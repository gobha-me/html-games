# Changelog — DEAD DISTRICT // SECTOR 7

All notable changes to `dead-district/` are documented in this file.

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
