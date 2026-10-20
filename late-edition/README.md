# LATE EDITION // 1947

**1947 Noir Newsroom & City-Dispatch RTS** — Run the night desk of *The Metropolitan Chronicle*. Dispatch investigative reporters, Speed Graphic photojournalists, and Tommy-gun street fixers across a 2.5D rain-slicked metropolis, beat rival syndicate papers to breaking leads, and plate your 4-column front page before the midnight rotary presses roll.

## How to Play

- **Select Operatives (`[1]`–`[4]` or Click Unit/Roster Card)**:
  - **[1] Jack Vance (`BEAT-1` Reporter)** & **[2] Peggy Sullivan (`BEAT-2` Reporter)** — Investigate breaking city leads and file verified copy for the front page.
  - **[3] Clara Reyes (`FLASH-1` Photographer)** — Snaps Speed Graphic photo proof on active leads (**1.8×** front-page circulation & revenue multiplier) and stuns rival operatives with her flashbulb.
  - **[4] "Knuckles" Malone (`ENFORCE-1` Street Fixer)** — Intercepts *Daily Herald* rival reporters and *Observer Syndicate* saboteurs (+$35 bounty per neutralization).
- **Dispatch & Recall**:
  - **Left-Click** any breaking lead node on the 2.5D city map (or click **SEND** in the roster) to dispatch your selected operative.
  - **Right-Click** on the map to recall the selected operative back to Press Row HQ.
- **Newsroom Desk Operations**:
  - **`[Q]` Wiretap Police Band ($65)** — Intercepts 2 exclusive breaking leads across the city.
  - **`[W]` Accept Syndicate Hush-Money (+$160)** — Emergency treasury injection at the cost of `-10%` credibility, while cooling mob heat by `-16%`.
  - **`[E]` Fortify Press Room ($75)** — Restores rotary press integrity to `100%` and repels *Observer* saboteurs.
- **Front-Page Broadsheet & Press Run**:
  - Verified scoops automatically plate into open columns on the right-hand parchment broadsheet (`Banner Headline 2.0×`, `Above-the-Fold Lead 1.5×`, `Darkroom Photo Exposé 1.6×`, `Below-the-Fold Column 1.2×`), or click any scoop in the tray to re-plate.
  - Press **`[SPACE]`** (or click **ROLL THE PRESSES**) at any time, or let the press clock reach `12:00 AM` midnight to print the edition and collect circulation & street revenue.

## Tech Stack & File Layout

- Zero external runtime dependencies — self-contained ES modules + HTML5 2D Canvas + WebAudio synthesizer + original `.mp3` SFX.
- Custom 1947 noir pixel-art sprites and illustrations (`late-edition/assets/sprites/*.png`).

```text
late-edition/
├── index.html          # 3-column Noir Newsroom & Broadsheet Press Deck UI
├── css/
│   └── style.css       # Smoky mahogany, brass & aged-parchment responsive layout
├── js/
│   ├── main.js         # UI controller, input bindings & showcase state
│   ├── sim.js          # Deterministic 1947 city-dispatch, rival AI & edition economy
│   ├── renderer.js     # 2.5D extruded noir city blocks, wet streetlamp reflections & rain
│   ├── config.js       # Districts, operative roster, front-page slots & story catalog
│   └── audio.js        # Hybrid MP3 + procedural WebAudio typewriter, flashbulb & press SFX
└── assets/
    ├── audio/          # Newsroom & street MP3 sound effects
    └── sprites/        # Top-down pixel-art operatives, editor portrait & rotary press art
```
