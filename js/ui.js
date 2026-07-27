// ============================================================
// ui.js — HUD, sidebar, modals, ticker rendering
// ============================================================

const UI = (() => {
  const $ = (id) => document.getElementById(id);

  // Counted nouns, written the way a person would write them. `aircraft` and
  // `sorties` are invariant in the plural and a blanket +s produces "2
  // aircrafts", so the exceptions are listed rather than guessed at.
  const INVARIANT = ['aircraft'];
  const plural = (n, word) =>
    `${n} ${word}${n === 1 || INVARIANT.includes(word) ? '' : 's'}`;
  // "1 turn" / "3 turns" without the noun — for the ETA lines that read
  // "3 turns out" rather than counting a thing.
  const turns = (n) => plural(n, 'turn');

  // A signed cost, typeset. The tuning tables store plain JS numbers, so a
  // world-opinion cost interpolated raw arrives as a hyphen-minus ("-1") and
  // sits next to a real minus ("−45") two lines up in the same panel. Every
  // signed number the player reads goes through here.
  const MINUS = '−';
  const signed = (n) => (n > 0 ? '+' : MINUS) + Math.abs(n);

  let selectedPkg = null;
  let currentTarget = null;

  // ============================================================
  // COLLAPSIBLE SIDEBAR PANELS
  // ------------------------------------------------------------
  // The sidebar is eight sections deep and only one of them is ever the one
  // being used. Each is a dropdown: the header is the hit target and the caret
  // turns. A shut section is not silent: its badge carries the one thing worth
  // knowing from the outside, which for an action panel is how many orders in
  // it can actually be given tonight.
  //
  // Open/shut state is deliberately NOT persisted. It used to survive a reload,
  // which meant a war opened with whatever assortment of sections happened to
  // be open when the last one was left — a sidebar the player did not arrange,
  // scrolled past the fold before the first order. The sections are cheap to
  // open and the badges say what is inside them, so every war and every turn
  // starts from the same shut sidebar. See closeAllPanels.
  // ============================================================
  function setPanelOpen(panel, open) {
    panel.classList.toggle('collapsed', !open);
    panel.querySelector('.panel-head').setAttribute('aria-expanded', String(open));
  }

  // Called at the start of a war and at the top of every turn: the sidebar is
  // reset to shut so the player opens what tonight's decision actually needs.
  function closeAllPanels() {
    for (const panel of document.querySelectorAll('#sidebar-scroll .panel[data-panel]')) {
      setPanelOpen(panel, false);
    }
    const scroll = $('sidebar-scroll');
    if (scroll) scroll.scrollTop = 0;
  }

  // For a section that has just become relevant on its own account rather than
  // because the player went looking for it. Everything in the sidebar opens by
  // being clicked; this is the exception, and CSAR is currently the only caller.
  function openPanel(key) {
    const panel = document.querySelector(`.panel[data-panel="${key}"]`);
    if (panel) setPanelOpen(panel, true);
  }

  function initPanels() {
    for (const panel of document.querySelectorAll('#sidebar-scroll .panel[data-panel]')) {
      panel.querySelector('.panel-head').addEventListener('click', () => {
        const opening = panel.classList.contains('collapsed');
        setPanelOpen(panel, opening);
        // a section opened at the bottom of the list would otherwise expand
        // off-screen: pull it back into the scroll once it has finished growing
        if (opening) setTimeout(() => panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 200);
      });
    }
  }

  // The sidebar fades its bottom edge while there is more list below the fold
  // (see #sidebar-scroll's mask). Lift the fade once it is scrolled out, so a
  // fully-read sidebar does not sit there implying it is still hiding something.
  function initScrollEdge() {
    const scroll = $('sidebar-scroll');
    const update = () => {
      const atEnd = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 2;
      scroll.classList.toggle('at-end', atEnd);
    };
    scroll.addEventListener('scroll', update, { passive: true });
    new ResizeObserver(update).observe(scroll);
    update();
  }

  // The same contract for every modal body. On a desktop window almost nothing
  // overflows and the fade never appears; on a landscape phone the endgame, the
  // primer and a strike estimate all run past the bottom of a ~260px window,
  // and without this the player has no way to know the rest of the page is
  // there. `no-overflow` is the common case and lifts the fade entirely.
  //
  // Modals are populated after this runs, so each body is watched rather than
  // measured once: the ResizeObserver fires when the content is written in, and
  // MutationObserver catches a rewrite that happens to come out the same height.
  function initModalScrollEdge() {
    for (const body of document.querySelectorAll('.modal-body')) {
      const update = () => {
        const overflows = body.scrollHeight > body.clientHeight + 2;
        body.classList.toggle('no-overflow', !overflows);
        body.classList.toggle('at-end',
          body.scrollTop + body.clientHeight >= body.scrollHeight - 2);
      };
      body.addEventListener('scroll', update, { passive: true });
      new ResizeObserver(update).observe(body);
      new MutationObserver(update).observe(body, { childList: true, subtree: true });
      update();
    }
  }

  function setBadge(key, text, cls) {
    const panel = document.querySelector(`.panel[data-panel="${key}"]`);
    if (!panel) return;
    const badge = panel.querySelector('.panel-badge');
    badge.textContent = text || '';
    badge.className = 'panel-badge' + (cls ? ` ${cls}` : '');
  }

  // Action panels get counted rather than described: whatever the section
  // rendered, how much of it is still live.
  const ACTION_PANELS = {
    fleet: 'fleet-buttons', csar: 'csar-buttons', diplo: 'diplo-buttons',
    intel: 'intel-buttons', specops: 'specops-buttons',
  };
  function renderBadges() {
    for (const key in ACTION_PANELS) {
      const box = $(ACTION_PANELS[key]);
      if (!box) continue;
      // the disclosure carets are not orders and must not be counted — they are
      // never disabled, so counting them would report every panel as READY
      const total = box.querySelectorAll('button:not(.action-why)').length;
      const live = box.querySelectorAll('button:not(.action-why):not(:disabled)').length;
      if (!total) { setBadge(key, ''); continue; }
      setBadge(key, live ? `${live} READY` : 'NONE', live ? '' : 'badge-none');
    }
  }

  // ---- HUD / bottom bar ----
  function renderHUD(G) {
    // clock
    const day = Math.ceil(G.turn / 2);
    const hour = G.turn % 2 === 1 ? '06:00' : '18:00';
    $('map-clock').textContent = `DAY ${day} — ${hour} LOCAL`;
    $('turn-value').textContent = `${G.turn}/${G.maxTurns}`;

    // Iran war capacity meter: the enemy's remaining ability to fight.
    // Full and red at the start — the mission is draining it to zero.
    const meter = $('capacity-meter');
    meter.innerHTML = '';
    const cap = G.iranCapacity();
    const lvl = Math.round(cap / 10);
    for (let i = 1; i <= 10; i++) {
      const seg = document.createElement('div');
      let cls = 'seg';
      if (i <= lvl) {
        cls += cap >= 60 ? ' on-high' : cap >= 30 ? ' on-mid' : ' on-low';
      }
      seg.className = cls;
      meter.appendChild(seg);
    }
    $('capacity-value').textContent = `${cap}%`;
    $('capacity-value').style.color = cap >= 60 ? 'var(--red)' : cap >= 30 ? 'var(--amber)' : 'var(--green)';

    const ap = $('approval-value');
    ap.textContent = `${Math.round(G.approval)}%`;
    ap.className = 'stat-value big ' + (G.approval < 30 ? 'crit' : G.approval < 45 ? 'warn' : 'good');

    // Oil defeats the war outright at $240; pulse the number once it is close
    // enough that the next spike could end it, so the loss never arrives unseen.
    const oil = $('oil-value');
    oil.textContent = `$${Math.round(G.oil)}`;
    oil.className = 'stat-value big ' + (G.oil >= 150 ? 'crit' : G.oil >= 110 ? 'warn' : '') +
      (G.oil >= 190 ? ' pulsing' : '');

    // A closed Strait breaks the economy after five turns shut. Show the count
    // against that limit the same way casualties are counted against theirs.
    const hz = $('hormuz-value');
    hz.textContent = G.hormuz === 'CLOSED' && G.hormuzClosedTurns > 0
      ? `CLOSED ${G.hormuzClosedTurns}/7` : G.hormuz;
    hz.className = 'stat-value big ' + (G.hormuz === 'CLOSED' ? 'crit' : G.hormuz === 'CONTESTED' ? 'warn' : 'good') +
      (G.hormuz === 'CLOSED' && G.hormuzClosedTurns >= 3 ? ' pulsing' : '');

    const w = $('world-value');
    w.textContent = Math.round(G.world);
    w.className = 'stat-value big ' + (G.world < 30 ? 'crit' : G.world < 45 ? 'warn' : '');

    $('casualty-value').textContent = G.casualties.us;
    $('casualty-value').className = 'stat-value big ' + (G.casualties.us > 180 ? 'crit' : G.casualties.us > 110 ? 'warn' : '');

    AudioSys.alertCheck(G);
  }

  // ---- sidebar ----
  function renderObjectives(G) {
    const deg = G.nukeDegraded();
    const brk = Game.breakoutEstimate();
    const items = [
      { text: `Destroy nuclear program (${deg}% / 100%)`, done: deg >= 100 },
      { text: 'Break Iran\'s war machine (missiles · navy · IRGC command)', done: G.iranBroken() },
      { text: `Limit US casualties (${G.casualties.us} / ${Game.casualtyLimit()} tolerated)`, done: null },
      { text: `Keep Strait of Hormuz open`, done: null },
    ];
    $('objectives-list').innerHTML = items.map(i =>
      `<li class="${i.done === true ? 'done' : 'pending'}">${i.text}</li>`).join('');

    // ---- the breakout clock ----
    // The one number in this game the player is never given exactly. It reads
    // as a band, and the band is the whole point: it is narrow because someone
    // paid an action slot for it to be, or it is wide because nobody did.
    const box = $('breakout-line');
    if (!box) return;
    if (brk.halted) {
      box.className = 'breakout halted';
      box.innerHTML = '<span class="bo-label">ENRICHMENT</span>' +
        '<span class="bo-value">HALTED — no capability remaining</span>';
      setBadge('objectives', 'HALTED');
      return;
    }
    const urgent = brk.hi <= 6 ? ' urgent' : brk.hi <= 12 ? ' warn' : '';
    // shut, the objectives panel still has to show the clock the war is run against
    setBadge('objectives', `${brk.lo}–${brk.hi}T`, urgent ? '' : 'badge-none');
    box.className = 'breakout' + urgent;
    box.innerHTML = '<span class="bo-label">EST. TIME TO A DEVICE</span>' +
      `<span class="bo-value">${brk.lo}–${brk.hi} turns</span>` +
      `<span class="bo-conf">${brk.conf} confidence</span>`;
  }

  // ---- the air-superiority ladder ----
  // The single most important number on the screen after the enrichment clock,
  // because it decides which two thirds of the force are allowed to fly. Shown
  // as a bar with the two release thresholds marked on it, so the player can
  // see how much more of the SAM belt has to come down — and can watch it slide
  // back the other way on the nights nobody goes back.
  function renderAirPhase(G) {
    const s = Game.airSuperiority();
    const phase = Game.airPhase();
    const cls = phase === 'superiority' ? 'ap-sup' : phase === 'degraded' ? 'ap-deg' : 'ap-con';
    const gated = !Game.difficulty().softGate;
    const next = phase === 'contested'
      ? (gated ? 'Fourth-generation squadrons release at 40%.'
               : 'Fourth-generation squadrons release at 40% — until then they fly into an intact belt.')
      : phase === 'degraded'
        ? 'Heavy bombers release at 80%. Air defense repairs overnight — this number falls if you look away.'
        : 'The heavy force is released. Every night the SAM belt is left alone, this number falls.';
    return `<div class="airsup ${cls}">` +
      `<div class="as-head"><span class="as-label">${Game.PHASE_LABEL[phase]}</span>` +
      `<span class="as-value">${Math.round(s * 100)}%</span></div>` +
      `<div class="as-bar"><span class="as-fill" style="width:${Math.round(s * 100)}%"></span>` +
      `<span class="as-tick" style="left:${AIR_PHASE.degraded * 100}%"></span>` +
      `<span class="as-tick" style="left:${AIR_PHASE.superiority * 100}%"></span></div>` +
      `<div class="as-note dim">${next}</div></div>`;
  }

  function renderResources(G) {
    // the bomber lines read as a deployment status until there is a force to count
    const b2 = G.bombersArrived ? `${G.res.stealth} / ${G.caps.stealth}`
      : G.bombersOrdered ? `EN ROUTE ${G.bomberEta}T` : 'NOT DEPLOYED';
    const hv = G.heaviesArrived ? `${G.res.heavy} / ${G.caps.heavy}`
      : G.heaviesOrdered ? `EN ROUTE ${G.heavyEta}T` : 'NOT DEPLOYED';
    // A tier that is present but not released is not the same as a tier that is
    // empty, and the panel has to say which — the whole early campaign is a
    // player looking at fifteen Strike Eagles they are not allowed to use.
    // A force that isn't in theater at all needs no badge: the count says it.
    const held = (need, present) => !present || Game.phaseAtLeast(need) ? ''
      : Game.difficulty().softGate ? ' <span class="res-gate warn">UNSUPPRESSED</span>'
      : ' <span class="res-gate crit">HELD</span>';
    // A count is not an answer. What the player needs to know is whether the
    // magazine holds a PACKAGE, because that is the unit the strike modal
    // spends — "1 / 2" reads like something you can use and buys nothing.
    // Only when the count is non-zero: an empty magazine already reads as
    // empty, and it is the leftover sortie that lies.
    const short = (asset, present) => {
      if (!present) return '';
      const have = G.res[Game.resKey(asset)], min = Game.minPackage(asset);
      return min && have > 0 && have < min
        ? ` <span class="res-gate crit">SHORT OF A PACKAGE (${min} NEEDED)</span>` : '';
    };
    // The Tomahawk reservoir is finite for the whole war (Lincoln 20, Ford +10).
    // Show what is left in theater behind the ready launchers, and escalate the
    // styling as it runs down — the point of the number is that it must be rationed.
    const tlamReserve = () => {
      const n = G.tlamPool ?? 0;
      const cls = n <= 4 ? 'res-gate crit' : n <= 10 ? 'res-gate warn' : 'res-gate';
      return ` <span class="${cls}">${n} IN THEATER</span>`;
    };
    const rows = [
      ['5th-gen sorties (F-35/F-22)', `${G.res.f35} / ${G.caps.f35}`, short('f35', true)],
      ['4th-gen sorties (F-15E/F-16)', `${G.res.fighters} / ${G.caps.fighters}`,
        held('degraded', true) || short('fighter', true)],
      ['Cruise missiles (TLAM)', `${G.res.cruise} / ${G.caps.cruise}`, short('cruise', true) + tlamReserve()],
      // The boat's own load — it is not a theater magazine and it never refills,
      // so it is counted here rather than hidden inside the strike modal.
      ['Mk-48 torpedoes (Toledo)', `${G.torpedoes ?? 0} / ${TORPEDO_LOAD}`,
        (G.torpedoes ?? 0) === 0 ? ' <span class="res-gate crit">TUBES DRY</span>' : ''],
      ['B-2 missions (GBU-57)', b2, short('stealth', G.bombersArrived)],
      ['Heavy bombers (B-1/B-52)', hv,
        held('superiority', G.heaviesArrived) || short('heavy', G.heaviesArrived)],
      ['SOF task force (Tier 1)', `${G.res.specops} / ${G.caps.specops}`, ''],
    ];
    let html = renderAirPhase(G);
    html += rows.map(([n, v, gate]) =>
      `<div class="res-row"><span>${n}${gate}</span>` +
      `<span class="res-count${gate.includes('crit') ? ' crit' : ''}">${v}</span></div>`).join('');
    // Tanker tracks are the other magazine. Shown with the reach it buys,
    // because "3 tracks" means nothing on its own and "3 tracks — a heavy on the
    // interior, or three deep fighter packages" means everything. Thresholds
    // moved with the v1.19 charge rescale: crit is the point where nothing but
    // fighters and Tomahawks will fly, warn is losing the deep heavy option.
    const tk = G.tankers, cap = G.tankerCap || Game.tankerCapacity();
    const tkCls = tk <= 1 ? 'crit' : tk <= 3 ? 'warn' : '';
    html += `<div class="res-row tanker-row"><span>Tanker tracks tonight</span>` +
      `<span class="res-count ${tkCls}">${tk} / ${cap}</span></div>`;
    html += `<div class="res-note dim">Fighters: littoral unrefuelled · interior 1 · deep 2. ` +
      `Bombers tank at every depth — B-1/B-52 littoral 2 · interior 3 · deep 4 · ` +
      `B-2 mission 4 · Tomahawks fly unrefuelled.` +
      (!G.basing.gulf ? ' <span class="crit">Gulf ramps closed — nothing deep is reachable.</span>'
        : !G.basing.nato ? ' <span class="warn">NATO and Saudi tracks withdrawn.</span>' : '') +
      `</div>`;
    if (G.missions.length) {
      html += `<div class="res-row" style="margin-top:6px"><span style="color:var(--amber)">MISSIONS IN FLIGHT</span></div>`;
      html += G.missions.map(m => {
        const t = TARGETS.find(x => x.id === m.targetId);
        return `<div class="res-row"><span class="dim">→ ${t.short}</span>` +
          `<span class="res-count">${m.eta > 1 ? `TOT ${m.eta} turns` : 'TOT this turn'}</span></div>`;
      }).join('');
    }
    $('resources-list').innerHTML = html;
    // shut, the assets panel shows the magazine that actually runs out first
    setBadge('resources', `${tk} TKR`, tkCls === 'crit' ? '' : 'badge-none');
    // bombers still on the long leg in get a transit card in the scope panel
    MapView.updateTransit(G.missions);
  }

  // ---- carrier strike groups ----
  // The panel answers three questions at a glance: where is each deck, what is
  // it worth there, and can it be shot at.
  //
  // These notes say what an asset IS doing. What it would cost to change that
  // is the order row underneath, which now carries the trade explicitly — so
  // the note no longer lists the Aegis umbrella, the weight on the strait and
  // the oil lid only for the button below it to list them again as the price.
  // State here, consequence there.
  function carrierLine(cv) {
    if (cv.lost) return { label: 'LOST', cls: 'cv-lost', note: 'Sunk in the North Arabian Sea.' };
    if (!cv.arrived) return null;   // handled by the order/ETA button below
    if (cv.moving) {
      return {
        label: cv.moving === 'forward' ? 'CLOSING NORTHWEST' : 'WITHDRAWING',
        cls: 'cv-moving',
        note: 'Repositioning — full strike either way, but still inside the envelope until she is clear.',
      };
    }
    if (cv.posture === 'forward') {
      return {
        label: 'ON STATION — N. ARABIAN SEA', cls: 'cv-forward',
        note: (cv.damaged ? 'Battle damage: flying at a fraction of her rate. ' : '') +
          'Full sortie generation — and a hull inside Iranian anti-ship fires.',
      };
    }
    return {
      label: 'DEEP ARABIAN SEA', cls: 'cv-back',
      note: (cv.damaged ? 'Battle damage: flying at a fraction of her rate. ' : '') +
        'Out of reach, and flying her full air wing.',
    };
  }

  // ---- the bomber force ----
  // The 509th is a third piece of the deployment picture, and it competes with
  // the Ford for the same naval transit — so it lives in the same panel, where
  // the player can see both halves of the choice at once.
  function bomberLine(G) {
    if (G.bombersArrived) {
      return {
        label: 'ON THE RAMP — DIEGO GARCIA', cls: 'cv-forward',
        note: `${G.res.stealth} of ${plural(G.caps.stealth, 'mission')} generated. 2,900 nm south of the fight and out of Iranian reach.`,
      };
    }
    if (G.bombersOrdered) {
      return {
        label: 'EN ROUTE — WHITEMAN → DIEGO GARCIA', cls: 'cv-moving',
        note: `Crossing the Pacific on tankers — ${turns(G.bomberEta)} out.`,
      };
    }
    return {
      label: 'NOT IN THEATER', cls: 'cv-away',
      note: 'At Whiteman AFB, Missouri.',
    };
  }

  // ---- the heavy bomber force ----
  // The last piece of the deployment picture and the only one with a
  // precondition attached: the sky has to be at least breaking before anyone
  // will move it, and taken before anyone will fly it.
  function heavyLine(G) {
    if (G.heaviesArrived) {
      const released = Game.phaseAtLeast('superiority');
      return {
        label: released ? 'ON THE RAMP — RELEASED' : 'ON THE RAMP — NOT RELEASED',
        cls: released ? 'cv-forward' : 'cv-back',
        note: `${G.res.heavy} of ${plural(G.caps.heavy, 'mission')} generated. ` + (released
          ? 'Air superiority holds and the cells are on tonight\'s tasking order.'
          : 'They will not be tasked until the SAM belt is back down. Until then they are the most expensive parked aircraft in the world.'),
      };
    }
    if (G.heaviesOrdered) {
      return {
        label: 'EN ROUTE — CONUS → RAF FAIRFORD', cls: 'cv-moving',
        note: `Crossing the Atlantic on tankers — ${turns(G.heavyEta)} out.`,
      };
    }
    return {
      label: 'NOT IN THEATER', cls: 'cv-away',
      note: 'B-1s at Dyess and B-52s at Barksdale.',
    };
  }

  function renderFleet(G) {
    const box = $('fleet-list');
    if (!box) return;
    const naval = IranAI.navalStrength();
    const status = $('fleet-status');
    status.textContent = naval > 0 ? '— ANTI-SHIP THREAT ACTIVE' : '— THREAT NEUTRALIZED';
    status.style.color = naval > 0 ? 'var(--red)' : 'var(--green)';

    box.innerHTML = G.carriers.map(cv => {
      const info = CARRIER_INFO[cv.id];
      const st = carrierLine(cv);
      const head = `<div class="cv-head"><span class="cv-hull">${info.short}</span>` +
        `<span class="cv-state ${st ? st.cls : 'cv-away'}">${st ? st.label : 'NOT IN THEATER'}</span></div>`;
      // a deck that is not here yet has its whole story in the order row below
      const note = st ? st.note
        : G.secondCarrierOrdered
          ? `Under way from the Indian Ocean — ${turns(G.secondCarrierEta)} out.`
          : '';
      return `<div class="cv-row"><div class="cv-name dim">${info.name}</div>${head}` +
        `<div class="cv-note dim">${note}</div></div>`;
    }).join('');

    const bl = bomberLine(G);
    box.innerHTML +=
      `<div class="cv-row"><div class="cv-name dim">509th Bomb Wing — B-2 Spirit</div>` +
      `<div class="cv-head"><span class="cv-hull">B-2</span>` +
      `<span class="cv-state ${bl.cls}">${bl.label}</span></div>` +
      `<div class="cv-note dim">${bl.note}</div></div>`;

    const hl = heavyLine(G);
    box.innerHTML +=
      `<div class="cv-row"><div class="cv-name dim">Heavy Bomber Force — B-1B / B-52H</div>` +
      `<div class="cv-head"><span class="cv-hull">HEAVY</span>` +
      `<span class="cv-state ${hl.cls}">${hl.label}</span></div>` +
      `<div class="cv-note dim">${hl.note}</div></div>`;

    // one force flow a night: whichever deployment was ordered this turn holds
    // tonight's transit plan, and the other one goes out on tomorrow's
    const planCut = Game.transitCommitted();
    const bomberInbound = G.bombersOrdered && !G.bombersArrived;

    // Force-flow orders go through the shared action list like every other
    // tasking: the order and what it costs stay up, the explanation of what a
    // transit plan is folds away. Each entry needs its own data attribute
    // because these do not go through doDiplo — the wiring below reads them.
    const acts = [];

    G.carriers.forEach(cv => {
      const info = CARRIER_INFO[cv.id];
      if (cv.lost) return;
      if (!cv.arrived) {
        if (G.secondCarrierOrdered) {
          acts.push({ id: `cv-eta-${cv.id}`, attrs: '', name: `${info.short} EN ROUTE`,
            current: `ETA ${turns(G.secondCarrierEta)}.`,
            desc: 'She cannot be hurried.', disabled: true });
        } else if (planCut) {
          acts.push({ id: `cv-cut-${cv.id}`, attrs: '', name: 'NAVAL TRANSIT COMMITTED — B-2 FORCE MOVING',
            current: `${info.short} can be surged next turn.`,
            desc: 'Fifth Fleet cuts one transit plan a night, and tonight\'s is the 509th.',
            disabled: true });
        } else {
          acts.push({ id: `cv-surge-${cv.id}`, name: `SURGE ${info.short} TO THE THEATER`,
            attrs: 'data-carrier-order="1"',
            current: `${turns(Game.FORD_TRANSIT_TURNS)} out. Costs tonight's naval transit.`,
            desc: `Orders ${info.name} into theater; she arrives at standoff in the deep Arabian Sea. ` +
              'Costs no money and no lives — but the B-2s cannot be moved until next turn.' });
        }
        return;
      }
      const fwd = cv.posture === 'forward';
      acts.push({
        id: `cv-post-${cv.id}`,
        name: cv.moving ? `${info.short} REPOSITIONING`
          : fwd ? `PULL ${info.short} BACK TO THE DEEP ARABIAN SEA`
          : `SEND ${info.short} FORWARD TO THE NORTH ARABIAN SEA`,
        attrs: `data-carrier-toggle="${cv.id}"`,
        current: cv.moving ? 'Between stations until the end of the turn.'
          : fwd ? 'One turn, exposed until clear. Aegis, strait pressure and the oil lid come off with her.'
          : 'One turn, exposed until on station. Adds Aegis BMD, a harder strait, a lower oil premium.',
        desc: cv.moving ? 'The order is given.'
          : fwd ? 'Full strike either way — what you give up is the Aegis umbrella over the Gulf-state bases, the weight on the strait, and the lid on the oil premium.'
          : 'Full strike either way. The cost is a hull inside Iran\'s anti-ship envelope.',
        disabled: cv.moving,
      });
    });

    if (!G.bombersArrived) {
      if (bomberInbound) {
        acts.push({ id: 'b2-eta', attrs: '', name: 'B-2 FORCE EN ROUTE', current: `ETA ${turns(G.bomberEta)}.`,
          desc: 'They land, they get built up, then they fly.', disabled: true });
      } else if (planCut) {
        acts.push({ id: 'b2-cut', attrs: '', name: 'NAVAL TRANSIT COMMITTED — FORD UNDER WAY',
          current: 'The 509th moves on tomorrow\'s plan.',
          desc: 'Tonight\'s transit plan is the carrier surge. They do not wait on her arrival.',
          disabled: true });
      } else {
        acts.push({ id: 'b2-go', name: 'DEPLOY B-2 FORCE — WHITEMAN → DIEGO GARCIA',
          attrs: 'data-bomber-order="1"',
          current: `${turns(Game.B2_TRANSIT_TURNS)} out. Unlocks the GBU-57 — the only way to reach Fordow.`,
          desc: 'Moves the 509th into theater. Takes tonight\'s naval transit, so the ' +
            `${CARRIER_INFO['csg-ford'].short} cannot be surged until next turn.` });
      }
    }

    // the heavies want the sky to be breaking before anyone will move them, and
    // they take a transit slot like everything else
    if (!G.heaviesArrived) {
      if (G.heaviesOrdered) {
        acts.push({ id: 'hv-eta', attrs: '', name: 'HEAVY BOMBER FORCE EN ROUTE',
          current: `ETA ${turns(G.heavyEta)} to RAF Fairford.`, disabled: true });
      } else if (!Game.phaseAtLeast('degraded')) {
        acts.push({ id: 'hv-blocked', attrs: '', name: 'HEAVY BOMBERS — AIRSPACE STILL CONTESTED',
          current: 'Degrade the air defense network first.',
          desc: 'Air Combat Command will not flow B-1s and B-52s into a theater with an intact SAM belt.',
          disabled: true });
      } else if (planCut) {
        acts.push({ id: 'hv-cut', attrs: '', name: 'TRANSIT COMMITTED — ANOTHER FORCE IS MOVING',
          current: 'The heavies go out on tomorrow\'s plan.',
          desc: 'One force flow a night.', disabled: true });
      } else {
        acts.push({ id: 'hv-go', name: 'DEPLOY HEAVY BOMBER FORCE — CONUS → RAF FAIRFORD',
          attrs: 'data-heavy-order="1"',
          current: `${turns(Game.HEAVY_TRANSIT_TURNS)} out. Roughly half again a fighter package per target.`,
          desc: 'Moves the B-1 and B-52 force into theater. They will not be tasked until air superiority ' +
            'is declared, so calling them early is a bet on the campaign going well.' });
      }
    }

    $('fleet-buttons').innerHTML = actionButtons(acts, false);
    for (const btn of $('fleet-buttons').querySelectorAll('.action-do')) {
      if (btn.dataset.carrierOrder) btn.addEventListener('click', () => Game.orderCarrier());
      else if (btn.dataset.bomberOrder) btn.addEventListener('click', () => Game.orderBombers());
      else if (btn.dataset.heavyOrder) btn.addEventListener('click', () => Game.orderHeavies());
      else if (btn.dataset.carrierToggle) {
        btn.addEventListener('click', () => Game.toggleCarrierPosture(btn.dataset.carrierToggle));
      }
    }
    wireWhy('#fleet-buttons');
  }

  // Which advisors the player has opened, and the turn that was true for.
  // Deliberately NOT on `G` and NOT in save/load `FIELDS`: what you had open
  // when you quit is not part of the war, and an advisor says something
  // different every turn, so carrying an expansion across the turn boundary
  // would reopen a paragraph the player never asked for. Cleared on the turn
  // roll; survives the many re-renders inside one turn, which is the point.
  let advOpen = new Set();
  let advTurn = 0;

  // When more than one advisor is urgent, only the top of this order opens
  // itself — the rest are marked and left shut. The order is the one the
  // branch comments in advise() already argue for: Americans on the ground and
  // the enrichment clock live on NSA and outrank everything; a perishable fix
  // on launchers is SecDef's; the staff's sequencing problem is CJCS; State's
  // windows are real but measured in turns rather than tonight.
  const ADV_PRIORITY = ['NSA Reyes', 'SecDef Whitfield', 'Gen. Halvorsen, CJCS', 'SecState Okafor'];

  function renderAdvisors(G) {
    const advice = IranAI.advise(G);

    if (advTurn !== G.turn) { advOpen = new Set(); advTurn = G.turn; }

    // the single advisor whose paragraph opens without being asked
    const lead = ADV_PRIORITY
      .map(n => advice.find(a => a.name === n))
      .find(a => a && a.urgent);
    if (lead) advOpen.add(lead.name);

    $('advisors-list').innerHTML = advice.map(a => {
      const open = advOpen.has(a.name);
      return `<div class="advisor ${a.cls}${a.urgent ? ' urgent' : ''}${open ? ' open' : ''}" data-adv="${a.name}">` +
        `<button type="button" class="adv-head" aria-expanded="${open}">` +
        `<span class="adv-caret" aria-hidden="true">▾</span>` +
        `<span class="adv-name">${a.name}</span>` +
        (a.urgent ? '<span class="adv-flag">URGENT</span>' : '') +
        `<span class="adv-line">${a.line}</span>` +
        `</button>` +
        `<div class="adv-text">${a.text}</div></div>`;
    }).join('');

    for (const head of $('advisors-list').querySelectorAll('.adv-head')) {
      head.addEventListener('click', () => {
        const box = head.parentElement;
        const key = box.dataset.adv;
        const open = !box.classList.contains('open');
        box.classList.toggle('open', open);
        head.setAttribute('aria-expanded', String(open));
        if (open) advOpen.add(key); else advOpen.delete(key);
      });
    }

    // The panel is collapsed most of the time, so the header is the only place
    // an urgent advisor can be seen without opening anything. This goes in the
    // meta line rather than the badge for the same reason the fleet's threat
    // warning does: "SITUATION ROOM — ADVISORS" is long enough that a badge
    // beside it wraps the title, and the meta row is already the slot for a
    // condition rather than a count.
    const urgent = advice.filter(a => a.urgent).length;
    const status = $('advisors-status');
    if (!status) return;
    // lowercase noun: the meta row is uppercased by CSS, and plural() would
    // otherwise pluralise "ADVISOR" to "ADVISORs"
    status.textContent = urgent ? `— ${plural(urgent, 'advisor')} flagged urgent` : '';
    status.style.color = 'var(--red)';
  }

  function renderDiplo(G) {
    const used = G.diploUsed;
    $('diplo-status').textContent = used ? '— USED THIS TURN' : '';
    const negReady = G.negotiationReady();
    // `current` is what the player needs to choose — the odds, the price, the
    // countdown. `desc` is what the instrument is. Anything with a number in it
    // that the player is spending belongs above the fold.
    const actions = [
      {
        id: 'backchannel', name: 'Omani backchannel',
        current: negReady
          ? 'Tehran is breaking — a deal is possible.'
          : 'Tehran will not talk while it can still fight.',
        desc: negReady
          ? 'Far from certain, but this is the moment an overture can land. Attempt to bring them to the table.'
          : 'An overture now will be rebuffed and read as weakness at home.',
      },
      {
        id: 'un', name: 'UN Security Council push',
        current: 'World opinion +.',
        desc: 'Rally international support and diplomatic cover.',
      },
      {
        id: 'sanctions', name: 'Snap-back sanctions package',
        current: 'Negotiation leverage +, small oil cost.',
        desc: 'Tighten the economic screws. Leverage is what a backchannel spends when the time comes.',
      },
      {
        id: 'coalition', name: 'Build strike coalition',
        current: G.coalition ? 'Coalition assembled — allied sorties added.' : 'Adds allied sorties.',
        desc: G.coalition ? '' : 'Brings allied air into the operation and spreads the political weight of it.',
        disabled: G.coalition,
      },
      {
        id: 'israel', name: 'Coordinate with Israel',
        current: G.israelPosture === 'coordinated'
          ? 'Israel is in. Joint deep-strike package available.'
          : G.israelPosture === 'unilateral'
            ? 'Too late — Israel acted on its own.'
            : `World opinion −8. They go alone in ${turns(G.israelPatience)} regardless.`,
        desc: G.israelPosture === 'sidelined'
          ? 'Brings the IAF in openly: fighter capacity, and ONE joint deep-strike package against Natanz ' +
            'or Fordow — the only path to the buried halls that does not need a B-2. It also widens the war, ' +
            'and Iran starts shooting at Israel on our account.'
          : '',
        disabled: G.israelPosture !== 'sidelined',
      },
      {
        id: 'spr', name: 'Release the Strategic Reserve',
        current: G.sprReleases >= 2
          ? 'Tanks too low for another release of scale.'
          : `Oil ${G.sprReleases === 0 ? '−$20' : '−$12'}, approval +2. ${plural(2 - G.sprReleases, 'release')} left.`,
        desc: G.sprReleases >= 2 ? '' : 'A coordinated draw on the Strategic Petroleum Reserve to push the pump price down.',
        disabled: G.sprReleases >= 2,
      },
      {
        id: 'address', name: 'Address the nation',
        current: G.addressCooldown > 0
          ? `Available in ${turns(G.addressCooldown)}.`
          : `Approval +6. ${plural(G.addresses, 'address')} so far.`,
        desc: G.addressCooldown > 0 ? '' :
          'Rally the public — and the count is read out when the War Powers vote comes up.',
        disabled: G.addressCooldown > 0,
      },
    ];

    $('diplo-buttons').innerHTML = actionButtons(actions, used);
    wireActions('#diplo-buttons');
  }

  // one control for every order the player can give, so a tasking looks like a
  // tasking wherever it is rendered
  // Which action explainers are open. Unlike the advisors' `advOpen` this is NOT
  // cleared on the turn roll: an advisor says something different every turn, so
  // a stale expansion would show a paragraph nobody asked for, but "what a
  // collection deck is" is the same sentence on turn 1 and turn 30. A player who
  // opens it is learning the game and should keep it open until they close it.
  const actOpen = new Set();

  // One control for every order the player can give, so a tasking looks like a
  // tasking wherever it is rendered — and so the split between what changed and
  // what it means is made once instead of per panel.
  //
  // `name` and `current` are the decision: the order, its live state, and what
  // it costs. `desc` is the mechanism — what an SPR draw is, why the heavies
  // will not fly — which is the same prose every turn for thirty turns and is
  // the part that was making these panels 600-840px tall. It renders collapsed.
  //
  // The explainer sits OUTSIDE the button rather than inside it: the button
  // performs the action on click, so a disclosure nested in it would be an
  // invalid control that fires an order when the player only wanted to read.
  function actionButtons(list, used) {
    return list.map(a => {
      const off = used || a.disabled;
      const open = actOpen.has(a.id);
      // `attrs: ''` marks a status row — something the panel is telling the
      // player rather than an order they can give. Omitting attrs entirely is
      // the diplomacy/intelligence default, where the id IS the order.
      const attrs = a.attrs === undefined ? `data-diplo="${a.id}"` : a.attrs;
      return `<div class="action${off ? ' off' : ''}${open ? ' open' : ''}" data-action="${a.id}">` +
        `<button class="action-do" ${attrs} ${off ? 'disabled' : ''}>` +
        `<span class="action-name">${a.name}</span>` +
        (a.current ? `<span class="il-current">${a.current}</span>` : '') +
        `</button>` +
        (a.desc
          ? `<button type="button" class="action-why" aria-expanded="${open}" ` +
            `aria-label="Why this order matters"><span class="why-caret">▾</span></button>` +
            `<div class="action-desc">${a.desc}</div>`
          : '') +
        `</div>`;
    }).join('');
  }

  // Wires the disclosure carets in a panel. The action itself is wired by the
  // caller, because a diplomatic action, a carrier order and a bomber order all
  // go somewhere different — but every panel hides its prose the same way.
  function wireWhy(sel) {
    for (const why of document.querySelectorAll(`${sel} .action-why`)) {
      why.addEventListener('click', () => {
        const row = why.parentElement;
        const open = !row.classList.contains('open');
        row.classList.toggle('open', open);
        why.setAttribute('aria-expanded', String(open));
        if (open) actOpen.add(row.dataset.action); else actOpen.delete(row.dataset.action);
      });
    }
  }

  function wireActions(sel) {
    for (const btn of document.querySelectorAll(`${sel} .action-do`)) {
      btn.addEventListener('click', () => Game.doDiplo(btn.dataset.diplo));
    }
    wireWhy(sel);
  }

  // ---- intelligence tasking ----
  // Its own one-per-turn slot, separate from diplomacy: these buy knowing
  // instead of doing. The panel leads with the collection picture — what is
  // currently known, and how firmly — because every one of these orders is a
  // decision to spend the night's intel slot moving one of those lines. Reading
  // the state out of four paragraphs of button text was the wrong shape for it.
  function renderIntel(G) {
    const used = G.intelUsed;
    $('intel-status').textContent = used ? '— SLOT SPENT THIS TURN' : '';

    const hidden = IranAI.liveTels().filter(t => !t.located).length;
    const brk = Game.breakoutEstimate();
    const posture = G.postureKnown ? IranAI.posture() : null;

    const lines = [
      ['Enrichment', brk.halted ? 'HALTED' : `${brk.lo}–${brk.hi}T · ${brk.conf}`,
        brk.halted || brk.conf === 'high' ? 'known' : brk.conf === 'low' ? 'unknown' : ''],
      ['Dispersed launchers', hidden ? `${hidden} unlocated` : 'none loose',
        hidden ? 'unknown' : 'known'],
      ['Iranian war plan', posture ? posture.name : 'unassessed', posture ? 'known' : 'unknown'],
    ];
    const picture = lines.map(([label, value, cls]) =>
      `<div class="intel-line"><span>${label}</span>` +
      `<span class="il-value ${cls}">${value}</span></div>`).join('');

    // A collection deck is only worth flying when there is something soft
    // enough to be worth looking at. Offered with nothing on the list it spends
    // the night's intel slot and hands back "nothing worth the sortie" — so the
    // button says so up front instead, and the count is the argument for it.
    const stale = Game.staleEstimates();

    const intel = [
      {
        id: 'bda', name: 'Task a collection deck — reassess damaged sites',
        current: stale.length
          ? `${plural(stale.length, 'estimate')} soft enough to be worth the sortie: ` +
            `${stale.map(({ t }) => t.short).join(' · ')}.`
          : 'Nothing on the list is stale enough to be worth a collection deck.',
        desc: stale.length
          ? 'Overhead, a Global Hawk orbit and the signals picture. Narrows those estimates to ±3 — ' +
            'which is the difference between knowing a site needs one more package and guessing.'
          : 'Every site that has been hit is carrying a fresh assessment. Strike something and let a ' +
            'night pass, and the analysts will have work worth doing.',
        disabled: !stale.length,
      },
      {
        id: 'hunt', name: 'Hunt dispersed launchers',
        current: hidden
          ? `${hidden} launcher group${hidden === 1 ? '' : 's'} loose in the country and shooting.`
          : 'Nothing unaccounted for.',
        desc: hidden
          ? 'A sweep may find one. Found is not killed — they move again if they are not serviced the ' +
            'same turn.'
          : 'Every launcher group known to have left a base is on the plot or destroyed.',
        disabled: !hidden,
      },
      {
        id: 'assess-nuclear', name: 'Reassess the enrichment timeline',
        current: brk.halted
          ? 'No capability remaining.'
          : `Current judgement: ${brk.lo}–${brk.hi} turns, ${brk.conf} confidence.`,
        desc: brk.halted
          ? 'Enrichment capability is destroyed. There is no timeline left to assess.'
          : 'Narrows the band — the estimate is what the whole campaign is being paced against.',
        disabled: brk.halted,
      },
      {
        id: 'assess-intent', name: 'Assess Iranian war plan',
        current: posture
          ? `Assessed: ${posture.name}.`
          : (G.turn <= 3 ? `Locked until turn 4 (currently turn ${G.turn}).` : 'Never assessed.'),
        desc: posture
          ? posture.brief
          : (G.turn <= 3
            ? 'The Agency needs time on the target before it can read Tehran\'s intent. The tasking ' +
              'opens up after the first three turns of the campaign.'
            : 'The Agency can tell you which arm Tehran has decided to fight this war with — and therefore ' +
              'which one is worth spending the campaign destroying. One tasking, permanent answer.'),
        disabled: G.postureKnown || G.turn <= 3,
      },
    ];

    // the leadership raid's ISR prep is an intelligence tasking: it lives here
    // now, not in Special Operations. SpecOps hands back the button (or null
    // once there is no raid left to prepare for).
    const isr = SpecOps.isrTasking(G);
    if (isr) intel.push(isr);

    $('intel-buttons').innerHTML = picture + actionButtons(intel, used);
    wireActions('#intel-buttons');
  }

  let csarWasHidden = true;

  function renderSidebar(G) {
    CSAR.renderPanel(G);   // hidden unless there are Americans on the ground
    // A recovery panel that has just appeared opens itself. Whatever the player
    // had shut, aircrew on the ground outrank it.
    const csar = $('csar-panel');
    const csarHidden = csar.classList.contains('hidden');
    if (csarWasHidden && !csarHidden) setPanelOpen(csar, true);
    csarWasHidden = csarHidden;

    renderObjectives(G);
    renderResources(G);
    renderFleet(G);
    renderAdvisors(G);
    renderDiplo(G);
    renderIntel(G);
    SpecOps.renderPanel(G);
    renderBadges();
  }

  function renderAll(G) {
    renderHUD(G);
    renderSidebar(G);
  }

  // ---- ticker ----
  function setTicker(headlines) {
    $('ticker-text').textContent = headlines.join('  •••  ') + '  •••  ';
  }

  // ---- strike modal ----
  // Asset names sit mid-sentence ("Requires 2× cruise missiles"), so the
  // leading capital comes down — EXCEPT when the name opens on an aircraft
  // designation, where dropping it produces "b-2 bomber missions". A name that
  // starts with a capital followed by a lower-case letter is an ordinary word
  // and can be folded; anything else is a designation and is left alone.
  const lcFirst = (s) => /^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s;

  function openStrikeModal(G, target) {
    currentTarget = target;
    selectedPkg = null;
    $('strike-target-name').textContent = target.name.toUpperCase();
    $('strike-target-desc').textContent = Game.targetDesc(target);
    $('strike-estimate').classList.add('hidden');
    $('btn-confirm-strike').disabled = true;

    const box = $('strike-packages');
    box.innerHTML = '';

    // Congress, the tanker plan and the search for the target itself can all
    // take a target off the board without it being destroyed. Say which.
    const block = Game.barred(target);
    if (block) {
      box.innerHTML = `<div class="pkg-blocked">${block}</div>`;
      $('strike-modal').classList.remove('hidden');
      return;
    }

    target.packages.forEach((pkg) => {
      // the submarine shot is counted out of the boat's tubes, not the theater
      // magazine — same gate, different magazine, and it says which
      const have = Game.pkgStock(pkg);
      const { cost, ok: fuelOk } = Game.tankersFor(target, pkg);
      const stockOk = have >= pkg.qty;
      // the air-superiority ladder outranks both magazines: a tier that has not
      // been released is not short of anything, it is simply not flying tonight
      const gate = Game.pkgBlock(target, pkg);
      const ok = stockOk && fuelOk && !gate;
      const div = document.createElement('div');
      div.className = 'pkg-option' + (ok ? '' : ' unavailable') + (gate ? ' pkg-gated' : '');
      // when a package can't fly, the reason matters: an empty magazine, an
      // empty tanker plan and an intact SAM belt are three different problems
      // with three different answers
      const why = stockOk ? '' : ' — MAGAZINE SHORT';
      const fuelWhy = !fuelOk ? ' — NO TANKER TRACKS' : '';
      div.innerHTML = `<span class="pkg-name">${pkg.label}</span>` +
        (gate ? `<span class="pkg-detail pkg-gate">${gate}</span>` : '') +
        `<span class="pkg-detail">Requires ${pkg.qty}× ` +
        `${pkg.sub ? SUB_WEAPON_NAME : lcFirst(ASSET_NAMES[pkg.asset])} ` +
        // "1 tanker track of 10 left" reads as "1 out of 10" and means the
        // opposite — the cost is 1 and the plan has 10. Separate the two.
        `(available: ${have})${why} · ${cost ? `${plural(cost, 'tanker track')} ` +
        `· ${G.tankers} left tonight${fuelWhy}` : 'no tanker requirement'}` +
        (pkg.sub ? ' · <span class="est-good">no theater magazine spent</span>' : '') + '</span>';
      if (ok) {
        div.addEventListener('click', () => {
          box.querySelectorAll('.pkg-option').forEach(el => el.classList.remove('selected'));
          div.classList.add('selected');
          selectedPkg = pkg;
          showEstimate(G, target, pkg);
          $('btn-confirm-strike').disabled = false;
          // On a landscape phone the package list alone fills the window, and
          // the estimate this click just produced — the tanker bill, the
          // diplomatic bill, the aircrew loss risk — renders below the fold
          // while AUTHORIZE STRIKE sits enabled and fully visible above it.
          // Bring the numbers to the player rather than trusting them to go
          // looking: the whole point of the panel is to be read before the
          // button is pressed. Harmless on a desktop window, where nothing
          // overflows and the scroll is a no-op.
          //
          // Scroll the box itself rather than calling scrollIntoView on the
          // estimate: the estimate is un-hidden one line above, so its geometry
          // is a frame stale, and `nearest` reads that as "already visible" and
          // moves ten pixels. Waiting a frame and driving the scroller directly
          // puts the bottom of the estimate — loss risk, the unsuppressed
          // threat warning — against the bottom of the window every time.
          // Assigned rather than animated: a smooth scroll is silently a no-op
          // wherever reduced motion is in force, and a jump that always happens
          // beats an animation that sometimes does. There is no motion worth
          // watching here anyway — the player clicked to read a number.
          requestAnimationFrame(() => {
            const body = $('strike-modal').querySelector('.modal-body');
            const est = $('strike-estimate');
            const want = est.offsetTop + est.offsetHeight - body.clientHeight;
            if (want > body.scrollTop) body.scrollTop = want;
          });
        });
      }
      box.appendChild(div);
    });

    $('strike-modal').classList.remove('hidden');
  }

  function showEstimate(G, target, pkg) {
    const est = Game.computeStrike(target, pkg);
    const pct = Math.round(est.success * 100);
    const sCls = pct >= 70 ? 'est-good' : pct >= 45 ? 'est-warn' : 'est-bad';
    // "probability of kill" means something different for a site that wears
    // down: the roll decides whether the package achieves effects, and what the
    // effects are worth is the bite it takes out of the condition track. Both
    // numbers go in front of the player, plus what it takes to finish the job.
    // How many more packages it takes is now a RANGE, because the condition it
    // is computed from is a range. This is the number the whole uncertainty
    // layer exists to make interesting: "one, probably — maybe two" is a
    // decision, and "two" is arithmetic.
    const band = Game.estimate(target);
    const hitsLo = est.gradual ? Math.max(1, Math.ceil(band.lo / est.damage)) : 0;
    const hitsHi = est.gradual ? Math.max(1, Math.ceil(band.hi / est.damage)) : 0;
    const hits = hitsLo === hitsHi ? `${hitsLo}` : `${hitsLo}–${hitsHi}`;
    // only the B-2 pays a transit turn now — the heavies land the same night
    // they are tasked (see MISSION_ETA in game.js)
    const eta = pkg.eta || (pkg.asset === 'stealth' ? 2 : 1);
    const totWhy = pkg.joint ? 'joint mission planning and transit'
      : pkg.sub ? 'the boat has to close the range submerged before she shoots'
      : 'transit from Diego Garcia';
    const tot = eta > 1
      ? `TIME ON TARGET: <span class="est-warn">${eta} turns — ${totWhy}</span>`
      : 'TIME ON TARGET: <span class="est-good">end of this turn — BDA with the battle report</span>';
    const worldCost = target.world + (pkg.extraWorld || 0);
    let html =
      // against a hull there is no partial result to report, so the number means
      // what it says: this is the chance she goes down
      `EST. PROBABILITY OF ${est.oneShot ? 'KILL' : 'EFFECTS'}: <span class="${sCls}">${pct}%</span><br>` +
      (est.oneShot
        ? `<span class="est-good">One weapon on target sinks her — no partial damage, and a sunk hull ` +
          `never comes back.</span><br>` : '') +
      (est.gradual
        ? `ASSESSED CONDITION: <span class="${band.lo >= 100 ? 'est-bad' : 'est-warn'}">` +
          `${Game.condition(target)}</span>` +
          (band.age > 0
            ? ` <span class="dim">(last looked at ${band.age} turn${band.age === 1 ? '' : 's'} ago — ` +
              `it has been repairing since)</span>` : '') + `<br>` +
          `PACKAGE WEIGHT: <span class="est-good">−${est.damage} condition</span> on full effects, ` +
          `<span class="dim">half that on partial — an estimated ${hits} more package` +
          `${hits === '1' ? '' : 's'} on target to finish it</span><br>`
        : '') +
      `TANKER COST: <span class="${est.tanker > G.tankers ? 'est-bad' : 'est-good'}">` +
      `${est.tanker ? `${plural(est.tanker, 'track')} · ${G.tankers} left tonight`
                    : 'none — flies unrefuelled'}` +
      `</span><br>` +
      `${tot}<br>` +
      // Two different bills. `worldCost` is what tonight costs; `worldOnKill` is
      // what the target costs when it finally stops working, and the player has
      // to be able to see that before committing the first package — otherwise
      // a free-looking strike hands them a −8 they never agreed to.
      `WORLD OPINION: <span class="${worldCost ? 'est-warn' : 'est-good'}">` +
      `${worldCost ? signed(worldCost) : 'no cost for this strike'}</span>` +
      // the joint packages only exist against the enrichment sites, and those
      // now cost nothing on their own — so the whole number is the surcharge
      (pkg.extraWorld
        ? ` <span class="dim">(${target.world ? `${signed(target.world)} target, ` : 'the aimpoint itself costs nothing — '}` +
          `${signed(pkg.extraWorld)} for flying it with Israel)</span>` : '') + `<br>` +
      (target.worldOnKill
        ? `<span class="est-warn">DESTROYING IT COSTS ${MINUS}${Math.abs(target.worldOnKill)}</span> ` +
          `<span class="dim">— the diplomatic bill lands once, the night the site is finished, ` +
          `not for the packages that get it there.</span><br>` : '');
    // flying a tier outside its phase — only reachable on hard, and the player
    // is told in as many words what they are ordering
    if (est.raw) {
      html += `<span class="est-bad">FLYING INTO AN UNSUPPRESSED THREAT. ` +
        `${pkg.asset === 'heavy' ? 'Heavy bombers have no business over a live SAM belt'
          : 'These are fourth-generation airframes and the belt is still up'} — ` +
        `the staff has written this plan because it was ordered to.</span><br>`;
    }
    if (est.adPenalty > 0.01) {
      html += `<span class="est-warn">Air defenses degrade this package (−${Math.round(est.adPenalty * 100)}%).</span> `;
    }
    if (est.adaptPenalty > 0.01) {
      html += `<span class="est-warn">Iran has adapted to this platform (−${Math.round(est.adaptPenalty * 100)}%) ` +
        `— mixing the force is what walks this back.</span> `;
    }
    if (est.lossRisk > 0.01) {
      html += `<span class="est-bad">Aircrew loss risk: ${Math.round(est.lossRisk * 100)}%.</span>`;
    } else {
      html += `<span class="est-good">No aircrew at risk.</span>`;
    }
    $('strike-estimate').innerHTML = html;
    $('strike-estimate').classList.remove('hidden');
  }

  function closeStrikeModal() {
    $('strike-modal').classList.add('hidden');
    currentTarget = null;
    selectedPkg = null;
  }

  // ---- turn report modal ----
  // Two people read this screen. One wants the prose — the assessment language,
  // the miss reasons, the casualty sentence. The other wants to know whether the
  // night went well and what it cost, and will not read twelve paragraphs to find
  // out. The prose loses that fight every time it is the only thing on offer: a
  // wall of text gets ACKNOWLEDGE'd unread, and then the player is making
  // decisions off a war they never actually read.
  //
  // So the report is built the other way round. A one-line verdict and a strip of
  // net changes come first, every event is one scannable line carrying its own
  // impact chips, and the full assessment is one tap underneath. Nothing has to
  // be opened to play correctly — opening is for the player who wants the story.
  const VERBOSE_KEY = 'cic-report-verbose';
  const verbose = () => { try { return localStorage.getItem(VERBOSE_KEY) === '1'; } catch (e) { return false; } };
  const setVerbose = (v) => { try { localStorage.setItem(VERBOSE_KEY, v ? '1' : '0'); } catch (e) {} };

  // Everything the night did, added up once. Individual events still carry their
  // own numbers on their own line; this is the version you can read in a second.
  function digest(events) {
    const d = { destroyed: 0, damaged: 0, missed: 0, lost: 0, kia: 0,
      dApproval: 0, dOil: 0, dWorld: 0, dTanker: 0, hormuz: null };
    for (const ev of events) {
      if (ev.outcome === 'destroyed') d.destroyed++;
      else if (ev.outcome === 'damaged') d.damaged++;
      else if (ev.outcome === 'miss') d.missed++;
      if (ev.aircraftLost) d.lost++;
      d.kia += ev.casualties || 0;
      d.dApproval += ev.dApproval || 0;
      d.dOil += ev.dOil || 0;
      d.dWorld += ev.dWorld || 0;
      d.dTanker += ev.dTanker || 0;
      if (ev.hormuz) d.hormuz = ev.hormuz;   // last word on the strait wins
    }
    return d;
  }

  // The verdict line: what happened, in the fewest words that are still true.
  function headline(d) {
    const parts = [];
    if (d.destroyed) parts.push(`${plural(d.destroyed, 'target')} destroyed`);
    if (d.damaged) parts.push(`${d.damaged} damaged`);
    if (d.missed) parts.push(`${plural(d.missed, 'strike')} with no effect`);
    if (d.lost) parts.push(`${plural(d.lost, 'aircraft')} lost`);
    if (d.kia) parts.push(`${plural(d.kia, 'American')} killed`);
    if (d.hormuz) parts.push(`Hormuz ${d.hormuz.toLowerCase()}`);
    return parts.join(' · ');
  }

  // A number the player is meant to read at a glance, so it is signed, colored
  // by whether it helped or hurt, and never explained. `good` is the direction
  // that is good for the president: approval and world opinion up, oil down.
  function chip(label, val, good, unit) {
    if (!val) return '';
    const n = Math.round(val * 10) / 10;
    const sign = n > 0 ? '+' : '−';
    const body = unit === '$' ? `${sign}$${Math.abs(n)}` : `${sign}${Math.abs(n)}`;
    const tone = (n > 0) === good ? 'good' : 'bad';
    return `<span class="rc ${tone}"><b>${body}</b>${label}</span>`;
  }

  function chipsFor(o) {
    return chip('APPROVAL', o.dApproval, true) +
      chip('OIL', o.dOil, false, '$') +
      chip('WORLD', o.dWorld, true) +
      chip('TANKERS', o.dTanker, true) +
      ((o.casualties || o.kia)
        ? `<span class="rc bad"><b>+${o.casualties || o.kia}</b>US KIA</span>` : '') +
      ((o.aircraftLost || o.lost)
        ? `<span class="rc bad"><b>−${o.lost || 1}</b>AIRCRAFT</span>` : '') +
      (o.hormuz
        ? `<span class="rc ${o.hormuz === 'OPEN' ? 'good' : 'bad'}"><b>HORMUZ</b>${o.hormuz}</span>` : '');
  }

  // The collapsed line. `sum` is written by whatever produced the event when it
  // knows the outcome in four words (see resolveImpact); a title is the fallback,
  // and for Iran's events the title already is the summary.
  const evSummary = (ev) => ev.sum || ev.title;

  // opts.prose forces every event open: the set pieces the player triggered on
  // purpose and just watched an animation for — a raid debrief, a recovery, the
  // primer — are read for the writing, and there is one of them, not twelve a
  // night. The summary layout is for the nightly reports that stack up.
  function showReport(title, events, onClose, opts) {
    const d = digest(events);
    const verdict = headline(d);
    const strip = chipsFor(d);
    // A single-event report is already a one-liner — a cable, an intelligence
    // product. Collapsing one paragraph helps nobody.
    const collapsible = events.length > 1 && !(opts && opts.prose);
    const open = !collapsible || verbose();

    let html = '';
    // only worth a strip when there is more than one event to add up — on a
    // prose report or a single event the same numbers are already on the line
    if (collapsible && (verdict || strip)) {
      // a night with nothing to count still moved numbers — label the strip so
      // it does not read as an empty box
      html += `<div class="report-bottom-line">` +
        (verdict ? `<div class="bl-verdict">${verdict}</div>`
          : `<div class="bl-label">NET EFFECT TONIGHT</div>`) +
        (strip ? `<div class="bl-chips">${strip}</div>` : '') +
        `</div>`;
    }

    html += events.map((ev, i) => {
      const chips = chipsFor(ev);
      const sum = evSummary(ev);
      const detail = `<div class="ev-detail${open ? '' : ' hidden'}" id="ev-d${i}">` +
        (ev.sum ? `<div class="ev-title">${ev.title}</div>` : '') +
        `<div>${ev.text}</div></div>`;
      if (!collapsible) {
        return `<div class="report-event ${ev.cls || ''}">` +
          `<div class="ev-sum">${sum}</div>` +
          (chips ? `<div class="ev-chips">${chips}</div>` : '') + detail + `</div>`;
      }
      return `<div class="report-event ${ev.cls || ''}">` +
        `<button class="ev-row" aria-expanded="${open}" aria-controls="ev-d${i}" data-i="${i}">` +
        `<span class="ev-caret">${open ? '−' : '+'}</span>` +
        `<span class="ev-sum">${sum}</span>` +
        (chips ? `<span class="ev-chips">${chips}</span>` : '') +
        `</button>` + detail + `</div>`;
    }).join('');

    $('report-title').textContent = title;
    const body = $('report-body');
    body.innerHTML = html;
    body.scrollTop = 0;

    // one line opens one assessment; the footer toggle is for the player who
    // wants all of them, every turn, without clicking twelve times
    if (collapsible) {
      body.onclick = (e) => {
        const row = e.target.closest('.ev-row');
        if (!row) return;
        const det = document.getElementById('ev-d' + row.dataset.i);
        const nowOpen = det.classList.toggle('hidden') === false;
        row.setAttribute('aria-expanded', nowOpen);
        row.querySelector('.ev-caret').textContent = nowOpen ? '−' : '+';
      };
    } else {
      body.onclick = null;
    }

    const toggle = $('btn-report-detail');
    toggle.classList.toggle('hidden', !collapsible);
    if (collapsible) {
      const sync = () => {
        const all = verbose();
        toggle.textContent = all ? 'HIDE DETAIL' : 'FULL DETAIL';
        body.querySelectorAll('.ev-detail').forEach(el => el.classList.toggle('hidden', !all));
        body.querySelectorAll('.ev-row').forEach(r => {
          r.setAttribute('aria-expanded', all);
          r.querySelector('.ev-caret').textContent = all ? '−' : '+';
        });
      };
      toggle.onclick = () => { setVerbose(!verbose()); sync(); };
      toggle.textContent = verbose() ? 'HIDE DETAIL' : 'FULL DETAIL';
    }

    $('report-modal').classList.remove('hidden');
    $('btn-report-ok').onclick = () => {
      $('report-modal').classList.add('hidden');
      if (onClose) onClose();
    };
  }

  // ============================================================
  // ALLIED HEAD-OF-GOVERNMENT CALL
  // ------------------------------------------------------------
  // Runs twice a campaign at most: London off the coalition cable, Paris the
  // following turn (see `leaderCalls` in game.js). Take it or don't; the numbers
  // are tiny either way and the point is the moment, not the point. Everything
  // about the leader — name, portrait colours, which flag goes on the lapel —
  // comes from WORLD_LEADERS in data.js, and which of that leader's two takes
  // gets played is decided there too and handed in as `V`.
  // ============================================================

  // The flag pin on the lapel, drawn at r=8 around a local origin so both flags
  // are interchangeable in the portrait. Simplified on purpose: at 17px across
  // on screen, a faithful Union Jack is mud — the diagonals and the cross are
  // the whole recognisable signature and everything else is noise.
  function flagPin(kind, id) {
    const clip = `lc-pin-${id}`;
    const inner = kind === 'union'
      ? `<rect x="-8" y="-8" width="16" height="16" fill="#0c2074"/>` +
        `<path d="M-8-8 L8 8 M-8 8 L8-8" stroke="#f4f6fb" stroke-width="3.6"/>` +
        `<path d="M-8-8 L8 8 M-8 8 L8-8" stroke="#c8102e" stroke-width="1.7"/>` +
        `<path d="M-8 0 H8" stroke="#f4f6fb" stroke-width="5.4"/>` +
        `<path d="M0-8 V8" stroke="#f4f6fb" stroke-width="5.4"/>` +
        `<path d="M-8 0 H8" stroke="#c8102e" stroke-width="3"/>` +
        `<path d="M0-8 V8" stroke="#c8102e" stroke-width="3"/>`
      : `<rect x="-8" y="-8" width="5.34" height="16" fill="#0d3b93"/>` +
        `<rect x="-2.67" y="-8" width="5.34" height="16" fill="#f4f6fb"/>` +
        `<rect x="2.67" y="-8" width="5.34" height="16" fill="#c8102e"/>`;
    return `<clipPath id="${clip}"><circle cx="0" cy="0" r="8"/></clipPath>` +
      `<g clip-path="url(#${clip})">${inner}</g>` +
      `<circle cx="0" cy="0" r="8" fill="none" stroke="#d8b46a" stroke-width="1.4"/>`;
  }

  // Low-detail cartoon head-and-shoulders, the way a contact photo would look.
  // Drawn once per call and thrown away, so the clip-path ids only have to be
  // unique against the one other portrait that could ever exist.
  function drawLeader(L) {
    return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" ` +
      `aria-label="Portrait of the ${L.country} head of government">` +
      `<defs>` +
        `<radialGradient id="lc-bg-${L.id}" cx="50%" cy="34%" r="72%">` +
          `<stop offset="0%" stop-color="#22355a"/><stop offset="100%" stop-color="#0b1424"/>` +
        `</radialGradient>` +
        `<clipPath id="lc-frame-${L.id}"><circle cx="60" cy="60" r="57"/></clipPath>` +
      `</defs>` +
      `<circle cx="60" cy="60" r="57" fill="url(#lc-bg-${L.id})"/>` +
      `<g clip-path="url(#lc-frame-${L.id})">` +
        // neck first, then the jacket over it — the collar line comes for free
        `<path d="M51 62 h18 v24 q-9 6 -18 0 z" fill="${L.skin}"/>` +
        `<path d="M51 76 q9 8 18 0 v5 q-9 8 -18 0 z" fill="#000" opacity=".18"/>` +
        `<path d="M2 120 C 4 98, 15 88, 34 84 L 60 101 L 86 84 C 105 88, 116 98, 118 120 Z" fill="${L.suit}"/>` +
        `<path d="M47 83 L60 105 L73 83 L67 81 L60 91 L53 81 Z" fill="#e9eef7"/>` +
        `<path d="M60 92 l-4.5 5.5 4.5 22.5 4.5-22.5 z" fill="${L.tie}"/>` +
        // lapels last and on top of the shirt, one catching light and one in
        // shadow — it is the only thing keeping the jacket off the background
        `<path d="M34 84 L60 101 L53 120 L28 120 z" fill="#fff" opacity=".07"/>` +
        `<path d="M86 84 L60 101 L67 120 L92 120 z" fill="#000" opacity=".18"/>` +
        `<ellipse cx="38" cy="54" rx="4" ry="5" fill="${L.skin}"/>` +
        `<ellipse cx="82" cy="54" rx="4" ry="5" fill="${L.skin}"/>` +
        `<ellipse cx="60" cy="50" rx="22" ry="26" fill="${L.skin}"/>` +
        // hair: one closed shape across the crown, receding at the temples
        `<path d="M37 50 q-2-24 23-24 q25 0 23 24 q-3-13 -13-16 q-10 4 -20 1 ` +
          `q-9 3 -13 15 z" fill="${L.hair}"/>` +
        `<path d="M49 44 q5-3 9-1" stroke="${L.hair}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
        `<path d="M71 44 q-5-3 -9-1" stroke="${L.hair}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
        `<circle cx="53" cy="50" r="2.4" fill="#1b2430"/>` +
        `<circle cx="67" cy="50" r="2.4" fill="#1b2430"/>` +
        `<path d="M60 52 v7 q-3 1 -4-1" stroke="#00000038" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
        `<path d="M53 65 q7 5 14 0" stroke="#8a4a45" stroke-width="2" fill="none" stroke-linecap="round"/>` +
        // the pin sits out on the lapel, small enough to read as jewellery
        `<g transform="translate(40,99) scale(0.8)">${flagPin(L.pin, L.id)}</g>` +
      `</g>` +
      `<circle cx="60" cy="60" r="57" fill="none" stroke="#2a4a7a" stroke-width="2"/>` +
      `</svg>`;
  }

  // `L` is the leader (identity and portrait); `V` is the version of the call
  // being placed — clip, caption and readout — picked on world opinion back in
  // game.js. Everything that varies with tone comes off `V`, everything that is
  // the same person either way comes off `L`.
  //
  // `onResolve(accepted)` runs the moment the player answers — before the call
  // plays out — so the world-opinion swing is banked and saved even if they
  // close the tab while the leader is still talking.
  function openLeaderCall(L, V, onResolve, onDone) {
    const modal = $('leader-call-modal').querySelector('.modal');
    modal.classList.remove('connected', 'ended');
    $('lc-portrait').innerHTML = drawLeader(L);
    $('lc-country').textContent = L.country;
    // The country is already the line above, so the card carries the office
    // alone — "UNITED KINGDOM / The Prime Minister of the United Kingdom" said
    // it twice. The full title still goes in the sentence, where it reads.
    $('lc-name').textContent = L.office;
    $('lc-state-text').textContent = 'INCOMING — SECURE LINE';
    // the name is a title and carries its own article — mid-sentence it wants a
    // lowercase one, "Mr. President, the President of France is on the line".
    // No pronoun follows it: these are offices rather than named characters,
    // and the game has no business assigning one a gender it never established.
    const midSentence = L.name.charAt(0).toLowerCase() + L.name.slice(1);
    $('lc-line').innerHTML = `<span class="dim">SECRETARY OF STATE —</span> ` +
      `Mr. President, ${midSentence} is on the line, and would like to speak to you personally.`;
    $('lc-outcome').classList.add('hidden');
    $('lc-effect').classList.add('hidden');
    $('lc-footer').innerHTML = '';

    // The switchboard rings until somebody does something about it. Both
    // buttons stop it, and so does closing the popup — a bell still going after
    // the call has been dealt with is the one bug this is worth guarding.
    AudioSys.ringStart();

    const close = () => {
      AudioSys.ringStop();
      $('leader-call-modal').classList.add('hidden');
      if (onDone) onDone();
    };

    const effect = (text, bad) => {
      const box = $('lc-effect');
      box.textContent = text;
      box.classList.toggle('bad', !!bad);
      box.classList.remove('hidden');
    };

    const btn = (label, cls, fn) => {
      const b = document.createElement('button');
      b.className = cls;
      b.textContent = label;
      b.addEventListener('click', fn);
      $('lc-footer').appendChild(b);
      return b;
    };

    btn('DECLINE — SECSTATE TAKES IT', 'btn-secondary', () => {
      AudioSys.ringStop();
      onResolve(false);
      modal.classList.add('ended');
      $('lc-state-text').textContent = 'DECLINED — CALL PASSED TO STATE';
      $('lc-line').textContent = L.declined;
      effect('WORLD OPINION −1', true);
      $('lc-footer').innerHTML = '';
      btn('ACKNOWLEDGE', 'btn-primary', close);
    });

    btn('ACCEPT THE CALL', 'btn-primary', () => {
      AudioSys.ringStop();   // picked up — the bell stops before the line opens
      onResolve(true);
      modal.classList.add('connected');
      $('lc-state-text').textContent = 'LINE OPEN — SECURE';
      $('lc-line').textContent = V.caption;
      effect('WORLD OPINION +1', false);
      $('lc-footer').innerHTML = '';
      // The clip is the scene. END CALL cuts it short and hands straight on to
      // the same finish the clip would have reached on its own, so a player who
      // does not want to sit through the whole thing never has to.
      const end = btn('END CALL', 'btn-secondary', () => AudioSys.cut(V.clip));
      AudioSys.playThen(V.clip, () => {
        modal.classList.remove('connected');
        modal.classList.add('ended');
        $('lc-state-text').textContent = 'CALL ENDED';
        $('lc-outcome').textContent = V.accepted;
        $('lc-outcome').classList.remove('hidden');
        end.textContent = 'ACKNOWLEDGE';
        end.className = 'btn-primary';
        end.replaceWith(end.cloneNode(true));   // drop the cut handler
        $('lc-footer').lastChild.addEventListener('click', close);
      });
    });

    $('leader-call-modal').classList.remove('hidden');
  }

  // ---- endgame ----
  function showEndgame(result) {
    $('end-title').textContent = result.title;
    const vCls = result.kind === 'victory' ? 'end-victory' : result.kind === 'defeat' ? 'end-defeat' : 'end-stalemate';
    let html = `<div class="end-verdict ${vCls}">${result.verdict}</div>`;
    html += `<p class="dim">${result.narrative}</p>`;
    html += '<table class="grade-table">';
    for (const [label, grade, note] of result.grades) {
      html += `<tr><td>${label}<br><span class="dim" style="font-size:11px">${note}</span></td>` +
        `<td class="grade-${grade}">${grade}</td></tr>`;
    }
    html += '</table>';

    // What Tehran was actually doing the whole time. Shown at the end whether
    // or not the player ever spent a slot finding out — and if they didn't, the
    // reveal is the lesson.
    if (result.posture) {
      html += `<div class="end-reveal"><span class="er-label">IRANIAN WAR PLAN</span> ` +
        `<strong>${result.posture.name}</strong>` +
        (result.postureKnown ? ' <span class="dim">(assessed during the war)</span>'
          : ' <span class="warn">(never assessed — you fought this campaign without knowing it)</span>') +
        `<div class="dim">${result.posture.brief}</div></div>`;
    }

    // The campaign, one line a turn. The numbers are the shape of the war: you
    // can see the night it went wrong.
    if (result.timeline && result.timeline.length) {
      html += '<div class="end-section">AFTER-ACTION — THE CAMPAIGN, TURN BY TURN</div>';
      html += '<table class="timeline-table"><tr><th>T</th><th>APPR</th><th>KIA</th><th>NUKE</th><th>DEVELOPMENT</th></tr>';
      for (const r of result.timeline) {
        html += `<tr><td>${r.turn}</td><td>${r.approval}%</td><td>${r.dead}</td>` +
          `<td>${r.deg}%</td><td class="tl-text">${r.text}</td></tr>`;
      }
      html += '</table>';
    }

    html += `<p class="dim">Final: ` +
      `approval ${Math.round(result.stats.approval)}% · oil $${Math.round(result.stats.oil)} · ` +
      `${result.stats.casualties} of ${result.stats.limit} tolerated US dead · ` +
      `${result.stats.destroyed} targets destroyed · ${result.stats.turns} turns · ` +
      `${result.stats.difficulty}</p>`;
    $('end-body').innerHTML = html;
    $('end-modal').classList.remove('hidden');
  }

  // ---- wiring ----
  function init() {
    initPanels();
    initScrollEdge();
    initModalScrollEdge();
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => $(btn.dataset.close).classList.add('hidden'));
    });
    $('btn-confirm-strike').addEventListener('click', () => {
      if (currentTarget && selectedPkg) {
        const t = currentTarget, p = selectedPkg;
        closeStrikeModal();
        Game.executeStrike(t, p);
      }
    });
    $('btn-restart').addEventListener('click', () => window.location.reload());
  }

  // ---- primer ----
  // Reuses the report modal to teach the one thing the advisors cannot say
  // loudly enough: the war is fought in the sidebar as much as on the map.
  // Shown at the start of every war on easy and normal — the reminder is cheap
  // and the mistake it heads off is the most common one there is. Never shown on
  // hard: a player who has chosen the hardest setting does not need the tutorial,
  // and the difficulty description already warns them the staff refuses nothing.
  function showPrimer() {
    if ((Game.G.difficulty || 'normal') === 'hard') return;
    const panels = [
      { cls: 'friendly', title: 'COMMAND IS MORE THAN AIRSTRIKES',
        text: 'Click any Iranian target on the map to plan a strike — but that is only half the job. ' +
          'Every turn you also get TWO free actions in the sidebar: one INTELLIGENCE tasking and one ' +
          'DIPLOMATIC action. They win wars as often as bombs do. Open those panels early and keep using them.' },
      { cls: '', title: 'THE FOUR NUMBERS THAT BEAT YOU',
        text: 'Watch approval, oil, world opinion and casualties along the bottom bar. When approval slips, ' +
          'ADDRESS THE NATION. When oil spikes, release the STRATEGIC PETROLEUM RESERVE. When allies drift, ' +
          'build a COALITION or take it to the UN. A war that is being won on the map is routinely lost at ' +
          'home by a president who never touched these levers.' },
      { cls: 'iran', title: 'AND A WAR PLAN YOU CANNOT SEE',
        text: 'Tehran has chosen a hidden strategy — strangle the Strait, bleed you with missiles, or sprint ' +
          'for a bomb. Read it off what Iran actually does, or spend an intelligence slot to assess their ' +
          'intent. Fight the war in front of you, not the one you expected.' },
    ];
    showReport('PRESIDENTIAL PRIMER — HOW THIS WAR IS FOUGHT', panels, null, { prose: true });
  }

  return { init, renderAll, renderHUD, renderSidebar, setTicker, openStrikeModal, showReport,
    showEndgame, showPrimer, openLeaderCall, closeAllPanels, openPanel };
})();
