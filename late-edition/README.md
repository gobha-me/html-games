# LATE EDITION // 1947

**1947 Noir Newsroom Desk & Broadsheet Paste-Up RTS** — Run the night desk of *The Evening Star*. Scout a 2.5D rain-slicked metropolis on the green-leather Precinct Dispatch Blotter (left), send investigative reporters, Speed Graphic photojournalists, and Tommy-gun street fixers via physical Manila Press Passes, and replace faded municipal wire stand-ins on a full-height 1947 Cream Newsprint Front Page (right) before the `12:00 AM` rotary presses roll.

## How to Play (1-2-3 Night Editor Workflow)

Open on a desktop at **1280×720 or larger**. The masthead shows your saved best
circulation. Click **Start the night shift** or press **Enter** to take the desk.
Lou Vance rings with a 30-second assignment; **Skip [Esc]** or Escape dismisses it
immediately, even mid-line. The title, call and idle first desk consume no edition
time: **night one's clock starts only after a successful dispatch**. A lead click
with no selected pass sends Jack Vance, the first reporter. Invalid or locked
orders leave the clock waiting. Publishing is unavailable before that dispatch.

The payroll opens gradually:

| Night | New tools |
| --- | --- |
| 1 | Reporters Jack and Peggy, leads and the page |
| 2 | Clara Reyes, photographer (`3`) |
| 3 | Knuckles Malone, fixer (`4`), and Guard Press (`E`) |
| 4 | Wiretap (`Q`), hush-money (`W`), night line (`T`) and automatic dilemmas (`Y`/`N`) |

Unavailable passes/actions stay off the desk and their shortcuts do nothing.
Saboteurs arrive no earlier than night three, when you can counter them.
Each edition runs **210 seconds** at 1×, or about 105 seconds at 2×. Lead lifetime
is 112 seconds; rival spawn intervals and the 40%-of-night phone window scale from
the former 90-second edition. Lead replenishment remains 0.65/s when below three,
with immediate replacement of scooped leads, preserving dispatch pace per minute.

Below either minimum dimension, **The desk is too small** covers the desk and
pauses both play and Lou's call. Resize back to resume the same state, including
an intentional pause. Reduced-motion preferences freeze canvas rain/ripples,
disable CSS animation and reveal Lou's dialogue immediately; Skip remains available.
Reloading during the opening returns to an idle title. Only the best circulation
is saved; continuing a saved run belongs to the later save/load feature.


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

When trust reaches zero or saboteurs destroy the presses, the **PAPER FOLDED**
telegram shows the reason, edition reached, this run's peak circulation, and final
front page (the current paste-up if it has copy, otherwise the last printed page).
**Start a new night shift**, Enter or Space starts a fresh seed and Lou’s opening call;
the saved all-time record remains. Space on the telegram never rolls presses.

Keyboard-only: use **Tab/Shift+Tab** to reach passes, wire leads, scoops and page
slots; **Enter/Space** activates the focused control. **[1]–[4]** selects a pass.
Space away from controls rolls presses; on an edition report it continues.
Reports move focus to their action and restore the previous control on dismissal.

## Tech Stack & File Layout

- Zero external runtime dependencies — self-contained ES modules + HTML5 2D Canvas + WebAudio synthesizer + original `.mp3` SFX.
- Custom 1947 noir pixel-art sprites and illustrations (`late-edition/assets/sprites/*.png`).

```text
late-edition/
├── index.html          # Two-Zone 1947 Mahogany Desk: Left Dispatch Blotter + Right Cream Broadsheet
├── css/
│   └── style.css       # Burled mahogany, green leather blotter, manila press passes & aged newsprint
├── js/
│   ├── dom.js          # Keyed DOM reconciliation; dynamic copy uses textContent
│   ├── main.js         # UI controller, wire stand-in/paste-up renderer & input bindings
│   ├── sim.js          # 1947 city-dispatch, rival AI & edition economy, injected ports & canonical state hash
│   ├── rng.js          # Mulberry32 seeded PRNG, validated integer bounds & array selection
│   ├── adapters.js     # Safe score persistence, audio ports & URL seed parsing
│   ├── opening.js      # Pure 30-second cold-open text clock and reduced-motion reveal
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

The golden test runs five full 210-second editions with progressive payroll,
dispatches, investigation, auto-plating, rivals, fortification and night-four/five
phone choices, asserting a pinned hash after each print. Issue #84 repins the
hashes for the longer timings, gated mechanics and canonical opening/viewport gates.
Storage reads that are absent, corrupt, nonnumeric, negative or nonfinite become
zero. Blocked reads and quota-exceeded writes never interrupt play; the current
run's best is retained in memory.

New simulations and `reset()` begin at `phase: "title"`. Call `startNightShift()`,
then `finishColdOpen()` to enter the desk; a successful dispatch releases the
first-night clock. The UI drives the separate `ColdOpen` presentation clock.
`deskTooSmall` stops simulation without changing `paused` or the opening phase.

Publishing returns `true` on success and `false` for a duplicate in the same sim
tick, a destroyed press or a finished run. The first print can happen at time zero after dispatch;
another requires simulated time to advance. Reset clears the guard and returns to title.

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

## Browser verification (#83, #84)

Use the supported Node version in `package.json` (22.22+ in 22.x, or 24.8+):

```bash
npm ci
npm run lint
npm run test:coverage
npx playwright install chromium
npm run test:e2e
# Repeat the desk input regressions, including the permanent 4x CPU case:
npm run test:e2e -- e2e/desk.spec.js --repeat-each=5
```

Playwright starts Python's static HTTP server at the repository root on port 8123.
The tests in `e2e/` are linted and excluded from the explicit `tests/*.test.mjs`
Node test glob and Docker image. GitHub's `late-edition` job installs Chromium
with its OS dependencies, runs the suite and uploads the HTML report, screenshots
and traces on failure. Reports go to ignored `playwright-report/` and `test-results/`.

Each browser test checks console errors and uncaught exceptions. Tests use the
existing `window.lateEditionApp` inspection handle to force trust collapse and
hostile copy. The click contract is **100 actual pointer clicks on currently live
lead buttons = exactly 100 calls returning true from `dispatchOperativeToLead`**,
with simulation time advancing throughout, at both normal speed and 4× CPU
slowdown through Chromium's CDP. Every pointerdown must target a live lead;
no failed clicks are excluded or retried. Same-frame regressions force a scoop
(with immediate replacement) and expiry between display ticks, asserting that
obsolete buttons disappear while surviving keyed buttons stay attached.
Separate cases hold a pointer down across changing renders, verify keyed
node/focus/hover retention, remove stale
leads, inject HTML-shaped text, hold restart keys and resize during keyboard-only
play through one published edition. The tests replace the legacy remote font
stylesheet with empty CSS so offline runs exercise local fallback fonts; the
remote typography migration belongs to the planned art pass.

The six lists reconcile keyed nodes; unchanged subtrees stay attached between
250 ms display ticks. Lead membership also reconciles immediately after each
simulation frame that changes IDs/order, so scooped or expired leads cannot
remain clickable until the next display tick. Container event delegation is bound
once. Runtime DOM copy uses `createElement`/`textContent`, with no `innerHTML`
templates. Sim history
(`peakCirculation`, `lastPrintedFrontPage`) is display-only and excluded from
canonical gameplay hashes; deterministic replay behavior remains unchanged.

The shared browser helper takes existing desk scenarios through Start, Skip and
first dispatch. Opening tests separately force a mid-line skip, reload, a missing
selection, locked keys, every payroll unlock, the full 30-second call, exact
1279×720 / 1280×719 rejection and 1280×720 acceptance, resize recovery during play
and the call, retained user pause, and live reduced-motion preference changes.
