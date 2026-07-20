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

Escalation hitting 10/10 is **not** a loss — it just means the war has gone total and
Iran fights at maximum intensity. The ladder is the arena, not the failure state.

### How you lose

- **Unsustainable losses** — 150+ US dead. The home front stops funding the war.
- **Impeachment** — approval collapses below 20%.
- **Economic collapse** — the Strait of Hormuz stays closed too long, or oil passes $240.
- **Campaign culmination** — 20 turns expire with the program still standing (defeat);
  expire with real damage done and it's a graded stalemate instead.

### Each turn you can

- **Strike targets** — click any Iranian target on the map, pick a strike package,
  review estimated success / escalation cost / risks, and authorize.
  - *Fighter sorties* — flexible, but at risk from intact air defenses.
  - *Cruise missiles (TLAM)* — no aircrew risk, ineffective against buried sites.
  - *B-2 missions (GBU-57)* — scarce; the **only** weapon that can kill Fordow.
- **Take one diplomatic action** — backchannel talks, UN pressure, sanctions,
  coalition building, an address to the nation, or **ISR prep** for the raid below.
- **Launch the leadership raid** — a single Tier-1 SOF task force, one attempt for
  the whole game. Base odds are low; ISR prep and degraded air defenses / IRGC
  command raise them. Success shatters Tehran's command chain (and may open — or
  poison — the negotiation window); failure puts dead or captured operators on
  Iranian state TV.
- **End the turn** — Iran responds based on the escalation level and what you hit:
  proxy attacks, missile barrages, shipping attacks, cyber, or moves against the
  Strait of Hormuz.

The game autosaves at each turn boundary and after every resolved action —
use **Continue** on the title screen to pick up a crisis, **Save & Quit** to step
away, and the mute toggle in the status bar to silence sound effects.

### Tips

- Intact air defense networks (SEAD targets) degrade every non-stealth strike and can
  shoot down your aircraft. Roll them back first.
- **Tempo is everything.** Escalation does not decay while you wait, and Iran does not
  stop shooting because you did. Every turn its war machine survives is a turn it
  spends killing Americans.
- Iran's retaliation scales with what's left of its missile and naval forces. Killing
  missile bases thins the barrages; killing naval bases lets the Fifth Fleet force the
  Strait of Hormuz back open. A dead navy can't keep the strait shut.
- Striking oil infrastructure is economic pressure with brutal diplomatic costs — and
  Iran retaliates against shipping.
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
