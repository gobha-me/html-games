import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTetris, plain, block } from './harness.mjs';

function ready(type = 'O') {
  const harness = loadTetris();
  harness.state.currentPiece = harness.api.createPiece(type);
  harness.state.nextPieces = ['T', 'I', 'J'];
  harness.state.isPlaying = true;
  return harness;
}

test('line detection returns every full row in board order and excludes a row with one hole', () => {
  const { api, state } = ready();
  state.board[2].fill(block());
  state.board[7].fill(block());
  state.board[19].fill(block());
  state.board[19][9] = null;
  const before = plain(state.board);
  assert.deepEqual(plain(api.checkLines()), [2, 7]);
  assert.deepEqual(plain(state.board), before);
});

test('single-row removal inserts an independent empty top row and shifts the stack down', () => {
  const { api, state } = ready();
  state.board[18][1] = block('S');
  state.board[19].fill(block('Z'));
  api.clearLines([19]);
  assert.equal(state.board.length, 20);
  assert.ok(state.board[0].every((cell) => cell === null));
  assert.equal(state.board[19][1].type, 'S');
  assert.equal(state.board[18][1], null);
  assert.equal(new Set(state.board).size, 20);
  assert.deepEqual(plain(api.checkLines()), []);
});

for (const [isTSpin, points] of [[false, [0, 100, 300, 500, 800]], [true, [100, 400, 800, 1200, 800]]]) {
  for (let lines = isTSpin ? 0 : 1; lines <= 4; lines++) {
    test(`${isTSpin ? 'T-spin' : 'normal'} ${lines}-line clear scores its base value at level 3`, () => {
      const { api, state } = ready();
      state.level = 3;
      state.lines = 20;
      api.scoreLines(lines, isTSpin);
      assert.equal(state.score, points[lines] * 3);
      assert.equal(state.combo, 0);
      assert.equal(state.lines, 20 + lines);
      assert.equal(state.level, 3);
    });
  }
}

test('successive clears add escalating combo bonuses, then a non-clear lock resets the chain', () => {
  const { api, state } = ready();
  api.scoreLines(1, false);
  assert.equal(state.score, 100);
  api.scoreLines(1, false);
  assert.equal(state.score, 300);
  api.scoreLines(1, false);
  assert.equal(state.score, 550);
  state.currentPiece.y = 18;
  api.lockPiece();
  assert.equal(state.combo, -1);
  api.scoreLines(1, false);
  assert.equal(state.score, 650);
  assert.equal(state.combo, 0);
});

test('level transition scores at the old level, then changes the next drop interval', () => {
  const { api, state } = ready();
  state.lines = 9;
  api.scoreLines(1, false);
  assert.equal(state.score, 100);
  assert.equal(state.lines, 10);
  assert.equal(state.level, 2);
  assert.equal(state.dropInterval, 850);
});

test('three filled bounding-box corners trigger T-spin, while two do not', () => {
  const { api, state } = ready('T');
  const piece = { ...state.currentPiece, x: 3, y: 4 };
  state.board[4][3] = block();
  state.board[4][5] = block();
  assert.equal(api.checkTSpin(piece), false);
  state.board[6][3] = block();
  assert.equal(api.checkTSpin(piece), true);
  state.board[6][5] = block();
  assert.equal(api.checkTSpin(piece), true);
});

test('T-spin corner test counts side/floor walls but not empty space above the board', () => {
  const { api, state } = ready('T');
  const piece = { ...state.currentPiece, x: -1, y: 18 };
  assert.equal(api.checkTSpin(piece), true);
  piece.x = 3;
  piece.y = -1;
  state.board[1][3] = block();
  state.board[1][5] = block();
  assert.equal(api.checkTSpin(piece), false);
});

test('left/right movement stops at walls and stack cells without resetting lock delay', () => {
  const { api, state, setNow } = ready();
  state.currentPiece.x = 0;
  state.isLocking = true;
  state.lockTimer = 10;
  setNow(100);
  api.moveLeft();
  assert.equal(state.currentPiece.x, 0);
  assert.equal(state.lockResets, 0);
  assert.equal(state.lockTimer, 10);
  api.moveRight();
  assert.equal(state.currentPiece.x, 1);
  assert.equal(state.lockResets, 1);
  assert.equal(state.lockTimer, 100);
  state.board[0][3] = block();
  api.moveRight();
  assert.equal(state.currentPiece.x, 1);
  assert.equal(state.lockResets, 1);
  state.currentPiece.x = 8;
  api.moveRight();
  assert.equal(state.currentPiece.x, 8);
});

test('soft drop awards one point per successful cell and no points at the floor', () => {
  const { api, state } = ready();
  state.currentPiece.y = 17;
  api.softDrop();
  assert.equal(state.currentPiece.y, 18);
  assert.equal(state.score, 1);
  api.softDrop();
  assert.equal(state.currentPiece.y, 18);
  assert.equal(state.score, 1);
});

test('hard drop scores twice the distance, locks four cells and consumes the preview head', () => {
  const { api, state } = ready();
  state.currentPiece.y = 3;
  api.hardDrop();
  assert.equal(state.score, 30);
  for (const row of [18, 19]) {
    for (const col of [4, 5]) assert.equal(state.board[row][col].type, 'O');
  }
  assert.equal(state.board.flat().filter(Boolean).length, 4);
  assert.equal(state.currentPiece.type, 'T');
  assert.deepEqual(plain(state.nextPieces).slice(0, 2), ['I', 'J']);
  assert.equal(state.nextPieces.length, 3);
});

test('an empty preview queue and a blocked spawn both end the run', () => {
  for (const blocked of [false, true]) {
    const { api, state } = ready();
    if (blocked) {
      state.nextPieces = ['O', 'I', 'J'];
      state.board[0][4] = block();
    } else {
      state.nextPieces = [];
    }
    api.spawnPiece();
    assert.equal(state.isGameOver, true);
    assert.equal(state.isPlaying, false);
  }
});

for (const [type, rotation, x, y, direction, expected] of [
  ['T', 1, -1, 3, 1, [0, 3, 2]],
  ['T', 3, 8, 3, 1, [7, 3, 0]],
  ['I', 1, -2, 3, 1, [0, 3, 2]],
  ['T', 0, 3, 18, 1, [2, 17, 1]],
  ['I', 0, 3, 18, 1, [4, 16, 1]],
  ['T', 0, 3, 3, -1, [3, 3, 3]],
]) {
  test(`SRS ${type} rotation ${rotation} ${direction > 0 ? 'CW' : 'CCW'} at (${x},${y}) has the expected kick`, () => {
    const { api, state } = ready(type);
    Object.assign(state.currentPiece, { rotation, x, y });
    assert.equal(api.isValidPosition(state.currentPiece), true);
    api.rotate(direction);
    assert.deepEqual([state.currentPiece.x, state.currentPiece.y, state.currentPiece.rotation], expected);
    assert.equal(api.isValidPosition(state.currentPiece), true);
  });
}

test('four clockwise turns restore orientation and square pieces do not rotate or reset locks', () => {
  const { api, state } = ready('J');
  const before = plain(state.currentPiece);
  for (let i = 0; i < 4; i++) api.rotate();
  assert.deepEqual(plain(state.currentPiece), before);
  state.currentPiece = api.createPiece('O');
  state.isLocking = true;
  api.rotate();
  assert.equal(state.currentPiece.rotation, 0);
  assert.equal(state.lockResets, 0);
});

test('a rotation with every kick obstructed leaves the piece and lock timer unchanged', () => {
  const { api, state } = ready('T');
  state.currentPiece.y = 8;
  state.board.forEach((row) => row.fill(block()));
  for (const [r, c] of [[0, 1], [1, 0], [1, 1], [1, 2]]) {
    state.board[8 + r][3 + c] = null;
  }
  const before = plain(state.currentPiece);
  state.isLocking = true;
  state.lockTimer = 12;
  api.rotate();
  assert.deepEqual(plain(state.currentPiece), before);
  assert.equal(state.lockTimer, 12);
  assert.equal(state.lockResets, 0);
});

test('line-clear animation defers board removal, points and spawning until its timer fires', () => {
  const { api, state, pending, finishLineClear } = ready();
  state.currentPiece.y = 18;
  state.board[19].fill(block('J'));
  state.board[19][4] = null;
  state.board[19][5] = null;
  const locked = state.currentPiece;
  api.lockPiece();
  assert.equal(state.isLineClearing, true);
  assert.deepEqual(plain(state.lineClearRows), [19]);
  assert.equal(state.score, 0);
  assert.equal(state.lines, 0);
  assert.equal(state.currentPiece, locked);
  assert.equal(pending.length, 1);
  assert.equal(finishLineClear(), 300);
  assert.equal(state.isLineClearing, false);
  assert.deepEqual(plain(state.lineClearRows), []);
  assert.equal(state.score, 100);
  assert.equal(state.lines, 1);
  assert.equal(state.currentPiece.type, 'T');
  assert.deepEqual(plain(api.checkLines()), []);
  assert.equal(state.board[19][4].type, 'O');
});

test('line-clear gate blocks movement, drops, rotation, hold and frame updates', () => {
  const { api, state } = ready('T');
  state.isLineClearing = true;
  const before = plain(state);
  api.moveLeft();
  api.moveRight();
  api.softDrop();
  api.hardDrop();
  api.rotate();
  api.holdCurrentPiece();
  api.update(5000);
  assert.deepEqual(plain(state), before);
});

test('holding consumes one preview piece, refuses a second hold, and swaps without consuming preview', () => {
  const { api, state } = ready('L');
  api.holdCurrentPiece();
  assert.equal(state.holdPiece, 'L');
  assert.equal(state.currentPiece.type, 'T');
  assert.equal(state.canHold, false);
  const preview = plain(state.nextPieces);
  api.holdCurrentPiece();
  assert.equal(state.holdPiece, 'L');
  assert.equal(state.currentPiece.type, 'T');
  assert.deepEqual(plain(state.nextPieces), preview);
  // Exercise the already-held branch in isolation; next-turn eligibility has a
  // separate skipped regression because shipped lockPiece never re-enables it.
  state.canHold = true;
  state.currentPiece.y = 10;
  state.currentPiece.rotation = 2;
  api.holdCurrentPiece();
  assert.equal(state.holdPiece, 'T');
  assert.equal(state.currentPiece.type, 'L');
  assert.equal(state.currentPiece.y, 0);
  assert.equal(state.currentPiece.rotation, 0);
  assert.deepEqual(plain(state.nextPieces), preview);
});

test('lock delay resets only while locking and stops at the fifteenth successful reset', () => {
  const { api, state, setNow } = ready();
  setNow(100);
  api.resetLockDelay();
  assert.equal(state.lockResets, 0);
  state.isLocking = true;
  state.lockResets = 14;
  api.resetLockDelay();
  assert.equal(state.lockResets, 15);
  assert.equal(state.lockTimer, 100);
  setNow(200);
  api.resetLockDelay();
  assert.equal(state.lockResets, 15);
  assert.equal(state.lockTimer, 100);
});

test('gravity and lock delay honor exact timer boundaries', () => {
  const { api, state } = ready();
  api.update(999);
  assert.equal(state.currentPiece.y, 0);
  api.update(1000);
  assert.equal(state.currentPiece.y, 1);
  assert.equal(state.lastDropTime, 1000);
  state.currentPiece.y = 18;
  api.update(2000);
  assert.equal(state.isLocking, true);
  assert.equal(state.lockTimer, 2000);
  api.update(2499);
  assert.equal(state.currentPiece.type, 'O');
  assert.equal(state.board.flat().filter(Boolean).length, 0);
  api.update(2500);
  assert.equal(state.board.flat().filter(Boolean).length, 4);
  assert.equal(state.currentPiece.type, 'T');
});

test('paused, stopped and game-over frame updates leave the state unchanged', () => {
  for (const gate of ['isPaused', 'isGameOver', 'stopped']) {
    const { api, state } = ready();
    if (gate === 'stopped') state.isPlaying = false;
    else state[gate] = true;
    state.keys.ArrowLeft = true;
    const before = plain(state);
    api.update(5000);
    assert.deepEqual(plain(state), before);
  }
});

test('locking above the board ends the run without a line-clear timer', () => {
  const { api, state, pending } = ready();
  state.currentPiece.y = -1;
  api.lockPiece();
  assert.equal(state.isGameOver, true);
  assert.equal(state.isPlaying, false);
  assert.equal(pending.length, 0);
});

test('starting and ending a run load/persist the best score and establish clock state', () => {
  const h = loadTetris({ saved: { 'tetris-high-score': '125' } });
  h.setNow(321);
  h.api.startGame();
  assert.equal(h.state.isPlaying, true);
  assert.equal(h.state.isPaused, false);
  assert.equal(h.state.isGameOver, false);
  assert.equal(h.state.highScore, 125);
  assert.equal(h.state.lastDropTime, 321);
  h.state.score = 150;
  h.api.endGame();
  assert.equal(h.state.isPlaying, false);
  assert.equal(h.state.isGameOver, true);
  assert.equal(h.state.isNewHighScore, true);
  assert.deepEqual(h.writes, [['tetris-high-score', '150']]);
});
