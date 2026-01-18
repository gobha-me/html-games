/**
 * FactorIO Defense - Enemy AI & Wave System
 * Extracted from game.js per #52
 */

/** Spawn enemies for wave **/
function waveTimer() {
    if (gameState.isGameOver || gameState.isPaused) return;

    gameState.waveTimer--;
    document.getElementById('wave-timer').textContent = gameState.waveTimer;

    if (gameState.waveTimer <= 0) {
        spawnWave();
        gameState.waveTimer = CONFIG.WAVE_INTERVAL;
    }
}

/** Spawn enemy wave **/
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

/** Create individual enemy **/
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

/** Create enemy DOM element **/
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

/** Enemy movement and AI **/
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

/** Update enemy counter **/
function updateEnemyCount() {
    document.getElementById('enemies-alive').textContent = gameState.enemies.length;
}

/** Apply damage to enemy **/
function damageEnemy(enemy, damage) {
    enemy.health -= damage;
    showDamageNumber(enemy.x, enemy.y, Math.floor(damage));

    // Update health bar
    const el = document.querySelector(`[data-enemy-id="${enemy.id}"].health-bar-fill`);
    if (el) el.style.width = `${Math.max(0, (enemy.health / enemy.maxHealth) * 100)}%`;

    if (enemy.health <= 0) {
        killEnemy(enemy);
    }
}

/** Handle enemy death **/
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

/** Visual explosion effect **/
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

/** Floating damage text **/
function showDamageNumber(x, y, damage) {
    const el = document.createElement('div');
    el.className = 'damage-number';
    el.textContent = '-' + damage;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    world.appendChild(el);
    setTimeout(() => el.remove(), 800);
}