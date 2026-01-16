/**
 * Input Module
 * Keyboard, mouse, and zoom controls
 * 
 * NOTE: This module must load AFTER ui.js for access to updateCamera() and drawMinimap()
 */

let isDragging = false;
let dragStart = { x: 0, y: 0 };
let cameraStart = { x: 0, y: 0 };

// Range ring elements
let rangeRingElement = null;
let rangeRingCanvas = null;

// ============================================================================
// MOUSE CONTROLS
// ============================================================================

function setupMouseControls() {
    const gameGrid = document.getElementById('gameGrid');
    if (!gameGrid) {
        console.warn('setupMouseControls: gameGrid not found');
        return;
    }
    
    // Create range ring canvas
    createRangeRingCanvas();
    
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
        } else {
            // Update range ring position when hovering
            updateRangeRing(e);
        }
    });
    
    const stopDrag = () => {
        isDragging = false;
        gameGrid.classList.remove('dragging');
        // Hide range ring when not dragging
        hideRangeRing();
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
// RANGE RING VISUALIZATION
// ============================================================================

function createRangeRingCanvas() {
    // Create canvas overlay for range ring
    rangeRingCanvas = document.createElement('canvas');
    rangeRingCanvas.id = 'rangeRingCanvas';
    rangeRingCanvas.style.cssText = 'position: absolute; top: 0; left: 0; pointer-events: none; z-index: 50;';
    
    const gameGrid = document.getElementById('gameGrid');
    if (gameGrid) {
        gameGrid.appendChild(rangeRingCanvas);
    }
    
    // Create range ring element for DOM-based styling
    rangeRingElement = document.createElement('div');
    rangeRingElement.id = 'rangeRing';
    rangeRingElement.style.cssText = 'position: absolute; pointer-events: none; z-index: 49; display: none;';
    
    if (gameGrid) {
        gameGrid.appendChild(rangeRingElement);
    }
}

function screenToGridCoords(screenX, screenY) {
    const state = getGameState();
    if (!state) return { x: -1, y: -1 };
    
    const gameGrid = document.getElementById('gameGrid');
    if (!gameGrid) return { x: -1, y: -1 };
    
    const gridRect = gameGrid.getBoundingClientRect();
    
    // Get position relative to the centered game grid container
    const relX = screenX - gridRect.left;
    const relY = screenY - gridRect.top;
    
    // Account for camera offset (camera is already positioned to center grid)
    const worldX = relX - state.camera.x;
    const worldY = relY - state.camera.y;
    
    // Convert to grid coordinates
    const gridX = Math.floor(worldX / (CELL_SIZE * state.zoomLevel));
    const gridY = Math.floor(worldY / (CELL_SIZE * state.zoomLevel));
    
    return { x: gridX, y: gridY };
}

function gridToScreenCoords(gridX, gridY) {
    const state = getGameState();
    if (!state) return { x: 0, y: 0 };
    
    // Calculate cell center in screen coordinates
    const scaledCellSize = CELL_SIZE * state.zoomLevel;
    const centerX = state.camera.x + gridX * scaledCellSize + scaledCellSize / 2;
    const centerY = state.camera.y + gridY * scaledCellSize + scaledCellSize / 2;
    
    return { x: centerX, y: centerY };
}

function updateRangeRing(e) {
    const state = getGameState();
    if (!state || !rangeRingCanvas || !rangeRingElement) return;
    
    // Get grid coordinates from mouse position
    const gridCoords = screenToGridCoords(e.clientX, e.clientY);
    const gridX = gridCoords.x;
    const gridY = gridCoords.y;
    
    // Handle turret placement preview
    if (state.buildingInHand && state.buildingInHand.type === 'turret') {
        // Check if placement is valid
        const canPlace = canPlaceBuilding(gridX, gridY, 'turret');
        const canAffordTurret = canAfford('turret');
        const isValid = canPlace && canAffordTurret;
        
        // Calculate ring position at cell center
        const screenCoords = gridToScreenCoords(gridX, gridY);
        
        // Draw range ring on canvas
        drawRangeRing(screenCoords.x, screenCoords.y, isValid ? 'valid' : 'invalid', false);
        
        rangeRingCanvas.style.display = 'block';
        rangeRingElement.style.display = 'none';
    }
    // Handle hover over existing turrets
    else {
        const cell = getCell(gridX, gridY);
        
        if (cell && cell.entity === 'turret' && isRevealed(gridX, gridY)) {
            // Calculate ring position at cell center
            const screenCoords = gridToScreenCoords(gridX, gridY);
            
            // Draw hover ring for existing turret
            drawRangeRing(screenCoords.x, screenCoords.y, 'hover', true);
            
            rangeRingCanvas.style.display = 'block';
            rangeRingElement.style.display = 'none';
        } else {
            hideRangeRing();
        }
    }
}

function drawRangeRing(centerX, centerY, ringType, isSolid) {
    if (!rangeRingCanvas) return;
    
    const state = getGameState();
    const zoomLevel = state ? state.zoomLevel : 1;
    
    // Calculate ring radius in pixels
    const radius = TURRET_RANGE * CELL_SIZE * zoomLevel;
    
    // Resize canvas to match game grid
    const gameGrid = document.getElementById('gameGrid');
    if (gameGrid) {
        rangeRingCanvas.width = gameGrid.clientWidth;
        rangeRingCanvas.height = gameGrid.clientHeight;
    }
    
    const ctx = rangeRingCanvas.getContext('2d');
    ctx.clearRect(0, 0, rangeRingCanvas.width, rangeRingCanvas.height);
    
    // Set styles based on ring type
    let fillColor, strokeColor, lineWidth, lineDash;
    
    switch (ringType) {
        case 'valid':
            fillColor = 'rgba(0, 255, 0, 0.1)';
            strokeColor = '#0f0';
            lineWidth = 2;
            lineDash = [5, 5];
            break;
        case 'invalid':
            fillColor = 'rgba(255, 0, 0, 0.1)';
            strokeColor = '#f00';
            lineWidth = 2;
            lineDash = [5, 5];
            break;
        case 'hover':
            fillColor = 'rgba(0, 200, 255, 0.1)';
            strokeColor = '#0cf';
            lineWidth = 3;
            lineDash = [];
            break;
        default:
            fillColor = 'rgba(0, 255, 0, 0.1)';
            strokeColor = '#0f0';
            lineWidth = 2;
            lineDash = [];
    }
    
    // Draw filled circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fillStyle = fillColor;
    ctx.fill();
    
    // Draw stroke
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    
    if (lineDash.length > 0) {
        ctx.setLineDash(lineDash);
    } else {
        ctx.setLineDash([]);
    }
    
    ctx.stroke();
    
    // Reset line dash
    ctx.setLineDash([]);
}

function hideRangeRing() {
    if (rangeRingCanvas) {
        rangeRingCanvas.style.display = 'none';
        const ctx = rangeRingCanvas.getContext('2d');
        ctx.clearRect(0, 0, rangeRingCanvas.width, rangeRingCanvas.height);
    }
    if (rangeRingElement) {
        rangeRingElement.style.display = 'none';
    }
}

function updateRangeRingOnZoom() {
    // Range ring will be updated on next mouse move
    // This function ensures the canvas is properly sized
    if (rangeRingCanvas) {
        const gameGrid = document.getElementById('gameGrid');
        if (gameGrid) {
            rangeRingCanvas.width = gameGrid.clientWidth;
            rangeRingCanvas.height = gameGrid.clientHeight;
        }
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
        // Update range ring canvas size on zoom
        updateRangeRingOnZoom();
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
        changeZoom, updateZoomDisplay, updateCamera,
        createRangeRingCanvas, updateRangeRing, hideRangeRing, updateRangeRingOnZoom,
        screenToGridCoords, gridToScreenCoords
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
window.createRangeRingCanvas = createRangeRingCanvas;
window.updateRangeRing = updateRangeRing;
window.hideRangeRing = hideRangeRing;
window.updateRangeRingOnZoom = updateRangeRingOnZoom;
window.screenToGridCoords = screenToGridCoords;
window.gridToScreenCoords = gridToScreenCoords;
