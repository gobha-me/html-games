import { generatePage, isWalkable } from './map.js';
import { entityAt, isHostile, stairsAt } from './entity.js';
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
    if (occupant.kind === KIND.PLAYER || isHostile(occupant)) {
      return false;
    }
  }
  actor.x = nx;
  actor.y = ny;
  return true;
}

const PLAYER_HIT_FLAVOR = [
  'Your quill scores the {name} for {dmg}.',
  'Your nib bites the {name} (-{dmg}).',
  'Ink meets ink — the {name} loses {dmg}.',
];

const ENEMY_DEATH_FLAVOR = [
  'The {name} smudges into the parchment.',
  'The {name} blots out, soaked back into the page.',
  'The {name} unravels, ink draining into the gutter.',
];

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
    const tmpl = state.rng.pick(PLAYER_HIT_FLAVOR);
    pushLog(state, tmpl.replace('{name}', target.name).replace('{dmg}', dmg), 'good');
  } else {
    pushLog(state, `The ${attacker.name} ${enemyAttackVerb(attacker.kind)} you. (-${dmg} HP)`, 'bad');
  }
  if (target.hp <= 0) {
    target.alive = false;
    target.hp = 0;
    if (target.kind === KIND.PLAYER) {
      onPlayerDeath(state, attacker);
    } else {
      const tmpl = state.rng.pick(ENEMY_DEATH_FLAVOR);
      pushLog(state, tmpl.replace('{name}', target.name), 'good');
    }
  }
}

export function wait(state, actor) {
  if (actor.kind === KIND.PLAYER) {
    pushLog(state, 'You steady your quill.', 'muted');
  }
  return true;
}

export function descend(state, actor) {
  if (!actor.alive || actor.kind !== KIND.PLAYER) return false;
  const stairs = stairsAt(state, actor.x, actor.y);
  if (!stairs) {
    pushLog(state, 'No stairs here. The page does not yet end.', 'muted');
    return false;
  }
  transitionPage(state);
  return true;
}

function transitionPage(state) {
  const nextDepth = state.page.depth + 1;
  const page = generatePage(state.rng, nextDepth);
  state.page = {
    depth: page.depth,
    tiles: page.tiles,
    width: page.width,
    height: page.height,
    rooms: page.rooms,
  };
  state.entities = page.entities;
  state.player.x = page.playerStart.x;
  state.player.y = page.playerStart.y;
  state.player.ink = state.player.inkMax;
  state.animations = [];
  if (nextDepth > state.meta.deepestPage) {
    state.meta.deepestPage = nextDepth;
  }
  pushLog(state, `You turn the page. (Page ${nextDepth})`, 'muted');
}

function enemyAttackVerb(kind) {
  if (kind === KIND.SMEAR) return 'smudges across';
  if (kind === KIND.SCRAWL) return 'scratches';
  return 'drips on';
}

function onPlayerDeath(state, killer) {
  state.mode = 'gameover';
  const flavorByKiller = {
    drip: 'The drip absorbed you',
    smear: 'A smear swallowed your final word',
    scrawl: 'A scrawl tore through your binding',
  };
  const lead = flavorByKiller[killer.kind] || 'You smudged into the margin';
  state.meta.deathFlavor = `${lead} on page ${state.page.depth}.`;
  pushLog(state, state.meta.deathFlavor, 'bad');
}
