/**
 * Pong Game Controls Handler
 */

const Controls = {
    /**
     * Initialize keyboard controls
     */
    init() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    },
    
    /**
     * Handle key down events
     */
    handleKeyDown(e) {
        // Track key states
        switch (e.key.toLowerCase()) {
            case 'w':
                GameState.keys.w = true;
                e.preventDefault();
                break;
            case 's':
                GameState.keys.s = true;
                e.preventDefault();
                break;
            case 'arrowup':
                GameState.keys.ArrowUp = true;
                e.preventDefault();
                break;
            case 'arrowdown':
                GameState.keys.ArrowDown = true;
                e.preventDefault();
                break;
            case ' ':
            case 'p':
                if (GameState.isPlaying) {
                    Game.togglePause();
                    e.preventDefault();
                }
                break;
        }
    },
    
    /**
     * Handle key up events
     */
    handleKeyUp(e) {
        switch (e.key.toLowerCase()) {
            case 'w':
                GameState.keys.w = false;
                break;
            case 's':
                GameState.keys.s = false;
                break;
            case 'arrowup':
                GameState.keys.ArrowUp = false;
                break;
            case 'arrowdown':
                GameState.keys.ArrowDown = false;
                break;
        }
    },
    
    /**
     * Clear all key states
     */
    clearKeys() {
        GameState.keys.w = false;
        GameState.keys.s = false;
        GameState.keys.ArrowUp = false;
        GameState.keys.ArrowDown = false;
    },
};

// Export for use in other modules
window.Controls = Controls;