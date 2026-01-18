/**
 * FactorIO Defense - UI Updates & Notifications
 */

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

// ============= GAME END SCREENS =============
function gameOver() {
    gameState.isGameOver = true;
    document.getElementById('defeat-wave').textContent = gameState.wave;
    document.getElementById('defeat-screen').style.display = 'flex';
}

function continueGame() {
    document.getElementById('victory-screen').style.display = 'none';
}

// ============= PRODUCTION PANEL =============
function updateProductionPanel() {
    const panel = document.getElementById('production-stats');
    let html = '';
    Object.entries(gameState.production).forEach(([res, amount]) => {
        const perMin = amount * 60;
        html += `<div class="prod-row"><span>${res}</span><span class="prod-positive">+${perMin}/m</span></div>`;
    });
    panel.innerHTML = html || '<div style="color:#666;">No production</div>';
}
