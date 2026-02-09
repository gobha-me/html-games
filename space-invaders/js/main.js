// Main entry point and event handlers

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    Game.init();
    setupEventListeners();
});

function setupEventListeners() {
    // Start button
    document.getElementById('start-btn').addEventListener('click', () => {
        Game.showScreen('game-screen');
        Game.start();
    });

    // Restart button
    document.getElementById('restart-btn').addEventListener('click', () => {
        Game.showScreen('game-screen');
        Game.start();
    });

    // Menu button
    document.getElementById('menu-btn').addEventListener('click', () => {
        Game.showScreen('start-screen');
        Game.updateHighScoreDisplay();
    });

    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function handleKeyDown(event) {
    // Prevent default for game keys
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(event.key)) {
        event.preventDefault();
    }

    // Store key state
    Game.keys[event.key] = true;

    // Handle special keys
    if (Game.state === 'playing') {
        if (event.key === ' ') {
            Player.shoot();
        } else if (event.key === 'p' || event.key === 'P') {
            Game.pause();
        }
    } else if (Game.state === 'paused') {
        if (event.key === 'p' || event.key === 'P') {
            Game.pause();
        }
    } else if (Game.state === 'gameover') {
        if (event.key === 'r' || event.key === 'R') {
            Game.showScreen('game-screen');
            Game.start();
        }
    }
}

function handleKeyUp(event) {
    Game.keys[event.key] = false;
}

// Handle window blur to auto-pause
window.addEventListener('blur', () => {
    if (Game.state === 'playing') {
        Game.pause();
    }
});

// Handle visibility change
document.addEventListener('visibilitychange', () => {
    if (document.hidden && Game.state === 'playing') {
        Game.pause();
    }
});
