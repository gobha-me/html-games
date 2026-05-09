/**
 * Tetris Input Handler
 * Keyboard controls with DAS/ARR support.
 */

function initControls() {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
}

function handleKeyDown(e) {
    // Prevent default for game keys
    const gameKeys = [
        'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp',
        'Space', 'KeyC', 'KeyP', 'Enter',
    ];
    
    if (gameKeys.includes(e.code)) {
        e.preventDefault();
    }
    
    // Ignore if key is already held
    if (GameState.keys[e.code]) return;
    
    GameState.keys[e.code] = true;
    
    // Handle instant actions
    switch (e.code) {
        case 'Enter':
            if (!GameState.isPlaying || GameState.isGameOver) {
                startGame();
            }
            break;
            
        case 'KeyP':
        case 'Escape':
            togglePause();
            break;
            
        case 'ArrowLeft':
            moveLeft();
            break;
            
        case 'ArrowRight':
            moveRight();
            break;
            
        case 'ArrowUp':
        case 'KeyX':
            rotate(1); // CW
            break;
            
        case 'KeyZ':
        case 'ControlLeft':
        case 'ControlRight':
            rotate(-1); // CCW
            break;
            
        case 'Space':
            hardDrop();
            break;
            
        case 'KeyC':
        case 'ShiftLeft':
        case 'ShiftRight':
            holdCurrentPiece();
            break;
    }
}

function handleKeyUp(e) {
    GameState.keys[e.code] = false;
    
    // Reset DAS state on key release
    delete GameState.dasTimer[e.code];
    delete GameState.arrTimer[e.code];
    GameState.dasActive[e.code] = false;
}

// Export
window.initControls = initControls;
window.handleKeyDown = handleKeyDown;
window.handleKeyUp = handleKeyUp;
