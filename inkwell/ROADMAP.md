# Inkwell — Roadmap (post-v0.5)

The original 5-PR roadmap (#198 → #202) shipped on 2026-05-11. This file is
the post-v0.5 brief: three planned PRs and a feedback-driven pool of ideas
beyond them. Future sessions execute one PR at a time.

If you're an LLM session picking this up cold, read first:

1. [`AGENTS.md`](AGENTS.md) — ownership, session protocol, **locked seams**.
2. [`README.md`](README.md) — concept, controls, design notes.
3. [`CHANGELOG.md`](CHANGELOG.md) — what shipped per PR, save-format history.
4. `git log --oneline inkwell/` — recent changes.

Then sketch a 3–6 bullet plan, get Jeffrey's approval, and branch. Branch
convention is `feat/103-inkwell-<topic>` (or `fix/`, `docs/` per the
[repo-wide AGENTS](../AGENTS.md)).

## What stays locked

The architectural seams in [`AGENTS.md`](AGENTS.md):31–55 hold for every PR
here. Specifically:

- `js/actions.js` is the only mutator.
- `state.entities[]` is flat data with a `kind` discriminator.
- `js/turn.js` sequences but doesn't know what actions do.
- Simulation is instant; animations queued on rAF.
- Constants in `js/constants.js`, not in state.
- Vanilla ES modules, no build step, no external libraries.

Every PR below was scoped to fit these without re-litigating them. If a
future change wants to violate one, stop and ask — that's a scope decision,
not an implementation detail.

## Recommended order

PR #6 (Conditions) → PR #7 (Run history) → PR #8 (Genre branches). PR #6
and #7 are independent and can land in either order if a session only picks
up one. PR #8 should land last so the save-format bumps stack cleanly.

---

## PR #6 — "Conditions"

**Ships.** Three status effects that the player applies to enemies via new
glyphs:

- **Smudged.** Enemy's vision range drops to 0 for N turns; they wander
  instead of chase. The Dijkstra-map AI from PR #2 already falls back to
  wander when no chase target is visible — this just flips the visibility
  flag.
- **Folded.** Enemy skips every other turn for N turns. Tempo control.
  Generalises the `boundTurns` mechanic from PR #4
  ([`CHANGELOG.md`](CHANGELOG.md):88–90) — the same decrement-and-skip
  shape in `ai.runEnemyTurns`.
- **Annotated.** The player sees this enemy on the rendered map regardless
  of FOV for N turns. Tracking, not damage. `render.js` reads the flag
  when drawing the seen-but-not-visible tier.

Three new glyphs (one per condition) spawn from page 3+ alongside the
existing five. One new action: `applyCondition(state, target, kind, turns)`
in `js/actions.js`. One new helper: `decrementConditions(entity)` called
from `js/turn.js` next to the existing buff decrement.

**Why now.** Highest tactical depth per line of code. Conditions are the
generalised shape of mechanics already shipped (`boundTurns` from PR #4,
`sealed` from PR #3, `buffs.wardTurns` from PR #3) — the architecture is
already pointing at this. They also make existing glyphs richer: Strike
against a Folded enemy is free damage; Ward against a Foxing pack with
two Smudged blockers in front becomes a real positional decision.

**Files touched.**

- `js/constants.js` — `CONDITIONS` table (kind, default turns, palette
  hint, flavor verb) and three new `GLYPHS` entries.
- `js/actions.js` — `applyCondition()`, three new cast handlers wired into
  `castSpell`.
- `js/turn.js` — call `decrementConditions(entity)` in the existing per-turn
  loop alongside buff decrement. No branching on condition semantics here.
- `js/ai.js` — Smudged check at the top of the per-enemy step (treat
  visibility as 0); Folded check at the top (skip turn if `turns % 2 === 1`,
  decrement only the active half).
- `js/render.js` — small letter badge over Annotated enemies in the
  seen-but-not-visible tier; subtle palette tint over Smudged / Folded.
- `js/ui.js` — log lines for application / wearoff.

**Locked seams.** Conditions are an **additive object field** on entities
(`entity.conditions = { smudged: 3 }`), not a parallel collection — honors
[`AGENTS.md`](AGENTS.md):38–41. Applying is in `actions.js` only — honors
[`AGENTS.md`](AGENTS.md):35–37. `turn.js` decrements but never branches on
condition kind — honors [`AGENTS.md`](AGENTS.md):42–44. `ai.js` reads
conditions but doesn't mutate them.

**Save format.** Bump to **v4**. New persisted field: `entity.conditions`
(plain object map). Old v3 saves discarded by the existing version check —
no migration. Document the bump in `CHANGELOG.md` under PR #6.

**Verification.** `python3 -m http.server 8000` from repo root →
`http://localhost:8000/inkwell/`. Cast each glyph at an enemy in range,
watch the badge / tint appear, step around until the turn counter drains
the condition, confirm wearoff log line. Descend a page and confirm
conditions on the *player*-tile-adjacent enemies clear (they're per-page).
Save mid-run, reload, confirm an active condition resumes with the right
remaining-turn count.

**Stretch (do NOT scope-creep PR #6).** Enemies inflicting conditions
*back* on the player is a natural follow-up — e.g. Foxing applies Smudged
on hit. Park it in the beyond-the-roadmap pool until conditions are
shipped and feel right.

---

## PR #7 — "Run history"

**Ships.** A local-storage list of the last 10 runs, surfaced on the
title overlay. Each entry: `{ date, seed, deepestPage, turnsTaken,
glyphsCast, causeOfDeath, runCode, won }`. The title overlay grows a
"Past runs" section below the seed input — a small table, newest first.
Click a row to copy that run's URL hash to clipboard.

**Why now.** Standalone, low risk, complements the daily-seed +
shareable run codes from PR #4
([`CHANGELOG.md`](CHANGELOG.md):76–82). A deepest-page history is the
natural score-tracking mechanic for a roguelike and makes the game feel
like a hobby you return to. Issue
[#109](https://git.gobha.me/xcaliber/HTML-Games/issues/109) is open repo-wide
about leaderboard patterns — Inkwell's history is a concrete worked example.

**Files touched.**

- `js/history.js` — **new module.** `loadHistory()`, `appendRun(entry)`,
  `clearHistory()`. Backs onto `localStorage` key `inkwell:history`, capped
  at 10 entries (drop oldest on overflow). Catches JSON-parse errors and
  resets the key on corruption (matches the resilience pattern in
  `js/save.js`).
- `js/actions.js` — hook in `killEntity()` on **player death** to call
  `appendRun({ ...summary, won: false, causeOfDeath })`. One-line hook on
  the Colophon win path (`win-state` set in PR #4) for `won: true`.
- `js/ui.js` — title overlay table render; copy-to-clipboard handler;
  empty-state line ("No past runs yet — the page is fresh.").
- `css/style.css` — small parchment-toned table styling, hover affordance.

**Locked seams.** History is a **separate `localStorage` key** from the
save snapshot. It outlives a single run, so it does not belong in
`js/save.js`'s schema. History writes go through `js/history.js` only — no
direct `localStorage.setItem('inkwell:history', …)` scattered through
`actions.js`.

**Save format.** **No change.** History is its own key on its own
lifecycle.

**Verification.** Play a run, die, restart — confirm a row appears. Win
via Colophon (or force `state.meta.winFlavor`) — confirm `won: true` row
renders with distinct styling. Run, save mid-run, reload, confirm the
in-progress run is *not* in history yet. Run 11 times, confirm cap at 10.
Click a row, paste, confirm a working `#seed=N` URL. Clear `localStorage`
and confirm the empty-state line renders.

---

## PR #8 — "Genre branches"

**Ships.** Three starting "books" chosen on the title overlay:

- **Poetry.** 5 short pages, dense enemy spawns, low ink budget per page.
  A tighter, denser run — the form is the constraint.
- **Prose.** Current behavior, named honestly. The legacy default.
- **Drama.** Longer pages, more enemies, higher ink budget. More room to
  cast and breathe.

One configuration object per genre in `js/constants.js`. `js/map.js` and
the spawn tables read multipliers from `state.meta.book`. Daily seeds
default to Prose for reproducibility across players. Run codes encode
the chosen book in the URL hash (e.g. `#seed=N&book=poetry`).

**Why now.** Replayability multiplier with zero new systems. Pure config
on top of dungeon-gen, ink budget, and spawn tables. The PR tests whether
the architectural seams really do let new content slot in without
rewrites — if anything here demands a code rewrite instead of a constant
edit, that's a signal worth surfacing.

**Files touched.**

- `js/constants.js` — `BOOKS` table: three entries, each a multiplier
  dict (`pageSizeMult`, `enemyDensityMult`, `inkBudgetMult`, palette tint?).
- `js/state.js` — `createInitialState({ seed, book })` accepts a book arg;
  defaults to Prose. Sets `state.meta.book` to the chosen entry by key.
- `js/map.js` — read `BOOKS[state.meta.book].pageSizeMult` when sizing the
  generated page; read `enemyDensityMult` when seeding spawns.
- `js/actions.js` — `castSpell` multiplies ink cost by
  `BOOKS[state.meta.book].inkCostMult ?? 1`, floored at 1.
- `js/ui.js` — title overlay book picker (three buttons), URL-hash parse
  for `book=` query, daily-seed click hardcodes Prose.
- `js/save.js` — persist `meta.book` key; bump save version.

**Locked seams.** All multipliers live in `constants.js`. The book
*choice* is in `state.meta`; the *content* of each book is a constant.
Honors [`AGENTS.md`](AGENTS.md):48–51. No new entity kinds, no new
collections, no new actions.

**Save format.** Bump to **v5** (assumes PR #6's v4 has shipped first).
New persisted field: `meta.book` (string key into `BOOKS`). Old saves
discarded.

**Verification.** Pick each book in turn from the title overlay, watch
the first page render with the expected size and enemy density.
Confirm ink budget per page matches the multiplier. Copy a URL, paste in
a new tab, confirm the same book loads. Confirm daily seed always loads
Prose. Save mid-run, reload, confirm `meta.book` resumes.

---

## Beyond the roadmap

Ideas worth pursuing if Jeffrey asks, but NOT scoped as PRs yet:

- **More glyphs.** Underline (self defense buff, complements Ward),
  Footnote (summon a paper-copy decoy that draws aggro for 3 turns),
  Index (briefly reveal map). Each is one action function — cheap.
- **Mute toggle.** Single audio mute button. The explicit follow-up
  flagged in [`README.md`](README.md):90–91.
- **First-run tutorial.** One-time popover walkthrough of glyph-cast →
  ink budget → page descent. Gated on `localStorage` "seen tutorial" key.
- **Achievements / milestones.** "First boss slain," "Deepest page 10,"
  "Solved the Frontispiece without a Wax Seal." Bestiary-style flavor
  text, no leaderboard sync — local only.
- **Accessibility.** High-contrast palette toggle; configurable key
  bindings.
- **Enemies inflicting conditions back on the player.** Foxing applies
  Smudged on hit, Erratum applies Folded post-teleport. Only after PR #6
  ships and the condition shape feels right.

These stay in the pool until Jeffrey asks for one, matching the
feedback-driven spirit of the original AGENTS.md direction.
