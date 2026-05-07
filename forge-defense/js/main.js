/**
 * Forge Defense - Main Entry Point
 */

function init() {
    console.log('🔨 Forge Defense initializing...');
    
    // Generate world
    generateWorld();
    spawnBase();
    
    // Setup systems
    setupEventListeners();
    initAchievements();
    
    // Try to load saved game
    const hasSave = localStorage.getItem('forge_defense_save');
    if (hasSave) {
        loadGame();
    }
    
    // Initial UI update
    updateUI();
    checkObjectives();
    
    // Start game loops
    gameLoop();
    setInterval(gameTick, 100);
    setInterval(updateBuildingProduction, 1000);
    setInterval(waveTimer, 1000);
    
    console.log('🔨 Forge Defense ready!');
}

function gameLoop() {
    if (gameState.isGameOver) return;

    if (!gameState.isPaused) {
        updateEnemies();
        updateTurrets();
        updateProjectiles();
    }

    requestAnimationFrame(gameLoop);
}

function gameTick() {
    if (gameState.isGameOver || gameState.isPaused) return;

    gameState.gameTime += 100;
    updateGameStats();
    updateUI();
}

/**
 * Focus-trap handler for the pause overlay — cycles Tab between
 * the two action buttons and wraps around at the edges.
 */
function _pauseFocusTrap(e) {
    if (e.key !== 'Tab') return;
    const focusable = [
        document.getElementById('pause-resume-btn'),
        document.getElementById('pause-restart-btn'),
    ].filter(Boolean);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
        // Shift+Tab: if on first, wrap to last
        if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
        }
    } else {
        // Tab: if on last, wrap to first
        if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }
}

/**
 * Toggle pause state — called by P key and the pause button.
 */
let _prePauseFocusTarget = null;

function togglePause() {
    if (gameState.isGameOver) return;
    gameState.isPaused = !gameState.isPaused;

    const overlay = document.getElementById('pause-overlay');
    const btn     = document.getElementById('pause-btn');

    if (gameState.isPaused) {
        overlay.style.display = 'flex';
        if (btn) { btn.textContent = '▶ Resume'; btn.setAttribute('aria-pressed', 'true'); }
        // Stash the element that had focus so we can restore it later
        _prePauseFocusTarget = document.activeElement;
        // Move focus into the overlay so keyboard users can act immediately
        const resumeBtn = document.getElementById('pause-resume-btn');
        if (resumeBtn) resumeBtn.focus();
        // Install focus trap
        document.addEventListener('keydown', _pauseFocusTrap);
    } else {
        overlay.style.display = 'none';
        if (btn) { btn.textContent = '⏸ Pause';  btn.setAttribute('aria-pressed', 'false'); }
        // Remove focus trap
        document.removeEventListener('keydown', _pauseFocusTrap);
        // Restore focus to whatever was focused before pausing
        if (_prePauseFocusTarget && typeof _prePauseFocusTarget.focus === 'function') {
            _prePauseFocusTarget.focus();
        }
        _prePauseFocusTarget = null;
    }
}

// Auto-pause when the player switches tabs or minimises the window
function pauseIfActive() {
    if (!gameState.isGameOver && !gameState.isPaused) togglePause();
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden) pauseIfActive();
});

// Start the game
init();
