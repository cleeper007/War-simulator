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
    $('casualty-value').className = 'stat-value big ' + (G.casualties.us > 110 ? 'crit' : G.casualties.us > 60 ? 'warn' : '');

    AudioSys.alertCheck(G);
  }

  // ---- sidebar ----
  function renderObjectives(G) {
    const deg = G.nukeDegraded();
    const items = [
      { text: `Destroy nuclear program (${deg}% / 100%)`, done: deg >= 100 },
      { text: 'Break Iran\'s war machine (missiles · navy · IRGC command)', done: G.iranBroken() },
      { text: `Limit US casualties (${G.casualties.us} / 150 tolerated)`, done: null },
      { text: `Keep Strait of Hormuz open`, done: null },
    ];
    $('objectives-list').innerHTML = items.map(i =>
      `<li class="${i.done === true ? 'done' : 'pending'}">${i.text}</li>`).join('');
  }

  function renderResources(G) {
    const rows = [
      ['Fighter sorties', G.res.fighters, G.caps.fighters],
      ['Cruise missiles (TLAM)', G.res.cruise, G.caps.cruise],
      ['B-2 missions (GBU-57)', G.res.stealth, G.caps.stealth],
      ['SOF task force (Tier 1)', G.res.specops, G.caps.specops],
    ];
    let html = rows.map(([n, v, cap]) =>
      `<div class="res-row"><span>${n}</span><span class="res-count">${v} / ${cap}</span></div>`).join('');
    if (G.missions.length) {
      html += `<div class="res-row" style="margin-top:6px"><span style="color:var(--amber)">MISSIONS IN FLIGHT</span></div>`;
      html += G.missions.map(m => {
        const t = TARGETS.find(x => x.id === m.targetId);
        return `<div class="res-row"><span class="dim">→ ${t.short}</span>` +
          `<span class="res-count">${m.eta > 1 ? `TOT ${m.eta} turns` : 'TOT this turn'}</span></div>`;
      }).join('');
    }
    $('resources-list').innerHTML = html;
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
        id: 'address', name: 'Address the nation',
        desc: G.addressCooldown > 0 ? `Available in ${G.addressCooldown} turn(s).` : 'Rally the public. Approval +.',
        disabled: G.addressCooldown > 0,
      },
    ];
    $('diplo-buttons').innerHTML = actions.map(a =>
      `<button data-diplo="${a.id}" ${used || a.disabled ? 'disabled' : ''}>` +
      `${a.name}<span class="diplo-desc">${a.desc}</span></button>`).join('');
    for (const btn of $('diplo-buttons').querySelectorAll('button')) {
      btn.addEventListener('click', () => Game.doDiplo(btn.dataset.diplo));
    }
  }

  function renderSidebar(G) {
    renderObjectives(G);
    renderResources(G);
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
    target.packages.forEach((pkg, i) => {
      const have = G.res[pkg.asset === 'fighter' ? 'fighters' : pkg.asset] ?? 0;
      const ok = have >= pkg.qty;
      const div = document.createElement('div');
      div.className = 'pkg-option' + (ok ? '' : ' unavailable');
      div.innerHTML = `<span class="pkg-name">${pkg.label}</span>` +
        `<span class="pkg-detail">Requires ${pkg.qty}× ${ASSET_NAMES[pkg.asset].toLowerCase()} — available: ${have}</span>`;
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
    const tot = pkg.asset === 'stealth'
      ? 'TIME ON TARGET: <span class="est-warn">2 turns — transit from Diego Garcia</span>'
      : 'TIME ON TARGET: <span class="est-good">end of this turn — BDA with the battle report</span>';
    let html =
      `EST. PROBABILITY OF KILL: <span class="${sCls}">${pct}%</span><br>` +
      `${tot}<br>` +
      `WORLD OPINION: <span class="est-warn">${target.world}</span><br>`;
    if (est.adPenalty > 0.01) {
      html += `<span class="est-warn">Air defenses degrade this package (−${Math.round(est.adPenalty * 100)}%).</span> `;
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
    html += `<p class="dim">Final: ` +
      `approval ${Math.round(result.stats.approval)}% · oil $${Math.round(result.stats.oil)} · ` +
      `${result.stats.casualties} US dead · ${result.stats.destroyed} targets destroyed · ` +
      `${result.stats.turns} turns</p>`;
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
