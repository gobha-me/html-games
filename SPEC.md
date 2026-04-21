# MiniMaxOS - Interactive Operating System Demo

## Concept & Vision

MiniMaxOS is a visually stunning, fully interactive web-based operating system that demonstrates advanced UI/UX capabilities. It feels like a premium desktop environment from a near-future timeline — sleek, responsive, and delightfully functional. Every window is a canvas, every interaction a choreographed experience. Users should feel the urge to explore, click, drag, and discover dozens of micro-interactions that make this feel like real software, not a demo.

## Design Language

### Aesthetic Direction
Inspired by futuristic system interfaces — think retro-futurism meets modern glass morphism. A dark cosmic theme with luminous accents, soft gradients, and depth through layered shadows. The OS should feel like piloting a spacecraft's control panel.

### Color Palette
- **Primary Background**: `#0a0e1a` (deep space navy)
- **Secondary Background**: `#131929` (panel blue)
- **Accent Primary**: `#00d4ff` (electric cyan)
- **Accent Secondary**: `#ff6b9d` (neon pink)
- **Accent Tertiary**: `#a855f7` (vivid purple)
- **Success**: `#22c55e` (terminal green)
- **Warning**: `#fbbf24` (amber)
- **Text Primary**: `#e2e8f0` (soft white)
- **Text Secondary**: `#94a3b8` (muted)
- **Glass Effect**: `rgba(255,255,255,0.05)` with backdrop blur

### Typography
- **System Font**: 'Inter' for UI, fallback to system-ui
- **Monospace**: 'JetBrains Mono' for terminal/code
- **Headings**: Semi-bold, slight letter-spacing
- **Body**: Regular weight, good line-height for readability

### Spatial System
- Base unit: 8px
- Window padding: 16px
- Icon grid: 80px cells
- Taskbar height: 48px
- Window title bar: 36px
- Border radius: 12px (windows), 8px (buttons), 50% (icons)

### Motion Philosophy
- **Window open**: Scale 0.9→1, opacity 0→1, 200ms cubic-bezier(0.34, 1.56, 0.64, 1)
- **Window close**: Scale 1→0.9, opacity 1→0, 150ms ease-out
- **Minimize**: Shrink to taskbar with bounce
- **Hover effects**: 150ms transitions, subtle scale (1.02) and glow
- **Drag**: Smooth follow with slight lag for weight feel
- **Menu open**: Slide down with stagger for items

### Visual Assets
- Custom SVG icons for each app (geometric, consistent stroke weight)
- Animated gradient backgrounds
- Particle effects on desktop (subtle floating dots)
- Progress bars with gradient fills
- LED-style indicators in taskbar

## Layout & Structure

### Desktop
- Full viewport with subtle animated gradient background
- Grid of application icons (4 columns)
- Recycle Bin icon in bottom-left
- Clock widget in bottom-right corner
- Desktop widgets can be dragged around

### Taskbar
- Glass morphism bar at bottom
- Start button (miniMax logo) on left
- Running app icons in center (click to focus/restore)
- System tray on right: WiFi, Volume, Battery (decorative), Clock

### Start Menu
- Slides up from Start button
- Grid of all applications with icons and labels
- Search bar at top
- Power options at bottom

### Windows
- Draggable title bars with app icon, title, and window controls
- Minimize (—), Maximize (□), Close (×) buttons
- Resizable from edges and corners
- Content area with app-specific UI
- Subtle drop shadow and border glow

## Features & Interactions

### Core OS Features
- **Desktop Icons**: Double-click to open, single-click to select (highlight)
- **Window Management**: Drag title bar to move, drag edges to resize, triple-click title to maximize
- **Z-ordering**: Click to bring window to front
- **Minimize to Taskbar**: Window shrinks and icon pulses in taskbar
- **Maximize/Restore**: Toggle between full screen and previous size/position
- **Close**: Window animates out, removed from DOM
- **Start Menu**: Click start button or press Meta key to toggle
- **Multiple Windows**: Can open multiple instances of same app

### Application Launcher
Apps included:
1. **Calculator** - Scientific calculator with history
2. **Notepad** - Text editor with word count
3. **Snake Game** - Full playable snake game
4. **Chess** - Play against AI opponent
5. **Terminal** - Functional command prompt
6. **File Explorer** - Browse mock file system
7. **Clock** - World clock and alarm
8. **Weather** - Mock weather display
9. **Settings** - OS preferences panel
10. **Browser** - Simplified web browser UI

## Component Inventory

### Desktop Icon
- States: default (glow), hover (scale 1.05, brighter glow), selected (highlight ring), opening (pulse animation)
- 64px icon, 12px label below, centered

### Taskbar Button
- States: default, hover (brighten), active (accent underline), running (dot indicator)
- 40px square with rounded corners

### Window
- States: normal, focused (brighter border, higher shadow), dragging (slight opacity), resizing (resize cursor)
- Title bar: app icon, title text, control buttons
- Controls: hover shows color (red for close)

### Start Button
- Circular, gradient background, MiniMax logo
- States: default, hover (rotate icon 15°), active (scale down)

### Buttons (in apps)
- Rounded rect, gradient background, icon + label
- States: default, hover (lift shadow), active (press down), disabled (dimmed)

### Input Fields
- Dark background, subtle border, focus glow with accent color
- Placeholder text in secondary color

## Technical Approach

### Architecture
- Single HTML file with embedded CSS and JavaScript
- ES6+ features, no build step required
- CSS custom properties for theming
- Component-based mental model (functions return DOM elements)

### State Management
- Global `os` object holding:
  - `windows`: Map of active window instances
  - `zIndex`: Counter for layering
  - `startMenuOpen`: boolean
  - `focusedWindow`: id reference

### Window System
```javascript
Window {
  id, title, icon, content, position, size, state, onClose
}
```

### App Architecture
Each app is a function that returns content:
```javascript
function createApp(state) {
  return {
    render: () => DOMElement,
    onOpen: (windowId) => {},
    onClose: () => {}
  }
}
```

### Persistence
- LocalStorage for:
  - Window positions (optional)
  - Settings preferences
  - High scores

### Performance
- RequestAnimationFrame for animations
- Event delegation for window interactions
- CSS transforms for smooth dragging (GPU accelerated)
- Debounced resize handlers

## Application Details

### Calculator
- Basic operations: +, -, ×, ÷
- Scientific: sin, cos, tan, √, ^, π
- Display: LCD-style font, scrolling for large numbers
- History panel showing last 10 calculations
- Keyboard support

### Notepad
- Plain text editing with syntax highlighting (optional)
- Word count, character count in status bar
- New, Save (to localStorage), Clear buttons
- Auto-save indicator

### Snake Game
- Grid-based movement
- Score tracking
- Speed increases with score
- Game over screen with restart
- High score saved to localStorage
- Arrow key controls

### Chess
- 8x8 board with alternating colors
- Drag and drop piece movement
- Basic AI (random valid moves for now, with some strategy)
- Turn indicator
- Check/checkmate detection

### Terminal
- Command history (up/down arrows)
- Built-in commands: help, clear, echo, date, whoami, ls, cd, pwd
- ASCII art welcome message
- Blinking cursor

### File Explorer
- Tree view of mock filesystem
- Folder icons, file icons by type
- Breadcrumb navigation
- Double-click to open folders
- Click file to show preview (for images/text)

### Clock
- Analog clock face with animated hands
- Digital time display
- World clock: add cities with different timezones
- Alarm setting (visual only, no actual alerts)

### Weather
- Current conditions display
- 5-day forecast mock data
- Animated weather icons (sun, clouds, rain)
- Temperature display

### Settings
- Theme selector (colors)
- Wallpaper selector
- Sound toggle (visual)
- About MiniMaxOS info

### Browser
- URL bar with input
- Navigation buttons (back, forward, refresh)
- Homepage with search bar
- Bookmarks bar (decorative)
- Shows mock "loading" animation
- Displays placeholder pages for demo