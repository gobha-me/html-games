import { test, expect, startDesk, skipColdOpen } from './helpers.js';

async function clockState(page) {
  return page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    return { time: sim.time, clock: sim.clockSec, phase: sim.phase,
      leads: sim.leads.map((lead) => ({ uid: lead.uid, life: lead.timeLeft })) };
  });
}

test('title is idle, shows saved best, Enter rings Lou; skip mid-line is final', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('lateEdition.bestCirculation.v2', '47000'));
  await page.reload();
  await expect(page.locator('#title-best')).toContainText('47,000');
  const titleState = await clockState(page);
  await page.keyboard.press('Space');
  await page.keyboard.press('q');
  await page.waitForTimeout(400);
  expect(await clockState(page)).toEqual(titleState);
  await page.keyboard.press('Enter');
  await expect(page.locator('#cold-open')).toBeVisible();
  await expect(page.locator('#btn-skip-intro')).toBeFocused();
  await expect.poll(() => page.locator('#lou-lines p').first().textContent()).not.toBe('');
  const line = await page.locator('#lou-lines p').first().textContent();
  expect(line.length).toBeLessThan(67); // A real mid-line skip, not the completed line.
  await page.keyboard.press('Escape');
  await expect(page.locator('#cold-open')).toBeHidden();
  const state = await clockState(page);
  expect(state).toMatchObject({ time: 0, clock: 0, phase: 'desk' });
  await page.waitForTimeout(500);
  expect(await clockState(page)).toEqual(state);
  await expect(page.locator('#cold-open')).toBeHidden();
  await expect(page.locator('#btn-roll-press')).toBeDisabled();
});

test('first click with no operative selected dispatches Jack and starts the clock', async ({ page }) => {
  await startDesk(page, { dispatch: false });
  await page.evaluate(() => { window.lateEditionApp.sim.selectedOpId = null; });
  const lead = page.locator('#lead-list button').first();
  const uid = await lead.getAttribute('data-lead-id');
  await lead.click();
  expect(await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    return { selected: sim.selectedOpId, target: sim.operatives[0].targetLeadId,
      awaiting: sim.awaitingFirstDispatch };
  })).toEqual({ selected: 'rep_1', target: uid, awaiting: false });
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.sim.clockSec)).toBeGreaterThan(0);
  await expect(page.locator('#btn-roll-press')).toBeEnabled();
});

test('reload during Lou’s call returns to an idle title with a clean opening', async ({ page }) => {
  await page.locator('#btn-start-shift').click();
  await expect.poll(() => page.locator('#lou-lines p').first().textContent()).not.toBe('');
  await page.reload();
  await expect(page.locator('#title-screen')).toBeVisible();
  await expect(page.locator('#cold-open')).toBeHidden();
  expect(await clockState(page)).toMatchObject({ time: 0, clock: 0, phase: 'title' });
  await page.locator('#btn-start-shift').click();
  expect(await page.evaluate(() => window.lateEditionApp.coldOpen.elapsed)).toBeLessThan(1);
  await skipColdOpen(page);
  await page.waitForTimeout(350);
  expect(await clockState(page)).toMatchObject({ time: 0, clock: 0, phase: 'desk' });
});

test('unskipped cold open lasts 30 seconds without starting the edition clock', async ({ page }) => {
  await page.clock.install();
  await page.locator('#btn-start-shift').click();
  await page.clock.runFor(29000);
  await expect(page.locator('#cold-open')).toBeVisible();
  await page.clock.runFor(1300);
  await expect(page.locator('#cold-open')).toBeHidden();
  expect(await clockState(page)).toMatchObject({ time: 0, clock: 0, phase: 'desk' });
});

test('night-one locked shortcuts do nothing; every later payroll unlock is visible', async ({ page }) => {
  await startDesk(page, { dispatch: false });
  await expect(page.locator('#operative-list .op-card')).toHaveCount(2);
  const before = await page.evaluate(() => window.lateEditionApp.sim.getStateHash());
  for (const key of ['3', '4', 'q', 'w', 'e', 't', 'y', 'n']) await page.keyboard.press(key);
  expect(await page.evaluate(() => window.lateEditionApp.sim.getStateHash())).toBe(before);
  for (const id of ['wiretap', 'bribe', 'fortify', 'phone']) await expect(page.locator(`#act-${id}`)).toBeHidden();
  await page.locator('#lead-list button').first().click();
  for (const [night, count] of [[2, 3], [3, 4], [4, 4]]) {
    await page.locator('#btn-roll-press').click();
    await page.locator('#btn-modal-continue').click();
    await expect(page.locator('#hud-edition')).toHaveText(`#${night}`);
    await expect(page.locator('#operative-list .op-card')).toHaveCount(count);
    if (night >= 3) await expect(page.locator('#act-fortify')).toBeVisible();
    else await expect(page.locator('#act-fortify')).toBeHidden();
    for (const id of ['wiretap', 'bribe', 'phone']) {
      if (night === 4) await expect(page.locator(`#act-${id}`)).toBeVisible();
      else await expect(page.locator(`#act-${id}`)).toBeHidden();
    }
  }
  await page.keyboard.press('3');
  expect(await page.evaluate(() => window.lateEditionApp.sim.selectedOpId)).toBe('photog_1');
  await page.keyboard.press('4');
  expect(await page.evaluate(() => window.lateEditionApp.sim.selectedOpId)).toBe('fixer_1');
});

for (const size of [{ width: 1279, height: 720 }, { width: 1280, height: 719 }]) {
  test(`${size.width}x${size.height} shows the small-desk card and restores active play`, async ({ page }) => {
    await startDesk(page);
    await expect.poll(() => page.evaluate(() => window.lateEditionApp.sim.time)).toBeGreaterThan(0);
    await page.setViewportSize(size);
    await expect(page.locator('#desk-too-small')).toBeVisible();
    await expect(page.locator('#desk-too-small')).toContainText('at least 1280x720');
    const stopped = await clockState(page);
    for (const key of ['Space', '1', 'p']) await page.keyboard.press(key);
    await page.waitForTimeout(400);
    expect(await clockState(page)).toEqual(stopped);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('#desk-too-small')).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.lateEditionApp.sim.time)).toBeGreaterThan(stopped.time);
    expect(await page.evaluate(() => window.lateEditionApp.sim.edition)).toBe(1);
  });
}

test('1280x720 fits; shrinking during the call preserves its line and user pause', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('#desk-too-small')).toBeHidden();
  await page.locator('#btn-start-shift').click();
  await page.setViewportSize({ width: 1280, height: 719 });
  await expect(page.locator('#desk-too-small')).toBeVisible();
  const elapsed = await page.evaluate(() => window.lateEditionApp.coldOpen.elapsed);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.lateEditionApp.coldOpen.elapsed)).toBe(elapsed);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.lateEditionApp.sim.phase)).toBe('cold-open');
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('#cold-open')).toBeVisible();
  await skipColdOpen(page);
  await page.locator('#lead-list button').first().click();
  await page.keyboard.press('p');
  await page.setViewportSize({ width: 1279, height: 720 });
  await expect(page.locator('#desk-too-small')).toBeVisible();
  const paused = await clockState(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(350);
  expect(await clockState(page)).toEqual(paused);
  expect(await page.evaluate(() => window.lateEditionApp.sim.paused)).toBe(true);
});

test('reduced motion freezes rain, disables phone shake and reveals dialogue immediately', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('#title-screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.titleRenderer.reducedMotion)).toBe(true);
  const rain = await page.evaluate(() => structuredClone(window.lateEditionApp.titleRenderer.rain));
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.lateEditionApp.titleRenderer.rain)).toEqual(rain);
  await page.locator('#btn-start-shift').click();
  await expect(page.locator('#lou-lines')).toContainText('Make it count.');
  expect(await page.locator('.opening-phone').evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.coldOpen.reducedMotion)).toBe(false);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await skipColdOpen(page);
  const cityRain = await page.evaluate(() => structuredClone(window.lateEditionApp.renderer.rain));
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => window.lateEditionApp.renderer.rain)).toEqual(cityRain);
});


test('loading at an undersized desk holds the title until the window fits', async ({ page }) => {
  await page.setViewportSize({ width: 1279, height: 720 });
  await page.reload();
  await expect(page.locator('#desk-too-small')).toBeVisible();
  await expect(page.locator('#title-screen')).toBeHidden();
  const stopped = await clockState(page);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(350);
  expect(await clockState(page)).toEqual(stopped);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('#title-screen')).toBeVisible();
  await expect(page.locator('#desk-too-small')).toBeHidden();
  expect(await clockState(page)).toMatchObject({ phase: 'title', time: 0, clock: 0 });
});

test('a covered edition report restores its action and focus after resizing', async ({ page }) => {
  await startDesk(page);
  await page.locator('#btn-roll-press').click();
  const action = page.locator('#btn-modal-continue');
  await expect(action).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 719 });
  await expect(page.locator('#desk-too-small')).toBeVisible();
  const state = await clockState(page);
  await page.keyboard.press('Space');
  await page.waitForTimeout(350);
  expect(await clockState(page)).toEqual(state);
  expect(await page.evaluate(() => window.lateEditionApp.sim.editionSummary.edition)).toBe(1);
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('#desk-too-small')).toBeHidden();
  await expect(action).toBeFocused();
  await action.click();
  await expect(page.locator('#edition-modal')).toBeHidden();
  await expect(page.locator('#hud-edition')).toHaveText('#2');
});
