// Reproducible diagnostic, separate from Playwright's regression suite.
// Start the root static server on 8123, then run:
// node e2e/profile-performance.js before [--baseline=REV] [--cpu=1] [--paint-flashing]
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { sampleFrameIntervals, summarize } from './performance-metrics.js';

const name = process.argv[2] || 'profile';
const directory = 'performance-results';
const cpuRate = Number(process.argv.find((arg) => arg.startsWith('--cpu='))?.split('=')[1] || 4);
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
  await page.addInitScript(({ softwareCaches, softwareCanvas }) => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, options) {
      if (kind === '2d' && location.pathname.startsWith('/late-edition/') && ((softwareCaches && !this.isConnected) ||
          (softwareCanvas && this.id === 'city-canvas'))) {
        return original.call(this, kind, { ...options, willReadFrequently: true });
      }
      return original.call(this, kind, options);
    };
  }, { softwareCaches: process.argv.includes('--software-caches'), softwareCanvas: process.argv.includes('--software-canvas') });
  const calibration = {};
  for (const key of ['empty', 'canvas']) {
    calibration[key] = summarize(await page.evaluate(sampleFrameIntervals, { durationMs: 1500, draw: key === 'canvas' }));
  }
  if (baselineRevision) {
    // Compare committed source without checkout/stash or touching the worktree.
    for (const [path, contentType] of [['js/renderer.js', 'text/javascript'], ['js/city.js', 'text/javascript'],
      ['js/silhouettes.js', 'text/javascript'], ['js/main.js', 'text/javascript'],
      ['js/dom.js', 'text/javascript'], ['css/style.css', 'text/css'], ['assets/paper-grain.png', 'image/png']]) {
      const body = execFileSync('git', ['show', `${baselineRevision}:late-edition/${path}`]);
      await page.route(`**/late-edition/${path}`, (route) => route.fulfill({ body, contentType }));
    }
  }
  const cdp = await page.context().newCDPSession(page);
  const layers = new Map(), paints = [];
  cdp.on('LayerTree.layerTreeDidChange', ({ layers: current = [] }) => {
    for (const layer of current) layers.set(layer.layerId, layer);
  });
  cdp.on('LayerTree.layerPainted', (paint) => paints.push(paint));
  await cdp.send('DOM.enable');
  await cdp.send('LayerTree.enable');
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
  // Capture startup too: screenshots/readbacks before the live sample flush
  // deferred raster work and can conceal the exact regression being measured.
  await cdp.send('Tracing.start', {
    categories: 'devtools.timeline,blink.user_timing,cc,gpu,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.paint,disabled-by-default-cc.debug',
    transferMode: 'ReturnAsStream',
  });
  await page.goto('http://127.0.0.1:8123/late-edition/?seed=89&preview=combat');
  // LayerTree notifications need the inspected document, not just DOM.enable.
  await cdp.send('DOM.getDocument');
  await cdp.send('LayerTree.disable');
  await cdp.send('LayerTree.enable');
  await page.evaluate(() => document.fonts.ready);
  if (process.argv.includes('--no-grain')) await page.addStyleTag({ content: '*::after { background-image: none !important; }' });
  if (process.argv.includes('--no-weather')) await page.evaluate(() => { window.lateEditionApp.renderer._drawRainAndVignette = () => {}; });
  if (process.argv.includes('--no-blend')) await page.addStyleTag({ content: '*::after { mix-blend-mode: normal !important; }' });
  if (process.argv.includes('--isolate-map')) await page.addStyleTag({ content: '#city-canvas { will-change: transform; }' });
  if (process.argv.includes('--no-ui')) await page.evaluate(() => { window.lateEditionApp._syncFullUI = () => {}; });
  if (process.argv.includes('--fixed-labels')) await page.evaluate(() => {
    const renderer = window.lateEditionApp.renderer;
    const layout = renderer._layoutLeadLabels.bind(renderer);
    let placements;
    // Diagnostic only: freeze placement to isolate moving text raster cost.
    renderer._layoutLeadLabels = (...args) => placements ??= layout(...args);
  });
  await page.waitForFunction(() => Boolean(window.lateEditionApp.renderer.cache));
  await page.waitForTimeout(500);
  paints.length = 0;
  const metrics = await page.evaluate(async () => {
    const app = window.lateEditionApp;
    performance.mark('late-edition:sample-start');
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
    } finally {
      performance.mark('late-edition:sample-end');
      restoreRender(); restoreUI(); restores.forEach((restore) => restore());
    }
    const stats = (values) => ({ count: values.length,
      total: values.reduce((a, b) => a + b, 0),
      p95: values.toSorted((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1] });
    return { ...Object.fromEntries(Object.entries(costs).map(([key, values]) => [key, stats(values)])),
      frames: stats(frames),
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
  if (process.argv.includes('--paint-flashing')) {
    await cdp.send('Overlay.setShowPaintRects', { result: true });
    await page.waitForTimeout(250);
  }
  if (!process.argv.includes('--skip-screenshot')) await page.screenshot({ path: `${directory}/${name}.png` });
  await cdp.send('Overlay.setShowPaintRects', { result: false });
  metrics.calibration = calibration;
  metrics.cpuRate = cpuRate;
  metrics.layers = [];
  for (const layer of layers.values()) {
    let node;
    if (layer.backendNodeId) {
      try { node = (await cdp.send('DOM.describeNode', { backendNodeId: layer.backendNodeId })).node; }
      catch { /* Removed layers can refer to detached DOM nodes. */ }
    }
    const layerPaints = paints.filter((paint) => paint.layerId === layer.layerId);
    let reasons;
    try { reasons = await cdp.send('LayerTree.compositingReasons', { layerId: layer.layerId }); }
    catch { /* A layer removed during the trace has no current reasons. */ }
    metrics.layers.push({ ...layer, node: node && { name: node.nodeName, attributes: node.attributes },
      reasons, paints: layerPaints.length, clips: layerPaints.slice(0, 8).map((paint) => paint.clip) });
  }
  // Thread work can overlap: these are per-event totals, not additive wall time.
  metrics.baselineRevision = baselineRevision;
  metrics.traceWorkMs = {};
  metrics.liveTraceWorkMs = {};
  const events = JSON.parse(trace).traceEvents;
  const start = events.find((event) => event.name === 'late-edition:sample-start')?.ts;
  const end = events.find((event) => event.name === 'late-edition:sample-end')?.ts;
  const invalidations = new Map(), surfaces = new Set();
  for (const event of events) {
    if (event.name === 'LayerTreeHostImpl::CalculateRenderPasses') surfaces.add(event.args['render_surface_list_size()']);
    if (event.name === 'LayerTreeHostImpl:snapshot') {
      for (const layer of event.args.snapshot?.active_tree?.layers || []) {
        if (!layer.invalidation?.length) continue;
        const entry = invalidations.get(layer.layer_id) || { layerId: layer.layer_id, bounds: layer.bounds, snapshots: 0,
          node: metrics.layers.find((item) => Number(item.layerId) === layer.layer_id)?.node, regions: [] };
        entry.snapshots++;
        if (entry.regions.length < 3) entry.regions.push(layer.invalidation);
        invalidations.set(layer.layer_id, entry);
      }
    }
    if (event.ph === 'X' && /^(Paint|PrePaint|Layout|UpdateLayoutTree|RasterTask|CompositeLayers|DrawFrame|RasterDecoderImpl::DoEndRasterCHROMIUM|RasterDecoderImpl::DoRasterCHROMIUM|MainFrame.Draw|Commit)$/.test(event.name)) {
      metrics.traceWorkMs[event.name] = (metrics.traceWorkMs[event.name] || 0) + event.dur / 1000;
      if (event.ts >= start && event.ts + event.dur <= end) {
        metrics.liveTraceWorkMs[event.name] = (metrics.liveTraceWorkMs[event.name] || 0) + event.dur / 1000;
      }
    }
  }
  metrics.invalidations = [...invalidations.values()];
  metrics.renderSurfaceCounts = [...surfaces];
  await writeFile(`${directory}/${name}.json`, JSON.stringify(metrics, null, 2));
  console.log(JSON.stringify(metrics, null, 2));
} finally { await browser.close(); }
