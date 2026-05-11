import { isWalkable } from './map.js';
import { entityAt, isHostile } from './entity.js';
import { KIND } from './constants.js';
import { pushLog } from './state.js';

export function moveOrAttack(state, actor, dx, dy) {
  if (!actor.alive) return false;
  const nx = actor.x + dx;
  const ny = actor.y + dy;
  if (!isWalkable(state.page, nx, ny)) {
    if (actor.kind === KIND.PLAYER) pushLog(state, 'The page resists your quill.', 'muted');
    return false;
  }
  const occupant = entityAt(state, nx, ny);
  if (occupant && occupant !== actor) {
    if (actor.kind === KIND.PLAYER && isHostile(occupant)) {
      attack(state, actor, occupant);
      return true;
    }
    if (isHostile(actor) && occupant.kind === KIND.PLAYER) {
      attack(state, actor, occupant);
      return true;
    }
    return false;
  }
  actor.x = nx;
  actor.y = ny;
  return true;
}

export function attack(state, attacker, target) {
  const dmg = attacker.attack;
  target.hp -= dmg;
  state.animations.push({
    type: 'strike',
    x: target.x,
    y: target.y,
    turn: state.turn,
  });
  if (attacker.kind === KIND.PLAYER) {
    pushLog(state, `Your quill scores the ${target.name} for ${dmg}.`, 'good');
  } else {
    pushLog(state, `The ${attacker.name} drips on you. (-${dmg} HP)`, 'bad');
  }
  if (target.hp <= 0) {
    target.alive = false;
    target.hp = 0;
    if (target.kind === KIND.PLAYER) {
      onPlayerDeath(state, attacker);
    } else {
      pushLog(state, `The ${target.name} smudges into the parchment.`, 'good');
    }
  }
}

export function wait(state, actor) {
  if (actor.kind === KIND.PLAYER) {
    pushLog(state, 'You steady your quill.', 'muted');
  }
  return true;
}

function onPlayerDeath(state, killer) {
  state.mode = 'gameover';
  const flavorByKiller = {
    drip: 'The drip absorbed you',
  };
  const lead = flavorByKiller[killer.kind] || 'You smudged into the margin';
  state.meta.deathFlavor = `${lead} on page ${state.page.depth}.`;
  pushLog(state, state.meta.deathFlavor, 'bad');
}
