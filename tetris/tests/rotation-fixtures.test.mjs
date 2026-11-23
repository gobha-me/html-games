import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTetris, block, plain } from './harness.mjs';

// Independently describe the spawn silhouettes, then rotate their coordinates
// around the SRS 3x3 center. The game looks up stored matrices instead.
const spawnSilhouettes = {
  J: ['#..', '###', '...'],
  L: ['..#', '###', '...'],
  S: ['.##', '##.', '...'],
  Z: ['##.', '.##', '...'],
};

function glyphCells(rows) {
  return rows.flatMap((row, y) => [...row].flatMap((cell, x) => cell === '#' ? [[x, y]] : []));
}

function sortedCells(cells) {
  return cells.map(([x, y]) => `${x},${y}`).sort();
}

function rotateClockwise(cells) {
  return cells.map(([x, y]) => [2 - y, x]);
}

function occupiedCells(shape) {
  return plain(shape).flatMap((row, y) => row.flatMap((cell, x) => cell ? [[x, y]] : []));
}

for (const [type, silhouette] of Object.entries(spawnSilhouettes)) {
  test(`${type} stored orientations match its canonical footprint rotated about the SRS center`, () => {
    const { api } = loadTetris();
    const piece = api.createPiece(type);
    let expected = glyphCells(silhouette);
    for (let rotation = 0; rotation < 4; rotation++) {
      piece.rotation = rotation;
      assert.deepEqual(sortedCells(occupiedCells(api.getShape(piece))), sortedCells(expected),
        `${type} orientation ${rotation}`);
      expected = rotateClockwise(expected);
    }
  });

  for (const direction of [-1, 1]) {
    test(`${type} ${direction === 1 ? 'clockwise' : 'counterclockwise'} rotations expose the expected orientation on an open board`, () => {
      const { api, state } = loadTetris();
      state.currentPiece = { ...api.createPiece(type), x: 3, y: 5 };
      const spawn = glyphCells(silhouette);
      for (let turn = 1; turn <= 4; turn++) {
        api.rotate(direction);
        const orientation = ((turn * direction) % 4 + 4) % 4;
        let expected = spawn;
        for (let i = 0; i < orientation; i++) expected = rotateClockwise(expected);
        assert.equal(state.currentPiece.rotation, orientation);
        assert.equal(state.currentPiece.x, 3);
        assert.equal(state.currentPiece.y, 5);
        assert.deepEqual(sortedCells(occupiedCells(api.getShape(state.currentPiece))), sortedCells(expected));
        assert.equal(api.isValidPosition(state.currentPiece), true);
      }
    });
  }
}

for (const [corners, points] of [[2, 100], [3, 400]]) {
  test(`rotating then locking a T into a single-line slot with ${corners} occupied corners awards ${points} points`, () => {
    const { api, state, pending, finishLineClear } = loadTetris();
    state.currentPiece = { ...api.createPiece('T'), x: 3, y: 17 };
    state.nextPieces = ['O', 'I', 'J'];
    state.isPlaying = true;
    state.board[19].fill(block('J'));
    state.board[19][4] = null;
    // Bottom-left and bottom-right bounding corners are in the filled row.
    // A third corner makes the rotated placement a T-spin under this game.
    if (corners === 3) state.board[17][3] = block('S');
    assert.equal(api.isValidPosition(state.currentPiece), true);
    api.rotate(1);
    assert.deepEqual(
      [state.currentPiece.x, state.currentPiece.y, state.currentPiece.rotation], [3, 17, 1]);
    assert.equal(api.isValidPosition(state.currentPiece), true);
    api.lockPiece();
    assert.deepEqual(plain(state.lineClearRows), [19]);
    assert.equal(state.isLineClearing, true);
    assert.equal(state.score, 0);
    assert.equal(state.lines, 0);
    assert.equal(pending.length, 1);
    assert.equal(finishLineClear(), 300);
    assert.equal(state.score, points);
    assert.equal(state.lines, 1);
    assert.equal(state.combo, 0);
    assert.equal(state.isLineClearing, false);
    assert.equal(state.currentPiece.type, 'O');
    assert.deepEqual(plain(api.checkLines()), []);
    const retainedTCells = [];
    for (let y = 0; y < state.board.length; y++) {
      for (let x = 0; x < state.board[y].length; x++) {
        if (state.board[y][x]?.type === 'T') retainedTCells.push([x, y]);
      }
    }
    assert.deepEqual(retainedTCells, [[4, 18], [4, 19], [5, 19]]);
  });
}
