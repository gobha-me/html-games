import { test, expect, startDesk } from './helpers.js';

async function drawerDesk(page, count = 1, { lock = true } = {}) {
  await startDesk(page);
  return page.evaluate(({ count, lock }) => {
    const app = window.lateEditionApp;
    const { sim } = app;
    sim.paused = true;
    for (let i = 0; i < count; i++) sim.completeLeadScoop(sim.leads[0]);
    if (lock) sim.lockUp();
    app._syncFullUI();
    return sim.scoopedStories.map((story) => story.uid);
  }, { count, lock });
}

test('F plates selected copy in Fold, rejects occupied Fold and never opens the drawer', async ({ page }) => {
  const [first, second] = await drawerDesk(page, 2);
  const fold = page.locator('#layout-slots [data-slot-id="above_fold"]');
  await expect(page.locator('#scoop-tray [data-story-uid]').first()).toHaveAttribute('data-story-uid', first);
  await expect(page.locator('#scoop-tray button').first()).toBeFocused();
  await page.keyboard.press('f');
  await expect(fold).toHaveAttribute('data-story-uid', first);
  await expect(page.locator('#drawer-body')).toBeHidden();
  await expect(page.locator('#btn-drawer')).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => window.lateEditionApp.sim.frontPage.above_fold?.uid)).toBe(first);
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => window.lateEditionApp.selectedStoryUid)).toBe(second);
  const before = await page.evaluate(() => window.lateEditionApp.sim.getStateHash());
  await page.keyboard.press('F');
  await expect(page.locator('#layout-status')).toHaveText('Cannot assign: slot-occupied.');
  await expect(fold).toHaveAttribute('data-story-uid', first);
  await expect(page.locator('#scoop-tray button')).toHaveAttribute('data-story-uid', second);
  await expect(page.locator('#drawer-body')).toBeHidden();
  expect(await page.evaluate(() => window.lateEditionApp.sim.getStateHash())).toBe(before);
});

for (const phase of ['desk', 'paste-up']) {
  test(`D toggles the drawer in ${phase}; held D and F cannot leak into other actions`, async ({ page }) => {
    await drawerDesk(page, 1, { lock: phase === 'paste-up' });
    const handle = page.locator('#btn-drawer');
    await expect(handle).toHaveText('FILES [D] · 0/6');
    const before = await page.evaluate(() => window.lateEditionApp.sim.getStateHash());
    await page.keyboard.down('d');
    await expect(page.locator('#drawer-body')).toBeVisible();
    await expect(handle).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.down('d'); // Browser repeat must not immediately close it.
    await page.keyboard.up('d');
    await expect(page.locator('#drawer-body')).toBeVisible();
    await expect(page.locator('#btn-close-drawer')).toBeFocused();
    await page.keyboard.press('f'); // Drawer overlay blocks Fold, too.
    await expect(page.locator('#drawer-body')).toBeVisible();
    expect(await page.evaluate(() => window.lateEditionApp.sim.getStateHash())).toBe(before);
    await page.keyboard.press('D');
    await expect(page.locator('#drawer-body')).toBeHidden();
    await expect(handle).toHaveAttribute('aria-expanded', 'false');
    await expect(handle).toBeFocused();
    expect(await page.evaluate(() => window.lateEditionApp.sim.phase)).toBe(phase);
    expect(await page.evaluate(() => window.lateEditionApp.sim.getStateHash())).toBe(before);
    if (phase === 'desk') {
      await page.keyboard.press('f');
      await expect(page.locator('#drawer-body')).toBeHidden();
      expect(await page.evaluate(() => window.lateEditionApp.sim.getStateHash())).toBe(before);
    }
  });
}

test('spike, open the desk drawer and call a police tip: a high-value lead appears immediately', async ({ page }) => {
  const [uid] = await drawerDesk(page);
  await page.keyboard.press('s');
  await expect(page.locator('#btn-drawer')).toContainText('1/6');
  await page.locator('#btn-drawer').click();
  await expect(page.locator('#drawer-body')).toBeVisible();
  await expect(page.locator('.carbon-dots')).toHaveAttribute('aria-label', '3 nights fresh');
  const before = await page.evaluate(() => window.lateEditionApp.sim.leads.length);
  await page.getByRole('button', { name: 'Favor: police tip', exact: true }).click();
  await expect(page.locator('#lead-list button')).toHaveCount(before + 1);
  await expect(page.locator('#lead-list')).toContainText('POLICE TIP:');
  await expect(page.locator('.dossier')).toHaveCount(0);
  expect(await page.evaluate((uid) => window.lateEditionApp.sim.useFile(uid, 'favor', 'tip').reason, uid)).toBe('unknown-file');
  await expect(page.locator('#btn-close-drawer')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#btn-drawer')).toBeFocused();
});

test('keyboard squeeze preserves control focus through render ticks and never rolls presses', async ({ page }) => {
  await drawerDesk(page);
  await page.keyboard.press('6');
  const before = await page.evaluate(() => window.lateEditionApp.sim.cash);
  await page.keyboard.press('d');
  await expect(page.getByRole('button', { name: 'Favor: police tip', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const cash = page.getByRole('button', { name: 'Squeeze: cash', exact: true });
  await expect(cash).toBeFocused();
  await page.evaluate(() => window.lateEditionApp._syncFullUI());
  await expect(cash).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.lateEditionApp.sim.cash)).toBeGreaterThan(before);
  expect(await page.evaluate(() => window.lateEditionApp.sim.editionsPrinted)).toBe(0);
  await expect(page.locator('#drawer-status')).toContainText('The file has done its work.');
  await page.keyboard.press('d');
  await expect(page.locator('#drawer-body')).toBeHidden();
  await expect(page.locator('#btn-drawer')).toBeFocused();
});

test('full drawer asks which file to burn; keyboard shred makes room for the pending spike', async ({ page }) => {
  const uids = await drawerDesk(page, 7);
  await page.evaluate((uids) => {
    const app = window.lateEditionApp;
    for (const uid of uids.slice(0, 6)) app.sim.spike(uid);
    app.selectedStoryUid = uids[6];
    app._syncFullUI();
  }, uids);
  await page.keyboard.press('s');
  await expect(page.locator('#drawer-status')).toContainText('DRAWER FULL. Choose a file to shred');
  const shred = page.getByRole('button', { name: 'Shred', exact: true }).first();
  await expect(shred).toBeFocused();
  expect(await page.evaluate((uid) => window.lateEditionApp.sim.scoopedStories.some((story) => story.uid === uid), uids[6])).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('.dossier')).toHaveCount(6);
  await expect(page.locator('#scoop-tray [data-story-uid]')).toHaveCount(0);
  expect(await page.evaluate(() => window.lateEditionApp.sim.spikedStories.map((file) => file.uid))).toEqual(uids.slice(1));
  await expect(page.locator('#btn-cancel-burn')).toBeHidden();
});

test('cancel a full drawer spike; expiry and deadline close stale burn selection', async ({ page }) => {
  const uids = await drawerDesk(page, 7);
  await page.evaluate((uids) => {
    const app = window.lateEditionApp;
    for (const uid of uids.slice(0, 6)) app.sim.spike(uid);
    app.selectedStoryUid = uids[6];
    app._syncFullUI();
  }, uids);
  await page.keyboard.press('s');
  await page.getByRole('button', { name: 'Cancel spike', exact: true }).click();
  await expect(page.locator('#drawer-status')).toHaveText('Copy stays on the desk.');
  await page.keyboard.press('Escape');
  await page.keyboard.press('s');
  await expect(page.locator('#btn-cancel-burn')).toBeVisible();
  await page.evaluate(() => {
    const app = window.lateEditionApp;
    app.sim.clockSec = 209.99;
    app.sim.paused = false;
    app.sim.step(0.05);
    app._syncFullUI();
  });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#drawer-body')).toBeHidden();
  const printed = await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    // The real deadline has fired. Freeze subsequent ticks so the hash measures
    // only shortcut leakage, rather than the running clock behind the report.
    sim.paused = true;
    return sim.getStateHash();
  });
  await page.keyboard.press('d');
  await page.keyboard.press('f');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('#drawer-body')).toBeHidden();
  expect(await page.evaluate(() => window.lateEditionApp.sim.getStateHash())).toBe(printed);
  expect(await page.evaluate(() => window.lateEditionApp.pendingSpike)).toBeNull();
  expect(await page.evaluate(() => window.lateEditionApp.sim.spikedStories.length)).toBe(6);
});
