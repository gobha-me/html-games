import { test as base, expect } from '@playwright/test';

// Check both uncaught exceptions and browser console errors in every scenario.
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    // Legacy remote fonts are outside this issue's art pass. Supply an empty
    // stylesheet so offline CI exercises the real fallback fonts without noise.
    await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({
      contentType: 'text/css', body: '',
    }));
    await page.goto('/late-edition/?seed=83');
    await expect(page.locator('#lead-list button').first()).toBeVisible();
    await use(page);
    expect(errors, 'No console errors or uncaught exceptions').toEqual([]);
  },
});

async function fold(page) {
  await page.evaluate(() => { window.lateEditionApp.sim.credibility = 0; });
  await expect(page.getByRole('heading', { name: 'PAPER FOLDED', exact: true })).toBeVisible();
}

async function expectFreshRun(page, oldSeed) {
  await expect(page.getByRole('dialog')).toBeHidden();
  const state = await page.evaluate(() => {
    const { sim, selectedStoryUid } = window.lateEditionApp;
    return { seed: sim.seed, edition: sim.edition, printed: sim.editionsPrinted,
      trust: sim.credibility, gameOver: sim.gameOver, peak: sim.peakCirculation,
      selectedStoryUid, lastPage: sim.lastPrintedFrontPage };
  });
  expect(state.seed).not.toBe(oldSeed);
  expect(state).toMatchObject({ edition: 1, printed: 0, trust: 74, gameOver: false,
    peak: 18400, selectedStoryUid: null, lastPage: null });
  await page.locator('#lead-list button').first().click();
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.sim.operatives[0].targetLeadId)).not.toBeNull();
}

test('trust collapse shows the final paste-up, reason and run statistics; pointer restart', async ({ page }) => {
  const headline = 'NIGHT DESK TEST EXCLUSIVE';
  await page.evaluate((headline) => {
    const { sim } = window.lateEditionApp;
    sim.frontPage.banner = { uid: 'final-copy', beat: 'CRIME', headline,
      subdeck: 'Last dispatch before the presses stopped.', baseValue: 100,
      credibility: 2, heat: 0, photoVerified: false };
    sim.peakCirculation = 25000;
    sim.highCirculation = 99000; // Saved best must not masquerade as this run.
    window.lateEditionApp.selectedStoryUid = 'stale-selection';
  }, headline);
  await fold(page);
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('PUBLIC TRUST COLLAPSED');
  await expect(modal).toContainText('EDITION REACHED#1');
  await expect(modal).toContainText('PEAK CIRCULATION25,000');
  await expect(page.getByRole('region', { name: 'Final front page' })).toContainText(headline);
  await expect(page.locator('#final-layout-slots .paper-slot')).toHaveCount(4);
  const restart = page.getByRole('button', { name: 'Start a new night shift', exact: true });
  await expect(restart).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(restart).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(restart).toBeFocused();
  await restart.click();
  await expectFreshRun(page, 83);
});

test('folding over an edition report preserves the last printed page', async ({ page }) => {
  await page.evaluate(() => {
    const app = window.lateEditionApp;
    app.sim.frontPage.banner = { uid: 'printed-final', beat: 'CRIME',
      headline: 'FINAL PRINTED EXCLUSIVE', subdeck: 'Filed before midnight.',
      baseValue: 100, credibility: 2, heat: 0 };
    app.sim.publishEdition();
    app._syncFullUI();
  });
  await expect(page.getByRole('dialog')).toContainText('EDITION #1 HITS THE STREETS');
  await fold(page);
  await expect(page.locator('#final-front-page')).toContainText('FINAL PRINTED EXCLUSIVE');
  await expect(page.getByRole('dialog')).toContainText('EDITION REACHED#2');
  await page.getByRole('button', { name: 'Start a new night shift', exact: true }).click();
  await expectFreshRun(page, 83);
});

test('press destruction opens the end screen without a publication report', async ({ page }) => {
  await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    sim.pressHp = 0.01;
    sim.rivals = [{ id: 'fatal-saboteur', type: 'goon', hp: 100,
      x: sim.hq.x + sim.hq.w / 2, y: sim.hq.y + sim.hq.h / 2,
      stunTimer: 0, speed: 0, angle: 0 }];
  });
  await expect(page.getByRole('heading', { name: 'PAPER FOLDED', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('ROTARY PRESS DESTROYED');
  expect(await page.evaluate(() => window.lateEditionApp.sim.editionSummary)).toBeNull();
});

for (const key of ['Space', 'Enter']) {
  test(`${key} on the end screen restarts once without rolling presses`, async ({ page }) => {
    await fold(page);
    const oldSeed = await page.evaluate(() => window.lateEditionApp.sim.seed);
    await page.keyboard.down(key);
    const newSeed = await page.evaluate(() => window.lateEditionApp.sim.seed);
    // A held key repeats after the modal closes; it must not print or reset again.
    await page.keyboard.down(key);
    await page.keyboard.up(key);
    expect(await page.evaluate(() => window.lateEditionApp.sim.seed)).toBe(newSeed);
    await expectFreshRun(page, oldSeed);
  });
}

test('100 live lead clicks produce exactly 100 successful dispatches', async ({ page }) => {
  await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    const dispatch = sim.dispatchOperativeToLead.bind(sim);
    window.dispatchAudit = { attempts: 0, successes: 0, started: sim.time };
    sim.dispatchOperativeToLead = (...args) => {
      window.dispatchAudit.attempts++;
      const result = dispatch(...args);
      if (result) window.dispatchAudit.successes++;
      return result;
    };
  });
  // Real pointer input, not DOM click(): each iteration uses a current live lead.
  for (let i = 0; i < 100; i++) await page.locator('#lead-list button').first().click();
  const audit = await page.evaluate(() => ({ ...window.dispatchAudit,
    ended: window.lateEditionApp.sim.time, over: window.lateEditionApp.sim.gameOver }));
  expect(audit).toMatchObject({ attempts: 100, successes: 100, over: false });
  expect(audit.ended).toBeGreaterThan(audit.started);
});

test('pointer held across changed ticks retains its node, focus, hover and dispatch', async ({ page }) => {
  const lead = page.locator('#lead-list button').first();
  const handle = await lead.elementHandle();
  const box = await lead.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(lead).toBeFocused();
  await page.evaluate(() => {
    const app = window.lateEditionApp;
    const first = app.sim.leads[0];
    first.timeLeft -= 3;
    first.progress += 1;
    // Replace another lead while the pointer is down without adding a grid row;
    // a taller bottom-anchored stack would physically move the pressed target.
    app.sim.leads.pop();
    app.sim.spawnLead();
    app._syncFullUI();
  });
  await expect(lead.locator('.progress-track').first()).toHaveAttribute('title', 'Investigation 1%');
  await page.waitForTimeout(600); // Intentionally spans multiple real 250 ms ticks.
  expect(await handle.evaluate((node) => node === document.querySelector('#lead-list button') && node.isConnected && node.matches(':hover'))).toBe(true);
  await expect(lead).toBeFocused();
  await page.mouse.up();
  const uid = await lead.getAttribute('data-lead-id');
  expect(await page.evaluate(() => window.lateEditionApp.sim.operatives[0].targetLeadId)).toBe(uid);
});

async function tabTo(page, selector) {
  // All navigation is real keyboard input; no locator.focus(), mouse or sim input.
  for (let i = 0; i < 45; i++) {
    await page.keyboard.press('Tab');
    if (await page.locator(selector).evaluate((node) => node === document.activeElement)) return;
  }
  throw new Error(`Could not reach ${selector} using Tab`);
}

test('keyboard-only dispatch, plating, press run and next edition; resize mid-edition', async ({ page }) => {
  await page.keyboard.press('1');
  await tabTo(page, '#lead-list button:first-child');
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.lateEditionApp.sim.editionsPrinted)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.sim.operatives[0].targetLeadId)).not.toBeNull();
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.locator('#lead-list button').first()).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.sim.scoopsTotal), { timeout: 25000 }).toBeGreaterThan(0);
  await expect(page.locator('#layout-slots .paper-slot:not(.empty)')).not.toHaveCount(0);
  await page.keyboard.press('a');
  await tabTo(page, '#btn-roll-press');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'EXTRA! EXTRA! EDITION #1 HITS THE STREETS', exact: true })).toBeVisible();
  await page.keyboard.press('Space');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('#hud-edition')).toHaveText('#2');
  expect(await page.evaluate(() => window.lateEditionApp.sim.editionsPrinted)).toBe(1);
});

test('stable keyed rows, changing rankings and hostile copy never become markup', async ({ page }) => {
  expect(await page.evaluate(() => {
    const app = window.lateEditionApp;
    const containers = ['lead-list', 'operative-list', 'scoop-tray', 'wire-log', 'layout-slots', 'rival-standings'];
    const rows = containers.map((id) => Array.from(document.getElementById(id).children));
    const observer = new MutationObserver(() => {});
    for (const id of containers) observer.observe(document.getElementById(id), { childList: true, subtree: true });
    app._syncFullUI();
    const mutations = observer.takeRecords();
    observer.disconnect();
    return mutations.length === 0 && containers.every((id, i) => rows[i].every((node, j) => node === document.getElementById(id).children[j]));
  })).toBe(true);
  const hostile = '<img src=x onerror="window.injected=true">';
  await page.evaluate((hostile) => {
    const app = window.lateEditionApp;
    app.sim.leads[0].headline = hostile;
    app.sim.logWire(hostile);
    const story = { uid: 'hostile-copy', headline: hostile, subdeck: hostile,
      beat: 'CRIME', baseValue: 100, credibility: 2, heat: 0 };
    app.sim.scoopedStories.push(story);
    app.sim.frontPage.banner = { ...story, uid: 'hostile-banner' };
    app.sim.rivalStandings[0].circulation = 200000;
    app._syncFullUI();
  }, hostile);
  for (const selector of ['#lead-list', '#wire-log', '#scoop-tray', '#layout-slots']) {
    await expect(page.locator(selector)).toContainText(hostile);
    await expect(page.locator(`${selector} img[src="x"]`)).toHaveCount(0);
  }
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.locator('#rival-standings > :first-child')).not.toHaveAttribute('data-paper-id', 'player');
  // Removing a stale lead must not leave a delegated ghost action behind.
  const removed = await page.locator('#lead-list button').first().elementHandle();
  await page.evaluate(() => {
    const app = window.lateEditionApp;
    app.sim.leads.shift();
    app._syncFullUI();
  });
  expect(await removed.evaluate((node) => node.isConnected)).toBe(false);
});

test('expiring the preceding lead does not detach the focused surviving lead', async ({ page }) => {
  await tabTo(page, '#lead-list button:nth-child(2)');
  const survivor = await page.locator('#lead-list button').nth(1).elementHandle();
  const removedSurvivor = await page.evaluate(() => {
    const app = window.lateEditionApp;
    const container = document.getElementById('lead-list');
    const node = container.children[1];
    const observer = new MutationObserver(() => {});
    observer.observe(container, { childList: true });
    app.sim.leads.shift();
    app._syncFullUI();
    const removed = observer.takeRecords().some((record) => Array.from(record.removedNodes).includes(node));
    observer.disconnect();
    return removed;
  });
  expect(removedSurvivor).toBe(false);
  expect(await survivor.evaluate((node) => node.isConnected && node === document.activeElement)).toBe(true);
  await page.keyboard.press('Enter');
  const uid = await survivor.getAttribute('data-lead-id');
  expect(await page.evaluate(() => window.lateEditionApp.sim.operatives[0].targetLeadId)).toBe(uid);
});
