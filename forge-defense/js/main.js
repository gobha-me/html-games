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
 * Toggle pause state — called by P key and the pause button.
 */
function togglePause() {
    if (gameState.isGameOver) return;
    gameState.isPaused = !gameState.isPaused;

    const overlay = document.getElementById('pause-overlay');
    const btn     = document.getElementById('pause-btn');

    if (gameState.isPaused) {
        overlay.style.display = 'flex';
        if (btn) { btn.textContent = '▶ Resume'; btn.setAttribute('aria-pressed', 'true'); }
        // Move focus into the overlay so keyboard users can act immediately
        const resumeBtn = document.getElementById('pause-resume-btn');
        if (resumeBtn) resumeBtn.focus();
    } else {
        overlay.style.display = 'none';
        if (btn) { btn.textContent = '⏸ Pause';  btn.setAttribute('aria-pressed', 'false'); }
    }
}

// Auto-pause when the player switches tabs or minimises the window
window.addEventListener('blur', () => {
    if (!gameState.isGameOver && !gameState.isPaused) togglePause();
});

document.addEventListener('visibilitychange', () => {
    if (document.hidden && !gameState.isGameOver && !gameState.isPaused) togglePause();
});

// Start the game
init();
