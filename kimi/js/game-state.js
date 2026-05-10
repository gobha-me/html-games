/**
 * Game State Module
 * State management, save/load functionality
 *
 * NOTE: Achievement *badge* state (unlocked set, points) lives in achievements.js.
 *       This module owns the in-game stat counters stored inside gameState.achievements.
 */

let gameState = null;

function createInitialGameState() {
    return {
        grid: Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null)),
        resources: { ...STARTING_RESOURCES },
        enemies: [],
        projectiles: [],
        coreHealth: CORE_MAX_HEALTH,
        wave: 1,
        waveSpawnComplete: false,
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
            coreDamageTaken: 0,
            bossMinionsSpawned: 0,
            bossMinionsKilled: 0
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

// Save/Load system
function saveGame() {
    const stateToSave = {
        ...gameState,
        revealed: Array.from(gameState.revealed),
        enemies: [],
        projectiles: []
    };
    localStorage.setItem('factory_defense_v6', JSON.stringify(stateToSave));

    // Achievement badge state is owned by achievements.js
    if (typeof getAchievementState === 'function') {
        localStorage.setItem('factory_defense_achievements', JSON.stringify(getAchievementState()));
    }

    showMessage('Game Saved', '#0f0');
}

function loadGame() {
    const saved = localStorage.getItem('factory_defense_v6');
    if (saved) {
        gameState = JSON.parse(saved);
        gameState.revealed = new Set(gameState.revealed);
        gameState.enemies = [];
        gameState.projectiles = [];

        // Migration guards — ensure new fields exist in old saves
        if (gameState.waveSpawnComplete === undefined) {
            gameState.waveSpawnComplete = false;
        }
        if (!gameState.achievements) gameState.achievements = {};
        if (gameState.achievements.bossMinionsSpawned === undefined) {
            gameState.achievements.bossMinionsSpawned = 0;
        }
        if (gameState.achievements.bossMinionsKilled === undefined) {
            gameState.achievements.bossMinionsKilled = 0;
        }

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

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createInitialGameState, initGameState, getGameState, setGameState, resetGameState,
        saveGame, loadGame, autoSave, resetGame
    };
}
