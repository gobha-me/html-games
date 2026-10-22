import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { NoirAudio, AUDIO_SETTINGS_KEY, DEFAULT_AUDIO_SETTINGS, readAudioSettings } from '../js/audio.js';
import { createAudioAdapter } from '../js/adapters.js';
import { EDITION_DURATION_SEC } from '../js/config.js';
import { makeSim } from './helpers.mjs';

class Param {
  constructor() { this.value = 0; this.events = []; }
  setTargetAtTime(value, time, constant) { this.events.push({ value, time, constant }); }
  setValueAtTime(value, time) { this.events.push({ value, time }); }
  linearRampToValueAtTime(value, time) { this.events.push({ value, time }); }
  exponentialRampToValueAtTime(value, time) { this.events.push({ value, time }); }
}
class Node {
  constructor() { this.gain = new Param(); this.frequency = new Param(); this.Q = new Param(); this.connections = []; }
  connect(node) { this.connections.push(node); return node; }
  disconnect() { this.disconnected = true; }
  start(time) { this.startTime = time; }
  stop(time) { this.stopTime = time; }
}
class Context {
  constructor() { this.state = 'suspended'; this.currentTime = 7; this.sampleRate = 8000; this.destination = new Node(); this.sources = []; this.resumes = 0; this.suspends = 0; }
  createGain() { return new Node(); }
  createBiquadFilter() { return new Node(); }
  createOscillator() { const node = new Node(); this.sources.push(node); return node; }
  createBufferSource() { return this.createOscillator(); }
  createBuffer(channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  async resume() { this.resumes++; this.state = 'running'; }
  async suspend() { this.suspends++; this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}
function setup(options = {}) {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const audio = new NoirAudio({ getContext: () => Context, getStorage: () => storage, ...options });
  return { audio, values, storage };
}

for (const bad of [undefined, null, '', '{', 'null', '[]', '42', 'true',
  '{"version":2,"muted":true,"volumes":{"music":1}}', '{"version":1,"volumes":null}']) {
  test(`audio settings refuse corrupt/unsupported storage: ${String(bad)}`, () => {
    assert.deepEqual(readAudioSettings(bad), DEFAULT_AUDIO_SETTINGS);
  });
}

test('stored numbers clamp; wrong types, pollution, missing values and fake mute do not coerce', () => {
  assert.deepEqual(readAudioSettings('{"version":1,"muted":"false","volumes":{"music":-100,"ambience":100,"sfx":"0"},"__proto__":{"muted":true}}'),
    { music: 0, ambience: 1, sfx: 0.65, muted: false });
  assert.deepEqual(readAudioSettings('{"version":1,"muted":true,"volumes":{"music":null,"ambience":1e999,"sfx":false}}'),
    { ...DEFAULT_AUDIO_SETTINGS, muted: true });
  assert.equal({}.muted, undefined);
});

test('constructor, cues, settings and pause before gesture never even resolve the context factory', async () => {
  let lookups = 0;
  const { audio } = setup({ getContext: () => { lookups++; return Context; } });
  audio.setScene({ active: true, progress: 1 });
  for (const event of ['phoneRing', 'pressRun', 'deadline', 'editionStart', 'wireBell']) audio.emit(event);
  audio.setVolume('music', 0.2);
  await audio.setSuspended(true);
  await audio.resume(); // Gestures behind the small-desk/hidden gate cannot unlock.
  assert.equal(lookups, 0);
  await audio.setSuspended(false);
  assert.equal(lookups, 0);
  assert.equal(audio.ctx, null);
  await audio.resume();
  assert.equal(lookups, 1);
  assert.equal(audio.ctx.state, 'running');
});

test('missing/throwing context and failing graph setup remain silent and retryable', async () => {
  let contextClass;
  const { audio } = setup({ getContext: () => contextClass });
  await audio.resume();
  contextClass = class { constructor() { throw new Error('No device'); } };
  await audio.resume();
  assert.equal(audio.ctx, null);
  let closed = false;
  contextClass = class extends Context {
    createGain() { throw new Error('Device removed'); }
    async close() { closed = true; throw new Error('Already closed'); }
  };
  await audio.resume();
  assert.equal(closed, true);
  assert.equal(audio.ctx, null);
  contextClass = Context;
  await audio.resume();
  assert.equal(audio.ctx.state, 'running');
});

test('resume rejection does not loop on UI ticks; next gesture retries the same context', async () => {
  const { audio } = setup({ getContext: () => class extends Context {
    async resume() { this.resumes++; if (this.resumes === 1) throw new Error('Autoplay blocked'); this.state = 'running'; }
  } });
  await audio.resume();
  const ctx = audio.ctx;
  assert.equal(ctx.state, 'suspended');
  for (let i = 0; i < 100; i++) await audio.setSuspended(false);
  assert.equal(ctx.resumes, 1);
  await audio.resume();
  assert.equal(audio.ctx, ctx);
  assert.equal(ctx.state, 'running');
});

test('hide while resume is pending settles suspended, then foreground resumes', async () => {
  let release;
  const { audio } = setup({ getContext: () => class extends Context {
    async resume() { await new Promise((resolve) => { release = resolve; }); this.state = 'running'; }
  } });
  const pending = audio.resume();
  await audio.setSuspended(true);
  release();
  await pending;
  assert.equal(audio.ctx.state, 'suspended');
  // Replace the deliberately deferred device operation for the return trip.
  audio.ctx.resume = Context.prototype.resume;
  await audio.setSuspended(false);
  assert.equal(audio.ctx.state, 'running');
});

test('foreground during pending suspend settles running; rejecting suspend terminates', async () => {
  const { audio } = setup();
  await audio.resume();
  let release;
  audio.ctx.suspend = async function () { await new Promise((resolve) => { release = resolve; }); this.state = 'suspended'; };
  const pending = audio.setSuspended(true);
  await audio.setSuspended(false);
  release();
  await pending;
  assert.equal(audio.ctx.state, 'running');
  audio.ctx.suspend = async () => { throw new Error('Device gone'); };
  await audio.setSuspended(true);
  assert.equal(audio.transition, null);
  const before = audio.voices.size;
  audio.emit('pressRun');
  assert.equal(audio.voices.size, before, 'blocked state silences even if device cannot suspend');
});

test('three real buses, rising beds, bounded voices, cancellation and ended-node cleanup', async () => {
  const { audio } = setup();
  await audio.resume();
  assert.notEqual(audio.buses.music, audio.buses.sfx);
  assert.equal(audio.buses.ambience.connections[0], audio.master);
  audio.setScene({ active: true, progress: 0 });
  const quiet = audio.beds.map((bed) => bed.gain.gain.events.at(-1).value);
  audio.setScene({ active: true, progress: 1 });
  audio.beds.forEach((bed, i) => assert.ok(bed.gain.gain.events.at(-1).value > quiet[i]));
  audio.setScene({ active: true, progress: NaN });
  assert.equal(audio.scene.progress, 0);
  for (const event of ['editionStart', 'deadline', 'phoneRing', 'wireBell', 'shutter', 'dispatch', 'bribe', 'typewriter', 'pressRun']) audio.emit(event);
  const press = [...audio.voices].filter((voice) => voice.group === 'press');
  assert.ok(press.length > 10);
  assert.ok(press.some((voice) => voice.source.startTime >= audio.ctx.currentTime + 2.7), 'street cry is scheduled after spin-up');
  assert.ok([...audio.voices].some((voice) => voice.nodes.some((node) => node.connections.includes(audio.buses.music))));
  audio.cancel('press');
  assert.ok(press.every((voice) => voice.nodes.every((node) => node.disconnected)));
  assert.ok([...audio.voices].every((voice) => voice.group !== 'press'));
  const ending = [...audio.voices][0];
  ending.source.onended();
  assert.equal(audio.voices.has(ending), false);
  for (let i = 0; i < 100; i++) audio.emit('phoneRing');
  assert.equal(audio.voices.size, 64, 'rapid hostile input cannot allocate unbounded voices');
  audio.toggleMute();
  assert.equal(audio.voices.size, 0, 'mute also cancels future press/newsboy notes');
  audio.emit('pressRun');
  assert.equal(audio.voices.size, 0);
  assert.equal(audio.master.gain.events.at(-1).value, 0);
});

test('volume and mute persist independently of run saves; unavailable storage and invalid inputs are safe', async () => {
  const { audio, storage, values } = setup();
  audio.setVolume('music', 0.125);
  audio.setVolume('sfx', 0);
  audio.toggleMute();
  const reloaded = setup({ getStorage: () => storage }).audio;
  assert.deepEqual(reloaded.settings, { music: 0.125, ambience: 0.35, sfx: 0, muted: true });
  assert.equal(values.size, 1);
  assert.equal(JSON.parse(values.get(AUDIO_SETTINGS_KEY)).version, 1);
  for (const volume of ['1', NaN, Infinity, undefined]) audio.setVolume('music', volume);
  audio.setVolume('__proto__', 1);
  assert.equal(audio.settings.music, 0.125);
  const denied = setup({ getStorage: () => { throw new Error('Storage blocked'); } }).audio;
  denied.toggleMute();
  denied.setVolume('sfx', 100);
  assert.equal(denied.settings.sfx, 1);
  assert.equal(denied.muted, true);
  const quota = setup({ getStorage: () => ({ getItem: () => null, setItem() { throw new Error('Quota'); } }) }).audio;
  quota.setVolume('music', 0);
  await quota.resume();
  quota.editionStart();
  assert.equal(quota.voices.size, 0, 'zero music channel silences the actual music cues');
});

test('optional audio sink rejects both sync and async failures without escaping gameplay', async () => {
  const broken = createAudioAdapter({ emit() { throw new Error('Device'); } });
  const rejected = createAudioAdapter({ dispatch() { return Promise.reject(new Error('Device')); } });
  assert.doesNotThrow(() => { broken.emit('pressRun'); rejected.dispatch(); });
  const { audio } = setup();
  await audio.resume();
  audio.ctx.createOscillator = () => { throw new Error('Device removed'); };
  assert.doesNotThrow(() => createAudioAdapter(audio).emit('dispatch'));
  await new Promise((resolve) => setImmediate(resolve)); // Expose unhandled rejections to node:test.
});

test('sim emits start and 11:55 cues once, including a crossing step and gated unhappy paths', () => {
  const events = [];
  const sim = makeSim({ audio: { emit: (event) => events.push(event) } });
  sim.step(0.05);
  sim.step(0.05);
  assert.equal(events.filter((event) => event === 'editionStart').length, 1);
  sim.clockSec = EDITION_DURATION_SEC * (355 / 360) - 0.01;
  sim.paused = true;
  sim.step(1);
  assert.equal(events.includes('deadline'), false);
  sim.paused = false;
  sim.step(1);
  sim.step(0.1);
  assert.equal(events.filter((event) => event === 'deadline').length, 1);
  sim.publishEdition();
  sim.publishEdition();
  assert.equal(events.filter((event) => event === 'pressRun').length, 1);
  sim.editionSummary = null;
  sim.step(0.05);
  assert.equal(events.filter((event) => event === 'editionStart').length, 2);
});

test('five-edition state hashes match with synthesized audio on, muted, absent and throwing', async () => {
  const { audio } = setup();
  const muted = setup().audio;
  await audio.resume();
  await muted.resume();
  assert.equal(audio.ctx.state, 'running', 'equivalence must exercise real synthesis paths');
  muted.toggleMute();
  const sims = [audio, muted, undefined, { emit() { throw new Error('Broken'); } }].map((port) => makeSim({ seed: 81, audio: port }));
  for (let edition = 0; edition < 5; edition++) {
    for (let tick = 0; tick < 42; tick++) {
      for (const sim of sims) {
        if (tick % 3 === 0) sim.dispatchOperativeToLead('rep_1', sim.leads[0].uid);
        sim.step(5);
        if (sim.phase === 'paste-up' && sim.scoopedStories[0] && !sim.frontPage.banner) sim.placeStory(sim.scoopedStories[0].uid, 'banner');
      }
      assert.equal(new Set(sims.map((sim) => sim.getStateHash())).size, 1);
    }
    for (const sim of sims) {
      sim.publishEdition();
      assert.equal(sim.editionsPrinted, edition + 1);
      sim.editionSummary = null;
    }
    assert.equal(new Set(sims.map((sim) => sim.getStateHash())).size, 1);
  }
});

test('audio payload is below 2 MB and provenance covers synthesis without remote assets or timers', () => {
  const dir = new URL('../assets/audio/', import.meta.url);
  const files = readdirSync(dir).filter((file) => /\.(mp3|wav|ogg|m4a|flac)$/i.test(file));
  assert.ok(files.reduce((sum, file) => sum + statSync(new URL(file, dir)).size, 0) < 2_000_000);
  assert.equal(files.length, 0, 'no unlicensed legacy samples retained');
  assert.match(readFileSync(new URL('CREDITS.md', dir), 'utf8'), /source-filter/i);
  const source = readFileSync(new URL('../js/audio.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\b(?:fetch|setTimeout|setInterval|speechSynthesis)\s*\(/);
});
