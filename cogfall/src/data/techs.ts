// Tech tree. Prereqs reference other TechIds; isVictory marks the ascension
// path's terminus. `branch` is one of TECH_BRANCHES' keys.

export const TECHS = {
  rediscovery: {
    name: 'Rediscovery',
    cost: 30,
    prereqs: [],
    branch: 'science',
    flavor: 'The first sparks of memory return.',
  },
  metallurgy: {
    name: 'Metallurgy',
    cost: 50,
    prereqs: [],
    branch: 'industry',
    flavor: 'Iron remembers its old shape.',
  },
  currency: {
    name: 'Currency',
    cost: 50,
    prereqs: [],
    branch: 'economy',
    flavor: 'Coin survives all empires.',
  },
  cartography: {
    name: 'Cartography',
    cost: 70,
    prereqs: ['rediscovery'],
    branch: 'expansion',
    flavor: 'The world unfolds before us.',
  },
  gunpowder: {
    name: 'Gunpowder',
    cost: 100,
    prereqs: ['metallurgy'],
    branch: 'industry',
    unlocks: ['MUSKETEER'],
    flavor: 'Black powder, white smoke, red snow.',
  },
  aetherics: {
    name: 'Aetherics',
    cost: 100,
    prereqs: ['rediscovery'],
    branch: 'science',
    flavor: 'The unseen currents reveal themselves.',
  },
  espionage: {
    name: 'Espionage',
    cost: 120,
    prereqs: ['rediscovery'],
    branch: 'science',
    unlocks: ['SABOTEUR'],
    flavor: 'Coded letters in lacquered cases; whispers in foundry shadows.',
  },
  steamcraft: {
    name: 'Steamcraft',
    cost: 130,
    prereqs: ['metallurgy'],
    branch: 'industry',
    unlocks: ['IRONCLAD'],
    flavor: 'Pressure and pistons, the heartbeat of the new age.',
  },
  banking: {
    name: 'Banking',
    cost: 100,
    prereqs: ['currency'],
    branch: 'economy',
    flavor: 'Wealth multiplies in shadow.',
  },
  steam_armor: {
    name: 'Steam Armor',
    cost: 180,
    prereqs: ['steamcraft', 'gunpowder'],
    branch: 'industry',
    unlocks: ['STEAMTANK'],
    flavor: 'Iron men with iron hearts.',
  },
  aether_war: {
    name: 'Aether Combat',
    cost: 220,
    prereqs: ['aetherics', 'steamcraft'],
    branch: 'science',
    unlocks: ['AETHERMECH', 'AETHER_FRIGATE'],
    flavor: 'The Old Weapons return.',
  },
  grand_apparatus: {
    name: 'The Grand Apparatus',
    cost: 360,
    prereqs: ['aether_war', 'steam_armor'],
    branch: 'science',
    isVictory: true,
    flavor: 'Restore the Engine. Ascend.',
  },
} as const;

export const TECH_BRANCHES = {
  science: { name: 'Science', color: '#a060e0' },
  industry: { name: 'Industry', color: '#d4a017' },
  economy: { name: 'Economy', color: '#3a8acd' },
  expansion: { name: 'Expansion', color: '#3ea060' },
} as const;

export type TechId = keyof typeof TECHS;
export type TechDef = (typeof TECHS)[TechId];
export type TechBranch = keyof typeof TECH_BRANCHES;
