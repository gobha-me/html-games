# 💣 Minesweeper

A classic Minesweeper puzzle game with modern design and three difficulty levels.

## 🎮 How to Play

### Objective
Clear the minefield by revealing all safe cells without detonating any mines!

### Controls
- **Left-click**: Reveal a cell
- **Right-click**: Flag/unflag a cell as a mine
- **Middle-click** (or click on a number): Chord-reveal — if the number of adjacent flags matches the cell's number, all unflagged neighbours are revealed

### Rules
1. Each cell shows how many mines are in the 8 adjacent cells
2. Flag cells you suspect contain mines
3. Reveal all non-mine cells to win
4. Your first click is always safe (no mine will be under it or its neighbours)

## 🎯 Difficulty Levels

| Level | Grid Size | Mines |
|-------|-----------|-------|
| **Easy**   | 9×9   | 10  |
| **Medium** | 16×16 | 40  |
| **Hard**   | 16×30 | 99  |

## 🏆 Scoring

- **Timer**: Tracks how long it takes to clear the board
- **Best Time**: Your fastest completion time per difficulty (saved in localStorage)

## 🛠️ Technical Details

### Architecture
Single-file vanilla JavaScript implementation:

- **game.js**: Complete game logic, rendering, and event handling

### Features
- First-click safety (mines placed after first click, avoiding the clicked area)
- Flood-fill auto-reveal for empty cells
- Chord-reveal on numbered cells
- Best time persistence via localStorage
- Responsive design for different screen sizes

### Browser Compatibility
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## 🎨 Design

Matches the HTML-Games collection theme:
- Background: `#0a0a14`
- Accent: `#10b981` (emerald green)
- Cell unrevealed: `#1e1e3a`
- Cell revealed: `#16213e`
- Mine: `#ef4444` (red)
- Flag: 🚩 emoji

## 🎓 Tips

1. **Start with corners and edges** — they have fewer neighbours, making deduction easier
2. **Use the 1-2-1 and 1-2-2-1 patterns** — common mine configurations that are easy to spot
3. **Flag confidently** — if you're sure, flag it to keep track
4. **Chord-reveal is your friend** — once you've flagged all mines around a number, middle-click to quickly reveal the rest
5. **Don't guess** — if stuck, look for cells where logic can give you a definitive answer

## 📝 License

Part of the HTML-Games collection.

---

**Enjoy the game! 💣**
