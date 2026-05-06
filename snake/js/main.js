/**
 * Main Entry Point
 * Handles initialization, UI events, and input controls
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize game state
    GameState.init();

    // Update menu high score display
    updateMenuHighScore();
    
    // Update ghost trail toggle UI
    updateGhostTrailUI();
    // Setup event listeners
    setupEventListeners();
});

/**
 * Update menu high score display
 */
function updateMenuHighScore() {
    document.getElementById('menu-high-score').textContent = GameState.highScore;
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Mode selection (single/multiplayer)
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            modeButtons.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Set game mode
            const mode = btn.dataset.mode;
            GameState.setGameMode(mode);
            
            // Show/hide appropriate UI elements
            updateModeUI(mode);
        });
    });
    
    // Player count selection
    const playerCountButtons = document.querySelectorAll('.player-count-btn');
    playerCountButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            playerCountButtons.forEach(b => b.classList.remove('active'));
            
            // Add active class to clicked button
            btn.classList.add('active');
            
            // Set player count
            const count = parseInt(btn.dataset.count);
            GameState.setPlayerCount(count);
        });
    });

    // Difficulty selection
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    difficultyButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            difficultyButtons.forEach(b => b.classList.remove('active'));

            // Add active class to clicked button
            btn.classList.add('active');

            // Set difficulty
            const difficulty = btn.dataset.difficulty;
            GameState.setDifficulty(difficulty);
        });
    });

    // Ghost trail toggle
    const ghostTrailBtn = document.getElementById('ghost-trail-btn');
    ghostTrailBtn.addEventListener('click', () => {
        GameState.toggleGhostTrail();
        updateGhostTrailUI();
    });

    // Start button
    document.getElementById('start-btn').addEventListener('click', () => {
        startNewGame();
    });

    // Pause button
    document.getElementById('pause-btn').addEventListener('click', () => {
        Game.togglePause();
    });

    // Play again button
    document.getElementById('play-again-btn').addEventListener('click', () => {
        startNewGame();
    });

    // Menu button
    document.getElementById('menu-btn').addEventListener('click', () => {
        Game.showScreen('start-screen');
        updateMenuHighScore();
        // Reset to single player mode
        GameState.setGameMode('single');
        updateModeUI('single');
    });

    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

/**
 * Update UI based on selected mode
 */
function updateModeUI(mode) {
    const playerCountSection = document.getElementById('player-count-section');
    const multiplayerControls = document.getElementById('multiplayer-controls');
    const singleControls = document.getElementById('single-controls');
    
    if (mode === 'multiplayer') {
        playerCountSection.style.display = 'block';
        multiplayerControls.style.display = 'block';
        singleControls.style.display = 'none';
    } else {
        playerCountSection.style.display = 'none';
        multiplayerControls.style.display = 'none';
        singleControls.style.display = 'block';
    }
}

/**
 * Update ghost trail toggle button UI
 */
function updateGhostTrailUI() {
    const ghostTrailBtn = document.getElementById('ghost-trail-btn');
    const indicator = ghostTrailBtn.querySelector('.toggle-indicator');
    if (GameState.ghostTrail) {
        ghostTrailBtn.classList.add('active');
        indicator.textContent = 'ON';
    } else {
        ghostTrailBtn.classList.remove('active');
        indicator.textContent = 'OFF';
    }
}

/**
 * Start new game
 */
function startNewGame() {
    // Show appropriate scoreboard
    const scoreboard = document.getElementById('multiplayer-scoreboard');
    if (GameState.isMultiplayer()) {
        scoreboard.style.display = 'flex';
        // Update visible player displays based on player count
        for (let i = 1; i <= 4; i++) {
            const display = document.getElementById(`player${i}-score-display`);
            if (display) {
                display.style.display = i <= GameState.playerCount ? 'flex' : 'none';
            }
        }
    } else {
        scoreboard.style.display = 'none';
    }
    
    Game.reset();
}

/**
 * Handle keyboard input - key down
 */
function handleKeyDown(event) {
    // Handle multiplayer controls
    if (GameState.isMultiplayer()) {
        Controls.handleKeyDown(event);
    }
    
    // Only handle keys during gameplay
    if (GameState.currentState === GameState.PLAYING || GameState.currentState === GameState.PAUSED) {
        switch (event.key) {
            // Arrow keys
            case 'ArrowUp':
                if (!GameState.isMultiplayer()) {
                    event.preventDefault();
                    Snake.setDirection(0, -1);
                }
                break;
            case 'ArrowDown':
                if (!GameState.isMultiplayer()) {
                    event.preventDefault();
                    Snake.setDirection(0, 1);
                }
                break;
            case 'ArrowLeft':
                if (!GameState.isMultiplayer()) {
                    event.preventDefault();
                    Snake.setDirection(-1, 0);
                }
                break;
            case 'ArrowRight':
                if (!GameState.isMultiplayer()) {
                    event.preventDefault();
                    Snake.setDirection(1, 0);
                }
                break;

            // WASD keys
            case 'w':
            case 'W':
                if (!GameState.isMultiplayer()) {
                    event.preventDefault();
                    Snake.setDirection(0, -1);
                }
                break;
            case 's':
            case 'S':
                if (!GameState.isMultiplayer()) {
                    event.preventDefault();
                    Snake.setDirection(0, 1);
                }
                break;
            case 'a':
            case 'A':
                if (!GameState.isMultiplayer()) {
                    event.preventDefault();
                    Snake.setDirection(-1, 0);
                }
                break;
            case 'd':
            case 'D':
                if (!GameState.isMultiplayer()) {
                    event.preventDefault();
                    Snake.setDirection(1, 0);
                }
                break;

            // Pause keys
            case ' ':
            case 'p':
            case 'P':
                event.preventDefault();
                Game.togglePause();
                break;
        }
    }
}

/**
 * Handle keyboard input - key up
 */
function handleKeyUp(event) {
    if (GameState.isMultiplayer()) {
        Controls.handleKeyUp(event);
    }
}