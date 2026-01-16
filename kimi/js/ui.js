/**
 * UI Module
 * Rendering, minimap, stats, building list
 */

function setupGrid() {
    const gridEl = document.getElementById('grid');
    if (!gridEl) {
        console.error('setupGrid: grid element not found!');
        return;
    }
    
    console.log('Setting up grid with GRID_SIZE:', GRID_SIZE);
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
    console.log('Grid setup complete, cells created:', gridEl.children.length);
    updateGridView();
}

function updateGridView() {
    const cells = document.querySelectorAll('.cell');
    const state = getGameState();
    
    if (!state) {
        console.error('updateGridView: game state not initialized!');
        return;
    }
    
    const scaledCellSize = CELL_SIZE * state.zoomLevel;
    
    cells.forEach(cell => {
        const x = +cell.dataset.x, y = +cell.dataset.y;
        const data = getCell(x, y);
        if (!data) return;
        
        const isRevealed = state.revealed.has(`${x},${y}`);
        
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
            
            // Add assembler production indicator
            if (data.entity === 'assembler') {
                const indicator = document.createElement('div');
                indicator.className = `assembler-indicator ${data.productionActive ? 'producing' : ''}`;
                indicator.innerHTML = ASSEMBLER_RECIPES[data.productionType]?.icon || ASSEMBLER_RECIPES.ammo.icon;
                building.appendChild(indicator);
            }
            
            cell.appendChild(building);
        }
    });
}

function renderBuildingList() {
    const list = document.getElementById('buildingList');
    if (!list) {
        console.error('renderBuildingList: buildingList element not found!');
        return;
    }
    
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

function selectBuilding(type) {
    document.querySelectorAll('.building-btn').forEach(b => b.classList.remove('selected'));
    document.querySelector(`[data-building="${type}"]`)?.classList.add('selected');
    
    const state = getGameState();
    state.buildingInHand = { type, rotation: 0 };
    
    if (type === 'turret') {
        state.achievements.turretsBuilt++;
    }
}

function updateResources() {
    const resDiv = document.getElementById('resources');
    if (!resDiv) return;
    
    resDiv.innerHTML = RESOURCES.map(r => 
        `<div class="stat-line">${r}: <span>${Math.floor(getGameState().resources[r])}</span></div>`
    ).join('');
    
    document.querySelectorAll('.building-btn').forEach(btn => {
        const type = btn.dataset.building;
        btn.classList.toggle('disabled', !canAfford(type));
    });
    
    updateCraftingButtons();
}

/**
 * Setup crafting button event handlers and initial state.
 * Called once during game initialization.
 */
function setupCraftingButtons() {
    const gearBtn = document.getElementById('craft-gear');
    const circuitBtn = document.getElementById('craft-circuit');
    const ammoBtn = document.getElementById('craft-ammo');
    
    // Buttons already have onclick in HTML, just update initial state
    updateCraftingButtons();
}

function updateCraftingButtons() {
    const state = getGameState();
    
    const gearBtn = document.getElementById('craft-gear');
    if (gearBtn) {
        gearBtn.classList.toggle('disabled', state.resources.iron < MANUAL_RECIPES.gear.iron);
    }
    
    const circuitBtn = document.getElementById('craft-circuit');
    if (circuitBtn) {
        circuitBtn.classList.toggle('disabled', 
            state.resources.copper < MANUAL_RECIPES.circuit.copper || 
            state.resources.iron < MANUAL_RECIPES.circuit.iron);
    }
    
    const ammoBtn = document.getElementById('craft-ammo');
    if (ammoBtn) {
        ammoBtn.classList.toggle('disabled', 
            state.resources.iron < MANUAL_RECIPES.ammo.iron || 
            state.resources.copper < MANUAL_RECIPES.ammo.copper);
    }
}

function updateObjectives() {
    const state = getGameState();
    const turretCount = countBuildings('turret');
    
    if (!state.objectives[0] && state.revealed.has(`${CORE_POS.x},${CORE_POS.y}`)) {
        state.objectives[0] = true;
    }
    if (!state.objectives[1] && turretCount >= 4) {
        state.objectives[1] = true;
    }
    if (!state.objectives[2] && state.resources.ammo >= 50) {
        state.objectives[2] = true;
    }
    if (!state.objectives[3] && state.wave > 5) {
        state.objectives[3] = true;
    }
    
    const objDivs = document.querySelectorAll('.objective');
    objDivs[0].innerHTML = state.objectives[0] ? '✅ Core secured' : '⚪ Protect the Core at center';
    objDivs[1].innerHTML = `⚪ Build 4 turrets (${turretCount}/4)`;
    objDivs[2].innerHTML = `⚪ Stockpile 50 ammo (${Math.floor(state.resources.ammo)}/50)`;
    objDivs[3].innerHTML = `⚪ Survive 5 waves (${Math.min(state.wave-1, 5)}/5)`;
    objDivs[4].innerHTML = state.objectives[4] ? '✅ Rocket launched!' : '⚪ Build Rocket Silo & Launch';
    
    objDivs.forEach((div, i) => div.classList.toggle('complete', state.objectives[i]));
}

function updateStats() {
    const state = getGameState();
    const stats = document.getElementById('stats');
    stats.innerHTML = `
        <div class="stat-line">Time: <span>${Math.floor(state.gameTime/1000)}s</span></div>
        <div class="stat-line">Turrets: <span>${countBuildings('turret')}</span></div>
        <div class="stat-line">Barriers: <span>${countBuildings('barrier')}</span></div>
        <div class="stat-line">Miners: <span>${countBuildings('miner')}</span></div>
        <div class="stat-line">Kills: <span>${state.achievements.enemiesKilled}</span></div>
    `;
}

function showMessage(text, color) {
    const msg = document.getElementById('message');
    msg.textContent = text;
    msg.style.color = color;
    msg.style.display = 'block';
    setTimeout(() => msg.style.display = 'none', 3000);
}

function showAssemblerConfig(x, y) {
    const cell = getCell(x, y);
    if (!cell || cell.entity !== 'assembler') return;
    
    const modal = document.getElementById('assembler-modal');
    const currentType = cell.productionType || 'ammo';
    const currentRecipe = ASSEMBLER_RECIPES[currentType];
    
    // Update modal content
    const titleEl = document.getElementById('assembler-title');
    const infoEl = document.getElementById('assembler-info');
    const statusEl = document.getElementById('assembler-status');
    const recipeOptionsEl = document.getElementById('assembler-recipes');
    
    if (titleEl) titleEl.textContent = `⚙️ Assembler Configuration`;
    if (infoEl) {
        const inputStr = Object.entries(currentRecipe.inputs).map(([r, a]) => `${a} ${r}`).join(', ');
        infoEl.innerHTML = `
            <div class="assembler-info-row">
                <span>Current:</span>
                <span class="assembler-current">${currentRecipe.icon} ${currentRecipe.name}</span>
            </div>
            <div class="assembler-info-row">
                <span>Inputs:</span>
                <span>${inputStr}</span>
            </div>
            <div class="assembler-info-row">
                <span>Output:</span>
                <span>${Object.entries(currentRecipe.output).map(([r, a]) => `${a} ${r}`).join(', ')}</span>
            </div>
        `;
    }
    
    // Update status indicator
    if (statusEl) {
        const state = getGameState();
        const canProduce = Object.entries(currentRecipe.inputs).every(
            ([res, amount]) => state.resources[res] >= amount
        );
        statusEl.innerHTML = `
            <div class="assembler-status ${cell.productionActive ? 'active' : 'inactive'}">
                <span class="status-icon">${cell.productionActive ? '⚡' : '⏸️'}</span>
                <span>${cell.productionActive ? 'Producing' : 'Waiting for resources'}</span>
            </div>
        `;
    }
    
    // Build recipe options
    if (recipeOptionsEl) {
        recipeOptionsEl.innerHTML = '';
        Object.entries(ASSEMBLER_RECIPES).forEach(([type, recipe]) => {
            const option = document.createElement('div');
            option.className = `assembler-option ${currentType === type ? 'selected' : ''}`;
            option.innerHTML = `
                <div class="recipe-icon">${recipe.icon}</div>
                <div class="recipe-info">
                    <div class="recipe-name">${recipe.name}</div>
                    <div class="recipe-desc">${recipe.description}</div>
                    <div class="recipe-cost">In: ${Object.entries(recipe.inputs).map(([r,a]) => `${a} ${r}`).join(', ')} → Out: ${Object.entries(recipe.output).map(([r,a]) => `${a} ${r}`).join(', ')}</div>
                </div>
            `;
            option.addEventListener('click', () => {
                cell.productionType = type;
                updateGridView();
                closeAssemblerConfig();
                showAssemblerConfig(x, y); // Reopen with new selection
            });
            recipeOptionsEl.appendChild(option);
        });
    }
    
    // Store position for close handler
    modal.dataset.targetX = x;
    modal.dataset.targetY = y;
    
    if (modal) modal.style.display = 'block';
}

function closeAssemblerConfig() {
    const modal = document.getElementById('assembler-modal');
    if (modal) modal.style.display = 'none';
}

// Global exposure for HTML onclick handlers
window.showAssemblerConfig = showAssemblerConfig;
window.closeAssemblerConfig = closeAssemblerConfig;

function drawMinimap() {
    const canvas = document.getElementById('minimap');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    canvas.width = 150;
    canvas.height = 150;
    
    const scale = canvas.width / GRID_SIZE;
    const state = getGameState();
    
    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Revealed areas
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            if (state.revealed.has(`${x},${y}`)) {
                ctx.fillStyle = '#111';
                ctx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    }
    
    // Barriers
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = getCell(x, y);
            if (cell && cell.entity === 'barrier') {
                ctx.fillStyle = '#888';
                ctx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    }
    
    // Turrets
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = getCell(x, y);
            if (cell && cell.entity === 'turret') {
                ctx.fillStyle = '#f0f';
                ctx.fillRect(x * scale + scale/4, y * scale + scale/4, scale/2, scale/2);
            }
        }
    }
    
    // Core
    ctx.fillStyle = '#0ff';
    ctx.fillRect(CORE_POS.x * scale, CORE_POS.y * scale, scale, scale);
    
    // Enemies
    state.enemies.forEach(enemy => {
        const colors = {
            basic: '#f00', scout: '#ff0', tank: '#964B00', flyer: '#90f', boss: '#f06'
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
    
    // Viewport
    const viewportX = -state.camera.x / CELL_SIZE * scale / state.zoomLevel;
    const viewportY = -state.camera.y / CELL_SIZE * scale / state.zoomLevel;
    const viewportW = document.getElementById('gameGrid').clientWidth / CELL_SIZE * scale / state.zoomLevel;
    const viewportH = document.getElementById('gameGrid').clientHeight / CELL_SIZE * scale / state.zoomLevel;
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(viewportX, viewportY, viewportW, viewportH);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setupGrid, updateGridView, renderBuildingList, showTooltip, hideTooltip,
        selectBuilding, updateResources, setupCraftingButtons, updateCraftingButtons,
        updateObjectives, updateStats, showMessage, drawMinimap,
        showAssemblerConfig, closeAssemblerConfig
    };
}
