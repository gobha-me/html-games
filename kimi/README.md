# 🚀 Kimi — Factory Defense

A base-building tower defense game. Mine resources, craft buildings, and defend your core against waves of enemies. Build a rocket silo and launch to win!

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a history of changes.

## 🎮 How to Play

### Objective
Defend your **Core** (center of the map) from waves of enemies by building turrets, barriers, and resource infrastructure. **Build a Rocket Silo and launch to win!**

### Mission Objectives
1. **Protect the Core** at center
2. **Build 4 turrets** to defend your base
3. **Mine resources** for ammo and construction
4. **Survive 5 waves** of enemy attacks
5. **Build Rocket Silo & Launch** to complete the game

### Basic Flow
1. **Mine** — Click resource tiles to mine by hand, or place miners on resource deposits
2. **Smelt** — Build furnaces to convert iron into steel
3. **Craft** — Use assemblers to produce gears, circuits, and ammo, or craft manually
4. **Defend** — Build turrets (with ammo!) and barriers to stop enemies
5. **Win** — Accumulate enough resources to build and launch a rocket silo

### Starting Resources
You begin with: 50 iron, 30 copper, 20 coal, 20 stone, 5 gears, and 30 ammo.

## 🕹️ Controls

| Key | Action |
|-----|--------|
| **1-7** | Select building type (see Buildings table below) |
| **P** | Pause / Resume game |
| **+** / **=** | Zoom in |
| **-** | Zoom out |
| **Mouse Wheel** | Zoom in/out |
| **WASD** | Pan camera |
| **Left-Click** | Place selected building / Mine resource tiles by hand |
| **Right-Click** | Deconstruct building |
| **Middle-Click** / **Ctrl+Left-Click** | Drag camera |
| **F5** | Save game |
| **F9** | Load game |
| **F10** | Reset game |

## 🏗️ Buildings

| Key | Building | Cost | Description |
|-----|----------|------|-------------|
| **1** | Miner | 5 iron | Mines resources automatically. Must be placed on a resource tile. |
| **2** | Furnace | 8 iron, 5 stone | Smelts iron → steel. |
| **3** | Assembler | 10 iron, 5 gears | Crafts ammo, circuits, and gears. Click to configure production type. |
| **4** | Turret | 10 iron, 5 copper, 3 gears | Auto-fires at nearby enemies. **Requires ammo to function!** |
| **5** | Barrier | 2 iron | Blocks enemy path — build walls to funnel enemies. Has 100 HP. |
| **6** | Pumpjack | 15 iron, 10 gears | Extracts oil. Must be placed on an oil tile. |
| **7** | Silo | 100 iron, 50 copper, 50 steel, 100 circuits | Launch the rocket to **WIN!** |

## 🧪 Manual Crafting

Craft resources on-demand from the sidebar (takes time):

| Recipe | Cost | Output |
|--------|------|--------|
| **Gear** | 2 iron | 1 gear |
| **Circuit** | 2 copper, 1 iron | 1 circuit |
| **Ammo** | 2 iron, 1 copper | 1 ammo |

## 📦 Resources

| Resource | How to Obtain |
|----------|---------------|
| **Iron** | Mine iron ore deposits; enemy drops |
| **Copper** | Mine copper ore deposits; enemy drops |
| **Coal** | Mine coal deposits |
| **Stone** | Mine stone deposits |
| **Oil** | Pumpjack on oil deposits |
| **Gear** | Manual craft or Assembler |
| **Circuit** | Manual craft or Assembler |
| **Steel** | Furnace (smelts iron) |
| **Ammo** | Manual craft or Assembler |

## 🌟 Features

- **Fog of War** — Explore and expand to reveal the map; placing buildings reveals surrounding area
- **Wave-Based Enemies** — Enemies spawn in waves; difficulty scales over time
- **Resource Management** — Mine, smelt, and craft to build your base
- **Manual Crafting** — Craft gears, circuits, and ammo on-demand from the sidebar
- **Assembler Configuration** — Click placed assemblers to select production type (ammo, circuits, or gears)
- **Zoom & Pan** — Navigate the grid with WASD panning, mouse wheel, and +/- zoom
- **Save/Load** — Persist your progress with F5/F9
- **Turret Ammo System** — Turrets require ammo to fire; keep your assemblers running!
- **Barrier Walls** — Build walls to funnel enemies into kill zones
- **Achievement System** — Unlock badges for milestones
- **Synthesized Audio** — Sound effects and music without external files
- **Minimap** — Overview of the entire map in the corner

## 🛠️ Technical Details

### Architecture
The game is built with vanilla JavaScript using a modular architecture:

- **constants.js** — Game configuration, building definitions, enemy types, resources
- **game-state.js** — Central game state management
- **world.js** — World/map generation and cell management
- **buildings.js** — Building placement, production logic, resource management
- **enemies.js** — Enemy spawning, pathfinding, combat
- **turrets.js** — Turret targeting and firing logic
- **waves.js** — Wave management and enemy spawning schedules
- **ui.js** — UI rendering, minimap, resource display, messages
- **input.js** — Keyboard, mouse, and zoom controls
- **audio.js** — Synthesized sound effects and music
- **achievements.js** — Achievement tracking and notifications
- **defence.js** — Main entry point and game initialization

### File Structure
```
kimi/
├── defence.html          # Main HTML structure
├── defence.css           # Styles and theme
├── defence.js            # Main entry point
├── audio.js              # Audio system
├── achievements.js       # Achievement system
├── README.md             # This file
└── js/
    ├── constants.js      # Game configuration & definitions
    ├── game-state.js     # State management
    ├── world.js          # World generation
    ├── buildings.js      # Building placement & production
    ├── enemies.js        # Enemy AI & spawning
    ├── turrets.js        # Turret logic
    ├── waves.js          # Wave management
    ├── ui.js             # UI components & minimap
    └── input.js          # Keyboard & mouse controls
```

### No Dependencies
Pure vanilla JavaScript, HTML5, and CSS3 — no external libraries required!

## 💡 Tips

- **Click resource tiles** to mine resources by hand early game
- **Click placed assemblers** to configure what they produce
- **Build barriers** to funnel enemies into turret firing lanes
- **Keep ammo stocked** — turrets are useless without it!
- **Use the minimap** to scout unexplored areas and plan expansion

---

**Enjoy the game! 🚀**


## Status
Playable.

## File layout
- `index.html` — entry point
- `js/main.js` — bootstrap and game initialization
- `js/game.js` — core game loop and state management
- `js/buildings.js` — building definitions and placement logic
- `js/enemies.js` — enemy wave logic and pathfinding
- `js/resources.js` — resource management and production chain
- `js/ui.js` — UI panels, minimap, and controls
- `css/style.css` — styles and theme
