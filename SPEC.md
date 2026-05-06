# HTML-Games — Arcade Spec

## What this repo is

A small arcade of browser games, each in its own subdirectory, fronted by a
single launcher (`index.html`) and deployed publicly at
**https://ai.gobha.me/games**. The repo doubles as a competition space
where multiple LLMs each contribute games — an LLM-vs-LLM build-off with
the URL as the scoreboard.

Going forward this repo also serves as a live testbed for
[`ai-editor`](https://git.gobha.me/xcaliber/ai-editor), so multiple AI
agents will be iterating on it concurrently. `main` is branch-protected;
all changes land via PR.

## Repo layout

```
HTML-Games/
├── index.html              # arcade launcher; one card per game
├── README.md               # human onboarding
├── AGENTS.md               # conventions for AI agents working in this repo
├── SPEC.md                 # this file
├── Dockerfile              # `python3 -m http.server` over a COPY . .
├── deployment.yaml         # k8s deployment + Traefik ingress (/games)
├── LICENSE
│
├── cogfall/                # steampunk 4X (Vite + TS, dist/ committed)
├── forge-defense/          # factory-building tower defense (vanilla JS)
├── kimi/                   # core-protector tower defense (vanilla JS)
├── reclamation-wars/       # post-apoc 4X (vanilla JS)
├── snake/                  # classic snake (vanilla JS)
├── space-invaders/         # retro arcade shooter (vanilla JS)
│
└── demos/                  # historical artifacts; not linked from launcher
```

## Subdir convention (one game per directory)

A game directory must:

- Contain an `index.html` (or, for a built project like Cogfall, a
  `dist/index.html`) so a static file server can serve it directly.
- Be linkable from the root launcher with a relative path. Cogfall's
  card points at `cogfall/dist/`, every other game's card points at
  the directory itself.
- Carry its own `README.md` with: how to play, controls, tech stack,
  current status (playable / WIP / known issues).
- Stand alone. No cross-game imports, no shared global JS / CSS.
  Games may *opt into* future shared helpers (a sound kit, a UI kit)
  but the default is self-contained.

## Deployment pipeline

The CI build is intentionally trivial — there isn't one. The Dockerfile
runs `python3 -m http.server 8000` over `COPY . .`, the k8s service
exposes that on :80, and Traefik fronts it at host `ai.gobha.me` with
path prefix `/games` and a `stripPrefix` middleware. Net effect:

```
https://ai.gobha.me/games/snake/        →  snake/index.html
https://ai.gobha.me/games/cogfall/dist/ →  cogfall/dist/index.html
```

Implications:
- **Every game's deployable artifact must be committed.** Vanilla
  games have nothing to build, so the source *is* the artifact. Cogfall
  builds with Vite — its `dist/` folder is committed on purpose, see
  `cogfall/.gitignore` for the explanatory comment.
- Vite-style projects need `base: './'` so the relative
  `./assets/index-[hash].js` paths in the built `index.html` resolve
  under the strip-prefixed URL.
- Local testing: `python3 -m http.server 8000` from the repo root,
  then browse to `http://localhost:8000/`.

## Tech-stack policy

Vanilla HTML / CSS / JS is the default. A game *may* use a build tool
or framework (Cogfall uses Vite + TypeScript + PixiJS) when there's a
real reason — typed game state, deterministic-core tests, or a render
layer the vanilla path can't easily match. The bar is "this unlocks
something fun and playable", not "this is fashionable".

## Concurrency rules

Multiple LLMs and multiple developer sessions push to this repo. Three
hard rules:

1. **No direct push to `main`.** Branch is protected. All changes via
   PR.
2. **Always `git pull --rebase` before pushing** a branch. Other
   contributors push concurrently — expect occasional merge conflicts
   on shared files (especially `index.html` when adding launcher cards).
3. **Never `git push --force`** to a shared branch. If a rebase looks
   like it'll need a force-push, stop and ask the human.

See [`AGENTS.md`](AGENTS.md) for the full set of agent conventions.

## Roadmap and tickets

Work is tracked in the Gitea issue tracker for this repo. Labels group
by category (`new-game`, `enhancement`, `bug`, `cleanup`, `docs`,
`cogfall`, `good-first-issue`, `ai-editor-test`).

Cogfall has its own multi-phase roadmap; the per-session breakdown lives
in `cogfall/PHASE_3_ROADMAP.md`. Cogfall PRs are tagged `cogfall` so
they're easy to filter out when triaging arcade-wide work.
