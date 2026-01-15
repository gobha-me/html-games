/**
 * Factory Defense - Main Entry Point
 * 
 * Modular structure:
 * - constants.js: Game configuration
 * - game-state.js: State management
 * - world.js: World generation
 * - buildings.js: Building logic
 * - enemies.js: Enemy system
 * - turrets.js: Turret combat
 * - waves.js: Wave system
 * - input.js: Controls
 * - ui.js: Rendering
 */

// Initialize game when DOM is ready
function init() {
    // Initialize game state
    initGameState();
    initAchievementState();
    
    // Generate world
    generateWorld();
    
    // Setup UI
    renderBuildingList();
    setupGrid();
    setupCraftingButtons();
    
    // Setup controls
    setupMouseControls();
    setupKeyboard();
    setupZoom();
    
    // Initial render
    drawMinimap();
    
    // Start game loops
    gameLoop();
    setInterval(spawnEnemies, ENEMY_SPAWN_RATE);
    setInterval(() => { 
        const state = getGameState();
        if (!state.isPaused) state.gameTime += 1000; 
    }, 1000);
    setInterval(autoSave, 30000);
    
    // Initial camera position
    updateCamera();
    
    // First wave warning
    setTimeout(() => showMessage('FIRST WAVE IN 60 SECONDS! Build turrets NOW!', '#f00'), 5000);
    
    // Initialize audio on first user interaction
    document.addEventListener('click', function initAudio() {
        AudioSystem?.init();
        document.removeEventListener('click', initAudio);
    }, { once: true });
    
    // Load saved achievement state
    loadAchievementState();
}

// Main game loop
function gameLoop() {
    const state = getGameState();
    
    if (!state.isPaused) {
        processProduction();
        processTurrets();
        moveEnemies();
        checkWave();
        updateStats();
        updateObjectives();
    }
    
    setTimeout(gameLoop, TICK_RATE);
}

// Start the game
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for modules
window.initGame = init;
window.gameLoop = gameLoop;
