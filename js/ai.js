// ============================================================
// ai.js — Iranian AI opponent, advisor recommendations, headlines
// ============================================================

const IranAI = (() => {
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;

  // How many of Iran's missile bases still function (scales retaliation)
  function missileStrength() {
    let s = 0;
    for (const t of TARGETS) {
      if (t.type !== 'missile') continue;
      if (t.status === 'destroyed') continue;
      s += t.status === 'damaged' ? 0.5 : 1;
    }
    return s; // 0..2
  }

  function navalStrength() {
    let s = 0;
    for (const t of TARGETS) {
      if (t.type !== 'naval') continue;
      if (t.status === 'destroyed') continue;
      s += t.status === 'damaged' ? 0.5 : 1;
    }
    return s; // 0..2
  }

  // ---- event builders (return event objects consumed by game.js) ----
  const EV = {
    cyber: () => ({
      title: 'Iranian cyber attack on US financial sector',
      text: 'IRGC-linked hackers briefly disrupted several regional banks and a pipeline operator. Damage contained, but markets noticed.',
      dApproval: -1, dOil: 2,
    }),
    harass: () => ({
      title: 'IRGC fast boats harass Gulf shipping',
      text: 'Swarm craft shadowed a US destroyer and boarded a tanker for "inspection." No shots fired — this time.',
      dOil: 3,
    }),
    propaganda: () => ({
      title: 'Tehran vows "measured but crushing" response',
      text: 'The Supreme Leader\'s office signals it does not seek all-out war, but promises retaliation for any further strikes.',
    }),
    proxyRockets: () => ({
      title: 'Proxy rocket fire near US positions in Iraq',
      text: 'Militia rockets landed near the Baghdad embassy compound and a base perimeter. No US casualties reported.',
      dEsc: 0.3, dOil: 2, flashAsset: 'asad',
    }),
    proxyAttack: () => {
      const c = rand(1, 4);
      return {
        title: 'Militia attack on US forces in Iraq',
        text: `An Iranian-backed militia struck a US position with drones and rockets. ${c} American service members were killed.`,
        casualties: c, dApproval: -3, dEsc: 0.5, dOil: 4, flashAsset: 'asad',
      };
    },
    shipping: () => ({
      title: 'Tanker struck by Iranian drone in Gulf of Oman',
      text: 'A commercial tanker was hit by a loitering munition. Crews survived; insurers are pulling coverage for Gulf transits.',
      dOil: 8, dEsc: 0.3,
    }),
    mineScare: () => ({
      title: 'Mines reported in the Strait of Hormuz',
      text: 'Two tankers reported near-misses with drifting mines. Fifth Fleet has begun minesweeping operations; transits are slowing.',
      hormuz: 'CONTESTED', dOil: 12, dEsc: 0.4,
    }),
    missileBase: (str) => {
      const base = pick(['udeid', 'asad', 'dhafra']);
      const names = { udeid: 'Al Udeid Air Base in Qatar', asad: 'Ain al-Asad Air Base in Iraq', dhafra: 'Al Dhafra Air Base in the UAE' };
      const c = Math.round(rand(2, 8) * Math.max(0.3, str / 2));
      return {
        title: `Ballistic missile strike on ${names[base]}`,
        text: `Iranian missiles penetrated air defenses at ${names[base]}. ${c} Americans were killed and aircraft were damaged on the ramp.`,
        casualties: c, dApproval: -4, dEsc: 0.7, dOil: 8, flashAsset: base,
      };
    },
    hormuzClose: () => ({
      title: 'IRAN MOVES TO CLOSE THE STRAIT OF HORMUZ',
      text: 'Anti-ship missile batteries are active, minelayers are operating at night, and Tehran has declared the Strait closed to "hostile" shipping. A fifth of the world\'s oil is now blocked.',
      hormuz: 'CLOSED', dOil: 35, dEsc: 0.8,
    }),
    allyStrike: () => {
      const tgt = pick(['Saudi oil facilities at Abqaiq', 'Israeli port infrastructure at Haifa', 'Emirati facilities near Abu Dhabi']);
      return {
        title: `Iranian missiles strike ${tgt.split(' at ')[0]}`,
        text: `A missile and drone salvo hit ${tgt}. Allied capitals are demanding either decisive US action or immediate de-escalation.`,
        dEsc: 0.8, dOil: 14, dWorld: -3, dApproval: -2,
      };
    },
    massBarrage: (str) => {
      const c = Math.round(rand(12, 30) * Math.max(0.4, str / 2));
      return {
        title: 'MASS MISSILE BARRAGE ACROSS THE THEATER',
        text: `Iran launched its largest salvo of the crisis at US bases and fleet units across the region. Defenses were saturated. ${c} Americans are dead. CENTCOM assesses this as the opening of a general war.`,
        casualties: c, dApproval: -6, dEsc: 1.5, dOil: 20, flashAsset: 'udeid',
      };
    },
    quiet: () => ({
      title: 'Tehran pauses',
      text: 'Intelligence reports internal debate in Tehran. No significant Iranian military action in the last 12 hours.',
      dEsc: -0.3,
    }),
    backchannelFeeler: () => ({
      title: 'Quiet feeler through Oman',
      text: 'Muscat passes word that elements in Tehran may be looking for an off-ramp — if the pressure and the humiliation both stop rising.',
      dEsc: -0.2,
    }),
  };

  // Decide Iran's response this turn based on game state
  function respond(G) {
    const events = [];
    const esc = G.escalation;
    const mStr = missileStrength();
    const nStr = navalStrength();
    const struckOil = G.struckThisTurn.some(id => ['kharg', 'abadan'].includes(id));
    const struckNuclear = G.struckThisTurn.some(id => ['natanz', 'fordow'].includes(id));
    const struckAny = G.struckThisTurn.length > 0;

    // Revenge logic: hitting oil draws shipping/economic retaliation
    if (struckOil && nStr > 0) events.push(chance(0.6) ? EV.shipping() : EV.mineScare());

    if (esc >= 8.5) {
      events.push(EV.massBarrage(mStr));
      if (G.hormuz !== 'CLOSED' && nStr > 0 && chance(0.7)) events.push(EV.hormuzClose());
    } else if (esc >= 6.5) {
      if (mStr > 0 && chance(0.75)) events.push(EV.missileBase(mStr));
      else events.push(EV.proxyAttack());
      if (G.hormuz === 'OPEN' && nStr > 0 && chance(0.35)) events.push(EV.mineScare());
      else if (G.hormuz === 'CONTESTED' && nStr > 0 && chance(0.3)) events.push(EV.hormuzClose());
      if (chance(0.35)) events.push(EV.allyStrike());
    } else if (esc >= 4.5) {
      const pool = [EV.proxyAttack, EV.shipping, EV.proxyRockets, EV.cyber];
      events.push(pick(pool)());
      if (struckNuclear && mStr > 0 && chance(0.55)) events.push(EV.missileBase(mStr));
      if (G.hormuz === 'OPEN' && nStr > 0 && chance(0.15)) events.push(EV.mineScare());
    } else if (esc >= 2.5) {
      const pool = [EV.proxyRockets, EV.harass, EV.cyber, EV.propaganda];
      events.push(pick(pool)());
      if (struckAny && chance(0.3)) events.push(EV.proxyAttack());
    } else {
      events.push(chance(0.5) ? EV.quiet() : EV.backchannelFeeler());
    }

    // Hormuz can reopen when things cool down and Iran's navy is beaten up
    if (G.hormuz !== 'OPEN' && esc < 5 && (nStr < 1 || chance(0.4))) {
      events.push({
        title: 'Strait of Hormuz reopening',
        text: 'With minesweepers working and Iranian naval activity reduced, convoys are moving again under escort.',
        hormuz: 'OPEN', dOil: -18,
      });
    }

    return events;
  }

  // ---- Advisors ----
  function advise(G) {
    const esc = G.escalation;
    const nukeDeg = G.nukeDegraded();
    const adLeft = TARGETS.filter(t => t.type === 'airdefense' && t.status !== 'destroyed').length;

    const secdef = { name: 'SecDef Whitfield', cls: 'hawk', text: '' };
    const secstate = { name: 'SecState Okafor', cls: 'dove', text: '' };
    const nsa = { name: 'NSA Reyes', cls: '', text: '' };
    const cjcs = { name: 'Gen. Halvorsen, CJCS', cls: 'mil', text: '' };

    if (nukeDeg >= 100) {
      secdef.text = 'The nuclear program is finished. Keep the pressure on their missile force so they can\'t hit back while State works the endgame.';
    } else if (esc >= 7) {
      secdef.text = 'We\'re past half-measures, Mr. President. Finish the target list — enrichment sites and missile bases — before they can reconstitute.';
    } else {
      secdef.text = 'Restraint reads as weakness in Tehran. I recommend we strike the enrichment sites now while we hold escalation dominance.';
    }

    if (esc >= 7) {
      secstate.text = 'We are one bad night from regional war. I need you to pause strikes and let me open the Omani backchannel before this is out of anyone\'s control.';
    } else if (G.negotiationReady()) {
      secstate.text = 'The program is degraded and Tehran is hurting. This is the window — authorize the backchannel and let\'s get them to the table.';
    } else {
      secstate.text = 'Every strike costs us allies. Pair any military action with UN pressure and sanctions so we\'re not isolated when this ends.';
    }

    if (G.hormuz === 'CLOSED') {
      nsa.text = 'The Strait is the whole ballgame right now. Every turn it stays closed bleeds the economy — hit their naval bases or cool this down fast.';
    } else if (G.approval < 35) {
      nsa.text = 'Your political capital is nearly spent. Congress smells blood. We need visible wins or visible peace — drift is fatal.';
    } else if (esc >= 8) {
      nsa.text = 'At this escalation level their leadership may believe regime survival is at stake. Cornered adversaries do irrational things.';
    } else {
      nsa.text = 'Watch the ladder. Each rung up is easy; climbing down costs blood or prestige. Keep an off-ramp visible to Tehran at all times.';
    }

    if (adLeft >= 2) {
      cjcs.text = `Their air defense network is largely intact — ${adLeft} SAM complexes active. Non-stealth strikes carry real attrition risk. Recommend SEAD first, or lean on the B-2s.`;
    } else if (nukeDeg < 100) {
      cjcs.text = 'Skies are relatively permissive now. Fordow requires a B-2 with penetrators — nothing else touches it. Natanz we can service with either bombers or a heavy Tomahawk package.';
    } else {
      cjcs.text = 'Primary target set serviced. Remaining risk is their residual missile force and small-boat navy. We can hold what we\'ve gained if escalation stabilizes.';
    }

    return [secdef, secstate, nsa, cjcs];
  }

  // ---- Headlines for the ticker ----
  function headlines(G, events) {
    const h = [];
    for (const ev of events) h.push(ev.title.toUpperCase());
    if (G.oil > 150) h.push(`OIL SHOCK: BRENT AT $${Math.round(G.oil)} — RECESSION FEARS MOUNT`);
    else if (G.oil > 110) h.push(`BRENT CRUDE TOPS $${Math.round(G.oil)} AS CRISIS PREMIUM GROWS`);
    if (G.approval < 35) h.push('POLL: PRESIDENT\'S HANDLING OF CRISIS UNDERWATER, IMPEACHMENT TALK GROWS');
    else if (G.approval > 60) h.push('RALLY EFFECT: PUBLIC BACKS PRESIDENT\'S CRISIS MANAGEMENT');
    if (G.escalation >= 8) h.push('NETWORKS GO WALL-TO-WALL: "IS THIS WAR?"');
    if (G.hormuz === 'CLOSED') h.push('GAS LINES FORM AS HORMUZ CLOSURE CHOKES GLOBAL SUPPLY');
    const fillers = [...FILLER_HEADLINES].sort(() => Math.random() - 0.5).slice(0, 3);
    return [...h, ...fillers];
  }

  return { respond, advise, headlines };
})();
