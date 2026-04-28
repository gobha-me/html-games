// === UI RENDERING ===
class GameUI {
    constructor(game) {
        this.game = game;
        this.svg = document.getElementById('hex-map');
        this.hexElements = new Map();
        this.unitElements = new Map();
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.hoveredHex = null;
        this.highlightedHexes = [];

        this._setupEventListeners();
    }

    _setupEventListeners() {
        // SVG interactions
        this.svg.addEventListener('click', (e) => this._handleClick(e));
        this.svg.addEventListener('mousemove', (e) => this._handleMouseMove(e));
        this.svg.addEventListener('wheel', (e) => this._handleZoom(e));
        this.svg.addEventListener('mousedown', (e) => this._handleDragStart(e));
        this.svg.addEventListener('mouseup', () => this._handleDragEnd());
        this.svg.addEventListener('mouseleave', () => this._handleDragEnd());

        // End turn button
        document.getElementById('end-turn-btn').addEventListener('click', () => {
            this.game.endPlayerTurn();
            this.update();
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
                this.updateSidePanel(btn.dataset.tab);
            });
        });

        // Play again
        document.getElementById('play-again-btn').addEventListener('click', () => {
            location.reload();
        });
    }

    // === RENDERING ===
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
    }

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
    }

    _hexPoints(cx, cy, size) {
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i - Math.PI / 6;
            const x = cx + size * Math.cos(angle);
            const y = cy + size * Math.sin(angle);
            points.push(`${x},${y}`);
        }
        return points.join(' ');
    }

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
    }

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
    }

    // === INTERACTION ===
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
    }

    _handleMouseMove(e) {
        if (this.isDragging) {
            const dx = e.clientX - this.dragStart.x;
            const dy = e.clientY - this.dragStart.y;
            this.camera.x += dx;
            this.camera.y += dy;
            this.dragStart = { x: e.clientX, y: e.clientY };
            this._applyCamera();
        }
    }

    _handleZoom(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.camera.zoom = Math.max(0.5, Math.min(2, this.camera.zoom * delta));
        this._applyCamera();
    }

    _handleDragStart(e) {
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
            this.isDragging = true;
            this.dragStart = { x: e.clientX, y: e.clientY };
        }
    }

    _handleDragEnd() {
        this.isDragging = false;
    }

    _applyCamera() {
        this.svg.style.transform = `translate(${this.camera.x}px, ${this.camera.y}px) scale(${this.camera.zoom})`;
    }

    // === UPDATE ===
    update() {
        if (this.game.gameOver) {
            this._showVictoryScreen();
            return;
        }

        // Update top bar
        this._updateTopBar();

        // Re-render map
        this.renderMap();

        // Highlight selected hex
        if (this.game.selectedHex) {
            this._highlightHex(this.game.selectedHex);
        }

        // Highlight movement range
        if (this.game.selectedUnit && !this.game.selectedUnit.hasMoved) {
            this._highlightMovementRange(this.game.selectedUnit);
        }

        // Highlight attack range
        if (this.game.selectedUnit && !this.game.selectedUnit.hasAttacked) {
            this._highlightAttackRange(this.game.selectedUnit);
        }

        // Update side panel
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'info';
        this.updateSidePanel(activeTab);

        // Update message log
        this._updateMessageLog();
    }

    _updateTopBar() {
        document.getElementById('turn-display').textContent = `Turn ${this.game.turn}`;
        document.getElementById('phase-display').textContent = this.game.phase;

        // Resources
        const resourcesBar = document.getElementById('resources-bar');
        resourcesBar.innerHTML = '';
        for (const [type, amount] of Object.entries(this.game.playerFaction.resources)) {
            const resType = RESOURCE_TYPES[type];
            if (!resType) continue;

            const div = document.createElement('div');
            div.className = 'resource-item';
            div.innerHTML = `<span class="resource-icon">${resType.icon}</span><span class="resource-value">${amount}</span>`;
            resourcesBar.appendChild(div);
        }

        // Win conditions progress
        const winBar = document.getElementById('win-conditions');
        winBar.innerHTML = '';

        // Domination progress
        const mySettlements = this.game.gameMap.getSettlementsByOwner(this.game.playerFaction.id).length;
        const totalSettlements = this.game.gameMap.getTotalSettlements();
        const domPercent = totalSettlements > 0 ? Math.floor((mySettlements / totalSettlements) * 100) : 0;
        const domDiv = document.createElement('div');
        domDiv.className = `win-condition ${domPercent >= 60 ? 'complete' : 'progress'}`;
        domDiv.textContent = `${WIN_CONDITIONS.DOMINATION.icon} ${domPercent}%`;
        winBar.appendChild(domDiv);

        // Scientific progress
        const hasAscension = this.game.playerFaction.hasTech('ascension_protocol');
        const sciDiv = document.createElement('div');
        sciDiv.className = `win-condition ${hasAscension ? 'complete' : 'progress'}`;
        sciDiv.textContent = `${WIN_CONDITIONS.SCIENTIFIC.icon} ${hasAscension ? '✓' : '...'}`;
        winBar.appendChild(sciDiv);

        // Cultural progress
        const arkTurns = this.game.playerFaction.arkTurns;
        const culDiv = document.createElement('div');
        culDiv.className = `win-condition ${arkTurns >= 5 ? 'complete' : arkTurns > 0 ? 'progress' : ''}`;
        culDiv.textContent = `${WIN_CONDITIONS.CULTURAL.icon} ${arkTurns}/5`;
        winBar.appendChild(culDiv);
    }

    _highlightHex(hex) {
        const element = this.hexElements.get(hex.key());
        if (element) {
            element.classList.add('selected');
            element.setAttribute('stroke', '#fff');
            element.setAttribute('stroke-width', '3');
        }
    }

    _highlightMovementRange(unit) {
        const range = unit.movementLeft;
        const hexes = this.game.gameMap.grid.getHexesInRange(unit.hex, range);

        for (const hex of hexes) {
            const element = this.hexElements.get(hex.key());
            if (element) {
                element.classList.add('highlight');
                element.setAttribute('stroke', '#00ccff');
                element.setAttribute('stroke-width', '2');
            }
        }
    }

    _highlightAttackRange(unit) {
        const targets = this.game.unitManager.getAttackTargets(unit);
        for (const target of targets) {
            const element = this.hexElements.get(target.hex.key());
            if (element) {
                element.setAttribute('stroke', '#ff4444');
                element.setAttribute('stroke-width', '3');
            }
        }
    }

    updateSidePanel(tab) {
        if (!this.game.playerFaction) return;
        switch (tab) {
            case 'info': this._updateInfoPanel(); break;
            case 'research': this._updateResearchPanel(); break;
            case 'production': this._updateProductionPanel(); break;
            case 'diplomacy': this._updateDiplomacyPanel(); break;
        }
    }

    _updateInfoPanel() {
        const panel = document.getElementById('tab-info');
        let html = '';

        if (this.game.selectedUnit) {
            const unit = this.game.selectedUnit;
            html += `
                <div class="info-section">
                    <h3>${unit.icon} ${unit.name}</h3>
                    <div class="info-row"><span class="info-label">Owner</span><span class="info-value">${this.game.factions.find(f => f.id === unit.owner)?.name || 'Unknown'}</span></div>
                    <div class="info-row"><span class="info-label">HP</span><span class="info-value">${unit.hp}/${unit.maxHp}</span></div>
                    <div class="info-row"><span class="info-label">Attack</span><span class="info-value">${unit.attack}</span></div>
                    <div class="info-row"><span class="info-label">Defense</span><span class="info-value">${unit.defense}</span></div>
                    <div class="info-row"><span class="info-label">Movement</span><span class="info-value">${unit.movementLeft}/${unit.movement}</span></div>
                    <div class="info-row"><span class="info-label">Range</span><span class="info-value">${unit.range}</span></div>
                </div>
            `;
        } else if (this.game.selectedHex) {
            const hex = this.game.selectedHex;
            const terrain = this.game.gameMap.getTerrain(hex);
            const settlement = this.game.gameMap.getSettlement(hex);

            html += `
                <div class="info-section">
                    <h3>${terrain.icon} ${terrain.name}</h3>
                    <div class="info-row"><span class="info-label">Move Cost</span><span class="info-value">${terrain.moveCost}</span></div>
                    <div class="info-row"><span class="info-label">Defense Bonus</span><span class="info-value">+${terrain.defense}</span></div>
            `;

            if (settlement) {
                const faction = this.game.factions.find(f => f.id === settlement.owner);
                html += `
                    <div class="info-row"><span class="info-label">Settlement</span><span class="info-value" style="color: ${faction?.color || '#fff'}">${faction?.name || 'Abandoned'}</span></div>
                    <div class="info-row"><span class="info-label">Buildings</span><span class="info-value">${settlement.buildings.map(b => BUILDINGS[b]?.icon || '?').join(' ') || 'None'}</span></div>
                `;
            }

            if (this.game.gameMap.hasResource(hex)) {
                const res = this.game.gameMap.getResource(hex);
                html += `<div class="info-row"><span class="info-label">Resource</span><span class="info-value">${RESOURCE_TYPES[res.type]?.icon} ${res.amount}</span></div>`;
            }

            html += `</div>`;

            // Action buttons
            if (this.game.phase === PHASES.PLANNING) {
                const unitsOnHex = this.game.unitManager.getUnitsOnHex(hex);
                const playerUnits = unitsOnHex.filter(u => u.owner === this.game.playerFaction.id);

                if (!settlement && playerUnits.length > 0) {
                    html += `<button class="btn-action btn-small" onclick="game.establishSettlement(game.selectedHex); ui.update();">Establish Settlement (5 scrap)</button>`;
                }

                if (settlement && settlement.owner === this.game.playerFaction.id) {
                    html += `<p style="margin-top: 10px; color: #888; font-size: 0.8em;">Use Production tab to build here</p>`;
                }
            }
        } else {
            html += `<p style="color: #666;">Select a hex or unit to see details.</p>`;
        }

        // Faction summary
        html += `
            <div class="info-section" style="margin-top: 20px;">
                <h3>Your Faction</h3>
                <div class="info-row"><span class="info-label">Name</span><span class="info-value" style="color: ${this.game.playerFaction.color}">${this.game.playerFaction.name}</span></div>
                <div class="info-row"><span class="info-label">Settlements</span><span class="info-value">${this.game.gameMap.getSettlementsByOwner(this.game.playerFaction.id).length}</span></div>
                <div class="info-row"><span class="info-label">Units</span><span class="info-value">${this.game.unitManager.getUnitsByOwner(this.game.playerFaction.id).length}</span></div>
                <div class="info-row"><span class="info-label">Techs</span><span class="info-value">${this.game.playerFaction.researched.size}/${Object.keys(RESEARCH_TREE).length}</span></div>
                <div class="info-row"><span class="info-label">Kills</span><span class="info-value">${this.game.playerFaction.totalKills}</span></div>
            </div>
        `;

        panel.innerHTML = html;
    }

    _updateResearchPanel() {
        const panel = document.getElementById('tab-research');
        let html = '';

        // Current research
        const progress = this.game.researchSystem.getProgress(this.game.playerFaction);
        if (progress) {
            html += `
                <div class="info-section">
                    <h3>Currently Researching</h3>
                    <div class="info-row"><span class="info-label">${progress.techName}</span><span class="info-value">${progress.percentage}%</span></div>
                    <div style="background: #333; height: 8px; border-radius: 4px; margin-top: 5px;">
                        <div style="background: #00ccff; height: 100%; width: ${progress.percentage}%; border-radius: 4px;"></div>
                    </div>
                </div>
            `;
        }

        // Available research
        const available = this.game.researchSystem.getAvailable(this.game.playerFaction);
        if (available.length > 0) {
            html += `<div class="info-section"><h3>Available Technologies</h3>`;

            for (const tech of available) {
                const costStr = Object.entries(tech.cost).map(([t, a]) => `${RESOURCE_TYPES[t]?.icon || t}${a}`).join(' ');
                const canAfford = this.game.playerFaction.canAfford(tech.cost);

                html += `
                    <div class="research-item ${canAfford ? '' : 'locked'}" onclick="game.startResearch('${tech.id}'); ui.update();">
                        <div class="tech-name">${tech.name} (T${tech.tier})</div>
                        <div class="tech-cost">${costStr}</div>
                        <div class="tech-desc">${tech.description}</div>
                    </div>
                `;
            }

            html += `</div>`;
        }

        // Researched techs
        if (this.game.playerFaction.researched.size > 0) {
            html += `<div class="info-section"><h3>Researched</h3>`;
            for (const techId of this.game.playerFaction.researched) {
                const tech = RESEARCH_TREE[techId];
                if (tech) {
                    html += `
                        <div class="research-item researched">
                            <div class="tech-name">✓ ${tech.name}</div>
                            <div class="tech-desc">${tech.description}</div>
                        </div>
                    `;
                }
            }
            html += `</div>`;
        }

        panel.innerHTML = html;
    }

    _updateProductionPanel() {
        const panel = document.getElementById('tab-production');
        let html = '';

        const hex = this.game.selectedHex;
        const settlement = hex ? this.game.gameMap.getSettlement(hex) : null;

        if (!settlement || settlement.owner !== this.game.playerFaction.id) {
            html += `<p style="color: #666;">Select one of your settlements to produce units and buildings.</p>`;
        } else {
            // Units
            html += `<div class="info-section"><h3>Units</h3>`;
            for (const [id, unit] of Object.entries(UNIT_TYPES)) {
                if (unit.requires && !this.game.playerFaction.hasTech(unit.requires)) continue;

                const cost = this.game.playerFaction.getUnitCost(id);
                const costStr = Object.entries(cost).map(([t, a]) => `${RESOURCE_TYPES[t]?.icon || t}${a}`).join(' ');
                const canAfford = this.game.playerFaction.canAfford(cost);

                html += `
                    <div class="production-item ${canAfford ? '' : 'locked'}" onclick="game.buildUnit('${id}', game.selectedHex); ui.update();">
                        <div class="prod-name">${unit.icon} ${unit.name}</div>
                        <div class="prod-cost">${costStr}</div>
                        <div class="prod-desc">ATK:${unit.attack} DEF:${unit.defense} MOV:${unit.movement} HP:${unit.hp}</div>
                    </div>
                `;
            }
            html += `</div>`;

            // Buildings
            html += `<div class="info-section"><h3>Buildings</h3>`;
            const availableBuildings = this.game.buildingManager.getAvailableBuildings(this.game.playerFaction, hex);
            for (const building of availableBuildings) {
                const costStr = Object.entries(building.cost).map(([t, a]) => `${RESOURCE_TYPES[t]?.icon || t}${a}`).join(' ');

                html += `
                    <div class="production-item ${building.canAfford ? '' : 'locked'}" onclick="game.buildBuilding('${building.id}', game.selectedHex); ui.update();">
                        <div class="prod-name">${building.icon} ${building.name}</div>
                        <div class="prod-cost">${costStr}</div>
                        <div class="prod-desc">${building.description}</div>
                    </div>
                `;
            }
            html += `</div>`;
        }

        panel.innerHTML = html;
    }

    _updateDiplomacyPanel() {
        const panel = document.getElementById('tab-diplomacy');
        let html = '';

        for (const faction of this.game.factions) {
            if (faction.isPlayer) continue;

            const diplo = this.game.playerFaction.getDiplomacyState(faction.id);
            const diploState = DIPLOMACY_STATES[diplo.state];

            html += `
                <div class="diplomacy-item" style="--faction-color: ${faction.color}">
                    <h4 style="color: ${faction.color}">${faction.name}</h4>
                    <div class="diplomacy-status">
                        Status: <span style="color: ${diploState.color}">${diploState.name}</span>
                        ${diplo.turns > 0 ? ` (${diplo.turns} turns)` : ''}
                    </div>
                    <div class="diplomacy-status">
                        Settlements: ${this.game.gameMap.getSettlementsByOwner(faction.id).length} | 
                        Units: ${this.game.unitManager.getUnitsByOwner(faction.id).length}
                    </div>
            `;

            if (this.game.phase === PHASES.PLANNING) {
                html += `<div class="diplomacy-actions">`;

                if (diplo.state !== 'AT_WAR') {
                    html += `<button class="btn-action btn-small" onclick="game.playerFaction.declareWar('${faction.id}'); game.factions.find(f=>f.id==='${faction.id}').declareWar(game.playerFaction.id); ui.update();">Declare War</button>`;
                } else {
                    html += `<button class="btn-action btn-small" onclick="game.playerFaction.makePeace('${faction.id}'); game.factions.find(f=>f.id==='${faction.id}').makePeace(game.playerFaction.id); ui.update();">Propose Peace</button>`;
                }

                html += `</div>`;
            }

            html += `</div>`;
        }

        panel.innerHTML = html;
    }

    _updateMessageLog() {
        const log = document.getElementById('message-log');
        const recent = this.game.messageLog.slice(-10);
        log.innerHTML = recent.map(msg =>
            `<div class="message ${msg.type}">[T${msg.turn}] ${msg.message}</div>`
        ).join('');
        log.scrollTop = log.scrollHeight;
    }

    _showVictoryScreen() {
        document.getElementById('game-screen').classList.remove('active');
        document.getElementById('victory-screen').classList.add('active');

        const winner = this.game.winner;
        const condition = this.game.winCondition;

        document.getElementById('victory-title').textContent =
            winner.isPlayer ? '🎉 Victory!' : '💀 Defeat';
        document.getElementById('victory-title').style.color =
            winner.isPlayer ? '#00ff88' : '#ff4444';

        document.getElementById('victory-message').textContent =
            `${winner.name} achieved ${WIN_CONDITIONS[condition].name} victory on turn ${this.game.turn}!`;

        // Stats
        const stats = document.getElementById('victory-stats');
        stats.innerHTML = `
            <div class="info-row"><span class="info-label">Turns Played</span><span class="info-value">${this.game.turn}</span></div>
            <div class="info-row"><span class="info-label">Your Settlements</span><span class="info-value">${this.game.gameMap.getSettlementsByOwner(this.game.playerFaction.id).length}</span></div>
            <div class="info-row"><span class="info-label">Your Units</span><span class="info-value">${this.game.unitManager.getUnitsByOwner(this.game.playerFaction.id).length}</span></div>
            <div class="info-row"><span class="info-label">Techs Researched</span><span class="info-value">${this.game.playerFaction.researched.size}</span></div>
            <div class="info-row"><span class="info-label">Enemy Kills</span><span class="info-value">${this.game.playerFaction.totalKills}</span></div>
        `;
    }
}
