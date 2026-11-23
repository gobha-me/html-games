import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTetris, block, plain } from './harness.mjs';

// Canonical silhouettes, independent of the production matrices. An effect
// point may lie on a cell boundary; its entire occupied cell is the bound.
const silhouettes = {
  T: ['.#.', '###', '...'], J: ['#..', '###', '...'],
  L: ['..#', '###', '...'], S: ['.##', '##.', '...'],
  Z: ['##.', '.##', '...'], I: ['....', '####', '....', '....'],
};

for (const [type, rows] of Object.entries(silhouettes)) {
  for (let rotation = 0; rotation < 4; rotation++) {
    test(`hard-drop effects for ${type} orientation ${rotation} stay within occupied landed minos`, () => {
      const { api, state } = loadTetris({ random: () => 0 });
      let cells = rows.flatMap((row, y) => [...row].flatMap((cell, x) => cell === '#' ? [[x, y]] : []));
      for (let turn = 0; turn < rotation; turn++) cells = cells.map(([x, y]) => [rows.length - 1 - y, x]);
      const landingY = 19 - Math.max(...cells.map(([, y]) => y));
      state.currentPiece = { ...api.createPiece(type), x: 3, y: 0, rotation };
      state.nextPieces = ['O', 'I', 'J'];
      state.isPlaying = true;
      // Check the public silhouette before descent. An empty/malformed shape
      // can make hardDrop search forever; reject that real geometry fault here
      // rather than turn an assertion kill into a mutation-run timeout.
      const actual = plain(api.getShape(state.currentPiece)).flatMap((row, y) =>
        row.flatMap((cell, x) => cell ? [`${x},${y}`] : [])).sort();
      assert.deepEqual(actual, cells.map(([x, y]) => `${x},${y}`).sort());
      assert.equal(api.isValidPosition(state.currentPiece), true);
      const size = api.CONFIG.BLOCK_SIZE;
      api.hardDrop();
      assert.ok(state.particles.length > 0);
      for (const particle of state.particles) {
        assert.ok(cells.some(([x, y]) =>
          particle.x >= (3 + x) * size && particle.x <= (4 + x) * size &&
          particle.y >= (landingY + y) * size && particle.y <= (landingY + y + 1) * size),
        `effect at (${particle.x},${particle.y}) must belong to an occupied mino`);
      }
    });
  }
}

test('an above-board top-out emits effects for visible row zero and none above it', () => {
  const { api, state } = loadTetris();
  state.currentPiece = { ...api.createPiece('O'), x: 4, y: -1 };
  state.nextPieces = ['T', 'I', 'J'];
  state.isPlaying = true;
  state.board[1].fill(block());
  assert.equal(api.isValidPosition(state.currentPiece), true);
  const size = api.CONFIG.BLOCK_SIZE;
  api.hardDrop();
  assert.equal(state.isGameOver, true);
  assert.ok(state.particles.length > 0, 'visible row-zero minos still emit');
  for (const particle of state.particles) {
    assert.ok(particle.x >= 4 * size && particle.x <= 6 * size);
    assert.ok(particle.y > 0 && particle.y <= size, 'above-board minos emit no effect');
  }
});
