// === MAP CONFIGS ===
const MAP_SIZES = {
    small:  { cols: 8,  rows: 6,  resources: 0.15 },
    medium: { cols: 12, rows: 8,  resources: 0.18 },
    large:  { cols: 16, rows: 10, resources: 0.20 }
};

// === HEX TERRAIN TYPES ===
const TERRAIN = {
    PLAINS:     { name: 'Plains',     color: '#4a7a3a', moveCost: 1, defense: 0,  icon: '🌾' },
    FOREST:     { name: 'Forest',     color: '#2d5a1e', moveCost: 2, defense: 2,  icon: '🌲' },
    MOUNTAIN:   { name: 'Mountain',   color: '#6a6a6a', moveCost: 3, defense: 3,  icon: '⛰️' },
    DESERT:     { name: 'Desert',     color: '#c4a44a', moveCost: 1, defense: 0,  icon: '🏜️' },
    SWAMP:      { name: 'Swamp',      color: '#4a5a2a', moveCost: 2, defense: 1,  icon: '🌿' },
    RUINS:      { name: 'Ancient Ruins', color: '#5a4a7a', moveCost: 1, defense: 1, icon: '🏛️' },
    WATER:      { name: 'Water',      color: '#2a4a8a', moveCost: 99, defense: 0, icon: '🌊' },
    WASTELAND:  { name: 'Wasteland',  color: '#3a3a3a', moveCost: 1, defense: 0,  icon: '☢️' }
};

// === RESOURCES ===
const RESOURCE_TYPES = {
    SCRAP:      { name: 'Scrap',      icon: '🔩', color: '#aaa' },
    ENERGY:     { name: 'Energy',     icon: '⚡', color: '#ffcc00' },
    DATA:       { name: 'Data Cores', icon: '💾', color: '#00ccff' },
    FOOD:       { name: 'Food',       icon: '🍖', color: '#88cc44' },
    POPULATION: { name: 'Population', icon: '👥', color: '#cc88ff' }
};

// === FACTIONS ===
const FACTIONS = [
    {
        id: 'ironclad',
        name: 'Ironclad Syndicate',
        color: '#cc4444',
        description: 'Industrial militarists who believe strength comes from steel and fire.',
        bonus: '+25% production, units cost less scrap',
        startingTech: ['advanced_metallurgy', 'ballistics'],
        personality: 'aggressive', // AI personality
        startingUnits: { scout: 2, infantry: 2 },
        resourceBonus: { scrap: 1 }
    },
    {
        id: 'neon_collective',
        name: 'Neon Collective',
        color: '#00ccff',
        description: 'Data-worshipping technocrats seeking to rebuild the digital age.',
        bonus: '+25% research speed, starts with advanced data tech',
        startingTech: ['data_synthesis', 'neural_networks'],
        personality: 'expansionist',
        startingUnits: { scout: 2, technician: 1 },
        resourceBonus: { data: 1 }
    },
    {
        id: 'greenwardens',
        name: 'Greenwardens',
        color: '#44cc44',
        description: 'Eco-revivalists who blend old tech with nature to heal the world.',
        bonus: '+50% food production, forest terrain gives defense bonus',
        startingTech: ['bio_engineering', 'sustainable_agriculture'],
        personality: 'defensive',
        startingUnits: { scout: 1, infantry: 1, technician: 1 },
        resourceBonus: { food: 1 }
    },
    {
        id: 'dust_runners',
        name: 'Dust Runners',
        color: '#ccaa44',
        description: 'Nomadic scavengers who excel at finding and exploiting ruins.',
        bonus: '+50% resource yield from ruins, faster movement',
        startingTech: ['salvage_expertise', 'scout_enhancement'],
        personality: 'opportunistic',
        startingUnits: { scout: 3 },
        resourceBonus: { scrap: 1, energy: 1 }
    },
    {
        id: 'arcane_engineers',
        name: 'Arcane Engineers',
        color: '#cc66cc',
        description: 'Mystic technologists who discovered strange energy in the Collapse.',
        bonus: '+25% energy production, unique energy-based units',
        startingTech: ['energy_manipulation', 'force_fields'],
        personality: 'balanced',
        startingUnits: { scout: 1, infantry: 1, technician: 1 },
        resourceBonus: { energy: 2 }
    }
];

// === RESEARCH TREE ===
const RESEARCH_TREE = {
    // Tier 1 - Basic recovery
    advanced_metallurgy: {
        name: 'Advanced Metallurgy',
        cost: { data: 3 },
        tier: 1,
        description: 'Improved metalworking. Units gain +1 attack.',
        requires: [],
        effect: { unitAttackBonus: 1 }
    },
    ballistics: {
        name: 'Ballistics',
        cost: { data: 3, scrap: 2 },
        tier: 1,
        description: 'Ranged combat technology. Unlock ranged units.',
        requires: [],
        unlocks: ['rifleman']
    },
    data_synthesis: {
        name: 'Data Synthesis',
        cost: { data: 2 },
        tier: 1,
        description: 'Recover data processing. +1 data per turn.',
        requires: [],
        effect: { dataPerTurn: 1 }
    },
    neural_networks: {
        name: 'Neural Networks',
        cost: { data: 4 },
        tier: 1,
        description: 'AI-assisted research. -1 cost to all future research.',
        requires: [],
        effect: { researchDiscount: 1 }
    },
    bio_engineering: {
        name: 'Bio Engineering',
        cost: { data: 3, food: 2 },
        tier: 1,
        description: 'Genetic crop improvement. +2 food per turn.',
        requires: [],
        effect: { foodPerTurn: 2 }
    },
    sustainable_agriculture: {
        name: 'Sustainable Agriculture',
        cost: { data: 2, food: 1 },
        tier: 1,
        description: 'Efficient farming. Farms produce +1 food.',
        requires: [],
        effect: { farmBonus: 1 }
    },
    salvage_expertise: {
        name: 'Salvage Expertise',
        cost: { data: 2 },
        tier: 1,
        description: 'Better scavenging. +2 scrap from ruins.',
        requires: [],
        effect: { ruinBonus: 2 }
    },
    scout_enhancement: {
        name: 'Scout Enhancement',
        cost: { data: 2, scrap: 1 },
        tier: 1,
        description: 'Improved scouts. Scouts move +1 and see further.',
        requires: [],
        effect: { scoutBonus: 1 }
    },
    energy_manipulation: {
        name: 'Energy Manipulation',
        cost: { data: 3, energy: 2 },
        tier: 1,
        description: 'Harness energy. +2 energy per turn.',
        requires: [],
        effect: { energyPerTurn: 2 }
    },
    force_fields: {
        name: 'Force Fields',
        cost: { data: 4, energy: 3 },
        tier: 1,
        description: 'Defensive energy barriers. Buildings gain +2 defense.',
        requires: [],
        effect: { buildingDefense: 2 }
    },

    // Tier 2 - Intermediate
    mechanized_warfare: {
        name: 'Mechanized Warfare',
        cost: { data: 6, scrap: 5 },
        tier: 2,
        description: 'Unlock armored vehicles.',
        requires: ['advanced_metallurgy', 'ballistics'],
        unlocks: ['tank']
    },
    power_grid: {
        name: 'Power Grid',
        cost: { data: 5, scrap: 4 },
        tier: 2,
        description: 'Networked energy. +3 energy per turn.',
        requires: ['energy_manipulation'],
        effect: { energyPerTurn: 3 }
    },
    automated_production: {
        name: 'Automated Production',
        cost: { data: 6, scrap: 3 },
        tier: 2,
        description: 'Factory automation. Production costs -25%.',
        requires: ['advanced_metallurgy'],
        effect: { productionDiscount: 0.25 }
    },
    communications: {
        name: 'Communications',
        cost: { data: 5 },
        tier: 2,
        description: 'Long-range comms. See entire map. Diplomacy options expanded.',
        requires: ['data_synthesis'],
        effect: { revealMap: true }
    },
    medicine: {
        name: 'Medicine',
        cost: { data: 4, food: 3 },
        tier: 2,
        description: 'Medical advances. Units heal +2 per turn.',
        requires: ['bio_engineering'],
        effect: { healBonus: 2 }
    },
    advanced_salvage: {
        name: 'Advanced Salvage',
        cost: { data: 5, scrap: 3 },
        tier: 2,
        description: 'Deep ruin excavation. Ruins yield double resources.',
        requires: ['salvage_expertise'],
        effect: { ruinMultiplier: 2 }
    },

    // Tier 3 - Advanced
    robotics: {
        name: 'Robotics',
        cost: { data: 10, scrap: 8, energy: 5 },
        tier: 3,
        description: 'Autonomous combat units. Unlock mechs.',
        requires: ['mechanized_warfare', 'automated_production'],
        unlocks: ['mech']
    },
    fusion_power: {
        name: 'Fusion Power',
        cost: { data: 10, energy: 8 },
        tier: 3,
        description: 'Clean unlimited energy. +5 energy per turn.',
        requires: ['power_grid'],
        effect: { energyPerTurn: 5 }
    },
    terraforming: {
        name: 'Terraforming',
        cost: { data: 10, food: 8 },
        tier: 3,
        description: 'Reshape the land. Convert wasteland to plains.',
        requires: ['medicine', 'sustainable_agriculture'],
        unlocks: ['terraform_action']
    },
    quantum_computing: {
        name: 'Quantum Computing',
        cost: { data: 12 },
        tier: 3,
        description: 'Breakthrough processing. Research costs halved.',
        requires: ['communications', 'neural_networks'],
        effect: { researchDiscount: 0.5 }
    },

    // Tier 4 - Victory techs
    orbital_strike: {
        name: 'Orbital Strike Platform',
        cost: { data: 15, scrap: 15, energy: 15 },
        tier: 4,
        description: 'DOMINATION: Build an orbital weapon to control the skies.',
        requires: ['robotics', 'fusion_power'],
        unlocks: ['orbital_platform']
    },
    ark_project: {
        name: 'The Ark Project',
        cost: { data: 15, food: 15, energy: 10 },
        tier: 4,
        description: 'CULTURAL: Build a beacon of civilization to unite all survivors.',
        requires: ['terraforming', 'quantum_computing'],
        unlocks: ['ark_beacon']
    },
    ascension_protocol: {
        name: 'Ascension Protocol',
        cost: { data: 20, energy: 15 },
        tier: 4,
        description: 'SCIENTIFIC: Upload consciousness to a new digital existence.',
        requires: ['quantum_computing', 'fusion_power'],
        unlocks: ['ascension_matrix']
    }
};

// === UNITS ===
const UNIT_TYPES = {
    scout: {
        name: 'Scout',
        icon: '🔍',
        cost: { scrap: 2 },
        attack: 1,
        defense: 1,
        movement: 3,
        hp: 3,
        description: 'Fast reconnaissance unit.'
    },
    infantry: {
        name: 'Infantry',
        icon: '🔫',
        cost: { scrap: 3, food: 1 },
        attack: 2,
        defense: 2,
        movement: 2,
        hp: 5,
        description: 'Standard combat unit.'
    },
    rifleman: {
        name: 'Rifleman',
        icon: '🎯',
        cost: { scrap: 4, data: 1 },
        attack: 3,
        defense: 1,
        movement: 2,
        hp: 4,
        description: 'Ranged attacker. Can attack from 2 hexes away.',
        range: 2,
        requires: 'ballistics'
    },
    technician: {
        name: 'Technician',
        icon: '🔧',
        cost: { scrap: 2, data: 2 },
        attack: 0,
        defense: 1,
        movement: 2,
        hp: 3,
        description: 'Repairs buildings and speeds research.'
    },
    tank: {
        name: 'Tank',
        icon: '🛡️',
        cost: { scrap: 8, energy: 3 },
        attack: 5,
        defense: 4,
        movement: 2,
        hp: 10,
        description: 'Heavy armored unit.',
        requires: 'mechanized_warfare'
    },
    mech: {
        name: 'Mech',
        icon: '🤖',
        cost: { scrap: 12, energy: 6, data: 4 },
        attack: 7,
        defense: 5,
        movement: 3,
        hp: 15,
        description: 'Autonomous war machine.',
        requires: 'robotics'
    }
};

// === BUILDINGS ===
const BUILDINGS = {
    outpost: {
        name: 'Outpost',
        icon: '🏕️',
        cost: { scrap: 5 },
        description: 'Basic settlement. Generates resources.',
        production: { scrap: 1, food: 1 }
    },
    workshop: {
        name: 'Workshop',
        icon: '🔨',
        cost: { scrap: 8, energy: 2 },
        description: 'Production facility. +2 scrap per turn.',
        production: { scrap: 2 },
        requires: 'advanced_metallurgy'
    },
    generator: {
        name: 'Generator',
        icon: '⚡',
        cost: { scrap: 6, energy: 1 },
        description: 'Power source. +2 energy per turn.',
        production: { energy: 2 }
    },
    data_vault: {
        name: 'Data Vault',
        icon: '🗄️',
        cost: { scrap: 6, data: 3 },
        description: 'Data storage. +2 data per turn.',
        production: { data: 2 },
        requires: 'data_synthesis'
    },
    farm: {
        name: 'Farm',
        icon: '🌾',
        cost: { scrap: 4, food: 2 },
        description: 'Food production. +2 food per turn.',
        production: { food: 2 }
    },
    research_lab: {
        name: 'Research Lab',
        icon: '🔬',
        cost: { scrap: 10, data: 5, energy: 3 },
        description: 'Research facility. +1 research point per turn.',
        production: { research: 1 },
        requires: 'neural_networks'
    },
    fortress: {
        name: 'Fortress',
        icon: '🏰',
        cost: { scrap: 15, energy: 5 },
        description: 'Military stronghold. +3 defense, produces units.',
        production: { scrap: 1 },
        defense: 3,
        requires: 'mechanized_warfare'
    }
};

// === WIN CONDITIONS ===
const WIN_CONDITIONS = {
    DOMINATION: {
        name: 'Domination',
        description: 'Control 60% of all settlements on the map',
        icon: '⚔️'
    },
    SCIENTIFIC: {
        name: 'Scientific',
        description: 'Complete the Ascension Protocol',
        icon: '🧬'
    },
    CULTURAL: {
        name: 'Cultural',
        description: 'Build the Ark Beacon and maintain it for 5 turns',
        icon: '🏛️'
    }
};

// === AI PERSONALITIES ===
const AI_PERSONALITIES = {
    aggressive: {
        name: 'Aggressive',
        attackWeight: 0.8,
        expandWeight: 0.6,
        researchWeight: 0.3,
        defenseWeight: 0.3,
        diplomacyAggression: 0.7
    },
    expansionist: {
        name: 'Expansionist',
        attackWeight: 0.4,
        expandWeight: 0.9,
        researchWeight: 0.6,
        defenseWeight: 0.4,
        diplomacyAggression: 0.3
    },
    defensive: {
        name: 'Defensive',
        attackWeight: 0.2,
        expandWeight: 0.4,
        researchWeight: 0.5,
        defenseWeight: 0.9,
        diplomacyAggression: 0.1
    },
    opportunistic: {
        name: 'Opportunistic',
        attackWeight: 0.5,
        expandWeight: 0.5,
        researchWeight: 0.4,
        defenseWeight: 0.3,
        diplomacyAggression: 0.5
    },
    balanced: {
        name: 'Balanced',
        attackWeight: 0.5,
        expandWeight: 0.5,
        researchWeight: 0.5,
        defenseWeight: 0.5,
        diplomacyAggression: 0.4
    }
};

// === DIPLOMACY STATES ===
const DIPLOMACY_STATES = {
    ALLIED:     { name: 'Allied',     color: '#00ff88', hostility: 0 },
    FRIENDLY:   { name: 'Friendly',   color: '#88cc44', hostility: 0.2 },
    NEUTRAL:    { name: 'Neutral',    color: '#cccc44', hostility: 0.5 },
    HOSTILE:    { name: 'Hostile',    color: '#cc8844', hostility: 0.8 },
    AT_WAR:     { name: 'At War',     color: '#cc4444', hostility: 1.0 }
};

// === GAME PHASES ===
const PHASES = {
    PLANNING: 'Planning Phase',
    ACTION: 'Action Phase',
    AI_TURN: 'AI Turn',
    COMBAT: 'Combat Resolution'
};
