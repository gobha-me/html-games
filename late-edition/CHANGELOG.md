# Changelog — LATE EDITION // 1947

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
