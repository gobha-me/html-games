/**
 * Game State Management
 * Handles game state, difficulty settings, and localStorage
 */

const GameState = {
    // Game states
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    GAMEOVER: 'gameover',

    // Current state
    currentState: 'menu',

    // Game mode: 'single' or 'multiplayer'
    gameMode: 'single',

    // Number of players (for multiplayer)
    playerCount: 2,

    // Difficulty settings
    difficulties: {
        easy: {
            speed: 120,      // ms per frame
            speedIncrease: 2 // ms decrease per food
        },
        normal: {
            speed: 100,
            speedIncrease: 3
        },
        hard: {
            speed: 80,
            speedIncrease: 4
        }
    },

    // Current game settings
    difficulty: 'normal',
    speed: 100,
    score: 0,
    highScore: 0,

    // Grid settings
    gridSize: 30,
    cellSize: 20,

    // Ghost trail visual option
    ghostTrail: false,
    ghostTrailLength: 5,

    /**
     * Initialize state from localStorage
     */
    init() {
        this.loadHighScore();
        this.loadGhostTrail();
        this.setDifficulty(this.difficulty);
    },

    /**
     * Set difficulty level
     */
    setDifficulty(level) {
        this.difficulty = level;
        const settings = this.difficulties[level];
        this.speed = settings.speed;
        this.speedIncrease = settings.speedIncrease;
    },

    /**
     * Reset game state for new game
     */
    reset() {
        this.score = 0;
        this.setDifficulty(this.difficulty);
    },

    /**
     * Add points to score
     */
    addScore(points) {
        this.score += points;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            this.saveHighScore();
        }
    },

    /**
     * Increase game speed
     */
    increaseSpeed() {
        this.speed = Math.max(30, this.speed - this.speedIncrease);
    },

    /**
     * Load high score from localStorage
     */
    loadHighScore() {
        const saved = localStorage.getItem('snakeHighScore');
        this.highScore = saved ? parseInt(saved, 10) : 0;
    },

    /**
     * Save high score to localStorage
     */
    saveHighScore() {
        localStorage.setItem('snakeHighScore', this.highScore.toString());
    },

    /**
     * Check if current score is a new high score
     */
    isNewHighScore() {
        return this.score === this.highScore && this.score > 0;
    },

    /**
     * Set game mode
     */
    setGameMode(mode) {
        this.gameMode = mode;
    },

    /**
     * Set number of players
     */
    setPlayerCount(count) {
        this.playerCount = Math.max(2, Math.min(4, count));
    },

    /**
     * Check if in multiplayer mode
     */
    isMultiplayer() {
        return this.gameMode === 'multiplayer';
    },

    /**
     * Load ghost trail setting from localStorage
     */
    loadGhostTrail() {
        const saved = localStorage.getItem('snakeGhostTrail');
        this.ghostTrail = saved === 'true';
    },

    /**
     * Save ghost trail setting to localStorage
     */
    saveGhostTrail() {
        localStorage.setItem('snakeGhostTrail', this.ghostTrail.toString());
    },

    /**
     * Toggle ghost trail setting
     */
    toggleGhostTrail() {
        this.ghostTrail = !this.ghostTrail;
        this.saveGhostTrail();
    }
};
