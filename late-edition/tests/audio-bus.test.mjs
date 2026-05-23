import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioBus, AUDIO_CHANNELS } from '../js/audio/audio-bus.js';
import { CUE_TABLE } from '../js/audio/cue-table.js';
import { HTMLAudioPlayer } from '../js/audio/html-audio-player.js';

// v1.3.0 — ICD-07 first caller. Bus consumes WorldFrame.effects[] and
// routes FxEvent.kind → cue id per CUE_TABLE. Browser autoplay policy
// requires unlock(); pre-unlock consumeEffects is a silent no-op. Unknown
// kinds (e.g. raid_warning, death — unrecorded SFX) pass silently. The
// HTMLAudioElement implementation is browser-only; these tests inject a
// StubPlayer that records calls so they run under node:test without DOM.

function makeStubPlayer() {
  const calls = { loadCue: [], playCue: [], setMuted: [] };
  const mutedState = { master: false, channels: new Map() };
  return {
    calls,
    loadCue(id, path) { calls.loadCue.push({ id, path }); },
    playCue(id, channel) { calls.playCue.push({ id, channel }); },
    setMuted(muted, channel) {
      calls.setMuted.push({ muted, channel });
      if (channel === undefined) mutedState.master = muted;
      else mutedState.channels.set(channel, muted);
    },
    getMuted(channel) {
      if (channel === undefined) return mutedState.master;
      return mutedState.channels.get(channel) === true;
    },
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

// 1.4.0 — settings-popover surface. AUDIO_CHANNELS pins the channel
// vocabulary the toggles render; isChannelMuted reads back via the player
// so the popover can sync the toggle states without holding state itself.

test('AUDIO_CHANNELS locks the ICD-07 v0.1 channel vocabulary', () => {
  // Adding/removing a channel changes the popover's toggle count; lock the
  // surface so a rename anywhere requires an ICD-07 §Notes update.
  assert.deepEqual(AUDIO_CHANNELS, ['sfx', 'amb', 'mus', 'vo']);
});

test('isChannelMuted defaults to audible (false) on a fresh bus', () => {
  const player = makeStubPlayer();
  const bus = new AudioBus(player);
  assert.equal(bus.isChannelMuted(),       false, 'master defaults audible');
  assert.equal(bus.isChannelMuted('sfx'),  false);
  assert.equal(bus.isChannelMuted('amb'),  false);
  assert.equal(bus.isChannelMuted('mus'),  false);
  assert.equal(bus.isChannelMuted('vo'),   false);
});

test('isChannelMuted round-trips after mute() / unmute() forwards through the player', () => {
  const player = makeStubPlayer();
  const bus = new AudioBus(player);
  bus.mute('sfx');
  assert.equal(bus.isChannelMuted('sfx'), true);
  assert.equal(bus.isChannelMuted('amb'), false, 'untouched channel stays audible');
  bus.unmute('sfx');
  assert.equal(bus.isChannelMuted('sfx'), false);
  bus.mute();
  assert.equal(bus.isChannelMuted(), true, 'master mute reads back');
  bus.unmute();
  assert.equal(bus.isChannelMuted(), false);
});

test('isChannelMuted returns false when the player has no getMuted method (defensive)', () => {
  // Alternative Player implementations may not ship the getter (the
  // settings popover is opt-in feedback; the bus still works without it).
  const minimalPlayer = {
    loadCue() {},
    playCue() {},
    setMuted() {},
  };
  const bus = new AudioBus(minimalPlayer);
  bus.mute('sfx');
  assert.equal(bus.isChannelMuted('sfx'), false, 'no getter → UI defaults to audible');
});

test('HTMLAudioPlayer.getMuted round-trips the master + per-channel state', () => {
  // Default player (browser surface) ships with getMuted at 1.4.0.
  // Stub-free here since HTMLAudioPlayer's mute state is in-memory only.
  const player = new HTMLAudioPlayer();
  assert.equal(player.getMuted(),       false);
  assert.equal(player.getMuted('sfx'),  false);
  player.setMuted(true, 'sfx');
  assert.equal(player.getMuted('sfx'),  true);
  assert.equal(player.getMuted('amb'),  false);
  player.setMuted(true);  // master
  assert.equal(player.getMuted(),       true);
  assert.equal(player.getMuted('sfx'),  true, 'per-channel state independent of master');
  player.setMuted(false, 'sfx');
  assert.equal(player.getMuted('sfx'),  false);
});
