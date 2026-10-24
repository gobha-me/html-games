import test from 'node:test';
import assert from 'node:assert/strict';
import { KEYS, CONTROL_LABELS, actionFor, heldInput } from '../js/keys.js';

test('physical controls have exactly the documented bindings and labels', () => {
  assert.deepEqual(KEYS, {
    slow: ['ArrowLeft', 'KeyA'],
    fast: ['ArrowRight', 'KeyD'],
    hold: ['Space'],
    horn: ['KeyH'],
    lamp: ['KeyK'],
    pause: ['Escape', 'KeyP'],
    help: ['Slash'],
  });
  assert.deepEqual(CONTROL_LABELS, {
    slow: '← / A · slow', fast: '→ / D · fast', hold: 'Space · hold',
    horn: 'H · horn', lamp: 'K · signal lamp', pause: 'Esc / P · pause', help: '? · controls',
  });
  assert.equal(Object.isFrozen(KEYS), true);
  assert.equal(Object.isFrozen(CONTROL_LABELS), true);
  assert.throws(() => { KEYS.help = ['KeyQ']; }, TypeError);
  assert.throws(() => { CONTROL_LABELS.help = 'Q'; }, TypeError);
});

test('each alias has one owner; menu keys never become held gameplay actions', () => {
  for (const [action, codes] of Object.entries(KEYS)) {
    for (const code of codes) assert.equal(actionFor(code), action);
  }
  for (const code of ['', 'KeyQ', 'ArrowUp', 'a', ' ', null, undefined]) {
    assert.equal(actionFor(code), undefined);
  }
  const released = { slow: false, fast: false, hold: false, horn: false, lamp: false };
  assert.deepEqual(heldInput(new Set(['Escape', 'KeyP', 'Slash', 'KeyQ'])), released);
  for (const action of Object.keys(released)) {
    for (const code of KEYS[action]) {
      assert.deepEqual(heldInput(new Set([code])), { ...released, [action]: true });
    }
  }
  assert.deepEqual(heldInput(new Set(Object.values(KEYS).flat())), {
    slow: true, fast: true, hold: true, horn: true, lamp: true,
  });
});
