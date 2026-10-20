# 🕹️ Retro Cabinet — Early LLM Classics (5-in-1)

An anthology cabinet housing five lightweight classic mini-games built during the earliest rounds of the HTML-Games LLM build-off. Players can switch cartridges on the fly from the top deck (or with `F1`–`F5`), toggle CRT scanlines, or pop any cartridge open in its own full tab.

## How to play

Select any of the five cartridges from the top rack:

1. **🔢 2048 (`classics/2048/`)** — Slide tiles with Arrow keys / WASD to reach 2048. Every 10 moves a special ⚡ Power Tile spawns; merging two Power Tiles detonates a 3×3 board clear.
2. **💣 Minesweeper (`classics/minesweeper/`)** — Easy (9×9), Medium (16×16), and Hard (16×30) boards with first-click safety, right-click flagging, middle-click chord reveal, and per-difficulty best times.
3. **🏓 Pong (`classics/pong/`)** — 1P vs. CPU (Easy/Normal/Hard) or 2P local paddle duel (`W/S` vs. `↑/↓`), configurable to 5 or 11 points.
4. **📦 Sokoban (`classics/sokoban/`)** — 20 verified warehouse box-pushing levels with undo stack (`U` / `Ctrl+Z`), move/push counters, and saved best scores.
5. **⌨️ Typing Game (`classics/typing/`)** — Endless and 60-second Timed modes across Common, Programming, and Sci-Fi word lists with live WPM and accuracy tracking.

## Tech

Vanilla HTML / CSS / JS, zero build step. The cabinet shell (`classics/index.html`) mounts each self-contained game inside a CRT viewport frame and wires shared WebAudio sound effects (`assets/arcade-sfx.js`) across the classic cartridges.

## Status

Playable, v1.0.0.

## File layout

- `index.html` — 5-in-1 CRT cartridge switcher and cabinet shell
- `2048/` — Power-Tiles 2048 cartridge
- `minesweeper/` — Classic Minesweeper cartridge
- `pong/` — 1P/2P Pong cartridge
- `sokoban/` — 20-level Sokoban cartridge
- `typing/` — Falling-word Typing cartridge
