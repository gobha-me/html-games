# Changelog

All notable changes to Hexwire (the HTML-Games playtest client) are recorded here.

## v1.0.0 — 2026-07-16 — Neon-noir playtest client

Initial vanilla playtest client for the *Hexwire* lane card-battler design, a
cyberpunk sibling to Frontline built on the same base rules engine.

### Added
- **Full game loop vs AI**: Lobby, Decks (deck builder), Match, and Tutorial,
  recreated in vanilla ES modules from the Claude Design prototype.
- **Rules engine reuse**: `engine.js` (`globalThis.FL`, rules + heuristic AI)
  copied byte-for-byte from the design handoff; the 26-card pool ships with the
  cyberpunk display names baked into `FL.POOL`.
- **Match flow**: init-chip coin flip, the fence-a-card income economy, deploy /
  spells (Hexbolt, Grid Surge, Combat Stims, Datamine, Blinkstep, **Possession**),
  block-by-block auto-combat, the rival crew's turn, the STREET FEED log, and a
  game-over card ("Block secured" / "The block falls").
- **Signature mechanics**: Puppeteer **Subvert** (steal a ≤cost enemy unit beneath
  it; kill the top to expose it) and the **Possession** spell (two-step target).
- **Three factions** — CHROME (cyan), HEX (violet), STREET (amber) — with keyword
  tags Guard / Ward / Strike / Rally / Wired / Curse / Pierce / Subvert.
- **Decks**: 24-card decks with the 2-copy / 24-cap rules, default (★) deck,
  create / rename / delete — all persisted to `localStorage` under `hw_` keys
  (isolated from the sibling Frontline client's `fl_` saves).
- **Simulated meta**: wallet connect (Pera / Defly), THE BLOCK / SYNDICATE FLOOR
  lobbies, Standard / Collector ladders, and a win-loss record.
- **Venice card art (26 pieces)**: generated with `venice image` (venice-sd35) from
  the neon-noir style bible in `ART-DIRECTION.md` — one portrait per canonical
  `engine.js` id — plus a `board_field` battlefield backdrop. Rendered behind board
  cells, as the hand-card art window, and as roster thumbnails; missing art falls
  back to the text-only card.
- **Arcade launcher card** + Back-to-Arcade link.
