# Changelog — BACKBEAT // '89

## [2.1.0] — 2026-10-21 (Full-Bleed 1989 Synthwave Stage & Jukebox Overhaul)

### Changed
- **Eliminated 3-Column Dashboard Layout:** Replaced the boxed left/right sidebars and top stat-pill bar with a full-bleed `100vw × 100vh` 1989 Synthwave Concert Stage.
- **Two-State Stage UX (Reviewed with Venice Vision):**
  - **Attract / Track Select State:** Unified `01 → 02 → 03` Jukebox Console (`Select Synth Track` → `Select Chart Difficulty` → `▶ Drop The Beat [Enter]`) anchored top-left while the 3D perspective highway runs an unobstructed live note preview with BPM-synced equalizer bars.
  - **Active Performance State (`body.playing`):** Jukebox Console collapses into a compact spinning vinyl turntable platter (`NOW SPINNING`), revealing borderless 3D-angled holographic projections hugging the left and right highway rails (`S+` Rank, Combo Streak, Early/Late Timing Needle on the left rail; Kinetic Scoreboard & Vertical Overdrive Plasma Tube on the right rail).
- **Enhanced 3D Stage Canvas (`js/renderer.js`):** Added sliced Outrun sunset disk, synthwave wireframe mountain horizon, dual pumping stage subwoofer stacks, sweeping truss lasers, scrolling perspective rail chevrons, 3D molded `[D][F][J][K]` receptor keycaps, and a center-stage Early/Late precision tick bar.

## [2.0.0] — 2026-10-20 (Issue #14 Rewrite)

### Added
- **4-Track Playable Roster & 4 Difficulties (`Easy`, `Normal`, `Hard`, `Encore`):**
  - Preserved `Backbeat Anthem` (`120 BPM`) and added 3 procedural multi-track `OfflineAudioContext` songs: `Neon Horizon` (`118 BPM` Synthwave), `Chiptune Overdrive` (`140 BPM` 16-Bit Boss Rush), and `Cyberpunk Grind` (`132 BPM` Dark Industrial).
- **Hold/Sustain Ribbons, Simultaneous Chords & 2× Overdrive Fever:**
  - Perspective-projected sustain ribbons with tick scoring, gold chord tie-bars, and `[Space]` Overdrive Fever activation.
- **Pixel-Art Album Covers & Cyber-DJ Stage (`assets/art/`):**
  - Generated 4 watermark-free 32-bit pixel-art track covers and transparent stage sprite (`cyber_dj.png`) flanked by dual 26-band `AnalyserNode` FFT spectrum bars.

## [1.0.0] — Initial Prototype
- Single-track 4-lane tap prototype (`backbeat-anthem.json`).
