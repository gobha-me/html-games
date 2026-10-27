import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { KEYS, CONTROL_LABELS, actionFor, heldInput } from '../js/keys.js';

// Independent copy of the shipped bindings (#116 must not change them).
const BINDINGS = [
  ['slow', ['ArrowLeft', 'KeyA'], '← / A · slow'],
  ['fast', ['ArrowRight', 'KeyD'], '→ / D · fast'],
  ['hold', ['Space'], 'Space · hold'],
  ['horn', ['KeyH'], 'H · horn'],
  ['lamp', ['KeyK'], 'K · signal lamp'],
  ['log', ['KeyL'], 'L · keeper’s log'],
  ['pause', ['Escape', 'KeyP'], 'Esc / P · pause'],
  ['help', ['Slash'], '? · controls'],
];
const HELD = ['slow', 'fast', 'hold', 'horn', 'lamp'];
const MODAL = ['log', 'pause', 'help'];
const NONE_HELD = Object.freeze({ slow: false, fast: false, hold: false, horn: false, lamp: false });
const KEYS_URL = new URL('../js/keys.js', import.meta.url);
const SOURCE = readFileSync(KEYS_URL, 'utf8');

// Import a variant of the real module from a data: URL in a fresh process.
function importVariant(source, probe = '') {
  return spawnSync(process.execPath, ['--input-type=module', '-e', `
    const keys = await import('data:text/javascript,' + encodeURIComponent(${JSON.stringify(source)}));
    ${probe}
  `], { encoding: 'utf8' });
}
function replaceOnce(source, search, replacement) {
  assert.ok(source.includes(search), `fixture text present: ${search}`);
  return source.replace(search, replacement);
}

test('KEYS and CONTROL_LABELS pin the shipped bindings, labels and card order', () => {
  assert.deepEqual(Object.keys(KEYS), BINDINGS.map(([action]) => action));
  assert.deepEqual(Object.keys(CONTROL_LABELS), BINDINGS.map(([action]) => action));
  for (const [action, codes, label] of BINDINGS) {
    assert.deepEqual([...KEYS[action]], codes, action);
    assert.equal(CONTROL_LABELS[action], label, action);
  }
  const codes = Object.values(KEYS).flat();
  assert.equal(codes.length, 11);
  assert.equal(new Set(codes).size, codes.length, 'each physical code has exactly one owner');
  for (const code of codes) assert.match(code, /^(Arrow(Left|Right)|Key[A-Z]|Space|Escape|Slash)$/);
});

test('every action has exactly one non-empty label and every label names an action', () => {
  for (const action of Object.keys(KEYS)) {
    assert.ok(Object.hasOwn(CONTROL_LABELS, action), `label for ${action}`);
    assert.equal(typeof CONTROL_LABELS[action], 'string');
    assert.notEqual(CONTROL_LABELS[action].trim(), '');
    assert.ok(KEYS[action].length >= 1, `${action} has a binding`);
  }
  for (const action of Object.keys(CONTROL_LABELS)) assert.ok(Object.hasOwn(KEYS, action), `action for label ${action}`);
  assert.equal(new Set(Object.values(CONTROL_LABELS)).size, Object.keys(CONTROL_LABELS).length, 'labels are distinct');
});

test('binding tables are deeply frozen: no caller can rebind, add, remove or relabel a key', () => {
  assert.ok(Object.isFrozen(KEYS));
  assert.ok(Object.isFrozen(CONTROL_LABELS));
  for (const [action, codes] of Object.entries(KEYS)) {
    assert.ok(Object.isFrozen(codes), `${action} codes frozen`);
    assert.ok(Array.isArray(codes));
    assert.throws(() => { codes.push('KeyZ'); }, TypeError);
    assert.throws(() => { codes[0] = 'KeyZ'; }, TypeError);
    assert.throws(() => { codes.length = 0; }, TypeError);
    // A one-element reverse/sort writes nothing, so only multi-key bindings can throw there.
    if (codes.length > 1) {
      assert.throws(() => { codes.reverse(); }, TypeError);
      assert.throws(() => { codes.sort(); }, TypeError);
    }
    assert.throws(() => { codes.unshift('KeyZ'); }, TypeError);
    assert.throws(() => { codes.splice(0, 1); }, TypeError);
  }
  assert.throws(() => { KEYS.slow = ['KeyZ']; }, TypeError);
  assert.throws(() => { KEYS.jump = ['KeyJ']; }, TypeError);
  assert.throws(() => { delete KEYS.help; }, TypeError);
  assert.throws(() => { CONTROL_LABELS.horn = 'H · fog bell'; }, TypeError);
  assert.throws(() => { delete CONTROL_LABELS.log; }, TypeError);
  assert.throws(() => { Object.setPrototypeOf(KEYS, { jump: ['KeyJ'] }); }, TypeError);
  // Attempts above must not have leaked into lookup.
  for (const [action, codes] of BINDINGS) for (const code of codes) assert.equal(actionFor(code), action);
  assert.equal(actionFor('KeyZ'), undefined);
  assert.equal(actionFor('KeyJ'), undefined);
});

test('actionFor maps every bound code and only exact physical code strings', () => {
  for (const [action, codes] of BINDINGS) for (const code of codes) assert.equal(actionFor(code), action, code);
  for (const unknown of [
    'KeyZ', 'KeyQ', 'KeyW', 'KeyS', 'Enter', 'Tab', 'ShiftLeft', 'Digit1', 'Numpad5', 'ArrowUp', 'ArrowDown',
    '', ' ', 'keyl', 'KEYL', 'KeyL ', ' KeyL', 'Key L', 'l', 'L', '?', '/', 'Esc', 'space', 'Spacebar',
    'slow', 'fast', 'hold', 'horn', 'lamp', 'log', 'pause', 'help',
    '__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty', 'isPrototypeOf', 'length', '0',
    'ArrowLeft,KeyA', 'KeyA,ArrowLeft',
  ]) {
    assert.equal(actionFor(unknown), undefined, JSON.stringify(unknown));
  }
});

test('actionFor never coerces non-string input, including values that stringify to a bound code', () => {
  let coerced = 0;
  const sneaky = {
    toString() { coerced++; return 'KeyL'; },
    valueOf() { coerced++; return 'KeyL'; },
    [Symbol.toPrimitive]() { coerced++; return 'KeyL'; },
  };
  for (const invalid of [
    undefined, null, 0, 1, NaN, Infinity, -0, true, false, 32n, Symbol('KeyL'), Symbol.for('KeyL'),
    ['KeyL'], [['KeyL']], ['ArrowLeft', 'KeyA'], [], {}, { code: 'KeyL' }, new String('KeyL'), sneaky,
    () => 'KeyL', new Set(['KeyL']), new Map([['KeyL', 'log']]), Object.create(null), KEYS, KEYS.log,
  ]) {
    assert.equal(actionFor(invalid), undefined, String(typeof invalid));
  }
  assert.equal(coerced, 0, 'no toString/valueOf/toPrimitive was invoked');
  assert.equal(actionFor(), undefined);
});

test('heldInput reports exactly the five held actions, per code, and ignores modal toggles', () => {
  assert.deepEqual(heldInput(new Set()), NONE_HELD);
  assert.deepEqual(Object.keys(heldInput(new Set())), HELD);
  for (const [action, codes] of BINDINGS) {
    for (const code of codes) {
      const held = heldInput(new Set([code]));
      assert.deepEqual(Object.keys(held), HELD, code);
      for (const name of HELD) assert.equal(held[name], name === action, `${code} → ${name}`);
      if (MODAL.includes(action)) assert.deepEqual(held, NONE_HELD, `${code} is a toggle, never held`);
    }
  }
  const everything = new Set(Object.values(KEYS).flat());
  assert.deepEqual(heldInput(everything), { slow: true, fast: true, hold: true, horn: true, lamp: true });
  for (const action of MODAL) assert.equal(Object.hasOwn(heldInput(everything), action), false);
  assert.deepEqual(heldInput(new Set(['KeyL', 'Escape', 'KeyP', 'Slash'])), NONE_HELD);
  // Overlapping slow and fast is reported as-is; the simulation resolves it.
  assert.deepEqual(heldInput(new Set(['KeyA', 'ArrowRight'])), { ...NONE_HELD, slow: true, fast: true });
});

test('heldInput ignores unknown and non-string members and leaves the caller set untouched', () => {
  const pressed = new Set(['KeyZ', '', 'keyh', 'horn', '__proto__', 32, null, undefined, Symbol('KeyH'),
    ['KeyH'], new String('KeyH'), { toString: () => 'KeyH' }]);
  const before = [...pressed];
  assert.deepEqual(heldInput(pressed), NONE_HELD);
  assert.deepEqual([...pressed], before);
  pressed.add('KeyH');
  assert.deepEqual(heldInput(pressed), { ...NONE_HELD, horn: true });
  const first = heldInput(pressed), second = heldInput(pressed);
  assert.notStrictEqual(first, second, 'fresh object per call');
  first.horn = false;
  assert.equal(heldInput(pressed).horn, true);
  class PressedKeys extends Set {}
  assert.deepEqual(heldInput(new PressedKeys(['Space'])), { ...NONE_HELD, hold: true });
});

test('heldInput rejects every non-Set container, even ones with a working has()', () => {
  for (const invalid of [
    undefined, null, 0, 'KeyH', ['KeyH'], {}, { has: () => true }, new Map([['KeyH', true]]),
    new WeakSet(), Object.create(Set.prototype), new Proxy({}, { get: () => () => true }),
  ]) {
    assert.throws(() => heldInput(invalid), (error) => error instanceof TypeError
      && /Set/.test(error.message), String(invalid?.constructor?.name ?? invalid));
  }
  assert.throws(() => heldInput(), TypeError);
});

test('keys module stays pure: no browser globals, clock or randomness during import and lookups', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    for (const name of ['Date', 'window', 'document', 'localStorage', 'performance', 'navigator']) {
      Object.defineProperty(globalThis, name, { get() { throw new Error(name + ' read'); }, configurable: true });
    }
    Math.random = () => { throw new Error('Math.random called'); };
    const keys = await import(${JSON.stringify(KEYS_URL.href)});
    if (keys.actionFor('Slash') !== 'help') throw new Error('lookup');
    if (!keys.heldInput(new Set(['KeyK'])).lamp) throw new Error('held');
  `], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});

test('import refuses duplicate, empty and non-string codes and unlabelled actions', () => {
  // Sanity: the unmodified source loads through the same path.
  const ok = importVariant(SOURCE, "if (keys.actionFor('KeyL') !== 'log') process.exit(3);");
  assert.equal(ok.status, 0, ok.stderr);
  const broken = {
    'duplicate across actions': replaceOnce(SOURCE, "horn: Object.freeze(['KeyH'])", "horn: Object.freeze(['KeyH', 'KeyA'])"),
    'duplicate within one action': replaceOnce(SOURCE, "hold: Object.freeze(['Space'])", "hold: Object.freeze(['Space', 'Space'])"),
    'empty code': replaceOnce(SOURCE, "help: Object.freeze(['Slash'])", "help: Object.freeze(['Slash', ''])"),
    'numeric code': replaceOnce(SOURCE, "lamp: Object.freeze(['KeyK'])", "lamp: Object.freeze(['KeyK', 75])"),
    'missing label': replaceOnce(SOURCE, "help: '? · controls',", ''),
  };
  for (const [name, source] of Object.entries(broken)) {
    const result = importVariant(source);
    assert.notEqual(result.status, 0, `${name} must fail at import`);
    assert.match(result.stderr, name === 'missing label' ? /Missing control label: help/ : /Invalid or duplicate control code/, name);
  }
});
