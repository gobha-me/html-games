// === UI INPUT HANDLING ===
// Extracted from ui.js — mouse/keyboard interaction methods
Object.assign(GameUI.prototype, {
    _initInput() {
        this.isDragging = false;
        this.dragStart = null;

        this.svg.addEventListener('click', (e) => this._handleClick(e));
        this.svg.addEventListener('mousedown', (e) => this._handleDragStart(e));
        window.addEventListener('mouseup', () => this._handleDragEnd());
        window.addEventListener('mousemove', (e) => this._handleMouseMove(e));
        this.svg.addEventListener('wheel', (e) => this._handleZoom(e), { passive: false });
    },

    _handleClick(e) {
        if (this.game.gameOver || this.game.phase !== PHASES.PLANNING) return;

        const rect = this.svg.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hex = Hex.fromPixel(x - this.game.hexSize * Math.sqrt(3), y - this.game.hexSize, this.game.hexSize);

        if (!this.game.gameMap.grid.hasHex(hex.q, hex.r)) return;

        // Check if clicking on a unit
        const unitsOnHex = this.game.unitManager.getUnitsOnHex(hex);
        const playerUnits = unitsOnHex.filter(u => u.owner === this.game.playerFaction.id);

        if (this.game.selectedUnit && !this.game.selectedUnit.hasAttacked) {
            // Try to attack
            const enemies = unitsOnHex.filter(u => u.owner !== this.game.playerFaction.id);
            if (enemies.length > 0 && this.game.selectedUnit.hex.distance(hex) <= this.game.selectedUnit.range) {
                this.game.attackUnit(this.game.selectedUnit, enemies[0]);
                this.update();
                return;
            }
        }

        if (playerUnits.length > 0) {
            this.game.selectUnit(playerUnits[0]);
        } else {
            this.game.selectHex(hex);
        }

        this.update();
    },

    _handleMouseMove(e) {
        if (this.isDragging) {
            const dx = e.clientX - this.dragStart.x;
            const dy = e.clientY - this.dragStart.y;
            this.camera.x += dx;
            this.camera.y += dy;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this._applyCamera();
        }
    },

    _handleZoom(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.camera.zoom = Math.max(0.5, Math.min(2, this.camera.zoom * delta));
        this._applyCamera();
    },

    _handleDragStart(e) {
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
        }
    },

    _handleDragEnd() {
        this.isDragging = false;
    },

    _applyCamera() {
        this.svg.style.transform = `translate(${this.camera.x}px, ${this.camera.y}px) scale(${this.camera.zoom})`;
    },
});
