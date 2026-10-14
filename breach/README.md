# BREACH // 2099

A fast-paced, 2.5D normal-mapped WebGL2 cyberpunk tactical room-clear game inspired by *Syndicate* and *Hotline Miami*. Infiltrate a three-floor corporate spire (or today's deterministic Daily Seeded Contract), kick blast doors off their hinges to stun guards, shatter glass partitions, and spike your **Adrenaline Overclock** into bullet-time to wipe out every syndicate hostile on the floor.

## How to play

- **Objective**: Eliminate all syndicate hostiles on each Spire floor without flatlining. Chain kills quickly to build your **Combo Multiplier** and earn an `S+` Style Rank.
- **Controls**:
  - `W A S D` or `Arrow Keys` — Move operative
  - `Mouse` — 360° laser-sight aim
  - `Left-Click` — Fire active weapon
  - `Space` or `Right-Click` — Toggle **Adrenaline Overclock** (slow-motion time dilation + cyan neural-grid post-grading)
  - `E` / `F` / `Middle-Click` — **Kick / Breach Door** (destroys closed doors and stuns/damages guards in the blast cone)
  - `1 / 2 / 3` or `Q` — Swap weapon (`1`: Silenced Flechette Pistol, `2`: Ricochet Smart-SMG, `3`: Door-Breaching Gauss Scattergun)
  - `R` — Manual reload (or quick-retry after floor clear / flatline)
  - `P` / `Esc` — Pause / Resume
  - `M` — Mute / Unmute WebAudio synth & SFX

## Tech

Vanilla HTML5 / CSS3 / JavaScript with a custom **WebGL2 GLSL ES 3.00 2.5D Deferred Normal-Mapped Lighting & Raycast Line-of-Sight Shadow Engine** (plus an automatic Canvas2D software fallback for headless/non-WebGL2 environments):
- Procedurally generated `512×512` 24/32-bit pixel-art atlas, cell-clamped $3\times 3$ Sobel height-to-normal/specular map, and emissive neon mask.
- World-space normal vector rotation (`v_rot = vec2(cos(theta), sin(theta))`) inside the fragment shader so rotating 360° sprites receive accurate directional rim and specular lighting from room fixtures and muzzle flashes.
- Real-time 2D raycast visibility polygon uploaded to a shadow texture (`u_visTex`) so walls and closed blast doors cast hard shadows that dynamically open when doors are breached.
- Mulberry32 deterministic PRNG for the **Daily Seeded Contract** mode.

## Status

Playable (v1.0.0) — 3 Campaign Spire floors + Daily Seeded Contract mode.

## File layout

- `index.html` — Tactical HUD, briefing modal, and game stage
- `css/style.css` — Cyberpunk HUD layout and responsive viewport styling
- `js/sprites.js` — 24/32-bit pixel-art atlas, 2.5D Sobel normal map, and emissive mask generator
- `js/audio.js` — Web Audio API procedural gunshots, glass shatter, door breach, and time-dilated synth SFX
- `js/levels.js` — 3 Spire campaign floors + Mulberry32 deterministic Daily Seeded Contract generator
- `js/renderer.js` — WebGL2 GLSL ES 3.00 2.5D normal-mapped lighting & shadow shader + vector FX overlay
- `js/game.js` — 60 FPS simulation, raycast visibility, weapons, door kicking, guard AI, and scoring
