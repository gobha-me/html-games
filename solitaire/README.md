# 🃏 Solitaire — Klondike

Classic Klondike Solitaire with modern polish. Draw-1 or draw-3, Standard or Vegas scoring, daily deals, undo, and auto-complete.

## 🎮 How to Play

### Objective
Move all 52 cards to the four foundation piles (one per suit), building each from Ace to King.

### Rules
- **Tableau**: Build down in alternating colors (red on black, black on red). Only Kings can go on empty columns.
- **Foundation**: Build up by suit from Ace to King.
- **Stock/Waste**: Draw cards from the stock pile. Cycle through to find playable cards.
- **Auto-flip**: When a face-down card is exposed on the tableau, it flips face-up automatically.

## 🕹️ Controls

### Mouse / Touch
| Action | How |
|--------|-----|
| Draw from stock | Click the stock pile (top-left) |
| Select a card | Click it (highlights in red) |
| Move a card | Select it, then click the destination |
| Quick-move to foundation | Double-click a card |
| Drag & drop | Drag any face-up card to a valid destination |
| Flip face-down card | Click the topmost face-down card in a column |

### Keyboard
| Key | Action |
|-----|--------|
| `N` | New game |
| `U` | Undo last move |
| `A` | Auto-complete (when all cards are face-up) |
| `1` | Switch to draw-1 mode |
| `3` | Switch to draw-3 mode |

## 📊 Scoring

### Standard Mode
- Flip face-up card from tableau: **+5**
- Move card to foundation: **+10**
- Move card from foundation back: **-10**

### Vegas Mode
- Each deal: **-52**
- Each card to foundation: **+5**
- Recycling waste to stock: **-52**
- Goal: End with a positive score!

## ✨ Features

- **Daily Seed**: Everyone gets the same deal each day. Share your results!
- **Undo**: Up to 50 moves of undo history.
- **Auto-Complete**: When every tableau card is face-up, click Auto to finish the game.
- **Draw Modes**: Switch between draw-1 (easier) and draw-3 (classic challenge).
- **Responsive**: Works on desktop and mobile.
- **Stats**: Games played, won, best score, and win streak are saved locally.

## 🏗️ Tech

Vanilla HTML + CSS + JS. No build step, no dependencies.

```
solitaire/
├── index.html      # Entry point
├── README.md       # This file
├── css/
│   └── style.css   # All styles
└── js/
    ├── cards.js    # Card class, Deck, seeded RNG
    └── game.js     # Game engine, UI, drag-and-drop
```
