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
    victory: 'victory.wav',
    defeat: 'defeat.wav',
  };

  // Mission tracks: looping background music that plays while a jet's radar
  // scope is on screen. One is picked at random each time the music starts.
  const MISSION_TRACKS = ['mission-catalpa-1.m4a', 'mission-catalpa-2.m4a'];

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

  // Klaxon on the moments that change the war: the strait slams shut, or
  // the casualty count crosses what the home front will bear watching.
  // Called from the HUD render so every state change passes through it.
  let lastHormuz = null, lastCas = null;
  function alertCheck(G) {
    if (lastHormuz !== null && lastHormuz !== 'CLOSED' && G.hormuz === 'CLOSED') play('klaxon');
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

  return { init, play, alertCheck, isMuted, setMuted, missionMusicStart, missionMusicStop };
})();
