# AGENTS.md — Late Edition

Read [the repo rules](../AGENTS.md), [README.md](README.md), and
[docs/DIRECTION.md](docs/DIRECTION.md) before changing this game.
The direction document is the creative direction and art bible; its locked
decisions describe the target, not necessarily today's implementation.
Keep work inside this game unless the task explicitly permits shared files.

## Current module map

This is a static HTML/CSS game with native ES modules, no bundler, and
no external JavaScript runtime dependencies. Serve it over HTTP.

| File | Responsibility today |
| --- | --- |
| `index.html` | Desk shell, map canvas, broadsheet, controls, rotary-phone card, edition modal; loads `js/main.js`. |
| `css/style.css` | Mahogany desk, leather blotter, brass rail, newsprint slots, passes, phone and modal styling. |
| `js/config.js` | World dimensions, 90-second editions, districts, lamps, four operatives, slots, story catalog, three investigative arcs and phone dilemmas. |
| `js/sim.js` | `LateEditionSim`: mutable run state, dispatch/movement, leads, scoop races, sabotage, plating, projections, publishing, arc progression and dilemmas. Uses injected RNG, clock, storage and audio ports; exposes a canonical gameplay hash. |
| `js/main.js` | `LateEditionApp`: creates sim/audio/renderer, binds mouse/keyboard/buttons, renders DOM, advances the frame loop and exposes `window.lateEditionApp`. Includes showcase/combat preview setup. |
| `js/renderer.js` | `NoirCityRenderer`: Canvas2D city, coordinate conversion, sprites, rain/ripples, dispatch lines, leads, rivals, operatives and callouts. |
| `js/rng.js` | Mulberry32 PRNG with validated integer/pick helpers and inspectable state. |
| `js/adapters.js` | Safe best-score persistence, optional audio ports and URL seed parsing. |
| `js/presentation.js` | Display-only clock, wire, banner and operative-status formatting. |
| `js/audio.js` | `NoirAudio`: lazy WebAudio unlock, three fetched MP3 cues, synthesized fallback tones, mute and phone/press timers. |
| `assets/` | Existing sprite PNGs and three MP3 effects, loaded with relative URLs. |
| `scripts/` | Documentation-reference checker and its isolated adversarial shell tests. |
| `tests/` | Adversarial lint/PRNG/adapter/delta tests and a five-edition golden replay. |
| `package.json` | Native ES modules; development-only lint/test tools and npm scripts. |

## Sim/UI boundary

- Today `main.js` passes audio into the sim, calls its methods, and also
  mutates selection, speed, pause, summary and operative targets directly.
  It scales frame delta by speed, calls `sim.step(dt)`, draws each frame,
  and rebuilds much of the DOM every 250 ms.
- `sim.js` imports config and pure helper/adapter modules; no DOM or browser APIs.
  Gameplay randomness uses the injected RNG; IDs use counters. It owns visual
  effect/traffic data for compatibility, excluded from gameplay hashes.
- The canvas renderer reads sim state and maintains its own decorative
  rain/ripples and hover state. DOM updates and input binding belong in
  `main.js`; Canvas2D drawing belongs in `renderer.js`.
- The constructor accepts `{ seed, rng, storage, audio, now }`. `main.js` creates
  browser adapters and parses `?seed=N`, falling back to a wall-clock seed.
  Storage uses `readBest`/`writeBest`; audio has optional named cues. Display
  formatting lives in `presentation.js`. Keep browser APIs out of sim logic.
- Current scoops auto-plate; arc progress advances on publishing; unanswered
  phone calls take the reject effect. The art bible's manual print/bury/spike
  workflow, persistent file drawer and 210-second editions are future work.

## Determinism rules

- Equal seeds, elapsed-time steps and ordered inputs produce equal gameplay
  hashes, pinned after each of five editions in the golden replay test.
- All gameplay randomness uses injected mulberry32. ESLint and source tests ban
  `Math.random`, `Date`, `window`, `document`, `localStorage` and `performance` in sim.
- Renderer-only rain/ripple randomness may use `Math.random`, but must never
  affect gameplay, IDs, hit-testing or the sim's random stream.
- `step` ignores nonfinite/nonpositive deltas, splits valid time into <=50 ms
  substeps and caps catch-up at 10 s per call to bound work. `now()` only stamps
  wire events; steps drive gameplay time. Reset rewinds the built-in RNG only.
- `getStateHash()` uses FNV-1a over UTF-8 canonical JSON, sorting object keys.
  It includes gameplay, RNG/counters and edition summaries, excluding saved best,
  ports, wire/timestamps, traffic, banners, flashes, callouts and display fields.
  See README for the replay contract and injected RNG lifecycle.

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
cd late-edition
npm ci                    # Node 22.22+ (22.x) or 24.8+; lockfile is required
npm run lint              # ESLint, stylelint standard, html-validate recommended
npm test                  # node:test: bad fixtures must fail; real sources pass
cd ..
bash -n late-edition/scripts/check-docs.sh late-edition/scripts/check-docs.test.sh
bash late-edition/scripts/check-docs.sh
bash late-edition/scripts/check-docs.test.sh
```

Individual checks: `npm run lint:js`, `npm run lint:css`, `npm run lint:html`
from this directory. Bad fixtures are excluded from normal lint discovery;
tests feed their contents through the production configurations deliberately.

The docs checker skips vendor `node_modules` and exempts only direction/changelog
history in project files. Its optional directory argument is for isolated fixtures.
Both shell checks and the separate `late-edition` npm job run in GitHub CI.
Broader gameplay tests and coverage arrive in #82. Run all tests/linters before finishing;
never claim unrun CI is green. Keep `package-lock.json` in sync with dependencies.
For UI changes, serve the repo and use the root guide's headless render check.

Tests must force unhappy paths, including checker rejection and clean acceptance.
The planned sim suite must exercise invalid dispatch, empty/double publishing,
timeouts, insufficient funds, stat bounds, destroyed presses, out-of-order arcs
and simultaneous rival/player completion, rather than only successful play.

## Best-practice exceptions and reasons

- Native modules and committed source avoid a build stage because the game
  deploys directly from static files; preserve relative asset/import URLs.
- Mutable sim/UI coupling remains legacy debt for the stable-input work; browser
  APIs and display formatting are now behind ports/adapters (#81).
- Repeated `innerHTML` rendering uses authored content today; stable keyed
  updates and an explicit game-over screen are planned to fix lost input/focus.
  Never interpolate untrusted content into this path.
- Audio fetch/resume failures are currently swallowed so missing cues or
  browser autoplay restrictions cannot stop play; fallback tones are intentional.
- Audit exception (2026-10-21, #80): stylelint 17.16.0's transitive `braces@3.0.3`
  has a stack-exhaustion denial-of-service advisory,
  [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
  `npm audit fix` leaves seven high-severity package entries from this one advisory
  through micromatch, fast-glob, globby, stylelint and its configs. No non-breaking
  fix is available; npm proposes breaking downgrades to stylelint 7.7.0 and
  stylelint-config-standard 15.0.1. Retain current lint coverage: these are dev-only
  lint tools, not shipped (`late-edition/node_modules/` is excluded via the root
  `.dockerignore`). Re-run audit and upgrade when a compatible fix is released.
- Keep new exceptions inline at the affected code with when/why and follow-up.
  No blanket ESLint disables: only `eslint-disable-next-line <specific-rule>`
  followed by `-- <reason>` when an exception is necessary.

Update README/CHANGELOG when behavior or conventions change; do not turn this
guide into a historical log. Keep it at **150 lines or fewer**.
