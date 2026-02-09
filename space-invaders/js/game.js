// Main Game State and Loop
const Game = {
    state: 'start', // 'start', 'playing', 'paused', 'gameover'
    score: 0,
    highScore: 0,
    wave: 1,
    aliensKilled: 0,
    lastUpdateTime: 0,
    animationFrameId: null,
    keys: {},

    init() {
        // Load high score from localStorage
        this.highScore = parseInt(localStorage.getItem('spaceInvadersHighScore')) || 0;
        
        // Initialize audio
        AudioManager.init();
        
        // Initialize renderer
        Renderer.init();
        
        // Update UI
        this.updateHighScoreDisplay();
    },

    start() {
        this.state = 'playing';
        this.score = 0;
        this.wave = 1;
        this.aliensKilled = 0;
        this.keys = {};
        
        // Initialize game entities
        Player.init(Renderer.width, Renderer.height);
        AlienManager.init(this.wave);
        BarrierManager.init(Renderer.width, Renderer.height);
        ProjectileManager.clear();
        UFO.init();
        
        // Update UI
        this.updateUI();
        
        // Start game loop
        this.lastUpdateTime = performance.now();
        this.gameLoop();
    },

    gameLoop() {
        if (this.state !== 'playing' && this.state !== 'paused') return;

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
        this.lastUpdateTime = currentTime;

        if (this.state === 'playing') {
            this.update(deltaTime);
        }
        
        this.render();
        
        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
    },

    update(deltaTime) {
        // Handle input
        this.handleInput(deltaTime);
        
        // Update entities
        Player.update(deltaTime, Renderer.width);
        AlienManager.update(deltaTime, Renderer.width, Renderer.height);
        ProjectileManager.update(deltaTime, Renderer.height);
        UFO.update(deltaTime, Renderer.width);
        
        // Check collisions
        this.checkCollisions();
        
        // Check win/lose conditions
        this.checkGameState();
        
        // Update UI
        this.updateUI();
    },

    handleInput(deltaTime) {
        if (this.keys['ArrowLeft'] || this.keys['a'] || this.keys['A']) {
            Player.moveLeft(deltaTime);
        }
        if (this.keys['ArrowRight'] || this.keys['d'] || this.keys['D']) {
            Player.moveRight(deltaTime);
        }
    },

    checkCollisions() {
        // Player projectiles vs aliens
        const playerProjectiles = ProjectileManager.getPlayerProjectiles();
        const points = AlienManager.checkCollisions(playerProjectiles);
        if (points > 0) {
            this.score += points;
            this.aliensKilled++;
            if (this.score > this.highScore) {
                this.highScore = this.score;
                this.saveHighScore();
            }
        }
        
        // Player projectiles vs UFO
        const ufoPoints = UFO.checkCollision(playerProjectiles);
        if (ufoPoints > 0) {
            this.score += ufoPoints;
            if (this.score > this.highScore) {
                this.highScore = this.score;
                this.saveHighScore();
            }
        }
        
        // Projectiles vs barriers
        BarrierManager.checkCollisions(ProjectileManager.projectiles);
        
        // Alien projectiles vs player
        const alienProjectiles = ProjectileManager.getAlienProjectiles();
        alienProjectiles.forEach(proj => {
            if (!proj.active) return;
            
            const playerBounds = Player.getBounds();
            const projBounds = proj.getBounds();
            
            if (this.checkCollision(projBounds, playerBounds)) {
                proj.active = false;
                Player.hit();
            }
        });
    },

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    },

    checkGameState() {
        // Check if player lost all lives
        if (!Player.isAlive()) {
            this.gameOver();
            return;
        }
        
        // Check if aliens reached bottom
        if (AlienManager.hasReachedBottom(Renderer.height)) {
            this.gameOver();
            return;
        }
        
        // Check if all aliens destroyed
        if (AlienManager.allDestroyed()) {
            this.nextWave();
        }
    },

    nextWave() {
        this.wave++;
        AudioManager.playSound('newWave');
        
        // Reinitialize for next wave
        AlienManager.init(this.wave);
        BarrierManager.init(Renderer.width, Renderer.height);
        ProjectileManager.clear();
        
        // Brief pause
        this.state = 'paused';
        setTimeout(() => {
            if (this.state === 'paused') {
                this.state = 'playing';
            }
        }, 2000);
    },

    gameOver() {
        this.state = 'gameover';
        AudioManager.playSound('gameOver');
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        // Show game over screen
        this.showScreen('gameover-screen');
        
        // Update final stats
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('final-wave').textContent = this.wave - 1;
        document.getElementById('aliens-killed').textContent = this.aliensKilled;
        
        // Check for new high score
        const newHighScore = document.getElementById('new-high-score');
        if (this.score >= this.highScore && this.score > 0) {
            newHighScore.style.display = 'block';
        } else {
            newHighScore.style.display = 'none';
        }
    },

    pause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            document.getElementById('pause-overlay').style.display = 'flex';
        } else if (this.state === 'paused') {
            this.state = 'playing';
            document.getElementById('pause-overlay').style.display = 'none';
            this.lastUpdateTime = performance.now();
        }
    },

    render() {
        Renderer.render();
    },

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('high-score').textContent = this.highScore;
        document.getElementById('wave').textContent = this.wave;
        
        // Update lives display
        const hearts = '❤️'.repeat(Math.max(0, Player.lives));
        document.getElementById('lives').textContent = hearts || '💀';
    },

    updateHighScoreDisplay() {
        document.getElementById('menu-high-score').textContent = this.highScore;
    },

    saveHighScore() {
        localStorage.setItem('spaceInvadersHighScore', this.highScore.toString());
    },

    showScreen(screenId) {
        const screens = ['start-screen', 'game-screen', 'gameover-screen'];
        screens.forEach(id => {
            document.getElementById(id).style.display = id === screenId ? 'block' : 'none';
        });
    }
};
