import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTetris, block, plain } from './harness.mjs';
import fixtures from './srs-cavities.mjs';

// Independent fixtures generated from the published SRS kick specification:
// https://tetris.wiki/Super_Rotation_System#Wall_Kicks
// Each row names a legal start, stack cells, and the first available kick.
// No expected pose or silhouette is read from the game's kick/shape tables.
const silhouettes = {
  T: ['.#.', '###', '...'],
  J: ['#..', '###', '...'],
  L: ['..#', '###', '...'],
  S: ['.##', '##.', '...'],
  Z: ['##.', '.##', '...'],
  I: ['....', '####', '....', '....'],
};

function footprint(type, rotation, x, y) {
  const rows = silhouettes[type];
  let cells = rows.flatMap((row, yy) => [...row].flatMap((cell, xx) => cell === '#' ? [[xx, yy]] : []));
  for (let turn = 0; turn < rotation; turn++) cells = cells.map(([xx, yy]) => [rows.length - 1 - yy, xx]);
  return cells.map(([xx, yy]) => `${x + xx},${y + yy}`).sort();
}

for (const type of Object.keys(silhouettes)) {
  for (let rotation = 0; rotation < 4; rotation++) {
    for (const direction of [-1, 1]) {
      test(`${type} SRS ${rotation} ${direction === 1 ? 'CW' : 'CCW'} selects each reachable ordered kick in a cavity`, () => {
        const { api, state, setNow } = loadTetris();
        const cases = fixtures.filter((row) => row.type === type && row.from === rotation && row.direction === direction);
        // Four T candidates cannot be isolated without intersecting the legal
        // starting T or leaving an earlier kick free. J/L/S/Z exercise those
        // same table entries with different silhouettes; no table is read here.
        const redundantT = type === 'T' && (rotation === 0 || rotation === 2);
        assert.equal(cases.length, redundantT ? 4 : 5, 'every independently selectable SRS candidate has a fixture');
        for (const fixture of cases) {
          state.board = api.createBoard();
          state.currentPiece = { ...api.createPiece(type), x: fixture.at[0], y: fixture.at[1], rotation };
          for (const [x, y] of fixture.blocks) state.board[y][x] = block();
          const beforeBoard = plain(state.board);
          const label = `${type} ${rotation} -> ${fixture.to[2]}, kick ${fixture.kick}`;
          assert.equal(api.isValidPosition(state.currentPiece), true, `${label}: legal starting pose`);
          const [x, y, nextRotation] = fixture.to;
          const occupied = footprint(type, nextRotation, x, y);
          for (const coordinate of occupied) {
            const [xx, yy] = coordinate.split(',').map(Number);
            assert.ok(xx >= 0 && xx < 10 && yy < 20, `${label}: expected minos are in bounds`);
            if (yy >= 0) assert.equal(state.board[yy][xx], null, `${label}: expected minos do not overlap the stack`);
          }
          state.isLocking = true;
          state.lockResets = 0;
          state.lockTimer = 10;
          setNow(100);
          api.rotate(direction);
          assert.deepEqual([state.currentPiece.x, state.currentPiece.y, state.currentPiece.rotation], fixture.to, label);
          const actual = plain(api.getShape(state.currentPiece)).flatMap((row, yy) => row.flatMap((cell, xx) =>
            cell ? [`${state.currentPiece.x + xx},${state.currentPiece.y + yy}`] : [])).sort();
          assert.deepEqual(actual, occupied, `${label}: public footprint`);
          assert.equal(api.isValidPosition(state.currentPiece), true, `${label}: legal rotated pose`);
          assert.deepEqual(plain(state.board), beforeBoard, `${label}: rotation does not change the stack`);
          assert.equal(state.lockResets, 1, `${label}: successful rotation resets the lock once`);
          assert.equal(state.lockTimer, 100, `${label}: successful rotation uses the current clock`);
        }
      });
    }
  }
}

test('CCW T at the right wall uses the horizontal L-to-2 kick before a downward alternative', () => {
  const { api, state } = loadTetris();
  state.currentPiece = { ...api.createPiece('T'), x: 8, y: 0, rotation: 3 };
  assert.equal(api.isValidPosition(state.currentPiece), true);
  api.rotate(-1);
  assert.deepEqual([state.currentPiece.x, state.currentPiece.y, state.currentPiece.rotation], [7, 0, 2]);
});
