# SUNBREAK // V'BALL

2.5D HD-Pixel Arcade Beach Volleyball with a custom WebGL2 deformable sand & ocean shader, coupled 2D spring-damper soft-body physics (`Bust L/R` & `Hip L/R` harmonic oscillators + 5-link Verlet hair chains + real-time normal/specular sweat & clinging sand), and 1–4 player couch multiplayer (`HTML5 Gamepad API` + dual keyboard).

## Core Features

1. **WebGL2 Deformable Sand, Ocean & 3 Lighting Environments**:
   - **Golden Hour Sunset**, **Tropical High Noon**, and **Cyber-Beach Neon Night** shaders.
   - Real-time deformable sand heightfield (`u_trails`) where footprints, jump craters, and diving saves indent the sand normal map and catch low-angle sunlight.
2. **Coupled 2.5D Soft-Body Spring-Damper Rig + Real-Time Specular Sheen (`js/physics_rig.js`)**:
   - Independent Left & Right bust and glute/hip harmonic oscillators driven by vertical jump/landing $g$-loads, horizontal cut deceleration, stride cadence, and torso twist torque during spikes.
   - Dynamic perspiration/ocean splash specular highlights (`wetness`) and clinging sand grains (`sandCoat`).
   - Three live physics presets (**DOAX Arcade**, **Realistic Athletic**, **Paradise Turbo**) plus an interactive **Pose & Soft-Body Telemetry Studio** (`C` key).
3. **1–4 Player Couch Modes & Role-Locked Auto-Handoff Partner System (`js/game.js`)**:
   - **1P Solo Tournament** & **2P Head-to-Head**: Zero panic-switching—on defense, control automatically locks onto the defender closest to the predicted landing reticle while your AI partner sprints to the net Setter spot; on offense, after you dig (Touch 1), you keep control of your attacker to run your approach while your AI partner sets you (Touch 2).
   - **2P Co-Op Tandem** & **4P Couch Party**: Full manual control for up to 4 players (`WASD`, `Arrows`, and up to 4 USB/Bluetooth controllers via `navigator.getGamepads()`), featuring human-to-human **Tandem Flash Spikes**.
   - **Solar Overdrive Super-Spikes**: Fill the Solar Gauge to unleash signature character finishers with slow-mo cut-in showcase cards.

## Controls

| Action | Player 1 (KB1) | Player 2 (KB2) | Gamepad (1–4) |
| :--- | :--- | :--- | :--- |
| **Move / Aim Shot** | `WASD` | `Arrow Keys` | Left Stick / D-Pad |
| **Dig / High Set / Cut Lob** | `J` or `Space` | `M` or `Numpad 1` | `A` / Cross (`Button 0`) |
| **Dive / Quick Set / Power Spike** | `K` | `,` or `Numpad 2` | `X` or `B` (`Button 1/2`) |
| **Manual Switch / Setter Dump** | `L` or `Left Shift` | `.` or `Numpad 3` | `LB` / `L1` (`Button 4`) |
| **Pose & Physics Studio** | `C` | — | — |
| **1–4P Court & Mode Lobby** | `Esc` | — | — |
