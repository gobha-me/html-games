// Canvas Renderer
const Renderer = {
    canvas: null,
    ctx: null,
    width: 800,
    height: 600,

    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas size
        this.canvas.width = this.width;
        this.canvas.height = this.height;
    },

    clear() {
        this.ctx.fillStyle = '#0a0a15';
        this.ctx.fillRect(0, 0, this.width, this.height);
    },

    render() {
        this.clear();
        
        // Render in layers
        this.renderStars();
        this.renderBarriers();
        this.renderPlayers();
        this.renderAliens();
        this.renderProjectiles();
        this.renderUFO();
    },

    renderStars() {
        // Simple starfield background
        this.ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 50; i++) {
            const x = (i * 137) % this.width;
            const y = (i * 179) % this.height;
            const size = (i % 3) * 0.5 + 0.5;
            this.ctx.fillRect(x, y, size, size);
        }
    },

    renderPlayers() {
        const players = PlayerManager.getAllPlayers();
        for (const player of players) {
            this.renderPlayerShip(player);
        }
    },

    renderPlayerShip(player) {
        if (!player.isAlive()) return;

        const { x, y, width, height } = player;
        
        // Flashing effect when invulnerable
        if (player.invulnerable && Math.floor(Date.now() / 100) % 2 === 0) {
            return;
        }

        this.ctx.save();
        
        // P1 = cyan, P2 = red-orange
        const color = player.index === 1 ? '#00d4ff' : '#ff6b6b';
        this.ctx.fillStyle = color;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = color;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x + width / 2, y);
        this.ctx.lineTo(x, y + height);
        this.ctx.lineTo(x + width, y + height);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Cockpit
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(x + width / 2 - 3, y + 10, 6, 8);
        
        this.ctx.restore();
    },

    renderPlayer() {
        // Backward compatibility — delegates to renderPlayers
        this.renderPlayers();
    },
    renderAliens() {
        AlienManager.aliens.forEach(alien => {
            if (!alien.active) return;

            const { x, y, width, height, type, animFrame } = alien;
            
            // Different colors for different alien types
            const colors = ['#ff00ff', '#00ff00', '#ffff00'];
            this.ctx.fillStyle = colors[type];
            this.ctx.shadowBlur = 5;
            this.ctx.shadowColor = colors[type];

            // Simple alien shape with animation
            const frame = Math.floor(animFrame);
            
            // Body
            this.ctx.fillRect(x + 8, y + 8, width - 16, height - 16);
            
            // Eyes
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(x + 12, y + 12, 4, 4);
            this.ctx.fillRect(x + width - 16, y + 12, 4, 4);
            
            // Tentacles (animated)
            this.ctx.fillStyle = colors[type];
            if (frame === 0) {
                this.ctx.fillRect(x + 4, y + height - 4, 4, 4);
                this.ctx.fillRect(x + width - 8, y + height - 4, 4, 4);
            } else {
                this.ctx.fillRect(x, y + height - 4, 4, 4);
                this.ctx.fillRect(x + width - 4, y + height - 4, 4, 4);
            }
            
            this.ctx.shadowBlur = 0;
        });
    },

    renderProjectiles() {
        ProjectileManager.projectiles.forEach(proj => {
            if (!proj.active) return;

            const { x, y, width, height, type } = proj;
            
            if (type === 'player') {
                this.ctx.fillStyle = '#00d4ff';
                this.ctx.shadowBlur = 8;
                this.ctx.shadowColor = '#00d4ff';
            } else {
                this.ctx.fillStyle = '#ff0000';
                this.ctx.shadowBlur = 8;
                this.ctx.shadowColor = '#ff0000';
            }
            
            this.ctx.fillRect(x, y, width, height);
            this.ctx.shadowBlur = 0;
        });
    },

    renderBarriers() {
        BarrierManager.barriers.forEach(barrier => {
            if (!barrier.isActive()) return;

            const { x, y, width, height, damageMap } = barrier;
            const cellWidth = width / 20;
            const cellHeight = height / 20;
            
            this.ctx.fillStyle = '#00ff00';
            
            for (let i = 0; i < 20; i++) {
                for (let j = 0; j < 20; j++) {
                    if (damageMap[i][j]) {
                        this.ctx.fillRect(
                            x + j * cellWidth,
                            y + i * cellHeight,
                            cellWidth,
                            cellHeight
                        );
                    }
                }
            }
        });
    },

    renderUFO() {
        if (!UFO.isActive()) return;

        const { x, y, width, height } = UFO;
        
        this.ctx.save();
        this.ctx.fillStyle = '#ff0000';
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#ff0000';
        
        // UFO body - ellipse
        this.ctx.beginPath();
        this.ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Dome
        this.ctx.fillStyle = '#ffff00';
        this.ctx.beginPath();
        this.ctx.ellipse(x + width / 2, y + height / 3, width / 4, height / 3, 0, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Points indicator
        this.ctx.shadowBlur = 0;
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 12px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(UFO.points + '', x + width / 2, y - 5);
        
        this.ctx.restore();
    }
};
