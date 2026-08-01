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
    // Heads of government on the secure line once the coalition forms. Played
    // through playThen so the popup can hold the "line open" state for exactly
    // as long as the leader is actually talking. Two takes each — the `Strong`
    // ones play when world opinion was above LEADER_STRONG_WORLD when the
    // coalition formed (see WORLD_LEADERS in data.js).
    ukPmCall: 'uk-pm-call.mp3',                      // ~11.2 s
    francePmCall: 'france-pm-call.mp3',              // ~4.7 s
    ukPmCallStrong: 'uk-pm-call-strong.mp3',         // ~7.4 s
    francePmCallStrong: 'france-pm-call-strong.mp3', // ~8.2 s
    // The switchboard, ringing under the incoming-call popup until it is
    // answered or declined. Looped by hand — see ringStart.
    phoneRing: 'phone-ring.m4a',   // ~2.3 s
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

  // The score: one faint bed under the entire session, distinct from
  // MISSION_TRACKS, which are radio chatter tied to a live radar scope. It has
  // to sit *under* every event sound rather than beside them — a klaxon or a
  // watch-floor call has to read as an interruption, and it can't if the music
  // is at the same size in the mix. Hence two levels: MUSIC_VOLUME with nothing
  // else going on, and MUSIC_DUCK while a mission track is up, so the two beds
  // are never competing at equal gain.
  const MUSIC_FILE = 'soundtrack.mp3';
  const MUSIC_VOLUME = 0.10;
  const MUSIC_DUCK = 0.04;

  const MUTE_KEY = 'cic-muted';
  const MUSIC_KEY = 'cic-music-off';
  const clips = {};
  let muted = false;
  let unlocked = false;   // browsers require a user gesture before audio

  // ---- the score ----
  let music = null;       // the looping bed, null if it failed to load
  let musicOff = false;   // player's own switch, independent of the master mute

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
    try {
      const m = new Audio(`audio/${MUSIC_FILE}`);
      m.preload = 'auto';
      m.loop = true;
      m.volume = MUSIC_VOLUME;
      m.addEventListener('error', () => { music = null; });
      music = m;
    } catch (e) { /* no Audio support — game plays silent */ }
  }

  // The score's level depends on what else is playing: it steps aside for the
  // mission chatter rather than layering two beds at the same gain.
  function musicLevel() {
    if (!music) return;
    try { music.volume = missionCur ? MUSIC_DUCK : MUSIC_VOLUME; } catch (e) { /* silent */ }
  }

  // Start (or resume) the bed. No-op until the first gesture unlocks audio, and
  // no-op if either switch is off. Resumes from where it was rather than
  // restarting — a mute and unmute mid-campaign shouldn't rewind the track.
  function musicStart() {
    if (!music || musicOff || muted || !unlocked) return;
    musicLevel();
    try {
      const p = music.play();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* silent */ }
  }

  function musicStop() {
    if (!music) return;
    try { music.pause(); } catch (e) { /* silent */ }
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
    musicLevel();   // the score steps down while the chatter is up
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
    musicLevel();
  }

  // Kill the chatter outright regardless of how many scopes are open — used when
  // the player skips the turn, which tears every live scope down at once.
  function missionMusicStopAll() {
    missionCount = 0;
    if (!missionCur) return;
    const c = missionCur;
    missionCur = null;
    try { c.pause(); c.currentTime = 0; } catch (e) { /* silent */ }
    musicLevel();
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

  // ---- the switchboard ringing ----
  // `loop` on the element rings the clip end to end, which is a fire alarm, not
  // a telephone. A phone rings in bursts, so the silence is scheduled by hand:
  // play the burst, wait for it to actually finish, hold RING_GAP, ring again —
  // until the player answers or declines. The gap is measured from the end of
  // the burst rather than its start so a clip that decodes slowly still gets the
  // same silence after it.
  const RING_GAP = 1500;
  let ringing = false, ringTimer = null, ringOnEnd = null;

  function ringStart() {
    const c = clips.phoneRing;
    if (ringing || muted || !unlocked || !c) return;
    ringing = true;
    const ring = () => {
      if (!ringing) return;
      try {
        c.currentTime = 0;
        const p = c.play();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* silent */ }
    };
    ringOnEnd = () => { ringTimer = setTimeout(ring, RING_GAP); };
    c.addEventListener('ended', ringOnEnd);
    ring();
  }

  // Safe to call on a ring that never started, and safe to call twice — the
  // popup calls it from every path out of the incoming state.
  function ringStop() {
    ringing = false;
    clearTimeout(ringTimer);
    ringTimer = null;
    const c = clips.phoneRing;
    if (!c) return;
    if (ringOnEnd) { c.removeEventListener('ended', ringOnEnd); ringOnEnd = null; }
    try { c.pause(); c.currentTime = 0; } catch (e) { /* silent */ }
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
  function isMusicOff() { return musicOff; }

  // The score's own switch. The speaker button is the master — it silences
  // everything including this — so a player who wants the game but not the
  // music turns this one off and leaves the other alone.
  function setMusicOff(off) {
    musicOff = !!off;
    musicOff ? musicStop() : musicStart();
    try { localStorage.setItem(MUSIC_KEY, musicOff ? '1' : '0'); } catch (e) {}
    const btn = document.getElementById('btn-music');
    if (btn) {
      btn.classList.toggle('off', musicOff);
      btn.title = musicOff ? 'Music off — click to play' : 'Music on — click to stop';
      btn.setAttribute('aria-pressed', musicOff ? 'false' : 'true');
    }
  }

  function setMuted(m) {
    muted = !!m;
    // Muting silences the mission track immediately; unmuting resumes it if a
    // jet scope is still live.
    if (missionCur) {
      try { muted ? missionCur.pause() : missionCur.play().catch(() => {}); } catch (e) {}
    } else if (!muted && missionCount > 0) {
      playMissionTrack();   // a jet scope is still live — resume music
    }
    // The speaker is the master switch, so it takes the score down with it —
    // and hands it back on unmute unless the player turned the music off
    // separately, which musicStart checks for us.
    muted ? musicStop() : musicStart();
    // muting mid-ring hangs up the bell, not the call: the popup is still there
    // and still waiting on an answer, it has just stopped making noise
    if (muted) ringStop();
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch (e) {}
    const btn = document.getElementById('btn-mute');
    if (btn) {
      btn.textContent = muted ? '🔇' : '🔊';
      btn.title = muted ? 'Sound off — click to unmute' : 'Sound on — click to mute';
    }
  }

  function init() {
    try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}
    try { musicOff = localStorage.getItem(MUSIC_KEY) === '1'; } catch (e) {}
    preload();

    // Respect autoplay policy: unlock only after the first real interaction.
    // That gesture is also the earliest moment the score is allowed to start,
    // so it opens there rather than on load — anything sooner is refused.
    const unlock = () => { unlocked = true; musicStart(); };
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    const btn = document.getElementById('btn-mute');
    if (btn) btn.addEventListener('click', () => setMuted(!muted));
    const mbtn = document.getElementById('btn-music');
    if (mbtn) mbtn.addEventListener('click', () => setMusicOff(!musicOff));
    setMuted(muted);
    setMusicOff(musicOff);
  }

  return { init, play, playThen, cut, ringStart, ringStop, alertCheck, isMuted, setMuted, isMusicOff, setMusicOff, missionMusicStart, missionMusicStop, missionMusicStopAll };
})();
