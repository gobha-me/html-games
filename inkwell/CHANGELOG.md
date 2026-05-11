# Changelog

All notable changes to Inkwell live here. Format is loosely
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); semver is not
particularly meaningful for a single-page game so we just date the entries.

## [0.2.0] — 2026-05-11

The run has shape. PR #2 (issue #103).

### Added

- **Multi-page descent.** Each generated page now contains a stairs-down
  entity (`>`) placed in the room farthest from the player spawn. Press
  `>` (Shift+`.`) or Numpad `+` on the stairs to descend; the page
  regenerates with depth + 1 and the player teleports to the new spawn.
  `state.meta.deepestPage` tracks the deepest page reached.
- **Two new enemy kinds.** Ink-smear (`&`, hp 9, atk 3) — bulky, soaks
  quill hits; ink-scrawl (`%`, hp 3, atk 3) — fragile but sharp. Spawn
  mix steps in by depth: drips only on page 1, smears at page 2+,
  scrawls at page 3+.
- **Ink HUD.** `state.player.ink` / `inkMax` is now visible in the HUD
  (indigo, blood-red at ≤1). Ink resets to max on every descent — the
  page-bound budget the architecture has been pointing at since MVP.
- **Save-mid-run.** Game state is auto-saved to `localStorage`
  (`inkwell.save`) after every successful action. On reload, an
  unfinished run prompts Continue / New run. Death and pressing
  "New run" both clear the save. The RNG closure's internal state is
  preserved so a resumed run is bit-identical to a non-interrupted one.
- **Dijkstra-map AI.** Enemy chase is now a player-rooted BFS instead
  of greedy bump. Enemies route through corridors and stairwells
  instead of stalling on a wall corner. Ties broken randomly so groups
  don't move in lockstep.
- **Log dedupe + flavor.** Consecutive identical messages collapse to
  `"text ×N"`. Player hit and enemy death messages now pick from
  multiple flavor variants; enemy-attack strings stay stable per kind.
- **Welcome-back overlay.** Title overlay is two-button when a save
  exists: Continue or New run.

### Changed

- Movement collision: non-hostile non-player entities (stairs today,
  items in PR #3) are walkable. Hostiles still block each other.
- `mulberry32` now exposes `rng.getState()` so the live PRNG cursor
  can round-trip through save/load.

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
