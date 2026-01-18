/**
 * Forge Defense - Game State Management
 */

let gameState = {
    resources: {
        'iron-ore': 50,
        'copper-ore': 50,
        coal: 30,
        stone: 40,  // More stone to start
        'iron-plates': 0,  // Start with NO plates - must smelt
        'copper-plates': 0,
        circuits: 0,
        ammo: 20,  // Some starting ammo
        shells: 0
    },
    buildings: [],
    deposits: [],
    enemies: [],
    projectiles: [],
    wave: 1,
    waveTimer: CONFIG.WAVE_INTERVAL,
    gameTime: 0,
    kills: 0,
    totalKills: 0,
    isGameOver: false,
    camera: { x: 0, y: 0, scale: CONFIG.DEFAULT_SCALE },
    isPaused: false,
    selectedBuilding: null,
    placingBuilding: null,
    rotation: 0,
    production: {},
    crafting: {
        active: null,
        endTime: 0
    },
    achievements: {
        enemiesKilled: 0,
        buildingsPlaced: 0,
        turretsBuilt: 0,
        wavesSurvived: 0,
        resourcesCollected: 0
    },
    objectives: {
        turrets: false,
        waves: false,
        resources: false,
        victory: false
    },
    // Fog of war - tracks which tiles are revealed
    revealed: new Set(),  // Set of "x,y" strings for revealed tiles
    fogEnabled: CONFIG.FOG_OF_WAR
};

function resetGameState() {
    gameState = {
        resources: {
            'iron-ore': 50,
            'copper-ore': 50,
            coal: 30,
            stone: 40,
            'iron-plates': 0,
            'copper-plates': 0,
            circuits: 0,
            ammo: 20,
            shells: 0
        },
        buildings: [],
        deposits: [],
        enemies: [],
        projectiles: [],
        wave: 1,
        waveTimer: CONFIG.WAVE_INTERVAL,
        gameTime: 0,
        kills: 0,
        totalKills: 0,
        isGameOver: false,
        camera: { x: 0, y: 0, scale: CONFIG.DEFAULT_SCALE },
        isPaused: false,
        selectedBuilding: null,
        placingBuilding: null,
        rotation: 0,
        production: {},
        crafting: {
            active: null,
            endTime: 0
        },
        achievements: {
            enemiesKilled: 0,
            buildingsPlaced: 0,
            turretsBuilt: 0,
            wavesSurvived: 0,
            resourcesCollected: 0
        },
        objectives: {
            turrets: false,
            waves: false,
            resources: false,
            victory: false
        },
        revealed: new Set(),
        fogEnabled: CONFIG.FOG_OF_WAR
    };
}
