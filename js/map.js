// ============================================================
// map.js — SVG map rendering, pan/zoom, target icons, strike FX
// ============================================================

const MapView = (() => {
  let svg, world, tooltip;
  let view = { x: 0, y: 0, k: 1 };
  let panning = false, panStart = null;

  // ---- stylized regional geography (not to scale) ----
  const COUNTRIES = [
    { name: 'IRAN', cls: 'iran', label: [530, 270], pts:
      '350,150 420,128 500,148 560,138 622,168 700,200 760,250 800,330 788,420 742,452 700,442 662,432 640,420 600,432 560,412 520,402 480,382 440,352 400,332 368,300 340,250 330,198' },
    { name: 'IRAQ', label: [280, 250], pts:
      '198,180 280,168 350,150 330,198 340,250 368,300 350,330 300,352 248,330 208,262' },
    { name: 'KUWAIT', label: null, pts:
      '300,352 336,344 346,370 314,386' },
    { name: 'SAUDI ARABIA', label: [330, 520], pts:
      '148,300 208,262 248,330 300,352 314,386 340,402 380,432 430,472 470,462 496,470 505,505 560,522 560,560 600,690 140,690 120,420' },
    { name: 'QATAR', label: null, pts:
      '505,505 503,468 517,462 524,505' },
    { name: 'UAE', label: [600, 548], pts:
      '540,522 640,506 658,520 640,560 560,560 545,540' },
    { name: 'OMAN', label: [720, 545], pts:
      '658,520 700,472 718,450 738,455 728,472 760,470 772,540 720,602 660,562 640,560' },
    { name: 'TURKMENISTAN', label: [700, 140], pts:
      '622,168 700,200 760,250 830,240 900,180 880,110 760,100 660,130' },
    { name: 'PAKISTAN / AFGHANISTAN', label: [880, 330], pts:
      '760,250 800,330 788,420 850,432 950,400 985,300 950,190 900,180 830,240' },
  ];

  const SEAS = [
    { name: 'PERSIAN GULF', x: 455, y: 425 },
    { name: 'GULF OF OMAN', x: 745, y: 490 },
    { name: 'ARABIAN SEA', x: 840, y: 610 },
    { name: 'CASPIAN SEA', x: 520, y: 105 },
  ];

  // Caspian is drawn as water on top of land
  const CASPIAN = '470,60 560,50 610,80 615,150 570,175 500,165 460,120';

  function el(tag, attrs = {}) {
    const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  }

  function targetIcon(t) {
    const g = el('g', { class: `target intact`, id: `tgt-${t.id}`, transform: `translate(${t.x},${t.y})` });
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

    // countries
    for (const c of COUNTRIES) {
      const p = el('polygon', { class: `country ${c.cls || ''}`, points: c.pts });
      world.appendChild(p);
      if (c.label) {
        const t = el('text', { class: 'country-label', x: c.label[0], y: c.label[1] });
        t.textContent = c.name;
        world.appendChild(t);
      }
    }
    // caspian on top
    world.appendChild(el('polygon', { class: '', points: CASPIAN, fill: 'var(--water)', stroke: 'var(--land-line)', 'stroke-width': 1 }));

    for (const s of SEAS) {
      const t = el('text', { class: 'sea-label', x: s.x, y: s.y });
      t.textContent = s.name;
      world.appendChild(t);
    }

    // Hormuz status indicator
    const hz = el('g', { id: 'hormuz-indicator', transform: `translate(${HORMUZ_POS.x},${HORMUZ_POS.y})` });
    hz.appendChild(el('circle', { id: 'hormuz-dot', r: 5, class: 'hz-open' }));
    const hzLabel = el('text', { y: -10, 'font-size': 9, id: 'hormuz-label', class: 'hz-open' });
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
      panning = true;
      panStart = { px: e.clientX, py: e.clientY, vx: view.x, vy: view.y };
      svg.classList.add('panning');
    });
    window.addEventListener('mousemove', (e) => {
      if (!panning) return;
      // scale mouse delta from screen px to svg units
      const ctm = svg.getScreenCTM();
      const sx = (e.clientX - panStart.px) / ctm.a;
      const sy = (e.clientY - panStart.py) / ctm.d;
      view.x = panStart.vx + sx;
      view.y = panStart.vy + sy;
      applyView();
    });
    window.addEventListener('mouseup', () => {
      panning = false;
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
