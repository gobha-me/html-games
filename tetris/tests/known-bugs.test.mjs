import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTetris, block, key, plain } from './harness.mjs';

// These assertions express the intended behavior, not today's defective result.
// Opt in to reproduce the shipped failures; normal runs report explicit skips.
const knownBug = (reason) => ({
  skip: process.env.TETRIS_RUN_KNOWN_BUGS === '1' ? false : `Known shipped bug: ${reason}`,
});

test('regression: clearing adjacent full rows removes both, preserving the row above',
  knownBug('unshift inside descending clearLines loop changes the remaining row indices'), () => {
    const { api, state } = loadTetris();
    state.board[17][0] = block('S');
    state.board[18].fill(block('J'));
    state.board[19].fill(block('Z'));
    api.clearLines(api.checkLines());
    assert.deepEqual(plain(api.checkLines()), []);
    assert.equal(state.board[19][0].type, 'S');
    assert.equal(state.board.length, 20);
  });

test('regression: locking a piece makes hold available for the next piece',
  knownBug('lockPiece sets canHold=false and spawnPiece never re-enables it'), () => {
    const { api, state } = loadTetris();
    state.currentPiece = api.createPiece('O');
    state.currentPiece.y = 18;
    state.nextPieces = ['T', 'I', 'J'];
    api.lockPiece();
    assert.equal(state.currentPiece.type, 'T');
    assert.equal(state.canHold, true);
    api.holdCurrentPiece();
    assert.equal(state.holdPiece, 'T');
  });

test('regression: hard-drop input during pause leaves piece, board and score unchanged',
  knownBug('instant keyboard actions bypass the update pause gate'), () => {
    const { api, state } = loadTetris();
    state.isPlaying = true;
    state.isPaused = true;
    state.currentPiece = api.createPiece('O');
    state.nextPieces = ['T', 'I', 'J'];
    const before = plain({ piece: state.currentPiece, board: state.board, score: state.score });
    api.handleKeyDown(key('Space'));
    assert.equal(state.score, before.score);
    assert.deepEqual(plain({ piece: state.currentPiece, board: state.board, score: state.score }), before);
  });
