/**
 * Forge Defense - UI System
 */

function updateUI() {
    // Update resource counts
    Object.entries(gameState.resources).forEach(([key, value]) => {
        const el = document.getElementById(key);
        if (el) el.textContent = Math.floor(value);
    });

    // Update building affordability
    document.querySelectorAll('.building-item').forEach(item => {
        const type = item.dataset.building;
        const def = BUILDINGS[type];
        if (def && def.cost) {
            item.classList.toggle('disabled', !canAfford(def.cost));
        }
    });

    // Update stats
    document.getElementById('stat-buildings').textContent = gameState.buildings.length;
    document.getElementById('stat-kills').textContent = gameState.totalKills;
}

function updateGameStats() {
    const mins = Math.floor(gameState.gameTime / 60000);
    const secs = Math.floor((gameState.gameTime % 60000) / 1000);
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    
    document.getElementById('stat-time').textContent = timeStr;
    document.getElementById('game-time').textContent = timeStr;
}

function showNotification(text) {
    const el = document.getElementById('notification');
    el.textContent = text;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 3000);
}

function gameOver() {
    gameState.isGameOver = true;
    AudioSystem.playGameOver();
    document.getElementById('defeat-wave').textContent = gameState.wave;
    document.getElementById('defeat-stats').textContent = 
        `Kills: ${gameState.totalKills} | Time: ${formatTime(gameState.gameTime)}`;
    document.getElementById('defeat-screen').style.display = 'flex';
}

function continueGame() {
    document.getElementById('victory-screen').style.display = 'none';
}

function checkObjectives() {
    // Check turrets objective
    const turretCount = gameState.buildings.filter(b => 
        b.type === 'turret' || b.type === 'laser-turret' || b.type === 'artillery'
    ).length;
    
    const obj1 = document.getElementById('obj-turrets');
    obj1.textContent = `${turretCount >= 5 ? '✅' : '⚪'} Build 5 turrets (${turretCount}/5)`;
    obj1.classList.toggle('complete', turretCount >= 5);
    gameState.objectives.turrets = turretCount >= 5;

    // Check waves objective
    const obj2 = document.getElementById('obj-waves');
    const waveProgress = Math.min(gameState.wave - 1, 10);
    obj2.textContent = `${waveProgress >= 10 ? '✅' : '⚪'} Survive 10 waves (${waveProgress}/10)`;
    obj2.classList.toggle('complete', waveProgress >= 10);
    gameState.objectives.waves = waveProgress >= 10;

    // Check resources objective
    const totalResources = Object.values(gameState.resources).reduce((a, b) => a + b, 0);
    const obj3 = document.getElementById('obj-resources');
    obj3.textContent = `${totalResources >= 500 ? '✅' : '⚪'} Stockpile 500 resources (${Math.floor(totalResources)}/500)`;
    obj3.classList.toggle('complete', totalResources >= 500);
    gameState.objectives.resources = totalResources >= 500;

    // Check victory objective
    const obj4 = document.getElementById('obj-victory');
    obj4.textContent = `${gameState.objectives.victory ? '✅' : '⚪'} Reach wave 50`;
    obj4.classList.toggle('complete', gameState.objectives.victory);
}

// Manual crafting
function manualCraft(item) {
    const recipe = CRAFT_RECIPES[item];
    if (!recipe) return;
    
    const now = Date.now();
    
    // Check cooldown
    if (gameState.crafting.active && now < gameState.crafting.endTime) {
        showNotification('⏳ Crafting in progress...');
        return;
    }
    
    // Check resources
    for (const [res, cost] of Object.entries(recipe.cost)) {
        if (gameState.resources[res] < cost) {
            showNotification(`❌ Not enough ${res}!`);
            return;
        }
    }
    
    // Deduct resources
    for (const [res, cost] of Object.entries(recipe.cost)) {
        gameState.resources[res] -= cost;
    }
    
    gameState.crafting.active = item;
    gameState.crafting.endTime = now + recipe.time;
    
    showNotification(`🔨 Crafting ${recipe.name}...`);
    updateUI();
    
    setTimeout(() => {
        gameState.resources[item] += recipe.output;
        gameState.crafting.active = null;
        showNotification(`✅ +${recipe.output} ${recipe.name}`);
        updateUI();
        AudioSystem.playBuildingPlace();
    }, recipe.time);
}

window.manualCraft = manualCraft;

// Construction popup menu functions
function openConstructionPopup(buildingId) {
    const building = gameState.buildings.find(b => b.id === buildingId);
    if (!building) return;
    
    const options = CONSTRUCTION_OPTIONS[building.type];
    if (!options || !options.options.length) return;
    
    gameState.selectedPopupBuilding = buildingId;
    
    const popup = document.getElementById('construction-popup');
    const popupTitle = document.getElementById('popup-title');
    const popupOptions = document.getElementById('popup-options');
    
    popupTitle.textContent = options.name;
    popupOptions.innerHTML = '';
    
    options.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'popup-btn';
        btn.innerHTML = `${opt.name} <small>${formatOptionCost(opt.cost)}</small>`;
        btn.onclick = () => selectConstructionOption(buildingId, opt);
        popupOptions.appendChild(btn);
    });
    
    popup.style.display = 'flex';
}

function closeConstructionPopup() {
    document.getElementById('construction-popup').style.display = 'none';
    gameState.selectedPopupBuilding = null;
}

function selectConstructionOption(buildingId, option) {
    const building = gameState.buildings.find(b => b.id === buildingId);
    if (!building) return;
    
    building.productionOutput = option.output;
    building.productionCost = option.cost;
    
    closeConstructionPopup();
    showNotification(`✅ ${option.name} selected`);
}

function formatOptionCost(cost) {
    if (!cost) return 'Free';
    return Object.entries(cost).map(([res, amt]) => {
        const icons = {
            'iron-plates': '▬', 'copper-plates': '▬', stone: '◐', 
            circuits: '◈', coal: '■', 'iron-ore': '⚫', 'copper-ore': '🟠'
        };
        return `${amt}${icons[res] || res.charAt(0)}`;
    }).join(' ');
}

// Forge popup functions
function openForgePopup(buildingId) {
    gameState.selectedPopupBuilding = buildingId;
    document.getElementById('forge-popup').style.display = 'flex';
}

function closeForgePopup() {
    document.getElementById('forge-popup').style.display = 'none';
}

function setForgeOutput(type) {
    // Find selected furnace
    const furnace = gameState.buildings.find(b => 
        b.type === 'furnace' && b.id === gameState.selectedPopupBuilding
    );
    
    if (furnace) {
        furnace.productionType = type;
        showNotification(`✅ Now producing ${type === 'iron' ? 'Iron' : 'Copper'} Plates`);
    } else {
        showNotification('❌ Furnace not found');
    }
    
    closeForgePopup();
}
