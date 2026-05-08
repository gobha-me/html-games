# Forge Defense

A factory-building tower defense game. Build miners, furnaces, and factories to produce resources, then defend your base with turrets against waves of enemies.

## How to Play

1. Open `index.html` in a web browser
2. Build furnaces (just stone!) to smelt ore into plates
3. Build miners near resource deposits (iron, copper, coal, stone)
4. Build ammo factories and turrets to defend against waves
5. Survive as long as you can!

## Controls

| Key | Action |
|-----|--------|
| **1-9** | Select building type |
| **R** | Rotate building |
| **Q / Escape** | Cancel placement |
| **Right-Click** | Delete building (50% refund) |
| **WASD** | Pan camera |
| **Click** | Place building / Select |
| **Drag** | Move camera |
| **Shift+Click** | Multi-place buildings |
| **F5** | Quick save |
| **F9** | Quick load |

## Supply Chain (KISS)

```
Tier 1 (Raw Resources):
  └─ Miner (10 iron-ore + 5 stone) → extracts ore
  └─ Furnace (10 stone) → smelts ore to plates
  └─ Wall (3 stone) → blocks enemies

Tier 2 (Plates):
  └─ Turret (15 iron + 5 copper plates)
  └─ Ammo Factory (20 iron + 10 copper plates)
  └─ Circuit Plant (15 iron + 15 copper plates)

Tier 3 (Circuits):
  └─ Laser Turret (30 iron plates + 20 circuits)
  └─ Artillery (50 iron plates + 30 circuits)
  └─ Shell Factory (25 iron plates + 10 circuits)
```

## Features

- **Fog of War** - Explore and expand to reveal the map
- **Guaranteed Starting Resources** - One of each resource type spawns near base
- **Balanced Wave Scaling** - Enemies scale slowly: +8% health, +5% damage, +2% speed per wave
- **Achievement System** - Unlock badges for milestones
- **Synthesized Audio** - Sound effects without external files
- **Building Deletion** - Right-click to salvage buildings (50% refund)
- **Auto-save** - Game saves to localStorage


## Status
Playable.

## File layout
- `index.html` — entry point
- `js/main.js` — bootstrap and game initialization
- `js/game.js` — core game loop and state
- `js/buildings.js` — building definitions and logic
- `js/enemies.js` — enemy wave logic
- `js/resources.js` — resource management
- `js/ui.js` — UI components and interactions
- `css/style.css` — styles and theme

## Resource Colors

- **Iron** - Blue-steel color (clearly different from stone)
- **Copper** - Orange
- **Coal** - Dark gray/black
- **Stone** - Light gray/white

---

Built with vanilla HTML, CSS, and JavaScript. No dependencies required.
