// Strategic resources placed on the map by mapgen and consumed by city
// yield aggregation in systems/city.ts.
//
// Each resource declares which terrains it can spawn on and what yield
// deltas it adds when a city works the tile. Glyphs render as small
// gold-tinted overlays in render/canvas.ts (mirroring the improvement
// glyph pattern). Steampunk-flavored.

import type { TerrainId } from './terrain';

export interface ResourceDef {
  name: string;
  allowedTerrains: readonly TerrainId[];
  food?: number;
  prod?: number;
  gold?: number;
  glyph: string;
}

export const RESOURCES = {
  grain: {
    name: 'Grainfields',
    allowedTerrains: ['PLAINS'],
    food: 2,
    glyph: '❋',
  },
  livestock: {
    name: 'Livestock',
    allowedTerrains: ['PLAINS'],
    food: 1,
    gold: 1,
    glyph: '☘',
  },
  timber: {
    name: 'Heartwood',
    allowedTerrains: ['FOREST'],
    prod: 1,
    gold: 1,
    glyph: '♠',
  },
  iron: {
    name: 'Iron Lode',
    allowedTerrains: ['HILLS'],
    prod: 2,
    glyph: '⚒',
  },
  coal: {
    name: 'Coal Seam',
    allowedTerrains: ['HILLS'],
    prod: 1,
    gold: 1,
    glyph: '◆',
  },
  crystal: {
    name: 'Aether Crystal',
    allowedTerrains: ['WASTES'],
    prod: 1,
    gold: 2,
    glyph: '✧',
  },
  sulphur: {
    name: 'Sulphur Vein',
    allowedTerrains: ['WASTES'],
    prod: 1,
    gold: 1,
    glyph: '⚗',
  },
} as const satisfies Record<string, ResourceDef>;

export type ResourceId = keyof typeof RESOURCES;

export function getResource(id: string | null | undefined): ResourceDef | null {
  if (!id) return null;
  return (RESOURCES as Record<string, ResourceDef>)[id] ?? null;
}
