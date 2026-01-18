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
