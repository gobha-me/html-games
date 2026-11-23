import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTetris, plain, block } from './harness.mjs';

const types = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

test('empty board has 20 independent rows of 10 empty cells', () => {
  const { api } = loadTetris();
  const board = api.createBoard();
  assert.equal(board.length, 20);
  assert.ok(board.every((row) => row.length === 10 && row.every((cell) => cell === null)));
  assert.equal(new Set(board).size, 20);
  board[0][0] = block();
  assert.equal(board[1][0], null);
  assert.equal(api.createBoard()[0][0], null);
});

test('every tetromino rotation consists of exactly four occupied cells', () => {
  const { api } = loadTetris();
  assert.deepEqual(Object.keys(api.TETROMINOES).sort(), types);
  for (const type of types) {
    const piece = api.createPiece(type);
    assert.equal(piece.type, type);
    assert.equal(piece.rotation, 0);
    assert.equal(piece.x, type === 'O' ? 4 : 3);
    assert.equal(piece.y, 0);
    assert.match(piece.color, /^#[a-f0-9]{6}$/);
    for (let rotation = 0; rotation < 4; rotation++) {
      piece.rotation = rotation;
      const shape = api.getShape(piece);
      assert.equal(shape.flat().filter(Boolean).length, 4, `${type} rotation ${rotation}`);
    }
  }
});

test('each generated bag contains every tetromino exactly once across many fixtures', () => {
  for (let seed = 0; seed < 40; seed++) {
    const { api } = loadTetris({ seed });
    for (let bag = 0; bag < 10; bag++) {
      assert.deepEqual(plain(api.generateBag()).sort(), types);
    }
  }
});

test('shuffle endpoints preserve all seven pieces and have explicit known permutations', () => {
  const low = loadTetris({ random: () => 0 });
  const high = loadTetris({ random: () => 1 - Number.EPSILON });
  assert.deepEqual(plain(low.api.generateBag()), ['O', 'T', 'S', 'Z', 'J', 'L', 'I']);
  assert.deepEqual(plain(high.api.generateBag()), ['I', 'O', 'T', 'S', 'Z', 'J', 'L']);
});

test('injected RNG fixtures replay identical bags while different seeds vary their order', () => {
  const draw = (seed) => {
    const { api } = loadTetris({ seed });
    return Array.from({ length: 70 }, () => api.getNextPiece());
  };
  assert.deepEqual(draw(123), draw(123));
  assert.notDeepEqual(draw(123), draw(124));
});

test('bag replenishment preserves queued order and seven-piece groups across boundaries', () => {
  const { api, state } = loadTetris({ seed: 5 });
  state.bag = ['T', 'I'];
  assert.equal(api.getNextPiece(), 'T');
  assert.equal(api.getNextPiece(), 'I');
  const drawn = Array.from({ length: 35 }, () => api.getNextPiece());
  for (let i = 0; i < drawn.length; i += 7) {
    assert.deepEqual(drawn.slice(i, i + 7).sort(), types);
  }
  assert.ok(state.bag.length >= 3);
});

test('position checks distinguish side walls, floor, above-board spawn and empty matrix cells', () => {
  const { api, state } = loadTetris();
  const piece = api.createPiece('O');
  piece.x = 0;
  assert.equal(api.isValidPosition(piece), true);
  assert.equal(api.isValidPosition(piece, -1), false);
  piece.x = 8;
  assert.equal(api.isValidPosition(piece), true);
  assert.equal(api.isValidPosition(piece, 1), false);
  piece.y = 18;
  assert.equal(api.isValidPosition(piece), true);
  assert.equal(api.isValidPosition(piece, 0, 1), false);
  piece.y = -1;
  assert.equal(api.isValidPosition(piece), true);
  state.board[0][8] = block();
  assert.equal(api.isValidPosition(piece), false);
  const verticalI = { ...api.createPiece('I'), x: -2, y: 2, rotation: 1 };
  assert.equal(api.isValidPosition(verticalI), true, 'zero padding may cross the left wall');
  assert.equal(api.isValidPosition(verticalI, -1), false);
});

test('rotation override checks the proposed shape without changing the piece', () => {
  const { api } = loadTetris();
  const piece = { ...api.createPiece('T'), x: 8, y: 2, rotation: 3 };
  const before = plain(piece);
  assert.equal(api.isValidPosition(piece), true);
  assert.equal(api.isValidPosition(piece, 0, 0, 0), false);
  assert.deepEqual(plain(piece), before);
});

test('ghost lands immediately above a stack and leaves piece and board unchanged', () => {
  const { api, state } = loadTetris();
  const piece = api.createPiece('O');
  assert.equal(api.getGhostY(piece), 18);
  state.board[16][4] = block();
  const beforePiece = plain(piece);
  const beforeBoard = plain(state.board);
  assert.equal(api.getGhostY(piece), 14);
  assert.deepEqual(plain(piece), beforePiece);
  assert.deepEqual(plain(state.board), beforeBoard);
  piece.y = 14;
  assert.equal(api.getGhostY(piece), 14);
});

test('speed curve uses level, integer milliseconds and its 50ms floor', () => {
  const { api } = loadTetris();
  assert.equal(api.getDropInterval(1), 1000);
  assert.equal(api.getDropInterval(2), 850);
  assert.equal(api.getDropInterval(5), 522);
  assert.equal(api.getDropInterval(10), 231);
  assert.equal(api.getDropInterval(20), 50);
  assert.equal(api.getDropInterval(1000), 50);
});

test('reset starts a new board/queue while retaining the persisted best score', () => {
  const { api, state } = loadTetris();
  state.highScore = 9000;
  state.score = 100;
  state.lines = 25;
  state.level = 3;
  state.combo = 7;
  state.holdPiece = 'O';
  state.canHold = false;
  state.isGameOver = true;
  state.isLineClearing = true;
  state.isLocking = true;
  state.lockResets = 15;
  state.board[19][0] = block();
  state.particles.push({ life: 1 });
  api.resetGameState();
  assert.ok(state.board.every((row) => row.every((cell) => cell === null)));
  assert.equal(state.highScore, 9000);
  assert.equal(state.score, 0);
  assert.equal(state.lines, 0);
  assert.equal(state.level, 1);
  assert.equal(state.combo, -1);
  assert.equal(state.holdPiece, null);
  assert.equal(state.canHold, true);
  assert.equal(state.isGameOver, false);
  assert.equal(state.isLineClearing, false);
  assert.equal(state.isLocking, false);
  assert.equal(state.lockResets, 0);
  assert.equal(state.particles.length, 0);
  assert.equal(state.nextPieces.length, 3);
  assert.ok(types.includes(state.currentPiece.type));
});

for (const [saved, expected] of [['412', 412], ['0', 0], ['nonsense', 0], ['', 0]]) {
  test(`high-score load handles stored ${JSON.stringify(saved)}`, () => {
    const { api, state, writes } = loadTetris({ saved: { 'tetris-high-score': saved } });
    assert.equal(api.loadHighScore(), expected);
    assert.equal(state.highScore, expected);
    assert.equal(writes.length, 0);
  });
}

test('high-score save writes only a strictly greater score with the expected key and string value', () => {
  const { api, state, writes, storage } = loadTetris();
  state.highScore = 100;
  assert.equal(api.saveHighScore(99), false);
  assert.equal(api.saveHighScore(100), false);
  assert.deepEqual(writes, []);
  assert.equal(api.saveHighScore(101), true);
  assert.equal(state.highScore, 101);
  assert.equal(storage.get('tetris-high-score'), '101');
  assert.deepEqual(writes, [['tetris-high-score', '101']]);
});
