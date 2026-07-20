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

  // the glyph that identifies a target type — drawn on the map at 1x and blown
  // up inside the tactical scope, so both views read as the same object
  function targetCore(type) {
    switch (type) {
      case 'nuclear':
        return el('path', { class: 'tgt-core', d: 'M0,-5 L4.3,2.5 L-4.3,2.5 Z' }); // triangle
      case 'airdefense':
        return el('rect', { class: 'tgt-core', x: -3.5, y: -3.5, width: 7, height: 7, transform: 'rotate(45)' });
      case 'missile':
        return el('path', { class: 'tgt-core', d: 'M0,-5.5 L2.5,3 L0,1.2 L-2.5,3 Z' });
      case 'naval':
        return el('path', { class: 'tgt-core', d: 'M-4,-1 L4,-1 L2,3 L-2,3 Z M-0.8,-5 L0.8,-5 L0.8,-1 L-0.8,-1 Z' });
      case 'oil':
        return el('circle', { class: 'tgt-core', r: 3.5 });
      default:
        return el('rect', { class: 'tgt-core', x: -3.5, y: -3.5, width: 7, height: 7 });
    }
  }

  function targetIcon(t) {
    const g = el('g', { class: `target intact`, id: `tgt-${t.id}`, transform: `translate(${t.x},${t.y})` });
    // invisible filled circle so the whole icon (not just strokes) is clickable
    g.appendChild(el('circle', { r: 13, fill: 'transparent' }));
    g.appendChild(el('circle', { class: 'tgt-ring', r: 9 }));
    g.appendChild(targetCore(t.type));
    const label = el('text', { y: 20 });
    label.textContent = t.short;
    g.appendChild(label);
    return g;
  }

  // top-down aircraft-carrier silhouette (bow up): hull, angled flight deck,
  // starboard island and a faint centreline. drawn small so at map scale it
  // reads as a single flat-top; the escort screen is added separately.
  function carrierHull(cls) {
    const c = el('g', { class: cls });
    c.appendChild(el('path', { class: 'asset-icon carrier-hull',
      d: 'M0,-8 C1.8,-6.5 2.2,-4.5 2.2,-3 L2.2,6.5 Q2.2,7.8 1,7.8 L-1,7.8 Q-2.2,7.8 -2.2,6.5 L-2.2,-3 C-2.2,-4.5 -1.8,-6.5 0,-8 Z' }));
    // angled flight deck (offset to port, as on a real carrier)
    c.appendChild(el('path', { class: 'carrier-deck', d: 'M-0.8,5 L-4.8,-4 L-2.9,-5 L1.1,3.5 Z' }));
    // deck centreline
    c.appendChild(el('line', { class: 'carrier-line', x1: 0, y1: -6.5, x2: 0, y2: 6.5 }));
    // starboard island superstructure
    c.appendChild(el('rect', { class: 'carrier-island', x: 1.2, y: -2.4, width: 1.4, height: 3.2 }));
    return c;
  }

  // small screening warship (destroyer/cruiser), bow up before rotation
  function escortShip() {
    return el('path', { class: 'asset-icon escort-ship', d: 'M0,-3.4 L1.3,-0.8 L1.3,3 L-1.3,3 L-1.3,-0.8 Z' });
  }

  // the strike group: the carrier plus a ring of escorts, hidden until the
  // map is zoomed way in (toggled via the .map-deep-zoom class on the svg)
  function carrierGroup() {
    const grp = el('g', { class: 'carrier-strike-group' });
    // escort screen — revealed only on deep zoom
    const screen = el('g', { class: 'strike-group' });
    const escorts = [
      { dx: 0, dy: -17, rot: 0 },     // plane-guard / vanguard ahead
      { dx: -13, dy: -8, rot: -22 },  // port bow
      { dx: 13, dy: -6, rot: 20 },    // starboard bow
      { dx: -13, dy: 8, rot: -158 },  // port quarter
      { dx: 13, dy: 10, rot: 152 },   // starboard quarter (astern screen)
    ];
    for (const e of escorts) {
      const s = escortShip();
      s.setAttribute('transform', `translate(${e.dx},${e.dy}) rotate(${e.rot})`);
      screen.appendChild(s);
    }
    grp.appendChild(screen);
    grp.appendChild(carrierHull('carrier-body'));
    return grp;
  }

  function assetIcon(a) {
    const g = el('g', { class: 'us-asset' + (a.ally ? ' ally' : ''), id: `asset-${a.id}`, transform: `translate(${a.x},${a.y})` });
    let icon;
    if (a.kind === 'carrier') {
      icon = carrierGroup();
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
    // labelAbove keeps neighbouring bases (Nevatim/Hatzerim) from colliding
    const label = el('text', { y: a.labelAbove ? -11 : 17 });
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
        (a.ally
          ? `<br><em style="color:var(--amber)">ALLIED — NOT UNDER US COMMAND · ${Game.israelStatus()}</em>`
          : `<br><em style="color:var(--blue)">${a.sortie ? 'Fixed-wing sorties: YES' : 'Fixed-wing sorties: NO'}` +
            ` · ${a.atacms ? 'ATACMS/PrSM: YES' : 'ATACMS/PrSM: NO'}</em>`));
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
    // reveal each carrier's escort screen once zoomed way in
    svg.classList.toggle('map-deep-zoom', view.k >= 2.6);
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

  // ============================================================
  // TACTICAL SCOPE (top-left panel)
  // ------------------------------------------------------------
  // Every outbound strike is flown here, in a self-contained 200x200 display
  // with its own coordinate space, instead of across the strategic map. The
  // scope is pure theatre: it dramatizes airDefenseWeight() and the aircrew
  // loss risk that computeStrike() already decided, and it never touches an
  // outcome. game.js still owns every result.
  // ============================================================
  const SC = { C: 100, RING: 70, EDGE: 96, LOCK_ARC: 9 };

  function fsPanel() { return document.getElementById('flight-status'); }

  // scope cards (live strikes) stack above transit cards (B-2s still en route)
  function fsStacks() {
    const panel = fsPanel();
    let scope = document.getElementById('scope-stack');
    if (!scope) {
      scope = document.createElement('div');
      scope.id = 'scope-stack';
      scope.className = 'fs-stack';
      panel.appendChild(scope);
      const transit = document.createElement('div');
      transit.id = 'transit-stack';
      transit.className = 'fs-stack';
      panel.appendChild(transit);
    }
    return { scope, transit: document.getElementById('transit-stack') };
  }

  function fsSync() {
    const { scope, transit } = fsStacks();
    fsPanel().classList.toggle('hidden', !scope.children.length && !transit.children.length);
  }

  function fsLine(entry, text, problem) {
    const div = document.createElement('div');
    div.className = 'fs-line' + (problem ? ' fs-problem' : '');
    div.textContent = '> ' + text;
    entry.querySelector('.fs-lines').appendChild(div);
    const lines = entry.querySelectorAll('.fs-line');
    if (lines.length > 3) lines[0].remove();
  }

  // Killing a card also kills its rAF loops: every loop checks card._alive.
  function fsClose(entry, delay) {
    setTimeout(() => {
      entry._alive = false;
      entry.remove();
      fsSync();
    }, delay || 0);
  }

  // ---- silhouettes: drawn NOSE-UP (nose at -y), rotated +90 onto the heading ----
  const SIL = {
    // pointed nose, swept delta wings, twin canted tails
    fighter: 'M0,-7.5 L1.1,-3.4 L1.5,0.4 L6.8,4.4 L6.8,5.8 L1.6,3.8 L1.4,5.4 ' +
             'L3.4,7.4 L3.4,8.2 L1,7.2 L0,7.9 L-1,7.2 L-3.4,8.2 L-3.4,7.4 ' +
             'L-1.4,5.4 L-1.6,3.8 L-6.8,5.8 L-6.8,4.4 L-1.5,0.4 L-1.1,-3.4 Z',
    // flying wing — no tails, one continuous sawtooth trailing edge
    stealth: 'M0,-6.5 L9,4.2 L5.2,3.4 L2.8,6.4 L0,4.8 L-2.8,6.4 L-5.2,3.4 L-9,4.2 Z',
    // TLAM: a body and two stub fins, deliberately not a jet
    cruise: 'M0,-7 L1.2,-3.5 L1.2,3.2 L2.9,6.2 L1.2,5.6 L1.2,7 L-1.2,7 L-1.2,5.6 ' +
            'L-2.9,6.2 L-1.2,3.2 L-1.2,-3.5 Z',
  };
  const BURNER = 'M-1.5,7 L1.5,7 L0.9,12.5 L-0.9,12.5 Z';

  // ---- scope-local burst (the map's burst() draws in world coords) ----
  function scopeBurst(root, x, y, cls, maxR) {
    const c = el('circle', { class: cls, cx: x, cy: y, r: 1 });
    root.appendChild(c);
    const t0 = performance.now();
    (function step(now) {
      const p = Math.min(1, (now - t0) / 420);
      c.setAttribute('r', 1 + p * maxR);
      c.setAttribute('opacity', 0.9 * (1 - p));
      if (p < 1) { requestAnimationFrame(step); return; }
      c.remove();
    })(performance.now());
  }

  // ---- the scope card: header, mini tactical view, status lines, progress ----
  function scopeCard(header) {
    const { scope } = fsStacks();
    const entry = document.createElement('div');
    entry._alive = true;
    entry.className = 'flight-entry scope-card';
    entry.innerHTML =
      `<div class="fs-head">${header}</div>` +
      `<div class="scope-wrap"></div>` +
      `<div class="fs-lines"></div>` +
      `<div class="progress-row"><span class="progress-phase">STANDING BY</span>` +
      `<span class="progress-pct">0%</span></div>` +
      `<div class="progress-bar"><div class="progress-fill"></div></div>`;
    scope.appendChild(entry);
    fsPanel().classList.remove('hidden');
    return entry;
  }

  function setProgress(entry, p, phase, contested) {
    entry.querySelector('.progress-fill').style.width = Math.round(Math.min(1, p) * 100) + '%';
    entry.querySelector('.progress-fill').classList.toggle('contested', !!contested);
    entry.querySelector('.progress-phase').textContent = phase;
    entry.querySelector('.progress-pct').textContent = Math.round(Math.min(1, p) * 100) + '%';
  }

  const PHASES = [
    [0.08, 'WHEELS UP'], [0.42, 'INGRESS'], [0.86, 'CONTESTED AIRSPACE'],
    [0.99, 'TERMINAL'], [1.01, 'WEAPONS AWAY'],
  ];
  const PHASES_CRUISE = [
    [0.08, 'LAUNCH'], [0.42, 'MIDCOURSE'], [0.86, 'TERRAIN FOLLOWING'],
    [0.99, 'TERMINAL'], [1.01, 'IMPACT'],
  ];
  function phaseFor(p, cruise) {
    const table = cruise ? PHASES_CRUISE : PHASES;
    for (const [at, name] of table) if (p < at) return name;
    return 'BDA';
  }

  // Builds the static furniture of the mini display and returns handles to the
  // parts that animate. Coordinate space is the scope's own 0..200, never world.
  function buildScopeView(entry, target, adw) {
    const svg = el('svg', { class: 'scope-view', viewBox: '0 0 200 200' });
    const C = SC.C;

    // bearing ticks every 30° plus two faint range rings — situation-room furniture
    const grid = el('g', { class: 'scope-grid' });
    for (const r of [26, 48, SC.RING]) grid.appendChild(el('circle', { cx: C, cy: C, r }));
    for (let a = 0; a < 360; a += 30) {
      const rad = a * Math.PI / 180;
      const inner = a % 90 === 0 ? 82 : 88;
      grid.appendChild(el('line', {
        x1: C + Math.cos(rad) * inner, y1: C + Math.sin(rad) * inner,
        x2: C + Math.cos(rad) * 94, y2: C + Math.sin(rad) * 94,
      }));
    }
    svg.appendChild(grid);

    // THREAT RING — brightness and weight track live SAM coverage. Weight 0 means
    // no ring and no sweep at all: clean skies, the visible payoff for SEAD first.
    let ring = null, sweep = null;
    if (adw > 0) {
      const intensity = Math.min(1, adw / 3);
      ring = el('circle', {
        class: 'scope-ring', cx: C, cy: C, r: SC.RING,
        'stroke-width': (0.8 + intensity * 1.2).toFixed(2),
        opacity: (0.35 + intensity * 0.55).toFixed(2),
      });
      svg.appendChild(ring);

      // rotating wedge: solid leading edge trailing off into a faded tail
      sweep = el('g', { class: 'scope-sweep-g' });
      const span = 34 * Math.PI / 180;
      const x1 = C + Math.cos(-span) * SC.RING, y1 = C + Math.sin(-span) * SC.RING;
      sweep.appendChild(el('path', {
        class: 'scope-sweep',
        d: `M${C},${C} L${x1.toFixed(2)},${y1.toFixed(2)} A${SC.RING},${SC.RING} 0 0 1 ${C + SC.RING},${C} Z`,
      }));
      sweep.appendChild(el('line', { class: 'scope-beam', x1: C, y1: C, x2: C + SC.RING, y2: C }));
      svg.appendChild(sweep);
    }

    // TARGET at dead centre, same glyph it wears on the map, blown up 2x
    const tg = el('g', { class: `target ${target.status || 'intact'} scope-tgt`, transform: `translate(${C},${C})` });
    const inner = el('g', { transform: 'scale(2)' });
    inner.appendChild(el('circle', { class: 'tgt-ring', r: 9 }));
    inner.appendChild(targetCore(target.type));
    tg.appendChild(inner);
    const lbl = el('text', { y: 34 });
    lbl.textContent = target.short;
    tg.appendChild(lbl);
    svg.appendChild(tg);

    const fx = el('g', { class: 'scope-fx' });
    svg.appendChild(fx);

    entry.querySelector('.scope-wrap').appendChild(svg);
    return { svg, fx, ring, sweep, tg };
  }

  // ---- the terminal attack run, flown inside the scope ----
  function animateScope(assetType, target, done, count) {
    const stealth = assetType === 'stealth';
    const cruise = assetType === 'cruise';
    const ft = stealth ? { type: 'B-2', cs: 'SPIRIT' }
      : cruise ? { type: 'RGM-109 TLAM', cs: 'ARSENAL' }
      : pick(FIGHTER_TYPES);
    const origin = stealth ? US_ASSETS.find(a => a.id === 'diego')
      : cruise ? US_ASSETS.find(a => a.id === STRIKE_ORIGINS.cruise)
      : nearestSortieBase(target, ft.from === 'carrier');
    const callsign = `${ft.cs} ${rand(1, 9)}${rand(1, 9)}`;
    const baseName = origin.id === 'diego' ? 'DIEGO GARCIA' : origin.short;
    // one silhouette per aircraft/missile in the run — capped so a fat package
    // doesn't overflow the tiny scope
    const N = Math.max(1, Math.min(6, count | 0 || 1));

    // live SAM coverage over this target — the same number computeStrike() used
    const adw = (typeof Game !== 'undefined' && Game.airDefenseWeight) ? Game.airDefenseWeight() : 0;

    const headHeader = N > 1
      ? `${callsign} FLIGHT (×${N}) · ${ft.type} — ${baseName} → ${target.short}`
      : `${callsign} · ${ft.type} — ${baseName} → ${target.short}`;
    const entry = scopeCard(headHeader);
    entry.dataset.tgt = target.id;   // lets playStrikeHit() find this live scope
    const view = buildScopeView(entry, target, adw);
    const C = SC.C;

    // REAL BEARING: the angle from the strike origin to the target in world
    // coords, so the scope preserves which way the package actually came from.
    const bearing = Math.atan2(origin.y - target.y, origin.x - target.x);
    // Silhouettes are drawn NOSE-UP (nose at -y). The aircraft flies inbound
    // along `bearing` — velocity direction is bearing+180°, and the nose sits at
    // -90° in the shape's local frame, so the rotation to align them is
    // (bearing+180°) - (-90°) = bearing + 270°.
    const headingDeg = bearing * 180 / Math.PI + 270;

    // inbound track + the formation itself. Each silhouette gets a lateral
    // offset perpendicular to the bearing so they read as a formation abreast,
    // and a small along-track stagger so they don't stack in a straight line.
    view.fx.appendChild(el('line', {
      class: 'scope-track',
      x1: C + Math.cos(bearing) * SC.EDGE, y1: C + Math.sin(bearing) * SC.EDGE, x2: C, y2: C,
    }));
    const perpX = -Math.sin(bearing), perpY = Math.cos(bearing);
    const alongX = -Math.cos(bearing), alongY = -Math.sin(bearing); // toward centre
    const spacing = N <= 2 ? 11 : 9;
    const acs = [];
    for (let i = 0; i < N; i++) {
      const offIdx = i - (N - 1) / 2;                       // symmetric around 0
      const perpOff = offIdx * spacing;
      const alongOff = Math.abs(offIdx) * (N > 2 ? -3.5 : 0); // slight V trail
      const g = el('g', { class: 'scope-ac' });
      let burner = null;
      if (!cruise) {
        burner = el('path', { class: 'scope-burner', d: BURNER, opacity: 0 });
        g.appendChild(burner);
      }
      g.appendChild(el('path', { class: 'scope-jet', d: cruise ? SIL.cruise : stealth ? SIL.stealth : SIL.fighter }));
      view.fx.appendChild(g);
      acs.push({ g, burner, perpOff, alongOff, pos: { x: 0, y: 0 } });
    }

    // blinking lock box, shown only while the beam is actually painting; sits
    // on whichever silhouette the beam happens to be over that frame
    const lock = el('rect', { class: 'scope-lock', x: -11, y: -11, width: 22, height: 22, opacity: 0 });
    view.fx.appendChild(lock);

    // status lines
    const subs = { '{cs}': callsign, '{base}': baseName, '{tgt}': target.short };
    const fill = (s) => s.replace(/\{cs\}|\{base\}|\{tgt\}/g, (m) => subs[m]);
    const evs = (cruise ? CRUISE_EVENTS : FLIGHT_EVENTS)
      .filter(e => !e.only || e.only === (stealth ? 'stealth' : 'fighter'))
      .sort((a, b) => a.at - b.at);
    let evIdx = 0;
    const fireUpTo = (prog) => {
      while (evIdx < evs.length && evs[evIdx].at <= prog) {
        const e = evs[evIdx++];
        if (e.kind === 'problem' && Math.random() > e.chance) continue;
        fsLine(entry, fill(pick(e.msgs)), e.kind === 'problem');
      }
    };

    // ---- radar sweep + acquisition ----
    // The aircraft runs in along a fixed bearing, so the beam passes over it once
    // per revolution: sweeping past the inbound is what triggers a paint.
    // acPos tracks the LEAD silhouette (index 0) and is what SAMs chase; a
    // formation still reads as one contact on hostile radar.
    const acPos = { x: C + Math.cos(bearing) * SC.EDGE, y: C + Math.sin(bearing) * SC.EDGE };
    const bearingDeg = ((bearing * 180 / Math.PI) % 360 + 360) % 360;
    const revMs = adw >= 2.5 ? 2500 : adw >= 1 ? 3800 : 5000; // degraded radars turn slower
    let sweepDeg = Math.random() * 360;
    let painted = false, samLines = 0, samsUp = 0;

    // Stealth is painted late and briefly — that is the whole reason a B-2 walks
    // into a defended target and a Strike Eagle does not.
    const paintOdds = stealth ? 0.18 : cruise ? 0.45 : 1;
    // TLAMs fly a terrain-following profile under the SAM belt — air defense is
    // not what defeats a Tomahawk, so nothing rises to engage a cruise run.
    const samChance = cruise ? 0 : Math.min(0.7, 0.22 * adw) * (stealth ? 0.25 : 1);

    function launchSAM() {
      if (samsUp >= 4) return;
      samsUp++;
      // rises from the ring, a little off the inbound's bearing, and chases it
      const off = (Math.random() - 0.5) * 1.1;
      const sx = C + Math.cos(bearing + off) * SC.RING;
      const sy = C + Math.sin(bearing + off) * SC.RING;
      const trail = el('line', { class: 'sam-trail', x1: sx, y1: sy, x2: sx, y2: sy });
      const head = el('circle', { class: 'sam-head', cx: sx, cy: sy, r: 1.8 });
      view.fx.appendChild(trail);
      view.fx.appendChild(head);
      if (samLines < 2) { fsLine(entry, pick(SAM_LINES), true); samLines++; }
      const s0 = performance.now();
      (function step(now) {
        if (!entry._alive) { trail.remove(); head.remove(); return; }
        const p = Math.min(1, (now - s0) / 620);
        // lead the target's live position rather than a frozen intercept point
        const x = sx + (acPos.x - sx) * p, y = sy + (acPos.y - sy) * p;
        head.setAttribute('cx', x); head.setAttribute('cy', y);
        trail.setAttribute('x2', x); trail.setAttribute('y2', y);
        trail.setAttribute('opacity', 0.85 * (1 - p * 0.6));
        if (p < 1) { requestAnimationFrame(step); return; }
        head.remove(); trail.remove();
        samsUp--;
        scopeBurst(view.fx, x, y, 'sam-flash', 9);
      })(performance.now());
    }

    // t0/lastFrame are set when the flight actually starts — for a TLAM that is
    // after the launch clip finishes, so the clip never eats into radar time.
    let lastFrame = 0, t0 = 0;
    const dur = FLIGHT_DUR[assetType];

    // one loop drives the sweep, the aircraft, acquisition and the progress bar
    function frame(now) {
      if (!entry._alive) return;
      const dt = now - lastFrame;
      lastFrame = now;

      const p = Math.min(1, (now - t0) / dur);

      // formation: each silhouette rides the bearing in, offset perpendicular
      // (and slightly along-track) from the lead. Lead sits on the bearing line.
      const r = SC.EDGE * (1 - p);
      const leadX = C + Math.cos(bearing) * r;
      const leadY = C + Math.sin(bearing) * r;
      acPos.x = leadX; acPos.y = leadY;
      for (const a of acs) {
        a.pos.x = leadX + perpX * a.perpOff + alongX * a.alongOff;
        a.pos.y = leadY + perpY * a.perpOff + alongY * a.alongOff;
        a.g.setAttribute('transform',
          `translate(${a.pos.x.toFixed(2)},${a.pos.y.toFixed(2)}) rotate(${headingDeg.toFixed(1)})`);
        if (a.burner) a.burner.setAttribute('opacity',
          (Math.min(1, p * 3) * (0.55 + Math.random() * 0.45)).toFixed(2));
      }

      if (view.sweep) {
        sweepDeg = (sweepDeg + (dt / revMs) * 360) % 360;
        view.sweep.setAttribute('transform', `rotate(${sweepDeg.toFixed(1)},${C},${C})`);
        // degraded coverage flickers
        if (adw < 2 && Math.random() < 0.02) view.sweep.setAttribute('opacity', 0.25 + Math.random() * 0.75);

        // PAINT: is the beam's leading edge on the inbound right now?
        let diff = Math.abs(((sweepDeg - bearingDeg + 540) % 360) - 180);
        diff = 180 - diff;
        const inBeam = diff < SC.LOCK_ARC && r < SC.RING + 4;
        const allowed = !stealth || p > 0.72; // stealth is only ever seen late
        if (inBeam && allowed && Math.random() < paintOdds) {
          // paint whichever silhouette the beam happens to be sweeping across
          const idx = Math.floor(Math.random() * acs.length);
          const paintPos = acs[idx].pos;
          lock.setAttribute('transform', `translate(${paintPos.x.toFixed(2)},${paintPos.y.toFixed(2)})`);
          lock.setAttribute('opacity', 1);
          if (view.ring) view.ring.classList.add('painting');
          if (!painted && Math.random() < samChance) launchSAM();
          painted = true;
        } else if (painted) {
          lock.setAttribute('opacity', 0);
          if (view.ring) view.ring.classList.remove('painting');
          painted = false;
        }
      }

      fireUpTo(p);
      // cruise runs carry no threat styling — nothing is shooting at a TLAM
      setProgress(entry, p, phaseFor(p, cruise), !cruise && p >= 0.42 && p < 0.86 && adw > 0);

      if (p < 1) { requestAnimationFrame(frame); return; }
      impact();
    }

    function impact() {
      for (const a of acs) a.g.setAttribute('opacity', 0);
      lock.setAttribute('opacity', 0);
      if (view.ring) view.ring.classList.remove('painting');
      view.tg.classList.add('scope-hit');
      scopeBurst(view.fx, C, C, 'impact-flash', 46);
      setProgress(entry, 1, 'BDA', false);
      fireUpTo(1);
      done();                 // BDA resolves now — everything after is cosmetic
      targetPulse(target);    // the map's one quiet acknowledgement
      // a single egress beat, then the card retires. Held open long enough for
      // the hit clip (played by game.js on a successful hit) to finish first.
      if (!cruise) setTimeout(() => { if (entry._alive) fireUpTo(1.2); }, 1400);
      fsClose(entry, 5200);
    }

    // Start the terminal run. For a TLAM the launch clip plays first and in full
    // — the flight (and the radar) only begins once the clip is done, so the clip
    // never cuts into radar time. Every other asset starts its run immediately.
    function startFlight() {
      t0 = performance.now();
      lastFrame = t0;
      requestAnimationFrame(frame);
    }
    if (cruise) {
      overlayScopeClip(entry.querySelector('.scope-wrap'), 'video/tlam-launch.mp4', startFlight);
    } else {
      startFlight();
    }
  }

  // ---- B-2 transit cards: the Diego Garcia leg, kept visible ----
  // Stealth packages are ETA 2. While one is still in transit it gets a compact
  // card — no radar, no attack view — so the distance reads as time.
  const NM_PER_MAP = 1 / KM_TO_MAP / 1.852;

  // Deterministic per-target so the callsign survives re-renders without being
  // written into the mission (and therefore into the save).
  function transitCallsign(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return `SPIRIT ${11 + (h % 89)}`;
  }

  function updateTransit(missions) {
    const { transit } = fsStacks();
    const inbound = (missions || []).filter(m => m.pkg && m.pkg.asset === 'stealth' && m.eta > 1);
    transit.innerHTML = '';
    const diego = US_ASSETS.find(a => a.id === 'diego');
    for (const m of inbound) {
      const t = TARGETS.find(x => x.id === m.targetId);
      if (!t || !diego) continue;
      const nm = Math.round(Math.hypot(diego.x - t.x, diego.y - t.y) * NM_PER_MAP / 50) * 50;
      const turns = m.eta - 1;
      const card = document.createElement('div');
      card.className = 'flight-entry transit-card';
      card.innerHTML =
        `<div class="fs-head">${transitCallsign(t.id)} · B-2 — DIEGO GARCIA → ${t.short}</div>` +
        `<div class="transit-strip"><span class="transit-dot"></span></div>` +
        `<div class="fs-lines"><div class="fs-line">> B-2 // SPIRIT — ` +
        `${nm.toLocaleString()} NM — ${turns} TURN${turns === 1 ? '' : 'S'} TO TOT</div></div>`;
      transit.appendChild(card);
    }
    fsSync();
  }

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

  // ---- the map's only outbound-strike cue: a short pulse on the target ----
  function targetPulse(target) {
    const g = document.getElementById(`tgt-${target.id}`);
    if (g) {
      g.classList.add('struck');
      setTimeout(() => g.classList.remove('struck'), 500);
    }
    burst(target.x, target.y, 'impact-flash', 13);
  }

  // ---- strike dispatcher ----
  // Contract with game.js: `done` fires exactly once, at impact. game.js also
  // runs a watchdog that may call its own finishOne first, so the guard here is
  // about never double-resolving from this side.
  function animateStrike(assetType, target, done, count) {
    let called = false;
    const once = () => { if (called) return; called = true; if (done) done(); };
    try {
      animateScope(assetType, target, once, count);
    } catch (e) {
      // a broken animation must never hold up the war
      console.error('scope animation failed', e);
      once();
    }
  }

  // ---- strike footage: launch + hit clips that play inside the scope window ----
  // game.js holds the BDA report back until footage is done, so we track how many
  // clips are still on screen and let it await an idle scope.
  let activeClips = 0;
  let clipWaiters = [];
  function clipEnded() {
    activeClips = Math.max(0, activeClips - 1);
    if (activeClips === 0) { const w = clipWaiters; clipWaiters = []; w.forEach(fn => fn()); }
  }
  // Run cb once every strike clip has finished (or immediately if none are up).
  // The timeout is a hard safety net: a stuck clip must never hang the report.
  function whenFootageDone(cb) {
    if (activeClips === 0) { cb(); return; }
    let fired = false;
    const go = () => { if (fired) return; fired = true; cb(); };
    clipWaiters.push(go);
    setTimeout(go, 9000);
  }

  // Overlay a clip on a scope card's radar window, fading out when it ends.
  // Plays WITH sound (muted fallback if the browser blocks audible autoplay).
  // onEnd fires once — on natural end, a load error, or a stall timeout — so a
  // launch clip can gate the flight run behind itself without ever hanging.
  function overlayScopeClip(wrap, src, onEnd) {
    if (!wrap || wrap.querySelector('.scope-hit-video')) { if (onEnd) onEnd(); return; }
    const vid = document.createElement('video');
    vid.className = 'scope-hit-video';
    vid.src = src;
    vid.playsInline = true;
    activeClips++;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      vid.remove();
      clipEnded();
      if (onEnd) onEnd();
    };
    vid.addEventListener('ended', finish);
    vid.addEventListener('error', finish);   // genuine decode/load failure
    setTimeout(finish, 9000);                // stall safety (e.g. backgrounded tab)
    wrap.appendChild(vid);
    // Try to play with sound; a rejected audible autoplay falls back to muted so
    // the footage still runs. Any sound in the clip plays when the browser allows.
    vid.play().catch(() => { vid.muted = true; vid.play().catch(() => {}); });
  }

  // Called by game.js only when BDA confirms a successful hit (destroyed/damaged).
  // Plays in the same window as the radar, then fades out to reveal the BDA state.
  function playStrikeHit(target) {
    const entry = [...document.querySelectorAll('.scope-card')]
      .find(e => e._alive && e.dataset.tgt === target.id);
    if (entry) overlayScopeClip(entry.querySelector('.scope-wrap'), 'video/strike-hit.mp4');
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

  return { render, updateTarget, setHormuz, flashAsset, animateStrike, playStrikeHit,
    whenFootageDone, updateTransit, animateIranianAttacks, setTargetClickHandler };
})();
