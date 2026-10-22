import { test as base, expect } from '@playwright/test';
import { startDesk } from './helpers.js';
import { readFileSync } from 'node:fs';

// No pre-navigation route can conceal an external request: log before goto,
// including failed/blocked requests, and attach the complete log on every test.
const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const log = [];
    const errors = [];
    page.on('request', (request) => log.push({ url: request.url(), type: request.resourceType() }));
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      // These scenarios deliberately abort font requests; only that exact,
      // expected browser diagnostic is exempt from the console-error guard.
      const expectedFontFailure = testInfo.title.startsWith('blocked fonts') &&
        /^Failed to load resource: net::ERR_BLOCKED_BY_CLIENT(?:\.Inspector)?$/.test(message.text());
      if (!expectedFontFailure) errors.push(message.text());
    });
    await use(page);
    await testInfo.attach('network-log', { body: JSON.stringify(log, null, 2), contentType: 'application/json' });
    expect(log.filter(({ url }) => new URL(url).origin !== 'http://127.0.0.1:8123')).toEqual([]);
    expect(errors).toEqual([]);
  },
});

async function assertPaperFits(page) {
  const dimensions = await page.locator('#layout-slots').evaluate((slots) => ({
    client: slots.clientWidth, scroll: slots.scrollWidth,
    pageWidth: document.documentElement.clientWidth, pageScroll: document.documentElement.scrollWidth,
    escaped: [...slots.children].filter((card) => {
      const box = card.getBoundingClientRect();
      const parent = slots.getBoundingClientRect();
      // The zoom fallback can scroll the document, but each slot must retain
      // real height and remain inside the paper grid (never collapse to zero).
      const scale = parent.height / slots.offsetHeight;
      return box.height < 80 || box.left < parent.left - 10 || box.right > parent.right + 10 ||
        box.top + slots.scrollTop * scale < parent.top - 10 ||
        box.bottom + slots.scrollTop * scale > parent.top + slots.scrollHeight * scale + 10;
    }).length,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 3);
  expect(dimensions.pageScroll).toBeLessThanOrEqual(dimensions.pageWidth + 3);
  expect(dimensions.escaped).toBe(0);
}

for (const viewport of [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }]) {
  test(`local fonts, zero external requests and readable paper at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/late-edition/?seed=88');
    await startDesk(page);
    await page.evaluate(async () => {
      await Promise.all(['League Gothic', 'Old Standard TT', 'Courier Prime', 'UnifrakturMaguntia']
        .map((family) => document.fonts.load(`16px "${family}"`)));
      await document.fonts.ready;
    });
    const loaded = await page.evaluate(() => [...document.fonts].filter((face) => face.status === 'loaded').map((face) => face.family));
    expect(new Set(loaded)).toEqual(new Set(['League Gothic', 'Old Standard TT', 'Courier Prime', 'UnifrakturMaguntia']));
    await assertPaperFits(page);
    expect(await page.locator('.slot-body-copy').first().evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(14);
    await page.locator('#btn-lock-page').click();
    await expect(page.locator('#pasteup-controls')).toBeVisible();
    await assertPaperFits(page);
    await page.locator('#btn-roll-press').click();
    await expect(page.locator('#edition-modal')).toBeVisible();
  });
}

async function assertMasthead(page, selector) {
  const masthead = page.locator(selector);
  await expect(masthead).toHaveText('The Evening Star');
  await expect(masthead).toHaveAccessibleName('The Evening Star');
  const metrics = await masthead.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      height: node.getBoundingClientRect().height,
      lineHeight: parseFloat(style.lineHeight),
      transform: style.textTransform,
      width: node.clientWidth,
      contentWidth: node.scrollWidth,
    };
  });
  expect(metrics.transform).toBe('none');
  expect(metrics.height).toBeLessThan(1.6 * metrics.lineHeight);
  expect(metrics.contentWidth).toBeLessThanOrEqual(metrics.width);
}

// Read geometry without scrolling: every slot and all headline text must fit
// simultaneously, even when a full tray and long verified copy compete for space.
async function assertWholePageVisible(page) {
  await expect(page.locator('#drawer-body')).toBeHidden();
  await expect(page.locator('#layout-slots .paper-slot')).toHaveCount(4);
  const geometry = await page.locator('#layout-slots').evaluate((grid) => {
    const paper = grid.closest('.broadsheet-paper');
    const tray = document.querySelector('.pasteup-scoop-strip').getBoundingClientRect();
    const rect = (node) => {
      const { left, right, top, bottom } = node.getBoundingClientRect();
      return { left, right, top, bottom };
    };
    return {
      grid: { client: grid.clientHeight, scroll: grid.scrollHeight, top: grid.scrollTop },
      paper: { client: paper.clientHeight, scroll: paper.scrollHeight, top: paper.scrollTop },
      slots: [...grid.children].map((node) => {
        const box = rect(node);
        const headline = node.querySelector('.slot-headline');
        const range = document.createRange();
        range.selectNodeContents(headline);
        const clips = [rect(grid), rect(paper), box, { left: 0, top: 0, right: innerWidth, bottom: innerHeight }];
        return {
          id: node.dataset.slotId, box,
          inside: clips.every((clip) => box.left >= clip.left - 1 && box.right <= clip.right + 1 &&
            box.top >= clip.top - 1 && box.bottom <= clip.bottom + 1),
          headlineClipped: [...range.getClientRects()].some((line) => clips.some((clip) =>
            line.left < clip.left - 1 || line.right > clip.right + 1 ||
            line.top < clip.top - 1 || line.bottom > clip.bottom + 1)),
          intersectsTray: box.left < tray.right && box.right > tray.left && box.top < tray.bottom && box.bottom > tray.top,
          overflow: node.scrollHeight > node.clientHeight,
        };
      }),
    };
  });
  for (const container of [geometry.grid, geometry.paper]) {
    expect(container.scroll, JSON.stringify(geometry)).toBeLessThanOrEqual(container.client);
    expect(container.top).toBe(0);
  }
  for (const slot of geometry.slots) {
    expect(slot.inside, JSON.stringify(slot)).toBe(true);
    expect(slot.headlineClipped, JSON.stringify(slot)).toBe(false);
    expect(slot.intersectsTray, JSON.stringify(slot)).toBe(false);
    expect(slot.overflow, JSON.stringify(slot)).toBe(false);
  }
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1600, height: 900 },
  { width: 1920, height: 1080 },
]) {
  test(`whole page visible without scrolling and single-line mastheads at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/late-edition/?seed=88');
    await page.evaluate(() => document.fonts.ready);
    await assertMasthead(page, '#title-masthead');
    await startDesk(page);
    await assertMasthead(page, '.masthead-title-block h2');
    await page.evaluate(() => {
      const app = window.lateEditionApp;
      const { sim } = app;
      sim.paused = true;
      sim.edition = 4; // Include the unlocked photo plate and all desk controls.
      for (let i = 0; i < 12; i++) sim.completeLeadScoop(sim.leads[0]);
      app._syncFullUI();
    });
    await expect(page.locator('#scoop-tray button')).toHaveCount(12);
    await assertWholePageVisible(page);
    await page.locator('#btn-lock-page').click();
    await expect(page.locator('#pasteup-controls')).toBeVisible();
    await assertMasthead(page, '.masthead-title-block h2');
    await assertWholePageVisible(page);
    // A full tray, photo plate, series stamps and long copy force the overflow
    // path that a mostly empty first-night page would fail to exercise.
    await page.evaluate(() => {
      const app = window.lateEditionApp;
      const { sim } = app;
      for (const slotId of ['banner', 'above_fold', 'photo_expose', 'editorial']) {
        const story = sim.scoopedStories[0];
        story.headline = 'CITY COUNCIL DEMANDS FULL INQUIRY INTO MISSING HARBOR CONTRACTS AND SECRET PAYMENTS';
        story.subdeck = 'Witnesses demand a public hearing as auditors examine the missing municipal records.';
        story.seriesBadge = 'HARBOR INQUIRY';
        story.arcPart = 3;
        sim.placeStory(story.uid, slotId);
      }
      app._syncFullUI();
    });
    await expect(page.locator('#layout-slots [data-story-uid]')).toHaveCount(4);
    await assertWholePageVisible(page);
    await page.evaluate(() => {
      window.lateEditionApp.sim.phase = 'desk';
      window.lateEditionApp._syncFullUI();
    });
    await assertWholePageVisible(page);
    const excerpts = await page.locator('#layout-slots .slot-body-copy').evaluateAll((nodes) => nodes.map((node) => ({
      height: node.clientHeight,
      fullHeight: node.scrollHeight,
      lineHeight: parseFloat(getComputedStyle(node).lineHeight),
    })));
    expect(excerpts.some(({ height, fullHeight }) => fullHeight > height)).toBe(true);
    for (const { height, lineHeight } of excerpts) expect(height).toBeLessThanOrEqual(lineHeight * 2 + 1);
  });
}

for (const zoom of [1, 2]) {
  test(`blocked fonts keep layout and core actions at ${zoom * 100}% zoom`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    const blocked = [];
    await page.route('**/assets/fonts/*.woff2', (route) => {
      blocked.push(route.request().url());
      return route.abort('blockedbyclient');
    });
    await page.goto('/late-edition/?seed=88');
    // CSS zoom magnifies AND reflows layout. CDP pageScaleFactor alone is pinch
    // zoom and would miss overflowing tracks and inaccessible buttons.
    await page.evaluate((zoom) => { document.documentElement.style.zoom = String(zoom); }, zoom);
    await page.evaluate(() => document.fonts.ready);
    expect(blocked.length).toBeGreaterThanOrEqual(4);
    expect(await page.evaluate(() => [...document.fonts].some((face) => face.status === 'loaded'))).toBe(false);
    await startDesk(page);
    await assertPaperFits(page);
    await page.evaluate(() => {
      const { sim } = window.lateEditionApp;
      sim.paused = true;
      sim.completeLeadScoop(sim.leads[0]);
      window.lateEditionApp._syncFullUI();
    });
    await page.locator('#btn-lock-page').click();
    await page.keyboard.press('b');
    await expect(page.locator('#layout-slots [data-slot-id="banner"]')).toHaveAttribute('data-story-uid');
    await assertPaperFits(page);
    await page.locator('#btn-drawer').click();
    await expect(page.locator('#drawer-body')).toBeVisible();
    await page.locator('#btn-close-drawer').click();
    await page.locator('#btn-roll-press').click();
    await page.locator('#btn-modal-continue').click();
    await expect(page.locator('#hud-edition')).toHaveText('#2');
  });
}

test('static caption text nodes and words are each cut at least in half', async ({ page }, testInfo) => {
  const baseline = JSON.parse(readFileSync(new URL('../tests/fixtures/caption-baseline.json', import.meta.url), 'utf8'));
  await page.goto('/late-edition/');
  const counts = await page.evaluate(async (dynamicIds) => {
    const source = await (await fetch('index.html')).text();
    const doc = new DOMParser().parseFromString(source, 'text/html');
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const labels = [], soundLabels = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const dynamic = dynamicIds.some((id) => node.parentElement.closest(`[id="${id}"]`));
      if (!dynamic && !node.parentElement.closest('script, style') && node.textContent.trim()) {
        // #90 adds three mixer controls and a press report absent from the
        // pre-#88 fixture. Budget those additions separately; retain the original
        // 50% caption reduction gate on every pre-existing desk surface.
        const sound = node.parentElement.closest('.sound-mixer, #press-show, #morning-after');
        (sound ? soundLabels : labels).push(node.textContent.trim());
      }
    }
    return { nodes: labels.length, words: labels.reduce((sum, label) => sum + label.split(/\s+/).length, 0),
      soundNodes: soundLabels.length, soundWords: soundLabels.reduce((sum, label) => sum + label.split(/\s+/).length, 0) };
  }, baseline.dynamicIds);
  await testInfo.attach('caption-counts', { body: JSON.stringify({ baseline, after: counts }, null, 2), contentType: 'application/json' });
  expect(counts.nodes).toBeLessThanOrEqual(baseline.nodes / 2);
  expect(counts.words).toBeLessThanOrEqual(baseline.words / 2);
  expect(counts.soundNodes).toBeLessThanOrEqual(11);
  expect(counts.soundWords).toBeLessThanOrEqual(24);
});

test('reduced motion disables paper, stamps and phone, while sodium focus remains', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/late-edition/?preview=showcase');
  for (const selector of ['.paper-slot', '.galley-stamp', '.series-stamp', '.rotary-bell']) {
    const locator = page.locator(selector).first();
    if (await locator.count()) expect(await locator.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  }
  await page.locator('#btn-roll-press').focus();
  expect(await page.locator('#btn-roll-press').evaluate((node) => getComputedStyle(node).outlineColor)).toBe('rgb(232, 162, 58)');
});

test('browser zoom viewport geometry keeps the physical desk open and controls reachable', async ({ page }) => {
  // Model browser chrome at 1280 physical px while page zoom halves the CSS
  // viewport. This complements CSS zoom's actual magnification/reflow case.
  await page.addInitScript(() => Object.defineProperty(window, 'outerWidth', { get: () => 1280 }));
  await page.setViewportSize({ width: 640, height: 360 });
  await page.goto('/late-edition/?seed=88');
  await expect(page.locator('#desk-too-small')).toBeHidden();
  await startDesk(page);
  await assertPaperFits(page);
  await page.locator('#btn-lock-page').click();
  await page.locator('#btn-roll-press').click();
  await page.locator('#btn-modal-continue').click();
  await expect(page.locator('#hud-edition')).toHaveText('#2');
});
