import { test, expect, startDesk } from './helpers.js';

const RUN_KEY = 'lateEdition.run';

async function printFirstEdition(page) {
  await startDesk(page);
  const uid = await page.evaluate(() => {
    const app = window.lateEditionApp;
    const { sim } = app;
    sim.paused = true;
    sim.completeLeadScoop(sim.leads[0]);
    sim.completeLeadScoop(sim.leads[0]);
    sim.lockUp();
    const uid = sim.scoopedStories[0].uid;
    sim.spike(uid);
    sim.placeStory(sim.scoopedStories[0].uid, 'banner');
    app._syncFullUI();
    return uid;
  });
  await page.locator('#btn-roll-press').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), RUN_KEY)).toBeNull();
  return uid;
}

async function savedTitle(page) {
  const uid = await printFirstEdition(page);
  await page.locator('#btn-modal-continue').click();
  const json = await page.evaluate((key) => localStorage.getItem(key), RUN_KEY);
  expect(JSON.parse(json)).toMatchObject({ format: 'late-edition-save', version: 1 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue the run (Edition 2)', exact: true })).toBeVisible();
  return { json, uid };
}

test('dismiss report, reload and Continue edition 2 with exactly the same drawer and state', async ({ page }) => {
  const { json, uid } = await savedTitle(page);
  const hash = await page.evaluate(() => window.lateEditionApp.savedRun.getStateHash());
  // Keyboard activation must choose Continue without opening overwrite confirmation.
  await page.locator('#btn-continue-run').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#title-screen')).toBeHidden();
  await expect(page.locator('#cold-open')).toBeHidden();
  expect(await page.evaluate(() => window.lateEditionApp.sim.banner.title)).toBe('EDITION #2 // NIGHT DESK REOPENED');
  expect(await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    return { edition: sim.edition, hash: sim.getStateHash(), uid: sim.spikedStories[0].uid,
      freshness: sim.spikedStories[0].freshness };
  })).toEqual({ edition: 2, hash, uid, freshness: 2 });
  expect(await page.evaluate((key) => localStorage.getItem(key), RUN_KEY)).toBe(json);
  await page.locator('#btn-drawer').click();
  await expect(page.locator('.dossier')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Favor: police tip', exact: true })).toBeVisible();
});

test('report and mid-edition unload never write; boundary unload writes through the adapter', async ({ page }) => {
  await printFirstEdition(page);
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload')));
  expect(await page.evaluate((key) => localStorage.getItem(key), RUN_KEY)).toBeNull();
  await page.locator('#btn-modal-continue').click();
  const first = await page.evaluate((key) => localStorage.getItem(key), RUN_KEY);
  await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    sim.cash += 1;
    window.dispatchEvent(new Event('beforeunload'));
  });
  const boundary = await page.evaluate((key) => localStorage.getItem(key), RUN_KEY);
  expect(JSON.parse(boundary).state.cash).toBe(JSON.parse(first).state.cash + 1);
  await page.evaluate(() => {
    const { sim } = window.lateEditionApp;
    sim.paused = false;
    sim.step(0.05);
    sim.paused = true;
    sim.cash += 999;
    window.dispatchEvent(new Event('beforeunload'));
  });
  expect(await page.evaluate((key) => localStorage.getItem(key), RUN_KEY)).toBe(boundary);
  await page.reload();
  await page.locator('#btn-continue-run').click();
  expect(await page.evaluate(() => window.lateEditionApp.sim.cash)).toBe(JSON.parse(boundary).state.cash);
});

test('New run requires overwrite confirmation; cancel keeps Continue and the saved run', async ({ page }) => {
  const { json } = await savedTitle(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'New run', exact: true }).click();
  await expect(page.locator('#title-screen')).toBeVisible();
  await expect(page.locator('#btn-continue-run')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), RUN_KEY)).toBe(json);
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#btn-start-shift').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#cold-open')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), RUN_KEY)).toBeNull();
  expect(await page.evaluate(() => window.lateEditionApp.sim.edition)).toBe(1);
});

for (const [name, json, notice] of [
  ['truncated', '{"format":"late-edition-save",', 'The morgue file is damaged'],
  ['old version', '{"format":"late-edition-save","version":0}', 'older morgue file (version 0)'],
  ['future version', '{"format":"late-edition-save","version":2}', 'version is not supported'],
]) {
  test(`${name} save shows a notice and permits a fresh run`, async ({ page }) => {
    await page.evaluate(({ key, json }) => localStorage.setItem(key, json), { key: RUN_KEY, json });
    await page.reload();
    await expect(page.locator('#title-save-notice')).toContainText(notice);
    await expect(page.locator('#btn-continue-run')).toBeHidden();
    await startDesk(page, { dispatch: false });
    expect(await page.evaluate(() => window.lateEditionApp.sim.edition)).toBe(1);
    expect(await page.evaluate((key) => localStorage.getItem(key), RUN_KEY)).toBeNull();
  });
}

test('quota failure warns without losing the run or an older valid checkpoint', async ({ page }) => {
  await savedTitle(page);
  await page.locator('#btn-continue-run').click();
  const previous = await page.evaluate((key) => localStorage.getItem(key), RUN_KEY);
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key) throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, name, value);
    };
    const app = window.lateEditionApp;
    app.sim.cash++;
    app._autosave();
  }, RUN_KEY);
  await expect(page.locator('#save-status')).toContainText('Storage is full or unavailable');
  expect(await page.evaluate((key) => localStorage.getItem(key), RUN_KEY)).toBe(previous);
  expect(await page.evaluate(() => window.lateEditionApp.sim.gameOver)).toBe(false);
  // A serialization failure must be equally non-fatal and preserve the checkpoint.
  await page.evaluate(() => {
    window.lateEditionApp.sim.cash = NaN;
    window.lateEditionApp._autosave();
  });
  await expect(page.locator('#save-status')).toContainText('last checkpoint is unchanged');
});

test('throwing storage reads leave the title usable with a notice', async ({ page }) => {
  await page.addInitScript((key) => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function (name) {
      if (name === key) throw new DOMException('Blocked', 'SecurityError');
      return original.call(this, name);
    };
  }, RUN_KEY);
  await page.reload();
  await expect(page.locator('#title-save-notice')).toContainText('cannot be read');
  await expect(page.locator('#btn-continue-run')).toBeHidden();
  await startDesk(page);
  await expect(page.locator('#title-screen')).toBeHidden();
});

test('game over deletes the run, preserves the best score and cannot resurrect Continue', async ({ page }) => {
  await savedTitle(page);
  await page.locator('#btn-continue-run').click();
  await page.evaluate(() => {
    const app = window.lateEditionApp;
    app.sim.credibility = 0;
    app.sim.paused = false;
    app.sim.step(0.05);
    app._syncFullUI();
  });
  await expect(page.locator('#modal-title')).toHaveText('PAPER FOLDED');
  await expect(page.locator('#save-status')).toBeEmpty();
  expect(await page.evaluate((key) => localStorage.getItem(key), RUN_KEY)).toBeNull();
  expect(await page.evaluate(() => Number(localStorage.getItem('lateEdition.bestCirculation.v2')))).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('#btn-continue-run')).toBeHidden();
});
