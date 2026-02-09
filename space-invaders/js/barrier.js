// Barrier/Shield class
class Barrier {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 60;
        this.height = 40;
        this.health = 100;
        this.maxHealth = 100;
        this.active = true;
        
        // Create damage map for visual erosion
        this.damageMap = [];
        for (let i = 0; i < 20; i++) {
            this.damageMap.push([]);
            for (let j = 0; j < 20; j++) {
                this.damageMap[i].push(true);
            }
        }
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    takeDamage(hitX, hitY, amount = 10) {
        this.health -= amount;
        
        // Create erosion effect around hit point
        const localX = Math.floor((hitX - this.x) / this.width * 20);
        const localY = Math.floor((hitY - this.y) / this.height * 20);
        
        for (let i = -2; i <= 2; i++) {
            for (let j = -2; j <= 2; j++) {
                const x = localX + i;
                const y = localY + j;
                if (x >= 0 && x < 20 && y >= 0 && y < 20) {
                    if (Math.random() < 0.7) {
                        this.damageMap[y][x] = false;
                    }
                }
            }
        }

        if (this.health <= 0) {
            this.active = false;
        }
    }

    isActive() {
        return this.active && this.health > 0;
    }
}

// Barrier Manager
const BarrierManager = {
    barriers: [],

    init(canvasWidth, canvasHeight) {
        this.barriers = [];
        const barrierY = canvasHeight - 150;
        const spacing = canvasWidth / 5;
        
        for (let i = 0; i < 4; i++) {
            const x = spacing * (i + 1) - 30;
            this.barriers.push(new Barrier(x, barrierY));
        }
    },

    checkCollisions(projectiles) {
        projectiles.forEach(proj => {
            if (!proj.active) return;

            this.barriers.forEach(barrier => {
                if (!barrier.isActive()) return;

                const bounds = barrier.getBounds();
                const projBounds = proj.getBounds();

                if (this.checkCollision(projBounds, bounds)) {
                    barrier.takeDamage(proj.x, proj.y);
                    proj.active = false;
                }
            });
        });

        // Remove destroyed barriers
        this.barriers = this.barriers.filter(b => b.isActive());
    },

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    },

    clear() {
        this.barriers = [];
    }
};
