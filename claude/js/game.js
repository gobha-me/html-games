/**
 * FactorIO Defense - Game Logic
 */

// ============= INITIALIZATION =============
function init() {
    generateWorld();
    setupZoom();
    spawnBase();
    setupEventListeners(); // From buildings.js module
    loadGame();
    updateUI();
    gameLoop();
    setInterval(gameTick, 100);
    setInterval(updateBuildingProduction, 1000); // From buildings.js module
    setInterval(waveTimer, 1000);
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

// function productionTick() - MOVED to buildings.js as updateBuildingProduction()

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

    // Update building costs - now handled in buildings.js via canAfford()

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
                    renderBuilding(b); // Still needed for loading
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