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
        Snake.init();
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
     * Reset and start new game
     */
    reset() {
        // Reset state
        GameState.reset();

        // Reinitialize game
        this.init();

        // Show game screen
        this.showScreen('game-screen');

        // Start game
        this.start();
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
