/** Building system for FactorIO Defense */

/**
 * Check if player can afford building cost
 */
function canAfford(cost) {
    if (!cost) return true;
    return Object.entries(cost).every(([res, amount]) => gameState.resources[res] >= amount);
}

/**
 * Select building type for placement
 */
function selectBuildingForPlacement(type) {
    const def = BUILDINGS[type];
    if (!canAfford(def.cost)) {
        showNotification('❌ Not enough resources!');
        return;
    }
    
    gameState.placingBuilding = type;
    gameState.rotation = 0;
    
    document.querySelectorAll('.building-item').forEach(i => i.classList.remove('selected'));
    document.querySelector(`[data-building="${type}"]`)?.classList.add('selected');
    
    ghostBuilding.innerHTML = `<div style="width:${def.size * CONFIG.TILE_SIZE}px;height:${def.size * CONFIG.TILE_SIZE}px;background:${def.color};border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:${def.size * 20}px;">${def.icon}</div>`;
    ghostBuilding.style.display = 'block';
    worldContainer.style.cursor = 'crosshair';
}

/**
 * Handle clicking on the world for building placement or selection
 */
function handleWorldClick(e) {
    if (!gameState.placingBuilding) {
        // Select building
        const buildingEl = e.target.closest('.building');
        if (buildingEl) {
            selectBuilding(parseInt(buildingEl.dataset.id));
        } else {
            deselectBuilding();
        }
        return;
    }
    
    const rect = world.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CONFIG.TILE_SIZE);
    const y = Math.floor((e.clientY - rect.top) / CONFIG.TILE_SIZE);
    
    placeBuilding(x, y);
}

/**
 * Update ghost building position on mouse move
 */
function handleWorldMouseMove(e) {
    if (!gameState.placingBuilding) return;
    
    const rect = worldContainer.getBoundingClientRect();
    ghostBuilding.style.left = (e.clientX - rect.left - 20) + 'px';
    ghostBuilding.style.top = (e.clientY - rect.top - 20) + 'px';
}

/**
 * Place a building at given coordinates
 */
function placeBuilding(x, y) {
    const type = gameState.placingBuilding;
    const def = BUILDINGS[type];
    
    if (!canAfford(def.cost)) {
        showNotification('❌ Not enough resources!');
        return;
    }
    
    if (!canPlaceAt(x, y, def.size)) {
        showNotification('❌ Cannot place here!');
        return;
    }
    
    // Deduct cost
    Object.entries(def.cost).forEach(([res, amount]) => {
        gameState.resources[res] -= amount;
    });
    
    const building = {
        id: Date.now() + Math.random(),
        type,
        x,
        y,
        health: def.health,
        maxHealth: def.health,
        rotation: gameState.rotation,
        lastProduction: Date.now(),
        lastFire: 0
    };
    
    gameState.buildings.push(building);
    renderBuilding(building);
    updateUI();
    updateMinimap();
    
    // Keep placing if shift held
    if (!window.event?.shiftKey) {
        cancelPlacement();
    }
}

/**
 * Check if building can be placed at coordinates
 */
function canPlaceAt(x, y, size) {
    for (let dy = 0; dy < size; dy++) {
        for (let dx = 0; dx < size; dx++) {
            const cx = x + dx;
            const cy = y + dy;
            if (cx < 0 || cy < 0 || cx >= CONFIG.WORLD_SIZE || cy >= CONFIG.WORLD_SIZE) return false;
            if (gameState.buildings.some(b => {
                const bSize = BUILDINGS[b.type].size;
                return cx >= b.x && cx < b.x + bSize && cy >= b.y && cy < b.y + bSize;
            })) return false;
        }
    }
    return true;
}

/**
 * Render a building in the world
 */
function renderBuilding(building) {
    const def = BUILDINGS[building.type];
    const el = document.createElement('div');
    el.className = 'building';
    el.dataset.id = building.id;
    el.style.left = (building.x * CONFIG.TILE_SIZE) + 'px';
    el.style.top = (building.y * CONFIG.TILE_SIZE) + 'px';
    el.style.width = (def.size * CONFIG.TILE_SIZE) + 'px';
    el.style.height = (def.size * CONFIG.TILE_SIZE) + 'px';
    el.style.background = def.color;
    el.style.transform = `rotate(${building.rotation * 90}deg)`;
    el.innerHTML = `
        ${def.icon}
<div class="health-bar"><div class="health-bar-fill" style="width:${(building.health/building.maxHealth)*100}%"></div></div>
        ${def.combat ? '<div class="direction-indicator" style="top:-3px;left:50%;transform:translateX(-50%);"></div>' : ''}
    `;
    world.appendChild(el);
}

/**
 * Rotate current building (placement or selected)
 */
function rotateBuilding() {
    gameState.rotation = (gameState.rotation + 1) % 4;
    if (gameState.selectedBuilding !== null) {
        const building = gameState.buildings.find(b => b.id === gameState.selectedBuilding);
        if (building) {
            building.rotation = gameState.rotation;
            const el = document.querySelector(`[data-id="${building.id}"]`);
            if (el) el.style.transform = `rotate(${building.rotation * 90}deg)`;
        }
    }
}

/**
 * Select a building by ID
 */
function selectBuilding(id) {
    deselectBuilding();
    gameState.selectedBuilding = id;
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('selected-building');
    showBuildingTooltip(id);
}

/**
 * Deselect current building
 */
function deselectBuilding() {
    if (gameState.selectedBuilding !== null) {
        const el = document.querySelector(`[data-id="${gameState.selectedBuilding}"]`);
        if (el) el.classList.remove('selected-building');
    }
    gameState.selectedBuilding = null;
    document.getElementById('tooltip').style.display = 'none';
}

/**
 * Delete selected building
 */
function deleteSelectedBuilding() {
    if (gameState.selectedBuilding === null) return;
    const building = gameState.buildings.find(b => b.id === gameState.selectedBuilding);
    if (!building || building.type === 'base') return;
    
    // Refund 50%
    const def = BUILDINGS[building.type];
    Object.entries(def.cost || {}).forEach(([res, amount]) => {
        gameState.resources[res] += Math.floor(amount * 0.5);
    });
    
    gameState.buildings = gameState.buildings.filter(b => b.id !== gameState.selectedBuilding);
    document.querySelector(`[data-id="${gameState.selectedBuilding}"]`)?.remove();
    gameState.selectedBuilding = null;
    updateUI();
    updateMinimap();
}

/**
 * Cancel building placement
 */
function cancelPlacement() {
    gameState.placingBuilding = null;
    ghostBuilding.style.display = 'none';
    document.querySelectorAll('.building-item').forEach(i => i.classList.remove('selected'));
    worldContainer.style.cursor = 'grab';
}

/**
 * Show tooltip for selected building
 */
function showBuildingTooltip(id) {
    const building = gameState.buildings.find(b => b.id === id);
    if (!building) return;
    const def = BUILDINGS[building.type];
    
    const tooltip = document.getElementById('tooltip');
    document.getElementById('tooltip-title').textContent = def.name;
    
    let content = `<div class=\"stat\">Health: <span>${building.health}/${building.maxHealth}</span></div>`;
    if (def.combat) {
        content += `<div class=\"stat\">Damage: <span>${def.combat.damage}</span></div>`;
        content += `<div class=\"stat\">Range: <span>${def.combat.range} tiles</span></div>`;
    }
    if (def.production) {
        content += `<div class=\"stat\">Production active</div>`;
    }
    
    document.getElementById('tooltip-content').innerHTML = content;
    tooltip.style.display = 'block';
    tooltip.style.left = '290px';
    tooltip.style.top = '60px';
}

/**
 * Track production for UI updates
 */
function trackProduction(resource, amount) {
    gameState.production[resource] = (gameState.production[resource] || 0) + amount;
}

/**
 * Update health bar for a building
 */
function updateBuildingHealth(building) {
    const el = document.querySelector(`[data-id="${building.id}"] .health-bar-fill`);
    if (el) el.style.width = `${(building.health / building.maxHealth) * 100}%`;
}

/**
 * Update building production (called from game loop)
 */
function updateBuildingProduction() {
    const now = Date.now();
    
    gameState.buildings.forEach(building => {
        const def = BUILDINGS[building.type];
        if (!def.production) return;
        
        if (building.type === 'miner') {
            // Find nearby deposit
            const deposit = gameState.deposits.find(d => 
                Math.abs(d.x - building.x) <= 1 && Math.abs(d.y - building.y) <= 1 && d.amount > 0
            );
            if (deposit && now - building.lastProduction >= def.production.time) {
                const resourceKey = deposit.type === 'iron' ? 'iron-ore' : 
                                   deposit.type === 'copper' ? 'copper-ore' : deposit.type;
                gameState.resources[resourceKey] += def.production.rate;
                deposit.amount -= def.production.rate;
                building.lastProduction = now;
                
                // Update deposit display
                const depositEl = document.querySelector(`[data-deposit-id="${gameState.deposits.indexOf(deposit)}"]`);
                if (depositEl) depositEl.textContent = deposit.amount;
                
                trackProduction(resourceKey, def.production.rate);
            }
        }
        
        if (building.type === 'furnace') {
            if (now - building.lastProduction >= def.production.time) {
                // Try iron first, then copper
                if (gameState.resources['iron-ore'] >= 1 && gameState.resources.coal >= 1) {
                    gameState.resources['iron-ore']--;
                    gameState.resources.coal--;
                    gameState.resources['iron-plates']++;
                    building.lastProduction = now;
                    trackProduction('iron-plates', 1);
                } else if (gameState.resources['copper-ore'] >= 1 && gameState.resources.coal >= 1) {
                    gameState.resources['copper-ore']--;
                    gameState.resources.coal--;
                    gameState.resources['copper-plates']++;
                    building.lastProduction = now;
                    trackProduction('copper-plates', 1);
                }
            }
        }
        
        if (building.type === 'circuit-factory') {
            if (now - building.lastProduction >= def.production.time) {
                if (gameState.resources['iron-plates'] >= 1 && gameState.resources['copper-plates'] >= 2) {
                    gameState.resources['iron-plates']--;
                    gameState.resources['copper-plates'] -= 2;
                    gameState.resources.circuits += 2;
                    building.lastProduction = now;
                    trackProduction('circuits', 2);
                }
            }
        }
        
        if (building.type === 'ammo-factory') {
            if (now - building.lastProduction >= def.production.time) {
                if (gameState.resources['iron-plates'] >= 2 && gameState.resources['copper-plates'] >= 1) {
                    gameState.resources['iron-plates'] -= 2;
                    gameState.resources['copper-plates']--;
                    gameState.resources.ammo += 5;
                    building.lastProduction = now;
                    trackProduction('ammo', 5);
                }
            }
        }
        
        if (building.type === 'assembler') {
            // Make shells for artillery
            if (now - building.lastProduction >= 5000) {
                if (gameState.resources['iron-plates'] >= 5 && gameState.resources.coal >= 2) {
                    gameState.resources['iron-plates'] -= 5;
                    gameState.resources.coal -= 2;
                    gameState.resources.shells += 1;
                    building.lastProduction = now;
                    trackProduction('shells', 1);
                }
            }
        }
    });
}

/**
 * Setup all event listeners for building system
 */
function setupEventListeners() {
    // Building palette
    document.querySelectorAll('.building-item').forEach(item => {
        item.addEventListener('click', () => selectBuildingForPlacement(item.dataset.building));
        item.addEventListener('dragstart', (e) => {
            selectBuildingForPlacement(item.dataset.building);
            e.dataTransfer.setData('text/plain', item.dataset.building);
        });
    });
    
    // World click
    worldContainer.addEventListener('click', handleWorldClick);
    worldContainer.addEventListener('mousemove', handleWorldMouseMove);
    worldContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        cancelPlacement();
    });
    
    // Camera drag
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    
    worldContainer.addEventListener('mousedown', (e) => {
        if (e.button === 1 || (e.button === 0 && !gameState.placingBuilding)) {
            isDragging = true;
            dragStart = { x: e.clientX + gameState.camera.x, y: e.clientY + gameState.camera.y };
            worldContainer.style.cursor = 'grabbing';
        }
    });
    
    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            gameState.camera.x = dragStart.x - e.clientX;
            gameState.camera.y = dragStart.y - e.clientY;
            updateCameraPosition();
        }
    });
    
    window.addEventListener('mouseup', () => {
        isDragging = false;
        worldContainer.style.cursor = gameState.placingBuilding ? 'crosshair' : 'grab';
    });
    
    // Keyboard
    window.addEventListener('keydown', (e) => {
        const speed = 20;
        switch(e.key.toLowerCase()) {
            case 'w': gameState.camera.y -= speed; updateCameraPosition(); break;
            case 's': gameState.camera.y += speed; updateCameraPosition(); break;
            case 'a': gameState.camera.x -= speed; updateCameraPosition(); break;
            case 'd': gameState.camera.x += speed; updateCameraPosition(); break;
            case 'r': rotateBuilding(); break;
            case 'q': case 'escape': cancelPlacement(); break;
            case 'delete': deleteSelectedBuilding(); break;
        }
    });
    
    // Minimap click
    minimapCanvas.addEventListener('click', (e) => {
        const rect = minimapCanvas.getBoundingClientRect();
        const scale = CONFIG.WORLD_SIZE * CONFIG.TILE_SIZE / minimapCanvas.width;
        gameState.camera.x = (e.clientX - rect.left) * scale - worldContainer.clientWidth / 2;
        gameState.camera.y = (e.clientY - rect.top) * scale - worldContainer.clientHeight / 2;
        updateCameraPosition();
    });
}