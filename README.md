# HTML-Games

A small browser arcade. Each game lives in its own directory and is
served as static files — no backend, no build step (with one exception),
no accounts.

**Live**: <https://ai.gobha.me/games>

## Games

| Game | Description | Tech |
|------|-------------|------|
| [Forge Defense](forge-defense/) | Factory-building tower defense — mine, smelt, defend | vanilla JS |
| [Kimi: Core Protector](kimi/defence.html) | Tower defense with zoom + strategic placement | vanilla JS |
| [Snake](snake/) | Classic snake with difficulty levels and high scores | vanilla JS |
| [Space Invaders](space-invaders/) | Retro arcade shooter with destructible shields and UFO bonuses | vanilla JS |
| [Reclamation Wars](reclamation-wars/) | Post-apocalyptic 4X — 5 factions, hex map, 3 victory paths | vanilla JS |
| [Cogfall](cogfall/dist/) | Steampunk 4X — explore, expand, exploit, exterminate | Vite + TypeScript + PixiJS |

The launcher at [`index.html`](index.html) is the entry point.

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

Each game's deployable artifact is committed to git. There is no CI
build step — the deployment image is `python3 -m http.server` over a
straight `COPY . .`. Vanilla games are source-as-artifact; Cogfall
commits its `cogfall/dist/` build output. See [`SPEC.md`](SPEC.md) for
the full pipeline.

## Working in this repo

`main` is branch-protected. All changes land via pull request.

Multiple humans and AI agents (notably
[`ai-editor`](https://git.gobha.me/xcaliber/ai-editor)) push concurrently
— if you're an AI agent, start with [`AGENTS.md`](AGENTS.md). If you're
a human, [`SPEC.md`](SPEC.md) covers the layout, conventions, and
deployment story.

## License

[MIT](LICENSE)
