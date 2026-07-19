// ============================================================
// game.js — core state, turn loop, strikes, diplomacy, win/lose
// ============================================================

const Game = (() => {
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ---- game state ----
  const G = {
    turn: 1, maxTurns: 20,
    escalation: 4.0,       // 0–10 ladder
    approval: 58,          // %
    oil: 84,               // $/bbl Brent
    world: 60,             // world opinion 0–100
    hormuz: 'OPEN', hormuzClosedTurns: 0,
    casualties: { us: 7 }, // the destroyer attack that starts the crisis
    res: { fighters: 4, cruise: 8, stealth: 1, specops: 1 },
    caps: { fighters: 6, cruise: 12, stealth: 2, specops: 1 },
    strikesThisTurn: 0, struckThisTurn: [],
    sanctions: 0, coalition: false, addressCooldown: 0,
    negotiationsAccepted: false, negotiationMomentum: 0,
    diploUsed: false, over: false,
    // special operations (see specops.js)
    raid: 'none', raidThisTurn: false, isrPrep: 0,
    regimeChaosTurns: 0, regimeErratic: false, hostageCrisis: false,
    stats: { strikes: 0, destroyed: 0, aircraftLost: 0, peakOil: 84, backchannels: 0 },

    nukeDegraded() {
      let d = 0;
      for (const id of ['natanz', 'fordow']) {
        const t = TARGETS.find(x => x.id === id);
        if (t.status === 'destroyed') d += 50;
        else if (t.status === 'damaged') d += 25;
      }
      return d; // 0–100
    },
    negotiationReady() {
      // a successful decapitation raid (with the pragmatists in charge)
      // lowers how much of the program must be gone before Tehran talks
      const degNeeded = this.raid === 'success' && !this.regimeErratic ? 50 : 75;
      return this.nukeDegraded() >= degNeeded && this.escalation <= 6;
    },
  };

  // ---- save / continue (localStorage) ----
  const Save = (() => {
    const KEY = 'cic-save-v1';   // bump the version to invalidate old saves
    const FIELDS = [
      'turn', 'maxTurns', 'escalation', 'approval', 'oil', 'world',
      'hormuz', 'hormuzClosedTurns', 'casualties', 'res', 'caps',
      'strikesThisTurn', 'struckThisTurn', 'sanctions', 'coalition',
      'addressCooldown', 'negotiationsAccepted', 'negotiationMomentum',
      'diploUsed', 'over', 'raid', 'raidThisTurn', 'isrPrep',
      'regimeChaosTurns', 'regimeErratic', 'hostageCrisis', 'stats',
    ];

    function write() {
      if (G.over) return;
      try {
        const data = { version: 1, muted: AudioSys.isMuted(), fields: {}, targets: {} };
        for (const f of FIELDS) data.fields[f] = G[f];
        for (const t of TARGETS) data.targets[t.id] = t.status || 'intact';
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch (e) { /* storage unavailable — play without saves */ }
    }

    function read() {
      try {
        const data = JSON.parse(localStorage.getItem(KEY));
        return data && data.version === 1 ? data : null;
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

  const AD_PENALTY = { fighter: 0.09, cruise: 0.05, stealth: 0.02 };
  const resKey = (asset) => asset === 'fighter' ? 'fighters' : asset;

  function computeStrike(target, pkg) {
    const ad = airDefenseWeight();
    const adPenalty = AD_PENALTY[pkg.asset] * ad;
    const dmgBonus = target.status === 'damaged' ? 0.15 : 0;
    const success = clamp(pkg.base - adPenalty + dmgBonus, 0.05, 0.95);
    const lossRisk = pkg.asset === 'fighter' ? clamp(0.05 * ad, 0, 0.35) : 0;
    return { success, adPenalty, lossRisk };
  }

  function executeStrike(target, pkg) {
    if (G.over) return;
    const key = resKey(pkg.asset);
    if (G.res[key] < pkg.qty) return;
    G.res[key] -= pkg.qty;

    G.strikesThisTurn++;
    G.struckThisTurn.push(target.id);
    G.stats.strikes++;
    G.escalation = clamp(G.escalation + target.esc, 0, 10);
    G.world = clamp(G.world + target.world, 0, 100);
    AudioSys.play('launch');
    UI.renderAll(G);

    MapView.animateStrike(pkg.asset, target, () => {
      AudioSys.play('impact');
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

      const ev = { cls: 'friendly', title: `BDA: ${target.name}` };

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
        text = 'Strike failed to achieve desired effects. Weather, decoys, and hardening are assessed as contributing factors.';
      }

      // aircrew attrition vs remaining SAMs
      if (est.lossRisk > 0 && Math.random() < est.lossRisk) {
        G.stats.aircraftLost++;
        G.casualties.us += 2;
        G.approval = clamp(G.approval - 4, 0, 100);
        G.escalation = clamp(G.escalation + 0.4, 0, 10);
        text += ' One strike aircraft was lost to surface-to-air fire. Two aviators are dead; footage is already on Iranian state TV.';
        ev.casualties = 2;
        AudioSys.play('aircraftLost', 600);
      }

      ev.text = text;
      MapView.updateTarget(target);
      G.stats.peakOil = Math.max(G.stats.peakOil, G.oil);
      UI.renderAll(G);
      UI.showReport('STRIKE REPORT', [ev], afterAction);
    });
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
          const p = clamp(0.25 + G.sanctions * 0.08 + (G.world - 50) * 0.005 +
            (6 - G.escalation) * 0.06 + G.negotiationMomentum +
            (G.regimeChaosTurns > 0 ? 0.2 : 0) - (G.regimeErratic ? 0.15 : 0), 0.05, 0.9);
          if (Math.random() < p) {
            G.negotiationsAccepted = true;
            G.diploUsed = true;
            UI.renderAll(G);
            finish(buildResult('victory', 'deal'));
            return;
          }
          G.negotiationMomentum += 0.1;
          G.escalation = clamp(G.escalation - 0.8, 0, 10);
          events.push({
            cls: 'world', title: 'Backchannel: Tehran not ready — yet',
            text: 'The Omanis report serious engagement but no authority to close. Momentum is building; keep conditions stable and try again.',
            dEsc: -0.8,
          });
        } else {
          G.escalation = clamp(G.escalation - 1.0, 0, 10);
          G.world = clamp(G.world + 2, 0, 100);
          const ev = {
            cls: 'world', title: 'Backchannel contact established',
            text: 'Quiet contact through Muscat lowers the temperature. Tehran will not discuss its nuclear program from a position of strength — leverage is required before a deal is possible.',
            dEsc: -1.0, dWorld: 2,
          };
          if (Math.random() < 0.15) {
            G.approval = clamp(G.approval - 3, 0, 100);
            ev.text += ' The contact leaked to the press; hardliners at home accuse you of appeasement.';
            ev.dApproval = -3;
          }
          events.push(ev);
        }
        break;
      }
      case 'un': {
        G.world = clamp(G.world + 8, 0, 100);
        G.escalation = clamp(G.escalation - 0.5, 0, 10);
        events.push({
          cls: 'world', title: 'UN Security Council session',
          text: 'US diplomats rally broad condemnation of the attack on USS Milius. Russia and China block binding action but the diplomatic cover is valuable.',
          dWorld: 8, dEsc: -0.5,
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
        G.caps.fighters += 2;
        G.res.fighters = Math.min(G.res.fighters + 2, G.caps.fighters);
        events.push({
          cls: 'world', title: 'Strike coalition assembled',
          text: 'The UK, France, and Gulf partners formally join the operation. Allied squadrons add sortie capacity and share the political burden.',
          dWorld: 5,
        });
        break;
      }
      case 'address': {
        if (G.addressCooldown > 0) return;
        G.addressCooldown = 3;
        G.approval = clamp(G.approval + 6, 0, 100);
        events.push({
          cls: 'friendly', title: 'Oval Office address',
          text: 'You lay out the stakes to the American people: the attack, the objectives, and the off-ramp offered to Tehran. The rally effect is real, for now.',
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

  // ---- Iranian phase / end turn ----
  function applyEvent(ev) {
    if (ev.casualties) G.casualties.us += ev.casualties;
    if (ev.dApproval) G.approval = clamp(G.approval + ev.dApproval, 0, 100);
    if (ev.dEsc) G.escalation = clamp(G.escalation + ev.dEsc, 0, 10);
    if (ev.dOil) G.oil = Math.max(60, G.oil + ev.dOil);
    if (ev.dWorld) G.world = clamp(G.world + ev.dWorld, 0, 100);
    if (ev.hormuz) { G.hormuz = ev.hormuz; MapView.setHormuz(G.hormuz); }
    if (ev.flashAsset) MapView.flashAsset(ev.flashAsset);
  }

  function endTurn() {
    if (G.over) return;

    // restraint pays down the ladder (a raid is not restraint)
    const restrained = G.strikesThisTurn === 0 && !G.raidThisTurn;
    if (restrained) G.escalation = clamp(G.escalation - 0.6, 0, 10);

    const events = IranAI.respond(G);
    for (const ev of events) applyEvent(ev);
    if (events.some(ev => ev.casualties || ev.hormuz === 'CLOSED')) AudioSys.play('retaliation');

    // economy: oil drifts toward a level set by escalation + Hormuz status
    const oilTarget = 82 + G.escalation * 5 +
      (G.hormuz === 'CONTESTED' ? 20 : G.hormuz === 'CLOSED' ? 75 : 0);
    G.oil = Math.max(60, G.oil + (oilTarget - G.oil) * 0.25);
    G.stats.peakOil = Math.max(G.stats.peakOil, G.oil);

    if (G.hormuz === 'CLOSED') G.hormuzClosedTurns++;
    else G.hormuzClosedTurns = 0;

    // domestic drift: expensive gas and long crises erode approval
    if (G.oil >= 150) G.approval = clamp(G.approval - 2, 0, 100);
    else if (G.oil >= 115) G.approval = clamp(G.approval - 1, 0, 100);
    if (G.turn > 8) G.approval = clamp(G.approval - 0.5, 0, 100);

    // world opinion slowly recovers in quiet turns
    if (restrained) G.world = clamp(G.world + 1.5, 0, 100);

    const day = Math.ceil(G.turn / 2);
    UI.setTicker(IranAI.headlines(G, events));
    const result = checkEnd();

    UI.showReport(`DEVELOPMENTS — DAY ${day}, TURN ${G.turn}`, events, () => {
      if (result) { finish(result); return; }
      nextTurn();
    });
  }

  function nextTurn() {
    G.turn++;
    if (G.turn > G.maxTurns) { finish(buildResult('stalemate', 'time')); return; }

    // replenish
    G.res.fighters = Math.min(G.res.fighters + 2, G.caps.fighters);
    G.res.cruise = Math.min(G.res.cruise + 2, G.caps.cruise);
    if (G.turn % 3 === 0) G.res.stealth = Math.min(G.res.stealth + 1, G.caps.stealth);

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
    if (G.escalation >= 10) return buildResult('defeat', 'war');
    if (G.approval <= 20) return buildResult('defeat', 'impeachment');
    if (G.hormuzClosedTurns >= 4 || G.oil >= 220) return buildResult('defeat', 'economy');
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
      deal: 'CEASEFIRE — TEHRAN COMES TO THE TABLE',
      war: 'DEFEAT — REGIONAL WAR',
      impeachment: 'DEFEAT — PRESIDENCY COLLAPSES',
      economy: 'DEFEAT — ECONOMIC COLLAPSE',
      time: 'CRISIS FROZEN — NO RESOLUTION',
    };
    const verdicts = {
      deal: 'VICTORY. Iran\'s nuclear program is degraded and Tehran has accepted negotiations under a ceasefire framework.',
      war: 'The escalation ladder ran out of rungs. A general war has begun across the region — mobilization, a draft debate in Congress, and a conflict whose end no one can see.',
      impeachment: 'With approval in ruins, your own party abandoned you. The House opened impeachment proceedings over the handling of the crisis; the presidency is effectively over.',
      economy: 'The prolonged closure of Hormuz broke the global economy. Fuel rationing, a market crash, and allied governments falling — the crisis was lost at the gas pump.',
      time: 'Ten days of crisis ended in an uneasy, armed standoff. Objectives were not achieved; the problem is handed to the next news cycle, and perhaps the next president.',
    };
    const narratives = {
      deal: `Backchannel talks in Muscat produced a framework: verified enrichment freeze against phased sanctions relief.` +
        (G.hostageCrisis ? ' The final sticking point was the captured operators — their release is written into the first annex.' : '') +
        ` It took ${G.turn} turns and ${G.casualties.us} American lives.`,
      war: 'Historians will argue about which strike was one too many.',
      impeachment: 'The objectives, whatever their merits, could not survive the politics.',
      economy: 'Military dominance meant little once the strait stayed shut.',
      time: `The nuclear program stands at ${deg}% degraded. The fleet remains on station. Nothing is settled.`,
    };

    const grades = [
      ['MILITARY SUCCESS', milGrade, `Nuclear program ${deg}% degraded · ${G.stats.destroyed} targets destroyed · ${G.stats.aircraftLost} aircraft lost`],
      ['AMERICAN LIVES', livesGrade, `${G.casualties.us} US service members killed`],
      ['DIPLOMATIC STANDING', worldGrade, `World opinion ${Math.round(G.world)}/100`],
      ['ECONOMIC DAMAGE', econGrade, `Peak oil price $${Math.round(G.stats.peakOil)}/bbl`],
    ];
    if (G.raid !== 'none') {
      grades.splice(1, 0, G.raid === 'success'
        ? ['SPECIAL OPERATIONS', 'A', 'Leadership decapitation raid succeeded — regime command chain shattered']
        : ['SPECIAL OPERATIONS', 'F', G.hostageCrisis
          ? 'Leadership raid failed — operators captured and paraded on Iranian state TV'
          : 'Leadership raid failed — the task force was lost on Iranian soil']);
    }

    G.over = true;
    return {
      kind, title: titles[reason], verdict: verdicts[reason], narrative: narratives[reason],
      grades,
      stats: {
        esc: G.escalation, approval: G.approval, oil: G.oil,
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
    MapView.setTargetClickHandler((t) => {
      if (G.over) return;
      if (t.status === 'destroyed') return;
      UI.openStrikeModal(G, t);
    });
    if (resume) {
      // rebuild map state from the restored targets/Hormuz status
      for (const t of TARGETS) MapView.updateTarget(t);
      MapView.setHormuz(G.hormuz);
      UI.setTicker(IranAI.headlines(G, [{ title: 'SITUATION ROOM RECONVENES — CRISIS ONGOING' }]));
    } else {
      UI.setTicker(IranAI.headlines(G, [{ title: 'USS MILIUS STRUCK IN STRAIT OF HORMUZ — SEVEN SAILORS DEAD' }]));
    }
    UI.renderAll(G);
  }

  function restoreAndStart(data) {
    for (const [f, v] of Object.entries(data.fields)) G[f] = v;
    for (const t of TARGETS) t.status = data.targets[t.id] || 'intact';
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
      if (!confirm('Abandon the current crisis? The save will be erased.')) return;
      Save.clear();
      window.location.reload();
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  return { computeStrike, executeStrike, doDiplo, endTurn, afterAction, G };
})();
