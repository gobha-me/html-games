/**
 * Pong Game Core Logic
 */

const Game = {
    animationFrameId: null,
    lastUpdateTime: 0,
    countdownTimer: null,
    countdownValue: 3,
    
    /**
     * Start the game with countdown
     */
    start() {
        resetGameState();
        showScreen('game-screen');
        GameState.isPlaying = true;
        GameState.isPaused = false;
        GameState.isCountingDown = true;
        
        // Show countdown
        this.showCountdown();
    },
    
    /**
     * Show countdown before game starts
     */
    showCountdown() {
        const overlay = document.getElementById('countdown-overlay');
        const text = document.getElementById('countdown-text');
        
        overlay.style.display = 'flex';
        this.countdownValue = 3;
        text.textContent = this.countdownValue;
        
        this.countdownTimer = setInterval(() => {
            this.countdownValue--;
            if (this.countdownValue > 0) {
                text.textContent = this.countdownValue;
            } else {
                text.textContent = 'GO!';
                setTimeout(() => {
                    overlay.style.display = 'none';
                    GameState.isCountingDown = false;
                    this.lastUpdateTime = performance.now();
                    this.gameLoop();
                }, 300);
                clearInterval(this.countdownTimer);
            }
        }, 1000);
    },
    
    /**
     * Main game loop
     */
    gameLoop(currentTime = performance.now()) {
        if (!GameState.isPlaying || GameState.isPaused || GameState.isCountingDown) {
            return;
        }
        
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = currentTime;
        
        this.update(deltaTime);
        Renderer.render();
        
        Game.animationFrameId = requestAnimationFrame((t) => this.gameLoop(t));
    },
    
    /**
     * Update game state
     */
    update(deltaTime) {
        // Update paddle positions
        this.updatePaddles();
        
        // Update CPU paddle if in CPU mode
        if (GameState.mode === 'cpu') {
            this.updateCPUPaddle();
        }
        
        // Update ball
        this.updateBall();
    },
    
    /**
     * Update player paddle positions
     */
    updatePaddles() {
        // Player 1 controls (W/S)
        if (GameState.keys.w) {
            GameState.p1Y -= CONFIG.PADDLE_SPEED;
        }
        if (GameState.keys.s) {
            GameState.p1Y += CONFIG.PADDLE_SPEED;
        }
        
        // Clamp P1 position
        GameState.p1Y = Math.max(0, Math.min(CONFIG.CANVAS_HEIGHT - CONFIG.PADDLE_HEIGHT, GameState.p1Y));
        
        // Player 2 controls (Arrow keys)
        if (GameState.keys.ArrowUp) {
            GameState.p2Y -= CONFIG.PADDLE_SPEED;
        }
        if (GameState.keys.ArrowDown) {
            GameState.p2Y += CONFIG.PADDLE_SPEED;
        }
        
        // Clamp P2 position
        GameState.p2Y = Math.max(0, Math.min(CONFIG.CANVAS_HEIGHT - CONFIG.PADDLE_HEIGHT, GameState.p2Y));
    },
    
    /**
     * Update CPU paddle position
     */
    updateCPUPaddle() {
        const ballCenterY = GameState.ballY;
        const paddleCenterY = GameState.p2Y + CONFIG.PADDLE_HEIGHT / 2;
        const diff = ballCenterY - paddleCenterY;
        
        // Get speed based on difficulty
        let speed;
        switch (GameState.difficulty) {
            case 'easy':
                speed = CONFIG.CPU_EASY_SPEED;
                break;
            case 'hard':
                speed = CONFIG.CPU_HARD_SPEED;
                break;
            default:
                speed = CONFIG.CPU_NORMAL_SPEED;
        }
        
        // Move towards ball with some imperfection
        const threshold = 5;
        if (Math.abs(diff) > threshold) {
            if (diff > 0) {
                GameState.p2Y += Math.min(speed, diff);
            } else {
                GameState.p2Y += Math.max(-speed, diff);
            }
        }
        
        // Clamp CPU paddle position
        GameState.p2Y = Math.max(0, Math.min(CONFIG.CANVAS_HEIGHT - CONFIG.PADDLE_HEIGHT, GameState.p2Y));
    },
    
    /**
     * Update ball position and handle collisions
     */
    updateBall() {
        // Move ball
        GameState.ballX += GameState.ballVX;
        GameState.ballY += GameState.ballVY;
        
        // Top/bottom wall collision
        if (GameState.ballY - CONFIG.BALL_SIZE / 2 <= 0) {
            GameState.ballY = CONFIG.BALL_SIZE / 2;
            GameState.ballVY = Math.abs(GameState.ballVY);
        } else if (GameState.ballY + CONFIG.BALL_SIZE / 2 >= CONFIG.CANVAS_HEIGHT) {
            GameState.ballY = CONFIG.CANVAS_HEIGHT - CONFIG.BALL_SIZE / 2;
            GameState.ballVY = -Math.abs(GameState.ballVY);
        }
        
        // Paddle collision - Player 1 (left)
        if (this.checkPaddleCollision(0, GameState.p1Y)) {
            this.handlePaddleBounce(GameState.p1Y, true);
        }
        
        // Paddle collision - Player 2 (right) or CPU
        if (this.checkPaddleCollision(CONFIG.CANVAS_WIDTH - CONFIG.PADDLE_WIDTH, GameState.p2Y)) {
            this.handlePaddleBounce(GameState.p2Y, false);
        }
        
        // Score detection - ball goes past paddles
        if (GameState.ballX - CONFIG.BALL_SIZE / 2 <= 0) {
            // Player 2 scores
            GameState.p2Score++;
            this.checkWin();
            if (!GameState.winner) {
                resetBall();
            }
        } else if (GameState.ballX + CONFIG.BALL_SIZE / 2 >= CONFIG.CANVAS_WIDTH) {
            // Player 1 scores
            GameState.p1Score++;
            this.checkWin();
            if (!GameState.winner) {
                resetBall();
            }
        }
    },
    
    /**
     * Check if ball collides with paddle
     */
    checkPaddleCollision(paddleX, paddleY) {
        const ballLeft = GameState.ballX - CONFIG.BALL_SIZE / 2;
        const ballRight = GameState.ballX + CONFIG.BALL_SIZE / 2;
        const ballTop = GameState.ballY - CONFIG.BALL_SIZE / 2;
        const ballBottom = GameState.ballY + CONFIG.BALL_SIZE / 2;
        
        const paddleRight = paddleX + CONFIG.PADDLE_WIDTH;
        const paddleBottom = paddleY + CONFIG.PADDLE_HEIGHT;
        
        return ballLeft < paddleRight && 
               ballRight > paddleX && 
               ballTop < paddleBottom && 
               ballBottom > paddleY;
    },
    
    /**
     * Handle ball bouncing off paddle
     */
    handlePaddleBounce(paddleY, isLeftPaddle) {
        const paddleCenterY = paddleY + CONFIG.PADDLE_HEIGHT / 2;
        const ballCenterY = GameState.ballY;
        const relativeIntersectY = (paddleCenterY - ballCenterY) / (CONFIG.PADDLE_HEIGHT / 2);
        
        // Calculate bounce angle (max 60 degrees)
        const bounceAngle = relativeIntersectY * (Math.PI / 3);
        
        // Increase ball speed
        GameState.ballSpeed = Math.min(CONFIG.BALL_MAX_SPEED, GameState.ballSpeed + CONFIG.BALL_SPEED_INCREMENT);
        
        // Set new velocity
        const direction = isLeftPaddle ? 1 : -1;
        GameState.ballVX = GameState.ballSpeed * Math.cos(bounceAngle) * direction;
        GameState.ballVY = -GameState.ballSpeed * Math.sin(bounceAngle);
        
        // Prevent ball from getting stuck inside paddle
        if (isLeftPaddle) {
            GameState.ballX = CONFIG.PADDLE_WIDTH + CONFIG.BALL_SIZE / 2;
        } else {
            GameState.ballX = CONFIG.CANVAS_WIDTH - CONFIG.PADDLE_WIDTH - CONFIG.BALL_SIZE / 2;
        }
    },
    
    /**
     * Check for win condition
     */
    checkWin() {
        if (GameState.p1Score >= GameState.winScore) {
            this.endGame('Player 1');
        } else if (GameState.p2Score >= GameState.winScore) {
            if (GameState.mode === 'cpu') {
                this.endGame('CPU');
            } else {
                this.endGame('Player 2');
            }
        }
    },
    
    /**
     * End the game
     */
    endGame(winner) {
        GameState.isPlaying = false;
        GameState.winner = winner;
        GameState.winnerScore = winner === 'Player 1' ? GameState.p1Score : GameState.p2Score;
        
        // Check for high score (only in CPU mode)
        if (GameState.mode === 'cpu') {
            GameState.isNewHighScore = saveHighScore(GameState.winnerScore);
        }
        
        // Stop game loop
        if (Game.animationFrameId) {
            cancelAnimationFrame(Game.animationFrameId);
        }
        
        // Show game over screen
        showScreen('gameover-screen');
        Renderer.updateGameOver();
    },
    
    /**
     * Toggle pause state
     */
    togglePause() {
        if (!GameState.isPlaying || GameState.isCountingDown) {
            return;
        }
        
        GameState.isPaused = !GameState.isPaused;
        
        const pauseOverlay = document.getElementById('pause-overlay');
        pauseOverlay.style.display = GameState.isPaused ? 'flex' : 'none';
        
        if (!GameState.isPaused) {
            this.lastUpdateTime = performance.now();
            this.gameLoop();
        }
    },
    
    /**
     * Stop the game
     */
    stop() {
        GameState.isPlaying = false;
        if (Game.animationFrameId) {
            cancelAnimationFrame(Game.animationFrameId);
        }
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
        }
    },
};

// Export for use in other modules
window.Game = Game;