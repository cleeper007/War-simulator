// ============================================================
// csar.js — combat search and rescue: getting downed aircrew back
// ============================================================
// A shootdown is the only thing in this war that puts living Americans on
// Iranian soil by accident. When aircrew get out of the aircraft they become
// isolated personnel: a beacon, a voice on guard frequency, and a clock.
//
// Nothing here exists until that happens. The panel, the map marker and the
// mission are all created by the shootdown and destroyed by its resolution —
// there is no standing "rescue" button, because there is nothing to rescue.
//
// The mission itself follows the specops model exactly: the branch is decided
// BEFORE the first line of the script plays, and the timeline is a
// dramatization of a roll that has already happened.

const CSAR = (() => {
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  let running = false;   // recovery in progress: the war is locked out

  // ---- who was flying ----
  // Weighted toward two-seat airframes: a crew of two is what makes the
  // partial recovery possible, and a partial recovery is the worst night.
  const AIRFRAMES = [
    { type: 'F-15E Strike Eagle', cs: 'DUDE', crew: 2, w: 4 },
    { type: 'F/A-18F Super Hornet', cs: 'GUNSLINGER', crew: 2, w: 3 },
    { type: 'F/A-18E Super Hornet', cs: 'RHINO', crew: 1, w: 2 },
    { type: 'F-16C Fighting Falcon', cs: 'VIPER', crew: 1, w: 2 },
  ];
  const DIRS = ['east', 'south-east', 'north-east', 'south', 'north'];

  function pickAirframe() {
    const total = AIRFRAMES.reduce((n, a) => n + a.w, 0);
    let r = Math.random() * total;
    for (const a of AIRFRAMES) { r -= a.w; if (r <= 0) return a; }
    return AIRFRAMES[0];
  }

  // ============================================================
  // THE SHOOTDOWN — called by game.js when a strike package loses an aircraft
  // ============================================================
  // Returns the sentence the BDA report appends and the casualties it costs.
  // Most crews get out; the ones who do are alive until proven otherwise, so
  // no one is counted dead here. Only one recovery situation runs at a time —
  // a second shootdown while a crew is still on the ground is a crew nobody
  // could have reached.
  function aircraftDown(target) {
    const G = Game.G;
    const af = pickAirframe();
    const callsign = `${af.cs} ${rand(1, 7)}${rand(1, 9)}`;
    const crewWord = af.crew === 2 ? 'Both crew' : 'The pilot';

    if (G.downed) {
      return {
        casualties: af.crew,
        text: `A second aircraft — ${callsign}, ${af.type} — was lost to surface-to-air fire in the ` +
          `same package. ${crewWord} died in the aircraft. With a recovery already pending there was ` +
          `nothing airborne that could have reached them.`,
      };
    }

    // Ejection: modern seats work more often than not, and a working seat is
    // what turns a casualty report into a rescue problem.
    if (Math.random() >= 0.62) {
      return {
        casualties: af.crew,
        text: `One strike aircraft — ${callsign}, ${af.type} — was lost to surface-to-air fire. ` +
          `No chutes were seen. ${crewWord} died in the aircraft; footage of the wreckage is already ` +
          `on Iranian state TV.`,
      };
    }

    const km = rand(18, 70);
    const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    G.downed = {
      callsign, type: af.type, crew: af.crew,
      targetId: target.id,
      loc: `${km} km ${dir} of ${target.name}`,
      x: target.x + rand(-26, 26), y: target.y + rand(-22, 22),
      turn: G.turn, turnsOut: 0, isr: false,
    };
    G.stats.downedCrews++;
    syncMap(G);

    return {
      casualties: 0,
      text: `One strike aircraft — ${callsign}, ${af.type} — was lost to surface-to-air fire. ` +
        `${af.crew === 2 ? 'Two good chutes' : 'One good chute'} came off the aircraft and both ` +
        `beacons are transmitting from broken ground ${G.downed.loc}. ${af.crew === 2 ? 'The crew is' : 'The pilot is'} ` +
        `alive, on the ground, and being hunted. Personnel recovery is now a decision on your desk.`,
    };
  }

  // ---- the strategic-map marker: Americans on the ground, in amber ----
  function syncMap(G) {
    const d = G.downed;
    MapView.setSurvivor(d ? { x: d.x, y: d.y } : null,
      d ? `${d.callsign} — ${d.crew === 2 ? 'two aircrew' : 'one aviator'} evading, ${d.loc}` : '');
  }

  // ============================================================
  // ODDS
  // ============================================================
  // Everything that matters is something the player controls or has already
  // spent: darkness, the state of the SAM belt, whether they pushed ISR, and
  // above all how long the crew has been on the ground.
  function odds(G) {
    const d = G.downed;
    const parts = [];
    let p = 0.44;
    parts.push(['Baseline — alert package, hostile ground', 0.44]);

    // turns alternate 06:00 / 18:00; even turns launch into the dark
    if (G.turn % 2 === 0) { p += 0.12; parts.push(['Night recovery — they own the dark', 0.12]); }

    // the helicopters fly through whatever is left of the SAM belt, so this is
    // worth exactly what has been shot off it
    let adBonus = 0;
    for (const t of TARGETS) {
      if (t.type !== 'airdefense') continue;
      adBonus += 0.06 * (1 - t.hp / 100);
    }
    if (adBonus > 0.005) { p += adBonus; parts.push(['Air defenses degraded', adBonus]); }

    if (d.isr) { p += 0.10; parts.push(['ISR pushed — position locked', 0.10]); }
    if (G.coalition) { p += 0.05; parts.push(['Coalition tankers and basing', 0.05]); }
    if (G.carriers.some(cv => cv.arrived && !cv.lost && !cv.moving && cv.posture === 'forward')) {
      p += 0.05; parts.push(['Deck forward — alert helos closer', 0.05]);
    }
    if (d.turnsOut > 0) {
      const cost = -0.14 * d.turnsOut;
      p += cost;
      parts.push([`Time on the ground — ${d.turnsOut} turn(s) hunted`, cost]);
    }

    return { p: clamp(p, 0.10, 0.90), parts };
  }

  // Risk that the search parties get to them before your next order does.
  function captureRisk(G) {
    const d = G.downed;
    let p = 0.18 + 0.24 * d.turnsOut;
    if (d.isr) p -= 0.08;
    if (G.regimeChaosTurns > 0) p -= 0.10;  // nobody is coordinating the search
    return clamp(p, 0.05, 0.92);
  }

  // ============================================================
  // THE CLOCK — one roll per turn the player does not go
  // ============================================================
  function turnTick(G) {
    const d = G.downed;
    if (!d || running) return null;

    // the night they went down is yours: no roll before the player has had a
    // single chance to launch
    if (d.turn === G.turn) {
      return {
        cls: 'friendly', title: `SURVIVAL RADIO CONTACT — ${d.callsign}`,
        text: `The rescue coordination center has two-way contact with ${d.callsign} and has ` +
          `authenticated ${d.crew === 2 ? 'both crew' : 'the pilot'} against the ISOPREP file. ` +
          `They are ${d.loc}, in broken ground, moving away from the wreck. Alert helicopters and ` +
          `their escort are cocked on the ramp. Every hour they spend down there makes the ` +
          `recovery harder and the search parties closer.`,
      };
    }

    d.turnsOut++;
    if (Math.random() < captureRisk(G)) return capture(G, 'timeout');

    return {
      cls: 'iran', title: `${d.callsign} STILL EVADING — SEARCH TIGHTENING`,
      text: `${d.crew === 2 ? 'The crew has' : 'The pilot has'} moved again and is still up on the ` +
        `radio, but the picture is getting worse: IRGC ground units have cordoned the area, ` +
        `helicopters are working a search pattern over it, and Iranian state media is promising ` +
        `the country an American in custody by morning. The recovery force is standing by. ` +
        `The odds will not improve on their own.`,
      dApproval: -1,
    };
  }

  // ---- taken alive: the outcome the whole panel exists to prevent ----
  function capture(G, how) {
    const d = G.downed;
    const who = d.crew === 2 ? 'Both aircrew' : 'The pilot';
    G.stats.aircrewCaptured += d.crew;
    G.hostageCrisis = true;
    G.downed = null;
    syncMap(G);
    AudioSys.play('retaliation');
    return {
      cls: 'iran', title: `${d.callsign} CAPTURED — AMERICAN AIRCREW IN IRGC CUSTODY`,
      text: `The beacon stopped. ${who} ${d.crew === 2 ? 'were' : 'was'} taken alive ${d.loc} and ` +
        `${d.crew === 2 ? 'are' : 'is'} being moved to Tehran. Within the hour Iranian state ` +
        `television is airing the footage: a flight suit, a blindfold, a name read aloud in English. ` +
        (how === 'timeout'
          ? 'No recovery was attempted. That is the sentence every network is running under the picture, '
          : 'The recovery force could not reach them, ') +
        `and the family has learned it from a broadcast. The country has watched this before and ` +
        `remembers exactly how long it lasted.`,
      dApproval: -10, dWorld: -4,
    };
  }

  // ============================================================
  // SIDEBAR PANEL — exists only while there is someone to go get
  // ============================================================
  function renderPanel(G) {
    const panel = $('csar-panel');
    if (!panel) return;
    const d = G.downed;
    if (!d && !running) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');

    const status = $('csar-status');
    const brief = $('csar-brief');
    const box = $('csar-buttons');

    if (running) {
      status.textContent = '— RECOVERY IN PROGRESS';
      status.style.color = 'var(--amber)';
      brief.innerHTML = '';
      box.innerHTML = '<div class="dim" style="font-size:11px">The recovery force is on the objective. ' +
        'Watch the feed. Nothing else happens until they are out — with our people or without them.</div>';
      return;
    }

    status.textContent = `— ${d.callsign} DOWN`;
    status.style.color = 'var(--amber)';

    const { p } = odds(G);
    const risk = Math.round(captureRisk(G) * 100);
    brief.innerHTML =
      `<div class="csar-line"><span class="csar-key">AIRCREW</span>` +
      `<span>${d.crew === 2 ? 'Two — pilot and WSO' : 'One — pilot'}, ${d.type}</span></div>` +
      `<div class="csar-line"><span class="csar-key">POSITION</span><span>${d.loc}</span></div>` +
      `<div class="csar-line"><span class="csar-key">STATUS</span>` +
      `<span class="csar-evading">EVADING — ${d.turnsOut === 0 ? 'first hours' : `${d.turnsOut} turn(s) on the ground`}</span></div>` +
      `<div class="csar-line"><span class="csar-key">CAPTURE RISK</span>` +
      `<span class="${risk >= 55 ? 'est-bad' : risk >= 30 ? 'est-warn' : 'est-good'}">${risk}% before your next order</span></div>`;

    const noEscort = G.res.fighters < 1;
    const buttons = [
      {
        id: 'isr', name: 'Push ISR — lock the position',
        desc: d.isr
          ? 'The position is locked and the on-scene commander has the picture.'
          : G.intelUsed
            ? 'Uses this turn\'s intelligence slot — already spent.'
            : 'Spend this turn\'s intelligence slot retasking national assets onto the survivors. Recovery +10%, capture risk −8%.',
        disabled: d.isr || G.intelUsed,
      },
      {
        id: 'go', name: 'LAUNCH THE RECOVERY — MQ-9 overwatch + Jolly package',
        desc: noEscort
          ? 'No fighter sorties left to escort the package in. Nothing goes in over that ground unescorted.'
          : `Costs 1 fighter sortie. Current recovery estimate: ${Math.round(p * 100)}%. ` +
            `Waiting makes it worse — and the alternative to going is a broadcast.`,
        disabled: noEscort,
        danger: true,
      },
    ];
    box.innerHTML = buttons.map(b =>
      `<button data-csar="${b.id}" ${b.disabled ? 'disabled' : ''} class="${b.danger ? 'specops-danger' : ''}">` +
      `${b.name}<span class="diplo-desc">${b.desc}</span></button>`).join('');
    for (const btn of box.querySelectorAll('button')) {
      btn.addEventListener('click', () => btn.dataset.csar === 'isr' ? doIsr() : openModal());
    }
  }

  // ---- ISR push (spends the turn's intelligence slot) ----
  function doIsr() {
    const G = Game.G;
    if (G.over || running || !G.downed || G.downed.isr || G.intelUsed) return;
    G.intelUsed = true;
    G.downed.isr = true;
    AudioSys.play('cable');
    UI.renderAll(G);
    UI.showReport('PERSONNEL RECOVERY — ISR TASKING', [{
      cls: 'friendly', title: 'National assets retasked onto the survivors',
      text: `A Reaper is overhead and an RC-135 is working the search parties' radios. ${G.downed.callsign} ` +
        `has been moved to a covered position and given a pickup point they can reach. The rescue force ` +
        `now knows what is between them and the survivors instead of guessing at it.`,
    }], () => Game.afterAction());
  }

  // ---- mission modal ----
  function openModal() {
    const G = Game.G;
    if (G.over || running || !G.downed || G.res.fighters < 1) return;
    const d = G.downed;
    const { p, parts } = odds(G);
    const pct = Math.round(p * 100);
    const sCls = pct >= 60 ? 'est-good' : pct >= 40 ? 'est-warn' : 'est-bad';
    $('csar-brief-text').textContent =
      `${d.callsign} — ${d.type} — went down ${d.loc}. ${d.crew === 2 ? 'Two aircrew are' : 'One aviator is'} ` +
      `on the ground and authenticated. The package is a pair of HH-60W Jolly Green IIs with a ` +
      `pararescue team aboard, an armed MQ-9 Reaper flying overwatch and precision fires, and tankers holding off the ` +
      `coast. It is the most exposed thing the Air Force does, it is flown into an alerted area, and ` +
      `nobody in this building will tell you not to go.`;
    let html = parts.map(([label, v]) =>
      `${label}: <span class="${v >= 0 ? 'est-good' : 'est-bad'}">${v >= 0 ? '+' : ''}${Math.round(v * 100)}%</span><br>`).join('');
    html += `EST. PROBABILITY OF RECOVERY: <span class="${sCls}">${pct}%</span><br>` +
      `<span class="dim">The recovery runs about seventy seconds. It is narrated live in the tactical panel.</span><br>` +
      `<span class="est-good">Bringing them home is worth more at home than any target on the map.</span><br>` +
      `<span class="est-warn">Costs 1 fighter sortie for the escort. There is one attempt.</span><br>` +
      `<span class="est-bad">Short of success, aircrew — and possibly a rescue crew — go into IRGC custody.</span>`;
    $('csar-estimate').innerHTML = html;
    $('csar-modal').classList.remove('hidden');
  }

  function closeModal() { $('csar-modal').classList.add('hidden'); }

  // ============================================================
  // BRANCHES
  // ============================================================
  // clean    — everyone comes home, nothing goes wrong
  // costly   — everyone comes home; the rescue force pays for it
  // partial  — the recovery force gets out without all of them
  // disaster — the rescue becomes the story
  function pickBranch(G) {
    const { p } = odds(G);
    if (Math.random() < p) {
      const cleanOdds = 0.45 + (G.downed.isr ? 0.15 : 0);
      return Math.random() < cleanOdds ? 'clean' : 'costly';
    }
    return Math.random() < 0.5 ? 'partial' : 'disaster';
  }

  // ============================================================
  // THE SCRIPT
  // ============================================================
  // Same grammar as the raid: { t, text, kind, phase, contested, audio, fx }.
  // {cs} is substituted with the callsign at run time.

  const INGRESS = [
    { t: 0, phase: 'ALERT LAUNCH', audio: 'launch',
      text: 'JOLLY 51 and 52 off the alert pad — REAPER 01 already on station overhead',
      fx: (v) => v.ingress(26000) },
    { t: 4500, text: '{cs} is up on guard — survival radio contact, weak but readable' },
    { t: 9000, kind: 'good', text: 'Authentication passed against the ISOPREP file. It is them.',
      fx: (v) => v.beacon() },
    { t: 13500, text: 'REAPER 01 holds the wheel overhead — sparkling the position with its targeting pod' },
    { t: 18000, kind: 'problem', contested: true,
      text: 'Vehicles on the track east of the position — dismounts, moving to search',
      fx: (v) => v.searchers(30000) },
    { t: 22000, phase: 'ON-SCENE', text: 'Two minutes. JOLLY 51 is committing.' },
  ];

  const BRANCHES = {
    // ---- everyone comes home ----
    clean: [
      { t: 26000, phase: 'RECOVERY', audio: 'impact',
        text: 'REAPER 01 in hot — Hellfire between the search party and the survivors',
        fx: (v) => v.gunRun(true) },
      { t: 30000, kind: 'good', contested: false,
        text: 'Search party broken up. Nobody is walking onto that position now.' },
      { t: 34000, text: 'JOLLY 51 flaring into the wadi — brownout, going in on instruments',
        fx: (v) => v.land(4000) },
      { t: 39000, text: 'PJs off the ramp. Thirty seconds on the ground.',
        fx: (v) => v.pickup(9) },
      { t: 44000, kind: 'good', audio: 'impact', text: 'ALL SURVIVORS ABOARD — nobody left in that wadi' },
      { t: 48000, phase: 'EGRESS', text: 'JOLLY 51 off the deck — nose down, running for the coast',
        fx: (v) => v.egress(11000) },
      { t: 53000, text: 'REAPER 01 covering the egress. Nothing coming off the track behind them.' },
      { t: 58000, kind: 'good', text: 'Feet wet. Both engines good, no holes worth counting.' },
      { t: 63000, phase: 'RECOVERY COMPLETE', text: 'Aircrew recovered. Medical is meeting them on the ramp.' },
    ],

    // ---- everyone comes home and the rescue force pays for it ----
    costly: [
      { t: 26000, phase: 'RECOVERY', audio: 'impact', text: 'REAPER 01 in hot — Hellfire short of the position',
        fx: (v) => v.gunRun(false) },
      { t: 30000, kind: 'problem', text: 'They went to ground and kept shooting. This is not a clean pattern.' },
      { t: 34000, kind: 'bad', audio: 'aircraftLost',
        text: 'JOLLY 51 TAKING 23MM ON SHORT FINAL — hits through the cabin',
        fx: (v) => { v.heloHit('jolly1'); v.land(4000); } },
      { t: 39000, kind: 'bad', text: 'One pararescueman down on the ramp before they reached the survivors',
        fx: (v) => { v.crewHit(); v.pickup(9); } },
      { t: 44000, kind: 'good', audio: 'impact', text: 'SURVIVORS ABOARD — thirty-one seconds on the ground' },
      { t: 48000, phase: 'EGRESS', kind: 'problem', text: 'JOLLY 51 lifting heavy — number two engine degraded',
        fx: (v) => v.egress(12000) },
      { t: 53000, kind: 'problem', text: 'Trailing fuel and losing pressure. REAPER 01 is walking them out.' },
      { t: 58000, kind: 'good', text: 'Feet wet — they made the water and put down on a destroyer\'s deck.' },
      { t: 63000, phase: 'RECOVERY COMPLETE — CASUALTIES',
        text: 'Aircrew recovered. The pararescueman who went out first did not come back.' },
    ],

    // ---- the recovery force comes out without all of them ----
    // The night forks on how many people were down there to begin with.
    partial: (d) => d.crew === 2 ? [
      { t: 26000, phase: 'RECOVERY', text: 'REAPER 01 in hot — Hellfire on the track',
        fx: (v) => v.gunRun(false) },
      { t: 30000, kind: 'bad', text: 'Second element on foot from the north. They had this position before we did.',
        fx: (v) => v.searchers(26000, 'north') },
      { t: 34000, kind: 'bad', text: 'The survivors are separated — four hundred metres between the beacons' },
      { t: 38000, text: 'JOLLY 51 going for the closer beacon first', fx: (v) => v.land(3500) },
      { t: 43000, kind: 'good', text: 'Pilot is aboard.', fx: (v) => v.pickup(1) },
      { t: 47000, kind: 'bad', text: 'Second beacon has stopped. The voice answering on it is not his.',
        fx: (v) => v.taken() },
      { t: 52000, kind: 'bad', audio: 'aircraftLost', text: 'Ground fire walking onto the aircraft — JOLLY 51 is hit',
        fx: (v) => v.heloHit('jolly1') },
      { t: 56000, phase: 'EGRESS', kind: 'bad',
        text: 'On-scene commander calls it. They are leaving with one man and not two.',
        fx: (v) => v.egress(11000) },
      { t: 61000, kind: 'bad', text: 'Nothing further from the second beacon. It is in their hands now.' },
      { t: 66000, phase: 'RECOVERY ENDED', text: 'One aircrew aboard. One on that hillside.' },
    ] : [
      { t: 26000, phase: 'RECOVERY', text: 'REAPER 01 in hot — Hellfire on the track',
        fx: (v) => v.gunRun(false) },
      { t: 30000, kind: 'bad', text: 'Second element on foot from the north. They had this position before we did.',
        fx: (v) => v.searchers(26000, 'north') },
      { t: 35000, kind: 'bad', text: 'The beacon is moving fast and in the wrong direction — that is not him walking' },
      { t: 40000, kind: 'bad', text: 'Voice on the survival radio answering in Farsi. The radio has changed hands.',
        fx: (v) => v.taken() },
      { t: 45000, kind: 'bad', audio: 'aircraftLost', text: 'JOLLY 51 taking fire in the hold — no hover, no hoist',
        fx: (v) => v.heloHit('jolly1') },
      { t: 50000, phase: 'EGRESS', kind: 'bad',
        text: 'On-scene commander calls it. There is nothing down there left to recover.',
        fx: (v) => v.egress(11000) },
      { t: 56000, kind: 'bad', text: 'Search parties are on the position the aircrew held forty minutes ago.' },
      { t: 61000, phase: 'RECOVERY ENDED', text: 'Recovery force is out. The aviator is not with them.' },
    ],

    // ---- the rescue becomes the story ----
    disaster: [
      { t: 26000, phase: 'RECOVERY', kind: 'bad', audio: 'retaliation',
        text: 'The wadi is a killing zone. This was laid on the beacon and we flew into it.',
        fx: (v) => v.gunRun(false) },
      { t: 30000, kind: 'bad', audio: 'aircraftLost',
        text: 'JOLLY 51 HIT ON SHORT FINAL — going in hard, north of the position',
        fx: (v) => v.heloDown('jolly1', true) },
      { t: 35000, kind: 'bad', text: 'Rescue crew is out of the wreck and pinned in the open',
        fx: (v) => v.crewHit() },
      { t: 39000, kind: 'bad', text: 'REAPER 01 knocked down as well — MANPADS off the ridge line',
        fx: (v) => v.mq9Down() },
      { t: 44000, kind: 'bad', text: 'JOLLY 52 is taking fire in the hold and cannot get in' },
      { t: 49000, phase: 'DANGER CLOSE', kind: 'bad',
        text: 'Aircrew, pararescuemen and a helicopter crew are all on that ground now' },
      { t: 54000, kind: 'bad', text: 'The beacons are going off the air one at a time',
        fx: (v) => v.taken() },
      { t: 59000, phase: 'EGRESS', kind: 'bad',
        text: 'JOLLY 52 is winchester and bingo fuel. On-scene commander pulls them out.',
        fx: (v) => v.egress(10000) },
      { t: 64000, kind: 'bad', text: 'Iranian television crews are already at the wreck of JOLLY 51.' },
      { t: 69000, phase: 'MISSION ENDED', text: 'Nothing further from the objective. Standing by for debrief.' },
    ],
  };

  // ============================================================
  // OUTCOMES — applied when the timeline finishes, never during it
  // ============================================================
  const OUTCOMES = {
    clean(G, d, events) {
      G.stats.aircrewRescued += d.crew;
      G.approval = clamp(G.approval + 8, 0, 100);
      G.world = clamp(G.world + 3, 0, 100);
      events.push({
        cls: 'friendly', title: `RECOVERY COMPLETE — ${d.callsign} IS OUT`,
        text: `${d.crew === 2 ? 'Both aircrew are' : 'The pilot is'} aboard the recovery ship, dehydrated ` +
          `and intact, ${Math.round(4 + Math.random() * 6)} hours after ejecting over hostile ground. ` +
          `Nobody in the rescue package was hurt. The footage Tehran was preparing to run tonight does ` +
          `not exist, and the picture the country gets instead is a flight suit walking off a ramp under ` +
          `its own power. There is no target on that map worth what this is worth at home.`,
        dApproval: 8, dWorld: 3,
      });
    },

    costly(G, d, events) {
      G.stats.aircrewRescued += d.crew;
      G.casualties.us += 1;
      G.approval = clamp(G.approval + 5, 0, 100);
      events.push({
        cls: 'friendly', title: `RECOVERY COMPLETE — ONE PARARESCUEMAN KILLED`,
        text: `${d.crew === 2 ? 'Both aircrew are' : 'The pilot is'} out. It cost a pararescueman, ` +
          `killed on the ground covering the pickup, and an airframe that will not fly again without a ` +
          `depot. The aircraft came off the objective heavy, on one good engine, trailing fuel, and put ` +
          `down on a destroyer with the survivors alive in the back. Everyone in that squadron would ` +
          `fly it again tomorrow. That is the part that is hard to explain to the family.`,
        casualties: 1, dApproval: 5,
      });
    },

    partial(G, d, events) {
      G.hostageCrisis = true;
      const saved = d.crew === 2 ? 1 : 0;
      const taken = d.crew - saved;
      G.stats.aircrewRescued += saved;
      G.stats.aircrewCaptured += taken;
      G.approval = clamp(G.approval - (saved ? 6 : 9), 0, 100);
      G.world = clamp(G.world - 3, 0, 100);
      events.push({
        cls: 'iran', title: saved
          ? 'PARTIAL RECOVERY — ONE AIRCREW ABOARD, ONE IN IRGC HANDS'
          : `RECOVERY FAILED — ${d.callsign} TAKEN ALIVE`,
        text: saved
          ? `The pilot is out. The weapons systems officer was four hundred metres away when the second ` +
            `search element came over the ridge, and the aircraft was taking fire it could not sit through. ` +
            `The on-scene commander made the call that everyone in that cockpit will spend the rest of ` +
            `their life defending. By morning Iranian television has the man they took, blindfolded, ` +
            `named — and the man who came home has to watch it too.`
          : `The recovery force reached the position and found the search parties already on it. The ` +
            `survival radio changed hands while the helicopters were in the hold. ${d.callsign} is in ` +
            `IRGC custody, on television by morning, and the aircraft that went to get him came back ` +
            `shot up and empty. Nothing about this reads as anything but a failure, because it was one.`,
        dApproval: saved ? -6 : -9, dWorld: -3,
      });
    },

    disaster(G, d, events) {
      G.hostageCrisis = true;
      G.stats.aircrewCaptured += d.crew;
      G.stats.aircraftLost += 2;
      const c = rand(4, 9);
      G.casualties.us += c;
      G.approval = clamp(G.approval - 15, 0, 100);
      G.world = clamp(G.world - 8, 0, 100);
      events.push({
        cls: 'iran', title: 'RECOVERY FORCE DESTROYED — THE RESCUE IS NOW THE STORY',
        text: `The beacon was a trap and the package flew into it. A Jolly went in on short final with a ` +
          `pararescue team aboard, the MQ-9 flying overwatch was knocked out of the sky by a shoulder-launched missile ` +
          `over the ridge, and the second helicopter could not get in to either of them. ${c} Americans ` +
          `are dead. ${d.crew === 2 ? 'The aircrew and' : 'The aviator and'} the survivors of the ` +
          `helicopter crew are in IRGC custody — more prisoners than the shootdown created, taken by the ` +
          `operation launched to prevent it. Iranian state television is running the wreckage on a loop ` +
          `with the prisoners intercut. Every network at home is running it too, and the question under ` +
          `it is who ordered the rescue.`,
        casualties: c, dApproval: -15, dWorld: -8,
      });
    },
  };

  // ============================================================
  // THE RUNNER
  // ============================================================
  function lock(on) {
    running = on;
    const app = $('app');
    if (app) app.classList.toggle('raid-running', on);
  }

  function runMission(branch, d, onDone) {
    const tail = BRANCHES[branch];
    const steps = INGRESS.concat(typeof tail === 'function' ? tail(d) : tail);
    const total = steps[steps.length - 1].t + 2500;
    const view = MapView.csarOpen(
      `${d.callsign} RECOVERY · JOLLY 51 — ${d.loc.toUpperCase()}`, d.crew, () => finish(true), total);

    let phase = 'ALERT LAUNCH', contested = false, done = false;
    const timers = [];

    const t0 = performance.now();
    (function tick(now) {
      if (done) return;
      view.phase(Math.min(1, (now - t0) / total), phase, contested);
      requestAnimationFrame(tick);
    })(t0);

    for (const step of steps) {
      timers.push(setTimeout(() => {
        if (done) return;
        if (step.phase) phase = step.phase;
        if (step.contested !== undefined) contested = step.contested;
        view.log(step.text.replace('{cs}', d.callsign), step.kind || 'status', step.t);
        if (step.audio) AudioSys.play(step.audio);
        if (step.fx) { try { step.fx(view); } catch (e) { console.error('csar fx failed', e); } }
      }, step.t));
    }

    // Skipping cuts the theatre, never the result.
    function finish(skipped) {
      if (done) return;
      done = true;
      for (const id of timers) clearTimeout(id);
      view.phase(1, skipped ? 'SKIPPED' : phase, false);
      view.close(skipped ? 300 : 4500);
      onDone();
    }

    timers.push(setTimeout(() => finish(false), total));
  }

  // ---- resolution ----
  function executeRescue() {
    const G = Game.G;
    if (G.over || running || !G.downed || G.res.fighters < 1) return;
    closeModal();

    const d = G.downed;
    const branch = pickBranch(G);   // decided here, before anything is drawn

    G.res.fighters -= 1;            // the fighter escort is a real sortie
    G.downed = null;                // one attempt: the situation resolves tonight
    syncMap(G);
    lock(true);
    UI.renderAll(G);

    runMission(branch, d, () => {
      const events = [];
      OUTCOMES[branch](G, d, events);
      lock(false);
      UI.renderAll(G);
      UI.showReport('PERSONNEL RECOVERY — MISSION DEBRIEF', events, () => Game.afterAction());
    });
  }

  // ---- wiring ----
  function init() {
    $('btn-confirm-rescue').addEventListener('click', executeRescue);
  }

  return { init, renderPanel, aircraftDown, turnTick, syncMap, busy: () => running };
})();
