/**
 * Wave System Module
 * Wave management, win/lose conditions
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
    
    // Wave completion
    if (state.waveTimer >= WAVE_DURATION && getEnemyCount() === 0) {
        state.wave++;
        state.enemiesInWave = 5 + state.wave * 3;
        state.waveTimer = 0;
        state.achievements.wavesSurvived++;
        
        let waveMsg = `WAVE ${state.wave} INCOMING!`;
        if (state.wave >= 5) waveMsg += ' (Tanks!)';
        if (state.wave >= 8) waveMsg = 'WAVE ' + state.wave + ' INCOMING! (Flyers!)';
        if (state.wave % 10 === 0) waveMsg = 'WAVE ' + state.wave + ' - BOSS!';
        
        showMessage(waveMsg, '#ff0');
        AudioSystem?.playWaveAnnounce();
        
        checkAchievements();
    } else {
        state.waveTimer += TICK_RATE;
    }
    
    // Update ambient tension
    const inWave = state.waveTimer > 0 && state.waveTimer < WAVE_DURATION;
    AudioSystem?.updateAmbientForWave(state.wave, inWave);
    
    // Update wave info display
    const enemyCounts = {};
    state.enemies.forEach(e => {
        enemyCounts[e.type] = (enemyCounts[e.type] || 0) + 1;
    });
    const enemyTypeStr = Object.entries(enemyCounts).map(([t, c]) => `${c}${t[0].toUpperCase()}`).join(', ');
    
    document.getElementById('waveInfo').textContent = 
        `Wave: ${state.wave} | Enemies: ${state.enemies.length}/${state.enemiesInWave} ${enemyTypeStr ? `(${enemyTypeStr})` : ''} | Core: ${Math.ceil(state.coreHealth)}%`;
    
    // Check win condition after wave 25
    if (state.wave > 25) {
        checkWinCondition();
    }
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
        checkWave, damageCore, checkWinCondition, togglePause, manualCraft
    };
}
