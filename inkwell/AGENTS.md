# inkwell/AGENTS.md — for AI agents working in Inkwell

If you're an LLM session opened inside `inkwell/`, this file is your
cold-start brief. Repo-wide rules live in [`../AGENTS.md`](../AGENTS.md);
the design narrative and tech rationale are in
[`README.md`](README.md#design-notes); shipped history is in
[`CHANGELOG.md`](CHANGELOG.md).

## Ownership

**Claude owns Inkwell's direction.** Jeffrey delegated full latitude on
stack/scope when issue #103 opened. The 5-PR roadmap (#198 → #202) is
shipped; the README closes with *"No further roadmap. The book is
closed; future work on Inkwell is feedback-driven."*

That means: new work is reactive to feedback or to Jeffrey's specific
ask, not a continuation of a Phase plan. Don't invent a roadmap.

## Session-open protocol

1. **Read this file.**
2. **Read [`README.md`](README.md)** — concept, controls, design notes,
   tech rationale, and the locked architectural seams.
3. **Read [`CHANGELOG.md`](CHANGELOG.md)** — what shipped in each PR
   and the version history for the save format.
4. **`git log --oneline inkwell/`** for recent changes.
5. **Sketch a 3–6 bullet plan, get Jeffrey's approval, then branch and
   execute.** Branch convention: `feat/103-inkwell-<topic>` or
   `fix/103-inkwell-<topic>`.

## What's locked (don't re-litigate)

The PR #1 architectural calls are load-bearing for every later PR:

1. **`js/actions.js` is the ONLY mutator.** Spells, item-uses, and
   future content become new action functions. The turn loop never
   learns about new content types.
2. **`state.entities[]` is flat data with a `kind` discriminator.**
   Stairs, items, glyph fragments, enemies all share one array. Don't
   add parallel collections for new entity kinds; add a new `kind`.
3. **`js/turn.js` doesn't know what actions do.** It sequences
   actor → action → animations → render and recomputes FOV /
   decrements buffs. Logic for what a specific spell or item does
   lives in `actions.js`, never here.
4. **Simulation is instant; animations are queued.** rAF drains the
   queue. Polish (PR #5) was a parameter change, not a rewrite —
   keep it that way.
5. **Constants in `js/constants.js`, NOT in state.** Data tables
   (`ITEMS`, `GLYPHS`, `SPELLS`, etc.) are constants too. State is the
   simulation snapshot; constants are the rules. This split was made
   to avoid the `state.config` smell from `kimi/`.

If a change wants to violate one of these, stop and ask Jeffrey —
that's a scope change, not an implementation detail.

## The distinctive twist

**Language / writing IS the mechanic.** This is what makes Inkwell
"uniquely Claude" vs other roguelikes:

- Spells are **glyphs** picked up off the page and bound to slots.
- Ink is a **page-bound** resource that resets each descent.
- Items are literary: Inkpot, Blotting Cloth, Wax Seal, Quill Nib,
  Marginalia.
- Enemies are **ink-blots that have crept onto the page**.
- The score is **the deepest page reached**.
- Death is *"the natural state of an unfinished sentence"*.

When extending Inkwell — new spells, new items, new enemy variants —
the literary register is the spine. A "Fireball" spell would be
wrong; a "Strike" glyph or "Erase" or "Bind" is right. Bestiary
entries are written as marginalia, not stat blocks. Stay inside the
metaphor.

## Tech (locked)

Vanilla HTML / CSS / JS, ES modules, **no build step**. Single
`<canvas>`, glyphs rendered via `ctx.fillText`. Custom implementations:
Mulberry32 PRNG, rooms-and-corridors generator, recursive shadowcasting
FOV, Dijkstra-map AI. **No external libraries** — the design notes in
README explain why (the whole simulation is ~150 lines of custom code,
well below where ROT.js or similar would earn its place).

If a new feature seems to want a library, that's a signal to look harder
at the design first.

## Save format

Versioned and discarded on mismatch (no migration). Current shape lives
in `js/save.js`. Each save bump is a load-time decision — old saves
just don't load. Document the version change in `CHANGELOG.md` under
the relevant PR.

## Workflow

Per [`../AGENTS.md`](../AGENTS.md): branch from `main`, plan first,
one unit per commit, rebase before push, never force-push. Inkwell
specifics:

- **No test suite.** Verify by running `python3 -m http.server 8000`
  from the repo root and visiting `http://localhost:8000/inkwell/`.
  Click through the title overlay, play a few turns, test the
  affected feature, restart on death.
- **Commit message style:** `feat(inkwell): ...`, `fix(inkwell): ...`,
  `docs(inkwell): ...`. Add `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
  trailer.
- **PR labels:** `enhancement` / `bug` / `docs` as appropriate; no
  dedicated `inkwell` label exists in the tracker — reference issue
  #103 in the PR description.
- **Per-game contract:** update `README.md` and `CHANGELOG.md` in
  the final commit of any PR that ships new behavior.
- **Launcher integration:** `games.json` entry + `--inkwell` CSS
  variable + `.card.inkwell:hover` glow in root `index.html`. New
  visual identity changes touch both.

## When in doubt

This file + README + CHANGELOG is the cold-start surface. The book is
closed on the planned roadmap, but small targeted improvements are
welcome when Jeffrey asks. Keep the voice; keep the seams.
