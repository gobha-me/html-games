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
