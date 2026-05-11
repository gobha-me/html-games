import { runEnemyTurns } from './ai.js';

export function processPlayerAction(state, actionFn) {
  if (state.mode !== 'playing') return false;
  const acted = actionFn(state, state.player);
  if (!acted) return false;
  state.turn += 1;
  if (state.mode !== 'playing') return true;
  runEnemyTurns(state);
  cullDead(state);
  return true;
}

function cullDead(state) {
  state.entities = state.entities.filter((e) => e.alive);
}
