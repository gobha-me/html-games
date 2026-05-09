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
    playerMode: '1p', // '1p' or '2p'
    init() {
        // Initialize high score table
        HighScoreManager.init();
        this.highScore = HighScoreManager.getTopScore();
        
        // Initialize audio
        AudioManager.init();
        
        // Initialize renderer
        Renderer.init();
        
        // Update UI
        this.updateHighScoreDisplay();
    },

    start(mode = '1p') {
        this.playerMode = mode;
        this.state = 'playing';
        this.score = 0;
        this.wave = 1;
        this.aliensKilled = 0;
        this.keys = {};
        
        // Initialize game entities
        PlayerManager.init(Renderer.width, Renderer.height, mode);
        AlienManager.init(this.wave);
        BarrierManager.init(Renderer.width, Renderer.height);
        ProjectileManager.clear();
        UFO.init();
        
        // Show/hide P2 lives indicator
        const p2Stat = document.getElementById('p2-lives-stat');
        if (p2Stat) p2Stat.style.display = mode === '2p' ? 'block' : 'none';
        
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
        PlayerManager.update(deltaTime, Renderer.width);
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
        // P1 controls: Arrow keys (always)
        if (this.keys['ArrowLeft']) {
            PlayerManager.getP1().moveLeft(deltaTime);
        }
        if (this.keys['ArrowRight']) {
            PlayerManager.getP1().moveRight(deltaTime);
        }

        // P2 controls: A/D keys (only in 2P mode)
        if (this.playerMode === '2p') {
            const p2 = PlayerManager.getP2();
            if (p2) {
                if (this.keys['a'] || this.keys['A']) {
                    p2.moveLeft(deltaTime);
                }
                if (this.keys['d'] || this.keys['D']) {
                    p2.moveRight(deltaTime);
                }
            }
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
        
        // Alien projectiles vs players (handles both players in 2P mode)
        const alienProjectiles = ProjectileManager.getAlienProjectiles();
        PlayerManager.checkPlayerCollisions(alienProjectiles);
    },

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    },

    checkGameState() {
        // Check if all players lost all lives
        if (PlayerManager.allDead()) {
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
        
        // Check if score qualifies for top 10
        const initialsSection = document.getElementById('initials-section');
        const newHighScore = document.getElementById('new-high-score');
        
        if (HighScoreManager.qualifies(this.score) && this.score > 0) {
            // Show initials input
            initialsSection.style.display = 'block';
            newHighScore.style.display = 'none';
            const input = document.getElementById('initials-input');
            input.value = '';
            setTimeout(() => input.focus(), 100);
        } else if (this.score >= this.highScore && this.score > 0) {
            // Legacy: beat the single high score but not top 10
            newHighScore.style.display = 'block';
            initialsSection.style.display = 'none';
        } else {
            newHighScore.style.display = 'none';
            initialsSection.style.display = 'none';
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
        
        // Update P1 lives display
        const p1 = PlayerManager.getP1();
        const p1Hearts = '❤️'.repeat(Math.max(0, p1.lives));
        document.getElementById('lives').textContent = p1Hearts || '💀';
        
        // Update P2 lives display (2P mode only)
        if (this.playerMode === '2p') {
            const p2 = PlayerManager.getP2();
            if (p2) {
                const p2Hearts = '❤️'.repeat(Math.max(0, p2.lives));
                document.getElementById('p2-lives').textContent = p2Hearts || '💀';
            }
        }
    },

    updateHighScoreDisplay() {
        this.highScore = HighScoreManager.getTopScore();
        document.getElementById('menu-high-score').textContent = this.highScore;
        document.getElementById('high-score').textContent = this.highScore;
    },

    saveHighScore() {
        // Delegated to HighScoreManager
        this.highScore = HighScoreManager.getTopScore();
    },

    /**
     * Render the high scores table on the high scores screen.
     * @param {number|null} highlightRank - 1-based rank to highlight, or null
     */
    renderHighScores(highlightRank) {
        const entries = HighScoreManager.getAll();
        const container = document.getElementById('hs-entries');
        const empty = document.getElementById('hs-empty');

        container.innerHTML = '';
        if (entries.length === 0) {
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        entries.forEach((entry, i) => {
            const row = document.createElement('div');
            row.className = 'hs-entry' + (highlightRank === i + 1 ? ' highlight' : '');
            const mode = entry.mode || '1p';
            const modeLabel = mode === '2p' ? '2P' : '1P';
            const modeClass = mode === '2p' ? 'mode-2p' : 'mode-1p';
            row.innerHTML = `
                <span class="hs-rank">${i + 1}</span>
                <span class="hs-name">${entry.initials}<span class="hs-mode-badge ${modeClass}">${modeLabel}</span></span>
                <span class="hs-score">${entry.score.toLocaleString()}</span>
            `;
        });
    },
    showScreen(screenId) {
        const screens = ['start-screen', 'game-screen', 'gameover-screen', 'highscores-screen'];
        screens.forEach(id => {
            document.getElementById(id).style.display = id === screenId ? 'block' : 'none';
        });
    }
};
