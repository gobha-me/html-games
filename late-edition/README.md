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
│   ├── sim.js          # 1947 city-dispatch, rival AI & edition economy, injected ports & canonical state hash
│   ├── rng.js          # Mulberry32 seeded PRNG, validated integer bounds & array selection
│   ├── adapters.js     # Safe score persistence, audio ports & URL seed parsing
│   ├── presentation.js # Display-only clock, wire, banner & status formatting
│   ├── renderer.js     # 2.5D extruded noir landmarks, wet streetlamp reflections & rain
│   ├── config.js       # Districts, operative roster, front-page slots & story catalog
│   └── audio.js        # Hybrid MP3 + procedural WebAudio typewriter, flashbulb & press SFX
└── assets/
    ├── audio/          # Newsroom & street MP3 sound effects
    └── sprites/        # Top-down pixel-art operatives, editor portrait & rotary press art
```

## Status and Direction

Playable with investigative story arcs, rival scoop races and rotary-phone dilemmas.
The sim is deterministic: equal seeds, ordered inputs and elapsed-time steps produce
equal gameplay hashes. Browser storage, audio and clocks are injected ports.
See [AGENTS.md](AGENTS.md) for the module map and verification commands. ESLint, stylelint and HTML validation are
enforced in CI alongside adversarial gameplay tests and at least 80% line coverage
for `js/sim.js`. [docs/DIRECTION.md](docs/DIRECTION.md) is the creative direction
and art bible; its manual layout, file drawer and visual overhaul are targets.

## Deterministic runs

Open `?seed=81` to choose the run's seed (`0` and signed safe integers are valid).
Missing/invalid seeds use `Date.now()` in `main.js`. Mulberry32 normalizes seeds to
unsigned 32-bit values. The browser supplies storage/audio adapters and a monotonic
clock; headless callers can use `new LateEditionSim({ seed: 81 })` with no browser.
An injected `rng` overrides `seed` and must provide `nextFloat()`; optional
`getState()` is included in the hash. Reset rewinds the built-in seeded generator;
callers own the lifecycle/reset of an injected generator.

Call `step(seconds)` with the same deltas and ordered commands for a replay.
Nonfinite, negative and zero deltas do nothing, including consuming no randomness.
Valid deltas subdivide into **at most 50 ms** steps; each call processes at most
**10 seconds**, dropping additional catch-up time to bound work after a long stall.
Normal frame-sized deltas keep their existing timing. A seed alone does not make
independently timed browser clicks/frame sequences identical.

`getStateHash()` returns eight hex digits: FNV-1a over UTF-8 canonical JSON
(sorted object keys, ordered arrays) of gameplay state, RNG state/draw count,
IDs/counters, economy, movement, leads, arcs, dilemmas, edition summaries and the
last-published time (which prevents duplicate publication within a sim tick).
Stored best scores, adapters, wire messages/timestamps, traffic, banners,
flashes, callouts and display-only labels/angles/animation phases are excluded:
they never drive gameplay. The injected `now()` supplies wire event timestamps
only; gameplay time always comes from `step()`. Renderer rain/ripples may use
`Math.random()` independently without advancing the gameplay generator.

The golden test runs five editions with dispatches, investigation, auto-plating,
rivals, fortification and phone choices, asserting a pinned hash after each print.
Storage reads that are absent, corrupt, nonnumeric, negative or nonfinite become
zero. Blocked reads and quota-exceeded writes never interrupt play; the current
run's best is retained in memory.

Publishing returns `true` on success and `false` for a duplicate in the same sim
tick, a destroyed press or a finished run. The first print can happen at time zero;
another requires simulated time to advance. A reset clears the guard.

## Development checks

Use Node 22.22+ (22.x) or 24.8+. From `late-edition/`:

```bash
npm ci
npm run lint
npm run test:coverage
```

`lint:js`, `lint:css` and `lint:html` run ESLint 10 flat config, stylelint's
standard config and html-validate's recommended checks separately. There are no
rule relaxations or lint disables. `npm test` checks deliberately bad fixtures,
lint failure exit codes, clean real sources, PRNG validation, five-edition golden
replays and adversarial sim/adapter inputs; fixtures are excluded from normal
lint runs. `test:coverage` runs the same suite with native Node coverage, includes
only `js/sim.js`, and fails below 80% line coverage. The area suites pin current
dispatch, publish, phone, economy, arc, race and sabotage behavior; fuzz tests run
50 seeds through three editions of legal/illegal commands and both terminal paths,
checking numeric bounds, unique plates and sticky game over after every action.
The classic-script fixture exercises `no-implicit-globals`, which
cannot fire for module-scoped declarations. Documentation checks and their shell
self-tests are listed in [AGENTS.md](AGENTS.md).

These are development dependencies only; the game still deploys without a build.
The root `.dockerignore` excludes `late-edition/node_modules/` and
`late-edition/tests/` because the Dockerfile copies the repository into the static
server image. Tests and their deliberately invalid fixtures are never game assets.
