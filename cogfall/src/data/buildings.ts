// Building types. Lower-case keys (matches prototype). `requires` references
// a TechId; `defBonus` is a multiplier added to a city's effective defense.

export const BUILDING_TYPES = {
  workshop: {
    name: 'Workshop',
    cost: 40,
    yields: { prod: 2 },
    glyph: '⚒',
    desc: '+2 production',
  },
  granary: {
    name: 'Granary',
    cost: 35,
    yields: { food: 2 },
    glyph: '⊟',
    desc: '+2 food (faster growth)',
  },
  walls: {
    name: 'Cog Walls',
    cost: 50,
    defBonus: 0.5,
    glyph: '◫',
    desc: '+50% defense',
  },
  foundry: {
    name: 'Foundry',
    cost: 70,
    yields: { prod: 2, gold: 1 },
    requires: 'metallurgy',
    glyph: '⚘',
    desc: '+2 prod, +1 gold',
  },
  bank: {
    name: 'Trade House',
    cost: 80,
    yields: { gold: 4 },
    requires: 'currency',
    glyph: '⊕',
    desc: '+4 gold',
  },
  library: {
    name: 'Library',
    cost: 60,
    yields: { science: 3 },
    requires: 'rediscovery',
    glyph: '⊞',
    desc: '+3 science',
  },
  spire: {
    name: 'Aether Spire',
    cost: 100,
    yields: { science: 2, aether: 2 },
    requires: 'aetherics',
    glyph: '✦',
    desc: '+2 science, +2 aether',
  },
  academy: {
    name: 'Academy',
    cost: 130,
    yields: { science: 5 },
    requires: 'aetherics',
    glyph: '⌘',
    desc: '+5 science',
  },
  citadel: {
    name: 'Citadel',
    cost: 140,
    defBonus: 1.0,
    requires: 'steam_armor',
    glyph: '◯',
    desc: '+100% defense',
  },
  printing_press: {
    name: 'Printing Press',
    cost: 70,
    yields: { culture: 2 },
    requires: 'lithography',
    glyph: '✎',
    desc: '+2 culture',
  },
  opera_house: {
    name: 'Opera House',
    cost: 130,
    yields: { culture: 4, gold: 1 },
    requires: 'salons',
    glyph: '✺',
    desc: '+4 culture, +1 gold',
  },
} as const;

export type BuildingId = keyof typeof BUILDING_TYPES;
export type BuildingDef = (typeof BUILDING_TYPES)[BuildingId];
