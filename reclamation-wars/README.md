# Reclamation Wars

A Post-Collapse 4X Hex Strategy Game.

The Collapse shattered civilization. Now five factions race to rediscover lost technology, rebuild settlements, and shape the future of a broken world.

## How to Play

1. Click **Play Now** on the game card
2. Choose your faction, map size, and number of factions
3. Click **Begin Reclamation** to start
4. On each turn, select hexes, move units, build units/buildings, and research technologies
5. Click **End Turn** when you're done

## Keyboard Controls

All core game actions can be performed with the keyboard.

### Setup Screen

| Key | Action |
|-----|--------|
| `←` / `A` | Move to previous faction |
| `→` / `D` | Move to next faction |
| `↑` / `W` | Focus map configuration options |
| `↓` / `S` | Focus the "Begin Reclamation" button |
| `Enter` / `Space` | Select faction / Start game |
| `Escape` | Deselect current faction |

### Game Screen

| Key | Action |
|-----|--------|
| `←` / `A` | Move selection to adjacent hex (left) |
| `→` / `D` | Move selection to adjacent hex (right) |
| `↑` / `W` | Move selection to adjacent hex (up) |
| `↓` / `S` | Move selection to adjacent hex (down) |
| `Shift` + Arrow/WASD | Pan the camera view |
| `Enter` / `Space` | Select unit on hex / Move selected unit to hex |
| `Escape` | Deselect unit, then deselect hex |
| `E` | End turn |
| `T` | Cycle through side panel tabs (Info → Research → Production → Diplomacy) |
| `H` | Center camera on selected hex |
| `1`–`9` | Quick-build units/buildings (when Production tab is active) |

### Tab Navigation

All UI buttons and interactive elements are reachable via the `Tab` key. A visible focus ring (cyan outline) indicates the currently focused element.

## Victory Conditions

- **Domination**: Control 60% of all settlements
- **Scientific**: Research the Ascension Protocol
- **Cultural**: Maintain the Ark Project for 5 consecutive turns

## Factions

- **Ironclad Syndicate** — Militaristic, strong combat bonuses
- **Neon Collective** — Technological, research advantages
- **Greenwardens** — Ecological, resource generation bonuses
- **Dust Runners** — Nomadic, movement and scouting advantages
- **Arcane Engineers** — Mystical, building and defense bonuses


## Status
Playable.

## File layout

### Core
- `index.html` — entry point + game-card / setup / game / victory screens
- `js/main.js` — boot: instantiate Game, GameUI, KeyboardInput, SetupScreen
- `js/constants.js` — PHASES, WIN_CONDITIONS, RESEARCH_TREE, UNIT_TYPES, BUILDING_TYPES, AI_PERSONALITIES
- `js/game.js` — turn loop, win-condition checks, message log

### Map & geometry
- `js/hex.js` — hex coordinate math (axial ↔ pixel)
- `js/map.js` — HexGrid, settlement placement, pathfinding

### Game systems
- `js/factions.js` — Faction class, diplomacy state
- `js/units.js` — Unit class, combat resolution
- `js/buildings.js` — Building registry, construction rules
- `js/research.js` — research tree progression
- `js/resources.js` — resource collection
- `js/ai.js` — AI controller (read after factions/units, drives non-player turns)

### UI (split because `ui.js` got too large — see PR #166)
- `js/ui.js` — top-level GameUI shell, orchestrates updates
- `js/ui-map.js` — SVG hex rendering
- `js/ui-input.js` — mouse handlers (click / drag / wheel zoom) for the SVG map
- `js/ui-panels.js` — side panel content (info / research / production / diplomacy)
- `js/ui-status.js` — top bar, win-condition HUD, message log

### Input
- `js/keyboard.js` — global keyboard shortcuts (see Keyboard Controls above)
- `js/setup.js` — landing card / setup-screen / faction selection

### Style
- `css/style.css` — all styles

## Technical Notes

- Built with vanilla JavaScript, SVG for the hex map, and DOM for UI
- No external dependencies — runs in any modern browser
- Keyboard controls use `keydown` events with `preventDefault()` to avoid scrolling
- Focus styles use `:focus-visible` for clean mouse vs. keyboard distinction