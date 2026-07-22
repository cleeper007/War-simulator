// ============================================================
// ai.js — Iranian AI opponent, advisor recommendations, headlines
// ============================================================

const IranAI = (() => {
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const chance = (p) => Math.random() < p;

  // How much of Iran's missile force still functions (scales retaliation).
  // Read off each base's condition track, so a brigade worn down to 30% throws
  // 30% of the salvo — the weight of what comes back at you falls in step with
  // the damage you do, rather than in two big steps.
  //
  // Dispersed launchers count exactly as much as the bases they drove out of,
  // whether or not anyone has found them. That is the point of the hunt: the
  // salvos do not get lighter because you destroyed the sheds, and a player who
  // stops at the fixed sites is fighting a missile force that is still there.
  function missileStrength() {
    let s = 0;
    for (const t of TARGETS) {
      if (t.type !== 'missile' && t.type !== 'tel') continue;
      s += t.hp / 100;
    }
    return Math.min(2, s); // 0..2
  }

  // The launcher groups actually in play — dispersed and not yet destroyed.
  // Undetected ones are in here too; they are shooting either way.
  const liveTels = () => TARGETS.filter(t => t.type === 'tel' && t.dispersed && t.hp > 0);

  // the war plan Tehran is actually running (see IRAN_POSTURES)
  const posture = () => IRAN_POSTURES[Game.G.iranPosture] || IRAN_POSTURES.attrition;

  // Iran's navy: the bases and the hulls that sail from them. Everything
  // downstream — carrier risk, the Hormuz reopening, the capacity meter, the
  // negotiation gate — is written against a 0..2 scale, so this reports the
  // surviving FRACTION of the fleet on that scale rather than a raw count.
  // Hulls can then be added or removed without re-tuning the whole sim.
  function navalStrength() {
    const fleet = TARGETS.filter(t => t.type === 'naval' || t.type === 'ship');
    if (!fleet.length) return 0;
    let s = 0;
    for (const t of fleet) s += t.hp / 100;
    return (s / fleet.length) * 2; // 0..2
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
      title: 'Captured Americans shown on Iranian state TV',
      text: 'Tehran airs new footage of the prisoners — coerced statements, flags, cameras. The families are watching. Congress is demanding to know the plan to bring them home.',
      dApproval: -2,
    }),
    backchannelFeeler: () => ({
      title: 'Quiet feeler through Oman',
      text: 'Muscat passes word that the pragmatists in Tehran are counting what remains of the missile force — and quietly asking what an end to the war would cost.',
    }),
  };

  // ============================================================
  // ADAPTATION
  // ------------------------------------------------------------
  // Every strike package flown is logged by platform. Past a threshold Iran
  // starts working the specific counter — hardened dispersal and decoy fields
  // against cruise missiles, massed mobile SAMs and fighter dispersal against
  // manned packages — and the base success rate of that platform drops. The
  // counter to the counter is variety, which is the whole point: a player who
  // finds one efficient package and flies it thirty times should meet an enemy
  // who noticed.
  const ADAPT_EVERY = 6;    // packages of one platform before the counter deepens
  const ADAPT_MAX = 3;      // and it stops deepening here — never impossible
  const ADAPT_PER_LEVEL = 0.05;

  const adaptLevel = (asset) => Math.min(ADAPT_MAX,
    Math.floor((Game.G.adapt[asset] || 0) / ADAPT_EVERY));

  // what computeStrike subtracts from a package's base odds
  const adaptPenalty = (asset) => adaptLevel(asset) * ADAPT_PER_LEVEL;

  const ADAPT_TEXT = {
    cruise: ['Overhead imagery shows the pattern CENTCOM has been flying being answered: inflatable decoys ' +
      'and corner reflectors going up around every site still standing, aimpoints shuffled inside the ' +
      'perimeters, and the high-value equipment moved out from under the roofs the targeting folders were ' +
      'built on. Tomahawk effectiveness is assessed down against everything on the list.',
      'Cruise-missile corridors are being seeded with barrage balloons and cabling, and the sites are ' +
      'running their generators from dispersed positions well off the surveyed coordinates. The salvos ' +
      'are still arriving. They are arriving on emptier ground.'],
    fighter: ['Iranian air defense has stopped defending places and started hunting packages: the ' +
      'surviving batteries are shooting and moving, the engagement radars come up late, and the fighter ' +
      'regiments have dispersed to highway strips. Manned strike packages are assessed to face a harder ' +
      'problem on every profile.',
      'The SAM belt is being run as an ambush rather than a barrier — emissions discipline, mobile ' +
      'launchers, and acquisition handed off from passive sensors. Our packages are flying into a threat ' +
      'that no longer sits where the last mission found it.'],
    stealth: ['Tehran has bought low-frequency early-warning radars into the approach corridors. They ' +
      'cannot generate a firing solution on a B-2 and they know it — what they can do is know a mission ' +
      'is coming and get the crews underground before it arrives.'],
  };

  // Returns an event on the turn a platform's counter deepens, else null.
  function adaptStep(G) {
    for (const asset of ['cruise', 'fighter', 'stealth']) {
      const lvl = adaptLevel(asset);
      if (lvl <= (G.adaptSeen[asset] || 0)) continue;
      G.adaptSeen[asset] = lvl;
      const pool = ADAPT_TEXT[asset];
      const label = { cruise: 'CRUISE MISSILE', fighter: 'MANNED STRIKE', stealth: 'PENETRATOR' }[asset];
      return {
        cls: 'iran', title: `IRAN ADAPTS — ${label} EFFECTIVENESS DEGRADED`,
        text: pool[Math.min(lvl - 1, pool.length - 1)] +
          ` Assessed penalty to ${asset === 'fighter' ? 'manned strike' : asset} packages is now ` +
          `−${Math.round(lvl * ADAPT_PER_LEVEL * 100)}%. Mixing the force is what keeps this shallow.`,
      };
    }
    return null;
  }

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
    let coord = (0.6 + 0.4 * (irgc.hp / 100)) * (DIFFICULTY[G.difficulty] || DIFFICULTY.general).coord;
    if (G.regimeChaosTurns > 0) coord *= 0.55;                      // decapitated: paralysis
    else if (G.regimeErratic) coord = Math.min(1.15, coord + 0.25); // erratic remnant: lashing out
    // the war machine spins up over the first days, faster when provoked
    const spool = Math.min(1, 0.5 + 0.25 * (G.turn - 1) + (struckAny ? 0.25 : 0));
    // Israel in the war is a mobilizing argument in Tehran: whatever the
    // regime has left, more of it gets thrown, and some of it goes west
    const israelInPlay = G.israelPosture !== 'sidelined';
    const w = Math.min(1.3, coord * spool * (israelInPlay ? 1.2 : 1));
    // Tehran's war plan, which the player cannot see until they buy it: the
    // same event pool, weighted toward the arm this regime has decided matters
    const P = posture();

    // Revenge logic: hitting oil draws shipping/economic retaliation
    if (struckOil && nStr > 0) events.push(chance(0.6) ? EV.shipping() : EV.mineScare());

    if (cap <= 1) {
      // capacity overrides intent: a broken Iran cannot sustain the war
      events.push(chance(0.6) ? EV.quiet() : EV.propaganda());
      if (chance(0.25)) events.push(EV.proxyRockets());
    } else {
      // the missile arm throws what it has — while it exists, it is lethal
      if (mStr > 0 && chance(0.95 * w * P.missile)) {
        events.push(mStr >= 1.5 && chance(0.6 * w * P.missile) ? EV.massBarrage(mStr) : EV.missileBase(mStr));
      } else {
        events.push(pick([EV.proxyAttack, EV.proxyRockets, EV.cyber, EV.harass])());
      }
      if (chance(0.35 * w * P.proxy)) events.push(EV.proxyAttack());
      // hitting the nuclear program draws a dedicated reprisal salvo
      if (struckNuclear && mStr > 0 && chance(0.5)) events.push(EV.missileBase(mStr));
      // the naval arm contests the strait
      if (nStr > 0) {
        if (G.hormuz === 'OPEN' && nStr >= 1.5 && chance(0.2 * w * P.hormuz)) events.push(EV.hormuzClose());
        else if (G.hormuz === 'OPEN' && chance(0.3 * w * P.naval)) events.push(EV.mineScare());
        else if (G.hormuz === 'CONTESTED' && chance(0.35 * w * P.hormuz)) events.push(EV.hormuzClose());
      }
      if (chance((israelInPlay ? 0.5 : 0.3) * w * P.ally)) events.push(EV.allyStrike(israelInPlay));
      // a sustained two-front fight needs a missile force that still exists
      if (israelInPlay && mStr > 0 && chance(0.4 * w)) events.push(EV.israelExchange());
    }

    // ---- adaptation ----
    // An enemy that is hit the same way every night stops standing still for
    // it. Lean on one platform and Iran works the counter to that platform:
    // dispersal and decoys against the Tomahawk, massed and mobile SAMs against
    // the strike packages. It never becomes impossible, it becomes expensive —
    // and mixing the force keeps both counters shallow.
    const step = adaptStep(G);
    if (step) events.push(step);

    // Tehran only sues for peace when its ability to fight is actually shattered
    if (cap <= 1 && G.nukeDegraded() >= 75 && chance(0.35)) {
      events.push(EV.backchannelFeeler());
    }

    // A dispersal that has been located and then left alone does not wait to be
    // serviced. Finding them is not killing them.
    for (const t of liveTels()) {
      if (!t.located || G.struckThisTurn.includes(t.id)) continue;
      if (!chance(TEL_RELOCATE)) continue;
      t.located = false;
      MapView.updateTarget(t);
      events.push({
        cls: 'iran', title: `${t.short} HAS MOVED — TRACK LOST`,
        text: `The launcher group in the ${t.name.split(' — ')[1] || 'interior'} broke hide overnight and ` +
          'is no longer where the targeting folder says it is. Nothing was struck there, so nothing held ' +
          'them. The fix is stale and the group is off the plot until ISR finds it again.',
      });
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
    // sites hit but not finished, worst first — the ones the repair crews own.
    // Sorted on the ASSESSED figure, because that is all anyone in this room
    // actually has; the true number is not available to the people talking.
    const reconstituting = TARGETS
      .filter(t => Game.wearsDown(t) && t.hp > 0 && t.hp < 100)
      .map(t => ({ t, e: Game.estimate(t) }))
      .sort((a, b) => a.e.mid - b.e.mid)
      .map(x => x.t);
    // how stale the picture has got — the argument for spending a slot on ISR
    const blind = TARGETS
      .filter(t => (Game.wearsDown(t) || t.type === 'tel') && t.hp > 0)
      .map(t => Game.estimate(t))
      .filter(e => !e.known && e.hi - e.lo >= 30).length;
    const hiddenTels = liveTels().filter(t => !t.located).length;
    const foundTels = liveTels().filter(t => t.located).length;
    const brk = Game.breakoutEstimate();

    const secdef = { name: 'SecDef Whitfield', cls: 'hawk', text: '' };
    const secstate = { name: 'SecState Okafor', cls: 'dove', text: '' };
    const nsa = { name: 'NSA Reyes', cls: '', text: '' };
    const cjcs = { name: 'Gen. Halvorsen, CJCS', cls: 'mil', text: '' };

    const warStr = missileStrength() + navalStrength();

    // Launchers loose in the country outrank everything else SecDef has to say:
    // it is the one situation where the battle damage assessment is actively
    // lying to the player about how the war is going.
    if (foundTels > 0) {
      secdef.text = `We have a fix on ${foundTels === 1 ? 'a launcher group' : `${foundTels} launcher groups`} ` +
        'and fixes on those do not keep. They shoot and move — service them tonight or spend another ' +
        'week of ISR earning the same fix twice. This is the part of the missile force that is still ' +
        'killing Americans, and it is the part that is not on any of the imagery you have been shown.';
    } else if (hiddenTels > 0) {
      secdef.text = `Understand what the battle damage assessment is not telling you: the bases are rubble ` +
        `and the brigade is not dead. ${hiddenTels === 1 ? 'A launcher group is' : `${hiddenTels} launcher groups are`} ` +
        'out in the country, they are still shooting, and the capacity meter is counting them whether ' +
        'we can see them or not. Put the collection assets on the hunt or accept the salvos indefinitely.';
    // early on, the force-flow decision outranks everything else SecDef has to say
    } else if (!G.bombersOrdered && !G.secondCarrierOrdered && G.turn <= 3 && nukeDeg < 100) {
      secdef.text = 'Two things are outside this theater and Fifth Fleet cuts one transit plan a night to move them: the Ford, five turns out and worth double what one deck gives you, and the 509th, one turn out and the only thing that opens Fordow. One goes tonight, the other tomorrow. My advice is to decide which rather than discover in a week that you needed the one you left at home.';
    } else if (nukeDeg >= 100 && warStr <= 1.5) {
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

    // Americans on the ground outrank everything else on this table
    if (G.downed) {
      nsa.text = `We have ${G.downed.crew === 2 ? 'two aircrew' : 'an aviator'} alive on Iranian soil — ` +
        `${G.downed.callsign}, ${G.downed.loc} — and a search cordon closing on them. This is the ` +
        `decision that will define the news cycle either way, and it does not keep. Recovered, it is the ` +
        `best night of this war. Captured, it is a flight suit on their television for as long as they ` +
        `want it there, and every deal you ever sign runs through that cell.`;
    // The clock the entire war is against. It outranks everything except
    // Americans on the ground.
    } else if (!brk.halted && brk.hi <= 6) {
      nsa.text = `This is the number that matters tonight: the Agency puts Iran ${brk.lo}–${brk.hi} turns ` +
        `from a device, ${brk.conf} confidence. ${brk.conf === 'low'
          ? 'That band is wide enough that the low end may already have passed. I would spend a slot ' +
            'narrowing it before I spent another one on anything else.'
          : 'That is inside the time it takes to do anything else on this list.'} ` +
        'Everything that is not enrichment is a distraction from here.';
    } else if (!G.warPowers.done && G.turn >= Game.WAR_POWERS_TURN - 3) {
      const t = Game.WAR_POWERS_TURN - G.turn;
      nsa.text = `The authorization lapses in ${t <= 0 ? 'a matter of hours' : `${t} turn${t === 1 ? '' : 's'}`} ` +
        'and the Hill will vote on whether this campaign continues. They will be voting on your approval ' +
        `number, the casualty list, whether we still have allies, and whether you ever went on television ` +
        `to explain it — you have addressed the nation ${G.addresses} time${G.addresses === 1 ? '' : 's'}. ` +
        'A no vote ends the war where it stands. There is still time to change the arithmetic.';
    } else if (israelUrgent) {
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
    } else if (G.casualties.us >= 170) {
      nsa.text = `${G.casualties.us} dead and the country is counting. The home front will not fund this war past ${Game.casualtyLimit()} — win it before the arithmetic wins it for them.`;
    } else if (warStr >= 3) {
      nsa.text = 'Their war machine is still near full strength and they will throw everything they have. What matters is the exchange rate: their launchers and hulls have to die faster than our people do.';
    } else {
      nsa.text = 'The clock and the casualty count are the real enemies. Every turn their war machine survives is a turn it spends killing Americans — tempo is mercy.';
    }

    if (!G.basing.gulf) {
      cjcs.text = 'We have lost the Gulf ramps and with them the northern tanker tracks. Al Udeid and Al ' +
        'Dhafra are parking lots for aircraft that are not allowed to fly, the nightly tanker plan is down ' +
        `to ${Game.tankerCapacity()} tracks, and anything past the interior — Tabriz, the Caspian — is ` +
        'simply not reachable. This is not a targeting problem, Mr. President, it is a diplomatic one. ' +
        'Get the number up and I get the runways back.';
    } else if (!G.basing.nato) {
      cjcs.text = `Incirlik is closed to us and Riyadh has asked that Prince Sultan not be used offensively. ` +
        `That is two squadrons and two tanker tracks off tonight's plan — we are down to ${Game.tankerCapacity()} ` +
        'tracks a night, and the tanker plan is what caps the deep targets. It gets worse below fifteen.';
    } else if (blind >= 3) {
      cjcs.text = `We are flying on a stale picture. ${blind} sites on the list have assessments wide ` +
        'enough to be useless — anywhere from "nearly finished" to "back at full" — and every package ' +
        'planned against a number that soft is a package we may be wasting on rubble or throwing at a ' +
        'target that needs three more. Buy a collection deck. Knowing costs a night; not knowing costs ' +
        'the ordnance.';
    } else if (!G.bombersArrived && nukeDeg < 100) {
      cjcs.text = G.bombersOrdered
        ? `The 509th is airborne out of Whiteman with the tanker train strung out behind it — ${G.bomberEta} turn(s) to Diego Garcia. Until those aircraft are on that ramp, Fordow is a target we can photograph and not one we can service.`
        : 'Be clear on what you do not have: there is not a B-2 within eight thousand miles of this war. They are parked at Whiteman. One turn on the tankers puts them at Diego Garcia and puts the GBU-57 in play, and nothing else in the inventory touches Fordow — not a Tomahawk, not a fighter, nothing. The bill is one night of the naval transit: the turn they move, nothing else does.';
    } else if (adLeft >= 2) {
      cjcs.text = `Their air defense network is largely intact — ${adLeft} SAM complexes active. Non-stealth strikes carry real attrition risk. Recommend SEAD first${G.bombersArrived ? ', or lean on the B-2s' : ''}.`;
    } else if (reconstituting.length >= 2) {
      cjcs.text = `We are renting damage instead of buying it, Mr. President. ${reconstituting.length} sites we have already ` +
        `hit are working through the night — ${reconstituting.slice(0, 3).map(t => `${t.short} at ${Game.condition(t)}`).join(', ')} — ` +
        `and every one of them climbs back toward full while we service something else. Concentrate the ` +
        `packages: two on target in the same turn finishes a site, one a turn just keeps it wounded.`;
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
    if (G.casualties.us >= 170) h.push('CASUALTY COUNT MOUNTS — CONGRESS DEBATES LIMITS ON THE WAR');
    if (G.hormuz === 'CLOSED') h.push('GAS LINES FORM AS HORMUZ CLOSURE CHOKES GLOBAL SUPPLY');
    if (G.regimeChaosTurns > 0) h.push('POWER VACUUM IN TEHRAN — INTELLIGENCE AGENCIES ASK: WHO IS IN CHARGE?');
    if (G.downed) h.push(`SEARCH UNDER WAY FOR US AIRCREW DOWN INSIDE IRAN — PENTAGON WILL NOT DISCUSS RECOVERY OPERATIONS`);
    if (G.hostageCrisis) h.push('VIGILS HELD FOR AMERICANS IN IRANIAN CUSTODY');
    if (G.israelPosture === 'unilateral') h.push('ARAB CAPITALS DEMAND ANSWERS: DID WASHINGTON GREEN-LIGHT THE ISRAELI STRIKE?');
    else if (G.israelPosture === 'coordinated') h.push('IAF SQUADRONS FLYING WITH CENTCOM AS ISRAEL JOINS THE CAMPAIGN OPENLY');
    if (!G.basing.gulf) h.push('GULF STATES CLOSE AIRSPACE TO US STRIKE OPERATIONS — "NOT FROM OUR SOIL"');
    else if (!G.basing.nato) h.push('ANKARA CLOSES INCIRLIK AS EUROPEAN ALLIES SUSPEND PARTICIPATION');
    if (!G.warPowers.done && G.turn >= Game.WAR_POWERS_TURN - 2) {
      h.push('WAR POWERS VOTE LOOMS: CONGRESS TO DECIDE WHETHER THE CAMPAIGN CONTINUES');
    } else if (G.warPowers.result === 'restricted') {
      h.push('CONGRESS BARS STRIKES ON IRANIAN ENERGY INFRASTRUCTURE IN NARROW AUTHORIZATION VOTE');
    }
    const brk = Game.breakoutEstimate();
    if (brk.halted) h.push('IAEA: IRANIAN ENRICHMENT CAPABILITY ASSESSED DESTROYED');
    else if (brk.hi <= 6) h.push('INTELLIGENCE LEAK: "WEEKS, NOT MONTHS" — ANALYSTS WARN BREAKOUT IS CLOSE');
    if (liveTels().some(t => !t.located)) {
      h.push('PENTAGON CONCEDES IRANIAN MOBILE LAUNCHERS REMAIN "UNLOCATED AND ACTIVE"');
    }
    const fillers = [...FILLER_HEADLINES].sort(() => Math.random() - 0.5).slice(0, 3);
    return [...h, ...fillers];
  }

  return { respond, advise, headlines, missileStrength, navalStrength,
    adaptPenalty, adaptLevel, liveTels, posture };
})();
