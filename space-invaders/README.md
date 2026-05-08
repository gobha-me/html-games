# 👾 Space Invaders

A classic arcade shooter game recreated with HTML5 Canvas and vanilla JavaScript.

## Features

### Core Gameplay
- **Player Ship**: Move left/right and shoot lasers at alien invaders
- **Alien Formation**: 5 rows × 11 columns of aliens with different point values
- **Wave System**: Progressive difficulty with faster aliens each wave
- **Lives System**: 3 lives with temporary invulnerability after being hit

### Game Elements
- **Aliens**: Three types with different point values (10, 20, 30 points)
- **Destructible Barriers**: 4 shields that erode when hit by projectiles
- **Mystery UFO**: Random bonus ship worth 50-300 points
- **Projectiles**: Player lasers and alien bombs

### Difficulty Progression
- Aliens speed up as more are destroyed
- Each wave increases base speed and fire rate
- Move interval and shoot interval decrease with waves

### Audio
- Synthesized sound effects using Web Audio API
- Shoot, explosion, alien movement, UFO, and game over sounds
- No external audio files required

### UI/UX
- Start screen with controls guide
- Real-time score, high score, wave, and lives display
- Pause/resume functionality (P key)
- Game over screen with detailed statistics
- High score persistence using localStorage
- Responsive design for different screen sizes

## Controls

| Key | Action |
|-----|--------|
| ← → or A D | Move ship left/right |
| SPACE | Fire laser |
| P | Pause/Resume |
| R | Restart (Game Over screen) |

## Technical Details

### Architecture
- **Modular Design**: Separate files for each game system
- **Entity-Component Pattern**: Clean separation of concerns
- **Game Loop**: RequestAnimationFrame-based loop with delta time
- **Canvas Rendering**: Hardware-accelerated 2D graphics

### File Structure
```
space-invaders/
├── index.html          # Main HTML structure
├── css/
│   └── style.css       # Styling matching site theme
└── js/
    ├── main.js         # Entry point and event handlers
    ├── game.js         # Game loop and state management
    ├── renderer.js     # Canvas rendering
    ├── player.js       # Player ship logic
    ├── alien.js        # Alien formation and AI
    ├── projectile.js   # Bullet system
    ├── barrier.js      # Destructible shields
    ├── ufo.js          # Bonus UFO system
    └── audio.js        # Web Audio API sounds

```

### Key Systems

#### Collision Detection
- Axis-Aligned Bounding Box (AABB) collision
- Efficient projectile vs entity checks
- Pixel-level barrier erosion

#### Alien AI
- Formation movement with edge detection
- Automatic direction reversal and descent
- Bottom-most aliens shoot randomly
- Speed increases as aliens are eliminated

#### Barrier Erosion
- 20×20 damage map per barrier
- Localized erosion around hit points
- Visual degradation over time

## Scoring

| Element | Points |
|---------|--------|
| Top row aliens (purple) | 30 |
| Middle row aliens (green) | 20 |
| Bottom row aliens (yellow) | 10 |
| Mystery UFO | 50-300 (random) |

## Game Over Conditions

1. Player loses all 3 lives
2. Aliens reach the bottom of the screen

## Wave Progression

Each completed wave:
- Increases alien base speed by 5 units
- Decreases move interval (faster movement)
- Decreases shoot interval (more frequent shots)
- Resets barriers to full health
- Spawns new alien formation

## Browser Compatibility

- Modern browsers with HTML5 Canvas support
- Web Audio API for sound effects
- localStorage for high score persistence
- RequestAnimationFrame for smooth animation

## Performance

- Efficient rendering with minimal canvas operations
- Entity pooling for projectiles
- Optimized collision detection
- 60 FPS target frame rate

## Future Enhancements

Potential additions:
- Power-ups (rapid fire, shield, etc.)
- Multiple player ships
- Boss waves
- Leaderboard system
- Mobile touch controls
- Different alien attack patterns

## Credits

- Classic Space Invaders gameplay by Tomohiro Nishikado (1978)
- Recreated for HTML-Games collection
- Theme colors: #1a1a2e (bg), #00d4ff (accent), #16213e (cards)


## Status
Playable.
