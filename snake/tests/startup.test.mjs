import assert from 'node:assert/strict';
import test from 'node:test';
import { keyEvent, loadSnake, plain } from './harness.mjs';

function multiplayerMenu() {
  const page = loadSnake({ bootstrap: true });
  page.modes.find(button => button.dataset.mode === 'multiplayer').click();
  assert.equal(page.GameState.isMultiplayer(), true);
  assert.equal(page.GameState.currentState, page.GameState.MENU);
  return page;
}

test('a held ArrowUp on the first multiplayer menu only turns after release and a new press', () => {
  const { element, listeners, GameState, Multiplayer, timers } = multiplayerMenu();
  const down = listeners.get('keydown');
  const up = listeners.get('keyup');
  const held = keyEvent('ArrowUp');
  down(held);

  element('start-btn').click();
  for (let tick = 0; tick < 5; tick += 1) {
    assert.equal(timers.size, 1);
    timers.values().next().value();
  }
  assert.equal(GameState.currentState, GameState.PLAYING);
  assert.equal(timers.size, 0);

  const player = Multiplayer.getPlayer(1);
  assert.deepEqual(plain(player.snake.nextDirection), { x: 1, y: 0 });
  down(keyEvent('ArrowUp', { repeat: true }));
  assert.deepEqual({
    preventedInMenu: held.prevented,
    queuedByRepeat: plain(player.snake.nextDirection),
  }, { preventedInMenu: 1, queuedByRepeat: { x: 1, y: 0 } });
  up(keyEvent('ArrowUp'));
  down(keyEvent('ArrowUp'));
  assert.deepEqual(plain(player.snake.nextDirection), { x: 0, y: -1 });
});

test('the first multiplayer start displays a Length counter of zero', () => {
  const { element } = multiplayerMenu();
  element('start-btn').click();
  assert.equal(element('start-screen').style.display, 'none');
  assert.equal(element('multiplayer-scoreboard').style.display, 'flex');
  assert.equal(String(element('length').textContent), '0');
});
