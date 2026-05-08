// === UI MAP RENDERING ===
// Extracted from ui.js — SVG map rendering methods
Object.assign(GameUI.prototype, {
    renderMap() {
        const config = MAP_SIZES[this.game.gameMap.size];
        const hexSize = this.game.hexSize;

        // Calculate SVG dimensions
        const width = config.cols * hexSize * Math.sqrt(3) * 1.5 + hexSize * Math.sqrt(3);
        const height = config.rows * hexSize * 1.5 + hexSize;

        this.svg.setAttribute('width', width);
        this.svg.setAttribute('height', height);
        this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        // Clear existing
        this.svg.innerHTML = '';

        // Draw hexes
        for (const hex of this.game.gameMap.grid.getAllHexes()) {
            this._drawHex(hex);
        }

        // Draw settlements
        this._drawSettlements();

        // Draw units
        this._drawUnits();
    },

    _drawHex(hex) {
        const hexSize = this.game.hexSize;
        const pixel = hex.toPixel(hexSize);
        const x = pixel.x + hexSize * Math.sqrt(3);
        const y = pixel.y + hexSize;

        const terrain = this.game.gameMap.getTerrain(hex);
        const settlement = this.game.gameMap.getSettlement(hex);

        // Create hex polygon
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const points = this._hexPoints(x, y, hexSize - 1);
        polygon.setAttribute('points', points);
        polygon.setAttribute('fill', terrain.color);
        polygon.setAttribute('stroke', '#2a2a3a');
        polygon.setAttribute('stroke-width', '1');
        polygon.classList.add('hex');
        polygon.dataset.hexKey = hex.key();

        // Settlement overlay
        if (settlement) {
            const faction = this.game.factions.find(f => f.id === settlement.owner);
            if (faction) {
                polygon.setAttribute('fill', faction.color);
                polygon.setAttribute('opacity', '0.6');
            }
        }

        // Resource indicator
        if (this.game.gameMap.hasResource(hex)) {
            const res = this.game.gameMap.getResource(hex);
            const resType = RESOURCE_TYPES[res.type];

            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', y - 5);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '12');
            text.textContent = resType.icon;
            this.svg.appendChild(text);
        }

        // Ruins indicator
        if (this.game.gameMap.isRuins(hex)) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', y + 5);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '14');
            text.textContent = '🏛️';
            this.svg.appendChild(text);
        }

        this.svg.appendChild(polygon);
        this.hexElements.set(hex.key(), polygon);
    },

    _hexPoints(cx, cy, size) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const x = cx + size * Math.cos(angle);
            const y = cy + size * Math.sin(angle);
            points.push(`${x},${y}`);
        }
        return points.join(' ');
    },

    _drawSettlements() {
        for (const [key, settlement] of this.game.gameMap.settlements) {
            const hex = Hex.fromKey(key);
            const pixel = hex.toPixel(this.game.hexSize);
            const x = pixel.x + this.game.hexSize * Math.sqrt(3);
            const y = pixel.y + this.game.hexSize;

            const faction = this.game.factions.find(f => f.id === settlement.owner);
            if (!faction) continue;

            // Settlement marker
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', 8);
            circle.setAttribute('fill', faction.color);
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '2');
            this.svg.appendChild(circle);

            // Building indicators
            if (settlement.buildings.length > 0) {
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', x);
                text.setAttribute('y', y - 12);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-size', '10');
                text.textContent = settlement.buildings.map(b => BUILDINGS[b]?.icon || '').join('');
                this.svg.appendChild(text);
            }
        }
    },

    _drawUnits() {
        // Clear old unit elements
        this.unitElements.clear();

        for (const unit of this.game.unitManager.units) {
            const pixel = unit.hex.toPixel(this.game.hexSize);
            const x = pixel.x + this.game.hexSize * Math.sqrt(3);
            const y = pixel.y + this.game.hexSize;

            const faction = this.game.factions.find(f => f.id === unit.owner);
            if (!faction) continue;

            // Unit circle background
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', x);
            circle.setAttribute('cy', y);
            circle.setAttribute('r', 10);
            circle.setAttribute('fill', faction.color);
            circle.setAttribute('stroke', unit.owner === this.game.playerFaction.id ? '#fff' : '#666');
            circle.setAttribute('stroke-width', unit.owner === this.game.playerFaction.id ? '2' : '1');
            circle.setAttribute('opacity', '0.8');

            if (unit.hasMoved) circle.setAttribute('opacity', '0.5');

            this.svg.appendChild(circle);

            // Unit icon
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', y + 4);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '12');
            text.textContent = unit.icon;
            this.svg.appendChild(text);

            // HP bar
            if (unit.hp < unit.maxHp) {
                const barWidth = 16;
                const hpPercent = unit.hp / unit.maxHp;

                const bgBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bgBar.setAttribute('x', x - barWidth / 2);
                bgBar.setAttribute('y', y + 12);
                bgBar.setAttribute('width', barWidth);
                bgBar.setAttribute('height', 3);
                bgBar.setAttribute('fill', '#333');
                this.svg.appendChild(bgBar);

                const hpBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                hpBar.setAttribute('x', x - barWidth / 2);
                hpBar.setAttribute('y', y + 12);
                hpBar.setAttribute('width', barWidth * hpPercent);
                hpBar.setAttribute('height', 3);
                hpBar.setAttribute('fill', hpPercent > 0.5 ? '#0f0' : hpPercent > 0.25 ? '#ff0' : '#f00');
                this.svg.appendChild(hpBar);
            }

            this.unitElements.set(unit.id, { circle, text });
        }
    },
});
