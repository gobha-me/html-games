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
    
    if (!state.buildingInHand) return;
    
    const building = state.buildingInHand.type;
    
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
    cell.barrierHealth = building === 'barrier' ? 100 : undefined;
    
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
    const state = getGameState();
    const cell = getCell(x, y);
    
    if (state.isPaused) return;
    
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
                    }
                    break;
                case 'furnace':
                    if (state.resources.iron >= 5 && state.resources.coal >= 1) {
                        state.resources.iron -= 5;
                        state.resources.coal -= 1;
                        state.resources.steel += 1;
                        cell.lastProduced = now;
                    }
                    break;
                case 'assembler':
                    if (state.resources.ammo < 200 && state.resources.iron >= 2 && state.resources.copper >= 1) {
                        state.resources.iron -= 2;
                        state.resources.copper -= 1;
                        state.resources.ammo += 5;
                        cell.lastProduced = now;
                    }
                    break;
                case 'pumpjack':
                    if (cell.type === 'resource-oil' && cell.amount > 0) {
                        cell.amount -= 0.5;
                        state.resources.oil += 1;
                        cell.lastProduced = now;
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
        processProduction, countBuildings, getBuildingInfo, getAllBuildingTypes
    };
}
