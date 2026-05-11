import { KIND } from './constants.js';
import { moveOrAttack } from './actions.js';
import { isWalkable } from './map.js';
import { entityAt } from './entity.js';

const SIGHT = 8;

export function runEnemyTurns(state) {
  for (const e of state.entities) {
    if (!e.alive || e.kind === KIND.PLAYER) continue;
    stepEnemy(state, e);
  }
}

function stepEnemy(state, enemy) {
  const player = state.player;
  if (!player.alive) return;
  const dist = chebyshev(enemy.x, enemy.y, player.x, player.y);
  if (dist > SIGHT) {
    wander(state, enemy);
    return;
  }
  if (dist <= 1) {
    moveOrAttack(state, enemy, sign(player.x - enemy.x), sign(player.y - enemy.y));
    return;
  }
  const dx = sign(player.x - enemy.x);
  const dy = sign(player.y - enemy.y);
  const tried = tryStep(state, enemy, dx, dy)
    || tryStep(state, enemy, dx, 0)
    || tryStep(state, enemy, 0, dy);
  if (!tried) wander(state, enemy);
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
  if (occupant && occupant.kind !== KIND.PLAYER) return false;
  return moveOrAttack(state, enemy, dx, dy);
}

function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function sign(n) {
  return n === 0 ? 0 : n > 0 ? 1 : -1;
}
