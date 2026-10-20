# BACKBEAT // OVERDRIVE — 4-Lane Synth & Rhythm Deck

A 3D perspective 4-lane synth & rhythm deck featuring a 4-track roster, procedural multi-track `OfflineAudioContext` synthesis + MP3 playback, Hold/Sustain ribbons, Simultaneous Chords, `2× Overdrive Fever`, and a live 64-band `AnalyserNode` FFT spectrum Cyber-DJ stage.

## How to Play

- **Strike Notes (`[D] [F] [J] [K]` or `← ↓ ↑ →`):** Press the matching lane key as notes cross the cyan receptor bar at the bottom of the 3D perspective highway.
- **Hold Ribbons:** Keep the lane key held along glowing neon sustain ribbons to earn continuous tick points and completion bonuses.
- **Simultaneous Chords:** Notes linked by a horizontal gold tie-bar must be struck together across both lanes.
- **Overdrive Fever (`[Space]`):** Consecutive hits charge the Overdrive Capacitor; press `[Space]` at `≥50%` charge to activate `2× Fever Score` and hyper-neon stage lasers.
- **Auto-DJ Demo (`[A]`):** Toggle the automated Cyber-DJ to watch a 100% `PERFECT` stage showcase.

## Track Roster

1. **BACKBEAT ANTHEM** (`120 BPM` · Electro Anthem) — Original studio MP3 track + enhanced chart with Hold ribbons & Chords.
2. **NEON HORIZON** (`118 BPM` · Outrun Synthwave) — Multi-track procedural WebAudio synth (sawtooth sub-bass, gated snare, triangle arpeggio lead).
3. **CHIPTUNE OVERDRIVE** (`140 BPM` · 16-Bit Boss Rush) — High-tempo square-wave chiptune arpeggios and 16th-note streams.
4. **CYBERPUNK GRIND** (`132 BPM` · Dark Industrial) — Phrygian acid 303 bassline, heavy kick, and syncopated chord bursts.

## File Layout

- `index.html` — 3-column Studio & Stage UI (`Left Track Crate & Calibration` | `Center 3D Highway & Cyber-DJ Stage` | `Right Grade Matrix & Overdrive Core`)
- `css/style.css` — Responsive `1440×900` and `1280×800` styling
- `js/config.js` — Track roster, 4 difficulties (`Easy`, `Normal`, `Hard`, `Encore`), and judgement windows
- `js/chart.js` — JSON chart adapter + deterministic procedural beatmap generator
- `js/audio.js` — `OfflineAudioContext` multi-track synthesizer + MP3 loader + `AnalyserNode` FFT spectrum engine
- `js/game.js` — Rhythm simulation, Hold ribbon ticks, Chords, Overdrive Fever, and `±ms` timing offset telemetry
- `js/renderer.js` — 3D perspective trapezoid highway, pixel-art Cyber-DJ stage, dual-wing FFT visualizer, and hit shockwaves
- `js/main.js` — Studio controller, keyboard/mouse input, and HUD synchronization
