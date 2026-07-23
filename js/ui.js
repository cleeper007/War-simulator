// ============================================================
// ui.js — HUD, sidebar, modals, ticker rendering
// ============================================================

const UI = (() => {
  const $ = (id) => document.getElementById(id);

  let selectedPkg = null;
  let currentTarget = null;

  // ============================================================
  // COLLAPSIBLE SIDEBAR PANELS
  // ------------------------------------------------------------
  // The sidebar is eight sections deep and only one of them is ever the one
  // being used. Each is a dropdown: the header is the hit target, the caret
  // turns, and the open/shut state survives a reload — a player who works out
  // of diplomacy and intelligence should not have to re-open them every war.
  // A shut section is not silent: its badge carries the one thing worth knowing
  // from the outside, which for an action panel is how many orders in it can
  // actually be given tonight.
  // ============================================================
  const PANEL_KEY = 'cic-panels-v1';
  let panelState = {};

  function savePanelState() {
    try { localStorage.setItem(PANEL_KEY, JSON.stringify(panelState)); } catch (e) {}
  }

  function setPanelOpen(panel, open) {
    panel.classList.toggle('collapsed', !open);
    panel.querySelector('.panel-head').setAttribute('aria-expanded', String(open));
    panelState[panel.dataset.panel] = open;
  }

  function initPanels() {
    try { panelState = JSON.parse(localStorage.getItem(PANEL_KEY)) || {}; }
    catch (e) { panelState = {}; }
    for (const panel of document.querySelectorAll('#sidebar-scroll .panel[data-panel]')) {
      const key = panel.dataset.panel;
      // the markup carries the default; storage overrides it when the player
      // has an opinion
      if (key in panelState) setPanelOpen(panel, panelState[key]);
      panel.querySelector('.panel-head').addEventListener('click', () => {
        const opening = panel.classList.contains('collapsed');
        setPanelOpen(panel, opening);
        savePanelState();
        // a section opened at the bottom of the list would otherwise expand
        // off-screen: pull it back into the scroll once it has finished growing
        if (opening) setTimeout(() => panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 200);
      });
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
      const total = box.querySelectorAll('button').length;
      const live = box.querySelectorAll('button:not(:disabled)').length;
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

    const oil = $('oil-value');
    oil.textContent = `$${Math.round(G.oil)}`;
    oil.className = 'stat-value big ' + (G.oil >= 150 ? 'crit' : G.oil >= 110 ? 'warn' : '');

    const hz = $('hormuz-value');
    hz.textContent = G.hormuz;
    hz.className = 'stat-value big ' + (G.hormuz === 'CLOSED' ? 'crit' : G.hormuz === 'CONTESTED' ? 'warn' : 'good');

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
    const rows = [
      ['5th-gen sorties (F-35/F-22)', `${G.res.f35} / ${G.caps.f35}`, short('f35', true)],
      ['4th-gen sorties (F-15E/F-16)', `${G.res.fighters} / ${G.caps.fighters}`,
        held('degraded', true) || short('fighter', true)],
      ['Cruise missiles (TLAM)', `${G.res.cruise} / ${G.caps.cruise}`, short('cruise', true)],
      ['B-2 missions (GBU-57)', b2, short('stealth', G.bombersArrived)],
      ['Heavy bombers (B-1/B-52)', hv,
        held('superiority', G.heaviesArrived) || short('heavy', G.heaviesArrived)],
      ['SOF task force (Tier 1)', `${G.res.specops} / ${G.caps.specops}`, ''],
    ];
    let html = renderAirPhase(G);
    html += rows.map(([n, v, gate]) =>
      `<div class="res-row"><span>${n}${gate}</span>` +
      `<span class="res-count${gate.includes('crit') ? ' crit' : ''}">${v}</span></div>`).join('');
    // Tanker tracks are the other magazine, and the one that actually runs out.
    // Shown with the reach it buys, because "6 tracks" means nothing on its own
    // and "6 tracks — one deep package" means everything.
    const tk = G.tankers, cap = G.tankerCap || Game.tankerCapacity();
    const tkCls = tk <= 2 ? 'crit' : tk <= 5 ? 'warn' : '';
    html += `<div class="res-row tanker-row"><span>Tanker tracks tonight</span>` +
      `<span class="res-count ${tkCls}">${tk} / ${cap}</span></div>`;
    html += `<div class="res-note dim">Fighter package: littoral 3 · interior 4 · deep 5 · ` +
      `heavies one more apiece · B-2 mission 4 · Tomahawks fly unrefuelled.` +
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
    // B-2s still crossing the Indian Ocean get a transit card in the scope panel
    MapView.updateTransit(G.missions);
  }

  // ---- carrier strike groups ----
  // The panel answers three questions at a glance: where is each deck, what is
  // it worth there, and can it be shot at.
  function carrierLine(cv) {
    if (cv.lost) return { label: 'LOST', cls: 'cv-lost', note: 'Sunk in the North Arabian Sea.' };
    if (!cv.arrived) return null;   // handled by the order/ETA button below
    if (cv.moving) {
      return {
        label: cv.moving === 'forward' ? 'CLOSING NORTHWEST' : 'WITHDRAWING',
        cls: 'cv-moving',
        note: 'Repositioning — 50% strike capability, and still inside the envelope until she is clear.',
      };
    }
    if (cv.posture === 'forward') {
      return {
        label: 'ON STATION — N. ARABIAN SEA', cls: 'cv-forward',
        note: (cv.damaged ? 'Battle damage: flying at a fraction of her rate. ' : '') +
          'Full sortie generation. Under threat from Iranian anti-ship fires.',
      };
    }
    return {
      label: 'DEEP ARABIAN SEA', cls: 'cv-back',
      note: (cv.damaged ? 'Battle damage: flying at a fraction of her rate. ' : '') +
        'Out of reach. 50% strike capability.',
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
        note: `${G.res.stealth} of ${G.caps.stealth} mission(s) generated. 2,900 nm south of the fight and out of Iranian reach.`,
      };
    }
    if (G.bombersOrdered) {
      return {
        label: 'EN ROUTE — WHITEMAN → DIEGO GARCIA', cls: 'cv-moving',
        note: `Crossing the Pacific on tankers — ${G.bomberEta} turn(s) out.`,
      };
    }
    return {
      label: 'NOT IN THEATER', cls: 'cv-away',
      note: 'At Whiteman AFB, Missouri. One turn to Diego Garcia — and the only aircraft in the inventory that can reach Fordow.',
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
        note: `${G.res.heavy} of ${G.caps.heavy} mission(s) generated. ` + (released
          ? 'Air superiority holds and the cells are on tonight\'s tasking order.'
          : 'They will not be tasked until the SAM belt is back down. Until then they are the most expensive parked aircraft in the world.'),
      };
    }
    if (G.heaviesOrdered) {
      return {
        label: 'EN ROUTE — CONUS → DIEGO GARCIA', cls: 'cv-moving',
        note: `Crossing on tankers — ${G.heavyEta} turn(s) out.`,
      };
    }
    return {
      label: 'NOT IN THEATER', cls: 'cv-away',
      note: Game.phaseAtLeast('degraded')
        ? 'B-1s at Dyess and B-52s at Barksdale. Two turns to Diego Garcia — and the heaviest conventional weight in the inventory.'
        : 'B-1s at Dyess and B-52s at Barksdale. They will not be moved into a theater whose air defenses are still intact.',
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
      const note = st ? st.note
        : G.secondCarrierOrdered
          ? `Under way from the Indian Ocean — ${G.secondCarrierEta} turn(s) out.`
          : 'Available to be surged into the theater.';
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

    const buttons = G.carriers.map(cv => {
      const info = CARRIER_INFO[cv.id];
      if (cv.lost) return '';
      if (!cv.arrived) {
        if (G.secondCarrierOrdered) {
          return `<button disabled>${info.short} EN ROUTE<span class="diplo-desc">` +
            `ETA ${G.secondCarrierEta} turn(s). She cannot be hurried.</span></button>`;
        }
        if (planCut) {
          return `<button disabled>NAVAL TRANSIT COMMITTED — B-2 FORCE MOVING` +
            `<span class="diplo-desc">Fifth Fleet cuts one transit plan a night, and tonight's is the ` +
            `509th. ${info.short} can be surged next turn.</span></button>`;
        }
        return `<button data-carrier-order="1">SURGE ${info.short} TO THE THEATER` +
          `<span class="diplo-desc">Orders ${info.name} into theater. ${Game.FORD_TRANSIT_TURNS} turns out; ` +
          `arrives at standoff in the deep Arabian Sea. Costs no money and no lives — it costs tonight's naval ` +
          `transit, so the B-2s cannot be moved until next turn.</span></button>`;
      }
      const fwd = cv.posture === 'forward';
      return `<button data-carrier-toggle="${cv.id}" ${cv.moving ? 'disabled' : ''}>` +
        (cv.moving ? `${info.short} REPOSITIONING`
          : fwd ? `PULL ${info.short} BACK TO THE DEEP ARABIAN SEA`
          : `SEND ${info.short} FORWARD TO THE NORTH ARABIAN SEA`) +
        `<span class="diplo-desc">` +
        (cv.moving ? 'The order is given. She is between stations until the end of the turn.'
          : fwd ? 'Takes one turn at 50% capability, exposed until she is clear. Safe once there, at half the strike power.'
          : 'Takes one turn at 50% capability. Full sortie generation once on station — and a hull inside Iran\'s anti-ship envelope.') +
        `</span></button>`;
    }).join('');

    let bomberBtn = '';
    if (!G.bombersArrived) {
      if (bomberInbound) {
        bomberBtn = `<button disabled>B-2 FORCE EN ROUTE<span class="diplo-desc">` +
          `ETA ${G.bomberEta} turn(s). They land, they get built up, then they fly.</span></button>`;
      } else if (planCut) {
        bomberBtn = `<button disabled>NAVAL TRANSIT COMMITTED — FORD UNDER WAY` +
          `<span class="diplo-desc">Tonight's transit plan is the carrier surge. The 509th moves on ` +
          `tomorrow's — they do not wait on her arrival.</span></button>`;
      } else {
        bomberBtn = `<button data-bomber-order="1">DEPLOY B-2 FORCE — WHITEMAN → DIEGO GARCIA` +
          `<span class="diplo-desc">Moves the 509th into theater. ${Game.B2_TRANSIT_TURNS} turn out; unlocks ` +
          `GBU-57 penetrator missions — the only way to reach Fordow. Takes tonight's naval transit, so the ` +
          `${CARRIER_INFO['csg-ford'].short} cannot be surged until next turn.</span></button>`;
      }
    }

    // the heavies want the sky to be breaking before anyone will move them, and
    // they take a transit slot like everything else
    let heavyBtn = '';
    if (!G.heaviesArrived) {
      if (G.heaviesOrdered) {
        heavyBtn = `<button disabled>HEAVY BOMBER FORCE EN ROUTE<span class="diplo-desc">` +
          `ETA ${G.heavyEta} turn(s) to Diego Garcia.</span></button>`;
      } else if (!Game.phaseAtLeast('degraded')) {
        heavyBtn = `<button disabled>HEAVY BOMBERS — AIRSPACE STILL CONTESTED<span class="diplo-desc">` +
          `Air Combat Command will not flow B-1s and B-52s into a theater with an intact SAM belt. ` +
          `Degrade the air defense network and the force becomes available to call forward.</span></button>`;
      } else if (planCut) {
        heavyBtn = `<button disabled>TRANSIT COMMITTED — ANOTHER FORCE IS MOVING` +
          `<span class="diplo-desc">One force flow a night. The heavies go out on tomorrow's plan.</span></button>`;
      } else {
        heavyBtn = `<button data-heavy-order="1">DEPLOY HEAVY BOMBER FORCE — CONUS → DIEGO GARCIA` +
          `<span class="diplo-desc">Moves the B-1 and B-52 force into theater. ${Game.HEAVY_TRANSIT_TURNS} turns out. ` +
          `Each package takes roughly half again what a fighter package takes off a target — but they will not be ` +
          `tasked until air superiority is declared, so calling them early is a bet on the campaign going well.</span></button>`;
      }
    }

    $('fleet-buttons').innerHTML = buttons + bomberBtn + heavyBtn;
    for (const btn of $('fleet-buttons').querySelectorAll('button')) {
      if (btn.dataset.carrierOrder) btn.addEventListener('click', () => Game.orderCarrier());
      else if (btn.dataset.bomberOrder) btn.addEventListener('click', () => Game.orderBombers());
      else if (btn.dataset.heavyOrder) btn.addEventListener('click', () => Game.orderHeavies());
      else if (btn.dataset.carrierToggle) {
        btn.addEventListener('click', () => Game.toggleCarrierPosture(btn.dataset.carrierToggle));
      }
    }
  }

  function renderAdvisors(G) {
    const advice = IranAI.advise(G);
    $('advisors-list').innerHTML = advice.map(a =>
      `<div class="advisor ${a.cls}"><div class="adv-name">${a.name}</div>${a.text}</div>`).join('');
  }

  function renderDiplo(G) {
    const used = G.diploUsed;
    $('diplo-status').textContent = used ? '— USED THIS TURN' : '';
    const negReady = G.negotiationReady();
    const actions = [
      {
        id: 'backchannel', name: 'Omani backchannel',
        desc: negReady
          ? 'Tehran is breaking. A deal is possible — but far from certain. Attempt to bring them to the table.'
          : 'Tehran won\'t talk while it can still fight. An overture now will be rebuffed and read as weakness at home.',
      },
      {
        id: 'un', name: 'UN Security Council push',
        desc: 'Rally international support and diplomatic cover. World opinion +.',
      },
      {
        id: 'sanctions', name: 'Snap-back sanctions package',
        desc: 'Tighten economic pressure. Improves negotiation leverage; small oil-price cost.',
      },
      {
        id: 'coalition', name: 'Build strike coalition',
        desc: G.coalition ? 'Coalition assembled — allied sorties added.' : 'Bring allies in formally. Adds fighter capacity, world opinion +.',
        disabled: G.coalition,
      },
      {
        id: 'israel', name: 'Coordinate with Israel',
        desc: G.israelPosture === 'coordinated'
          ? 'Israel is in the operation. Joint deep-strike package available at Natanz/Fordow.'
          : G.israelPosture === 'unilateral'
            ? 'Too late — Israel acted on its own.'
            : `Bring the IAF in openly. Adds fighter capacity and ONE joint deep-strike package against Natanz or Fordow. Widens the war: world opinion −8, and Iran starts shooting at Israel. They go alone in ${G.israelPatience} turn(s) regardless.`,
        disabled: G.israelPosture !== 'sidelined',
      },
      {
        id: 'spr', name: 'Release the Strategic Reserve',
        desc: G.sprReleases >= 2
          ? 'Reserve drawn down — the tanks are too low for another release of scale.'
          : `Coordinated SPR draw to push the pump price down. Oil ${G.sprReleases === 0 ? '−$20' : '−$12'}, approval +2. ` +
            `${2 - G.sprReleases} release(s) left.`,
        disabled: G.sprReleases >= 2,
      },
      {
        id: 'address', name: 'Address the nation',
        desc: G.addressCooldown > 0
          ? `Available in ${G.addressCooldown} turn(s).`
          : `Rally the public. Approval +6 — and it is counted when the War Powers vote comes up ` +
            `(${G.addresses} so far).`,
        disabled: G.addressCooldown > 0,
      },
    ];

    $('diplo-buttons').innerHTML = actionButtons(actions, used);
    wireActions('#diplo-buttons');
  }

  // one control for every order the player can give, so a tasking looks like a
  // tasking wherever it is rendered
  function actionButtons(list, used) {
    return list.map(a =>
      `<button data-diplo="${a.id}" ${used || a.disabled ? 'disabled' : ''}>` +
      `${a.name}<span class="diplo-desc">` +
      (a.current ? `<span class="il-current">${a.current}</span>` : '') +
      `${a.desc}</span></button>`).join('');
  }

  function wireActions(sel) {
    for (const btn of document.querySelectorAll(`${sel} button`)) {
      btn.addEventListener('click', () => Game.doDiplo(btn.dataset.diplo));
    }
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

    const intel = [
      {
        id: 'bda', name: 'Task a collection deck — reassess damaged sites',
        current: 'Sharpens the three battle-damage estimates the analysts trust least.',
        desc: 'Overhead, a Global Hawk orbit and the signals picture. Narrows those estimates to ±3 — ' +
          'which is the difference between knowing a site needs one more package and guessing.',
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
        current: posture ? `Assessed: ${posture.name}.` : 'Never assessed.',
        desc: posture
          ? posture.brief
          : 'The Agency can tell you which arm Tehran has decided to fight this war with — and therefore ' +
            'which one is worth spending the campaign destroying. One tasking, permanent answer.',
        disabled: G.postureKnown,
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
    if (csarWasHidden && !csarHidden) { setPanelOpen(csar, true); savePanelState(); }
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
  // Asset names carry aircraft designations now, so they cannot be blanket
  // lowercased to sit mid-sentence — only the first letter comes down.
  const lcFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

  function openStrikeModal(G, target) {
    currentTarget = target;
    selectedPkg = null;
    $('strike-target-name').textContent = target.name.toUpperCase();
    $('strike-target-desc').textContent = target.desc;
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
      const have = G.res[Game.resKey(pkg.asset)] ?? 0;
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
        `<span class="pkg-detail">Requires ${pkg.qty}× ${lcFirst(ASSET_NAMES[pkg.asset])} ` +
        `(available: ${have})${why} · ${cost ? `${cost} tanker track${cost === 1 ? '' : 's'} ` +
        `of ${G.tankers} left${fuelWhy}` : 'no tanker requirement'}</span>`;
      if (ok) {
        div.addEventListener('click', () => {
          box.querySelectorAll('.pkg-option').forEach(el => el.classList.remove('selected'));
          div.classList.add('selected');
          selectedPkg = pkg;
          showEstimate(G, target, pkg);
          $('btn-confirm-strike').disabled = false;
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
    const ramp = pkg.asset === 'stealth' || pkg.asset === 'heavy';
    const eta = pkg.eta || (ramp ? 2 : 1);
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
      `${est.tanker || 'none'}${est.tanker ? ` of ${G.tankers} tracks left tonight` : ' — flies unrefuelled'}` +
      `</span><br>` +
      `${tot}<br>` +
      `WORLD OPINION: <span class="est-warn">${worldCost}</span>` +
      (pkg.extraWorld ? ` <span class="dim">(${target.world} target, ${pkg.extraWorld} for flying it with Israel)</span>` : '') + `<br>`;
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
  function showReport(title, events, onClose) {
    $('report-title').textContent = title;
    $('report-body').innerHTML = events.map(ev => {
      const effects = [];
      if (ev.casualties) effects.push(`US KIA +${ev.casualties}`);
      if (ev.dApproval) effects.push(`Approval ${ev.dApproval > 0 ? '+' : ''}${ev.dApproval}`);
      if (ev.dOil) effects.push(`Oil ${ev.dOil > 0 ? '+' : ''}$${ev.dOil}`);
      if (ev.dWorld) effects.push(`World opinion ${ev.dWorld > 0 ? '+' : ''}${ev.dWorld}`);
      if (ev.dTanker) effects.push(`Tanker tracks ${ev.dTanker > 0 ? '+' : ''}${ev.dTanker}/turn`);
      if (ev.hormuz) effects.push(`Hormuz → ${ev.hormuz}`);
      return `<div class="report-event ${ev.cls || ''}">` +
        `<div class="ev-title">${ev.title}</div>` +
        `<div>${ev.text}</div>` +
        (effects.length ? `<div class="ev-effects">${effects.join(' · ')}</div>` : '') +
        `</div>`;
    }).join('');
    $('report-modal').classList.remove('hidden');
    $('btn-report-ok').onclick = () => {
      $('report-modal').classList.add('hidden');
      if (onClose) onClose();
    };
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

  return { init, renderAll, renderHUD, renderSidebar, setTicker, openStrikeModal, showReport, showEndgame };
})();
