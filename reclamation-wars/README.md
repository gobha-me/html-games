# Reclamation Wars

A Post-Collapse 4X Hex Strategy Game.

The Collapse shattered civilization. Now five factions race to rediscover lost technology,
rebuild settlements, and shape the future of a broken world. Every choice matters — will you
conquer by force, out-research the competition, or inspire humanity with a monument to hope?

## Status

**Playable.** All three victory paths work end-to-end. No known blockers.

---

## How to Play

1. Click **Play Now** on the game card
2. Choose your **faction**, **map size** (Small / Medium / Large), and **number of AI opponents** (2–5)
3. Click **Begin Reclamation** to start
4. Each turn: select units, move them, attack enemies, build units/buildings, and queue research
5. Click **End Turn** (or press `E`) when you're done — AI factions then take their turns
6. First faction to meet a [victory condition](#victory-conditions) wins

---

## Controls

### Mouse

| Action | How |
|--------|-----|
| Select a hex / unit | Left-click on the hex |
| Move selected unit | Left-click a destination hex |
| Attack enemy unit | Select your unit, then left-click an enemy in range |
| Pan the map | Middle-click + drag **or** Shift + left-click + drag |
| Zoom in / out | Scroll wheel |

### Keyboard — Setup Screen

| Key | Action |
|-----|--------|
| `←` / `A` | Previous faction |
| `→` / `D` | Next faction |
| `↑` / `W` | Focus map-size options |
| `↓` / `S` | Focus **Begin Reclamation** button |
| `Enter` / `Space` | Select faction / start game |
| `Escape` | Deselect faction |

### Keyboard — Game Screen

| Key | Action |
|-----|--------|
| `←` / `A` | Move selection to adjacent hex (left) |
| `→` / `D` | Move selection to adjacent hex (right) |
| `↑` / `W` | Move selection to adjacent hex (up) |
| `↓` / `S` | Move selection to adjacent hex (down) |
| `Shift` + Arrow/WASD | Pan the camera |
| `Enter` / `Space` | Select unit on hex / move selected unit here |
| `Escape` | Deselect unit → deselect hex |
| `E` | End Turn |
| `T` | Cycle side-panel tabs (Info → Research → Production → Diplomacy) |
| `H` | Centre camera on selected hex |
| `1`–`9` | Quick-build (when Production tab is active) |

All interactive elements are reachable via `Tab`; a cyan outline marks the focused element.

---

## Factions

Choose your faction at the start — each has a unique playstyle, starting techs, and AI personality
when controlled by the computer.

| Faction | Colour | Playstyle | Bonus | Starting Techs |
|---------|--------|-----------|-------|----------------|
| **Ironclad Syndicate** | 🔴 Red | Militarist | +25% production, units cost less scrap | Advanced Metallurgy, Ballistics |
| **Neon Collective** | 🔵 Cyan | Technologist | +25% research speed, +1 Data per turn | Data Synthesis, Neural Networks |
| **Greenwardens** | 🟢 Green | Ecological | +50% food production, forest defense bonus | Bio Engineering, Sustainable Agriculture |
| **Dust Runners** | 🟡 Gold | Nomad | +50% resource yield from ruins, faster movement | Salvage Expertise, Scout Enhancement |
| **Arcane Engineers** | 🟣 Purple | Energy | +25% energy production, +2 Energy per turn | Energy Manipulation, Force Fields |

**AI personalities** (when you play against them):
- Ironclad → **Aggressive** — high attack weight, frequently declares war
- Neon Collective → **Expansionist** — spreads quickly, prioritises research
- Greenwardens → **Defensive** — turtles behind fortifications, rarely attacks first
- Dust Runners → **Opportunistic** — picks off weakened targets, raids ruins
- Arcane Engineers → **Balanced** — well-rounded, adapts to the situation

---

## Resources

Collected automatically at the start of each turn from settlements and buildings.

| Resource | Icon | Primary Source | Used For |
|----------|------|----------------|----------|
| Scrap | 🔩 | Workshops, outposts | Building units and structures |
| Energy | ⚡ | Generators | Advanced units, buildings, late-game techs |
| Data Cores | 💾 | Data Vaults, ruins | Research costs |
| Food | 🍖 | Farms, outposts | Infantry upkeep, bio-tech research |
| Population | 👥 | Starting value | Faction capacity (display only) |

Ruins tiles grant a one-time scrap/energy bonus when a unit moves onto them. Dust Runners
get double yield; Advanced Salvage tech doubles it again.

---

## Terrain

Each terrain type affects **movement cost** and **combat defense bonus** for units on it.

| Terrain | Icon | Move Cost | Defense | Notes |
|---------|------|-----------|---------|-------|
| Plains | 🌾 | 1 | 0 | Default open land |
| Forest | 🌲 | 2 | +2 | Greenwardens gain extra +2 defense here |
| Mountain | ⛰️ | 3 | +3 | Impassable to units that lack moves |
| Desert | 🏜️ | 1 | 0 | Fast but exposed |
| Swamp | 🌿 | 2 | +1 | Slows movement |
| Ancient Ruins | 🏛️ | 1 | +1 | Bonus resources on first visit |
| Water | 🌊 | — | — | Impassable |
| Wasteland | ☢️ | 1 | 0 | Can be converted by Terraforming tech |

---

## Units

Units are built at your settlements. Tech requirements must be researched first.

| Unit | Icon | Attack | Defense | HP | Move | Range | Cost | Requires |
|------|------|--------|---------|----|----|-------|------|----------|
| Scout | 🔍 | 1 | 1 | 3 | 3 | 1 | 2 Scrap | — |
| Infantry | 🔫 | 2 | 2 | 5 | 2 | 1 | 3 Scrap, 1 Food | — |
| Rifleman | 🎯 | 3 | 1 | 4 | 2 | **2** | 4 Scrap, 1 Data | Ballistics |
| Technician | 🔧 | 0 | 1 | 3 | 2 | — | 2 Scrap, 2 Data | — |
| Tank | 🛡️ | 5 | 4 | 10 | 2 | 1 | 8 Scrap, 3 Energy | Mechanized Warfare |
| Mech | 🤖 | 7 | 5 | 15 | 3 | 1 | 12 Scrap, 6 Energy, 4 Data | Robotics |

**Technicians** don't fight but speed up research (+0.5 research points/turn each) and can
repair buildings. **Dust Runners** get +1 movement on all their units for free.

---

## Combat

When you move a unit onto an enemy-occupied hex, or click an enemy in range, combat resolves
immediately:

1. **Attack roll**: `attacker.attack × random(0.8–1.2)` — Advanced Metallurgy adds +1 attack
2. **Defense roll**: `(terrain.defense + unit.defense) × random(0.8–1.2)`
3. **Damage dealt**: `max(1, floor(attackRoll − defenseRoll × 0.5))`
4. **Counter-attack**: if the defender survives *and* is adjacent (range 1), they hit back for
   `floor((defender.attack − attacker.defense×0.5) × random(0.5–1.0))`

Units reduced to 0 HP are removed from the map. Surviving units heal **+1 HP per turn**
(+2 with the Medicine tech) at the start of your next turn.

---

## Settlements

Settlements are the backbone of your economy — they produce resources and are where units
and buildings are constructed.

- Each faction **starts with one settlement** at a spawn point
- **Establish a new settlement**: costs **5 Scrap**, requires a unit within 1 hex, and the
  hex must not be Water or Mountain
- Settlements can only be **captured** by moving a unit onto a hex — the settlement
  ownership flips to the attacking faction when their unit occupies it

---

## Buildings

Buildings are constructed inside settlements and produce resources each turn.

| Building | Icon | Cost | Produces | Requires |
|----------|------|------|----------|----------|
| Outpost | 🏕️ | 5 Scrap | +1 Scrap, +1 Food / turn | — |
| Workshop | 🔨 | 8 Scrap, 2 Energy | +2 Scrap / turn | Advanced Metallurgy |
| Generator | ⚡ | 6 Scrap, 1 Energy | +2 Energy / turn | — |
| Data Vault | 🗄️ | 6 Scrap, 3 Data | +2 Data / turn | Data Synthesis |
| Farm | 🌾 | 4 Scrap, 2 Food | +2 Food / turn | — |
| Research Lab | 🔬 | 10 Scrap, 5 Data, 3 Energy | +1 Research Point / turn | Neural Networks |
| Fortress | 🏰 | 15 Scrap, 5 Energy | +3 Defense, +1 Scrap / turn | Mechanized Warfare |

Each settlement can hold one of each building type.

---

## Research

Research advances your faction's technology and unlocks new units, buildings, and effects.

- **One technology at a time** — queue the next in the Research tab
- **Cost**: paid in Data Cores (sometimes Scrap, Energy, or Food) when you start research
- **Progress**: base 1 point/turn + 1 per Research Lab + 0.5 per Technician unit
- **Discounts**: Neural Networks (−1 Data on all techs) → Quantum Computing (halves all costs)
- The tree has **4 tiers** across 23 technologies; higher tiers require multiple prerequisites

### Research Tree Overview

```
Tier 1 (starter)      Tier 2 (mid-game)         Tier 3 (late-game)    Tier 4 (victory)
──────────────────    ──────────────────────    ──────────────────    ─────────────────
Advanced Metallurgy ──┬─► Mechanized Warfare ──┬─► Robotics ──────────► Orbital Strike *
Ballistics ───────────┘                        │                        
                                               └─► (+ Automated)       
Data Synthesis ───────► Communications ────────► Quantum Computing ───► Ascension Protocol **
Neural Networks ──────► (+ Quantum Computing)  │
                                               └─► Ark Project ***
Energy Manipulation ──► Power Grid ────────────► Fusion Power ────────► (Orbital / Ascension)
Force Fields ─────────► (see Tier 2)           
Bio Engineering ──────► Medicine ──────────────► Terraforming ────────► Ark Project ***
Sustainable Agriculture ► (+ Terraforming)     
Salvage Expertise ────► Advanced Salvage        
Scout Enhancement ────► (standalone)           
Automated Production ─► (+ Robotics)           
```
`*` Domination path  `**` Scientific path  `***` Cultural path

---

## Victory Conditions

Three paths to victory — the first faction to satisfy any condition wins.

### ⚔️ Domination
Control **60% of all settlements** on the map (or eliminate every other faction's units
and settlements entirely).

*Tips*: Ironclad's production discount and Ballistics/Mechanized Warfare unlock line up well
for an early rush. Target clusters of neutral settlements before rivals settle them.

### 🧬 Scientific
Research the **Ascension Protocol** (Tier 4) *and* build the **Ascension Matrix** building in
one of your settlements.

*Path*: Data Synthesis → Communications → Neural Networks → Quantum Computing + Fusion Power
→ Ascension Protocol → build Ascension Matrix.
Neon Collective starts closest to this path.

### 🏛️ Cultural
Build the **Ark Beacon** (requires Ark Project tech) in a settlement, then **hold it for
5 consecutive turns** without losing the settlement.

*Path*: Terraforming + Quantum Computing → Ark Project → build Ark Beacon → defend for 5 turns.
Beacon turns reset to 0 if the settlement is captured.

---

## Diplomacy

All factions start **Neutral**. Diplomacy states affect AI aggression levels.

| State | Colour | Hostility |
|-------|--------|-----------|
| Allied | 🟢 Green | 0% |
| Friendly | 🟩 Lime | 20% |
| Neutral | 🟡 Yellow | 50% |
| Hostile | 🟠 Orange | 80% |
| At War | 🔴 Red | 100% |

Wars can expire naturally after several turns (20% chance per turn once the timer runs down),
resulting in an automatic peace treaty. The Diplomacy tab lets you view current standings.

---

## Known Issues

- No save/load — refreshing the page starts a new game
- Population resource is tracked but not actively used as a mechanic yet (reserved for a future
  update)
- AI opponents never initiate diplomacy or propose alliances (they react but don't proactively
  negotiate)

---

## File Layout

### Entry point
- `index.html` — game-card → setup screen → game screen → victory screen

### Core
- `js/main.js` — boot: instantiate `Game`, `GameUI`, `KeyboardInput`, `SetupScreen`
- `js/constants.js` — all data tables: `TERRAIN`, `FACTIONS`, `RESEARCH_TREE`, `UNIT_TYPES`,
  `BUILDINGS`, `WIN_CONDITIONS`, `AI_PERSONALITIES`, `DIPLOMACY_STATES`
- `js/game.js` — turn loop, player actions, win-condition checks, message log

### Map & Geometry
- `js/hex.js` — hex coordinate math (axial ↔ pixel, distance, pathfinding neighbours)
- `js/map.js` — `HexGrid`, terrain generation, settlement placement, A\* pathfinding

### Game Systems
- `js/factions.js` — `Faction` class, diplomacy state machine, research queue, resource wallet
- `js/units.js` — `Unit` + `UnitManager`; combat resolution formula lives here
- `js/buildings.js` — `BuildingManager`; construction rules, victory-building detection
- `js/research.js` — `ResearchSystem`; progress ticks, lab/technician bonuses, tree queries
- `js/resources.js` — per-turn resource collection from settlements and terrain
- `js/ai.js` — `AIController`; drives non-player turns (read after factions/units)

### UI (split when `ui.js` grew too large — see PR #166)
- `js/ui.js` — top-level `GameUI` shell, orchestrates all panel updates
- `js/ui-map.js` — SVG hex rendering, highlight overlays, camera transform
- `js/ui-input.js` — mouse handlers: click/drag/wheel zoom on the SVG map
- `js/ui-panels.js` — side panel content (Info / Research / Production / Diplomacy tabs)
- `js/ui-status.js` — top bar, win-condition HUD, message log

### Input
- `js/keyboard.js` — global keyboard shortcuts (see [Controls](#controls) above)
- `js/setup.js` — game-card, setup screen, faction selection, Play Again reset

### Style
- `css/style.css` — all styles

---

## Technical Notes

- Pure vanilla JavaScript — no frameworks, no build step; open `index.html` in any modern browser
- SVG for the hex map; DOM for all UI panels
- Keyboard handling uses `keydown` with `preventDefault()` to suppress browser scroll
- Focus styles use `:focus-visible` for clean mouse vs. keyboard distinction
- AI turns execute sequentially with 100 ms delays to keep the UI responsive

---

*Part of the [HTML-Games](../) collection.*
