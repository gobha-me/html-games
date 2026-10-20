# ⌨️ Typing Game

A typing-skills game where words fall from the top of the screen — type them correctly before they hit the bottom! Difficulty ramps up with speed and word length as you progress.

## 🎮 How to Play

### Objective
Type the falling words correctly before they reach the danger zone at the bottom of the screen. Each completed word earns points and increases the difficulty.

### Controls
- **Letter keys (A-Z)**: Type the characters of the falling words
- **Backspace**: Reset progress on the current word
- **Esc** or **P**: Pause/Resume game
- **Enter** or **Space**: Start game from menu

### Rules
1. Words fall from the top of the screen
2. The lowest word is your **target** (highlighted with a cyan glow)
3. Type the letters to match the word — matched characters turn green
4. Completing a word destroys it with a particle burst and earns points
5. If a word reaches the bottom, you lose a life
6. **Endless mode**: 3 lives — game ends when all lives are lost
7. **Timed mode**: 60 seconds — maximize your score, lives don't matter

## 🎯 Features

### Game Modes
- **♾️ Endless**: Survive as long as possible with 3 lives. Difficulty increases continuously.
- **⏱️ Timed 60s**: Score as many points as you can in 60 seconds.

### Word Lists
- **📝 Common Words**: Frequently used English words (great for beginners)
- **💻 Programming**: Keywords, functions, and tech terms (for developers)
- **🚀 Sci-Fi & Fantasy**: Names and terms from sci-fi worlds (for flavor)

### Difficulty Progression
- Words spawn faster as your score increases
- Word length progresses from easy → medium → hard
- Fall speed increases with each difficulty level

### Stats & Persistence
- **WPM** (Words Per Minute) calculated in real-time
- **Accuracy** percentage tracked throughout
- **Combo system**: consecutive words without errors earn bonus points
- **High scores** saved per mode in localStorage
- **Best WPM** tracked across all sessions

### Visual Effects
- Particle burst on word completion
- Combo counter with milestone sounds
- Danger zone indicator at the bottom
- Target word highlighting with glow effect
- Shake animation on wrong keystrokes

## 🏆 Scoring System

- **Base score**: 10 points per word completed
- **Combo bonus**: +5 points per consecutive word (after the first)
- **Accuracy multiplier**: Final score multiplied by accuracy percentage
- **High scores**: Saved separately for Endless and Timed modes

## 🛠️ Technical Details

### Architecture
The game is built with vanilla JavaScript using ES modules:

- **`main.js`**: Entry point, UI management, event handling
- **`game.js`**: Game loop, state management, input processing
- **`word-spawner.js`**: Word spawning, difficulty scaling, word list management
- **`word.js`**: Word entity (position, speed, matched characters)
- **`renderer.js`**: Canvas rendering, particle effects
- **`stats.js`**: WPM calculation, accuracy tracking, localStorage persistence
- **`audio.js`**: Web Audio API sound effects
- **`word-lists.js`**: Word data for all three lists

### Performance
- 60 FPS rendering using `requestAnimationFrame`
- Efficient canvas rendering with minimal DOM updates
- Lightweight particle system with automatic cleanup

### Browser Compatibility
- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## 📱 Responsive Design

The game adapts to different screen sizes:
- Desktop: Full viewport canvas
- Tablet: Scaled canvas with adjusted word spawn positions
- Mobile: Touch-friendly UI (keyboard required for typing)

## 🎨 Design

Matches the HTML-Games collection theme:
- Background: `#1a1a2e`
- Surface: `#16213e`
- Accent: `#00d4ff` (cyan)
- Success: `#2ed573` (green)
- Danger: `#ff4757` (red)

## 🔧 Development

### File Structure
```
typing/
├── index.html          # Main HTML structure
├── README.md           # This file
├── css/
│   └── style.css       # Styles and theme
└── js/
    ├── main.js         # Entry point and event handling
    ├── game.js         # Game loop and logic
    ├── word-spawner.js # Word spawning and difficulty
    ├── word.js         # Word entity
    ├── renderer.js     # Canvas rendering and particles
    ├── stats.js        # WPM, accuracy, localStorage
    ├── audio.js        # Web Audio API sound effects
    └── word-lists.js   # Word data
```

### No Dependencies
Pure vanilla JavaScript, HTML5 Canvas, and CSS3 — no external libraries required!

## 🎓 Tips for High Scores

1. **Focus on the target word**: The lowest word is always highlighted
2. **Don't rush**: Accuracy matters more than speed — mistakes cost time
3. **Build combos**: Consecutive correct words multiply your score
4. **Choose your word list**: Start with Common Words, then try Programming
5. **Use Backspace wisely**: Reset a word if you've made too many errors

## 📝 License

Part of the HTML-Games collection.

---

**Enjoy the game! ⌨️**
