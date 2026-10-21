# AGENTS.md — Late Edition

Read [the repo rules](../AGENTS.md), [README.md](README.md), and
[docs/DIRECTION.md](docs/DIRECTION.md) before changing this game.
The direction document is the creative direction and art bible; its locked
decisions describe the target, not necessarily today's implementation.
Keep work inside this game unless the task explicitly permits shared files.

## Current module map

This is a static HTML/CSS game with five native ES modules, no bundler, and
no external JavaScript runtime dependencies. Serve it over HTTP.

| File | Responsibility today |
| --- | --- |
| `index.html` | Desk shell, map canvas, broadsheet, controls, rotary-phone card, edition modal; loads `js/main.js`. |
| `css/style.css` | Mahogany desk, leather blotter, brass rail, newsprint slots, passes, phone and modal styling. |
| `js/config.js` | World dimensions, 90-second editions, districts, lamps, four operatives, slots, story catalog, three investigative arcs and phone dilemmas. |
| `js/sim.js` | `LateEditionSim`: mutable run state, dispatch/movement, leads, scoop races, sabotage, plating, projections, publishing, arc progression and dilemmas. Also audio calls, best-circulation storage and display strings. |
| `js/main.js` | `LateEditionApp`: creates sim/audio/renderer, binds mouse/keyboard/buttons, renders DOM, advances the frame loop and exposes `window.lateEditionApp`. Includes showcase/combat preview setup. |
| `js/renderer.js` | `NoirCityRenderer`: Canvas2D city, coordinate conversion, sprites, rain/ripples, dispatch lines, leads, rivals, operatives and callouts. |
| `js/audio.js` | `NoirAudio`: lazy WebAudio unlock, three fetched MP3 cues, synthesized fallback tones, mute and phone/press timers. |
| `assets/` | Existing sprite PNGs and three MP3 effects, loaded with relative URLs. |
| `scripts/` | Documentation-reference checker and its isolated adversarial shell tests. |
| `package.json` | Marks JavaScript as ES modules; currently has no dependencies or npm scripts. |

## Sim/UI boundary: current and intended

- Today `main.js` passes audio into the sim, calls its methods, and also
  mutates selection, speed, pause, summary and operative targets directly.
  It scales frame delta by speed, calls `sim.step(dt)`, draws each frame,
  and rebuilds much of the DOM every 250 ms.
- `sim.js` imports only config, but is **not pure**: it reads/writes
  localStorage, calls audio, uses wall-clock/random values and formats wire
  messages, banners and clock strings. It also owns visual effect/traffic data.
- The canvas renderer reads sim state and maintains its own decorative
  rain/ripples and hover state. DOM updates and input binding belong in
  `main.js`; Canvas2D drawing belongs in `renderer.js`.
- Target (#81): a pure sim with explicit inputs and injected seeded PRNG
  (mulberry32) and clock. Storage, audio and display formatting move behind
  adapters; UI consumes state/events rather than changing sim internals.
  Keep DOM, browser storage and audio APIs out of new sim logic.
- Current scoops auto-plate; arc progress advances on publishing; unanswered
  phone calls take the reject effect. The art bible's manual print/bury/spike
  workflow, persistent file drawer and 210-second editions are future work.

## Determinism rules

- Target: equal seeds, elapsed-time steps and ordered inputs produce equal
  gameplay state. Route all gameplay randomness through the injected PRNG.
  No `Math.random()` or wall-clock IDs in the target sim.
- This is **not yet true**: rival choice/IDs, lead replenishment and standings
  use `Math.random()`; rival IDs also use `Date.now()`. Tracked in #81.
  Do not describe the current sim as deterministic or add more hidden entropy.
- Renderer-only randomness may vary, but must never affect gameplay, IDs,
  hit-testing or the sim's random stream.
- Time must come through explicit steps/clock inputs. Validate invalid and
  extreme deltas during #81; today's frame-loop clamp is not a sim-level guard.

## Lore: canonical names

| Entity | Canonical name | Allowed shorthand / implementation note |
| --- | --- | --- |
| Player paper | **The Evening Star** | Evening Star; uppercase on signage. |
| Rival paper | **The Daily Herald** | Daily Herald / Herald; `herald` and `herald_hq` IDs. |
| Mob-backed syndicate/tabloid | **The Observer Syndicate** | Observer / syndicate; `observer` and `observer_hq` IDs. |
| Managing editor | Lou Vance | Directives and phone calls. |
| Reporters | Jack Vance; Peggy Sullivan | `rep_1`; `rep_2`. |
| Photographer | Clara Reyes | `photog_1`. |
| Street fixer | "Knuckles" Malone | `fixer_1`. |

The legacy `gazette` standings ID labels a Herald (Midtown) circulation row
to preserve behavior in this string-only naming pass; it is not another paper.
Do not rename internal IDs or change standings mechanics in a copy-only task.

## Art and audio direction

Follow [the art bible](docs/DIRECTION.md#art-bible) and
[locked decisions](docs/DIRECTION.md#locked-decisions-2026-10-21): restrained
newsprint/sodium palette, period self-hosted type, tactile desk objects,
silhouette noir city, grounded tone and free-licensed or synthesized audio.
Current bright accents, Google Fonts and pixel sprites predate that target;
replace them in the dedicated art pass, not during unrelated documentation work.

## Verification

From the repository root, run the checks available now:

```bash
for file in late-edition/js/*.js; do node --check "$file" || exit 1; done
bash -n late-edition/scripts/check-docs.sh late-edition/scripts/check-docs.test.sh
bash late-edition/scripts/check-docs.sh
bash late-edition/scripts/check-docs.test.sh
```

The checker rejects obsolete references outside the direction source and
changelog history. Its optional directory argument is for isolated fixtures.
Both scripts run in `.github/workflows/ci.yml`.

ESLint, stylelint and HTML validation configuration/commands arrive in #80;
the adversarial `node:test` sim suite and coverage command arrive in #82.
There are no game lint or sim-test npm scripts yet. Use installed linters
when available and report their exact configuration and any existing failures.
Run all applicable tests/linters before finishing; never claim unrun CI is green.
For UI changes, serve the repo and use the root guide's headless render check.

Tests must force unhappy paths, including checker rejection and clean acceptance.
The planned sim suite must exercise invalid dispatch, empty/double publishing,
timeouts, insufficient funds, stat bounds, destroyed presses, out-of-order arcs
and simultaneous rival/player completion, rather than only successful play.

## Best-practice exceptions and reasons

- Native modules and committed source avoid a build stage because the game
  deploys directly from static files; preserve relative asset/import URLs.
- Mutable sim/UI coupling, formatted strings and browser storage in the sim
  are legacy debt retained until #81 to avoid mixing a refactor into copy work.
- Repeated `innerHTML` rendering uses authored content today; stable keyed
  updates and an explicit game-over screen are planned to fix lost input/focus.
  Never interpolate untrusted content into this path.
- Audio fetch/resume failures are currently swallowed so missing cues or
  browser autoplay restrictions cannot stop play; fallback tones are intentional.
- Keep new exceptions inline at the affected code with when/why and follow-up.
  No blanket ESLint disables: only `eslint-disable-next-line <specific-rule>`
  followed by `-- <reason>` when an exception is necessary.

Update README/CHANGELOG when behavior or conventions change; do not turn this
guide into a historical log. Keep it at **150 lines or fewer**.
