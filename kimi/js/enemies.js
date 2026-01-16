/**
 * Enemies Module
 * Enemy spawning, AI, movement, combat
 */

function selectEnemyType() {
    const state = getGameState();
    const wave = state.wave;
    
    // Boss wave check
    if (wave % 10 === 0 && wave >= 10) {
        const roll = Math.random();
        if (roll < 0.15) return 'boss';
    }
    
    const roll = Math.random();
    
    if (wave >= 5 && roll < 0.2) return 'tank';
    if (wave >= 8 && roll < 0.25) return 'flyer';
    if (wave < 5 && roll < 0.6) return 'scout';
    
    return wave < 3 ? 'scout' : 'basic';
}

function createEnemy(type, x, y) {
    const state = getGameState();
    const typeData = ENEMY_TYPES[type] || ENEMY_TYPES.basic;
    const wave = state.wave;
    
    // Scale HP with wave
    const hpMultiplier = type === 'boss' ? 1 : (1 + (wave - typeData.spawnWave) * 0.1);
    const hp = Math.floor(typeData.hp * Math.max(1, hpMultiplier));
    const speed = typeData.speed * (1 + wave * 0.01);
    
    const enemy = {
        x, y,
        type: type,
        health: hp,
        maxHealth: hp,
        speed: speed,
        damage: typeData.damage,
        reward: typeData.reward,
        ignoresBarriers: typeData.ignoresBarriers || false,
        isBoss: typeData.isBoss || false,
        targetX: CORE_POS.x,
        targetY: CORE_POS.y
    };
    
    // Create DOM element
    const el = document.createElement('div');
    el.className = `enemy ${type}${enemy.isBoss ? ' boss' : ''}`;
    
    // Position and size
    updateEnemyElementPosition(el, x, y);
    el.textContent = typeData.icon;
    
    // Health bar
    const healthBar = document.createElement('div');
    healthBar.className = `health-bar${enemy.isBoss ? ' boss' : ''}`;
    healthBar.innerHTML = `<div class="health-fill" style="width: 100%"></div>`;
    el.appendChild(healthBar);
    
    if (enemy.isBoss) {
        el.style.width = (42 * state.zoomLevel) + 'px';
        el.style.height = (42 * state.zoomLevel) + 'px';
        el.style.fontSize = (30 * state.zoomLevel) + 'px';
    }
    
    enemy.element = el;
    return enemy;
}

function updateEnemyElementPosition(el, x, y) {
    const state = getGameState();
    el.style.left = (x * CELL_SIZE * state.zoomLevel + 2 * state.zoomLevel) + 'px';
    el.style.top = (y * CELL_SIZE * state.zoomLevel + 2 * state.zoomLevel) + 'px';
    el.style.width = (28 * state.zoomLevel) + 'px';
    el.style.height = (28 * state.zoomLevel) + 'px';
    el.style.fontSize = (20 * state.zoomLevel) + 'px';
}

function spawnEnemies() {
    const state = getGameState();
    
    // First wave delay
    if (!state.firstWaveSpawned) {
        if (state.gameTime >= FIRST_WAVE_DELAY) {
            state.firstWaveSpawned = true;
            showMessage('FIRST WAVE ARRIVES!', '#f00');
            AudioSystem?.playWaveAnnounce();
        }
        return;
    }
    
    // Limit spawns per wave - FIX: track total spawned this wave
    if (state.enemiesSpawnedThisWave >= state.enemiesInWave) return;
    
    // Random spawn edge with offset to prevent getting stuck at edges
    const side = Math.floor(Math.random() * 4);
    const edgeOffset = 1;
    let x, y;
    
    switch(side) {
        case 0: // Top edge
            x = Math.floor(Math.random() * (GRID_SIZE - 2)) + edgeOffset;
            y = edgeOffset;
            break;
        case 1: // Right edge
            x = GRID_SIZE - edgeOffset - 1;
            y = Math.floor(Math.random() * (GRID_SIZE - 2)) + edgeOffset;
            break;
        case 2: // Bottom edge
            x = Math.floor(Math.random() * (GRID_SIZE - 2)) + edgeOffset;
            y = GRID_SIZE - edgeOffset - 1;
            break;
        default: // Left edge
            x = edgeOffset;
            y = Math.floor(Math.random() * (GRID_SIZE - 2)) + edgeOffset;
            break;
    }
    
    const enemyType = selectEnemyType();
    const enemy = createEnemy(enemyType, x, y);
    
    // Boss spawn sound
    if (enemyType === 'boss') {
        AudioSystem?.playBossSpawn();
    }
    
    document.getElementById('grid').appendChild(enemy.element);
    state.enemies.push(enemy);
    state.enemiesSpawnedThisWave++;
}

function spawnMinions(x, y, count) {
    const state = getGameState();
    
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i;
        const spawnX = x + Math.cos(angle) * 2;
        const spawnY = y + Math.sin(angle) * 2;
        
        // Bounds check with offset to prevent edge spawning
        if (spawnX < 1 || spawnX >= GRID_SIZE - 1 || spawnY < 1 || spawnY >= GRID_SIZE - 1) {
            continue;
        }
        
        const minion = createEnemy('scout', spawnX, spawnY);
        minion.minion = true;
        state.enemies.push(minion);
        document.getElementById('grid').appendChild(minion.element);
    }
    
    showMessage('Boss spawned minions!', '#f55');
}

function moveEnemies() {
    const state = getGameState();
    
    // Build barrier map
    const barrierMap = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false));
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = getCell(x, y);
            if (cell && cell.entity === 'barrier') {
                barrierMap[y][x] = true;
            }
        }
    }
    
    // Iterate backwards to safely remove enemies
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];
        
        let dx = enemy.targetX - enemy.x;
        let dy = enemy.targetY - enemy.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > 0.3) {
            const moveX = dx / dist * enemy.speed;
            const moveY = dy / dist * enemy.speed;
            
            let nextX = enemy.x + moveX;
            let nextY = enemy.y + moveY;
            
            // Boundary check - clamp to valid grid range
            nextX = Math.max(1, Math.min(GRID_SIZE - 2, nextX));
            nextY = Math.max(1, Math.min(GRID_SIZE - 2, nextY));
            
            const nextCellX = Math.floor(nextX);
            const nextCellY = Math.floor(nextY);
            
            if (!enemy.ignoresBarriers) {
                if (barrierMap[nextCellY] && barrierMap[nextCellY][nextCellX]) {
                    // Try to go around barrier
                    const perpX = -moveY * 2;
                    const perpY = moveX * 2;
                    
                    let foundPath = false;
                    for (let tryDir of [[perpX, perpY], [-perpX, -perpY]]) {
                        const tryX = Math.floor(enemy.x + tryDir[0]);
                        const tryY = Math.floor(enemy.y + tryDir[1]);
                        if (tryX >= 0 && tryX < GRID_SIZE && tryY >= 0 && tryY < GRID_SIZE && 
                            !barrierMap[tryY][tryX]) {
                            enemy.x += tryDir[0];
                            enemy.y += tryDir[1];
                            foundPath = true;
                            break;
                        }
                    }
                    
                    if (!foundPath) {
                        damageBarrier(Math.floor(enemy.x), Math.floor(enemy.y), enemy.damage);
                    }
                } else {
                    enemy.x = nextX;
                    enemy.y = nextY;
                }
            } else {
                enemy.x = nextX;
                enemy.y = nextY;
            }
            
            updateEnemyElementPosition(enemy.element, enemy.x, enemy.y);
        } else {
            // Reached core
            damageCore(enemy.damage);
            state.enemies.splice(i, 1);
            enemy.element.remove();
        }
        
        // Update health bar
        const healthFill = enemy.element.querySelector('.health-fill');
        if (healthFill) {
            healthFill.style.width = `${(enemy.health / enemy.maxHealth) * 100}%`;
        }
    }
}

function damageBarrier(x, y, damage) {
    const cell = getCell(x, y);
    if (!cell || cell.entity !== 'barrier') return;
    
    cell.barrierHealth = (cell.barrierHealth || 100) - damage;
    
    if (cell.barrierHealth <= 0) {
        cell.entity = null;
        AudioSystem?.playDeconstruct();
        updateGridView();
        showMessage('Barrier destroyed!', '#f55');
    }
}

function killEnemy(enemy) {
    const state = getGameState();
    const idx = state.enemies.indexOf(enemy);
    if (idx > -1) state.enemies.splice(idx, 1);
    
    // Give rewards
    if (enemy.reward) {
        for (const [res, amount] of Object.entries(enemy.reward)) {
            state.resources[res] += amount;
        }
        showMessage(`+${Object.entries(enemy.reward).map(([r,a]) => `${a} ${r}`).join(', ')}`, '#0f0');
    }
    
    enemy.element.remove();
    state.achievements.enemiesKilled++;
    
    AudioSystem?.playEnemyHit();
    checkAchievements();
    
    // Boss spawns minions
    if (enemy.type === 'boss' && enemy.spawnsMinions && !enemy.minionsSpawned) {
        enemy.minionsSpawned = true;
        setTimeout(() => {
            spawnMinions(enemy.x, enemy.y, 3);
        }, 2000);
    }
}

function getEnemyCount() {
    const state = getGameState();
    return state.enemies.length;
}

function getEnemies() {
    const state = getGameState();
    return state.enemies;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        selectEnemyType, createEnemy, spawnEnemies, spawnMinions,
        moveEnemies, damageBarrier, killEnemy, getEnemyCount, getEnemies
    };
}
