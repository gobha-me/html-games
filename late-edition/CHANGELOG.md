# Changelog — LATE EDITION // 1947

## [2.0.0] — 2026-10-20

### Added
- Complete ground-up rewrite of `late-edition/` into **LATE EDITION // 1947**, a playable 2.5D noir newsroom & city-dispatch RTS (closing #12).
- **2.5D Rain-Slicked Noir Metropolis Canvas (`js/renderer.js`)**:
  - Perspective-extruded 1947 Art Deco city blocks with illuminated window grids, rooftop neon marquees, wet asphalt streetlamp reflections, roving Checker yellow cabs with headlight cones, diagonal rain streaks, and expanding puddle ripples.
- **Custom Noir Pixel-Art Sprites & Illustrations (`assets/sprites/`)**:
  - Top-down transparent pixel-art sprites for Reporter (`unit_reporter.png`), Speed Graphic Photographer (`unit_photographer.png`), Tommy-Gun Street Fixer (`unit_fixer.png`), and Rival Syndicate Enforcer (`unit_rival.png`), plus Managing Editor desk portrait (`portrait_editor.png`) and Rotary Printing Press illustration (`masthead_press.png`).
- **3-Column Newsroom & Broadsheet Press Deck (`index.html`, `css/style.css`, `js/main.js`, `js/sim.js`)**:
  - Left Wing: Managing Editor directives, 3 Newsroom Operations (`[Q]` Wiretap Police Band, `[W]` Precinct/Syndicate Payoff, `[E]` Fortify Press Room), 4-unit Press Corps Roster (`[1]`–`[4]`), and Breaking City Leads queue.
  - Center Stage: Interactive 2.5D city map with click-to-dispatch, flashlight cones, investigation progress rings, flashbulb shockwaves, Verified Scoop Tray, and live AP Teletype Wire Log.
  - Right Wing: Interactive 4-Slot Front-Page Broadsheet Composer (`Banner 2.0×`, `Above-the-Fold 1.5×`, `Darkroom Photo Exposé 1.6×`, `Below-the-Fold 1.2×`), Rotary Press Projection, and Rival Newspaper circulation standings.

### Removed
- Removed 12,400+ lines of Phase-0 design bureaucracy (`icds/`, `architecture/`, `design/`, `discussion/`, `METHODOLOGY.md`, `roadmap.md`) and external Google Fonts CDN dependency.
