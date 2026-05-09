// Player ship factory — creates a player object for P1 or P2
function createPlayer(index) {
    return {
        index: index, // 1 or 2
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
        alive: true,

        init(canvasWidth, canvasHeight) {
            // P1 on left side, P2 on right side
            const offset = this.index === 1 ? 0.3 : 0.7;
            this.x = canvasWidth * offset - this.width / 2;
            this.y = canvasHeight - this.height - 20;
            this.lives = 3;
            this.canShoot = true;
            this.shootCooldown = 0;
            this.invulnerable = false;
            this.invulnerableTime = 0;
            this.alive = true;
        },

        update(deltaTime, canvasWidth) {
            if (!this.alive) return;

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
            if (!this.alive) return;
            this.x -= this.speed * deltaTime;
        },

        moveRight(deltaTime) {
            if (!this.alive) return;
            this.x += this.speed * deltaTime;
        },

        shoot() {
            if (!this.alive || !this.canShoot) return false;

            const bulletX = this.x + this.width / 2 - 2;
            const bulletY = this.y;
            ProjectileManager.add(bulletX, bulletY, -400, 'player');
            AudioManager.playSound('shoot');

            this.canShoot = false;
            this.shootCooldown = this.shootCooldownTime;
            return true;
        },

        hit() {
            if (!this.alive || this.invulnerable) return false;

            this.lives--;
            AudioManager.playSound('playerHit');

            if (this.lives <= 0) {
                this.alive = false;
            } else {
                this.invulnerable = true;
                this.invulnerableTime = this.invulnerableDuration;
            }

            return true;
        },

        getBounds() {
            if (!this.alive) return null;
            return {
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height
            };
        },

        isAlive() {
            return this.alive;
        }
    };
}

// Player Manager — handles both players
const PlayerManager = {
    player1: null,
    player2: null,
    mode: '1p', // '1p' or '2p'

    init(canvasWidth, canvasHeight, mode) {
        this.mode = mode;
        this.player1 = createPlayer(1);
        this.player1.init(canvasWidth, canvasHeight);

        if (mode === '2p') {
            this.player2 = createPlayer(2);
            this.player2.init(canvasWidth, canvasHeight);
        } else {
            this.player2 = null;
        }
    },

    update(deltaTime, canvasWidth) {
        this.player1.update(deltaTime, canvasWidth);
        if (this.player2) {
            this.player2.update(deltaTime, canvasWidth);
        }
    },

    getPlayers() {
        const players = [this.player1];
        if (this.player2) players.push(this.player2);
        return players.filter(p => p.isAlive());
    },

    getAllPlayers() {
        const players = [this.player1];
        if (this.player2) players.push(this.player2);
        return players;
    },

    getP1() {
        return this.player1;
    },

    getP2() {
        return this.player2;
    },

    checkPlayerCollisions(alienProjectiles) {
        const players = this.getAllPlayers();
        let hit = false;
        for (const player of players) {
            if (!player.isAlive()) continue;
            const playerBounds = player.getBounds();
            if (!playerBounds) continue;

            for (const proj of alienProjectiles) {
                if (this._intersects(playerBounds, proj.getBounds())) {
                    ProjectileManager.remove(proj);
                    if (player.hit()) {
                        hit = true;
                    }
                }
            }
        }
        return hit;
    },

    allDead() {
        const players = this.getAllPlayers();
        return players.every(p => !p.isAlive());
    },

    anyAlive() {
        return this.getAllPlayers().some(p => p.isAlive());
    },

    _intersects(a, b) {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    }
};

// Backward compatibility: alias Player to PlayerManager.player1
// Code that references Player.lives, Player.x, etc. still works for 1P mode
const Player = new Proxy({}, {
    get(target, prop) {
        const p1 = PlayerManager.getP1();
        if (!p1) return undefined;
        const val = p1[prop];
        if (typeof val === 'function') {
            return val.bind(p1);
        }
        return val;
    },
    set(target, prop, value) {
        const p1 = PlayerManager.getP1();
        if (p1) p1[prop] = value;
        return true;
    }
});