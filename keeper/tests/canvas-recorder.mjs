// A recording stand-in for CanvasRenderingContext2D (the browser dependency,
// never a Keeper module). It tracks the current transform and alpha so tests
// can read back where and how strongly each path or rect would be painted.
const multiply = (a, b) => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
];
const apply = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });

export function createRecordingCanvas({ width = 1280, height = 720 } = {}) {
  const ops = [];
  let matrix = [1, 0, 0, 1, 0, 0];
  let path = [];
  const stack = [];
  const style = { fillStyle: '#000000', strokeStyle: '#000000', lineWidth: 1, globalAlpha: 1, font: '', textAlign: 'start' };
  const snapshot = () => ({ ...style, matrix: [...matrix] });
  const ctx = {
    setTransform(a, b, c, d, e, f) { matrix = [a, b, c, d, e, f]; },
    translate(x, y) { matrix = multiply(matrix, [1, 0, 0, 1, x, y]); },
    rotate(angle) { matrix = multiply(matrix, [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]); },
    save() { stack.push({ matrix: [...matrix], style: { ...style } }); },
    restore() {
      const top = stack.pop();
      if (top) { matrix = top.matrix; Object.assign(style, top.style); }
    },
    beginPath() { path = []; },
    moveTo(x, y) { path.push({ op: 'moveTo', local: [x, y], at: apply(matrix, x, y) }); },
    lineTo(x, y) { path.push({ op: 'lineTo', local: [x, y], at: apply(matrix, x, y) }); },
    arc(x, y, r, a0, a1) { path.push({ op: 'arc', local: [x, y, r, a0, a1], at: apply(matrix, x, y) }); },
    ellipse(...args) { path.push({ op: 'ellipse', local: args, at: apply(matrix, args[0], args[1]) }); },
    quadraticCurveTo(...args) { path.push({ op: 'quadraticCurveTo', local: args }); },
    closePath() { path.push({ op: 'closePath' }); },
    clip() { ops.push({ op: 'clip', path: [...path], ...snapshot() }); },
    fill() { ops.push({ op: 'fill', path: [...path], ...snapshot() }); },
    stroke() { ops.push({ op: 'stroke', path: [...path], ...snapshot() }); },
    fillRect(x, y, w, h) { ops.push({ op: 'fillRect', rect: [x, y, w, h], ...snapshot() }); },
    strokeRect(x, y, w, h) { ops.push({ op: 'strokeRect', rect: [x, y, w, h], ...snapshot() }); },
    fillText(text, x, y) { ops.push({ op: 'fillText', text, at: apply(matrix, x, y), local: [x, y], ...snapshot() }); },
    setLineDash(dash) { ops.push({ op: 'setLineDash', dash: [...dash] }); },
    createRadialGradient(...args) {
      const gradient = { args, stops: [], addColorStop(offset, colour) { this.stops.push([offset, colour]); } };
      ops.push({ op: 'createRadialGradient', gradient, at: apply(matrix, args[0], args[1]), ...snapshot() });
      return gradient;
    },
  };
  for (const key of Object.keys(style)) {
    Object.defineProperty(ctx, key, {
      get: () => style[key],
      set: (value) => { style[key] = value; },
      enumerable: true,
    });
  }
  const canvas = {
    width, height,
    cssWidth: width, cssHeight: height,
    getContext: (kind) => (kind === '2d' ? ctx : null),
    getBoundingClientRect() { return { width: this.cssWidth, height: this.cssHeight }; },
  };
  return { canvas, ctx, ops, clear: () => { ops.length = 0; } };
}

// Filled polygons whose local vertices equal `outline` exactly, in order.
export function filledPolygons(ops, outline) {
  return ops.filter((entry) => entry.op === 'fill'
    && entry.path.length === outline.length + 1
    && entry.path.at(-1).op === 'closePath'
    && entry.path[0].op === 'moveTo'
    && outline.every((point, i) => entry.path[i].local[0] === point[0] && entry.path[i].local[1] === point[1]));
}
