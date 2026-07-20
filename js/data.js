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

// ---- US assets shown on the map ----
// sortie: can generate fixed-wing strike sorties (flight animations launch
// from the nearest sortie-capable base); atacms: hosts Army long-range fires
// (ATACMS/PrSM) — drawn with range rings on the forward-basing layer;
// forward: lives on the toggleable forward-basing layer (off by default)
const US_ASSETS = [
  { id: 'csg-gulf', name: 'CSG-9 — Persian Gulf', short: 'CVN-71 CSG', x: 437, y: 476, kind: 'carrier', sortie: true,
    desc: 'Carrier strike group operating in the central Gulf. Launches fighter sorties and Tomahawks.' },
  { id: 'csg-arabian', name: 'CSG-3 — Arabian Sea', short: 'CVN-68 CSG', x: 767, y: 604, kind: 'carrier', sortie: true,
    desc: 'Carrier strike group in the Arabian Sea, outside Iranian missile range.' },
  { id: 'udeid', name: 'Al Udeid AB — Qatar', short: 'AL UDEID', x: 427, y: 543, kind: 'airbase', sortie: true,
    desc: 'Forward headquarters, tankers and strike aircraft. Within Iranian ballistic missile range.' },
  { id: 'dhafra', name: 'Al Dhafra AB — UAE', short: 'AL DHAFRA', x: 535, y: 576, kind: 'airbase', sortie: true,
    desc: 'F-35 squadrons and ISR platforms. Within Iranian ballistic missile range.' },
  { id: 'asad', name: 'Ain al-Asad AB — Iraq', short: 'AIN AL-ASAD', x: 131, y: 216, kind: 'airbase', sortie: true,
    desc: 'US forces in western Iraq. Repeatedly targeted by Iranian missiles and proxy rockets.' },
  { id: 'diego', name: 'Diego Garcia (B-2 staging)', short: 'B-2 // DIEGO GARCIA →', x: 895, y: 655, kind: 'bomber',
    desc: 'Stealth bombers staging 2,900 nm south. The only platform that can kill Fordow.' },

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
];

// map from asset type to launch origin on the map
const STRIKE_ORIGINS = { fighter: 'csg-gulf', cruise: 'csg-gulf', stealth: 'diego' };

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
const FLIGHT_DUR = { fighter: 5500, stealth: 9000, cruise: 1000 };

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
