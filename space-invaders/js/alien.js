// Individual Alien class
class Alien {
    constructor(x, y, row, col, type) {
        this.x = x;
        this.y = y;
        this.row = row;
        this.col = col;
        this.type = type; // 0 = top (30pts), 1 = middle (20pts), 2 = bottom (10pts)
        this.width = 32;
        this.height = 24;
        this.active = true;
        this.animFrame = 0;
    }

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    }

    getPoints() {
        return [30, 20, 10][this.type] || 10;
    }
}

// Alien Formation Manager
const AlienManager = {
    aliens: [],
    direction: 1, // 1 = right, -1 = left
    speed: 30,
    baseSpeed: 30,
    dropDistance: 20,
    moveTimer: 0,
    moveInterval: 1.0, // seconds between moves
    shootTimer: 0,
    shootInterval: 2.0, // seconds between alien shots
    rows: 5,
    cols: 11,
    spacing: 45,
    offsetX: 50,
    offsetY: 80,

    init(wave = 1) {
        this.aliens = [];
        this.direction = 1;
        this.moveTimer = 0;
        this.shootTimer = 0;
        
        // Increase difficulty with waves
        this.baseSpeed = 30 + (wave - 1) * 5;
        this.speed = this.baseSpeed;
        this.moveInterval = Math.max(0.5, 1.0 - (wave - 1) * 0.05);
        this.shootInterval = Math.max(1.0, 2.0 - (wave - 1) * 0.1);

        // Create alien formation
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const x = this.offsetX + col * this.spacing;
                const y = this.offsetY + row * this.spacing;
                const type = row < 1 ? 0 : (row < 3 ? 1 : 2);
                this.aliens.push(new Alien(x, y, row, col, type));
            }
        }
    },

    update(deltaTime, canvasWidth, canvasHeight) {
        if (this.aliens.length === 0) return;

        this.moveTimer += deltaTime;
        this.shootTimer += deltaTime;

        // Move aliens
        if (this.moveTimer >= this.moveInterval) {
            this.moveTimer = 0;
            this.moveAliens(canvasWidth);
            AudioManager.playSound('alienMove');

            // Speed up as aliens are destroyed
            const remaining = this.aliens.filter(a => a.active).length;
            const total = this.rows * this.cols;
            const speedMultiplier = 1 + (1 - remaining / total) * 2;
            this.speed = this.baseSpeed * speedMultiplier;
        }

        // Random alien shooting
        if (this.shootTimer >= this.shootInterval) {
            this.shootTimer = 0;
            this.alienShoot();
        }

        // Update animation frames
        this.aliens.forEach(alien => {
            if (alien.active) {
                alien.animFrame = (alien.animFrame + deltaTime * 2) % 2;
            }
        });
    },

    moveAliens(canvasWidth) {
        let shouldDrop = false;

        // Check if any alien hit the edge
        this.aliens.forEach(alien => {
            if (!alien.active) return;
            
            const nextX = alien.x + this.direction * this.speed;
            if (nextX < 10 || nextX + alien.width > canvasWidth - 10) {
                shouldDrop = true;
            }
        });

        if (shouldDrop) {
            // Drop down and reverse direction
            this.aliens.forEach(alien => {
                if (alien.active) {
                    alien.y += this.dropDistance;
                }
            });
            this.direction *= -1;
        } else {
            // Move horizontally
            this.aliens.forEach(alien => {
                if (alien.active) {
                    alien.x += this.direction * this.speed;
                }
            });
        }
    },

    alienShoot() {
        // Get bottom-most aliens in each column
        const activeAliens = this.aliens.filter(a => a.active);
        if (activeAliens.length === 0) return;

        const columns = {};
        activeAliens.forEach(alien => {
            if (!columns[alien.col] || alien.y > columns[alien.col].y) {
                columns[alien.col] = alien;
            }
        });

        const shooters = Object.values(columns);
        if (shooters.length === 0) return;

        // Random shooter
        const shooter = shooters[Math.floor(Math.random() * shooters.length)];
        const bulletX = shooter.x + shooter.width / 2 - 2;
        const bulletY = shooter.y + shooter.height;
        ProjectileManager.add(bulletX, bulletY, 200, 'alien');
    },

    checkCollisions(projectiles) {
        let score = 0;
        
        projectiles.forEach(proj => {
            if (!proj.active) return;

            this.aliens.forEach(alien => {
                if (!alien.active) return;

                if (this.checkCollision(proj.getBounds(), alien.getBounds())) {
                    alien.active = false;
                    proj.active = false;
                    score += alien.getPoints();
                    AudioManager.playSound('explosion');
                }
            });
        });

        // Remove inactive aliens
        this.aliens = this.aliens.filter(a => a.active);
        
        return score;
    },

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    },

    getLowestAlienY() {
        let maxY = 0;
        this.aliens.forEach(alien => {
            if (alien.active && alien.y > maxY) {
                maxY = alien.y;
            }
        });
        return maxY;
    },

    hasReachedBottom(canvasHeight) {
        return this.getLowestAlienY() + 24 >= canvasHeight - 60;
    },

    allDestroyed() {
        return this.aliens.length === 0;
    },

    getActiveCount() {
        return this.aliens.filter(a => a.active).length;
    }
};
