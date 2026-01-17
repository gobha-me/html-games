/**
 * FactorIO Defense - Game Configuration & Data Definitions
 * Extracted from game.js for better code organization
 */

// ============= GAME CONFIG =============
const CONFIG = {
    WORLD_SIZE: 60,
    TILE_SIZE: 40,
    WAVE_INTERVAL: 60,
    SPAWN_DISTANCE: 25,
    BASE_CENTER: { x: 30, y: 30 },
    VICTORY_WAVE: 50
};

// ============= BUILDING DEFINITIONS =============
const BUILDINGS = {
    miner: {
        name: 'Mining Drill',
        icon: '⛏️',
        color: '#6a6a6a',
        size: 1,
        cost: { 'iron-plates': 10, stone: 5 },
        health: 100,
        production: { rate: 1, time: 2000 }
    },
    furnace: {
        name: 'Furnace',
        icon: '🔥',
        color: '#c0392b',
        size: 1,
        cost: { 'iron-plates': 15, stone: 10 },
        health: 150,
        production: { input: 'ore', output: 'plate', rate: 1, time: 3000, coal: 1 }
    },
    assembler: {
        name: 'Assembler',
        icon: '⚙️',
        color: '#2980b9',
        size: 1,
        cost: { 'iron-plates': 20, circuits: 10 },
        health: 150,
        production: { time: 4000 }
    },
    'ammo-factory': {
        name: 'Ammo Factory',
        icon: '🏭',
        color: '#8e44ad',
        size: 1,
        cost: { 'iron-plates': 25, circuits: 15 },
        health: 150,
        production: { input: { 'iron-plates': 2, 'copper-plates': 1 }, output: 'ammo', rate: 5, time: 3000 }
    },
    'circuit-factory': {
        name: 'Circuit Plant',
        icon: '📟',
        color: '#27ae60',
        size: 1,
        cost: { 'iron-plates': 20, 'copper-plates': 10 },
        health: 150,
        production: { input: { 'iron-plates': 1, 'copper-plates': 2 }, output: 'circuits', rate: 2, time: 4000 }
    },
    wall: {
        name: 'Wall',
        icon: '🧱',
        color: '#7f8c8d',
        size: 1,
        cost: { stone: 5 },
        health: 500
    },
    turret: {
        name: 'Gun Turret',
        icon: '🔫',
        color: '#e74c3c',
        size: 1,
        cost: { 'iron-plates': 30, circuits: 20 },
        health: 200,
        combat: { damage: 10, range: 6, fireRate: 300, ammoUse: 1 }
    },
    'laser-turret': {
        name: 'Laser Turret',
        icon: '⚡',
        color: '#3498db',
        size: 1,
        cost: { 'iron-plates': 50, circuits: 40 },
        health: 180,
        combat: { damage: 8, range: 8, fireRate: 150, ammoUse: 0 }
    },
    artillery: {
        name: 'Artillery',
        icon: '💥',
        color: '#d35400',
        size: 2,
        cost: { 'iron-plates': 100, circuits: 50 },
        health: 300,
        combat: { damage: 50, range: 15, fireRate: 2000, ammoUse: 1, splash: 3, usesShells: true }
    },
    chest: {
        name: 'Storage Chest',
        icon: '📦',
        color: '#f39c12',
        size: 1,
        cost: { 'iron-plates': 10 },
        health: 100,
        storage: 500
    },
    base: {
        name: 'Command Center',
        icon: '🏛️',
        color: '#9b59b6',
        size: 2,
        health: 1000,
        isBase: true
    }
};

// ============= ENEMY DEFINITIONS =============
const ENEMIES = {
    basic: { name: 'Biter', health: 30, damage: 5, speed: 1, reward: { 'iron-ore': 2 } },
    fast: { name: 'Spitter', health: 20, damage: 3, speed: 2, reward: { 'copper-ore': 2 } },
    tank: { name: 'Big Biter', health: 100, damage: 15, speed: 0.5, reward: { 'iron-ore': 5, 'copper-ore': 5 } },
    boss: { name: 'Behemoth', health: 500, damage: 50, speed: 0.3, reward: { 'iron-plates': 20, circuits: 10 } }
};

// Export to global scope for use in other scripts
window.CONFIG = CONFIG;
window.BUILDINGS = BUILDINGS;
window.ENEMIES = ENEMIES;