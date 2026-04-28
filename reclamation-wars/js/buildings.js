// === BUILDING MANAGEMENT ===
class BuildingManager {
    constructor(gameMap) {
        this.map = gameMap;
    }

    // Check if a building can be constructed
    canBuild(faction, buildingId, hex) {
        const building = BUILDINGS[buildingId];
        if (!building) return false;

        // Check tech requirement
        if (building.requires && !faction.hasTech(building.requires)) {
            return false;
        }

        // Check if hex has a settlement
        const settlement = this.map.getSettlement(hex);
        if (!settlement || settlement.owner !== faction.id) {
            return false;
        }

        // Check if faction can afford
        if (!faction.canAfford(building.cost)) {
            return false;
        }

        // Check if building already exists
        if (settlement.buildings.includes(buildingId)) {
            return false;
        }

        return true;
    }

    // Build a structure
    build(faction, buildingId, hex) {
        if (!this.canBuild(faction, buildingId, hex)) return false;

        const building = BUILDINGS[buildingId];
        faction.spend(building.cost);

        const settlement = this.map.getSettlement(hex);
        settlement.buildings.push(buildingId);

        return true;
    }

    // Get available buildings for a settlement
    getAvailableBuildings(faction, hex) {
        const settlement = this.map.getSettlement(hex);
        if (!settlement || settlement.owner !== faction.id) return [];

        const available = [];
        for (const [id, building] of Object.entries(BUILDINGS)) {
            if (!settlement.buildings.includes(id)) {
                if (!building.requires || faction.hasTech(building.requires)) {
                    available.push({
                        id,
                        ...building,
                        canAfford: faction.canAfford(building.cost)
                    });
                }
            }
        }
        return available;
    }

    // Destroy a building (combat damage)
    destroyBuilding(hex, buildingId) {
        const settlement = this.map.getSettlement(hex);
        if (!settlement) return false;

        const idx = settlement.buildings.indexOf(buildingId);
        if (idx >= 0) {
            settlement.buildings.splice(idx, 1);
            return true;
        }
        return false;
    }

    // Get building count by type for a faction
    getBuildingCount(factionId, buildingId) {
        let count = 0;
        for (const [key, settlement] of this.map.settlements) {
            if (settlement.owner === factionId && settlement.buildings.includes(buildingId)) {
                count++;
            }
        }
        return count;
    }

    // Check for victory buildings
    hasVictoryBuilding(factionId, buildingId) {
        for (const [key, settlement] of this.map.settlements) {
            if (settlement.owner === factionId && settlement.buildings.includes(buildingId)) {
                return true;
            }
        }
        return false;
    }
}
