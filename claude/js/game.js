/**
 * FactorIO Defense - Game Logic
 */

// ============= INITIALIZATION =============
function init() {
    generateWorld();
    setupZoom();
    spawnBase();
    setupEventListeners();
    loadGame();
    updateUI();
    gameLoop();
    setInterval(gameTick, 100);
    setInterval(productionTick, 1000);
    setInterval(waveTimer, 1000);
}

// ============= EVENT LISTENERS =============
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

function handleWorldMouseMove(e) {
    if (!gameState.placingBuilding) return;
    
    const rect = worldContainer.getBoundingClientRect();
    ghostBuilding.style.left = (e.clientX - rect.left - 20) + 'px';
    ghostBuilding.style.top = (e.clientY - rect.top - 20) + 'px';
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

function canAfford(cost) {
    if (!cost) return true;
    return Object.entries(cost).every(([res, amount]) => gameState.resources[res] >= amount);
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
        ${def.combat ? '<div class="direction-indicator" style="top:-3px;left:50%;transform:translateX(-50%);"></div>' : ''}
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

function cancelPlacement() {
    gameState.placingBuilding = null;
    ghostBuilding.style.display = 'none';
    document.querySelectorAll('.building-item').forEach(i => i.classList.remove('selected'));
    worldContainer.style.cursor = 'grab';
}

function showBuildingTooltip(id) {
    const building = gameState.buildings.find(b => b.id === id);
    if (!building) return;
    const def = BUILDINGS[building.type];
    
    const tooltip = document.getElementById('tooltip');
    document.getElementById('tooltip-title').textContent = def.name;
    
    let content = `<div class="stat">Health: <span>${building.health}/${building.maxHealth}</span></div>`;
    if (def.combat) {
        content += `<div class="stat">Damage: <span>${def.combat.damage}</span></div>`;
        content += `<div class="stat">Range: <span>${def.combat.range} tiles</span></div>`;
    }
    if (def.production) {
        content += `<div class="stat">Production active</div>`;
    }
    
    document.getElementById('tooltip-content').innerHTML = content;
    tooltip.style.display = 'block';
    tooltip.style.left = '290px';
    tooltip.style.top = '60px';
}

// ============= GAME LOOPS =============
function gameLoop() {
    if (gameState.isGameOver) return;
    
    updateEnemies();
    updateTurrets();
    updateProjectiles();
    
    requestAnimationFrame(gameLoop);
}

function gameTick() {
    if (gameState.isGameOver || gameState.isPaused) return;
    gameState.gameTime += 100;
    updateGameStats();
}

function productionTick() {
    if (gameState.isGameOver || gameState.isPaused) return;
    
    const now = Date.now();
    gameState.production = {};
    
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
    
    updateUI();
    updateProductionPanel();
}

function trackProduction(resource, amount) {
    gameState.production[resource] = (gameState.production[resource] || 0) + amount;
}

function updateProductionPanel() {
    const panel = document.getElementById('production-stats');
    let html = '';
    Object.entries(gameState.production).forEach(([res, amount]) => {
        const perMin = amount * 60;
        html += `<div class="prod-row"><span>${res}</span><span class="prod-positive">+${perMin}/m</span></div>`;
    });
    panel.innerHTML = html || '<div style="color:#666;">No production</div>';
}

// ============= WAVE SYSTEM =============
function waveTimer() {
    if (gameState.isGameOver || gameState.isPaused) return;
    
    gameState.waveTimer--;
    document.getElementById('wave-timer').textContent = gameState.waveTimer;
    
    if (gameState.waveTimer <= 0) {
        spawnWave();
        gameState.waveTimer = CONFIG.WAVE_INTERVAL;
    }
}

function spawnWave() {
    const wave = gameState.wave;
    showNotification(`⚔️ WAVE ${wave} INCOMING!`);
    
    // Calculate enemy counts based on wave
    const basicCount = 5 + wave * 2;
    const fastCount = Math.floor(wave / 2);
    const tankCount = Math.floor(wave / 5);
    const bossCount = wave % 10 === 0 ? 1 : 0;
    
    const spawnEnemies = (type, count) => {
        for (let i = 0; i < count; i++) {
            setTimeout(() => spawnEnemy(type), i * 500);
        }
    };
    
    spawnEnemies('basic', basicCount);
    spawnEnemies('fast', fastCount);
    spawnEnemies('tank', tankCount);
    if (bossCount) setTimeout(() => spawnEnemy('boss'), 3000);
    
    gameState.wave++;
    document.getElementById('wave-number').textContent = gameState.wave;
    
    // Check victory
    if (wave >= CONFIG.VICTORY_WAVE) {
        document.getElementById('victory-screen').style.display = 'flex';
    }
}

function spawnEnemy(type) {
    const def = ENEMIES[type];
    const angle = Math.random() * Math.PI * 2;
    const distance = CONFIG.SPAWN_DISTANCE * CONFIG.TILE_SIZE;
    
    const enemy = {
        id: Date.now() + Math.random(),
        type,
        x: CONFIG.BASE_CENTER.x * CONFIG.TILE_SIZE + Math.cos(angle) * distance,
        y: CONFIG.BASE_CENTER.y * CONFIG.TILE_SIZE + Math.sin(angle) * distance,
        health: def.health * (1 + gameState.wave * 0.1),
        maxHealth: def.health * (1 + gameState.wave * 0.1),
        speed: def.speed,
        damage: def.damage * (1 + gameState.wave * 0.05)
    };
    
    gameState.enemies.push(enemy);
    renderEnemy(enemy);
    updateEnemyCount();
}

function renderEnemy(enemy) {
    const def = ENEMIES[enemy.type];
    const el = document.createElement('div');
    el.className = 'enemy ' + enemy.type;
    el.dataset.enemyId = enemy.id;
    el.style.left = enemy.x + 'px';
    el.style.top = enemy.y + 'px';
    el.style.width = (enemy.type === 'boss' ? 50 : enemy.type === 'tank' ? 35 : 25) + 'px';
    el.style.height = (enemy.type === 'boss' ? 50 : enemy.type === 'tank' ? 35 : 25) + 'px';
    el.innerHTML = `
        ${enemy.type === 'boss' ? '👹' : enemy.type === 'tank' ? '🐛' : enemy.type === 'fast' ? '🦗' : '🐜'}
        <div class="health-bar"><div class="health-bar-fill" style="width:100%"></div></div>
    `;
    world.appendChild(el);
}

function updateEnemies() {
    const base = gameState.buildings.find(b => b.type === 'base');
    if (!base) return;
    
    const baseX = base.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE;
    const baseY = base.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE;
    
    gameState.enemies.forEach(enemy => {
        const def = ENEMIES[enemy.type];
        
        // Find nearest target (walls/turrets first, then base)
        let targetX = baseX;
        let targetY = baseY;
        let targetBuilding = base;
        let minDist = Infinity;
        
        gameState.buildings.forEach(b => {
            if (b.type === 'base') return;
            const bx = b.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
            const by = b.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
            const dist = Math.hypot(enemy.x - bx, enemy.y - by);
            if (dist < minDist && dist < 200) {
                minDist = dist;
                targetX = bx;
                targetY = by;
                targetBuilding = b;
            }
        });
        
        // Move toward target
        const dx = targetX - enemy.x;
        const dy = targetY - enemy.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 20) {
            enemy.x += (dx / dist) * enemy.speed * 2;
            enemy.y += (dy / dist) * enemy.speed * 2;
        } else {
            // Attack
            targetBuilding.health -= enemy.damage * 0.05;
            if (targetBuilding.health <= 0) {
                if (targetBuilding.type === 'base') {
                    gameOver();
                } else {
                    gameState.buildings = gameState.buildings.filter(b => b.id !== targetBuilding.id);
                    document.querySelector(`[data-id="${targetBuilding.id}"]`)?.remove();
                }
            }
            updateBuildingHealth(targetBuilding);
        }
        
        // Update position
        const el = document.querySelector(`[data-enemy-id="${enemy.id}"]`);
        if (el) {
            el.style.left = enemy.x + 'px';
            el.style.top = enemy.y + 'px';
        }
    });
    
    updateMinimap();
}

function updateBuildingHealth(building) {
    const el = document.querySelector(`[data-id="${building.id}"] .health-bar-fill`);
    if (el) el.style.width = `${(building.health / building.maxHealth) * 100}%`;
}

function updateEnemyCount() {
    document.getElementById('enemies-alive').textContent = gameState.enemies.length;
}

// ============= COMBAT SYSTEM =============
function updateTurrets() {
    const now = Date.now();
    
    gameState.buildings.forEach(building => {
        const def = BUILDINGS[building.type];
        if (!def.combat) return;
        
        // Check fire rate
        if (now - building.lastFire < def.combat.fireRate) return;
        
        // Check ammo
        if (def.combat.ammoUse > 0) {
            const ammoType = def.combat.usesShells ? 'shells' : 'ammo';
            if (gameState.resources[ammoType] < def.combat.ammoUse) return;
        }
        
        // Find target in range
        const bx = building.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        const by = building.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        const range = def.combat.range * CONFIG.TILE_SIZE;
        
        let target = null;
        let minDist = Infinity;
        
        gameState.enemies.forEach(enemy => {
            const dist = Math.hypot(enemy.x - bx, enemy.y - by);
            if (dist < range && dist < minDist) {
                minDist = dist;
                target = enemy;
            }
        });
        
        if (target) {
            // Consume ammo
            if (def.combat.ammoUse > 0) {
                const ammoType = def.combat.usesShells ? 'shells' : 'ammo';
                gameState.resources[ammoType] -= def.combat.ammoUse;
            }
            
            building.lastFire = now;
            fireProjectile(building, target, def.combat);
        }
    });
}

function fireProjectile(building, target, combat) {
    const bx = building.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    const by = building.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    
    const projectile = {
        id: Date.now() + Math.random(),
        x: bx,
        y: by,
        targetId: target.id,
        damage: combat.damage,
        splash: combat.splash || 0,
        speed: combat.usesShells ? 8 : 15,
        isArtillery: !!combat.usesShells
    };
    
    gameState.projectiles.push(projectile);
    renderProjectile(projectile);
}

function renderProjectile(proj) {
    const el = document.createElement('div');
    el.className = 'projectile' + (proj.isArtillery ? ' artillery' : '');
    el.dataset.projId = proj.id;
    el.style.left = proj.x + 'px';
    el.style.top = proj.y + 'px';
    world.appendChild(el);
}

function updateProjectiles() {
    gameState.projectiles = gameState.projectiles.filter(proj => {
        const target = gameState.enemies.find(e => e.id === proj.targetId);
        if (!target) {
            document.querySelector(`[data-proj-id="${proj.id}"]`)?.remove();
            return false;
        }
        
        const dx = target.x - proj.x;
        const dy = target.y - proj.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist < 15) {
            // Hit!
            createExplosion(proj.x, proj.y, proj.isArtillery ? 40 : 20);
            
            if (proj.splash > 0) {
                // Splash damage
                gameState.enemies.forEach(e => {
                    const eDist = Math.hypot(e.x - proj.x, e.y - proj.y);
                    if (eDist < proj.splash * CONFIG.TILE_SIZE) {
                        damageEnemy(e, proj.damage * (1 - eDist / (proj.splash * CONFIG.TILE_SIZE)));
                    }
                });
            } else {
                damageEnemy(target, proj.damage);
            }
            
            document.querySelector(`[data-proj-id="${proj.id}"]`)?.remove();
            return false;
        }
        
        // Move projectile
        proj.x += (dx / dist) * proj.speed;
        proj.y += (dy / dist) * proj.speed;
        
        const el = document.querySelector(`[data-proj-id="${proj.id}"]`);
        if (el) {
            el.style.left = proj.x + 'px';
            el.style.top = proj.y + 'px';
        }
        
        return true;
    });
}

function damageEnemy(enemy, damage) {
    enemy.health -= damage;
    showDamageNumber(enemy.x, enemy.y, Math.floor(damage));
    
    // Update health bar
    const el = document.querySelector(`[data-enemy-id="${enemy.id}"] .health-bar-fill`);
    if (el) el.style.width = `${Math.max(0, (enemy.health / enemy.maxHealth) * 100)}%`;
    
    if (enemy.health <= 0) {
        killEnemy(enemy);
    }
}

function killEnemy(enemy) {
    const def = ENEMIES[enemy.type];
    
    // Reward
    Object.entries(def.reward).forEach(([res, amount]) => {
        gameState.resources[res] += amount;
    });
    
    gameState.kills++;
    gameState.enemies = gameState.enemies.filter(e => e.id !== enemy.id);
    document.querySelector(`[data-enemy-id="${enemy.id}"]`)?.remove();
    createExplosion(enemy.x, enemy.y, 30);
    updateUI();
    updateEnemyCount();
}

function createExplosion(x, y, size) {
    const el = document.createElement('div');
    el.className = 'explosion';
    el.style.left = (x - size/2) + 'px';
    el.style.top = (y - size/2) + 'px';
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    world.appendChild(el);
    setTimeout(() => el.remove(), 300);
}

function showDamageNumber(x, y, damage) {
    const el = document.createElement('div');
    el.className = 'damage-number';
    el.textContent = '-' + damage;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    world.appendChild(el);
    setTimeout(() => el.remove(), 800);
}

// ============= UI UPDATES =============
function updateUI() {
    Object.entries(gameState.resources).forEach(([key, value]) => {
        const el = document.getElementById(key);
        if (el) el.textContent = Math.floor(value);
    });
    
    // Update building costs
    document.querySelectorAll('.building-item').forEach(item => {
        const type = item.dataset.building;
        const def = BUILDINGS[type];
        if (canAfford(def.cost)) {
            item.classList.remove('disabled');
        } else {
            item.classList.add('disabled');
        }
    });
    
    document.getElementById('stat-buildings').textContent = gameState.buildings.length;
    document.getElementById('stat-kills').textContent = gameState.kills;
}

function updateGameStats() {
    const mins = Math.floor(gameState.gameTime / 60000);
    const secs = Math.floor((gameState.gameTime % 60000) / 1000);
    document.getElementById('stat-time').textContent = 
        `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function showNotification(text) {
    const el = document.getElementById('notification');
    el.textContent = text;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

// ============= MINIMAP =============
function updateMinimap() {
    minimapCanvas.width = 180;
    minimapCanvas.height = 180;
    
    const scale = 180 / (CONFIG.WORLD_SIZE * CONFIG.TILE_SIZE);
    
    // Background
    minimapCtx.fillStyle = '#0a0a15';
    minimapCtx.fillRect(0, 0, 180, 180);
    
    // Deposits
    gameState.deposits.forEach(d => {
        minimapCtx.fillStyle = d.type === 'iron' ? '#7f8c8d' : 
                              d.type === 'copper' ? '#e67e22' : 
                              d.type === 'coal' ? '#34495e' : '#95a5a6';
        minimapCtx.fillRect(d.x * CONFIG.TILE_SIZE * scale, d.y * CONFIG.TILE_SIZE * scale, 4, 4);
    });
    
    // Buildings
    gameState.buildings.forEach(b => {
        minimapCtx.fillStyle = b.type === 'base' ? '#9b59b6' : 
                              b.type === 'turret' || b.type === 'laser-turret' ? '#e74c3c' :
                              b.type === 'wall' ? '#7f8c8d' : '#3498db';
        const size = BUILDINGS[b.type].size * CONFIG.TILE_SIZE * scale;
        minimapCtx.fillRect(b.x * CONFIG.TILE_SIZE * scale, b.y * CONFIG.TILE_SIZE * scale, size, size);
    });
    
    // Enemies
    minimapCtx.fillStyle = '#e74c3c';
    gameState.enemies.forEach(e => {
        minimapCtx.beginPath();
        minimapCtx.arc(e.x * scale, e.y * scale, 2, 0, Math.PI * 2);
        minimapCtx.fill();
    });
    
    updateMinimapViewport();
}

function updateMinimapViewport() {
    const scale = 180 / (CONFIG.WORLD_SIZE * CONFIG.TILE_SIZE);
    const viewport = document.getElementById('minimap-viewport');
    viewport.style.left = (gameState.camera.x * scale) + 'px';
    viewport.style.top = (gameState.camera.y * scale) + 'px';
    // Visible area shrinks when zoomed in (higher zoom = smaller viewport)
    const visibleWidth = worldContainer.clientWidth / gameState.camera.zoom;
    const visibleHeight = worldContainer.clientHeight / gameState.camera.zoom;
    viewport.style.width = (visibleWidth * scale) + 'px';
    viewport.style.height = (visibleHeight * scale) + 'px';
}

// ============= SAVE/LOAD =============
function saveGame() {
    const saveData = {
        resources: gameState.resources,
        buildings: gameState.buildings,
        deposits: gameState.deposits,
        wave: gameState.wave,
        gameTime: gameState.gameTime,
        kills: gameState.kills
    };
    localStorage.setItem('factorio-defense-save', JSON.stringify(saveData));
    showNotification('💾 Game Saved!');
}

function loadGame() {
    const saveData = localStorage.getItem('factorio-defense-save');
    if (!saveData) return;
    
    try {
        const data = JSON.parse(saveData);
        gameState.resources = { ...gameState.resources, ...data.resources };
        gameState.wave = data.wave || 1;
        gameState.gameTime = data.gameTime || 0;
        gameState.kills = data.kills || 0;
        
        // Restore deposits
        if (data.deposits) {
            gameState.deposits = data.deposits;
            document.querySelectorAll('.resource-deposit').forEach((el, i) => {
                if (gameState.deposits[i]) {
                    el.textContent = gameState.deposits[i].amount;
                }
            });
        }
        
        // Restore buildings (except base which is already spawned)
        if (data.buildings) {
            data.buildings.forEach(b => {
                if (b.type !== 'base') {
                    gameState.buildings.push(b);
                    renderBuilding(b);
                }
            });
        }
        
        updateUI();
        document.getElementById('wave-number').textContent = gameState.wave;
        showNotification('📂 Game Loaded!');
    } catch (e) {
        console.error('Failed to load:', e);
    }
}

function gameOver() {
    gameState.isGameOver = true;
    document.getElementById('defeat-wave').textContent = gameState.wave;
    document.getElementById('defeat-screen').style.display = 'flex';
}

function continueGame() {
    document.getElementById('victory-screen').style.display = 'none';
}

// ============= INIT =============

/*
 * FactorIO Defense - Game Logic
 */
init();
