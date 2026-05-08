// === KEYBOARD INPUT HANDLER ===
class KeyboardInput {
    constructor(game, ui) {
        this.game = game;
        this.ui = ui;
        this._onKeyDown = this._onKeyDown.bind(this);
        this._bind();
    }

    _bind() {
        document.addEventListener('keydown', this._onKeyDown);
    }

    _onKeyDown(e) {
        // Don't capture keys when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        const key = e.key.toLowerCase();

        // Global keys (work on any screen)
        if (key === 'escape') {
            e.preventDefault();
            this._handleEscape();
            return;
        }

        // Setup screen keys
        if (document.getElementById('setup-screen')?.classList.contains('active')) {
            this._handleSetupKey(e, key);
            return;
        }

        // Game screen keys
        if (document.getElementById('game-screen')?.classList.contains('active')) {
            this._handleGameKey(e, key);
            return;
        }
    }

    // === SETUP SCREEN ===
    _handleSetupKey(e, key) {
        const cards = Array.from(document.querySelectorAll('.faction-card'));
        const currentIdx = cards.findIndex(c => c.classList.contains('selected'));
        const startBtn = document.getElementById('start-btn');

        if (key === 'arrowleft' || key === 'a') {
            e.preventDefault();
            const nextIdx = currentIdx > 0 ? currentIdx - 1 : cards.length - 1;
            this._selectFactionCard(cards[nextIdx]);
        } else if (key === 'arrowright' || key === 'd') {
            e.preventDefault();
            const nextIdx = currentIdx < cards.length - 1 ? currentIdx + 1 : 0;
            this._selectFactionCard(cards[nextIdx]);
        } else if (key === 'arrowup' || key === 'w') {
            e.preventDefault();
            // Move focus to map size / faction count selects
            const mapSize = document.getElementById('map-size');
            if (mapSize) mapSize.focus();
        } else if (key === 'arrowdown' || key === 's') {
            e.preventDefault();
            if (startBtn && !startBtn.disabled) {
                startBtn.focus();
            }
        } else if (key === 'enter' || key === ' ') {
            e.preventDefault();
            if (currentIdx >= 0 && startBtn && !startBtn.disabled) {
                startBtn.click();
            } else if (cards.length > 0) {
                this._selectFactionCard(cards[0]);
            }
        }
    }

    _selectFactionCard(card) {
        const factionId = card.dataset.factionId;
        setup._selectFaction(factionId, card);
        card.focus();
    }

    // === GAME SCREEN ===
    _handleGameKey(e, key) {
        if (this.game.gameOver) return;

        // End turn
        if (key === 'e') {
            e.preventDefault();
            if (this.game.phase === PHASES.PLANNING) {
                this.game.endPlayerTurn();
                this.ui.update();
            }
            return;
        }

        // Tab cycling
        if (key === 't') {
            e.preventDefault();
            this._cycleTab();
            return;
        }

        // Center camera on selected hex
        if (key === 'h') {
            e.preventDefault();
            this._centerCamera();
            return;
        }

        // Hex navigation and camera pan (only during planning phase)
        if (this.game.phase === PHASES.PLANNING) {
            const direction = this._getHexDirection(key);
            if (direction) {
                e.preventDefault();
                if (e.shiftKey) {
                    // Shift + arrow = pan camera
                    this._panCamera(direction);
                } else {
                    // Arrow = move selected hex
                    this._navigateHex(direction);
                }
                return;
            }
        }

        // Confirm / select
        if (key === 'enter' || key === ' ') {
            e.preventDefault();
            this._handleConfirm();
            return;
        }

        // Quick-build: number keys 1-9 on production tab
        if (/^[1-9]$/.test(key)) {
            e.preventDefault();
            this._handleQuickBuild(parseInt(key, 10));
            return;
        }
    }

    _getHexDirection(key) {
        // Map keys to axial coordinate deltas
        // Pointy-top hex grid: q is roughly horizontal, r is vertical
        const directions = {
            'arrowup':    { dq:  0, dr: -1 },  // W
            'arrowdown':  { dq:  0, dr:  1 },  // S
            'arrowleft':  { dq: -1, dr:  0 },  // A
            'arrowright': { dq:  1, dr:  0 },  // D
            'w':          { dq:  0, dr: -1 },
            's':          { dq:  0, dr:  1 },
            'a':          { dq: -1, dr:  0 },
            'd':          { dq:  1, dr:  0 },
        };
        return directions[key] || null;
    }

    _navigateHex(direction) {
        const grid = this.game.gameMap?.grid;
        if (!grid) return;

        // Start from selected hex, or find a reasonable starting point
        let current = this.game.selectedHex;
        if (!current) {
            // Default to first hex in grid
            const allHexes = grid.getAllHexes();
            if (allHexes.length > 0) {
                current = allHexes[0];
            } else {
                return;
            }
        }

        // Find the neighbor in the desired direction
        const neighbors = grid.getNeighbors(current);
        let bestNeighbor = null;
        let bestScore = Infinity;

        for (const neighbor of neighbors) {
            const dq = neighbor.q - current.q;
            const dr = neighbor.r - current.r;
            // Score by how well the neighbor matches the desired direction
            const score = Math.abs(dq - direction.dq) + Math.abs(dr - direction.dr);
            if (score < bestScore) {
                bestScore = score;
                bestNeighbor = neighbor;
            }
        }

        if (bestNeighbor) {
            this.game.selectHex(bestNeighbor);
            this.ui.update();
        }
    }

    _panCamera(direction) {
        const panAmount = 50;
        // Convert axial direction to screen pixels
        // In pointy-top hex: q increases right, r increases down
        this.ui.camera.x += direction.dq * panAmount;
        this.ui.camera.y += direction.dr * panAmount;
        this.ui._applyCamera();
    }

    _centerCamera() {
        if (!this.game.selectedHex) return;
        const hexSize = this.game.hexSize;
        const pixel = this.game.selectedHex.toPixel(hexSize);
        const svgRect = this.ui.svg.getBoundingClientRect();

        // Center the selected hex in the viewport
        this.ui.camera.x = svgRect.width / 2 - (pixel.x + hexSize * Math.sqrt(3));
        this.ui.camera.y = svgRect.height / 2 - (pixel.y + hexSize);
        this.ui._applyCamera();
    }

    _handleConfirm() {
        if (!this.game.selectedHex) return;

        const unitsOnHex = this.game.unitManager.getUnitsOnHex(this.game.selectedHex);
        const playerUnits = unitsOnHex.filter(u => u.owner === this.game.playerFaction.id);

        if (this.game.selectedUnit) {
            // Try to move selected unit to selected hex
            if (!this.game.selectedUnit.hasMoved) {
                const moved = this.game.moveUnit(this.game.selectedUnit, this.game.selectedHex);
                if (moved) {
                    this.ui.update();
                }
            }
        } else if (playerUnits.length > 0) {
            this.game.selectUnit(playerUnits[0]);
            this.ui.update();
        }
    }

    _handleEscape() {
        // Setup screen: deselect faction
        if (document.getElementById('setup-screen')?.classList.contains('active')) {
            document.querySelectorAll('.faction-card').forEach(c => c.classList.remove('selected'));
            setup.selectedFaction = null;
            const btn = document.getElementById('start-btn');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Select a Faction';
            }
            return;
        }

        // Game screen: deselect unit/hex
        if (document.getElementById('game-screen')?.classList.contains('active')) {
            if (this.game.selectedUnit) {
                this.game.selectedUnit = null;
            } else if (this.game.selectedHex) {
                this.game.selectedHex = null;
            }
            this.ui.update();
        }
    }

    _cycleTab() {
        const tabs = Array.from(document.querySelectorAll('.tab-btn'));
        const activeIdx = tabs.findIndex(t => t.classList.contains('active'));
        const nextIdx = (activeIdx + 1) % tabs.length;
        tabs[nextIdx].click();
    }

    _handleQuickBuild(num) {
        // Only works on production tab
        const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
        if (activeTab !== 'production') return;

        const hex = this.game.selectedHex;
        const settlement = hex ? this.game.gameMap.getSettlement(hex) : null;
        if (!settlement || settlement.owner !== this.game.playerFaction.id) return;

        // Collect all production items (units + buildings)
        const items = [];

        for (const [id, unit] of Object.entries(UNIT_TYPES)) {
            if (unit.requires && !this.game.playerFaction.hasTech(unit.requires)) continue;
            items.push({ type: 'unit', id });
        }

        const availableBuildings = this.game.buildingManager.getAvailableBuildings(this.game.playerFaction, hex);
        for (const building of availableBuildings) {
            items.push({ type: 'building', id: building.id });
        }

        if (num <= items.length) {
            const item = items[num - 1];
            if (item.type === 'unit') {
                this.game.buildUnit(item.id, hex);
            } else {
                this.game.buildBuilding(item.id, hex);
            }
            this.ui.update();
        }
    }
}
