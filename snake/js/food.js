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

            // Check if position is not occupied by snake
            if (!Snake.collidesWithBody(newX, newY)) {
                validPosition = true;
            }
        }

        this.position = { x: newX, y: newY };
    },

    /**
     * Check if snake head collides with food
     */
    checkCollision() {
        const head = Snake.getHead();
        return head.x === this.position.x && head.y === this.position.y;
    }
};
