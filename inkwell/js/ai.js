import { KIND } from './constants.js';
import { moveOrAttack } from './actions.js';
import { isWalkable } from './map.js';
import { entityAt, isHostile } from './entity.js';

const SIGHT = 8;
const MAX_DIST = SIGHT + 2;

const NEIGHBORS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export function runEnemyTurns(state) {
  if (!state.player.alive) return;
  const dist = playerDistanceMap(state);
  for (const e of state.entities) {
    if (!e.alive || e.kind === KIND.PLAYER) continue;
    stepEnemy(state, e, dist);
  }
}

function stepEnemy(state, enemy, dist) {
  const player = state.player;
  const w = state.page.width;
  const myDist = dist[enemy.y * w + enemy.x];
  if (myDist < 0 || myDist > SIGHT) {
    wander(state, enemy);
    return;
  }
  if (myDist <= 1) {
    moveOrAttack(state, enemy, sign(player.x - enemy.x), sign(player.y - enemy.y));
    return;
  }
  const candidates = bestNeighbors(state, enemy, dist, myDist);
  if (!candidates.length) {
    wander(state, enemy);
    return;
  }
  shuffle(candidates, state.rng);
  for (const step of candidates) {
    if (tryStep(state, enemy, step[0], step[1])) return;
  }
  wander(state, enemy);
}

function bestNeighbors(state, enemy, dist, myDist) {
  const w = state.page.width;
  const out = [];
  let best = myDist;
  for (const [dx, dy] of NEIGHBORS) {
    const nx = enemy.x + dx;
    const ny = enemy.y + dy;
    if (!isWalkable(state.page, nx, ny)) continue;
    const nd = dist[ny * w + nx];
    if (nd < 0) continue;
    if (nd < best) {
      best = nd;
      out.length = 0;
      out.push([dx, dy]);
    } else if (nd === best) {
      out.push([dx, dy]);
    }
  }
  return out;
}

function playerDistanceMap(state) {
  const { player, page } = state;
  const w = page.width;
  const h = page.height;
  const dist = new Int16Array(w * h);
  dist.fill(-1);
  const start = player.y * w + player.x;
  dist[start] = 0;
  const queue = [start];
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const d = dist[idx];
    if (d >= MAX_DIST) continue;
    const x = idx % w;
    const y = (idx - x) / w;
    for (let i = 0; i < 8; i++) {
      const nx = x + NEIGHBORS[i][0];
      const ny = y + NEIGHBORS[i][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (!isWalkable(page, nx, ny)) continue;
      const ni = ny * w + nx;
      if (dist[ni] !== -1) continue;
      dist[ni] = d + 1;
      queue.push(ni);
    }
  }
  return dist;
}

function wander(state, enemy) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]];
  const [dx, dy] = state.rng.pick(dirs);
  if (dx === 0 && dy === 0) return;
  tryStep(state, enemy, dx, dy);
}

function tryStep(state, enemy, dx, dy) {
  if (dx === 0 && dy === 0) return false;
  const nx = enemy.x + dx;
  const ny = enemy.y + dy;
  if (!isWalkable(state.page, nx, ny)) return false;
  const occupant = entityAt(state, nx, ny);
  if (occupant && occupant !== enemy && occupant.kind !== KIND.PLAYER && isHostile(occupant)) return false;
  return moveOrAttack(state, enemy, dx, dy);
}

function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
}

function sign(n) {
  return n === 0 ? 0 : n > 0 ? 1 : -1;
}
