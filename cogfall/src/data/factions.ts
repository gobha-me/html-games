// Faction templates. The array is iterated by index (the player's faction
// becomes index 0); the engine never re-orders or filters this array, so
// FactionIdx values stay stable even after a faction is eliminated.

export const FACTIONS = [
  {
    id: 'cogwright',
    name: 'The Cogwright Guild',
    color: '#d4a017',
    personality: 'industrial',
    startTechs: ['metallurgy'],
    desc: 'Master smiths who never forgot the old craft.',
    traits: 'Starts with Metallurgy',
    glyph: '⚒',
  },
  {
    id: 'aetheric',
    name: 'The Aetheric Order',
    color: '#a060e0',
    personality: 'scientific',
    startTechs: ['rediscovery'],
    desc: 'Mystics who study the unseen currents.',
    traits: 'Starts with Rediscovery, +1 aether/turn',
    glyph: '✦',
  },
  {
    id: 'iron',
    name: 'The Iron Legion',
    color: '#c41e3a',
    personality: 'militaristic',
    startTechs: [],
    startBonus: 'extra_warrior',
    desc: 'They remember war when all else is forgotten.',
    traits: 'Bonus warband, +20% unit attack',
    glyph: '⚔',
  },
  {
    id: 'verdant',
    name: 'The Verdant Pact',
    color: '#3ea060',
    personality: 'defensive',
    startTechs: [],
    startBonus: 'extra_pioneer',
    desc: 'They tend the wild gears beneath the moss.',
    traits: 'Extra pioneer, +15% city defense, +1 culture in capitals',
    glyph: '♣',
  },
  {
    id: 'coin',
    name: 'The Coalition of Coin',
    color: '#3a8acd',
    personality: 'economic',
    startTechs: ['currency'],
    desc: 'Coin survives all empires.',
    traits: 'Starts with Currency, +50 starting gold',
    glyph: '⊕',
  },
] as const;

export const MAP_SIZES = {
  small: { w: 20, h: 14 },
  medium: { w: 30, h: 20 },
  large: { w: 42, h: 28 },
} as const;

export const CITY_NAMES = [
  'Brassholm',
  'Cogspire',
  'Ironvein',
  'Aetherwell',
  'Greymarch',
  'Pistonfall',
  'Old Anvil',
  'Glasswick',
  'Steamhaven',
  'Coalreach',
  'Thornforge',
  'Mistgrove',
  'Thunderworks',
  'Soothsay',
  'Vaulthold',
  'Embertide',
  'Loomshade',
  'Brokenwheel',
  'Lantern Vale',
  'Cinderpost',
  'Gildreach',
  'Hollowforge',
  'Quartz Hold',
] as const;

export type FactionId = (typeof FACTIONS)[number]['id'];
export type FactionDef = (typeof FACTIONS)[number];
export type MapSizeId = keyof typeof MAP_SIZES;
