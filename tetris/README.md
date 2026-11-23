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

## Logic tests

From the repository root, run the dependency-free Node suite:

```bash
node --test --test-concurrency=2 tetris/tests/*.test.mjs
```

The tests execute the shipped `state.js`, `game.js` and `controls.js` in an
isolated `node:vm` context. The harness supplies deterministic random values,
a controllable clock, localStorage and deferred line-clear timers; it does not
copy the game logic or load the renderer. The seeded RNG is a test fixture,
not a new game feature. Coverage includes seven-bag distribution, collision,
ghost position, SRS kicks, scoring/combo/levels, drop and lock timing, hold,
DAS/ARR, keyboard mapping and high-score persistence.

Three shipped defects have explicit skipped regression tests in
`tests/known-bugs.test.mjs`. Tests document the intended behavior while product
code remains unchanged:

- Clearing two adjacent full rows can leave a full row behind because inserting
  an empty top row shifts the remaining removal indices.
- Locking a piece never re-enables hold for the newly spawned piece.
- Instant keyboard actions still run during pause; Space can score and lock a piece.

To reproduce these defects, opt in to those tests (currently exits nonzero with
three assertion failures):

```bash
TETRIS_RUN_KNOWN_BUGS=1 node --test --test-concurrency=2 tetris/tests/known-bugs.test.mjs
```

The normal suite reports these cases as skips. It does not claim browser,
rendering or accessibility coverage. No packages or browser are required.

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
