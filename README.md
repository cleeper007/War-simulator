# Commander in Chief: Persian Gulf War

A browser-based, turn-based war simulator. You are the President of the United States
in a shooting war with Iran — part **DEFCON**, part grand-strategy situation room.
The mission is victory: destroy Iran's nuclear program and break its ability to fight,
while the casualty count, the home front, and the global economy grind against you.

> **Note:** This is a work of strategic fiction. The scenario, events, and outcomes are
> invented and abstracted for gameplay, in the tradition of DEFCON, Twilight Struggle,
> and Command: Modern Operations. It depicts no real events and endorses no policy.

## Screenshots

<!-- Add screenshots here, e.g.: -->
<!-- ![Situation Room](screenshots/situation-room.png) -->
<!-- ![Strike planning](screenshots/strike-planning.png) -->

## How to Play

Open `index.html` in any modern browser — no build step, no server, no dependencies.

### The situation

Iranian missiles have struck a US destroyer in the Strait of Hormuz. This is not a
crisis to be managed — it is a war to be won. Each turn is 12 in-game hours; you have
20 turns (10 days) before the campaign culminates.

### How you win

1. **Decisive military victory** (the primary path) — destroy the nuclear program
   (Natanz and Fordow, 100% degradation) **and** break Iran's war machine: its missile
   bases, its naval bases, and the IRGC command complex.
2. **Armistice** (rare, conditional) — Tehran only comes to the table once the program
   is destroyed and its forces are collapsing, and even then each overture is a gamble.
   Diplomacy is a face-saving off-ramp from a war you are already dominating — not a
   strategy to open with. Attempt it too early and the rebuff costs you at home.

There is no abstract escalation meter. Iran's behavior is driven by what it actually
has left: while its missile force, navy, and IRGC command function, it fights at full
fury; as you destroy them, its capacity to hurt you physically drains away. The
**IRAN WAR CAPACITY** meter in the status bar tracks the enemy's remaining ability to
fight — the mission is driving it to zero.

### How you lose

- **Unsustainable losses** — 150+ US dead. The home front stops funding the war.
- **Impeachment** — approval collapses below 20%.
- **Economic collapse** — the Strait of Hormuz stays closed too long, or oil passes $240.
- **Campaign culmination** — 20 turns expire with the program still standing (defeat);
  expire with real damage done and it's a graded stalemate instead.

### Theater forces and the naval transit

You open the war with one deck — the *Abraham Lincoln*, on station in the North Arabian
Sea, well east of Oman — and everything else is somewhere else. Two forces can be brought in, and **Fifth
Fleet cuts one naval transit plan a night**, so only one deployment order goes out per
turn and the order you put them in is the decision:

- **USS Gerald R. Ford** — five turns out. She arrives at standoff in the Arabian Sea
  and roughly doubles what you can put in the air in a day. Every fighter sortie and
  every Tomahawk in this war comes off a deck, so the second one is the difference
  between servicing the target list and picking at it.
- **509th Bomb Wing (B-2)** — one turn out, Whiteman AFB to Diego Garcia. There is not
  a stealth bomber in the hemisphere until you send for it, and the GBU-57 is the only
  thing in the inventory that reaches Fordow. Two sustainable missions off the ramp,
  regenerating one every three turns.

One goes tonight, the other tomorrow. The bombers are cheap in time and priceless in
reach; the carrier is slow and pays out for the rest of the war. Sending the Ford first
costs a turn before the 509th can follow — she does not have to arrive first, but that
lost night still puts Fordow a turn further away.

Once in theater, each deck is either **forward** in the North Arabian Sea box east of
Oman (full sortie generation, inside the longest-legged anti-ship weapons Iran owns) or
**back** in the deep Arabian Sea toward the Indian Ocean approaches (untouchable, half
the strike power). Repositioning takes a turn at reduced
capability, still exposed.

### Israel

Israel is not an American asset. It is a **semi-autonomous actor with its own clock**,
and it starts *sidelined* — watching, waiting, and losing patience while Iran's
enrichment halls stand.

You have two ways this goes, and only one of them is your choice:

- **Coordinate with them** (diplomatic action). IAF squadrons join openly: +2 fighter
  capacity, and **one** combined US–Israeli deep-strike package unlocks against Natanz
  *or* Fordow — the only path to the buried halls that isn't a B-2. It is genuinely
  strong and genuinely not free. It costs 8 points of world opinion up front, the
  strike itself carries a diplomatic surcharge on top of the target's normal cost
  (−13 at Fordow vs −5 for an American strike), it takes two turns to plan and fly,
  it risks aircrew, and it is **one-shot** — spend it at Natanz and Fordow still needs
  a bomber. Most of all, it makes Israel a live target: Iranian salvos start going
  west, and your war acquires a second front you don't command.
- **Ignore them.** Each turn they sit out while the program is still largely intact
  (under 50% degraded), their patience drops. At zero they **fly the mission
  themselves**, on their timetable, without telling you. They have no penetrators, so
  the results are partial — real damage at Natanz, very little at Fordow — but the
  escalation is total: a heavy world-opinion hit, an oil spike, an approval hit, and
  every capital in the region convinced Washington authorized it. You inherit the
  consequences of a strike you did not plan and could not aim.

Your SecState and NSA will warn you as the clock runs down — the patience count is in
the advisor panel and on the diplomacy button. Coordinating openly widens the war;
letting it happen by default widens it *and* wastes the shot.

Once Israel is in play, Iranian retaliation weights up, its ally-strikes bias toward
Haifa, and a new **missile exchange** event fires: Iran barrages Israel, the IAF
answers, and the counter-strike can destroy Iranian missile bases CENTCOM never
scheduled. It cuts both ways. Like everything else in the sim it is capacity-gated —
a broken Iran cannot sustain a two-front fight.

Israeli bases (Nevatim and Hatzerim) appear on the forward-basing layer in amber
rather than US blue: allied, but not under your command.

### When an aircraft goes down: personnel recovery

Fighter packages flown against live SAMs can be shot down. Most of the time the crew
gets out — two good chutes, two beacons, and living Americans on Iranian soil. When
that happens, and *only* when that happens:

- An amber **AIRCREW DOWN** marker appears on the map at the crash area, and a
  **PERSONNEL RECOVERY** panel opens at the top of the situation room showing the
  callsign, the airframe, how long they have been down, and the running **capture
  risk**. Recover them or lose them; both panel and marker disappear the moment it
  resolves either way.
- **Every turn you wait, the odds get worse in both directions** — the recovery
  estimate falls and the capture risk rises, because IRGC search parties are working
  the ground and helicopters are flying a pattern over it. Do nothing long enough and
  they are taken alive: hostage crisis, −10 approval, −4 world opinion, and Tehran
  running the footage for the rest of the war.
- **Push ISR** (spends the turn's action slot) to lock the position: +10% recovery,
  −8% capture risk.
- **Launch the recovery** — a pair of HH-60W Jolly Green IIs with pararescuemen, an
  A-10 Sandy flight as on-scene commander, tankers off the coast. Costs one fighter
  sortie for the escort. One attempt. It plays out live in the tactical panel over
  about seventy seconds, and it branches four ways: everyone out clean; everyone out
  at the cost of a pararescueman and a shot-up airframe; a **partial recovery** where
  the helicopter leaves with one crewman and not two; or the rescue force itself
  destroyed on the objective — a downed Jolly, a downed Sandy, up to nine dead, and
  more Americans in IRGC custody than the shootdown created.

Night turns (18:00) help. Rolled-back SAM belts help. A carrier forward helps. Time
does not. The failure cases are the harshest political outcomes in the game — a failed
rescue costs 15 points of approval and 8 of world opinion — and a clean one is worth
more at home than any target on the map.

### Each turn you can

- **Lay on strikes** — click any Iranian target on the map, pick a strike package,
  review estimated success / time on target / risks, and authorize. **Strikes take
  time**: authorizing commits the assets and puts the mission *in flight* — fighter
  and TLAM packages arrive at the end of the turn, with battle damage assessment in
  the battle report; B-2s transiting from Diego Garcia take two turns. Missions
  resolve in the order they were laid on, so a SEAD sweep queued first clears the air
  for the packages behind it.
  - *Fighter sorties* — flexible, but at risk from whatever SAMs are alive at TOT.
  - *Cruise missiles (TLAM)* — no aircrew risk, ineffective against buried sites.
  - *B-2 missions (GBU-57)* — scarce, slow to arrive, and not in theater until the
    509th is deployed forward; the **only** weapon that can kill Fordow.
- **Move forces** — surge the *Ford*, deploy the B-2s forward, or shift a deck between
  the North Arabian Sea and the deep Arabian Sea. Only one deployment order can be cut per turn
  (see above); posture changes are free of it.
- **Take one diplomatic action** — backchannel talks, UN pressure, sanctions,
  coalition building, **coordinating with Israel**, an address to the nation, or
  **ISR prep** for the raid below.
- **Decide what to do about Israel** — see below. Doing nothing is also a decision.
- **Launch the leadership raid** — a single Tier-1 SOF task force, one attempt for
  the whole game. Base odds are low; ISR prep and degraded air defenses / IRGC
  command raise them. Success shatters Tehran's command chain (and may open — or
  poison — the negotiation window); failure puts dead or captured operators on
  Iranian state TV.
- **Go get your people** — *only if a strike aircraft has actually been shot down.*
  There is no standing rescue button; the panel does not exist until aircrew are on
  the ground. See below.
- **End the turn** — your packages arrive and BDA comes back, then Iran answers with
  whatever the volley left standing: missile barrages, proxy attacks, shipping
  attacks, cyber, or moves against the Strait of Hormuz.

The game autosaves at each turn boundary and after every resolved action —
use **Continue** on the title screen to pick up a war in progress, **Save & Quit** to
step away, and the mute toggle in the status bar to silence sound effects.

### Tips

- Intact air defense networks (SEAD targets) degrade every non-stealth strike and can
  shoot down your aircraft. Roll them back first — and remember that a shootdown is
  not just two names on a list, it is a rescue decision you will have to make under a
  clock.
- **If you have aircrew on the ground, go the first night.** Waiting a turn is the one
  thing that worsens the recovery odds and the capture odds at the same time. Push ISR
  *and* launch in the same turn — it costs the diplomatic action slot, not the clock.
- **Tempo is everything.** Iran does not stop shooting because you did, and its war
  machine spins up over the first days. Every turn it survives is a turn it spends
  killing Americans.
- **Plan your volleys.** Strikes land at the end of the turn, in the order you queued
  them — SEAD first, then the packages that need clear skies. Don't double-tap a
  target that already has a mission inbound; watch the MISSIONS IN FLIGHT list.
- Iran's retaliation scales with what's left of its missile and naval forces. Killing
  missile bases thins the barrages; killing naval bases lets the Fifth Fleet force the
  Strait of Hormuz back open. A dead navy can't keep the strait shut.
- Striking oil infrastructure is economic pressure with brutal diplomatic costs — and
  Iran retaliates against shipping.
- **Decide about Israel early, on purpose.** The worst outcome is drifting into their
  unilateral strike: you pay the escalation, Fordow survives, and you never got the
  joint package. If you're going to bring them in, do it while there's still a buried
  site worth spending the shot on — and roll back the SAMs first, because the joint
  package is manned aircraft and air defenses gut its odds.
- Don't open with the backchannel: Tehran reads early overtures as weakness and your
  approval pays for it. Break their forces first; the Omanis will tell you when the
  pragmatists start counting launchers.
- Watch the Strait of Hormuz indicator and the casualty count — those two clocks, plus
  approval, are what actually beat you.

## Project Structure

```
commander-in-chief/
├── index.html        # Layout: map, sidebar, status bar, modals
├── css/
│   └── style.css     # Dark situation-room theme
├── audio/            # Sound effects (synthesized in-house, royalty-free WAVs)
└── js/
    ├── geodata.js    # Real country outlines (Natural Earth 50m, generated)
    ├── data.js       # Targets, US assets, static data
    ├── map.js        # SVG map, pan/zoom, icons, strike animations
    ├── ai.js         # Iranian AI opponent, advisors, headlines
    ├── audio.js      # Sound manager: preload, play, mute toggle
    ├── ui.js         # HUD, sidebar, modal rendering
    ├── specops.js    # Special forces: ISR prep + leadership raid
    ├── csar.js       # Combat search and rescue: downed aircrew, recovery mission
    └── game.js       # State, turn loop, strikes, save/continue, endings
```

Vanilla HTML/CSS/JavaScript. All state is client-side. The SVG map uses real country
borders from [Natural Earth](https://www.naturalearthdata.com/) 50m data (public domain),
pre-projected into the game's coordinate space and baked into `js/geodata.js`, so there
are still no API keys or network calls. Targets and bases sit at their real-world
coordinates (equirectangular projection, standard parallel 28°N).

## Deploying to GitHub Pages

The game is fully static and deploys from the repository root.

1. Push the repo to GitHub:
   ```sh
   git remote add origin https://github.com/<you>/commander-in-chief.git
   git push -u origin main
   ```
2. On GitHub: **Settings → Pages → Build and deployment**
   - Source: *Deploy from a branch*
   - Branch: `main`, folder: `/ (root)`
3. Your game will be live at `https://<you>.github.io/commander-in-chief/`.

(Alternatively, use the `/docs` folder method by moving the files into `docs/`, or a
`gh-pages` branch — the root-of-`main` method is the simplest for this layout.)

## License

MIT
