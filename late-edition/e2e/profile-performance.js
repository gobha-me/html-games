// Reproducible diagnostic, separate from Playwright's regression suite.
// Start the root static server on 8123, then run:
// node e2e/profile-performance.js before [--baseline=REV] [--no-grain] [--no-weather]
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const name = process.argv[2] || 'profile';
const directory = 'performance-results';
const baselineArg = process.argv.find((arg) => arg === '--baseline' || arg.startsWith('--baseline='));
// Resolve once: another session may commit while a diagnostic is running.
const baselineRevision = baselineArg ? execFileSync('git',
  ['rev-parse', '--verify', '--end-of-options', `${baselineArg.split('=')[1] || 'HEAD'}^{commit}`],
  { encoding: 'utf8' }).trim() : null;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ args: [
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
] });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  if (baselineRevision) {
    // Compare committed source without checkout/stash or touching the worktree.
    for (const [path, contentType] of [['js/renderer.js', 'text/javascript'], ['css/style.css', 'text/css']]) {
      const body = execFileSync('git', ['show', `${baselineRevision}:late-edition/${path}`], { encoding: 'utf8' });
      await page.route(`**/late-edition/${path}`, (route) => route.fulfill({ body, contentType }));
    }
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.goto('http://127.0.0.1:8123/late-edition/?seed=89&preview=combat');
  await page.evaluate(() => document.fonts.ready);
  if (process.argv.includes('--no-grain')) await page.addStyleTag({ content: '*::after { background-image: none !important; }' });
  if (process.argv.includes('--no-weather')) await page.evaluate(() => { window.lateEditionApp.renderer._drawRainAndVignette = () => {}; });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${directory}/${name}.png` });
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline,blink.user_timing,cc,gpu,disabled-by-default-devtools.timeline',
    transferMode: 'ReturnAsStream',
  });
  const metrics = await page.evaluate(async () => {
    const app = window.lateEditionApp;
    const costs = { render: [], ui: [] };
    const wrap = (target, key, label) => {
      const original = target[key];
      target[key] = function (...args) {
        const start = performance.now();
        try { return original.apply(this, args); }
        finally {
          const end = performance.now();
          costs[label].push(end - start);
          performance.measure(`late-edition:${label}`, { start, end });
        }
      };
      return () => { target[key] = original; };
    };
    const restores = ['_drawRainAndVignette', '_drawDistrictSigns', '_ensureLayers'].map((key) => {
      costs[key] = [];
      return wrap(app.renderer, key, key);
    });
    const restoreRender = wrap(app.renderer, 'render', 'render');
    const restoreUI = wrap(app, '_syncFullUI', 'ui');
    const frames = [];
    try {
      await new Promise((resolve) => {
        let first, last;
        const sample = (now) => {
          first ??= now;
          if (last !== undefined) frames.push(now - last);
          last = now;
          if (now - first >= 5000) resolve();
          else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
    } finally { restoreRender(); restoreUI(); restores.forEach((restore) => restore()); }
    const stats = (values) => ({ count: values.length,
      total: values.reduce((a, b) => a + b, 0),
      p95: values.toSorted((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] });
    const deterministic = [];
    for (let i = 0; i < 150; i++) {
      const start = performance.now();
      app.renderer.render(app.sim, 1 / 60);
      deterministic.push(performance.now() - start);
    }
    return { ...Object.fromEntries(Object.entries(costs).map(([key, values]) => [key, stats(values)])),
      deterministic: stats(deterministic), frames: stats(frames),
      canvas: [app.renderer.canvas.width, app.renderer.canvas.height], dpr: devicePixelRatio };
  });
  const complete = new Promise((resolve) => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end');
  const { stream } = await complete;
  let trace = '';
  for (;;) {
    const chunk = await cdp.send('IO.read', { handle: stream });
    trace += chunk.data;
    if (chunk.eof) break;
  }
  await cdp.send('IO.close', { handle: stream });
  await writeFile(`${directory}/${name}.trace.json`, trace);
  // Thread work can overlap: these are per-event totals, not additive wall time.
  metrics.baselineRevision = baselineRevision;
  metrics.traceWorkMs = {};
  for (const event of JSON.parse(trace).traceEvents) {
    if (event.ph === 'X' && /^(Paint|PrePaint|Layout|UpdateLayoutTree|RasterTask|CompositeLayers|DrawFrame|RasterDecoderImpl::DoEndRasterCHROMIUM|RasterDecoderImpl::DoRasterCHROMIUM|MainFrame.Draw|Commit)$/.test(event.name)) {
      metrics.traceWorkMs[event.name] = (metrics.traceWorkMs[event.name] || 0) + event.dur / 1000;
    }
  }
  await writeFile(`${directory}/${name}.json`, JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify(metrics, null, 2));
} finally { await browser.close(); }
