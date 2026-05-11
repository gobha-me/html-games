# Changelog

All notable changes to Inkwell live here. Format is loosely
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); semver is not
particularly meaningful for a single-page game so we just date the entries.

## [0.1.0] — 2026-05-11

Initial playable MVP (PR #1, issue #103).

### Added

- One procedurally generated dungeon page (rooms-and-corridors generator,
  Mulberry32 seeded RNG).
- Player character (`@`) with bump-to-attack quill (5 damage), 20 HP.
- One enemy type: ink-drip (`~`) — wanders when out of sight, chases greedily
  inside an 8-tile range, hits for 2.
- Parchment + sepia canvas theme with procedurally generated ink-stain
  texture and a soft vignette.
- Title overlay and death overlay with thematic copy.
- Message log (last 6 lines, color-toned by good / bad / muted).
- Full keyboard movement: arrows, WASD, HJKL, YUBN diagonals, numpad,
  period / space to wait, R to restart.
- "← Back to Arcade" link per repo convention, styled against the parchment
  background.
- Launcher card with custom `--inkwell` accent and hover glow.
- README + CHANGELOG.

### Architectural foundations

- 11 ES modules under `js/`, no build step required.
- `actions.js` is the only mutator; `turn.js` only sequences; `render.js`
  only reads.
- Flat `state.entities[]` with a `kind` discriminator (extensible to items,
  stairs, glyph fragments).
- Animations are queued on state, drained by the rAF loop — simulation stays
  instant.

### Known limits (intentional, per the phased plan)

- Single floor only.
- One enemy type.
- `state.player.ink` exists but is not yet exposed in the HUD because no
  spells consume it (lands in PR #3 with the glyph system).
- No fog-of-war.
- Desktop keyboard only.
