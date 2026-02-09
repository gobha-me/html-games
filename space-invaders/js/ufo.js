// Mystery UFO for bonus points
const UFO = {
    x: 0,
    y: 30,
    width: 40,
    height: 20,
    speed: 100,
    active: false,
    direction: 1, // 1 = right, -1 = left
    spawnTimer: 0,
    spawnInterval: 15, // seconds between UFO appearances
    points: 0,

    init() {
        this.active = false;
        this.spawnTimer = Math.random() * 10 + 5; // Random initial spawn
    },

    update(deltaTime, canvasWidth) {
        if (!this.active) {
            this.spawnTimer -= deltaTime;
            if (this.spawnTimer <= 0) {
                this.spawn(canvasWidth);
            }
            return;
        }

        // Move UFO
        this.x += this.speed * this.direction * deltaTime;

        // Deactivate if off screen
        if (this.direction === 1 && this.x > canvasWidth) {
            this.active = false;
            this.spawnTimer = this.spawnInterval + Math.random() * 10;
        } else if (this.direction === -1 && this.x < -this.width) {
            this.active = false;
            this.spawnTimer = this.spawnInterval + Math.random() * 10;
        }
    },

    spawn(canvasWidth) {
        this.active = true;
        this.direction = Math.random() < 0.5 ? 1 : -1;
        this.x = this.direction === 1 ? -this.width : canvasWidth;
        this.points = [50, 100, 150, 200, 300][Math.floor(Math.random() * 5)];
        AudioManager.playSound('ufo');
    },

    checkCollision(projectiles) {
        if (!this.active) return 0;

        for (let proj of projectiles) {
            if (!proj.active) continue;

            const bounds = this.getBounds();
            const projBounds = proj.getBounds();

            if (this.collides(projBounds, bounds)) {
                proj.active = false;
                this.active = false;
                this.spawnTimer = this.spawnInterval + Math.random() * 10;
                AudioManager.playSound('explosion');
                return this.points;
            }
        }

        return 0;
    },

    collides(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    },

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    },

    isActive() {
        return this.active;
    }
};
