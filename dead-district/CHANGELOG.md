# Changelog

All notable changes to DEAD DISTRICT are recorded here.

## v1.1.0 — 2026-07-21 — Mobile touch controls

### Added
- **Dual virtual-stick touch controls** (`js/game.js`): the left half of the
  screen is a floating movement stick (ring + knob appear where you touch,
  analog speed inside a 60px throw); holding the right half aims the
  flashlight/shotgun at your finger and auto-fires. Implemented with Pointer
  Events (`pointerType === 'touch'`), so desktop mouse/keyboard paths are
  untouched; `pointercancel` and lifted fingers free their stick immediately
  (no stuck movement or fire).
- **Touch pause button** (`❚❚` in the HUD next to mute) — appears after the
  first touch, hidden again if a real mouse moves (hybrid devices). Tapping
  the pause overlay still resumes.
- Touch line in the menu controls hint; `touch-action: none` on the canvas and
  `overscroll-behavior: none` so the page never scrolls, zooms, or
  rubber-bands mid-fight.

### Changed
- Movement normalization now only clamps vectors longer than 1 so the touch
  stick gets analog speed; keyboard movement (cardinal and diagonal) is
  numerically identical to before.
- README: controls section documents touch; fixed the tech-stack note claiming
  WebP assets (all images are PNG).

### Verified
- `menu_bg.png` / `gameover_bg.png` were already wired as CSS backgrounds on
  the menu and game-over overlays (`css/style.css`) — no change needed.

## v1.0.0 — 2026-07-21 — Initial arcade import

### Added
- Top-down survival-horror wave shooter behind an 18+ age gate: fixed-timestep
  loop, camera shake, flashlight-cone darkness mask, three enemy archetypes
  (walker / runner / brute), shotgun pellet combat, blood/gore/casing
  particles, health pickups, wave scaling, `localStorage` high score.
- Venice-generated PNG sprites + MP3 SFX/music under `assets/`.
- Launcher card with blood-crimson (`#c81e1e`) theme.
