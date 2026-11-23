import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTetris, block, plain } from './harness.mjs';

function ready(options = {}) {
  const harness = loadTetris(options);
  harness.state.currentPiece = harness.api.createPiece('O');
  harness.state.nextPieces = ['T', 'I', 'J'];
  harness.state.isPlaying = true;
  return harness;
}

test('a fresh bag yields valid tetrominoes in complete seven-piece groups', () => {
  const { api } = loadTetris();
  const types = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  for (let bag = 0; bag < 3; bag++) {
    const drawn = Array.from({ length: 7 }, () => api.getNextPiece());
    assert.deepEqual(drawn.sort(), types);
  }
});

test('reset removes the old line animation selection and new-high-score announcement', () => {
  const { api, state } = ready();
  state.lineClearRows = [18, 19];
  state.isLineClearing = true;
  state.isNewHighScore = true;
  api.resetGameState();
  assert.deepEqual(plain(state.lineClearRows), []);
  assert.equal(state.isLineClearing, false);
  assert.equal(state.isNewHighScore, false);
});

test('a frame with no active piece leaves the state unchanged', () => {
  const { api, state } = ready();
  state.currentPiece = null;
  const before = plain(state);
  assert.doesNotThrow(() => api.update(1000));
  assert.deepEqual(plain(state), before);
});

for (const saved of [{}, { 'tetris-high-score': '' }]) {
  test(`loading ${Object.keys(saved).length ? 'empty' : 'missing'} storage preserves the remembered best score`, () => {
    const { api, state, writes } = loadTetris({ saved });
    state.highScore = 975;
    assert.equal(api.loadHighScore(), 975);
    assert.equal(state.highScore, 975);
    assert.deepEqual(writes, []);
  });
}

for (const random of [0, 1 - Number.EPSILON]) {
  test(`line effects use the occupied cleared cell and valid particle properties at RNG ${random}`, () => {
    const { api, state } = ready({ random: () => random });
    api.spawnLineParticles(7);
    assert.deepEqual(plain(state.particles), [], 'an empty row emits no block particles');
    const cell = block('L');
    state.board[7][3] = cell;
    api.spawnLineParticles(7);
    assert.ok(state.particles.length > 0, 'a cleared occupied cell emits particles');
    const size = api.CONFIG.BLOCK_SIZE;
    for (const particle of state.particles) {
      assert.ok(particle.x >= 3 * size && particle.x < 4 * size);
      assert.ok(particle.y >= 7 * size && particle.y < 8 * size);
      assert.equal(particle.color, cell.color);
      for (const property of ['x', 'y', 'vx', 'vy', 'life', 'decay', 'size']) {
        assert.equal(Number.isFinite(particle[property]), true, property);
      }
      assert.ok(particle.life > 0);
      assert.ok(particle.decay > 0);
      assert.ok(particle.size > 0);
    }
  });

  test(`hard drop emits valid particles at the landed square at RNG ${random}`, () => {
    const { api, state } = ready({ random: () => random });
    state.currentPiece.y = 18;
    const color = state.currentPiece.color;
    api.hardDrop();
    assert.ok(state.particles.length > 0);
    const size = api.CONFIG.BLOCK_SIZE;
    for (const particle of state.particles) {
      assert.ok(particle.x >= 4 * size && particle.x < 6 * size);
      assert.ok(particle.y >= 18 * size && particle.y <= 20 * size);
      assert.equal(particle.color, color);
      for (const property of ['x', 'y', 'vx', 'vy', 'life', 'decay', 'size']) {
        assert.equal(Number.isFinite(particle[property]), true, property);
      }
      assert.ok(particle.life > 0);
      assert.ok(particle.decay > 0);
      assert.ok(particle.size > 0);
    }
  });
}

test('line-clear locking emits its effect before the delayed board removal', () => {
  const { api, state, pending } = ready();
  state.currentPiece.y = 18;
  state.board[19].fill(block('J'));
  state.board[19][4] = null;
  state.board[19][5] = null;
  api.lockPiece();
  assert.equal(state.isLineClearing, true);
  assert.equal(pending.length, 1);
  assert.ok(state.particles.length > 0);
  assert.ok(state.board[19].every(Boolean));
});

function particle(life) {
  return { x: 10, y: 20, vx: 2, vy: -1, life, decay: 0.25, color: '#123456', size: 2 };
}

test('particle updates move by velocity, accelerate downward and subtract lifetime decay', () => {
  const { api, state } = ready();
  state.particles = [particle(0.75)];
  api.updateParticles();
  assert.equal(state.particles.length, 1);
  assert.equal(state.particles[0].x, 12);
  assert.equal(state.particles[0].y, 19);
  assert.ok(state.particles[0].vy > -1, 'gravity increases the downward velocity');
  assert.equal(state.particles[0].life, 0.5);
});

test('particle expiry removes zero and negative lifetimes while preserving live neighbors', () => {
  const { api, state } = ready();
  const live = particle(0.75);
  state.particles = [particle(0.25), live, particle(0.125)];
  api.updateParticles();
  assert.equal(state.particles.length, 1);
  assert.equal(state.particles[0], live);
  assert.equal(live.life, 0.5);
});
