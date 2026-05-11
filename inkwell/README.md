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
- **R** — restart after death

**Combat:** bump-to-attack. Step into an ink-drip to strike it with your quill.
If you stand next to one when its turn comes, it strikes back.

**Win/lose:** there is no win in this PR — only how far you got. Death is
permanent and the book closes. Press **R** to begin a new run.

## Tech

Vanilla HTML/CSS/JS, ES modules, single `<canvas>` for the game board. No
build step, no external dependencies beyond two Google Fonts (IM Fell English
for UI, JetBrains Mono for glyphs). PRNG is a small Mulberry32 implementation
so daily-seed mode will slot in cleanly in a later PR.

## Status

**Playable MVP (PR #1).** This is the first slice: one procedural page, one
enemy type (ink-drip), bump-attack, HP, permadeath + restart, parchment
aesthetic. Future PRs add multi-page descent, the ink resource, glyph spells,
items, fog-of-war, daily seeds, and bestiary. See the roadmap below.

**Known limits in this PR:**

- Single floor (no stairs down yet)
- Only ink-drip enemies
- HP is the only resource exposed in the HUD (`ink` field exists in state but
  has no spells to spend it on yet)
- Desktop keyboard only — no touch controls
- Whole map is always visible; FOV/exploration arrives in PR #3

## File layout

```
inkwell/
├── index.html        — scaffold, loads main.js as a module
├── README.md         — this file
├── CHANGELOG.md      — shipped changes per PR
├── css/style.css     — parchment + sepia theme
└── js/
    ├── main.js       — bootstrap, input, rAF loop
    ├── constants.js  — palette, sizes, tile + kind enums (NOT state)
    ├── state.js      — createInitialState(), pushLog()
    ├── rng.js        — Mulberry32 + helpers (int, pick, chance, dailySeed)
    ├── map.js        — rooms-and-corridors generation, tileAt, isWalkable
    ├── entity.js     — uniform Entity factory; flat array with kind discriminator
    ├── actions.js    — moveOrAttack, attack, wait (the ONLY mutators)
    ├── ai.js         — monster-turn dispatch (greedy chase for MVP)
    ├── turn.js       — scheduler: player → enemies → cull
    ├── render.js     — canvas paint, camera, parchment pattern, vignette
    └── ui.js         — HUD, message log, overlay
```

## Roadmap

- **PR #1 (this one) — MVP.** One page, one enemy, bump-attack, death+restart.
- **PR #2 — "the run has shape."** Multi-page descent, page-bound ink budget,
  2-3 enemy types (smear, scrawl), message log polish, Dijkstra-map AI,
  localStorage save-mid-run.
- **PR #3 — "the writing mechanic lands."** Glyph fragments → 3 spell slots,
  3-5 spells (Strike, Ward, Sight, Bind, Erase), items (Inkpot, Blotting
  Cloth, Wax Seal, Marginalia, quill upgrades), inventory UI, FOV with
  *ink-stain* unexplored treatment instead of black fog.
- **PR #4 — "distinctiveness."** Daily seed + shareable run codes, procedural
  bestiary entries, milestone bosses every 5 pages (Margin-Lord, Frontispiece,
  Colophon), 6-8 enemy types.
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
