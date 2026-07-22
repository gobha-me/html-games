# AGENTS.md — conventions for AI agents working in this repo

If you're an LLM (or an LLM-driven editor like
[`ai-editor`](https://git.gobha.me/xcaliber/ai-editor)) about to make
changes here, read this first. Humans should read [`SPEC.md`](SPEC.md)
for the broader picture; this file is the short, tactical version.

## The hard rules

1. **Never push to `main` directly.** It's a protected branch. All
   changes land via pull request.
2. **Always `git pull --rebase origin main` before pushing** a branch.
   Multiple agents push concurrently; expect conflicts on shared files
   (especially `index.html` when adding a launcher card).
3. **Never `git push --force`** to a branch other agents may be using.
   If the rebase looks like it'll need a force-push to land, stop and
   ask the human.
4. **One unit of work per commit.** Cleanup in its own commit, feature
   in its own commit, refactor in its own commit. Don't mix mechanical
   changes with behavior changes.
5. **Don't touch a game directory you weren't asked to touch.** Each
   game subdir is owned by whoever started it (see "Multi-session
   topology" below). Cross-game refactors need a ticket and explicit
   approval.

## Agent attribution

Multiple LLM agents and humans push here. To make per-model quality
trackable over time ("does it work, does the change meet the goal"),
any agent-authored change must carry structured attribution:

1. **Commit trailer** — every agent-authored commit ends with:

   ```
   Co-authored-by: <Model Name> (<agent harness>) <noreply@venice.ai>
   Agent: <harness> / <model id>
   ```

   (Commit *authorship* reflects the local git config and says nothing
   about who wrote the change — the trailer is the source of truth.)

2. **PR label** — tag the PR with a per-model label: `llm:kimi-k3`,
   `llm:claude-opus-4`, etc. (create the label if missing), or `human`
   for unassisted human work. One PR = one primary model; if a second
   model materially contributed, say so in the PR body.

3. **Verification line** — the PR body states what check was run and
   its result (e.g. "node --check on 9 modules: pass; linkcheck:
   pass"). "No automated tests exist for X" is a valid entry — the
   point is that the claim is explicit, not that a suite exists.

With those three, `tea` can answer "show every <model> PR and whether
it merged cleanly" without manual bookkeeping.

## Multi-session topology

Multiple LLM sessions work this repo concurrently. The split is by
subdirectory:

- **Per-game sessions** open with a game's subdirectory as their
  working context (e.g. a Cogfall session at `cogfall/`, a roguelike
  session at `roguelike/`). Each session owns its subdir: its code
  style, architectural choices, roadmap format, commit cadence, and
  long-term tracking. A session inherits the conventions in this file
  and `SPEC.md`; everything inside its subdir is its own to decide and
  document.
- **The repo-root session** opens at `/` and handles cross-cutting
  work: launcher updates, `AGENTS.md`/`SPEC.md` changes,
  `Dockerfile`/`deployment.yaml`, cross-game comparisons, triage. It
  should not edit a game's interior unless that game has no active
  session or the change is genuinely repo-wide (e.g. a shared label
  rename, a launcher card refresh).

The boundary:

- **Repo-wide (root session territory):** this file, `SPEC.md`, deploy
  pipeline, branch protection, tea-cli usage, the label set, the
  launcher card list, the "Back to Arcade" link convention,
  shared/cross-game tooling.
- **Game-interior (per-game session territory):** code, tests,
  `README.md`, `CHANGELOG.md`, optional roadmap doc, optional decision
  log, build choices within the policy this file sets.

Each game's documentation IS the per-session memory across
conversations — keep it current.

## Workflow

For any non-trivial change:

1. **Find or create a ticket** in the Gitea issue tracker. Reference
   the issue number in your branch name and commit messages.
2. **Branch from `main`** with a descriptive prefix: `feat/`, `fix/`,
   `chore/`, `docs/`. Example: `feat/snake-ghost-trail`.
3. **Sketch a 3–6 bullet plan** before writing code if the change is
   non-trivial. Get human approval if you're working alongside one.
4. **Commit small.** Imperative subject line, "why" in the body if
   non-obvious. Co-author trailers welcome.
5. **Rebase before pushing.** `git pull --rebase origin main`, resolve
   conflicts, push.
6. **Open a PR** linking the issue. Tag a label so the triage view
   stays useful.

## Repo layout (cliff notes)

- One game per top-level directory: `cogfall/`, `forge-defense/`,
  `kimi/`, `reclamation-wars/`, `snake/`, `space-invaders/`.
- The launcher is `index.html` at repo root — it links to each game
  with a relative path. If you add a new game, add a card. The card
  data lives in **two** places that must be kept in sync: `games.json`
  (canonical manifest, consumed by `scripts/linkcheck.sh`) and the
  `<script type="application/json" id="games-data">` block inside
  `index.html` (what the launcher actually reads — inlined to avoid a
  `fetch()` that breaks under `file://` and under the deployed
  `/games`-without-trailing-slash URL).
- `demos/` holds historical artifacts and is **not** linked from the
  launcher. Don't reference it from active games.
- `LICENSE`, `README.md`, `SPEC.md`, `AGENTS.md`, `Dockerfile`,
  `deployment.yaml` are repo-level — change them with care, they
  affect everyone.

## Deployment & PR checks

The deploy image is a multi-stage Dockerfile: a Node stage builds
Cogfall (`npm ci && npm run build`), and a Python stage serves the
repo plus the built `cogfall/dist/` via `python3 -m http.server`.
Implications for you:

- Vanilla games (HTML / CSS / JS) deploy as-is. The source *is* the
  artifact.
- Cogfall is built in CI. **Don't commit `cogfall/dist/`** — it's
  gitignored. Edit `cogfall/src/`, push, open a PR; the image rebuilds
  on merge to `main`.
- PR checks (`.gitea/workflows/pr-checks.yaml`) run lint, build, and
  tests on any PR that touches `cogfall/**`. All three must pass
  before merge — that's the quality gate browser-only agents like
  ai-editor rely on.
- New build-tool-using games should extend the multi-stage Dockerfile
  with their own build stage and follow Cogfall's gitignore-the-dist
  pattern. Point the launcher card at `<game>/dist/` and document the
  build in the game's README.

## Tech-stack defaults

Vanilla HTML / CSS / JS unless there's a real reason to reach for a
framework. Cogfall reaches for Vite + TypeScript + PixiJS because the
game needs typed state, deterministic-core tests, and a render layer
the vanilla path can't easily match. The bar is "this unlocks
something fun and playable", not "lightweight is virtuous". Strong
training data and good docs are perfectly valid reasons to pick a
library.

## Per-game documentation

Every game directory carries its own documentation. The session
working on that game picks the format and cadence — these files are
the session's memory across conversations.

**Required:**

- **`README.md`** — what it is, how to play, tech stack, status, file
  layout. Template lives in [`SPEC.md`](SPEC.md). Skim
  `snake/README.md` or `space-invaders/README.md` for current models.
- **`CHANGELOG.md`** — chronological log of shipped changes. Format
  is the session's call: `kimi/CHANGELOG.md` uses Keep-a-Changelog,
  Cogfall captures equivalent detail in commit messages plus
  `cogfall/PHASE_3_ROADMAP.md` annotations. Both are valid. The bar
  is "a new session can read this and know what's already been
  shipped without re-deriving from `git log`."

**Optional (per session's call):**

- **Roadmap doc.** Cogfall uses `cogfall/PHASE_3_ROADMAP.md` with a
  per-session breakdown; other games may prefer a "next 3 things"
  bullet list, a Gitea milestone, or no roadmap at all.
- **Decision log.** Cogfall's lives in the comment block at the top of
  `cogfall/src/core/state.ts`. Other games may not need one — use
  one if the same design choices keep getting re-litigated across
  conversations.

If you're starting fresh on a new game, ship the README in the first
PR and add a CHANGELOG no later than the second. Backfilling a
CHANGELOG for an existing game is welcome but not required as part
of unrelated PRs.

## 'Back to arcade' link convention

Every game must include a persistent "← Back to Arcade" link so players
can navigate back to the launcher without using the browser back button.

- **HTML**: `<a href="../" class="back-to-arcade">← Back to Arcade</a>`
  placed near the bottom of `<body>` (before `<script>` tags).
- **Cogfall exception**: Cogfall's source lives in `cogfall/index.html`
  but is built to `cogfall/dist/` in CI. The link in the source must use
  `href="../../"` to reach the repo root from the built output.
- **Styling**: Use class `back-to-arcade`. Placement and color are
  flexible per game's aesthetic, but it must be visually unobtrusive
  (e.g. muted color, fixed position at bottom or corner).
- **New games**: Follow this convention when adding a new game.


## Things that will break the deploy

- Pushing Cogfall changes that fail PR checks (lint / build / tests) —
  the merge still goes through if a human force-merges, but the deploy
  image build will fail at the Node stage.
- Adding a launcher card with a broken relative path.
- Renaming a game directory without updating the launcher's link.
- Committing files with absolute paths or `localhost` URLs.
- Importing scripts via `/games/...` (the prefix is stripped at the
  ingress — paths must be relative to repo root).

## When you're stuck

- Issue tracker is at <https://git.gobha.me/xcaliber/HTML-Games/issues>.
- The repo's pre-flight cleanup PR (#80), this `AGENTS.md`, and
  [`SPEC.md`](SPEC.md) are the current best on-ramp.
- If you're working in a game subdir and need context the codebase
  doesn't make obvious, check that game's `README.md` / `CHANGELOG.md`
  / roadmap doc first — the prior session left them for you.
- If a change you're about to make would obviously break the deploy
  pipeline (e.g. a new game that needs a backend), stop and open an
  issue first.
