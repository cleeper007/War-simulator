# Commander in Chief: Persian Gulf Crisis

A browser-based, turn-based geopolitical strategy game. You are the President of the
United States during an escalating military crisis with Iran — part **DEFCON**, part
grand-strategy situation room. Manage strikes, diplomacy, domestic politics, and the
global economy without letting the crisis spiral into regional war.

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

Iranian missiles have struck a US destroyer in the Strait of Hormuz. You're in the
Situation Room with strike authority requested and the world watching. Each turn is
12 in-game hours; you have 20 turns (10 days) to resolve the crisis.

### Objectives (victory)

1. **Degrade Iran's nuclear program** — cripple the Natanz and Fordow enrichment sites
   (at least 75% program degradation).
2. **Force Tehran to negotiate** — with the program degraded and escalation under
   control, use the Omani backchannel to close a deal.

### How you lose

- **Regional war** — escalation hits 10/10. The ladder runs out of rungs.
- **Impeachment** — approval collapses below 20%.
- **Economic collapse** — the Strait of Hormuz stays closed too long, or oil passes $220.
- **Stalemate** — 20 turns expire with nothing resolved (graded, but no win).

### Each turn you can

- **Strike targets** — click any Iranian target on the map, pick a strike package,
  review estimated success / escalation cost / risks, and authorize.
  - *Fighter sorties* — flexible, but at risk from intact air defenses.
  - *Cruise missiles (TLAM)* — no aircrew risk, ineffective against buried sites.
  - *B-2 missions (GBU-57)* — scarce; the **only** weapon that can kill Fordow.
- **Take one diplomatic action** — backchannel talks, UN pressure, sanctions,
  coalition building, or an address to the nation.
- **End the turn** — Iran responds based on the escalation level and what you hit:
  proxy attacks, missile barrages, shipping attacks, cyber, or moves against the
  Strait of Hormuz.

### Tips

- Intact air defense networks (SEAD targets) degrade every non-stealth strike and can
  shoot down your aircraft. Roll them back first.
- Escalation decays when you *don't* strike. Restraint is a weapon.
- Striking oil infrastructure is effective economic pressure but carries brutal
  diplomatic costs — and Iran retaliates against shipping.
- Tehran won't negotiate from a position of strength: build leverage (degrade the
  program, sanctions), then de-escalate to open the window for a deal.
- Watch the Strait of Hormuz indicator. A closure is an economic doomsday clock.

## Project Structure

```
commander-in-chief/
├── index.html        # Layout: map, sidebar, status bar, modals
├── css/
│   └── style.css     # Dark situation-room theme
└── js/
    ├── data.js       # Targets, US assets, static data
    ├── map.js        # SVG map, pan/zoom, icons, strike animations
    ├── ai.js         # Iranian AI opponent, advisors, headlines
    ├── ui.js         # HUD, sidebar, modal rendering
    └── game.js       # State, turn loop, strike resolution, endings
```

Vanilla HTML/CSS/JavaScript. All state is client-side; the SVG map is drawn in code
(stylized, not to scale) so there are no API keys or network calls.

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
