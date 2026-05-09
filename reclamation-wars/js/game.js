// === MAIN GAME ENGINE ===
class Game {
    constructor() {
        this.turn = 1;
        this.phase = PHASES.PLANNING;
        this.factions = [];
        this.playerFaction = null;
        this.gameMap = null;
        this.unitManager = null;
        this.buildingManager = null;
        this.resourceManager = null;
        this.researchSystem = null;
        this.aiControllers = [];
        this.selectedHex = null;
        this.selectedUnit = null;
        this.messageLog = [];
        this.gameOver = false;
        this.winner = null;
        this.winCondition = null;
        this.hexSize = 35;
    }

    // Initialize game with settings
    init(mapSize, factionCount, playerFactionId) {
        const config = MAP_SIZES[mapSize];

        // Create hex grid
        const grid = new HexGrid(config.cols, config.rows);

        // Create map
        this.gameMap = new GameMap(mapSize, grid);

        // Create factions
        const shuffledFactions = [...FACTIONS].sort(() => Math.random() - 0.5);
        const selectedFactions = shuffledFactions.slice(0, factionCount);

        for (const factionConfig of selectedFactions) {
            const isPlayer = factionConfig.id === playerFactionId;
            const faction = new Faction(factionConfig, isPlayer);
            this.factions.push(faction);

            if (isPlayer) {
                this.playerFaction = faction;
            }
        }

        // Initialize managers
        this.unitManager = new UnitManager(this.gameMap);
        this.buildingManager = new BuildingManager(this.gameMap);
        this.resourceManager = new ResourceManager(this.gameMap, this.factions);
        this.researchSystem = new ResearchSystem(this.factions);

        // Place starting settlements and units
        this._placeStartingPositions();

        // Create AI controllers
        for (const faction of this.factions) {
            if (!faction.isPlayer) {
                this.aiControllers.push(new AIController(faction, this));
            }
        }

        // Initialize diplomacy
        this._initDiplomacy();

        // Initial resource collection
        for (const faction of this.factions) {
            this.resourceManager.collectResources(faction);
        }

        this.phase = PHASES.PLANNING;
        this.logMessage('Welcome to Reclamation Wars! The world awaits your command.', '');
    }

    _placeStartingPositions() {
        for (let i = 0; i < this.factions.length; i++) {
            const faction = this.factions[i];
            const startHex = this.gameMap.startingPositions[i];

            if (!startHex) continue;

            // Create starting settlement
            this.gameMap.addSettlement(startHex, faction.id);
            faction.settlements.push(startHex);

            // Set terrain to plains for starting position
            this.gameMap.terrain.set(startHex.key(), 'PLAINS');

            // Create starting units
            for (const [type, count] of Object.entries(faction.startingUnits)) {
                for (let j = 0; j < count; j++) {
                    const unit = this.unitManager.createUnit(type, faction.id, startHex);
                }
            }
        }
    }

    _initDiplomacy() {
        for (const f1 of this.factions) {
            for (const f2 of this.factions) {
                if (f1.id === f2.id) continue;
                f1.setDiplomacyState(f2.id, 'NEUTRAL');
            }
        }
    }

    // End player's turn
    endPlayerTurn() {
        if (this.gameOver || this.phase !== PHASES.PLANNING) return;

        this.phase = PHASES.AI_TURN;

        // Execute AI turns sequentially
        this._executeAITurns(0);
    }

    async _executeAITurns(index) {
        if (index >= this.aiControllers.length) {
            // All AI done, start new turn
            this._startNewTurn();
            return;
        }

        const ai = this.aiControllers[index];
        await ai.executeTurn();

        // Check for game over after each AI turn
        if (this._checkWinConditions()) {
            return;
        }

        // Next AI
        setTimeout(() => this._executeAITurns(index + 1), 100);
    }

    _startNewTurn() {
        this.turn++;
        this.phase = PHASES.PLANNING;

        // Collect resources for all factions
        for (const faction of this.factions) {
            this.resourceManager.collectResources(faction);
            faction.applyBonuses();

            // Heal units
            const healAmount = 1 + faction.getHealBonus();
            this.unitManager.healAllForFaction(faction.id, healAmount);

            // Reset units
            this.unitManager.resetTurnForFaction(faction.id);

            // Track ark beacon turns for cultural victory (incremented once per turn
            // here, not in _checkWinConditions — bug fix from issue #176).
            if (this.buildingManager.hasVictoryBuilding(faction.id, 'ark_beacon')) {
                faction.arkTurns++;
            } else {
                faction.arkTurns = 0;
            }
        }

        // Advance research
        const completed = this.researchSystem.advanceAll();
        for (const result of completed) {
            this.logMessage(`${result.faction} completed research: ${RESEARCH_TREE[result.tech].name}`, 'research');
        }

        // Update diplomacy timers
        this._updateDiplomacy();

        // Check win conditions
        this._checkWinConditions();

        this.logMessage(`Turn ${this.turn} begins.`, '');
    }

    _updateDiplomacy() {
        for (const faction of this.factions) {
            for (const [otherId, diplo] of Object.entries(faction.diplomacy)) {
                if (diplo.turns > 0) {
                    diplo.turns--;
                    if (diplo.turns === 0 && diplo.state === 'AT_WAR') {
                        // Wars can end after duration
                        if (Math.random() < 0.2) {
                            faction.makePeace(otherId);
                            const other = this.factions.find(f => f.id === otherId);
                            if (other) other.makePeace(faction.id);
                            this.logMessage(`${faction.name} and ${other?.name} signed a peace treaty!`, 'diplomacy');
                        }
                    }
                }
            }
        }
    }

    // Player actions
    selectHex(hex) {
        this.selectedHex = hex;
        this.selectedUnit = null;

        // Check if there's a player unit on this hex
        const units = this.unitManager.getUnitsOnHex(hex);
        const playerUnits = units.filter(u => u.owner === this.playerFaction.id);
        if (playerUnits.length > 0) {
            this.selectedUnit = playerUnits[0];
        }
    }

    selectUnit(unit) {
        if (unit.owner !== this.playerFaction.id) return;
        this.selectedUnit = unit;
        this.selectedHex = unit.hex;
    }

    moveUnit(unit, targetHex) {
        if (!unit || unit.owner !== this.playerFaction.id) return false;
        if (unit.hasMoved || this.phase !== PHASES.PLANNING) return false;

        const path = this.gameMap.grid.getPath(unit.hex, targetHex, (hex) => {
            const terrain = this.gameMap.getTerrain(hex);
            return terrain.moveCost < 99;
        });

        if (!path || path.length <= 1) return false;

        // Move along path
        let movesLeft = unit.movementLeft;
        for (let i = 1; i < path.length; i++) {
            const nextHex = path[i];
            const terrain = this.gameMap.getTerrain(nextHex);
            const cost = terrain.moveCost;

            if (cost > movesLeft) break;

            // Check for enemy units
            const enemies = this.unitManager.getEnemyUnitsOnHex(nextHex, this.playerFaction.id);
            if (enemies.length > 0) {
                // Attack instead of moving
                this.resolveCombat(unit, enemies[0]);
                return true;
            }

            unit.hex = nextHex;
            movesLeft -= cost;
        }

        unit.movementLeft = movesLeft;
        unit.hasMoved = movesLeft <= 0;
        return true;
    }

    attackUnit(attacker, defender) {
        if (!attacker || !defender) return;
        if (attacker.owner === defender.owner) return;
        if (attacker.hasAttacked || attacker.attack === 0) return;

        const distance = attacker.hex.distance(defender.hex);
        if (distance > attacker.range) return;

        this.resolveCombat(attacker, defender);
    }

    resolveCombat(attacker, defender) {
        const result = this.unitManager.resolveCombat(attacker, defender, this);

        this.logMessage(
            `${attacker.icon} ${attacker.name} attacks ${defender.icon} ${defender.name} for ${result.damage} damage!`,
            'combat'
        );

        if (result.defenderKilled) {
            this.unitManager.removeUnit(defender);
            const attackerFaction = this.factions.find(f => f.id === attacker.owner);
            if (attackerFaction) attackerFaction.totalKills++;
            this.logMessage(`${defender.icon} ${defender.name} destroyed!`, 'combat');
        }
        if (result.attackerKilled) {
            this.unitManager.removeUnit(attacker);
            this.logMessage(`${attacker.icon} ${attacker.name} destroyed!`, 'combat');
        }

        return result;
    }

    buildUnit(unitType, hex) {
        if (!hex || this.phase !== PHASES.PLANNING) return false;

        const settlement = this.gameMap.getSettlement(hex);
        if (!settlement || settlement.owner !== this.playerFaction.id) return false;

        const cost = this.playerFaction.getUnitCost(unitType);
        if (!cost || !this.playerFaction.canAfford(cost)) return false;

        // Check tech requirement
        const unitData = UNIT_TYPES[unitType];
        if (unitData.requires && !this.playerFaction.hasTech(unitData.requires)) return false;

        this.playerFaction.spend(cost);
        this.unitManager.createUnit(unitType, this.playerFaction.id, hex);
        this.logMessage(`Produced ${unitData.icon} ${unitData.name}`, 'production');
        return true;
    }

    buildBuilding(buildingId, hex) {
        return this.buildingManager.build(this.playerFaction, buildingId, hex);
    }

    startResearch(techId) {
        return this.researchSystem.startResearch(this.playerFaction, techId);
    }

    establishSettlement(hex) {
        if (this.gameMap.getSettlement(hex)) return false;
        if (!this.playerFaction.canAfford({ scrap: 5 })) return false;

        const terrain = this.gameMap.terrain.get(hex.key());
        if (terrain === 'WATER' || terrain === 'MOUNTAIN') return false;

        // Need a nearby unit to settle
        const nearbyUnits = this.unitManager.getUnitsInRange(hex, 1, this.playerFaction.id);
        if (nearbyUnits.length === 0) return false;

        this.playerFaction.spend({ scrap: 5 });
        this.gameMap.addSettlement(hex, this.playerFaction.id);
        this.logMessage(`New settlement established!`, 'production');
        return true;
    }

    // Win condition checks
    _checkWinConditions() {
        for (const faction of this.factions) {
            // Domination: control 60% of settlements
            const mySettlements = this.gameMap.getSettlementsByOwner(faction.id).length;
            const totalSettlements = this.gameMap.getTotalSettlements();
            if (totalSettlements > 0 && mySettlements / totalSettlements >= 0.6) {
                this._declareVictory(faction, 'DOMINATION');
                return true;
            }

            // Scientific: completed ascension protocol
            if (faction.hasTech('ascension_protocol') && this.buildingManager.hasVictoryBuilding(faction.id, 'ascension_matrix')) {
                this._declareVictory(faction, 'SCIENTIFIC');
                return true;
            }

            // Cultural: ark beacon maintained for 5 turns (arkTurns incremented in _startNewTurn)
            if (faction.arkTurns >= 5 && this.buildingManager.hasVictoryBuilding(faction.id, 'ark_beacon')) {
                this._declareVictory(faction, 'CULTURAL');
                return true;
            }

            // Elimination: all other factions have no settlements and no units
            const otherFactions = this.factions.filter(f => f.id !== faction.id);
            const allEliminated = otherFactions.every(other => {
                const settlements = this.gameMap.getSettlementsByOwner(other.id);
                const units = this.unitManager.getUnitsByOwner(other.id);
                return settlements.length === 0 && units.length === 0;
            });
            if (allEliminated && otherFactions.length > 0) {
                this._declareVictory(faction, 'DOMINATION');
                return true;
            }
        }

        return false;
    }

    _declareVictory(faction, condition) {
        this.gameOver = true;
        this.winner = faction;
        this.winCondition = condition;
        this.logMessage(`${faction.name} achieves ${WIN_CONDITIONS[condition].name} victory!`, '');
    }

    // Message logging
    logMessage(message, type = '') {
        this.messageLog.push({ message, type, turn: this.turn });
        if (this.messageLog.length > 50) {
            this.messageLog.shift();
        }
    }

    // Get game state summary
    getState() {
        return {
            turn: this.turn,
            phase: this.phase,
            playerFaction: this.playerFaction?.toJSON(),
            factions: this.factions.map(f => ({
                id: f.id,
                name: f.name,
                color: f.color,
                isPlayer: f.isPlayer,
                settlements: this.gameMap.getSettlementsByOwner(f.id).length,
                units: this.unitManager.getUnitsByOwner(f.id).length,
                resources: { ...f.resources }
            })),
            gameOver: this.gameOver,
            winner: this.winner?.id,
            winCondition: this.winCondition
        };
    }
}
