import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, step, summary, isLit, bearingTo, perception, planSpawns, validateSchedule,
  specialtyApproach, installSpecialty, fogReach,
  NIGHT_SECONDS, SMUGGLER_FLEE_SECONDS, SMUGGLER_LIT_THROTTLE, LIFEBOAT_LOST_SECONDS,
  LIFEBOAT_DRIFT_THROTTLE, COASTER_ASK_SECONDS,
} from '../js/sim.js';
import { keyingFor, encode } from '../js/morse.js';
import { HULLS } from '../js/physics.js';

const HOLD = Object.freeze({ hold: true });
const TICK = 1 / 60;
const gap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);
const find = (state, id) => state.ships.find((ship) => ship.id === id);
const advanceTo = (state, time, input = HOLD) => step(state, input, time - state.time);

// Same action-edge driver as morse-sim.test.mjs, but at a caller-chosen player
// unit so a short message completes while an outbound hull is still in fog reach.
function playerKeying(text, unit) {
  const flashes = [];
  let time = 0;
  for (const [wordIndex, word] of encode(text).split(' / ').entries()) {
    if (wordIndex) time += 7 * unit;
    for (const [letterIndex, letter] of word.split(' ').entries()) {
      if (letterIndex) time += 3 * unit;
      for (const [symbolIndex, symbol] of [...letter].entries()) {
        if (symbolIndex) time += unit;
        const off = time + (symbol === '.' ? unit : 3 * unit);
        flashes.push({ on: time, off });
        time = off;
      }
    }
  }
  return flashes;
}
function send(state, text, { finish = true, unit = null } = {}) {
  const schedule = unit === null ? keyingFor(text) : playerKeying(text, unit);
  let elapsed = 0;
  for (const { on, off } of schedule) {
    if (on > elapsed) state = step(state, HOLD, (on - elapsed) / 1000);
    state = step(state, { hold: true, lamp: true }, (off - on) / 1000);
    elapsed = off;
  }
  return step(state, HOLD, finish ? 7 * (unit ?? 150) / 1000 + 0.001 : 0.001);
}

// A seeded rock well away from the opening trawler, so the trawler is never the
// lamp recipient, plus a radial bearing that clears every hazard outward.
function quietRock(state, avoid = []) {
  const trawler = bearingTo(state.trawler);
  const rock = state.hazards.slice(3).find((candidate) => gap(bearingTo(candidate), trawler) > 40
    && avoid.every((bearing) => gap(bearingTo(candidate), bearing) > 40));
  assert.ok(rock, `seed ${state.seed} has no quiet rock`);
  return rock;
}
function openBearing(state, avoid = []) {
  const trawler = bearingTo(state.trawler);
  for (let bearing = 0; bearing < 360; bearing += 5) {
    if (gap(bearing, trawler) > 40 && avoid.every((other) => gap(bearing, other) > 40)
      && state.hazards.every((rock) => gap(bearing, bearingTo(rock)) > 25)) return bearing;
  }
  assert.fail('no open bearing');
}

function smugglerState(seed = 108, { spawnRange = 300, aim = true } = {}) {
  let state = createState(seed);
  const bearing = openBearing(state);
  state = installSpecialty(state, specialtyApproach({ id: 'dark', bearing, spawnRange }));
  state.beam = aim ? bearing : (bearing + 180) % 360;
  assert.equal(isLit(state, state.trawler), false, 'precondition: trawler outside the beam');
  return { state, bearing };
}
function lifeboatState(seed = 108, { aim = true, id = 'lb', margin = 40 } = {}) {
  let state = createState(seed);
  const rock = quietRock(state);
  const bearing = bearingTo(rock);
  const spawnRange = Math.hypot(rock.x, rock.y) - rock.radius - margin;
  state = installSpecialty(state, specialtyApproach({ id, type: 'lifeboat', bearing, spawnRange }));
  state.beam = aim ? bearing : (bearing + 180) % 360;
  assert.equal(isLit(state, state.trawler), false, 'precondition: trawler outside the beam');
  return { state, rock, bearing };
}

test('smuggler: exactly SMUGGLER_FLEE_SECONDS of light does not flee; any further light does', () => {
  assert.equal(SMUGGLER_FLEE_SECONDS, 3);
  const { state: start } = smugglerState();
  assert.equal(isLit(start, find(start, 'dark')), true);
  const exact = step(start, HOLD, SMUGGLER_FLEE_SECONDS);
  const ship = find(exact, 'dark');
  assert.equal(isLit(exact, ship), true);
  assert.equal(ship.litSeconds, SMUGGLER_FLEE_SECONDS);
  assert.equal(ship.response, 'none');
  assert.equal(ship.reactAt, null);
  const past = step(exact, HOLD, 1e-10);
  assert.equal(find(past, 'dark').response, 'flee');
  assert.equal(find(past, 'dark').reactAt, past.time);
  const tick = step(exact, HOLD, TICK);
  assert.equal(find(tick, 'dark').response, 'flee');
  // Splitting the same light into many frames must not move the edge.
  let frames = start;
  for (let i = 0; i < 300; i++) frames = step(frames, HOLD, 0.01);
  assert.equal(find(frames, 'dark').response, 'none');
  assert.equal(find(step(frames, HOLD, 1e-9), 'dark').response, 'flee');
});

test('smuggler: a single unlit tick resets accumulated light', () => {
  const { state: start, bearing } = smugglerState();
  let state = step(start, HOLD, 2.9);
  assert.ok(find(state, 'dark').litSeconds > 2.8);
  state.beam = (bearing + 180) % 360;
  state = step(state, HOLD, TICK);
  assert.equal(find(state, 'dark').litSeconds, 0);
  state.beam = bearingTo(find(state, 'dark'));
  state = step(state, HOLD, 2.9);
  assert.equal(find(state, 'dark').response, 'none', '5.8 s of broken light is not 3 s continuous');
  state = step(state, HOLD, 0.2);
  assert.equal(find(state, 'dark').response, 'flee');
});

test('smuggler: throttles to half cruise while lit and recovers when dark', () => {
  assert.equal(SMUGGLER_LIT_THROTTLE, 0.5);
  const cruise = HULLS.speedboat.cruiseSpeed;
  const { state: lit } = smugglerState();
  const { state: dark } = smugglerState(108, { aim: false });
  const slowed = step(lit, HOLD, 2.9);
  const free = step(dark, HOLD, 2.9);
  assert.ok(Math.abs(find(free, 'dark').speed - cruise) < 1e-9, 'unlit launch keeps cruise speed');
  const speed = find(slowed, 'dark').speed;
  assert.ok(speed >= cruise * SMUGGLER_LIT_THROTTLE && speed < cruise * SMUGGLER_LIT_THROTTLE + 0.4, `lit speed ${speed}`);
  const travelled = (state) => Math.hypot(find(state, 'dark').x, find(state, 'dark').y) - 300;
  assert.ok(travelled(slowed) < travelled(free) - 3);
  slowed.beam = (slowed.beam + 180) % 360;
  const recovered = step(slowed, HOLD, 6);
  assert.ok(find(recovered, 'dark').speed > cruise - 0.02, `recovered ${find(recovered, 'dark').speed}`);
  assert.equal(find(recovered, 'dark').litSeconds, 0);
});

test('smuggler: crosses a reef without wrecking and exits safe; an honest launch on that track wrecks', () => {
  for (const seed of [108, 7, 0xffffffff]) {
    const base = createState(seed);
    const rock = quietRock(base);
    const bearing = bearingTo(rock), spawnRange = Math.hypot(rock.x, rock.y) - rock.radius - 40;
    const run = (smuggler) => {
      let state = installSpecialty(base, specialtyApproach({ id: 'boat', bearing, spawnRange, smuggler }));
      state.beam = (bearing + 180) % 360;
      let closest = Infinity;
      for (let t = 0; t < 120 && find(state, 'boat').status === 'underway'; t += 0.5) {
        state = step(state, HOLD, 0.5);
        const ship = find(state, 'boat');
        closest = Math.min(closest, Math.hypot(ship.x - rock.x, ship.y - rock.y));
      }
      return { ship: find(state, 'boat'), closest };
    };
    const dark = run(true);
    assert.ok(dark.closest < rock.radius + 8, `seed ${seed}: smuggler reached the reef`);
    assert.equal(dark.ship.status, 'safe');
    assert.equal(dark.ship.wreckedAt, null);
    const honest = run(false);
    assert.equal(honest.ship.status, 'wrecked', `seed ${seed}: control hull wrecks on the same course`);
  }
});

test('smuggler: shows no running lights and never flashes, even when lit and keyed', () => {
  let { state } = smugglerState(108, { spawnRange: 150 });
  const view = perception(state, find(state, 'dark'));
  assert.equal(view.runningLights, false);
  assert.equal(view.signal, false);
  state = send(state, 'WHO', { unit: 60 });
  assert.equal(state.morse.lastMessage.recipient, 'dark');
  assert.equal(find(state, 'dark').reply, null);
});

test('lifeboat: builder flags distress and the boat flashes a repeating SOS at incoming WPM', () => {
  const { state: start } = lifeboatState();
  const boat = find(start, 'lb');
  assert.equal(boat.distress, true);
  assert.equal(boat.smuggler, false);
  assert.equal(boat.speed, HULLS.lifeboat.cruiseSpeed * LIFEBOAT_DRIFT_THROTTLE);
  assert.deepEqual(boat.reply.flashes, keyingFor('SOS', 8));
  assert.equal(perception(start, boat).runningLights, false);
  // 8 WPM: 150 ms unit; SOS ends at 4.05 s, then a 7-unit word gap (1.05 s).
  const period = 5.1;
  let state = start;
  for (const [time, on] of [[0.075, true], [0.225, false], [1.4, true], [1.7, false], [4.5, false],
    [period + 0.075, true], [period + 0.225, false], [2 * period + 2.6, true], [2 * period + 4.6, false]]) {
    state = advanceTo(state, time);
    state.beam = bearingTo(find(state, 'lb'));
    assert.equal(perception(state, find(state, 'lb')).signal, on, `SOS at ${time}`);
  }
  state.beam = (state.beam + 180) % 360;
  state = advanceTo(state, 3 * period + 0.075);
  assert.equal(perception(state, find(state, 'lb')).signal, true, 'SOS visible off-beam');
});

test('lifeboat: lost exactly at LIFEBOAT_LOST_SECONDS unlit, not before', () => {
  assert.equal(LIFEBOAT_LOST_SECONDS, 24);
  const { state: start } = lifeboatState(108, { aim: false });
  const before = step(start, HOLD, LIFEBOAT_LOST_SECONDS - 1e-6);
  assert.equal(find(before, 'lb').status, 'underway');
  assert.equal(find(before, 'lb').lostAt, null);
  const edge = step(before, HOLD, 1e-6);
  assert.equal(find(edge, 'lb').status, 'lost');
  const direct = step(start, HOLD, LIFEBOAT_LOST_SECONDS);
  const lost = find(direct, 'lb');
  assert.equal(lost.status, 'lost');
  assert.ok(Math.abs(lost.lostAt - LIFEBOAT_LOST_SECONDS) < 1e-9, `lostAt ${lost.lostAt}`);
  assert.equal(lost.speed, 0);
  assert.equal(lost.reply, null);
  assert.equal(perception(direct, lost).signal, false);
  const later = step(direct, HOLD, 20);
  assert.equal(find(later, 'lb').lostAt, lost.lostAt, 'loss is recorded once');
  assert.equal(find(later, 'lb').x, lost.x);
});

test('lifeboat: light resets the unlit timer; it survives far past 24 s of total darkness', () => {
  const { state: start, bearing } = lifeboatState(108, { aim: false });
  let state = step(start, HOLD, 20);
  state.beam = bearingTo(find(state, 'lb'));
  state = step(state, HOLD, TICK);
  assert.equal(find(state, 'lb').unlitSeconds, 0);
  state.beam = (bearing + 180) % 360;
  state = step(state, HOLD, 20);
  assert.equal(find(state, 'lb').status, 'underway', '40 s dark, but never 24 s at once');
  state = step(state, HOLD, 4);
  assert.equal(find(state, 'lb').status, 'lost');
});

test('lifeboat: drifts to the reef edge and stops; never wrecks while it waits', () => {
  const { state: start, rock } = lifeboatState(108, { margin: 14 });
  let state = start;
  for (let t = 0; t < 60; t += 1) {
    state.beam = bearingTo(find(state, 'lb'));
    state = step(state, HOLD, 1);
    const boat = find(state, 'lb');
    assert.notEqual(boat.status, 'wrecked');
    assert.ok(Math.hypot(boat.x - rock.x, boat.y - rock.y) > rock.radius + 8, 'hull stays outside the reef');
  }
  const boat = find(state, 'lb');
  assert.equal(boat.status, 'underway');
  assert.equal(boat.speed, 0);
  assert.ok(Math.hypot(boat.x - rock.x, boat.y - rock.y) < rock.radius + 8 + 1, 'it actually reached the edge');
});

test('lifeboat: K, R and AR under the beam rescue it; it stays safe and still in darkness', () => {
  for (const text of ['K', 'R', 'AR']) {
    let { state } = lifeboatState();
    state = send(state, text);
    assert.equal(state.morse.lastMessage.recipient, 'lb');
    const boat = find(state, 'lb');
    assert.equal(boat.status, 'safe', text);
    assert.equal(boat.speed, 0);
    assert.equal(boat.reply, null, `${text}: no reply and SOS stops`);
    assert.equal(perception(state, boat).signal, false);
    state.beam = (state.beam + 180) % 360;
    const later = step(state, HOLD, LIFEBOAT_LOST_SECONDS + 10);
    assert.equal(find(later, 'lb').status, 'safe');
    assert.equal(find(later, 'lb').x, boat.x);
    const without = { ...later, ships: later.ships.filter((ship) => ship.id !== 'lb') };
    assert.equal(summary(later).safe, summary(without).safe + 1, 'a rescue counts as safe');
  }
});

test('lifeboat: other words, an ack lit only at key-down, or an ack after loss never rescue', () => {
  for (const text of ['ROCKS', 'WHO', 'SOS', 'SKR', 'WHAT LIGHT', 'E']) {
    let { state } = lifeboatState();
    state = send(state, text);
    assert.equal(state.morse.lastMessage.recipient, 'lb', text);
    const boat = find(state, 'lb');
    assert.equal(boat.status, 'underway', text);
    assert.equal(boat.reply.startedAt, 0, `${text}: SOS keeps flashing, no reply`);
    assert.equal(boat.warnedAt, null);
  }
  let { state } = lifeboatState();
  state = send(state, 'K', { finish: false });
  state.beam = (state.beam + 180) % 360;
  state = step(state, HOLD, 1.049);
  assert.equal(state.morse.lastMessage.recipient, null);
  assert.equal(find(state, 'lb').status, 'underway');

  ({ state } = lifeboatState(108, { aim: false }));
  state = step(state, HOLD, LIFEBOAT_LOST_SECONDS + 1);
  assert.equal(find(state, 'lb').status, 'lost');
  state.beam = bearingTo(find(state, 'lb'));
  assert.equal(isLit(state, find(state, 'lb')), true);
  state = send(state, 'K');
  assert.notEqual(state.morse.lastMessage.recipient, 'lb');
  assert.equal(find(state, 'lb').status, 'lost');
  const without = { ...state, ships: state.ships.filter((ship) => ship.id !== 'lb') };
  assert.equal(summary(state).safe, summary(without).safe);
  assert.equal(summary(state).lost, summary(without).lost + 1);
});

test('lifeboat: distress boats ignore the horn while a generic lifeboat hull hears it', () => {
  let state = createState(108);
  const rock = quietRock(state);
  const bearing = bearingTo(rock), range = Math.hypot(rock.x, rock.y);
  const other = quietRock(state, [bearing]);
  state = installSpecialty(state, specialtyApproach({ id: 'sos', type: 'lifeboat',
    bearing: bearingTo(other), spawnRange: Math.hypot(other.x, other.y) - other.radius - 40 }));
  // Fixture: a lifeboat hull without the scripted distress flag, inbound at cruise.
  state = installSpecialty(state, { ...specialtyApproach({ id: 'hull', type: 'lifeboat', bearing,
    spawnRange: range + 120 }), distress: false, threatening: true, speed: HULLS.lifeboat.cruiseSpeed });
  const hull = find(state, 'hull');
  assert.equal(hull.reply, null, 'no SOS without distress');
  assert.equal(perception(state, hull).signal, false);
  state.beam = openBearing(state, [bearing, bearingTo(other)]);
  assert.equal(isLit(state, find(state, 'sos')), false, 'precondition: distress boat stays dark');
  state = step(state, { hold: true, horn: true }, 0.1);
  assert.equal(find(state, 'hull').lastHorn.heard, true);
  assert.equal(find(state, 'hull').response, 'turn-away');
  assert.notEqual(find(state, 'hull').warnedAt, null);
  assert.equal(find(state, 'sos').lastHorn, undefined);
  assert.equal(find(state, 'sos').warnedAt, null);
  assert.equal(find(state, 'sos').response, 'none');
  // Unlit far beyond the loss timer: only the distress boat is lost.
  state = step(state, HOLD, LIFEBOAT_LOST_SECONDS + 6);
  assert.equal(find(state, 'sos').status, 'lost');
  assert.notEqual(find(state, 'hull').status, 'lost');
  assert.equal(find(state, 'hull').lostAt, null);
});

test('coaster: asks WHAT LIGHT after COASTER_ASK_SECONDS of continuous light; SKR earns an R', () => {
  assert.equal(COASTER_ASK_SECONDS, 1);
  let state = createState(108);
  const coaster = state.schedule.find((entry) => entry.type === 'coaster'
    && gap(entry.bearing, bearingTo(state.trawler)) > 40);
  assert.ok(coaster, 'seed 108 schedules a coaster');
  state.beam = (coaster.bearing + 180) % 360;
  state = advanceTo(state, coaster.spawnTime + TICK);
  const id = coaster.id;
  assert.equal(find(state, id).litSeconds, 0);
  state.beam = bearingTo(find(state, id));
  // A broken first second does not count toward the ask.
  state = step(state, HOLD, 0.9);
  state.beam = (state.beam + 180) % 360;
  state = step(state, HOLD, TICK);
  state.beam = bearingTo(find(state, id));
  state = step(state, HOLD, COASTER_ASK_SECONDS - 1e-6);
  assert.equal(find(state, id).askedLight, false);
  assert.equal(find(state, id).reply, null);
  state = step(state, HOLD, 1e-6);
  assert.equal(find(state, id).askedLight, true);
  assert.deepEqual(find(state, id).reply.flashes, keyingFor('WHAT LIGHT', 8));
  const asked = find(state, id).reply.startedAt;
  state = step(state, HOLD, 0.01);
  assert.equal(perception(state, find(state, id)).signal, true);
  state = send(state, 'SKR', { unit: 60 });
  assert.equal(state.morse.lastMessage.recipient, id);
  assert.deepEqual(find(state, id).reply.flashes, keyingFor('R', 8));
  assert.ok(find(state, id).reply.startedAt > asked);
  // Asked once only, however long it stays lit afterward.
  state = step(state, HOLD, 0.5);
  assert.deepEqual(find(state, id).reply.flashes, keyingFor('R', 8));
});

test('two ships at once: lighting the smuggler leaves the lifeboat to be lost, and vice versa', () => {
  const build = () => {
    let state = createState(108);
    const rock = quietRock(state);
    const lifeBearing = bearingTo(rock);
    state = installSpecialty(state, specialtyApproach({ id: 'lb', type: 'lifeboat', bearing: lifeBearing,
      spawnRange: Math.hypot(rock.x, rock.y) - rock.radius - 40 }));
    const darkBearing = openBearing(state, [lifeBearing]);
    state = installSpecialty(state, specialtyApproach({ id: 'dark', bearing: darkBearing, spawnRange: 300 }));
    return { state, lifeBearing, darkBearing };
  };
  let { state, darkBearing } = build();
  state.beam = darkBearing;
  state = step(state, HOLD, SMUGGLER_FLEE_SECONDS + 0.1);
  assert.equal(find(state, 'dark').response, 'flee');
  assert.ok(find(state, 'lb').unlitSeconds > SMUGGLER_FLEE_SECONDS);
  state = step(state, HOLD, LIFEBOAT_LOST_SECONDS - SMUGGLER_FLEE_SECONDS);
  assert.equal(find(state, 'lb').status, 'lost');

  let lifeBearing;
  ({ state, lifeBearing } = build());
  state.beam = lifeBearing;
  state = step(state, HOLD, 30);
  assert.equal(find(state, 'lb').status, 'underway');
  assert.equal(find(state, 'dark').litSeconds, 0);
  assert.equal(find(state, 'dark').response, 'none');
  assert.ok(Math.abs(find(state, 'dark').speed - HULLS.speedboat.cruiseSpeed) < 1e-9);
  state = send(state, 'K');
  assert.equal(find(state, 'lb').status, 'safe');
  assert.equal(find(state, 'dark').reply, null);
  assert.equal(find(state, 'dark').response, 'none');
});

test('spawn inside the beam: light accrues from the arrival instant, for due-now and future arrivals', () => {
  const { state: start } = smugglerState();
  const first = step(start, HOLD, TICK);
  assert.ok(Math.abs(find(first, 'dark').litSeconds - TICK) < 1e-12);

  let state = createState(108);
  const bearing = openBearing(state);
  const spawnTime = 5.005; // Not a tick boundary: only the post-arrival fraction counts.
  state = installSpecialty(state, specialtyApproach({ id: 'late', bearing, spawnTime, spawnRange: 300 }));
  assert.equal(find(state, 'late'), undefined, 'future arrival is not installed early');
  state.beam = bearing;
  state = advanceTo(state, spawnTime - 0.001);
  assert.equal(find(state, 'late'), undefined);
  state = advanceTo(state, spawnTime + SMUGGLER_FLEE_SECONDS - 0.0005);
  assert.equal(state.ships.filter((ship) => ship.id === 'late').length, 1);
  assert.ok(Math.abs(find(state, 'late').litSeconds - (SMUGGLER_FLEE_SECONDS - 0.0005)) < 1e-9);
  assert.equal(find(state, 'late').response, 'none');
  state = step(state, HOLD, 0.001);
  assert.equal(find(state, 'late').response, 'flee');

  const { state: boat } = lifeboatState();
  assert.equal(find(step(boat, HOLD, 30), 'lb').unlitSeconds, 0);
});

test('builders reject invalid specialties with RangeError', () => {
  const ok = { id: 'x', bearing: 10 };
  for (const bad of [
    { ...ok, type: 'trawler' }, { ...ok, type: 'coaster' }, { ...ok, type: 'Lifeboat' },
    { ...ok, type: 'lifeboat', smuggler: true },
    { ...ok, smuggler: 'true' }, { ...ok, smuggler: 1 },
    { ...ok, id: '' }, { ...ok, id: undefined }, { ...ok, id: NaN }, { ...ok, id: Infinity }, { ...ok, id: {} },
    { ...ok, bearing: undefined }, { ...ok, bearing: NaN }, { ...ok, bearing: Infinity }, { ...ok, bearing: '10' },
    { ...ok, spawnTime: -1e-9 }, { ...ok, spawnTime: NIGHT_SECONDS + 1e-9 }, { ...ok, spawnTime: NaN },
    { ...ok, spawnRange: 0 }, { ...ok, spawnRange: -5 }, { ...ok, spawnRange: Infinity },
  ]) {
    assert.throws(() => specialtyApproach(bad), RangeError, JSON.stringify(bad));
  }
  assert.throws(() => specialtyApproach(), RangeError);
  // Accepted edges and defaults.
  assert.equal(specialtyApproach({ ...ok, spawnTime: NIGHT_SECONDS }).spawnTime, NIGHT_SECONDS);
  assert.equal(specialtyApproach({ ...ok, bearing: -90 }).bearing, 270);
  assert.equal(specialtyApproach({ ...ok, id: 0 }).id, 0);
  assert.equal(specialtyApproach(ok).smuggler, true);
  assert.equal(specialtyApproach(ok).distress, false);
  assert.equal(specialtyApproach({ ...ok, smuggler: false }).smuggler, false);
  assert.equal(specialtyApproach({ ...ok, type: 'lifeboat' }).smuggler, false);
  assert.equal(specialtyApproach(ok).spawnRange, fogReach(0.16));

  const state = createState(108);
  const prior = structuredClone(state);
  const scheduled = state.schedule[1].id;
  assert.throws(() => installSpecialty(state, specialtyApproach({ id: 'trawler', bearing: 10 })), RangeError);
  assert.throws(() => installSpecialty(state, specialtyApproach({ id: scheduled, bearing: 10 })), RangeError);
  const once = installSpecialty(state, specialtyApproach({ id: 'a', bearing: 10, spawnTime: 50 }));
  assert.throws(() => installSpecialty(once, specialtyApproach({ id: 'a', bearing: 200 })), RangeError);
  const ghost = structuredClone(state);
  ghost.ships.push({ ...structuredClone(ghost.trawler), id: 'ghost' });
  assert.throws(() => installSpecialty(ghost, specialtyApproach({ id: 'ghost', bearing: 10 })), RangeError);
  const later = step(state, {}, 10);
  assert.throws(() => installSpecialty(later, specialtyApproach({ id: 'b', bearing: 10, spawnTime: 9.99 })), RangeError);
  assert.doesNotThrow(() => installSpecialty(later, specialtyApproach({ id: 'b', bearing: 10, spawnTime: later.time })));
  assert.deepEqual(state, prior, 'failed installs leave the state untouched');
});

test('installSpecialty is pure and leaves the seeded schedule and its budgets unchanged', () => {
  const reach = fogReach(0.16);
  for (const seed of [0, 1, 7, 108, 4242, 0xffffffff]) {
    const state = createState(seed);
    assert.deepEqual(state.schedule.slice(1), planSpawns(seed));
    const traffic = state.schedule.filter((entry) => entry.threatening !== false);
    assert.equal(validateSchedule(traffic, { night: 1, fogReach: reach, phase0: 285 }).ok, true, `seed ${seed}`);
    const prior = structuredClone(state);
    const approach = specialtyApproach({ id: 'lb', type: 'lifeboat', bearing: 33, spawnRange: 200 });
    const frozen = structuredClone(approach);
    const next = installSpecialty(state, approach);
    assert.deepEqual(state, prior);
    assert.deepEqual(approach, frozen);
    assert.deepEqual(next.schedule.slice(0, -1), prior.schedule);
    assert.deepEqual(next.schedule.at(-1), frozen);
    assert.notEqual(next.schedule.at(-1), approach, 'installed entry is a copy');
    assert.equal(next.ships.length, prior.ships.length + 1);
    assert.deepEqual(next.ships.slice(0, -1), prior.ships);
  }
});

test('determinism: same seed and inputs give identical specialty outcomes', () => {
  const script = () => {
    let state = createState(4242);
    const rock = quietRock(state);
    state = installSpecialty(state, specialtyApproach({ id: 'lb', type: 'lifeboat', bearing: bearingTo(rock),
      spawnRange: Math.hypot(rock.x, rock.y) - rock.radius - 40 }));
    state = installSpecialty(state, specialtyApproach({ id: 'dark', bearing: openBearing(state, [bearingTo(rock)]),
      spawnTime: 12.5, spawnRange: 250 }));
    for (let i = 0; i < 40; i++) state = step(state, { horn: i % 9 === 0, slow: i % 4 === 0 }, 0.75);
    state.beam = bearingTo(find(state, 'lb'));
    state = send(state, 'AR');
    return step(state, {}, 60);
  };
  const a = script(), b = script();
  assert.deepEqual(a, b);
  assert.deepEqual(summary(a), summary(b));
  assert.ok(['safe', 'lost'].includes(find(a, 'lb').status));
  assert.notEqual(find(a, 'dark'), undefined);
});

test('summary.lost counts only lost boats that were ever seen', () => {
  const baseline = summary(step(createState(108), HOLD, LIFEBOAT_LOST_SECONDS + 1));
  const { state: dark } = lifeboatState(108, { aim: false });
  const unseen = step(dark, HOLD, LIFEBOAT_LOST_SECONDS + 1);
  assert.equal(find(unseen, 'lb').status, 'lost');
  assert.equal(find(unseen, 'lb').everSeen, false);
  assert.deepEqual(summary(unseen), { ...baseline, unseen: baseline.unseen + 1, lost: 0 });

  const { state: start, bearing } = lifeboatState();
  let seen = step(start, HOLD, TICK);
  assert.equal(find(seen, 'lb').everSeen, true);
  seen.beam = (bearing + 180) % 360;
  seen = step(seen, HOLD, LIFEBOAT_LOST_SECONDS + 1);
  assert.equal(find(seen, 'lb').status, 'lost');
  assert.equal(summary(seen).lost, 1);
  assert.equal(summary(seen).unseen, baseline.unseen);
  assert.equal(summary(seen).wrecked, baseline.wrecked, 'a lost lifeboat is not a wreck');

  const twoLost = structuredClone(seen);
  twoLost.ships.push({ ...structuredClone(find(seen, 'lb')), id: 'lb2', everSeen: false });
  twoLost.ships.push({ ...structuredClone(find(seen, 'lb')), id: 'lb3' });
  assert.equal(summary(twoLost).lost, 2);
});

test('dawn ends the watch: no loss or flight is triggered after NIGHT_SECONDS', () => {
  let state = createState(108);
  const bearing = openBearing(state);
  state = installSpecialty(state, specialtyApproach({ id: 'lb', type: 'lifeboat', bearing: (bearing + 180) % 360,
    spawnTime: NIGHT_SECONDS - 10, spawnRange: 150 }));
  state = step(state, HOLD, NIGHT_SECONDS);
  assert.equal(state.phase, 'dawn');
  assert.equal(find(state, 'lb').status, 'underway');
  const after = step(state, HOLD, 60);
  assert.deepEqual(after, state);
  assert.equal(summary(after).lost, 0);
});

test('R1: strict spawnTime > prevents opener or prior arrival from re-entering after emptySea', () => {
  const base = createState(108);
  assert.equal(base.schedule[0].id, 'trawler');
  assert.equal(base.schedule[0].spawnTime, 0);

  const emptyAtZero = { ...createState(108), ships: [] };
  const afterFirstTick = step(emptyAtZero, { hold: true, horn: true }, TICK);
  assert.equal(find(afterFirstTick, 'trawler'), undefined);
  assert.equal(afterFirstTick.ships.length, 0);
  assert.equal(afterFirstTick.trust, 0.75);

  const bearing = openBearing(base);
  const withTickArrival = installSpecialty(base, specialtyApproach({
    id: 'tick-1', bearing, spawnTime: TICK, spawnRange: 300,
  }));
  const arrived = step(withTickArrival, HOLD, TICK);
  assert.notEqual(find(arrived, 'trawler'), undefined);
  assert.notEqual(find(arrived, 'tick-1'), undefined);

  const clearedAfterArrival = { ...arrived, ships: [] };
  const afterSecondTick = step(clearedAfterArrival, { hold: true, horn: true }, TICK);
  assert.equal(find(afterSecondTick, 'trawler'), undefined);
  assert.equal(find(afterSecondTick, 'tick-1'), undefined);
  assert.equal(afterSecondTick.ships.length, 0);
  assert.equal(afterSecondTick.trust, 0.75);
});

test('R2: lifeboat SOS repeat and unlit loss timer apply only when distress is true', () => {
  let state = createState(108);
  const rock = quietRock(state);
  const distressBearing = bearingTo(rock);
  const distressApproach = specialtyApproach({
    id: 'sos-lb',
    type: 'lifeboat',
    bearing: distressBearing,
    spawnRange: Math.hypot(rock.x, rock.y) - rock.radius - 40,
  });
  assert.equal(distressApproach.distress, true);

  const clearBearing = openBearing(state, [distressBearing]);
  const genericApproach = {
    ...specialtyApproach({ id: 'generic-lb', type: 'lifeboat', bearing: clearBearing, spawnRange: 200 }),
    distress: false,
    speed: HULLS.lifeboat.cruiseSpeed,
  };

  state = installSpecialty(state, distressApproach);
  state = installSpecialty(state, genericApproach);
  state.beam = openBearing(state, [distressBearing, clearBearing]);

  const distressBoat = find(state, 'sos-lb');
  const genericBoat = find(state, 'generic-lb');
  assert.equal(distressBoat.distress, true);
  assert.equal(distressBoat.speed, HULLS.lifeboat.cruiseSpeed * LIFEBOAT_DRIFT_THROTTLE);
  assert.deepEqual(distressBoat.reply?.flashes, keyingFor('SOS', 8));
  assert.ok(distressBoat.reply?.repeatSeconds > 0);
  assert.equal(perception(state, distressBoat).runningLights, false);

  assert.equal(genericBoat.type, 'lifeboat');
  assert.equal(genericBoat.distress, false);
  assert.equal(genericBoat.reply, null);
  assert.equal(perception(state, genericBoat).signal, false);
  assert.equal(perception(state, genericBoat).runningLights, true);

  const afterDark = step(state, HOLD, LIFEBOAT_LOST_SECONDS + 1);
  assert.equal(find(afterDark, 'sos-lb').status, 'lost');
  assert.notEqual(find(afterDark, 'sos-lb').lostAt, null);
  assert.equal(find(afterDark, 'generic-lb').status, 'underway');
  assert.equal(find(afterDark, 'generic-lb').lostAt, null);
  assert.equal(find(afterDark, 'generic-lb').unlitSeconds, 0);
});

test('R3: blastHorn excludes distress ships while non-distress lifeboat hulls and safe ships hear the horn', () => {
  const base = createState(108);
  const rock = quietRock(base);
  const rockBearing = bearingTo(rock);
  const withoutOpener = { ...base, schedule: base.schedule.slice(1), ships: [] };

  const distressOnly = installSpecialty(withoutOpener, specialtyApproach({
    id: 'sos-only',
    type: 'lifeboat',
    bearing: rockBearing,
    spawnRange: Math.hypot(rock.x, rock.y) - rock.radius - 30,
  }));
  distressOnly.beam = (rockBearing + 180) % 360;
  const afterDistressBlast = step(distressOnly, { hold: true, horn: true }, TICK);
  assert.equal(afterDistressBlast.trust, 0.75);
  assert.equal(find(afterDistressBlast, 'sos-only').lastHorn, undefined);
  assert.equal(find(afterDistressBlast, 'sos-only').warnedAt, null);
  assert.equal(find(afterDistressBlast, 'sos-only').response, 'none');

  const otherRock = quietRock(base, [rockBearing]);
  const hullBearing = bearingTo(otherRock);
  let mixed = installSpecialty(withoutOpener, specialtyApproach({
    id: 'sos-mixed',
    type: 'lifeboat',
    bearing: rockBearing,
    spawnRange: Math.hypot(rock.x, rock.y) - rock.radius - 30,
  }));
  mixed = installSpecialty(mixed, {
    ...specialtyApproach({
      id: 'honest-lifeboat-hull',
      type: 'lifeboat',
      bearing: hullBearing,
      spawnRange: Math.hypot(otherRock.x, otherRock.y) + 80,
    }),
    distress: false,
    threatening: true,
    speed: HULLS.lifeboat.cruiseSpeed,
  });
  mixed.beam = openBearing(mixed, [rockBearing, hullBearing]);
  const afterMixedBlast = step(mixed, { hold: true, horn: true }, TICK);
  assert.equal(afterMixedBlast.trust, 1);
  assert.equal(find(afterMixedBlast, 'honest-lifeboat-hull').lastHorn?.heard, true);
  assert.equal(find(afterMixedBlast, 'honest-lifeboat-hull').response, 'turn-away');
  assert.equal(find(afterMixedBlast, 'honest-lifeboat-hull').warnedAt, afterMixedBlast.time);
  assert.equal(find(afterMixedBlast, 'sos-mixed').lastHorn, undefined);

  // Safe non-distress ships still receive horn broadcast; wrecked and lost ships do not.
  const statusState = structuredClone(withoutOpener);
  const template = structuredClone(base.trawler);
  statusState.ships = [
    { ...template, id: 'safe-ship', status: 'safe', distress: false },
    { ...template, id: 'wrecked-ship', status: 'wrecked', distress: false },
    { ...template, id: 'lost-ship', status: 'lost', distress: false },
  ];
  const afterStatusBlast = step(statusState, { hold: true, horn: true }, TICK);
  assert.equal(find(afterStatusBlast, 'safe-ship').lastHorn?.heard, true);
  assert.equal(find(afterStatusBlast, 'wrecked-ship').lastHorn, undefined);
  assert.equal(find(afterStatusBlast, 'lost-ship').lastHorn, undefined);
});

test('arrive and builders: error messages, callsigns, speed/type fallbacks, destinations, and nearest rock edges', () => {
  assert.throws(
    () => specialtyApproach({ id: '', bearing: 10 }),
    { name: 'RangeError', message: 'Invalid specialty approach' },
  );
  const base = createState(108);
  assert.throws(
    () => installSpecialty(base, specialtyApproach({ id: 'trawler', bearing: 10 })),
    { name: 'RangeError', message: 'Specialty must have a unique id and not arrive in the past' },
  );

  assert.equal(base.trawler.callsign, 'T108');
  let state = installSpecialty(base, specialtyApproach({ id: 'ship-9', bearing: 20, spawnRange: 300 }));
  assert.equal(find(state, 'ship-9').callsign, 'S9');
  state = installSpecialty(state, {
    ...specialtyApproach({ id: 'custom-speed', bearing: 45, spawnRange: 300 }),
    speed: 4.25,
  });
  const custom = find(state, 'custom-speed');
  assert.equal(custom.callsign, 'Scustom-speed');
  assert.equal(custom.speed, 4.25);
  const rad45 = 45 * Math.PI / 180;
  assert.ok(Math.abs(custom.destination.x - Math.sin(rad45) * (300 + 1600)) < 1e-9);
  assert.ok(Math.abs(custom.destination.y - (-Math.cos(rad45) * (300 + 1600))) < 1e-9);

  // Speed and type fallbacks when approach omits speed or type.
  state = installSpecialty(state, {
    id: 'fallback-distress', type: 'lifeboat', distress: true, smuggler: false,
    bearing: 60, spawnTime: 0, spawnRange: 200, threatening: false,
  });
  assert.equal(find(state, 'fallback-distress').speed, HULLS.lifeboat.cruiseSpeed * LIFEBOAT_DRIFT_THROTTLE);

  state = installSpecialty(state, {
    id: 'fallback-hull', type: 'lifeboat', distress: false, smuggler: false,
    bearing: 75, spawnTime: 0, spawnRange: 200, threatening: false,
  });
  assert.equal(find(state, 'fallback-hull').speed, HULLS.lifeboat.cruiseSpeed);

  state = installSpecialty(state, {
    id: 'fallback-trawler', bearing: 90, spawnTime: 0, spawnRange: 200, threatening: false,
  });
  assert.equal(find(state, 'fallback-trawler').type, 'trawler');
  assert.equal(find(state, 'fallback-trawler').speed, HULLS.trawler.cruiseSpeed);

  // Empty hazards leave distress lifeboat with default outbound heading and destination.
  const noRockState = installSpecialty(
    { ...base, hazards: [] },
    specialtyApproach({ id: 'lb-empty', type: 'lifeboat', bearing: 30, spawnRange: 200 }),
  );
  const noRockBoat = find(noRockState, 'lb-empty');
  assert.equal(noRockBoat.heading, 30);
  assert.ok(Math.hypot(noRockBoat.destination.x, noRockBoat.destination.y) > 1700);

  // Off-radial distress lifeboat at (100, 100): nearest hazard uses edge distance (dist - radius),
  // tested in both hazard orders and with exact tie-breaking.
  const farOpposite = { kind: 'reef', x: -100, y: -100, radius: 10 };
  const smallCenterCloser = { kind: 'reef', x: 100, y: 150, radius: 5 }; // dist=50, edge=45
  const largeEdgeCloser = { kind: 'reef', x: 160, y: 120, radius: 30 }; // dist=63.25, edge=33.25
  const spawnAt100 = specialtyApproach({
    id: 'lb-edge', type: 'lifeboat', bearing: 135, spawnRange: Math.SQRT2 * 100,
  });
  for (const hazards of [
    [farOpposite, smallCenterCloser, largeEdgeCloser],
    [largeEdgeCloser, smallCenterCloser, farOpposite],
  ]) {
    const picked = find(installSpecialty({ ...base, hazards }, spawnAt100), 'lb-edge');
    assert.deepEqual(picked.destination, { x: 160, y: 120 });
    assert.ok(Math.abs(picked.heading - bearingTo({ x: 60, y: 20 })) < 1e-9);
  }
  const tieA = { kind: 'reef', x: 150, y: 100, radius: 10 }; // dist=50, edge=40
  const tieB = { kind: 'reef', x: 100, y: 150, radius: 10 }; // dist=50, edge=40
  const tied = find(installSpecialty({ ...base, hazards: [tieA, tieB] }, spawnAt100), 'lb-edge');
  assert.deepEqual(tied.destination, { x: 150, y: 100 });
});

test('updateSpecialty and perception: non-repeating replies, coaster >3s light, smuggler flee idempotence, and lost runningLights', () => {
  let state = createState(108);
  const coasterApproach = state.schedule.find((entry) => entry.type === 'coaster'
    && gap(entry.bearing, bearingTo(state.trawler)) > 40);
  assert.ok(coasterApproach);
  state.beam = (coasterApproach.bearing + 180) % 360;
  state = advanceTo(state, coasterApproach.spawnTime + TICK);
  const cid = coasterApproach.id;
  state.beam = bearingTo(find(state, cid));

  // Coaster asks WHAT LIGHT without repeatSeconds, and does not flee even when lit > 3s.
  state = step(state, HOLD, COASTER_ASK_SECONDS + TICK);
  const askedCoaster = find(state, cid);
  assert.equal(askedCoaster.askedLight, true);
  assert.equal(askedCoaster.reply.repeatSeconds, undefined);
  const startedAt = askedCoaster.reply.startedAt;
  const flashEndMs = askedCoaster.reply.flashes.at(-1).off;
  state = step(state, HOLD, SMUGGLER_FLEE_SECONDS);
  assert.ok(find(state, cid).litSeconds > SMUGGLER_FLEE_SECONDS);
  assert.equal(find(state, cid).response, 'none');
  assert.equal(find(state, cid).reactAt, null);
  const repeatWindow = (flashEndMs + 7 * 1200 / 8) / 1000;
  state = advanceTo(state, startedAt + repeatWindow + 0.075);
  assert.equal(perception(state, find(state, cid)).signal, false, 'non-distress reply does not repeat');

  // Non-smuggler non-coaster ships never accumulate litSeconds; smuggler never asks WHAT LIGHT.
  let check = createState(108);
  const open = openBearing(check);
  check = installSpecialty(check, specialtyApproach({ id: 'honest-fast', bearing: open, smuggler: false, spawnRange: 250 }));
  check.beam = open;
  check = step(check, HOLD, 1.5);
  assert.equal(find(check, 'honest-fast').litSeconds, 0);
  assert.equal(find(check, 'honest-fast').askedLight, false);
  assert.equal(find(check, 'honest-fast').reply, null);

  check.beam = bearingTo(check.trawler);
  check = step(check, HOLD, 1.5);
  assert.equal(check.trawler.litSeconds, 0);

  // Smuggler speedboat and smuggler-flagged coaster never ask WHAT LIGHT at >=1s light.
  const { state: smugglerStart } = smugglerState(108, { spawnRange: 250 });
  const smugglerAtTwo = step(smugglerStart, HOLD, 2);
  assert.equal(find(smugglerAtTwo, 'dark').askedLight, false);
  assert.equal(find(smugglerAtTwo, 'dark').reply, null);

  const smugglerCoasterState = structuredClone(smugglerStart);
  find(smugglerCoasterState, 'dark').type = 'coaster';
  const smugglerCoasterAtTwo = step(smugglerCoasterState, HOLD, 2);
  assert.equal(find(smugglerCoasterAtTwo, 'dark').askedLight, false);
  assert.equal(find(smugglerCoasterAtTwo, 'dark').reply, null);

  // Inward-heading smuggler flees once when lit >3s: reactAt stays fixed, navigation stays null, and helm turns it outward.
  const inwardSmugglerState = structuredClone(smugglerStart);
  const darkShip = find(inwardSmugglerState, 'dark');
  darkShip.heading = (bearingTo(darkShip) + 140) % 360;
  const fledOnce = step(inwardSmugglerState, HOLD, SMUGGLER_FLEE_SECONDS + TICK);
  const fledShip = find(fledOnce, 'dark');
  assert.equal(fledShip.response, 'flee');
  assert.equal(fledShip.navigation, null);
  const firstReactAt = fledShip.reactAt;
  assert.notEqual(firstReactAt, null);
  const fledTwice = step(fledOnce, HOLD, TICK);
  assert.equal(find(fledTwice, 'dark').reactAt, firstReactAt, 'flee does not re-trigger on later lit ticks');
  assert.equal(find(fledTwice, 'dark').navigation, null);
  assert.notEqual(find(fledTwice, 'dark').rudder, 0, 'fleeing smuggler steers toward radial escape heading');

  // perception.runningLights is false for status === 'lost' even when distress is false.
  assert.equal(perception(check, { ...check.trawler, x: 50, y: 0, status: 'lost', distress: false }).runningLights, false);
  assert.equal(perception(check, { ...check.trawler, x: 50, y: 0, status: 'underway', distress: false }).runningLights, true);
});

test('tick mechanics: trust recovery, speed/beam controls, fog progression, blast windows, and duplicate schedule guard', () => {
  const base = createState(108);
  const lowTrust = { ...structuredClone(base), trust: 0.5 };
  const afterTrustTick = step(lowTrust, HOLD, TICK);
  assert.ok(Math.abs(afterTrustTick.trust - (0.5 + 0.01 * TICK)) < 1e-12);
  assert.ok(Math.abs(afterTrustTick.fog - (0.08 + 0.08 * TICK / NIGHT_SECONDS)) < 1e-12);

  const rotated = step(base, {}, TICK);
  assert.equal(rotated.speed, 30);
  assert.ok(Math.abs(rotated.beam - (285 + 30 * TICK)) < 1e-12);

  const faster = step(base, { fast: true, hold: true }, TICK);
  assert.ok(Math.abs(faster.speed - (30 + 24 * TICK)) < 1e-12);
  assert.equal(faster.beam, 285);

  const slower = step(base, { slow: true, hold: true }, TICK);
  assert.ok(Math.abs(slower.speed - (30 - 24 * TICK)) < 1e-12);

  const bothSteer = step(base, { fast: true, slow: true, hold: true }, TICK);
  assert.equal(bothSteer.speed, 30);

  // Blast and ignoredBlast expiry windows at t = 25 (verifies state.time - time < 20 and < 2).
  const blastWindow = structuredClone(base);
  blastWindow.time = 25 - TICK;
  blastWindow.blasts = [5, 5.5, 24];
  blastWindow.ignoredBlasts = [23, 23.5];
  const afterWindow = step(blastWindow, HOLD, TICK);
  assert.deepEqual(afterWindow.blasts, [5.5, 24]);
  assert.deepEqual(afterWindow.ignoredBlasts, [23.5]);

  // Holding horn across ticks emits once and clears horn state on release.
  const horn1 = step(base, { horn: true, hold: true }, TICK);
  assert.equal(horn1.horn, true);
  assert.equal(horn1.blasts.length, 1);
  const horn2 = step(horn1, { horn: true, hold: true }, TICK);
  assert.equal(horn2.horn, true);
  assert.equal(horn2.blasts.length, 1);
  const horn3 = step(horn2, HOLD, TICK);
  assert.equal(horn3.horn, false);

  // Schedule admission does not duplicate an id already in fleet(state) when spawnTime arrives.
  const dupState = structuredClone(base);
  const dupApproach = specialtyApproach({ id: 'already-present', bearing: openBearing(dupState), spawnTime: TICK, spawnRange: 300 });
  dupState.schedule.push(dupApproach);
  dupState.ships.push({ ...structuredClone(dupState.trawler), id: 'already-present' });
  const afterDupTick = step(dupState, HOLD, TICK);
  assert.equal(afterDupTick.ships.filter((ship) => ship.id === 'already-present').length, 1);
});

test('navigation, boundaries, and summary.lost: reactAt edge, avoidance resume, shipDt, contact/exit edges, and non-lost everSeen', () => {
  // Directed ROCKS warning sets turn-away; reactAt edge triggers avoidance at equality and transitions to resume.
  let state = createState(108);
  state.beam = bearingTo(state.trawler);
  state = send(state, 'ROCKS', { unit: 60 });
  const warnedAt = state.trawler.warnedAt;
  const reactAt = state.trawler.reactAt;
  assert.notEqual(warnedAt, null);
  assert.equal(state.trawler.response, 'turn-away');
  assert.ok(Math.abs(reactAt - (warnedAt + HULLS.trawler.reactionSeconds[1])) < 1e-9);
  state.beam = bearingTo(state.trawler);
  const rewarned = send(state, 'ROCKS', { unit: 60 });
  assert.equal(rewarned.trawler.warnedAt, warnedAt, 'second ROCKS does not overwrite warnedAt');

  // Exact reactAt equality boundary (TICK + TICK === 2 * TICK) and avoidance out -> resume transition.
  const avoidRock = { kind: 'reef', x: 0, y: -120, radius: 6 };
  let reactEdge = { ...createState(108), hazards: [avoidRock], ships: [] };
  reactEdge = installSpecialty(reactEdge, {
    ...specialtyApproach({ id: 'avoid-fast', bearing: 0, smuggler: false, spawnRange: 220 }),
    threatening: true,
    speed: HULLS.speedboat.cruiseSpeed,
  });
  find(reactEdge, 'avoid-fast').warnedAt = 0;
  find(reactEdge, 'avoid-fast').reactAt = 2 * TICK;
  find(reactEdge, 'avoid-fast').response = 'turn-away';

  const beforeReact = step(reactEdge, HOLD, TICK);
  assert.equal(find(beforeReact, 'avoid-fast').navigation, null);
  assert.equal(find(beforeReact, 'avoid-fast').rudder, 0);

  const atReact = step(beforeReact, HOLD, TICK);
  assert.equal(atReact.time, find(atReact, 'avoid-fast').reactAt);
  assert.notEqual(find(atReact, 'avoid-fast').navigation, null);
  assert.equal(find(atReact, 'avoid-fast').navigation.phase, 'out');
  assert.equal(find(atReact, 'avoid-fast').targetHeading, find(atReact, 'avoid-fast').navigation.heading);
  assert.notEqual(find(atReact, 'avoid-fast').targetHeading, 180);
  assert.equal(Math.sign(find(atReact, 'avoid-fast').rudder), find(atReact, 'avoid-fast').navigation.sign);

  let resumeState = atReact;
  for (let t = 0; t < 30 && find(resumeState, 'avoid-fast').navigation?.phase !== 'resume'; t += 1) {
    resumeState = step(resumeState, HOLD, 1);
  }
  assert.equal(find(resumeState, 'avoid-fast').navigation?.phase, 'resume');
  assert.notEqual(find(resumeState, 'avoid-fast').targetHeading, find(resumeState, 'avoid-fast').navigation.heading);
  const beforeResumeHeading = find(resumeState, 'avoid-fast').heading;
  resumeState = step(resumeState, HOLD, 1);
  assert.notEqual(find(resumeState, 'avoid-fast').heading, beforeResumeHeading);
  assert.ok(find(resumeState, 'avoid-fast').rudder * find(resumeState, 'avoid-fast').navigation.sign < 0);

  // Arrival at exact tick boundary has shipDt === 0; mid-tick arrival moves only for post-arrival shipDt.
  let exactSpawn = createState(108);
  const b = openBearing(exactSpawn);
  exactSpawn = installSpecialty(exactSpawn, specialtyApproach({ id: 'at-tick', bearing: b, spawnTime: TICK, spawnRange: 300 }));
  exactSpawn = installSpecialty(exactSpawn, specialtyApproach({
    id: 'mid-tick', bearing: (b + 20) % 360, spawnTime: 0.005, spawnRange: 300, smuggler: false,
  }));
  exactSpawn = step(exactSpawn, HOLD, TICK);
  assert.ok(Math.abs(Math.hypot(find(exactSpawn, 'at-tick').x, find(exactSpawn, 'at-tick').y) - 300) < 1e-12);
  assert.ok(Math.abs(Math.hypot(find(exactSpawn, 'mid-tick').x, find(exactSpawn, 'mid-tick').y) - (300 + 6 * (TICK - 0.005))) < 1e-9);

  // Exact reef contact boundary (distance === rock.radius) wrecks an underway honest ship,
  // wrecked ships stay frozen on subsequent ticks, and safe ships stay safe even on contact.
  const contactState = { ...createState(108), hazards: [{ kind: 'reef', x: 18, y: 0, radius: 10 }], ships: [] };
  const template = structuredClone( createState(108).trawler );
  contactState.ships = [
    { ...template, id: 'edge-wreck', type: 'speedboat', smuggler: false, distress: false,
      x: 0, y: 0.1, heading: 0, speed: 6, rudder: 0, yawRate: 0, status: 'underway', wreckedAt: null },
    { ...template, id: 'safe-contact', type: 'speedboat', smuggler: false, distress: false,
      x: 0, y: 0.1, heading: 0, speed: 6, rudder: 0, yawRate: 0, status: 'safe', wreckedAt: null },
  ];
  const afterContact = step(contactState, HOLD, TICK);
  const wrecked = find(afterContact, 'edge-wreck');
  assert.equal(wrecked.status, 'wrecked');
  assert.equal(wrecked.wreckedAt, afterContact.time);
  assert.equal(find(afterContact, 'safe-contact').status, 'safe');

  const afterWreckStep = step(afterContact, HOLD, 1);
  assert.equal(find(afterWreckStep, 'edge-wreck').x, wrecked.x);
  assert.equal(find(afterWreckStep, 'edge-wreck').y, wrecked.y);
  assert.equal(find(afterWreckStep, 'edge-wreck').wreckedAt, wrecked.wreckedAt);
  assert.ok(Math.hypot(find(afterWreckStep, 'safe-contact').x, find(afterWreckStep, 'safe-contact').y)
    > Math.hypot(find(afterContact, 'safe-contact').x, find(afterContact, 'safe-contact').y));

  // Exact exitRange (600 m) and outward dot-product boundaries for safe status.
  const exitState = { ...createState(108), hazards: [], ships: [
    { ...template, id: 'at-600', type: 'speedboat', smuggler: false, distress: false,
      x: 0, y: -599.9, heading: 0, speed: 6, rudder: 0, yawRate: 0, status: 'underway' },
    { ...template, id: 'tangent-0', type: 'speedboat', smuggler: false, distress: false,
      x: 605, y: 0.1, heading: 0, speed: 6, rudder: 0, yawRate: 0, status: 'underway' },
    { ...template, id: 'inbound-sin', type: 'speedboat', smuggler: false, distress: false,
      x: 500, y: 400, heading: 5, speed: 6, rudder: 0, yawRate: 0, status: 'underway' },
    { ...template, id: 'inbound-cos', type: 'speedboat', smuggler: false, distress: false,
      x: -400, y: -500, heading: 85, speed: 6, rudder: 0, yawRate: 0, status: 'underway' },
  ] };
  const afterExitTick = step(exitState, HOLD, TICK);
  assert.equal(Math.hypot(find(afterExitTick, 'at-600').x, find(afterExitTick, 'at-600').y), 600);
  assert.equal(find(afterExitTick, 'at-600').status, 'underway', 'exact 600 m is not > exitRange');
  assert.equal(find(afterExitTick, 'tangent-0').status, 'underway', 'zero radial dot product is not outward');
  assert.equal(find(afterExitTick, 'inbound-sin').status, 'underway');
  assert.equal(find(afterExitTick, 'inbound-cos').status, 'underway');
  const pastExitTick = step(afterExitTick, HOLD, TICK);
  assert.equal(find(pastExitTick, 'at-600').status, 'safe');

  // summary.lost requires status === 'lost' and does not count seen underway/safe/wrecked ships.
  const tallyState = { ...createState(108), ships: [
    { ...template, id: 's-underway', everSeen: true, status: 'underway' },
    { ...template, id: 's-safe', everSeen: true, status: 'safe' },
    { ...template, id: 's-wrecked', everSeen: true, status: 'wrecked' },
  ] };
  assert.deepEqual(summary(tallyState), { safe: 1, wrecked: 1, unseen: 0, lost: 0 });
  tallyState.ships.push(
    { ...template, id: 's-lost-seen', everSeen: true, status: 'lost' },
    { ...template, id: 's-lost-unseen', everSeen: false, status: 'lost' },
  );
  assert.deepEqual(summary(tallyState), { safe: 1, wrecked: 1, unseen: 1, lost: 1 });
});
