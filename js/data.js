// ============================================================
// data.js — static game data: targets, US assets, geography refs
// ============================================================

// ---- Iranian strategic targets ----
// world: world-opinion cost per strike
// worldOnKill: world-opinion cost paid ONCE, the night the site is finished,
//          instead of per strike. The distinction is about what the world is
//          actually reacting to. Nobody abroad files a protest over the third
//          package into an oil terminal — the story is "the Americans have
//          taken Iran's oil export off the board", and that story does not
//          exist until the thing is off the board. Charging it per strike also
//          punished the player twice for a target the game itself says needs
//          several packages to finish. So the big economic aimpoints cost
//          nothing to chip at and the whole bill lands on the last hit.
// momentumOnKill: added to negotiationMomentum when the site is finished.
//          Wrecking what pays for the war is leverage at the table (see doDiplo
//          in game.js) — it does not open the door, but it helps once the
//          nuclear gate is met.
// packages: valid strike options {asset, qty, base (success), label}
// depth:   how far inside Iran the target sits, which is what a strike package
//          actually costs in tanker tracks (see TANKER_COST). 1 = the Gulf
//          littoral, a short leg fighters fly unrefuelled; 2 = the interior;
//          3 = the far northwest and the Caspian, the longest legs in the
//          theater. Fighters only book tankers at depth 2+ — deep, past Abadan
//          and Nojeh; the bombers book them everywhere.
const TARGETS = [
  {
    id: 'ad-tehran', name: 'Tehran Air Defense Network', short: 'AD TEHRAN',
    type: 'airdefense', x: 417, y: 130, depth: 2,
    desc: 'Long-range SAM belt covering the capital region. Degrading it improves survivability of all non-stealth strikes.',
    world: -1,
    packages: [
      { asset: 'f35', qty: 2, base: 0.75, label: 'F-35 SEAD package — 2 sorties' },
      { asset: 'fighter', qty: 3, base: 0.70, label: 'Wild Weasel sweep — 3 F-16CM sorties' },
      { asset: 'cruise', qty: 3, base: 0.85, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'ad-isfahan', name: 'Isfahan Air Defense Complex', short: 'AD ISFAHAN',
    type: 'airdefense', x: 439, y: 259, depth: 2,
    desc: 'Central SAM network screening the nuclear sites. Degrading it improves survivability of all non-stealth strikes.',
    world: -1,
    packages: [
      { asset: 'f35', qty: 2, base: 0.77, label: 'F-35 SEAD package — 2 sorties' },
      { asset: 'fighter', qty: 3, base: 0.72, label: 'Wild Weasel sweep — 3 F-16CM sorties' },
      { asset: 'cruise', qty: 3, base: 0.85, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'ad-bandar', name: 'Bandar Abbas Coastal Defense', short: 'AD BANDAR',
    type: 'airdefense', x: 563, y: 449, depth: 1, label: { dy: -14 },
    desc: 'Coastal radar and SAM coverage over the Strait of Hormuz approaches.',
    world: -1,
    packages: [
      { asset: 'f35', qty: 2, base: 0.79, label: 'F-35 SEAD package — 2 sorties' },
      { asset: 'fighter', qty: 3, base: 0.74, label: 'Wild Weasel sweep — 3 F-16CM sorties' },
      { asset: 'cruise', qty: 3, base: 0.86, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'natanz', name: 'Natanz Enrichment Facility', short: 'NATANZ',
    type: 'nuclear', x: 441, y: 218, depth: 2,
    desc: 'Primary enrichment site. Partially buried — cruise missiles can damage surface halls but only penetrators guarantee destruction. PRIMARY OBJECTIVE.',
    // The enrichment program is the stated reason the country went to war and
    // the one thing no capital will defend out loud. Hitting it costs nothing
    // abroad; finishing it is worth a bump (see objectiveMilestones in game.js).
    world: 0,
    packages: [
      { asset: 'stealth', qty: 1, base: 0.90, label: 'B-2 mission — GBU-57 penetrators' },
      { asset: 'cruise', qty: 5, base: 0.48, label: 'Saturation TLAM strike — limited vs buried halls' },
    ],
  },
  {
    id: 'fordow', name: 'Fordow Enrichment Plant', short: 'FORDOW',
    type: 'nuclear', x: 416, y: 174, depth: 2, hardened: true,
    desc: 'Enrichment halls buried under 80m of rock. ONLY a B-2 with GBU-57 penetrators has any chance. PRIMARY OBJECTIVE.',
    world: 0,
    packages: [
      { asset: 'stealth', qty: 1, base: 0.80, label: 'B-2 mission — GBU-57 penetrators (only viable option)' },
    ],
  },
  {
    id: 'irgc-hq', name: 'IRGC Command Complex — Tehran', short: 'IRGC HQ',
    type: 'command', x: 447, y: 157, depth: 2,
    desc: 'Revolutionary Guard national command node. Striking it disrupts coordination of retaliation but is highly provocative.',
    world: -2,
    packages: [
      { asset: 'cruise', qty: 2, base: 0.80, label: 'TLAM decapitation strike — 2 missiles' },
      { asset: 'f35', qty: 2, base: 0.75, label: 'F-35 precision strike — 2 sorties' },
      { asset: 'fighter', qty: 3, base: 0.70, label: 'Precision air strike — 3 F-15E sorties' },
      { asset: 'heavy', qty: 2, base: 0.74, label: 'HEAVY BOMBER STRIKE — 2 B-1B sorties, JASSM' },
    ],
  },
  {
    id: 'msl-kermanshah', name: 'Kermanshah Missile Base', short: 'MSL KERMANSHAH',
    // stays below, but pulled left so the long label clears Khorramabad's icon
    // down-right of it; above would put it into Nojeh AB
    type: 'missile', x: 285, y: 196, depth: 2, label: { dx: 8, dy: 20, anchor: 'end' },
    desc: 'Ballistic missile brigade in range of US bases in Iraq. Destroying it reduces the weight of Iranian missile retaliation.',
    world: -2,
    packages: [
      { asset: 'f35', qty: 2, base: 0.75, label: 'F-35 strike package — 2 sorties' },
      { asset: 'fighter', qty: 3, base: 0.70, label: 'Air strike — 3 F-15E sorties' },
      { asset: 'cruise', qty: 3, base: 0.80, label: 'TLAM salvo — 3 cruise missiles' },
      { asset: 'heavy', qty: 2, base: 0.74, label: 'HEAVY BOMBER STRIKE — 2 B-52H sorties, JDAM' },
    ],
  },
  {
    id: 'msl-shiraz', name: 'Shiraz Missile Base', short: 'MSL SHIRAZ',
    type: 'missile', x: 469, y: 374, depth: 1,
    desc: 'Missile brigade covering the Gulf littoral and US bases in Qatar/UAE. Destroying it reduces Iranian retaliation weight.',
    world: -2,
    packages: [
      { asset: 'f35', qty: 2, base: 0.77, label: 'F-35 strike package — 2 sorties' },
      { asset: 'fighter', qty: 3, base: 0.72, label: 'Air strike — 3 F-15E sorties' },
      { asset: 'cruise', qty: 3, base: 0.80, label: 'TLAM salvo — 3 cruise missiles' },
      { asset: 'heavy', qty: 2, base: 0.76, label: 'HEAVY BOMBER STRIKE — 2 B-52H sorties, JDAM' },
    ],
  },
  {
    id: 'naval-bandar', name: 'Bandar Abbas Naval Base', short: 'NAV BANDAR',
    type: 'naval', x: 590, y: 467, depth: 1,
    desc: 'Home port of the fast-attack craft and midget submarines threatening Hormuz shipping. Key to keeping the Strait open.',
    world: -2,
    packages: [
      { asset: 'f35', qty: 2, base: 0.81, label: 'F-35 strike package — 2 sorties' },
      { asset: 'fighter', qty: 3, base: 0.76, label: 'Air strike — 3 F/A-18E sorties' },
      { asset: 'cruise', qty: 2, base: 0.82, label: 'TLAM salvo — 2 cruise missiles' },
      { asset: 'heavy', qty: 2, base: 0.80, label: 'HEAVY BOMBER STRIKE — 2 B-1B sorties, naval mining and JDAM' },
    ],
  },
  {
    id: 'naval-bushehr', name: 'Bushehr Naval Base', short: 'NAV BUSHEHR',
    type: 'naval', x: 411, y: 398, depth: 1, label: { dx: -13, dy: 4, anchor: 'end' },
    desc: 'IRGC-Navy swarm-boat base in the central Gulf. Threatens the carrier strike group.',
    world: -2,
    packages: [
      { asset: 'f35', qty: 2, base: 0.81, label: 'F-35 strike package — 2 sorties' },
      { asset: 'fighter', qty: 3, base: 0.76, label: 'Air strike — 3 F/A-18E sorties' },
      { asset: 'cruise', qty: 2, base: 0.82, label: 'TLAM salvo — 2 cruise missiles' },
      { asset: 'heavy', qty: 2, base: 0.80, label: 'HEAVY BOMBER STRIKE — 2 B-1B sorties, naval mining and JDAM' },
    ],
  },
  {
    id: 'ship-mahdavi', name: 'IRIS Shahid Mahdavi — Gulf of Oman', short: 'MAHDAVI',
    type: 'ship', x: 703, y: 586, depth: 1,
    desc: 'IRGC-Navy forward base ship operating outside the Strait, carrying anti-ship missiles and drones well past the Gulf. A hull at sea, not a pier — she moves, and she is the closest Iranian shooter to the carrier box. One weapon that finds her ends her; there is no damaging a ship into repairing itself.',
    world: -2,
    packages: [
      { asset: 'f35', qty: 2, base: 0.85, label: 'F-35 maritime strike — 2 sorties' },
      { asset: 'fighter', qty: 2, base: 0.80, label: 'Air strike — 2 F/A-18E sorties' },
      { asset: 'cruise', qty: 2, base: 0.84, label: 'TLAM salvo — 2 cruise missiles' },
      // The cheapest shot in the game and the slowest: one weapon out of the
      // boat's own tubes, no aircrew, nothing on anyone's radar — but she has to
      // close inside torpedo range submerged first.
      { asset: 'cruise', qty: 1, base: 0.88, eta: 2, sub: true,
        label: 'SUBMARINE ATTACK — 1 Mk-48 ADCAP heavyweight torpedo (2 turns to close the range)' },
    ],
  },
  {
    id: 'ship-caspian', name: 'IRGC Caspian Flotilla — Bandar-e Anzali', short: 'CASPIAN FLOT',
    type: 'ship', x: 392, y: 72, depth: 3,
    desc: 'Missile craft in the Caspian, 900 nm from the Gulf and beyond the fight — but a live hull all the same. The Caspian is a closed sea with Moscow on the far shore: putting American ordnance in it costs far more abroad than the tonnage is worth. No submarine has ever reached it and none ever will — this one is aircraft and cruise missiles or nothing.',
    // Was -8, which priced a handful of missile craft like an oil terminal and
    // made the flotilla a target nobody sane ever took. It is a real hull in a
    // sea Moscow watches, so it still costs more than any other warship on the
    // list — but it is warships, and warships are what this war is about.
    world: -3,
    packages: [
      { asset: 'f35', qty: 2, base: 0.67, label: 'F-35 maritime strike — 2 sorties (deep, the whole tanker plan)' },
      { asset: 'fighter', qty: 2, base: 0.62, label: 'Air strike — 2 F-15E sorties (deep, unrefuelled leg)' },
      { asset: 'cruise', qty: 3, base: 0.76, label: 'TLAM salvo — 3 cruise missiles' },
    ],
  },
  {
    id: 'tabriz-ab', name: 'Tabriz Air Base', short: 'TABRIZ AB',
    type: 'airbase', x: 260, y: 54, depth: 3,
    desc: 'Second Tactical Air Base — MiG-29 and F-5 squadrons covering the northwestern approaches, and the dispersal field aircraft are flown to when the interior is hit. Far from the Gulf: a long way in and a long way back out.',
    world: -2,
    packages: [
      { asset: 'f35', qty: 2, base: 0.71, label: 'F-35 strike package — 2 sorties (deep)' },
      { asset: 'fighter', qty: 3, base: 0.66, label: 'Air strike — 3 F-15E sorties (deep, unrefuelled leg)' },
      { asset: 'cruise', qty: 3, base: 0.80, label: 'TLAM salvo — 3 cruise missiles' },
      { asset: 'heavy', qty: 2, base: 0.70, label: 'HEAVY BOMBER STRIKE — 2 B-52H sorties, runway and ramp' },
    ],
  },
  {
    id: 'kharg', name: 'Kharg Island Oil Terminal', short: 'KHARG OIL',
    type: 'oil', x: 394, y: 387, depth: 1, label: { dy: -14 },
    desc: 'Handles ~90% of Iranian crude exports. Crippling it strangles Tehran\'s economy — and spikes global oil prices. Heavy diplomatic cost paid the night the terminal stops loading, not before.',
    world: 0, worldOnKill: -8, momentumOnKill: 0.08,
    packages: [
      { asset: 'cruise', qty: 3, base: 0.86, label: 'TLAM salvo — 3 cruise missiles' },
      { asset: 'f35', qty: 2, base: 0.77, label: 'F-35 strike package — 2 sorties' },
      { asset: 'fighter', qty: 3, base: 0.72, label: 'Air strike — 3 F-15E sorties' },
      { asset: 'heavy', qty: 2, base: 0.76, label: 'HEAVY BOMBER STRIKE — 2 B-52H sorties, loading berths and tank farm' },
    ],
  },
  {
    id: 'abadan', name: 'Abadan Refinery', short: 'ABADAN REF',
    type: 'oil', x: 327, y: 346, depth: 1,
    desc: 'Iran\'s largest domestic fuel refinery. An economic pressure target: the diplomatic bill comes due when the refinery train stops, not for the craters along the way.',
    world: 0, worldOnKill: -8, momentumOnKill: 0.06,
    packages: [
      { asset: 'cruise', qty: 3, base: 0.86, label: 'TLAM salvo — 3 cruise missiles' },
      { asset: 'f35', qty: 2, base: 0.77, label: 'F-35 strike package — 2 sorties' },
      { asset: 'fighter', qty: 3, base: 0.72, label: 'Air strike — 3 F-15E sorties' },
      { asset: 'heavy', qty: 2, base: 0.76, label: 'HEAVY BOMBER STRIKE — 2 B-52H sorties, the whole refinery train' },
    ],
  },
  {
    id: 'arak', name: 'Arak Heavy-Water Reactor', short: 'ARAK IR-40',
    type: 'nuclear', x: 363, y: 199, depth: 2, hardened: true,
    desc: 'The plutonium road to a bomb — a heavy-water research reactor that breeds weapons-grade material a uranium centrifuge never touches. The reactor hall is a hardened concrete shell; cruise missiles scar it, but only a penetrator reaches the core. Killing it closes the second path to a weapon.',
    // Unfuelled and unambiguously weapons-related — the same free pass as the
    // enrichment halls. Bushehr NPP below is the exception that proves it.
    world: 0,
    packages: [
      { asset: 'stealth', qty: 1, base: 0.86, label: 'B-2 mission — GBU-57 penetrator into the reactor hall' },
      { asset: 'f35', qty: 2, base: 0.60, label: 'F-35 strike — 2 sorties (limited vs the hardened core)' },
      { asset: 'cruise', qty: 4, base: 0.55, label: 'Saturation TLAM strike — surface plant only' },
    ],
  },
  {
    id: 'bushehr-npp', name: 'Bushehr Nuclear Power Plant', short: 'BUSHEHR NPP',
    type: 'nuclear', x: 430, y: 415, depth: 1,
    desc: 'A live civilian reactor on the Gulf coast, run under Russian contract with Russian technicians on site. It makes no bomb fuel — but cracking a fuelled core seeds a radiological plume across the Gulf and puts Moscow\'s people under American ordnance. The most diplomatically ruinous aimpoint in Iran, and militarily the least worth it.',
    // The one nuclear-typed site that still costs: it is a civil power plant
    // with foreign nationals in it, not a weapons program. Cratering the
    // switchyard is survivable abroad; killing the plant is the plume, and the
    // plume is the whole bill. Heavier than the oil targets, and it always was.
    world: 0, worldOnKill: -10, momentumOnKill: 0.04,
    packages: [
      { asset: 'cruise', qty: 3, base: 0.80, label: 'TLAM salvo — switchyard and auxiliaries, not the core' },
      { asset: 'f35', qty: 2, base: 0.75, label: 'F-35 strike package — 2 sorties' },
      { asset: 'fighter', qty: 3, base: 0.70, label: 'Air strike — 3 F-15E sorties' },
    ],
  },
  {
    id: 'naval-chabahar', name: 'Chabahar Naval Base — Konarak', short: 'NAV CHABAHAR',
    type: 'naval', x: 680, y: 540, depth: 1, label: { dy: -14 },
    desc: 'Iran\'s deep-water port on the Gulf of Oman, east of Hormuz and wide open to the Indian Ocean. It is where the surface fleet runs to when the Gulf ports are held at risk, and the one base from which Iran reaches blue water. Far to the east, but on the coast and inside the carrier\'s reach.',
    world: -2,
    packages: [
      { asset: 'f35', qty: 2, base: 0.80, label: 'F-35 strike package — 2 sorties' },
      { asset: 'fighter', qty: 2, base: 0.75, label: 'Air strike — 2 F/A-18E sorties' },
      { asset: 'cruise', qty: 2, base: 0.82, label: 'TLAM salvo — 2 cruise missiles' },
      { asset: 'heavy', qty: 2, base: 0.79, label: 'HEAVY BOMBER STRIKE — 2 B-1B sorties, naval mining and JDAM' },
    ],
  },
  {
    id: 'nojeh-ab', name: 'Shahid Nojeh Air Base — Hamadan', short: 'NOJEH AB',
    type: 'airbase', x: 327, y: 159, depth: 2,
    desc: 'Third Tactical Air Base in the western highlands — F-4 Phantom and Su-24 squadrons covering the approaches from Iraq, and a primary dispersal field for aircraft flown out of the interior when it is struck. Cratering the runways grounds the wing until the fill sets.',
    world: -2,
    packages: [
      { asset: 'f35', qty: 2, base: 0.74, label: 'F-35 strike package — 2 sorties' },
      { asset: 'fighter', qty: 3, base: 0.69, label: 'Air strike — 3 F-15E sorties' },
      { asset: 'cruise', qty: 3, base: 0.80, label: 'TLAM salvo — 3 cruise missiles' },
      { asset: 'heavy', qty: 2, base: 0.72, label: 'HEAVY BOMBER STRIKE — 2 B-52H sorties, runway and ramp' },
    ],
  },
  {
    id: 'msl-khorramabad', name: 'Khorramabad Missile Base', short: 'MSL KHORRAMABAD',
    type: 'missile', x: 321, y: 221, depth: 2,
    desc: 'An underground "missile city" tunnelled into the Zagros — launch cells and reload magazines behind blast doors deep in the rock, ranging every US base in Iraq and the northern Gulf. The tunnel portals are the only thing to hit, and hitting them buries launchers rather than destroying them. Reduces the weight of Iranian missile retaliation.',
    world: -2,
    packages: [
      { asset: 'f35', qty: 2, base: 0.72, label: 'F-35 strike package — 2 sorties (tunnel portals)' },
      { asset: 'fighter', qty: 3, base: 0.67, label: 'Air strike — 3 F-15E sorties' },
      { asset: 'cruise', qty: 3, base: 0.78, label: 'TLAM salvo — 3 cruise missiles' },
      { asset: 'heavy', qty: 2, base: 0.72, label: 'HEAVY BOMBER STRIKE — 2 B-52H sorties, portals and support area' },
    ],
  },

  // ---- dispersed missile brigades (TELs) ----
  // These are not on the map when the war opens and they cannot be planned
  // against. Flattening a missile base does not kill the brigade — it kills the
  // garrison and the sheds, and the transporter-erector-launchers that were
  // always the point drive out into the country and keep shooting. They appear
  // only when a base is destroyed (dispersal), and they can only be struck once
  // ISR has actually found them. Left alone, they move again and go dark.
  //
  // This is why killing both missile bases does not end the missile war: the
  // strength that leaves a base mostly survives it. See DISPERSAL below.
  {
    id: 'tel-west', name: 'Dispersed TEL Group — Zagros Foothills', short: 'TEL WEST',
    type: 'tel', x: 330, y: 245, depth: 2, dispersal: true,
    desc: 'Transporter-erector-launchers operating out of culverts, road tunnels and orchard cover in the western highlands. They shoot and move inside fifteen minutes. There is nothing here to bomb twice — find them tonight and kill them tonight, or find them again next week.',
    world: -1,
    packages: [
      { asset: 'f35', qty: 2, base: 0.73, label: 'Armed reconnaissance — 2 F-35 sorties' },
      { asset: 'fighter', qty: 2, base: 0.68, label: 'Armed reconnaissance — 2 F-16CM sorties' },
      { asset: 'cruise', qty: 2, base: 0.58, label: 'TLAM salvo — 2 missiles (they will have moved)' },
    ],
  },
  {
    id: 'tel-central', name: 'Dispersed TEL Group — Central Plateau', short: 'TEL CENTRAL',
    type: 'tel', x: 470, y: 285, depth: 2, dispersal: true,
    desc: 'The strategic reserve, dispersed into the desert interior — hardened shelters cut into rock, and hides the IRGC prepared years ago for exactly this. The furthest inland of the launcher groups and the hardest to hold a fix on.',
    world: -1,
    packages: [
      { asset: 'f35', qty: 2, base: 0.71, label: 'Armed reconnaissance — 2 F-35 sorties' },
      { asset: 'fighter', qty: 2, base: 0.66, label: 'Armed reconnaissance — 2 F-16CM sorties' },
      { asset: 'cruise', qty: 2, base: 0.56, label: 'TLAM salvo — 2 missiles (they will have moved)' },
    ],
  },
  {
    id: 'tel-south', name: 'Dispersed TEL Group — Fars Highlands', short: 'TEL SOUTH',
    type: 'tel', x: 432, y: 340, depth: 1, dispersal: true,
    desc: 'Launchers scattered through the valleys north of the Gulf littoral, ranging every American base on the Arabian side. Close enough to reach quickly, mobile enough that quickly is the only way it works.',
    world: -1,
    packages: [
      { asset: 'f35', qty: 2, base: 0.75, label: 'Armed reconnaissance — 2 F-35 sorties' },
      { asset: 'fighter', qty: 2, base: 0.70, label: 'Armed reconnaissance — 2 F-16CM sorties' },
      { asset: 'cruise', qty: 2, base: 0.60, label: 'TLAM salvo — 2 missiles (they will have moved)' },
    ],
  },
];

// Where a destroyed missile base's surviving launchers go, and how much of the
// brigade drives away. A base is worth 100 points of missile strength; killing
// it converts 55 of those into TELs rather than deleting them. The player trades
// a fixed target they can always find for a mobile one they usually cannot —
// which is the actual history of every missile hunt ever attempted.
const DISPERSAL = {
  'msl-kermanshah': [['tel-west', 30], ['tel-central', 25]],
  'msl-shiraz': [['tel-south', 30], ['tel-central', 25]],
};

// Chance per turn that a located TEL group that was NOT struck picks up and
// moves, going dark again. Finding them is not the same as killing them.
const TEL_RELOCATE = 0.45;

// ---- durability model ----
// Fixed installations are worn down rather than switched off. Every target
// carries a 0–100 condition track; a package takes a bite out of it and the
// site keeps fighting on whatever is left. What a site does with the nights you
// spend somewhere else is repair — spare radars rolled out of the dispersal
// revetments, craters filled, a replacement crane barged in — so anything left
// standing at 20% is back at 60% in a few days if you look away. Zero is
// permanent for almost everything: nobody reconstitutes rubble in the middle of
// a war. The one exception is the SAM belt — see AD_RECONSTITUTION below.
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

// ============================================================
// THE SAM BELT COMES BACK
// ------------------------------------------------------------
// The one target type that reconstitutes from zero, and the reason is that a
// SAM "site" is a LOCATION, not an order of battle. Flattening it kills the
// launchers and the engagement radars that happened to be parked there. It does
// not kill the air defense force of a country that fields hundreds of systems,
// keeps most of them mobile, and has spent twenty years planning to fight this
// exact war out of dispersal. Left alone long enough, the reserve moves in.
//
// This exists because airSuperiority() has always CLAIMED it: "the heavy force
// is not a reward you unlock, it is a condition you maintain, and the night you
// look away is the night the plan gets smaller." That was true of the airbases
// and false of the SAM belt, because the belt is three targets and a player
// takes all three to zero by the end of the first week — after which
// airDefenseWeight() is zero forever, every strike is free forever, and the
// campaign is a checklist. Three sites deep is not a threat model.
//
// It never comes back to full and it never comes back fast. What returns is
// what the reserve can field: older systems, worse crews, less of it.
// `quiet` is what makes this a decision rather than a tax — go back and keep
// the rubble smoking and it stays rubble. Look away for three nights and it
// doesn't.
const AD_RECONSTITUTION = {
  quiet: 3,    // nights of being left alone before the reserve starts moving
  rate: 7,     // condition per night once it does — slower than a live site repairs
  // PERMANENT ceiling on a site that has been finished once, enforced by
  // repairCeiling() in game.js against the ordinary overnight repair as well as
  // against the return itself. Without it the reserve arrives at 7% and then
  // repairs to 100% like any other damaged site, and destroying air defense
  // buys the player nothing that lasts. With it, killing a battery is permanent
  // progress that is simply not permanent REMOVAL — which is the whole point.
  cap: 60,
};

// Fallback full-effect damage for anything not carrying its own weight in
// AIR_ASSETS. Individual packages override with `dmg`.
const PKG_DAMAGE = 55;

// ============================================================
// THE AIR CAMPAIGN, IN THE ORDER IT IS ACTUALLY FLOWN
// ------------------------------------------------------------
// An American air war against a defended country is not one force applied
// evenly for thirty nights. It is three forces applied in sequence, and the
// sequence is the doctrine:
//
//   1. The door is kicked by things that survive a live SAM belt — F-35s and
//      F-22s, and Tomahawks that fly under it. Small magazines, light bomb
//      loads, expensive per aimpoint. This phase is slow and it is supposed to
//      be slow: what it is buying is not damage, it is the next phase.
//   2. Once the belt is broken, the fourth-generation force is released —
//      F-15Es, F-16s, the carrier's Super Hornets. There are far more of them
//      and each one carries far more, but they are 1980s airframes and they
//      die in defended airspace. Volume, not survivability.
//   3. Once nobody is contesting the sky at all, the heavies come — B-1s and
//      B-52s off RAF Fairford, which is what it looks like when the United
//      States stops raiding and starts flattening. One heavy package does the
//      work of two nights of fighters. They are also the most helpless thing
//      in the inventory if the belt comes back up.
//
// `ad`     — success penalty per point of surviving SAM coverage (0..3)
// `loss`   — aircrew loss risk per point of the same
// `weight` — condition taken off a site that wears down, on full effects
// `tanker` — tracks booked, as a function of target depth
// `needs`  — the air-superiority phase this platform will not be tasked below
//
// TANKER RULE. Fighters fly the Gulf littoral (depth 1 — the coast up to
// Abadan) unrefuelled: a Strike Eagle or a Hornet has the legs to hit Bandar
// Abbas, Bushehr or Kharg off the deck or the Gulf ramps and come home dry.
// They only book tankers once the target sits deep — the interior and the
// northwest, everything north of Abadan and west of Nojeh (depth 2+). The
// bombers are the opposite: a B-1, B-52 or B-2 is on the tanker every night, at
// every depth, because it is staging from Fairford or Diego Garcia in the first
// place and neither of those is anywhere near Iran.
//
// v1.19 RESCALE. These numbers used to be 2+d for fighters and 3+d for the
// heavies, against a night-one capacity of ten. That made fuel the only thing
// the player was ever actually deciding about: two deep packages a night, every
// night, for thirty turns, and the answer to every question was "wait for the
// tanker wing." The war it produced was the same war every time. The charge is
// now roughly a quarter of what it was at the fighter end, which takes fuel out
// of the role of universal brake and leaves it as what it should have been — the
// thing that makes the far northwest expensive and the littoral cheap. What
// binds instead is the magazine and, more to the point, world opinion: with the
// tracks no longer rationing sorties, a player who flies everything at
// everything now runs the standing down through the basing tiers (see
// BASING_TIERS) and loses the ramps that the deep targets are only reachable
// from. The constraint moved from fuel to politics on purpose.
//
// ATTRITION — the loss rate that has nothing to do with the SAM belt, and
// therefore the one the player cannot bomb away. Shoulder-launched missiles in
// the target area. Triple-A nobody bothers to target and nobody can suppress. A
// hydraulic failure nine hundred miles from a divert field. A bad night trap on
// a pitching deck at the end of a six-hour cycle. Desert Storm went on losing
// aircraft to exactly these for six weeks after the Iraqi IADS was dead.
//
// `loss` is multiplied by surviving SAM coverage and goes to zero when the belt
// does; `attrition` is added flat and never goes anywhere. It is small — one
// airframe roughly every twelve nights of fighter packages — and it is the
// difference between an air campaign where aircrew are people and one where
// they stop existing after night eight. It is also the only thing that keeps
// csar.js reachable in a war the player is winning.
const AIR_ASSETS = {
  f35:     { ad: 0.02, loss: 0.015, attrition: 0.004, weight: 45, tanker: (d) => d >= 2 ? d - 1 : 0 },
  fighter: { ad: 0.11, loss: 0.060, attrition: 0.013, weight: 62, tanker: (d) => d >= 2 ? d - 1 : 0, needs: 'degraded' },
  heavy:   { ad: 0.20, loss: 0.090, attrition: 0.010, weight: 92, tanker: (d) => 1 + d, needs: 'superiority' },
  // the B-2 flies one aircraft at a time, at night, from Missouri or Diego
  // Garcia, with the whole Air Force arranged around getting it home
  stealth: { ad: 0.02, loss: 0,     attrition: 0.002, weight: 55, tanker: () => 4 },
  // nobody is aboard a Tomahawk, and nobody is aboard an Mk-48
  cruise:  { ad: 0,    loss: 0,     attrition: 0,     weight: 55, tanker: () => 0 },
};

// How much of the sky Iran still owns, and what that permits. Air superiority
// is not a switch the player throws — it is computed off what is left of the
// SAM belt and the fighter bases, which means it can be LOST again by looking
// away while the repair crews work. The whole late-war force structure rests
// on a number that has to be maintained.
//   0.00 — opening night: the belt is whole
//   0.40 — DEGRADED: the belt is broken enough to fly fourth-gen into
//   0.80 — AIR SUPERIORITY: nobody is contesting the sky; bring the heavies
const AIR_PHASE = { degraded: 0.40, superiority: 0.80 };
// what the number is built from: the SAM belt is three quarters of the problem,
// Iranian fighter basing the rest
const AIR_WEIGHT = { sam: 0.75, airbase: 0.25 };

// ============================================================
// THEATER FORCE FLOW
// ------------------------------------------------------------
// The other half of why an American war gets heavier rather than lighter. The
// carriers are what is there on night one; everything else is a machine that
// takes weeks to spin up and then does not stop. Squadrons come out of CONUS
// and USAFE, the tanker wings come with them, and by the third week there is
// simply more of everything than there was.
//
// It is not free and it is not automatic in the way a resource tick is: every
// wave needs a ramp to land on, and ramps are what world opinion buys. Lose
// the basing tier a wave needs and the wave holds at its staging field until
// the politics are repaired — the buildup stalls exactly when the player has
// spent the standing that pays for it.
const FORCE_FLOW = [
  { at: 3, needs: 'nato', f35: 1, fighters: 2, tanker: 1, rep: 1,
    title: 'AIR EXPEDITIONARY WING CLOSES — AL DHAFRA',
    text: 'The first tranche out of the CONUS force flow is on the ramp: an F-35A squadron off Hill and two F-16CM squadrons out of Spangdahlem, with the KC-135 element that brought them. They are combat-ready in the morning.' },
  { at: 5, needs: 'gulf', f35: 1, fighters: 3, tanker: 1, rep: 1,
    title: 'SECOND TRANCHE ON THE RAMP — AL UDEID',
    text: 'F-15E Strike Eagles out of Seymour Johnson and a second F-35A squadron closed overnight. Air Mobility Command has been running a bridge across the Atlantic for four days to do it — the aircraft are the easy part.' },
  { at: 8, needs: 'gulf', f35: 2, fighters: 3, tanker: 2, rep: 1,
    title: 'KC-46 TANKER WING ESTABLISHED IN THEATER',
    text: 'Two tanker squadrons and their maintenance tail are established at Al Udeid and Prince Sultan. This is the wave that actually matters: fuel in the air is what has been capping the plan, and tonight there is meaningfully more of it.' },
  { at: 11, needs: 'gulf', f35: 1, fighters: 3, tanker: 2, rep: 2,
    title: 'THIRD TRANCHE — PRINCE SULTAN AND ALI AL SALEM',
    text: 'Another four squadrons are on the ramps and the munitions ships have caught up with them. Weapons handlers are building up JDAM in numbers nobody in this theater has seen since 2003.' },
  { at: 15, needs: 'nato', f35: 2, fighters: 4, tanker: 2, rep: 2,
    title: 'USAFE SQUADRONS ARRIVE — MUWAFFAQ SALTI AND ERBIL',
    text: 'The European theater has been stripped to reinforce this one. F-16s from Aviano and F-15Es from Lakenheath are flying out of Jordan and northern Iraq, which puts the western axis in the plan for the first time.' },
  { at: 19, needs: 'gulf', f35: 1, fighters: 4, tanker: 2, rep: 2,
    title: 'SUSTAINED SURGE RATE ACHIEVED — CENTCOM AIR FORCES',
    text: 'The last of the deploying wings is in place and the theater has reached its sustained surge rate. From tonight the plan is limited by what the tankers can carry and by nothing else — this is the whole weight of American air power, and it is now simply present.' },
];

// ============================================================
// THE HEAVY BOMBER FORCE
// ------------------------------------------------------------
// B-1Bs and B-52s off the RAF Fairford ramp — a different field from the 509th
// and a completely different weapon. Fairford is where the Air Force has always
// bedded heavies down for a Middle East war: it is a real ramp with real
// munitions storage, it is inside NATO, and it puts the cells over Iran from the
// northwest rather than up out of the Indian Ocean. Diego Garcia stays the
// B-2's. A B-2 is a key cut for one lock; the heavies
// are tonnage, and tonnage is what actually takes a country's ability to fight
// away from it. They cannot penetrate anything and they will not be tasked
// into contested airspace, which is why they are the reward for the first two
// phases rather than a substitute for them.
const HEAVY_TRANSIT_TURNS = 2;
const HEAVY_CAP = 4;        // sustainable missions off the ramp
const HEAVY_READY = 2;      // generated and ready the turn they land

// ============================================================
// TANKER TRACKS
// ------------------------------------------------------------
// An air campaign flown from the sea against a country the size of Iran runs on
// fuel in the air. Deep packages book tanker tracks out of a nightly theater
// total; Tomahawks book none, because a missile does not refuel — and fighters
// on the littoral book none either, because they have the legs to reach the
// coast and come home dry. It is depth that starts the meter: fighters pay once
// the target is past Abadan and Nojeh, the bombers pay everywhere. What this
// buys the war is geography — the far northwest costs real fuel and the coast
// costs none, so "the littoral or the Caspian" stays a live question.
//
// What it deliberately no longer buys is the campaign's only limit. Through
// v1.18 the tracks rationed the entire war down to two deep packages a night
// and every other system was decoration; the charges were cut hard in v1.19 (see
// the rescale note above AIR_ASSETS) so that the ceiling on how hard a player
// can hit is the political one instead. The heavies still book the most of
// anyone — longest legs in the theater, a tanker apiece — which keeps the
// tonnage phase feeling like something you staged for rather than something you
// switched on.
const TANKER_COST = Object.fromEntries(
  Object.entries(AIR_ASSETS).map(([k, a]) => [k, a.tanker]));

// theater baseline before any deck or basing is counted
const TANKER_BASE = 4;

// ============================================================
// WORLD OPINION — WHAT IT ACTUALLY BUYS
// ------------------------------------------------------------
// Standing abroad is not a scoreboard. It is the permission slip for the ramps
// and the tanker tracks the whole campaign is flown off, and it is withdrawn in
// two steps. Losing NATO and Saudi basing costs squadrons and tankers. Losing
// the Gulf states costs the rest of the tanker plan and the reach to touch
// anything deep — Tabriz and the Caspian come off the target list entirely,
// because there is no longer an airfield within range that will take the
// mission. Both are recoverable: get the number back up and the ramps reopen.
const BASING_TIERS = {
  nato: { at: 30, tankers: 2, fighters: 2, name: 'NATO and Saudi basing' },
  gulf: { at: 15, tankers: 2, fighters: 2, name: 'Gulf state basing and overflight' },
};

// ============================================================
// IRANIAN WAR PLANS
// ------------------------------------------------------------
// Tehran is not a reaction table. One of these is chosen when the war opens and
// it is not shown to the player: it has to be read off what Iran actually does,
// or bought from the analysts with an action slot. Each one re-weights the same
// event pool rather than adding new events, so the war stays coherent — it just
// stops being the same war every time.
const IRAN_POSTURES = {
  strangler: {
    name: 'STRAIT STRANGLER',
    brief: 'Tehran means to win this at the gas pump. The naval arm and the mine warfare units are the main effort; the missile force is being husbanded to keep the Strait shut rather than spent on airfields.',
    tell: 'heavy naval and mining activity, restrained missile use',
    missile: 0.7, naval: 1.7, proxy: 0.9, ally: 0.8, hormuz: 1.9,
  },
  attrition: {
    name: 'ATTRITION',
    brief: 'Tehran has decided the American public is the weak point and is playing for the casualty count. Missile brigades and proxies are being spent freely against bases and fleet units; the Strait is a lever, not the plan.',
    tell: 'sustained missile salvos against bases, heavy proxy activity',
    missile: 1.35, naval: 0.8, proxy: 1.5, ally: 1.1, hormuz: 0.7,
  },
  sprint: {
    name: 'NUCLEAR SPRINT',
    brief: 'Tehran is buying time for the enrichment halls and nothing else. Air defense and the nuclear sites are being reinforced at the expense of everything else; the retaliation is deliberately measured to keep the war small enough to survive.',
    tell: 'restrained retaliation, hardened air defense, accelerated enrichment',
    missile: 0.75, naval: 0.75, proxy: 0.8, ally: 0.6, hormuz: 0.6,
    // The sprint is meant to be the urgent war, not the unwinnable one: at 1.3
    // the clock runs ~12 turns from a standing start, which is inside what two
    // B-2 cycles against Natanz and Fordow can actually service. Pushed to 1.5
    // it stops being a race and becomes a coin flip on the opening rolls.
    enrich: 1.3, repair: 1.35,
  },
};

// ============================================================
// THE BREAKOUT CLOCK
// ------------------------------------------------------------
// The reason there is a war on. Iran is enriching the whole time, and the
// campaign is a race against a number nobody in the building can see exactly.
// `need` is randomized at the start of every war, so the estimate the player is
// given is a genuine estimate and not a countdown with a fog filter over it.
const BREAKOUT = {
  needMin: 88, needMax: 118,   // progress required for a device
  rate: 6,                     // per turn at full enrichment capability
  // how wide the IC's estimate is, by confidence — ± this many turns
  band: { low: 5, medium: 3, high: 1 },
  decay: 3,                    // turns before a fresh assessment goes stale again
};

// ============================================================
// DIFFICULTY
// ------------------------------------------------------------
// Three numbers do almost all the work: what the country will absorb in dead,
// how fast Iran puts its damaged sites back together, and how well it
// coordinates what it has left.
// `softGate` decides whether the air-superiority ladder is advice or law. On
// easy and normal, CENTCOM simply will not task fourth-gen fighters or heavy
// bombers into airspace that has not been taken — the packages are not offered,
// and the player learns the doctrine by reading why. On hard the staff will
// write any plan the President signs: the packages are always available, and
// flying them early is priced in dead aircrew instead of refused outright.
const DIFFICULTY = {
  easy:   { name: 'EASY', casualties: 320, repair: 0.75, coord: 0.85, breakout: 1.25, softGate: false,
    desc: 'A forgiving war. The country absorbs more, Iran reconstitutes slower, and the enrichment clock runs long.' },
  normal: { name: 'NORMAL', casualties: 250, repair: 1, coord: 1, breakout: 1, softGate: false,
    desc: 'The war as designed. Everything above and below is scaled from here.' },
  hard:   { name: 'HARD', casualties: 190, repair: 1.25, coord: 1.15, breakout: 0.85, softGate: true,
    desc: 'The country has less patience, Iran repairs faster and fights better coordinated, the centrifuges are further along than you would like — and the staff will fly any package you order, into any threat, and hand you the casualty list afterwards.' },
};

// These levels were once named for the chair you were sitting in. A save
// written under those names still restores at the level it was played at
// rather than silently dropping to normal.
const DIFFICULTY_ALIAS = { advisor: 'easy', general: 'normal', president: 'hard' };

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
  // active: false — the ramp is bare until the 509th is called forward from
  // Whiteman AFB. Nothing stealthy exists in this theater until it is.
  //
  // The atoll's real position is 7.3S 72.4E, which projects to y≈1770 — a long
  // way below the bottom of the chart. The marker sits at the atoll's true
  // LONGITUDE out in the Laccadive Sea, bottom-right of the plot, with the ↓ in
  // its label pointing due south down the meridian the real thing is on. Open
  // water: west of Kerala, south of the Indian shelf, clear of every carrier
  // box. Diego Garcia is B-2s only — the heavies fly out of Fairford.
  { id: 'diego', name: 'Diego Garcia (B-2 staging)', short: 'B-2 // DIEGO GARCIA ↓', x: 1130, y: 1130, kind: 'bomber', active: false,
    ramp: 'DIEGO GARCIA',
    desc: 'Staging field 2,900 nm south. Empty until the 509th Bomb Wing is deployed forward from Whiteman AFB, Missouri — and the B-2 is the only platform that can kill Fordow.' },
  // RAF Fairford (51.7N 1.8W) — the heavy bomber ramp, and the one US asset in
  // the game that is nowhere near the chart: it projects to roughly (-1343,
  // -460), off the top-left corner by a wide margin. `nomap` keeps it out of the
  // render loop entirely; it exists only so a heavy package has a real origin to
  // compute a bearing and a transit distance from. The northwest inbound track
  // it produces is correct — the heavies come down over Europe and Iraq, not up
  // out of the Indian Ocean like the B-2s.
  { id: 'fairford', name: 'RAF Fairford — England (heavy bomber staging)', short: 'FAIRFORD',
    x: -1343, y: -460, kind: 'bomber', nomap: true, ramp: 'RAF FAIRFORD',
    desc: 'The Air Force\'s forward operating base for heavy bombers, Gloucestershire. Empty until the B-1 and B-52 force is called forward from Dyess and Barksdale.' },
  // The one American shooter Iran cannot see, plotted where Fifth Fleet last had
  // her rather than where she is. She takes her Tomahawks out of the same
  // theater magazine everything else does — a submarine shot is not a free shot,
  // it is the same missile fired from somewhere nobody is looking.
  { id: 'ssn-toledo', name: 'USS Toledo — Gulf of Oman', short: 'TOLEDO (SSN)', x: 655, y: 545, kind: 'submarine',
    desc: 'Los Angeles-class attack submarine on patrol in the Gulf of Oman. Four tubes of Mk-48 ADCAP, and nothing on the Iranian side has ever held her on sonar. Against a hull at sea she is the cheapest weapon in the theater — one torpedo out of her own load, no aircrew, no warning, nothing off the theater magazine — and the slowest, because she has to close inside firing range submerged before she shoots.' },

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
const STRIKE_ORIGINS = {
  f35: 'csg-lincoln', fighter: 'csg-lincoln', cruise: 'csg-lincoln',
  stealth: 'diego', heavy: 'fairford', sub: 'ssn-toledo',
};

// The boat's own war shots. A submarine attack is the one package in the game
// that spends nothing off the theater magazine — the weapon is already in her
// tubes, and when the four are gone there is no reloading her mid-war.
const TORPEDO_LOAD = 4;
const SUB_WEAPON_NAME = 'Mk-48 ADCAP heavyweight torpedo, out of the boat\'s own tubes';

const ASSET_NAMES = {
  f35: '5th-gen sorties (F-35/F-22)',
  fighter: '4th-gen sorties (F-15E/F-16/F-18)',
  cruise: 'Cruise missiles (TLAM)',
  stealth: 'B-2 bomber missions',
  heavy: 'Heavy bomber missions (B-1/B-52)',
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
// `sub` is not an asset type — it is the submarine shot, keyed separately
// because a torpedo runs to the datum at 55 knots, not at 500, and the sonar
// display is worth the extra seconds on screen.
const FLIGHT_DUR = { f35: 10500, fighter: 10500, stealth: 16000, heavy: 14000, cruise: 6500, sub: 13000 };

// Airframes by tier: a random one flies each package. cs is the callsign root;
// from decides whether it launches off a carrier or a land base. The split is
// the whole point of the force structure — the 5th-gen pool is what flies on
// night one, the 4th-gen pool is what floods in once the belt is broken, and
// the heavies come off the Fairford ramp at the end.
const F35_TYPES = [
  { type: 'F-35A', cs: 'PANTHER', from: 'land' },
  { type: 'F-35C', cs: 'WARLOCK', from: 'carrier' },
  { type: 'F-22A', cs: 'RAPTOR', from: 'land' },
];
const FIGHTER_TYPES = [
  { type: 'F/A-18E', cs: 'RHINO', from: 'carrier' },
  { type: 'F-16CM', cs: 'VIPER', from: 'land' },
  { type: 'F-15E', cs: 'MUDHEN', from: 'land' },
  { type: 'F/A-18F', cs: 'GUNSLINGER', from: 'carrier' },
];
const HEAVY_TYPES = [
  { type: 'B-1B', cs: 'BONE', from: 'land' },
  { type: 'B-52H', cs: 'BUFF', from: 'land' },
];

// Every in-flight status / problem message lives here — edit freely.
//   at:    fraction of the flight when the entry fires (values > 1 fire on the
//          egress leg home, where 1.0 = weapons away and 2.0 = animation end)
//   kind:  'status' always fires; 'problem' fires with probability `chance`
//   only:  restricts an entry to one tier ('stealth' | 'heavy' | 'f35' |
//          'fighter') or to a family — 'bomber' is both bomber tiers, 'fighter'
//          is both manned fighter tiers. 'stealth' is the B-2 alone, which
//          matters: it is the only thing that still stages out of the Indian
//          Ocean, and the heavies fly the Fairford leg instead.
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
  { at: 0.30, kind: 'status', only: 'heavy', msgs: [
    'Heavy is on the boom over the eastern Med — full offload, then the run in',
    'Cell is joined and level — running the whole target set off one pass',
  ] },
  { at: 0.90, kind: 'status', only: 'heavy', msgs: [
    'Bomb bay doors open — full load, walking the aimpoints',
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
// holding a firing solution long enough to put one heavyweight in the water,
// steering it down the wire, and then going deep. The weapon runs for minutes,
// not seconds, and the target never hears it until the seeker goes active.
const SUB_EVENTS = [
  { at: 0.02, kind: 'status', msgs: [
    '{base} at firing depth — tube one, {cs} away, wire good',
    'Firing solution good — {cs} swimming out of tube one, {base} steering',
  ] },
  { at: 0.22, kind: 'status', msgs: [
    'Weapon running normal — 40 knots on the wire, medium speed to the datum',
    '{cs} on course down the wire — {base} holding the solution passive',
  ] },
  { at: 0.46, kind: 'status', msgs: [
    'Steering correction sent — {cs} coming right onto the updated track',
    'Passive bearing drift on {tgt} — wire correction away to the weapon',
  ] },
  { at: 0.62, kind: 'status', msgs: [
    'ENABLE — {cs} going active, seeker searching',
    'Wire cut — {cs} enabled on its own sonar, autonomous from here',
  ] },
  { at: 0.86, kind: 'status', msgs: [
    'ACQUISITION — {cs} has the hull, closing at 55 knots',
    'Seeker locked on {tgt} — weapon in terminal, going under the keel',
  ] },
  { at: 0.99, kind: 'status', msgs: ['UNDER-KEEL DETONATION — {tgt}'] },
];

// Written the moment the noisemaker actually goes in the water, so the line and
// the false target on the sonar display are the same event — the same contract
// SAM_LINES has with the streak on a radar scope.
const TORPEDO_CM_LINES = [
  'Countermeasures — {tgt} put a noisemaker over the side and turned away',
  '{tgt} at flank, knuckle in the water — {cs} reattacking around the false target',
  'Decoy blooming in the seeker picture — {cs} sorting the hull out of the noise',
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
    { x: 321, y: 221, tgtId: 'msl-khorramabad' },
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

// ---- Allied heads of government who call the moment the coalition forms ----
// Assembling the coalition is the one diplomatic action that puts other
// governments' names on the operation, so it is the one that earns a personal
// call. Both of them ring — London first, off the cable itself, then Paris the
// following turn (see `leaderCalls` in game.js). Taking a call is worth +1 world
// opinion, refusing it -1. Deliberately small numbers — this is a courtesy, not
// a lever, and it should never be worth farming. The whole point is that it
// costs the player nothing but a click and they still have to decide whether to
// be bothered.
//
// Each leader has two versions of the same call, chosen on world opinion at the
// moment the coalition forms (LEADER_STRONG_WORLD). Above the line the ally
// gives you the most it has in it to give; at or below it the same government
// gives you markedly less. For London that is the distance between putting the
// RAF under your command and offering everything except aircraft — bases,
// intelligence and sanctions, with a flat no to offensive operations. For Paris
// it is the distance between a defensive contribution and refusing to take part
// at all. France is the ally who is never fully in, and the good version of her
// call is still a no to anything that flies against Iran.
//
// Which means below the line neither ally puts a strike aircraft over Iran, and
// the coalition cable says so — see the `coalition` case in game.js, where the
// prose branches on the same tone. The sortie capacity the action grants does
// not branch: at that tone it is the Gulf partners flying, not the RAF.
//
// `clip` keys into AudioSys.FILES; `caption` is the fallback shown when the
// audio can't play (muted, autoplay refused, file missing) and is written as a
// paraphrase rather than a transcript so it can never contradict the recording.
// `declined` is shared across both versions — the snub reads the same however
// warm the call was going to be. `skin` / `hair` / `suit` / `tie` drive the
// cartoon portrait UI.drawLeader() builds, and `pin` selects which flag goes on
// the lapel.
const LEADER_STRONG_WORLD = 75;   // world opinion ABOVE this gets the unhedged call

const WORLD_LEADERS = [
  {
    id: 'uk',
    name: 'The Prime Minister of the United Kingdom',
    // `office` alone goes on the call card, where the country is already the
    // line above it; `name` is the full title and goes in the sentence.
    office: 'The Prime Minister',
    country: 'UNITED KINGDOM',
    pin: 'union',
    skin: '#e8b894', hair: '#4a3526', suit: '#2c3d60', tie: '#7a1f2e',
    declined: 'You let it go to the Secretary of State. It is noticed. A Number 10 spokesman is ' +
      'asked whether the Prime Minister has spoken to the President and declines to say — which ' +
      'is itself the story by the evening broadcasts.',
    strong: {
      clip: 'ukPmCallStrong',
      caption: 'The Prime Minister commits the RAF to joint strikes against Iran and tells you ' +
        'to consider British squadrons under your command.',
      accepted: 'You take the call. Downing Street briefs it out within the hour and hedges not ' +
        'one word of it — RAF squadrons are flying your missions against your targets, and the ' +
        'operation has a second flag on it that nobody had to be pressured into flying.',
    },
    standard: {
      clip: 'ukPmCall',
      caption: 'The Prime Minister offers basing, intelligence and joint sanctions — but tells ' +
        'you Britain will not take part in offensive operations against Iran.',
      accepted: 'You take the call. London gives you everything except the thing you asked for: ' +
        'the bases, the intelligence take, its name on the sanctions. British aircraft stay on the ' +
        'ground, and the readout is worded carefully enough that the distinction survives contact ' +
        'with the evening broadcasts.',
    },
  },
  {
    id: 'france',
    // France's head of state is the President, and the Élysée — not Matignon —
    // is who a US president calls about a war. The `clip` ids below still read
    // `francePmCall`: they are keys into AudioSys.FILES pointing at recordings
    // that already exist under those filenames, and they are never shown.
    name: 'The President of France',
    office: 'The President',
    country: 'FRANCE',
    pin: 'tricolore',
    skin: '#e3b08c', hair: '#2b2b2b', suit: '#26314a', tie: '#2f5390',
    declined: 'You let it go to the Secretary of State. Paris reads the snub exactly as a snub. ' +
      'Whatever the President intended to say to you privately is said in public instead, ' +
      'and the French position on this war hardens a degree overnight.',
    strong: {
      clip: 'francePmCallStrong',
      caption: 'The President offers French forces in a defensive role only — nothing that ' +
        'flies against Iran — and urges restraint and a negotiated end to the war.',
      accepted: 'You take the call. The Élysée readout is careful about what it is not: French ' +
        'assets are committed to the defence of the region and to nothing beyond it, and every ' +
        'line after that is about the diplomatic track. It is as far as Paris will go, and the ' +
        'President went to the trouble of saying it to you directly.',
    },
    standard: {
      clip: 'francePmCall',
      caption: 'The President tells you France will not take part in the operation, and ' +
        'warns you — plainly, on a secure line — not to make a mistake.',
      accepted: 'You take the call. There is no warm readout to brief out: Paris confirms only ' +
        'that the two of you spoke. France is out, and the President thought enough of the ' +
        'relationship to say so directly rather than let you learn it from a communiqué. ' +
        'Taking the call was the only part of this you controlled.',
    },
  },
];

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
