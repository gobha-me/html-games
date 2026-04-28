// === AI SYSTEM ===
class AIController {
    constructor(faction, game) {
        this.faction = faction;
        this.game = game;
        this.personality = AI_PERSONALITIES[faction.personality];
        this.memory = {
            targets: [],
            threats: [],
            lastResearch: null,
            warTurns: 0,
            expansionTargets: []
        };
    }

    // Main AI turn execution
    async executeTurn() {
        // Small delay for visual pacing
        await this.delay(300);

        // Phase 1: Collect resources
        this.game.resourceManager.collectResources(this.faction);

        // Phase 2: Research
        this.decideResearch();
        await this.delay(200);

        // Phase 3: Production
        this.decideProduction();
        await this.delay(200);

        // Phase 4: Diplomacy
        this.decideDiplomacy();
        await this.delay(200);

        // Phase 5: Move units and attack
        await this.executeUnitActions();

        // Phase 6: Settle new territories
        this.decideExpansion();
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // === RESEARCH DECISIONS ===
    decideResearch() {
        if (this.faction.currentResearch) return;

        const available = this.game.researchSystem.getAvailable(this.faction);
        if (available.length === 0) return;

        // Score each technology
        const scored = available.map(tech => {
            let score = 0;

            // Personality weights
            if (tech.effect?.unitAttackBonus) score += this.personality.attackWeight * 10;
            if (tech.effect?.buildingDefense) score += this.personality.defenseWeight * 10;
            if (tech.unlocks?.includes('tank') || tech.unlocks?.includes('mech')) {
                score += this.personality.attackWeight * 15;
            }
            if (tech.unlocks?.includes('terraform_action')) {
                score += this.personality.expandWeight * 8;
            }

            // Victory tech priority (scale based on game progress)
            if (tech.tier === 4) {
                const progress = this.game.turn / 50; // Scale with game length
                score += progress * 20;
            }

            // Resource production techs always valuable
            if (tech.effect?.scrapPerTurn || tech.effect?.energyPerTurn || tech.effect?.dataPerTurn || tech.effect?.foodPerTurn) {
                score += 8;
            }

            // Research efficiency
            if (tech.effect?.researchDiscount) score += 12;

            // Affordability bonus
            if (tech.canAfford) score += 5;

            // Random factor to feel less predictable
            score += Math.random() * 3;

            return { ...tech, score };
        });

        // Pick best affordable tech
        scored.sort((a, b) => b.score - a.score);
        const chosen = scored.find(t => t.canAfford) || scored[0];

        if (chosen) {
            this.game.researchSystem.startResearch(this.faction, chosen.id);
            this.memory.lastResearch = chosen.id;
            this.game.logMessage(`${this.faction.name} is researching ${chosen.name}`, 'research');
        }
    }

    // === PRODUCTION DECISIONS ===
    decideProduction() {
        const settlements = this.game.gameMap.getSettlementsByOwner(this.faction.id);

        for (const settlement of settlements) {
            this.produceForSettlement(settlement);
        }
    }

    produceForSettlement(settlement) {
        const hex = settlement.hex;
        const available = this.faction.getAvailableProduction();
        if (available.length === 0) return;

        // Decide what to produce based on current needs
        const needs = this.assessNeeds();

        // Score production options
        const scored = available.map(item => {
            let score = 0;

            if (item.type === 'unit') {
                // Military needs
                if (needs.military > 0.6) score += 15;
                if (item.id === 'scout' && needs.scouts) score += 10;
                if (item.id === 'infantry' && needs.infantry) score += 8;
                if ((item.id === 'tank' || item.id === 'mech') && needs.heavy) score += 20;

                // Affordability
                if (this.faction.canAfford(this.faction.getUnitCost(item.id))) {
                    score += 5;
                }
            } else if (item.type === 'building') {
                // Infrastructure needs
                if (needs.infrastructure > 0.6) score += 12;
                if (item.id === 'workshop' && !settlement.buildings.includes('workshop')) score += 10;
                if (item.id === 'generator' && this.faction.getResource('energy') < 5) score += 10;
                if (item.id === 'farm' && this.faction.getResource('food') < 5) score += 10;
                if (item.id === 'research_lab' && !this.faction.currentResearch) score += 8;
                if (item.id === 'fortress' && needs.defense) score += 15;

                // Victory buildings
                if (item.id === 'orbital_platform' || item.id === 'ark_beacon' || item.id === 'ascension_matrix') {
                    score += 25;
                }

                if (this.faction.canAfford(item.cost)) score += 5;
            }

            score += Math.random() * 2;
            return { ...item, score };
        });

        scored.sort((a, b) => b.score - a.score);
        const chosen = scored[0];

        if (chosen && this.faction.canAfford(chosen.type === 'unit' ? this.faction.getUnitCost(chosen.id) : chosen.cost)) {
            if (chosen.type === 'unit') {
                const cost = this.faction.getUnitCost(chosen.id);
                this.faction.spend(cost);
                this.game.unitManager.createUnit(chosen.id, this.faction.id, hex);
                this.game.logMessage(`${this.faction.name} produced ${chosen.name}`, 'production');
            } else {
                this.game.buildingManager.build(this.faction, chosen.id, hex);
                this.game.logMessage(`${this.faction.name} built ${chosen.name}`, 'production');
            }
        }
    }

    assessNeeds() {
        const needs = {
            military: 0,
            infrastructure: 0,
            scouts: false,
            infantry: false,
            heavy: false,
            defense: false
        };

        // Count units
        const myUnits = this.game.unitManager.getUnitsByOwner(this.faction.id);
        const militaryUnits = myUnits.filter(u => u.attack > 0);

        // Check for nearby threats
        const threats = this.detectThreats();
        if (threats.length > 0) {
            needs.military = 0.8;
            needs.defense = true;
        }

        // Need more military if at war
        for (const [otherId, diplo] of Object.entries(this.faction.diplomacy)) {
            if (diplo.state === 'AT_WAR') {
                needs.military = 0.9;
                const enemyUnits = this.game.unitManager.getUnitsByOwner(otherId);
                if (enemyUnits.length > militaryUnits.length) {
                    needs.heavy = true;
                }
            }
        }

        // Need scouts if map not fully explored
        const scouts = myUnits.filter(u => u.type === 'scout');
        if (scouts.length < 2) {
            needs.scouts = true;
        }

        // Need infantry as base military
        const infantry = myUnits.filter(u => u.type === 'infantry' || u.type === 'rifleman');
        if (infantry.length < 3) {
            needs.infantry = true;
        }

        // Infrastructure need based on settlement count
        const settlements = this.game.gameMap.getSettlementsByOwner(this.faction.id);
        if (settlements.length < 3) {
            needs.infrastructure = 0.7;
        }

        return needs;
    }

    detectThreats() {
        const threats = [];
        const mySettlements = this.game.gameMap.getSettlementsByOwner(this.faction.id);

        for (const settlement of mySettlements) {
            const nearbyEnemies = this.game.unitManager.getUnitsInRange(settlement.hex, 3).filter(u => u.owner !== this.faction.id);
            if (nearbyEnemies.length > 0) {
                threats.push({ settlement, enemies: nearbyEnemies });
            }
        }

        return threats;
    }

    // === DIPLOMACY DECISIONS ===
    decideDiplomacy() {
        for (const otherFaction of this.game.factions) {
            if (otherFaction.id === this.faction.id) continue;

            const currentDiplo = this.faction.getDiplomacyState(otherFaction.id);
            const myPower = this.calculatePower(this.faction);
            const theirPower = this.calculatePower(otherFaction);
            const powerRatio = myPower / Math.max(1, theirPower);

            // Personality influences diplomacy
            const aggression = this.personality.diplomacyAggression;

            // Declare war if much stronger and aggressive
            if (currentDiplo.state !== 'AT_WAR' && powerRatio > 2.0 && aggression > 0.6 && Math.random() < aggression * 0.3) {
                this.faction.declareWar(otherFaction.id);
                otherFaction.declareWar(this.faction.id);
                this.game.logMessage(`${this.faction.name} declared war on ${otherFaction.name}!`, 'diplomacy');
            }

            // Make peace if losing and war has been long
            if (currentDiplo.state === 'AT_WAR' && powerRatio < 0.5 && this.faction.turnsAtWar > 5) {
                if (Math.random() < 0.3) {
                    this.faction.makePeace(otherFaction.id);
                    otherFaction.makePeace(this.faction.id);
                    this.game.logMessage(`${this.faction.name} seeks peace with ${otherFaction.name}`, 'diplomacy');
                }
            }

            // Opportunistic: attack weakened neighbors
            if (currentDiplo.state === 'NEUTRAL' && powerRatio > 1.5 && aggression > 0.4) {
                const theirSettlements = this.game.gameMap.getSettlementsByOwner(otherFaction.id);
                if (theirSettlements.length <= 1 && Math.random() < 0.15 * aggression) {
                    this.faction.declareWar(otherFaction.id);
                    otherFaction.declareWar(this.faction.id);
                    this.game.logMessage(`${this.faction.name} declared war on ${otherFaction.name}!`, 'diplomacy');
                }
            }
        }
    }

    calculatePower(faction) {
        const units = this.game.unitManager.getUnitsByOwner(faction.id);
        let power = 0;
        for (const unit of units) {
            power += unit.attack + unit.defense + (unit.hp / unit.maxHp) * 5;
        }
        const settlements = this.game.gameMap.getSettlementsByOwner(faction.id);
        power += settlements.length * 5;
        return power;
    }

    // === UNIT ACTIONS ===
    async executeUnitActions() {
        const myUnits = this.game.unitManager.getUnitsByOwner(this.faction.id);

        // Sort units: military first, then others
        const militaryUnits = myUnits.filter(u => u.attack > 0);
        const otherUnits = myUnits.filter(u => u.attack === 0);

        // Execute military actions
        for (const unit of militaryUnits) {
            if (unit.hp <= 0) continue;

            // Refresh unit state
            unit.resetTurn();

            // Try to attack
            const targets = this.game.unitManager.getAttackTargets(unit);
            if (targets.length > 0) {
                // Pick best target (weakest)
                targets.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
                const target = targets[0];

                // Only attack if likely to win or personality is aggressive
                const winChance = (unit.attack + unit.defense) / (target.defense + target.attack);
                if (winChance > 0.6 || this.personality.attackWeight > 0.6) {
                    await this.moveTowards(unit, target.hex);
                    if (!unit.hasAttacked && unit.hex.distance(target.hex) <= unit.range) {
                        this.executeAttack(unit, target);
                    }
                }
            }

            // Move towards enemy settlements if no targets
            if (!unit.hasMoved) {
                const enemySettlement = this.findNearestEnemySettlement(unit);
                if (enemySettlement) {
                    await this.moveTowards(unit, enemySettlement);
                }
            }

            await this.delay(150);
        }

        // Execute non-military actions
        for (const unit of otherUnits) {
            if (unit.hp <= 0) continue;
            unit.resetTurn();

            // Technicians heal nearby units
            if (unit.type === 'technician') {
                const wounded = this.game.unitManager.getUnitsInRange(unit.hex, 2, this.faction.id)
                    .filter(u => u.hp < u.maxHp && u !== unit);
                if (wounded.length > 0) {
                    wounded[0].heal(2);
                    this.game.logMessage(`${unit.name} repaired ${wounded[0].name}`, 'production');
                }
            }

            // Scouts explore
            if (unit.type === 'scout' && !unit.hasMoved) {
                const target = this.findUnexploredHex(unit);
                if (target) {
                    await this.moveTowards(unit, target);
                }
            }

            await this.delay(100);
        }
    }

    async moveTowards(unit, targetHex) {
        if (unit.hasMoved) return;

        const path = this.game.gameMap.grid.getPath(unit.hex, targetHex, (hex) => {
            const terrain = this.game.gameMap.getTerrain(hex);
            return terrain.moveCost < 99 && this.game.unitManager.getEnemyUnitsOnHex(hex, this.faction.id).length === 0;
        });

        if (path && path.length > 1) {
            // Move as far as possible along path
            let movesLeft = unit.movementLeft;
            for (let i = 1; i < path.length && movesLeft > 0; i++) {
                const nextHex = path[i];
                const terrain = this.game.gameMap.getTerrain(nextHex);
                const cost = terrain.moveCost;
                if (cost <= movesLeft) {
                    unit.hex = nextHex;
                    movesLeft -= cost;
                } else {
                    break;
                }
            }
            unit.hasMoved = true;
        }
    }

    executeAttack(attacker, defender) {
        const result = this.game.unitManager.resolveCombat(attacker, defender, this.game);

        this.game.logMessage(
            `${attacker.name} attacks ${defender.name} for ${result.damage} damage!`,
            'combat'
        );

        if (result.defenderKilled) {
            this.game.unitManager.removeUnit(defender);
            this.faction.totalKills++;
            this.game.logMessage(`${defender.name} destroyed!`, 'combat');
        }
        if (result.attackerKilled) {
            this.game.unitManager.removeUnit(attacker);
            this.game.logMessage(`${attacker.name} destroyed in combat!`, 'combat');
        }
    }

    findNearestEnemySettlement(unit) {
        let nearest = null;
        let minDist = Infinity;

        for (const [key, settlement] of this.game.gameMap.settlements) {
            if (settlement.owner === this.faction.id) continue;
            const hex = Hex.fromKey(key);
            const dist = unit.hex.distance(hex);
            if (dist < minDist) {
                minDist = dist;
                nearest = hex;
            }
        }

        return nearest;
    }

    findUnexploredHex(unit) {
        const allHexes = this.game.gameMap.grid.getAllHexes();
        // Simple: find a random hex that's far from current position
        const distant = allHexes
            .filter(h => unit.hex.distance(h) > 3)
            .sort(() => Math.random() - 0.5);

        return distant[0] || null;
    }

    // === EXPANSION ===
    decideExpansion() {
        const mySettlements = this.game.gameMap.getSettlementsByOwner(this.faction.id);

        // Try to settle new locations
        if (mySettlements.length < 5) {
            // Find a good expansion target
            const allHexes = this.game.gameMap.grid.getAllHexes();
            const candidates = allHexes.filter(hex => {
                // Not already settled
                if (this.game.gameMap.getSettlement(hex)) return false;

                // Not water or mountain
                const terrain = this.game.gameMap.terrain.get(hex.key());
                if (terrain === 'WATER' || terrain === 'MOUNTAIN') return false;

                // Near existing settlement
                for (const settlement of mySettlements) {
                    if (hex.distance(settlement.hex) <= 3) return true;
                }
                return false;
            });

            if (candidates.length > 0) {
                // Pick best candidate (has resources)
                candidates.sort((a, b) => {
                    const aHasResource = this.game.gameMap.hasResource(a) ? 1 : 0;
                    const bHasResource = this.game.gameMap.hasResource(b) ? 1 : 0;
                    return bHasResource - aHasResource;
                });

                const target = candidates[0];
                // Send a unit to settle
                const nearbyUnits = this.game.unitManager.getUnitsInRange(target, 2, this.faction.id)
                    .filter(u => u.type === 'scout' || u.type === 'infantry');

                if (nearbyUnits.length > 0 && this.faction.canAfford({ scrap: 5 })) {
                    this.faction.spend({ scrap: 5 });
                    this.game.gameMap.addSettlement(target, this.faction.id);
                    this.game.logMessage(`${this.faction.name} established a new settlement!`, 'production');
                }
            }
        }
    }
}
