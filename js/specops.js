// ============================================================
// specops.js — special forces: ISR prep + leadership raid
// ============================================================
// One Tier-1 task force for the whole game (G.res.specops, never
// replenished). The raid is not a strike: no package math, no strike
// animation — a deniable insert resolved in a single high-stakes roll.

const SpecOps = (() => {
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  const ISR_CAP = 2;

  // ---- odds ----
  // Base is deliberately low: this is the best-protected target in the
  // country. Patience (ISR prep) and prior strikes on air defense and
  // command nodes are what make it survivable.
  function odds(G) {
    const parts = [];
    let p = 0.25;
    parts.push(['Baseline — hardest target in Iran', 0.25]);

    if (G.isrPrep > 0) {
      const bonus = Math.min(G.isrPrep, ISR_CAP) * 0.12;
      p += bonus;
      parts.push([`ISR preparation ×${Math.min(G.isrPrep, ISR_CAP)}`, bonus]);
    }

    let adBonus = 0;
    for (const t of TARGETS) {
      if (t.type !== 'airdefense') continue;
      if (t.status === 'destroyed') adBonus += 0.06;
      else if (t.status === 'damaged') adBonus += 0.03;
    }
    if (adBonus > 0) { p += adBonus; parts.push(['Air defenses degraded', adBonus]); }

    const hq = TARGETS.find(t => t.id === 'irgc-hq');
    if (hq.status === 'destroyed') { p += 0.10; parts.push(['IRGC command destroyed', 0.10]); }
    else if (hq.status === 'damaged') { p += 0.05; parts.push(['IRGC command damaged', 0.05]); }

    p = clamp(p, 0.05, 0.75);
    return { p, parts };
  }

  // ---- sidebar panel ----
  function renderPanel(G) {
    const status = $('specops-status');
    const box = $('specops-buttons');
    if (!box) return;

    if (G.raid !== 'none') {
      status.textContent = G.raid === 'success' ? '— MISSION COMPLETE' : '— TASK FORCE LOST';
      status.style.color = G.raid === 'success' ? 'var(--green)' : 'var(--red)';
      box.innerHTML = `<div class="dim" style="font-size:11px">${
        G.raid === 'success'
          ? 'The task force is out. Its work echoes through everything Tehran does now.'
          : 'There will be no second attempt. The families have been notified.'}</div>`;
      return;
    }

    status.textContent = '';
    const { p } = odds(G);
    const isrDone = G.isrPrep >= ISR_CAP;
    const isrBlocked = G.diploUsed || isrDone;
    const buttons = [
      {
        id: 'isr', name: 'ISR prep — shadow the leadership',
        desc: isrDone
          ? 'Pattern-of-life picture is as good as it gets.'
          : G.diploUsed
            ? 'Uses this turn\'s action slot — already spent.'
            : `Spend this turn's action slot building the intel picture. Next raid +12% (${G.isrPrep}/${ISR_CAP} used).`,
        disabled: isrBlocked,
      },
      {
        id: 'raid', name: 'LEADERSHIP DECAPITATION — launch raid',
        desc: `One task force, one attempt, ever. Current success estimate: ${Math.round(p * 100)}%. Win or lose, the world will know — and Tehran will answer.`,
        disabled: G.res.specops < 1,
        danger: true,
      },
    ];
    box.innerHTML = buttons.map(b =>
      `<button data-specops="${b.id}" ${b.disabled ? 'disabled' : ''} class="${b.danger ? 'specops-danger' : ''}">` +
      `${b.name}<span class="diplo-desc">${b.desc}</span></button>`).join('');
    for (const btn of box.querySelectorAll('button')) {
      btn.addEventListener('click', () => btn.dataset.specops === 'isr' ? doIsrPrep() : openModal());
    }
  }

  // ---- ISR prep (spends the turn's diplomatic/action slot) ----
  function doIsrPrep() {
    const G = Game.G;
    if (G.over || G.diploUsed || G.isrPrep >= ISR_CAP) return;
    G.diploUsed = true;
    G.isrPrep++;
    AudioSys.play('cable');
    UI.renderAll(G);
    UI.showReport('SPECIAL OPERATIONS — ISR TASKING', [{
      cls: 'friendly', title: 'Pattern-of-life surveillance expanded',
      text: 'National assets are retasked against the leadership\'s movements, communications, and security detail rotations. The picture sharpens. If the raid ever goes, this is what brings the operators home.',
    }], () => Game.afterAction());
  }

  // ---- mission modal ----
  function openModal() {
    const G = Game.G;
    if (G.over || G.res.specops < 1 || G.raid !== 'none') return;
    const { p, parts } = odds(G);
    const pct = Math.round(p * 100);
    const sCls = pct >= 60 ? 'est-good' : pct >= 40 ? 'est-warn' : 'est-bad';
    let html = parts.map(([label, v]) =>
      `${label}: <span class="est-good">+${Math.round(v * 100)}%</span><br>`).join('');
    html += `EST. PROBABILITY OF SUCCESS: <span class="${sCls}">${pct}%</span><br>` +
      `<span class="est-bad">Attempting the raid costs world opinion — success or failure.</span><br>` +
      `<span class="est-bad">On failure, operators will be killed or captured on Iranian soil.</span>`;
    $('specops-estimate').innerHTML = html;
    $('specops-modal').classList.remove('hidden');
  }

  function closeModal() { $('specops-modal').classList.add('hidden'); }

  // ---- resolution ----
  function executeRaid() {
    const G = Game.G;
    if (G.over || G.res.specops < 1 || G.raid !== 'none') return;
    closeModal();

    const { p } = odds(G);
    G.res.specops = 0;
    G.raidThisTurn = true;

    // the insert is an act the world sees, whatever happens on the objective
    G.world = clamp(G.world - 4, 0, 100);
    AudioSys.play('launch');
    UI.renderAll(G);

    const events = [];

    if (Math.random() < p) {
      // ---- SUCCESS ----
      G.raid = 'success';
      G.approval = clamp(G.approval + 10, 0, 100);
      G.regimeChaosTurns = 3;
      events.push({
        cls: 'friendly', title: 'OBJECTIVE SECURED — LEADERSHIP TARGET ELIMINATED',
        text: 'The task force is feet-dry, feet-wet, and aboard the recovery ship before Tehran state media finishes denying it. The top of the regime\'s command chain is gone. Retaliation orders are not being issued — no one is sure who has the authority to issue them.',
        dApproval: 10,
      });

      if (Math.random() < 0.45) {
        const c = rand(4, 10);
        G.casualties.us += c;
        G.oil += 8;
        events.push({
          cls: 'iran', title: 'Leaderless IRGC units lash out',
          text: `Before the paralysis sets in, a rogue missile brigade empties its launchers at US positions on standing orders no one is alive to countermand. ${c} Americans are dead in a retaliation nobody in Tehran ordered.`,
          casualties: c, dOil: 8,
        });
      }

      if (Math.random() < 0.5) {
        G.negotiationMomentum += 0.15;
        events.push({
          cls: 'world', title: 'Succession faction signals interest in an off-ramp',
          text: 'CIA assesses the pragmatists are consolidating control. Muscat reports the first serious feeler of the crisis: they want to know what a ceasefire would cost. The window you wanted may be opening.',
        });
      } else {
        G.regimeErratic = true;
        events.push({
          cls: 'iran', title: 'Hardline remnant seizes the security organs',
          text: 'CIA assesses the wrong faction won the scramble. What is left of the regime is erratic, paranoid, and un-deterred — diplomatic contact will be harder, not easier, until the dust settles. Decapitation cuts both ways.',
        });
      }
    } else {
      // ---- FAILURE ----
      G.raid = 'failed';
      G.approval = clamp(G.approval - 12, 0, 100);
      G.world = clamp(G.world - 8, 0, 100);
      const captured = Math.random() < 0.5;
      const c = captured ? rand(2, 4) : rand(5, 8);
      G.casualties.us += c;
      AudioSys.play('aircraftLost', 700);

      if (captured) {
        G.hostageCrisis = true;
        events.push({
          cls: 'iran', title: 'RAID COMPROMISED — OPERATORS CAPTURED',
          text: `The assault element was ambushed inside the compound perimeter. ${c} operators are dead; the survivors are in IRGC custody. Within hours, Iranian state TV airs footage of captured Americans and wrecked stealth helicopters. It is the worst propaganda disaster since Desert One — and now Tehran holds hostages.`,
          casualties: c, dApproval: -12, dWorld: -12,
        });
      } else {
        events.push({
          cls: 'iran', title: 'RAID FAILED — TASK FORCE LOST',
          text: `The compound was a trap — the pattern-of-life picture was wrong, or leaked. ${c} operators died fighting to the last on Iranian soil. State TV runs the wreckage on a loop. Allies are asking what else Washington hasn't told them.`,
          casualties: c, dApproval: -12, dWorld: -12,
        });
      }
    }

    UI.renderAll(G);
    UI.showReport('SPECIAL OPERATIONS — MISSION DEBRIEF', events, () => Game.afterAction());
  }

  // ---- wiring ----
  function init() {
    $('btn-confirm-raid').addEventListener('click', executeRaid);
  }

  return { init, renderPanel, odds };
})();
