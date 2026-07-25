// ============================================================
// audio.js — sound effects: preload, play, mute toggle
// ============================================================
// Clips live in /audio (synthesized in-house, royalty-free). Every path
// here fails silently — a missing file or blocked autoplay never breaks
// the game.

const AudioSys = (() => {
  const FILES = {
    launch: 'launch.wav',           // strike package launched
    impact: 'impact.wav',           // strike impact / BDA
    aircraftLost: 'aircraft-lost.wav',
    retaliation: 'retaliation.wav', // Iranian retaliation alert
    klaxon: 'klaxon.wav',           // Hormuz closes / casualties cross 100
    cable: 'cable.wav',             // diplomatic cable
    sonarPing: 'sonar-ping.wav',    // Mk-48 seeker going active on the sonar scope
    victory: 'victory.wav',
    defeat: 'defeat.wav',
    // Voice traffic — watch-floor calls on the moments that change the board.
    fordArrival: 'ford-arrival.mp3',            // Ford checks in with Fifth Fleet
    b2Arrival: 'b2-arrival.mp3',                // 509th on the ramp at Diego Garcia
    strikeForce: 'strike-force-initiated.mp3',  // the night's packages step off
    hormuzClosure: 'hormuz-closure.mp3',        // the strait slams shut
    targetMarked: 'target-marked.mp3',          // a package is authorized onto a target
    bdaReport: 'bda-report.mp3',                // the damage assessment lands on the table
    // Rotor wash and interphone under the JSOC infil. ~28s, which is the length
    // of the infil sequence in specops.js — it runs out on its own as the team
    // hits the ramp, so the branch beats after the objective play into silence.
    raidInfil: 'spec-ops-infil.m4a',
  };

  // Per-clip playback level, 0..1. Anything not listed plays at full volume.
  // The klaxon rides under the Hormuz closure call rather than over it — at
  // full gain it buried the voice and simply hurt.
  const VOLUME = {
    klaxon: 0.25,
    // Ambience, not an event: the rotors sit under the launch SFX and the feed
    // rather than on top of them.
    raidInfil: 0.6,
  };

  // Mission tracks: looping background music that plays while a jet's radar
  // scope is on screen. One is picked at random each time the music starts.
  const MISSION_TRACKS = ['radio-chatter-1.m4a', 'radio-chatter-2.m4a'];

  const MUTE_KEY = 'cic-muted';
  const clips = {};
  let muted = false;
  let unlocked = false;   // browsers require a user gesture before audio

  // ---- mission music (jet radar scopes) ----
  // Reference-counted across overlapping sorties: the track starts when the
  // first jet scope opens and stops when the last one closes.
  const missionAudio = [];   // preloaded <Audio> per track
  let missionCount = 0;      // live jet scopes currently on screen
  let missionCur = null;     // the clip currently playing

  function preload() {
    for (const [name, file] of Object.entries(FILES)) {
      try {
        const a = new Audio(`audio/${file}`);
        a.preload = 'auto';
        if (VOLUME[name] !== undefined) a.volume = VOLUME[name];
        a.addEventListener('error', () => delete clips[name]);
        clips[name] = a;
      } catch (e) { /* no Audio support — game plays silent */ }
    }
    for (const file of MISSION_TRACKS) {
      try {
        const a = new Audio(`audio/${file}`);
        a.preload = 'auto';
        a.loop = false;   // plays through once — never repeats within a mission
        a.addEventListener('error', () => { const i = missionAudio.indexOf(a); if (i >= 0) missionAudio.splice(i, 1); });
        missionAudio.push(a);
      } catch (e) { /* no Audio support — game plays silent */ }
    }
  }

  // Pick a random track and start it (no ref-counting). No-op if one is already
  // playing, if muted, if audio isn't unlocked yet, or if no tracks loaded.
  function playMissionTrack() {
    if (missionCur || muted || !unlocked || !missionAudio.length) return;
    // Only ever one chatter stream at a time: silence every track first so a
    // big package launching several scopes at once can never stack audio.
    for (const a of missionAudio) {
      try { a.pause(); a.currentTime = 0; } catch (e) { /* silent */ }
    }
    missionCur = missionAudio[Math.floor(Math.random() * missionAudio.length)];
    try {
      missionCur.currentTime = 0;
      const p = missionCur.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* silent */ }
  }

  // A jet's radar scope just opened. Start the music if nothing is playing yet.
  function missionMusicStart() {
    missionCount++;
    playMissionTrack();
  }

  // A jet's radar scope closed. Stop only once the last live scope is gone.
  function missionMusicStop() {
    if (missionCount > 0) missionCount--;
    if (missionCount > 0 || !missionCur) return;
    const c = missionCur;
    missionCur = null;
    try { c.pause(); c.currentTime = 0; } catch (e) { /* silent */ }
  }

  // Kill the chatter outright regardless of how many scopes are open — used when
  // the player skips the turn, which tears every live scope down at once.
  function missionMusicStopAll() {
    missionCount = 0;
    if (!missionCur) return;
    const c = missionCur;
    missionCur = null;
    try { c.pause(); c.currentTime = 0; } catch (e) { /* silent */ }
  }

  function play(name, delayMs = 0) {
    if (muted || !unlocked || !clips[name]) return;
    const go = () => {
      const c = clips[name];
      if (!c) return;
      try {
        c.currentTime = 0;
        const p = c.play();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* silent */ }
    };
    delayMs > 0 ? setTimeout(go, delayMs) : go();
  }

  // Finishers for the clips currently gating something, keyed by clip name, so
  // a clip can be cut short and hand straight on to whatever was waiting on it.
  const pendingThen = {};

  // Play a clip and run `cb` once it has finished — for the places where the
  // audio has to clear before the next thing starts rather than run under it.
  //
  // `cb` is always called exactly once, and never held hostage by the sound:
  // if the clip can't play at all (muted, audio not unlocked yet, file missing,
  // autoplay refused) it runs immediately, and a watchdog covers a clip that
  // starts and then stalls — a background tab throttling the decode must not
  // wedge a turn behind a sound effect.
  function playThen(name, cb) {
    const go = typeof cb === 'function' ? cb : () => {};
    if (muted || !unlocked || !clips[name]) { go(); return; }
    const c = clips[name];
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (pendingThen[name] === finish) delete pendingThen[name];
      c.removeEventListener('ended', finish);
      c.removeEventListener('error', finish);
      go();
    };
    pendingThen[name] = finish;
    c.addEventListener('ended', finish);
    c.addEventListener('error', finish);
    try {
      c.currentTime = 0;
      const p = c.play();
      if (p && p.catch) p.catch(finish);
    } catch (e) { finish(); return; }
    const dur = isFinite(c.duration) && c.duration > 0 ? c.duration : 10;
    setTimeout(finish, dur * 1000 + 1000);
  }

  // Cut a playThen clip short: silence it and hand straight on to whatever was
  // waiting on it. A skip is the player saying they have heard this one — the
  // clip should get out of the way rather than be the thing they wait out.
  // Safe to call when the clip isn't playing, or was never gating anything.
  function cut(name) {
    const c = clips[name];
    if (c) { try { c.pause(); c.currentTime = 0; } catch (e) { /* silent */ } }
    const finish = pendingThen[name];
    if (finish) finish();
  }

  // Klaxon on the moments that change the war: the strait slams shut, or
  // the casualty count crosses what the home front will bear watching.
  // Called from the HUD render so every state change passes through it.
  let lastHormuz = null, lastCas = null;
  function alertCheck(G) {
    if (lastHormuz !== null && lastHormuz !== 'CLOSED' && G.hormuz === 'CLOSED') {
      play('klaxon');
      play('hormuzClosure', 400);   // alarm first, then the watch floor says it
    }
    if (lastCas !== null && lastCas < 100 && G.casualties.us >= 100) play('klaxon');
    lastHormuz = G.hormuz;
    lastCas = G.casualties.us;
  }

  function isMuted() { return muted; }

  function setMuted(m) {
    muted = !!m;
    // Muting silences the mission track immediately; unmuting resumes it if a
    // jet scope is still live.
    if (missionCur) {
      try { muted ? missionCur.pause() : missionCur.play().catch(() => {}); } catch (e) {}
    } else if (!muted && missionCount > 0) {
      playMissionTrack();   // a jet scope is still live — resume music
    }
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
    const btn = document.getElementById('btn-mute');
    if (btn) {
      btn.textContent = muted ? '🔇' : '🔊';
      btn.title = muted ? 'Sound off — click to unmute' : 'Sound on — click to mute';
    }
  }

  function init() {
    try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}
    preload();

    // Respect autoplay policy: unlock only after the first real interaction.
    const unlock = () => { unlocked = true; };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    const btn = document.getElementById('btn-mute');
    if (btn) btn.addEventListener('click', () => setMuted(!muted));
    setMuted(muted);
  }

  return { init, play, playThen, cut, alertCheck, isMuted, setMuted, missionMusicStart, missionMusicStop, missionMusicStopAll };
})();
