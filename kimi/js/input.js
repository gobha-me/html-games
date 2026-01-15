/**
 * Input Module
 * Keyboard, mouse, and zoom controls
 */

let isDragging = false;
let dragStart = { x: 0, y: 0 };
let cameraStart = { x: 0, y: 0 };

function setupMouseControls() {
    const gameGrid = document.getElementById('gameGrid');
    
    gameGrid.addEventListener('mousedown', (e) => {
        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
            isDragging = true;
            dragStart = { x: e.clientX, y: e.clientY };
            const state = getGameState();
            cameraStart = { ...state.camera };
            gameGrid.classList.add('dragging');
            e.preventDefault();
        }
    });
    
    gameGrid.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const state = getGameState();
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            state.camera.x = cameraStart.x + dx;
            state.camera.y = cameraStart.y + dy;
            updateCamera();
        }
    });
    
    gameGrid.addEventListener('mouseup', () => {
        isDragging = false;
        const gameGrid = document.getElementById('gameGrid');
        if (gameGrid) gameGrid.classList.remove('dragging');
    });
    
    gameGrid.addEventListener('mouseleave', () => {
        isDragging = false;
        const gameGrid = document.getElementById('gameGrid');
        if (gameGrid) gameGrid.classList.remove('dragging');
    });
    
    // Minimap click to jump
    document.getElementById('minimap').addEventListener('click', (e) => {
        const rect = e.target.getBoundingClientRect();
        const scale = 150 / GRID_SIZE;
        const x = Math.floor((e.clientX - rect.left) / scale);
        const y = Math.floor((e.clientY - rect.top) / scale);
        
        const state = getGameState();
        state.camera.x = -(x * CELL_SIZE - window.innerWidth / 2);
        state.camera.y = -(y * CELL_SIZE - window.innerHeight / 2);
        updateCamera();
    });
}

function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        // Building selection
        if (BUILDING_KEYS[e.key]) {
            selectBuilding(BUILDING_KEYS[e.key]);
        }
        // Pause
        else if (e.key === 'p' || e.key === 'P') {
            togglePause();
        }
        // Zoom controls
        else if (e.key === '+' || e.key === '=') {
            changeZoom(ZOOM_STEP);
        }
        else if (e.key === '-' || e.key === '_') {
            changeZoom(-ZOOM_STEP);
        }
        // Camera panning
        else if (e.key === 'w' || e.key === 'W') {
            const state = getGameState();
            state.camera.y += CELL_SIZE * state.zoomLevel;
            updateCamera();
        }
        else if (e.key === 's' || e.key === 'S') {
            const state = getGameState();
            state.camera.y -= CELL_SIZE * state.zoomLevel;
            updateCamera();
        }
        else if (e.key === 'a' || e.key === 'A') {
            const state = getGameState();
            state.camera.x += CELL_SIZE * state.zoomLevel;
            updateCamera();
        }
        else if (e.key === 'd' || e.key === 'D') {
            const state = getGameState();
            state.camera.x -= CELL_SIZE * state.zoomLevel;
            updateCamera();
        }
        // Save/Load/Reset
        else if (e.key === 'F5') {
            e.preventDefault();
            saveGame();
        }
        else if (e.key === 'F9') {
            e.preventDefault();
            loadGame();
        }
        else if (e.key === 'F10') {
            e.preventDefault();
            resetGame();
        }
    });
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
    const state = getGameState();
    const oldZoom = state.zoomLevel;
    state.zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoomLevel + delta));
    
    if (oldZoom !== state.zoomLevel) {
        updateCamera();
        drawMinimap();
        updateZoomDisplay();
    }
}

function updateZoomDisplay() {
    const state = getGameState();
    const zoomElement = document.getElementById('zoomLevel');
    if (zoomElement) {
        zoomElement.textContent = `${Math.round(state.zoomLevel * 100)}%`;
    }
}

function updateCamera() {
    const state = getGameState();
    const grid = document.getElementById('grid');
    const scaledCellSize = CELL_SIZE * state.zoomLevel;
    
    grid.style.gridTemplateColumns = `repeat(${GRID_SIZE}, ${scaledCellSize}px)`;
    grid.style.transform = `translate(${state.camera.x}px, ${state.camera.y}px) scale(${state.zoomLevel})`;
    
    // Update cell sizes
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.style.width = `${scaledCellSize}px`;
        cell.style.height = `${scaledCellSize}px`;
        cell.style.fontSize = `${scaledCellSize * 0.75}px`;
    });
    
    // Update building sizes
    const buildings = document.querySelectorAll('.building');
    buildings.forEach(building => {
        building.style.fontSize = `${scaledCellSize * 0.75}px`;
    });
    
    // Update enemy sizes and positions
    const enemies = document.querySelectorAll('.enemy');
    enemies.forEach(el => {
        const enemy = getEnemies().find(e => e.element === el);
        if (enemy) {
            updateEnemyElementPosition(el, enemy.x, enemy.y);
        }
    });
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isDragging, dragStart, cameraStart,
        setupMouseControls, setupKeyboard, setupZoom,
        changeZoom, updateZoomDisplay, updateCamera
    };
}
