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
 * - ui.js: Rendering
 * - input.js: Controls (MUST load after ui.js)
 */

// Main initialization
function init() {
    console.log('Initializing Factory Defense...');
    
    // Initialize game state
    initGameState();
    initAchievementState();
    
    // Generate world
    generateWorld();
    
    // Setup UI
    renderBuildingList();
    setupGrid();
    setupCraftingButtons();
    
    // Setup controls (input.js loaded after ui.js)
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
    
    // Initialize achievements system
    initAchievements();
    
    // Initialize audio on first user interaction
    document.addEventListener('click', function initAudio() {
        AudioSystem?.init();
        document.removeEventListener('click', initAudio);
    }, { once: true });
    
    console.log('Factory Defense initialized');
}

// Main game loop
function gameLoop() {
    const state = getGameState();
    
    if (!state.isPaused) {
        // Process production (buildings)
        processProduction();
        // Process turret combat
        processTurrets();
        // Move enemies
        moveEnemies();
        // Update wave system
        checkWave();
        // Update UI
        updateStats();
        updateObjectives();
        // Check achievements
        if (typeof checkAchievements === 'function') {
            checkAchievements(state);
        }
    }
    
    // Continue loop - CRITICAL: This keeps the game running
    setTimeout(gameLoop, TICK_RATE);
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for modules
window.initGame = init;
window.gameLoop = gameLoop;
