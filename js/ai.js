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
      dOil: 2, flashAsset: 'asad', attack: { kind: 'drone', base: 'asad', count: 3 },
    }),
    proxyAttack: () => {
      const c = rand(1, 4);
      return {
        title: 'Militia attack on US forces in Iraq',
        text: `An Iranian-backed militia struck a US position with drones and rockets. ${c} American service members were killed.`,
        casualties: c, dApproval: -3, dOil: 4, flashAsset: 'asad',
        attack: { kind: 'drone', base: 'asad', count: 5 },
      };
    },
    shipping: () => ({
      title: 'Tanker struck by Iranian drone in Gulf of Oman',
      text: 'A commercial tanker was hit by a loitering munition. Crews survived; insurers are pulling coverage for Gulf transits.',
      dOil: 8,
    }),
    mineScare: () => ({
      title: 'Mines reported in the Strait of Hormuz',
      text: 'Two tankers reported near-misses with drifting mines. Fifth Fleet has begun minesweeping operations; transits are slowing.',
      hormuz: 'CONTESTED', dOil: 12,
    }),
    missileBase: (str) => {
      const base = pick(['udeid', 'asad', 'dhafra']);
      const names = { udeid: 'Al Udeid Air Base in Qatar', asad: 'Ain al-Asad Air Base in Iraq', dhafra: 'Al Dhafra Air Base in the UAE' };
      const c = Math.round(rand(2, 8) * Math.max(0.3, str / 2));
      return {
        title: `Ballistic missile strike on ${names[base]}`,
        text: `Iranian missiles penetrated air defenses at ${names[base]}. ${c} Americans were killed and aircraft were damaged on the ramp.`,
        casualties: c, dApproval: -4, dOil: 8, flashAsset: base,
        attack: { kind: 'missile', base, count: 4 },
      };
    },
    hormuzClose: () => ({
      title: 'IRAN MOVES TO CLOSE THE STRAIT OF HORMUZ',
      text: 'Anti-ship missile batteries are active, minelayers are operating at night, and Tehran has declared the Strait closed to "hostile" shipping. A fifth of the world\'s oil is now blocked.',
      hormuz: 'CLOSED', dOil: 35,
    }),
    allyStrike: (israelInPlay) => {
      // once Israel is in the war, Tehran's salvos go there by preference
      const pool = israelInPlay
        ? ['Israeli port infrastructure at Haifa', 'Israeli port infrastructure at Haifa', 'Saudi oil facilities at Abqaiq']
        : ['Saudi oil facilities at Abqaiq', 'Israeli port infrastructure at Haifa', 'Emirati facilities near Abu Dhabi'];
      const tgt = pick(pool);
      return {
        title: `Iranian missiles strike ${tgt.split(' at ')[0]}`,
        text: `A missile and drone salvo hit ${tgt}. Allied capitals are demanding either decisive US action or immediate de-escalation.`,
        dOil: 14, dWorld: -3, dApproval: -2,
      };
    },
    massBarrage: (str) => {
      const c = Math.round(rand(12, 30) * Math.max(0.4, str / 2));
      return {
        title: 'MASS MISSILE BARRAGE ACROSS THE THEATER',
        text: `Iran launched its largest salvo of the crisis at US bases and fleet units across the region. Defenses were saturated. ${c} Americans are dead. CENTCOM assesses this as the opening of a general war.`,
        casualties: c, dApproval: -6, dOil: 20, flashAsset: 'udeid',
        attack: { kind: 'mixed', bases: ['udeid', 'asad', 'dhafra'], count: 4 },
      };
    },
    // A two-front exchange. Iran throws a barrage at Israel and takes the
    // counter-strike: this is the one Iranian action that can cost Iran
    // capacity, because Israel is shooting back at launchers the US never
    // reached. Cuts both ways — and only a functioning Iran can sustain it.
    israelExchange: () => {
      const live = TARGETS.filter(t => t.type === 'missile' && t.status !== 'destroyed');
      const hitBack = live.length > 0 && chance(0.4) ? pick(live) : null;
      const ev = {
        title: 'MISSILE EXCHANGE BETWEEN IRAN AND ISRAEL',
        text: 'Iran fired a large ballistic and drone salvo at Israeli cities and airbases overnight; Arrow and David\'s Sling intercepted most of it. The IAF answered before dawn against launch sites in western Iran.',
        dOil: 10, dWorld: -4, dApproval: -1,
      };
      if (hitBack) {
        ev.degradeTarget = hitBack.id;
        ev.text += ` Israeli aircraft caught ${hitBack.name} in the open — the counter-strike did work CENTCOM had not scheduled.`;
      } else {
        ev.text += ' The counter-strike hit dispersal sites already abandoned. Both sides are now spending missiles to no decisive effect, and the war has a second front.';
      }
      return ev;
    },
    quiet: () => ({
      title: 'Tehran pauses',
      text: 'Intelligence reports internal debate in Tehran. No significant Iranian military action in the last 12 hours.',
    }),
    hostageParade: () => ({
      title: 'Captured US operators shown on Iranian state TV',
      text: 'Tehran airs new footage of the captured special operators — coerced statements, flags, cameras. The families are watching. Congress is demanding to know the plan to bring them home.',
      dApproval: -2,
    }),
    backchannelFeeler: () => ({
      title: 'Quiet feeler through Oman',
      text: 'Muscat passes word that the pragmatists in Tehran are counting what remains of the missile force — and quietly asking what an end to the war would cost.',
    }),
  };

  // Decide Iran's response this turn. There is no abstract escalation ladder:
  // what Iran does is a function of what it has left (capacity), how far the
  // war machine has spun up (spool), and whether anyone is coordinating it.
  function respond(G) {
    const events = [];
    const mStr = missileStrength();
    const nStr = navalStrength();
    const cap = mStr + nStr; // 0..4
    const struckOil = G.struckThisTurn.some(id => ['kharg', 'abadan'].includes(id));
    const struckNuclear = G.struckThisTurn.some(id => ['natanz', 'fordow'].includes(id));
    const struckAny = G.struckThisTurn.length > 0;

    // coordination: killing command degrades the response machine
    const irgc = TARGETS.find(t => t.id === 'irgc-hq');
    let coord = irgc.status === 'destroyed' ? 0.6 : irgc.status === 'damaged' ? 0.8 : 1;
    if (G.regimeChaosTurns > 0) coord *= 0.55;                      // decapitated: paralysis
    else if (G.regimeErratic) coord = Math.min(1.15, coord + 0.25); // erratic remnant: lashing out
    // the war machine spins up over the first days, faster when provoked
    const spool = Math.min(1, 0.5 + 0.25 * (G.turn - 1) + (struckAny ? 0.25 : 0));
    // Israel in the war is a mobilizing argument in Tehran: whatever the
    // regime has left, more of it gets thrown, and some of it goes west
    const israelInPlay = G.israelPosture !== 'sidelined';
    const w = Math.min(1.3, coord * spool * (israelInPlay ? 1.2 : 1));

    // Revenge logic: hitting oil draws shipping/economic retaliation
    if (struckOil && nStr > 0) events.push(chance(0.6) ? EV.shipping() : EV.mineScare());

    if (cap <= 1) {
      // capacity overrides intent: a broken Iran cannot sustain the war
      events.push(chance(0.6) ? EV.quiet() : EV.propaganda());
      if (chance(0.25)) events.push(EV.proxyRockets());
    } else {
      // the missile arm throws what it has — while it exists, it is lethal
      if (mStr > 0 && chance(0.95 * w)) {
        events.push(mStr >= 1.5 && chance(0.6 * w) ? EV.massBarrage(mStr) : EV.missileBase(mStr));
      } else {
        events.push(pick([EV.proxyAttack, EV.proxyRockets, EV.cyber, EV.harass])());
      }
      if (chance(0.35 * w)) events.push(EV.proxyAttack());
      // hitting the nuclear program draws a dedicated reprisal salvo
      if (struckNuclear && mStr > 0 && chance(0.5)) events.push(EV.missileBase(mStr));
      // the naval arm contests the strait
      if (nStr > 0) {
        if (G.hormuz === 'OPEN' && nStr >= 1.5 && chance(0.2 * w)) events.push(EV.hormuzClose());
        else if (G.hormuz === 'OPEN' && chance(0.3 * w)) events.push(EV.mineScare());
        else if (G.hormuz === 'CONTESTED' && chance(0.35 * w)) events.push(EV.hormuzClose());
      }
      if (chance((israelInPlay ? 0.5 : 0.3) * w)) events.push(EV.allyStrike(israelInPlay));
      // a sustained two-front fight needs a missile force that still exists
      if (israelInPlay && mStr > 0 && chance(0.4 * w)) events.push(EV.israelExchange());
    }

    // Tehran only sues for peace when its ability to fight is actually shattered
    if (cap <= 1 && G.nukeDegraded() >= 75 && chance(0.35)) {
      events.push(EV.backchannelFeeler());
    }

    // Captured raid personnel are a recurring propaganda drumbeat — a standing
    // political cost, not a death spiral: often enough to stay a running sore,
    // rare enough that it cannot bleed a presidency out on its own.
    if (G.hostageCrisis && chance(0.22)) events.push(EV.hostageParade());

    // Hormuz reopens the war-sim way: break Iran's navy and the Fifth Fleet
    // clears the strait by force. While the navy fights, it mostly stays shut.
    if (G.hormuz !== 'OPEN' && chance(nStr < 1 ? 0.65 : 0.12)) {
      events.push({
        title: 'Strait of Hormuz reopened by force',
        text: nStr < 1
          ? 'With Iranian naval bases in ruins, minesweepers and escorts cleared the channel. Convoys are moving under Fifth Fleet guns.'
          : 'With minesweepers working and Iranian naval activity reduced, convoys are moving again under escort.',
        hormuz: 'OPEN', dOil: -18,
      });
    }

    return events;
  }

  // ---- Advisors ----
  function advise(G) {
    const nukeDeg = G.nukeDegraded();
    const adLeft = TARGETS.filter(t => t.type === 'airdefense' && t.status !== 'destroyed').length;

    const secdef = { name: 'SecDef Whitfield', cls: 'hawk', text: '' };
    const secstate = { name: 'SecState Okafor', cls: 'dove', text: '' };
    const nsa = { name: 'NSA Reyes', cls: '', text: '' };
    const cjcs = { name: 'Gen. Halvorsen, CJCS', cls: 'mil', text: '' };

    const warStr = missileStrength() + navalStrength();

    if (nukeDeg >= 100 && warStr <= 1.5) {
      secdef.text = 'They\'re beaten and they know it. Finish the missile force, the navy, and the IRGC command node — end this on our terms, not theirs.';
    } else if (nukeDeg >= 100) {
      secdef.text = 'The nuclear program is finished — half the job. Now break the sword: missile brigades, the swarm-boat navy, IRGC command. Victory is destroying their ability to fight, not their will to.';
    } else if (G.turn >= 4) {
      secdef.text = 'This is a war now, Mr. President — fight it like one. Sustain the sortie rate, service the full target list, and don\'t give them a night to reconstitute.';
    } else {
      secdef.text = 'The mission is victory: kill the program and break their war machine. Roll back the air defenses first, then take the enrichment sites while the skies are ours.';
    }

    // Israel outranks the usual talking points: it changes what State can do
    const israelUrgent = G.israelPosture === 'sidelined' && !G.israelStrikesUsed &&
      G.israelPatience <= 2 && nukeDeg < 50;

    if (G.israelPosture === 'unilateral') {
      secstate.text = 'The Israelis went without us and the world has decided we blessed it. I am losing basing rights and coalition partners by the hour. Nothing I say in New York lands until this war has an end state — get me one.';
    } else if (G.israelPosture === 'coordinated') {
      secstate.text = 'We own Israel\'s war now as well as our own. That joint package is real capability and I would rather we spend it than watch it expire — but understand that every hour it sits unused, Tehran is still shooting at Haifa on our account.';
    } else if (israelUrgent) {
      secstate.text = `Jerusalem has stopped asking. My read is ${G.israelPatience} turn${G.israelPatience === 1 ? '' : 's'} before they fly it themselves — and a unilateral Israeli strike is the worst version of this: the escalation without the results. Bring them in on our terms or finish the program before they lose patience.`;
    } else if (G.negotiationReady()) {
      secstate.text = 'Tehran is broken — this is the rare moment a backchannel might actually close. If you want the win signed instead of just shattered, authorize the Omani channel now.';
    } else if (nukeDeg >= 75 && warStr <= 2) {
      secstate.text = 'They\'re not ready to fold yet — an overture now would be read as weakness and spun against us. Keep destroying what they fight with; I\'ll be ready when they break.';
    } else {
      secstate.text = 'No one in Tehran will talk while they can still shoot. My job right now is holding the coalition together while you win — pair the strikes with UN pressure and sanctions.';
    }

    if (israelUrgent) {
      nsa.text = `Israeli readiness indicators are unambiguous — tanker movements, reserve call-ups, the whole signature. They are going, with or without you, in roughly ${G.israelPatience} turn${G.israelPatience === 1 ? '' : 's'}. If it happens on their timetable you get the blame and none of the targeting.`;
    } else if (G.israelPosture === 'unilateral') {
      nsa.text = 'Israel struck on its own and Fordow is still under the mountain. We inherited the escalation without the result — expect Iranian salvos to go west as well as at us, and expect the Gulf states to start putting distance between themselves and our aircraft.';
    } else if (G.israelPosture === 'coordinated' && missileStrength() > 0) {
      nsa.text = 'With the Israelis in openly, Tehran is fighting two enemies with one missile force. That splits their fires — some of those launchers are now dying to the IAF instead of to us. It also means this war ends when both of our wars end, not just ours.';
    } else if (G.hormuz === 'CLOSED') {
      nsa.text = 'The Strait is the whole ballgame right now. Every turn it stays closed bleeds the economy — hit their naval bases or cool this down fast.';
    } else if (G.hostageCrisis) {
      nsa.text = 'Our people are in an IRGC prison and on their televisions. Every deal now runs through that cell block — no agreement survives politically unless it brings them home.';
    } else if (G.regimeChaosTurns > 0) {
      nsa.text = 'Tehran\'s command chain is decapitated and their retaliation is uncoordinated. This window closes fast — whoever consolidates power will need to look strong. Use it or lose it.';
    } else if (G.approval < 35) {
      nsa.text = 'Your political capital is nearly spent. Congress smells blood. We need visible wins or visible peace — drift is fatal.';
    } else if (G.casualties.us >= 100) {
      nsa.text = `${G.casualties.us} dead and the country is counting. The home front will not fund this war past 150 — win it before the arithmetic wins it for them.`;
    } else if (warStr >= 3) {
      nsa.text = 'Their war machine is still near full strength and they will throw everything they have. What matters is the exchange rate: their launchers and hulls have to die faster than our people do.';
    } else {
      nsa.text = 'The clock and the casualty count are the real enemies. Every turn their war machine survives is a turn it spends killing Americans — tempo is mercy.';
    }

    if (adLeft >= 2) {
      cjcs.text = `Their air defense network is largely intact — ${adLeft} SAM complexes active. Non-stealth strikes carry real attrition risk. Recommend SEAD first, or lean on the B-2s.`;
    } else if (nukeDeg < 100) {
      cjcs.text = 'Skies are relatively permissive now. Fordow requires a B-2 with penetrators — nothing else touches it. Natanz we can service with either bombers or a heavy Tomahawk package.';
    } else {
      cjcs.text = 'Nuclear target set serviced. For decisive victory the remaining list is their missile brigades, both naval bases, and the IRGC command complex — kill those and Iran is out of the war.';
    }

    return [secdef, secstate, nsa, cjcs];
  }

  // ---- Headlines for the ticker ----
  function headlines(G, events) {
    const h = [];
    for (const ev of events) h.push(ev.title.toUpperCase());
    if (G.oil > 150) h.push(`OIL SHOCK: BRENT AT $${Math.round(G.oil)} — RECESSION FEARS MOUNT`);
    else if (G.oil > 110) h.push(`BRENT CRUDE TOPS $${Math.round(G.oil)} AS CRISIS PREMIUM GROWS`);
    if (G.approval < 35) h.push('POLL: PRESIDENT\'S CONDUCT OF THE WAR UNDERWATER, IMPEACHMENT TALK GROWS');
    else if (G.approval > 60) h.push('RALLY EFFECT: PUBLIC BACKS PRESIDENT\'S CONDUCT OF THE WAR');
    if (missileStrength() + navalStrength() <= 1) h.push('ANALYSTS: IRAN\'S MILITARY SHATTERED — HOW MUCH LONGER CAN TEHRAN FIGHT?');
    if (G.casualties.us >= 100) h.push('CASUALTY COUNT MOUNTS — CONGRESS DEBATES LIMITS ON THE WAR');
    if (G.hormuz === 'CLOSED') h.push('GAS LINES FORM AS HORMUZ CLOSURE CHOKES GLOBAL SUPPLY');
    if (G.regimeChaosTurns > 0) h.push('POWER VACUUM IN TEHRAN — INTELLIGENCE AGENCIES ASK: WHO IS IN CHARGE?');
    if (G.hostageCrisis) h.push('VIGILS HELD FOR CAPTURED US SPECIAL OPERATORS');
    if (G.israelPosture === 'unilateral') h.push('ARAB CAPITALS DEMAND ANSWERS: DID WASHINGTON GREEN-LIGHT THE ISRAELI STRIKE?');
    else if (G.israelPosture === 'coordinated') h.push('IAF SQUADRONS FLYING WITH CENTCOM AS ISRAEL JOINS THE CAMPAIGN OPENLY');
    const fillers = [...FILLER_HEADLINES].sort(() => Math.random() - 0.5).slice(0, 3);
    return [...h, ...fillers];
  }

  return { respond, advise, headlines, missileStrength, navalStrength };
})();
