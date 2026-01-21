/**
 * Forge Defense - Save/Load System
 */

function saveGame() {
    const saveData = {
        resources: gameState.resources,
        buildings: gameState.buildings,
        deposits: gameState.deposits,
        wave: gameState.wave,
        waveTimer: gameState.waveTimer,
        gameTime: gameState.gameTime,
        kills: gameState.kills,
        totalKills: gameState.totalKills,
        camera: gameState.camera,
        achievements: gameState.achievements,
        objectives: gameState.objectives,
        revealed: Array.from(gameState.revealed),  // Convert Set to Array for JSON
        fogEnabled: gameState.fogEnabled
    };
    
    localStorage.setItem('forge_defense_save', JSON.stringify(saveData));
    showNotification('💾 Game saved!');
}

function loadGame() {
    const saved = localStorage.getItem('forge_defense_save');
    if (!saved) {
        showNotification('📂 No save found');
        return;
    }

    try {
        const saveData = JSON.parse(saved);
        
        // Clear existing buildings and enemies from DOM
        document.querySelectorAll('.building').forEach(el => el.remove());
        document.querySelectorAll('.enemy').forEach(el => el.remove());
        document.querySelectorAll('.projectile').forEach(el => el.remove());
        document.querySelectorAll('.resource-deposit').forEach(el => el.remove());
        
        // Restore state
        gameState.resources = saveData.resources || gameState.resources;
        gameState.buildings = [];
        gameState.deposits = saveData.deposits || gameState.deposits;
        gameState.enemies = [];
        gameState.projectiles = [];
        gameState.wave = saveData.wave || 1;
        gameState.waveTimer = saveData.waveTimer || CONFIG.WAVE_INTERVAL;
        gameState.gameTime = saveData.gameTime || 0;
        gameState.kills = saveData.kills || 0;
        gameState.totalKills = saveData.totalKills || 0;
        gameState.camera = saveData.camera || { x: 0, y: 0, scale: CONFIG.DEFAULT_SCALE };
        gameState.achievements = saveData.achievements || gameState.achievements;
        gameState.objectives = saveData.objectives || gameState.objectives;
        gameState.isGameOver = false;
        gameState.isPaused = false;
        
        // Restore fog of war
        gameState.revealed = new Set(saveData.revealed || []);
        gameState.fogEnabled = saveData.fogEnabled !== undefined ? saveData.fogEnabled : CONFIG.FOG_OF_WAR;
        
        // Re-render buildings
        if (saveData.buildings) {
            saveData.buildings.forEach(b => {
                gameState.buildings.push(b);
                renderBuilding(b);
            });
        }
        
        // Re-render deposits
        if (saveData.deposits) {
            saveData.deposits.forEach((d, index) => {
                const deposit = document.createElement('div');
                deposit.className = 'resource-deposit ' + d.type;
                deposit.style.left = (d.x * CONFIG.TILE_SIZE + 5) + 'px';
                deposit.style.top = (d.y * CONFIG.TILE_SIZE + 5) + 'px';
                deposit.style.width = '30px';
                deposit.style.height = '30px';
                deposit.textContent = d.amount;
                deposit.dataset.depositId = index;
                world.appendChild(deposit);
            });
        }
        
        // Update UI and fog
        updateUI();
        updateCameraPosition();
        updateMinimap();
        if (typeof updateFog === 'function') updateFog();
        checkObjectives();
        
        document.getElementById('wave-number').textContent = gameState.wave;
        document.getElementById('wave-timer').textContent = gameState.waveTimer;
        
        showNotification('📂 Game loaded!');
    } catch (e) {
        console.error('Load failed:', e);
        showNotification('❌ Load failed!');
    }
}

function resetGame() {
    if (!confirm('Are you sure you want to reset? All progress will be lost!')) return;
    
    localStorage.removeItem('forge_defense_save');
    location.reload();
}

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
    if (e.key === 'F5') {
        e.preventDefault();
        saveGame();
    }
    if (e.key === 'F9') {
        e.preventDefault();
        loadGame();
    }
});

window.saveGame = saveGame;
window.loadGame = loadGame;
window.resetGame = resetGame;
