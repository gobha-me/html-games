# IRONWAKE // CONVOY

**2.5D Tactical Armored-Train & Wasteland Convoy Defense** — Command the 5-car steam-diesel dreadnought train *Ironwake* roaring across a scorched salt flat. Route live reactor steam pressure between weapons, Aegis void shields, locomotive thrust, and hull-welding repair drones, target enemy war-rig subsystems, sever steel harpoon tethers, and break through the Goliath Canyon Siege Crawler.

## How to Play

- **Focus Fire & Subsystem Targeting**:
  - **Left-Click** any enemy Raider Sand-Skiff, Harpoon War-Rig, Valkyrie Gyrocopter, or Siege Crawler on the desert battlefield to lock all railcar turrets onto it.
  - Press **`[Z]`**, **`[X]`**, or **`[C]`** (or click the **Target Subsystem Scanner** on the left wing) to focus fire on:
    - **`[Z]` Turret Mount (`WPN`)** — Cripples enemy weapon fire rate by `55%`.
    - **`[X]` Drive Engine (`ENG`)** — Slows raider speed by `55%`.
    - **`[C]` Harpoon Winch (`HARP`)** — Destroys the rig's harpoon launcher and immediately snaps any latched cable.
- **Steam Reactor Power Manifold (`10` Total Bars)**:
  - Click **`−` / `+`** or choose a quick preset (**`BALANCED`**, **`BARRAGE`**, **`FORTRESS`**, **`THROTTLE`**) to route steam between:
    - **Weapons Overclock** (Turret fire rate & projectile velocity)
    - **Aegis Void Shield** (Elliptical energy shield recharge rate)
    - **Locomotive Thrust** (Train cruising speed `50–115 MPH` & harpoon drag resistance)
    - **Repair Drones & Vents** (Continuous railcar hull welding & boiler cooling)
- **Tactical Commander Orders**:
  - **`[Q]` Sever Harpoons & Flak Burst (`35 ⚙`)** — Snaps all latched harpoon cables and detonates 88mm shrapnel across all raiders.
  - **`[W]` Thermal Steam Vent Purge (`FREE`)** — Vents `-45%` boiler heat and surges `+55` Aegis Void Shield.
  - **`[E]` / `[SPACE]` Overdrive Turret Barrage (`55 ⚙`)** — Overclocks all 5 railcar turrets to `1.55×` cyclic rate for `7.0s`.
- **Modular 5-Car Dreadnought Consist (`[1]`–`[5]` & `[U]` Upgrade)**:
  - Select any railcar (`Ironwake MK-IV Engine`, `Vulcan-8 Rotary Car`, `Skyburst 88mm Flak`, `Hellfire Siege Car`, `Bulwark Caboose`) and press **`[U]`** to upgrade its weapon & armor MK tier (`+22%` damage, `+40` max hull, `+75` hull repair).

## Tech Stack & File Layout

- Self-contained Vanilla ES Modules + HTML5 2D Canvas + WebAudio Dieselpunk Synthesizer + Custom 16-bit Pixel-Art Sprites (`ironwake/assets/sprites/*.png`).

```text
ironwake/
├── index.html          # 3-column Dreadnought Bridge, Steam Manifold & Consist HUD
├── css/
│   └── style.css       # Dieselpunk gunmetal, copper & boiler-amber responsive layout
├── js/
│   ├── main.js         # Input controller, HUD bindings & showcase state
│   ├── sim.js          # Deterministic 5-car train, steam routing, harpoons & subsystem sim
│   ├── renderer.js     # 2.5D scrolling salt flat, track crossties, Aegis dome & sprites
│   ├── config.js       # Railcar templates, steam manifold, enemy archetypes & sectors
│   └── audio.js        # Procedural WebAudio autocannon, flak, harpoon & steam whistle SFX
└── assets/
    └── sprites/        # Transparent pixel-art raider vehicles, commander & locomotive art
```
