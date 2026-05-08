// === UI STATUS & HIGHLIGHTS ===
// Extracted from ui.js — top bar, hex highlights, message log, victory screen
Object.assign(GameUI.prototype, {
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
    },

    _highlightHex(hex) {
        const element = this.hexElements.get(hex.key());
        if (element) {
            element.classList.add('selected');
            element.setAttribute('stroke', '#fff');
            element.setAttribute('stroke-width', '3');
        }
    },

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
    },

    _highlightAttackRange(unit) {
        const targets = this.game.unitManager.getAttackTargets(unit);
        for (const target of targets) {
            const element = this.hexElements.get(target.hex.key());
            if (element) {
                element.setAttribute('stroke', '#ff4444');
                element.setAttribute('stroke-width', '3');
            }
        }
    },

    _updateMessageLog() {
        const log = document.getElementById('message-log');
        const recent = this.game.messageLog.slice(-10);
        log.innerHTML = recent.map(msg =>
            `<div class="message ${msg.type}">[T${msg.turn}] ${msg.message}</div>`
        ).join('');
        log.scrollTop = log.scrollHeight;
    },

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
    },
});
