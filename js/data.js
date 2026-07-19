// ============================================================
// data.js — static game data: targets, US assets, geography refs
// ============================================================

// ---- Iranian strategic targets ----
// esc: escalation added per strike, world: world-opinion cost per strike
// packages: valid strike options {asset, qty, base (success), label}
const TARGETS = [
  {
    id: 'ad-tehran', name: 'Tehran Air Defense Network', short: 'AD TEHRAN',
    type: 'airdefense', x: 497, y: 218,
    desc: 'Long-range SAM belt covering the capital region. Degrading it improves survivability of all non-stealth strikes.',
    esc: 1.0, world: -2,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.70, label: 'SEAD sweep — 2 fighter sorties' },
      { asset: 'cruise', qty: 3, base: 0.85, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'ad-isfahan', name: 'Isfahan Air Defense Complex', short: 'AD ISFAHAN',
    type: 'airdefense', x: 520, y: 322,
    desc: 'Central SAM network screening the nuclear sites. Degrading it improves survivability of all non-stealth strikes.',
    esc: 1.0, world: -2,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.72, label: 'SEAD sweep — 2 fighter sorties' },
      { asset: 'cruise', qty: 3, base: 0.85, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'ad-bandar', name: 'Bandar Abbas Coastal Defense', short: 'AD BANDAR',
    type: 'airdefense', x: 628, y: 398,
    desc: 'Coastal radar and SAM coverage over the Strait of Hormuz approaches.',
    esc: 1.0, world: -2,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.74, label: 'SEAD sweep — 2 fighter sorties' },
      { asset: 'cruise', qty: 3, base: 0.86, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'natanz', name: 'Natanz Enrichment Facility', short: 'NATANZ',
    type: 'nuclear', x: 536, y: 300,
    desc: 'Primary enrichment site. Partially buried — cruise missiles can damage surface halls but only penetrators guarantee destruction. PRIMARY OBJECTIVE.',
    esc: 2.5, world: -5,
    packages: [
      { asset: 'stealth', qty: 1, base: 0.90, label: 'B-2 mission — GBU-57 penetrators' },
      { asset: 'cruise', qty: 5, base: 0.48, label: 'Saturation TLAM strike — limited vs buried halls' },
    ],
  },
  {
    id: 'fordow', name: 'Fordow Enrichment Plant', short: 'FORDOW',
    type: 'nuclear', x: 506, y: 256, hardened: true,
    desc: 'Enrichment halls buried under 80m of rock. ONLY a B-2 with GBU-57 penetrators has any chance. PRIMARY OBJECTIVE.',
    esc: 3.0, world: -5,
    packages: [
      { asset: 'stealth', qty: 1, base: 0.80, label: 'B-2 mission — GBU-57 penetrators (only viable option)' },
    ],
  },
  {
    id: 'irgc-hq', name: 'IRGC Command Complex — Tehran', short: 'IRGC HQ',
    type: 'command', x: 514, y: 232,
    desc: 'Revolutionary Guard national command node. Striking it disrupts coordination of retaliation but is highly provocative.',
    esc: 2.0, world: -3,
    packages: [
      { asset: 'cruise', qty: 2, base: 0.80, label: 'TLAM decapitation strike — 2 missiles' },
      { asset: 'fighter', qty: 2, base: 0.70, label: 'Precision air strike — 2 sorties' },
    ],
  },
  {
    id: 'msl-kermanshah', name: 'Kermanshah Missile Base', short: 'MSL KERMANSHAH',
    type: 'missile', x: 412, y: 264,
    desc: 'Ballistic missile brigade in range of US bases in Iraq. Destroying it reduces the weight of Iranian missile retaliation.',
    esc: 1.5, world: -3,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.70, label: 'Air strike — 2 fighter sorties' },
      { asset: 'cruise', qty: 3, base: 0.80, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'msl-shiraz', name: 'Shiraz Missile Base', short: 'MSL SHIRAZ',
    type: 'missile', x: 542, y: 372,
    desc: 'Missile brigade covering the Gulf littoral and US bases in Qatar/UAE. Destroying it reduces Iranian retaliation weight.',
    esc: 1.5, world: -3,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.72, label: 'Air strike — 2 fighter sorties' },
      { asset: 'cruise', qty: 3, base: 0.80, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'naval-bandar', name: 'Bandar Abbas Naval Base', short: 'NAV BANDAR',
    type: 'naval', x: 645, y: 412,
    desc: 'Home port of the fast-attack craft and midget submarines threatening Hormuz shipping. Key to keeping the Strait open.',
    esc: 1.5, world: -3,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.76, label: 'Air strike — 2 fighter sorties' },
      { asset: 'cruise', qty: 2, base: 0.82, label: 'TLAM salvo — 2 cruise missiles' },
    ],
  },
  {
    id: 'naval-bushehr', name: 'Bushehr Naval Base', short: 'NAV BUSHEHR',
    type: 'naval', x: 468, y: 372,
    desc: 'IRGC-Navy swarm-boat base in the central Gulf. Threatens the carrier strike group.',
    esc: 1.5, world: -3,
    packages: [
      { asset: 'fighter', qty: 2, base: 0.76, label: 'Air strike — 2 fighter sorties' },
      { asset: 'cruise', qty: 2, base: 0.82, label: 'TLAM salvo — 2 cruise missiles' },
    ],
  },
  {
    id: 'kharg', name: 'Kharg Island Oil Terminal', short: 'KHARG OIL',
    type: 'oil', x: 448, y: 358,
    desc: 'Handles ~90% of Iranian crude exports. Crippling it strangles Tehran\'s economy — and spikes global oil prices. Heavy diplomatic cost.',
    esc: 2.0, world: -12,
    packages: [
      { asset: 'cruise', qty: 3, base: 0.86, label: 'TLAM salvo — 3 cruise missiles' },
      { asset: 'fighter', qty: 2, base: 0.72, label: 'Air strike — 2 fighter sorties' },
    ],
  },
  {
    id: 'abadan', name: 'Abadan Refinery', short: 'ABADAN REF',
    type: 'oil', x: 372, y: 336,
    desc: 'Iran\'s largest domestic fuel refinery. An economic pressure target with severe diplomatic blowback.',
    esc: 2.0, world: -12,
    packages: [
      { asset: 'cruise', qty: 3, base: 0.86, label: 'TLAM salvo — 3 cruise missiles' },
      { asset: 'fighter', qty: 2, base: 0.72, label: 'Air strike — 2 fighter sorties' },
    ],
  },
];

// ---- US assets shown on the map ----
const US_ASSETS = [
  { id: 'csg-gulf', name: 'CSG-9 — Persian Gulf', short: 'CVN-71 CSG', x: 492, y: 420, kind: 'carrier',
    desc: 'Carrier strike group operating in the central Gulf. Launches fighter sorties and Tomahawks.' },
  { id: 'csg-arabian', name: 'CSG-3 — Arabian Sea', short: 'CVN-68 CSG', x: 758, y: 592, kind: 'carrier',
    desc: 'Carrier strike group in the Arabian Sea, outside Iranian missile range.' },
  { id: 'udeid', name: 'Al Udeid AB — Qatar', short: 'AL UDEID', x: 511, y: 487, kind: 'airbase',
    desc: 'Forward headquarters, tankers and strike aircraft. Within Iranian ballistic missile range.' },
  { id: 'dhafra', name: 'Al Dhafra AB — UAE', short: 'AL DHAFRA', x: 592, y: 528, kind: 'airbase',
    desc: 'F-35 squadrons and ISR platforms. Within Iranian ballistic missile range.' },
  { id: 'asad', name: 'Ain al-Asad AB — Iraq', short: 'AIN AL-ASAD', x: 290, y: 262, kind: 'airbase',
    desc: 'US forces in western Iraq. Repeatedly targeted by Iranian missiles and proxy rockets.' },
  { id: 'diego', name: 'Diego Garcia (B-2 staging)', short: 'B-2 // DIEGO GARCIA →', x: 895, y: 655, kind: 'bomber',
    desc: 'Stealth bombers staging 2,900 nm south. The only platform that can kill Fordow.' },
];

// map from asset type to launch origin on the map
const STRIKE_ORIGINS = { fighter: 'csg-gulf', cruise: 'csg-gulf', stealth: 'diego' };

const ASSET_NAMES = {
  fighter: 'Fighter sorties',
  cruise: 'Cruise missiles (TLAM)',
  stealth: 'B-2 bomber missions',
};

// ---- Hormuz indicator location ----
const HORMUZ_POS = { x: 668, y: 447 };

// ---- Filler headlines (mixed into the ticker every turn) ----
const FILLER_HEADLINES = [
  'MARKETS ON EDGE AS GULF CRISIS ENTERS ANOTHER DAY',
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
