/**
 * Forge Defense - Building System
 */

function canAfford(cost) {
    if (!cost) return true;
    return Object.entries(cost).every(([res, amount]) => gameState.resources[res] >= amount);
}

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

    worldContainer.classList.add('placing-building');
    ghostBuilding.innerHTML = `<div style="width:${def.size * CONFIG.TILE_SIZE}px;height:${def.size * CONFIG.TILE_SIZE}px;background:${def.color};border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:${def.size * 20}px;opacity:0.7;">${def.icon}</div>`;
    ghostBuilding.style.display = 'block';
    worldContainer.style.cursor = 'crosshair';
}

function handleWorldClick(e) {
    if (!gameState.placingBuilding) {
        const buildingEl = e.target.closest('.building');
        if (buildingEl) {
            // Use parseFloat since IDs are floats (Date.now() + Math.random())
            selectBuilding(parseFloat(buildingEl.dataset.id));
        } else {
            deselectBuilding();
        }
        return;
    }

    const containerRect = worldContainer.getBoundingClientRect();
    const scale = gameState.camera.scale;
    // Account for scale when converting screen to world coordinates
    const worldX = (e.clientX - containerRect.left) / scale + gameState.camera.x;
    const worldY = (e.clientY - containerRect.top) / scale + gameState.camera.y;
    const x = Math.floor(worldX / CONFIG.TILE_SIZE);
    const y = Math.floor(worldY / CONFIG.TILE_SIZE);

    placeBuilding(x, y);
}

function handleWorldMouseMove(e) {
    if (!gameState.placingBuilding) return;

    const containerRect = worldContainer.getBoundingClientRect();
    const scale = gameState.camera.scale;
    // Account for scale when converting screen to world coordinates
    const worldX = (e.clientX - containerRect.left) / scale + gameState.camera.x;
    const worldY = (e.clientY - containerRect.top) / scale + gameState.camera.y;
    const tileX = Math.floor(worldX / CONFIG.TILE_SIZE);
    const tileY = Math.floor(worldY / CONFIG.TILE_SIZE);

    const def = BUILDINGS[gameState.placingBuilding];
    // Ghost position in screen coordinates (already scaled by CSS)
    const screenX = (tileX * CONFIG.TILE_SIZE - gameState.camera.x) * scale;
    const screenY = (tileY * CONFIG.TILE_SIZE - gameState.camera.y) * scale;

    ghostBuilding.style.left = screenX + 'px';
    ghostBuilding.style.top = screenY + 'px';
    ghostBuilding.style.transform = `scale(${scale})`;
    ghostBuilding.style.transformOrigin = '0 0';
}

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
    
    // Reveal fog around the building
    if (def.revealRadius && typeof revealArea === 'function') {
        revealArea(x, y, def.revealRadius);
    }
    
    updateUI();
    updateMinimap();
    
    // Track for achievements
    gameState.achievements.buildingsPlaced++;
    if (type === 'turret' || type === 'laser-turret' || type === 'artillery') {
        gameState.achievements.turretsBuilt++;
    }
    checkObjectives();
    checkAchievements(gameState);
    
    AudioSystem.playBuildingPlace();

    if (!window.event?.shiftKey) {
        cancelPlacement();
    }
}

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
        ${def.combat ? '<div class="direction-indicator"></div>' : ''}
    `;
    world.appendChild(el);
}

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

function selectBuilding(id) {
    deselectBuilding();
    gameState.selectedBuilding = id;
    const el = document.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('selected-building');
    showBuildingTooltip(id);
}

function deselectBuilding() {
    if (gameState.selectedBuilding !== null) {
        const el = document.querySelector(`[data-id="${gameState.selectedBuilding}"]`);
        if (el) el.classList.remove('selected-building');
    }
    gameState.selectedBuilding = null;
    document.getElementById('tooltip').style.display = 'none';
}

function deleteSelectedBuilding() {
    if (gameState.selectedBuilding === null) return;
    const building = gameState.buildings.find(b => b.id === gameState.selectedBuilding);
    if (!building || building.type === 'base') {
        if (building?.type === 'base') {
            showNotification('❌ Cannot delete Command Center!');
        }
        return;
    }

    // Refund 50%
    const def = BUILDINGS[building.type];
    let refundMsg = '♻️ Salvaged: ';
    if (def.cost) {
        const refunds = [];
        Object.entries(def.cost).forEach(([res, amount]) => {
            const refund = Math.floor(amount * 0.5);
            gameState.resources[res] += refund;
            refunds.push(`+${refund} ${res.replace('-', ' ')}`);
        });
        refundMsg += refunds.join(', ');
    }

    gameState.buildings = gameState.buildings.filter(b => b.id !== gameState.selectedBuilding);
    document.querySelector(`[data-id="${gameState.selectedBuilding}"]`)?.remove();
    deselectBuilding();
    updateUI();
    updateMinimap();
    AudioSystem.playDeconstruct();
    showNotification(refundMsg);
}

function cancelPlacement() {
    gameState.placingBuilding = null;
    ghostBuilding.style.display = 'none';
    worldContainer.classList.remove('placing-building');
    document.querySelectorAll('.building-item').forEach(i => i.classList.remove('selected'));
    worldContainer.style.cursor = 'grab';
}

function showBuildingTooltip(id) {
    const building = gameState.buildings.find(b => b.id === id);
    if (!building) return;
    const def = BUILDINGS[building.type];

    const tooltip = document.getElementById('tooltip');
    document.getElementById('tooltip-title').textContent = def.name;

    let content = `<div class="stat">Health: <span>${Math.floor(building.health)}/${building.maxHealth}</span></div>`;
    if (def.combat) {
        content += `<div class="stat">Damage: <span>${def.combat.damage}</span></div>`;
        content += `<div class="stat">Range: <span>${def.combat.range} tiles</span></div>`;
    }
    if (def.production) {
        content += `<div class="stat">Production active</div>`;
    }
    if (def.desc) {
        content += `<div class="stat" style="margin-top:6px;color:#888;">${def.desc}</div>`;
    }

    document.getElementById('tooltip-content').innerHTML = content;
    tooltip.style.display = 'block';
    tooltip.style.left = '290px';
    tooltip.style.top = '60px';
}

function updateBuildingHealth(building) {
    const el = document.querySelector(`[data-id="${building.id}"] .health-bar-fill`);
    if (el) el.style.width = `${(building.health / building.maxHealth) * 100}%`;
}

function updateBuildingProduction() {
    const now = Date.now();
    gameState.production = {};

    gameState.buildings.forEach(building => {
        const def = BUILDINGS[building.type];
        if (!def.production) return;

        if (building.type === 'miner') {
            const deposit = gameState.deposits.find(d =>
                Math.abs(d.x - building.x) <= 1 && Math.abs(d.y - building.y) <= 1 && d.amount > 0
            );
            if (deposit && now - building.lastProduction >= def.production.time) {
                const resourceKey = deposit.type === 'iron' ? 'iron-ore' :
                                   deposit.type === 'copper' ? 'copper-ore' : deposit.type;
                gameState.resources[resourceKey] += def.production.rate;
                deposit.amount -= def.production.rate;
                building.lastProduction = now;
                gameState.achievements.resourcesCollected += def.production.rate;

                const depositEl = document.querySelector(`[data-deposit-id="${gameState.deposits.indexOf(deposit)}"]`);
                if (depositEl) depositEl.textContent = deposit.amount;

                trackProduction(resourceKey, def.production.rate);
            }
        }

        if (building.type === 'furnace') {
            if (now - building.lastProduction >= def.production.time) {
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
            if (now - building.lastProduction >= def.production.time) {
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
    
    checkObjectives();
}

function trackProduction(resource, amount) {
    gameState.production[resource] = (gameState.production[resource] || 0) + amount;
}

function setupEventListeners() {
    // Building palette
    const buildingList = document.getElementById('building-list');
    Object.entries(BUILDINGS).forEach(([type, def]) => {
        if (def.isBase) return;
        
        const item = document.createElement('div');
        item.className = 'building-item';
        item.dataset.building = type;
        item.innerHTML = `
            ${def.key ? `<span class="keybind">${def.key}</span>` : ''}
            <div class="building-preview" style="background:${def.color}">${def.icon}</div>
            <div class="building-name">${def.name}</div>
            <div class="building-cost">${formatCost(def.cost)}</div>
        `;
        item.addEventListener('click', () => selectBuildingForPlacement(type));
        buildingList.appendChild(item);
    });

    // World interactions
    worldContainer.addEventListener('click', handleWorldClick);
    worldContainer.addEventListener('mousemove', handleWorldMouseMove);
    worldContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        
        // If clicking on a building, delete it
        const buildingEl = e.target.closest('.building');
        if (buildingEl) {
            const id = parseFloat(buildingEl.dataset.id);
            selectBuilding(id);
            deleteSelectedBuilding();
            return;
        }
        
        cancelPlacement();
    });

    // Camera drag
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let cameraAtDragStart = { x: 0, y: 0 };

    worldContainer.addEventListener('mousedown', (e) => {
        if (e.button === 1 || (e.button === 0 && !gameState.placingBuilding)) {
            isDragging = true;
            dragStart = { x: e.clientX, y: e.clientY };
            cameraAtDragStart = { x: gameState.camera.x, y: gameState.camera.y };
            worldContainer.style.cursor = 'grabbing';
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const scale = gameState.camera.scale;
            // Divide by scale so dragging feels natural at any zoom level
            gameState.camera.x = cameraAtDragStart.x + (dragStart.x - e.clientX) / scale;
            gameState.camera.y = cameraAtDragStart.y + (dragStart.y - e.clientY) / scale;
            updateCameraPosition();
        }
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        worldContainer.style.cursor = gameState.placingBuilding ? 'crosshair' : 'grab';
    });

    // Keyboard
    window.addEventListener('keydown', (e) => {
        const speed = 20 / gameState.camera.scale;  // Adjust for zoom
        switch(e.key.toLowerCase()) {
            case 'w': gameState.camera.y -= speed; updateCameraPosition(); break;
            case 's': gameState.camera.y += speed; updateCameraPosition(); break;
            case 'a': gameState.camera.x -= speed; updateCameraPosition(); break;
            case 'd': gameState.camera.x += speed; updateCameraPosition(); break;
            case 'r': rotateBuilding(); break;
            case 'q': case 'escape': cancelPlacement(); deselectBuilding(); break;
            case 'delete': case 'backspace': deleteSelectedBuilding(); break;
        }
        
        // Number keys for building selection
        if (BUILDING_KEYS[e.key]) {
            selectBuildingForPlacement(BUILDING_KEYS[e.key]);
        }
    });

    // Minimap click - navigate to clicked location
    minimapCanvas.addEventListener('click', (e) => {
        const rect = minimapCanvas.getBoundingClientRect();
        const mmScale = CONFIG.WORLD_SIZE * CONFIG.TILE_SIZE / minimapCanvas.width;
        const camScale = gameState.camera.scale;
        // Calculate visible area size accounting for zoom
        const visibleWidth = worldContainer.clientWidth / camScale;
        const visibleHeight = worldContainer.clientHeight / camScale;
        // Center camera on clicked point
        gameState.camera.x = (e.clientX - rect.left) * mmScale - visibleWidth / 2;
        gameState.camera.y = (e.clientY - rect.top) * mmScale - visibleHeight / 2;
        updateCameraPosition();
    });
    
    // Initialize audio on first interaction
    document.addEventListener('click', () => AudioSystem.resume(), { once: true });
}

function formatCost(cost) {
    if (!cost) return 'Free';
    return Object.entries(cost).map(([res, amt]) => {
        const icons = {
            'iron-plates': '▬', 'copper-plates': '▬', stone: '◐', 
            circuits: '◈', coal: '■', 'iron-ore': '⚫', 'copper-ore': '🟠'
        };
        return `${amt}${icons[res] || res.charAt(0)}`;
    }).join(' ');
}
