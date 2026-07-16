# Changelog

All notable changes to Hexwire (the HTML-Games playtest client) are recorded here.

## v1.2.0 — 2026-07-16 — Scenario tutorial + street/overwatch readout

Ported from an updated Claude Design handoff. Rules engine unchanged — this is a
teaching + readability pass.

### Added
- **Eight-lesson scenario tutorial** replaces the old single hand-held game. Each
  lesson sets a fixed board, hand and energy, then gates every step to one action
  and shows a recap on success: FENCE & THE CLOCK · STREET vs OVERWATCH · GUARD ·
  WARD · WIRED · PIERCE · LINKS & RALLY · **THE SOLVE** — a final exact-lethal
  placement puzzle (rival at 6♥) that verifies the answer and offers a retry on a
  miss.

### Changed
- **Street/overwatch stat readout**: a unit's two combat numbers now read as
  `power/strike` everywhere (board cells, hand cards, deck pool). On the board the
  *active* half lights up by row — melee lit on the street, strike lit on
  overwatch — and the idle half dims.
- Dropped the now-redundant `⚔X` board tag and `Strike X` card tag; the number
  carries that information.

## v1.1.0 — 2026-07-16 — Art-legibility polish

Playtest feedback pass on how the venice art reads across surfaces.

### Added
- **Card-art zoom**: tap a card thumbnail in the deck manager to open a modal with
  the full, uncropped portrait (`object-fit:contain`) plus name / cost / faction /
  stats / keyword line. Backdrop or × closes it.
- **Per-card focal points** (`ART_FOCUS` in `art.js`): each card carries a tuned
  vertical crop (`object-position` Y) so full-body figures keep their head in frame
  while abstract pieces sit mid-frame — applied to board cells, hand bands, and
  roster thumbnails.

### Changed
- **Battlefield backdrop reads through the board**: empty board cells are now
  translucent and the `board_field` backdrop opacity is raised, so the environment
  shows instead of being ~fully occluded by opaque cells. Unit text stays legible.
- **Taller deployed slots**: board cells grew so a deployed unit shows much more of
  its portrait; unit name / power / ♥ / tags pin to the bottom over the darkest part
  of the scrim, with a text-shadow for legibility.
- **Taller hand-card art window**: the hand-card art band is taller (and the card
  grew to fit), showing more of each portrait with the per-card framing above.

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
