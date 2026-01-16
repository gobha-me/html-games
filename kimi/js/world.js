/**
 * World Module
 * World generation, resources, fog of war
 */

// Seedable RNG for reproducible maps
let mapSeed = Date.now();

function setMapSeed(seed) {
    mapSeed = seed;
}

function rng() {
    mapSeed = (mapSeed * 9301 + 49297) % 233280;
    return mapSeed / 233280;
}

// Value noise function (simple 2D noise)
function noiseValue(x, y, seed) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    
    const a = hashNoise(xi, yi, seed);
    const b = hashNoise(xi + 1, yi, seed);
    const c = hashNoise(xi, yi + 1, seed);
    const d = hashNoise(xi + 1, yi + 1, seed);
    
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

function hashNoise(x, y, seed) {
    let n = x * 374761393 + y * 668265263 + seed * 1274126177;
    n = ((n ^ (n >> 13)) * 1274126177) & 0x7fffffff;
    return n / 0x7fffffff;
}

// Fractal Brownian Motion for natural distribution
function fbm(x, y, seed, octaves = 4) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
        value += noiseValue(x * frequency, y * frequency, seed + i * 1000) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
    }
    
    return value / maxValue;
}

// Check if position is near spawn (for exclusion zones)
function isNearSpawn(x, y) {
    const dist = Math.abs(x - CORE_POS.x) + Math.abs(y - CORE_POS.y);
    return dist < 8;
}

// Resource configuration with scarcity tiers
const resourceConfig = {
    iron: { noiseScale: 0.06, threshold: 0.35, minDist: 3, amount: 800, excludeSpawn: false },
    copper: { noiseScale: 0.08, threshold: 0.32, minDist: 3, amount: 600, excludeSpawn: false },
    coal: { noiseScale: 0.1, threshold: 0.30, minDist: 4, amount: 500, excludeSpawn: false },
    stone: { noiseScale: 0.12, threshold: 0.28, minDist: 4, amount: 400, excludeSpawn: true },
    oil: { noiseScale: 0.05, threshold: -0.15, minDist: 6, amount: 300, excludeSpawn: true }
};

function generateWorld() {
    const state = getGameState();
    mapSeed = Date.now() + Math.random() * 1000000;
    
    // Initialize grid with ground
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            state.grid[y][x] = { type: 'ground', amount: 0, entity: null };
        }
    }
    
    // Place guaranteed spawn resources (3-4 near core)
    const spawnResources = [];
    const spawnRadius = 10;
    for (let y = CORE_POS.y - spawnRadius; y <= CORE_POS.y + spawnRadius; y++) {
        for (let x = CORE_POS.x - spawnRadius; x <= CORE_POS.x + spawnRadius; x++) {
            if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                const dist = Math.abs(x - CORE_POS.x) + Math.abs(y - CORE_POS.y);
                if (dist > 3 && dist <= spawnRadius) {
                    spawnResources.push({ x, y, dist });
                }
            }
        }
    }
    
    // Shuffle spawn positions
    for (let i = spawnResources.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [spawnResources[i], spawnResources[j]] = [spawnResources[j], spawnResources[i]];
    }
    
    // Place guaranteed iron/copper/coal near spawn
    const spawnTypes = ['iron', 'copper', 'coal'];
    const spawnAmounts = { iron: 800, copper: 600, coal: 500 };
    
    for (let i = 0; i < Math.min(3, spawnResources.length); i++) {
        const pos = spawnResources[i];
        const resourceType = spawnTypes[i];
        state.grid[pos.y][pos.x] = {
            type: `resource-${resourceType}`,
            amount: spawnAmounts[resourceType],
            entity: null
        };
        
        // Small cluster around spawn resource
        const clusterSize = 2 + Math.floor(rng() * 2);
        for (let j = 0; j < clusterSize; j++) {
            const angle = rng() * Math.PI * 2;
            const radius = 1 + rng() * 1.5;
            const cx = Math.round(pos.x + Math.cos(angle) * radius);
            const cy = Math.round(pos.y + Math.sin(angle) * radius);
            
            if (cx >= 0 && cx < GRID_SIZE && cy >= 0 && cy < GRID_SIZE) {
                if (state.grid[cy][cx].type === 'ground') {
                    state.grid[cy][cx] = {
                        type: `resource-${resourceType}`,
                        amount: spawnAmounts[resourceType],
                        entity: null
                    };
                }
            }
        }
    }
    
    // Use separate noise seeds for each resource type
    const resourceSeeds = {
        iron: mapSeed + 1,
        copper: mapSeed + 2,
        coal: mapSeed + 3,
        stone: mapSeed + 4,
        oil: mapSeed + 5
    };
    
    // Fill map with noise-based resource placement
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            // Skip if already has guaranteed resource
            if (state.grid[y][x].type !== 'ground') continue;
            
            // Skip spawn exclusion zones
            if (isNearSpawn(x, y)) continue;
            
            // Check each resource type
            for (const [resourceType, config] of Object.entries(resourceConfig)) {
                if (config.excludeSpawn && isNearSpawn(x, y)) continue;
                
                const noiseVal = fbm(x * config.noiseScale, y * config.noiseScale, resourceSeeds[resourceType], 4);
                
                if (noiseVal > config.threshold) {
                    // Check minimum distance from other resource types
                    let valid = true;
                    const checkDist = config.minDist;
                    
                    for (let dy = -checkDist; dy <= checkDist && valid; dy++) {
                        for (let dx = -checkDist; dx <= checkDist && valid; dx++) {
                            const nx = x + dx;
                            const ny = y + dy;
                            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                                const cell = state.grid[ny][nx];
                                if (cell.type && cell.type.startsWith('resource-')) {
                                    const existingType = cell.type.replace('resource-', '');
                                    if (existingType !== resourceType) {
                                        valid = false;
                                    }
                                }
                            }
                        }
                    }
                    
                    if (valid) {
                        state.grid[y][x] = {
                            type: `resource-${resourceType}`,
                            amount: config.amount,
                            entity: null
                        };
                    }
                }
            }
        }
    }
    
    // Reveal starting area
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const dist = Math.abs(x - CORE_POS.x) + Math.abs(y - CORE_POS.y);
            if (dist <= START_REVEAL_RADIUS) {
                state.revealed.add(`${x},${y}`);
            }
        }
    }
    
    // Place core
    state.grid[CORE_POS.y][CORE_POS.x] = {
        type: 'core',
        amount: 0,
        entity: 'core',
        lastProduced: 0
    };
}

function revealArea(x, y, radius = 4) {
    const state = getGameState();
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                state.revealed.add(`${nx},${ny}`);
            }
        }
    }
}

function isRevealed(x, y) {
    const state = getGameState();
    return state.revealed.has(`${x},${y}`);
}

function getCell(x, y) {
    const state = getGameState();
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
        return state.grid[y][x];
    }
    return null;
}

function setCell(x, y, data) {
    const state = getGameState();
    if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
        state.grid[y][x] = data;
    }
}

function getGridSize() {
    return GRID_SIZE;
}

function getCorePosition() {
    return CORE_POS;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateWorld, revealArea, isRevealed, getCell, setCell, getGridSize, getCorePosition, setMapSeed
    };
}
