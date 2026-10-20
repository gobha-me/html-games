# Changelog — IRONWORKS // CORE

## [1.0.0] — 2026-10-20 — Full Rewrite & Rebrand (`kimi/` → `ironworks/`, Issue #11)
- **Rebrand & Architecture:** Replaced the legacy `kimi/` DOM-table clicker with **IRONWORKS // CORE** (`ironworks/`), a 60fps Canvas2D spatial logistics and siege defense game.
- **Physical Conveyor & Machine Logistics (`js/sim.js`, `js/renderer.js`):**
  - Implemented directional **Conveyor Belts** with smart drag-orientation, **Round-Robin Splitters**, **Excavator Drills**, **Arc Smelters**, and **Munitions Fabricators**.
  - Physical resource packets (`Iron Ore`, `Copper Ore`, `Coal`, `Aether Shards`, `Iron Ingots`, `Copper Wire`, `Steel Plates`, `Logic Circuits`, `Slug Magazines`, `Artillery Shells`, `Plasma Cells`) visibly ride belts into machines, turrets, or the central 2×2 Reactor Core.
- **BFS Flow-Field Pathfinding & Siege Combat:**
  - Implemented a 48×48 BFS distance field around the 2×2 Reactor Core so 5 hostile crawler classes (*Slag Skitter*, *Ironclad Crawler*, *Acid Spitter*, *Magma Breacher*, *Foundry Behemoth*) route around **Ferrocrete Bulkheads** and chew through choke points.
  - Added 4 distinct defense turrets (*Vulcan Gatling*, *Arc Coil* chain-lightning, *Siege Howitzer* splash mortar, *Hyper-Velocity Railgun* piercing beam) plus the **⚡ Core Overdrive** shockwave ability (`Space`) and **Orbital Ascension Spire** win condition.
- **Procedural Industrial WebAudio (`js/audio.js`):**
  - Added zero-dependency synthesized audio for belt placement, hand-mining, smelting, gatling bursts, arc discharges, artillery shells, railgun beams, and wave alarms.
