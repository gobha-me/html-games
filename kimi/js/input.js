/**
 * Input Module
 * Keyboard, mouse, and zoom controls
 * 
 * NOTE: This module must load AFTER ui.js for access to updateCamera() and drawMinimap()
 */

let isDragging = false;
let dragStart = { x: 0, y: 0 };
let cameraStart = { x: 0, y: 0 };

// ============================================================================
// MOUSE CONTROLS
// ============================================================================

function setupMouseControls() {
    const gameGrid = document.getElementById('gameGrid');
    if (!gameGrid) {
        console.warn('setupMouseControls: gameGrid not found');
        return;
    }
    
    gameGrid.addEventListener('mousedown', (e) => {
        // Middle mouse button (button 1) or Ctrl+Left click for camera drag
        if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
            isDragging = true;
            dragStart = { x: e.clientX, y: e.clientY };
            const state = getGameState();
            cameraStart = { ...state.camera };
            gameGrid.classList.add('dragging');
            e.preventDefault();
            e.stopPropagation();
        }
    });
    
    gameGrid.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const state = getGameState();
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            state.camera.x = cameraStart.x + dx;
            state.camera.y = cameraStart.y + dy;
            if (typeof updateCamera === 'function') {
                updateCamera();
            }
        }
    });
    
    const stopDrag = () => {
        isDragging = false;
        gameGrid.classList.remove('dragging');
    };
    
    gameGrid.addEventListener('mouseup', stopDrag);
    gameGrid.addEventListener('mouseleave', stopDrag);
    
    // Minimap click to jump
    const minimap = document.getElementById('minimap');
    if (minimap) {
        minimap.addEventListener('click', (e) => {
            const rect = minimap.getBoundingClientRect();
            const scale = 150 / GRID_SIZE;
            const x = Math.floor((e.clientX - rect.left) / scale);
            const y = Math.floor((e.clientY - rect.top) / scale);
            
            const state = getGameState();
            state.camera.x = -(x * CELL_SIZE - window.innerWidth / 2);
            state.camera.y = -(y * CELL_SIZE - window.innerHeight / 2);
            if (typeof updateCamera === 'function') {
                updateCamera();
            }
        });
    }
}

// ============================================================================
// KEYBOARD CONTROLS
// ============================================================================

function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        const state = getGameState();
        
        // Building selection (1-7)
        if (BUILDING_KEYS[e.key]) {
            selectBuilding(BUILDING_KEYS[e.key]);
        }
        // Pause
        else if (e.key === 'p' || e.key === 'P') {
            togglePause();
        }
        // Zoom controls (+/-)
        else if (e.key === '+' || e.key === '=') {
            changeZoom(ZOOM_STEP);
        }
        else if (e.key === '-' || e.key === '_') {
            changeZoom(-ZOOM_STEP);
        }
        // Camera panning (WASD)
        else if (e.key === 'w' || e.key === 'W') {
            state.camera.y += CELL_SIZE * state.zoomLevel;
            if (typeof updateCamera === 'function') updateCamera();
        }
        else if (e.key === 's' || e.key === 'S') {
            state.camera.y -= CELL_SIZE * state.zoomLevel;
            if (typeof updateCamera === 'function') updateCamera();
        }
        else if (e.key === 'a' || e.key === 'A') {
            state.camera.x += CELL_SIZE * state.zoomLevel;
            if (typeof updateCamera === 'function') updateCamera();
        }
        else if (e.key === 'd' || e.key === 'D') {
            state.camera.x -= CELL_SIZE * state.zoomLevel;
            if (typeof updateCamera === 'function') updateCamera();
        }
        // Save/Load/Reset
        else if (e.key === 'F5') {
            e.preventDefault();
            if (typeof saveGame === 'function') saveGame();
        }
        else if (e.key === 'F9') {
            e.preventDefault();
            if (typeof loadGame === 'function') loadGame();
        }
        else if (e.key === 'F10') {
            e.preventDefault();
            if (typeof resetGame === 'function') resetGame();
        }
    });
}

// ============================================================================
// ZOOM CONTROLS
// ============================================================================

function setupZoom() {
    const gameGrid = document.getElementById('gameGrid');
    if (!gameGrid) {
        console.warn('setupZoom: gameGrid not found');
        return;
    }
    
    gameGrid.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
        changeZoom(delta);
    }, { passive: false });
    
    updateZoomDisplay();
}

function changeZoom(delta) {
    const state = getGameState();
    const oldZoom = state.zoomLevel;
    state.zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoomLevel + delta));
    
    if (oldZoom !== state.zoomLevel) {
        if (typeof updateCamera === 'function') updateCamera();
        if (typeof drawMinimap === 'function') drawMinimap();
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

// ============================================================================
// CAMERA UPDATE (called by other modules)
// ============================================================================

function updateCamera() {
    const state = getGameState();
    const grid = document.getElementById('grid');
    if (!grid) return;
    
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
        const enemy = state.enemies.find(e => e.element === el);
        if (enemy) {
            el.style.left = (enemy.x * CELL_SIZE * state.zoomLevel + 2 * state.zoomLevel) + 'px';
            el.style.top = (enemy.y * CELL_SIZE * state.zoomLevel + 2 * state.zoomLevel) + 'px';
            el.style.width = (28 * state.zoomLevel) + 'px';
            el.style.height = (28 * state.zoomLevel) + 'px';
            el.style.fontSize = (20 * state.zoomLevel) + 'px';
        }
    });
}

// ============================================================================
// MODULE INITIALIZATION
// ============================================================================

const Input = {
    init() {
        console.log('Input module initializing...');
        setupMouseControls();
        setupKeyboard();
        setupZoom();
        console.log('Input module ready');
    }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Input,
        isDragging, dragStart, cameraStart,
        setupMouseControls, setupKeyboard, setupZoom,
        changeZoom, updateZoomDisplay, updateCamera
    };
}

// Also expose globally for non-module usage
window.Input = Input;
window.setupMouseControls = setupMouseControls;
window.setupKeyboard = setupKeyboard;
window.setupZoom = setupZoom;
window.changeZoom = changeZoom;
window.updateZoomDisplay = updateZoomDisplay;
window.updateCamera = updateCamera;
