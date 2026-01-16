/**
 * Constants Module
 * Game configuration, building definitions, enemy types, resources
 */

const GRID_SIZE = 50;
const CELL_SIZE = 32;
const TICK_RATE = 100;
const ENEMY_SPAWN_RATE = 3000;
const WAVE_DURATION = 25000;
const FIRST_WAVE_DELAY = 60000;
const START_REVEAL_RADIUS = 8;
const CORE_MAX_HEALTH = 100;

// Turret configuration
const TURRET_RANGE = 5;
const TURRET_FIRE_RATE = 500;

// Zoom configuration
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

// Building key bindings
const BUILDING_KEYS = {
    '1': 'miner', '2': 'furnace', '3': 'assembler',
    '4': 'turret', '5': 'barrier', '6': 'pumpjack', '7': 'silo'
};

// Building definitions
const BUILDINGS = {
    miner: { 
        cost: { iron: 5 }, 
        icon: '⛏️', 
        key: '1', 
        desc: 'Mines resources automatically',
        requiresResource: true 
    },
    furnace: { 
        cost: { iron: 8, stone: 5 }, 
        icon: '🔥', 
        key: '2', 
        desc: 'Smelts iron → steel' 
    },
    assembler: { 
        cost: { iron: 10, gear: 5 }, 
        icon: '⚙️', 
        key: '3', 
        desc: 'Crafts ammo, circuits, & gears' 
    },
    turret: { 
        cost: { iron: 10, copper: 5, gear: 3 }, 
        icon: '🛡️', 
        key: '4', 
        desc: 'Auto-fires at enemies (NEEDS AMMO!)' 
    },
    barrier: { 
        cost: { iron: 2 }, 
        icon: '🧱', 
        key: '5', 
        desc: 'Blocks enemy path - build walls!' 
    },
    pumpjack: { 
        cost: { iron: 15, gear: 10 }, 
        icon: '🛢️', 
        key: '6', 
        desc: 'Extracts oil',
        requiresResource: 'oil' 
    },
    silo: { 
        cost: { iron: 100, copper: 50, steel: 50, circuit: 100 }, 
        icon: '🚀', 
        key: '7', 
        desc: 'Launch rocket to WIN!' 
    }
};

// Assembler production recipes
const ASSEMBLER_RECIPES = {
    ammo: {
        name: 'Ammo',
        icon: '💣',
        inputs: { iron: 2, copper: 1 },
        output: { ammo: 5 },
        description: 'Produces ammunition for turrets'
    },
    circuit: {
        name: 'Circuit',
        icon: '🔋',
        inputs: { copper: 2, iron: 1 },
        output: { circuit: 1 },
        description: 'Produces electronic circuits'
    },
    gear: {
        name: 'Gear',
        icon: '⚙️',
        inputs: { iron: 3 },
        output: { gear: 2 },
        description: 'Produces gears for building construction'
    }
};

// Resource types
const RESOURCES = ['iron', 'copper', 'coal', 'stone', 'oil', 'gear', 'circuit', 'steel', 'ammo'];

// Starting resources
const STARTING_RESOURCES = { 
    iron: 50, copper: 30, coal: 20, stone: 20, oil: 0, 
    gear: 5, circuit: 0, steel: 0, ammo: 30 
};

// Manual crafting recipes
const MANUAL_RECIPES = {
    gear: { iron: 2, time: 2000 },
    circuit: { copper: 2, iron: 1, time: 3000 },
    ammo: { iron: 2, copper: 1, time: 1000 }
};

// Enemy type definitions
const ENEMY_TYPES = {
    basic: { 
        hp: 100, 
        speed: 0.04, 
        icon: '👾', 
        damage: 10, 
        reward: { iron: 2 },
        spawnWave: 1 
    },
    scout: { 
        hp: 30, 
        speed: 0.08, 
        icon: '🦗', 
        damage: 5, 
        reward: { iron: 1 },
        spawnWave: 1 
    },
    tank: { 
        hp: 300, 
        speed: 0.02, 
        icon: '🪨', 
        damage: 30, 
        reward: { iron: 10, steel: 2 },
        spawnWave: 5 
    },
    flyer: { 
        hp: 50, 
        speed: 0.06, 
        icon: '🦇', 
        damage: 15, 
        reward: { copper: 5 },
        spawnWave: 8,
        ignoresBarriers: true 
    },
    boss: { 
        hp: 1000, 
        speed: 0.015, 
        icon: '👹', 
        damage: 50, 
        reward: { circuit: 20, steel: 10, gear: 10 },
        spawnWave: 10,
        isBoss: true,
        spawnsMinions: true 
    }
};

// Core position (center of grid)
const CORE_POS = { x: 25, y: 25 };

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        GRID_SIZE, CELL_SIZE, TICK_RATE, ENEMY_SPAWN_RATE, WAVE_DURATION,
        FIRST_WAVE_DELAY, START_REVEAL_RADIUS, CORE_MAX_HEALTH,
        TURRET_RANGE, TURRET_FIRE_RATE,
        MIN_ZOOM, MAX_ZOOM, ZOOM_STEP,
        BUILDING_KEYS, BUILDINGS, RESOURCES, STARTING_RESOURCES,
        ASSEMBLER_RECIPES, MANUAL_RECIPES, ENEMY_TYPES, CORE_POS
    };
}
