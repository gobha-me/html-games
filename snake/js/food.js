/**
 * Food Logic
 * Manages food spawning and collection
 */

const Food = {
    // Food position
    position: { x: 0, y: 0 },

    /**
     * Spawn food at random position (not on snake)
     */
    spawn() {
        let validPosition = false;
        let newX, newY;

        // Keep trying until we find a valid position
        while (!validPosition) {
            newX = Math.floor(Math.random() * GameState.gridSize);
            newY = Math.floor(Math.random() * GameState.gridSize);

            // Check if position is not occupied by any snake
            if (GameState.isMultiplayer()) {
                // In multiplayer, check against all snakes
                if (!Multiplayer.collidesWithAnySnake(newX, newY)) {
                    validPosition = true;
                }
            } else {
                // Single player - check against single snake
                if (!Snake.collidesWithBody(newX, newY)) {
                    validPosition = true;
                }
            }
        }

        this.position = { x: newX, y: newY };
    },

    /**
     * Check if snake head collides with food
     */
    checkCollision() {
        if (GameState.isMultiplayer()) {
            // In multiplayer, check all players
            return Multiplayer.checkFoodCollision();
        } else {
            // Single player
            const head = Snake.getHead();
            return head.x === this.position.x && head.y === this.position.y;
        }
    },

    /**
     * Check if position collides with any snake (for spawning)
     */
    collidesWithSnake(x, y) {
        if (GameState.isMultiplayer()) {
            return Multiplayer.collidesWithAnySnake(x, y);
        } else {
            return Snake.collidesWithBody(x, y);
        }
    }
};
