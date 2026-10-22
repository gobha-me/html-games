# Changelog — LATE EDITION // 1947

## [2.10.0] — 2026-10-21 (#89 — Oblique silhouette city)

### Changed
- Replace outlined district slabs and pixel units with a fixed-seed oblique noir
  city: varied extruded buildings, cornices, fire escapes, water towers, sparse
  lit windows, eight landmark silhouettes and small period street signs.
- Wet asphalt, sodium pools/reflections, rain and drifting fog at the city edges;
  pinned telegram lead flags, red arc thread, sodium selection rings and scoop flash.
- Shared procedural fedora/coat staff portraits and street figures, photographer
  camera, broad fixer, brass Herald hats/sedans and Observer cigarette embers;
  police-blue searchlights are reserved for raids. Delete the four unused unit PNGs;
  retain the editor portrait and press illustration, with asset documentation.
- Three cached title skyline depth layers, bridge, water towers, lit windows,
  Evening Star rooftop sign, slow searchlight/parallax. Reduced motion freezes
  decorative animation and suppresses flashes; title pixels remain static.
- Cache static layers at displayed resolution/DPR; per-frame work is dynamic art.
  Simulation, gameplay RNG, world hit targets and golden hashes stay unchanged.

### Art director review round 1 (#89)
- Darken distant skyline masses into low-contrast night haze over an ink-to-faint
  mahogany/sodium horizon; keep near silhouettes ink-black with sparse windows.
  Replace grey corner fog with subtle ink-only shading. Place a slow, low-alpha
  sodium searchlight behind the near buildings so its beam reads against the sky.
- Give map buildings lighter oblique roofs, dark fronts, setbacks/parapets/cornices
  and soft street shadows cast away from the nearest lamp. Restrict mahogany to
  a faint tint near lamps; use solid tanks/roofs/legs and substantial pier cranes.
- Enlarge street staff/rivals 1.6×, retain number badges and add long cast shadows
  and a more readable camera. Retain all eight district street signs with curb
  offsets around telegram flags, headlines and series badges.
- Add adversarial coincident-lamp/shadow and obstructed-sign checks plus a 1600×900
  browser regression for night values, ink-only corners and every district’s signs.
  The browser report attaches review screenshots; gameplay and input are unchanged.

### CI performance follow-up (PR #101)
- Follow-up CDP LayerTree/paint-flashing/paint + cc traces identify fifteen
  compositor surfaces from multiply-blended paper, including a 1286×997 grain
  surface; unconditional 250 ms text replacement also invalidates the broadsheet.
  Encode grain as equivalent translucent black and use normal source-over (three
  surfaces). Preserve unchanged text nodes and update changed copy in place.
- Add browser regressions comparing the baked grain with the original SVG on all
  ten palette colors and rejecting unchanged UI text mutations, stale values,
  node replacement and HTML injection. Retain every performance assertion.
- Trace 4× CPU/1080p SwiftShader with render/UI User Timing and browser raster,
  paint, style/layout and compositor events. Two-core runs reproduced 66 frames
  even with weather disabled: raster flush stalls dominate that failure shape.
- Cache street-sign measurements/collision positions with in-place lead-edit
  invalidation and DPR-sized drifting fog sprites. Bake the existing SVG paper
  grain to an equivalent 120×120 PNG; retain its filter source/rebuild command.
- Require 150 fixed-dt render samples plus five seconds of live render timings:
  p95 <8ms normally, <16ms at CDP 4× CPU. Measure live pacing before the batch so
  queued benchmark raster work cannot contaminate it. Keep frame p95 <20ms when
  independent empty-page/full-viewport-canvas calibration sustains ≥55fps/<20ms;
  never waive render budgets or use an environment flag to waive frame pacing.
- Adversarial tests reject corrupt/missing calibration, force slow raster-shaped
  rAF starvation and over-budget rendering, and attack stale sign/fog caches.
  Local diagnosis and measurements are recorded in `docs/PERFORMANCE.md`.

### Verification
- Add adversarial cosmetic-generation/cache/DPR/nonfinite-delta tests; compare
  gameplay hash/RNG before and after rendering without changing the golden fixture.
- Browser regressions click ten distinct leads at 720p/1080p, attack hit-boundary,
  unit-priority and closed-dispatch paths, reject retired PNG requests/console
  errors, and compare title pixels under live reduced-motion preference changes.
- Five-second 1080p live SwiftShader smoke asserts rAF frame p95 <20ms and render
  CPU p95 <8ms, with metrics attached to the browser report. Initial local sample:
  16.7ms frame / 0.5ms render p95; superseded by the calibrated checks above.

### Art director review round 2 (PR #101)
- Remove the cached Observer warehouse label; each district now paints exactly
  one unique street-sign label, verified across the complete cold-cache render.
- Enlarge staff/rival silhouettes another 1.4×, with proportional number badges,
  selection/stun rings and dispatch markers. Offset telegram/headline/badge groups
  above/right/left/below to avoid figures and rings; crowded groups use a clear
  offset with a thin leader line. Keep lead coordinates and input targets intact.
- Slightly lift the three title silhouette layers using palette mixes, strengthen
  the slow sodium searchlight, and attach the Evening Star frame's two legs to
  the actual generated near-building roofline. Reduced motion remains static.
- Add adversarial unique-sign, crowded/boxed-in label, scaling, invalid geometry
  and multi-seed roof-anchor tests. Paper grain and performance gates are unchanged.

### Director-notes performance regression (PR #101)
- Cache telegram text/flags/stamps at display resolution, retaining label positions
  until lead geometry changes or a current figure/ring/sign would intersect them.
  Keep countdown/progress rings and leader lines live, and bounce the prompt bitmap.
  Invalidate in-place copy, verification and selection changes; release expired
  sprites and rebuild on size/DPR changes.
- Lazily bake only the visible city/title scene, use CPU-backed static bitmap
  sources, and declare the visible canvas opaque. Avoid unused skyline submissions
  and extra GPU producers competing with the live SwiftShader map. Preserve every
  director visual change and every performance assertion.
- Cache enlarged figure bodies by role/faction, preserving separate live bobbing,
  fixed cast shadows, badges and rings instead of resubmitting their coat/hat/camera
  paths each render. Invalidate figure resolution with the other DPR-sized art.
- Add adversarial incoming-obstacle, unlock/hover/selection, stale-content,
  last-lead removal and DPR checks, plus a live hidden-title regression. Extend
  profiling with complete historical art modules, frozen-placement ablation and
  explicit live-window trace totals; record results in `docs/PERFORMANCE.md`.

### Owner-approved performance simplification (PR #101)
- Place new lead labels once at four fixed diagonal offsets against HQ, street
  signs and existing labels; choose the first clear offset or the final offset
  when all are blocked. Always connect telegrams to their addresses with a thin
  leader line. Remove the recurring per-frame collision pass.
- Check figure/selection/dispatch/stun-ring overlaps at most every 250 ms of wall
  time, including while paused or under reduced motion. Re-place only an
  obstructed label and reuse its bitmap. Copy/selection/verification edits refresh
  pixels in place; address edits only retie the leader. Keep onboarding collision
  space for each label's lifetime, even after its first scoop, while tightly
  bounding cached images around actual artwork.
- Generate title skyline geometry/textures lazily, close bitmaps and clear canvas
  references/backing stores when leaving the title. Desk rendering never creates
  or retains title caches. Preserve unique district signs, 1.4× figures and the
  title depth contrast, rooftop sign and searchlight.
- Update adversarial tests for the exact 250 ms boundary, warm-frame zero collision
  work, persistent leaders, all-four-blocked fallback, unlock/hover/target/stun
  rings, cache closure, desk resize and title re-entry. Record verification in
  `docs/PERFORMANCE.md`.
- Give the starvation scenario the same 60 s total setup/test timeout as the two
  budget cases after reproducing a 23.8 s SwiftShader context-creation delay.
  Keep all measured frame/render budgets and adversarial assertions unchanged;
  document the initial failure and separate cache/trace diagnostics explicitly.

## [2.9.0] — 2026-10-21 (#88 — Art bible desk pass)

### Changed
- Ten strict palette tokens replace the legacy CSS/canvas hues. District seams
  are neutral ink; the existing city geometry and sprites await #89.
- Self-hosted Latin WOFF2 League Gothic, Old Standard TT, Courier Prime and
  masthead-only UnifrakturMaguntia replace Google Fonts. All four OFL licenses,
  pinned source revision and a fonttools/Brotli rebuild script are included.
- Mahogany wood grain, newsprint turbulence, deterministic paper rotations and
  shadows from a top-left lamp; telegram slips, punched manila passes, tabbed
  folders, carbon dots, red pinholes, bakelite phone and outlined ink stamps.
- Static caption text nodes: **74 → 37 (50% fewer)**; words: **286 → 99
  (65.4% fewer)**. Count excludes whitespace, comments, attributes, scripts/style
  and fields replaced at runtime; includes static controls. Including dynamic
  placeholders, all body text nodes fall from 103 to 44 and words from 395 to 121.
  Runtime instructional copy is shortened too; hotkeys and accessible action names remain.
- Body text is at least 14px with explicit line heights; faded stand-in text is
  removed. Text token contrasts range from **4.66:1 to 15.34:1**. Blue carbon dots
  use newsprint stock (5.65:1), rather than aged stock (which fails at 4.44:1).
- Paper slap and stamp hit last 120ms; reduced motion disables all CSS motion.
  A container query reflows the magnified desk; scrolling retains core actions.

### Art director review fixes (#100)
- Keep **The Evening Star** mastheads in mixed case with their accessible names.
- Show all four front-page slots together in desk and paste-up, without paper or
  slot-grid scrolling. Height-sharing grid tracks, clamped type/spacing and
  per-slot size queries shorten secondary excerpts; full headlines keep priority.
  Slot size (not viewport height) controls excerpts so tall, narrow desks also fit.
  Crowded copy trays and Inside lists scroll independently in bounded space.
- Move the drawer to the map column as a left-sliding manila folder, up to 420px
  wide, with an always-visible FILES tab. Transform motion takes 180ms (none under
  reduced motion). Keep keyboard operations, close/focus restoration and internal
  file scrolling; the folder and tab cannot cover the broadsheet.
- Replace the scroll-per-headline regression with simultaneous slot, viewport,
  grid/paper bounds, no-scroll, headline clipping and copy-tray checks in both
  phases at 1280×720, 1366×768, 1600×900 and 1920×1080. Crowded fixtures include
  twelve scoops, long headlines, photo plates and series stamps. Full-folder tests
  cover both phases at 1280×720/1920×1080 and reduced-motion/keyboard operation.
- Remove the duplicate Herald district row from simulation, UI and lore. Validate
  exactly two distinct canonical rivals on save/load. Existing v1 checkpoints
  discard only the validated historical third row; new saves contain two rivals.
  Unit tests require unique standings names matching the three-paper lore table.
- Repin golden hashes for the removed rival state, preserving its publish-time
  random draw so all later seeded gameplay stays unchanged. The original pre-#88
  player snapshot remains untouched: every recorded economy/HP/edition/scoop/file
  field still matches; rival rows intentionally fall outside that comparison.

### Verification and compatibility
- Stylelint runs core `color-no-hex` and `function-disallowed-list` outside root
  token declarations via a selector-scoped plugin; adversarial fixtures prove
  that ordinary, grouped and nested rules cannot bypass enforcement.
- Node tests reject literal colors in every JS module except `palette.js` and
  check exact token parity, font signatures/licenses and used text-pair contrast.
- Playwright attaches actual request logs and rejects external origins. Art
  scenarios check loaded families, 1280×720/1920×1080 layout, blocked fonts at
  100%/200% CSS layout zoom, core print/drawer actions and reduced motion.
- Removed the legacy district-accent checksum file and import. All color and
  display fields, including accents, district signage, operative descriptions
  and summary copy, are excluded consistently across the entire hash projection.
  Recursive filtering preserves ordered arrays, including nested dossier tags.
- One-time #88 golden hash repin: cosmetics left the hash; gameplay is unchanged.
  An independent fixture recorded from pre-#88 commit `2c8b14e` (after reproducing
  its original goldens) pins circulation, funds, credibility, heat, press HP,
  edition, scoops and drawer contents after every print in the five-edition replay.
  Adversarial hash tests recolor/delete display fields and mutate nested records,
  effects, summaries and geometry to distinguish cosmetics from gameplay.

## [2.8.0] — 2026-10-21 (#87 — Save/load the run)

### Added
- Version 1 `late-edition-save` checkpoints with seed, exact Mulberry32 state,
  next edition/unlock night, gameplay state, drawer, arcs, source status, raid
  protection and scheduled burned-source consequences. Pure `serialize()` and
  static `deserialize(json) → {ok, sim|reason}` validate an explicit allowlist.
- Autosave through the storage adapter after dismissing a press report, and on
  `beforeunload` only between editions. Mid-edition saves are excluded to preserve
  deterministic checkpoints and avoid replaying outcomes. Failed storage writes
  retain the previous checkpoint and warn without interrupting play.
- Title Continue with the next edition number, direct desk resumption and New run
  overwrite confirmation. Corruption, unsupported future versions and undefined
  v0 saves show a useful notice and permit fresh play. Game over deletes the run;
  the separate best circulation survives.
- Strict rejection of malformed/non-finite/out-of-range values, oversized drawers,
  duplicate UIDs, counter collisions and non-boundary snapshots; unknown and
  prototype-pollution keys are ignored. Bounded decoding never restores browser
  ports or instance methods from stored keys.
- Adversarial unit and browser tests for round-trip and continued-play equality,
  malformed/tampered/versioned saves, blocked/quota storage, overwrite cancellation,
  boundary-only unload, retained drawer and game-over cleanup.

### Changed
- Press reports freeze time and remaining catch-up substeps. Publication that
  exhausts trust folds the paper immediately, before it can become a checkpoint.
- Updated README and the local agent guide with the save contract and boundaries.

## [2.7.0] — 2026-10-21 (#86 — The file drawer)

### Added
- Six-card manila drawer; spiking converts copy into a named-subject dossier with
  tags, weight, three-night freshness and exposure. Full capacity rejects atomically
  and asks the editor which file to shred. Every publish ages files; expiry shreds
  with a wire notice. Dossiers, subject state, pending calls and raid protection
  persist across editions and are included in the gameplay hash; disk saves are #87.
- Pure `useFile(uid, action, target?)` and `shredFile(uid)` commands. Favors call a
  valuable district tip, stop one goon/bank one raid block, or kill a rival's target
  story while preserving player access. Squeezes trade evidence for cash/protection,
  growing exposure and seeded burn risk; a burn destroys evidence and schedules a
  private-line payoff/trust-and-heat dilemma 1–2 editions later.
- Print later produces EXCLUSIVE — HELD copy: +50% when the subject's arc/publication
  advanced, −25% otherwise. Original value, age and exposure survive re-filing;
  held tray copy and live contact tips age too. Tips retain source exposure to
  prevent tip/scoop/re-file cash loops. Dead/exposed subjects reject blackmail. Unaffordable
  payoffs reject; timeout/printing cannot evade a burned-source consequence.
- Drawer handle and D shortcut, native keyboard actions with stable keyed focus,
  carbon-blue freshness dots and red exposure pinholes. Fold retains F/2.
  Full-drawer pending spikes support explicit cancellation
  and invalidate at the deadline. New styling uses only the period palette.
- Adversarial Node tests for capacity, shredding/expiry, duplicate/expired/burned UID
  use, all targets and gates, exposure/burn boundaries, delayed calls and both
  outcomes, insufficient payoff funds, held-copy bonuses and re-file loop attacks.
  Twenty seeded 20-night greedy and never-spike bots must remain viable under the
  documented $100,000 total cash ceiling; each fresh weight-5 file yields at most
  $900 even against an adversarial never-burning RNG.
- Chromium scenarios for spike → tip → visible lead, keyboard squeeze, full-drawer
  shred/cancel and deadline invalidation. Fuzz invariants enforce capacity and
  drawer/tray uniqueness. Five-edition golden hashes repinned for new subject and
  drawer consequence state; replay inputs unchanged. README and agent guide updated.

### Fixed
- Resolved the drawer/Fold shortcut collision found during manual review: D
  (desk drawer) toggles the drawer in desk and paste-up; F assigns selected copy
  to Fold. Button labels and help match. All application shortcuts share a
  phase-specific `HOTKEYS` table; Node tests reject duplicate bindings and injected
  collisions, including the original F regression. Chromium verifies F placement,
  occupied-Fold rejection, D toggling in both phases, repeat-key suppression and
  drawer/modal isolation.

## [2.6.0] — 2026-10-21 (#85 — Hand layout)

### Added
- Paste-up phase at 11 PM (175 seconds) or L / Lock up the page after dispatch.
  Scoops stay in the tray until placed. Banner, Fold, Photo and Editorial retain
  their weights; unlimited Inside copy earns ¼ value, trust and heat, including
  reduced series bonuses. Spiked copy is removed from scoring and retained in
  `spikedStories` across editions for #86.
- Pure `placeStory(uid, slotId)`, `unplace(uid)`, `spike(uid)` commands return
  `{ok, reason}`. Occupied slots reject without displacement; placed copy must
  return to tray before moving. Unknown/prototype slots and stale UIDs reject atomically.
- Pointer capture dragging with drop highlighting, cancellation and edition guards;
  keyboard Tab/arrows selection, 1–6 or B/F/P/E/I/S assignment, U/Delete unplace.
  The broadsheet takes focus during paste-up; new styling uses the period palette.
- Accusatory Banner copy adds 8 heat. An empty Banner prints a wire stand-in and
  costs 6 trust, alongside existing empty-paper penalties. Midnight publishes only
  placed copy; pending drags cannot alter either the printed page or the next edition.
- A optional assist fills only empty front-page slots, marks `editionLayout.assisted`
  and the edition report, and costs 500 readers once per edition. Projection and
  publishing share scoring, so penalties cannot drift between preview and print.
- Adversarial Node coverage for layout gates, duplicate/occupied slots, malformed
  inputs, plated/buried/queued spikes, repeated spikes/assist, burial, accusation,
  empty Banner, and deadline mid-drag. Chromium covers real pointer and keyboard
  layout, cancellation, expiry during input, wire stand-ins and visible assist scoring.

### Changed
- Five-edition replay explicitly lays out stories and repins golden hashes for
  the new layout state, Inside/Spike collections, assist flag and placement scoring.
  Existing scoop/rival/photo tests now assert unplaced tray copy. Fuzzing exercises
  layout/unplace/spike/assist with story uniqueness across every collection.
- Updated play instructions and agent guide; kept the numeric `edition` counter
  for compatibility, with per-edition scoring state in `editionLayout`.

## [2.5.0] — 2026-10-21 (#84 — Taking the night desk)

### Fixed
- Scooped/expired lead buttons reconcile in the same simulation frame, closing
  the 250 ms stale-button window that caused CI's 99/100 dispatch failure.
  A 6× CPU reproduction caught a click on an already scooped lead with 81.8 s
  lifetime remaining; the reporter and first-dispatch gate were valid.
  Surviving keyed buttons keep their identity; countdown/progress retain their
  existing display cadence. Permanent 4× CPU coverage still requires exactly
  100 successful dispatches from 100 live pointer presses, with no exclusions,
  plus forced same-frame scoop replacement and expiry regressions.

### Added
- **THE EVENING STAR** title over a rainy silhouette skyline, saved best circulation,
  Start the night shift and Enter activation, reusing the city canvas renderer.
- Thirty-second rotary-phone cold open with three clipped Lou Vance lines, typed
  dialogue and immediate Skip/Escape. No simulation time or lead life passes on
  the title, during the call, or before night one's first successful dispatch.
- Pure payroll rules: reporters on night one, photographer on two, fixer and press
  repairs on three, wiretap/hush-money/night line/dilemmas on four. Locked passes
  and actions stay hidden, including canvas operatives; locked keys are inert.
- Diegetic **The desk is too small** card below 1280×720. Simulation and intro
  time pause behind it; returning restores the prior phase, focus and user pause.
- Live reduced-motion support: stationary rain/ripples, immediate dialogue and
  disabled CSS animations including the ringing phone.
- Adversarial unit and Playwright coverage for each unlock, idle clocks, invalid
  dispatches, no operative selection, skip mid-line, reload during the call,
  natural 30-second completion, viewport boundaries and resize restoration.

### Changed
- Editions last 210 seconds. Lead life scales from 48 to 112 seconds; rival spawn
  windows and automatic-call timing scale proportionally. Lead replacement and
  work rates retain their per-second cadence. Saboteurs wait for night three so
  there is a counter on the payroll. First print requires a successful dispatch.
- Five-edition golden replay now runs full 210-second nights and exercises the
  staged payroll and later phone calls. Repinned hashes reflect these deliberate
  timing/rules changes and new canonical opening/viewport gates.
- Existing browser scenarios enter through shared opening helpers. Full-payroll
  unit fixtures keep affordability, sabotage and phone tests on their intended
  unhappy paths; the action fuzzer starts on night four to reach every mechanic.
- Restart starts a fresh cold open; reload returns to the title and retains only
  the saved record. Updated play instructions and module ownership notes.

## [2.4.0] — 2026-10-21 (#83 — Paper folded and stable input)

### Added
- Period-palette **PAPER FOLDED** stop-press telegram with game-over reason,
  edition reached, run peak readership and final front page. Restart by button,
  Enter or Space starts a fresh seed, clears selection/history and preserves the
  saved record. Current paste-up takes precedence over the last printed page.
- Snapshot of each printed page and run-specific peak circulation, including
  phone effects, without changing deterministic gameplay hashes.
- Playwright Chromium suite covering trust collapse/restart, held restart keys,
  exactly 100 successful dispatches from 100 live pointer clicks, pointer-down
  across changed ticks, keyboard-only publication, resizing, stable keyed nodes,
  hostile text and stale lead removal. Every case checks browser console errors.
- `test:e2e`, static-server config, locked dev dependency, lint coverage for browser
  tests, CI browser installation and failure report/trace artifacts. Node test
  discovery and Docker deployment exclude browser tests and generated reports.

### Fixed
- Replaced dynamic `innerHTML` builds in leads, roster, tray, wire, page slots,
  standings and metrics with keyed createElement/textContent reconciliation.
  Unchanged nodes stay attached and delegated handlers bind once, preserving
  pointer presses, hover and keyboard focus across 250 ms updates.
- Native buttons for leads, pass selection and scoop plating; keyboard activation
  for page slots. Focused Space dispatches without printing. Modals isolate the
  covered desk, contain focus and restore the prior control on dismissal.
- End-screen input takes precedence over edition summaries and shortcuts. Space
  activation and held repeats cannot accidentally publish the restarted edition.

## [2.3.1] — 2026-10-21 (#82 — Adversarial sim coverage)

### Added
- Focused `node:test` suites for dispatch, publishing, dilemmas, economy/clamps,
  arcs, rival races and sabotage, with exact outcomes for expired/missing leads,
  unknown operative fallback, busy retasking, empty/double publication, unanswered
  calls, insufficient funds, stat bounds, destroyed presses, out-of-order arc
  publication and simultaneous player/rival completion.
- Property-style fuzzing across 50 seeds, each completing three editions with
  legal/illegal commands, then forcing press destruction or trust collapse.
  Every command and step checks finite numeric state, trust/heat/press bounds,
  nonnegative funds, unique story placement and sticky game over.
- `npm run test:coverage` uses Node's experimental test coverage and enforces
  at least 80% lines specifically for `js/sim.js`. Native include/threshold flags
  verified on Node 22.23.3; the GitHub late-edition job now runs this command.

### Fixed
- Repeated/reentrant publishing in one sim tick no longer counts editions,
  rewards or adapter effects twice. Destroyed presses and finished runs refuse
  publication; publishing returns a success boolean. The guard resets per run.
- Nonfinite/nonnumeric dispatch coordinates cannot poison movement state;
  invalid slot IDs cannot consume a queued story into an unprintable property.
- Repeated/stale scoop completions cannot duplicate stories or scoop rewards.
- Included the publish guard in canonical hashes and updated the golden replay.
  Compared all five complete edition snapshots against #81: gameplay is unchanged
  apart from the added guard field. Existing unknown-ID fallback, retasking,
  cash floors, arc highest-part progression and player-first tick order remain.

## [2.3.0] — 2026-10-21 (#81 — Deterministic simulation)

### Added
- Mulberry32 seeded PRNG with validated `nextFloat`, `nextInt` and `pick` helpers;
  constructor injection for seed/RNG, storage, audio and clock. Browser runs accept
  `?seed=N`, with a wall-clock fallback supplied by `main.js`.
- Canonical UTF-8 JSON/FNV-1a gameplay hashes and a five-edition golden replay;
  adversarial RNG, delta, storage, missing-audio and lint-enforcement tests.
- ESLint restrictions and a source grep test banning ambient entropy/browser
  identifiers in `sim.js`; display formatting extracted into its own adapter.

### Fixed
- Counter-based rival IDs and seeded rival choices, lead replenishment and
  standings make identical scripts repeatable; cosmetic effects and saved best
  records do not affect gameplay hashes.
- Nonfinite/nonpositive deltas do nothing. Long deltas subdivide into <=50 ms
  ticks with a 10 s catch-up cap, preserving travel and event processing.
- Missing/corrupt/nonfinite/negative best scores become zero; blocked reads and
  quota-exceeded writes cannot crash gameplay and best scores survive in memory.

## [2.2.2] — 2026-10-21 (#80 — Lint tooling and CI)

### Added
- Locked development dependencies and npm commands for ESLint 10 flat recommended
  rules plus `no-unused-vars`, `eqeqeq` and `no-implicit-globals`, stylelint standard,
  and recommended HTML validation of `index.html`; no rule relaxations or disables.
- Adversarial `node:test` fixtures for undefined/unused variables, loose equality,
  implicit globals, invalid CSS hex, duplicate IDs and IDs containing whitespace.
  Tests assert lint failure exit codes and that real sources pass all three tools.
- A separate Node 22 `late-edition` GitHub CI job with lockfile-based npm caching.
- Git/Docker exclusions for installed dependencies; Docker also excludes tests
  and deliberately invalid fixtures from the static deployment image.

### Fixed
- Upgraded ESLint to 10.13.0 and `@eslint/js` to 10.0.1, regenerated the lockfile,
  and ran non-breaking audit fixes. The remaining stylelint dependency advisory
  (GHSA-vfj7-8cjw-p6xm) has no non-breaking fix; its development-only deployment
  exclusion and follow-up are documented in `AGENTS.md`.
- Corrected the malformed projected-readers ID and its JavaScript lookup.
- Fixed existing HTML, CSS and JS lint findings, including button semantics,
  landmark names, CSS notation/order and an unused publishing accumulator.
- Documented intentional audio/storage fallback handlers inline and pruned
  installed vendor dependencies from documentation checks, with regression tests.

## [2.2.1] — 2026-10-21 (#79 — Current architecture and canonical lore)

### Changed
- Replaced the obsolete agent guide with the current module map, sim/UI boundary,
  determinism target and known gaps (#81), verification commands and reasoned exceptions.
- Canonicalized the player paper as The Evening Star, the rival as The Daily Herald,
  and the mob-backed tabloid as The Observer Syndicate; retained gameplay IDs and values.
- Included `docs/DIRECTION.md` as the creative direction and art bible.

### Added
- A stale-reference checker and adversarial fixture tests, both run by GitHub CI.

## [2.2.0] — 2026-10-21 (PR #77 — Investigations, scoop races and night-line dilemmas)

### Added
- Three investigative story arcs: Red Hook Dockside Syndicate, City Hall Transit
  Kickbacks and Tenement Torch Ring. Publishing each part unlocks the next, with
  circulation/revenue bonuses and reduced heat for series finales.
- Rival scoop races with visible progress and contested stories: a rival-first
  scoop halves an unverified story's value; photo proof restores its full value.
- Rotary-phone editorial dilemmas involving the DA, an advertiser and a tipster,
  with accept/reject effects on funds, readers, trust and heat; unanswered calls
  time out to the reject outcome.

## [2.1.0] — 2026-10-21 (1947 Mahogany Desk & Cream Broadsheet Paste-Up Overhaul)

### Changed
- **Eliminated 3-Column Dark Dashboard Layout (Reviewed with Venice Vision):**
  - Replaced the 3-column dark obsidian dashboard and floating stat pills with a tactile **Two-Zone 1947 Mahogany & Brass Newsroom Desk**:
    - **Top Engraved Brass Night-Desk Ledger Plate:** Integrated 1947 flip-clock (`06:00 PM` → `12:00 AM` Deadline), Managing Editor Lou Vance directive strip, engraved brass metrics, and crimson Rotary Press lever.
    - **Left Zone (59% — Green-Leather Precinct Dispatch Blotter):** 2.5D Noir Metropolis map with bespoke rooftop landmark architecture, `① → ② → ③` onboarding ribbon, map-level gold dispatch prompt on first launch, 3 pinned yellow Western Union / AP telegram wire slips, 4 horizontal **Manila Press-Pass Credentials**, and continuous-feed AP Teletype paper tape.
    - **Right Zone (41% — Full-Height 1947 Cream Newsprint Broadsheet Paste-Up):** Authentic double-ruled newspaper front page (`THE METROPOLITAN CHRONICLE`) with full-width Banner Headline + 2-column asymmetric body grid (`Above-the-Fold Lead`, `Editorial Column`, and `Speed Graphic Darkroom Halftone Photo Exposé`), faded sepia municipal **Wire Stand-In** copy with red rubber stamps before scoops are filed, and multi-column justified newspaper body copy when plated.
- **Fixed Headless Chromium Negative-Delta Ellipse Guard (`js/main.js`, `js/renderer.js`):**
  - Clamped `rawDt` and puddle ripple radii (`Math.max(0.5, rp.r)`) and added synchronous first-frame canvas render in `LateEditionApp.constructor()`.

## [2.0.0] — 2026-10-20
- Initial playable 2.5D noir newsroom & city-dispatch RTS rewrite (closing #12).
