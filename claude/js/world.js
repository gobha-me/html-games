/**
 * FactorIO Defense - World Generation & Camera
 * Extracted from game.js for better code organization
 */

// ============= DOM ELEMENTS =============
const world = document.getElementById('world');
const worldContainer = document.getElementById('world-container');
const ghostBuilding = document.getElementById('ghost-building');
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');

// ============= WORLD GENERATION =============
function generateWorld() {
    const worldWidth = CONFIG.WORLD_SIZE * CONFIG.TILE_SIZE;
    world.style.width = worldWidth + 'px';
    world.style.height = worldWidth + 'px';

    // Generate tiles
    for (let y = 0; y < CONFIG.WORLD_SIZE; y++) {
        for (let x = 0; x < CONFIG.WORLD_SIZE; x++) {
            const tile = document.createElement('div');
            tile.className = 'tile ' + (Math.random() > 0.3 ? 'grass' : 'dirt');
            tile.style.left = (x * CONFIG.TILE_SIZE) + 'px';
            tile.style.top = (y * CONFIG.TILE_SIZE) + 'px';
            tile.dataset.x = x;
            tile.dataset.y = y;
            world.appendChild(tile);
        }
    }

    // Generate resource deposits
    const depositTypes = ['iron', 'copper', 'coal', 'stone'];
    for (let i = 0; i < 40; i++) {
        const type = depositTypes[Math.floor(Math.random() * depositTypes.length)];
        let x, y;
        do {
            x = Math.floor(Math.random() * CONFIG.WORLD_SIZE);
            y = Math.floor(Math.random() * CONFIG.WORLD_SIZE);
        } while (Math.abs(x - CONFIG.BASE_CENTER.x) < 5 && Math.abs(y - CONFIG.BASE_CENTER.y) < 5);

        const amount = 500 + Math.floor(Math.random() * 1500);
        gameState.deposits.push({ x, y, type, amount, maxAmount: amount });

        const deposit = document.createElement('div');
        deposit.className = 'resource-deposit ' + type;
        deposit.style.left = (x * CONFIG.TILE_SIZE + 5) + 'px';
        deposit.style.top = (y * CONFIG.TILE_SIZE + 5) + 'px';
        deposit.style.width = '30px';
        deposit.style.height = '30px';
        deposit.textContent = amount;
        deposit.dataset.depositId = gameState.deposits.length - 1;
        world.appendChild(deposit);
    }

    // Center camera on base
    centerCamera();
    updateMinimap();
}

function spawnBase() {
    gameState.camera.x = 0;
    gameState.camera.y = 0;
    const baseBuilding = {
        type: 'base',
        x: CONFIG.BASE_CENTER.x,
        y: CONFIG.BASE_CENTER.y,
        health: BUILDINGS.base.health,
        maxHealth: BUILDINGS.base.health,
        rotation: 0
    };
    gameState.buildings.push(baseBuilding);
    renderBuilding(baseBuilding);
}

// ============= ZOOM =============
function setupZoom() {
    worldContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.001;
        const newZoom = gameState.camera.zoom - e.deltaY * zoomSpeed;
        gameState.camera.zoom = Math.max(0.5, Math.min(2, newZoom));
        updateCameraPosition();
    });
}

function centerCamera() {
    const containerRect = worldContainer.getBoundingClientRect();
    const visibleWidth = containerRect.width / gameState.camera.zoom;
    const visibleHeight = containerRect.height / gameState.camera.zoom;
    gameState.camera.x = CONFIG.BASE_CENTER.x * CONFIG.TILE_SIZE - visibleWidth / 2;
    gameState.camera.y = CONFIG.BASE_CENTER.y * CONFIG.TILE_SIZE - visibleHeight / 2;
    updateCameraPosition();
}

function updateCameraPosition() {
    // Account for zoom - visible area shrinks when zoomed in
    const visibleWidth = worldContainer.clientWidth / gameState.camera.zoom;
    const visibleHeight = worldContainer.clientHeight / gameState.camera.zoom;

    const maxX = CONFIG.WORLD_SIZE * CONFIG.TILE_SIZE - visibleWidth;
    const maxY = CONFIG.WORLD_SIZE * CONFIG.TILE_SIZE - visibleHeight;

    gameState.camera.x = Math.max(0, Math.min(maxX, gameState.camera.x));
    gameState.camera.y = Math.max(0, Math.min(maxY, gameState.camera.y));
    world.style.transform = `translate(${-gameState.camera.x}px, ${-gameState.camera.y}px) scale(${gameState.camera.zoom})`;
    updateMinimapViewport();
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
