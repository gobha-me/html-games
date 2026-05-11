import { MAP_W, MAP_H, TILE, FOV_RADIUS, SPELLS } from './constants.js';
import { tileAt } from './map.js';

// Eight-octant recursive shadowcasting (Björn Bergström's algorithm).
// Each row of OCTANTS is the (xx, xy, yx, yy) basis transform.
const OCTANTS = [
  [1, 0, 0, 1],
  [0, 1, 1, 0],
  [0, -1, 1, 0],
  [-1, 0, 0, 1],
  [-1, 0, 0, -1],
  [0, -1, -1, 0],
  [0, 1, -1, 0],
  [1, 0, 0, -1],
];

export function createFovArrays() {
  return {
    visible: new Uint8Array(MAP_W * MAP_H),
    seen: new Uint8Array(MAP_W * MAP_H),
  };
}

export function computeFOV(state, radius) {
  const { fov, player } = state;
  if (!fov) return;
  fov.visible.fill(0);
  if (!player.alive) return;
  const r = radius != null ? radius : effectiveRadius(player);
  markVisible(state, player.x, player.y);
  const cx = player.x;
  const cy = player.y;
  for (const [xx, xy, yx, yy] of OCTANTS) {
    castOctant(state, cx, cy, r, 1, 1.0, 0.0, xx, xy, yx, yy);
  }
}

function effectiveRadius(player) {
  const sightActive = player.buffs && player.buffs.sightTurns > 0;
  return sightActive ? FOV_RADIUS + SPELLS.sight.bonus : FOV_RADIUS;
}

function castOctant(state, cx, cy, radius, row, startSlope, endSlope, xx, xy, yx, yy) {
  if (startSlope < endSlope) return;
  let nextStart = 0;
  let curStart = startSlope;
  for (let dist = row; dist <= radius; dist++) {
    const dy = -dist;
    let blocked = false;
    for (let dx = -dist; dx <= 0; dx++) {
      const lSlope = (dx - 0.5) / (dy + 0.5);
      const rSlope = (dx + 0.5) / (dy - 0.5);
      if (curStart < rSlope) continue;
      if (endSlope > lSlope) break;
      const mx = cx + dx * xx + dy * xy;
      const my = cy + dx * yx + dy * yy;
      if (dx * dx + dy * dy < radius * radius) {
        markVisible(state, mx, my);
      }
      if (blocked) {
        if (isBlocking(state, mx, my)) {
          nextStart = rSlope;
          continue;
        }
        blocked = false;
        curStart = nextStart;
      } else if (isBlocking(state, mx, my) && dist < radius) {
        blocked = true;
        castOctant(state, cx, cy, radius, dist + 1, curStart, lSlope, xx, xy, yx, yy);
        nextStart = rSlope;
      }
    }
    if (blocked) break;
  }
}

function markVisible(state, x, y) {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
  const i = y * MAP_W + x;
  state.fov.visible[i] = 1;
  state.fov.seen[i] = 1;
}

function isBlocking(state, x, y) {
  return tileAt(state.page, x, y) !== TILE.FLOOR;
}

export function isVisible(fov, x, y) {
  if (!fov || x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  return fov.visible[y * MAP_W + x] === 1;
}

export function isSeen(fov, x, y) {
  if (!fov || x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  return fov.seen[y * MAP_W + x] === 1;
}
