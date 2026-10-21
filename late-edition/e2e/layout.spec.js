import { test, expect, startDesk } from './helpers.js';

// Freeze only the fixture setup, then exercise real keyboard/pointer events.
async function copyDesk(page, { banner = false, lock = true } = {}) {
  await startDesk(page);
  await page.evaluate(({ banner, lock }) => {
    const app = window.lateEditionApp;
    const { sim } = app;
    sim.paused = true;
    for (let i = 0; i < 3; i++) sim.completeLeadScoop(sim.leads[0]);
    if (lock) sim.lockUp();
    if (banner) sim.placeStory(sim.scoopedStories[0].uid, 'banner');
    app._syncFullUI();
  }, { banner, lock });
}

async function dragTo(page, source, destination) {
  await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox();
  const to = await destination.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
}

test('pointer drag plates banner; occupied slot refuses a second galley; spike removes plated copy', async ({ page }) => {
  await copyDesk(page);
  const banner = page.locator('#layout-slots [data-slot-id="banner"]');
  const first = page.locator('#scoop-tray button').first();
  const uid = await first.getAttribute('data-story-uid');
  await dragTo(page, first, banner);
  await expect(page.locator('.drag-copy')).toBeVisible();
  await page.mouse.up();
  await expect(banner).toHaveAttribute('data-story-uid', uid);
  await expect(page.locator('#scoop-tray button')).toHaveCount(2);
  await dragTo(page, page.locator('#scoop-tray button').first(), banner);
  await page.mouse.up();
  await expect(page.locator('#layout-status')).toHaveText('Cannot assign: slot-occupied.');
  await expect(banner).toHaveAttribute('data-story-uid', uid);
  await banner.click();
  await page.keyboard.press('s');
  await expect(banner).toHaveClass(/empty/);
  expect(await page.evaluate(() => window.lateEditionApp.sim.spikedStories.map((s) => s.uid))).toEqual([uid]);
});

test('Tab and arrows select stories; all six destinations and unplace work without assist', async ({ page }) => {
  await copyDesk(page);
  // Entering paste-up focuses its first copy. All subsequent actions use keys.
  await expect(page.locator('#scoop-tray button').first()).toBeFocused();
  await page.keyboard.press('b');
  const banner = page.locator('#layout-slots [data-slot-id="banner"]');
  await expect(banner).not.toHaveClass(/empty/);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('2');
  await expect(page.locator('#layout-slots [data-slot-id="above_fold"]')).not.toHaveClass(/empty/);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('p');
  await expect(page.locator('#layout-slots [data-slot-id="photo_expose"]')).not.toHaveClass(/empty/);
  await page.keyboard.press('u');
  await page.keyboard.press('4');
  await expect(page.locator('#layout-slots [data-slot-id="editorial"]')).not.toHaveClass(/empty/);
  await page.keyboard.press('u');
  await page.keyboard.press('i');
  await expect(page.locator('#inside-stories button')).toHaveCount(1);
  await page.keyboard.press('6');
  await expect(page.locator('#inside-stories button')).toHaveCount(0);
  await expect(page.locator('#spiked-count')).toHaveText('1 SPIKED');
  // Tab into a placed story selects it, without needing Enter or the mouse.
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    if (await banner.evaluate((node) => node === document.activeElement)) break;
  }
  await expect(banner).toBeFocused();
  await page.keyboard.press('u');
  await expect(banner).toHaveClass(/empty/);
  await page.keyboard.press('1');
  await expect(banner).not.toHaveClass(/empty/);
  expect(await page.evaluate(() => window.lateEditionApp.sim.editionLayout.assisted)).toBe(false);
});

test('deadline during pointer drag prints placed copy and cancels the pending drop', async ({ page }) => {
  await copyDesk(page, { banner: true });
  const target = page.locator('#layout-slots [data-slot-id="above_fold"]');
  await dragTo(page, page.locator('#scoop-tray button').first(), target);
  await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    sim.clockSec = 209.99;
    sim.paused = false;
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.mouse.up();
  await expect(page.locator('.drag-copy')).toHaveCount(0);
  const state = await page.evaluate(() => {
    const { sim, drag } = window.lateEditionApp;
    return { count: sim.editionsPrinted, placed: sim.editionSummary.slottedCount,
      banner: sim.lastPrintedFrontPage.banner?.uid, fold: sim.lastPrintedFrontPage.above_fold,
      tray: sim.scoopedStories.length, nextBanner: sim.frontPage.banner, drag };
  });
  expect(state).toMatchObject({ count: 1, placed: 1, fold: null, tray: 2, nextBanner: null, drag: null });
  expect(state.banner).toBeTruthy();
});

test('keyboard assignment at expired deadline cannot alter the published page', async ({ page }) => {
  await copyDesk(page, { banner: true });
  await page.keyboard.press('ArrowDown');
  // Cross the deadline inside this keyboard event, before the app's handler.
  await page.evaluate(() => {
    window.addEventListener('keydown', (event) => {
      if (event.key === 'f') {
        const { sim } = window.lateEditionApp;
        sim.paused = false;
        sim.clockSec = 209.99;
        sim.step(0.05);
      }
    }, { once: true, capture: true });
  });
  await page.keyboard.press('f');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate(() => ({ fold: window.lateEditionApp.sim.lastPrintedFrontPage.above_fold,
    printed: window.lateEditionApp.sim.editionsPrinted }))).toEqual({ fold: null, printed: 1 });
});

test('empty-banner print shows wire stand-in and trust penalty; assist is visibly scored', async ({ page }) => {
  await copyDesk(page);
  await page.keyboard.press('f');
  const projection = await page.evaluate(() => window.lateEditionApp.sim.calculateEditionProjection());
  await page.locator('#btn-roll-press').click();
  await expect(page.getByRole('dialog')).toContainText('WIRE STAND-IN: −6 trust.');
  expect(await page.evaluate(() => window.lateEditionApp.sim.editionSummary.credDelta)).toBe(projection.credDelta);
  await page.keyboard.press('Space');
  await page.keyboard.press('l');
  await expect(page.locator('#layout-slots [data-slot-id="banner"]')).toContainText('WIRE STAND-IN');
  await page.keyboard.press('a');
  await expect(page.locator('#assist-note')).toHaveText('ASSISTED · −500 READERS');
  await page.evaluate(() => { window.lateEditionApp.sim.time += 0.05; });
  await page.locator('#btn-roll-press').click();
  await expect(page.getByRole('dialog')).toContainText('ASSISTED: −500 readers.');
  expect(await page.evaluate(() => window.lateEditionApp.sim.editionSummary.assisted)).toBe(true);
});

test('canceled pointer drag leaves tray and page intact', async ({ page }) => {
  await copyDesk(page);
  await dragTo(page, page.locator('#scoop-tray button').first(), page.locator('#layout-slots [data-slot-id="banner"]'));
  await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointercancel')));
  await page.mouse.up();
  await expect(page.locator('.drag-copy')).toHaveCount(0);
  await expect(page.locator('#scoop-tray button')).toHaveCount(3);
  await expect(page.locator('#layout-slots .paper-slot:not(.empty)')).toHaveCount(0);
});
