import { test, expect, startDesk } from './helpers.js';

test.use({ openTitle: false });

async function title(page) {
  await page.goto('/late-edition/?seed=90');
  await expect(page.locator('#title-screen')).toBeVisible();
}

async function instrumentContext(page, mode = 'normal') {
  await page.addInitScript((mode) => {
    const Native = window.AudioContext;
    window.audioConstructions = 0;
    window.audioResumeAttempts = 0;
    if (mode === 'missing') {
      window.AudioContext = undefined;
      window.webkitAudioContext = undefined;
    } else {
      window.AudioContext = class extends Native {
        constructor(...args) {
          window.audioConstructions++;
          if (mode === 'throws') throw new Error('Device unavailable');
          super(...args);
        }
        resume() {
          window.audioResumeAttempts++;
          if (mode === 'rejects') return Promise.reject(new Error('Autoplay denied'));
          return super.resume();
        }
      };
    }
  }, mode);
}

test('no context before a trusted gesture, including synthetic events and programmatic sim inputs', async ({ page }) => {
  await instrumentContext(page);
  await title(page);
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Shift' }));
    window.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    const { sim, audio } = window.lateEditionApp;
    audio.emit('pressRun');
    sim.startNightShift();
    sim.finishColdOpen();
    sim.dispatchOperativeToLead('rep_1', sim.leads[0].uid);
    sim.step(1);
  });
  await expect.poll(() => page.evaluate(() => window.audioConstructions)).toBe(0);
  expect(await page.evaluate(() => window.lateEditionApp.audio.ctx)).toBeNull();
  await page.reload();
  await page.keyboard.press('Enter');
  await expect(page.locator('#cold-open')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.audioConstructions)).toBe(1);
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.audio.ctx.state)).toBe('running');
  await page.keyboard.press('Shift');
  expect(await page.evaluate(() => window.audioConstructions)).toBe(1);
});

for (const mode of ['missing', 'throws', 'rejects']) {
  test(`audio ${mode} leaves dispatch, deadline and printing playable without console errors`, async ({ page }) => {
    await instrumentContext(page, mode);
    await title(page);
    if (mode === 'rejects') {
      // Force a real suspended native context to exercise the rejecting override.
      await page.keyboard.press('Shift');
      await page.evaluate(() => window.lateEditionApp.audio.ctx.suspend());
    }
    await startDesk(page);
    await page.evaluate(() => {
      const app = window.lateEditionApp;
      app.sim.clockSec = 207;
      app.sim.step(4);
      app._syncFullUI();
    });
    await expect(page.locator('#edition-modal')).toBeVisible();
    expect(await page.evaluate(() => window.lateEditionApp.sim.editionsPrinted)).toBe(1);
    if (mode === 'rejects') {
      expect(await page.evaluate(() => window.audioResumeAttempts)).toBeGreaterThan(0);
      expect(await page.evaluate(() => window.lateEditionApp.audio.ctx.state)).toBe('suspended');
    }
    await page.locator('#btn-modal-continue').click();
    await expect(page.locator('#edition-modal')).toBeHidden();
  });
}

test('blocked audio routes need no downloads: synthesized cues and midnight show still run', async ({ page }, testInfo) => {
  const requests = [];
  await page.route('**/assets/audio/**', async (route) => {
    requests.push(route.request().url());
    await route.abort('failed');
  });
  await title(page);
  await startDesk(page);
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.audio.ctx?.state)).toBe('running');
  const voices = await page.evaluate(() => {
    const app = window.lateEditionApp;
    app.sim.clockSec = 207;
    app.sim.step(1);
    app.sim.publishEdition();
    app._syncFullUI();
    app.sim.publishEdition(); // Repeated input cannot restart the presentation/cue.
    return [...app.audio.voices].filter((voice) => voice.group === 'press').length;
  });
  expect(voices).toBeGreaterThan(10);
  await expect(page.locator('#press-show')).toHaveAttribute('data-stage', 'plates');
  await expect(page.locator('#morning-after')).toBeHidden();
  await expect(page.locator('#press-show')).toHaveAttribute('data-stage', 'rolling');
  await expect(page.locator('#press-show')).toHaveAttribute('data-stage', 'papers');
  await expect(page.locator('#press-caption')).toContainText('EXTRA!');
  await expect(page.locator('#morning-after')).toBeVisible();
  await expect(page.locator('#rival-headline')).toContainText(/HERALD/);
  await expect(page.locator('#rival-deck')).toContainText('The Daily Herald');
  await testInfo.attach('morning-after', { body: await page.screenshot(), contentType: 'image/png' });
  await page.locator('#btn-modal-continue').click();
  expect(await page.evaluate(() => [...window.lateEditionApp.audio.voices].filter((voice) => voice.group === 'press').length)).toBe(0);
  expect(requests, 'synthesis stays available even with all sample routes blocked; it requests zero samples').toEqual([]);
});

for (const [name, raw, expected] of [
  ['truncated', '{', { music: '45', ambience: '35', sfx: '65', muted: false }],
  ['out-of-range', '{"version":1,"muted":true,"volumes":{"music":-5,"ambience":42,"sfx":"NaN"}}',
    { music: '0', ambience: '100', sfx: '65', muted: true }],
]) {
  test(`${name} stored volume values safely populate the actual controls`, async ({ page }) => {
    await page.addInitScript((raw) => localStorage.setItem('lateEdition.audio', raw), raw);
    await title(page);
    await startDesk(page);
    await page.locator('.sound-mixer summary').click();
    for (const channel of ['music', 'ambience', 'sfx']) await expect(page.locator(`#volume-${channel}`)).toHaveValue(expected[channel]);
    await expect(page.locator('#btn-audio')).toHaveAttribute('aria-pressed', String(expected.muted));
  });
}

test('keyboard mixer values and mute persist across reload; unmute restores independent channels', async ({ page }, testInfo) => {
  await instrumentContext(page);
  await title(page);
  await startDesk(page);
  await page.locator('.sound-mixer summary').click();
  for (const [channel, value] of [['music', '17'], ['ambience', '0'], ['sfx', '92']]) {
    const slider = page.locator(`#volume-${channel}`);
    await slider.fill(value);
    await expect(page.locator(`#volume-${channel}-value`)).toHaveText(`${value}%`);
  }
  await page.locator('#volume-music').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#volume-music')).toHaveValue('18');
  await testInfo.attach('sound-mixer', { body: await page.screenshot(), contentType: 'image/png' });
  await page.locator('#btn-audio').click();
  await expect(page.locator('#btn-audio')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  expect(await page.evaluate(() => window.audioConstructions)).toBe(0);
  expect(await page.evaluate(() => window.lateEditionApp.audio.muted)).toBe(true);
  await startDesk(page);
  await expect(page.locator('#btn-audio')).toHaveText('SOUND: OFF [M]');
  await page.locator('.sound-mixer summary').click();
  for (const [channel, value] of [['music', '18'], ['ambience', '0'], ['sfx', '92']]) await expect(page.locator(`#volume-${channel}`)).toHaveValue(value);
  await page.locator('.sound-mixer summary').click();
  await page.locator('#btn-audio').focus();
  await page.keyboard.press('m');
  await expect(page.locator('#btn-audio')).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => window.lateEditionApp.audio.settings)).toEqual({ music: 0.18, ambience: 0, sfx: 0.92, muted: false });
});

test('hidden tab, desk-too-small and manual pause suspend sound and keep overlapping gates', async ({ page }) => {
  await title(page);
  await startDesk(page);
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.audio.ctx.state)).toBe('running');
  // Override the browser-owned visibility read to deterministically deliver the
  // same event as backgrounding, without freezing the test driver itself.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.audio.ctx.state)).toBe('suspended');
  const held = await page.evaluate(() => window.lateEditionApp.audio.ctx.currentTime);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => window.lateEditionApp.audio.ctx.currentTime)).toBe(held);
  await page.setViewportSize({ width: 1000, height: 600 });
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.locator('#desk-too-small')).toBeVisible();
  await page.keyboard.press('Shift');
  expect(await page.evaluate(() => window.lateEditionApp.audio.ctx.state)).toBe('suspended');
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.audio.ctx.state)).toBe('running');
  await page.locator('#btn-pause').click();
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.audio.ctx.state)).toBe('suspended');
  await page.locator('#btn-speed-1').click();
  await expect.poll(() => page.evaluate(() => window.lateEditionApp.audio.ctx.state)).toBe('running');
});

test('reduced motion shows morning card immediately and dismissing early cancels scheduled EXTRA', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await title(page);
  await startDesk(page);
  await page.evaluate(() => { window.lateEditionApp.sim.publishEdition(); window.lateEditionApp._syncFullUI(); });
  await expect(page.locator('#morning-after')).toBeVisible();
  await expect(page.locator('#press-show')).toHaveAttribute('data-stage', 'morning');
  expect(await page.locator('.press-rollers span').evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await page.locator('#btn-modal-continue').click();
  expect(await page.evaluate(() => [...window.lateEditionApp.audio.voices].filter((voice) => voice.group === 'press').length)).toBe(0);
});

test('native offline rendering produces non-silent finite signals for every cue and silence for zero/mute', async ({ page }) => {
  await title(page);
  await startDesk(page);
  const results = await page.evaluate(async () => {
    const { NoirAudio } = await import('./js/audio.js');
    const render = async (cue, mute = false, music = 1) => {
      class RenderContext extends OfflineAudioContext {
        constructor() { super(1, 48000 * 4, 48000); }
        // Offline rendering has no gesture/resume lifecycle. Use the same native
        // graph/envelopes while allowing scheduling before startRendering().
        get state() { return 'running'; }
      }
      const audio = new NoirAudio({ getContext: () => RenderContext, getStorage: () => null });
      audio.setVolume('music', music);
      if (mute) audio.toggleMute();
      await audio.resume();
      audio.emit(cue);
      const data = (await audio.ctx.startRendering()).getChannelData(0);
      let energy = 0, tailEnergy = 0, peak = 0, finite = true;
      data.forEach((value, i) => {
        finite &&= Number.isFinite(value);
        energy += value * value;
        if (i > 48000 * 2.7) tailEnergy += value * value;
        peak = Math.max(peak, Math.abs(value));
      });
      return { cue, energy, tailEnergy, peak, finite };
    };
    const cues = ['dispatch', 'shutter', 'typewriter', 'bribe', 'wireBell', 'phoneRing', 'editionStart', 'deadline', 'pressRun'];
    return { cues: await Promise.all(cues.map((cue) => render(cue))), muted: await render('pressRun', true), zero: await render('deadline', false, 0) };
  });
  for (const result of results.cues) {
    expect(result.finite, result.cue).toBe(true);
    expect(result.energy, result.cue).toBeGreaterThan(0.01);
    expect(result.peak, result.cue).toBeLessThan(1);
  }
  expect(results.cues.find(({ cue }) => cue === 'pressRun').tailEnergy, 'voiced street cry after the motor').toBeGreaterThan(0.01);
  expect(results.muted.energy).toBe(0);
  expect(results.zero.energy).toBe(0);
});
