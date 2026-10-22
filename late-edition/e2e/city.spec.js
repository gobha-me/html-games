import { test, expect, startDesk } from './helpers.js';

for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`ten map addresses dispatch through art at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const retiredRequests = [];
    page.on('request', (request) => {
      if (/\/unit_[^/]+\.png/.test(request.url())) retiredRequests.push(request.url());
    });
    await page.setViewportSize(viewport);
    await page.reload(); // Capture requests from title, pass portraits, and unlocked plates too.
    await startDesk(page, { dispatch: false });
    await page.evaluate(() => {
      const { sim } = window.lateEditionApp;
      sim.paused = true;
      sim.edition = 4;
      window.lateEditionApp._syncFullUI();
    });
    const dispatched = [];
    for (let i = 0; i < 10; i++) {
      const target = await page.evaluate(() => {
        const app = window.lateEditionApp, { sim } = app;
        sim.selectOperative('rep_1');
        const lead = sim.leads[0];
        // Keep idle staff away from the address: operative selection has always
        // taken precedence within 30 world px and must continue to do so.
        sim.operatives.forEach((op, i) => { op.x = 580 + i * 80; op.y = 520; });
        const rect = app.canvas.getBoundingClientRect();
        app.renderer.render(sim, 0);
        return { uid: lead.uid, x: rect.left + lead.x / 1400 * rect.width,
          y: rect.top + lead.y / 1000 * rect.height };
      });
      await page.mouse.click(target.x, target.y);
      expect(await page.evaluate(() => window.lateEditionApp.sim.operatives[0].targetLeadId)).toBe(target.uid);
      dispatched.push(target.uid);
      await page.evaluate(() => {
        const { sim } = window.lateEditionApp;
        sim.completeLeadScoop(sim.leads[0]);
      });
    }
    expect(new Set(dispatched).size).toBe(10);
    expect(retiredRequests).toEqual([]);
  });
}

test('art never widens the lead hit radius, steals unit clicks, or dispatches after lockup', async ({ page }) => {
  await startDesk(page, { dispatch: false });
  const clickWorld = async (x, y) => {
    const point = await page.locator('#city-canvas').evaluate((canvas, { x, y }) => {
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + x / 1400 * rect.width, y: rect.top + y / 1000 * rect.height };
    }, { x, y });
    await page.mouse.click(point.x, point.y);
  };
  await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    sim.paused = true;
    sim.selectOperative('rep_1');
    sim.leads[0].x = 700; sim.leads[0].y = 300;
  });
  // Native click coordinates are rounded to CSS pixels; leave enough margin
  // that both sides of the legacy 46px point-dispatch snap radius survive
  // scaling. The canvas first checks 36px, then delegates to that sim fallback.
  await clickWorld(750, 300);
  expect(await page.evaluate(() => window.lateEditionApp.sim.operatives[0].targetLeadId)).toBe(null);
  await clickWorld(742, 300);
  expect(await page.evaluate(() => window.lateEditionApp.sim.operatives[0].targetLeadId)).not.toBe(null);
  await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    sim.operatives[1].x = 700; sim.operatives[1].y = 300;
    sim.operatives[0].targetLeadId = null;
  });
  await clickWorld(700, 300);
  expect(await page.evaluate(() => window.lateEditionApp.sim.selectedOpId)).toBe('rep_2');
  expect(await page.evaluate(() => window.lateEditionApp.sim.operatives[0].targetLeadId)).toBe(null);
  await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    sim.operatives[1].x = 800; sim.operatives[1].y = 500;
    sim.lockUp();
    window.lateEditionApp._syncFullUI();
  });
  await clickWorld(700, 300);
  expect(await page.evaluate(() => window.lateEditionApp.sim.operatives[1].targetLeadId)).toBe(null);
});

test('reduced motion title is pixel-static, including a live preference change', async ({ page }) => {
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.titleRenderer.reducedMotion)).toBe(true);
  const first = await page.locator('#title-city').evaluate((canvas) => canvas.toDataURL());
  await page.waitForTimeout(300);
  expect(await page.locator('#title-city').evaluate((canvas) => canvas.toDataURL())).toBe(first);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(300);
  expect(await page.locator('#title-city').evaluate((canvas) => canvas.toDataURL())).not.toBe(first);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(100);
  const frozen = await page.locator('#title-city').evaluate((canvas) => canvas.toDataURL());
  await page.waitForTimeout(300);
  expect(await page.locator('#title-city').evaluate((canvas) => canvas.toDataURL())).toBe(frozen);
});

test('desk releases every title cache and never renders a hidden searchlight', async ({ page }) => {
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => Boolean(window.lateEditionApp.titleRenderer.cache?.skyline))).toBe(true);
  await page.evaluate(() => {
    window.releasedSkylines = window.lateEditionApp.titleRenderer.cache.skyline;
  });
  await startDesk(page);
  const before = await page.evaluate(() => {
    const { titleRenderer, renderer } = window.lateEditionApp;
    window.titleCallsWhileHidden = 0;
    const original = titleRenderer.renderTitle;
    titleRenderer.renderTitle = function (...args) {
      window.titleCallsWhileHidden++;
      return original.apply(this, args);
    };
    return { title: titleRenderer.cosmeticTime, desk: renderer.cosmeticTime };
  });
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.renderer.cosmeticTime)).toBeGreaterThan(before.desk);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => ({ calls: window.titleCallsWhileHidden,
    time: window.lateEditionApp.titleRenderer.cosmeticTime }))).toEqual({ calls: 0, time: before.title });
  const caches = () => page.evaluate(() => {
    const { titleRenderer, renderer } = window.lateEditionApp;
    return { title: titleRenderer.cache, geometry: titleRenderer.skylines,
      deskSkyline: renderer.cache.skyline, deskGeometry: renderer.skylines,
      closedWidths: window.releasedSkylines.map((sprite) => sprite.width),
      backing: [titleRenderer.canvas.width, titleRenderer.canvas.height] };
  });
  const released = { title: null, geometry: null, deskSkyline: null, deskGeometry: null,
    closedWidths: [0, 0, 0], backing: [1, 1] };
  expect(await caches()).toEqual(released);
  await page.setViewportSize({ width: 1600, height: 900 });
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.renderer.canvas.width))
    .toBe(await page.locator('#city-canvas').evaluate((canvas) => Math.round(canvas.getBoundingClientRect().width * devicePixelRatio)));
  expect(await caches()).toEqual(released);
  await page.evaluate(() => { window.lateEditionApp.sim.phase = 'title'; window.lateEditionApp._syncFullUI(); });
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.titleRenderer.cache?.skyline?.length)).toBe(3);
  await page.evaluate(() => { window.lateEditionApp.sim.phase = 'desk'; window.lateEditionApp._syncFullUI(); });
  expect(await caches()).toEqual(released);

});

test('title depth values stay distinct and the sodium beam survives foreground compositing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => Boolean(window.lateEditionApp.titleRenderer.cache))).toBe(true);
  const pixels = await page.evaluate(() => {
    const renderer = window.lateEditionApp.titleRenderer;
    const canvas = document.createElement('canvas');
    canvas.width = 1400; canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    const masses = [0, 1, 2].map((depth) => {
      ctx.clearRect(0, 0, 1400, 1000);
      renderer._drawSkyline(ctx, depth);
      const building = renderer.skylines[depth][2];
      // Inside a real facade, above its first windows; ornaments cannot bias it.
      return Array.from(ctx.getImageData(building.x + building.width / 2, building.top + 8, 1, 1).data);
    });
    renderer.renderTitle(0);
    const lit = renderer.ctx.getImageData(0, 0, renderer.canvas.width, renderer.canvas.height).data;
    const original = renderer._drawTitleSearchlight;
    try {
      renderer._drawTitleSearchlight = () => {};
      renderer.renderTitle(0);
      const unlit = renderer.ctx.getImageData(0, 0, renderer.canvas.width, renderer.canvas.height).data;
      const paper = document.querySelector('.title-paper').getBoundingClientRect();
      const rect = renderer.canvas.getBoundingClientRect();
      let visibleBeamPixels = 0;
      for (let i = 0; i < lit.length; i += 4) {
        const x = i / 4 % renderer.canvas.width / renderer.canvas.width * rect.width + rect.left;
        const y = Math.floor(i / 4 / renderer.canvas.width) / renderer.canvas.height * rect.height + rect.top;
        if (x >= paper.left && x <= paper.right && y >= paper.top && y <= paper.bottom) continue;
        if (lit[i] - unlit[i] >= 8 && lit[i] > lit[i + 1] && lit[i + 1] > lit[i + 2]) visibleBeamPixels++;
      }
      return { masses, visibleBeamPixels };
    } finally {
      renderer._drawTitleSearchlight = original;
      renderer.renderTitle(0);
    }
  });
  for (const mass of pixels.masses) {
    expect(mass[3]).toBe(255);
    expect(Math.max(...mass.slice(0, 3))).toBeLessThan(45);
  }
  expect(pixels.masses[0][0]).toBeGreaterThan(pixels.masses[1][0] + 3);
  expect(pixels.masses[1][0]).toBeGreaterThan(pixels.masses[2][0] + 3);
  expect(pixels.masses[2][0]).toBeGreaterThan(14);
  expect(pixels.visibleBeamPixels).toBeGreaterThan(1000);
});

test('crowded telegram artwork keeps clear of figures and rings without moving any address', async ({ page }, testInfo) => {
  await startDesk(page, { dispatch: false });
  const results = await page.evaluate(async () => {
    const { boxesIntersect } = await import('../late-edition/js/label-placement.js');
    const { renderer, sim } = window.lateEditionApp;
    sim.edition = 4;
    sim.paused = true;
    sim.scoopsTotal = 1;
    sim.operatives.forEach((op, i) => Object.assign(op, { x: 650 + i * 35, y: 530,
      targetX: 700, targetY: 500 }));
    sim.rivals = [{ x: 740, y: 440, stunTimer: 1, type: 'goon', angle: 0 },
      { x: 600, y: 475, stunTimer: 0, type: 'reporter', angle: 0 }];
    sim.leads.forEach((lead, i) => Object.assign(lead, { uid: `crowded-${i}`, x: 700 + i * 20, y: 500,
      headline: 'CROWDED TELEGRAM HEADLINE', seriesBadge: 'SERIES III/III (+2,500 RDRS)', photoVerified: true }));
    const before = sim.getStateHash();
    renderer.render(sim, 0);
    const placements = renderer._layoutLeadLabels(renderer.ctx, sim, renderer.cache.labelLayout.lastCheck + 251);
    renderer.render(sim, 0);
    const obstacles = renderer._leadLabelObstacles(sim);
    const collisions = placements.filter(({ box }) => {
      const collision = obstacles.some((b) => boxesIntersect(box, b));
      return collision;
    });
    return { count: placements.length, leads: sim.leads.length, collisions,
      detached: placements.filter((p) => p.leader).length, unchanged: sim.getStateHash() === before };
  });
  expect(results.count).toBe(results.leads);
  expect(results.collisions).toEqual([]);
  expect(results.detached).toBe(results.leads);
  expect(results.unchanged).toBe(true);
  await testInfo.attach('crowded-map', { body: await page.screenshot(), contentType: 'image/png' });
});

test('1600x900 night art stays dark and all eight signs survive flags on their curbs', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => Boolean(window.lateEditionApp.titleRenderer.cache))).toBe(true);
  const night = await page.evaluate(async () => {
    const { PALETTE } = await import('../late-edition/js/palette.js');
    const renderer = window.lateEditionApp.titleRenderer;
    const canvas = document.createElement('canvas');
    canvas.width = 1400; canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    renderer._drawSkyline(ctx, 0);
    // The old smoke-grey cutouts fail across thousands of real raster pixels.
    const pixels = ctx.getImageData(0, 0, 1400, 1000).data;
    let brightest = 0;
    for (let i = 0; i < pixels.length; i += 4) brightest = Math.max(brightest, pixels[i], pixels[i + 1], pixels[i + 2]);
    ctx.fillStyle = PALETTE.nightInk;
    ctx.fillRect(0, 0, 1400, 1000);
    renderer._drawFogEdges(ctx);
    const corners = [[0, 0], [1399, 0], [0, 999], [1399, 999]].map(([x, y]) =>
      Array.from(ctx.getImageData(x, y, 1, 1).data));
    return { brightest, corners };
  });
  expect(night.brightest).toBeLessThan(45);
  for (const corner of night.corners) expect(corner).toEqual([14, 13, 12, 255]);
  await testInfo.attach('title-1600x900', { body: await page.screenshot(), contentType: 'image/png' });
  await startDesk(page, { dispatch: false });
  const placements = await page.evaluate(async () => {
    const { DISTRICTS } = await import('../late-edition/js/config.js');
    const renderer = window.lateEditionApp.renderer;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const original = ctx.fillText.bind(ctx);
    const signs = [];
    ctx.fillText = (text, x, y) => {
      signs.push({ text, x: x - 6, y, w: ctx.measureText(text).width + 12 });
      original(text, x, y);
    };
    const results = [];
    // Attack every usual sign position, including full-length headlines and an
    // oversized series badge. Rendering must not move any underlying address.
    for (const d of DISTRICTS) {
      const lead = { x: d.x + 40, y: d.y + d.h - 4, baseValue: 999,
        headline: 'A VERY LONG TELEGRAM HEADLINE AT THE CURB', seriesBadge: 'ARC · SERIES PART III/III (+2,500 RDRS)' };
      const before = JSON.stringify(lead);
      signs.length = 0;
      renderer._drawDistrictSigns(ctx, { leads: [lead] });
      ctx.font = '12px "Courier Prime", monospace';
      const half = Math.max(48, (ctx.measureText(`$999 · ${lead.headline.slice(0, 24)}…`).width + 16) / 2,
        (ctx.measureText(lead.seriesBadge).width + 14) / 2);
      const b = { x: lead.x - half - 8, y: lead.y - 74, w: half * 2 + 16, h: 142 };
      results.push({ count: signs.length, unique: new Set(signs.map((s) => s.text)).size,
        overlaps: signs.filter((s) => s.x < b.x + b.w && s.x + s.w > b.x && s.y - 18 < b.y + b.h && s.y + 25 > b.y),
        unchanged: JSON.stringify(lead) === before });
    }
    return results;
  });
  for (const result of placements) {
    expect(result.count).toBe(8);
    expect(result.unique).toBe(8);
    expect(result.overlaps).toEqual([]);
    expect(result.unchanged).toBe(true);
  }
  const mass = await page.evaluate(async () => {
    const { PALETTE } = await import('../late-edition/js/palette.js');
    const canvas = document.createElement('canvas');
    canvas.width = 1400; canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    const renderer = new window.lateEditionApp.renderer.constructor(canvas);
    // Put the nearest lamp directly south. A front-edge-only shadow vanishes
    // under the roof in this direction; the northern street must still darken.
    const b = { x: 700 - (60 + 40 * 0.577) / 2, y: 300, width: 60,
      depth: 40, height: 50, windows: [], setback: false, tank: false, escape: false };
    renderer.city = [{ district: { id: 'shadow-fixture' }, buildings: Array(5).fill(b) }];
    ctx.fillStyle = PALETTE.smoke;
    ctx.fillRect(0, 0, 1400, 1000);
    const read = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    const streetBefore = read(700, 195);
    renderer._drawDistrictBuildings25D(ctx);
    return { streetBefore, streetAfter: read(700, 195), roof: read(700, 235), front: read(690, 280) };
  });
  expect(mass.streetAfter[0]).toBeLessThan(mass.streetBefore[0]);
  expect(mass.roof[0]).toBeGreaterThan(mass.front[0] + 10);
  await testInfo.attach('map-1600x900', { body: await page.screenshot(), contentType: 'image/png' });
});
