// ============================================================
// map.js — SVG map rendering, pan/zoom, target icons, strike FX
// ============================================================

const MapView = (() => {
  let svg, world, tooltip;
  let view = { x: 0, y: 0, k: 1 };
  let panning = false, panStart = null;
  let forwardOn = false; // forward-basing layer starts hidden

  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // Real geography lives in geodata.js (COUNTRY_PATHS, Natural Earth 50m).
  // Label anchors are hand-placed in the same projected coordinate space.
  const COUNTRY_LABELS = [
    { name: 'IRAN', x: 533, y: 272 },
    { name: 'IRAQ', x: 160, y: 276 },
    { name: 'SAUDI ARABIA', x: 233, y: 585 },
    { name: 'TURKMENISTAN', x: 633, y: 49 },
    { name: 'AFGHANISTAN', x: 917, y: 215 },
    { name: 'PAKISTAN', x: 933, y: 453 },
    { name: 'OMAN', x: 627, y: 642 },
    { name: 'UAE', x: 563, y: 600 },
    { name: 'TURKEY', x: 67, y: 34 },
    { name: 'SYRIA', x: 33, y: 170 },
  ];

  const SEAS = [
    { name: 'PERSIAN GULF', x: 390, y: 457 },
    { name: 'GULF OF OMAN', x: 667, y: 551 },
    { name: 'ARABIAN SEA', x: 833, y: 668 },
    { name: 'CASPIAN SEA', x: 423, y: 38 },
  ];

  function el(tag, attrs = {}) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  }

  function targetIcon(t) {
    const g = el('g', { class: `target intact`, id: `tgt-${t.id}`, transform: `translate(${t.x},${t.y})` });
    // invisible filled circle so the whole icon (not just strokes) is clickable
    g.appendChild(el('circle', { r: 13, fill: 'transparent' }));
    g.appendChild(el('circle', { class: 'tgt-ring', r: 9 }));
    // core shape varies by type
    let core;
    switch (t.type) {
      case 'nuclear':
        core = el('path', { class: 'tgt-core', d: 'M0,-5 L4.3,2.5 L-4.3,2.5 Z' }); break; // triangle
      case 'airdefense':
        core = el('rect', { class: 'tgt-core', x: -3.5, y: -3.5, width: 7, height: 7, transform: 'rotate(45)' }); break;
      case 'missile':
        core = el('path', { class: 'tgt-core', d: 'M0,-5.5 L2.5,3 L0,1.2 L-2.5,3 Z' }); break;
      case 'naval':
        core = el('path', { class: 'tgt-core', d: 'M-4,-1 L4,-1 L2,3 L-2,3 Z M-0.8,-5 L0.8,-5 L0.8,-1 L-0.8,-1 Z' }); break;
      case 'oil':
        core = el('circle', { class: 'tgt-core', r: 3.5 }); break;
      default:
        core = el('rect', { class: 'tgt-core', x: -3.5, y: -3.5, width: 7, height: 7 });
    }
    g.appendChild(core);
    const label = el('text', { y: 20 });
    label.textContent = t.short;
    g.appendChild(label);
    return g;
  }

  function assetIcon(a) {
    const g = el('g', { class: 'us-asset', id: `asset-${a.id}`, transform: `translate(${a.x},${a.y})` });
    let icon;
    if (a.kind === 'carrier') {
      icon = el('path', { class: 'asset-icon', d: 'M-7,-2 L7,-2 L5,3 L-5,3 Z M-2,-6 L2,-6 L2,-2 L-2,-2 Z' });
    } else if (a.kind === 'bomber') {
      icon = el('path', { class: 'asset-icon', d: 'M0,-4 L8,3 L2,2 L0,5 L-2,2 L-8,3 Z' });
    } else if (a.kind === 'logistics') {
      icon = el('path', { class: 'asset-icon', d: 'M-4.5,-4.5 L4.5,-4.5 L4.5,4.5 L-4.5,4.5 Z M-4.5,-1 L4.5,-1 L4.5,1 L-4.5,1 Z' });
    } else if (a.kind === 'naval') {
      icon = el('path', { class: 'asset-icon', d: 'M0,-5.5 L4.5,0 L0,5.5 L-4.5,0 Z' });
    } else {
      icon = el('path', { class: 'asset-icon', d: 'M-5,4 L0,-5 L5,4 Z M-7,4 L7,4 L7,5.5 L-7,5.5 Z' });
    }
    g.appendChild(icon);
    const label = el('text', { y: 17 });
    label.textContent = a.short;
    g.appendChild(label);
    return g;
  }

  function render() {
    svg = document.getElementById('map');
    world = document.getElementById('world');
    tooltip = document.getElementById('tooltip');
    world.innerHTML = '';

    // water backdrop
    world.appendChild(el('rect', { x: -2000, y: -2000, width: 5000, height: 5000, fill: 'var(--water)' }));

    // countries (real borders; the Caspian shows as water between them)
    for (const c of COUNTRY_PATHS) {
      const p = el('path', { class: `country ${c.cls || ''}`, d: c.d, 'fill-rule': 'evenodd' });
      world.appendChild(p);
    }
    for (const c of COUNTRY_LABELS) {
      const t = el('text', { class: 'country-label', x: c.x, y: c.y });
      t.textContent = c.name;
      world.appendChild(t);
    }

    for (const s of SEAS) {
      const t = el('text', { class: 'sea-label', x: s.x, y: s.y });
      t.textContent = s.name;
      world.appendChild(t);
    }

    // Hormuz status indicator
    const hz = el('g', { id: 'hormuz-indicator', transform: `translate(${HORMUZ_POS.x},${HORMUZ_POS.y})` });
    hz.appendChild(el('circle', { id: 'hormuz-dot', r: 5, class: 'hz-open' }));
    const hzLabel = el('text', { y: 16, 'font-size': 9, id: 'hormuz-label', class: 'hz-open' });
    hzLabel.textContent = 'HORMUZ: OPEN';
    hz.appendChild(hzLabel);
    world.appendChild(hz);

    // forward basing & long-range fires layer (toggled off by default so the
    // map isn't overcrowded — the BASES button in the map header shows it)
    const fwd = el('g', { id: 'forward-layer', class: forwardOn ? '' : 'hidden' });
    const forwardAssets = US_ASSETS.filter(a => a.forward);
    for (const a of forwardAssets) {
      if (!a.atacms) continue;
      // rings first so every base icon draws above them
      for (const r of MISSILE_RANGES) {
        const px = r.km * KM_TO_MAP;
        fwd.appendChild(el('circle', { class: `range-ring ${r.cls}`, cx: a.x, cy: a.y, r: px }));
        const lbl = el('text', { class: 'ring-label', x: a.x, y: a.y - px + 9 });
        lbl.textContent = r.name;
        fwd.appendChild(lbl);
      }
    }
    for (const a of forwardAssets) {
      const g = assetIcon(a);
      attachTooltip(g, () => `<span class="tt-name">${a.name}</span><br>${a.desc}` +
        `<br><em style="color:var(--blue)">${a.sortie ? 'Fixed-wing sorties: YES' : 'Fixed-wing sorties: NO'}` +
        ` · ${a.atacms ? 'ATACMS/PrSM: YES' : 'ATACMS/PrSM: NO'}</em>`);
      fwd.appendChild(g);
    }
    world.appendChild(fwd);

    // strike FX layer sits under icons' labels but above land
    world.appendChild(el('g', { id: 'fx-layer' }));

    // US assets
    for (const a of US_ASSETS) {
      if (a.forward) continue; // rendered on the forward layer above
      const g = assetIcon(a);
      attachTooltip(g, () => `<span class="tt-name">${a.name}</span><br>${a.desc}`);
      world.appendChild(g);
    }

    // targets
    for (const t of TARGETS) {
      const g = targetIcon(t);
      attachTooltip(g, () => {
        const st = t.status || 'intact';
        const stColor = st === 'intact' ? 'var(--red)' : st === 'damaged' ? 'var(--amber)' : 'var(--dim)';
        return `<span class="tt-name">${t.name}</span><br>` +
          `<span class="tt-status" style="color:${stColor}">STATUS: ${st}</span><br>${t.desc}` +
          (st !== 'destroyed' ? `<br><em style="color:var(--blue)">Click to plan strike</em>` : '');
      });
      g.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof onTargetClick === 'function') onTargetClick(t);
      });
      world.appendChild(g);
    }

    initPanZoom();
    applyView();
  }

  // callback set by game.js
  let onTargetClick = null;
  function setTargetClickHandler(fn) { onTargetClick = fn; }

  function attachTooltip(node, htmlFn) {
    node.addEventListener('mousemove', (e) => {
      tooltip.innerHTML = htmlFn();
      tooltip.classList.remove('hidden');
      const rect = document.getElementById('map-container').getBoundingClientRect();
      let tx = e.clientX - rect.left + 16, ty = e.clientY - rect.top + 12;
      if (tx + 250 > rect.width) tx -= 270;
      if (ty + 120 > rect.height) ty -= 130;
      tooltip.style.left = tx + 'px';
      tooltip.style.top = ty + 'px';
    });
    node.addEventListener('mouseleave', () => tooltip.classList.add('hidden'));
  }

  // ---- pan & zoom ----
  function applyView() {
    world.setAttribute('transform', `translate(${view.x},${view.y}) scale(${view.k})`);
  }

  function zoomAt(cx, cy, factor) {
    const nk = Math.min(5, Math.max(0.6, view.k * factor));
    const f = nk / view.k;
    view.x = cx - f * (cx - view.x);
    view.y = cy - f * (cy - view.y);
    view.k = nk;
    applyView();
  }

  // convert client coords to svg user-space coords
  function toSvgPoint(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function initPanZoom() {
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = toSvgPoint(e);
      zoomAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });

    svg.addEventListener('mousedown', (e) => {
      panStart = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
    });
    window.addEventListener('mousemove', (e) => {
      if (!panStart) return;
      const dx = e.clientX - panStart.px, dy = e.clientY - panStart.py;
      // ignore sub-threshold jitter so clicks on targets aren't swallowed by panning
      if (!panning && Math.hypot(dx, dy) < 4) return;
      panning = true;
      svg.classList.add('panning');
      // scale mouse delta from screen px to svg units
      const ctm = svg.getScreenCTM();
      view.x = panStart.vx + dx / ctm.a;
      view.y = panStart.vy + dy / ctm.d;
      applyView();
    });
    window.addEventListener('mouseup', () => {
      panning = false;
      panStart = null;
      svg.classList.remove('panning');
    });

    document.getElementById('zoom-in').addEventListener('click', () => zoomAt(500, 350, 1.3));
    document.getElementById('zoom-out').addEventListener('click', () => zoomAt(500, 350, 1 / 1.3));
    document.getElementById('zoom-reset').addEventListener('click', () => {
      view = { x: 0, y: 0, k: 1 };
      applyView();
    });
    document.getElementById('toggle-bases').addEventListener('click', () => {
      forwardOn = !forwardOn;
      document.getElementById('forward-layer').classList.toggle('hidden', !forwardOn);
      document.getElementById('toggle-bases').classList.toggle('layer-on', forwardOn);
    });
  }

  // ---- visual state updates ----
  function updateTarget(t) {
    const g = document.getElementById(`tgt-${t.id}`);
    if (!g) return;
    g.setAttribute('class', `target ${t.status || 'intact'}`);
  }

  function setHormuz(status) {
    const dot = document.getElementById('hormuz-dot');
    const label = document.getElementById('hormuz-label');
    const cls = status === 'OPEN' ? 'hz-open' : status === 'CONTESTED' ? 'hz-contested' : 'hz-closed';
    dot.setAttribute('class', cls + (status !== 'OPEN' ? ' pulsing' : ''));
    label.setAttribute('class', cls);
    label.textContent = `HORMUZ: ${status}`;
  }

  function flashAsset(assetId) {
    const g = document.getElementById(`asset-${assetId}`);
    if (!g) return;
    g.classList.add('under-attack', 'pulsing');
    setTimeout(() => g.classList.remove('under-attack', 'pulsing'), 4000);
  }

  // ---- impact / intercept burst ----
  function burst(x, y, cls, maxR) {
    const fx = document.getElementById('fx-layer');
    const c = el('circle', { class: cls, cx: x, cy: y, r: 1.5 });
    fx.appendChild(c);
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / 450);
      c.setAttribute('r', 1.5 + p * maxR);
      c.setAttribute('opacity', 0.9 * (1 - p));
      if (p < 1) { requestAnimationFrame(step); return; }
      c.remove();
    }
    requestAnimationFrame(step);
  }

  // ---- in-flight status panel (top-left of the map) ----
  function fsPanel() { return document.getElementById('flight-status'); }

  function fsOpen(header) {
    const panel = fsPanel();
    panel.classList.remove('hidden');
    const entry = document.createElement('div');
    entry.className = 'flight-entry';
    entry.innerHTML = `<div class="fs-head">${header}</div><div class="fs-lines"></div>`;
    panel.appendChild(entry);
    return entry;
  }

  function fsLine(entry, text, problem) {
    const div = document.createElement('div');
    div.className = 'fs-line' + (problem ? ' fs-problem' : '');
    div.textContent = '> ' + text;
    entry.querySelector('.fs-lines').appendChild(div);
    const lines = entry.querySelectorAll('.fs-line');
    if (lines.length > 4) lines[0].remove();
  }

  function fsClose(entry, delay) {
    setTimeout(() => {
      entry.remove();
      if (!fsPanel().children.length) fsPanel().classList.add('hidden');
    }, delay || 0);
  }

  // ---- flight animation: aircraft flies base → target with status updates ----
  function nearestSortieBase(target, wantCarrier) {
    let best = null, bd = Infinity;
    for (const a of US_ASSETS) {
      if (!a.sortie) continue;
      if ((a.kind === 'carrier') !== wantCarrier) continue;
      const d = Math.hypot(a.x - target.x, a.y - target.y);
      if (d < bd) { bd = d; best = a; }
    }
    return best;
  }

  function animateFlight(assetType, target, done) {
    const stealth = assetType === 'stealth';
    const ft = stealth ? { type: 'B-2', cs: 'SPIRIT' } : pick(FIGHTER_TYPES);
    const origin = stealth ? US_ASSETS.find(a => a.id === 'diego')
      : nearestSortieBase(target, ft.from === 'carrier');
    const callsign = `${ft.cs} ${rand(1, 9)}${rand(1, 9)}`;
    const baseName = origin.id === 'diego' ? 'DIEGO GARCIA' : origin.short;

    const fx = document.getElementById('fx-layer');
    const x1 = origin.x, y1 = origin.y, x2 = target.x, y2 = target.y;
    const mx = (x1 + x2) / 2 + (y1 - y2) * 0.15;
    const my = (y1 + y2) / 2 + (x2 - x1) * 0.15;
    const path = el('path', { class: 'flight-path', d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}` });
    fx.appendChild(path);
    const icon = el('path', {
      class: 'flight-icon' + (stealth ? ' stealth' : ''),
      d: stealth ? 'M0,-4 L8,3 L2,2 L0,5 L-2,2 L-8,3 Z' : 'M0,-5 L3,4 L0,2.2 L-3,4 Z',
    });
    fx.appendChild(icon);

    const entry = fsOpen(`${callsign} · ${ft.type} — ${baseName} → ${target.short}`);
    const subs = { '{cs}': callsign, '{base}': baseName, '{tgt}': target.short };
    const fill = (s) => s.replace(/\{cs\}|\{base\}|\{tgt\}/g, (m) => subs[m]);
    const evs = FLIGHT_EVENTS
      .filter(e => !e.only || e.only === (stealth ? 'stealth' : 'fighter'))
      .sort((a, b) => a.at - b.at);
    let evIdx = 0;
    // prog runs 0→1 on ingress, then 1→2 on the egress leg home
    const fireUpTo = (prog) => {
      while (evIdx < evs.length && evs[evIdx].at <= prog) {
        const e = evs[evIdx++];
        if (e.kind === 'problem' && Math.random() > e.chance) continue;
        fsLine(entry, fill(pick(e.msgs)), e.kind === 'problem');
      }
    };

    const total = path.getTotalLength();
    const setIcon = (len, rev) => {
      const pa = path.getPointAtLength(Math.max(0, len - 1.5));
      const pb = path.getPointAtLength(Math.min(total, len + 1.5));
      const pt = path.getPointAtLength(len);
      const ang = Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180 / Math.PI + (rev ? 270 : 90);
      icon.setAttribute('transform', `translate(${pt.x},${pt.y}) rotate(${ang})`);
    };

    const dur = FLIGHT_DUR[assetType];
    const t0 = performance.now();
    function ingress(now) {
      const p = Math.min(1, (now - t0) / dur);
      setIcon(total * p, false);
      fireUpTo(p);
      if (p < 1) { requestAnimationFrame(ingress); return; }
      // impact flash; BDA resolves now — the egress leg is purely visual
      const flash = el('circle', { class: 'impact-flash', cx: x2, cy: y2, r: 2 });
      fx.appendChild(flash);
      const f0 = performance.now();
      function flashStep(now2) {
        const fp = Math.min(1, (now2 - f0) / 500);
        flash.setAttribute('r', 2 + fp * 22);
        flash.setAttribute('opacity', 0.9 * (1 - fp));
        if (fp < 1) { requestAnimationFrame(flashStep); return; }
        flash.remove();
      }
      requestAnimationFrame(flashStep);
      if (done) done();
      egress();
    }
    function egress() {
      const e0 = performance.now();
      const edur = 1800;
      function step(now) {
        const ep = Math.min(1, (now - e0) / edur);
        fireUpTo(1 + ep);
        setIcon(total * (1 - ep * 0.45), true);
        icon.setAttribute('opacity', 1 - ep);
        path.setAttribute('opacity', 0.5 * (1 - ep));
        if (ep < 1) { requestAnimationFrame(step); return; }
        icon.remove();
        path.remove();
        fsClose(entry, 2200);
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(ingress);
  }

  // ---- strike animation dispatcher: cruise keeps the fast projectile,
  // fighters and B-2s fly the full route with status updates ----
  function animateStrike(assetType, target, done) {
    if (assetType !== 'cruise') { animateFlight(assetType, target, done); return; }
    const originAsset = US_ASSETS.find(a => a.id === STRIKE_ORIGINS[assetType]);
    const fx = document.getElementById('fx-layer');
    const x1 = originAsset.x, y1 = originAsset.y, x2 = target.x, y2 = target.y;
    // arc control point
    const mx = (x1 + x2) / 2 + (y1 - y2) * 0.18;
    const my = (y1 + y2) / 2 + (x2 - x1) * 0.18;
    const path = el('path', { class: 'strike-path', d: `M${x1},${y1} Q${mx},${my} ${x2},${y2}` });
    fx.appendChild(path);
    const proj = el('circle', { class: 'strike-proj', r: 3 });
    fx.appendChild(proj);

    const total = path.getTotalLength();
    const dur = 1000;
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      const pt = path.getPointAtLength(total * p);
      proj.setAttribute('cx', pt.x);
      proj.setAttribute('cy', pt.y);
      if (p < 1) { requestAnimationFrame(step); return; }
      proj.remove();
      // impact flash
      const flash = el('circle', { class: 'impact-flash', cx: x2, cy: y2, r: 2 });
      fx.appendChild(flash);
      const f0 = performance.now();
      function flashStep(now2) {
        const fp = Math.min(1, (now2 - f0) / 500);
        flash.setAttribute('r', 2 + fp * 22);
        flash.setAttribute('opacity', 0.9 * (1 - fp));
        if (fp < 1) { requestAnimationFrame(flashStep); return; }
        flash.remove();
        path.remove();
        if (done) done();
      }
      requestAnimationFrame(flashStep);
    }
    requestAnimationFrame(step);
  }

  // ---- Iranian counterattacks: ballistic/cruise missiles arc in fast,
  // Shahed drones swarm slowly; both can be intercepted short of the base ----
  function iranOrigin(kind, tx, ty) {
    // destroyed missile-base targets stop launching (tgtId links site → target)
    const alive = IRAN_LAUNCH_SITES[kind].filter(s => {
      if (!s.tgtId) return true;
      const t = TARGETS.find(x => x.id === s.tgtId);
      return t && t.status !== 'destroyed';
    });
    const pool = alive.length ? alive : IRAN_LAUNCH_SITES[kind].slice(-1);
    let best = pool[0], bd = Infinity;
    for (const s of pool) {
      const d = Math.hypot(s.x - tx, s.y - ty);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  function launchMissiles(base, count, cb) {
    const fx = document.getElementById('fx-layer');
    const o = iranOrigin('missile', base.x, base.y);
    let left = count;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const jx = base.x + rand(-8, 8), jy = base.y + rand(-6, 6);
        const mx = (o.x + jx) / 2 + (o.y - jy) * 0.35 + rand(-15, 15);
        const my = (o.y + jy) / 2 + (jx - o.x) * 0.35 + rand(-15, 15);
        const path = el('path', { class: 'iran-missile-path', d: `M${o.x},${o.y} Q${mx},${my} ${jx},${jy}` });
        fx.appendChild(path);
        const m = el('circle', { class: 'iran-missile', r: 2.2 });
        fx.appendChild(m);
        const total = path.getTotalLength();
        const dur = 900 + rand(0, 300);
        // terminal-phase intercept by base air defenses (visual only)
        const interceptAt = Math.random() < 0.35 ? 0.78 + Math.random() * 0.12 : 2;
        const t0 = performance.now();
        const end = () => {
          m.remove();
          path.remove();
          if (--left === 0) cb();
        };
        function step(now) {
          const p = Math.min(1, (now - t0) / dur);
          const pt = path.getPointAtLength(total * p);
          m.setAttribute('cx', pt.x);
          m.setAttribute('cy', pt.y);
          if (p >= interceptAt) { burst(pt.x, pt.y, 'intercept-flash', 10); end(); return; }
          if (p < 1) { requestAnimationFrame(step); return; }
          burst(jx, jy, 'impact-flash-iran', 16);
          end();
        }
        requestAnimationFrame(step);
      }, i * 220);
    }
  }

  function launchDrones(base, count, cb) {
    const fx = document.getElementById('fx-layer');
    const o = iranOrigin('drone', base.x, base.y);
    let left = count;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const sx = o.x + rand(-12, 12), sy = o.y + rand(-10, 10);
        const jx = base.x + rand(-7, 7), jy = base.y + rand(-5, 5);
        const mx = (sx + jx) / 2 + rand(-30, 30);
        const my = (sy + jy) / 2 + rand(-30, 30);
        // invisible guide path (stroke: none) — geometry only, for the swarm route
        const path = el('path', { class: 'iran-drone-path', d: `M${sx},${sy} Q${mx},${my} ${jx},${jy}` });
        fx.appendChild(path);
        const d = el('path', { class: 'iran-drone', d: 'M0,-2.6 L2.2,2 L-2.2,2 Z' });
        fx.appendChild(d);
        const total = path.getTotalLength();
        const dur = 2600 + rand(0, 900);
        const wob = 2.5 + Math.random() * 2.5, wf = 4 + Math.random() * 4;
        const interceptAt = Math.random() < 0.3 ? 0.6 + Math.random() * 0.3 : 2;
        const t0 = performance.now();
        const end = () => {
          d.remove();
          path.remove();
          if (--left === 0) cb();
        };
        function step(now) {
          const p = Math.min(1, (now - t0) / dur);
          const pt = path.getPointAtLength(total * p);
          const pb = path.getPointAtLength(Math.min(total, total * p + 2));
          const dx = pb.x - pt.x, dy = pb.y - pt.y;
          const len = Math.hypot(dx, dy) || 1;
          // weave perpendicular to the heading — the swarm wobble
          const off = Math.sin(p * wf * Math.PI) * wob;
          const wx = pt.x + (-dy / len) * off, wy = pt.y + (dx / len) * off;
          const ang = Math.atan2(dy, dx) * 180 / Math.PI + 90;
          d.setAttribute('transform', `translate(${wx},${wy}) rotate(${ang})`);
          if (p >= interceptAt) { burst(wx, wy, 'intercept-flash', 6); end(); return; }
          if (p < 1) { requestAnimationFrame(step); return; }
          burst(jx, jy, 'impact-flash-iran', 9);
          end();
        }
        requestAnimationFrame(step);
      }, i * 280);
    }
  }

  // Called from the end-of-turn flow: animates every event carrying an
  // `attack` spec, then hands control back so the battle report can land.
  function animateIranianAttacks(events, done) {
    const specs = [];
    for (const ev of events) {
      if (!ev.attack) continue;
      const bases = ev.attack.bases || [ev.attack.base];
      for (const b of bases) {
        const asset = US_ASSETS.find(a => a.id === b);
        if (!asset) continue;
        if (ev.attack.kind === 'mixed') {
          specs.push({ kind: 'missile', asset, count: ev.attack.count || 4 });
          specs.push({ kind: 'drone', asset, count: 5 });
        } else {
          specs.push({ kind: ev.attack.kind, asset, count: ev.attack.count || (ev.attack.kind === 'drone' ? 5 : 3) });
        }
      }
    }
    if (!specs.length) { if (done) done(); return; }

    let leftSalvos = specs.length, called = false;
    const finish = () => {
      if (called) return;
      called = true;
      if (done) done();
    };
    specs.forEach((s, i) => {
      setTimeout(() => {
        (s.kind === 'missile' ? launchMissiles : launchDrones)(s.asset, s.count, () => {
          if (--leftSalvos === 0) setTimeout(finish, 400);
        });
      }, i * 600);
    });
    setTimeout(finish, 12000); // watchdog: a throttled tab must never stall the war
  }

  return { render, updateTarget, setHormuz, flashAsset, animateStrike, animateIranianAttacks, setTargetClickHandler };
})();
