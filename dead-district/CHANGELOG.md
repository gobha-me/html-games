# Changelog — DEAD DISTRICT // SECTOR 7

All notable changes to `dead-district/` are documented in this file.

## [2.1.0] — 2026-10-21 — Full-Bleed Diegetic Horror HUD, Pixel-Art Vehicles & Light-Distance Visibility

### Added
- **Top-Down Pixel-Art Street Vehicles with Aligned Dynamic Lighting (`assets/sprites/veh_*.png`, `js/config.js`, `js/renderer.js`):**
  - Generated 4 bespoke 90° overhead pixel-art emergency & street vehicles via Venice `gpt-image-2-5-flare` (`hide_watermark: true`): `PD-Cruiser 04` (`veh_police.png`), `EMS Ambulance 12` (`veh_ambulance.png`), `Metro Taxi 718` (`veh_taxi.png`), and `SWAT Bearcat 01` (`veh_swat.png`).
  - Engineered `getVehicleLightingState()` to project raycast shadow-clipped headlight cones, taillight glows, and roof strobes directly from each rotated vehicle's exact bulb sockets — including working twin xenon beams, a damaged/flickering ambulance right headlight with electrical arc sparks, a smashed/dead taxi right headlight matching its crumpled fender sprite, and alternating/rotating red-blue/red-white emergency lightbars.
- **Distance + Illumination-Modulated Zombie Visibility (`js/renderer.js`):**
  - Added `computeIlluminationAt(sim, wx, wy)` combining player flashlight raycasts, close-proximity sixth-sense halo, vehicle headlight cones, emergency strobes, streetlamps, sentry turret spotlights, and thermite fire pools.
  - Zombies in direct light render at 100% crisp detail; zombies in the twilight penumbra render as darkened silhouettes with glowing eyes; zombies in deep darkness hide at `3.5%` body opacity while emitting distance-gated **acoustic footstep ripples** synced to their stride and faint **eye glints** when closing in.
- **Full-Bleed Survival-Horror Visor HUD & Armory Workbench (`index.html`, `css/style.css`, `js/main.js`):**
  - Replaced the 3-column dashboard shell with a `100vw × 100vh` full-bleed viewport, top-left **Body-Cam Bio-Monitor** with live animated **ECG Heartbeat Oscilloscope (`#ecg-canvas`)**, bottom-left **Circular Acoustic Motion Scope**, bottom-right **Brass Cartridge Pip Counter (`#ammo-pips`)** + non-thrashing 5-slot weapon holster, non-blocking **Tactical Sitrep** onboarding card, and a slide-over **Safe-Room Armory Workbench & Infected Dossier (`[B]` / `[TAB]`)**.

## [2.0.0] — 2026-10-20 — Full Sector 7 Tactical Survival-Horror Rewrite (#13)

### Added
- **Urban Quarantine Crossroads & Safe-Room Barricades (`js/config.js`, `js/sim.js`):**
  - Built a `1600×1200` multi-block intersection featuring 4 enterable corner buildings (*St. Jude Pharmacy*, *Precinct 7 Armory*, *Redline Auto Garage*, *Blackout Diner*), abandoned emergency vehicles, concrete jersey barriers, and **8 destructible/repairable doorway barricades (`[F]`)**.
- **2D Raycast Flashlight Shadow Engine & Bio-Radar (`js/renderer.js`):**
  - Implemented 64-ray 2D shadow-casting directional flashlight cone (`[L]` Spot/Flood toggle), muzzle-flash illumination, flickering streetlamps, acoustic bio-sonar rings on unseen threats, and a live `1600×1200` **Sector 7 Bio-Radar** minimap (`#minimap-canvas`).
- **5-Weapon Arsenal, Deployables & Requisition Armory (`js/config.js`, `js/sim.js`, `index.html`):**
  - Added `M9 Tactical`, `Remington 870`, `MP5-K PDW`, `FN-FAL 7.62 AP` (piercing), and `M79 Thermite` launcher with magazine reloads (`[R]`), plus **Thermite Molotovs (`[G]`)**, **Aegis 360° Auto-Turrets (`[T]`)**, **Med-Stims (`[H]`)**, **Combat Dash (`[Space]`)**, and an in-game Scrap (`$`) Requisition Armory.
- **5 Infected Archetypes:**
  - *Shambler*, *Feral Sprinter*, *Bile Spitter* (ranged acid pools), *Riot Juggernaut* (front ballistic shield), and *Necro Screamer* (frenzy sonic shockwave).
- **Procedural WebAudio Synthesizer (`js/audio.js`):**
  - Replaced `7 MB` of static binary PNG/MP3 assets with zero-dependency synthesized gunfire, reloads, explosions, and horror audio.
