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

    updateEnemies();
    updateTurrets();
    updateProjectiles();

    requestAnimationFrame(gameLoop);
}

function gameTick() {
    if (gameState.isGameOver || gameState.isPaused) return;
    
    gameState.gameTime += 100;
    updateGameStats();
    updateUI();
}

// Start the game
init();
