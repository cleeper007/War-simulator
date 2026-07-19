// ============================================================
// map.js — SVG map rendering, pan/zoom, target icons, strike FX
// ============================================================

const MapView = (() => {
  let svg, world, tooltip;
  let view = { x: 0, y: 0, k: 1 };
  let panning = false, panStart = null;

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

    // strike FX layer sits under icons' labels but above land
    world.appendChild(el('g', { id: 'fx-layer' }));

    // US assets
    for (const a of US_ASSETS) {
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

  // ---- strike animation: projectile from origin asset to target, then flash ----
  function animateStrike(assetType, target, done) {
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

  return { render, updateTarget, setHormuz, flashAsset, animateStrike, setTargetClickHandler };
})();
