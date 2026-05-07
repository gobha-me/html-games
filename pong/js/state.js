/**
 * Pong Game State Management
 */

// Game configuration constants
const CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 500,
    PADDLE_WIDTH: 12,
    PADDLE_HEIGHT: 80,
    BALL_SIZE: 12,
    PADDLE_SPEED: 8,
    BALL_SPEED_INITIAL: 6,
    BALL_SPEED_INCREMENT: 0.5,
    BALL_MAX_SPEED: 12,
    CPU_EASY_SPEED: 3,
    CPU_NORMAL_SPEED: 5,
    CPU_HARD_SPEED: 7,
};

// Game state
const GameState = {
    // Screens
    screens: ['start-screen', 'game-screen', 'gameover-screen'],
    
    // Current screen
    currentScreen: 'start-screen',
    
    // Game settings
    mode: 'cpu', // 'cpu' or '2p'
    difficulty: 'normal', // 'easy', 'normal', 'hard'
    winScore: 11,
    
    // Game status
    isPlaying: false,
    isPaused: false,
    isCountingDown: false,
    
    // Scores
    p1Score: 0,
    p2Score: 0,
    highScore: 0,
    
    // Paddle positions
    p1Y: CONFIG.CANVAS_HEIGHT / 2 - CONFIG.PADDLE_HEIGHT / 2,
    p2Y: CONFIG.CANVAS_HEIGHT / 2 - CONFIG.PADDLE_HEIGHT / 2,
    
    // Ball state
    ballX: CONFIG.CANVAS_WIDTH / 2,
    ballY: CONFIG.CANVAS_HEIGHT / 2,
    ballVX: CONFIG.BALL_SPEED_INITIAL,
    ballVY: CONFIG.BALL_SPEED_INITIAL,
    ballSpeed: CONFIG.BALL_SPEED_INITIAL,
    
    // Input state
    keys: {
        w: false,
        s: false,
        ArrowUp: false,
        ArrowDown: false,
    },
    
    // Winner tracking
    winner: null,
    winnerScore: 0,
    isNewHighScore: false,
};

// Load high score from localStorage
function loadHighScore() {
    const saved = localStorage.getItem('pong-high-score');
    if (saved) {
        GameState.highScore = parseInt(saved, 10) || 0;
    }
    return GameState.highScore;
}

// Save high score to localStorage
function saveHighScore(score) {
    if (score > GameState.highScore) {
        GameState.highScore = score;
        localStorage.setItem('pong-high-score', score.toString());
        return true;
    }
    return false;
}

// Reset game state for a new game
function resetGameState() {
    GameState.p1Score = 0;
    GameState.p2Score = 0;
    GameState.p1Y = CONFIG.CANVAS_HEIGHT / 2 - CONFIG.PADDLE_HEIGHT / 2;
    GameState.p2Y = CONFIG.CANVAS_HEIGHT / 2 - CONFIG.PADDLE_HEIGHT / 2;
    GameState.ballSpeed = CONFIG.BALL_SPEED_INITIAL;
    GameState.winner = null;
    GameState.winnerScore = 0;
    GameState.isNewHighScore = false;
    resetBall();
}

// Reset ball to center with random direction
function resetBall() {
    GameState.ballX = CONFIG.CANVAS_WIDTH / 2;
    GameState.ballY = CONFIG.CANVAS_HEIGHT / 2;
    
    // Random horizontal direction
    const direction = Math.random() > 0.5 ? 1 : -1;
    GameState.ballVX = GameState.ballSpeed * direction;
    
    // Random vertical angle between -30 and 30 degrees
    const angle = (Math.random() - 0.5) * Math.PI / 3;
    GameState.ballVY = GameState.ballSpeed * Math.sin(angle);
}

// Switch between screens
function showScreen(screenName) {
    if (!GameState.screens.includes(screenName)) {
        console.error(`Invalid screen: ${screenName}`);
        return;
    }
    
    GameState.screens.forEach(screen => {
        const element = document.getElementById(screen);
        if (element) {
            element.style.display = screen === screenName ? 'block' : 'none';
        }
    });
    
    GameState.currentScreen = screenName;
}

// Export for use in other modules
window.GameState = GameState;
window.CONFIG = CONFIG;
window.loadHighScore = loadHighScore;
window.saveHighScore = saveHighScore;
window.resetGameState = resetGameState;
window.resetBall = resetBall;
window.showScreen = showScreen;