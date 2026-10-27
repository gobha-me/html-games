// Ship-free scenes covering every locked layer (chart, compass ring, labels,
// island, lamp housing/cone/reach, fog, surf, horn rings), and a canonical
// draw-call trace used to compare a renderer with the #116 base fixture.
import { createHash } from 'node:crypto';
import { createState } from '../js/sim.js';
import { createRecordingCanvas } from './canvas-recorder.mjs';

export function lockedScenes() {
  const base = createState(108);
  const scene = (name, patch, reduced, size = [1280, 720]) => ({ name, state: { ...base, ships: [], ...patch }, reduced, size });
  return [
    scene('title', {}, false),
    scene('north-early', { beam: 0, time: 0.5 }, false),
    scene('east-drifted', { beam: 90, time: 7.3, fog: 0.3 }, false),
    scene('south-reduced', { beam: 200, time: 61.5 }, true),
    scene('keyed-lamp', { beam: 314.5, time: 12, lamp: true }, false),
    scene('horn-rings', { beam: 45, time: 20, blasts: [18.5, 19, 19.6], ignoredBlasts: [19] }, false),
    scene('dense-fog-hidpi', { beam: 359.5, time: 99, fog: 1 }, false, [2560, 1440]),
    scene('wide-reduced', { beam: 180, time: 3 }, true, [1920, 720]),
  ];
}

const round = (value) => (typeof value === 'number' ? Math.round(value * 1e6) / 1e6 : value);
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v !== 'function').map(([k, v]) => [k, canonical(v)]));
  }
  return round(value);
}

export function traceScenes(createRenderer) {
  const previous = globalThis.window;
  globalThis.window = { devicePixelRatio: 1 };
  try {
    return Object.fromEntries(lockedScenes().map(({ name, state, reduced, size: [width, height] }) => {
      const recording = createRecordingCanvas({ width, height });
      createRenderer(recording.canvas).draw(state, reduced);
      return [name, canonical(recording.ops)];
    }));
  } finally {
    globalThis.window = previous;
  }
}

// Short per-op digests keep the fixture small yet locate the first divergence.
export function digestScenes(traces) {
  return Object.fromEntries(Object.entries(traces).map(([name, ops]) => [name,
    ops.map((op) => createHash('sha256').update(JSON.stringify(op)).digest('hex').slice(0, 10))]));
}
