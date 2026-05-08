// === SETUP SCREEN ===
class SetupScreen {
    constructor() {
        this.selectedFaction = null;
        this._setupEventListeners();
        this._renderFactionCards();
    }

    _setupEventListeners() {
        // Game card "Play Now" button
        const playBtn = document.getElementById('play-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this._showSetup());
        }

        document.getElementById('start-btn').addEventListener('click', () => this._startGame());

        // End Turn button — mirrors the 'E' keyboard handler
        const endTurnBtn = document.getElementById('end-turn-btn');
        if (endTurnBtn) {
            endTurnBtn.addEventListener('click', () => {
                if (game.gameOver || game.phase !== PHASES.PLANNING) return;
                game.endPlayerTurn();
                ui.update();
            });
        }

        // Play Again button — reset to setup screen with fresh state
        const playAgainBtn = document.getElementById('play-again-btn');
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => {
                document.getElementById('victory-screen').classList.remove('active');
                document.getElementById('game-screen').classList.remove('active');
                document.getElementById('setup-screen').classList.add('active');
                // Reset selection so the user re-picks
                this.selectedFaction = null;
                document.querySelectorAll('.faction-card').forEach(c => c.classList.remove('selected'));
                const btn = document.getElementById('start-btn');
                btn.disabled = true;
                btn.textContent = 'Select a faction to begin';
                // Fresh game + UI to avoid stale state (game.init appends, doesn't reset)
                if (keyboard) keyboard.destroy();
                game = new Game();
                ui = new GameUI(game);
            });
        }

        // Tab buttons — delegated click handler for Info/Research/Production/Diplomacy
        const panelTabs = document.getElementById('panel-tabs');
        if (panelTabs) {
            panelTabs.addEventListener('click', (e) => {
                const btn = e.target.closest('.tab-btn');
                if (!btn) return;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tabId = btn.dataset.tab;
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                document.getElementById('tab-' + tabId).classList.add('active');
                ui.update();
            });
        }
    }

    _showSetup() {
        document.getElementById('game-card').classList.remove('active');
        document.getElementById('setup-screen').classList.add('active');
    }

    _renderFactionCards() {
        const container = document.getElementById('faction-select');
        container.innerHTML = '';

        for (const faction of FACTIONS) {
            const card = document.createElement('div');
            card.className = 'faction-card';
            card.style.setProperty('--faction-color', faction.color);
            card.dataset.factionId = faction.id;

            const startingTechNames = faction.startingTech.map(id => RESEARCH_TREE[id]?.name || id).join(', ');

            card.innerHTML = `
                <h3 style="color: ${faction.color}">${faction.name}</h3>
                <div class="faction-desc">${faction.description}</div>
                <div class="faction-bonus">⚡ ${faction.bonus}</div>
                <div class="faction-starting-tech">🔬 Starts with: ${startingTechNames}</div>
            `;

            card.addEventListener('click', () => this._selectFaction(faction.id, card));
            container.appendChild(card);
        }
    }

    _selectFaction(factionId, cardElement) {
        // Deselect previous
        document.querySelectorAll('.faction-card').forEach(c => c.classList.remove('selected'));

        // Select new
        cardElement.classList.add('selected');
        this.selectedFaction = factionId;

        // Enable start button
        const btn = document.getElementById('start-btn');
        btn.disabled = false;
        btn.textContent = 'Begin Reclamation';
    }

    _startGame() {
        if (!this.selectedFaction) return;

        const mapSize = document.getElementById('map-size').value;
        const factionCount = parseInt(document.getElementById('faction-count').value);

        // Clean up previous keyboard instance to prevent listener leak
        if (keyboard) {
            keyboard.destroy();
        }

        // Hide setup, show game
        document.getElementById('setup-screen').classList.remove('active');
        document.getElementById('game-screen').classList.add('active');

        // Initialize game
        game.init(mapSize, factionCount, this.selectedFaction);

        // Initialize UI
        ui.renderMap();
        ui.update();

        // Create fresh keyboard handler bound to the new game state
        keyboard = new KeyboardInput(game, ui);
    }
}
