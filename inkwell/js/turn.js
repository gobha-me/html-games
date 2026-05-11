import { runEnemyTurns } from './ai.js';
import { computeFOV } from './fov.js';

export function processPlayerAction(state, actionFn) {
  if (state.mode !== 'playing') return false;
  const acted = actionFn(state, state.player);
  if (!acted) return false;
  state.turn += 1;
  decrementBuffs(state.player);
  computeFOV(state);
  if (state.mode !== 'playing') return true;
  runEnemyTurns(state);
  cullDead(state);
  computeFOV(state);
  return true;
}

function decrementBuffs(player) {
  const b = player.buffs;
  if (b) {
    if (b.wardTurns > 0) b.wardTurns -= 1;
    if (b.sightTurns > 0) b.sightTurns -= 1;
  }
  if (player.marginaliaTurns > 0) player.marginaliaTurns -= 1;
}

function cullDead(state) {
  state.entities = state.entities.filter((e) => e.alive);
}
