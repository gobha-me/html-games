/**
 * Multi-Player Controls
 * Handles input for 2-4 players on the same keyboard
 */

const Controls = {
    // Player configurations with key mappings
    playerKeys: {
        1: {
            name: 'Player 1',
            color: '#00d4ff',
            up: 'ArrowUp',
            down: 'ArrowDown',
            left: 'ArrowLeft',
            right: 'ArrowRight'
        },
        2: {
            name: 'Player 2',
            color: '#00ff88',
            up: 'w',
            down: 's',
            left: 'a',
            right: 'd'
        },
        3: {
            name: 'Player 3',
            color: '#ff00ff',
            up: 'i',
            down: 'k',
            left: 'j',
            right: 'l'
        },
        4: {
            name: 'Player 4',
            color: '#ff8800',
            up: 'Num8',
            down: 'Num5',
            left: 'Num4',
            right: 'Num6'
        }
    },

    // Active players in current game
    activePlayers: [1],

    // Track pressed keys to prevent rapid direction changes
    pressedKeys: new Set(),

    /**
     * Set number of active players
     */
    setActivePlayers(count) {
        this.activePlayers = Array.from({ length: count }, (_, i) => i + 1);
    },

    /**
     * Get keys for a specific player
     */
    getPlayerKeys(playerId) {
        return this.playerKeys[playerId];
    },

    /**
     * Get player ID from key press
     */
    getPlayerFromKey(key) {
        for (const playerId of this.activePlayers) {
            const keys = this.playerKeys[playerId];
            if ([keys.up, keys.down, keys.left, keys.right].includes(key)) {
                return playerId;
            }
        }
        return null;
    },

    /**
     * Get direction from key for a player
     */
    getDirectionFromKey(key, playerId) {
        const keys = this.playerKeys[playerId];
        if (!keys) return null;

        if (key === keys.up) return { x: 0, y: -1 };
        if (key === keys.down) return { x: 0, y: 1 };
        if (key === keys.left) return { x: -1, y: 0 };
        if (key === keys.right) return { x: 1, y: 0 };
        return null;
    },

    /**
     * Handle key down event
     */
    handleKeyDown(event) {
        const key = event.key;
        
        // Prevent default for game keys
        const playerId = this.getPlayerFromKey(key);
        if (playerId !== null) {
            event.preventDefault();
            
            // Prevent key repeat from causing issues
            if (this.pressedKeys.has(key)) {
                return;
            }
            this.pressedKeys.add(key);

            // Get direction and apply to the correct snake
            const direction = this.getDirectionFromKey(key, playerId);
            if (direction) {
                Multiplayer.setPlayerDirection(playerId, direction);
            }
        }
    },

    /**
     * Handle key up event
     */
    handleKeyUp(event) {
        this.pressedKeys.delete(event.key);
    },

    /**
     * Check if a key belongs to any player
     */
    isGameKey(key) {
        return this.getPlayerFromKey(key) !== null;
    },

    /**
     * Get control scheme display info
     */
    getControlScheme() {
        return this.activePlayers.map(id => ({
            playerId: id,
            ...this.playerKeys[id]
        }));
    }
};

// Make Controls globally available
window.Controls = Controls;