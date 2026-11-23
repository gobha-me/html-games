import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTetris, key, plain } from './harness.mjs';

function ready(type = 'T') {
  const h = loadTetris();
  h.state.currentPiece = h.api.createPiece(type);
  h.state.nextPieces = ['O', 'I', 'J'];
  h.state.isPlaying = true;
  return h;
}

test('initialization registers the real keydown and keyup handlers', () => {
  const { api, listeners } = ready();
  api.initControls();
  assert.equal(listeners.get('keydown'), api.handleKeyDown);
  assert.equal(listeners.get('keyup'), api.handleKeyUp);
});

for (const [code, direction] of [['ArrowLeft', -1], ['ArrowRight', 1]]) {
  test(`${code} moves once immediately, suppresses held-key repeats, then moves after release`, () => {
    const { api, state } = ready();
    const event = key(code);
    api.handleKeyDown(event);
    assert.equal(event.prevented, true);
    assert.equal(state.currentPiece.x, 3 + direction);
    assert.equal(state.keys[code], true);
    api.handleKeyDown(key(code));
    assert.equal(state.currentPiece.x, 3 + direction);
    api.handleKeyUp(key(code));
    assert.equal(state.keys[code], false);
    api.handleKeyDown(key(code));
    assert.equal(state.currentPiece.x, 3 + direction * 2);
  });
}

for (const code of ['ArrowUp', 'KeyX', 'KeyZ', 'ControlLeft', 'ControlRight']) {
  test(`${code} rotates in its documented direction`, () => {
    const { api, state } = ready();
    api.handleKeyDown(key(code));
    assert.equal(state.currentPiece.rotation, ['ArrowUp', 'KeyX'].includes(code) ? 1 : 3);
    assert.equal(state.currentPiece.x, 3);
    assert.equal(state.currentPiece.y, 0);
  });
}

for (const code of ['KeyC', 'ShiftLeft', 'ShiftRight']) {
  test(`${code} holds the active piece and spawns the preview head`, () => {
    const { api, state } = ready();
    api.handleKeyDown(key(code));
    assert.equal(state.holdPiece, 'T');
    assert.equal(state.currentPiece.type, 'O');
    assert.equal(state.canHold, false);
  });
}

test('Space hard-drops the real piece and prevents browser page scrolling', () => {
  const { api, state } = ready('O');
  const event = key('Space');
  api.handleKeyDown(event);
  assert.equal(event.prevented, true);
  assert.equal(state.score, 36);
  assert.equal(state.board.flat().filter(Boolean).length, 4);
  assert.equal(state.currentPiece.type, 'O');
  assert.equal(state.currentPiece.y, 0);
});

for (const code of ['KeyP', 'Escape']) {
  test(`${code} toggles pause once per press and is inert after game over`, () => {
    const { api, state } = ready();
    api.handleKeyDown(key(code));
    assert.equal(state.isPaused, true);
    api.handleKeyDown(key(code));
    assert.equal(state.isPaused, true);
    api.handleKeyUp(key(code));
    api.handleKeyDown(key(code));
    assert.equal(state.isPaused, false);
    state.isGameOver = true;
    api.handleKeyUp(key(code));
    api.handleKeyDown(key(code));
    assert.equal(state.isPaused, false);
  });
}

test('Enter starts a stopped game, leaves a running game alone, and restarts after game over', () => {
  const { api, state, setNow } = loadTetris();
  setNow(123);
  api.handleKeyDown(key('Enter'));
  assert.equal(state.isPlaying, true);
  assert.equal(state.lastDropTime, 123);
  state.score = 25;
  api.handleKeyUp(key('Enter'));
  api.handleKeyDown(key('Enter'));
  assert.equal(state.score, 25);
  state.isGameOver = true;
  api.handleKeyUp(key('Enter'));
  api.handleKeyDown(key('Enter'));
  assert.equal(state.score, 0);
  assert.equal(state.isGameOver, false);
});

for (const [code, direction] of [['ArrowLeft', -1], ['ArrowRight', 1]]) {
  test(`${code} auto-repeat begins at 170ms and repeats only at 50ms intervals`, () => {
    const { api, state } = ready();
    api.handleKeyDown(key(code));
    assert.equal(state.currentPiece.x, 3 + direction);
    api.handleDAS(100);
    api.handleDAS(269);
    assert.equal(state.currentPiece.x, 3 + direction);
    api.handleDAS(270);
    assert.equal(state.currentPiece.x, 3 + direction * 2);
    assert.equal(state.dasActive[code], true);
    api.handleDAS(319);
    assert.equal(state.currentPiece.x, 3 + direction * 2);
    api.handleDAS(320);
    assert.equal(state.currentPiece.x, 3 + direction * 3);
    api.handleKeyUp(key(code));
    assert.equal(state.dasTimer[code], undefined);
    assert.equal(state.arrTimer[code], undefined);
    assert.equal(state.dasActive[code], false);
    api.handleDAS(1000);
    assert.equal(state.currentPiece.x, 3 + direction * 3);
  });
}

test('held ArrowDown soft-drops on updates, then stops immediately after release', () => {
  const { api, state } = ready();
  const event = key('ArrowDown');
  api.handleKeyDown(event);
  assert.equal(event.prevented, true);
  assert.equal(state.currentPiece.y, 0);
  api.handleDAS(100);
  api.handleDAS(101);
  assert.equal(state.currentPiece.y, 2);
  assert.equal(state.score, 2);
  api.handleKeyUp(key('ArrowDown'));
  api.handleDAS(102);
  assert.equal(state.currentPiece.y, 2);
  assert.equal(state.score, 2);
});

test('unmapped keys do not move, rotate, drop or prevent browser defaults', () => {
  const { api, state } = ready();
  const before = plain(state.currentPiece);
  const event = key('KeyQ');
  api.handleKeyDown(event);
  assert.equal(event.prevented, false);
  assert.deepEqual(plain(state.currentPiece), before);
  assert.equal(state.score, 0);
  assert.equal(state.holdPiece, null);
});
