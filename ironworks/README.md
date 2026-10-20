# 🏭 IRONWORKS // CORE — Industrial Logistics & Siege Defense

A spatial **industrial logistics, conveyor automation, and siege tower-defense game** built on a 60fps HTML5 Canvas2D engine with procedural WebAudio synthesis. Rebranded and rebuilt from the ground up to replace the legacy `kimi/` DOM prototype (Issue #11).

---

## 🎮 How to Play

### Objective
Protect the central **2×2 Reactor Core** from escalating waves of mechanized **Siege Crawlers** while expanding your mining & smelting network. Win by either:
1. Constructing the **Orbital Ascension Spire (`[O]`)** and charging it to **100%** (by feeding it refined Steel, Logic Circuits, Plasma Cells, or Aether Shards via Conveyor Belts or Core batch injection), **or**
2. Surviving all **8 Siege Waves** through the *Apocalypse Protocol*.

### Logistics & Conveyor Automation
- **Excavator Drills (`[3]`):** Place directly on **Iron**, **Copper**, **Coal**, or **Aether** veins. Drills extract raw ore every 1.15s and eject physical resource packets onto the tile in front of their output port (`[R]` to rotate).
- **Conveyor Belts (`[1]`) & Splitters (`[2]`):** Left-click and drag across the grid to paint conveyor lines—belts automatically orient along your drag path! Belts feeding into the central **2×2 Reactor Core** deposit items into your global Core Telemetry Stock.
- **Arc Smelters (`[4]`) & Munitions Fabricators (`[5]`):** Refine raw ore into **Iron Ingots**, **Copper Wire**, and **Steel Plates**, and assemble **Slug Magazines**, **Logic Circuits**, **Artillery Shells**, and **Plasma Cells**. Click any placed Smelter or Fabricator to inspect it and switch its active recipe.
- **Turret Ordnance:** **Vulcan Gatlings (`[7]`)**, **Arc Coils (`[8]`)**, **Siege Howitzers (`[9]`)**, and **Hyper-Velocity Railguns (`[0]`)** can be fed directly by Conveyor Belts or auto-draw ammunition from Core Stock.

---

## 🕹️ Controls

| Input | Action |
|---|---|
| **`1` – `0`, `O`** | Select structure from the Construction Palette |
| **`R`** | Rotate output direction of Drills, Belts, Splitters, Smelters, and Fabricators |
| **`Left-Click / Drag`** | Place selected structure (smart-orients Conveyor Belts as you drag) / Inspect placed machine / Hand-mine ore veins |
| **`Right-Click / Drag`** | Deconstruct structure (refunds 75% of build cost) |
| **`Space`** | Trigger **⚡ Core Overdrive** (shockwave damages nearby crawlers + 1.85× factory & turret speed for 8s) |
| **`WASD` / `Arrow Keys`** | Pan camera across the 48×48 sector |
| **`Shift + Left-Drag` / `Middle-Drag`** | Drag camera |
| **`Mouse Wheel`** | Zoom in / out (`0.45×` – `2.2×`) |
| **`P`** | Pause / Resume simulation |
| **`F5` / `F9`** | Save / Load factory blueprint (`localStorage`) |

---

## 📁 File Layout

```text
ironworks/
├── index.html          # App shell, telemetry top bar, sidebar palette, canvas viewport
├── README.md           # Documentation
├── CHANGELOG.md        # Shipped milestone log
├── css/
│   └── style.css       # Industrial slate & amber/cyan telemetry styling
└── js/
    ├── main.js         # Bootstrap, smart belt drag-painting, inspector UI, 60fps loop
    ├── config.js       # Resources, recipes, 11 building defs, 5 crawler types, 8 waves
    ├── sim.js          # Spatial logistics, BFS flow-field pathfinding, ballistics, save/load
    ├── renderer.js     # 60fps Canvas2D world renderer, belt packet animation, minimap
    └── audio.js        # Procedural WebAudio industrial synthesizer
```
