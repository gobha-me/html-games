# BACKBEAT // '89 — Full-Bleed 4-Lane Synthwave Rhythm Stage

A full-bleed `100vw × 100vh` 3D perspective 4-lane synthwave rhythm stage featuring a 4-track roster, procedural multi-track `OfflineAudioContext` synthesis + MP3 playback, Hold/Sustain ribbons, Simultaneous Chords, `2× Overdrive Fever`, and a live 26-band `AnalyserNode` FFT spectrum Cyber-DJ concert stage.

## How to Play

1. **Unified 1-2-3 Jukebox Console (Attract State):**
   - **01 // Select Synth Track:** Pick any of the 4 tracks in the cartridge crate while the 3D highway runs an unobstructed live note preview.
   - **02 // Select Chart Difficulty:** Choose `EASY (1.0×)`, `NORMAL (1.4×)`, `HARD (1.85×)`, or `ENCORE (2.4×)`.
   - **03 // Drop The Beat:** Press `▶ DROP THE BEAT [ENTER]`, strike `[D] [F] [J] [K]` directly on the stage, or click `🤖 AUTO-DJ [A]` for an automated 100% `PERFECT` stage showcase.
2. **Stage Performance State:**
   - The Jukebox Console collapses into a compact **Spinning Vinyl Turntable Platter (`NOW SPINNING`)** in the top-left corner.
   - **Borderless 3D-Angled Holographic Stage Projections** flank the outer highway rails (`S+` Rank, Combo Streak, Early/Late Timing Needle on the left rail; Kinetic Scoreboard & Vertical Overdrive Plasma Tube on the right rail).
   - **Center-Stage Precision Tick Bar:** Every hit displays its exact millisecond offset (`-2ms DEAD-ON / EARLY / LATE`) and a live timing tick bar directly on the highway.

## Track Roster

1. **BACKBEAT ANTHEM** (`120 BPM` · Electro Anthem) — Studio MP3 track + enhanced chart with Hold ribbons & Chords.
2. **NEON HORIZON** (`118 BPM` · Outrun Synthwave) — Multi-track procedural WebAudio synth (sawtooth sub-bass, gated snare, triangle arpeggio lead).
3. **CHIPTUNE OVERDRIVE** (`140 BPM` · 16-Bit Boss Rush) — High-tempo square-wave chiptune arpeggios and 16th-note streams.
4. **CYBERPUNK GRIND** (`132 BPM` · Dark Industrial) — Phrygian acid 303 bassline, heavy kick, and syncopated chord bursts.

## File Layout

- `index.html` — Full-bleed `100vw × 100vh` Stage HUD (`Spinning Vinyl Platter` + `1-2-3 Jukebox Drawer` + `3D Holographic Highway Rail Projections`)
- `css/style.css` — Full-bleed viewport layout, 3D perspective CSS hologram projections, and vinyl turntable animation
- `js/config.js` — Track roster, 4 difficulties (`Easy`, `Normal`, `Hard`, `Encore`), and judgement windows
- `js/chart.js` — JSON chart adapter + deterministic procedural beatmap generator
- `js/audio.js` — `OfflineAudioContext` multi-track synthesizer + MP3 loader + `AnalyserNode` FFT spectrum engine
- `js/game.js` — Rhythm simulation, Hold ribbon ticks, Chords, Overdrive Fever, and `±ms` timing offset telemetry
- `js/renderer.js` — Full-bleed Outrun sunset, wireframe mountain horizon, dual pumping subwoofer stacks, 3D perspective highway with scrolling rail chevrons, and 3D molded receptor keycaps
- `js/main.js` — Jukebox & stage state controller, keyboard/pointer input, and HUD synchronization
