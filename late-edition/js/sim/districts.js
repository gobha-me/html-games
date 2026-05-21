// Late Edition — districts as data (Design Doc §16 + §18).
// Pure module. World imports DISTRICTS + helpers and uses them at lead-spawn
// time (rect → spawn tile) and at headline-synthesis time (actor pool +
// flavor weights). 0.10.0 ships 2 districts (Docks + Hillside) — Tier-0 §16
// line 1251 calls for "1 district (the Docks)"; the second district matches
// the §13 dossier mock ("Docks: Strike Threat · Hillside: Mayor's Mistress").
// Tier-1 expands to 4; Tier-2 to 18+ (procedural slot is future work).
//
// Coverage model: every district names the BuildingKind that "covers" it.
// The main Bureau covers the Docks by lore (the central HQ is in the
// harbor); Branch Bureau covers Hillside. Coverage controls spawn rate
// (§19 line 1436: 1 lead per ~90s with a bureau, ×0.5 without — Tier-1's
// Tip Line ×1.5 boost is not in 0.10.0). When the covering building is
// destroyed the district drops to the rumor rate.

export const DISTRICTS = [
  {
    id: 'docks',
    name: 'The Docks',
    // 4×4 spawn rect in the SW quadrant. Goon spawn (0,0) sits outside; the
    // original 0.3 hardcoded LEAD_SPAWN_TILE (2,2) is inside this rect.
    spawnRect: { x: 1, y: 1, w: 4, h: 4 },
    coveredByKind: 'bureau',          // the central HQ canonically anchors the Docks
    // Flavor weights match the §16 callout ("war-bond fraud at the docks ·
    // vice in the radio district") — the Docks lean vice + violence with
    // money trailing. Sums to 1.0.
    flavorWeights: { vice: 0.5, violence: 0.3, money: 0.2 },
    // Actor pool feeds the §18 slot grammar. ALL CAPS because the headline
    // formatter capitalizes the full string; storing pre-capped keeps the
    // grammar deterministic across renders.
    actorPool: ['DOCKHAND', 'LONGSHOREMAN', 'STEVEDORE', 'CAPTAIN', 'FENCE'],
  },
  {
    id: 'hillside',
    name: 'Hillside',
    // 4×4 spawn rect in the NE quadrant. Branch Bureau (G-01) sits inside.
    spawnRect: { x: 6, y: 1, w: 4, h: 4 },
    coveredByKind: 'branch_bureau',
    // Money-heavy uptown: bankers, judges, embassy folk. §16 names "the
    // embassy quarter · the diamond row" — Hillside stands in for that
    // axis at Tier-0.
    flavorWeights: { vice: 0.2, violence: 0.2, money: 0.6 },
    actorPool: ['MAYOR', 'MISTRESS', 'BANKER', 'JUDGE', 'HEIRESS'],
  },
];

export const DEFAULT_DISTRICT_ID = DISTRICTS[0].id;

export function getDistrict(id) {
  return DISTRICTS.find((d) => d.id === id) ?? null;
}

// Walk-back compat: code (and saves) authored before 0.10.0 used the
// 'd-default' district string. Resolve those to the Docks so old leads
// stay live after the substrate lands. New spawns always use real ids.
export function resolveDistrictId(id) {
  if (id === 'd-default') return DEFAULT_DISTRICT_ID;
  return getDistrict(id) ? id : DEFAULT_DISTRICT_ID;
}

// Pick a spawn tile inside the district rect that:
//   - is inside the grid
//   - is walkable on the live grid (not under a building)
//   - is not currently occupied by another lead
// Returns null if no tile qualifies (district full / over-built). Rng is a
// SeededRng instance; the caller owns deterministic RNG ownership.
export function pickSpawnTile(district, ctx, rng) {
  const { spawnRect } = district;
  const candidates = [];
  for (let dy = 0; dy < spawnRect.h; dy++) {
    for (let dx = 0; dx < spawnRect.w; dx++) {
      const x = spawnRect.x + dx;
      const y = spawnRect.y + dy;
      if (y < 0 || y >= ctx.grid.height || x < 0 || x >= ctx.grid.width) continue;
      if (!ctx.grid.walkable[y][x]) continue;
      if (ctx.occupiedTiles && ctx.occupiedTiles.has(`${x},${y}`)) continue;
      candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[rng.range(0, candidates.length)];
}

// Weighted draw from { key: weight } table. Weights need not sum to 1; the
// helper normalizes. Returns null on empty/zero-weight table.
export function pickWeighted(table, rng) {
  const entries = Object.entries(table).filter(([, w]) => w > 0);
  if (entries.length === 0) return null;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng.next() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll < 0) return key;
  }
  return entries[entries.length - 1][0];
}

export function pickFromList(list, rng) {
  if (!list || list.length === 0) return null;
  return list[rng.range(0, list.length)];
}

// Which district contains this tile? Falls back to DEFAULT_DISTRICT_ID when
// no rect covers the point (units inside the central buildings cluster, for
// example, sit between district rects). Used by the rival view's reporter
// district projection (ICD-02) and any HUD readout that wants a unit's
// current beat.
export function districtForTile(tile) {
  for (const d of DISTRICTS) {
    const r = d.spawnRect;
    if (tile.x >= r.x && tile.x < r.x + r.w && tile.y >= r.y && tile.y < r.y + r.h) {
      return d.id;
    }
  }
  return DEFAULT_DISTRICT_ID;
}
