import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioBus } from '../js/audio/audio-bus.js';
import { CUE_TABLE } from '../js/audio/cue-table.js';

// v1.3.0 — ICD-07 first caller. Bus consumes WorldFrame.effects[] and
// routes FxEvent.kind → cue id per CUE_TABLE. Browser autoplay policy
// requires unlock(); pre-unlock consumeEffects is a silent no-op. Unknown
// kinds (e.g. raid_warning, death — unrecorded SFX) pass silently. The
// HTMLAudioElement implementation is browser-only; these tests inject a
// StubPlayer that records calls so they run under node:test without DOM.

function makeStubPlayer() {
  const calls = { loadCue: [], playCue: [], setMuted: [] };
  return {
    calls,
    loadCue(id, path) { calls.loadCue.push({ id, path }); },
    playCue(id, channel) { calls.playCue.push({ id, channel }); },
    setMuted(muted, channel) { calls.setMuted.push({ muted, channel }); },
  };
}

test('CUE_TABLE locks the three v1.3.0 recorded cues to the sfx channel', () => {
  // Shape lock — adding a row (death / raid_warning / flash) is the
  // signal that an additional Supplement-C cue recorded. Removing a row
  // is a regression. The channel commitment is the load-bearing half
  // of ICD-07 line 130 ("channels and trigger sites are locked").
  assert.deepEqual(Object.keys(CUE_TABLE).sort(), ['pickup', 'print', 'verify']);
  for (const kind of Object.keys(CUE_TABLE)) {
    assert.equal(CUE_TABLE[kind].channel, 'sfx', `${kind} → sfx channel`);
    assert.match(CUE_TABLE[kind].path, /^assets\/audio\/SFX-\d{2}-[a-z-]+\.mp3$/);
  }
});

test('consumeEffects with unknown FxEvent kind is a silent no-op', () => {
  const player = makeStubPlayer();
  const bus = new AudioBus(player);
  bus.unlock();
  bus.consumeEffects([
    { kind: 'raid_warning', at: { x: 0, y: 0, z: 0 }, rival: 'evening_star' },
    { kind: 'death',        at: { x: 0, y: 0, z: 0 }, unit_kind: 'goon' },
    { kind: 'flash',        at: { x: 0, y: 0, z: 0 } },
  ]);
  assert.equal(player.calls.playCue.length, 0);
});

test('consumeEffects is a no-op before unlock() (browser autoplay policy)', () => {
  const player = makeStubPlayer();
  const bus = new AudioBus(player);
  bus.consumeEffects([{ kind: 'pickup', at: { x: 0, y: 0, z: 0 }, story_id: 's1' }]);
  assert.equal(player.calls.playCue.length, 0, 'pre-unlock must not fire');
  bus.unlock();
  bus.consumeEffects([{ kind: 'pickup', at: { x: 0, y: 0, z: 0 }, story_id: 's1' }]);
  assert.equal(player.calls.playCue.length, 1, 'post-unlock must fire');
  assert.deepEqual(player.calls.playCue[0], { id: 'SFX-01', channel: 'sfx' });
});

test('consumeEffects after unlock dispatches one playCue per known FxEvent kind', () => {
  const player = makeStubPlayer();
  const bus = new AudioBus(player);
  bus.unlock();
  bus.consumeEffects([
    { kind: 'pickup', at: { x: 0, y: 0, z: 0 }, story_id: 's1' },
    { kind: 'verify', at: { x: 0, y: 0, z: 0 }, story_id: 's1' },
    { kind: 'print',  at: { x: 0, y: 0, z: 0 }, edition: 1 },
  ]);
  assert.equal(player.calls.playCue.length, 3);
  assert.deepEqual(player.calls.playCue[0], { id: 'SFX-01', channel: 'sfx' });
  assert.deepEqual(player.calls.playCue[1], { id: 'SFX-05', channel: 'sfx' });
  assert.deepEqual(player.calls.playCue[2], { id: 'SFX-07', channel: 'sfx' });
});

test('consumeEffects handles empty / undefined input without throwing', () => {
  const player = makeStubPlayer();
  const bus = new AudioBus(player);
  bus.unlock();
  bus.consumeEffects([]);
  bus.consumeEffects(undefined);
  bus.consumeEffects(null);
  assert.equal(player.calls.playCue.length, 0);
});

test('mute / unmute forward to the player with the correct channel argument', () => {
  const player = makeStubPlayer();
  const bus = new AudioBus(player);
  bus.mute('ambient');
  bus.unmute('ambient');
  bus.mute();
  bus.unmute();
  assert.deepEqual(player.calls.setMuted, [
    { muted: true,  channel: 'ambient' },
    { muted: false, channel: 'ambient' },
    { muted: true,  channel: undefined },
    { muted: false, channel: undefined },
  ]);
});

test('loadAll calls player.loadCue once per entry in the cue table', () => {
  const player = makeStubPlayer();
  const bus = new AudioBus(player);
  bus.loadAll();
  assert.equal(player.calls.loadCue.length, Object.keys(CUE_TABLE).length);
  const loadedIds = player.calls.loadCue.map((c) => c.id).sort();
  assert.deepEqual(loadedIds, ['SFX-01', 'SFX-05', 'SFX-07']);
});
