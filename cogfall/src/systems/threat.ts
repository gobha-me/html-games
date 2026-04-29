// Phase 2n-2 — threat-range visualization (pure compute layer).
//
// Reports the set of hexes that any *visible* enemy unit could reach with
// a melee attack on its next turn. Combat in Cogfall is adjacent-only, so
// the threat set is the union of each enemy's six neighbors. Workers /
// pioneers (atk 0) do not contribute. Enemies in fog do not contribute —
// the layer must not reveal hidden units through a side-channel.
//
// Pure: no RNG, no mutation, no DOM. The render layer (overlay.ts) reads
// the result per frame; a debug overlay (debugOverlay.ts) could reuse it
// for designer visualization, but doesn't today.
//
// Filter rule mirrors UNIT_TYPES.atk; PIONEER and WORKER are the current
// atk-0 entries. SABOTEUR is atk-1 — minimal threat but real, included.
// Off-map neighbor coords are filtered against G.map.tiles to keep the
// returned key set legal under hexKey.
import { hexKey, hexNeighbors } from '../core/hex';
import { G } from '../core/state';
import type { FactionIdx, TileKey } from '../core/types';
import { UNIT_TYPES } from '../data/units';

export function computeThreatRange(viewer: FactionIdx): TileKey[] {
  if (!G.map) return [];
  const out = new Set<TileKey>();
  for (const u of G.units) {
    if (u.factionIdx === viewer) continue;
    if (UNIT_TYPES[u.typeId].atk <= 0) continue;
    const tile = G.map.tiles.get(hexKey(u.q, u.r));
    if (!tile) continue;
    if (tile.visibility[viewer] !== 'visible') continue;
    for (const n of hexNeighbors(u.q, u.r)) {
      const k = hexKey(n.q, n.r);
      if (G.map.tiles.has(k)) out.add(k);
    }
  }
  return Array.from(out);
}
