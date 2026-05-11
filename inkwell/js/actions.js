import { generatePage, isWalkable, spawnGlyph } from './map.js';
import { entityAt, isHostile, isItem, isGlyph, stairsAt, createStairs } from './entity.js';
import { KIND, ITEMS, GLYPHS, SPELLS } from './constants.js';
import { pushLog } from './state.js';
import { createFovArrays, computeFOV, isVisible } from './fov.js';

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
    case 'marginalia':
      actor.marginaliaTurns = (actor.marginaliaTurns || 0) + spec.amount;
      break;
    case 'fountainUpgrade':
      actor.attack += spec.amount;
      break;
    case 'reedUpgrade':
      actor.inkCostBonus = (actor.inkCostBonus || 0) - spec.amount;
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
  const cost = Math.max(1, spec.cost + (actor.inkCostBonus || 0));
  if (actor.ink < cost) {
    pushLog(state, `Not enough ink for ${capitalize(spellId)} (need ${cost}).`, 'muted');
    return false;
  }
  let ok = false;
  switch (spec.effect) {
    case 'damage': ok = applyStrike(state, actor, spec); break;
    case 'buff':   ok = applyWard(state, actor, spec); break;
    case 'fov':    ok = applySight(state, actor, spec); break;
    case 'bind':   ok = applyBind(state, actor, spec); break;
    case 'erase':  ok = applyErase(state, actor, spec); break;
    default:       return false;
  }
  if (!ok) return false;
  actor.ink -= cost;
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
  if (target.hp <= 0) killEntity(state, target, actor, 'The {name} unravels under the glyph.');
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

function applyBind(state, actor, spec) {
  const target = findAdjacentHostile(state, actor);
  if (!target) {
    pushLog(state, 'You inscribe Bind — but nothing stands close enough to pin.', 'muted');
    return false;
  }
  target.boundTurns = spec.turns;
  state.animations.push({ type: 'strike', x: target.x, y: target.y, turn: state.turn });
  pushLog(state, `Bind takes hold — the ${target.name} is fixed to the margin.`, 'good');
  return true;
}

function applyErase(state, actor, spec) {
  const target = findEraseTarget(state, actor, spec.range);
  if (!target) {
    pushLog(state, 'You inscribe Erase — but no word in sight answers it.', 'muted');
    return false;
  }
  const hpMaxDmg = target.boss ? (spec.bossHpMaxDmg || spec.hpMaxDmg) : spec.hpMaxDmg;
  const newMax = Math.max(1, target.hpMax - hpMaxDmg);
  const loss = target.hpMax - newMax;
  target.hpMax = newMax;
  target.hp = Math.min(target.hp, target.hpMax);
  target.titleErased = true;
  state.animations.push({ type: 'strike', x: target.x, y: target.y, turn: state.turn });
  pushLog(state, `You erase a word — the ${target.name} grows shorter (-${loss} max HP).`, 'good');
  if (target.hp <= 0) killEntity(state, target, actor, 'The {name} is unwritten.');
  return true;
}

function findEraseTarget(state, actor, range) {
  let best = null;
  let bestHp = Infinity;
  let bestDist = Infinity;
  for (const e of state.entities) {
    if (!isHostile(e)) continue;
    if (!isVisible(state.fov, e.x, e.y)) continue;
    const dist = Math.abs(e.x - actor.x) + Math.abs(e.y - actor.y);
    if (dist > range) continue;
    if (e.hp < bestHp || (e.hp === bestHp && dist < bestDist)) {
      best = e;
      bestHp = e.hp;
      bestDist = dist;
    }
  }
  return best;
}

function killEntity(state, target, attacker, deathFlavor) {
  target.alive = false;
  target.hp = 0;
  if (deathFlavor) {
    pushLog(state, deathFlavor.replace('{name}', target.name), 'good');
  }
  recordBeastSeen(state, target.kind);
  maybeDropMarginaliaGlyph(state, target, attacker);
  if (target.boss) onBossDeath(state, target);
}

function maybeDropMarginaliaGlyph(state, target, attacker) {
  if (target.boss) return;
  if (!attacker || attacker.kind !== KIND.PLAYER) return;
  if (!attacker.marginaliaTurns || attacker.marginaliaTurns <= 0) return;
  const glyph = spawnGlyph(state.rng, state.page.depth, target.x, target.y);
  state.entities.push(glyph);
  pushLog(state, `A glyph blooms in the margin where the ${target.name} fell.`, 'good');
}

function onBossDeath(state, boss) {
  if (!state.meta.bossesSlain) state.meta.bossesSlain = [];
  state.meta.bossesSlain.push({
    kind: boss.kind,
    name: boss.name,
    depth: state.page.depth,
    turn: state.turn,
  });
  pushLog(state, `${boss.name} closes — a stair opens beneath the body.`, 'good');
  state.entities.push(createStairs(boss.x, boss.y));
  if (boss.kind === KIND.BOSS_COLOPHON) {
    state.mode = 'gameover';
    state.meta.winFlavor =
      `You closed the book. The Colophon dissolves into the gutter; the last page is yours.`;
    pushLog(state, state.meta.winFlavor, 'good');
  }
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
  if (attacker.kind === KIND.PLAYER && target.kind === KIND.BOSS_FRONTISPIECE && !target.titleErased) {
    const halved = Math.max(1, Math.floor(dmg / 2));
    if (halved < dmg) {
      pushLog(state, 'The title-page turns the blow aside.', 'muted');
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
    if (target.kind === KIND.PLAYER) {
      target.alive = false;
      target.hp = 0;
      onPlayerDeath(state, attacker);
    } else {
      const tmpl = state.rng.pick(ENEMY_DEATH_FLAVOR);
      killEntity(state, target, attacker, tmpl);
    }
  }
}

function recordBeastSeen(state, kind) {
  if (!state.meta) return;
  if (!Array.isArray(state.meta.beastsSeen)) state.meta.beastsSeen = [];
  if (!state.meta.beastsSeen.includes(kind)) state.meta.beastsSeen.push(kind);
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
  if (kind === KIND.MARGINALIA) return 'annotates';
  if (kind === KIND.FOXING) return 'rusts into';
  if (kind === KIND.ERRATUM) return 'misprints onto';
  if (kind === KIND.BOSS_MARGIN_LORD) return 'crushes';
  if (kind === KIND.BOSS_FRONTISPIECE) return 'bleeds onto';
  if (kind === KIND.BOSS_COLOPHON) return 'seals';
  return 'drips on';
}

function onPlayerDeath(state, killer) {
  state.mode = 'gameover';
  const flavorByKiller = {
    drip: 'The drip absorbed you',
    smear: 'A smear swallowed your final word',
    scrawl: 'A scrawl tore through your binding',
    marginalia: 'A marginalia annotated you out of the text',
    foxing: 'Foxing crept across your binding and stopped your hand',
    erratum: 'An erratum struck where you stood — you were never written',
    boss_margin_lord: 'The Margin-Lord pressed you into the gutter',
    boss_frontispiece: 'The Frontispiece bound shut around you',
    boss_colophon: 'The Colophon stamped you into the final mark',
  };
  const lead = flavorByKiller[killer.kind] || 'You smudged into the margin';
  state.meta.deathFlavor = `${lead} on page ${state.page.depth}.`;
  pushLog(state, state.meta.deathFlavor, 'bad');
}
