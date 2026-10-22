import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDistrict, generateSkyline, rooftopSignGeometry, CITY_SEED, districtSignPosition, shadowVector } from '../js/city.js';
import { DISTRICTS } from '../js/config.js';
import { NoirCityRenderer } from '../js/renderer.js';
import { LateEditionSim } from '../js/sim.js';
import { boxesIntersect, placeLabel } from '../js/label-placement.js';
import { FIGURE_SCALE, MARKER_SCALE } from '../js/silhouettes.js';

const district = DISTRICTS[0];
test('cosmetic seed is repeatable, isolated from order, and changes silhouettes', () => {
  const expected = generateDistrict(district);
  generateDistrict(DISTRICTS[1], 99);
  assert.deepEqual(generateDistrict(district, CITY_SEED), expected);
  assert.notDeepEqual(generateDistrict(district, CITY_SEED + 1), expected);
  assert.notDeepEqual(generateDistrict({ ...district, id: 'other' }), expected);
  // Identity must change the actual architecture, not just its map position.
  const shape = (list) => list.map(({ height, setback, tank, escape, windows }) => ({ height, setback, tank, escape, windows }));
  assert.notDeepEqual(shape(generateDistrict({ ...district, id: 'other' })), shape(expected));
  for (const d of DISTRICTS) for (const b of generateDistrict(d)) {
    assert.ok(b.width > 0 && b.depth > 0 && b.height >= 24 && b.height < 67);
    assert.equal(b.windows.length, 15);
    assert.ok(b.windows.every((lit) => typeof lit === 'boolean'));
  }
  expected[0].windows.fill(false);
  assert.notDeepEqual(generateDistrict(district), expected, 'No shared mutable generator output');
});

test('cosmetic generator rejects corrupt geometry and invalid seeds', () => {
  for (const invalid of [null, {}, { ...district, id: '' }, { ...district, x: NaN },
    { ...district, y: Infinity }, { ...district, w: -1 }, { ...district, h: 0 }]) {
    assert.throws(() => generateDistrict(invalid), RangeError);
  }
  for (const seed of [NaN, Infinity, 1.2, '1947', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => generateDistrict(district, seed), RangeError);
  }
});

// A recording canvas exercises the real renderer, including the cold-cache path;
// it does not replace render() with a stub that could hide simulation mutations.
function canvasFixture(t) {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, key) => {
    if (key === 'measureText') return (text) => { calls.push([key, text]); return { width: text.length * 7 }; };
    if (String(key).startsWith('create')) return (...args) => { calls.push([key, ...args]); return { addColorStop() {} }; };
    return (...args) => calls.push([key, ...args]);
  }, set: () => true });
  const rect = { left: 12, top: 34, width: 1000, height: 650 };
  const canvas = () => ({ width: 1, height: 1, getContext: () => ctx, getBoundingClientRect: () => rect });
  const oldWindow = globalThis.window, oldDocument = globalThis.document;
  globalThis.window = { devicePixelRatio: 1 };
  globalThis.document = { createElement: canvas };
  t.after(() => {
    if (oldWindow === undefined) delete globalThis.window;
    else globalThis.window = oldWindow;
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  });
  return { canvas: canvas(), rect, calls };
}

test('rendering cold/warm/resized/DPR layers preserves gameplay and exact coordinate mapping', (t) => {
  const fixture = canvasFixture(t);
  const sim = new LateEditionSim({ seed: 81 });
  const hash = sim.getStateHash(), rng = sim.rng.getState();
  const renderer = new NoirCityRenderer(fixture.canvas);
  renderer.render(sim, 0.016);
  const cached = renderer.cache;
  renderer.render(sim, 0.016);
  assert.equal(renderer.cache, cached);
  renderer.hoverLeadId = sim.leads[0].uid;
  renderer.render(sim, NaN);
  assert.ok(Number.isFinite(renderer.cosmeticTime));
  fixture.rect.width = 800;
  renderer.render(sim, 0);
  assert.notEqual(renderer.cache, cached);
  const resized = renderer.cache;
  globalThis.window.devicePixelRatio = 2;
  renderer.render(sim, 0);
  assert.notEqual(renderer.cache, resized);
  assert.equal(fixture.canvas.width, 1600);
  assert.deepEqual(renderer.screenToWorld(412, 359), { x: 700, y: 500 });
  assert.equal(sim.getStateHash(), hash);
  assert.equal(sim.rng.getState(), rng);
  // Even a collapsed canvas cannot generate infinite/NaN input coordinates.
  fixture.rect.width = fixture.rect.height = 0;
  assert.deepEqual(renderer.screenToWorld(12, 34), { x: 0, y: 0 });
});

test('reduced motion freezes title geometry/rain, including after a live preference change', (t) => {
  const fixture = canvasFixture(t);
  const renderer = new NoirCityRenderer(fixture.canvas);
  renderer.renderTitle(0.1);
  renderer.reducedMotion = true;
  fixture.calls.length = 0;
  renderer.renderTitle(1);
  const first = fixture.calls.slice();
  fixture.calls.length = 0;
  renderer.renderTitle(10);
  assert.deepEqual(fixture.calls, first);
});


test('initial font loading cannot bake fallback signs; font failure still permits the city', (t) => {
  const fixture = canvasFixture(t);
  globalThis.document.fonts = { status: 'loading' };
  const renderer = new NoirCityRenderer(fixture.canvas);
  const sim = new LateEditionSim({ seed: 89 });
  renderer.render(sim);
  renderer.renderTitle();
  assert.equal(renderer.cache, null);
  assert.equal(fixture.calls.length, 0);
  // FontFaceSet settles to loaded even when a face failed (blocked/offline).
  globalThis.document.fonts.status = 'loaded';
  renderer.render(sim);
  assert.ok(renderer.cache);
  assert.ok(fixture.calls.some(([name]) => name === 'fillText'));
});

test('title resources are lazy, close on exit, and never exist in a desk cache', (t) => {
  const { canvas, rect } = canvasFixture(t);
  const renderer = new NoirCityRenderer(canvas);
  const sim = new LateEditionSim({ seed: 89 });
  assert.equal(renderer.skylines, null, 'Construction must not even generate title geometry');
  renderer.render(sim, 0);
  assert.ok(renderer.cache.city);
  assert.equal(renderer.cache.skyline, null);
  assert.equal(renderer.skylines, null);
  renderer.renderTitle(0);
  assert.equal(renderer.cache.city, null, 'Title must not retain hidden city textures');
  const skyline = renderer.cache.skyline;
  renderer.renderTitle(0);
  assert.equal(renderer.cache.skyline, skyline, 'Visible title reuses its textures');
  let closed = 0;
  for (const sprite of skyline) sprite.close = () => closed++;
  renderer.releaseTitle();
  assert.equal(closed, 3, 'Every title bitmap must close');
  assert.equal(renderer.cache, null, 'Canvas fallbacks must lose all retained references too');
  assert.equal(renderer.skylines, null);
  assert.equal(canvas.width, 1, 'Release the hidden title backing store');
  renderer.releaseTitle();
  assert.equal(closed, 3, 'Release is idempotent');
  renderer.renderTitle(0);
  assert.notEqual(renderer.cache.skyline, skyline, 'Re-entering title builds fresh layers');
  rect.width += 100;
  renderer.render(sim, 0);
  assert.ok(renderer.cache.city);
  assert.equal(renderer.cache.skyline, null, 'Resizing into desk must never create title layers');
  assert.equal(renderer.skylines, null);
});

test('warm weather/sign caches survive ticks but invalidate for in-place lead edits and DPR', (t) => {
  const fixture = canvasFixture(t);
  const renderer = new NoirCityRenderer(fixture.canvas);
  const sim = new LateEditionSim({ seed: 89 });
  renderer.render(sim);
  const fog = renderer.cache.driftFog;
  const signs = renderer.cache.signs;
  fixture.calls.length = 0;
  sim.leads[0].progress += 1;
  sim.leads[0].timeLeft -= 1;
  renderer.render(sim);
  assert.equal(renderer.cache.signs, signs, 'Countdown/progress never remeasure sign obstacles');
  fixture.calls.length = 0;
  renderer._drawRainAndVignette(renderer.ctx, 1 / 60);
  assert.equal(fixture.calls.filter(([name]) => name === 'createRadialGradient').length, 0,
    'Steady-state weather must not rasterize fog gradients (lead auras remain dynamic)');
  // Call the sign pass alone: dynamic lead labels elsewhere still measure text.
  fixture.calls.length = 0;
  renderer._drawDistrictSigns(renderer.ctx, sim);
  assert.equal(fixture.calls.filter(([name]) => name === 'measureText').length, 0);
  for (const [field, value] of Object.entries({ x: 10, y: 20, headline: 'Changed in place',
    baseValue: 9999, seriesBadge: 'A much wider series badge' })) {
    const previous = renderer.cache.signs;
    sim.leads[0][field] = value;
    renderer.render(sim);
    assert.notEqual(renderer.cache.signs, previous, field);
    assert.equal(renderer.cache.signs.positions.length, DISTRICTS.length);
    assert.equal(renderer.cache.driftFog, fog);
  }
  const beforeRemoval = renderer.cache.signs;
  sim.leads.length = 0;
  renderer.render(sim);
  assert.notEqual(renderer.cache.signs, beforeRemoval, 'Last lead removed');
  globalThis.window.devicePixelRatio = 2;
  renderer.render(sim);
  assert.notEqual(renderer.cache.driftFog, fog, 'Fog resolution follows backing size/DPR');
});


test('building shadows point away from the lamp, including a coincident light', () => {
  for (const lamp of [{ x: -10, y: -20 }, { x: 10, y: 20 }, { x: 0, y: 20 }]) {
    const shadow = shadowVector(0, 0, 60, lamp);
    assert.ok(Math.abs(Math.hypot(shadow.x, shadow.y) - 60) < 1e-10);
    assert.ok(shadow.x * -lamp.x + shadow.y * -lamp.y > 0);
  }
  assert.deepEqual(shadowVector(8, 12, 60, { x: 8, y: 12 }), { x: 0, y: 60 });
});

test('all eight district signs escape flags, headlines and series badges on their usual curb', () => {
  assert.equal(DISTRICTS.length, 8);
  const overlaps = (point, width, b) => point.x < b.x + b.w && point.x + width > b.x &&
    point.y - 18 < b.y + b.h && point.y + 25 > b.y;
  for (const d of DISTRICTS) {
    const width = 100;
    const original = districtSignPosition(d, width, []);
    const obstacles = [{ x: original.x - 40, y: original.y - 74, w: 240, h: 142 }];
    const snapshot = structuredClone({ d, obstacles });
    const shifted = districtSignPosition(d, width, obstacles);
    assert.notDeepEqual(shifted, original, `${d.id} must move away from the telegram`);
    assert.ok(obstacles.every((b) => !overlaps(shifted, width, b)), d.id);
    assert.deepEqual({ d, obstacles }, snapshot, 'Placement cannot mutate gameplay inputs');
    const crowded = [0, 1, 2, 3].map((i) => ({ x: d.x - 50,
      y: d.y - 75 + i * 65, w: d.w + 100, h: 142 }));
    const street = districtSignPosition(d, width, crowded);
    assert.ok(crowded.every((b) => !overlaps(street, width, b)), `${d.id}: four flags cover both curbs`);
    // A fully covered district still keeps exactly one finite, stable sign.
    const blocked = [{ x: -1000, y: -1000, w: 4000, h: 4000 }];
    const fallback = districtSignPosition(d, width, blocked);
    assert.ok(Number.isFinite(fallback.x) && Number.isFinite(fallback.y));
    assert.deepEqual(districtSignPosition(d, width, blocked), fallback);
  }
});

test('whole map paints exactly one unique sign label per district, including cached landmarks', (t) => {
  const { canvas, calls } = canvasFixture(t);
  const renderer = new NoirCityRenderer(canvas);
  const sim = new LateEditionSim({ seed: 89 });
  // Force every street sign off its usual curb; never resurrect a landmark copy.
  sim.leads = DISTRICTS.map((d, i) => ({ ...sim.leads[0], uid: `crowd-${i}`,
    x: d.x + 40, y: d.y + d.h - 4 }));
  renderer.render(sim, 0);
  const signs = renderer.cache.signs.positions;
  assert.equal(signs.length, DISTRICTS.length);
  assert.equal(new Set(signs.map((sign) => sign.text)).size, DISTRICTS.length);
  assert.deepEqual(signs.map((sign) => sign.districtId).sort(), DISTRICTS.map((d) => d.id).sort());
  for (const sign of signs) {
    assert.equal(calls.filter(([method, text]) => method === 'fillText' && text === sign.text).length,
      1, `${sign.districtId}: the static city and dynamic sign pass together paint one label`);
  }
});

test('crowded labels avoid enlarged staff/rivals, badges, selection and dispatch rings', (t) => {
  const { canvas } = canvasFixture(t);
  const renderer = new NoirCityRenderer(canvas);
  const sim = new LateEditionSim({ seed: 89 });
  sim.edition = 4;
  sim.operatives.forEach((op, i) => Object.assign(op, {
    x: 650 + i * 35, y: 530, targetX: 700, targetY: 500,
  }));
  sim.rivals = [{ x: 740, y: 440, stunTimer: 1 }, { x: 600, y: 475, stunTimer: 0 }];
  sim.leads.forEach((lead, i) => Object.assign(lead, { x: 700 + i * 20, y: 500,
    headline: 'LONG CROWDED TELEGRAM HEADLINE', seriesBadge: 'SERIES PART III/III (+2,500 RDRS)' }));
  const before = sim.getStateHash();
  renderer.render(sim, 0);
  const obstacles = renderer._leadLabelObstacles(sim);
  const placements = renderer._layoutLeadLabels(renderer.ctx, sim, renderer.cache.labelLayout.lastCheck + 250);
  assert.ok(placements.every((p) => p.leader), 'Every offset must have a leader line');
  for (const { box } of placements) {
    assert.ok(obstacles.every((b) => !boxesIntersect(box, b)), JSON.stringify(box));
    assert.ok(box.x >= 0 && box.x + box.w <= 1400 && box.y >= 0 && box.y + box.h <= 1000);
  }
  assert.equal(sim.getStateHash(), before);
});

test('labels try four fixed diagonal offsets, always use leaders, and fall back to the last', () => {
  const anchor = { x: 200, y: 200 }, size = { w: 80, h: 30 };
  const bounds = { x: 0, y: 0, w: 400, h: 400 };
  const obstacles = [];
  for (const [x, y] of [[304, 66], [16, 66], [304, 304], [16, 304]]) {
    const placement = placeLabel(anchor, size, obstacles, bounds);
    assert.deepEqual(placement.box, { x, y, ...size });
    assert.deepEqual(placement.leader.from, anchor);
    assert.deepEqual(placement.leader.to, { x: x > anchor.x ? x : x + size.w,
      y: y > anchor.y ? y : y + size.h });
    obstacles.push({ ...placement.box });
  }
  const snapshot = structuredClone({ anchor, size, obstacles, bounds });
  const fallback = placeLabel(anchor, size, obstacles, bounds);
  assert.deepEqual(fallback.box, obstacles[3], 'No expensive free-space search when all four are blocked');
  assert.ok(fallback.leader);
  assert.deepEqual(placeLabel(anchor, size, obstacles, bounds), fallback);
  assert.deepEqual({ anchor, size, obstacles, bounds }, snapshot);
  const covered = [{ x: -1000, y: -1000, w: 4000, h: 4000 }];
  assert.deepEqual(placeLabel(anchor, size, covered, bounds), fallback);
  for (const bad of [{ ...size, w: NaN }, { ...size, h: 0 }, { ...size, w: -1 }]) {
    assert.throws(() => placeLabel(anchor, bad, obstacles), RangeError);
  }
  assert.throws(() => placeLabel({ x: Infinity, y: 0 }, size, []), RangeError);
  assert.throws(() => placeLabel(anchor, size, [{ x: 0, y: 0, w: 0, h: 10 }]), RangeError);
});

test('birth placement checks HQ, district signs and existing labels without consulting moving figures', (t) => {
  const { canvas } = canvasFixture(t);
  const renderer = new NoirCityRenderer(canvas);
  const sim = new LateEditionSim({ seed: 89 });
  sim.scoopsTotal = 1;
  sim.hq = { x: 800, y: 0, w: 400, h: 500 }; // Blocks above-right.
  sim.leads = sim.leads.slice(0, 2).map((lead, i) => ({ ...lead, uid: `birth-${i}`, x: 700, y: 500 }));
  renderer._ensureLayers();
  renderer.cache.signs = { positions: [{ x: 0, y: 350, width: 600 }] }; // Blocks above-left.
  renderer._leadLabelObstacles = () => { throw new Error('Birth must use static obstacles only'); };
  const now = renderer.cache.labelLayout.lastCheck;
  const placements = renderer._layoutLeadLabels(renderer.ctx, sim, now);
  assert.ok(placements[0].box.x > 700 && placements[0].box.y > 500, 'First clear offset is below-right');
  assert.ok(placements[1].box.x < 700 && placements[1].box.y > 500, 'Existing label reserves below-right');
  assert.ok(!boxesIntersect(placements[0].box, placements[1].box));
  for (const { box } of placements) {
    assert.ok(renderer._leadLabelStaticObstacles(sim).every((obstacle) => !boxesIntersect(box, obstacle)));
  }
  sim.leads.push({ ...sim.leads[0], uid: 'last-offset-fallback' });
  const added = renderer._layoutLeadLabels(renderer.ctx, sim, now + 1);
  assert.equal(added[0], placements[0], 'An appearing label never moves an existing one');
  assert.equal(added[1], placements[1]);
  assert.deepEqual(added[2].box, placements[1].box, 'Fully obstructed births keep the last offset');
});

test('warm label sprites reject stale in-place copy, selection and verification; removed leads release sprites', (t) => {
  const { canvas, calls } = canvasFixture(t);
  const renderer = new NoirCityRenderer(canvas);
  const sim = new LateEditionSim({ seed: 89 });
  renderer.render(sim, 0);
  const lead = sim.leads[0];
  const first = renderer.cache.leadLabels.get(lead.uid);
  calls.length = 0;
  lead.timeLeft -= 10;
  lead.progress = 50;
  lead.rivalProgress = 90;
  renderer._drawStoryLeads(renderer.ctx, sim);
  assert.equal(renderer.cache.leadLabels.get(lead.uid), first);
  assert.equal(calls.filter(([name]) => name === 'measureText' || name === 'fillText').length, 0,
    'Live arcs/countdown must not measure or rasterize unchanged label text');
  for (const [field, value] of Object.entries({ beat: 'GRAFT', headline: 'CHANGED IN PLACE',
    baseValue: 0, seriesBadge: 'PART III/III', photoVerified: true, scoopedByRival: true })) {
    const previous = renderer.cache.leadLabels.get(lead.uid);
    lead[field] = value;
    renderer._drawStoryLeads(renderer.ctx, sim);
    assert.notEqual(renderer.cache.leadLabels.get(lead.uid), previous, field);
  }
  const previous = renderer.cache.leadLabels.get(lead.uid);
  sim.selectedLeadId = sim.selectedLeadId === lead.uid ? null : lead.uid;
  renderer._drawStoryLeads(renderer.ctx, sim);
  assert.notEqual(renderer.cache.leadLabels.get(lead.uid), previous, 'Selection changes the pill border');
  lead.photoVerified = false;
  calls.length = 0;
  renderer._drawStoryLeads(renderer.ctx, sim);
  assert.ok(calls.some(([name, text]) => name === 'fillText' && text === '0.5×'),
    'Removing photo verification must expose the rival stamp');
  calls.length = 0;
  renderer._drawStoryLeads(renderer.ctx, sim);
  for (const { leader } of renderer.cache.labelLayout.placements.values()) {
    assert.ok(calls.some(([name, x, y], i) => name === 'moveTo' && x === leader.from.x && y === leader.from.y &&
      calls[i + 1]?.[0] === 'lineTo' && calls[i + 1][1] === leader.to.x && calls[i + 1][2] === leader.to.y &&
      calls[i + 2]?.[0] === 'stroke'), 'Every cached label must still draw its leader on warm frames');
  }
  const uid = lead.uid;
  lead.uid = 'replacement-at-same-address';
  renderer._drawStoryLeads(renderer.ctx, sim);
  assert.equal(renderer.cache.leadLabels.has(uid), false);
  assert.equal(renderer.cache.leadLabels.size, sim.leads.length);
  sim.leads = [];
  renderer._drawStoryLeads(renderer.ctx, sim);
  assert.equal(renderer.cache.leadLabels.size, 0);
});

test('a first scoop and later selection never shrink onboarding space or shift surviving artwork', (t) => {
  const { canvas, calls } = canvasFixture(t);
  const renderer = new NoirCityRenderer(canvas);
  const sim = new LateEditionSim({ seed: 89 });
  renderer.render(sim, 0);
  const lead = sim.leads[1];
  const placement = renderer.cache.labelLayout.placements.get(lead.uid);
  const cached = renderer.cache.leadLabels.get(lead.uid);
  assert.ok(cached.width < placement.box.w, 'Do not rasterize the empty prompt margin');
  const drawPosition = (sprite) => {
    const call = calls.find(([name, image]) => name === 'drawImage' && image === sprite);
    assert.ok(call, 'The actual cached telegram must be blitted');
    return call.slice(2);
  };
  const before = drawPosition(cached.sprite);
  sim.scoopsTotal = 1;
  sim.selectedLeadId = lead.uid;
  calls.length = 0;
  renderer._drawStoryLeads(renderer.ctx, sim);
  assert.deepEqual(renderer.cache.labelLayout.placements.get(lead.uid).box, placement.box);
  assert.deepEqual(drawPosition(renderer.cache.leadLabels.get(lead.uid).sprite), before,
    'A selection pixel refresh must preserve the exact image position and size after onboarding ends');
});

test('only overlapping labels move at 250 ms; warm frames never build collision geometry or repaint', (t) => {
  const { canvas, calls } = canvasFixture(t);
  const renderer = new NoirCityRenderer(canvas, { reducedMotion: true });
  const sim = new LateEditionSim({ seed: 89 });
  sim.edition = 4;
  sim.scoopsTotal = 1;
  renderer.render(sim, 0);
  const start = renderer.cache.labelLayout.lastCheck = 1000;
  const first = renderer._layoutLeadLabels(renderer.ctx, sim, start);
  const sprites = [...renderer.cache.leadLabels.values()].map(({ sprite }) => sprite);
  const { box } = first[0];
  const op = sim.operatives[0];
  Object.assign(op, { x: box.x + box.w / 2, y: box.y + box.h,
    targetX: box.x + box.w / 2, targetY: box.y + box.h });
  const original = renderer._leadLabelObstacles.bind(renderer);
  let checks = 0;
  renderer._leadLabelObstacles = (...args) => { checks++; return original(...args); };
  calls.length = 0;
  for (const elapsed of [0, 16, 125, 249]) {
    assert.deepEqual(renderer._layoutLeadLabels(renderer.ctx, sim, start + elapsed), first);
  }
  assert.equal(checks, 0, 'A per-frame collision pass would fail this assertion');
  const moved = renderer._layoutLeadLabels(renderer.ctx, sim, start + 250);
  assert.equal(checks, 1);
  assert.notDeepEqual(moved[0].box, first[0].box, 'An incoming figure moves its obstructed label');
  assert.equal(moved[1], first[1], 'Unobstructed labels never reflow');
  for (const { box, leader } of moved) {
    assert.ok(original(sim).every((obstacle) => !boxesIntersect(box, obstacle)));
    assert.ok(leader);
  }
  assert.deepEqual([...renderer.cache.leadLabels.values()].map(({ sprite }) => sprite), sprites,
    'Re-placement must reuse text/frame bitmaps');
  assert.equal(calls.filter(([name]) => name === 'measureText' || name === 'fillText').length, 0);
  renderer._layoutLeadLabels(renderer.ctx, sim, start + 499);
  assert.equal(checks, 1, 'The next check cannot run early');
  renderer._layoutLeadLabels(renderer.ctx, sim, start + 500);
  assert.equal(checks, 2, 'Wall-clock checks continue under reduced motion and zero render dt');
  // Incoming signs, new leads, copy, selection and departing actors must never
  // reflow a surviving clear label; only figure/ring overlaps may do so.
  sim.operatives.forEach((actor) => Object.assign(actor, { x: 50, y: 950, targetX: 50, targetY: 950 }));
  renderer.cache.signs.positions[0] = { x: moved[0].box.x, y: moved[0].box.y + 19, width: moved[0].box.w };
  sim.leads[0].headline = 'A NEW HEADLINE IN PLACE';
  sim.selectedLeadId = null;
  const changed = renderer._layoutLeadLabels(renderer.ctx, sim, start + 750);
  assert.equal(changed[0].box.x, moved[0].box.x);
  assert.equal(changed[0].box.y, moved[0].box.y);
  sim.leads.push({ ...sim.leads[0], uid: 'incoming', x: 700, y: 700 });
  const added = renderer._layoutLeadLabels(renderer.ctx, sim, start + 1000);
  assert.deepEqual(added[0], changed[0], 'New labels must respect existing placement');
  sim.leads[0].x += 17;
  sim.leads[0].y += 19;
  const retied = renderer._layoutLeadLabels(renderer.ctx, sim, start + 1001);
  assert.deepEqual(retied[0].box, added[0].box, 'Address edits only retie the thread');
  assert.deepEqual(retied[0].leader.from, { x: sim.leads[0].x, y: sim.leads[0].y });
  globalThis.window.devicePixelRatio = 2;
  const oldSprites = renderer.cache.leadLabels;
  renderer.render(sim, 0);
  assert.notEqual(renderer.cache.leadLabels, oldSprites, 'DPR must rebuild label resolution');
});

test('250 ms checks catch unlock, hover/selection, target and stunned-rival rings', (t) => {
  const { canvas } = canvasFixture(t);
  const renderer = new NoirCityRenderer(canvas);
  const sim = new LateEditionSim({ seed: 89 });
  sim.scoopsTotal = 1;
  sim.leads = [sim.leads[0]];
  renderer.render(sim, 0);
  let now = renderer.cache.labelLayout.lastCheck = 1000;
  const placements = () => renderer._layoutLeadLabels(renderer.ctx, sim, now);
  const photo = sim.operatives.find((op) => op.role === 'photographer');
  const first = placements()[0];
  const box = first.box;
  Object.assign(photo, { x: box.x + box.w / 2, y: box.y + box.h,
    targetX: box.x + box.w / 2, targetY: box.y + box.h });
  now += 250;
  assert.equal(placements()[0], first, 'Locked photographer is not a visible obstacle');
  sim.edition = 2;
  now += 250;
  assert.notEqual(placements()[0], first, 'Unlock makes that figure visible');
  for (const state of ['hover', 'selection', 'target', 'stun']) {
    sim.operatives.forEach((op) => Object.assign(op, { x: 50, y: 950, targetX: 50, targetY: 950 }));
    sim.rivals = [];
    renderer.hoverOperativeId = null;
    sim.selectedOpId = sim.operatives[0].id;
    const before = placements()[0];
    const { box } = before;
    const op = sim.operatives[1];
    if (state === 'hover' || state === 'selection') {
      // Body ends left of label; only the wider ground ring can overlap.
      Object.assign(op, { x: box.x - 51, y: box.y + box.h / 2,
        targetX: box.x - 51, targetY: box.y + box.h / 2 });
      assert.ok(boxesIntersect(box, { x: op.x - 39 * MARKER_SCALE,
        y: op.y - 13 * MARKER_SCALE, w: 78 * MARKER_SCALE, h: 36 * MARKER_SCALE }));
      if (state === 'hover') renderer.hoverOperativeId = op.id;
      else sim.selectedOpId = op.id;
    } else if (state === 'target') {
      op.targetX = box.x + box.w / 2; op.targetY = box.y + box.h / 2;
    } else {
      sim.rivals = [{ x: box.x + box.w / 2, y: box.y + box.h + 20, stunTimer: 1 }];
    }
    assert.equal(placements()[0], before, 'Never check before the 250 ms deadline');
    now += 250;
    const after = placements()[0];
    assert.notDeepEqual(after.box, before.box, state);
    assert.ok(renderer._leadLabelObstacles(sim).every((obstacle) => !boxesIntersect(after.box, obstacle)), state);
  }
});

test('street figures, number badges and ground rings grow together by 1.4x', (t) => {
  const { canvas, calls } = canvasFixture(t);
  const renderer = new NoirCityRenderer(canvas);
  const sim = new LateEditionSim({ seed: 89 });
  sim.edition = 4;
  renderer._drawOperatives(renderer.ctx, sim);
  assert.equal(FIGURE_SCALE, 1.6 * 1.4);
  assert.equal(calls.filter(([method, x, y]) => method === 'scale' && x === FIGURE_SCALE && y === FIGURE_SCALE).length, 4);
  assert.ok(calls.some(([method, , , rx, ry]) => method === 'ellipse' && rx === 38 * MARKER_SCALE && ry === 17 * MARKER_SCALE));
  calls.length = 0;
  renderer._drawRivals(renderer.ctx, { rivals: [{ x: 0, y: 0, type: 'goon', angle: 0, stunTimer: 1 }] });
  assert.ok(calls.some(([method, x, y]) => method === 'scale' && x === FIGURE_SCALE && y === FIGURE_SCALE));
});

test('figure bitmaps reuse body raster while bobbing, separate hostile factions, and rebuild at DPR changes', (t) => {
  const { canvas, calls } = canvasFixture(t);
  const renderer = new NoirCityRenderer(canvas);
  renderer._ensureLayers();
  renderer._drawFigure(renderer.ctx, 'reporter');
  const first = renderer.cache.figures.get('reporter:false:false');
  assert.ok(first);
  calls.length = 0;
  renderer._drawFigure(renderer.ctx, 'reporter', { bob: 1.5 });
  assert.equal(renderer.cache.figures.get('reporter:false:false'), first);
  assert.ok(calls.some(([name, image, x, y]) => name === 'drawImage' && image === first && x === -22 && y === -41.5));
  assert.equal(calls.filter(([name]) => name === 'stroke' || name === 'fillRect').length, 0,
    'Walking must not repaint body paths/camera/hat; its street shadow stays live');
  for (const [role, options, key] of [
    ['reporter', { herald: true }, 'reporter:true:false'],
    ['fixer', { goon: true }, 'fixer:false:true'],
    ['photographer', {}, 'photographer:false:false'],
  ]) {
    renderer._drawFigure(renderer.ctx, role, options);
    assert.ok(renderer.cache.figures.has(key));
    assert.notEqual(renderer.cache.figures.get(key), first, 'Factions/camera must never share the wrong art');
  }
  globalThis.window.devicePixelRatio = 2;
  renderer._ensureLayers();
  renderer._drawFigure(renderer.ctx, 'reporter');
  assert.notEqual(renderer.cache.figures.get('reporter:false:false'), first);
});

test('title sign legs meet their generated near-building roof within one pixel', (t) => {
  const { canvas, calls } = canvasFixture(t);
  const renderer = new NoirCityRenderer(canvas);
  for (const seed of [CITY_SEED, 0, -99, 12345]) {
    const buildings = generateSkyline(2, seed);
    assert.deepEqual(generateSkyline(2, seed), buildings);
    const host = buildings[17];
    const sign = rooftopSignGeometry(host, 120);
    assert.ok(Math.abs(sign.bottomY - host.roofY) <= 1);
    assert.equal(host.roofY, host.top - 5, 'The actual cornice roof, not the facade top');
    assert.ok(sign.legs.every((x) => x > host.x && x < host.x + host.width));
    renderer.skylines = [null, null, buildings];
    calls.length = 0;
    renderer._drawSkyline(renderer.ctx, 2);
    for (const x of sign.legs) assert.ok(calls.some(([method, px, py]) => method === 'lineTo' && px === x && Math.abs(py - host.roofY) <= 1));
    assert.ok(calls.some(([method, x, y, w, h]) => method === 'fillRect' && x === host.x && y === host.top && w === host.width && h === host.height + 240));
    assert.equal(calls.filter(([method, text]) => method === 'fillText' && text === 'EVENING STAR').length, 1);
  }
  for (const depth of [-1, 3, NaN]) assert.throws(() => generateSkyline(depth), RangeError);
  assert.throws(() => generateSkyline(2, Infinity), RangeError);
  assert.throws(() => rooftopSignGeometry(null, 120), RangeError);
  assert.throws(() => rooftopSignGeometry(generateSkyline(2)[17], NaN), RangeError);
});
