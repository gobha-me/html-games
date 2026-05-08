# ⚙️ The Cogfall — A Steampunk 4X

A turn-based 4X hex strategy game set in a steampunk world. Play as one of five factions competing to rediscover lost technology, expand settlements, and shape the future through exploration, research, diplomacy, and combat.

## How to play

### Objective
Explore the hex map, gather resources (gold, aether, science, culture), build units and structures, research technologies, and achieve victory through domination, scientific advancement, or cultural dominance.

### Controls
- **Click** a hex to select it
- **Click** an adjacent hex to move a selected unit
- **Click** action buttons in the side panel to build, research, or interact
- **End Turn** button to pass to the next faction
- **Tab** through UI elements for keyboard navigation

### Win conditions
- **Domination**: Control the majority of settlements
- **Scientific**: Research the top-tier technology
- **Cultural**: Achieve cultural dominance

## Tech
Vanilla HTML/CSS/JS. Canvas for the hex map rendering, SVG for overlay elements, DOM for UI panels. No build step — open `index.html` in a browser.

## Status
WIP — Phase 3 development in progress. Combat resolution animations, per-faction AI personality variety, and turn-end/tech-unlock animations are planned (see issues #104, #105, #106).

## File layout
- `index.html` — entry point, game shell (top bar, bottom bar, canvas, SVG overlay)
- `src/` — game source code (game logic, AI, rendering, UI)
- `tests/` — test suite
- `legacy/` — legacy code from earlier phases
- `PHASE_3_ROADMAP.md` — detailed Phase 3 session breakdown
