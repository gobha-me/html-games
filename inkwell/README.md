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
  cycle a slot through your known spells, **Esc** or **i** to close
- **1** / **2** / **3** — while playing, cast the spell bound to that slot
- **R** — restart after death

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

**PR #3 — "the writing mechanic lands."** The language metaphor turns
into actual gameplay. Glyph fragments now appear in the world; pick one
up and the spell burns into your memory. Bind known spells to three
slots and cast them with `1`/`2`/`3`. Four literary items spawn across
the pages — Inkpot (restores ink), Blotting Cloth (heals), Wax Seal
(absorbs the next hit), Quill Nib (permanent +1 attack). A modal
inventory screen lists what you've gathered and lets you bind spells.

The biggest reshape is the field of view. Where you have not yet read,
the page is **ink-stained** — solid darkness with the texture of soaked
parchment. Where you've been but cannot currently see, the page fades
to a dimmed parchment — visible memory, but enemies that move into the
dark are no longer drawn. The Sight spell briefly extends how far the
page is legible.

**Known limits in this PR (intentional, per the phased plan):**

- Only three of the five planned spells ship here (Strike, Ward, Sight).
  Bind and Erase land in PR #4 along with status effects and targeting.
- Marginalia + quill upgrades beyond the basic Nib are PR #4.
- No daily seed / shareable run codes yet — PR #4
- Desktop keyboard only — no touch controls (PR #5)

## File layout

```
inkwell/
├── index.html        — scaffold, loads main.js as a module
├── README.md         — this file
├── CHANGELOG.md      — shipped changes per PR
├── css/style.css     — parchment + sepia theme, inventory + slot UI
└── js/
    ├── main.js       — bootstrap, input, rAF loop, mode gating
    ├── constants.js  — palette, sizes, tile + kind enums; ITEMS, GLYPHS, SPELLS tables
    ├── state.js      — createInitialState(), pushLog()
    ├── rng.js        — Mulberry32 + helpers (int, pick, chance, getState)
    ├── map.js        — rooms-and-corridors gen; spawn enemies, items, glyphs
    ├── entity.js     — uniform Entity factory; flat array with kind discriminator
    ├── actions.js    — the ONLY mutators: move, attack, pickup, useItem, castSpell, …
    ├── ai.js         — Dijkstra-map chase for hostiles
    ├── turn.js       — scheduler: player → FOV → enemies → cull → FOV; buff decrement
    ├── fov.js        — recursive shadowcasting; visible/seen Uint8Arrays
    ├── render.js     — canvas paint, three-tier FOV draw, camera, parchment pattern
    ├── save.js       — localStorage round-trip; versioned snapshot
    └── ui.js         — HUD, log, overlays, inventory screen, slot strip
```

## Roadmap

- **PR #1 — MVP.** One page, one enemy, bump-attack, death+restart. _Shipped._
- **PR #2 — "the run has shape."** Multi-page descent, page-bound ink budget,
  2-3 enemy types (smear, scrawl), message log polish, Dijkstra-map AI,
  localStorage save-mid-run. _Shipped._
- **PR #3 (this one) — "the writing mechanic lands."** Glyph fragments → 3
  spell slots, 3 spells (Strike, Ward, Sight), 4 items (Inkpot, Blotting
  Cloth, Wax Seal, Quill Nib), inventory UI, FOV with *ink-stain* unexplored
  treatment instead of black fog.
- **PR #4 — "distinctiveness."** Daily seed + shareable run codes, procedural
  bestiary entries, milestone bosses every 5 pages (Margin-Lord, Frontispiece,
  Colophon), 6-8 enemy types, the remaining spells (Bind, Erase) and items
  (Marginalia, quill upgrades).
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
