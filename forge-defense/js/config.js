/**
 * Forge Defense - Game Configuration
 */

const CONFIG = {
    WORLD_SIZE: 60,
    TILE_SIZE: 40,
    DEFAULT_SCALE: 1.75,  // Zoomed in - makes minimap essential
    WAVE_INTERVAL: 60,
    SPAWN_DISTANCE: 25,
    BASE_CENTER: { x: 30, y: 30 },
    VICTORY_WAVE: 50,
    FOG_OF_WAR: true  // Enable fog of war
};

// Building definitions with hotkeys
// SUPPLY CHAIN (KISS):
//   Tier 0: Raw resources (iron-ore, copper-ore, coal, stone) - start with these
//   Tier 1: Miner (iron-ore + stone) → extracts raw resources
//   Tier 1: Furnace (stone) → smelts ore into plates (needs coal fuel)
//   Tier 2: Circuits, Ammo, Turrets (require plates)
//   Tier 3: Advanced (require circuits)

const BUILDINGS = {
    miner: {
        name: 'Mining Drill',
        icon: '⛏️',
        color: '#6a6a6a',
        size: 1,
        cost: { 'iron-ore': 10, stone: 5 },  // RAW resources only!
        health: 100,
        production: { rate: 2, time: 1500 },  // Faster mining
        key: '1',
        desc: 'Mines resources from nearby deposits',
        revealRadius: 3
    },
    furnace: {
        name: 'Furnace',
        icon: '🔥',
        color: '#c0392b',
        size: 1,
        cost: { stone: 10 },  // Just stone! Easy to build
        health: 150,
        production: { time: 2000 },  // Faster smelting
        key: '2',
        desc: 'Smelts ore into plates (needs coal)',
        revealRadius: 2
    },
    wall: {
        name: 'Wall',
        icon: '🧱',
        color: '#7f8c8d',
        size: 1,
        cost: { stone: 3 },  // Cheap walls
        health: 500,
        key: '3',
        desc: 'Blocks enemy movement',
        revealRadius: 1
    },
    turret: {
        name: 'Gun Turret',
        icon: '🔫',
        color: '#e74c3c',
        size: 1,
        cost: { 'iron-plates': 15, 'copper-plates': 5 },  // Plates only, no circuits needed
        health: 200,
        combat: { damage: 10, range: 6, fireRate: 300, ammoUse: 1 },
        key: '4',
        desc: 'Auto-fires at enemies (uses ammo)',
        revealRadius: 6
    },
    'ammo-factory': {
        name: 'Ammo Factory',
        icon: '🏭',
        color: '#8e44ad',
        size: 1,
        cost: { 'iron-plates': 20, 'copper-plates': 10 },  // Plates only
        health: 150,
        production: { time: 2000 },  // Faster ammo
        key: '5',
        desc: 'Produces ammunition',
        revealRadius: 2
    },
    'circuit-factory': {
        name: 'Circuit Plant',
        icon: '📟',
        color: '#27ae60',
        size: 1,
        cost: { 'iron-plates': 15, 'copper-plates': 15 },  // Plates only
        health: 150,
        production: { time: 3000 },
        key: '6',
        desc: 'Makes circuits from plates',
        revealRadius: 2
    },
    'laser-turret': {
        name: 'Laser Turret',
        icon: '⚡',
        color: '#3498db',
        size: 1,
        cost: { 'iron-plates': 30, circuits: 20 },  // Now requires circuits (tier 3)
        health: 180,
        combat: { damage: 8, range: 8, fireRate: 150, ammoUse: 0 },
        key: '7',
        desc: 'Fires lasers (no ammo needed)',
        revealRadius: 8
    },
    artillery: {
        name: 'Artillery',
        icon: '💥',
        color: '#d35400',
        size: 2,
        cost: { 'iron-plates': 50, circuits: 30 },  // Tier 3
        health: 300,
        combat: { damage: 50, range: 15, fireRate: 2000, ammoUse: 1, splash: 3, usesShells: true },
        key: '8',
        desc: 'Long range splash damage (uses shells)',
        revealRadius: 15
    },
    assembler: {
        name: 'Shell Factory',
        icon: '⚙️',
        color: '#2980b9',
        size: 1,
        cost: { 'iron-plates': 25, circuits: 10 },  // Tier 3
        health: 150,
        production: { time: 4000 },
        key: '9',
        desc: 'Produces shells for artillery',
        revealRadius: 2
    },
    base: {
        name: 'Command Center',
        icon: '🏛️',
        color: '#9b59b6',
        size: 2,
        health: 1000,
        isBase: true,
        revealRadius: 8
    }
};

// Enemy definitions - BASE stats (scaled by wave)
// Speed is tiles per game tick - keep LOW for fairness
const ENEMIES = {
    basic: { 
        name: 'Crawler', 
        health: 40, 
        damage: 5, 
        speed: 0.3,  // SLOW - was 1
        reward: { 'iron-ore': 3 },
        icon: '🐜'
    },
    fast: { 
        name: 'Spitter', 
        health: 25, 
        damage: 3, 
        speed: 0.5,  // Faster but still reasonable - was 2
        reward: { 'copper-ore': 3 },
        icon: '🦗'
    },
    tank: { 
        name: 'Heavy', 
        health: 150, 
        damage: 12, 
        speed: 0.15,  // Very slow - was 0.5
        reward: { 'iron-ore': 8, 'copper-ore': 5 },
        icon: '🐛'
    },
    boss: { 
        name: 'Behemoth', 
        health: 800, 
        damage: 40, 
        speed: 0.1,  // Extremely slow - was 0.3
        reward: { 'iron-plates': 30, circuits: 15 },
        icon: '👹'
    }
};

// Wave scaling factors - increases per wave
const WAVE_SCALING = {
    healthMultiplier: 0.08,   // +8% health per wave
    damageMultiplier: 0.05,   // +5% damage per wave  
    speedMultiplier: 0.02,    // +2% speed per wave (very slow increase)
    maxSpeedMultiplier: 2.0   // Cap speed at 2x base
};

// Manual crafting recipes
const CRAFT_RECIPES = {
    circuits: {
        name: 'Circuits',
        cost: { 'copper-plates': 2, 'iron-plates': 1 },
        output: 2,
        time: 3000
    },
    ammo: {
        name: 'Ammo',
        cost: { 'iron-plates': 2, 'copper-plates': 1 },
        output: 5,
        time: 2000
    }
};

// Key bindings
const BUILDING_KEYS = {};
Object.entries(BUILDINGS).forEach(([type, def]) => {
    if (def.key) BUILDING_KEYS[def.key] = type;
});
