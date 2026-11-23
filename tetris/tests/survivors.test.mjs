import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTetris, block, key, plain } from './harness.mjs';

function ready(type = 'O') {
  const h = loadTetris();
  h.state.currentPiece = h.api.createPiece(type);
  h.state.nextPieces = ['O', 'I', 'J'];
  h.state.isPlaying = true;
  return h;
}

test('a legal T lock at the ceiling writes only its four occupied cells, including row zero', () => {
  const { api, state } = ready('T');
  Object.assign(state.currentPiece, { x: 0, y: 0 });
  assert.equal(api.isValidPosition(state.currentPiece), true);
  api.lockPiece();
  const occupied = [];
  for (let y = 0; y < state.board.length; y++) {
    for (let x = 0; x < state.board[y].length; x++) {
      if (state.board[y][x]) occupied.push([x, y, state.board[y][x].type]);
    }
  }
  assert.deepEqual(occupied, [[1, 0, 'T'], [0, 1, 'T'], [1, 1, 'T'], [2, 1, 'T']]);
  assert.equal(state.isGameOver, false);
  assert.equal(state.currentPiece.type, 'O');
});

test('clearing a single row preserves the 20 by 10 board shape, including the new top row', () => {
  const { api, state } = ready();
  state.board[12].fill(block());
  state.board[11][9] = block('L');
  api.clearLines([12]);
  assert.equal(state.board.length, 20);
  assert.ok(state.board.every((row) => row.length === 10));
  assert.deepEqual(plain(state.board[0]), Array(10).fill(null));
  assert.equal(state.board[12][9].type, 'L');
  assert.equal(new Set(state.board).size, 20);
});

for (let emptyCorner = 0; emptyCorner < 4; emptyCorner++) {
  test(`a T-spin needs any three corners, including when corner ${emptyCorner} is the empty one`, () => {
    const { api, state } = ready('T');
    Object.assign(state.currentPiece, { x: 3, y: 4 });
    const corners = [[3, 4], [5, 4], [3, 6], [5, 6]];
    corners.forEach(([x, y], index) => {
      if (index !== emptyCorner) state.board[y][x] = block();
    });
    assert.equal(api.isValidPosition(state.currentPiece), true);
    assert.equal(api.checkTSpin(state.currentPiece), true);
  });
}

test('occupied row-zero corners count toward a T-spin without treating the ceiling as a wall', () => {
  const { api, state } = ready('T');
  Object.assign(state.currentPiece, { x: 3, y: 0 });
  for (const [x, y] of [[3, 0], [5, 0], [3, 2]]) state.board[y][x] = block();
  assert.equal(api.isValidPosition(state.currentPiece), true);
  assert.equal(api.checkTSpin(state.currentPiece), true);
  state.board[0][3] = null;
  assert.equal(api.checkTSpin(state.currentPiece), false);
});

test('the leftmost board column is an ordinary T-spin corner, not an out-of-bounds wall', () => {
  const { api, state } = ready('T');
  Object.assign(state.currentPiece, { x: 0, y: 4 });
  state.board[4][2] = block();
  state.board[6][2] = block();
  assert.equal(api.checkTSpin(state.currentPiece), false);
  state.board[4][0] = block();
  assert.equal(api.checkTSpin(state.currentPiece), true);
});

test('T-spin corners exactly beyond the right edge or below the floor count as walls', () => {
  for (const fixture of [
    { x: 8, y: 4, rotation: 3, interiorCorner: [8, 4] },
    { x: 3, y: 18, rotation: 0, interiorCorner: [3, 18] },
  ]) {
    const { api, state } = ready('T');
    Object.assign(state.currentPiece, fixture);
    assert.equal(api.isValidPosition(state.currentPiece), true);
    assert.equal(api.checkTSpin(state.currentPiece), false, 'two wall corners alone are insufficient');
    const [x, y] = fixture.interiorCorner;
    state.board[y][x] = block();
    assert.equal(api.isValidPosition(state.currentPiece), true);
    assert.equal(api.checkTSpin(state.currentPiece), true);
  }
});

test('combo bonuses scale with level three across a normal clear and a T-spin clear', () => {
  const { api, state } = ready();
  state.level = 3;
  state.lines = 20;
  api.scoreLines(1, false);
  assert.equal(state.score, 300);
  api.scoreLines(1, false);
  assert.equal(state.score, 900, 'second clear adds 300 base points and 300 combo points');
  api.scoreLines(1, true);
  assert.equal(state.score, 2550, 'third clear adds 1200 T-spin points and 450 combo points');
  assert.equal(state.combo, 2);
  assert.equal(state.lines, 23);
  assert.equal(state.level, 3);
});

test('gravity waits for elapsed time since the previous drop rather than the absolute clock', () => {
  const h = loadTetris();
  h.setNow(100);
  h.api.startGame();
  h.state.currentPiece = h.api.createPiece('O');
  h.api.update(1099);
  assert.equal(h.state.currentPiece.y, 0);
  h.api.update(1100);
  assert.equal(h.state.currentPiece.y, 1);
  assert.equal(h.state.lastDropTime, 1100);
  h.api.update(2099);
  assert.equal(h.state.currentPiece.y, 1);
  h.api.update(2100);
  assert.equal(h.state.currentPiece.y, 2);
  assert.equal(h.state.lastDropTime, 2100);
});

test('locking and spawning a fresh piece clear the old lock state and reset count', () => {
  const { api, state } = ready();
  state.currentPiece.y = 18;
  state.isLocking = true;
  state.lockResets = 7;
  api.lockPiece();
  assert.equal(state.isLocking, false);
  assert.equal(state.lockResets, 0);
  assert.equal(state.currentPiece.y, 0);
  assert.equal(state.board.flat().filter(Boolean).length, 4);
  // Check spawnPiece itself, whose reset is otherwise followed by lockPiece's
  // own reset in this path. The board contains only the bottom grounded square.
  state.isLocking = true;
  state.lockResets = 9;
  api.spawnPiece();
  assert.equal(state.isLocking, false);
  assert.equal(state.lockResets, 0);
  assert.equal(state.currentPiece.type, 'I');
});

test('holding a grounded first piece starts the replacement without the old lock delay', () => {
  const { api, state } = ready();
  state.currentPiece.y = 18;
  state.isLocking = true;
  state.lockResets = 5;
  api.holdCurrentPiece();
  assert.equal(state.holdPiece, 'O');
  assert.equal(state.currentPiece.type, 'O');
  assert.equal(state.currentPiece.y, 0);
  assert.equal(state.isLocking, false);
  assert.equal(state.lockResets, 0);
  assert.equal(state.board.flat().filter(Boolean).length, 0);
});

test('sliding off a ledge resumes gravity and cancels the old landing lock', () => {
  const { api, state } = ready();
  state.currentPiece.y = 5;
  state.board[7][4] = block();
  state.board[7][5] = block();
  state.lastDropTime = 100;
  api.update(1100);
  assert.equal(state.isLocking, true);
  assert.equal(state.currentPiece.y, 5);
  api.moveLeft();
  api.moveLeft();
  api.update(1200);
  assert.equal(state.currentPiece.y, 6);
  assert.equal(state.isLocking, false);
  assert.equal(state.board.flat().filter(Boolean).length, 2);
});

for (const [code, direction] of [['ArrowLeft', -1], ['ArrowRight', 1]]) {
  test(`${code} gets a new full DAS delay after release, an idle frame and a fresh press`, () => {
    const { api, state } = ready();
    api.handleKeyDown(key(code));
    api.handleDAS(100);
    api.handleDAS(270);
    assert.equal(state.currentPiece.x, 4 + 2 * direction);
    api.handleKeyUp(key(code));
    api.handleDAS(300);
    const afterRelease = state.currentPiece.x;
    api.handleKeyDown(key(code));
    assert.equal(state.currentPiece.x, afterRelease + direction);
    api.handleDAS(400);
    api.handleDAS(569);
    assert.equal(state.currentPiece.x, afterRelease + direction);
    api.handleDAS(570);
    assert.equal(state.currentPiece.x, afterRelease + 2 * direction);
  });
}

for (const code of ['ArrowUp', 'KeyC', 'KeyP', 'Enter']) {
  test(`${code} suppresses its browser default while dispatching gameplay input`, () => {
    const { api } = ready('T');
    const event = key(code);
    api.handleKeyDown(event);
    assert.equal(event.prevented, true);
  });
}
