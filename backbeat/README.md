# 🎵 BACKBEAT

A lane-based rhythm game. Notes scroll down four lanes — hit the key in time
with the music. All audio and art are **generated** (Venice media tools); the
chart is produced by onset-detection, so it is beat-*calculated* rather than
hand-timed.

## 🎮 How to Play

### Objective
Hit each falling note exactly when it crosses the glowing line. Build combo,
chase accuracy, beat your high score.

### Controls
- **D F J K** — hit the note in lanes 1–4
- **P** — pause / resume
- **Tap a lane** (touch) — hit on mobile

### Judgement windows
| Rating | Timing | Points |
|--------|--------|--------|
| Perfect | within ~40–90 ms | 300 × combo bonus |
| Good | within ~90–160 ms | 100 × combo bonus |
| Miss | outside window | combo reset |

Windows tighten on higher difficulties (Easy / Normal / Hard).

## 🎯 Features

- Web Audio API clock for sample-accurate note timing
- 4-lane canvas renderer with hit-line flashes
- Score / combo / accuracy HUD, results screen
- High score persistence (localStorage)
- **Audio-offset calibration** — if hits feel early/late, nudge the offset in
  the menu until taps land on the pulse (agent can't tune by ear, so the knob
  is exposed to the player)
- Generated ship track, hit SFX, and background art

## 🛠️ Technical Details

### Architecture (vanilla JS, ES modules)
- **`config.js`** — difficulty windows, scoring, lane/key map
- **`chart.js`** — chart loading (`charts/*.json`)
- **`audio.js`** — Web Audio engine: track clock, hit SFX (loaded, blip fallback)
- **`game.js`** — pure hit-detection + scoring state (no DOM)
- **`renderer.js`** — canvas drawing (lanes, notes, receptors, flashes)
- **`main.js`** — wiring: menu → game → results, input, calibration, persistence

### Chart format
Charts are data, not code — `charts/<name>.json`:
```json
{ "title": "…", "audio": "assets/track.mp3", "bpm": 120, "offset": 0,
  "notes": [ {"time": 1.997, "lane": 3}, … ] }
```
`time` is seconds (float), `lane` 0–3. `charts/manifest.json` lists tracks for
the menu.

### Chart generation (`tools/chartgen.py`)
Because the authoring agent **cannot hear the track**, note placement is driven
by onset detection:
1. `analyze` — decode to mono PCM via ffmpeg, compute a spectral-flux onset
   envelope, peak-pick onsets, estimate BPM from inter-onset intervals.
2. `generate` — emit notes on detected onsets, distributed across lanes, then
   thin to a minimum inter-note gap for playability.

This makes the chart *beat-calculated*. Whether it *grooves* is a human call —
see the PR note.

### Assets
- `assets/backbeat-track.mp3` — ship track (Venice music, instrumental)
- `assets/hit.mp3` — note-hit SFX (Venice sfx)
- `assets/bg.jpg` — background art (Venice image)

### No dependencies
Pure vanilla JS/HTML/CSS. ffmpeg is only used by the offline chart tool, not
at runtime.

## 🎨 Design
Matches the arcade theme: dark indigo backdrop, cyan/magenta gradient accents,
per-lane neon colors (cyan / magenta / yellow / green).

## 📱 Responsive
Scales to narrow screens; touch-tap lanes for mobile play.

## 📝 License
Part of the HTML-Games collection.

---

## Status
Playable. **Playtest note:** the chart is onset-calculated, not hand-timed —
if the groove feels off or the offset needs a global nudge, that's calibration
feedback, not a code bug. Tell the maintainer what offset felt right.
