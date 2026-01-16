/**
 * Buildings Module
 * Building placement, production logic, resource management
 */

function canAfford(building) {
    const state = getGameState();
    return Object.entries(BUILDINGS[building].cost).every(([res, cost]) => 
        state.resources[res] >= cost
    );
}

function canPlaceBuilding(x, y, buildingType) {
    const state = getGameState();
    const cell = getCell(x, y);
    
    if (!cell) return false;
    if (cell.entity) return false;
    if (BUILDINGS[buildingType].requiresResource && !cell.type?.startsWith('resource-')) return false;
    if (buildingType === 'pumpjack' && cell.type !== 'resource-oil') return false;
    if (x === CORE_POS.x && y === CORE_POS.y) return false;
    
    // Fog of war check
    if (!isRevealed(x, y)) {
        showMessage('Cannot build in unexplored territory!', '#f80');
        return false;
    }
    return true;
}

function placeBuilding(x, y) {
    const state = getGameState();
    
    if (!state.buildingInHand) {
        console.log('placeBuilding: no building in hand');
        return;
    }
    
    const building = state.buildingInHand.type;
    console.log('placeBuilding: placing', building, 'at', x, y);
    
    // Cannot build on core
    if (x === CORE_POS.x && y === CORE_POS.y) {
        showMessage('Cannot build on CORE!', '#f00');
        state.buildingInHand = null;
        document.querySelectorAll('.building-btn').forEach(b => b.classList.remove('selected'));
        return;
    }
    
    // Validate placement
    if (!canPlaceBuilding(x, y, building)) {
        const buildingName = building.charAt(0).toUpperCase() + building.slice(1);
        showMessage(`${buildingName} must be placed on ${building === 'miner' ? 'resource tile' : 'valid location'}!`, '#f80');
        state.buildingInHand = null;
        document.querySelectorAll('.building-btn').forEach(b => b.classList.remove('selected'));
        return;
    }
    
    // Check affordability
    if (!canAfford(building)) {
        const needed = Object.entries(BUILDINGS[building].cost)
            .filter(([res, cost]) => state.resources[res] < cost)
            .map(([res, cost]) => `${cost - Math.floor(state.resources[res])} ${res}`)
            .join(', ');
        showMessage(`Need: ${needed}`, '#f80');
        AudioSystem?.playLowResource();
        state.buildingInHand = null;
        document.querySelectorAll('.building-btn').forEach(b => b.classList.remove('selected'));
        return;
    }
    
    // Deduct resources
    Object.entries(BUILDINGS[building].cost).forEach(([res, cost]) => {
        state.resources[res] -= cost;
    });
    
    // Place building
    const cell = getCell(x, y);
    cell.entity = building;
    cell.rotation = state.buildingInHand.rotation;
    cell.lastProduced = Date.now();
    cell.productionActive = false;
    cell.barrierHealth = building === 'barrier' ? 100 : undefined;
    
    // Set default production type for assembler
    if (building === 'assembler') {
        cell.productionType = 'ammo';
    }
    
    console.log('Building placed, cell.entity:', cell.entity);
    
    // Play sound and reveal area
    AudioSystem?.playBuildingPlace();
    revealArea(x, y, 4);
    
    // Update UI
    updateGridView();
    updateResources();
    
    // Clear selection
    state.buildingInHand = null;
    document.querySelectorAll('.building-btn').forEach(b => b.classList.remove('selected'));
    
    // Track achievements
    if (building === 'turret') {
        state.achievements.turretsBuilt++;
        checkAchievements();
    }
}

function handleRightClick(x, y) {
    const cell = getCell(x, y);
    if (!cell) return;
    
    // Cannot deconstruct core
    if (cell.entity === 'core') return;
    
    // Fog of war check
    if (!isRevealed(x, y)) {
        showMessage('Cannot interact with unexplored territory!', '#f80');
        return;
    }
    
    if (cell.entity) {
        const deconstructTime = 500;
        showMessage('Deconstructing...', '#888');
        
        setTimeout(() => {
            // Refund 50%
            Object.entries(BUILDINGS[cell.entity].cost).forEach(([res, cost]) => {
                const state = getGameState();
                state.resources[res] += Math.floor(cost / 2);
            });
            
            cell.entity = null;
            updateGridView();
            updateResources();
            AudioSystem?.playDeconstruct();
            showMessage('Deconstructed! (50% refund)', '#0f0');
        }, deconstructTime);
    }
}

function handleCellClick(x, y, e) {
    console.log('handleCellClick called for', x, y, 'buildingInHand:', getGameState()?.buildingInHand);
    const state = getGameState();
    const cell = getCell(x, y);
    
    if (!cell) {
        console.log('handleCellClick: cell is null');
        return;
    }
    
    if (state.isPaused) {
        console.log('handleCellClick: game is paused');
        return;
    }
    
    // Click on assembler to configure production
    if (!state.buildingInHand && cell.entity === 'assembler' && isRevealed(x, y)) {
        e.stopPropagation();
        showAssemblerConfig(x, y);
        return;
    }
    
    // Mining resources
    if (!state.buildingInHand && isRevealed(x, y) && 
        cell.type && cell.type.startsWith('resource-') && cell.amount > 0) {
        const resource = cell.type.split('-')[1];
        cell.amount -= 1;
        state.resources[resource] += 1;
        AudioSystem?.playMining();
        showMessage(`+1 ${resource}`, '#0f0');
        updateGridView();
        updateResources();
        return;
    }
    
    placeBuilding(x, y);
}

function processProduction() {
    const state = getGameState();
    const now = Date.now();
    
    // Initialize production tracking for this tick
    state.productionStats = state.productionStats || {
        activeMiners: 0,
        activeFurnaces: 0,
        activeAssemblers: 0,
        activePumpjacks: 0,
        productionRates: { iron: 0, copper: 0, coal: 0, stone: 0, oil: 0, steel: 0, gear: 0, circuit: 0, ammo: 0 }
    };
    
    // Reset active counts for this tick
    state.productionStats.activeMiners = 0;
    state.productionStats.activeFurnaces = 0;
    state.productionStats.activeAssemblers = 0;
    state.productionStats.activePumpjacks = 0;
    
    // Reset production rates for this tick (accumulate during processing)
    Object.keys(state.productionStats.productionRates).forEach(key => {
        state.productionStats.productionRates[key] = 0;
    });
    
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = getCell(x, y);
            if (!cell.entity || cell.lastProduced + 2000 > now) continue;
            
            switch(cell.entity) {
                case 'miner':
                    const resource = cell.type?.split('-')[1];
                    if (resource && cell.amount > 0) {
                        const amount = resource === 'oil' ? 0.5 : 1;
                        cell.amount -= amount;
                        state.resources[resource] += amount;
                        cell.lastProduced = now;
                        cell.productionActive = true;
                        state.productionStats.activeMiners++;
                        state.productionStats.productionRates[resource] += amount;
                    } else {
                        cell.productionActive = false;
                    }
                    break;
                case 'furnace':
                    if (state.resources.iron >= 5 && state.resources.coal >= 1) {
                        state.resources.iron -= 5;
                        state.resources.coal -= 1;
                        state.resources.steel += 1;
                        cell.lastProduced = now;
                        cell.productionActive = true;
                        state.productionStats.activeFurnaces++;
                        state.productionStats.productionRates.steel += 1;
                        state.productionStats.productionRates.iron -= 5;
                        state.productionStats.productionRates.coal -= 1;
                    } else {
                        cell.productionActive = false;
                    }
                    break;
                case 'assembler':
                    const recipe = ASSEMBLER_RECIPES[cell.productionType] || ASSEMBLER_RECIPES.ammo;
                    const canProduce = Object.entries(recipe.inputs).every(
                        ([res, amount]) => state.resources[res] >= amount
                    );
                    const outputKey = Object.keys(recipe.output)[0];
                    const outputLimit = outputKey === 'ammo' ? 200 : 100;
                    const outputAmount = Object.values(recipe.output)[0];
                    
                    if (state.resources[outputKey] < outputLimit && canProduce) {
                        Object.entries(recipe.inputs).forEach(([res, amount]) => {
                            state.resources[res] -= amount;
                            state.productionStats.productionRates[res] -= amount;
                        });
                        Object.entries(recipe.output).forEach(([res, amount]) => {
                            state.resources[res] += amount;
                            state.productionStats.productionRates[res] += amount;
                        });
                        cell.lastProduced = now;
                        cell.productionActive = true;
                        state.productionStats.activeAssemblers++;
                    } else {
                        cell.productionActive = false;
                    }
                    break;
                case 'pumpjack':
                    if (cell.type === 'resource-oil' && cell.amount > 0) {
                        cell.amount -= 0.5;
                        state.resources.oil += 1;
                        cell.lastProduced = now;
                        cell.productionActive = true;
                        state.productionStats.activePumpjacks++;
                        state.productionStats.productionRates.oil += 1;
                    } else {
                        cell.productionActive = false;
                    }
                    break;
            }
        }
    }
}

function countBuildings(type) {
    let count = 0;
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = getCell(x, y);
            if (cell && cell.entity === type) count++;
        }
    }
    return count;
}

function countActiveBuildings(type) {
    let count = 0;
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = getCell(x, y);
            if (cell && cell.entity === type && cell.productionActive) count++;
        }
    }
    return count;
}

function getBuildingInfo(type) {
    return BUILDINGS[type];
}

function getAllBuildingTypes() {
    return Object.keys(BUILDINGS);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        canAfford, canPlaceBuilding, placeBuilding, handleRightClick, handleCellClick,
        processProduction, countBuildings, countActiveBuildings, getBuildingInfo, getAllBuildingTypes
    };
}
