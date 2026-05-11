# Changelog

All notable changes to Inkwell live here. Format is loosely
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); semver is not
particularly meaningful for a single-page game so we just date the entries.

## [0.5.0] — 2026-05-11

Polish. PR #5 (issue #103) — the final PR on the original 5-PR roadmap.

### Added

- **Frame-timed animation queue.** Animations carry `startMs` +
  `durationMs` instead of a turn stamp, so the rAF loop can fade
  them smoothly per-frame instead of blinking the strike circle off
  on the following turn. `pushAnim(state, anim)` moves from a local
  helper in `actions.js` to `state.js` next to `pushLog` so all
  animation push sites (now in `actions.js` and `ai.js`) share one
  schema.
- **Smudge-on-death + ink-drip animations.** New animation types
  alongside the existing strike fade. `smudge` (500 ms) is queued
  inside `killEntity()` for every enemy/boss death — drawn as an
  asymmetric ink blot. `drip` (350 ms) is queued in two places: in
  `attack()` when an enemy hits the player (drip from the player
  tile), and in `ai.frontispieceTurn()` when the Frontispiece bleeds
  a fresh drip onto the page (drip from the new drip's tile).
- **Page-flip transition on descend.** `transitionPage()` sets
  `state.transition = { startMs, durationMs: 450 }` after wiping the
  page-local animations array. `render.drawPageFlip()` draws a moving
  sepia gradient band across the canvas while the transition is
  active and clears `state.transition` when it expires. The main rAF
  loop stays dirty while either animations or a transition are
  in-flight. `state.transition` is ephemeral — never saved.
- **Procedural audio.** New `js/audio.js` wraps a lazy Web Audio
  context and exposes `playSfx(name)` for five short tones:
  `hit` (any attack lands), `pickup` (item or glyph), `descend`
  (page-flip), `cast` (spell), `death` (player death). Wired at the
  natural mutation points in `actions.js`. `audio.resume()` is called
  from `onKey()` in `main.js` so the AudioContext is unsuspended on
  the first user gesture per browser autoplay policy. Fails silent
  if `AudioContext` is unavailable.
- **Illuminated title overlay.** `#overlay`'s card grows a 60px
  drop-cap on the first letter in blood-red, a thin sepia rule below
  the title, and a small ink-drop pseudo-element that slowly drips
  off the rule on a 7s loop. Pure CSS — no canvas. Death overlay
  reuses the same treatment (it lives in the same overlay surface).
- **Desktop-only banner.** Boot-time check in `main.js` detects
  touch capability AND viewport < 900 px wide and reveals a
  parchment-colored banner above the slots strip explaining
  Inkwell is keyboard-only; "Play anyway" dismisses it for the rest
  of the session. Inkwell's bump-to-attack control surface doesn't
  translate to touch, so this PR opts out of a mobile redesign
  explicitly.

### Changed

- `dirty` flag in the rAF loop now stays true while a page-flip
  transition is in-flight, in addition to its existing animations
  check.
- Render order grows a `drawPageFlip(ctx, state)` call at the very
  end of `render()`, after the vignette, so the sweep covers
  everything else.

### Architecture

- Save format stays **v3.** Animations and `state.transition` are
  ephemeral and dropped by the existing snapshot whitelist in
  `save.js`. No load-time migrations.

## [0.4.0] — 2026-05-11

Distinctiveness. PR #4 (issue #103).

### Added

- **Daily seed + shareable run codes.** Title overlay gains a seed
  input and a "Today's page" button. Any numeric seed boots a
  deterministic run; today's seed is `YYYYMMDD` and switches the run
  to no-save daily mode. Run URLs share back as `#seed=N`. The death
  overlay tags the seed onto the flavor line.
- **Three new enemy kinds.** **Marginalia** (`,`, page 3+), **Foxing**
  (`f`, page 5+, heals adjacent ink-family enemies via an `actBefore`
  AI hook), **Erratum** (`!`, page 7+, teleports adjacent to the player
  every four turns). Each has its own attack-verb, death flavor, and
  palette entry. `ai.js` now dispatches per-kind `actBefore` callbacks
  from a small table before the generic Dijkstra step.
- **Bind + Erase spells.** Bind (cost 4, range 1, 4 turns) sets a target's
  `boundTurns`; the enemy loop decrements-and-skips at the very top.
  Erase (cost 5, range 4) auto-aims the nearest visible hostile,
  reduces both `hp` and `hpMax` permanently, and sets `titleErased`
  for the Frontispiece interaction. Two new glyphs (`-`, `/`) spawn
  from page 3+.
- **Milestone bosses.** Pages 5, 10, 15 spawn a boss at the far-room
  center *instead of* placing stairs; stairs spawn at the boss tile
  on death. **Margin-Lord** (Dijkstra chase, +1 attack per tier),
  **Frontispiece** (stationary; bleeds a drip onto an adjacent tile
  every 3 turns; bump damage halved until Erase flips `titleErased`),
  **Colophon** (Dijkstra chase; death triggers the win-state with
  `state.meta.winFlavor`). Boss deaths append to `meta.bossesSlain`
  with kind / depth / turn.
- **Marginalia + quill variants.** Marginalia (item, page 5+) — 2-turn
  buff that drops a random depth-appropriate glyph on every non-boss
  kill. Fountain Pen (page 7+, rare) — permanent +2 attack. Reed Pen
  (page 3+) — permanent -1 to every spell's ink cost, floored at 1.
- **Procedural bestiary.** New `js/bestiary.js` holds per-kind
  paragraph tables in three voice registers (clinical, folkloric,
  source-quote). `composeBestiaryEntry(seed, kind, bossRecord)` uses
  a sub-seeded RNG (`subRng` in `js/rng.js`) so entries are
  deterministic per `(seed, kind)` and don't desync the main RNG
  cursor. A "Bestiary" button on the inventory overlay opens a new
  modal showing entries for every kind the player has slain; bosses
  get a "Defeated on page N, turn T" footer. After every kind is
  read, an italic completion footer appears.

### Changed

- `actions.js` now has a single `killEntity(state, target, attacker,
  flavorTmpl)` helper. `attack()`, `applyStrike()`, and `applyErase()`
  all funnel through it. The helper handles death flavor, `beastsSeen`
  tracking, Marginalia glyph drops, and boss-stairs spawning.
- `castSpell` applies `actor.inkCostBonus` when computing the spell
  cost, floored at 1 ink.
- `state.meta` gains `beastsSeen: []` and `bossesSlain: []` from PR #4
  commit 1, populated by the kill helpers as the run progresses.
- `attack()` damage ladder gains a Frontispiece title-shield rung: if
  the player is attacking a Frontispiece and the title is not erased,
  damage halves (floored at 1).
- `ai.runEnemyTurns` decrements `enemy.boundTurns` and short-circuits
  the affected enemy *before* the per-kind `actBefore` hook or
  boss-brain dispatch.
- Save format **v3**. New fields: `meta.beastsSeen`, `meta.bossesSlain`,
  `meta.dailySeed` (load-bearing), `meta.winFlavor`, and additive
  enemy fields (`boundTurns`, `titleErased`, `dripCooldown`,
  `teleportCooldown`, `boss`, `bossBrain`). Old v2 saves are discarded
  via the existing version check; the welcome-back overlay falls back
  to the title overlay.

## [0.3.0] — 2026-05-11

The writing mechanic lands. PR #3 (issue #103).

### Added

- **Field of view with ink-stained unexplored treatment.** New
  `js/fov.js` runs recursive shadowcasting from the player each turn.
  Three render tiers: visible (full color), seen-but-not-visible
  (parchment dimmed behind a soft ink overlay; entities not drawn),
  unseen (solid `ink` with a low-frequency bleed-noise pattern — the
  page is still soaked where you haven't read it). Default radius 8.
- **Four literary items.** **Inkpot** restores +3 ink. **Blotting
  Cloth** restores +5 HP. **Wax Seal** marks the player; the next
  hostile blow cracks the seal and deals no damage. **Quill Nib**
  permanently adds +1 to attack. 1–2 items spawn per page in
  non-spawn rooms. Walking onto an item picks it up automatically.
- **Inventory overlay.** Press `i` to open a parchment modal that
  groups inventory by kind (letters `a`–`d` and ×N count badges),
  lists known spells, and shows the three slot bindings.
  Press `a`–`d` to use an item — uses one turn, then closes the
  overlay. `Esc` or `i` again closes without using.
- **Glyph fragments and the spell system.** Three glyph entities —
  Strike (`*`), Ward (`+`), Sight (`?`) — spawn on most pages.
  Walking onto a glyph adds the spell to `player.knownSpells`. Inside
  the inventory screen, `1`/`2`/`3` cycles the corresponding slot
  through `[empty, …knownSpells]`. While playing, `1`/`2`/`3` casts
  the bound spell, deducting ink:
  - **Strike** (2 ink, power 6): hits the first hostile in a cardinal
    neighbour tile.
  - **Ward** (3 ink, 4 turns): halves incoming damage. Stacks
    naturally with the Wax Seal (seal triggers first, then ward).
  - **Sight** (2 ink, 6 turns): extends the FOV radius by 6.
- **Slot HUD strip.** A persistent strip under the stats shows the
  three slots and the bound spell's ink cost; bound spells dim when
  the player can't afford them.

### Changed

- `actions.js` is still the only mutator, now with `pickup`,
  `useItem`, `castSpell`, and `cycleSlot` alongside the originals.
- `attack()` now checks `target.sealed` (consumes seal, no damage)
  and `target.buffs.wardTurns` (halves damage) before applying.
- `turn.js` recomputes FOV after every player action and again after
  enemy resolution; it also decrements buff timers each player turn.
- Save format **v2** persists `fov.seen` so the explored page is
  preserved across reloads. Inventory, known spells, slots, and
  buffs are additive — old `v1` saves are discarded by version check;
  later in-PR fields default safely on load.
- Constants extended with `ITEMS`, `GLYPHS`, and `SPELLS` tables —
  pure data, no mechanics in `constants.js`.

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
