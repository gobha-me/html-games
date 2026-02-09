/**
 * Snake Logic
 * Manages snake movement, growth, and collision detection
 */

const Snake = {
    // Snake body segments [{x, y}, ...]
    body: [],

    // Current direction
    direction: { x: 1, y: 0 },

    // Next direction (to prevent reverse on same frame)
    nextDirection: { x: 1, y: 0 },

    // Growing flag
    growing: false,

    /**
     * Initialize snake at center of grid
     */
    init() {
        const center = Math.floor(GameState.gridSize / 2);
        this.body = [
            { x: center, y: center },
            { x: center - 1, y: center },
            { x: center - 2, y: center }
        ];
        this.direction = { x: 1, y: 0 };
        this.nextDirection = { x: 1, y: 0 };
        this.growing = false;
    },

    /**
     * Update snake position
     */
    update() {
        // Apply queued direction
        this.direction = { ...this.nextDirection };

        // Calculate new head position
        const head = this.body[0];
        const newHead = {
            x: head.x + this.direction.x,
            y: head.y + this.direction.y
        };

        // Add new head
        this.body.unshift(newHead);

        // Remove tail if not growing
        if (!this.growing) {
            this.body.pop();
        } else {
            this.growing = false;
        }
    },

    /**
     * Set direction (prevent 180-degree turns)
     */
    setDirection(x, y) {
        // Can't reverse direction
        if (x === -this.direction.x && y === -this.direction.y) {
            return;
        }

        // Can't change to same direction
        if (x === this.direction.x && y === this.direction.y) {
            return;
        }

        this.nextDirection = { x, y };
    },

    /**
     * Grow snake by one segment
     */
    grow() {
        this.growing = true;
    },

    /**
     * Get snake head position
     */
    getHead() {
        return this.body[0];
    },

    /**
     * Get snake length
     */
    getLength() {
        return this.body.length;
    },

    /**
     * Check if snake collides with walls
     */
    checkWallCollision() {
        const head = this.getHead();
        return (
            head.x < 0 ||
            head.x >= GameState.gridSize ||
            head.y < 0 ||
            head.y >= GameState.gridSize
        );
    },

    /**
     * Check if snake collides with itself
     */
    checkSelfCollision() {
        const head = this.getHead();
        // Start from index 1 to skip the head
        for (let i = 1; i < this.body.length; i++) {
            if (head.x === this.body[i].x && head.y === this.body[i].y) {
                return true;
            }
        }
        return false;
    },

    /**
     * Check if position collides with snake body
     */
    collidesWithBody(x, y) {
        return this.body.some(segment => segment.x === x && segment.y === y);
    }
};
