# 🏓 Pong

A classic Pong game with VS CPU and 2-Player local modes.

## Features

- **VS CPU Mode** — Play against the computer with three difficulty levels
- **2P Local Mode** — Play with a friend on the same keyboard
- **Adjustable Win Score** — First to 5 or first to 11 points
- **High Score Tracking** — Persisted high score in localStorage (CPU mode)
- **Pause Functionality** — Press Space or P to pause/resume
- **Smooth Animations** — Canvas-based rendering with glow effects

## Controls

### Player 1 (Left Paddle)
| Action | Key |
|--------|-----|
| Move Up | W |
| Move Down | S |

### Player 2 (Right Paddle) — 2P Mode Only
| Action | Key |
|--------|-----|
| Move Up | ↑ (Arrow Up) |
| Move Down | ↓ (Arrow Down) |

### Game Controls
| Action | Key |
|--------|-----|
| Pause/Resume | Space or P |

## Game Rules

1. Each player controls a paddle
2. Ball bounces off walls and paddles
3. When ball passes a paddle, opponent scores
4. First to reach the winning score wins
5. Ball speed increases with each paddle hit

## Difficulty Levels (CPU Mode)

| Level | CPU Speed | Description |
|-------|-----------|-------------|
| Easy | Slow | Great for beginners |
| Normal | Medium | Balanced challenge |
| Hard | Fast | For experienced players |

## Technical Details

- Pure vanilla JavaScript with Canvas API
- No external dependencies
- Modular code structure
- Responsive design

## Files

```
pong/
├── index.html      # Game HTML structure
├── css/
│   └── style.css  # Neon arcade styling
├── js/
│   ├── state.js    # Game state management
│   ├── game.js     # Core game logic
│   ├── renderer.js # Canvas rendering
│   ├── controls.js # Input handling
│   └── main.js     # Entry point
└── README.md       # This file
```

## Credits

Built as a contribution to the xcaliber/HTML-Games arcade collection.
