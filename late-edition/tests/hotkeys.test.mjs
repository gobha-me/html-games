import assert from 'node:assert/strict';
import test from 'node:test';
import { HOTKEYS, hotkeyAction } from '../js/hotkeys.js';

function buildHotkeyMap(bindings) {
  const phases = new Map();
  for (const { action, keys, phases: activePhases } of bindings) {
    for (const phase of activePhases) {
      if (!phases.has(phase)) phases.set(phase, new Map());
      const map = phases.get(phase);
      for (const key of keys) {
        const normalized = key.toLowerCase();
        assert.ok(!map.has(normalized),
          `${phase}: ${JSON.stringify(normalized)} binds both ${map.get(normalized)} and ${action}`);
        map.set(normalized, action);
      }
    }
  }
  return phases;
}

test('the full application hotkey map has no duplicate bindings in any phase', () => {
  const phases = buildHotkeyMap(HOTKEYS);
  assert.deepEqual([...phases.keys()].sort(),
    ['cold-open', 'desk', 'drawer-open', 'modal', 'paste-up', 'title']);
  for (const [phase, keys] of phases) {
    for (const [key, action] of keys) {
      assert.equal(hotkeyAction(phase, key), action);
      assert.equal(hotkeyAction(phase, key.toUpperCase()), action);
    }
    assert.equal(hotkeyAction(phase, 'unbound'), undefined);
  }
  for (const phase of ['desk', 'paste-up', 'drawer-open']) {
    assert.equal(phases.get(phase).get('d'), 'toggle-drawer');
  }
  assert.equal(phases.get('paste-up').get('f'), 'place:above_fold');
  assert.equal(phases.get('paste-up').get('2'), 'place:above_fold');
  assert.equal(phases.get('desk').has('f'), false);
  assert.equal(phases.get('drawer-open').has('f'), false);
  assert.equal(phases.get('modal').has('d'), false);
  assert.equal(hotkeyAction('unknown-phase', 'd'), undefined);
});

test('collision guard rejects the original F/drawer regression even if Fold would win lookup', () => {
  const broken = HOTKEYS.map((binding) => binding.action === 'toggle-drawer' ?
    { ...binding, keys: ['f'] } : binding);
  // Both traversal orders must fail: lookup precedence must never hide a conflict.
  for (const bindings of [broken, [...broken].reverse()]) {
    assert.throws(() => buildHotkeyMap(bindings), /paste-up: "f" binds both .* and /);
  }
});

for (const phase of ['desk', 'paste-up', 'drawer-open', 'modal']) {
  test(`collision guard rejects a second D action in ${phase}, including uppercase aliases`, () => {
    const broken = [...HOTKEYS,
      { action: 'conflicting-action', keys: ['D'], phases: [phase] }];
    if (phase === 'modal') {
      broken.push({ action: 'another-modal-action', keys: ['d'], phases: [phase] });
    }
    assert.throws(() => buildHotkeyMap(broken), new RegExp(`${phase}: "d" binds both .* and `));
  });
}

test('shared desk keys have explicit paste-up replacements and overlays isolate gameplay', () => {
  for (const [key, desk, pasteUp] of [
    ['1', 'select-operative:0', 'place:banner'],
    ['2', 'select-operative:1', 'place:above_fold'],
    ['3', 'select-operative:2', 'place:photo_expose'],
    ['4', 'select-operative:3', 'place:editorial'],
    ['e', 'fortify', 'place:editorial'],
    ['p', 'pause', 'place:photo_expose'],
  ]) {
    assert.equal(hotkeyAction('desk', key), desk);
    assert.equal(hotkeyAction('paste-up', key), pasteUp);
    assert.equal(hotkeyAction('drawer-open', key), undefined);
    assert.equal(hotkeyAction('modal', key), undefined);
  }
});
