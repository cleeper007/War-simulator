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
    klaxon: 'klaxon.wav',           // escalation crosses 7
    cable: 'cable.wav',             // diplomatic cable
    victory: 'victory.wav',
    defeat: 'defeat.wav',
  };

  const MUTE_KEY = 'cic-muted';
  const clips = {};
  let muted = false;
  let unlocked = false;   // browsers require a user gesture before audio
  let lastEsc = null;

  function preload() {
    for (const [name, file] of Object.entries(FILES)) {
      try {
        const a = new Audio(`audio/${file}`);
        a.preload = 'auto';
        a.addEventListener('error', () => delete clips[name]);
        clips[name] = a;
      } catch (e) { /* no Audio support — game plays silent */ }
    }
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

  // Klaxon when the ladder crosses 7 from below. Called from the HUD
  // render so every escalation change passes through it.
  function escalationCheck(esc) {
    if (lastEsc !== null && lastEsc < 7 && esc >= 7) play('klaxon');
    lastEsc = esc;
  }

  function isMuted() { return muted; }

  function setMuted(m) {
    muted = !!m;
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

  return { init, play, escalationCheck, isMuted, setMuted };
})();
