# Changelog — AETHERIUM // PINBALL

All notable changes to `pinball/` are documented in this file.

## [1.0.1] — 2026-10-20

### Fixed
- **Trough & Corner Clearance (`js/config.js`, `js/physics.js`, `js/renderer.js`):**
  - Widened the Left (`T`) and Right (`E`) inlane trough corners beneath the twin slingshots from `13.9px` to `44.0px` clear perpendicular width (`2.3×` ball diameter) so spheres travel freely around both corners without pinching.
  - Aligned the Left, Right, and Upper-Left inlane guide rail endpoints flush with the top tangent surface of the flipper bases (`y=786` / `y=452`) to eliminate the V-notch step at the flipper pivot hub.
  - Sealed the outer bevel of the right-side Alchemical Spinner channel (`x=442..466`) and removed the redundant inner shooter-lane arch above the one-way gate (`(499,205)->(458,224)`), verified across a 201-point full-table grid sweep and 50 plunger strengths with `0` stuck balls.

## [1.0.0] — 2026-10-20

### Added
- **480Hz Sub-Stepped Pinball Physics Engine (`js/physics.js`, `js/config.js`):**
  - Full `520×900` vertical pinball table with 32-segment top dome arch, isolated shooter lane (`x=468..500`), one-way launch gate, 3 tapered rotating flippers (Left Main, Right Main, Upper-Left Sanctum), twin triangular slingshots, 5 elemental pop bumpers (`Hg`, `S`, `Au`, `Na`, `Vi`), 2×3 drop-target banks (`Salt` & `Sulfur`), 7 rollover sensors (`SOL·LUNA·AZOTH` crown + `U·T·E·M` lower lanes), Philosopher's Crucible saucer, and right-channel Alchemical Spinner.
  - Ball-to-ball elastic collision solver supporting up to 4 simultaneous spheres during **Azoth Multiball**.
  - Defensive safeguards including timed **Aegis Drain-Save Post**, **Left Outlane Kickback**, **Magnetkinesis (`W`)** center-sanctum attractor, and **Tilt Pendulum (`A`/`X`/`D`)**.
- **3 Multi-Phase Boss Rituals:**
  - *Ritual I: The Brass Gargoyle*, *Ritual II: The Ouroboros Engine*, and *Ritual III: The Grand Alchemist*, complete with rotating brass shield arcs, flanking Clockwork Homunculi sentries, and drifting Cinnabar Orbs.
- **2.5D Hermetic Brass & Amber DMD Renderer (`js/renderer.js`, `index.html`, `css/style.css`):**
  - Responsive 3-column backglass cabinet layout verified at `1440×900` and `1280×800` viewports.
  - Live `256×60` Amber Dot-Matrix Display (`#dmd-canvas`), coiled brass plunger spring, lower cabinet apron plaques, radial shot-guide chevrons, and liquid-mercury comet trails.
- **Procedural WebAudio Synthesizer (`js/audio.js`):**
  - Zero-asset synthesized solenoid clacks, spring launch sweep, harmonic bumper chimes, spinner clicks, and multiball organ fanfare.
