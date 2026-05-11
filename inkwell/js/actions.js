import { generatePage, isWalkable } from './map.js';
import { entityAt, isHostile, isItem, isGlyph, stairsAt } from './entity.js';
import { KIND, ITEMS, GLYPHS, SPELLS } from './constants.js';
import { pushLog } from './state.js';
import { createFovArrays, computeFOV } from './fov.js';

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
  if (actor.kind === KIND.PLAYER) pickup(state, actor);
  return true;
}

export function pickup(state, actor) {
  for (const e of state.entities) {
    if (!e.alive) continue;
    if (e.x !== actor.x || e.y !== actor.y) continue;
    if (isItem(e)) {
      const spec = ITEMS[e.kind];
      actor.inventory.push({ kind: e.kind, name: spec.name });
      pushLog(state, spec.pickup, 'good');
      e.alive = false;
      return true;
    }
    if (isGlyph(e)) {
      const spec = GLYPHS[e.kind];
      if (!actor.knownSpells.includes(spec.spell)) {
        actor.knownSpells.push(spec.spell);
      }
      pushLog(state, spec.pickup, 'good');
      e.alive = false;
      return true;
    }
  }
  return false;
}

export function useItem(state, actor, kind) {
  if (!actor.alive) return false;
  const idx = actor.inventory.findIndex((it) => it.kind === kind);
  if (idx < 0) return false;
  const spec = ITEMS[kind];
  switch (spec.effect) {
    case 'ink':
      actor.ink = Math.min(actor.inkMax, actor.ink + spec.amount);
      break;
    case 'heal':
      actor.hp = Math.min(actor.hpMax, actor.hp + spec.amount);
      break;
    case 'seal':
      actor.sealed = true;
      break;
    case 'nibUpgrade':
      actor.attack += spec.amount;
      break;
    default:
      return false;
  }
  actor.inventory.splice(idx, 1);
  pushLog(state, spec.use, 'good');
  return true;
}

export function castSpell(state, actor, slotIdx) {
  if (!actor.alive) return false;
  const spellId = actor.slots ? actor.slots[slotIdx] : null;
  if (!spellId) {
    pushLog(state, `Slot ${slotIdx + 1} is empty — bind a glyph in inventory.`, 'muted');
    return false;
  }
  const spec = SPELLS[spellId];
  if (!spec) return false;
  if (actor.ink < spec.cost) {
    pushLog(state, `Not enough ink for ${capitalize(spellId)} (need ${spec.cost}).`, 'muted');
    return false;
  }
  let ok = false;
  switch (spec.effect) {
    case 'damage': ok = applyStrike(state, actor, spec); break;
    case 'buff':   ok = applyWard(state, actor, spec); break;
    case 'fov':    ok = applySight(state, actor, spec); break;
    default:       return false;
  }
  if (!ok) return false;
  actor.ink -= spec.cost;
  return true;
}

function applyStrike(state, actor, spec) {
  const target = findAdjacentHostile(state, actor);
  if (!target) {
    pushLog(state, 'You inscribe Strike — but the parchment is empty around you.', 'muted');
    return false;
  }
  target.hp -= spec.power;
  state.animations.push({ type: 'strike', x: target.x, y: target.y, turn: state.turn });
  pushLog(state, `You inscribe Strike — the ${target.name} loses ${spec.power}.`, 'good');
  if (target.hp <= 0) {
    target.alive = false;
    target.hp = 0;
    pushLog(state, `The ${target.name} unravels under the glyph.`, 'good');
  }
  return true;
}

function applyWard(state, actor, spec) {
  actor.buffs.wardTurns = spec.turns;
  pushLog(state, 'A ward rises around you, indigo and patient.', 'good');
  return true;
}

function applySight(state, actor, spec) {
  actor.buffs.sightTurns = spec.turns;
  pushLog(state, 'The page brightens — your sight runs farther.', 'good');
  return true;
}

function findAdjacentHostile(state, actor) {
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const [dx, dy] of dirs) {
    const e = entityAt(state, actor.x + dx, actor.y + dy);
    if (isHostile(e)) return e;
  }
  return null;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function cycleSlot(state, slotIdx) {
  const player = state.player;
  if (!player.slots) return false;
  const options = [null, ...player.knownSpells];
  if (options.length === 1) return false;
  const cur = player.slots[slotIdx];
  const i = options.indexOf(cur);
  const next = options[(i + 1) % options.length];
  player.slots[slotIdx] = next;
  const label = next ? capitalize(next) : 'empty';
  pushLog(state, `Slot ${slotIdx + 1} → ${label}.`, 'muted');
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
  let dmg = attacker.attack;
  if (target.kind === KIND.PLAYER && target.sealed) {
    target.sealed = false;
    state.animations.push({
      type: 'strike',
      x: target.x,
      y: target.y,
      turn: state.turn,
    });
    pushLog(state, 'The wax seal cracks — the blow glances off.', 'good');
    return;
  }
  if (target.kind === KIND.PLAYER && target.buffs && target.buffs.wardTurns > 0) {
    const halved = Math.floor(dmg / 2);
    if (halved < dmg) {
      pushLog(state, 'The ward drinks half the blow.', 'good');
      dmg = halved;
    }
  }
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
  state.fov = createFovArrays();
  computeFOV(state);
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
