# cogfall/AGENTS.md — for AI agents working in Cogfall

If you're an LLM session opened inside `cogfall/`, this file is your
cold-start brief. Repo-wide rules live in [`../AGENTS.md`](../AGENTS.md);
this one covers everything specific to Cogfall.

## Ownership

**Claude owns Cogfall's direction** — architecture, roadmap, features,
balance, refactors. Jeffrey delegated this on 2026-05-11 verbatim:
*"cogfall is one of many games in one project dir … this game is yours;
direction, arch, roadmap, issues, etc — you want to refactor/rewrite,
fine, you want to add features, fine"*.

That trust comes with discipline: every session opens with a plan,
gets human approval, then branches.

## Session-open protocol

Every Cogfall session, in this order:

1. **Read this file** (you are here).
2. **Read [`README.md`](README.md)** — current stack, win conditions,
   commands.
3. **Read [`PHASE_3_ROADMAP.md`](PHASE_3_ROADMAP.md)** — full Phase 3
   plan with per-session what/why/critical-files.
4. **Skim the decision-log block at the top of
   [`src/core/state.ts`](src/core/state.ts)** (items 1–13+). These are
   "kept on purpose" choices. Extend the block when you add new ones;
   never silently revert.
5. **Check open tickets:**
   `tea-cli issues list --repo xcaliber/HTML-Games --state open --labels cogfall`
   (the `--repo` flag is required — tea-cli does NOT auto-detect from
   cwd reliably).
6. **`git log --oneline cogfall/`** for recent changes.
7. **Sketch a 3–6 bullet plan, get Jeffrey's approval, then branch and
   execute.** No code before the plan.

## Phase status

- **Phase 1 + 2 (a–n3) + Phase 3 S1–S8 + S9a: shipped.**
- **S9b is the next session** — alliances + persistent trade
  agreements. S9a (one-shot trades + tribute) shipped through
  `systems/diplomacy.ts` (pure eval/apply functions),
  `ai/diploAI.ts` (`aiConsiderTrade` / `aiConsiderTribute` after the
  peace ↔ war pass), `ui/diploModal.ts` (inline trade/tribute
  action sub-panel), and `data/diplomacyVoice.ts` (per-faction
  register for all new log lines). S9b introduces the `treaties`
  array on G with additive serialization (item-8 precedent),
  alliance breakage on either side suing peace, and alliance-aware
  war-declaration in `aiDiplomacy`.
- Then Tier 3 (S10 endgame polish), Tier 4 (S11 balance, S12 perf),
  optional Tier 5 (eras, more factions, mods).

For per-session narrative, prefer `git log --oneline cogfall/` over
re-deriving from any single doc — it's authoritative.

## The voice is the moat

Cogfall's competitive moat vs Reclamation Wars (Qwen 3.6's 4X) is **not**
the architecture — Qwen could close those gaps. It's the **consistent
literary steampunk register** layered over every player-facing surface.
Anchor phrases from the live game:

- Opening: *"The Awakening begins. The Cogwright Guild stirs from the
  ash."*
- Player address: *"Awaiting your orders, Steward..."* (never "Player",
  never "Commander")
- Top-bar nav: *Knowledge / Banners / Records* (not Tech / Diplomacy /
  Save)
- Tech tree: *"The Tree of Forgotten Lore — Choose a path of
  rediscovery."*
- Diplomacy: *"The Other Banners — Watch them. They watch you."*
- Save: *"The Records — Three slots and the autoscribe. Time gnaws at
  all things — keep your ledgers."*
- Hot-seat: *"Step away from the gears."*
- Hotkey legend: *"Stewards' Codex — Bind one to memory, then bind
  another. The Engine respects discipline."*
- Replay: *"The Loom of Past Turns."*

**Implications for every content session:**

- **S7 + S8 + S9a (shipped):** the chronicle-passage register for
  victory endings (S7), the hand-authored scenario prologues (S8),
  and the per-faction diplomacy voice table (S9a, in
  `data/diplomacyVoice.ts`) are the reference for any future copy.
  If you add a new scenario or a new diplomacy event, match the
  cadence in `data/factions.ts` → `victoryProfile.flavorTemplates`,
  `data/scenarios.ts` → `SCENARIOS[*].prologue`, and
  `data/diplomacyVoice.ts`. Treat those strings as load-bearing.
- **S9b–S10 (next): every new UI surface gets a voice review before
  merge.** Generic placeholders ("Click here", "Trade Agreement #1")
  break the spell. Alliance text especially — each faction's offers,
  acceptances, and breakages should speak in its register (the S9a
  voice block is the model; extend it before adding new log
  surfaces).
- **Per-faction speech registers in `data/personalities.ts` /
  `data/factionBehaviors.ts`:** Aetheric Order speaks of ratios and
  proofs; Coalition of Coin in ledger terms; Iron Legion in martial
  imperatives; Verdant Pact in growth/seasons; Cogwright in mechanism.
- **Never strip flavor while refactoring.** Treat copy with the same
  byte-feel discipline as the mechanics decision-log. A string that
  looks "redundant" or "overwrought" is almost certainly load-bearing
  — confirm before touching.

## Carry-forwards & decision discipline

The authoritative carry-forward list is the decision-log block at the
top of [`src/core/state.ts`](src/core/state.ts) (items 1–13+). It
captures every "kept on purpose" choice from Phase 1 through Phase 3 S3.
Highlights:

- `Map<TileKey, Tile>` not flat array (item 1) — defer until perf
  pressure justifies the A/B.
- Cosmetic `Math.random` sites stay on `Math.random` (item 2 + the
  header in `core/rng.ts`) — converting them breaks replay parity via
  side-channel.
- Rivers are visual + bookkeeping only (item 5) — no movement cost, no
  defense bonus, no yield change.
- Soft-claim invariant (item 7) — `tile.claim` MUST NOT mutate
  `tile.owner`.
- Save format is additive (item 8) — fresh fields with sensible
  defaults don't bump `SAVE_VERSION`.
- Build queue is FIFO with shift-on-complete (item 9) — AI stays
  length-1; don't widen.
- Animation event bus (item 10) — `systems/{combat,movement,turn,…}`
  emit; render-side subscribes. Pixi-free leaf module.
- Per-faction AI behavior (item 11) — read scalars via
  `resolveBehavior(faction)`, never `PERSONALITIES[...]` directly.
- Scenario system (item 12) — three shipped scenarios pin `seed`;
  cosmetic overrides (`nameOverride`/`colorOverride`/`glyphOverride`)
  re-skin without changing the underlying FactionDef; `startBuildings`
  and `victoryOverrides` remain type-only.
- Replay log cap (item 13) — `MAX_REPLAY_TURNS = 200`; don't remove
  without a fresh memory budget.
- Per-faction victory profile (item 14) — read via
  `getVictoryProfile(idx)`, never `FACTIONS[idx].victoryProfile`
  directly.

When a new "kept on purpose" choice lands, extend the block. Don't
bypass.

## Workflow

Per [`../AGENTS.md`](../AGENTS.md): one unit of work per commit, rebase
before push, never force-push, never push to main. Cogfall-specific:

- **Test gate.** After each commit unit, run from `cogfall/`:
  `npm test && npm run build && npm run lint`. Report pass/fail before
  the next commit.
- **Don't commit `cogfall/dist/`.** It's gitignored as of PR #117.
  Multi-stage Dockerfile builds it in CI on every push to main.
- **Test the bundle locally** before opening a PR if the change touches
  rendering: `npm run build && python3 -m http.server 8000` from the
  repo root, then `http://localhost:8000/cogfall/dist/`.
- **Commit message style:** `Cogfall Phase 3 SN: <what>` for roadmap
  sessions; conventional commits (`feat(cogfall): ...`,
  `fix(cogfall): ...`, `docs(cogfall): ...`) for everything else.
  Add `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
  trailer.
- **PR labels:** always `cogfall`, plus `enhancement` / `bug` / `docs`
  as appropriate.

## Local tooling gotchas

- **Worktree paths.** Cogfall worktrees live at
  `cogfall/.claude/worktrees/<name>/` and contain a FULL HTML-Games
  checkout. When editing, paths must be relative to the worktree root
  (e.g. `cogfall/README.md` from the worktree, NOT
  `/config/Projects/HTML-Games/cogfall/README.md` which is the main
  checkout — separate). If your Bash session has `cd`-wandered, get
  back to the worktree root before Write/Edit.
- **Fresh worktree needs install.** The worktree's `cogfall/` has its
  own `package.json` but no `node_modules`. Run `npm install` in
  `cogfall/` before `npm run dev` or any preview-tool launch.
- **Preview tool + PixiJS.** `mcp__Claude_Preview__preview_screenshot`
  hangs on Pixi/WebGL canvases (timeout after 30s). Use
  `preview_eval` with DOM probes instead — every player-facing piece
  of state lives in `#top-bar`, `#bottom-bar`, `#left-panel`,
  `#right-panel`, `#event-log`, `#ai-action-banner`. Click via
  `preview_click` against button selectors. The setup modal is
  `#setup-modal`; the dev server runs on `http://localhost:5173`.
- **tea-cli quirk.** Always pass `--repo xcaliber/HTML-Games --head <branch> --base main`
  to `tea-cli pulls create`. The auto-detection fails with "reference
  not found" otherwise.

## Multiplayer seam (active carry-forward)

Hot-seat ships via `ControlMode = 'single' | 'hotseat'` with `'pbem' |
'plinth'` reserved as a future seam. `systems/turn.ts` factors
`dispatchHandoff(next)` into AI / single / hotseat-different-human paths.
The `Promise<void>` handoff contract is the seam future PBEM / Plinth
work would slot into. **Don't build PBEM/Plinth in this repo** — Jeffrey
moved that to a hypothetical port. Just don't break the seam.

## When in doubt

- This file + README.md + PHASE_3_ROADMAP.md + decision-log in state.ts
  is the cold-start surface. If something feels under-documented, ask
  Jeffrey before guessing.
- The voice is sacred. The decision log is sacred. Everything else is
  Claude's call.
