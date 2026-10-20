# AETHERIUM // PINBALL

**The Grand Athanor · Model 1618-IX** — A 2.5D occult alchemical pinball and boss-ritual table with an 8× sub-stepped (480Hz) rigid-body physics engine, live Amber Dot-Matrix Display (DMD), 3 Boss Rituals, Crucible Saucer locks, 3-Ball Azoth Multiball, Magnetkinesis, and procedural WebAudio solenoid & chime synthesis.

## How to Play

1. **Launch Sphere (`Space` / `↓` / `Enter`):** Hold and release the coiled brass spring plunger to launch a liquid-mercury sphere up the shooter lane and through the one-way gate into the top crown rollovers (`SOL · LUNA · AZOTH`).
2. **Flippers & Lane Shift (`Z` / `←` / `Left Shift` & `M` / `→` / `Right Shift`):** Drive the Left Main, Right Main, and Upper-Left Sanctum tapered flippers. Pressing either flipper shifts the lit `SOL · LUNA · AZOTH` crown lanes—complete all three to increase the Table Multiplier (`+1×` up to `10×`).
3. **T-R-A-N-S-M-U-T-E Matrix (`+100,000`):** Knock down the Left (`Salt`) and Right (`Sulfur`) 3-target drop banks and roll through the lower inlanes/outlanes (`U · T · E · M`) to ignite all 9 letters of `TRANSMUTE` for a `+100,000` Magnum Opus bonus, `+2×` Multiplier, and re-lit safeguards.
4. **Philosopher's Crucible & 3-Ball Azoth Multiball:** Shoot into the upper-left Crucible Saucer (`x=102, y=318`) three times (or trigger **⚡ Azoth Burst**) to unleash 3-Ball Azoth Multiball with full ball-to-ball elastic collisions.
5. **Boss Rituals:** Strike the center Boss Sanctum past its rotating brass shield segments and Clockwork Homunculi sentries across 3 escalating rituals:
   - **Ritual I — The Brass Gargoyle** (*Clockwork Sentinel of the First Seal*)
   - **Ritual II — The Ouroboros Engine** (*Serpent of Perpetual Calcination*)
   - **Ritual III — The Grand Alchemist** (*Master of the Philosopher's Crucible*)
6. **Magnetkinesis (`W` / `↑`) & Table Nudge (`A` / `X` / `D`):** Hold `W` to curve falling spheres upward out of the drain using stored capacitor charge, or nudge the cabinet (`A` / `X` / `D`) while watching the **Tilt Pendulum**.

## Tech Stack

- **Vanilla ES Modules + HTML5 Canvas2D** (Zero external dependencies or build steps)
- **Physics (`js/physics.js`):** 480Hz (8× sub-stepped per 60fps frame) rigid-body solver with tapered rotating flipper angular velocity transfer, capsule wall restitution, slingshot kickers, drop-target banks, saucer capture/eject, and multiball sphere-sphere collisions.
- **Renderer (`js/renderer.js`):** High-DPI responsive vertical playfield renderer (`520×900` logical table scaled to fit `1280×800` and `1440×900` viewports) plus a live `256×60` Amber Dot-Matrix Display (`#dmd-canvas`).
- **Audio (`js/audio.js`):** Procedural WebAudio synthesizer for mechanical solenoid flipper clacks, plunger spring release, pitched alchemical bumper bells, spinner ticks, and multiball organ fanfare.

## File Layout

```text
pinball/
├── index.html        # 3-column cabinet shell (Left DMD/Boss wing, Center Playfield, Right Controls/Grimoire wing)
├── css/
│   └── style.css     # Burnished brass, obsidian slate, and responsive 1440x900 / 1280x800 cabinet layout
├── js/
│   ├── config.js     # Table geometry (arch, walls, flippers, bumpers, drop banks, rollovers, Boss Rituals)
│   ├── audio.js      # Procedural WebAudio solenoid & harmonic chime synthesizer
│   ├── physics.js    # 480Hz sub-stepped rigid-body physics & Boss Ritual state machine
│   ├── renderer.js   # 2.5D Canvas playfield & Amber Dot-Matrix Display renderer
│   └── main.js       # Keyboard/pointer controls, HUD telemetry sync & localStorage high score
├── README.md
└── CHANGELOG.md
```
