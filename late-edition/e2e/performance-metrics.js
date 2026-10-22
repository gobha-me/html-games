// Reject missing/invalid samples instead of letting a failed probe waive a budget.
export function summarize(values) {
  if (!values.length || values.some((value) => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('Performance samples must be nonempty, finite and nonnegative');
  }
  return { samples: values.length, p95: values.toSorted((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1],
    total: values.reduce((sum, value) => sum + value, 0) };
}

export function supportsFrameBudget(calibration) {
  // Both probes run in the foreground, before loading the game, on this same
  // browser/viewport/DPR. The second invalidates a blank full-viewport canvas:
  // idle-page callbacks alone can hit 60Hz even when software raster cannot.
  // Never use CI/env flags, or the game's own slow frames, to waive its budget.
  return ['empty', 'canvas'].map((key) => {
    const probe = calibration[key];
    if (!probe || !Number.isInteger(probe.samples) || probe.samples < 30 || !Number.isFinite(probe.total) || probe.total < 1000 ||
        !Number.isFinite(probe.p95) || probe.p95 <= 0) {
      throw new RangeError(`Invalid ${key} frame calibration`);
    }
    return probe.p95 < 20 && probe.samples / (probe.total / 1000) >= 55;
  }).every(Boolean);
}

// Browser-side functions are self-contained so Playwright can serialize them.
export async function sampleFrameIntervals({ durationMs, draw = false }) {
  const canvas = document.createElement('canvas');
  canvas.width = innerWidth * devicePixelRatio;
  canvas.height = innerHeight * devicePixelRatio;
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%';
  const ctx = canvas.getContext('2d');
  if (draw) document.body.append(canvas);
  const intervals = [];
  try {
    await new Promise((resolve) => {
      let first, last, count = 0;
      const sample = (timestamp) => {
        if (count++ >= 15) {
          first ??= timestamp;
          if (last !== undefined) intervals.push(timestamp - last);
          last = timestamp;
        }
        if (draw) {
          ctx.fillStyle = count % 2 ? 'black' : 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        if (first !== undefined && timestamp - first >= durationMs && intervals.length >= 30) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return intervals;
  } finally { canvas.remove(); }
}

export async function sampleRenderCosts() {
  const app = window.lateEditionApp;
  const renderer = app.renderer;
  const original = renderer.render;
  const cache = renderer.cache;
  const deterministic = [], live = [], frames = [];
  const startClock = app.sim.clockSec;
  renderer.render = function (...args) {
    const start = performance.now();
    try { return original.apply(this, args); }
    finally { live.push(performance.now() - start); }
  };
  let duration;
  try {
    duration = await new Promise((resolve) => {
      let first, last;
      const sample = (timestamp) => {
        first ??= timestamp;
        if (last !== undefined) frames.push(timestamp - last);
        last = timestamp;
        if (timestamp - first >= 5000) resolve(timestamp - first);
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  } finally { renderer.render = original; }
  const elapsed = app.sim.clockSec - startClock;
  // Sample presentation FIRST: a synchronous batch queues GPU work and must not
  // contaminate the live interval with the benchmark's own raster backlog.
  // Fixed dt, live combat state, real renderer, no sim.step(): the >=100 CPU
  // samples cannot disappear when SwiftShader only presents 66 frames in 5s.
  for (let i = 0; i < 10; i++) original.call(renderer, app.sim, 1 / 60);
  const hash = app.sim.getStateHash(), rng = app.sim.rng.getState();
  for (let i = 0; i < 150; i++) {
    const start = performance.now();
    original.call(renderer, app.sim, 1 / 60);
    deterministic.push(performance.now() - start);
  }
  const simulationUntouched = hash === app.sim.getStateHash() && rng === app.sim.rng.getState();
  return { deterministic, live, frames, duration, simulationUntouched,
    cacheStable: cache === renderer.cache, elapsed,
    viewport: [innerWidth, innerHeight], dpr: devicePixelRatio };
}
