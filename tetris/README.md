# 🧱 Tetris

A classic falling-block puzzle game with modern Tetris guideline features: SRS rotation, ghost piece, hold queue, next-piece preview, T-spin detection, and combo scoring.

## Features

- **7-Bag Randomizer** — Fair piece distribution using the standard 7-bag system
- **SRS (Super Rotation System)** — Full wall-kick tables for all tetrominoes
- **Ghost Piece** — See where your piece will land
- **Hold Queue** — Store a piece for later (press C or Shift)
- **Next Preview** — See the next 3 upcoming pieces
- **T-Spin Detection** — Bonus scoring for T-spin maneuvers
- **Combo System** — Chain consecutive line clears for escalating bonuses
- **Lock Delay** — Brief window to slide pieces after landing (with move resets)
- **DAS/ARR** — Delayed Auto Shift for smooth horizontal movement
- **Particle Effects** — Visual flair on line clears and hard drops
- **High Score Tracking** — Persisted in localStorage

## Controls

| Action | Key |
|--------|-----|
| Move Left | ← (Arrow Left) |
| Move Right | → (Arrow Right) |
| Soft Drop | ↓ (Arrow Down) |
| Rotate CW | ↑ (Arrow Up) or X |
| Rotate CCW | Z or Ctrl |
| Hard Drop | Space |
| Hold Piece | C or Shift |
| Pause/Resume | P or Escape |
| Start/Restart | Enter |

## Scoring

| Action | Base Score |
|--------|-----------|
| Single | 100 × level |
| Double | 300 × level |
| Triple | 500 × level |
| Tetris (4 lines) | 800 × level |
| T-Spin Single | 400 × level |
| T-Spin Double | 800 × level |
| T-Spin Triple | 1200 × level |
| Soft Drop | 1 per cell |
| Hard Drop | 2 per cell |
| Combo | 50 + (50 × combo count) × level |

**Level up** every 10 lines cleared. Speed increases with each level.

## Speed Curve

Drop interval = 1000ms × 0.85^(level-1), minimum 50ms.

| Level | Interval |
|-------|----------|
| 1 | 1000ms |
| 5 | 522ms |
| 10 | 196ms |
| 15 | 87ms |
| 20 | 39ms (min) |

## Technical Details

- Pure vanilla JavaScript with Canvas API
- No external dependencies
- Modular code structure (state, game logic, renderer, controls)
- Neon arcade aesthetic with glow effects
- Responsive design with mobile scaling

## Files

```
tetris/
├── index.html      # Game HTML structure
├── css/
│   └── style.css  # Neon arcade styling
├── js/
│   ├── state.js    # Game state, constants, tetromino definitions
│   ├── game.js     # Core game logic (movement, rotation, scoring)
│   ├── renderer.js # Canvas rendering (board, UI, particles)
│   ├── controls.js # Keyboard input handling with DAS/ARR
│   └── main.js     # Entry point and game loop
└── README.md       # This file
```

## Original Twist

**Neon Arcade Aesthetic** — Glowing blocks with gradient highlights, particle explosions on line clears, and a pulsing UI that gives this classic a modern arcade feel. The combo system rewards aggressive play, and T-spin detection adds a skill ceiling for advanced players.

## Credits

Built as a contribution to the xcaliber/HTML-Games arcade collection.
