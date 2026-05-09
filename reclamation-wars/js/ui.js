// === UI ORCHESTRATOR ===
// Thin shell — delegates to ui-map, ui-input, ui-panels, ui-status
class GameUI {
    constructor(game) {
        this.game = game;
        this.svg = document.getElementById('hex-map');
        this.hexElements = new Map();
        this.unitElements = new Map();
        this.camera = { x: 0, y: 0, zoom: 1 };
        this._initInput();
        this._initPanelActions();
    }

    _initPanelActions() {
        const sidePanel = document.getElementById('side-panel');
        if (!sidePanel) return;
        sidePanel.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            switch (action) {
                case 'establish-settlement':
                    this.game.establishSettlement(this.game.selectedHex);
                    break;
                case 'start-research':
                    this.game.startResearch(target.dataset.techId);
                    break;
                case 'build-unit':
                    this.game.buildUnit(target.dataset.unitId, this.game.selectedHex);
                    break;
                case 'build-building':
                    this.game.buildBuilding(target.dataset.buildingId, this.game.selectedHex);
                    break;
                case 'declare-war': {
                    const fid = target.dataset.factionId;
                    this.game.playerFaction.declareWar(fid);
                    const faction = this.game.factions.find(f => f.id === fid);
                    if (faction) faction.declareWar(this.game.playerFaction.id);
                    break;
                }
                case 'propose-peace':
                    this.game.playerFaction.makePeace(target.dataset.factionId);
                    break;
            }
            this.update();
        });
    }

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
}
