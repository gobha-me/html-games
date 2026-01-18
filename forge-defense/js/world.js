/**
 * Forge Defense - World Generation & Camera
 * With fog of war support
 */

const world = document.getElementById('world');
const worldContainer = document.getElementById('world-container');
const ghostBuilding = document.getElementById('ghost-building');
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');

// Fog of war overlay canvas
let fogCanvas = null;
let fogCtx = null;

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

    // Generate resource deposits with GUARANTEED starting resources
    const depositTypes = ['iron', 'copper', 'coal', 'stone'];
    
    // GUARANTEED deposits near base (within 8-12 tiles) - one of each type
    const guaranteedDeposits = [
        { type: 'iron', angle: 0 },
        { type: 'copper', angle: Math.PI / 2 },
        { type: 'coal', angle: Math.PI },
        { type: 'stone', angle: Math.PI * 1.5 }
    ];
    
    guaranteedDeposits.forEach(({ type, angle }) => {
        const dist = 6 + Math.random() * 4;  // 6-10 tiles from center
        const x = Math.floor(CONFIG.BASE_CENTER.x + Math.cos(angle + (Math.random() - 0.5)) * dist);
        const y = Math.floor(CONFIG.BASE_CENTER.y + Math.sin(angle + (Math.random() - 0.5)) * dist);
        const amount = 800 + Math.floor(Math.random() * 700);  // 800-1500 - generous starting deposits
        
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
    });
    
    // Additional random deposits further out
    for (let i = 0; i < 36; i++) {
        const type = depositTypes[Math.floor(Math.random() * depositTypes.length)];
        let x, y, attempts = 0;
        do {
            x = Math.floor(Math.random() * CONFIG.WORLD_SIZE);
            y = Math.floor(Math.random() * CONFIG.WORLD_SIZE);
            attempts++;
        } while (
            (Math.abs(x - CONFIG.BASE_CENTER.x) < 8 && Math.abs(y - CONFIG.BASE_CENTER.y) < 8) &&
            attempts < 20
        );

        const amount = 400 + Math.floor(Math.random() * 1100);  // 400-1500
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

    // Create fog of war canvas
    if (CONFIG.FOG_OF_WAR) {
        createFogOverlay();
    }

    centerCamera();
    updateMinimap();
}

function createFogOverlay() {
    fogCanvas = document.createElement('canvas');
    fogCanvas.id = 'fog-canvas';
    fogCanvas.width = CONFIG.WORLD_SIZE * CONFIG.TILE_SIZE;
    fogCanvas.height = CONFIG.WORLD_SIZE * CONFIG.TILE_SIZE;
    fogCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:50;';
    fogCtx = fogCanvas.getContext('2d');
    world.appendChild(fogCanvas);
}

function revealArea(centerX, centerY, radius) {
    if (!gameState.fogEnabled) return;
    
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= radius) {
                const tx = centerX + dx;
                const ty = centerY + dy;
                if (tx >= 0 && tx < CONFIG.WORLD_SIZE && ty >= 0 && ty < CONFIG.WORLD_SIZE) {
                    gameState.revealed.add(`${tx},${ty}`);
                }
            }
        }
    }
    updateFog();
}

function updateFog() {
    if (!fogCanvas || !gameState.fogEnabled) return;
    
    const tileSize = CONFIG.TILE_SIZE;
    
    // Fill with fog
    fogCtx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);
    
    // Cut out revealed areas
    fogCtx.globalCompositeOperation = 'destination-out';
    
    gameState.revealed.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        // Soft circular reveal with gradient
        const gradient = fogCtx.createRadialGradient(
            x * tileSize + tileSize / 2, 
            y * tileSize + tileSize / 2, 
            0,
            x * tileSize + tileSize / 2, 
            y * tileSize + tileSize / 2, 
            tileSize
        );
        gradient.addColorStop(0, 'rgba(0,0,0,1)');
        gradient.addColorStop(0.7, 'rgba(0,0,0,0.8)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        
        fogCtx.fillStyle = gradient;
        fogCtx.fillRect(x * tileSize - tileSize/2, y * tileSize - tileSize/2, tileSize * 2, tileSize * 2);
    });
    
    fogCtx.globalCompositeOperation = 'source-over';
}

function isRevealed(x, y) {
    if (!gameState.fogEnabled) return true;
    const tileX = Math.floor(x / CONFIG.TILE_SIZE);
    const tileY = Math.floor(y / CONFIG.TILE_SIZE);
    return gameState.revealed.has(`${tileX},${tileY}`);
}

function spawnBase() {
    const baseBuilding = {
        id: Date.now() + Math.random(),
        type: 'base',
        x: CONFIG.BASE_CENTER.x,
        y: CONFIG.BASE_CENTER.y,
        health: BUILDINGS.base.health,
        maxHealth: BUILDINGS.base.health,
        rotation: 0,
        lastProduction: Date.now(),
        lastFire: 0
    };
    gameState.buildings.push(baseBuilding);
    renderBuilding(baseBuilding);
    
    // Reveal area around base
    revealArea(CONFIG.BASE_CENTER.x, CONFIG.BASE_CENTER.y, BUILDINGS.base.revealRadius || 8);
}

function centerCamera() {
    const containerRect = worldContainer.getBoundingClientRect();
    const scale = gameState.camera.scale;
    const visibleWidth = containerRect.width / scale;
    const visibleHeight = containerRect.height / scale;
    gameState.camera.x = CONFIG.BASE_CENTER.x * CONFIG.TILE_SIZE - visibleWidth / 2;
    gameState.camera.y = CONFIG.BASE_CENTER.y * CONFIG.TILE_SIZE - visibleHeight / 2;
    updateCameraPosition();
}

function updateCameraPosition() {
    const scale = gameState.camera.scale;
    const visibleWidth = worldContainer.clientWidth / scale;
    const visibleHeight = worldContainer.clientHeight / scale;
    
    const maxX = CONFIG.WORLD_SIZE * CONFIG.TILE_SIZE - visibleWidth;
    const maxY = CONFIG.WORLD_SIZE * CONFIG.TILE_SIZE - visibleHeight;

    gameState.camera.x = Math.max(0, Math.min(maxX, gameState.camera.x));
    gameState.camera.y = Math.max(0, Math.min(maxY, gameState.camera.y));
    
    world.style.transform = `scale(${scale}) translate(${-gameState.camera.x}px, ${-gameState.camera.y}px)`;
    world.style.transformOrigin = '0 0';
    updateMinimapViewport();
}

function updateMinimap() {
    const size = 160;
    minimapCanvas.width = size;
    minimapCanvas.height = size;

    const scale = size / (CONFIG.WORLD_SIZE * CONFIG.TILE_SIZE);

    // Background
    minimapCtx.fillStyle = '#0a0a15';
    minimapCtx.fillRect(0, 0, size, size);

    // Fog on minimap
    if (gameState.fogEnabled) {
        minimapCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        minimapCtx.fillRect(0, 0, size, size);
        
        // Revealed areas
        minimapCtx.fillStyle = '#1a1a2a';
        gameState.revealed.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            minimapCtx.fillRect(
                x * CONFIG.TILE_SIZE * scale, 
                y * CONFIG.TILE_SIZE * scale, 
                CONFIG.TILE_SIZE * scale + 1, 
                CONFIG.TILE_SIZE * scale + 1
            );
        });
    }

    // Deposits (only if revealed)
    gameState.deposits.forEach(d => {
        if (!gameState.fogEnabled || gameState.revealed.has(`${d.x},${d.y}`)) {
            minimapCtx.fillStyle = d.type === 'iron' ? '#7f8c8d' :
                                  d.type === 'copper' ? '#e67e22' :
                                  d.type === 'coal' ? '#34495e' : '#95a5a6';
            minimapCtx.fillRect(d.x * CONFIG.TILE_SIZE * scale, d.y * CONFIG.TILE_SIZE * scale, 3, 3);
        }
    });

    // Buildings
    gameState.buildings.forEach(b => {
        minimapCtx.fillStyle = b.type === 'base' ? '#9b59b6' :
                              b.type === 'turret' || b.type === 'laser-turret' ? '#e74c3c' :
                              b.type === 'wall' ? '#7f8c8d' : '#3498db';
        const bSize = BUILDINGS[b.type].size * CONFIG.TILE_SIZE * scale;
        minimapCtx.fillRect(b.x * CONFIG.TILE_SIZE * scale, b.y * CONFIG.TILE_SIZE * scale, Math.max(2, bSize), Math.max(2, bSize));
    });

    // Enemies (only if in revealed area)
    minimapCtx.fillStyle = '#e74c3c';
    gameState.enemies.forEach(e => {
        if (!gameState.fogEnabled || isRevealed(e.x, e.y)) {
            minimapCtx.beginPath();
            minimapCtx.arc(e.x * scale, e.y * scale, 2, 0, Math.PI * 2);
            minimapCtx.fill();
        }
    });

    updateMinimapViewport();
}

function updateMinimapViewport() {
    const mmScale = 160 / (CONFIG.WORLD_SIZE * CONFIG.TILE_SIZE);
    const camScale = gameState.camera.scale;
    const viewport = document.getElementById('minimap-viewport');
    viewport.style.left = (gameState.camera.x * mmScale) + 'px';
    viewport.style.top = (gameState.camera.y * mmScale) + 'px';
    viewport.style.width = (worldContainer.clientWidth / camScale * mmScale) + 'px';
    viewport.style.height = (worldContainer.clientHeight / camScale * mmScale) + 'px';
}
