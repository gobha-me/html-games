/**
 * Tetris Game Entry Point
 */

// Game loop
let lastTimestamp = 0;

function gameLoop(timestamp) {
    // Update game logic
    update(timestamp);
    
    // Render is handled by requestAnimationFrame in renderer
    // This loop ensures update runs at consistent rate
    requestAnimationFrame(gameLoop);
}

// Initialize everything
function init() {
    console.log('🎮 Tetris initializing...');
    
    // Load high score
    loadHighScore();
    
    // Initialize renderer
    initRenderer();
    
    // Initialize controls
    initControls();
    
    // Start render loop
    startRenderLoop();
    
    // Start game loop
    requestAnimationFrame(gameLoop);
    
    console.log('✅ Tetris ready! Press Enter to start.');
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
