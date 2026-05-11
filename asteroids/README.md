# ☄️ Asteroids

A vector-style top-down space shooter. Blast rocks, dodge UFOs, hyperspace if you dare.

## 🎮 How to Play

### Objective
Pilot your ship through an asteroid field. Destroy all asteroids to advance to the next level. Watch out for the bonus UFO — it's worth big points, but it shoots back!

### Controls
- **← →** or **A D**: Rotate ship
- **↑** or **W**: Thrust
- **Space**: Fire
- **H**: Hyperspace (random teleport — 15% chance of instant death!)
- **P**: Pause/Resume

### Rules
1. The ship drifts in space — thrust to move, but momentum carries you
2. Asteroids break into smaller fragments when shot
3. Clear all asteroids to advance to the next level (more rocks each time)
4. A UFO appears periodically — shoot it for bonus points (50–200)
5. Game over when you lose all 3 lives

## 🏆 Scoring

| Target | Points |
|--------|--------|
| Large asteroid | 20 |
| Medium asteroid | 50 |
| Small asteroid | 100 |
| UFO | 50–200 (random) |

High scores are automatically saved to localStorage.

## 🎯 Features

### Core Gameplay
- Classic Asteroids mechanics with momentum-based physics
- Procedurally generated asteroid shapes (every rock is unique)
- Asteroid splitting: large → 2 medium → 2 small → destroyed
- UFO bonus enemy that tracks and fires at the player
- Wraparound screen for all entities
- Level progression with increasing difficulty

### Twists
- **Vector-line CRT aesthetic** — glowing wireframe graphics with subtle grid
- **Hyperspace** — press H to random-teleport (risky! 15% chance of death)
- **Web Audio SFX** — retro oscillator beeps for shooting, explosions, and more
- **Explosion particles** — satisfying vector-particle bursts on destruction

### UI/UX
- Clean dark theme with green vector glow
- HUD overlay showing score, level, and lives
- Start screen with controls reference
- Game over screen with final score and high score
- Pause functionality

## 🛠️ Technical Details

### Architecture
Single-file vanilla JavaScript game engine:

- **js/game.js**: Complete game — rendering, physics, collision, audio, input

### Rendering
- HTML5 Canvas with vector-style line drawing
- CRT glow via `shadowBlur`
- Subtle background grid for depth perception

### Performance
- 60 FPS rendering via `requestAnimationFrame`
- Simple circle-based collision detection
- Efficient particle system with lifetime management

### Browser Compatibility
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## 📁 File Structure
```
asteroids/
├── index.html          # Main HTML structure
├── README.md           # This file
├── css/
│   └── style.css       # Styles and theme
└── js/
    └── game.js         # Complete game engine
```

### No Dependencies
Pure vanilla JavaScript, HTML5 Canvas, and CSS3 — no external libraries required!

## 🎓 Tips for High Scores

1. **Keep moving** — a stationary ship is an easy target
2. **Clear edges first** — asteroids near screen edges are harder to dodge
3. **Save hyperspace** — use it as an emergency escape, not a travel tool
4. **Prioritize the UFO** — it's worth more than any single asteroid
5. **Watch your momentum** — it's easy to drift into an asteroid when you're not paying attention

## 📝 License

Part of the HTML-Games collection.

---

**Enjoy the game! ☄️**
