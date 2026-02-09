// Projectile class for player and alien bullets
class Projectile {
    constructor(x, y, velocityY, type = 'player') {
        this.x = x;
        this.y = y;
        this.velocityY = velocityY;
        this.type = type; // 'player' or 'alien'
        this.width = 4;
        this.height = type === 'player' ? 12 : 8;
        this.active = true;
    }

    update(deltaTime) {
        this.y += this.velocityY * deltaTime;
    }

    isOffScreen(canvasHeight) {
        return this.y < 0 || this.y > canvasHeight;
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }
}

// Projectile Manager
const ProjectileManager = {
    projectiles: [],

    add(x, y, velocityY, type) {
        this.projectiles.push(new Projectile(x, y, velocityY, type));
    },

    update(deltaTime, canvasHeight) {
        // Update all projectiles
        this.projectiles.forEach(proj => {
            if (proj.active) {
                proj.update(deltaTime);
                
                // Deactivate if off screen
                if (proj.isOffScreen(canvasHeight)) {
                    proj.active = false;
                }
            }
        });

        // Remove inactive projectiles
        this.projectiles = this.projectiles.filter(proj => proj.active);
    },

    getPlayerProjectiles() {
        return this.projectiles.filter(proj => proj.type === 'player' && proj.active);
    },

    getAlienProjectiles() {
        return this.projectiles.filter(proj => proj.type === 'alien' && proj.active);
    },

    clear() {
        this.projectiles = [];
    },

    remove(projectile) {
        projectile.active = false;
    }
};
