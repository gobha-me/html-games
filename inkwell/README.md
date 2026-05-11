# Inkwell

A turn-based literary roguelike. You are a scribe descending through the pages
of a corrupted grimoire. Each floor is a page. Enemies are ink-blots that have
crept onto the page. Your weapon is a quill, your resource is ink, and
permadeath is the natural state of an unfinished sentence.

## How to play

**Goal:** survive as deep into the grimoire as you can.

**Controls (keyboard, desktop):**

- **Arrow keys** / **WASD** / **HJKL** — move one tile (orthogonal)
- **YUBN** / **Numpad 7 9 1 3** — move diagonally
- **.** or **Space** or **Numpad 5** — wait one turn (steady your quill)
- **\>** (Shift+`.`) or **Numpad +** — descend a page (standing on `>`)
- **i** — open the inventory; press `a`–`d` to use an item, `1`/`2`/`3` to
  cycle a slot through your known spells, **Esc** or **i** to close.
  From the inventory, click **Bestiary** to read the entries for every
  margin-creature you've defeated.
- **1** / **2** / **3** — while playing, cast the spell bound to that slot
- **R** — restart after death

**Starting a run.** The title overlay accepts a numeric seed (any number),
or you can click **Today's page** to play today's daily seed. A daily
run does not save — closing the tab ends it. The seed of the current
run lives in the URL hash, so a shareable run is just the page link.

**Combat:** bump-to-attack. Step into an ink-blot to strike it with your quill.
If you stand next to one when its turn comes, it strikes back. Spells let you
strike at range, raise a ward, or read farther into the page.

**Items and glyphs:** walk onto a literary item (Inkpot, Blotting Cloth, Wax
Seal, Quill Nib) to pocket it. Walk onto a glyph fragment (`*`, `+`, `?`) to
learn its spell — then bind it to a slot in the inventory screen.

**Win/lose:** there is no win in this PR — only how far you got. Death is
permanent and the book closes. Press **R** to begin a new run.

## Tech

Vanilla HTML/CSS/JS, ES modules, single `<canvas>` for the game board. No
build step, no external dependencies beyond two Google Fonts (IM Fell English
for UI, JetBrains Mono for glyphs). PRNG is a small Mulberry32 implementation
so daily-seed mode will slot in cleanly in a later PR.

## Status

**PR #4 — "distinctiveness."** The book becomes its own world. Six
beats land in one PR:

1. **Daily seed + shareable run codes.** The title overlay now has a
   seed input and a "Today's page" button. Any numeric seed boots a
   deterministic run; today's seed is `YYYYMMDD` and switches the run
   to a no-save daily mode. Run URLs share back as `#seed=N`. The
   death overlay shows the seed for share-back.
2. **Three new enemy kinds.** **Marginalia** (`,`, page 3+) — small,
   fast, low HP. **Foxing** (`f`, page 5+) — heals adjacent ink-family
   enemies each turn. **Erratum** (`!`, page 7+) — teleports adjacent
   to the player every four turns. Total bestiary now six common kinds.
3. **Bind + Erase spells.** Bind (cost 4, range 1) freezes an adjacent
   hostile for four enemy-turns. Erase (cost 5, range 4) auto-aims the
   nearest visible hostile, reducing both current and max HP
   permanently. The glyphs for both spawn from page 3+.
4. **Milestone bosses.** Pages 5, 10, 15 spawn the boss in place of
   the stairs. **Margin-Lord** (Dijkstra chase, attack scales by tier),
   **Frontispiece** (stationary; spawns a drip every three turns;
   bump-attack damage halved until Erase flips its title), **Colophon**
   (final boss; defeating it ends the run with the win-state).
5. **Marginalia + quill variants.** **Marginalia** (item, page 5+) —
   two-turn buff that drops a random glyph at every non-boss kill.
   **Fountain Pen** (page 7+, rare) — permanent +2 attack.
   **Reed Pen** (page 3+) — permanent -1 to every spell's ink cost,
   floored at 1.
6. **Procedural bestiary.** A new Bestiary screen reachable from the
   inventory shows entries for every kind you've slain. Each entry is
   composed at runtime from a sub-seeded RNG over per-kind paragraph
   tables in three voice registers (clinical, folkloric, source-quote).
   Two players on the same seed see the same entries; different seeds
   see different ones. Bosses get a "defeated on page N, turn T" footer.

Save format is now **v3**. Old v2 saves are discarded.

**Known limits in this PR (intentional, per the phased plan):**

- Daily-seed runs do not save. Closing the tab ends the run.
- No animations yet — visual polish is PR #5.
- No audio, no title art, no mobile pass — all PR #5.
- Desktop keyboard only.

## File layout

```
inkwell/
├── index.html        — scaffold, loads main.js as a module
├── README.md         — this file
├── CHANGELOG.md      — shipped changes per PR
├── css/style.css     — parchment + sepia theme, inventory + slot UI, bestiary
└── js/
    ├── main.js       — bootstrap, input, rAF loop, mode gating, daily-seed wiring
    ├── constants.js  — palette, sizes, KIND, ENEMY_STATS, BOSS_STATS, SPELLS, ITEMS, GLYPHS
    ├── state.js      — createInitialState(), pushLog()
    ├── rng.js        — Mulberry32, dailySeed(), subRng() for the bestiary
    ├── map.js        — rooms-and-corridors gen; boss-replaces-stairs on tier pages
    ├── entity.js     — uniform Entity factory; flat array with kind discriminator
    ├── actions.js    — the ONLY mutators: move, attack, pickup, useItem, castSpell, …
    ├── ai.js         — Dijkstra chase; per-kind actBefore hooks; boss-brain dispatch
    ├── turn.js       — scheduler: player → FOV → enemies → cull → FOV; buff decrement
    ├── fov.js        — recursive shadowcasting; visible/seen Uint8Arrays
    ├── render.js     — canvas paint, three-tier FOV draw, camera, parchment pattern
    ├── save.js       — localStorage round-trip; v3 snapshot (daily mode skips save)
    ├── ui.js         — HUD, log, overlays, inventory + bestiary screens, slot strip
    └── bestiary.js   — per-kind paragraph tables; composeBestiaryEntry(seed, kind)
```

## Roadmap

- **PR #1 — MVP.** One page, one enemy, bump-attack, death+restart. _Shipped._
- **PR #2 — "the run has shape."** Multi-page descent, page-bound ink budget,
  2-3 enemy types (smear, scrawl), message log polish, Dijkstra-map AI,
  localStorage save-mid-run. _Shipped._
- **PR #3 — "the writing mechanic lands."** Glyph fragments → 3
  spell slots, 3 spells (Strike, Ward, Sight), 4 items (Inkpot, Blotting
  Cloth, Wax Seal, Quill Nib), inventory UI, FOV with *ink-stain* unexplored
  treatment instead of black fog. _Shipped._
- **PR #4 (this one) — "distinctiveness."** Daily seed + shareable run codes,
  procedural bestiary, milestone bosses (Margin-Lord, Frontispiece,
  Colophon), 3 new enemies (Marginalia, Foxing, Erratum), Bind + Erase
  spells, Marginalia item + Fountain Pen / Reed Pen quill variants.
- **PR #5 — "polish."** Animations (ink drips, smudge-on-death, page-flip),
  audio, title screen, mobile pass or explicit desktop-only banner.

## Design notes

**Why a literary theme.** Cogfall (the other Claude-authored game in this
repo) is a steampunk 4X — gears and numbers. Inkwell goes the other way:
language, ink, and the page metaphor. The aesthetic and the mechanic both
lean into what a language model is for. Spells will be *glyphs*. Enemies are
*ink-blots*. The score will be *the deepest page you reached.*

**Why vanilla.** The arcade convention (`AGENTS.md`) defaults to vanilla
HTML/CSS/JS unless there's a real reason to reach further. A turn-based grid
roguelike fits comfortably inside that envelope. Custom Mulberry32 + a small
rooms-and-corridors generator + greedy AI is ~150 lines total — well under
the threshold where a library like ROT.js would earn its place.

**Architectural seams that matter as the game grows.** Three calls were made
in PR #1 specifically so PRs #2-5 don't have to be rewrites:

1. `actions.js` is the **only** module that mutates state. Future spells and
   item-uses become more action functions; the turn loop stays the same.
2. Entities are flat **data** with a `kind` discriminator, not class
   instances. When stairs, items, and glyph fragments are added, they slot
   into `state.entities` with no new collection and no new render pass.
3. `turn.js` doesn't know what an action *does* — it only sequences
   actor → action → animations → render. Animations are queued, not blocking,
   so PR #5's polish pass is a parameter change, not a rewrite.
