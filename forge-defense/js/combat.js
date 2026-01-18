/**
 * Forge Defense - Combat System
 */

function updateTurrets() {
    const now = Date.now();

    gameState.buildings.forEach(building => {
        const def = BUILDINGS[building.type];
        if (!def.combat) return;

        if (now - building.lastFire < def.combat.fireRate) return;

        // Check ammo
        if (def.combat.ammoUse > 0) {
            const ammoType = def.combat.usesShells ? 'shells' : 'ammo';
            if (gameState.resources[ammoType] < def.combat.ammoUse) return;
        }

        // Find target in range
        const bx = building.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        const by = building.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
        const range = def.combat.range * CONFIG.TILE_SIZE;

        let target = null;
        let minDist = Infinity;

        gameState.enemies.forEach(enemy => {
            const dist = Math.hypot(enemy.x - bx, enemy.y - by);
            if (dist < range && dist < minDist) {
                minDist = dist;
                target = enemy;
            }
        });

        if (target) {
            // Consume ammo
            if (def.combat.ammoUse > 0) {
                const ammoType = def.combat.usesShells ? 'shells' : 'ammo';
                gameState.resources[ammoType] -= def.combat.ammoUse;
            }

            building.lastFire = now;
            fireProjectile(building, target, def.combat);
            AudioSystem.playTurretFire();
        }
    });
}

function fireProjectile(building, target, combat) {
    const bx = building.x * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;
    const by = building.y * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2;

    const projectile = {
        id: Date.now() + Math.random(),
        x: bx,
        y: by,
        targetId: target.id,
        damage: combat.damage,
        splash: combat.splash || 0,
        speed: combat.usesShells ? 8 : 15,
        isArtillery: !!combat.usesShells
    };

    gameState.projectiles.push(projectile);
    renderProjectile(projectile);
}

function renderProjectile(proj) {
    const el = document.createElement('div');
    el.className = 'projectile' + (proj.isArtillery ? ' artillery' : '');
    el.dataset.projId = proj.id;
    el.style.left = proj.x + 'px';
    el.style.top = proj.y + 'px';
    world.appendChild(el);
}

function updateProjectiles() {
    gameState.projectiles = gameState.projectiles.filter(proj => {
        const target = gameState.enemies.find(e => e.id === proj.targetId);
        if (!target) {
            document.querySelector(`[data-proj-id="${proj.id}"]`)?.remove();
            return false;
        }

        const dx = target.x - proj.x;
        const dy = target.y - proj.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 15) {
            // Hit!
            createExplosion(proj.x, proj.y, proj.isArtillery ? 40 : 20);

            if (proj.splash > 0) {
                // Splash damage
                gameState.enemies.forEach(e => {
                    const eDist = Math.hypot(e.x - proj.x, e.y - proj.y);
                    if (eDist < proj.splash * CONFIG.TILE_SIZE) {
                        damageEnemy(e, proj.damage * (1 - eDist / (proj.splash * CONFIG.TILE_SIZE)));
                    }
                });
            } else {
                damageEnemy(target, proj.damage);
            }

            document.querySelector(`[data-proj-id="${proj.id}"]`)?.remove();
            return false;
        }

        // Move projectile
        proj.x += (dx / dist) * proj.speed;
        proj.y += (dy / dist) * proj.speed;

        const el = document.querySelector(`[data-proj-id="${proj.id}"]`);
        if (el) {
            el.style.left = proj.x + 'px';
            el.style.top = proj.y + 'px';
        }

        return true;
    });
}
