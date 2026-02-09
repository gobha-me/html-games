// Player ship class
const Player = {
    x: 0,
    y: 0,
    width: 40,
    height: 30,
    speed: 300,
    lives: 3,
    canShoot: true,
    shootCooldown: 0,
    shootCooldownTime: 0.5, // seconds
    invulnerable: false,
    invulnerableTime: 0,
    invulnerableDuration: 2, // seconds after being hit

    init(canvasWidth, canvasHeight) {
        this.x = canvasWidth / 2 - this.width / 2;
        this.y = canvasHeight - this.height - 20;
        this.lives = 3;
        this.canShoot = true;
        this.shootCooldown = 0;
        this.invulnerable = false;
        this.invulnerableTime = 0;
    },

    update(deltaTime, canvasWidth) {
        // Update shoot cooldown
        if (!this.canShoot) {
            this.shootCooldown -= deltaTime;
            if (this.shootCooldown <= 0) {
                this.canShoot = true;
            }
        }

        // Update invulnerability
        if (this.invulnerable) {
            this.invulnerableTime -= deltaTime;
            if (this.invulnerableTime <= 0) {
                this.invulnerable = false;
            }
        }

        // Keep player in bounds
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvasWidth) {
            this.x = canvasWidth - this.width;
        }
    },

    moveLeft(deltaTime) {
        this.x -= this.speed * deltaTime;
    },

    moveRight(deltaTime) {
        this.x += this.speed * deltaTime;
    },

    shoot() {
        if (this.canShoot) {
            const bulletX = this.x + this.width / 2 - 2;
            const bulletY = this.y;
            ProjectileManager.add(bulletX, bulletY, -400, 'player');
            AudioManager.playSound('shoot');
            
            this.canShoot = false;
            this.shootCooldown = this.shootCooldownTime;
            return true;
        }
        return false;
    },

    hit() {
        if (this.invulnerable) return false;

        this.lives--;
        AudioManager.playSound('playerHit');
        
        if (this.lives > 0) {
            this.invulnerable = true;
            this.invulnerableTime = this.invulnerableDuration;
        }
        
        return true;
    },

    getBounds() {
        return {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height
        };
    },

    isAlive() {
        return this.lives > 0;
    }
};
