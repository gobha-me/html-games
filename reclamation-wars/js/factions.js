// === FACTION MANAGEMENT ===
class Faction {
    constructor(config, isPlayer = false) {
        this.id = config.id;
        this.name = config.name;
        this.color = config.color;
        this.description = config.description;
        this.bonus = config.bonus;
        this.startingTech = [...config.startingTech];
        this.personality = config.personality;
        this.startingUnits = { ...config.startingUnits };
        this.resourceBonus = { ...config.resourceBonus };
        this.isPlayer = isPlayer;

        // Game state
        this.resources = {
            scrap: 5,
            energy: 3,
            data: 2,
            food: 5,
            population: 3
        };

        this.researched = new Set(this.startingTech);
        this.currentResearch = null;
        this.researchProgress = 0;
        this.units = [];
        this.diplomacy = {}; // factionId -> { state, turns, hostility }
        this.turnsAtWar = 0;
        this.settlements = [];
        this.totalKills = 0;
        this.arkTurns = 0; // For cultural victory
    }

    getResource(type) {
        return this.resources[type] || 0;
    }

    addResource(type, amount) {
        this.resources[type] = (this.resources[type] || 0) + amount;
    }

    canAfford(cost) {
        for (const [type, amount] of Object.entries(cost)) {
            if ((this.resources[type] || 0) < amount) return false;
        }
        return true;
    }

    spend(cost) {
        for (const [type, amount] of Object.entries(cost)) {
            this.resources[type] -= amount;
        }
    }

    hasTech(techId) {
        return this.researched.has(techId);
    }

    canResearch(techId) {
        const tech = RESEARCH_TREE[techId];
        if (!tech || this.researched.has(techId)) return false;
        if (this.currentResearch) return false;

        // Check prerequisites
        for (const req of tech.requires) {
            if (!this.researched.has(req)) return false;
        }

        return true;
    }

    startResearch(techId) {
        if (!this.canResearch(techId)) return false;
        this.currentResearch = techId;
        this.researchProgress = 0;
        return true;
    }

    getResearchCost(techId) {
        const tech = RESEARCH_TREE[techId];
        if (!tech) return { data: 999 };

        let cost = { ...tech.cost };

        // Apply discounts
        if (this.hasTech('neural_networks')) {
            cost.data = Math.max(1, (cost.data || 0) - 1);
        }
        if (this.hasTech('quantum_computing')) {
            for (const key of Object.keys(cost)) {
                cost[key] = Math.max(1, Math.floor(cost[key] * 0.5));
            }
        }

        return cost;
    }

    advanceResearch(amount) {
        if (!this.currentResearch) return false;

        const cost = this.getResearchCost(this.currentResearch);
        this.researchProgress += amount;

        // Check if research is complete
        const totalCost = Object.values(cost).reduce((a, b) => a + b, 0);
        if (this.researchProgress >= totalCost) {
            this.researched.add(this.currentResearch);
            const completed = this.currentResearch;
            this.currentResearch = null;
            this.researchProgress = 0;
            return completed;
        }
        return false;
    }

    getAvailableResearch() {
        const available = [];
        for (const [id, tech] of Object.entries(RESEARCH_TREE)) {
            if (!this.researched.has(id) && !this.currentResearch) {
                // Check prerequisites
                const prereqsMet = tech.requires.every(req => this.researched.has(req));
                if (prereqsMet) {
                    available.push({ id, ...tech });
                }
            }
        }
        return available.sort((a, b) => a.tier - b.tier);
    }

    getAvailableProduction() {
        const available = [];
        for (const [id, unit] of Object.entries(UNIT_TYPES)) {
            if (!unit.requires || this.hasTech(unit.requires)) {
                available.push({ id, ...unit, type: 'unit' });
            }
        }
        for (const [id, building] of Object.entries(BUILDINGS)) {
            if (!building.requires || this.hasTech(building.requires)) {
                available.push({ id, ...building, type: 'building' });
            }
        }
        return available;
    }

    getDiplomacyState(otherFactionId) {
        return this.diplomacy[otherFactionId] || { state: 'NEUTRAL', turns: 0, hostility: 0.5 };
    }

    setDiplomacyState(otherFactionId, state, turns = 0) {
        this.diplomacy[otherFactionId] = {
            state,
            turns,
            hostility: DIPLOMACY_STATES[state].hostility
        };
    }

    isAtWar(otherFactionId) {
        return this.getDiplomacyState(otherFactionId).state === 'AT_WAR';
    }

    declareWar(otherFactionId) {
        this.setDiplomacyState(otherFactionId, 'AT_WAR');
        this.turnsAtWar++;
    }

    makePeace(otherFactionId) {
        this.setDiplomacyState(otherFactionId, 'NEUTRAL');
        this.turnsAtWar = 0;
    }

    // Apply faction-specific bonuses
    applyBonuses() {
        // Resource bonuses per turn
        for (const [type, amount] of Object.entries(this.resourceBonus)) {
            this.addResource(type, amount);
        }

        // Ironclad: production bonus
        if (this.id === 'ironclad') {
            // Handled in production cost calculation
        }

        // Dust Runners: ruin bonus
        if (this.id === 'dust_runners') {
            // Handled in resource collection
        }
    }

    getProductionDiscount() {
        if (this.id === 'ironclad') return 0.75; // 25% less scrap cost
        if (this.hasTech('automated_production')) return 0.75;
        return 1.0;
    }

    getUnitCost(unitId) {
        const unit = UNIT_TYPES[unitId];
        if (!unit) return null;

        let cost = { ...unit.cost };
        const discount = this.getProductionDiscount();

        if (cost.scrap) {
            cost.scrap = Math.max(1, Math.floor(cost.scrap * discount));
        }

        return cost;
    }

    getMoveBonus() {
        if (this.id === 'dust_runners') return 1;
        return 0;
    }

    getDefenseBonus(terrain) {
        if (this.id === 'greenwardens' && terrain === 'FOREST') return 2;
        return 0;
    }

    getHealBonus() {
        if (this.hasTech('medicine')) return 2;
        return 0;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            color: this.color,
            isPlayer: this.isPlayer,
            resources: { ...this.resources },
            researched: Array.from(this.researched),
            currentResearch: this.currentResearch,
            researchProgress: this.researchProgress,
            diplomacy: { ...this.diplomacy },
            totalKills: this.totalKills,
            arkTurns: this.arkTurns
        };
    }
}
