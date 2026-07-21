// ============================================================
// game.js — core state, turn loop, strikes, diplomacy, win/lose
// ============================================================

const Game = (() => {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  // ---- game state ----
  const G = {
    turn: 1, maxTurns: 20,
    approval: 58,          // %
    oil: 84,               // $/bbl Brent
    world: 60,             // world opinion 0–100
    hormuz: 'OPEN', hormuzClosedTurns: 0,
    casualties: { us: 7 }, // the destroyer attack that starts the crisis
    // Fighter and TLAM capacity is DERIVED from where the carriers are (see
    // fleetCapacity) — these are the opening values with the Lincoln alone,
    // forward. The SOF task force is not carrier-based, and the B-2s are not
    // in theater at all: they sit at Whiteman until they are sent for.
    res: { fighters: 3, cruise: 6, stealth: 0, specops: 1 },
    caps: { fighters: 4, cruise: 8, stealth: 0, specops: 1 },
    // The fleet. One deck to start; the second has to be sent for. Only mutable
    // state lives here — names come from CARRIER_INFO by id, so a restored save
    // can never carry a stale ship name back into the war.
    carriers: [
      { id: 'csg-lincoln', arrived: true, posture: 'forward', moving: null, damaged: false, lost: false },
      { id: 'csg-ford', arrived: false, posture: 'back', moving: null, damaged: false, lost: false },
    ],
    secondCarrierOrdered: false, secondCarrierEta: 0,
    // the 509th Bomb Wing: at Whiteman AFB, Missouri, until called forward
    bombersOrdered: false, bomberEta: 0, bombersArrived: false,
    alliedFighters: 0,     // coalition and IAF squadrons folded into the fighter cap
    strikesThisTurn: 0, struckThisTurn: [],
    missions: [],          // strike packages in flight: {targetId, pkg, eta}
    sanctions: 0, coalition: false, addressCooldown: 0,
    negotiationsAccepted: false, negotiationMomentum: 0,
    diploUsed: false, over: false,
    // Israel: a semi-autonomous actor, not an American asset. Sidelined by
    // default; coordinate with them and the war widens, ignore them and they
    // eventually go alone on a timetable you do not control.
    israelPosture: 'sidelined', israelPatience: 4,
    israelStrikesUsed: false, israelJointAvailable: false,
    // special operations (see specops.js)
    raid: 'none', raidThisTurn: false, isrPrep: 0,
    regimeChaosTurns: 0, regimeErratic: false, hostageCrisis: false,
    stats: { strikes: 0, destroyed: 0, aircraftLost: 0, peakOil: 84, backchannels: 0, carriersLost: 0 },

    // Is the flagship out of the anti-ship envelope? Derived rather than stored:
    // with two independently-stationed decks there is no single fleet posture,
    // and a stored copy of this would be one more thing to keep in sync.
    get csgPulledBack() {
      const cv = this.carriers[0];
      return !cv.lost && !cv.moving && cv.posture === 'back';
    },
    nukeDegraded() {
      let d = 0;
      for (const id of ['natanz', 'fordow']) {
        const t = TARGETS.find(x => x.id === id);
        if (t.status === 'destroyed') d += 50;
        else if (t.status === 'damaged') d += 25;
      }
      return d; // 0–100
    },
    // Iran's remaining ability to fight, 0–100, for the HUD meter:
    // missile force + navy + IRGC command, the set you must break to win
    iranCapacity() {
      const irgc = TARGETS.find(t => t.id === 'irgc-hq');
      const irgcVal = irgc.status === 'destroyed' ? 0 : irgc.status === 'damaged' ? 0.5 : 1;
      return Math.round(100 * (IranAI.missileStrength() + IranAI.navalStrength() + irgcVal) / 5);
    },
    // warfighting capacity shattered: missile force and navy near zero, IRGC command gone
    iranBroken() {
      const irgc = TARGETS.find(t => t.id === 'irgc-hq');
      return IranAI.missileStrength() <= 0.5 && IranAI.navalStrength() <= 0.5 &&
        irgc.status === 'destroyed';
    },
    // The leadership target died — whether or not the task force came home.
    // 'pyrrhic' bought the same decapitation at the price of the whole team.
    raidDecapitated() { return this.raid === 'success' || this.raid === 'pyrrhic'; },
    negotiationReady() {
      // Tehran only talks when it is already losing the war: the program gone
      // AND its ability to fight visibly draining away. The raid does NOT
      // discount this gate — killing the leadership cannot substitute for
      // destroying the thing the war is about, or the raid becomes the game.
      // What it buys instead is a better chance at the table (see doDiplo).
      const warStr = IranAI.missileStrength() + IranAI.navalStrength(); // 0..4
      return this.nukeDegraded() >= 100 && warStr <= 1.5;
    },
  };

  // ---- save / continue (localStorage) ----
  const Save = (() => {
    // v4: the bomber force became state too. A v3 save has B-2s in theater from
    // turn one, which no longer corresponds to anything — retired, not migrated.
    const KEY = 'cic-save-v4';   // bump the version to invalidate old saves
    const FIELDS = [
      'turn', 'maxTurns', 'approval', 'oil', 'world',
      'hormuz', 'hormuzClosedTurns', 'casualties', 'res', 'caps',
      'strikesThisTurn', 'struckThisTurn', 'missions', 'sanctions', 'coalition',
      'addressCooldown', 'negotiationsAccepted', 'negotiationMomentum',
      'diploUsed', 'over', 'raid', 'raidThisTurn', 'isrPrep',
      'israelPosture', 'israelPatience', 'israelStrikesUsed', 'israelJointAvailable',
      'regimeChaosTurns', 'regimeErratic', 'hostageCrisis', 'stats',
      'carriers', 'secondCarrierOrdered', 'secondCarrierEta', 'alliedFighters',
      'bombersOrdered', 'bomberEta', 'bombersArrived',
    ];

    function write() {
      if (G.over) return;
      try {
        const data = { version: 4, muted: AudioSys.isMuted(), fields: {}, targets: {} };
        for (const f of FIELDS) data.fields[f] = G[f];
        for (const t of TARGETS) data.targets[t.id] = t.status || 'intact';
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch (e) { /* storage unavailable — play without saves */ }
    }

    function read() {
      try {
        const data = JSON.parse(localStorage.getItem(KEY));
        return data && data.version === 4 ? data : null;
      } catch (e) { return null; }
    }

    function clear() {
      try { localStorage.removeItem(KEY); } catch (e) {}
    }

    return { write, read, clear };
  })();

  // ---- strike math ----
  function airDefenseWeight() {
    let w = 0;
    for (const t of TARGETS) {
      if (t.type !== 'airdefense') continue;
      if (t.status === 'destroyed') continue;
      w += t.status === 'damaged' ? 0.5 : 1;
    }
    return w; // 0..3
  }

  // ============================================================
  // CARRIER STRIKE GROUPS
  // ------------------------------------------------------------
  // Every fighter sortie and every Tomahawk in this war comes off a deck, so
  // where the decks sit is the standing decision underneath all the others.
  // FORWARD is the Gulf of Oman: the full air wing, and a hull inside every
  // anti-ship missile, swarm boat and midget submarine Iran has left. BACK is
  // the deep Arabian Sea: untouchable, and half the strike power. The move
  // between them takes a turn, and that turn buys the worst of both — reduced
  // capability, still exposed.
  //
  // Nothing here mutates G.caps directly. Capacity is recomputed from the
  // fleet's disposition (see fleetCapacity), so a posture change can never
  // leak a permanent bonus and a restored save needs no migration.
  // ============================================================

  // per-deck contribution at FORWARD station. The Ford is the newer and larger
  // ship and generates the heavier sortie rate; halved at BACK, she is worth
  // exactly the +3 fighters / +4 TLAM her arrival is advertised as.
  const CARRIER_BASE = {
    'csg-lincoln': { fighters: 4, cruise: 8, repFighters: 2, repCruise: 2 },
    'csg-ford':    { fighters: 6, cruise: 8, repFighters: 2, repCruise: 2 },
  };
  const FORD_TRANSIT_TURNS = 5;

  // ============================================================
  // THE AIR BRIDGE
  // ------------------------------------------------------------
  // Neither the second deck nor the bomber force is in this theater when the
  // war opens, and TRANSCOM can only run one force flow at a time: the tanker
  // bridge that walks the B-2s across the Pacific is the same one carrying the
  // Ford's surge support east. So the two deployments queue behind each other,
  // and the order you put them in is the decision. The Ford is five turns away
  // and doubles what you can throw in a day; the bombers are one turn away and
  // are the only key that fits Fordow. You can have both — eventually — but
  // never at the same time, and the war does not wait for the second one.
  // ============================================================
  const B2_TRANSIT_TURNS = 1;
  const BOMBER_CAP = 2;     // sustainable missions off the Diego Garcia ramp
  const BOMBER_READY = 1;   // generated and ready the turn they land

  // is a force flow already on the bridge?
  function deploymentInbound() {
    return (G.secondCarrierOrdered && G.secondCarrierEta > 0) ||
      (G.bombersOrdered && !G.bombersArrived);
  }

  const carrierById = (id) => G.carriers.find(c => c.id === id);
  const cvName = (cv) => CARRIER_INFO[cv.id].name;    // "USS Abraham Lincoln"
  const cvShort = (cv) => CARRIER_INFO[cv.id].short;  // "LINCOLN"

  // how much of a deck's air wing is actually in the fight
  function carrierFactor(cv) {
    if (cv.lost || !cv.arrived) return 0;
    // repositioning flies at the same reduced rate as sitting back, because
    // that is what a carrier in transit is: off station either way
    let f = (cv.moving || cv.posture === 'back') ? 0.5 : 1;
    if (cv.damaged) f *= 0.5;   // fires out, catapults down, flying a fraction of her rate
    return f;
  }

  // exposure to Iranian anti-ship fires, 0..1 — the mirror of the capability above
  function carrierExposure(cv) {
    if (cv.lost || !cv.arrived) return 0;
    if (cv.moving) return 0.5;                    // clearing the area, or closing back in
    return cv.posture === 'forward' ? 1 : 0;
  }

  // fighter/TLAM caps and per-turn replenishment, derived from the whole fleet
  function fleetCapacity() {
    let fighters = 0, cruise = 0, repFighters = 0, repCruise = 0;
    for (const cv of G.carriers) {
      const f = carrierFactor(cv);
      if (!f) continue;
      const b = CARRIER_BASE[cv.id];
      fighters += b.fighters * f;
      cruise += b.cruise * f;
      repFighters += b.repFighters * f;
      repCruise += b.repCruise * f;
    }
    return {
      // allied squadrons fly from land and survive the loss of every deck
      fighters: Math.round(fighters) + G.alliedFighters,
      cruise: Math.round(cruise),
      repFighters: Math.round(repFighters),
      repCruise: Math.round(repCruise),
    };
  }

  // push the derived caps into G and clamp any stock that no longer fits under
  // them — pulling back doesn't just cap the magazine, it empties what the
  // deck can no longer hold ready
  function syncFleetCaps() {
    const cap = fleetCapacity();
    G.caps.fighters = cap.fighters;
    G.caps.cruise = cap.cruise;
    G.res.fighters = Math.min(G.res.fighters, G.caps.fighters);
    G.res.cruise = Math.min(G.res.cruise, G.caps.cruise);
  }

  // put every deck where its state says it is (also used on load/restore)
  function syncCarrierMap() {
    for (const cv of G.carriers) {
      if (cv.id === 'csg-ford' && !cv.arrived) {
        // still crossing: place her along the run-in, or nowhere at all
        MapView.setCarrierIngress(cv.id, G.secondCarrierOrdered
          ? 1 - G.secondCarrierEta / FORD_TRANSIT_TURNS : -1);
        continue;
      }
      MapView.setCarrierPosture(cv);
    }
  }

  // the Diego Garcia marker is only on the plot once there is something on it
  function syncBomberMap() {
    MapView.setAssetActive('diego', G.bombersArrived);
  }

  // Call the 509th forward. One turn wingtip-to-wingtip across the Pacific with
  // the whole tanker force behind it — and for that turn, nothing else moves.
  function orderBombers() {
    if (G.over || G.bombersOrdered || deploymentInbound()) return;
    G.bombersOrdered = true;
    G.bomberEta = B2_TRANSIT_TURNS;
    AudioSys.play('cable');
    UI.renderAll(G);
    Save.write();
  }

  // tick the bomber deployment; on arrival the ramp at Diego Garcia goes live
  function checkBomberArrival() {
    if (!G.bombersOrdered || G.bombersArrived || G.bomberEta <= 0) return null;
    G.bomberEta--;
    if (G.bomberEta > 0) return null;

    G.bombersArrived = true;
    G.caps.stealth = BOMBER_CAP;
    G.res.stealth = BOMBER_READY;
    syncBomberMap();
    AudioSys.play('cable');
    return {
      cls: 'friendly', title: 'B-2 FORCE IN THEATER — DIEGO GARCIA',
      text: 'The 509th Bomb Wing flew from Whiteman with the tanker force strung out behind it across the Pacific, and the aircraft are on the ramp at Diego Garcia under cover. Munitions handlers are building up GBU-57s tonight. From here the Massive Ordnance Penetrator is on the table — which means Fordow is finally a target and not a briefing slide. The bridge is clear again for whatever you want moved next.',
    };
  }

  // ---- the two fleet commands ----

  // Surging a second deck is a five-turn decision. She is somewhere in the
  // Indian Ocean when the order goes out and no amount of wanting moves her
  // faster — the cost of the second carrier is paid in the turns before it.
  function orderCarrier() {
    if (G.over || G.secondCarrierOrdered || deploymentInbound()) return;
    G.secondCarrierOrdered = true;
    G.secondCarrierEta = FORD_TRANSIT_TURNS;
    syncCarrierMap();
    AudioSys.play('cable');
    UI.renderAll(G);
    Save.write();
  }

  // Order a deck between stations. Takes effect at the end of the turn — the
  // order is given now, the ship is somewhere in between until then.
  function toggleCarrierPosture(id) {
    if (G.over || SpecOps.busy()) return;
    const cv = carrierById(id);
    if (!cv || !cv.arrived || cv.lost || cv.moving) return;
    cv.moving = cv.posture === 'forward' ? 'back' : 'forward';
    syncFleetCaps();
    MapView.setCarrierPosture(cv);
    AudioSys.play('cable');
    UI.renderAll(G);
    Save.write();
  }

  // ---- end-of-turn fleet movement ----

  // a deck that spent this turn repositioning is now on its new station
  function checkCarrierTransit() {
    const events = [];
    for (const cv of G.carriers) {
      if (!cv.moving) continue;
      cv.posture = cv.moving;
      cv.moving = null;
      MapView.setCarrierPosture(cv);
      events.push(cv.posture === 'forward' ? {
        cls: 'friendly', title: `${cvShort(cv)} ON STATION — GULF OF OMAN`,
        text: `${cvName(cv)} has closed back up into the Gulf of Oman and resumed full flight operations. Her air wing is at your disposal again — and so is she, to everything Iran can range on that water.`,
      } : {
        cls: 'friendly', title: `${cvShort(cv)} WITHDRAWN TO THE ARABIAN SEA`,
        text: `${cvName(cv)} is clear of the anti-ship envelope and steaming in open water. She is out of reach, and so is half of what she could do for you: the tanker chain from out here only supports a fraction of her sortie rate.`,
      });
    }
    if (events.length) syncFleetCaps();
    return events;
  }

  // tick the second carrier's transit; on arrival she joins at safe standoff
  function checkCarrierArrival() {
    if (!G.secondCarrierOrdered || G.secondCarrierEta <= 0) return null;
    G.secondCarrierEta--;
    const ford = carrierById('csg-ford');

    if (G.secondCarrierEta > 0) {
      MapView.setCarrierIngress(ford.id, 1 - G.secondCarrierEta / FORD_TRANSIT_TURNS);
      return null;
    }

    ford.arrived = true;
    ford.posture = 'back';
    ford.moving = null;
    syncFleetCaps();
    MapView.setCarrierPosture(ford);
    AudioSys.play('cable');
    return {
      cls: 'friendly', title: 'FORD ON STATION — ARABIAN SEA',
      text: 'The USS Gerald R. Ford Carrier Strike Group has arrived in the Arabian Sea and checked in with Fifth Fleet. Her air wing is available from standoff at reduced rate — bring her up into the Gulf of Oman and she doubles what she gives you, on the same terms as every other hull in that water.',
    };
  }

  // ---- Iranian anti-ship fires ----
  // The reason a carrier in the Gulf of Oman is a decision and not scenery. The
  // threat is Iran's navy: kill the naval bases and the risk goes with them.
  function carrierRisk() {
    const events = [];
    const naval = IranAI.navalStrength(); // 0..2
    if (naval <= 0) return events;        // nothing left to shoot at her
    for (const cv of G.carriers) {
      const exposure = carrierExposure(cv);
      if (!exposure) continue;
      // 10% a turn at full Iranian naval strength, forward — halved in transit,
      // and falling to nothing as their naval bases burn
      if (Math.random() >= 0.05 * naval * exposure) continue;
      events.push(strikeCarrier(cv, naval));
    }
    return events;
  }

  // Resolve a hit. The event carries the numbers; applyEvent spends them, so
  // nothing here touches approval or the casualty count directly.
  function strikeCarrier(cv, naval) {
    // an unlucky hit hurts; only a coordinated salvo from an intact navy has
    // any real chance of putting a supercarrier under
    const sunk = Math.random() < (naval >= 1 ? 0.18 : 0.06);
    AudioSys.play('aircraftLost', 600);

    if (sunk) {
      cv.lost = true;
      cv.moving = null;
      G.stats.carriersLost++;
      syncFleetCaps();
      MapView.setCarrierPosture(cv);
      return {
        cls: 'iran', title: `${cvName(cv).toUpperCase()} LOST`,
        text: `A coordinated Iranian salvo — anti-ship ballistic missiles from the coast, cruise missiles from the islands, and small craft coming in underneath the engagement envelope — saturated the strike group's defenses and put multiple weapons into ${cvName(cv)}. Flooding was uncontrolled. The order to abandon ship was given four hours later and her escorts recovered the great majority of her ship's company; the rest are dead or unaccounted for. The United States has lost a nuclear aircraft carrier for the first time in its history, on television, and Tehran is claiming the largest naval victory since the age of sail.`,
        casualties: rand(45, 85), dApproval: -20, dOil: 16, dWorld: -3,
        flashAsset: cv.id, attack: { kind: 'missile', base: cv.id, count: 6 },
      };
    }

    cv.damaged = true;
    cv.moving = null;
    cv.posture = 'back';   // she comes off the line whether you ordered it or not
    syncFleetCaps();
    MapView.setCarrierPosture(cv);
    return {
      cls: 'iran', title: `${cvShort(cv)} STRUCK — WITHDRAWING FROM THE GULF`,
      text: `An Iranian anti-ship missile got through the screen and hit ${cvName(cv)} above the waterline, starting fires on the hangar deck. Damage control has the ship, but her flight deck is fouled and her catapults are down. She is retiring to the Arabian Sea and will fly at a fraction of her rate for the rest of this war. Fifth Fleet did not order the withdrawal — the damage did.`,
      casualties: rand(8, 25), dApproval: -7, dOil: 6,
      flashAsset: cv.id, attack: { kind: 'missile', base: cv.id, count: 4 },
    };
  }

  // ---- Israel: the joint deep-strike option ----
  // Coordinating with Israel buys exactly one combined package against a buried
  // site — IAF F-35I escort and SEAD opening the corridor for US penetrators.
  // It is the only path to Fordow that isn't a B-2, and it costs more abroad
  // than an American strike does: everyone reads it as the war widening.
  const JOINT_PKGS = {
    natanz: {
      asset: 'fighter', qty: 2, base: 0.78, eta: 2, joint: true, extraWorld: -6,
      label: 'JOINT US–ISRAELI PACKAGE — F-35I escort + penetrators',
    },
    fordow: {
      asset: 'fighter', qty: 2, base: 0.62, eta: 2, joint: true, extraWorld: -8,
      label: 'JOINT US–ISRAELI PACKAGE — the only alternative to a B-2',
    },
  };

  // TARGETS is static data rebuilt on load, so the joint option is derived from
  // saved state rather than stored — call this whenever that state changes.
  function syncJointPackages() {
    for (const [id, pkg] of Object.entries(JOINT_PKGS)) {
      const t = TARGETS.find(x => x.id === id);
      t.packages = t.packages.filter(p => !p.joint);
      if (G.israelJointAvailable) t.packages.push(pkg);
    }
  }

  // one-line posture summary used by map tooltips and the diplomacy panel
  function israelStatus() {
    if (G.israelPosture === 'coordinated') return 'COORDINATED WITH CENTCOM';
    if (G.israelPosture === 'unilateral') return 'ACTING UNILATERALLY';
    return `SIDELINED — patience ${G.israelPatience}`;
  }

  const AD_PENALTY = { fighter: 0.09, cruise: 0.05, stealth: 0.02 };
  const resKey = (asset) => asset === 'fighter' ? 'fighters' : asset;

  // Why a TLAM salvo comes up short — weather, bad targeting data, or a launch/
  // booster fault. Air defense is never the cause.
  const TLAM_MISS_REASONS = [
    'Strike failed to achieve desired effects. Assessed cause: heavy weather over the target degraded terminal guidance and the missiles went long.',
    'Strike failed to achieve desired effects. Assessed cause: the targeting package was bad — the aimpoint coordinates were off and the warheads fell on open ground.',
    'Strike failed to achieve desired effects. Assessed cause: booster and launch faults — several birds failed to reach the target after leaving the rail.',
  ];

  function computeStrike(target, pkg) {
    const ad = airDefenseWeight();
    // TLAMs fly under the SAM belt — air defense doesn't degrade a Tomahawk.
    // Its misses come from weather, targeting, or launch faults, not the threat.
    const adPenalty = pkg.asset === 'cruise' ? 0 : AD_PENALTY[pkg.asset] * ad;
    const dmgBonus = target.status === 'damaged' ? 0.15 : 0;
    const success = clamp(pkg.base - adPenalty + dmgBonus, 0.05, 0.95);
    const lossRisk = pkg.asset === 'fighter' ? clamp(0.05 * ad, 0, 0.35) : 0;
    return { success, adPenalty, lossRisk };
  }

  // Strikes take time. Authorizing a package commits the assets and puts the
  // mission IN FLIGHT: fighter and TLAM packages arrive at the end of this
  // turn; B-2s transiting from Diego Garcia take two turns. BDA comes back
  // with the battle report — you commit, then you wait.
  const MISSION_ETA = { fighter: 1, cruise: 1, stealth: 2 };

  function executeStrike(target, pkg) {
    if (G.over) return;
    const key = resKey(pkg.asset);
    if (G.res[key] < pkg.qty) return;
    G.res[key] -= pkg.qty;

    // the joint option is one-shot: committing it against either site spends it
    if (pkg.joint) { G.israelJointAvailable = false; syncJointPackages(); }

    G.strikesThisTurn++;
    G.stats.strikes++;
    G.missions.push({ targetId: target.id, pkg: { ...pkg }, eta: pkg.eta || MISSION_ETA[pkg.asset] });
    AudioSys.play('launch');
    UI.renderAll(G);
    Save.write();
  }

  // resolve one mission at time-on-target; returns the BDA event
  function resolveImpact(target, pkg) {
    if (target.status === 'destroyed') {
      // an earlier package in the same volley (or turn) already finished it
      return {
        cls: 'friendly', title: `BDA: ${target.name}`,
        text: 'The package arrived over a target already destroyed. Aircraft and missiles expended against rubble — coordination cost, nothing gained.',
      };
    }

    G.struckThisTurn.push(target.id);
    // a joint strike carries its own diplomatic surcharge on top of the target's
    const worldCost = target.world + (pkg.extraWorld || 0);
    G.world = clamp(G.world + worldCost, 0, 100);
    const est = computeStrike(target, pkg);
    const roll = Math.random();
    let outcome, text;

    if (roll < est.success * 0.6) {
      outcome = 'destroyed';
    } else if (roll < est.success) {
      outcome = target.status === 'damaged' ? 'destroyed' : 'damaged';
    } else {
      outcome = 'miss';
    }

    const ev = { cls: 'friendly', title: `BDA: ${target.name}`, dWorld: worldCost };
    ev.hit = outcome === 'destroyed' || outcome === 'damaged';

    if (outcome === 'destroyed') {
      target.status = 'destroyed';
      G.stats.destroyed++;
      G.approval = clamp(G.approval + 3, 0, 100);
      ev.dApproval = 3;
      text = 'Battle damage assessment confirms the target is destroyed. Functional capability eliminated.';
      if (target.type === 'oil') { G.oil += 10; ev.dOil = 10; }
    } else if (outcome === 'damaged') {
      target.status = 'damaged';
      G.approval = clamp(G.approval + 1, 0, 100);
      ev.dApproval = 1;
      text = 'Partial effects on target. Significant damage, but the site retains residual capability. A follow-up strike would likely finish it.';
    } else {
      G.approval = clamp(G.approval - 2, 0, 100);
      ev.dApproval = -2;
      text = pkg.asset === 'cruise'
        ? TLAM_MISS_REASONS[Math.floor(Math.random() * TLAM_MISS_REASONS.length)]
        : 'Strike failed to achieve desired effects. Weather, decoys, and hardening are assessed as contributing factors.';
    }

    // aircrew attrition vs the SAMs still standing at time-on-target
    if (est.lossRisk > 0 && Math.random() < est.lossRisk) {
      G.stats.aircraftLost++;
      G.casualties.us += 2;
      G.approval = clamp(G.approval - 4, 0, 100);
      text += ' One strike aircraft was lost to surface-to-air fire. Two aviators are dead; footage is already on Iranian state TV.';
      ev.casualties = 2;
      AudioSys.play('aircraftLost', 600);
    }

    if (pkg.joint) {
      ev.title = `BDA: ${target.name} — JOINT US–ISRAELI STRIKE`;
      text += ' Israeli aircraft flew the escort and SEAD package. Tehran is telling the region this was a Zionist–American operation, and the region is inclined to believe it.';
    }

    ev.text = text;
    MapView.updateTarget(target);
    G.stats.peakOil = Math.max(G.stats.peakOil, G.oil);
    return ev;
  }

  // advance the mission clock and resolve everything reaching time-on-target,
  // animating each impact in sequence. Missions resolve in the order they were
  // laid on — a SEAD sweep queued first clears the air for packages behind it.
  function resolveMissions(done) {
    const due = [];
    for (const m of G.missions) { m.eta--; if (m.eta <= 0) due.push(m); }
    G.missions = G.missions.filter(m => m.eta > 0);
    const events = [];

    const next = () => {
      if (due.length === 0) { done(events); return; }
      // Batch adjacent same-target same-asset missions into one scope run so the
      // formation flies together with one silhouette per package. BDA still
      // resolves per-mission — the batching is purely an animation grouping.
      const head = due.shift();
      const batch = [head];
      while (due.length && due[0].targetId === head.targetId && due[0].pkg.asset === head.pkg.asset) {
        batch.push(due.shift());
      }
      const target = TARGETS.find(t => t.id === head.targetId);
      const count = batch.reduce((n, m) => n + (m.pkg.qty || 1), 0);
      // watchdog: if the animation frame loop is throttled (background tab),
      // resolve anyway — a stalled animation must never hold up the war
      let resolved = false;
      const finishBatch = () => {
        if (resolved) return;
        resolved = true;
        AudioSys.play('impact');
        const batchEvents = batch.map(bm => resolveImpact(target, bm.pkg));
        for (const ev of batchEvents) events.push(ev);
        // a successful hit plays the strike clip in the target's radar window
        if (batchEvents.some(ev => ev.hit)) MapView.playStrikeHit(target);
        UI.renderAll(G);
        next();
      };
      MapView.animateStrike(head.pkg.asset, target, finishBatch, count);
      // watchdog window must clear the whole run; a launch clip plays before the
      // flight (TLAMs always, carrier fighter sorties sometimes), so allow extra
      // time before force-resolving. Fighters can't be told apart here, so the
      // allowance is applied to all of them — it only delays the stall fallback.
      const launchClip = head.pkg.asset === 'cruise' || head.pkg.asset === 'fighter' ? 5000 : 0;
      setTimeout(finishBatch, (FLIGHT_DUR[head.pkg.asset] || 1000) + launchClip + 3500);
    };
    next();
  }

  // ran after any resolved action: persist, then check for an ending
  function afterAction() {
    G.stats.peakOil = Math.max(G.stats.peakOil, G.oil);
    Save.write();
    const result = checkEnd();
    if (result) finish(result);
  }

  // ---- diplomacy ----
  function doDiplo(action) {
    if (G.over || G.diploUsed) return;
    const events = [];

    switch (action) {
      case 'backchannel': {
        G.stats.backchannels++;
        if (G.negotiationReady()) {
          // odds are driven by how badly Iran is losing, not by how calm things are
          const warStr = IranAI.missileStrength() + IranAI.navalStrength(); // 0..4
          const irgcDown = TARGETS.find(t => t.id === 'irgc-hq').status === 'destroyed';
          // A dead leadership is leverage at the table rather than a shortcut to
          // it: a lasting bonus while the pragmatists hold on, plus the sharper
          // temporary one during the immediate power vacuum.
          const p = clamp(0.08 + (1.5 - warStr) * 0.12 + (irgcDown ? 0.08 : 0) +
            G.sanctions * 0.03 + G.negotiationMomentum +
            (G.raidDecapitated() && !G.regimeErratic ? 0.10 : 0) +
            (G.regimeChaosTurns > 0 ? 0.15 : 0) - (G.regimeErratic ? 0.15 : 0), 0.03, 0.65);
          if (Math.random() < p) {
            G.negotiationsAccepted = true;
            G.diploUsed = true;
            UI.renderAll(G);
            finish(buildResult('victory', 'deal'));
            return;
          }
          G.negotiationMomentum += 0.1;
          events.push({
            cls: 'world', title: 'Backchannel: Tehran not broken enough — yet',
            text: 'The Omanis report the pragmatists are listening but the hardliners still believe they can absorb the damage. Keep destroying what they fight with and the calculus changes.',
          });
        } else {
          // Tehran can still fight — the overture reads as American hesitation
          G.approval = clamp(G.approval - 2, 0, 100);
          events.push({
            cls: 'world', title: 'Backchannel rebuffed',
            text: 'Muscat relays Tehran\'s answer: no talks while the Islamic Republic can still fight. The overture is spun as American weakness on state TV, and hardliners at home ask why you\'re suing for peace mid-war.',
            dApproval: -2,
          });
        }
        break;
      }
      case 'un': {
        G.world = clamp(G.world + 8, 0, 100);
        events.push({
          cls: 'world', title: 'UN Security Council session',
          text: 'US diplomats rally broad condemnation of the attack on USS Milius. Russia and China block binding action but the diplomatic cover is valuable.',
          dWorld: 8,
        });
        break;
      }
      case 'sanctions': {
        G.sanctions++;
        G.world = clamp(G.world - 2, 0, 100);
        G.oil += 4;
        events.push({
          cls: 'world', title: 'Snap-back sanctions imposed',
          text: 'Sweeping secondary sanctions hit Iranian oil sales and finance. Tehran\'s economy contracts further — negotiation leverage improves.',
          dWorld: -2, dOil: 4,
        });
        break;
      }
      case 'coalition': {
        if (G.coalition) return;
        G.coalition = true;
        G.world = clamp(G.world + 5, 0, 100);
        // allied squadrons fly from land — they survive whatever happens afloat
        G.alliedFighters += 2;
        syncFleetCaps();
        G.res.fighters = Math.min(G.res.fighters + 2, G.caps.fighters);
        events.push({
          cls: 'world', title: 'Strike coalition assembled',
          text: 'The UK, France, and Gulf partners formally join the operation. Allied squadrons add sortie capacity and share the political burden.',
          dWorld: 5,
        });
        break;
      }
      case 'israel': {
        if (G.israelPosture !== 'sidelined') return;
        G.israelPosture = 'coordinated';
        G.israelPatience = 0;      // they are in the war now; nothing left to wait for
        G.israelJointAvailable = true;
        syncJointPackages();
        G.world = clamp(G.world - 8, 0, 100);
        G.oil += 5;
        G.alliedFighters += 2;
        syncFleetCaps();
        G.res.fighters = Math.min(G.res.fighters + 2, G.caps.fighters);
        events.push({
          cls: 'world', title: 'Israel brought into the operation',
          text: 'Jerusalem folds its strike planning into CENTCOM\'s. IAF squadrons add sortie capacity, and one combined deep-strike package is now available against Natanz or Fordow — the first path to the buried halls that does not require a B-2. The price is paid abroad: Arab partners who were quietly helping now have to be publicly seen not to, and Tehran has been handed the war it wants to fight — Israel is now a legitimate target in every Iranian broadcast.',
          dWorld: -8, dOil: 5,
        });
        break;
      }
      case 'address': {
        if (G.addressCooldown > 0) return;
        G.addressCooldown = 3;
        G.approval = clamp(G.approval + 6, 0, 100);
        events.push({
          cls: 'friendly', title: 'Oval Office address',
          text: 'You lay out the stakes to the American people: the attack, the objectives, and what victory requires. The rally effect is real, for now.',
          dApproval: 6,
        });
        break;
      }
      default: return;
    }

    G.diploUsed = true;
    G.stats.peakOil = Math.max(G.stats.peakOil, G.oil);
    AudioSys.play('cable');
    UI.renderAll(G);
    UI.showReport('DIPLOMATIC CABLE', events, afterAction);
  }

  // ---- Israel's own clock ----
  // Israel is not waiting on American permission indefinitely. While they are
  // sidelined and the program is still substantially intact, their patience
  // runs down; at zero they fly the mission themselves. It is a worse strike
  // than one you would have run — no penetrators, partial results — and you
  // own the escalation without having chosen it.
  function israelTurn() {
    if (G.israelStrikesUsed || G.israelPosture !== 'sidelined') return null;
    if (G.nukeDegraded() >= 50) return null; // program already gutted: they stand down
    if (--G.israelPatience > 0) return null;

    G.israelPosture = 'unilateral';
    G.israelStrikesUsed = true;

    // what they actually achieve: real damage at Natanz, little at Fordow,
    // which is buried under rock only a GBU-57 reaches
    const hits = [];
    for (const [id, killP, dmgP] of [['natanz', 0.30, 0.75], ['fordow', 0, 0.40]]) {
      const t = TARGETS.find(x => x.id === id);
      if (t.status === 'destroyed') continue;
      const roll = Math.random();
      if (roll < killP) { t.status = 'destroyed'; hits.push(`${t.name} destroyed`); }
      else if (roll < dmgP) {
        t.status = t.status === 'damaged' ? 'destroyed' : 'damaged';
        hits.push(`${t.name} ${t.status}`);
      }
      MapView.updateTarget(t);
    }

    const bda = hits.length
      ? `Assessed effects: ${hits.join('; ')}.`
      : 'Assessed effects: negligible. They spent the surprise and bought nothing.';

    return {
      cls: 'world', title: 'ISRAEL STRIKES IRAN UNILATERALLY',
      text: `Without notifying Washington, the Israeli Air Force flew a long-range package against the enrichment sites overnight. The first CENTCOM knew of it was the radar picture. ${bda} Jerusalem's statement thanks the United States for its support. Every capital in the region now believes you authorized this, and Tehran has said so on every frequency it owns. You no longer control the escalation — you only answer for it.`,
      dWorld: -14, dOil: 16, dApproval: -3,
    };
  }

  // ---- Iranian phase / end turn ----
  function applyEvent(ev) {
    if (ev.degradeTarget) {
      const t = TARGETS.find(x => x.id === ev.degradeTarget);
      if (t && t.status !== 'destroyed') {
        t.status = t.status === 'damaged' ? 'destroyed' : 'damaged';
        MapView.updateTarget(t);
      }
    }
    if (ev.casualties) G.casualties.us += ev.casualties;
    if (ev.dApproval) G.approval = clamp(G.approval + ev.dApproval, 0, 100);
    if (ev.dOil) G.oil = Math.max(60, G.oil + ev.dOil);
    if (ev.dWorld) G.world = clamp(G.world + ev.dWorld, 0, 100);
    if (ev.hormuz) { G.hormuz = ev.hormuz; MapView.setHormuz(G.hormuz); }
    if (ev.flashAsset) MapView.flashAsset(ev.flashAsset);
  }

  function endTurn() {
    // the task force is still on the objective — nothing else moves until the
    // mission resolves, or the sequencing of its debrief and the turn breaks
    if (G.over || SpecOps.busy()) return;

    // strike packages arrive first — BDA lands, then Iran answers with
    // whatever the volley left standing
    resolveMissions((bda) => {
      // Israel moves between the BDA and Iran's answer — if they went tonight,
      // Tehran is responding to their strike as much as to yours
      const israeli = israelTurn();
      const events = IranAI.respond(G);
      // anti-ship fires are resolved against wherever the decks sat THIS turn,
      // before any repositioning ordered this turn completes below
      for (const ev of carrierRisk()) events.unshift(ev);
      if (israeli) events.unshift(israeli);
      if (events.some(ev => ev.casualties || ev.hormuz === 'CLOSED')) AudioSys.play('retaliation');

      // Iran's salvos fly on the map — missiles, drone swarms, intercepts —
      // before the battle report lands and covers the screen
      MapView.animateIranianAttacks(events, () => {
        for (const ev of events) applyEvent(ev);

        // economy: oil carries a war premium set by Iran's remaining ability
        // to threaten the Gulf, plus the state of the strait
        const warPremium = IranAI.missileStrength() + IranAI.navalStrength() > 1 ? 14 : 4;
        const oilTarget = 88 + warPremium +
          (G.hormuz === 'CONTESTED' ? 20 : G.hormuz === 'CLOSED' ? 75 : 0);
        G.oil = Math.max(60, G.oil + (oilTarget - G.oil) * 0.25);
        G.stats.peakOil = Math.max(G.stats.peakOil, G.oil);

        if (G.hormuz === 'CLOSED') G.hormuzClosedTurns++;
        else G.hormuzClosedTurns = 0;

        // domestic drift: expensive gas and long wars erode approval
        if (G.oil >= 150) G.approval = clamp(G.approval - 2, 0, 100);
        else if (G.oil >= 115) G.approval = clamp(G.approval - 1, 0, 100);
        if (G.turn > 8) G.approval = clamp(G.approval - 0.5, 0, 100);

        // fleet movement closes the turn: decks that spent it repositioning are
        // on their new stations, and the second carrier is one leg closer
        const fleet = checkCarrierTransit();
        const arrival = checkCarrierArrival();
        if (arrival) fleet.push(arrival);
        const bombers = checkBomberArrival();
        if (bombers) fleet.push(bombers);

        const day = Math.ceil(G.turn / 2);
        const all = [...bda, ...events, ...fleet];
        UI.setTicker(IranAI.headlines(G, all));
        const result = checkEnd();

        // hold the battle report until every strike clip has finished playing
        MapView.whenFootageDone(() => {
          UI.showReport(`BATTLE REPORT — DAY ${day}, TURN ${G.turn}`, all, () => {
            if (result) { finish(result); return; }
            nextTurn();
          });
        });
      });
    });
  }

  function nextTurn() {
    G.turn++;
    if (G.turn > G.maxTurns) {
      // the campaign has culminated: if the objectives are nowhere near met,
      // the force is spent for nothing — that is a defeat, not a draw
      finish(G.nukeDegraded() < 50
        ? buildResult('defeat', 'exhaustion')
        : buildResult('stalemate', 'time'));
      return;
    }

    // replenish — what the decks can turn around depends on where they are
    syncFleetCaps();
    const cap = fleetCapacity();
    G.res.fighters = Math.min(G.res.fighters + cap.repFighters, G.caps.fighters);
    G.res.cruise = Math.min(G.res.cruise + cap.repCruise, G.caps.cruise);
    // the bombers only regenerate once there are bombers — turnaround at Diego
    // Garcia is three turns per airframe, and an empty ramp turns nothing around
    if (G.bombersArrived && G.turn % 3 === 0) {
      G.res.stealth = Math.min(G.res.stealth + 1, G.caps.stealth);
    }

    if (G.addressCooldown > 0) G.addressCooldown--;
    if (G.regimeChaosTurns > 0) G.regimeChaosTurns--;
    G.diploUsed = false;
    G.strikesThisTurn = 0;
    G.struckThisTurn = [];
    G.raidThisTurn = false;

    UI.renderAll(G);
    Save.write();
  }

  // ---- endings ----
  function checkEnd() {
    if (G.over) return null;
    // primary win: the nuclear program is gone and Iran can no longer fight
    if (G.nukeDegraded() >= 100 && G.iranBroken()) return buildResult('victory', 'military');
    // the losses are military and political:
    if (G.casualties.us >= 150) return buildResult('defeat', 'casualties');
    if (G.approval <= 20) return buildResult('defeat', 'impeachment');
    if (G.hormuzClosedTurns >= 5 || G.oil >= 240) return buildResult('defeat', 'economy');
    return null;
  }

  function gradeFor(value, thresholds) {
    // thresholds: [A,B,C,D] cutoffs, ascending badness
    const letters = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < thresholds.length; i++) if (value <= thresholds[i]) return letters[i];
    return 'F';
  }

  function buildResult(kind, reason) {
    const deg = G.nukeDegraded();
    const milGrade = deg >= 100 && G.stats.destroyed >= 5 ? 'A'
      : deg >= 100 ? 'B' : deg >= 50 ? 'C' : deg >= 25 ? 'D' : 'F';
    const livesGrade = gradeFor(G.casualties.us, [15, 30, 60, 120]);
    const worldGrade = G.world >= 60 ? 'A' : G.world >= 48 ? 'B' : G.world >= 36 ? 'C' : G.world >= 25 ? 'D' : 'F';
    const econGrade = gradeFor(G.stats.peakOil, [100, 125, 155, 190]);

    const titles = {
      military: 'DECISIVE VICTORY — IRAN\'S WAR MACHINE BROKEN',
      deal: 'ARMISTICE — TEHRAN SUES FOR PEACE',
      casualties: 'DEFEAT — UNSUSTAINABLE LOSSES',
      impeachment: 'DEFEAT — PRESIDENCY COLLAPSES',
      economy: 'DEFEAT — ECONOMIC COLLAPSE',
      exhaustion: 'DEFEAT — CAMPAIGN CULMINATED',
      time: 'WAR FROZEN — OBJECTIVES INCOMPLETE',
    };
    const verdicts = {
      military: 'VICTORY. The nuclear program is destroyed and Iran\'s ability to wage war — its missile force, its navy, its command structure — has been dismantled. The objectives are achieved by force of arms.',
      deal: 'VICTORY. With its war machine breaking apart, Tehran took the off-ramp and accepted terms. The objectives are achieved — signed rather than shattered.',
      casualties: 'The casualty count crossed what the country would bear. Congress moved to cut off funding for the operation, and the campaign ends with its objectives unmet and its dead counted in the hundreds.',
      impeachment: 'With approval in ruins, your own party abandoned you. The House opened impeachment proceedings over the conduct of the war; the presidency is effectively over.',
      economy: 'The prolonged closure of Hormuz broke the global economy. Fuel rationing, a market crash, and allied governments falling — the war was lost at the gas pump.',
      exhaustion: 'The force culminated with the objectives nowhere in sight. Magazines empty, crews exhausted, and Iran\'s program still standing — the campaign simply ran out of ammunition and time.',
      time: 'Ten days of war ended in an armed standoff. Real damage was done, but Iran\'s capacity to fight survives; the problem is handed to the next news cycle, and perhaps the next president.',
    };
    const narratives = {
      military: `CENTCOM's assessment is unambiguous: enrichment halted, missile brigades combat-ineffective, the IRGC command chain severed.` +
        (G.hostageCrisis ? ' The captured operators were recovered in the final hours as the regime\'s prison apparatus dissolved.' : '') +
        ` It took ${G.turn} turns and ${G.casualties.us} American lives.`,
      deal: `Backchannel talks in Muscat produced a framework: verified dismantlement against phased sanctions relief — terms dictated by the battlefield.` +
        (G.hostageCrisis ? ' The final sticking point was the captured operators — their release is written into the first annex.' : '') +
        ` It took ${G.turn} turns and ${G.casualties.us} American lives.`,
      casualties: 'The war was winnable on the map. It was lost in the arrival ceremonies at Dover.',
      impeachment: 'The objectives, whatever their merits, could not survive the politics.',
      economy: 'Military dominance meant little once the strait stayed shut.',
      exhaustion: 'Historians will note the sorties flown and the little they changed.',
      time: `The nuclear program stands at ${deg}% degraded. The fleet remains on station. Nothing is settled.`,
    };

    const grades = [
      ['MILITARY SUCCESS', milGrade, `Nuclear program ${deg}% degraded · ${G.stats.destroyed} targets destroyed · ${G.stats.aircraftLost} aircraft lost`],
      ['AMERICAN LIVES', livesGrade, `${G.casualties.us} US service members killed` +
        (G.stats.carriersLost ? ` · ${G.stats.carriersLost} carrier${G.stats.carriersLost > 1 ? 's' : ''} lost` : '')],
      ['DIPLOMATIC STANDING', worldGrade, `World opinion ${Math.round(G.world)}/100`],
      ['ECONOMIC DAMAGE', econGrade, `Peak oil price $${Math.round(G.stats.peakOil)}/bbl`],
    ];
    if (G.raid !== 'none') {
      grades.splice(1, 0,
        G.raid === 'success'
          ? ['SPECIAL OPERATIONS', 'A', 'Leadership decapitation raid succeeded — regime command chain shattered']
        : G.raid === 'pyrrhic'
          ? ['SPECIAL OPERATIONS', 'C', 'Leadership target killed — the entire task force was lost taking him']
        : ['SPECIAL OPERATIONS', 'F', G.hostageCrisis
          ? 'Leadership raid failed — operators captured and paraded on Iranian state TV'
          : 'Leadership raid failed — the task force was lost on Iranian soil']);
    }

    G.over = true;
    return {
      kind, title: titles[reason], verdict: verdicts[reason], narrative: narratives[reason],
      grades,
      stats: {
        approval: G.approval, oil: G.oil,
        casualties: G.casualties.us, destroyed: G.stats.destroyed, turns: G.turn,
      },
    };
  }

  function finish(result) {
    G.over = true;
    Save.clear(); // the crisis is over, one way or another
    AudioSys.play(result.kind === 'victory' ? 'victory' : result.kind === 'defeat' ? 'defeat' : 'cable');
    UI.renderAll(G);
    UI.showEndgame(result);
  }

  // ---- boot ----
  function start(resume) {
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    MapView.render();
    syncFleetCaps();
    syncCarrierMap();   // the decks are only where the fleet state says they are
    syncBomberMap();    // and Diego Garcia is only on the plot once it is manned
    MapView.setTargetClickHandler((t) => {
      if (G.over || SpecOps.busy()) return;
      if (t.status === 'destroyed') return;
      UI.openStrikeModal(G, t);
    });
    if (resume) {
      // rebuild map state from the restored targets/Hormuz status
      for (const t of TARGETS) MapView.updateTarget(t);
      MapView.setHormuz(G.hormuz);
      UI.setTicker(IranAI.headlines(G, [{ title: 'SITUATION ROOM RECONVENES — THE WAR CONTINUES' }]));
    } else {
      UI.setTicker(IranAI.headlines(G, [{ title: 'USS MILIUS STRUCK IN STRAIT OF HORMUZ — SEVEN SAILORS DEAD' }]));
    }
    UI.renderAll(G);
  }

  function restoreAndStart(data) {
    for (const [f, v] of Object.entries(data.fields)) G[f] = v;
    for (const t of TARGETS) t.status = data.targets[t.id] || 'intact';
    syncJointPackages(); // packages live on static TARGETS — rebuild from saved state
    AudioSys.setMuted(!!data.muted);
    start(true);
  }

  function init() {
    for (const t of TARGETS) t.status = 'intact';
    AudioSys.init();
    UI.init();
    SpecOps.init();

    document.getElementById('btn-start').addEventListener('click', () => start(false));
    document.getElementById('btn-end-turn').addEventListener('click', endTurn);

    // continue / save & quit / new game
    const saved = Save.read();
    const btnContinue = document.getElementById('btn-continue');
    btnContinue.disabled = !saved;
    if (saved) btnContinue.addEventListener('click', () => restoreAndStart(saved));

    document.getElementById('btn-save-quit').addEventListener('click', () => {
      Save.write();
      window.location.reload();
    });
    document.getElementById('btn-new-game').addEventListener('click', () => {
      if (!confirm('Abandon the current war? The save will be erased.')) return;
      Save.clear();
      window.location.reload();
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  // airDefenseWeight is exported read-only for the tactical scope's threat ring —
  // the scope dramatizes the number, it never feeds back into the strike math.
  return { computeStrike, executeStrike, doDiplo, endTurn, afterAction, israelStatus,
    airDefenseWeight, orderCarrier, toggleCarrierPosture, carrierFactor, carrierExposure,
    orderBombers, deploymentInbound, FORD_TRANSIT_TURNS, B2_TRANSIT_TURNS, G };
})();
