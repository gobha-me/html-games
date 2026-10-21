# DEAD DISTRICT // SECTOR 7

**Redline Quarantine Crossroads · Bio-Containment Ops** — A full-bleed top-down 2.5D survival-horror tactical shooter featuring a `1600×1200` 4-building urban crossroads, real-time 2D raycast shadow-casting flashlight beam, 4 abandoned street vehicles (`PD-Cruiser 04`, `EMS Ambulance 12`, `Metro Taxi 718`, `SWAT Bearcat 01`) with aligned dynamic headlight cones (intact, flickering/damaged, and broken bulbs) plus emergency roof strobes, distance + illumination-modulated zombie visibility, 8 destructible/repairable safe-room doorway barricades, a 5-weapon firearm arsenal with visual brass shell counters, deployable 360° Aegis Auto-Turrets, and a slide-over Safe-Room Armory Workbench (`[B]` / `[TAB]`).

## How to Play

1. **Light Is Survival (`Mouse` Aim + `[L]` Beam Mode):**
   - Infected outside your raycast flashlight cone and away from street vehicle headlights blend into the dark (`alpha ~3.5%`).
   - Watch for **glinting eyes** in the twilight penumbra and **acoustic footstep ripples** in deep darkness, or fight near the beams of the 4 street vehicles (`PD-Cruiser 04` north xenon beams, `EMS Ambulance 12` south halogen + sputtering damaged right bulb + rotating beacon, `Metro Taxi 718` west single amber beam, and `SWAT Bearcat 01` east twin floodlights).
   - Press `[L]` to cycle your flashlight between **Wide Flood**, **Focused Spot**, and **Stealth Off**.
2. **Move, Roll & Hold the 4 Safe-Rooms (`WASD` / `Arrows`, `Space` Roll, `[F]` Fortify):**
   - Navigate the central Evacuation Plaza or retreat inside the 4 corner safe-room buildings (*St. Jude Pharmacy*, *Precinct 7 Armory*, *Redline Auto Garage*, *Blackout Diner*).
   - Press `Space` for an evasive combat roll dash. Press `[F]` near any of the 8 safe-room doorway barricades to reinforce them.
3. **Firearm Arsenal & Reloads (`[1]–[5]` or Mouse Wheel, `[R]` Reload):**
   - `[1] M9 TACTICAL` — `9mm` sidearm with unlimited reserve ammunition.
   - `[2] REMINGTON 870` — `12-Gauge` 7-pellet pump buckshot with heavy stopping power.
   - `[3] MP5-K PDW` — High-RPM `9mm Subsonic` personal defense weapon (`$120`).
   - `[4] FN-FAL 7.62 AP` — Armor-piercing battle rifle that punches through 3 targets and ignores Riot Juggernaut shields (`$220`).
   - `[5] M79 THERMITE` — `40mm` incendiary launcher that ignites persistent thermite fire pools (`$300`).
4. **Safe-Room Armory Workbench (`[B]` or `[TAB]`):**
   - Press `[B]` or `[TAB]` at any time (auto-pauses combat while open) to access the **Precinct 7 Tactical Armory Workbench** and spend `$SCRAP` on weapons, ammo crates, Kevlar plates, **Thermite Molotovs (`[G]`)**, **Aegis Auto-Turrets (`[T]`)**, **Med-Stims (`[H]`)**, and Operator Perks.

## Infected Threat Dossier

| Class | Archetype | Behavior |
|---|---|---|
| **I** | **Shambler** | Relentless street horde; hides in unlit alleys and claws down safe-room barricades. |
| **II** | **Feral Sprinter** | High-speed hunter; watch for rapid crimson footstep ripples and eye glints in the dark. |
| **III** | **Bile Spitter** | Lobs ranged bioluminescent globules that leave corrosive acid pools. |
| **IV** | **Riot Juggernaut** | Front ballistic shield resists standard rounds; weak to `7.62 AP` & thermite fire. |
| **V** | **Necro Screamer** | Emits violet sonic shockwaves that drive nearby infected into a speed frenzy. |

## Tech Stack

- **Vanilla ES Modules + HTML5 Canvas2D** (Zero external runtime dependencies)
- **Simulation (`js/sim.js`):** Circle-vs-AABB sliding collision solver, standby-until-first-input onboarding, barricade breach/repair mechanics, armor-piercing & incendiary ballistics, sentry turret AI, and wave requisition economy.
- **Renderer (`js/renderer.js`):** 2D raycast shadow-casting flashlight + aligned vehicle headlight cones, per-entity `computeIlluminationAt()` light+distance visibility solver, emergency roof lightbar strobes, and circular **Acoustic Motion Tracker** scope (`#minimap-canvas`).
- **Audio (`js/audio.js`):** Procedural WebAudio synthesizer for firearm reports, reload clicks, thermite explosions, and screamer shockwaves.

## File Layout

```text
dead-district/
├── index.html        # Full-bleed survival-horror HUD (Bio-Cam ECG, Acoustic Scope, Brass Shell Counter, [B] Workbench)
├── css/
│   └── style.css     # Full-bleed 100vw x 100vh diegetic visor & armory workbench styling
├── assets/
│   └── sprites/      # Top-down pixel-art operator, 5 infected types, turret & 4 street vehicles
├── js/
│   ├── config.js     # 1600x1200 crossroads map, 4 vehicles with aligned light sockets, 8 barricades, 5 weapons
│   ├── audio.js      # Procedural WebAudio firearm & horror synthesizer
│   ├── sim.js        # Tactical survival-horror simulation & wave requisition engine
│   ├── renderer.js   # 2.5D urban renderer, aligned vehicle lighting, light-distance visibility & acoustic radar
│   └── main.js       # Input controller, live ECG waveform, brass ammo pips & Armory Workbench drawer
├── README.md
└── CHANGELOG.md
```
