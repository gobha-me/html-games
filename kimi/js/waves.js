/**
 * Wave System Module - REFACTORED
 * Clean wave management with difficulty settings
 * 
 * Design:
 * - All enemies for a wave spawn in a burst (1-2 seconds)
 * - No continuous spawning during wave
 * - Wave ends when all enemies are dead
 * - Clear progression and difficulty selection
 */

function checkWave() {
    const state = getGameState();
    
    // First wave countdown
    if (!state.firstWaveSpawned) {
        const timeUntilFirst = Math.max(0, Math.ceil((FIRST_WAVE_DELAY - state.gameTime) / 1000));
        document.getElementById('waveInfo').textContent = 
            `Wave: 1 (Starting in ${timeUntilFirst}s) | Core: ${Math.ceil(state.coreHealth)}%`;
        return;
    }
    
    // Check if wave is complete (all enemies spawned AND all dead)
    if (state.waveSpawnComplete && getEnemyCount() === 0) {
        // Wave complete - start next wave
        state.wave++;
        state.waveTimer = 0;
        state.waveSpawnComplete = false;
        state.achievements.wavesSurvived++;
        
        let waveMsg = `WAVE ${state.wave} INCOMING!`;
        if (state.wave >= 5) waveMsg += ' (Tanks!)';
        if (state.wave >= 8) waveMsg = 'WAVE ' + state.wave + ' INCOMING! (Flyers!)';
        if (state.wave % 10 === 0) waveMsg = 'WAVE ' + state.wave + ' - BOSS!';
        
        showMessage(waveMsg, '#ff0');
        AudioSystem?.playWaveAnnounce();
        checkAchievements();
        
        // Trigger wave spawn after short delay
        setTimeout(() => {
            startWaveSpawn();
        }, 2000);
    }
    
    // Update ambient tension
    const inWave = !state.waveSpawnComplete || getEnemyCount() > 0;
    AudioSystem?.updateAmbientForWave(state.wave, inWave);
    
    // Update wave info display
    const enemyCounts = {};
    state.enemies.forEach(e => {
        enemyCounts[e.type] = (enemyCounts[e.type] || 0) + 1;
    });
    const enemyTypeStr = Object.entries(enemyCounts).map(([t, c]) => `${c}${t[0].toUpperCase()}`).join(', ');
    
    const waveStatus = state.waveSpawnComplete ? 'Wave Active' : 'Spawning...';
    document.getElementById('waveInfo').textContent = 
        `Wave: ${state.wave} | ${waveStatus} | Enemies: ${state.enemies.length} ${enemyTypeStr ? `(${enemyTypeStr})` : ''} | Core: ${Math.ceil(state.coreHealth)}%`;
    
    // Check win condition after wave 25
    if (state.wave > 25) {
        checkWinCondition();
    }
}

/**
 * Start spawning all enemies for the current wave
 * Spawns in bursts over 1-2 seconds for visual effect
 */
function startWaveSpawn() {
    const state = getGameState();
    
    // Calculate enemy count for this wave based on difficulty
    const baseCount = 3;
    const waveMultiplier = Math.floor(state.wave * 2.5);
    const enemyCount = baseCount + waveMultiplier;
    
    // Spawn enemies in quick bursts
    const spawnInterval = 200; // 200ms between spawns
    let spawnedCount = 0;
    
    const spawnTimer = setInterval(() => {
        if (spawnedCount >= enemyCount) {
            clearInterval(spawnTimer);
            state.waveSpawnComplete = true;
            return;
        }
        
        // Spawn one enemy
        spawnSingleEnemy();
        spawnedCount++;
    }, spawnInterval);
}

/**
 * Spawn a single enemy at a random edge
 */
function spawnSingleEnemy() {
    const state = getGameState();
    
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
    // Boss spawn: play sound and schedule minion swarm
    if (enemyType === 'boss') {
        AudioSystem?.playBossSpawn();
        // Re-enable minions: spawn swarm 1 second after boss appears (issue #88)
        setTimeout(() => spawnBossMinions(enemy), 1000);
    }
    
    document.getElementById('grid').appendChild(enemy.element);
    state.enemies.push(enemy);
}

function damageCore(damage) {
    const state = getGameState();
    state.coreHealth -= damage;
    state.achievements.coreDamageTaken += damage;
    
    checkWave();
    
    if (state.coreHealth <= 0) {
        showMessage('GAME OVER - Core Destroyed!', '#f00');
        AudioSystem?.playGameOver();
        AudioSystem?.stopAmbient();
        state.isPaused = true;
    }
}

function checkWinCondition() {
    const state = getGameState();
    
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = getCell(x, y);
            if (cell && cell.entity === 'silo' && !state.rocketLaunched) {
                showMessage('ROCKET LAUNCHING... VICTORY!', '#0f0');
                AudioSystem?.playVictory();
                AudioSystem?.stopAmbient();
                state.rocketLaunched = true;
                state.isPaused = true;
                state.objectives[4] = true;
                
                checkAchievements();
                return;
            }
        }
    }
}

function togglePause() {
    const state = getGameState();
    state.isPaused = !state.isPaused;
    
    if (state.isPaused) {
        AudioSystem?.stopAmbient();
    } else {
        AudioSystem?.startAmbient();
    }
    
    showMessage(state.isPaused ? 'PAUSED - Press P to resume' : 'RESUMED', '#ff0');
}

function manualCraft(item) {
    const state = getGameState();
    const recipe = MANUAL_RECIPES[item];
    const now = Date.now();
    
    // Check resources
    for (const [res, cost] of Object.entries(recipe)) {
        if (res === 'time') continue;
        if (state.resources[res] < cost) {
            showMessage(`Not enough ${res}!`, '#f80');
            AudioSystem?.playLowResource();
            return;
        }
    }
    
    // Check cooldown
    if (state.manualCrafting.lastCrafted + recipe.time > now) {
        showMessage('Crafting... wait!', '#fa0');
        return;
    }
    
    // Deduct resources
    for (const [res, cost] of Object.entries(recipe)) {
        if (res !== 'time') state.resources[res] -= cost;
    }
    
    state.manualCrafting.lastCrafted = now;
    showMessage(`Crafting ${item}...`, '#0f0');
    
    // Complete craft after delay
    setTimeout(() => {
        state.resources[item] += (item === 'ammo' ? 5 : 1);
        updateResources();
        updateCraftingButtons();
        showMessage(`+1 ${item}`, '#0f0');
    }, recipe.time);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkWave, damageCore, checkWinCondition, togglePause, manualCraft,
        startWaveSpawn, spawnSingleEnemy
    };
}

// Expose globally for use by other modules
window.startWaveSpawn = startWaveSpawn;
window.spawnSingleEnemy = spawnSingleEnemy;
