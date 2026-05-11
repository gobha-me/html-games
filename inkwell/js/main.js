import { createInitialState, pushLog } from './state.js';
import { moveOrAttack, wait, descend } from './actions.js';
import { processPlayerAction } from './turn.js';
import { saveRun, loadRun, clearRun, hasSave } from './save.js';
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
  bootIntoOverlay();
  window.addEventListener('keydown', onKey);
  requestAnimationFrame(loop);
});

function bootIntoOverlay() {
  if (hasSave()) {
    const loaded = loadRun();
    if (loaded) {
      state = loaded;
      dirty = true;
      ui.showOverlay({
        title: 'Welcome back.',
        body: `An unfinished run waits on page ${state.page.depth}. The ink has not yet dried.`,
        primary: { text: 'Continue', onClick: continueRun },
        secondary: { text: 'New run', onClick: startNewRun },
      });
      return;
    }
    clearRun();
  }
  state = createInitialState();
  pushLog(state, 'You dip your quill into the inkwell.', 'plain');
  dirty = true;
  ui.showOverlay({
    title: 'Inkwell',
    body: 'A scribe descends the pages of a corrupted grimoire. Move toward the ink — but mind your page.',
    primary: { text: 'Open the book', onClick: continueRun },
  });
}

function continueRun() {
  ui.hideOverlay();
  state.mode = 'playing';
  pushLog(state, `Page ${state.page.depth} opens. The ink stirs.`, 'plain');
  dirty = true;
}

function startNewRun() {
  clearRun();
  state = createInitialState();
  pushLog(state, 'You dip your quill into the inkwell.', 'plain');
  ui.hideOverlay();
  state.mode = 'playing';
  pushLog(state, `Page ${state.page.depth} opens. The ink stirs.`, 'plain');
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
  if (isDescendKey(ev)) {
    ev.preventDefault();
    processPlayerAction(state, descend);
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

function isDescendKey(ev) {
  if (ev.code === 'Period' && ev.shiftKey) return true;
  if (ev.code === 'NumpadAdd') return true;
  return false;
}

function afterAction() {
  dirty = true;
  if (state.mode === 'gameover') {
    clearRun();
    setTimeout(() => {
      ui.showOverlay({
        title: 'The book closes.',
        body: state.meta.deathFlavor || 'Your run ends here.',
        primary: { text: 'Begin a new run (R)', onClick: startNewRun },
      });
    }, 300);
    return;
  }
  saveRun(state);
}

function restart() {
  startNewRun();
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
