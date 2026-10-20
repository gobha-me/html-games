# HTML-Games

A small browser arcade. Each game lives in its own directory and is
served as static files — no backend, no build step (with one exception),
no accounts.

**Live**: <https://ai.gobha.me/games>

## Games

| Game | Description | Tech |
|------|-------------|------|
| [Frontline // Hexwire](frontline/) | Dual-style 3-lane tactical card battler (1918 Dieselpunk vs. 2099 Cyberpunk Street Magic & Rift Crossover) | vanilla JS |
| [Kimi: Core Protector](kimi/defence.html) | Tower defense with zoom + strategic placement | vanilla JS |
| [Snake](snake/) | Classic snake with difficulty levels and high scores | vanilla JS |
| [Space Invaders](space-invaders/) | Retro arcade shooter with destructible shields and UFO bonuses | vanilla JS |
| [Cogfall](cogfall/dist/) | Steampunk 4X — explore, expand, exploit, exterminate | Vite + TypeScript + PixiJS |
| [Breakout](breakout/) | Brick-breaking arcade classic with power-ups and boss battles | vanilla JS |
| [Retro Cabinet](classics/) | 5-in-1 early LLM anthology: 2048, Minesweeper, Pong, Sokoban, Typing | vanilla JS |
| [Solitaire](solitaire/) | Klondike with daily deals, Vegas scoring, auto-complete | vanilla JS |
| [Tetris](tetris/) | Neon-arcade falling-block classic | vanilla JS |
| [Inkwell](inkwell/) | Literary roguelike — a scribe descends a corrupted grimoire | vanilla JS |
| [Asteroids](asteroids/) | Vector-style space shooter — blast rocks, dodge UFOs | vanilla JS |
| [Oregon Trail](oregon-trail/) | Lead your party to the Willamette Valley — resources, moral choices, reputation | vanilla JS |
| [Late Edition](late-edition/) | 1940s noir RTS — a newspaper fronting an information empire (design phase) | vanilla JS |
| [DEAD DISTRICT](dead-district/) | Survival-horror wave shooter with an 18+ age gate | vanilla JS |
| [BACKBEAT](backbeat/) | 4-lane rhythm game with onset-charted generated audio | vanilla JS |
| [BREACH // 2099](breach/) | 2.5D normal-mapped WebGL2 cyberpunk tactical room-clear | WebGL2 + vanilla JS |
| [SUNBREAK // V'BALL](sunbreak/) | 2.5D HD-pixel arcade beach volleyball with coupled soft-body physics & 1–4P co-op | WebGL2 + vanilla JS |

The launcher at [`index.html`](index.html) is the entry point, and
[`games.json`](games.json) is the canonical manifest it renders from.

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

That's it. Click any game card.

## Verify

Check that all game links in the launcher resolve to real files:

```bash
bash scripts/linkcheck.sh
```

Exit code 0 means all links are valid; non-zero means one or more are broken.

## Deploy

The deploy image is the multi-stage [`Dockerfile`](Dockerfile) at repo
root: a Node stage runs `npm ci && npm run build` for Cogfall, and a
Python stage serves the repo — plus the built `cogfall/dist/` copied
from the build stage — via `python3 -m http.server`.

- Vanilla games (HTML / CSS / JS) deploy as-is; the source is the artifact.
- Cogfall is built in CI. **Don't commit `cogfall/dist/`** — it's
  gitignored. Edit `cogfall/src/` and open a PR; the image rebuilds on
  merge to `main`.

See [`SPEC.md`](SPEC.md) for the full pipeline.

## Working in this repo

`main` is branch-protected. All changes land via pull request.

Multiple humans and AI agents (notably
[`ai-editor`](https://git.gobha.me/xcaliber/ai-editor)) push concurrently
— if you're an AI agent, start with [`AGENTS.md`](AGENTS.md). If you're
a human, [`SPEC.md`](SPEC.md) covers the layout, conventions, and
deployment story.

## License

[MIT](LICENSE)
