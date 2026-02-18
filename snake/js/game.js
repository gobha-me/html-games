/**
 * Game Loop and Logic
 * Manages the main game loop, updates, and game flow
 */

const Game = {
    lastUpdateTime: 0,
    animationFrameId: null,

    /**
     * Initialize game
     */
    init() {
        if (GameState.isMultiplayer()) {
            // Initialize multiplayer
            Multiplayer.initMultiplayer(GameState.playerCount);
        } else {
            // Single player
            Snake.init();
        }
        Food.spawn();
        Renderer.init();
        this.updateUI();
    },

    /**
     * Start game
     */
    start() {
        GameState.currentState = GameState.PLAYING;
        this.lastUpdateTime = performance.now();
        this.loop();
    },

    /**
     * Start multiplayer game with countdown
     */
    startMultiplayer() {
        GameState.currentState = 'countdown';
        
        // Show countdown overlay
        const countdownOverlay = document.getElementById('countdown-overlay');
        if (countdownOverlay) {
            countdownOverlay.style.display = 'flex';
        }
        
        let count = 3;
        const countdownText = document.getElementById('countdown-text');
        
        const interval = setInterval(() => {
            if (countdownText) {
                countdownText.textContent = count > 0 ? count : 'GO!';
            }
            
            if (count < 0) {
                clearInterval(interval);
                if (countdownOverlay) {
                    countdownOverlay.style.display = 'none';
                }
                this.start();
            }
            count--;
        }, 1000);
    },

    /**
     * Game loop
     */
    loop(currentTime = 0) {
        if (GameState.currentState !== GameState.PLAYING) {
            return;
        }

        // Calculate time since last update
        const deltaTime = currentTime - this.lastUpdateTime;

        // Update game at fixed intervals based on speed
        if (deltaTime >= GameState.speed) {
            this.update();
            this.lastUpdateTime = currentTime;
        }

        // Render at 60 FPS
        Renderer.render();

        // Continue loop
        this.animationFrameId = requestAnimationFrame((time) => this.loop(time));
    },

    /**
     * Update game state
     */
    update() {
        if (GameState.isMultiplayer()) {
            this.updateMultiplayer();
        } else {
            this.updateSinglePlayer();
        }
    },

    /**
     * Update single player game
     */
    updateSinglePlayer() {
        // Move snake
        Snake.update();

        // Check collisions
        if (Snake.checkWallCollision() || Snake.checkSelfCollision()) {
            this.gameOver();
            return;
        }

        // Check food collision
        if (Food.checkCollision()) {
            this.eatFood();
        }
    },

    /**
     * Update multiplayer game
     */
    updateMultiplayer() {
        // Update all snakes
        Multiplayer.update();

        // Check collisions
        Multiplayer.checkCollisions();

        // Check if game over (one player left)
        if (Multiplayer.isGameOver()) {
            this.multiplayerGameOver();
            return;
        }

        // Check food collision
        if (Food.checkCollision()) {
            // Spawn new food
            Food.spawn();
            
            // Update UI
            this.updateMultiplayerUI();
        }
    },

    /**
     * Handle eating food
     */
    eatFood() {
        // Grow snake
        Snake.grow();

        // Add score (10 points per food)
        GameState.addScore(10);

        // Increase speed
        GameState.increaseSpeed();

        // Spawn new food
        Food.spawn();

        // Update UI
        this.updateUI();
    },

    /**
     * Pause game
     */
    pause() {
        if (GameState.currentState === GameState.PLAYING) {
            GameState.currentState = GameState.PAUSED;
            cancelAnimationFrame(this.animationFrameId);
            document.getElementById('pause-overlay').style.display = 'flex';
        }
    },

    /**
     * Resume game
     */
    resume() {
        if (GameState.currentState === GameState.PAUSED) {
            GameState.currentState = GameState.PLAYING;
            document.getElementById('pause-overlay').style.display = 'none';
            this.lastUpdateTime = performance.now();
            this.loop();
        }
    },

    /**
     * Toggle pause
     */
    togglePause() {
        if (GameState.currentState === GameState.PLAYING) {
            this.pause();
        } else if (GameState.currentState === GameState.PAUSED) {
            this.resume();
        }
    },

    /**
     * Game over
     */
    gameOver() {
        GameState.currentState = GameState.GAMEOVER;
        cancelAnimationFrame(this.animationFrameId);

        // Update game over screen
        document.getElementById('final-score').textContent = GameState.score;
        document.getElementById('final-length').textContent = Snake.getLength();

        // Show new high score message if applicable
        if (GameState.isNewHighScore()) {
            document.getElementById('new-high-score').style.display = 'block';
        } else {
            document.getElementById('new-high-score').style.display = 'none';
        }

        // Show game over screen
        this.showScreen('gameover-screen');
    },

    /**
     * Multiplayer game over
     */
    multiplayerGameOver() {
        GameState.currentState = GameState.GAMEOVER;
        cancelAnimationFrame(this.animationFrameId);

        // Get winner
        const winner = Multiplayer.winner;
        
        // Update game over screen for multiplayer
        const winnerText = document.getElementById('winner-text');
        const winnerScore = document.getElementById('winner-score');
        
        if (winner) {
            winnerText.textContent = `Player ${winner.id} Wins!`;
            winnerText.style.color = winner.color;
            winnerScore.textContent = `Score: ${winner.score}`;
        } else {
            winnerText.textContent = 'Draw!';
            winnerText.style.color = '#fff';
            winnerScore.textContent = 'All players eliminated!';
        }

        // Show game over screen
        this.showScreen('gameover-screen');
    },

    /**
     * Update multiplayer UI
     */
    updateMultiplayerUI() {
        // Update scoreboard if exists
        for (const player of Multiplayer.players) {
            const scoreEl = document.getElementById(`player${player.id}-score`);
            const statusEl = document.getElementById(`player${player.id}-status`);
            
            if (scoreEl) {
                scoreEl.textContent = player.score;
            }
            if (statusEl) {
                statusEl.textContent = player.alive ? 'Alive' : 'Eliminated';
                statusEl.style.color = player.alive ? '#00ff88' : '#ff4444';
            }
        }
    },

    /**
     * Reset and start new game
     */
    reset() {
        // Reset state
        GameState.reset();

        // Reinitialize game
        this.init();

        // Show game screen
        this.showScreen('game-screen');

        // Start game based on mode
        if (GameState.isMultiplayer()) {
            this.startMultiplayer();
        } else {
            this.start();
        }
    },

    /**
     * Update UI elements
     */
    updateUI() {
        document.getElementById('score').textContent = GameState.score;
        document.getElementById('high-score').textContent = GameState.highScore;
        document.getElementById('length').textContent = Snake.getLength();
    },

    /**
     * Show specific screen
     */
    showScreen(screenId) {
        const screens = ['start-screen', 'game-screen', 'gameover-screen'];
        screens.forEach(id => {
            document.getElementById(id).style.display = 'none';
        });
        document.getElementById(screenId).style.display = 'block';
    }
};
