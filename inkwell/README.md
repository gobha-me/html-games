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

**Audio.** Short procedural Web Audio tones play on hits, pickups,
spells, descending a page, and death. No mute UI in this build — the
sounds are very short. Audio gracefully degrades to silent if your
browser doesn't expose `AudioContext`.

**Mobile.** Inkwell is keyboard-driven. On touch devices below 900 px
a banner above the board explains as much; "Play anyway" dismisses it
for the rest of the session.

## Tech

Vanilla HTML/CSS/JS, ES modules, single `<canvas>` for the game board. No
build step, no external dependencies beyond two Google Fonts (IM Fell English
for UI, JetBrains Mono for glyphs). PRNG is a small Mulberry32 implementation
that round-trips through `localStorage` for save resume and seeds the daily
run. Audio is procedural Web Audio — no audio assets ship in the repo.

## Status

**PR #5 — "polish."** The final PR on the original 5-PR roadmap.
Four areas land in one PR:

1. **Frame-timed animations.** The strike circle now fades smoothly
   over a quarter-second instead of blinking off on the next turn.
   Two new animation types ride the same queue: a **smudge** on
   every entity death (~500 ms ink-blot) and an **ink drip** when
   an enemy lands a blow on the player or the Frontispiece bleeds
   a fresh drip onto the page (~350 ms streak).
2. **Page-flip transition.** Descending stairs plays a brief sepia
   sweep across the canvas while the new page is being read in —
   the book actually turns.
3. **Procedural audio.** Five short Web Audio tones, no asset files:
   `hit` (any attack), `pickup` (item or glyph), `descend`
   (page-flip), `cast` (spell), `death` (player death). The audio
   context is created lazily and unsuspended on the first key
   press so the browser autoplay policy is satisfied. Fails silent
   if the platform doesn't have Web Audio.
4. **Illuminated title + desktop-only banner.** The title overlay
   grows an illuminated drop-cap on the first letter, a sepia rule
   beneath it, and a slow CSS ink-drip loop. On touch devices below
   900 px, a parchment banner above the board explains that Inkwell
   is keyboard-only with a "Play anyway" dismiss.

Save format stays **v3** — no schema bumps. Animations and the
page-flip transition are ephemeral and not persisted.

**Known limits in this PR (intentional, per the phased plan):**

- Daily-seed runs still do not save (carried from PR #4).
- No mute UI — audio is procedural and short, so the trade-off was
  KISS. A toggle can land as a feedback-driven follow-up.
- Touch controls are explicitly not supported.

## File layout

```
inkwell/
├── index.html        — scaffold, loads main.js as a module; mobile banner
├── README.md         — this file
├── CHANGELOG.md      — shipped changes per PR
├── css/style.css     — parchment + sepia theme, illuminated title, banner
└── js/
    ├── main.js       — bootstrap, input, rAF loop, mode gating, mobile banner
    ├── constants.js  — palette, sizes, KIND, ENEMY_STATS, BOSS_STATS, SPELLS, ITEMS, GLYPHS
    ├── state.js      — createInitialState(), pushLog(), pushAnim()
    ├── rng.js        — Mulberry32, dailySeed(), subRng() for the bestiary
    ├── map.js        — rooms-and-corridors gen; boss-replaces-stairs on tier pages
    ├── entity.js     — uniform Entity factory; flat array with kind discriminator
    ├── actions.js    — the ONLY mutators: move, attack, pickup, useItem, castSpell, …
    ├── ai.js         — Dijkstra chase; per-kind actBefore hooks; boss-brain dispatch
    ├── turn.js       — scheduler: player → FOV → enemies → cull → FOV; buff decrement
    ├── fov.js        — recursive shadowcasting; visible/seen Uint8Arrays
    ├── render.js     — canvas paint, three-tier FOV draw, animation fades, page-flip
    ├── save.js       — localStorage round-trip; v3 snapshot (daily mode skips save)
    ├── audio.js      — lazy Web Audio context; playSfx() five procedural tones
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
  audio, illuminated title, explicit desktop-only banner. _Shipped._

See [`ROADMAP.md`](ROADMAP.md) for planned post-v0.5 PRs (Conditions,
Run history, Genre branches) and a feedback-driven pool of ideas beyond
them.

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
