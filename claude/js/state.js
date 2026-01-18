/**
 * FactorIO Defense - Game State Management
 * Extracted from game.js for better code organization
 */

// ============= GAME STATE =============
let gameState = {
    resources: {
        'iron-ore': 50,
        'copper-ore': 50,
        coal: 30,
        stone: 30,
        'iron-plates': 20,
        'copper-plates': 20,
        circuits: 10,
        ammo: 50,
        shells: 5
    },
    buildings: [],
    deposits: [],
    enemies: [],
    projectiles: [],
    wave: 1,
    waveTimer: CONFIG.WAVE_INTERVAL,
    gameTime: 0,
    kills: 0,
    isGameOver: false,
    isPaused: false,
    selectedBuilding: null,
    placingBuilding: null,
    rotation: 0,
    camera: { x: 0, y: 0 },
    production: {}
};
