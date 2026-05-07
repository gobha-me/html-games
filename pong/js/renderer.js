/**
 * Pong Game Renderer
 */

const Renderer = {
    canvas: null,
    ctx: null,
    
    /**
     * Initialize the renderer
     */
    init() {
        this.canvas = document.getElementById('game-canvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.canvas.width = CONFIG.CANVAS_WIDTH;
            this.canvas.height = CONFIG.CANVAS_HEIGHT;
        }
    },
    
    /**
     * Main render function
     */
    render() {
        if (!this.ctx) return;
        
        // Clear canvas
        this.clearCanvas();
        
        // Draw center line
        this.drawCenterLine();
        
        // Draw paddles
        this.drawPaddle(0, GameState.p1Y, '#00d4ff'); // Player 1 - cyan
        this.drawPaddle(CONFIG.CANVAS_WIDTH - CONFIG.PADDLE_WIDTH, GameState.p2Y,
            GameState.mode === 'cpu' ? '#ff6b6b' : '#00ff88'); // Player 2/CPU
        
        // Draw ball
        this.drawBall();
        
        // Update score display
        this.updateScoreDisplay();
    },
    
    /**
     * Clear the canvas
     */
    clearCanvas() {
        this.ctx.fillStyle = '#0a0a12';
        this.ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    },
    
    /**
     * Draw center dashed line
     */
    drawCenterLine() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 4;
        this.ctx.setLineDash([15, 15]);
        this.ctx.beginPath();
        this.ctx.moveTo(CONFIG.CANVAS_WIDTH / 2, 0);
        this.ctx.lineTo(CONFIG.CANVAS_WIDTH / 2, CONFIG.CANVAS_HEIGHT);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    },
    
    /**
     * Draw a paddle
     */
    drawPaddle(x, y, color) {
        this.ctx.fillStyle = color;
        
        // Add glow effect
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 15;
        
        // Draw paddle with rounded corners
        const radius = 6;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, CONFIG.PADDLE_WIDTH, CONFIG.PADDLE_HEIGHT, radius);
        this.ctx.fill();
        
        // Reset shadow
        this.ctx.shadowBlur = 0;
        
        // Add inner highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.roundRect(x + 2, y + 2, CONFIG.PADDLE_WIDTH - 4, CONFIG.PADDLE_HEIGHT - 4, radius - 2);
        this.ctx.fill();
    },
    
    /**
     * Draw the ball
     */
    drawBall() {
        const x = GameState.ballX;
        const y = GameState.ballY;
        const size = CONFIG.BALL_SIZE;
        
        // Glow effect
        this.ctx.shadowColor = '#ffffff';
        this.ctx.shadowBlur = 20;
        
        // Draw ball
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Reset shadow
        this.ctx.shadowBlur = 0;
        
        // Inner highlight
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(x - 2, y - 2, size / 4, 0, Math.PI * 2);
        this.ctx.fill();
    },
    
    /**
     * Update score display
     */
    updateScoreDisplay() {
        document.getElementById('p1-score').textContent = GameState.p1Score;
        document.getElementById('p2-score').textContent = GameState.p2Score;
        document.getElementById('high-score').textContent = GameState.highScore;
    },
    
    /**
     * Update game over screen
     */
    updateGameOver() {
        const titleEl = document.getElementById('gameover-title');
        const textEl = document.getElementById('winner-text');
        const scoreEl = document.getElementById('winner-score');
        const newHighScoreEl = document.getElementById('new-high-score');
        
        if (titleEl) {
            titleEl.textContent = `🏆 ${GameState.winner} WINS!`;
        }
        
        if (textEl) {
            textEl.textContent = `${GameState.winner} Wins!`;
        }
        
        if (scoreEl) {
            scoreEl.textContent = `Score: ${GameState.winnerScore}`;
        }
        
        if (newHighScoreEl) {
            newHighScoreEl.style.display = GameState.isNewHighScore ? 'block' : 'none';
        }
    },
};

// Export for use in other modules
window.Renderer = Renderer;