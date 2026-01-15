/**
 * World Module
 * World generation, resources, fog of war
 */

function generateWorld() {
    const state = getGameState();
    const startPos = [];
    
    // Collect valid starting positions around core
    for (let dy = -START_REVEAL_RADIUS; dy <= START_REVEAL_RADIUS; dy++) {
        for (let dx = -START_REVEAL_RADIUS; dx <= START_REVEAL_RADIUS; dx++) {
            const x = CORE_POS.x + dx, y = CORE_POS.y + dy;
            if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                    startPos.push({ x, y, dist: Math.abs(dx) + Math.abs(dy) });
                }
            }
        }
    }
    
    startPos.sort((a, b) => a.dist - b.dist);
    
    function placeCluster(resourceType, count, clusterSize = 6) {
        for (let i = 0; i < count && startPos.length > 0; i++) {
            const centerIndex = Math.min(Math.floor(startPos.length * 0.3 + Math.random() * 5), startPos.length - 1);
            const center = startPos.splice(centerIndex, 1)[0];
            if (!center) continue;
            
            for (let j = 0; j < clusterSize; j++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * 2;
                const x = Math.round(center.x + Math.cos(angle) * radius);
                const y = Math.round(center.y + Math.sin(angle) * radius);
                
                if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                    if (state.grid[y][x] === null || state.grid[y][x].type === 'ground') {
                        const amounts = { iron: 800, copper: 600, coal: 500, stone: 400, oil: 300 };
                        state.grid[y][x] = {
                            type: `resource-${resourceType}`,
                            amount: amounts[resourceType],
                            entity: null
                        };
                    }
                }
            }
        }
    }
    
    // Place resource clusters
    placeCluster('iron', 2);
    placeCluster('copper', 2);
    placeCluster('coal', 2);
    placeCluster('stone', 1);
    
    // Fill remaining with noise-based generation
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (state.grid[y][x] === null) {
                const noise = Math.sin(x * 0.03) * Math.cos(y * 0.03) * 0.6 + 
                              Math.sin(x * 0.08) * Math.cos(y * 0.08) * 0.4;
                
                if (noise > 0.65) state.grid[y][x] = { type: 'resource-iron', amount: 1000, entity: null };
                else if (noise > 0.45) state.grid[y][x] = { type: 'resource-copper', amount: 800, entity: null };
                else if (noise > 0.25) state.grid[y][x] = { type: 'resource-coal', amount: 600, entity: null };
                else if (noise > 0.05) state.grid[y][x] = { type: 'resource-stone', amount: 500, entity: null };
                else if (noise < -0.4) state.grid[y][x] = { type: 'resource-oil', amount: 200, entity: null };
                else state.grid[y][x] = { type: 'ground', amount: 0, entity: null };
            }
            
            // Reveal starting area
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
            const nx = x + dx, ny = y + dy;
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
        generateWorld, revealArea, isRevealed, getCell, setCell, getGridSize, getCorePosition
    };
}
