# 🔢 2048 — Power Tiles Edition

A modern take on the classic 2048 puzzle game with an explosive twist.

## 🎮 How to Play

### Objective
Slide numbered tiles on a 4×4 grid. When two tiles with the same number collide, they **merge into one** with their sum. Reach the **2048** tile to win!

### Controls
- **Arrow Keys** (↑ ↓ ← →): Slide all tiles in that direction
- **WASD**: Alternative movement keys
- **Ctrl+Z** or **↩ Undo button**: Undo your last move
- **Swipe** on mobile: Touch and drag in any direction

### Rules
1. Each move slides all tiles as far as possible in the chosen direction
2. When two tiles with the same value collide, they merge into one tile with double the value
3. After every move, a new tile (2 or 4) spawns in a random empty cell
4. The game ends when no moves are possible (board is full and no merges available)
5. After reaching 2048, you can choose to keep playing for a higher score

## ⚡ Power Tiles — The Twist

Every **10 moves**, a special **Power Tile** (⚡) spawns on the board. Power tiles behave like normal tiles (value 2) for merging, but with a special ability:

> **When two Power Tiles merge, they explode — clearing all tiles in a 3×3 area centered on the merge point!**

This gives you a strategic tool to clear space on a crowded board. Plan your merges carefully!

## 🏆 Scoring

- Merging two tiles adds the **new tile's value** to your score
- Power tile explosions add the **value of all cleared tiles** to your score
- High score is saved automatically in your browser

## 🎯 Features

- **Classic 2048 gameplay** with smooth animations
- **Power Tile mechanic** — strategic explosions every 10 moves
- **Undo** — reverse your last move (one level)
- **Persistent high score** via localStorage
- **Touch/swipe support** for mobile play
- **Responsive design** — works on desktop and mobile
- **Win/lose overlays** with keep-playing option

## 🛠️ Technical Details

### Architecture
Single vanilla JavaScript file with no dependencies:

- **game.js**: Complete game engine — state management, movement logic, rendering, input handling

### No Build Step
Pure HTML, CSS, and JavaScript — just open `index.html` in a browser.

### Browser Compatibility
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers with touch support

## 🎨 Design

Matches the HTML-Games collection theme:
- Dark space theme with purple/violet accents
- Orbitron font for tile values
- Gradient tile colors that intensify with value
- Power tiles glow with amber/red gradient

## 📝 License

Part of the HTML-Games collection.

---

**Enjoy the game! 🔢⚡**
