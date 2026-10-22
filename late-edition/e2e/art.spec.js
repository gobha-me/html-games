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
        message.text() === 'Failed to load resource: net::ERR_BLOCKED_BY_CLIENT';
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
      // Rotated paper corners extend a few pixels; content must stay in its grid.
      return box.left < parent.left - 10 || box.right > parent.right + 10;
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
  const counts = await page.evaluate(async () => {
    const source = await (await fetch('index.html')).text();
    const doc = new DOMParser().parseFromString(source, 'text/html');
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const labels = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement.closest('script, style') && node.textContent.trim()) labels.push(node.textContent.trim());
    }
    return { nodes: labels.length, words: labels.reduce((sum, label) => sum + label.split(/\s+/).length, 0) };
  });
  await testInfo.attach('caption-counts', { body: JSON.stringify({ baseline, after: counts }, null, 2), contentType: 'application/json' });
  expect(counts.nodes).toBeLessThanOrEqual(baseline.nodes / 2);
  expect(counts.words).toBeLessThanOrEqual(baseline.words / 2);
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
