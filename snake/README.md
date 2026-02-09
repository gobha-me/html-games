# 🐍 Snake Game

A classic Snake game implementation with modern design and smooth gameplay.

## 🎮 How to Play

### Objective
Control the snake to eat food and grow as long as possible without hitting the walls or yourself!

### Controls
- **Arrow Keys** or **WASD**: Move the snake
- **Space** or **P**: Pause/Resume game

### Rules
1. The snake moves continuously in the current direction
2. Eat the red food to grow longer and earn points
3. Each food gives you **10 points**
4. The game speeds up as your snake grows
5. Game over if you hit a wall or collide with yourself

## 🎯 Features

### Core Gameplay
- Classic snake mechanics with smooth movement
- Growing snake with each food eaten
- Progressive difficulty (speed increases)
- Wall and self-collision detection
- Score tracking

### Difficulty Levels
- **Easy**: Slower starting speed, gradual difficulty increase
- **Normal**: Balanced gameplay (default)
- **Hard**: Fast-paced action for experienced players

### UI/UX
- Clean, modern dark theme with cyan accents
- Responsive design for different screen sizes
- Pause functionality
- High score persistence using localStorage
- Game over screen with statistics
- Smooth animations and visual effects

## 🏆 Scoring System

- **+10 points** per food eaten
- High scores are automatically saved
- New high score celebration on game over

## 🛠️ Technical Details

### Architecture
The game is built with vanilla JavaScript using a modular architecture:

- **state.js**: Game state management and difficulty settings
- **snake.js**: Snake logic, movement, and collision detection
- **food.js**: Food spawning and collection
- **renderer.js**: Canvas rendering with visual effects
- **game.js**: Main game loop and update logic
- **main.js**: Initialization and input handling

### Performance
- 60 FPS rendering using `requestAnimationFrame`
- Optimized collision detection
- Efficient grid-based movement system

### Browser Compatibility
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## 📱 Responsive Design

The game adapts to different screen sizes:
- Desktop: Full-size canvas with optimal grid
- Tablet: Scaled canvas
- Mobile: Touch-friendly layout (keyboard required for controls)

## 🎨 Design

Matches the HTML-Games collection theme:
- Background: `#1a1a2e`
- Accent: `#00d4ff` (cyan)
- Secondary: `#16213e`
- Snake: Glowing cyan with brighter head
- Food: Red with glow effect

## 🔧 Development

### File Structure
```
snake/
├── index.html          # Main HTML structure
├── README.md           # This file
├── css/
│   └── style.css       # Styles and theme
└── js/
    ├── main.js         # Entry point and event handling
    ├── game.js         # Game loop and logic
    ├── snake.js        # Snake mechanics
    ├── food.js         # Food logic
    ├── renderer.js     # Canvas rendering
    └── state.js        # State management
```

### No Dependencies
Pure vanilla JavaScript, HTML5, and CSS3 - no external libraries required!

## 🎓 Tips for High Scores

1. **Plan ahead**: Think about your path before making moves
2. **Use the edges**: Navigate along walls for more control
3. **Create space**: Avoid boxing yourself in
4. **Stay calm**: Don't panic as the speed increases
5. **Practice**: Master the controls at different difficulty levels

## 📝 License

Part of the HTML-Games collection.

---

**Enjoy the game! 🐍**
