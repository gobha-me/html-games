/**
 * Game State Module
 * State management, save/load functionality
 */

let gameState = null;

// Achievement tracking state
let achievementState = null;

function createInitialGameState() {
    return {
        grid: Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null)),
        resources: { ...STARTING_RESOURCES },
        enemies: [],
        projectiles: [],
        coreHealth: CORE_MAX_HEALTH,
        wave: 1,
        enemiesInWave: 3,
        enemiesSpawnedThisWave: 0,
        waveTimer: 0,
        gameTime: 0,
        revealed: new Set(),
        buildingInHand: null,
        isPaused: false,
        rocketLaunched: false,
        objectives: [false, false, false, false, false],
        firstWaveSpawned: false,
        camera: { 
            x: -((GRID_SIZE * CELL_SIZE) / 2) + window.innerWidth / 2, 
            y: -((GRID_SIZE * CELL_SIZE) / 2) + window.innerHeight / 2 
        },
        manualCrafting: { lastCrafted: 0 },
        zoomLevel: 1.0,
        achievements: {
            enemiesKilled: 0,
            turretsBuilt: 0,
            wavesSurvived: 0,
            coreDamageTaken: 0
        }
    };
}

function initGameState() {
    gameState = createInitialGameState();
    return gameState;
}

function getGameState() {
    if (!gameState) {
        initGameState();
    }
    return gameState;
}

function setGameState(newState) {
    gameState = newState;
}

function resetGameState() {
    gameState = createInitialGameState();
    return gameState;
}

// Achievement state management
function createInitialAchievementState() {
    return {
        unlocked: [],
        totalPoints: 0,
        stats: {
            totalKills: 0,
            totalResources: {},
            wavesCompleted: 0,
            buildingsBuilt: {},
            maxTurrets: 0,
            fastestWave5: null,
            coreHealthAtWave5: 100
        }
    };
}

function initAchievementState() {
    if (!achievementState) {
        achievementState = createInitialAchievementState();
    }
    return achievementState;
}

function getAchievementState() {
    return achievementState || initAchievementState();
}

function setAchievementState(state) {
    achievementState = state;
}

// Save/Load system
function saveGame() {
    const stateToSave = {
        ...gameState,
        revealed: Array.from(gameState.revealed),
        enemies: [],
        projectiles: []
    };
    localStorage.setItem('factory_defense_v6', JSON.stringify(stateToSave));
    
    // Save achievement state
    const achState = getAchievementState();
    localStorage.setItem('factory_defense_achievements', JSON.stringify(achState));
    
    showMessage('Game Saved', '#0f0');
}

function loadGame() {
    const saved = localStorage.getItem('factory_defense_v6');
    if (saved) {
        gameState = JSON.parse(saved);
        gameState.revealed = new Set(gameState.revealed);
        gameState.enemies = [];
        gameState.projectiles = [];
        
        // Setup grid and UI
        setupGrid();
        updateResources();
        updateZoomDisplay();
        
        showMessage('Game Loaded', '#0f0');
        return true;
    }
    return false;
}

function autoSave() {
    if (!gameState.isPaused && !gameState.rocketLaunched) {
        saveGame();
    }
}

function resetGame() {
    if (confirm('Reset game? All progress will be lost.')) {
        AudioSystem?.stopAmbient();
        localStorage.removeItem('factory_defense_v6');
        localStorage.removeItem('factory_defense_achievements');
        location.reload();
    }
}

// Load achievement state
function loadAchievementState() {
    const saved = localStorage.getItem('factory_defense_achievements');
    if (saved) {
        achievementState = JSON.parse(saved);
        return true;
    }
    return false;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        gameState, achievementState,
        createInitialGameState, initGameState, getGameState, setGameState, resetGameState,
        createInitialAchievementState, initAchievementState, getAchievementState, setAchievementState,
        saveGame, loadGame, autoSave, resetGame, loadAchievementState
    };
}
