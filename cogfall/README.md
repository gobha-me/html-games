# The Cogfall — A Steampunk 4X

A turn-based 4X hex strategy game set in a steampunk world. Play as one of five factions competing to rediscover lost technology, expand settlements, and shape the future through exploration, research, diplomacy, and combat.

## How to play

### Objective
Explore the hex map, gather resources (gold, aether, science, culture), build units and structures, research technologies, and achieve victory through one of four paths.

### Controls
- **Left-click** a hex to select; click an adjacent hex to move a selected unit
- **Right-click drag** to pan the map; **scroll wheel** to zoom
- **Space** end turn · **N** next unit · **F** fortify · **?** open the Stewards' Codex (full keybinds)
- Click action buttons in the side panels to build, research, save, or open the replay viewer

### Win conditions
- **Domination** — be the last faction with a city standing
- **Scientific** — complete the Grand Apparatus tech
- **Cultural** — hold 40% of claimed tiles for 5 turns (toggle in setup)
- **Economic** — amass 5000 gold for 3 turns (configurable: 3000 / 5000 / 8000)

## Tech
Vite + TypeScript (strict), PixiJS 8 for the hex map render layer, DOM for UI panels, Vitest for the test suite (~300 tests). Source under `src/` organized as `core/ data/ systems/ ai/ render/ ui/ input/`. The deployed bundle is built into `dist/` (gitignored — CI builds it during deploy).

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle into dist/
npm test         # Vitest
npm run lint
```

## Status
Phase 3 in progress. Sessions S1–S8 + S9a shipped: animation event bus, per-faction AI dispatch + variety, scenario scaffold + three named scenarios (Aether Ascendancy, Steamguild Civil War, Coastal Conquest), faction-flavored victory paths, turn-end / tech-pop / unit-death animations, and one-shot diplomacy (gold-for-tech trades, gold-for-aether trades, tribute demands) with per-faction voice across every new log line. **Next: S9b** — alliances + persistent trade agreements (the treaty layer the S9a one-shots were a warmup for). See `PHASE_3_ROADMAP.md` for the full breakdown.

## File layout
- `index.html` — entry point, game shell (top bar, bottom bar, canvas, SVG overlay, modals)
- `src/` — game source (core state, data tables, systems, AI, render, UI, input)
- `tests/` — Vitest suite
- `legacy/` — original prototype (kept as a byte-feel reference for refactors)
- `PHASE_3_ROADMAP.md` — Phase 3 session breakdown
