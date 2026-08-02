// ============================================================
// THE WALKTHROUGH
// ------------------------------------------------------------
// The written brief (UI.showPrimer) is the reference — five headings a player
// can skim at turn 14 to check one fact. This is the orientation: the same
// lessons standing next to the widget each one is about, because "STRIKE ASSETS
// carries the count" means nothing to somebody who has not yet found STRIKE
// ASSETS among eight shut drawers.
//
// It runs on the live war, and it spends nothing. The strike dialog it opens is
// the real one, on a target the player picked, and the walkthrough presses ABORT
// on the way out. A sandbox turn would be more code and would teach a room that
// is not the room.
//
// NOTHING HERE TRAPS THE PLAYER, and that is the design constraint the rest
// falls out of:
//
//   - Every card carries END WALKTHROUGH in the same place, and Escape does the
//     same thing whenever it is the walkthrough's to end.
//   - The dim is a box-shadow, which is not hit-testable, so every click still
//     reaches the room underneath. A walkthrough that swallows clicks is one you
//     can be stuck inside.
//   - No step waits on the player doing something. NEXT is the only thing that
//     has to be pressed to get through the whole card stack; the first card asks
//     for a target and then opens one itself off NEXT rather than standing there
//     until the map is clicked.
//   - The loop is a watchdog as much as a positioner: if the player closes the
//     strike dialog out from under a step that lives inside it, the walkthrough
//     moves on rather than pointing at a widget that is gone.
// ============================================================
const Tour = (() => {
  const $ = (id) => document.getElementById(id);

  const strikeOpen = () => {
    const m = $('strike-modal');
    return !!m && !m.classList.contains('hidden');
  };

  // Any real dialog, by the same test initModals uses in ui.js — an .overlay
  // with a .modal in it, which is what keeps the title screen out of the count.
  const anyModalOpen = () => [...document.querySelectorAll('.overlay:not(.hidden)')]
    .some(o => o.querySelector(':scope > .modal'));

  // The estimate box does not exist until a package is picked, so this step
  // points at whichever of the two is actually on screen. Everything else names
  // an element that is always in the DOM.
  const estimateOrFooter = () => {
    const est = $('strike-estimate');
    if (est && !est.classList.contains('hidden')) return est;
    return document.querySelector('#strike-modal .modal-footer');
  };

  // `panel` names a sidebar section to open first (the data-panel key).
  // `modal` marks the steps that live inside the strike dialog — what the
  // watchdog reads, and what moves the card into the dialog's focus trap.
  // `opens` marks the card whose NEXT has to have a strike dialog open behind it
  // before the next card, which lives inside one, can point at anything.
  const STEPS = [
    { sel: '#map-panel', opens: true,
      title: 'THE MAP IS THE ORDER FORM',
      text: 'Every marker is an Iranian target, and clicking one opens the strike dialog. ' +
        'NEXT opens it on an air defense site — the right first move.' },
    { sel: '#strike-packages', modal: true,
      title: 'PICK A PACKAGE',
      text: 'Each row is a way to hit it. Greyed rows are grounded: that aircraft has not been ' +
        'released yet, or it cannot reach from where it sits.' },
    // NEXT here is ABORT, deliberately and in as many words. The two were always
    // the same action — closing the dialog is what moves the walkthrough off the
    // steps that live inside it — but with the button reading NEXT, a player who
    // took the card's advice and pressed ABORT watched the tutorial advance on
    // its own and read it as a misfire. Same behaviour, no longer a surprise.
    { sel: estimateOrFooter, modal: true, next: 'ABORT',
      title: 'NOTHING IS SPENT UNTIL YOU AUTHORIZE',
      text: 'Pick a package and the estimate reads back the odds and the risk to aircrew. ' +
        'ABORT costs you nothing.' },
    { sel: '#resources-panel', panel: 'resources',
      title: 'THREE PACKAGES A NIGHT',
      text: 'STRIKE ASSETS carries the count. Additional sorties still fly, degraded, and they ' +
        'come off tomorrow\'s plan.' },
    { sel: '#fleet-panel', panel: 'fleet',
      title: 'BRING IN MORE FIREPOWER',
      text: 'Not everything is in theater yet. Order it forward from here — including the B-2, ' +
        'the only aircraft that reaches Fordow.' },
    { sel: '#intel-panel', panel: 'intel',
      title: 'INTELLIGENCE TASKING',
      text: 'Hunt the missile launchers, assess Tehran\'s intent, or re-look a target you have ' +
        'already hit.' },
    { sel: '#diplo-panel', panel: 'diplo',
      title: 'DIPLOMATIC ACTIONS',
      text: 'Steady the home front, work the coalition, or lean on Tehran. This shelf and ALLIES ' +
        'share one action a turn between them.' },
    { sel: '#status-row',
      title: 'THE WAR AT HOME',
      text: 'Approval, oil, world opinion, casualties. A war being won on the map is routinely ' +
        'lost along this bar.' },
    { sel: '#advisors-panel', panel: 'advisors',
      title: 'YOUR STAFF IS WORTH READING',
      text: 'Four advisors watching the war from four directions, the pressing ones flagged ' +
        'URGENT. When they agree on something, do it.' },
    { sel: '#btn-end-turn', next: 'DONE',
      title: 'THEN END THE TURN',
      text: 'Tehran answers overnight and the assessment lands in the morning. Thirty turns is ' +
        'the whole war.' },
  ];

  let i = -1;          // current step, -1 when the walkthrough is not running
  let root = null, ring = null, card = null;
  let raf = 0;
  let ownsModal = false;   // the strike dialog is the walkthrough's to close
  let hadOpen = [];        // sidebar sections the player had expanded before we started
  let pin = 0;             // frames left holding a freshly-opened section at the top
  let settle = 0;          // frames left in which the card may still reposition
  let lastBox = '';        // the anchor geometry the card was last placed against
  let keyHandler = null, resizeHandler = null;

  function build() {
    root = document.createElement('div');
    root.id = 'tour';
    root.className = 'hidden';
    root.innerHTML =
      '<div id="tour-ring"></div>' +
      '<div id="tour-card" role="region" aria-live="polite" aria-label="Walkthrough">' +
        '<div class="tour-step" id="tour-count"></div>' +
        '<div class="tour-title" id="tour-title"></div>' +
        '<div class="tour-text" id="tour-text"></div>' +
        '<div class="tour-nav">' +
          '<button id="tour-back" class="btn-secondary">BACK</button>' +
          '<button id="tour-next" class="btn-primary">NEXT</button>' +
        '</div>' +
        '<button id="tour-end" class="tour-end">END WALKTHROUGH</button>' +
      '</div>';
    document.body.appendChild(root);
    ring = $('tour-ring');
    card = $('tour-card');
    $('tour-back').addEventListener('click', onBack);
    $('tour-next').addEventListener('click', onNext);
    $('tour-end').addEventListener('click', endTour);
  }

  // BACK has to step over the dialog steps once the dialog is shut, or it does
  // nothing at all: step four closed the strike dialog on its way in, so a plain
  // i-1 lands on a step that lives inside it, the watchdog sees no dialog and
  // bounces straight forward to four again. The button looked dead. From the
  // first sidebar card, back is the map.
  function onBack() {
    let n = i - 1;
    if (n >= 0 && STEPS[n].modal && !strikeOpen()) {
      while (n >= 0 && STEPS[n].modal) n--;
    }
    go(Math.max(0, n));
  }

  // NEXT off the first card opens the strike dialog itself, on a live air
  // defense site — the strike it was recommending anyway. It used to watch the
  // map instead and advance when the player clicked a target, with NEXT as the
  // escape hatch; one button doing the whole walkthrough is less to explain, and
  // a card that advances on its own while you are reading it reads as a misfire.
  // A player who clicks a target anyway gets the same dialog, and the
  // walkthrough owns it either way — it presses ABORT on the way out, which
  // spends nothing.
  function onNext() {
    const st = STEPS[i];
    if (st && st.opens) {
      if (strikeOpen()) ownsModal = true;
      else {
        const t = demoTarget();
        if (t && !Game.G.over) { UI.openStrikeModal(Game.G, t); ownsModal = true; }
      }
    }
    go(i + 1);
  }

  function demoTarget() {
    if (typeof TARGETS === 'undefined') return null;
    return TARGETS.find(t => t.type === 'airdefense' && t.status !== 'destroyed')
      || TARGETS.find(t => t.status !== 'destroyed');
  }

  const closeStrike = () => {
    const b = document.querySelector('#strike-modal [data-close]');
    if (b) b.click();
  };

  const resolve = (st) => (typeof st.sel === 'function' ? st.sel() : document.querySelector(st.sel));

  // Moving a subtree drops focus to the body, and the card is routinely holding
  // it — NEXT is focused the moment the walkthrough starts. Hand it back.
  function reparent(host) {
    if (root.parentNode === host) return;
    const keep = root.contains(document.activeElement) ? document.activeElement : null;
    host.appendChild(root);
    if (keep) keep.focus();
  }

  // ---- geometry ----
  // Re-run every frame rather than measured once per step. A sidebar section
  // animates open on grid-template-rows, the scroll pane moves under it, and the
  // window can be rotated mid-card; a rAF loop answers all three for the cost of
  // a couple of getBoundingClientRect calls, and it is the same loop the
  // watchdog and the gate ride on. It does not run in a hidden tab, which is
  // fine — there is nothing to keep in sync in a tab nobody is looking at.
  const PAD = 6, GAP = 12, EDGE = 8;

  // What the player can actually SEE of an element, which is not its rect. An
  // expanded sidebar section is routinely 700px of content hanging out of a
  // 200px scroll pane, and getBoundingClientRect happily reports all of it — so
  // the ring drawn off it enclosed the END TURN button and the session row, none
  // of which is in the panel it claimed to be pointing at. Intersect with every
  // ancestor that clips, then with the window.
  function visibleBox(el) {
    let box = el.getBoundingClientRect();
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ov = getComputedStyle(p).overflow;
      if (ov === 'visible') continue;
      const c = p.getBoundingClientRect();
      box = {
        top: Math.max(box.top, c.top), left: Math.max(box.left, c.left),
        bottom: Math.min(box.bottom, c.bottom), right: Math.min(box.right, c.right),
      };
    }
    return box;
  }

  const pinPanel = (el) => {
    const scroll = $('sidebar-scroll');
    if (!scroll || !scroll.contains(el)) return;
    scroll.scrollTop += el.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
  };

  function place(el) {
    const r = visibleBox(el);
    if (r.bottom <= r.top || r.right <= r.left) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    const top = Math.max(0, r.top - PAD), left = Math.max(0, r.left - PAD);
    const bottom = Math.min(vh, r.bottom + PAD), right = Math.min(vw, r.right + PAD);
    ring.style.top = top + 'px';
    ring.style.left = left + 'px';
    ring.style.width = Math.max(0, right - left) + 'px';
    ring.style.height = Math.max(0, bottom - top) + 'px';

    // THE RING TRACKS; THE CARD SETTLES AND THEN HOLDS STILL. Both used to be
    // rewritten every frame, which is right for the outline — it has to stay on
    // the thing it is outlining — and wrong for the card, because the thing it
    // is outlining changes size under the player. Picking a package on step two
    // opens the estimate box, the dialog grows, the roomiest side is suddenly a
    // different side, and the card the player is mid-sentence in jumps across
    // the screen and lands on the estimate it just told them to read.
    //
    // So the card follows only while the anchor is genuinely moving, and locks
    // the frame it stops — the same two-equal-frames test openPanel uses to know
    // a section has finished animating open. Not a fixed delay: a delay is a
    // guess that is either too short for a slow panel or long enough to still be
    // live when a quick player clicks something. The count is only a backstop
    // against something that animates forever. A reader is owed a stationary
    // paragraph more than a perfectly-adjacent one.
    if (settle <= 0) return;
    // rounded, or a subpixel jitter somewhere upstream reads as "still moving"
    // forever and the window never closes
    const box = [top, left, bottom, right].map(Math.round).join(',');
    if (box === lastBox) { settle = 0; return; }
    lastBox = box;
    settle--;

    // Put the card wherever there is the most room. Below is the habit, but on a
    // landscape phone the map panel is the whole window and nothing is below
    // anything, so fall back to the roomiest side and clamp into the window.
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const space = { below: vh - bottom, above: top, right: vw - right, left: left };
    let side = 'below';
    if (space.below < ch + GAP) {
      side = Object.keys(space).sort((a, b) => space[b] - space[a])[0];
    }
    let ct, cl;
    if (side === 'below') { ct = bottom + GAP; cl = r.left; }
    else if (side === 'above') { ct = top - GAP - ch; cl = r.left; }
    else if (side === 'right') { cl = right + GAP; ct = r.top; }
    else { cl = left - GAP - cw; ct = r.top; }
    card.style.left = Math.max(EDGE, Math.min(cl, vw - cw - EDGE)) + 'px';
    card.style.top = Math.max(EDGE, Math.min(ct, vh - ch - EDGE)) + 'px';
  }

  function frame() {
    if (i < 0) return;
    const st = STEPS[i];
    // the player closed the dialog out from under a step that lives inside it —
    // Escape, ABORT, or authorising the strike for real. All three are fine.
    if (st.modal && !strikeOpen()) { ownsModal = false; return go(afterModal()); }
    // A player who clicks a target on the first card rather than pressing NEXT
    // gets the real dialog up over the map. The card stays anchored to the map —
    // that is still what this step is about — but it has to ride inside the
    // dialog to stay in ui.js's focus trap, or its own NEXT is on screen and
    // unreachable from the keyboard.
    if (st.opens) reparent(strikeOpen() ? $('strike-modal') : document.body);
    const el = resolve(st);
    if (!el) return go(i + 1);
    if (pin > 0) { pin--; pinPanel(el); }
    place(el);
    raf = requestAnimationFrame(frame);
  }

  const afterModal = () => {
    let n = i;
    while (n < STEPS.length && STEPS[n].modal) n++;
    return n;
  };

  function go(n) {
    cancelAnimationFrame(raf); raf = 0;
    if (n < 0) n = 0;
    if (n >= STEPS.length) return endTour();
    i = n;
    const st = STEPS[i];
    if (!st.modal && ownsModal && strikeOpen()) { closeStrike(); ownsModal = false; }
    // openPanel's own `reveal` is deliberately not used. It brings a section's
    // leading 140px in from below, which is right for a panel that opened
    // because the war made it relevant and wrong here: the walkthrough is about
    // to draw a box round the whole section, and a box whose top edge is off the
    // pane points at nothing. Pin the head to the top of the scroller instead,
    // for as long as the section is still animating open — half a second, after
    // which the player's own scrolling is left alone.
    if (st.panel) { UI.openPanel(st.panel); pin = 30; } else { pin = 0; }
    settle = 40; lastBox = '';

    // The card rides inside the dialog it is talking about. ui.js traps Tab
    // within the top .overlay, so a card left on the body would be visible and
    // unreachable from the keyboard for these two steps; parented to the overlay
    // its buttons join the trap for free. It is a plain div either way — never
    // an .overlay with a .modal in it — so it never enters the dialog stack.
    reparent(st.modal || (st.opens && strikeOpen()) ? $('strike-modal') : document.body);

    $('tour-count').textContent = `STEP ${i + 1} OF ${STEPS.length}`;
    $('tour-title').textContent = st.title;
    $('tour-text').textContent = st.text;
    $('tour-back').disabled = i === 0;
    $('tour-next').textContent = st.next || 'NEXT';
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (i >= 0) return;
    // Never over a resolving turn or an open set piece. The HOW TO PLAY button
    // already guards the primer this way; the walkthrough reaches for the same
    // board — it opens panels, opens the strike modal and moves the map — so it
    // has to answer to the same lock rather than relying on the primer being the
    // only door into it.
    if (Game.busy && Game.busy()) return;
    if (!root) build();
    hadOpen = [...document.querySelectorAll('#sidebar-scroll .panel[data-panel]')]
      .filter(p => !p.classList.contains('collapsed')).map(p => p.dataset.panel);
    ownsModal = false;
    root.classList.remove('hidden');
    document.addEventListener('keydown', keyHandler, true);
    // A rotate or a resize is the one thing that genuinely invalidates a settled
    // card: the side it chose may no longer exist. Reopen the window rather than
    // repositioning here, so it still lands after the layout has finished moving.
    window.addEventListener('resize', resizeHandler);
    go(0);
    // after the report modal that launched this has finished handing focus back
    // — syncStack restores it on a microtask, so claiming it synchronously here
    // would just lose the race
    requestAnimationFrame(() => { if (i >= 0) $('tour-next').focus(); });
  }

  // Escape ends the walkthrough, but only when it is the walkthrough's to end.
  // Two steps run inside the real strike dialog, which has its own Escape in
  // ui.js; one key doing two things at once is how a player ends up unable to
  // tell which. So defer while any dialog is open — the dialog closing is what
  // the watchdog reads as "move on", so the second press lands here anyway.
  //
  // CAPTURE PHASE, and that is the whole of why this works. Both handlers sit on
  // document, ui.js's registered first at boot, so in the bubble phase it closes
  // the dialog before this one gets a look — and this one then sees no dialog
  // open and ends the walkthrough off the same keystroke. Capture asks the
  // question before anybody has changed the answer.
  resizeHandler = () => { settle = 40; lastBox = ''; };

  keyHandler = (e) => {
    if (i < 0 || e.key !== 'Escape' || anyModalOpen()) return;
    e.preventDefault();
    endTour();
  };

  // One teardown, called from the END WALKTHROUGH button, from Escape, and from
  // running off the end of the list. Three exit paths where two forget to put
  // something back is the usual way a walkthrough leaves a mess behind it.
  function endTour() {
    if (i < 0) return;
    cancelAnimationFrame(raf); raf = 0;
    i = -1;
    if (ownsModal && strikeOpen()) closeStrike();
    ownsModal = false;
    document.removeEventListener('keydown', keyHandler, true);
    window.removeEventListener('resize', resizeHandler);
    root.classList.add('hidden');
    document.body.appendChild(root);
    // the sidebar back the way the player had it: the walkthrough opened four
    // sections they did not ask for, and every turn otherwise starts from a shut
    // sidebar (see closeAllPanels)
    UI.closeAllPanels();
    for (const key of hadOpen) UI.openPanel(key);
    const btn = $('btn-primer');
    if (btn && btn.offsetParent !== null) btn.focus();
  }

  return { start, end: endTour, running: () => i >= 0 };
})();
