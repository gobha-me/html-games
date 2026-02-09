/**
 * Main Entry Point
 * Handles initialization, UI events, and input controls
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize game state
    GameState.init();

    // Update menu high score display
    updateMenuHighScore();

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
    });

    // Keyboard controls
    document.addEventListener('keydown', handleKeyPress);
}

/**
 * Start new game
 */
function startNewGame() {
    Game.reset();
}

/**
 * Handle keyboard input
 */
function handleKeyPress(event) {
    // Only handle keys during gameplay
    if (GameState.currentState === GameState.PLAYING || GameState.currentState === GameState.PAUSED) {
        switch (event.key) {
            // Arrow keys
            case 'ArrowUp':
                event.preventDefault();
                Snake.setDirection(0, -1);
                break;
            case 'ArrowDown':
                event.preventDefault();
                Snake.setDirection(0, 1);
                break;
            case 'ArrowLeft':
                event.preventDefault();
                Snake.setDirection(-1, 0);
                break;
            case 'ArrowRight':
                event.preventDefault();
                Snake.setDirection(1, 0);
                break;

            // WASD keys
            case 'w':
            case 'W':
                event.preventDefault();
                Snake.setDirection(0, -1);
                break;
            case 's':
            case 'S':
                event.preventDefault();
                Snake.setDirection(0, 1);
                break;
            case 'a':
            case 'A':
                event.preventDefault();
                Snake.setDirection(-1, 0);
                break;
            case 'd':
            case 'D':
                event.preventDefault();
                Snake.setDirection(1, 0);
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
