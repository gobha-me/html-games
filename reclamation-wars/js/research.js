// === RESEARCH SYSTEM ===
class ResearchSystem {
    constructor(factions) {
        this.factions = factions;
    }

    // Get available research for a faction
    getAvailable(faction) {
        const available = [];
        for (const [id, tech] of Object.entries(RESEARCH_TREE)) {
            if (faction.researched.has(id)) continue;
            if (faction.currentResearch && faction.currentResearch !== id) continue;

            // Check prerequisites
            const prereqsMet = tech.requires.every(req => faction.researched.has(req));
            if (prereqsMet) {
                available.push({
                    id,
                    ...tech,
                    cost: faction.getResearchCost(id),
                    canAfford: faction.canAfford(faction.getResearchCost(id))
                });
            }
        }
        return available.sort((a, b) => a.tier - b.tier);
    }

    // Start research on a technology
    startResearch(faction, techId) {
        if (!faction.canResearch(techId)) return false;
        const cost = faction.getResearchCost(techId);
        if (!faction.canAfford(cost)) return false;

        faction.spend(cost);
        faction.startResearch(techId);
        return true;
    }

    // Advance research for all factions
    advanceAll() {
        const completed = [];

        for (const faction of this.factions) {
            if (faction.currentResearch) {
                // Research labs give bonus
                const settlements = faction.settlements || [];
                let researchPoints = 1; // Base

                for (const settlement of settlements) {
                    if (settlement.buildings && settlement.buildings.includes('research_lab')) {
                        researchPoints += 1;
                    }
                }

                // Technician bonus
                const technicians = faction.units.filter(u => u.type === 'technician');
                researchPoints += technicians.length * 0.5;

                const result = faction.advanceResearch(researchPoints);
                if (result) {
                    completed.push({ faction: faction.id, tech: result });
                }
            }
        }

        return completed;
    }

    // Get research progress for display
    getProgress(faction) {
        if (!faction.currentResearch) return null;

        const tech = RESEARCH_TREE[faction.currentResearch];
        const cost = faction.getResearchCost(faction.currentResearch);
        const totalCost = Object.values(cost).reduce((a, b) => a + b, 0);
        const progress = faction.researchProgress;

        return {
            techId: faction.currentResearch,
            techName: tech.name,
            progress,
            totalCost,
            percentage: Math.min(100, Math.floor((progress / totalCost) * 100))
        };
    }

    // Get tech tree visualization data
    getTechTree(faction) {
        const nodes = [];
        const edges = [];

        for (const [id, tech] of Object.entries(RESEARCH_TREE)) {
            nodes.push({
                id,
                name: tech.name,
                tier: tech.tier,
                researched: faction.researched.has(id),
                current: faction.currentResearch === id,
                available: faction.canResearch(id),
                cost: faction.getResearchCost(id)
            });

            for (const req of tech.requires) {
                edges.push({ from: req, to: id });
            }
        }

        return { nodes, edges };
    }
}
