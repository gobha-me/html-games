# 🧱 Breakout — Brick Breaker

A modern Breakout/Brick Breaker game with power-ups, boss fights, and 10 hand-designed levels.

## 🎮 How to Play

### Objective
Destroy all bricks by bouncing the ball off your paddle. Clear every level to win!

### Controls
- **← → Arrow Keys** or **A / D**: Move paddle
- **Mouse**: Move paddle (hover over canvas)
- **Space** / **↑** / **W**: Launch ball (when stuck to paddle)
- **F**: Fire lasers (when laser power-up is active)
- **ESC**: Pause / Resume

### Rules
1. The ball bounces off walls, paddle, and bricks
2. Destroy all destructible bricks to complete a level
3. You have **3 lives** — lose one when all balls fall below the paddle
4. Indestructible bricks (dark grey, no HP number) cannot be destroyed

## 🎯 Features

### Core Gameplay
- Classic breakout mechanics with angle-based paddle reflection
- Ball launches from paddle — press Space to release
- Mouse control supported for precision aiming

### Power-Ups (drop from broken bricks)
| Power-Up | Icon | Effect |
|---|---|---|
| **Multi-Ball** | ●● | Splits each ball into 3 |
| **Paddle Extend** | ↔ | Widens paddle for ~10 seconds |
| **Sticky Paddle** | ⊂ | Ball sticks to paddle on next catch |
| **Lasers** | ↑ | Press F to shoot lasers from paddle edges |

### Brick Types
| Type | Description |
|---|---|
| **Normal** | One hit to destroy (10 pts) |
| **Tough** | Two hits to destroy, shows HP number (20 pts) |
| **Explosive** | Destroys adjacent bricks in a chain reaction (15 pts) |
| **Indestructible** | Cannot be destroyed — part of level geometry |
| **Boss** | Multi-hit bricks with high HP, appear in boss levels (50 pts) |

### Level Pack (10 Levels)
1. **First Light** — Gentle introduction
2. **Checkerboard** — Alternating pattern
3. **Fortress** — Bricks surround a core
4. **Diamond** — Diamond-shaped layout
5. **Boss Fight I** — First boss encounter
6. **Zigzag** — Winding brick paths
7. **Explosive Core** — Chain-reaction fun
8. **Gauntlet** — Rows of tough & explosive bricks
9. **Boss Fight II** — Bigger boss, tighter paddle
10. **Final Stand** — Everything at once

### Audio
- Web Audio API sound effects (no external files needed)
- Unique sounds for: brick hit, paddle bounce, wall bounce, power-up, explosion, laser, level complete, game over

### UI/UX
- Clean, modern dark theme matching the HTML-Games collection
- Particle effects on brick destruction
- Glowing neon aesthetic
- HUD showing score, level, and lives
- Overlay screens for menu, pause, level complete, and game over

## 🏆 Scoring System

- **Normal brick**: +10 points
- **Tough brick**: +20 points
- **Explosive brick**: +15 points
- **Boss brick**: +50 points
- **Chain reaction brick**: +5 points

## 🛠️ Technical Details

### Architecture
Built with vanilla JavaScript in a modular pattern:

- **levels.js**: Level definitions (10 hand-designed layouts)
- **audio.js**: Web Audio API sound effects
- **game.js**: Main game engine (input, physics, rendering, state)

### Performance
- 60 FPS rendering using `requestAnimationFrame`
- Canvas-based rendering with glow effects
- Efficient collision detection (clamped distance check)

### Browser Compatibility
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## 🔧 Development

### File Structure
```
breakout/
├── index.html          # Main HTML structure
├── README.md           # This file
├── css/
│   └── style.css       # Styles and theme
└── js/
    ├── levels.js       # Level definitions
    ├── audio.js        # Sound effects
    └── game.js         # Game engine
```

### No Dependencies
Pure vanilla JavaScript, HTML5 Canvas, and CSS3 — no external libraries required!

## 🎓 Tips

1. **Angle matters**: Hit the ball with the edge of the paddle for sharp angles
2. **Save power-ups**: Sticky paddle lets you aim your next shot
3. **Chain reactions**: Explosive bricks can clear large sections — aim for them!
4. **Boss fights**: Focus fire on one boss brick at a time
5. **Multi-ball chaos**: Great for scoring, but harder to control

## 📝 License

Part of the HTML-Games collection.

---

**Enjoy the game! 🧱🏓**
