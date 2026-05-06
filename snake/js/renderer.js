/**
 * Renderer
 * Handles all canvas drawing operations
 */

const Renderer = {
    canvas: null,
    ctx: null,

    // Colors matching theme
    colors: {
        background: '#0f1419',
        grid: '#1a1a2e',
        snake: '#00d4ff',
        snakeHead: '#00ffff',
        food: '#ff4444',
        foodGlow: 'rgba(255, 68, 68, 0.5)'
    },

    // Player colors for multiplayer
    playerColors: {
        1: { body: '#00d4ff', head: '#00ffff', glow: 'rgba(0, 212, 255, 0.5)' },
        2: { body: '#00ff88', head: '#66ffaa', glow: 'rgba(0, 255, 136, 0.5)' },
        3: { body: '#ff00ff', head: '#ff66ff', glow: 'rgba(255, 0, 255, 0.5)' },
        4: { body: '#ff8800', head: '#ffaa66', glow: 'rgba(255, 136, 0, 0.5)' }
    },

    /**
     * Initialize renderer
     */
    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        // Set canvas size
        const size = GameState.gridSize * GameState.cellSize;
        this.canvas.width = size;
        this.canvas.height = size;
    },

    /**
     * Clear canvas
     */
    clear() {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },

    /**
     * Draw grid (subtle)
     */
    drawGrid() {
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 0.5;

        for (let i = 0; i <= GameState.gridSize; i++) {
            const pos = i * GameState.cellSize;

            // Vertical lines
            this.ctx.beginPath();
            this.ctx.moveTo(pos, 0);
            this.ctx.lineTo(pos, this.canvas.height);
            this.ctx.stroke();

            // Horizontal lines
            this.ctx.beginPath();
            this.ctx.moveTo(0, pos);
            this.ctx.lineTo(this.canvas.width, pos);
            this.ctx.stroke();
        }
    },

    /**
     * Draw a single snake with specified color
     */
    drawSnakeBody(body, colors) {
        body.forEach((segment, index) => {
            const x = segment.x * GameState.cellSize;
            const y = segment.y * GameState.cellSize;

            // Head is brighter
            if (index === 0) {
                this.ctx.fillStyle = colors.head;
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = colors.glow;
            } else {
                this.ctx.fillStyle = colors.body;
                this.ctx.shadowBlur = 5;
                this.ctx.shadowColor = colors.glow;
            }

            // Draw rounded rectangle
            this.roundRect(
                x + 1,
                y + 1,
                GameState.cellSize - 2,
                GameState.cellSize - 2,
                4
            );

            // Reset shadow
            this.ctx.shadowBlur = 0;
        });
    },

    /**
     * Draw ghost trail for a single snake
     */
    drawGhostTrail(body, color, trailLength) {
        if (!GameState.ghostTrail || body.length < 2) return;

        const segments = Math.min(trailLength, body.length - 1);
        const cellSize = GameState.cellSize;

        for (let i = 1; i <= segments; i++) {
            const segment = body[i];
            const x = segment.x * cellSize;
            const y = segment.y * cellSize;
            // Alpha fades from 0.4 down to 0 across the trail
            const alpha = 0.4 * (1 - (i - 1) / segments);

            this.ctx.fillStyle = this.hexToRgba(color, alpha);
            this.roundRect(
                x + 1,
                y + 1,
                cellSize - 2,
                cellSize - 2,
                4
            );
        }
    },

    /**
     * Convert hex color to rgba string
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    /**
     * Draw snake(s)
     */
    drawSnake() {
        if (GameState.isMultiplayer()) {
            // Draw all player snakes
            for (const player of Multiplayer.players) {
                if (!player.alive) continue;
                const colors = this.playerColors[player.id];
                this.drawGhostTrail(player.snake.body, colors.body, GameState.ghostTrailLength);
                this.drawSnakeBody(player.snake.body, colors);
            }
        } else {
            // Single player - draw single snake
            const snakeColors = {
                body: this.colors.snake,
                head: this.colors.snakeHead,
                glow: this.colors.snake
            };
            this.drawGhostTrail(Snake.body, this.colors.snake, GameState.ghostTrailLength);
            this.drawSnakeBody(Snake.body, snakeColors);
        }
    },

    /**
     * Draw food
     */
    drawFood() {
        const x = Food.position.x * GameState.cellSize;
        const y = Food.position.y * GameState.cellSize;
        const centerX = x + GameState.cellSize / 2;
        const centerY = y + GameState.cellSize / 2;
        const radius = GameState.cellSize / 2 - 2;

        // Glow effect
        const gradient = this.ctx.createRadialGradient(
            centerX, centerY, 0,
            centerX, centerY, radius * 2
        );
        gradient.addColorStop(0, this.colors.food);
        gradient.addColorStop(0.5, this.colors.foodGlow);
        gradient.addColorStop(1, 'transparent');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius * 1.5, 0, Math.PI * 2);
        this.ctx.fill();

        // Food circle
        this.ctx.fillStyle = this.colors.food;
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.colors.food;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    },

    /**
     * Draw rounded rectangle
     */
    roundRect(x, y, width, height, radius) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
        this.ctx.fill();
    },

    /**
     * Render game frame
     */
    render() {
        this.clear();
        this.drawGrid();
        this.drawFood();
        this.drawSnake();
    }
};
