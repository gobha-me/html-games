// === UI PANELS ===
// Extracted from ui.js — side panel rendering methods
Object.assign(GameUI.prototype, {
    updateSidePanel(tab) {
        if (!this.game.playerFaction) return;
        switch (tab) {
            case 'info': this._updateInfoPanel(); break;
            case 'research': this._updateResearchPanel(); break;
            case 'production': this._updateProductionPanel(); break;
            case 'diplomacy': this._updateDiplomacyPanel(); break;
        }
    },

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
    },

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
                html += `\n                    <div class="research-item ${canAfford ? '' : 'locked'}" tabindex="0" role="button" aria-label="Research ${tech.name}" onclick="game.startResearch('${tech.id}'); ui.update();">\n                        <div class="tech-name">${tech.name} (T${tech.tier})</div>\n                        <div class="tech-cost">${costStr}</div>\n                        <div class="tech-desc">${tech.description}</div>\n                    </div>\n                `;
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
    },

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

                html += `\n                    <div class="production-item ${canAfford ? '' : 'locked'}" tabindex="0" role="button" aria-label="Build ${unit.name}" onclick="game.buildUnit('${id}', game.selectedHex); ui.update();">\n                        <div class="prod-name">${unit.icon} ${unit.name}</div>\n                        <div class="prod-cost">${costStr}</div>\n                        <div class="prod-desc">ATK:${unit.attack} DEF:${unit.defense} MOV:${unit.movement} HP:${unit.hp}</div>\n                    </div>\n                `;
            }
            html += `</div>`;

            // Buildings
            html += `<div class="info-section"><h3>Buildings</h3>`;
            const availableBuildings = this.game.buildingManager.getAvailableBuildings(this.game.playerFaction, hex);
            for (const building of availableBuildings) {
                const costStr = Object.entries(building.cost).map(([t, a]) => `${RESOURCE_TYPES[t]?.icon || t}${a}`).join(' ');

                html += `\n                    <div class="production-item ${building.canAfford ? '' : 'locked'}" tabindex="0" role="button" aria-label="Build ${building.name}" onclick="game.buildBuilding('${building.id}', game.selectedHex); ui.update();">\n                        <div class="prod-name">${building.icon} ${building.name}</div>\n                        <div class="prod-cost">${costStr}</div>\n                        <div class="prod-desc">${building.description}</div>\n                    </div>\n                `;
            }
            html += `</div>`;
        }

        panel.innerHTML = html;
    },

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
    },
});
