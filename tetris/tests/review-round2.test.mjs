import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTetris, block, plain } from './harness.mjs';
import { recordParticleArcs } from './effect-render-port.mjs';
import { effectCompatibility } from './effect-compatibility-fixtures.mjs';

// Literal same-28-draw public trace frozen from released3509241 after the
// concrete831 survivor. Historical compatibility, not a shuffle specification.
const releasedInterleavedTrace = ["L", "S", "I", "Z", "J", "T", "O", "O", "J", "T", "Z", "I", "S", "L", "T", "Z", "I", "J", "S", "L", "O", "T", "J", "O", "I", "Z", "S", "L"];

// Oracles: PR #148 FINDINGS round 2 specifies the seed-1 eighth piece and
// four visible line-clear particles per occupied cell. No game implementation
// or production RNG logic supplies these expectations.
test('particle randomness between draws preserves the specified seed-1 refill replay', () => {
  const { api, state } = loadTetris({ seed: 1 });
  state.board[19].fill(block());
  const drawn = [];
  for (let index = 0; index < 28; index++) {
    drawn.push(api.getNextPiece());
    api.spawnLineParticles(19);
  }
  assert.deepEqual(drawn.slice(0, 7).sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z']);
  assert.equal(drawn[7], 'O', 'reviewer seed-1 refill control: the eighth piece is O');
  // README's standard 7-bag promise and the existing public replenishment
  // test specify complete consecutive seven-piece groups across refills.
  for (let start = 0; start < drawn.length; start += 7) {
    assert.deepEqual(drawn.slice(start, start + 7).sort(), ['I', 'J', 'L', 'O', 'S', 'T', 'Z'],
      `interleaved particle randomness must preserve bag ${start / 7 + 1}`);
  }
  assert.deepEqual(drawn, releasedInterleavedTrace,
    'preserve the frozen released public trace under the same 28-draw schedule');
});

test('one cleared occupied cell retains four particles and four real-renderer arcs after three updates', () => {
  const { api, state } = loadTetris({ seed: 1 });
  state.board[19][3] = block('L');
  api.spawnLineParticles(19);
  assert.equal(state.particles.length, 4, 'reviewer contract: four particles per occupied cell');
  for (let frame = 0; frame < 3; frame++) api.updateParticles();
  assert.equal(state.particles.length, 4, 'the emitted particles remain live through three updates');
  const arcs = recordParticleArcs(api);
  assert.equal(arcs.length, 4, 'the actual renderer draws one arc for each of the four live particles');
});

// These literal fixtures were frozen by observing public APIs and actual
// Canvas arc calls on released head 3509241 before any source control. They
// preserve historical effects, rather than supply an independent art/physics
// specification. Math.random is the existing external browser boundary;
// no shipped randomizer, particle function or renderer is replaced.
for (const fixture of effectCompatibility) {
  for (const kind of ['line', 'drop']) {
    test(`${kind} effect preserves released numeric and Canvas compatibility at external random ${fixture.externalRandom}`, () => {
      const { api, state } = loadTetris({ random: () => fixture.externalRandom });
      if (kind === 'line') {
        state.board[7][3] = block('L');
        api.spawnLineParticles(7);
      } else {
        state.currentPiece = api.createPiece('O');
        state.currentPiece.y = 18;
        state.nextPieces = ['T', 'I', 'J'];
        state.isPlaying = true;
        // Canonical square geometry is independent of source matrices. Reject
        // malformed/empty shapes before a hard-drop search can hang.
        assert.deepEqual(plain(api.getShape(state.currentPiece)), [[1, 1], [1, 1]]);
        api.hardDrop();
      }
      assert.deepEqual({ count: state.particles.length, first: plain(state.particles[0]) }, fixture[kind].initial);
      for (let frame = 0; frame < 3; frame++) api.updateParticles();
      assert.deepEqual({
        count: state.particles.length,
        first: plain(state.particles[0]),
        arcs: recordParticleArcs(api),
      }, fixture[kind].afterThree);
    });
  }
}
