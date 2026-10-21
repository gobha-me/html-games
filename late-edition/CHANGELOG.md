# Changelog — LATE EDITION // 1947

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
