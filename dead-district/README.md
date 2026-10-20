# DEAD DISTRICT // SECTOR 7

**Redline Quarantine Crossroads · Bio-Containment Ops** — A top-down 2.5D survival-horror tactical shooter featuring a 4-building urban crossroads (`1600×1200`), real-time 2D raycast shadow-casting flashlight beam, 8 destructible/repairable safe-room doorway barricades, a 5-weapon firearm arsenal with reload mechanics, deployable 360° Aegis Auto-Turrets, thermite Molotovs, and 5 distinct infected archetypes.

## How to Play

1. **Move & Dash (`WASD` / `Arrows` + `Space`):** Navigate the central Evacuation Plaza or retreat inside the 4 corner safe-room buildings (*St. Jude Pharmacy*, *Precinct 7 Armory*, *Redline Auto Garage*, *Blackout Diner*). Press `Space` for an evasive combat roll dash.
2. **Aim Flashlight & Fire (`Mouse` + `Left Click`, `[L]` Beam Toggle):** Your tactical flashlight casts real 2D raycast shadows behind building walls and wrecked vehicles. Toggle between **Spot Beam** (long range) and **Flood Beam** (wide angle) with `[L]`. Unseen infected in the dark emit subtle bio-sonar acoustic rings.
3. **Firearm Arsenal & Reloads (`[1]–[5]` or Mouse Wheel, `[R]` Reload):**
   - `[1] M9 TACTICAL` — `9mm` sidearm with unlimited reserve ammunition.
   - `[2] REMINGTON 870` — `12-Gauge` 7-pellet pump buckshot with heavy stopping power.
   - `[3] MP5-K PDW` — High-RPM `9mm Subsonic` personal defense weapon (`$120`).
   - `[4] FN-FAL 7.62 AP` — Armor-piercing battle rifle that punches through 3 targets and ignores Riot Juggernaut shields (`$220`).
   - `[5] M79 THERMITE` — `40mm` incendiary launcher that ignites persistent thermite fire pools (`$300`).
4. **Barricades & Deployables (`[F]` Fortify, `[G]` Molotov, `[T]` Sentry Turret, `[H]` Med-Stim):**
   - Infected claw through the 8 safe-room doorway barricades to breach buildings; press `[F]` near a doorway (or spend `$35` remotely) to reinforce them.
   - Press `[G]` to hurl a **Thermite Molotov** (`6.5s` fire pool) or `[T]` to deploy an **Aegis 360° Auto-Turret** (`140` rounds).

## Infected Threat Dossier

| Class | Archetype | Behavior |
|---|---|---|
| **I** | **Shambler** | Relentless street horde; claws down safe-room barricades. |
| **II** | **Feral Sprinter** | High-speed flanker that rushes through alleyways. |
| **III** | **Bile Spitter** | Lobs ranged toxic globules that leave corrosive acid pools. |
| **IV** | **Riot Juggernaut** | Front ballistic shield resists standard rounds; weak to `7.62 AP` & fire. |
| **V** | **Necro Screamer** | Emits sonic shockwaves that drive nearby infected into a speed frenzy. |

## Tech Stack

- **Vanilla ES Modules + HTML5 Canvas2D** (Zero external dependencies or static binary bloat)
- **Simulation (`js/sim.js`):** Circle-vs-AABB sliding collision solver, barricade breach/repair mechanics, armor-piercing & incendiary ballistics, sentry turret AI, and wave requisition economy.
- **Renderer (`js/renderer.js`):** 64-ray 2D shadow-casting flashlight engine, flickering streetlamp & fire illumination, bio-sonar rings, and live `1600×1200` Sector Bio-Radar minimap (`#minimap-canvas`).
- **Audio (`js/audio.js`):** Procedural WebAudio synthesizer for distinct firearm reports, reload clicks, thermite explosions, and screamer shockwaves.

## File Layout

```text
dead-district/
├── index.html        # 3-column tactical command HUD (Bio-Telemetry/Radar, Urban Viewport, Arsenal/Armory)
├── css/
│   └── style.css     # Responsive 1440x900 / 1280x800 dark bio-containment styling
├── js/
│   ├── config.js     # 1600x1200 crossroads map, 4 buildings, 8 barricades, 5 weapons, 5 infected types
│   ├── audio.js      # Procedural WebAudio firearm & horror synthesizer
│   ├── sim.js        # Tactical survival-horror simulation & wave requisition engine
│   ├── renderer.js   # 2.5D urban renderer, 2D raycast shadow layer & radar minimap
│   └── main.js       # Input controller, HUD telemetry sync & localStorage high score
├── README.md
└── CHANGELOG.md
```
