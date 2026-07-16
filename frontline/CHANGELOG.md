# Changelog

All notable changes to Frontline (the HTML-Games playtest client) are recorded here.

## v1.2.0 — 2026-07-16 — Deck-builder art + weathervane initiative

### Added
- **Deck-builder card art**: the roster pool (the "NFT browser") now shows each
  card's WebP portrait as a 44×56 thumbnail with the cost badge overlaid on its
  corner (`cardThumb` in `js/art.js`). Missing art falls back to a dark tile that
  still carries the cost badge.

### Changed
- **Weathervane initiative** replaces the coin flip. The old disc rendered
  pre-colored with the result on first paint (it never actually hid the outcome);
  the new brass weathervane needle whirls neutral, then settles pointing **down
  (you)** or **up (the foe)** as the "wind favors…" reveal fades in — a true
  hidden-until-it-lands flip. The wind framing ties into the game's Gas keyword.
  The overlay window widened 1900→2500ms to give the reveal room to breathe.

## v1.1.0 — 2026-07-15 — Venice draft card art

The venice drop-in target from v1.0.0 is now populated with a full draft art set.

### Added
- **Venice card art (24 pieces)**: generated with `venice image` (venice-sd35) from
  the dieselpunk style bible in `venice-asset-brief.md` — one portrait per canonical
  `engine.js` id — plus a `board_field` battlefield backdrop.
- **Hand-card art window**: hand cards now render the card's art in a window at the
  top with the cream text panel below it (`cardArtBand` in `js/art.js`), matching the
  art already shown behind board-cell units. Missing art still falls back to the
  text-only card.

### Changed
- Art is served as **WebP** (~640×800 cards, downscaled from the 1024×1280 PNG
  masters), cutting the drop-in set from ~61 MB to ~1.9 MB for fast static serving.
  The drop-in contract in `art/README.md` is now `art/cards/<id>.webp` +
  `art/env/board_field.webp`.

## v1.0.0 — 2026-07-15 — Dieselpunk playtest client

Initial vanilla playtest client for the *Frontline* card-battler design.

### Added
- **Full game loop vs AI**: Home, Rosters (deck builder), War Ladder, Match, and
  Field Training, recreated in vanilla ES modules from the Claude Design prototype.
- **Rules engine reuse**: `engine.js` (`globalThis.FL`, rules + heuristic AI)
  copied byte-for-byte from the design handoff; dieselpunk names applied to the
  card pool at runtime only.
- **Match flow**: coin-flip field orders, banking/requisition economy, deploy /
  spells (Artillery Strike, Creeping Barrage, Fortify, Intel Report, Forced March),
  auto-combat, the enemy commander's turn, and an armistice (game-over) card.
- **Standing**: Elo-style +18 win / −12 loss (floor 800), a simulated season
  ladder, and rank tiers — all persisted to `localStorage`.
- **Rosters**: 24-card decks with the 2-copy / 24-cap rules, default (★) roster,
  create / rename / delete.
- **Settings popover**: playtest knobs for starting morale (5–40) and Fast AI.
- **Venice art drop-in**: optional `art/cards/{id}.png` + `art/env/board_field.png`
  render behind the text cards and fall back cleanly when absent.
- **Arcade launcher card** + Back-to-Arcade link.
