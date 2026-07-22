// ============================================================
// ui.js — HUD, sidebar, modals, ticker rendering
// ============================================================

const UI = (() => {
  const $ = (id) => document.getElementById(id);

  let selectedPkg = null;
  let currentTarget = null;

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
      return;
    }
    const urgent = brk.hi <= 6 ? ' urgent' : brk.hi <= 12 ? ' warn' : '';
    box.className = 'breakout' + urgent;
    box.innerHTML = '<span class="bo-label">EST. TIME TO A DEVICE</span>' +
      `<span class="bo-value">${brk.lo}–${brk.hi} turns</span>` +
      `<span class="bo-conf">${brk.conf} confidence</span>`;
  }

  function renderResources(G) {
    // the bomber line reads as a deployment status until there is a force to count
    const b2 = G.bombersArrived ? `${G.res.stealth} / ${G.caps.stealth}`
      : G.bombersOrdered ? `EN ROUTE — ${G.bomberEta}T` : 'NOT IN THEATER';
    const rows = [
      ['Fighter sorties', `${G.res.fighters} / ${G.caps.fighters}`],
      ['Cruise missiles (TLAM)', `${G.res.cruise} / ${G.caps.cruise}`],
      ['B-2 missions (GBU-57)', b2],
      ['SOF task force (Tier 1)', `${G.res.specops} / ${G.caps.specops}`],
    ];
    let html = rows.map(([n, v]) =>
      `<div class="res-row"><span>${n}</span><span class="res-count">${v}</span></div>`).join('');
    // Tanker tracks are the other magazine, and the one that actually runs out.
    // Shown with the reach it buys, because "6 tracks" means nothing on its own
    // and "6 tracks — one deep package" means everything.
    const tk = G.tankers, cap = G.tankerCap || Game.tankerCapacity();
    const tkCls = tk <= 2 ? 'crit' : tk <= 5 ? 'warn' : '';
    html += `<div class="res-row tanker-row"><span>Tanker tracks tonight</span>` +
      `<span class="res-count ${tkCls}">${tk} / ${cap}</span></div>`;
    html += `<div class="res-note dim">Littoral package 3 · interior 4 · deep 5 · B-2 mission 4 · ` +
      `Tomahawks fly unrefuelled.` +
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

    $('fleet-buttons').innerHTML = buttons + bomberBtn;
    for (const btn of $('fleet-buttons').querySelectorAll('button')) {
      if (btn.dataset.carrierOrder) btn.addEventListener('click', () => Game.orderCarrier());
      else if (btn.dataset.bomberOrder) btn.addEventListener('click', () => Game.orderBombers());
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
        id: 'address', name: 'Address the nation',
        desc: G.addressCooldown > 0
          ? `Available in ${G.addressCooldown} turn(s).`
          : `Rally the public. Approval +6 — and it is counted when the War Powers vote comes up ` +
            `(${G.addresses} so far).`,
        disabled: G.addressCooldown > 0,
      },
    ];

    // ---- intelligence taskings ----
    // Same slot, different currency: these buy knowing instead of doing.
    const hidden = IranAI.liveTels().filter(t => !t.located).length;
    const brk = Game.breakoutEstimate();
    const intel = [
      {
        id: 'bda', name: 'Task a collection deck — reassess damaged sites',
        desc: 'Overhead, a Global Hawk orbit and the signals picture against the three sites the ' +
          'analysts are least sure of. Narrows their estimates to ±3 — which is the difference between ' +
          'knowing a site needs one more package and guessing.',
      },
      {
        id: 'hunt', name: 'Hunt dispersed launchers',
        desc: hidden
          ? `${hidden} launcher group${hidden === 1 ? '' : 's'} loose in the country and shooting. A sweep ` +
            'may find one. Found is not killed — they move again if they are not serviced the same turn.'
          : 'No dispersed launchers unaccounted for.',
        disabled: !hidden,
      },
      {
        id: 'assess-nuclear', name: 'Reassess the enrichment timeline',
        desc: brk.halted
          ? 'Enrichment capability is destroyed. There is no timeline left to assess.'
          : `Current judgement: ${brk.lo}–${brk.hi} turns, ${brk.conf} confidence. Narrows the band — ` +
            'the estimate is what the whole campaign is being paced against.',
        disabled: brk.halted,
      },
      {
        id: 'assess-intent', name: 'Assess Iranian war plan',
        desc: G.postureKnown
          ? `Assessed: ${IranAI.posture().name}. ${IranAI.posture().brief}`
          : 'The Agency can tell you which arm Tehran has decided to fight this war with — and therefore ' +
            'which one is worth spending the campaign destroying. One tasking, permanent answer.',
        disabled: G.postureKnown,
      },
    ];
    const render = (list) => list.map(a =>
      `<button data-diplo="${a.id}" ${used || a.disabled ? 'disabled' : ''}>` +
      `${a.name}<span class="diplo-desc">${a.desc}</span></button>`).join('');
    $('diplo-buttons').innerHTML = render(actions);
    $('intel-buttons').innerHTML = render(intel);
    $('intel-status').textContent = used ? '— SLOT SPENT THIS TURN' : '';
    for (const btn of document.querySelectorAll('#diplo-buttons button, #intel-buttons button')) {
      btn.addEventListener('click', () => Game.doDiplo(btn.dataset.diplo));
    }
  }

  function renderSidebar(G) {
    CSAR.renderPanel(G);   // hidden unless there are Americans on the ground
    renderObjectives(G);
    renderResources(G);
    renderFleet(G);
    renderAdvisors(G);
    renderDiplo(G);
    SpecOps.renderPanel(G);
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
      const have = G.res[pkg.asset === 'fighter' ? 'fighters' : pkg.asset] ?? 0;
      const { cost, ok: fuelOk } = Game.tankersFor(target, pkg);
      const stockOk = have >= pkg.qty;
      const ok = stockOk && fuelOk;
      const div = document.createElement('div');
      div.className = 'pkg-option' + (ok ? '' : ' unavailable');
      // when a package can't fly, the reason matters: an empty magazine and an
      // empty tanker plan are different problems with different answers
      const why = stockOk ? '' : ' — MAGAZINE SHORT';
      const fuelWhy = !fuelOk ? ' — NO TANKER TRACKS' : '';
      div.innerHTML = `<span class="pkg-name">${pkg.label}</span>` +
        `<span class="pkg-detail">Requires ${pkg.qty}× ${ASSET_NAMES[pkg.asset].toLowerCase()} ` +
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
      `${est.tanker || 'none'}${est.tanker ? ` of ${G.tankers} tracks left tonight` : ' — flies unrefuelled'}` +
      `</span><br>` +
      `${tot}<br>` +
      `WORLD OPINION: <span class="est-warn">${worldCost}</span>` +
      (pkg.extraWorld ? ` <span class="dim">(${target.world} target, ${pkg.extraWorld} for flying it with Israel)</span>` : '') + `<br>`;
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
