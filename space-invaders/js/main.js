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

    // High Scores button (title screen)
    document.getElementById('high-scores-btn').addEventListener('click', () => {
        Game.showScreen('highscores-screen');
        Game.renderHighScores(null);
    });

    // High Scores button (game over screen)
    document.getElementById('gameover-hs-btn').addEventListener('click', () => {
        Game.showScreen('highscores-screen');
        Game.renderHighScores(null);
    });

    // Back button (high scores screen)
    document.getElementById('hs-back-btn').addEventListener('click', () => {
        Game.showScreen('start-screen');
        Game.updateHighScoreDisplay();
    });

    // Reset high scores button
    document.getElementById('hs-reset-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all high scores? This cannot be undone.')) {
            HighScoreManager.reset();
            Game.updateHighScoreDisplay();
            Game.renderHighScores(null);
        }
    });

    // Submit initials
    document.getElementById('initials-submit-btn').addEventListener('click', submitInitials);
    document.getElementById('initials-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitInitials();
    });

    // Keyboard controls
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function submitInitials() {
    const input = document.getElementById('initials-input');
    const initials = input.value.trim().toUpperCase();
    if (initials.length === 0) {
        input.focus();
        return;
    }
    const rank = HighScoreManager.addEntry(initials, Game.score);
    Game.updateHighScoreDisplay();
    // Hide initials section, show high scores
    document.getElementById('initials-section').style.display = 'none';
    Game.showScreen('highscores-screen');
    Game.renderHighScores(rank);
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
