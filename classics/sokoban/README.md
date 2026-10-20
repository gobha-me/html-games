# 📦 Sokoban

A classic Sokoban-style box-pushing puzzle game with a steampunk warehouse theme. Push crates onto glowing targets in confined rooms — you can only push, never pull, so every move counts.

## How to Play

### Goal
Push all crates onto the target tiles (glowing circles) to complete each level.

### Controls
- **Arrow Keys** or **WASD**: Move the worker (🔧)
- **U**: Undo last move
- **Ctrl+R**: Reset current level
- **Touch/Swipe**: Swipe in any direction to move (mobile)

### Rules
1. You can only **push** crates — never pull them
2. You can only push **one crate at a time**
3. Crates cannot be pushed into walls or other crates
4. A level is complete when **all crates** are on target tiles
5. Plan ahead — a misplaced crate can block the entire level!

## Features

### 20 Hand-Authored Levels — every one BFS-verified solvable
- **Levels 1–5**: Tutorial — one new concept per level (push, turn, multi-box, ordering, detour)
- **Levels 6–10**: Easy — chambers, symmetric rooms, light obstacles
- **Levels 11–15**: Medium — courtyards, vaults, multi-target planning
- **Levels 16–20**: Hard — the final archive halls

Every level was run through a BFS solver — no impossible configurations, no
mismatched box/target counts. Pars are derived from the optimal solution length.

### Quality of Life
- **Unlimited Undo** — never get stuck, always try again
- **Reset Level** — start fresh with one click
- **Move & Push Counter** — track your efficiency
- **Best Score Tracking** — localStorage persists your best move count per level
- **Level Selector** — jump to any level or use prev/next navigation
- **Celebration Screen** — satisfying completion overlay with stats

### Mobile Support
- Touch-friendly swipe controls
- Responsive layout that adapts to screen size

## Tech
Vanilla HTML/CSS/JS — no frameworks, no build tools, no dependencies.

## Status
Playable. 20 levels included with progressive difficulty.

## File Layout
- `index.html` — entry point
- `css/style.css` — steampunk warehouse theme and responsive layout
- `js/levels.js` — 20 hand-authored level definitions
- `js/game.js` — game engine: movement, push logic, undo, win detection, rendering

## Tips
1. **Start from the targets** — work backwards to figure out which crates need to go where
2. **Don't push crates into corners** — unless that corner is a target
3. **Keep the center open** — you need maneuvering room
4. **Undo is your friend** — use it liberally to explore different approaches
5. **Fewer pushes = better** — focus on efficient crate placement

---

**Enjoy the puzzle! 📦🔧**
