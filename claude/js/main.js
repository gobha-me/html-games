/**
 * FactorIO Defense - Main Game Entry Point
 * Extracted from game.js for cleaner initialization
 */

// ============= INITIALIZATION =============
function init() {
    generateWorld();
    setupZoom();
    spawnBase();
    setupEventListeners(); // From buildings.js module
    loadGame();
    updateUI();
    gameLoop();
    setInterval(gameTick, 100);
    setInterval(updateBuildingProduction, 1000); // From buildings.js module
    setInterval(waveTimer, 1000);
}

// ============= GAME LOOPS =============
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
}

// ============= INIT =============

/*
 * FactorIO Defense - Main Entry Point
 */
init();