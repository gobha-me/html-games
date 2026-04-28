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

        // Hide setup, show game
        document.getElementById('setup-screen').classList.remove('active');
        document.getElementById('game-screen').classList.add('active');

        // Initialize game
        game.init(mapSize, factionCount, this.selectedFaction);

        // Initialize UI
        ui.renderMap();
        ui.update();
    }
}
