import test from 'node:test';
import assert from 'node:assert/strict';
import { createState, step, bearingTo, perception, resetLamp } from '../js/sim.js';
import { keyingFor, encode } from '../js/morse.js';
import { HULLS, threatensReef } from '../js/physics.js';

function aimed() {
  const state = createState();
  state.beam = bearingTo(state.trawler);
  return state;
}
// Use actual action edges and simulation time, never inject decoder events.
function send(state, text, finish = true) {
  const schedule = keyingFor(text);
  let elapsed = 0;
  for (const { on, off } of schedule) {
    if (on > elapsed) state = step(state, { hold: true }, (on - elapsed) / 1000);
    state = step(state, { hold: true, lamp: true }, (off - on) / 1000);
    elapsed = off;
  }
  return step(state, { hold: true }, finish ? 1.05 : 0.001);
}

test('ROCKS warns only the ship lit at completion, reuses avoidance and never costs trust', () => {
  let state = aimed();
  const other = structuredClone(state.trawler);
  other.id = 'other'; other.x *= -1; other.y *= -1;
  state.ships.push(other);
  state.trust = 0; state.hornIgnoredUntil = 100;
  const prior = structuredClone(state);
  state = send(state, 'ROCKS');
  assert.equal(state.morse.text, 'ROCKS');
  assert.equal(state.morse.lastMessage.recipient, 'trawler');
  assert.notEqual(state.trawler.warnedAt, null);
  assert.equal(state.trawler.response, 'turn-away');
  assert.equal(state.trawler.reactAt, state.trawler.warnedAt + HULLS.trawler.reactionSeconds[1]);
  assert.equal(state.ships[1].warnedAt, null);
  assert.deepEqual(state.blasts, []);
  assert.ok(Math.abs(state.trust - state.time * 0.01) < 1e-9);
  const warnedAt = state.trawler.warnedAt;
  state = send(state, 'ROCKS');
  assert.equal(state.trawler.warnedAt, warnedAt, 'do not replan a repeated warning');
  assert.ok(state.trawler.navigation);
  assert.ok(['out', 'resume'].includes(state.trawler.navigation.phase));
  state = step(state, {}, 180);
  assert.equal(state.trawler.wreckedAt, null);
  assert.equal(prior.trawler.warnedAt, null);
});

test('both ships can be endangered and in horn range: directed warning still reaches only one', () => {
  let state = aimed();
  state.trawler.x *= 0.9; state.trawler.y *= 0.9;
  const other = structuredClone(state.trawler);
  other.id = 'also-endangered';
  // Use a second radial approach through a different hazard.
  const rock = state.hazards.find((r) => Math.abs(bearingTo(r) - state.beam) > 30);
  const bearing = bearingTo(rock), angle = bearing * Math.PI / 180;
  const range = Math.hypot(rock.x, rock.y) + 100;
  other.x = Math.sin(angle) * range; other.y = -Math.cos(angle) * range; other.heading = (bearing + 180) % 360;
  state.ships.push(other);
  const reefs = state.hazards.map((r) => ({ x: r.x, y: -r.y, radius: r.radius + 8 }));
  for (const ship of state.ships) assert.equal(threatensReef({ ...ship, y: -ship.y }, reefs, 120), true);
  state = send(state, 'ROCKS');
  assert.notEqual(state.trawler.warnedAt, null);
  assert.equal(state.ships[1].warnedAt, null);
  assert.equal(state.ships[1].reply, null);
});

test('no recipient when unlit, even with an afterimage; recipient chosen at completion', () => {
  let state = send(aimed(), 'ROCKS', false);
  assert.equal(state.morse.lastMessage, null);
  state.beam = (state.beam + 90) % 360;
  state = step(state, { hold: true }, 1.049);
  assert.equal(state.morse.lastMessage.recipient, null);
  assert.equal(state.trawler.warnedAt, null);
  assert.equal(state.trawler.reply, null);
  assert.ok(state.trawler.afterimage > 0);
  state = send(state, 'K', false);
  state.beam = bearingTo(state.trawler);
  state = step(state, { hold: true }, 1.049);
  assert.equal(state.morse.lastMessage.recipient, 'trawler');
  assert.deepEqual(state.trawler.reply.flashes, keyingFor('K'));
});

test('seven-unit idle completes exactly once, not at three units or one ms before seven', () => {
  let state = step(aimed(), { hold: true, lamp: true }, 0.125);
  state = step(state, { hold: true }, 0.375);
  assert.equal(state.morse.text, 'E');
  assert.equal(state.morse.lastMessage, null);
  state = step(state, { hold: true }, 0.499);
  assert.equal(state.morse.lastMessage, null);
  state = step(state, { hold: true }, 0.001);
  assert.equal(state.morse.lastMessage.text, 'E');
  const completed = state.morse.lastMessage.time, started = state.trawler.reply.startedAt;
  state = step(state, { hold: true }, 3);
  assert.equal(state.morse.lastMessage.time, completed);
  assert.equal(state.trawler.reply.startedAt, started);
});

test('ship replies blink at 8 WPM or the 5 WPM setting without leaking decoded reply text', () => {
  for (const wpm of [8, 5]) {
    let state = aimed();
    state.settings.incomingWpm = wpm;
    state = send(state, 'K');
    assert.deepEqual(state.trawler.reply.flashes, keyingFor('K', wpm));
    assert.equal(perception(state).signal, true);
    const reply = state.trawler.reply;
    for (const { on, off } of reply.flashes) {
      state.time = reply.startedAt + (on + 1) / 1000;
      assert.equal(perception(state).signal, true);
      state.time = reply.startedAt + (off + 1) / 1000;
      assert.equal(perception(state).signal, false);
    }
    state.time = reply.startedAt;
    state.beam = (state.beam + 90) % 360;
    assert.equal(perception(state).hull, state.trawler.lastSeen);
    assert.equal(perception(state).signal, true, 'only a blinking point is visible off beam');
    state.trawler.x *= 2; state.trawler.y *= 2;
    assert.equal(perception(state).signal, false, 'fog limits the signal');
  }
});

test('garbage sends a question-mark reply; smugglers and acknowledgements stay silent; safe ROCKS holds course', () => {
  let state = send(aimed(), '?');
  assert.equal(state.morse.text, '?');
  assert.equal(state.morse.symbols, '..--..');
  assert.deepEqual(state.trawler.reply.flashes, keyingFor('?'));
  assert.equal(state.trawler.warnedAt, null);
  for (const text of ['R', 'AR']) {
    state = send(aimed(), text);
    assert.equal(state.trawler.reply, null);
  }
  state = aimed(); state.trawler.smuggler = true;
  state = send(state, 'ROCKS');
  assert.equal(state.trawler.reply, null);
  assert.equal(state.trawler.warnedAt, null);
  assert.equal(perception(state).signal, false);
  state = aimed(); state.trawler.heading = state.beam;
  const heading = state.trawler.heading;
  // Bring the outward safe ship well inside fog reach for the whole message.
  state.trawler.x *= 0.8; state.trawler.y *= 0.8;
  state = send(state, 'ROCKS');
  assert.equal(state.trawler.warnedAt, null);
  assert.equal(state.trawler.heading, heading);
  assert.deepEqual(state.trawler.reply.flashes, keyingFor('R'));
});

test('WHO replies with a stable alphanumeric callsign and wrecks cannot receive or flash', () => {
  let state = send(aimed(), 'WHO');
  assert.match(state.trawler.callsign, /^[A-Z0-9]+$/);
  assert.deepEqual(state.trawler.reply.flashes, keyingFor(state.trawler.callsign));
  state.trawler.status = 'wrecked';
  assert.equal(perception(state).signal, false);
  state = send(state, 'K');
  assert.equal(state.morse.lastMessage.recipient, null);
});

test('known unfinished commands survive the seven-unit word gap and dispatch the whole vocabulary', () => {
  for (const [text, reply] of [['WHAT LIGHT', 'SKR'], ['STEER N', 'R'], ['STEER S', 'R'], ['STEER E', 'R'], ['STEER W', 'R']]) {
    const state = send(aimed(), text);
    assert.equal(state.morse.lastMessage.text, text);
    assert.equal(state.morse.lastMessage.recipient, 'trawler');
    assert.deepEqual(state.trawler.reply.flashes, keyingFor(reply));
    assert.equal(state.trawler.warnedAt, null, 'only ROCKS changes navigation');
  }
  let state = send(aimed(), 'WHAT');
  assert.equal(state.morse.lastMessage, null);
  assert.equal(state.trawler.reply, null, 'do not reply to the unfinished first word');
  state = resetLamp(state);
  state = send(state, 'HELLO');
  assert.equal(state.morse.lastMessage.text, 'HELLO');
  assert.deepEqual(state.trawler.reply.flashes, keyingFor('?'));
});

test('mode reset discards held key and partial message; pause adds no synthetic dash or replay', () => {
  let state = step(aimed(), { lamp: true, hold: true }, 0.1);
  const before = structuredClone(state);
  state = resetLamp(state);
  assert.equal(before.lamp, true);
  assert.equal(state.lamp, false);
  assert.equal(state.morse.down, null);
  state = step(state, { hold: true }, 15);
  assert.equal(state.morse.text, '');
  assert.equal(state.morse.lastMessage, null);
  state = send(state, 'K');
  assert.equal(state.morse.lastMessage.text, 'K');
  const completed = structuredClone(state.morse.lastMessage);
  state = step(state, { lamp: true, hold: true }, 1);
  state = resetLamp(state);
  state = step(state, { hold: true }, 10);
  assert.deepEqual(state.morse.lastMessage, completed);
  assert.equal(state.morse.text, '');
  assert.equal(encode(completed.text), completed.symbols);
});

test('reject nonboolean lamp, zero-time input is inert, dawn extinguishes the lamp', () => {
  for (const lamp of [null, undefined, 0, 1, '', 'true', {}, []]) {
    assert.throws(() => step(createState(), { lamp }), TypeError);
  }
  const state = aimed();
  assert.deepEqual(step(state, { lamp: true }, 0), state);
  const dawn = step(state, { lamp: true, hold: true }, 180);
  assert.equal(dawn.lamp, false);
  assert.deepEqual(step(dawn, { lamp: true }, 1), dawn);
});
