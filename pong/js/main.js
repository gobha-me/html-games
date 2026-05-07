/**
 * Pong Game Main Entry Point
 */

const PongGame = {
    /**
     * Initialize the game
     */
    init() {
        // Load high score
        loadHighScore();
        document.getElementById('menu-high-score').textContent = GameState.highScore;
        
        // Initialize renderer
        Renderer.init();
        
        // Initialize controls
        Controls.init();
        
        // Set up menu event listeners
        this.setupMenuListeners();
        
        console.log('🏓 Pong initialized');
    },
    
    /**
     * Set up menu event listeners
     */
    setupMenuListeners() {
        // Mode selection
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                GameState.mode = e.target.dataset.mode;
                
                // Toggle difficulty visibility
                const difficultySection = document.querySelector('.difficulty-buttons').parentElement;
                const controlsPreview = document.getElementById('controls-preview');
                const cpuControlsPreview = document.getElementById('cpu-controls-preview');
                
                if (GameState.mode === '2p') {
                    difficultySection.style.display = 'none';
                    controlsPreview.style.display = 'block';
                    cpuControlsPreview.style.display = 'none';
                } else {
                    difficultySection.style.display = 'block';
                    controlsPreview.style.display = 'none';
                    cpuControlsPreview.style.display = 'block';
                }
            });
        });
        
        // Difficulty selection
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                GameState.difficulty = e.target.dataset.difficulty;
            });
        });
        
        // Win score selection
        document.querySelectorAll('.win-score-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.win-score-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                GameState.winScore = parseInt(e.target.dataset.score, 10);
            });
        });
        
        // Start button
        document.getElementById('start-btn').addEventListener('click', () => {
            Controls.clearKeys();
            Game.start();
        });
        
        // Pause button
        document.getElementById('pause-btn').addEventListener('click', () => {
            Game.togglePause();
        });
        
        // Play again button
        document.getElementById('play-again-btn').addEventListener('click', () => {
            Controls.clearKeys();
            Game.start();
        });
        
        // Menu button
        document.getElementById('menu-btn').addEventListener('click', () => {
            Game.stop();
            Controls.clearKeys();
            resetGameState();
            document.getElementById('menu-high-score').textContent = GameState.highScore;
            showScreen('start-screen');
        });
    },
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    PongGame.init();
});