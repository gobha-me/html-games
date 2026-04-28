// === MAP GENERATION ===
class GameMap {
    constructor(size, grid) {
        this.size = size; // 'small', 'medium', 'large'
        this.grid = grid; // HexGrid instance
        this.terrain = new Map(); // hexKey -> terrain type
        this.resources = new Map(); // hexKey -> { type, amount }
        this.ruins = new Set(); // hexKeys with ruins
        this.settlements = new Map(); // hexKey -> { owner, buildings }
        this._generate();
    }

    _generate() {
        const config = MAP_SIZES[this.size];
        const allHexes = this.grid.getAllHexes();

        // Initialize all as plains
        for (const hex of allHexes) {
            this.terrain.set(hex.key(), 'PLAINS');
        }

        // Generate terrain clusters using simple cellular automata
        this._generateTerrain(allHexes, config);

        // Place resources
        this._placeResources(allHexes, config);

        // Place ancient ruins
        this._placeRuins(allHexes);

        // Generate starting positions for factions
        this._generateStartingPositions();
    }

    _generateTerrain(allHexes, config) {
        // Seed random terrain patches
        const numPatches = Math.floor(allHexes.length * 0.15);
        const terrainTypes = ['FOREST', 'MOUNTAIN', 'DESERT', 'SWAMP', 'WASTELAND'];

        for (let i = 0; i < numPatches; i++) {
            const seedHex = allHexes[Math.floor(Math.random() * allHexes.length)];
            const terrainType = terrainTypes[Math.floor(Math.random() * terrainTypes.length)];
            this._spreadTerrain(seedHex, terrainType, 2 + Math.floor(Math.random() * 3));
        }

        // Add some water bodies (lakes)
        const numLakes = Math.floor(allHexes.length * 0.03);
        for (let i = 0; i < numLakes; i++) {
            const seedHex = allHexes[Math.floor(Math.random() * allHexes.length)];
            this._spreadTerrain(seedHex, 'WATER', 1 + Math.floor(Math.random() * 2));
        }
    }

    _spreadTerrain(startHex, terrainType, radius) {
        const hexes = this.grid.getHexesInRange(startHex, radius);
        for (const hex of hexes) {
            if (Math.random() < 0.6) {
                this.terrain.set(hex.key(), terrainType);
            }
        }
    }

    _placeResources(allHexes, config) {
        const numResources = Math.floor(allHexes.length * config.resources);
        const resourceTypes = Object.keys(RESOURCE_TYPES).filter(r => r !== 'POPULATION');

        for (let i = 0; i < numResources; i++) {
            const hex = allHexes[Math.floor(Math.random() * allHexes.length)];
            const type = resourceTypes[Math.floor(Math.random() * resourceTypes.length)];
            const amount = 1 + Math.floor(Math.random() * 3);

            this.resources.set(hex.key(), { type, amount });
        }
    }

    _placeRuins(allHexes) {
        const numRuins = Math.floor(allHexes.length * 0.08);
        const eligibleHexes = allHexes.filter(h => this.terrain.get(h.key()) === 'PLAINS' || this.terrain.get(h.key()) === 'WASTELAND');

        for (let i = 0; i < numRuins; i++) {
            if (eligibleHexes.length === 0) break;
            const idx = Math.floor(Math.random() * eligibleHexes.length);
            const hex = eligibleHexes.splice(idx, 1)[0];
            this.ruins.add(hex.key());
            this.terrain.set(hex.key(), 'RUINS');
        }
    }

    _generateStartingPositions() {
        const allHexes = this.grid.getAllHexes();
        // Find edge positions for faction starts
        this.startingPositions = [];

        // Get corners and edges
        const edges = allHexes.filter(h =>
            h.q === 0 || h.r === 0 || h.q >= this.grid.cols - 1 || h.r >= this.grid.rows - 1
        );

        // Spread starting positions around the map
        const numPositions = 5; // Max factions
        const step = Math.floor(edges.length / numPositions);

        for (let i = 0; i < numPositions; i++) {
            const hex = edges[(i * step) % edges.length];
            this.startingPositions.push(hex);
        }
    }

    getTerrain(hex) {
        return TERRAIN[this.terrain.get(hex.key())] || TERRAIN.PLAINS;
    }

    hasResource(hex) {
        return this.resources.has(hex.key());
    }

    getResource(hex) {
        return this.resources.get(hex.key());
    }

    isRuins(hex) {
        return this.ruins.has(hex.key());
    }

    getSettlement(hex) {
        return this.settlements.get(hex.key());
    }

    addSettlement(hex, owner) {
        this.settlements.set(hex.key(), {
            owner,
            buildings: [],
            hp: 10
        });
    }

    removeSettlement(hex) {
        this.settlements.delete(hex.key());
    }

    getSettlementsByOwner(owner) {
        const result = [];
        for (const [key, settlement] of this.settlements) {
            if (settlement.owner === owner) {
                result.push({ key: Hex.fromKey(key), ...settlement });
            }
        }
        return result;
    }

    getTotalSettlements() {
        return this.settlements.size;
    }

    // Get resource yield for a hex
    getYield(hex, owner) {
        const terrain = this.getTerrain(hex);
        let yield_ = { scrap: 0, energy: 0, data: 0, food: 0 };

        // Base terrain yield
        switch (this.terrain.get(hex.key())) {
            case 'PLAINS': yield_.food = 1; break;
            case 'FOREST': yield_.scrap = 1; break;
            case 'DESERT': yield_.energy = 1; break;
            case 'RUINS': yield_.scrap = 2; yield_.data = 1; break;
        }

        // Resource bonus
        if (this.hasResource(hex)) {
            const res = this.getResource(hex);
            yield_[res.type.toLowerCase()] = (yield_[res.type.toLowerCase()] || 0) + res.amount;
        }

        // Settlement bonus
        const settlement = this.getSettlement(hex);
        if (settlement && settlement.owner === owner) {
            for (const building of settlement.buildings) {
                const bData = BUILDINGS[building];
                if (bData && bData.production) {
                    for (const [type, amount] of Object.entries(bData.production)) {
                        yield_[type] = (yield_[type] || 0) + amount;
                    }
                }
            }
        }

        return yield_;
    }
}
