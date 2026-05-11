import { createInitialState, pushLog } from './state.js';
import { moveOrAttack, wait } from './actions.js';
import { processPlayerAction } from './turn.js';
import * as render from './render.js';
import * as ui from './ui.js';

let state = null;
let dirty = true;

const KEYMAP = {
  ArrowUp:    [0, -1], ArrowDown:  [0, 1], ArrowLeft:  [-1, 0], ArrowRight: [1, 0],
  KeyW:       [0, -1], KeyS:       [0, 1], KeyA:       [-1, 0], KeyD:       [1, 0],
  KeyK:       [0, -1], KeyJ:       [0, 1], KeyH:       [-1, 0], KeyL:       [1, 0],
  KeyY: [-1, -1], KeyU: [1, -1], KeyB: [-1, 1], KeyN: [1, 1],
  Numpad8: [0, -1], Numpad2: [0, 1], Numpad4: [-1, 0], Numpad6: [1, 0],
  Numpad7: [-1, -1], Numpad9: [1, -1], Numpad1: [-1, 1], Numpad3: [1, 1],
};

const WAIT_KEYS = new Set(['Period', 'Space', 'Numpad5']);
const RESTART_KEYS = new Set(['KeyR']);

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('board');
  render.init(canvas);
  ui.init();
  newRun();
  ui.showOverlay({
    title: 'Inkwell',
    body: 'A scribe descends the pages of a corrupted grimoire. Move toward the ink — but mind your page.',
    button: 'Open the book',
  });
  ui.onOverlayButton(() => {
    ui.hideOverlay();
    state.mode = 'playing';
    pushLog(state, `Page ${state.page.depth} opens. The ink stirs.`, 'plain');
    dirty = true;
  });
  window.addEventListener('keydown', onKey);
  requestAnimationFrame(loop);
});

function newRun() {
  state = createInitialState();
  pushLog(state, 'You dip your quill into the inkwell.', 'plain');
  dirty = true;
}

function onKey(ev) {
  if (state.mode === 'gameover') {
    if (RESTART_KEYS.has(ev.code) || ev.code === 'Enter') {
      ev.preventDefault();
      restart();
    }
    return;
  }
  if (state.mode !== 'playing') return;

  const move = KEYMAP[ev.code];
  if (move) {
    ev.preventDefault();
    processPlayerAction(state, (s, p) => moveOrAttack(s, p, move[0], move[1]));
    afterAction();
    return;
  }
  if (WAIT_KEYS.has(ev.code)) {
    ev.preventDefault();
    processPlayerAction(state, wait);
    afterAction();
    return;
  }
  if (RESTART_KEYS.has(ev.code)) {
    ev.preventDefault();
    restart();
  }
}

function afterAction() {
  dirty = true;
  if (state.mode === 'gameover') {
    setTimeout(() => {
      ui.showOverlay({
        title: 'The book closes.',
        body: state.meta.deathFlavor || 'Your run ends here.',
        button: 'Begin a new run (R)',
      });
    }, 300);
  }
}

function restart() {
  ui.hideOverlay();
  newRun();
  state.mode = 'playing';
  pushLog(state, `Page ${state.page.depth} opens. The ink stirs.`, 'plain');
  dirty = true;
}

function loop() {
  if (dirty) {
    render.render(state);
    ui.updateHUD(state);
    ui.renderLog(state);
    dirty = state.animations.length > 0;
  }
  requestAnimationFrame(loop);
}
