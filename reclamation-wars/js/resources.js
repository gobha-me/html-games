// === RESOURCE MANAGEMENT ===
class ResourceManager {
    constructor(gameMap, factions) {
        this.map = gameMap;
        this.factions = factions;
    }

    // Collect resources for a faction from all their settlements
    collectResources(faction) {
        const settlements = this.map.getSettlementsByOwner(faction.id);
        const yields = { scrap: 0, energy: 0, data: 0, food: 0 };

        for (const settlement of settlements) {
            const hexYield = this.map.getYield(settlement, faction.id);
            for (const [type, amount] of Object.entries(hexYield)) {
                yields[type] = (yields[type] || 0) + amount;
            }
        }

        // Apply faction bonuses
        if (faction.id === 'greenwardens') {
            yields.food = Math.floor(yields.food * 1.5);
        }
        if (faction.id === 'arcane_engineers') {
            yields.energy = Math.floor(yields.energy * 1.25);
        }
        if (faction.id === 'dust_runners') {
            // Bonus from ruins
            for (const settlement of settlements) {
                if (this.map.isRuins(settlement)) {
                    yields.scrap += 2;
                    yields.data += 1;
                }
            }
        }

        // Apply research bonuses
        if (faction.hasTech('data_synthesis')) {
            yields.data += 1;
        }
        if (faction.hasTech('bio_engineering')) {
            yields.food += 2;
        }
        if (faction.hasTech('energy_manipulation')) {
            yields.energy += 2;
        }
        if (faction.hasTech('power_grid')) {
            yields.energy += 3;
        }
        if (faction.hasTech('fusion_power')) {
            yields.energy += 5;
        }

        // Add to faction resources
        for (const [type, amount] of Object.entries(yields)) {
            if (amount > 0) {
                faction.addResource(type, amount);
            }
        }

        // Population growth (if enough food)
        if (faction.getResource('food') >= faction.getResource('population') * 2) {
            faction.addResource('population', 1);
        }

        return yields;
    }

    // Collect resources from a single hex (for ruins exploration, etc.)
    collectFromHex(faction, hex) {
        if (!this.map.hasResource(hex) && !this.map.isRuins(hex)) {
            return null;
        }

        const yields = { scrap: 0, energy: 0, data: 0, food: 0 };

        if (this.map.hasResource(hex)) {
            const res = this.map.getResource(hex);
            yields[res.type.toLowerCase()] = res.amount;
        }

        if (this.map.isRuins(hex)) {
            yields.scrap += 2;
            yields.data += 1;

            if (faction.id === 'dust_runners') {
                yields.scrap += 2;
            }
            if (faction.hasTech('advanced_salvage')) {
                yields.scrap *= 2;
                yields.data *= 2;
            }
        }

        // Consume the resource
        this.map.resources.delete(hex.key());
        if (this.map.isRuins(hex)) {
            this.map.ruins.delete(hex.key());
            this.map.terrain.set(hex.key(), 'WASTELAND');
        }

        for (const [type, amount] of Object.entries(yields)) {
            if (amount > 0) {
                faction.addResource(type, amount);
            }
        }

        return yields;
    }

    // Calculate total income for display
    calculateIncome(faction) {
        const settlements = this.map.getSettlementsByOwner(faction.id);
        const income = { scrap: 0, energy: 0, data: 0, food: 0 };

        for (const settlement of settlements) {
            const yield_ = this.map.getYield(settlement, faction.id);
            for (const [type, amount] of Object.entries(yield_)) {
                income[type] = (income[type] || 0) + amount;
            }
        }

        // Add faction bonuses
        for (const [type, amount] of Object.entries(faction.resourceBonus)) {
            income[type] = (income[type] || 0) + amount;
        }

        // Add research bonuses
        if (faction.hasTech('data_synthesis')) income.data += 1;
        if (faction.hasTech('bio_engineering')) income.food += 2;
        if (faction.hasTech('energy_manipulation')) income.energy += 2;
        if (faction.hasTech('power_grid')) income.energy += 3;
        if (faction.hasTech('fusion_power')) income.energy += 5;

        return income;
    }
}
