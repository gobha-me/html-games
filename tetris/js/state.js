/**
 * Tetris Game State Management
 */

// Game configuration constants
const CONFIG = {
    BOARD_WIDTH: 10,
    BOARD_HEIGHT: 20,
    BLOCK_SIZE: 30,
    PREVIEW_COUNT: 3,
    INITIAL_DROP_INTERVAL: 1000, // ms
    MIN_DROP_INTERVAL: 50,
    SPEED_CURVE: 0.85, // multiply interval by this each level
    LOCK_DELAY: 500, // ms to lock after landing
    MAX_LOCK_RESETS: 15,
    DAS_DELAY: 170, // ms before auto-repeat starts
    ARR_DELAY: 50, // ms between auto-repeats
    LINE_CLEAR_ANIM_DURATION: 300, // ms
    COLORS: {
        I: '#00f0f0',
        O: '#f0f000',
        T: '#a000f0',
        S: '#00f000',
        Z: '#f00000',
        J: '#0000f0',
        L: '#f0a000',
    },
    GHOST_ALPHA: 0.2,
};

// Tetromino definitions (each rotation state)
const TETROMINOES = {
    I: {
        color: CONFIG.COLORS.I,
        states: [
            [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
            [[0,0,1,0],[0,0,1,0],[0,0,1,0],[0,0,1,0]],
            [[0,0,0,0],[0,0,0,0],[1,1,1,1],[0,0,0,0]],
            [[0,1,0,0],[0,1,0,0],[0,1,0,0],[0,1,0,0]],
        ],
    },
    O: {
        color: CONFIG.COLORS.O,
        states: [
            [[1,1],[1,1]],
            [[1,1],[1,1]],
            [[1,1],[1,1]],
            [[1,1],[1,1]],
        ],
    },
    T: {
        color: CONFIG.COLORS.T,
        states: [
            [[0,1,0],[1,1,1],[0,0,0]],
            [[0,1,0],[0,1,1],[0,1,0]],
            [[0,0,0],[1,1,1],[0,1,0]],
            [[0,1,0],[1,1,0],[0,1,0]],
        ],
    },
    S: {
        color: CONFIG.COLORS.S,
        states: [
            [[0,1,1],[1,1,0],[0,0,0]],
            [[0,1,0],[0,1,1],[0,0,1]],
            [[0,0,0],[0,1,1],[1,1,0]],
            [[1,0,0],[1,1,0],[0,1,0]],
        ],
    },
    Z: {
        color: CONFIG.COLORS.Z,
        states: [
            [[1,1,0],[0,1,1],[0,0,0]],
            [[0,0,1],[0,1,1],[0,1,0]],
            [[0,0,0],[1,1,0],[0,1,1]],
            [[0,1,0],[1,1,0],[1,0,0]],
        ],
    },
    J: {
        color: CONFIG.COLORS.J,
        states: [
            [[1,0,0],[1,1,1],[0,0,0]],
            [[0,1,1],[0,1,0],[0,1,0]],
            [[0,0,0],[1,1,1],[0,0,1]],
            [[0,1,0],[0,1,0],[1,1,0]],
        ],
    },
    L: {
        color: CONFIG.COLORS.L,
        states: [
            [[0,0,1],[1,1,1],[0,0,0]],
            [[0,1,0],[0,1,0],[0,1,1]],
            [[0,0,0],[1,1,1],[1,0,0]],
            [[1,1,0],[0,1,0],[0,1,0]],
        ],
    },
};

// SRS wall kick data
const WALL_KICKS = {
    // For J, L, S, T, Z
    JLSTZ: {
        '0>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
        '1>0': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
        '1>2': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
        '2>1': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
        '2>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
        '3>2': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
        '3>0': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
        '0>3': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    },
    // For I
    I: {
        '0>1': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
        '1>0': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
        '1>2': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
        '2>1': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
        '2>3': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
        '3>2': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
        '3>0': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
        '0>3': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    },
};

// Scoring
const SCORING = {
    SINGLE: 100,
    DOUBLE: 300,
    TRIPLE: 500,
    TETRIS: 800,
    T_SPIN_MINI: 100,
    T_SPIN: 400,
    T_SPIN_DOUBLE: 800,
    T_SPIN_TRIPLE: 1200,
    SOFT_DROP: 1,
    HARD_DROP: 2,
    COMBO_BASE: 50,
    COMBO_INCREMENT: 50,
};

// Game state object
const GameState = {
    // Board: 2D array [row][col], null or { color, locked }
    board: [],
    
    // Current piece
    currentPiece: null, // { type, rotation, x, y, color }
    
    // Hold piece
    holdPiece: null,
    canHold: true,
    
    // Bag of upcoming pieces
    bag: [],
    nextPieces: [],
    
    // Game status
    isPlaying: false,
    isPaused: false,
    isGameOver: false,
    isLineClearing: false,
    
    // Scoring
    score: 0,
    level: 1,
    lines: 0,
    combo: -1,
    
    // Timing
    dropInterval: CONFIG.INITIAL_DROP_INTERVAL,
    lastDropTime: 0,
    lockTimer: 0,
    lockResets: 0,
    isLocking: false,
    
    // Input state
    keys: {},
    dasTimer: {},
    arrTimer: {},
    dasActive: {},
    
    // Animation
    lineClearRows: [],
    lineClearAnimProgress: 0,
    particles: [],
    
    // High score
    highScore: 0,
    isNewHighScore: false,
};

// Create empty board
function createBoard() {
    const board = [];
    for (let r = 0; r < CONFIG.BOARD_HEIGHT; r++) {
        board[r] = [];
        for (let c = 0; c < CONFIG.BOARD_WIDTH; c++) {
            board[r][c] = null;
        }
    }
    return board;
}

// Generate a random 7-bag
function generateBag() {
    const types = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
    // Fisher-Yates shuffle
    for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
    }
    return types;
}

// Get next piece from bag
function getNextPiece() {
    while (GameState.bag.length < CONFIG.PREVIEW_COUNT + 1) {
        GameState.bag = GameState.bag.concat(generateBag());
    }
    return GameState.bag.shift();
}

// Create a new piece
function createPiece(type) {
    const states = TETROMINOES[type].states;
    const shape = states[0];
    const x = Math.floor((CONFIG.BOARD_WIDTH - shape[0].length) / 2);
    return {
        type,
        rotation: 0,
        x,
        y: 0,
        color: TETROMINOES[type].color,
    };
}

// Get shape for a piece at given rotation
function getShape(piece) {
    return TETROMINOES[piece.type].states[piece.rotation];
}

// Check if a piece position is valid
function isValidPosition(piece, offsetX = 0, offsetY = 0, rotation = null) {
    const rot = rotation !== null ? rotation : piece.rotation;
    const shape = TETROMINOES[piece.type].states[rot];
    const newX = piece.x + offsetX;
    const newY = piece.y + offsetY;
    
    for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
            if (!shape[r][c]) continue;
            const boardX = newX + c;
            const boardY = newY + r;
            
            if (boardX < 0 || boardX >= CONFIG.BOARD_WIDTH) return false;
            if (boardY >= CONFIG.BOARD_HEIGHT) return false;
            if (boardY < 0) continue;
            if (GameState.board[boardY][boardX]) return false;
        }
    }
    return true;
}

// Calculate ghost piece Y position
function getGhostY(piece) {
    let ghostY = piece.y;
    while (isValidPosition(piece, 0, ghostY - piece.y + 1)) {
        ghostY++;
    }
    return ghostY;
}

// Calculate drop interval for current level
function getDropInterval(level) {
    return Math.max(
        CONFIG.MIN_DROP_INTERVAL,
        Math.floor(CONFIG.INITIAL_DROP_INTERVAL * Math.pow(CONFIG.SPEED_CURVE, level - 1))
    );
}

// Reset game state
function resetGameState() {
    GameState.board = createBoard();
    GameState.bag = [];
    GameState.nextPieces = [];
    GameState.holdPiece = null;
    GameState.canHold = true;
    GameState.score = 0;
    GameState.level = 1;
    GameState.lines = 0;
    GameState.combo = -1;
    GameState.dropInterval = CONFIG.INITIAL_DROP_INTERVAL;
    GameState.lastDropTime = 0;
    GameState.lockTimer = 0;
    GameState.lockResets = 0;
    GameState.isLocking = false;
    GameState.isGameOver = false;
    GameState.isLineClearing = false;
    GameState.lineClearRows = [];
    GameState.lineClearAnimProgress = 0;
    GameState.particles = [];
    GameState.isNewHighScore = false;
    
    // Fill bag and get first pieces
    GameState.bag = generateBag();
    const firstType = getNextPiece();
    GameState.currentPiece = createPiece(firstType);
    
    // Pre-fill next pieces
    for (let i = 0; i < CONFIG.PREVIEW_COUNT; i++) {
        GameState.nextPieces.push(getNextPiece());
    }
}

// Load high score
function loadHighScore() {
    const saved = localStorage.getItem('tetris-high-score');
    if (saved) {
        GameState.highScore = parseInt(saved, 10) || 0;
    }
    return GameState.highScore;
}

// Save high score
function saveHighScore(score) {
    if (score > GameState.highScore) {
        GameState.highScore = score;
        localStorage.setItem('tetris-high-score', score.toString());
        return true;
    }
    return false;
}

// Export for use in other modules
window.GameState = GameState;
window.CONFIG = CONFIG;
window.TETROMINOES = TETROMINOES;
window.WALL_KICKS = WALL_KICKS;
window.SCORING = SCORING;
window.createBoard = createBoard;
window.generateBag = generateBag;
window.getNextPiece = getNextPiece;
window.createPiece = createPiece;
window.getShape = getShape;
window.isValidPosition = isValidPosition;
window.getGhostY = getGhostY;
window.getDropInterval = getDropInterval;
window.resetGameState = resetGameState;
window.loadHighScore = loadHighScore;
window.saveHighScore = saveHighScore;
