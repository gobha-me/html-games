/**
 * Turrets Module
 * Targeting, firing, projectiles
 */

// Use constants from constants.js (TURRET_RANGE and TURRET_FIRE_RATE)
// These are defined in constants.js and exported to window by the main game

function findEnemyInRange(x, y, range) {
    // Use TURRET_RANGE from constants.js if range not specified
    const effectiveRange = range || TURRET_RANGE;
    const enemies = getEnemies();
    return enemies.find(e => {
        const dx = e.x - x, dy = e.y - y;
        return Math.sqrt(dx*dx + dy*dy) <= effectiveRange;
    });
}

function processTurrets() {
    const state = getGameState();
    const now = Date.now();
    
    for (let y = 0; y < GRID_SIZE; y++) {
        for (let x = 0; x < GRID_SIZE; x++) {
            const cell = getCell(x, y);
            if (!cell || cell.entity !== 'turret') continue;
            
            // Check ammo and fire rate
            if (state.resources.ammo <= 0) continue;
            if (cell.lastProduced + TURRET_FIRE_RATE > now) continue;
            
            // Find target
            const target = findEnemyInRange(x, y);
            if (target) {
                fireTurret(x, y, target);
                state.resources.ammo--;
                cell.lastProduced = now;
            }
        }
    }
}

function fireTurret(x, y, target) {
    // Visual feedback
    const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"] .building`);
    if (cell) cell.classList.add('firing');
    setTimeout(() => cell?.classList.remove('firing'), 200);
    
    // Play sound
    AudioSystem?.playTurretFire();
    
    // Create projectile
    const projectile = document.createElement('div');
    projectile.className = 'projectile';
    
    const state = getGameState();
    const startX = x * CELL_SIZE * state.zoomLevel + 14 * state.zoomLevel;
    const startY = y * CELL_SIZE * state.zoomLevel + 14 * state.zoomLevel;
    
    projectile.style.left = startX + 'px';
    projectile.style.top = startY + 'px';
    document.getElementById('grid').appendChild(projectile);
    
    // Calculate trajectory
    const dx = target.x - x, dy = target.y - y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    projectile.style.transition = `all ${distance * 30}ms linear`;
    projectile.style.left = (target.x * CELL_SIZE * state.zoomLevel + 14 * state.zoomLevel) + 'px';
    projectile.style.top = (target.y * CELL_SIZE * state.zoomLevel + 14 * state.zoomLevel) + 'px';
    
    // Hit detection
    setTimeout(() => {
        projectile.remove();
        target.health -= 50;
        
        if (target.health <= 0) {
            killEnemy(target);
        } else {
            AudioSystem?.playEnemyHit();
        }
    }, distance * 30);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        findEnemyInRange, processTurrets, fireTurret
    };
}

// Also expose globally for non-module usage
window.Turrets = {
    findEnemyInRange,
    processTurrets,
    fireTurret
};
