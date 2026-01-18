/**
 * Forge Defense - Enemy AI & Wave System
 */

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
    
    let waveMsg = `⚔️ WAVE ${wave} INCOMING!`;
    if (wave >= 5 && wave < 10) waveMsg += ' (Heavies!)';
    if (wave >= 10) waveMsg += ' (Boss wave!)';
    
    showNotification(waveMsg);
    AudioSystem.playWaveAnnounce();

    // Calculate enemy counts based on wave
    const basicCount = 5 + wave * 2;
    const fastCount = Math.floor(wave / 2);
    const tankCount = wave >= 5 ? Math.floor((wave - 4) / 2) : 0;
    const bossCount = wave % 10 === 0 ? 1 : 0;

    const spawnEnemies = (type, count) => {
        for (let i = 0; i < count; i++) {
            setTimeout(() => spawnEnemy(type), i * 400);
        }
    };

    spawnEnemies('basic', basicCount);
    setTimeout(() => spawnEnemies('fast', fastCount), 500);
    setTimeout(() => spawnEnemies('tank', tankCount), 1000);
    
    if (bossCount) {
        setTimeout(() => {
            spawnEnemy('boss');
            AudioSystem.playBossSpawn();
        }, 2000);
    }

    gameState.wave++;
    gameState.achievements.wavesSurvived++;
    document.getElementById('wave-number').textContent = gameState.wave;
    
    checkObjectives();
    checkAchievements(gameState);

    // Check victory
    if (wave >= CONFIG.VICTORY_WAVE) {
        setTimeout(() => {
            AudioSystem.playVictory();
            document.getElementById('victory-stats').textContent = 
                `Kills: ${gameState.totalKills} | Buildings: ${gameState.buildings.length} | Time: ${formatTime(gameState.gameTime)}`;
            document.getElementById('victory-screen').style.display = 'flex';
            gameState.objectives.victory = true;
        }, 3000);
    }
}

function spawnEnemy(type) {
    const def = ENEMIES[type];
    const wave = gameState.wave;
    const angle = Math.random() * Math.PI * 2;
    const distance = CONFIG.SPAWN_DISTANCE * CONFIG.TILE_SIZE;

    // Calculate wave-scaled stats
    const healthScale = 1 + (wave - 1) * WAVE_SCALING.healthMultiplier;
    const damageScale = 1 + (wave - 1) * WAVE_SCALING.damageMultiplier;
    const speedScale = Math.min(
        1 + (wave - 1) * WAVE_SCALING.speedMultiplier,
        WAVE_SCALING.maxSpeedMultiplier
    );

    const enemy = {
        id: Date.now() + Math.random(),
        type,
        x: CONFIG.BASE_CENTER.x * CONFIG.TILE_SIZE + Math.cos(angle) * distance,
        y: CONFIG.BASE_CENTER.y * CONFIG.TILE_SIZE + Math.sin(angle) * distance,
        health: def.health * healthScale,
        maxHealth: def.health * healthScale,
        speed: def.speed * speedScale,
        damage: def.damage * damageScale
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
    
    const size = enemy.type === 'boss' ? 50 : enemy.type === 'tank' ? 35 : 25;
    el.style.width = size + 'px';
    el.style.height = size + 'px';
    
    el.innerHTML = `
        ${def.icon}
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

        // Update position and visibility (fog of war)
        const el = document.querySelector(`[data-enemy-id="${enemy.id}"]`);
        if (el) {
            el.style.left = enemy.x + 'px';
            el.style.top = enemy.y + 'px';
            
            // Hide enemies in fog of war
            if (gameState.fogEnabled && typeof isRevealed === 'function') {
                el.style.opacity = isRevealed(enemy.x, enemy.y) ? '1' : '0';
            }
        }
    });

    updateMinimap();
}

function updateEnemyCount() {
    document.getElementById('enemies-alive').textContent = gameState.enemies.length;
}

function damageEnemy(enemy, damage) {
    enemy.health -= damage;
    showDamageNumber(enemy.x, enemy.y, Math.floor(damage));
    AudioSystem.playEnemyHit();

    // Update health bar - FIXED selector
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
        gameState.achievements.resourcesCollected += amount;
    });

    gameState.kills++;
    gameState.totalKills++;
    gameState.achievements.enemiesKilled++;
    gameState.enemies = gameState.enemies.filter(e => e.id !== enemy.id);
    document.querySelector(`[data-enemy-id="${enemy.id}"]`)?.remove();
    createExplosion(enemy.x, enemy.y, 30);
    updateUI();
    updateEnemyCount();
    checkAchievements(gameState);
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

function formatTime(ms) {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
