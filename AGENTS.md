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
   game subdir is owned by whoever started it. Cross-game refactors
   need a ticket and explicit approval.

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
  with a relative path. If you add a new game, add a card.
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

## Per-game READMEs

Every game directory should carry a `README.md` covering:

- **What it is** — one paragraph
- **How to play** — controls and goal
- **Tech stack** — vanilla? framework? build step?
- **Status** — playable / WIP / known bugs
- **File layout** — pointer to the entry HTML and the main JS modules

Match the template by skimming `snake/README.md` and
`space-invaders/README.md` — they're the current models.

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
- The repo's pre-flight cleanup PR (#TBD) and this `AGENTS.md` are the
  current best on-ramp.
- If a change you're about to make would obviously break the deploy
  pipeline (e.g. a new game that needs a backend), stop and open an
  issue first.
