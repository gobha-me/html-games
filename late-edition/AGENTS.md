# AGENTS.md — Late Edition

Read [the repo rules](../AGENTS.md), [README.md](README.md), and [docs/DIRECTION.md](docs/DIRECTION.md) before changing this game.
The direction document is the art bible; locked decisions describe the target, not necessarily today’s implementation. Keep work inside this game unless explicitly permitted.

## Current module map

Static HTML/CSS with native ES modules, no bundler or external runtime dependencies. Serve over HTTP.
| File | Responsibility today |
| --- | --- |
| `index.html` | Desk shell, map canvas, broadsheet, controls, rotary-phone card, edition modal; loads `js/main.js`. |
| `css/style.css` | Mahogany desk, ink map frame, brass rail, newsprint slots, passes, phone and modal styling. |
| `js/config.js` | Paste-up timing/penalties, 210-second editions, scaled pressure windows, pure payroll unlock/desk-size rules, world, roster, slots, stories, arcs, dilemmas and `FILE_DRAWER` balance. |
| `js/sim.js` | `LateEditionSim`: mutable run state, dispatch/movement, leads, scoop races, sabotage, explicit layout/Inside/Spike, projections, publishing, arc progression, dossier economy and delayed calls. Uses injected RNG, clock, storage and audio ports; exposes a canonical gameplay hash. |
| `js/main.js` | `LateEditionApp`: creates sim/audio/renderer, binds mouse/keyboard/buttons, renders DOM, advances the frame loop and exposes `window.lateEditionApp`. Includes showcase/combat preview setup and modal focus handling. |
| `js/hotkeys.js` | Shared `HOTKEYS` action/key/phase table and lookup. Keep all application shortcuts here; Node tests reject duplicate keys per phase, including injected collisions. |
| `js/palette.js` | Ten art colors and derived alpha, mirrored in CSS root tokens. |
| `js/renderer.js` | `NoirCityRenderer`: size/DPR-cached city, edge fog and three title skyline layers; dynamic weather, figures, telegrams, traffic and callouts. Input coordinates stay unchanged. |
| `js/city.js`, `js/silhouettes.js` | Fixed cosmetic seed 1947 builds district architecture; shared Canvas2D figures paint map units and pass portraits. Never consume gameplay RNG. |
| `js/save.js` | Version 1 save allowlist, strict validation and bounded decoding; ignores pollution/unknown keys. |
| `js/rng.js` | Mulberry32 PRNG with validated integer/pick helpers and inspectable state. |
| `js/adapters.js` | Safe run/best-score persistence, optional audio ports and URL seed parsing. |
| `js/dom.js` | Keyed recursive DOM reconciliation with text-only dynamic copy; preserves unchanged nodes and input. |
| `js/opening.js` | Pure 30-second Lou Vance dialogue clock; reduced-motion text reveal. |
| `js/presentation.js` | Display-only clock, wire, banner and operative-status formatting. |
| `js/audio.js` | `NoirAudio`: lazy WebAudio unlock, three fetched MP3 cues, synthesized fallback tones, mute and phone/press timers. |
| `assets/` | Retained editor/press PNGs, audio and licensed WOFF2 fonts; unit PNGs retired (see asset notes). |
| `scripts/` | Documentation-reference checker and its isolated adversarial shell tests. |
| `tests/` | Adversarial area suites, 50-seed fuzzing, lint/adapter tests and a five-edition golden replay. |
| `package.json` | Native ES modules; development-only lint/test tools and npm scripts. |

## Sim/UI boundary

- Today `main.js` passes audio into the sim, calls its methods, and also
  mutates speed, pause, summary and operative targets directly. It scales delta by speed, calls `sim.step(dt)`, draws each frame and reconciles keyed DOM every 250 ms.
- `sim.js` imports config and pure helper/adapter modules; no DOM or browser APIs.
  Gameplay randomness uses the injected RNG; IDs use counters. Visual effects/traffic are excluded from hashes.
- The canvas renderer reads sim state and maintains its own decorative
  rain/fog, scoop flashes, an independent animation clock and hover state. DOM/input belongs in `main.js`; Canvas2D in `renderer.js`.
- The constructor accepts `{ seed, rng, storage, audio, now }`. `main.js` creates
  browser adapters and parses `?seed=N`, falling back to a wall-clock seed.
  Storage uses `readBest`/`writeBest` and `readRun`/`writeRun`/`clearRun`; audio has optional named cues. Display
  formatting lives in `presentation.js`. Keep browser APIs out of sim logic.
- Scoops stay in the tray. `lockUp()` or 11 PM enters `paste-up`; `placeStory`,
  `unplace`, `spike` return `{ok, reason}`. Occupied/duplicate placements reject.
  `insideStories` scores at ¼ weight; `spikedStories` holds six aging dossiers (#86).
  `editionLayout.assisted` flags A's −500 readers; empty Banner costs 6 trust.
  Sim owns phases/gates/scoring; UI owns pointer capture, selection and stale-drag cancellation.
- Drawer: `useFile(uid, favor|squeeze|print-later, target?)`, `shredFile(uid)` return
  `{ok, reason, effects}`. D toggles it in desk/paste-up; Fold uses F/2. Re-filing preserves age/exposure
  and original value. `subjectStates`, `subjectProgress`, `pendingBurns`,
  `raidBlocked` and dossiers are hashed and saved run state (#87).

## Determinism rules

- `serialize()` / static `deserialize(json) → {ok, sim|reason}` use format `late-edition-save`, v1.
  Save only after report dismissal or boundary unload; never mid-edition (replaying known outcomes is an exploit).
  Reports freeze the sim. Save includes RNG state, next edition/unlocks, drawer/arcs and scheduled burns.
  v0 (no format) and future versions refuse with a message; invalid values reject, unknown/pollution keys drop.
  UI owns autosave/Continue/overwrite confirmation and game-over deletion; storage failure is non-fatal.
- Equal seeds, elapsed-time steps and ordered inputs produce equal gameplay
  hashes, pinned after each of five editions in the golden replay test.
- All gameplay randomness uses injected mulberry32. ESLint and source tests ban
  `Math.random`, `Date`, `window`, `document`, `localStorage` and `performance` in sim.
- City/rain use a separate fixed cosmetic RNG; animation never affects gameplay, IDs or hit-testing.
  Reduced motion freezes decorative animation and suppresses flashes; cache rebuilds only on size/DPR changes.
- `step` ignores nonfinite/nonpositive deltas, splits valid time into <=50 ms
  substeps and caps catch-up at 10 s per call to bound work. `now()` only stamps
  wire events; steps drive gameplay time. Reset rewinds the built-in RNG only.
- `getStateHash()` uses FNV-1a over UTF-8 canonical JSON, sorting object keys.
  It includes opening/viewport gates, gameplay, RNG/counters and summaries, excluding saved best,
  ports, wire/timestamps, traffic, banners, flashes, callouts and all display/color fields.
  `withoutCosmetics` recursively filters records and preserves arrays; map keys remain gameplay data.
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

## Art and audio direction

Follow [the art bible](docs/DIRECTION.md#art-bible). CSS `:root` has exactly ten
art tokens mirrored by `js/palette.js`, the only JS color-literal source. Use
`color-mix()` for alpha; never add CSS hex/rgb/hsl outside root declarations.
The selector-scoped stylelint plugin runs the actual core rules; nested/grouped
selectors do not inherit the exception. Tests check parity and text contrast.
Self-hosted Latin WOFF2: League Gothic, Old Standard TT, Courier Prime and
masthead-only UnifrakturMaguntia; licenses/provenance in [font credits](assets/fonts/README.md).
Use the pinned fonttools/Brotli venv rebuild script; never add a font CDN.
Paper rotations are deterministic; #89 adds cached silhouette city/title art. Motion respects reduced motion.
#88 removes cosmetics from hashes with a one-time golden repin. Every seed-81 replay print must match
`tests/fixtures/pre88-gameplay.json` from `2c8b14e` (economy, HP, edition, scoops, drawer);
never regenerate from current code. #100 removes the duplicate rival row, repins hashes
and reserves its RNG draw.

## Verification

```bash
cd late-edition
npm ci                    # Node 22.22+ (22.x) or 24.8+; lockfile is required
npm run lint              # ESLint, stylelint standard, html-validate recommended
npm run test:coverage     # node:test plus >=80% sim.js line coverage; Node 22 native flags
npx playwright install chromium
npm run test:e2e          # Chromium browser scenarios; starts a root static server
cd ..
bash -n late-edition/scripts/check-docs.sh late-edition/scripts/check-docs.test.sh
bash late-edition/scripts/check-docs.sh
bash late-edition/scripts/check-docs.test.sh
```

Individual checks: `npm run lint:js`, `npm run lint:css`, `npm run lint:html`. Bad fixtures test production configs.
The docs checker skips `node_modules`, exempts direction/changelog history and accepts a fixture directory. Shell/lint/unit/Chromium checks run in GitHub CI.
Area/fuzz/economy tests cover gameplay; e2e uses SwiftShader (1080p/5s, frame p95 <20ms, render p95 <8ms). Run all checks;
never claim unrun CI is green. Keep `package-lock.json` in sync with dependencies.
For UI changes, serve the repo and use the root guide's headless render check.

Tests force invalid orders, empty/double print, timeouts, insufficient funds, stat bounds, destroyed presses,
out-of-order arcs, simultaneous completions, bad saves and storage failures.

## Best-practice exceptions and reasons
- Native modules and committed source avoid a build stage because the game
  deploys directly from static files; preserve relative asset/import URLs.
- Mutable selection/targets remain legacy sim/UI coupling; browser APIs and
  display formatting are behind ports/adapters. Keyed lists use delegated events
  and textContent/createElement; never interpolate dynamic content into HTML.
- Run peak and last-printed page are display history, excluded from gameplay hashes.
  Restart chooses fresh browser entropy; sim.reset() itself remains deterministic.
- `edition` stays numeric; its assist flag is `editionLayout.assisted`, captured in
  `editionSummary.assisted`. Pointer drags never move sim copy until a valid drop.
- Audio fetch/resume failures are currently swallowed so missing cues or
  browser autoplay restrictions cannot stop play; fallback tones are intentional.
- Audit exception (2026-10-21, #80): stylelint 17.16.0's transitive `braces@3.0.3`
  has [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), a stack-exhaustion denial of service.
  `npm audit fix` leaves seven high-severity package entries from this one advisory
  through micromatch, fast-glob, globby, stylelint and its configs. No compatible fix
  is available; npm proposes stylelint 7.7.0/config-standard 15.0.1 downgrades. Retain
  coverage: these tools are dev-only (node_modules is excluded by root .dockerignore).
  Re-run audit and upgrade when a compatible fix is released.
- Keep exceptions inline with when/why. No blanket ESLint disables: only
  `eslint-disable-next-line <specific-rule> -- <reason>` when necessary.

Update README/CHANGELOG when behavior or conventions change. Keep this guide at **150 lines or fewer**.
