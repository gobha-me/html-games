/**
 * FactorIO Defense - Save/Load System
 */

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

function resetGame() {
    localStorage.removeItem('factorio-defense-save');
    location.reload();
}