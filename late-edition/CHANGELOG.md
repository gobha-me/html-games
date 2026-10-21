# Changelog — LATE EDITION // 1947

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
