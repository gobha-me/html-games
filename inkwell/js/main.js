import { createInitialState, pushLog } from './state.js';
import { moveOrAttack, wait, descend, useItem, castSpell, cycleSlot } from './actions.js';
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
const INVENTORY_LETTERS = ['KeyA', 'KeyB', 'KeyC', 'KeyD'];
const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3'];

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
  if (state.mode === 'inventory') {
    handleInventoryKey(ev);
    return;
  }
  if (state.mode !== 'playing') return;

  if (ev.code === 'KeyI') {
    ev.preventDefault();
    openInventory();
    return;
  }

  const slotIdx = SLOT_KEYS.indexOf(ev.code);
  if (slotIdx >= 0) {
    ev.preventDefault();
    processPlayerAction(state, (s, p) => castSpell(s, p, slotIdx));
    afterAction();
    return;
  }

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

function openInventory() {
  state.mode = 'inventory';
  ui.showInventory(state);
}

function closeInventory() {
  if (state.mode !== 'inventory') return;
  state.mode = 'playing';
  ui.hideInventory();
  dirty = true;
}

function handleInventoryKey(ev) {
  if (ev.code === 'Escape' || ev.code === 'KeyI') {
    ev.preventDefault();
    closeInventory();
    return;
  }
  const letterIdx = INVENTORY_LETTERS.indexOf(ev.code);
  if (letterIdx >= 0) {
    ev.preventDefault();
    const kind = ui.getInventoryKindAt(letterIdx);
    if (!kind) return;
    closeInventory();
    processPlayerAction(state, (s, p) => useItem(s, p, kind));
    afterAction();
    return;
  }
  const slotIdx = SLOT_KEYS.indexOf(ev.code);
  if (slotIdx >= 0) {
    ev.preventDefault();
    cycleSlot(state, slotIdx);
    ui.showInventory(state);
    saveRun(state);
    dirty = true;
    return;
  }
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
    ui.renderSlots(state);
    dirty = state.animations.length > 0;
  }
  requestAnimationFrame(loop);
}
