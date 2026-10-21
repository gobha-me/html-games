# LATE EDITION // 1947

**1947 Noir Newsroom Desk & Broadsheet Paste-Up RTS** — Run the night desk of *The Evening Star*. Scout a 2.5D rain-slicked metropolis on the green-leather Precinct Dispatch Blotter (left), send investigative reporters, Speed Graphic photojournalists, and Tommy-gun street fixers via physical Manila Press Passes, and replace faded municipal wire stand-ins on a full-height 1947 Cream Newsprint Front Page (right) before the `12:00 AM` rotary presses roll.

## How to Play (1-2-3 Night Editor Workflow)

1. **① Pick a Manila Press Pass (`[1]`–`[4]` or Click Pass at Bottom-Left):**
   - **[1] Jack Vance (`BEAT-1` Reporter)** & **[2] Peggy Sullivan (`BEAT-2` Reporter)** — Investigate breaking city leads and file exclusive front-page scoops.
   - **[3] Clara Reyes (`FLASH-1` Photographer)** — Snaps Speed Graphic halftone photo proof on active leads (**1.8×** front-page circulation & revenue multiplier) and stuns rival operatives with her flashbulb.
   - **[4] "Knuckles" Malone (`ENFORCE-1` Street Fixer)** — Intercepts *Daily Herald* rival reporters and *Observer Syndicate* saboteurs (+$35 bounty per neutralization).
2. **② Click a Breaking Lead on the Map (or Pinned Yellow Telegram Wire Slip):**
   - Dispatches your selected operative along street avenues to investigate the lead before rival *Daily Herald* reporters scoop it.
3. **③ Plate Exclusive Scoops on the Broadsheet & Roll the Presses (`[SPACE]`):**
   - At the start of each night shift, the 4 front-page columns (`Banner Headline 2.0×`, `Above-the-Fold Lead 1.5×`, `Darkroom Photo Exposé 1.6×`, `Editorial Column 1.2×`) hold faded sepia municipal **Wire Stand-In** stories.
   - Verified scoops automatically rip off the wire stand-in and plate bold black-ink headlines, datelines, multi-column justified newspaper copy, and halftone darkroom plates onto the front page!
   - Press **`[SPACE]`** (or pull the **🖨️ ROLL PRESSES** lever) at any time, or let the engraved brass flip-clock reach `12:00 AM` midnight to print the edition.

## Tech Stack & File Layout

- Zero external runtime dependencies — self-contained ES modules + HTML5 2D Canvas + WebAudio synthesizer + original `.mp3` SFX.
- Custom 1947 noir pixel-art sprites and illustrations (`late-edition/assets/sprites/*.png`).

```text
late-edition/
├── index.html          # Two-Zone 1947 Mahogany Desk: Left Dispatch Blotter + Right Cream Broadsheet
├── css/
│   └── style.css       # Burled mahogany, green leather blotter, manila press passes & aged newsprint
├── js/
│   ├── main.js         # UI controller, wire stand-in/paste-up renderer & input bindings
│   ├── sim.js          # 1947 city-dispatch, rival AI & edition economy (seeded determinism planned in #81)
│   ├── renderer.js     # 2.5D extruded noir landmarks, wet streetlamp reflections & rain
│   ├── config.js       # Districts, operative roster, front-page slots & story catalog
│   └── audio.js        # Hybrid MP3 + procedural WebAudio typewriter, flashbulb & press SFX
└── assets/
    ├── audio/          # Newsroom & street MP3 sound effects
    └── sprites/        # Top-down pixel-art operatives, editor portrait & rotary press art
```

## Status and Direction

Playable with investigative story arcs, rival scoop races and rotary-phone dilemmas.
The sim currently uses unseeded randomness, wall-clock IDs, audio and browser storage;
the pure, seeded core is tracked in #81. See [AGENTS.md](AGENTS.md) for the current
module map and verification commands. Lint tooling arrives in #80 and the adversarial
sim suite in #82. [docs/DIRECTION.md](docs/DIRECTION.md) is the creative direction
and art bible; its manual layout, file drawer and visual overhaul are targets.
