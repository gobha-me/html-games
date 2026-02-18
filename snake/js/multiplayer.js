/**
 * Multiplayer Game Logic
 * Manages multiplayer game state, players, and win conditions
 */

const Multiplayer = {
    // Player configurations
    playerConfigs: {
        1: { color: '#00d4ff', glowColor: 'rgba(0, 212, 255, 0.5)' },
        2: { color: '#00ff88', glowColor: 'rgba(0, 255, 136, 0.5)' },
        3: { color: '#ff00ff', glowColor: 'rgba(255, 0, 255, 0.5)' },
        4: { color: '#ff8800', glowColor: 'rgba(255, 136, 0, 0.5)' }
    },

    // Active players array
    players: [],

    // Number of players
    playerCount: 2,

    // Game mode
    gameMode: 'single', // 'single' or 'multiplayer'

    // Winner
    winner: null,

    // Countdown state
    countdown: 0,
    countdownInterval: null,

    /**
     * Initialize multiplayer with specified number of players
     */
    initMultiplayer(count) {
        this.playerCount = Math.max(2, Math.min(4, count));
        this.gameMode = 'multiplayer';
        this.winner = null;
        this.players = [];

        // Create players
        for (let i = 1; i <= this.playerCount; i++) {
            this.players.push({
                id: i,
                snake: this.createSnake(i),
                score: 0,
                alive: true,
                color: this.playerConfigs[i].color,
                glowColor: this.playerConfigs[i].glowColor
            });
        }

        // Set active controls
        Controls.setActivePlayers(this.playerCount);
    },

    /**
     * Create a snake for a specific player
     * Positions snakes in different corners
     */
    createSnake(playerId) {
        const center = Math.floor(GameState.gridSize / 2);
        const offset = playerId - 2;
        
        // Different starting positions for each player
        const positions = [
            { x: center, y: center },           // Player 1: center
            { x: 5, y: 5 },                      // Player 2: top-left
            { x: GameState.gridSize - 6, y: 5 }, // Player 3: top-right
            { x: 5, y: GameState.gridSize - 6 }  // Player 4: bottom-left
        ];

        const startPos = positions[playerId - 1] || positions[0];

        return {
            body: [
                { x: startPos.x, y: startPos.y },
                { x: startPos.x - 1, y: startPos.y },
                { x: startPos.x - 2, y: startPos.y }
            ],
            direction: { x: 1, y: 0 },
            nextDirection: { x: 1, y: 0 },
            growing: false
        };
    },

    /**
     * Reset to single player mode
     */
    resetToSinglePlayer() {
        this.gameMode = 'single';
        this.playerCount = 1;
        this.winner = null;
        this.players = [];
        Controls.setActivePlayers(1);
    },

    /**
     * Set direction for a specific player
     */
    setPlayerDirection(playerId, direction) {
        const player = this.players.find(p => p.id === playerId);
        if (!player || !player.alive) return;

        const snake = player.snake;

        // Can't reverse direction
        if (direction.x === -snake.direction.x && direction.y === -snake.direction.y) {
            return;
        }

        // Can't change to same direction
        if (direction.x === snake.direction.x && direction.y === snake.direction.y) {
            return;
        }

        snake.nextDirection = { ...direction };
    },

    /**
     * Update all alive snakes
     */
    update() {
        for (const player of this.players) {
            if (!player.alive) continue;

            const snake = player.snake;

            // Apply queued direction
            snake.direction = { ...snake.nextDirection };

            // Calculate new head position
            const head = snake.body[0];
            const newHead = {
                x: head.x + snake.direction.x,
                y: head.y + snake.direction.y
            };

            // Add new head
            snake.body.unshift(newHead);

            // Remove tail if not growing
            if (!snake.growing) {
                snake.body.pop();
            } else {
                snake.growing = false;
            }
        }
    },

    /**
     * Check collisions for all players
     */
    checkCollisions() {
        const alivePlayers = this.players.filter(p => p.alive);

        for (const player of alivePlayers) {
            const snake = player.snake;
            const head = snake.body[0];

            // Wall collision
            if (head.x < 0 || head.x >= GameState.gridSize ||
                head.y < 0 || head.y >= GameState.gridSize) {
                player.alive = false;
                continue;
            }

            // Self collision
            for (let i = 1; i < snake.body.length; i++) {
                if (head.x === snake.body[i].x && head.y === snake.body[i].y) {
                    player.alive = false;
                    break;
                }
            }

            // Collision with other snakes
            if (player.alive) {
                for (const otherPlayer of this.players) {
                    if (otherPlayer.id === player.id) continue;
                    
                    for (let i = 0; i < otherPlayer.snake.body.length; i++) {
                        if (head.x === otherPlayer.snake.body[i].x && 
                            head.y === otherPlayer.snake.body[i].y) {
                            player.alive = false;
                            break;
                        }
                    }
                    if (!player.alive) break;
                }
            }
        }
    },

    /**
     * Check if any player ate food
     */
    checkFoodCollision() {
        const foodPos = Food.position;
        let foodEaten = false;

        for (const player of this.players) {
            if (!player.alive) continue;

            const head = player.snake.body[0];
            if (head.x === foodPos.x && head.y === foodPos.y) {
                // Grow snake
                player.snake.growing = true;
                player.score += 10;
                foodEaten = true;
            }
        }

        return foodEaten;
    },

    /**
     * Get all snake bodies for food collision checking
     */
    getAllSnakeBodies() {
        const bodies = [];
        for (const player of this.players) {
            if (player.alive) {
                bodies.push(...player.snake.body);
            }
        }
        return bodies;
    },

    /**
     * Check if position collides with any snake
     */
    collidesWithAnySnake(x, y) {
        for (const player of this.players) {
            if (!player.alive) continue;
            for (const segment of player.snake.body) {
                if (x === segment.x && y === segment.y) {
                    return true;
                }
            }
        }
        return false;
    },

    /**
     * Check if game is over (one player left or all dead)
     */
    isGameOver() {
        const alivePlayers = this.players.filter(p => p.alive);
        
        if (alivePlayers.length <= 1) {
            // Game over - determine winner
            if (alivePlayers.length === 1) {
                this.winner = alivePlayers[0];
            } else {
                // All players died - no winner
                this.winner = null;
            }
            return true;
        }
        return false;
    },

    /**
     * Get alive players count
     */
    getAliveCount() {
        return this.players.filter(p => p.alive).length;
    },

    /**
     * Start countdown before game
     */
    startCountdown(callback) {
        this.countdown = 3;
        
        this.countdownInterval = setInterval(() => {
            this.countdown--;
            
            if (this.countdown <= 0) {
                clearInterval(this.countdownInterval);
                this.countdownInterval = null;
            }
            
            if (callback) callback(this.countdown);
        }, 1000);
    },

    /**
     * Stop countdown
     */
    stopCountdown() {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        this.countdown = 0;
    },

    /**
     * Get player by ID
     */
    getPlayer(playerId) {
        return this.players.find(p => p.id === playerId);
    },

    /**
     * Check if in multiplayer mode
     */
    isMultiplayer() {
        return this.gameMode === 'multiplayer';
    }
};

// Make Multiplayer globally available
window.Multiplayer = Multiplayer;