// Faction templates. The array is iterated by index (the player's faction
// becomes index 0); the engine never re-orders or filters this array, so
// FactionIdx values stay stable even after a faction is eliminated.

// Phase 3 S7 — per-faction victory flavor + threshold overrides. Pure data
// keyed on FactionId; never serialized (derived from the const at every read
// site). See decision-log item 14 in core/state.ts. Keys mirror VictoryType
// in core/types.ts; kept as string literals here to avoid a type-only cycle
// with that module (which already imports FactionId from this file).
export type VictoryProfile = {
  titles?: {
    domination?: string;
    ascension?: string;
    hegemony?: string;
    cultural?: string;
  };
  flavorTemplates?: {
    domination?: string;
    ascension?: string;
    hegemony?: string;
    cultural?: string;
  };
  // Faction-local override; if set, beats G.culturalHegemonyThreshold even
  // when mods have rewritten the global. Cogwright (default) reads G.
  culturalHegemonyThreshold?: number;
  // Same precedence rule for G.goldHegemonyThreshold.
  goldHegemonyThreshold?: number;
  // Override the cost of the `grand_apparatus` tech for this faction only.
  // Read via getAvailableTechs so AI and the tech-modal UI see the adjusted
  // value automatically.
  grandApparatusCost?: number;
};

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
    // No victoryProfile — byte-equal control for replay parity.
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
    victoryProfile: {
      titles: { ascension: 'Aether Ascension' },
      flavorTemplates: {
        ascension:
          'The aether sings home through {name}. The veil thins; the Old World remembers itself in their workings.',
      },
      grandApparatusCost: 320,
    },
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
    victoryProfile: {
      titles: { domination: 'Steel Throne' },
      flavorTemplates: {
        domination:
          'On the iron throne sits {name}, helmed in the silence of every fallen banner. The drums have stopped — there is no one left to march.',
      },
    },
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
    victoryProfile: {
      titles: { cultural: 'World-Tree Bloom' },
      flavorTemplates: {
        cultural:
          'The roots of {name} have reached the last forgotten gear. Where the great machine slept, a forest now breathes.',
      },
      culturalHegemonyThreshold: 0.35,
    },
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
    victoryProfile: {
      titles: { hegemony: 'Mercantile Hegemony' },
      flavorTemplates: {
        hegemony:
          'Every ledger in every counting-house bears the seal of {name}. The world is now a market — and they keep the only key.',
      },
      goldHegemonyThreshold: 4500,
    },
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

// S7: typed accessor for the per-faction victory profile. The `as const`
// above narrows each entry to its own literal type, so the Cogwright entry
// (no victoryProfile field) has no such property at the type level — a
// plain `FACTIONS[idx].victoryProfile` access trips TS2339. This helper is
// the single place we widen via a cast; call sites in turn.ts, culture.ts,
// and research.ts go through it and stay strict-typed.
export function getVictoryProfile(factionIdx: number): VictoryProfile | undefined {
  return (FACTIONS[factionIdx] as { victoryProfile?: VictoryProfile }).victoryProfile;
}
