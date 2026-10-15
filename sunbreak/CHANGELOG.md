# Changelog — SUNBREAK // V'BALL

## [0.1.0] — 2026-10-15
### Added
- Initial release of **SUNBREAK // V'BALL** (`sunbreak/`), a 2.5D normal-mapped HD-pixel arcade beach volleyball prototype.
- Custom WebGL2 fragment shader (`js/renderer_gl.js`) with 3 lighting environments (`sunset`, `noon`, `neon`), animated ocean waves/caustics, and a 24-slot deformable sand footprint/dive-trench normal map.
- Articulated 2.5D athlete renderer and coupled harmonic spring-damper soft-body physics rig (`js/physics_rig.js`) with independent Left/Right bust and hip/glute oscillators, 5-link Verlet hair ponytails, dynamic sweat specular sheen, and clinging sand masks.
- 6 playable athletes (`js/roster.js`) with distinct stats and signature *Solar Overdrive* super-spikes.
- 1–4 player input & mode matrix (`1P Solo`, `2P Co-Op Tandem`, `2P Head-to-Head`, `4P Couch Party`) supporting dual keyboards and up to 4 HTML5 Gamepads, plus Role-Locked Auto-Handoff partner logic.
