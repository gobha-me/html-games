import { test, expect } from './helpers.js';

test.use({ openTitle: false });

test('paper grain preserves monochrome multiply without blend surfaces', async ({ page }) => {
  await page.goto('/late-edition/?seed=89&preview=combat');
  const result = await page.evaluate(async () => {
    const { PALETTE } = await import('../late-edition/js/palette.js');
    // Compare the shipped asset with the original filter, rather than repeating
    // the baker's conversion. Inverted/missing alpha or plain grey grain fails
    // on both paper and the dark ink/text underneath it.
    const source = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
<filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" stitchTiles="stitch"/>
<feColorMatrix type="saturate" values="0"/></filter>
<path filter="url(#g)" d="M0 0h120v120H0z"/></svg>`;
    const original = new Image(), baked = new Image();
    original.src = `data:image/svg+xml,${encodeURIComponent(source)}`;
    baked.src = 'assets/paper-grain.png';
    await Promise.all([original.decode(), baked.decode()]);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 120;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const paint = (image, mode, color) => {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 120, 120);
      ctx.globalAlpha = 0.065;
      ctx.globalCompositeOperation = mode;
      ctx.drawImage(image, 0, 0);
      return ctx.getImageData(0, 0, 120, 120).data;
    };
    let maxError = 0;
    for (const color of Object.values(PALETTE)) {
      const expected = paint(original, 'multiply', color);
      const actual = paint(baked, 'source-over', color);
      for (let i = 0; i < expected.length; i++) maxError = Math.max(maxError, Math.abs(actual[i] - expected[i]));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(baked, 0, 0);
    const pixels = ctx.getImageData(0, 0, 120, 120).data;
    let nonblack = 0;
    const alphas = new Set();
    for (let i = 0; i < pixels.length; i += 4) {
      nonblack += pixels[i] + pixels[i + 1] + pixels[i + 2];
      alphas.add(pixels[i + 3]);
    }
    const styles = [...document.querySelectorAll('.lead-item, .op-card, .broadsheet-paper, .paper-slot, .scoop-chip')]
      .map((node) => getComputedStyle(node, '::after'));
    return { maxError, nonblack, alphaLevels: alphas.size, size: [baked.width, baked.height],
      modes: styles.map((style) => style.mixBlendMode), opacities: styles.map((style) => style.opacity) };
  });
  expect(result.size).toEqual([120, 120]);
  expect(result.nonblack).toBe(0);
  expect(result.alphaLevels).toBeGreaterThan(30);
  expect(result.maxError).toBeLessThanOrEqual(1); // 8-bit alpha/compositing rounding.
  expect(result.modes.length).toBeGreaterThan(10);
  expect(new Set(result.modes)).toEqual(new Set(['normal']));
  expect(new Set(result.opacities)).toEqual(new Set(['0.065']));
});

test('unchanged UI ticks cause no text mutations; changed and hostile copy stays live', async ({ page }) => {
  await page.goto('/late-edition/?seed=89&preview=combat');
  const result = await page.evaluate(async () => {
    const app = window.lateEditionApp;
    app.sim.paused = true;
    app._syncFullUI();
    const observer = new MutationObserver(() => {});
    observer.observe(document.body, { subtree: true, characterData: true, childList: true });
    for (let i = 0; i < 4; i++) app._syncFullUI();
    const unchanged = observer.takeRecords().map((record) => ({ type: record.type, target: record.target.parentElement?.id }));
    const cash = document.getElementById('hud-funds'), textNode = cash.firstChild;
    app.sim.cash = 0;
    app._syncFullUI();
    const changed = observer.takeRecords().filter((record) => record.target === textNode).length;
    const cashUpdated = cash.textContent === '$0' && cash.firstChild === textNode;
    // Exercise scalar reconciliation and direct updates through the same helper.
    const { setText, h, reconcile } = await import('../late-edition/js/dom.js');
    const host = document.createElement('div');
    setText(host, 0);
    const zero = host.textContent;
    setText(host, '');
    const empty = host.textContent;
    host.append(document.createElement('strong'));
    const hostile = '<img src=x onerror="window.injected=true">';
    setText(host, hostile);
    const literal = host.textContent === hostile && host.querySelector('img') === null;
    reconcile(host, [h('span', '', 'before', {}, 'same')]);
    const span = host.firstElementChild, child = span.firstChild;
    reconcile(host, [h('span', '', hostile, {}, 'same')]);
    const reconciled = host.firstElementChild === span && span.firstChild === child && span.textContent === hostile;
    observer.disconnect();
    return { unchanged, changed, cashUpdated, zero, empty, literal, reconciled, injected: Boolean(window.injected) };
  });
  expect(result.unchanged).toEqual([]);
  expect(result.changed).toBe(1);
  expect(result.cashUpdated).toBe(true);
  expect(result.zero).toBe('0');
  expect(result.empty).toBe('');
  expect(result.literal).toBe(true);
  expect(result.reconciled).toBe(true);
  expect(result.injected).toBe(false);
});
