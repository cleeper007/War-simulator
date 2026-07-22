// ============================================================
// data.js — static game data: targets, US assets, geography refs
// ============================================================

// ---- Iranian strategic targets ----
// world: world-opinion cost per strike
// packages: valid strike options {asset, qty, base (success), label}
const TARGETS = [
  {
    id: 'ad-tehran', name: 'Tehran Air Defense Network', short: 'AD TEHRAN',
    type: 'airdefense', x: 417, y: 130,
    desc: 'Long-range SAM belt covering the capital region. Degrading it improves survivability of all non-stealth strikes.',
    world: -2,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.70, label: 'SEAD sweep — 2 fighter sorties' },
      { asset: 'cruise', qty: 3, base: 0.85, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'ad-isfahan', name: 'Isfahan Air Defense Complex', short: 'AD ISFAHAN',
    type: 'airdefense', x: 439, y: 259,
    desc: 'Central SAM network screening the nuclear sites. Degrading it improves survivability of all non-stealth strikes.',
    world: -2,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.72, label: 'SEAD sweep — 2 fighter sorties' },
      { asset: 'cruise', qty: 3, base: 0.85, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'ad-bandar', name: 'Bandar Abbas Coastal Defense', short: 'AD BANDAR',
    type: 'airdefense', x: 563, y: 449,
    desc: 'Coastal radar and SAM coverage over the Strait of Hormuz approaches.',
    world: -2,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.74, label: 'SEAD sweep — 2 fighter sorties' },
      { asset: 'cruise', qty: 3, base: 0.86, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'natanz', name: 'Natanz Enrichment Facility', short: 'NATANZ',
    type: 'nuclear', x: 441, y: 218,
    desc: 'Primary enrichment site. Partially buried — cruise missiles can damage surface halls but only penetrators guarantee destruction. PRIMARY OBJECTIVE.',
    world: -5,
    packages: [
      { asset: 'stealth', qty: 1, base: 0.90, label: 'B-2 mission — GBU-57 penetrators' },
      { asset: 'cruise', qty: 5, base: 0.48, label: 'Saturation TLAM strike — limited vs buried halls' },
    ],
  },
  {
    id: 'fordow', name: 'Fordow Enrichment Plant', short: 'FORDOW',
    type: 'nuclear', x: 416, y: 174, hardened: true,
    desc: 'Enrichment halls buried under 80m of rock. ONLY a B-2 with GBU-57 penetrators has any chance. PRIMARY OBJECTIVE.',
    world: -5,
    packages: [
      { asset: 'stealth', qty: 1, base: 0.80, label: 'B-2 mission — GBU-57 penetrators (only viable option)' },
    ],
  },
  {
    id: 'irgc-hq', name: 'IRGC Command Complex — Tehran', short: 'IRGC HQ',
    type: 'command', x: 447, y: 157,
    desc: 'Revolutionary Guard national command node. Striking it disrupts coordination of retaliation but is highly provocative.',
    world: -3,
    packages: [
      { asset: 'cruise', qty: 2, base: 0.80, label: 'TLAM decapitation strike — 2 missiles' },
      { asset: 'fighter', qty: 2, base: 0.70, label: 'Precision air strike — 2 sorties' },
    ],
  },
  {
    id: 'msl-kermanshah', name: 'Kermanshah Missile Base', short: 'MSL KERMANSHAH',
    type: 'missile', x: 285, y: 196,
    desc: 'Ballistic missile brigade in range of US bases in Iraq. Destroying it reduces the weight of Iranian missile retaliation.',
    world: -3,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.70, label: 'Air strike — 2 fighter sorties' },
      { asset: 'cruise', qty: 3, base: 0.80, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'msl-shiraz', name: 'Shiraz Missile Base', short: 'MSL SHIRAZ',
    type: 'missile', x: 469, y: 374,
    desc: 'Missile brigade covering the Gulf littoral and US bases in Qatar/UAE. Destroying it reduces Iranian retaliation weight.',
    world: -3,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.72, label: 'Air strike — 2 fighter sorties' },
      { asset: 'cruise', qty: 3, base: 0.80, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'naval-bandar', name: 'Bandar Abbas Naval Base', short: 'NAV BANDAR',
    type: 'naval', x: 590, y: 467,
    desc: 'Home port of the fast-attack craft and midget submarines threatening Hormuz shipping. Key to keeping the Strait open.',
    world: -3,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.76, label: 'Air strike — 2 fighter sorties' },
      { asset: 'cruise', qty: 2, base: 0.82, label: 'TLAM salvo — 2 cruise missiles' },
    ],
  },
  {
    id: 'naval-bushehr', name: 'Bushehr Naval Base', short: 'NAV BUSHEHR',
    type: 'naval', x: 411, y: 398,
    desc: 'IRGC-Navy swarm-boat base in the central Gulf. Threatens the carrier strike group.',
    world: -3,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.76, label: 'Air strike — 2 fighter sorties' },
      { asset: 'cruise', qty: 2, base: 0.82, label: 'TLAM salvo — 2 cruise missiles' },
    ],
  },
  {
    id: 'ship-mahdavi', name: 'IRIS Shahid Mahdavi — Gulf of Oman', short: 'MAHDAVI',
    type: 'ship', x: 703, y: 586,
    desc: 'IRGC-Navy forward base ship operating outside the Strait, carrying anti-ship missiles and drones well past the Gulf. A hull at sea, not a pier — she moves, and she is the closest Iranian shooter to the carrier box. One weapon that finds her ends her; there is no damaging a ship into repairing itself.',
    world: -3,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.80, label: 'Air strike — 2 fighter sorties' },
      { asset: 'cruise', qty: 2, base: 0.84, label: 'TLAM salvo — 2 cruise missiles' },
      // The cheapest shot in the game and the slowest: one weapon, no aircrew,
      // nothing on anyone's radar — but the boat has to close the range first.
      { asset: 'cruise', qty: 1, base: 0.88, eta: 2, sub: true,
        label: 'SUBMARINE ATTACK — 1 maritime-strike Tomahawk (2 turns to get on station)' },
    ],
  },
  {
    id: 'ship-caspian', name: 'IRGC Caspian Flotilla — Bandar-e Anzali', short: 'CASPIAN FLOT',
    type: 'ship', x: 392, y: 72,
    desc: 'Missile craft in the Caspian, 900 nm from the Gulf and beyond the fight — but a live hull all the same. The Caspian is a closed sea with Moscow on the far shore: putting American ordnance in it costs far more abroad than the tonnage is worth. No submarine has ever reached it and none ever will — this one is aircraft and cruise missiles or nothing.',
    world: -8,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.62, label: 'Air strike — 2 fighter sorties (deep, unrefuelled leg)' },
      { asset: 'cruise', qty: 3, base: 0.76, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'tabriz-ab', name: 'Tabriz Air Base', short: 'TABRIZ AB',
    type: 'airbase', x: 260, y: 54,
    desc: 'Second Tactical Air Base — MiG-29 and F-5 squadrons covering the northwestern approaches, and the dispersal field aircraft are flown to when the interior is hit. Far from the Gulf: a long way in and a long way back out.',
    world: -3,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.66, label: 'Air strike — 2 fighter sorties (deep, unrefuelled leg)' },
      { asset: 'cruise', qty: 3, base: 0.80, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'kharg', name: 'Kharg Island Oil Terminal', short: 'KHARG OIL',
    type: 'oil', x: 394, y: 387,
    desc: 'Handles ~90% of Iranian crude exports. Crippling it strangles Tehran\'s economy — and spikes global oil prices. Heavy diplomatic cost.',
    world: -12,
    packages: [
      { asset: 'cruise', qty: 3, base: 0.86, label: 'TLAM salvo — 3 cruise missiles' },
      { asset: 'fighter', qty: 2, base: 0.72, label: 'Air strike — 2 fighter sorties' },
    ],
  },
  {
    id: 'abadan', name: 'Abadan Refinery', short: 'ABADAN REF',
    type: 'oil', x: 327, y: 346,
    desc: 'Iran\'s largest domestic fuel refinery. An economic pressure target with severe diplomatic blowback.',
    world: -12,
    packages: [
      { asset: 'cruise', qty: 3, base: 0.86, label: 'TLAM salvo — 3 cruise missiles' },
      { asset: 'fighter', qty: 2, base: 0.72, label: 'Air strike — 2 fighter sorties' },
    ],
  },
];

// ---- durability model ----
// Fixed installations are worn down rather than switched off. Every target
// carries a 0–100 condition track; a package takes a bite out of it and the
// site keeps fighting on whatever is left. What a site does with the nights you
// spend somewhere else is repair — spare radars rolled out of the dispersal
// revetments, craters filled, a replacement crane barged in — so anything left
// standing at 20% is back at 60% in a few days if you look away. Zero is
// permanent: nobody reconstitutes rubble in the middle of a war.
//
// Two kinds of target sit outside this and take damage in whole steps the way
// they always have. A hull is afloat or it is on the bottom and it never comes
// back up; and the buried enrichment halls are all-or-nothing by design.
// Types absent from this table are the ones that neither wear down nor repair.
const TARGET_REPAIR = {
  command:    14,   // radios and staff officers — a command node reconstitutes fastest
  airdefense: 12,   // spare launchers and engagement radars rolled out of dispersal
  airbase:    12,   // fill the craters, sweep the ramp, fly again by morning
  missile:    10,   // the TELs were always hidden; the brigade rebuilds around them
  naval:       8,   // piers, cranes and fuel farms take longer than a runway does
  oil:         5,   // refinery trains and loading berths are the slowest of all
};

// Full-effect damage of one strike package. A package is a package: the
// differences between platforms are already priced into probability of kill,
// world opinion, and what the sortie costs you — not into tonnage. So two good
// packages finish a fixed site, and everything short of two good packages is
// a race against the repair crews. Individual packages override with `dmg`.
const PKG_DAMAGE = 55;

// ---- US assets shown on the map ----
// sortie: can generate fixed-wing strike sorties (flight animations launch
// from the nearest sortie-capable base); atacms: hosts Army long-range fires
// (ATACMS/PrSM) — drawn with range rings on the forward-basing layer;
// forward: lives on the toggleable forward-basing layer (off by default)
const US_ASSETS = [
  { id: 'csg-lincoln', name: 'USS Abraham Lincoln', short: 'LINCOLN', x: 800, y: 668, kind: 'carrier', sortie: true,
    desc: 'The only carrier strike group in theater, on station in the North Arabian Sea some 250 nm southeast of Ra\'s al Hadd — out of the Gulf of Oman entirely, and still inside the anti-ship weapons Iran shoots the farthest. Full sortie generation, flown in over Oman on tankers.' },
  // labelAbove keeps her name clear of neighbouring labels on the way in
  { id: 'csg-ford', name: 'USS Gerald R. Ford', short: 'FORD', x: 1120, y: 790, kind: 'carrier', sortie: true, active: false, labelAbove: true,
    desc: 'Second carrier strike group. Not in theater — she has to be sent for, and she has an ocean to cross.' },
  { id: 'udeid', name: 'Al Udeid AB — Qatar', short: 'AL UDEID', x: 427, y: 543, kind: 'airbase', sortie: true,
    desc: 'Forward headquarters, tankers and strike aircraft. Within Iranian ballistic missile range.' },
  { id: 'dhafra', name: 'Al Dhafra AB — UAE', short: 'AL DHAFRA', x: 535, y: 576, kind: 'airbase', sortie: true,
    desc: 'F-35 squadrons and ISR platforms. Within Iranian ballistic missile range.' },
  { id: 'asad', name: 'Ain al-Asad AB — Iraq', short: 'AIN AL-ASAD', x: 131, y: 216, kind: 'airbase', sortie: true,
    desc: 'US forces in western Iraq. Repeatedly targeted by Iranian missiles and proxy rockets.' },
  // active: false — the ramp is bare until the bomber force is called forward
  // from Whiteman AFB. Nothing stealthy exists in this theater until it is.
  // parked in the open water south of Oman's cape, clear of the carrier boxes
  // out east; the arrow points off the bottom of the chart, which is where the
  // atoll actually is
  { id: 'diego', name: 'Diego Garcia (B-2 staging)', short: 'B-2 // DIEGO GARCIA ↓', x: 660, y: 730, kind: 'bomber', active: false,
    desc: 'Staging field 2,900 nm south. Empty until the 509th Bomb Wing is deployed forward from Whiteman AFB, Missouri — and the B-2 is the only platform that can kill Fordow.' },
  // The one American shooter Iran cannot see, plotted where Fifth Fleet last had
  // her rather than where she is. She takes her Tomahawks out of the same
  // theater magazine everything else does — a submarine shot is not a free shot,
  // it is the same missile fired from somewhere nobody is looking.
  { id: 'ssn-toledo', name: 'USS Toledo — Gulf of Oman', short: 'TOLEDO (SSN)', x: 655, y: 545, kind: 'submarine',
    desc: 'Los Angeles-class attack submarine on patrol in the Gulf of Oman. She carries maritime-strike Tomahawks and nothing on the Iranian side has ever held her on sonar. Against a hull at sea she is the cheapest weapon in the theater — one missile, no aircrew, no warning — and the slowest, because she has to close the range submerged before she shoots.' },

  // -- forward basing layer (projected from real coordinates; toggle in map header) --
  { id: 'arifjan', name: 'Camp Arifjan — Kuwait', short: 'ARIFJAN', x: 322, y: 401, kind: 'logistics',
    forward: true, sortie: false, atacms: true,
    desc: 'Army logistics hub south of Kuwait City. Sustains the theater and hosts long-range fires (ATACMS/PrSM).' },
  { id: 'nsa-bahrain', name: 'Naval Support Activity Bahrain', short: 'NSA BAHRAIN', x: 404, y: 502, kind: 'naval',
    forward: true, sortie: false, atacms: false,
    desc: 'Headquarters of the Fifth Fleet — the command node for everything afloat in the Gulf.' },
  { id: 'alisalem', name: 'Ali Al Salem AB — Kuwait', short: 'ALI AL SALEM', x: 300, y: 383, kind: 'airbase',
    forward: true, sortie: true, atacms: false,
    desc: '"The Rock." Airlift and fighter operations from western Kuwait, minutes from Iranian airspace.' },
  { id: 'psab', name: 'Prince Sultan AB — Saudi Arabia', short: 'PRINCE SULTAN', x: 302, y: 583, kind: 'airbase',
    forward: true, sortie: true, atacms: false,
    desc: 'Fighters, tankers and Patriot batteries in the Saudi interior, buying standoff from the Gulf littoral.' },
  { id: 'salti', name: 'Muwaffaq Salti AB — Jordan', short: 'MUWAFFAQ SALTI', x: -58, y: 289, kind: 'airbase',
    forward: true, sortie: true, atacms: false,
    desc: 'F-16 and F-15E operations from Jordan\'s eastern desert, covering the western axis. (Pan west to see it.)' },
  { id: 'harir', name: 'Harir AB — Iraq', short: 'HARIR', x: 194, y: 111, kind: 'airbase',
    forward: true, sortie: true, atacms: false,
    desc: 'Airstrip in the Kurdish highlands supporting operations across northern Iraq.' },
  { id: 'erbil', name: 'Erbil AB — Iraq', short: 'ERBIL', x: 182, y: 123, kind: 'airbase',
    forward: true, sortie: true, atacms: false,
    desc: 'US air operations hub in Iraqi Kurdistan. Struck by Iranian ballistic missiles before — and in range now.' },
  { id: 'buehring', name: 'Camp Buehring — Kuwait', short: 'BUEHRING', x: 286, y: 372, kind: 'logistics',
    forward: true, sortie: false, atacms: true,
    desc: 'Forward staging camp in the Kuwaiti desert. HIMARS batteries here hold Iranian territory at risk.' },

  // -- Israeli air force bases: allied, not American (ally: true draws them in
  //    amber rather than US blue). Far west of the Gulf — pan west to see them.
  { id: 'nevatim', name: 'Nevatim AB — Israel', short: 'NEVATIM', x: -117, y: 313, kind: 'airbase',
    forward: true, ally: true, sortie: false, atacms: false,
    desc: 'IAF F-35I "Adir" and heavy transport base in the Negev. The long-range strike force flies from here. (Pan west to see it.)' },
  { id: 'hatzerim', name: 'Hatzerim AB — Israel', short: 'HATZERIM', x: -129, y: 312, kind: 'airbase',
    forward: true, ally: true, sortie: false, atacms: false, labelAbove: true,
    desc: 'IAF F-15I and F-16I squadrons west of Beersheba — the aircraft that would fly a deep-strike package into Iran.' },
];

// ---- carrier strike groups ----
// Ships are referred to by name everywhere the player can see them — hull
// numbers mean nothing at a glance in the middle of a war.
const CARRIER_INFO = {
  'csg-lincoln': { name: 'USS Abraham Lincoln', short: 'LINCOLN' },
  'csg-ford':    { name: 'USS Gerald R. Ford',  short: 'FORD' },
};

// Nobody parks a supercarrier in the Gulf of Oman. Both stations below are out
// in the Arabian Sea, east of the easternmost point of Oman and on the water
// between Oman and India — FORWARD is the North Arabian Sea box at roughly
// 22N 63E, close enough for the air wing to reach Iran on tankers and still
// inside the outer edge of Iran's anti-ship reach. BACK is 200-odd miles
// further southeast, down toward the Indian Ocean approaches at roughly 20N
// 65E: untouchable, and half the sortie rate for the tanker distance.
// Repositioning between them takes a turn, and that turn is spent at reduced
// capability while still exposed. Every station sits in open water clear of
// both coasts; check any change against the coastline.
const CARRIER_STATIONS = {
  'csg-lincoln': { forward: { x: 800, y: 668 }, back: { x: 880, y: 736 } },
  'csg-ford':    { forward: { x: 846, y: 646 }, back: { x: 940, y: 718 } },
};

// Where the Ford begins her run-in: over the horizon southeast of the plot,
// outside the frame, coming up out of the Indian Ocean. She closes one leg per
// turn until she's on station.
const FORD_INGRESS = { x: 1120, y: 790 };

// map from asset type to launch origin on the map. `sub` is not an asset type —
// it is the cruise magazine fired from a different hull (see the `sub` flag on
// strike packages), and it needs its own origin so the inbound bearing on the
// scope comes from where the boat is rather than from where the carrier is.
const STRIKE_ORIGINS = { fighter: 'csg-lincoln', cruise: 'csg-lincoln', stealth: 'diego', sub: 'ssn-toledo' };

const ASSET_NAMES = {
  fighter: 'Fighter sorties',
  cruise: 'Cruise missiles (TLAM)',
  stealth: 'B-2 bomber missions',
};

// ---- projection scale ----
// The map is equirectangular (standard parallel 28°N): ~33.4 px/°lon,
// ~37.8 px/°lat, which works out to 0.34 projected units per km.
const KM_TO_MAP = 0.34;

// Range rings drawn around ATACMS-capable positions on the forward layer
const MISSILE_RANGES = [
  { name: 'ATACMS 300 KM', km: 300, cls: 'ring-atacms' },
  { name: 'PrSM 500 KM', km: 500, cls: 'ring-prsm' },
];

// ---- flight animation config ----
// Animation length (ms) for each strike asset's map animation
const FLIGHT_DUR = { fighter: 10500, stealth: 16000, cruise: 6500 };

// Fighter airframes: a random one flies each fighter package. cs is the
// callsign root; from decides whether it launches off a carrier or a land base.
const FIGHTER_TYPES = [
  { type: 'F-35A', cs: 'PANTHER', from: 'land' },
  { type: 'F/A-18E', cs: 'RHINO', from: 'carrier' },
  { type: 'F-16C', cs: 'VIPER', from: 'land' },
  { type: 'F-15E', cs: 'MUDHEN', from: 'land' },
  { type: 'F-22A', cs: 'RAPTOR', from: 'land' },
];

// Every in-flight status / problem message lives here — edit freely.
//   at:    fraction of the flight when the entry fires (values > 1 fire on the
//          egress leg home, where 1.0 = weapons away and 2.0 = animation end)
//   kind:  'status' always fires; 'problem' fires with probability `chance`
//   only:  'stealth' | 'fighter' restricts an entry to that platform
//   msgs:  one is picked at random; {cs} {base} {tgt} are substituted
const FLIGHT_EVENTS = [
  { at: 0.02, kind: 'status', msgs: [
    '{cs} wheels up — departing {base}',
    '{cs} airborne out of {base}, climbing on mission profile',
  ] },
  { at: 0.18, kind: 'status', only: 'stealth', msgs: [
    'Aerial refueling over the Indian Ocean — tanker rendezvous complete',
  ] },
  { at: 0.22, kind: 'status', only: 'fighter', msgs: [
    'On the tanker — topping off before the push',
    'Refueling complete — pushing to the line',
  ] },
  { at: 0.42, kind: 'status', msgs: [
    'Feet dry — entering contested airspace',
    'Crossing into Iranian airspace — emissions control, sensors cold',
  ] },
  { at: 0.55, kind: 'problem', chance: 0.4, msgs: [
    'SAM search radar spike — defensive maneuvering',
    'GPS jamming detected — reverting to inertial guidance',
    'Iranian interceptors scrambling — flight is committing anyway',
  ] },
  { at: 0.72, kind: 'problem', chance: 0.35, msgs: [
    'SA-15 launch detected — countermeasures out',
    'Heavy AAA over the target area',
    'Threat ring active — rerouting around the engagement zone',
  ] },
  { at: 0.86, kind: 'status', msgs: [
    'Final attack run — master arm hot',
    'Target designated — weapons release imminent',
  ] },
  { at: 0.99, kind: 'status', msgs: ['ON TARGET — weapons away'] },
  { at: 1.15, kind: 'status', msgs: [
    'Off target — egressing the threat envelope at speed',
  ] },
  { at: 1.75, kind: 'status', msgs: [
    '{cs} feet wet — RTB {base}',
    '{cs} clear of Iranian airspace — returning to {base}',
  ] },
];

// TLAMs fly themselves — no crew, no tanker, no egress. Their own short set of
// lines keeps the scope reading as an unmanned shot rather than a sortie.
const CRUISE_EVENTS = [
  { at: 0.02, kind: 'status', msgs: [
    '{cs} away — vertical launch, {base}',
    'Birds away from {base} — {cs} in the boost phase',
  ] },
  { at: 0.35, kind: 'status', msgs: [
    'Terrain-following, sea-skimming profile — {cs} in the weeds',
    'Midcourse waypoints good — {cs} tracking on inertial',
  ] },
  { at: 0.7, kind: 'problem', chance: 0.3, msgs: [
    'Weather over the target — cloud deck degrading the terminal seeker',
    'One bird lost to a booster fault after launch — remainder pressing',
    'Targeting package flagged stale — running on last-good coordinates',
  ] },
  { at: 0.99, kind: 'status', msgs: ['TERMINAL — {tgt} impact'] },
];

// A submarine shot is a different kind of quiet. There is no tanker, no
// formation and nothing for Iran to see coming — the whole event is a boat
// holding a firing solution long enough to take the shot and then going deep.
const SUB_EVENTS = [
  { at: 0.02, kind: 'status', msgs: [
    '{base} at launch depth — {cs} away, one weapon',
    'Firing solution good — {cs} clear of the tube out of {base}',
  ] },
  { at: 0.3, kind: 'status', msgs: [
    'Breach and boost — {cs} on the deck, running to the datum',
    '{cs} sea-skimming inbound — nothing radiating, nothing to warn her',
  ] },
  { at: 0.68, kind: 'problem', chance: 0.25, msgs: [
    'Target maneuvered off the firing solution — weapon re-attacking on its own seeker',
    'Merchant traffic in the terminal basket — discrimination is on the seeker now',
  ] },
  { at: 0.99, kind: 'status', msgs: ['TERMINAL — {tgt} impact'] },
];

// Fired into the scope's status lines the moment a SAM actually leaves the ring,
// so the text and the streak on the mini display are the same event.
const SAM_LINES = [
  'SA-15 launch detected — countermeasures out',
  'SA-20 uplink — missile inbound, breaking hard',
  'Launch warning — flares and chaff away',
  'Engagement radar locked — defeating with a beam maneuver',
];

// ---- Iranian counterattack launch sites (projected coords inside Iran) ----
// Missile salvos rise from the surviving missile-base targets (tgtId links a
// site to its TARGETS entry — destroyed bases stop launching); the last entry
// is the fallback for dispersed IRGC launchers. Drones swarm from the interior.
const IRAN_LAUNCH_SITES = {
  missile: [
    { x: 285, y: 196, tgtId: 'msl-kermanshah' },
    { x: 469, y: 374, tgtId: 'msl-shiraz' },
    { x: 434, y: 152 },
  ],
  drone: [
    { x: 330, y: 262 },
    { x: 402, y: 305 },
    { x: 528, y: 418 },
  ],
};

// ---- Hormuz indicator location ----
const HORMUZ_POS = { x: 607, y: 494 };

// ---- Filler headlines (mixed into the ticker every turn) ----
const FILLER_HEADLINES = [
  'MARKETS ON EDGE AS GULF WAR ENTERS ANOTHER DAY',
  'PENTAGON DECLINES COMMENT ON FORCE MOVEMENTS',
  'ALLIES SEEK CLARITY ON WASHINGTON\'S ENDGAME',
  'SHIPPING INSURERS RAISE GULF TRANSIT PREMIUMS AGAIN',
  'CONGRESSIONAL LEADERS BRIEFED IN CLOSED SESSION',
  'EU CALLS EMERGENCY MEETING ON ENERGY SECURITY',
  'TEHRAN STATE TV AIRS FOOTAGE OF MISSILE UNITS ON THE MOVE',
  'FIFTH FLEET: TRANSITS CONTINUING "AS CONDITIONS PERMIT"',
  'OPEC MEMBERS SIGNAL SPARE CAPACITY IS LIMITED',
  'UN SECRETARY-GENERAL URGES "MAXIMUM RESTRAINT"',
];
