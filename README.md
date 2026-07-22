# HTML-Games

A small browser arcade. Each game lives in its own directory and is
served as static files — no backend, no build step (with one exception),
no accounts.

**Live**: <https://ai.gobha.me/games>

## Games

| Game | Description | Tech |
|------|-------------|------|
| [Forge Defense](forge-defense/) | Factory-building tower defense — mine, smelt, defend | vanilla JS |
| [Frontline](frontline/) | Dieselpunk trench-warfare card battler across three sectors | vanilla JS |
| [Kimi: Core Protector](kimi/defence.html) | Tower defense with zoom + strategic placement | vanilla JS |
| [Snake](snake/) | Classic snake with difficulty levels and high scores | vanilla JS |
| [Space Invaders](space-invaders/) | Retro arcade shooter with destructible shields and UFO bonuses | vanilla JS |
| [Reclamation Wars](reclamation-wars/) | Post-apocalyptic 4X — 5 factions, hex map, 3 victory paths | vanilla JS |
| [Cogfall](cogfall/dist/) | Steampunk 4X — explore, expand, exploit, exterminate | Vite + TypeScript + PixiJS |
| [2048](2048/) | Slide-and-merge tile puzzle with power-tile combos | vanilla JS |
| [Breakout](breakout/) | Brick-breaking arcade classic with power-ups and boss battles | vanilla JS |
| [Pong](pong/) | The original arcade duel — vs CPU or local two-player | vanilla JS |
| [Minesweeper](minesweeper/) | Flag mines, reveal safe cells, beat your best time | vanilla JS |
| [Typing Game](typing/) | Type falling words before they land — multiple modes, live WPM | vanilla JS |
| [Sokoban](sokoban/) | Classic box-pushing puzzle — push, never pull | vanilla JS |
| [Solitaire](solitaire/) | Klondike with daily deals, Vegas scoring, auto-complete | vanilla JS |
| [Tetris](tetris/) | Neon-arcade falling-block classic | vanilla JS |
| [Inkwell](inkwell/) | Literary roguelike — a scribe descends a corrupted grimoire | vanilla JS |
| [Asteroids](asteroids/) | Vector-style space shooter — blast rocks, dodge UFOs | vanilla JS |
| [Oregon Trail](oregon-trail/) | Lead your party to the Willamette Valley — resources, moral choices, reputation | vanilla JS |
| [Late Edition](late-edition/) | 1940s noir RTS — a newspaper fronting an information empire (design phase) | vanilla JS |
| [Hexwire](hexwire/) | Neon-noir cyberpunk lane battler across three city blocks | vanilla JS |
| [DEAD DISTRICT](dead-district/) | Survival-horror wave shooter with an 18+ age gate | vanilla JS |

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
