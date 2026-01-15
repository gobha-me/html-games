const GRID_SIZE = 50;
const CELL_SIZE = 32;
const TICK_RATE = 100;
const ENEMY_SPAWN_RATE = 3000;
const WAVE_DURATION = 25000;
const FIRST_WAVE_DELAY = 60000;
const START_REVEAL_RADIUS = 8;
const CORE_POS = { x: 25, y: 25 };
const CORE_MAX_HEALTH = 100;

// Zoom configuration
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;

const BUILDING_KEYS = {
    '1': 'miner', '2': 'furnace', '3': 'assembler', 
    '4': 'turret', '5': 'barrier', '6': 'pumpjack', '7': 'silo'
};

const BUILDINGS = {
    miner: { cost: { iron: 5 }, icon: '⛏️', key: '1', desc: 'Mines resources automatically', requiresResource: true },
    furnace: { cost: { iron: 8, stone: 5 }, icon: '🔥', key: '2', desc: 'Smelts iron → steel' },
    assembler: { cost: { iron: 10, gear: 5 }, icon: '⚙️', key: '3', desc: 'Crafts ammo & circuits' },
    turret: { cost: { iron: 10, copper: 5, gear: 3 }, icon: '🛡️', key: '4', desc: 'Auto-fires at enemies (NEEDS AMMO!)' },
    barrier: { cost: { iron: 2 }, icon: '🧱', key: '5', desc: 'Blocks enemy path - build walls!' },
    pumpjack: { cost: { iron: 15, gear: 10 }, icon: '🛢️', key: '6', desc: 'Extracts oil', requiresResource: 'oil' },
    silo: { cost: { iron: 100, copper: 50, steel: 50, circuit: 100 }, icon: '🚀', key: '7', desc: 'Launch rocket to WIN!' }
};

const RESOURCES = ['iron', 'copper', 'coal', 'stone', 'oil', 'gear', 'circuit', 'steel', 'ammo'];
const STARTING_RESOURCES = { iron: 50, copper: 30, coal: 20, stone: 20, oil: 0, gear: 5, circuit: 0, steel: 0, ammo: 30 };

const MANUAL_RECIPES = {
    gear: { iron: 2, time: 2000 },
    circuit: { copper: 2, iron: 1, time: 3000 },
    ammo: { iron: 2, copper: 1, time: 1000 }
};

// Enemy type definitions
const ENEMY_TYPES = {
    basic: { 
        hp: 100, 
        speed: 0.04, 
        icon: '👾', 
        damage: 10, 
        reward: { iron: 2 },
        spawnWave: 1 
    },
    scout: { 
        hp: 30, 
        speed: 0.08, 
        icon: '🦗', 
        damage: 5, 
        reward: { iron: 1 },
        spawnWave: 1 
    },
    tank: { 
        hp: 300, 
        speed: 0.02, 
        icon: '🪨', 
        damage: 30, 
        reward: { iron: 10, steel: 2 },
        spawnWave: 5 
    },
    flyer: { 
        hp: 50, 
        speed: 0.06, 
        icon: '🦇', 
        damage: 15, 
        reward: { copper: 5 },
        spawnWave: 8,
        ignoresBarriers: true 
    },
    boss: { 
        hp: 1000, 
        speed: 0.015, 
        icon: '👹', 
        damage: 50, 
        reward: { circuit: 20, steel: 10, gear: 10 },
        spawnWave: 10,
        isBoss: true,
        spawnsMinions: true 
    }
};

let gameState = {
    grid: Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null)),
    resources: {...STARTING_RESOURCES},
    enemies: [],
    projectiles: [],
    coreHealth: CORE_MAX_HEALTH,
    wave: 1,
    enemiesInWave: 3,
    waveTimer: 0,
    gameTime: 0,
    revealed: new Set(),
    buildingInHand: null,
    isPaused: false,
    rocketLaunched: false,
    objectives: [false, false, false, false, false],
    firstWaveSpawned: false,
    camera: { x: -((GRID_SIZE * CELL_SIZE) / 2) + window.innerWidth / 2, y: -((GRID_SIZE * CELL_SIZE) / 2) + window.innerHeight / 2 },
    manualCrafting: { lastCrafted: 0 },
    zoomLevel: 1.0,
    achievements: {
        enemiesKilled: 0,
        turretsBuilt: 0,
        wavesSurvived: 0,
        coreDamageTaken: 0
    }
};

let isDragging = false;
let dragStart = { x: 0, y: 0 };
let cameraStart = { x: 0, y: 0 };

function init() {
    generateWorld();
    renderBuildingList();
    setupGrid();
    setupCraftingButtons();
    setupMouseControls();
    setupKeyboard();
    setupZoom();
    drawMinimap();
    gameLoop();
    setInterval(spawnEnemies, ENEMY_SPAWN_RATE);
    setInterval(() => { if (!gameState.isPaused) gameState.gameTime += 1000; }, 1000);
    setInterval(autoSave, 30000);
    updateCamera();
    setTimeout(() => showMessage('FIRST WAVE IN 60 SECONDS! Build turrets NOW!', '#f00'), 5000);
}

function setupZoom() {
    const gameGrid = document.getElementById('gameGrid');
    gameGrid.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        changeZoom(delta);
    });
    updateZoomDisplay();
}

function changeZoom(delta) {
    const oldZoom = gameState.zoomLevel;
    gameState.zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, gameState.zoomLevel + delta));
    if (oldZoom !== gameState.zoomLevel) {
        updateCamera();
        drawMinimap();
        updateZoomDisplay();
    }
}

function updateZoomDisplay() {
    const zoomElement = document.getElementById('zoomLevel');
    if (zoomElement) {
        zoomElement.textContent = `${Math.round(gameState.zoomLevel * 100)}%`;
    }
}

function generateWorld() {
    const startPos = [];
    for (let dy = -START_REVEAL_RADIUS; dy <= START_REVEAL_RADIUS; dy++) {
        for (let dx = -START_REVEAL_RADIUS; dx <= START_REVEAL_RADIUS; dx++) {
            const x = CORE_POS.x + dx, y = CORE_POS.y + dy;
            if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                    startPos.push({ x, y, dist: Math.abs(dx) + Math.abs(dy) });
                }
            }
        }
    }
    
    startPos.sort((a, b) => a.dist - b.dist);
    
    function placeCluster(resourceType, count, clusterSize = 6) {
        for (let i = 0; i < count && startPos.length > 0; i++) {
            const centerIndex = Math.min(Math.floor(startPos.length * 0.3 + Math.random() * 5), startPos.length - 1);
            const center = startPos.splice(centerIndex, 1)[0];
            if (!center) continue;
            
            for (let j = 0; j < clusterSize; j++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = Math.random() * 2;
                const x = Math.round(center.x + Math.cos(angle) * radius);
                const y = Math.round(center.y + Math.sin(angle) * radius);
                
                if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
                    if (gameState.grid[y][x] === null || gameState.grid[y][x].type === 'ground') {
                        const amounts = { iron: 800, copper: 600, coal: 500, stone: 400, oil: 300 };
                        gameState.grid[y][x] = {
                            type: `resource-${resourceType}`,
                            amount: amounts[resourceType],
                            entity: null
                        };
                    }
                }
            }
        }
    }
    
    placeCluster('iron', 2);
    placeCluster('copper', 2);
    placeCluster('coal', 2);
    placeCluster('stone', 1);
    
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (gameState.grid[y][x] === null) {
                const noise = Math.sin(x * 0.03) * Math.cos(y * 0.03) * 0.6 + Math.sin(x * 0.08) * Math.cos(y * 0.08) * 0.4;
                
                if (noise > 0.65) gameState.grid[y][x] = { type: 'resource-iron', amount: 1000, entity: null };
                else if (noise > 0.45) gameState.grid[y][x] = { type: 'resource-copper', amount: 800, entity: null };
                else if (noise > 0.25) gameState.grid[y][x] = { type: 'resource-coal', amount: 600, entity: null };
                else if (noise > 0.05) gameState.grid[y][x] = { type: 'resource-stone', amount: 500, entity: null };
                else if (noise < -0.4) gameState.grid[y][x] = { type: 'resource-oil', amount: 200, entity: null };
                else gameState.grid[y][x] = { type: 'ground', amount: 0, entity: null };
            }
            
            const dist = Math.abs(x - CORE_POS.x) + Math.abs(y - CORE_POS.y);
            if (dist <= START_REVEAL_RADIUS) {
                gameState.revealed.add(`${x},${y}`);
            }
        }
    }
    
    gameState.grid[CORE_POS.y][CORE_POS.x] = { 
        type: 'core', amount: 0, entity: 'core', lastProduced: 0 
    };
}

function setupGrid() {
    const gridEl = document.getElementById('grid');
    gridEl.style.gridTemplateColumns = `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`;
    gridEl.innerHTML = '';
    
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell fog';
            cell.dataset.x = x;
            cell.dataset.y = y;
            cell.addEventListener('click', (e) => handleCellClick(x, y, e));
            cell.addEventListener('contextmenu', (e) => { e.preventDefault(); handleRightClick(x, y); });
            gridEl.appendChild(cell);
        }
    }
    updateGridView();
}

function setupCraftingButtons() {
    updateCraftingButtons();
}

function updateCraftingButtons() {
    const gearBtn = document.getElementById('craft-gear');
    gearBtn.classList.toggle('disabled', gameState.resources.iron < MANUAL_RECIPES.gear.iron);
    
    const circuitBtn = document.getElementById('craft-circuit');
    circuitBtn.classList.toggle('disabled', gameState.resources.copper < MANUAL_RECIPES.circuit.copper || gameState.resources.iron < MANUAL_RECIPES.circuit.iron);
    
    const ammoBtn = document.getElementById('craft-ammo');
    ammoBtn.classList.toggle('disabled', gameState.resources.iron < MANUAL_RECIPES.ammo.iron || gameState.resources.copper < MANUAL_RECIPES.ammo.copper);
}

function manualCraft(item) {
    const recipe = MANUAL_RECIPES[item];
    const now = Date.now();
    
    for (const [res, cost] of Object.entries(recipe)) {
        if (res === 'time') continue;
        if (gameState.resources[res] < cost) {
            showMessage(`Not enough ${res}!`, '#f80');
            return;
        }
    }
    
    if (gameState.manualCrafting.lastCrafted + recipe.time > now) {
        showMessage('Crafting... wait!', '#fa0');
        return;
    }
    
    for (const [res, cost] of Object.entries(recipe)) {
        if (res !== 'time') gameState.resources[res] -= cost;
    }
    
    gameState.manualCrafting.lastCrafted = now;
    showMessage(`Crafting ${item}...`, '#0f0');
    
    setTimeout(() => {
        gameState.resources[item] += (item === 'ammo' ? 5 : 1);
        updateResources();
        updateCraftingButtons();
        showMessage(`+1 ${item}`, '#0f0');
    }, recipe.time);
}

function setupMouseControls() {
    const gameGrid = document.getElementById('gameGrid');
    
    gameGrid.addEventListener('mousedown', (e) => {
        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
            isDragging = true;
            dragStart = { x: e.clientX, y: e.clientY };
            cameraStart = { ...gameState.camera };
            gameGrid.classList.add('dragging');
            e.preventDefault();
        }
    });
    
    gameGrid.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            gameState.camera.x = cameraStart.x - dx;
            gameState.camera.y = cameraStart.y - dy;
            updateCamera();
        }
    });
    
    gameGrid.addEventListener('mouseup', () => {
        isDragging = false;
        gameGrid.classList.remove('dragging');
    });
    
    gameGrid.addEventListener('mouseleave', () => {
        isDragging = false;
        gameGrid.classList.remove('dragging');
    });
    
    document.getElementById('minimap').addEventListener('click', (e) => {
        const rect = e.target.getBoundingClientRect();
        const scale = 150 / GRID_SIZE;
        const x = Math.floor((e.clientX - rect.left) / scale);
        const y = Math.floor((e.clientY - rect.top) / scale);
        gameState.camera.x = -(x * CELL_SIZE - window.innerWidth / 2);
        gameState.camera.y = -(y * CELL_SIZE - window.innerHeight / 2);
        updateCamera();
    });
}

function updateCamera() {
    const grid = document.getElementById('grid');
    const scaledCellSize = CELL_SIZE * gameState.zoomLevel;
    
    grid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, ${scaledCellSize}px)`;
    grid.style.transform = `translate(${gameState.camera.x}px, ${gameState.camera.y}px) scale(${gameState.zoomLevel})`;
    
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.style.width = `${scaledCellSize}px`;
        cell.style.height = `${scaledCellSize}px`;
        cell.style.fontSize = `${scaledCellSize * 0.75}px`;
    });
    
    const buildings = document.querySelectorAll('.building');
    buildings.forEach(building => {
        building.style.fontSize = `${scaledCellSize * 0.75}px`;
    });
    
    const enemies = document.querySelectorAll('.enemy');
    enemies.forEach(el => {
        const enemy = gameState.enemies.find(e => e.element === el);
        if (enemy) {
            el.style.left = (enemy.x * CELL_SIZE * gameState.zoomLevel + 2 * gameState.zoomLevel) + 'px';
            el.style.top = (enemy.y * CELL_SIZE * gameState.zoomLevel + 2 * gameState.zoomLevel) + 'px';
            el.style.width = (28 * gameState.zoomLevel) + 'px';
            el.style.height = (28 * gameState.zoomLevel) + 'px';
            el.style.fontSize = (20 * gameState.zoomLevel) + 'px';
        }
    });
}

function handleCellClick(x, y, e) {
    if (gameState.isPaused) return;
    
    const cell = gameState.grid[y][x];
    const isRevealed = gameState.revealed.has(`${x},${y}`);
    
    if (!gameState.buildingInHand && isRevealed && cell.type && cell.type.startsWith('resource-') && cell.amount > 0) {
        const resource = cell.type.split('-')[1];
        cell.amount -= 1;
        gameState.resources[resource] += 1;
        showMessage(`+1 ${resource}`, '#0f0');
        updateGridView();
        updateResources();
        return;
    }
    
    placeBuilding(x, y);
}

function renderBuildingList() {
    const list = document.getElementById('buildingList');
    list.innerHTML = '';
    Object.entries(BUILDINGS).forEach(([key, building]) => {
        const btn = document.createElement('div');
        btn.className = 'building-btn';
        btn.innerHTML = `${building.icon}<span class="keybind">${building.key}</span>`;
        btn.draggable = true;
        btn.dataset.building = key;
        btn.title = `${key.toUpperCase()}: ${Object.entries(building.cost).map(([r,c]) => `${c} ${r}`).join(', ')}`;
        btn.addEventListener('click', () => selectBuilding(key));
        btn.addEventListener('mouseenter', (e) => showTooltip(e, building));
        btn.addEventListener('mouseleave', hideTooltip);
        list.appendChild(btn);
    });
}

function showTooltip(e, building) {
    const tooltip = document.getElementById('tooltip') || (() => {
        const t = document.createElement('div');
        t.id = 'tooltip';
        t.className = 'tooltip';
        document.body.appendChild(t);
        return t;
    })();
    const costStr = Object.entries(building.cost).map(([r,c]) => `${c} ${r}`).join(', ');
    tooltip.innerHTML = `<strong>${building.key}: ${costStr}</strong><br>${building.desc}`;
    tooltip.style.display = 'block';
    tooltip.style.left = e.clientX + 10 + 'px';
    tooltip.style.top = e.clientY + 10 + 'px';
}

function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) tooltip.style.display = 'none';
}

function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (BUILDING_KEYS[e.key]) {
            selectBuilding(BUILDING_KEYS[e.key]);
        } else if (e.key === 'p' || e.key === 'P') {
            togglePause();
        } else if (e.key === '+' || e.key === '=') {
            changeZoom(ZOOM_STEP);
        } else if (e.key === '-' || e.key === '_') {
            changeZoom(-ZOOM_STEP);
        } else if (e.key === 'w' || e.key === 'W') {
            gameState.camera.y += CELL_SIZE * gameState.zoomLevel;
            updateCamera();
        } else if (e.key === 's' || e.key === 'S') {
            gameState.camera.y -= CELL_SIZE * gameState.zoomLevel;
            updateCamera();
        } else if (e.key === 'a' || e.key === 'A') {
            gameState.camera.x += CELL_SIZE * gameState.zoomLevel;
            updateCamera();
        } else if (e.key === 'd' || e.key === 'D') {
            gameState.camera.x -= CELL_SIZE * gameState.zoomLevel;
            updateCamera();
        } else if (e.key === 'F5') {
            e.preventDefault();
            saveGame();
        } else if (e.key === 'F9') {
            e.preventDefault();
            loadGame();
        } else if (e.key === 'F10') {
            e.preventDefault();
            resetGame();
        }
    });
}

function togglePause() {
    gameState.isPaused = !gameState.isPaused;
    showMessage(gameState.isPaused ? 'PAUSED - Press P to resume' : 'RESUMED', '#ff0');
}

function selectBuilding(type) {
    document.querySelectorAll('.building-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector(`[data-building="${type}"]`)?.classList.add('selected');
    gameState.buildingInHand = { type, rotation: 0 };
    
    if (type === 'turret') {
        gameState.achievements.turretsBuilt++;
    }
}

function canAfford(building) {
    return Object.entries(BUILDINGS[building].cost).every(([res, cost]) => 
        gameState.resources[res] >= cost
    );
}

function canPlaceBuilding(x, y, buildingType) {
    const cell = gameState.grid[y][x];
    if (cell.entity) return false;
    if (BUILDINGS[buildingType].requiresResource && !cell.type?.startsWith('resource-')) return false;
    if (buildingType === 'pumpjack' && cell.type !== 'resource-oil') return false;
    if (x === CORE_POS.x && y === CORE_POS.y) return false;
    return true;
}

function placeBuilding(x, y) {
    if (!gameState.buildingInHand) return;
    if (x === CORE_POS.x && y === CORE_POS.y) {
        showMessage('Cannot build on CORE!', '#f00');
        gameState.buildingInHand = null;
        document.querySelectorAll('.building-btn').forEach(b => b.classList.remove('selected'));
        return;
    }
    
    const building = gameState.buildingInHand.type;
    const cell = gameState.grid[y][x];
    
    if (!canPlaceBuilding(x, y, building)) {
        const buildingName = building.charAt(0).toUpperCase() + building.slice(1);
        showMessage(`${buildingName} must be placed on ${building === 'miner' ? 'resource tile' : 'valid location'}!`, '#f80');
        gameState.buildingInHand = null;
        document.querySelectorAll('.building-btn').forEach(b => b.classList.remove('selected'));
        return;
    }
    
    if (!canAfford(building)) {
        const needed = Object.entries(BUILDINGS[building].cost)
            .filter(([res, cost]) => gameState.resources[res] < cost)
            .map(([res, cost]) => `${cost - Math.floor(gameState.resources[res])} ${res}`)
            .join(', ');
        showMessage(`Need: ${needed}`, '#f80');
        gameState.buildingInHand = null;
        document.querySelectorAll('.building-btn').forEach(b => b.classList.remove('selected'));
        return;
    }

    Object.entries(BUILDINGS[building].cost).forEach(([res, cost]) => {
        gameState.resources[res] -= cost;
    });

    cell.entity = building;
    cell.rotation = gameState.buildingInHand.rotation;
    cell.lastProduced = Date.now();
    cell.barrierHealth = building === 'barrier' ? 100 : undefined;

    revealArea(x, y, 4);
    updateGridView();
    updateResources();
    gameState.buildingInHand = null;
    document.querySelectorAll('.building-btn').forEach(b => b.classList.remove('selected'));
}

function handleRightClick(x, y) {
    const cell = gameState.grid[y][x];
    if (cell.entity === 'core') return;
    
    if (cell.entity) {
        const deconstructTime = 500;
        showMessage('Deconstructing...', '#888');
        setTimeout(() => {
            Object.entries(BUILDINGS[cell.entity].cost).forEach(([res, cost]) => {
                gameState.resources[res] += Math.floor(cost / 2);
            });
            cell.entity = null;
            updateGridView();
            updateResources();
            showMessage('Deconstructed! (50% refund)', '#0f0');
        }, deconstructTime);
    }
}

function revealArea(x, y, radius = 4) {
    for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                gameState.revealed.add(`${nx},${ny}`);
            }
        }
    }
}

function updateGridView() {
    const cells = document.querySelectorAll('.cell');
    const scaledCellSize = CELL_SIZE * gameState.zoomLevel;
    
    cells.forEach(cell => {
        const x = +cell.dataset.x, y = +cell.dataset.y;
        const data = gameState.grid[y][x];
        const isRevealed = gameState.revealed.has(`${x},${y}`);
        
        cell.className = `cell ${isRevealed ? data.type : 'fog'}`;
        cell.innerHTML = '';
        cell.style.width = `${scaledCellSize}px`;
        cell.style.height = `${scaledCellSize}px`;
        
        if (isRevealed && data.entity) {
            const building = document.createElement('div');
            building.className = `building ${data.entity} rot-${data.rotation || 0}`;
            building.style.fontSize = `${scaledCellSize * 0.75}px`;
            if (data.entity === 'core') {
                building.innerHTML = '🚀';
            } else {
                building.textContent = BUILDINGS[data.entity]?.icon || '';
            }
            cell.appendChild(building);
        }
    });
}

function updateResources() {
    const resDiv = document.getElementById('resources');
    resDiv.innerHTML = RESOURCES.map(r => 
        `<div class="stat-line">${r}: <span>${Math.floor(gameState.resources[r])}</span></div>`
    ).join('');
    
    document.querySelectorAll('.building-btn').forEach(btn => {
        const type = btn.dataset.building;
        btn.classList.toggle('disabled', !canAfford(type));
    });
    
    updateCraftingButtons();
}

function updateObjectives() {
    const turretCount = countBuildings('turret');
    if (!gameState.objectives[0] && gameState.revealed.has(`${CORE_POS.x},${CORE_POS.y}`)) {
        gameState.objectives[0] = true;
    }
    if (!gameState.objectives[1] && turretCount >= 4) {
        gameState.objectives[1] = true;
    }
    if (!gameState.objectives[2] && gameState.resources.ammo >= 50) {
        gameState.objectives[2] = true;
    }
    if (!gameState.objectives[3] && gameState.wave > 5) {
        gameState.objectives[3] = true;
    }
    
    const objDivs = document.querySelectorAll('.objective');
    objDivs[0].innerHTML = gameState.objectives[0] ? '✅ Core secured' : '⚪ Protect the Core at center';
    objDivs[1].innerHTML = `⚪ Build 4 turrets (${turretCount}/4)`;
    objDivs[2].innerHTML = `⚪ Stockpile 50 ammo (${Math.floor(gameState.resources.ammo)}/50)`;
    objDivs[3].innerHTML = `⚪ Survive 5 waves (${Math.min(gameState.wave-1, 5)}/5)`;
    objDivs[4].innerHTML = gameState.objectives[4] ? '✅ Rocket launched!' : '⚪ Build Rocket Silo & Launch';
    
    objDivs.forEach((div, i) => div.classList.toggle('complete', gameState.objectives[i]));
}

function countBuildings(type) {
    let count = 0;
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (gameState.grid[y][x].entity === type) count++;
        }
    }
    return count;
}

function gameLoop() {
    if (!gameState.isPaused) {
        processProduction();
        processTurrets();
        moveEnemies();
        checkWave();
        updateStats();
        updateObjectives();
    }
    setTimeout(gameLoop, TICK_RATE);
}

function processProduction() {
    const now = Date.now();
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = gameState.grid[y][x];
            if (!cell.entity || cell.lastProduced + 2000 > now) continue;

            switch(cell.entity) {
                case 'miner':
                    const resource = cell.type?.split('-')[1];
                    if (resource && cell.amount > 0) {
                        const amount = resource === 'oil' ? 0.5 : 1;
                        cell.amount -= amount;
                        gameState.resources[resource] += amount;
                        cell.lastProduced = now;
                    }
                    break;
                case 'furnace':
                    if (gameState.resources.iron >= 5 && gameState.resources.coal >= 1) {
                        gameState.resources.iron -= 5;
                        gameState.resources.coal -= 1;
                        gameState.resources.steel += 1;
                        cell.lastProduced = now;
                    }
                    break;
                case 'assembler':
                    if (gameState.resources.ammo < 200 && gameState.resources.iron >= 2 && gameState.resources.copper >= 1) {
                        gameState.resources.iron -= 2;
                        gameState.resources.copper -= 1;
                        gameState.resources.ammo += 5;
                        cell.lastProduced = now;
                    }
                    break;
                case 'pumpjack':
                    if (cell.type === 'resource-oil' && cell.amount > 0) {
                        cell.amount -= 0.5;
                        gameState.resources.oil += 1;
                        cell.lastProduced = now;
                    }
                    break;
            }
        }
    }
}

function processTurrets() {
    const now = Date.now();
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = gameState.grid[y][x];
            if (cell.entity === 'turret' && gameState.resources.ammo > 0 && cell.lastProduced + 500 < now) {
                const target = findEnemyInRange(x, y, 6);
                if (target) {
                    fireTurret(x, y, target);
                    gameState.resources.ammo -= 1;
                    cell.lastProduced = now;
                }
            }
        }
    }
}

function findEnemyInRange(x, y, range) {
    return gameState.enemies.find(e => {
        const dx = e.x - x, dy = e.y - y;
        return Math.sqrt(dx*dx + dy*dy) <= range;
    });
}

function fireTurret(x, y, target) {
    const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"] .building`);
    if (cell) cell.classList.add('firing');
    setTimeout(() => cell?.classList.remove('firing'), 200);
    
    const projectile = document.createElement('div');
    projectile.className = 'projectile';
    projectile.style.left = (x * CELL_SIZE * gameState.zoomLevel + 14 * gameState.zoomLevel) + 'px';
    projectile.style.top = (y * CELL_SIZE * gameState.zoomLevel + 14 * gameState.zoomLevel) + 'px';
    document.getElementById('grid').appendChild(projectile);
    
    const dx = target.x - x, dy = target.y - y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    projectile.style.transition = `all ${distance*30}ms linear`;
    projectile.style.left = (target.x * CELL_SIZE * gameState.zoomLevel + 14 * gameState.zoomLevel) + 'px';
    projectile.style.top = (target.y * CELL_SIZE * gameState.zoomLevel + 14 * gameState.zoomLevel) + 'px';
    
    setTimeout(() => {
        projectile.remove();
        target.health -= 50;
        if (target.health <= 0) {
            killEnemy(target);
        }
    }, distance * 30);
}

function killEnemy(enemy) {
    const idx = gameState.enemies.indexOf(enemy);
    if (idx > -1) gameState.enemies.splice(idx, 1);
    
    if (enemy.reward) {
        for (const [res, amount] of Object.entries(enemy.reward)) {
            gameState.resources[res] += amount;
        }
        showMessage(`+${Object.entries(enemy.reward).map(([r,a]) => `${a} ${r}`).join(', ')}`, '#0f0');
    }
    
    enemy.element.remove();
    gameState.achievements.enemiesKilled++;
    
    if (enemy.type === 'boss' && enemy.spawnsMinions && !enemy.minionsSpawned) {
        enemy.minionsSpawned = true;
        setTimeout(() => {
            spawnMinions(enemy.x, enemy.y, 3);
        }, 2000);
    }
}

function spawnMinions(x, y, count) {
    for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i;
        const spawnX = x + Math.cos(angle) * 2;
        const spawnY = y + Math.sin(angle) * 2;
        
        // Bounds check - only spawn minions within grid
        if (spawnX < 0 || spawnX >= GRID_SIZE || spawnY < 0 || spawnY >= GRID_SIZE) {
            continue;
        }
        
        const minion = createEnemy('scout', spawnX, spawnY);
        minion.minion = true;
        gameState.enemies.push(minion);
        document.getElementById('grid').appendChild(minion.element);
    }
    showMessage('Boss spawned minions!', '#f55');
}

function createEnemy(type, x, y) {
    const typeData = ENEMY_TYPES[type] || ENEMY_TYPES.basic;
    const wave = gameState.wave;
    
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
    
    const el = document.createElement('div');
    el.className = `enemy ${type}${enemy.isBoss ? ' boss' : ''}`;
    el.style.left = (x * CELL_SIZE * gameState.zoomLevel + 2 * gameState.zoomLevel) + 'px';
    el.style.top = (y * CELL_SIZE * gameState.zoomLevel + 2 * gameState.zoomLevel) + 'px';
    el.style.width = (28 * gameState.zoomLevel) + 'px';
    el.style.height = (28 * gameState.zoomLevel) + 'px';
    el.style.fontSize = (20 * gameState.zoomLevel) + 'px';
    el.textContent = typeData.icon;
    
    const healthBar = document.createElement('div');
    healthBar.className = `health-bar${enemy.isBoss ? ' boss' : ''}`;
    healthBar.innerHTML = `<div class="health-fill" style="width: 100%"></div>`;
    el.appendChild(healthBar);
    
    if (enemy.isBoss) {
        el.style.width = (42 * gameState.zoomLevel) + 'px';
        el.style.height = (42 * gameState.zoomLevel) + 'px';
        el.style.fontSize = (30 * gameState.zoomLevel) + 'px';
        healthBar.style.height = enemy.isBoss ? '8px' : '4px';
    }
    
    enemy.element = el;
    return enemy;
}

function selectEnemyType() {
    const wave = gameState.wave;
    
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

function spawnEnemies() {
    if (!gameState.firstWaveSpawned) {
        if (gameState.gameTime >= FIRST_WAVE_DELAY) {
            gameState.firstWaveSpawned = true;
            showMessage('FIRST WAVE ARRIVES!', '#f00');
        }
        return;
    }
    
    if (gameState.enemies.length >= gameState.enemiesInWave) return;
    const side = Math.floor(Math.random() * 4);
    let x, y;
    switch(side) {
        case 0: x = Math.floor(Math.random() * GRID_SIZE); y = 0; break;
        case 1: x = GRID_SIZE-1; y = Math.floor(Math.random() * GRID_SIZE); break;
        case 2: x = Math.floor(Math.random() * GRID_SIZE); y = GRID_SIZE-1; break;
        default: x = 0; y = Math.floor(Math.random() * GRID_SIZE);
    }
    
    const enemyType = selectEnemyType();
    const enemy = createEnemy(enemyType, x, y);
    
    document.getElementById('grid').appendChild(enemy.element);
    gameState.enemies.push(enemy);
}

function moveEnemies() {
    const barrierMap = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(false));
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (gameState.grid[y][x].entity === 'barrier') {
                barrierMap[y][x] = true;
            }
        }
    }
    
    gameState.enemies.forEach(enemy => {
        let dx = enemy.targetX - enemy.x;
        let dy = enemy.targetY - enemy.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > 0.3) {
            const moveX = dx / dist * enemy.speed;
            const moveY = dy / dist * enemy.speed;
            
            const nextX = enemy.x + moveX;
            const nextY = enemy.y + moveY;
            const nextCellX = Math.floor(nextX);
            const nextCellY = Math.floor(nextY);
            
            if (!enemy.ignoresBarriers) {
                if (barrierMap[nextCellY] && barrierMap[nextCellY][nextCellX]) {
                    const perpX = -moveY * 2;
                    const perpY = moveX * 2;
                    
                    let foundPath = false;
                    for (let tryDir of [[perpX, perpY], [-perpX, -perpY]]) {
                        const tryX = Math.floor(enemy.x + tryDir[0]);
                        const tryY = Math.floor(enemy.y + tryDir[1]);
                        if (tryX >= 0 && tryX < GRID_SIZE && tryY >= 0 && tryY < GRID_SIZE && !barrierMap[tryY][tryX]) {
                            enemy.x += tryDir[0];
                            enemy.y += tryDir[1];
                            foundPath = true;
                            break;
                        }
                    }
                    
                    if (!foundPath) {
                        const barrierX = Math.floor(enemy.x);
                        const barrierY = Math.floor(enemy.y);
                        damageBarrier(barrierX, barrierY, enemy.damage);
                    }
                } else {
                    enemy.x = nextX;
                    enemy.y = nextY;
                }
            } else {
                enemy.x = nextX;
                enemy.y = nextY;
            }
            
            enemy.element.style.left = (enemy.x * CELL_SIZE * gameState.zoomLevel + 2 * gameState.zoomLevel) + 'px';
            enemy.element.style.top = (enemy.y * CELL_SIZE * gameState.zoomLevel + 2 * gameState.zoomLevel) + 'px';
        } else {
            damageCore(enemy.damage);
            const idx = gameState.enemies.indexOf(enemy);
            if (idx > -1) {
                gameState.enemies.splice(idx, 1);
                enemy.element.remove();
            }
        }
        
        const healthFill = enemy.element.querySelector('.health-fill');
        healthFill.style.width = `${(enemy.health / enemy.maxHealth) * 100}%`;
    });
}

function damageBarrier(x, y, damage) {
    // Bounds check - prevent out of bounds access
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;
    const cell = gameState.grid[y][x];
    if (cell.entity === 'barrier') {
        cell.barrierHealth = (cell.barrierHealth || 100) - damage;
        if (cell.barrierHealth <= 0) {
            cell.entity = null;
            updateGridView();
            showMessage('Barrier destroyed!', '#f55');
        }
    }
}

function damageCore(damage) {
    gameState.coreHealth -= damage;
    gameState.achievements.coreDamageTaken += damage;
    checkWave();
    
    if (gameState.coreHealth <= 0) {
        showMessage('GAME OVER - Core Destroyed!', '#f00');
        gameState.isPaused = true;
    }
}

function checkWave() {
    if (!gameState.firstWaveSpawned) {
        const timeUntilFirst = Math.max(0, Math.ceil((FIRST_WAVE_DELAY - gameState.gameTime) / 1000));
        document.getElementById('waveInfo').textContent = 
            `Wave: 1 (Starting in ${timeUntilFirst}s) | Core: ${Math.ceil(gameState.coreHealth)}%`;
        return;
    }
    
    if (gameState.waveTimer >= WAVE_DURATION && gameState.enemies.length === 0) {
        gameState.wave++;
        gameState.enemiesInWave = 5 + gameState.wave * 3;
        gameState.waveTimer = 0;
        gameState.achievements.wavesSurvived++;
        
        let waveMsg = `WAVE ${gameState.wave} INCOMING!`;
        if (gameState.wave >= 5) waveMsg += ' (Tanks!)';
        if (gameState.wave >= 8) waveMsg = 'WAVE ' + gameState.wave + ' INCOMING! (Flyers!)';
        if (gameState.wave % 10 === 0) waveMsg = 'WAVE ' + gameState.wave + ' - BOSS!';
        
        showMessage(waveMsg, '#ff0');
    } else {
        gameState.waveTimer += TICK_RATE;
    }
    
    const enemyCounts = {};
    gameState.enemies.forEach(e => {
        enemyCounts[e.type] = (enemyCounts[e.type] || 0) + 1;
    });
    const enemyTypeStr = Object.entries(enemyCounts).map(([t, c]) => `${c}${t[0].toUpperCase()}`).join(', ');
    
    document.getElementById('waveInfo').textContent = 
        `Wave: ${gameState.wave} | Enemies: ${gameState.enemies.length}/${gameState.enemiesInWave} ${enemyTypeStr ? `(${enemyTypeStr})` : ''} | Core: ${Math.ceil(gameState.coreHealth)}%`;
    
    if (gameState.wave > 25) {
        checkWinCondition();
    }
}

function checkWinCondition() {
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (gameState.grid[y][x].entity === 'silo' && !gameState.rocketLaunched) {
                showMessage('ROCKET LAUNCHING... VICTORY!', '#0f0');
                gameState.rocketLaunched = true;
                gameState.isPaused = true;
                gameState.objectives[4] = true;
                return;
            }
        }
    }
}

function showMessage(text, color) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.style.color = color;
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
}

function updateStats() {
    const stats = document.getElementById('stats');
    stats.innerHTML = `
        <div class="stat-line">Time: <span>${Math.floor(gameState.gameTime/1000)}s</span></div>
        <div class="stat-line">Turrets: <span>${countBuildings('turret')}</span></div>
        <div class="stat-line">Barriers: <span>${countBuildings('barrier')}</span></div>
        <div class="stat-line">Miners: <span>${countBuildings('miner')}</span></div>
        <div class="stat-line">Kills: <span>${gameState.achievements.enemiesKilled}</span></div>
    `;
}

function drawMinimap() {
    const canvas = document.getElementById('minimap');
    const ctx = canvas.getContext('2d');
    canvas.width = 150;
    canvas.height = 150;
    
    const scale = canvas.width / GRID_SIZE;
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (gameState.revealed.has(`${x},${y}`)) {
                ctx.fillStyle = '#111';
                ctx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    }
    
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (gameState.grid[y][x].entity === 'barrier') {
                ctx.fillStyle = '#888';
                ctx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    }
    
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (gameState.grid[y][x].entity === 'turret') {
                ctx.fillStyle = '#f0f';
                ctx.fillRect(x * scale + scale/4, y * scale + scale/4, scale/2, scale/2);
            }
        }
    }
    
    ctx.fillStyle = '#0ff';
    ctx.fillRect(CORE_POS.x * scale, CORE_POS.y * scale, scale, scale);
    
    gameState.enemies.forEach(enemy => {
        const colors = {
            basic: '#f00',
            scout: '#ff0',
            tank: '#964B00',
            flyer: '#90f',
            boss: '#f06'
        };
        ctx.fillStyle = colors[enemy.type] || '#f00';
        
        if (enemy.isBoss) {
            ctx.beginPath();
            ctx.arc(enemy.x * scale + scale/2, enemy.y * scale + scale/2, scale/2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(enemy.x * scale + scale/2, enemy.y * scale + scale/2, scale/3, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    
    const viewportX = -gameState.camera.x / CELL_SIZE * scale / gameState.zoomLevel;
    const viewportY = -gameState.camera.y / CELL_SIZE * scale / gameState.zoomLevel;
    const viewportW = document.getElementById('gameGrid').clientWidth / CELL_SIZE * scale / gameState.zoomLevel;
    const viewportH = document.getElementById('gameGrid').clientHeight / CELL_SIZE * scale / gameState.zoomLevel;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(viewportX, viewportY, viewportW, viewportH);
}

function saveGame() {
    localStorage.setItem('factory_defense_v6', JSON.stringify(gameState));
    showMessage('Game Saved', '#0f0');
}

function loadGame() {
    const saved = localStorage.getItem('factory_defense_v6');
    if (saved) {
        gameState = JSON.parse(saved);
        gameState.revealed = new Set(gameState.revealed);
        gameState.enemies = [];
        gameState.projectiles = [];
        setupGrid();
        updateResources();
        updateZoomDisplay();
        showMessage('Game Loaded', '#0f0');
    }
}

function autoSave() {
    if (!gameState.isPaused && !gameState.rocketLaunched) saveGame();
}

function resetGame() {
    if (confirm('Reset game? All progress will be lost.')) {
        localStorage.removeItem('factory_defense_v6');
        location.reload();
    }
}

init();
