import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Each case evaluates the shipped classic scripts unchanged in its own realm.
// Only browser ports are replaced. Game rules remain the real implementation.
export function loadSnake({ saved = {}, random = [0, 0], bootstrap = false } = {}) {
  const storage = new Map(Object.entries(saved));
  const writes = [];
  const elements = new Map();
  const listeners = new Map();
  const timers = new Map();
  const cancelledFrames = [];
  let timerId = 0;
  let frameId = 0;
  let randomIndex = 0;
  const gradient = () => ({ addColorStop() {} });
  // Explicit standard Canvas 2D browser port. The Renderer itself is real;
  // this logic suite observes state/UI writes and does not inspect pixels.
  const canvasContext = {
    clearRect() {}, fillRect() {}, strokeRect() {},
    beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    arc() {}, arcTo() {}, ellipse() {}, rect() {}, roundRect() {},
    quadraticCurveTo() {}, bezierCurveTo() {},
    fill() {}, stroke() {}, clip() {},
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    setTransform() {}, resetTransform() {},
    fillText() {}, strokeText() {}, drawImage() {},
    setLineDash() {}, getLineDash() { return []; },
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    measureText(text) { return { width: String(text).length * 8 }; },
  };
  const math = Object.create(Math);
  math.random = () => {
    if (randomIndex >= random.length) throw new Error('Test random sequence exhausted');
    return random[randomIndex++];
  };
  function domNode() {
    const handlers = new Map();
    const classes = new Set();
    return {
      textContent: '',
      style: {},
      classList: {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
      },
      addEventListener: (type, callback) => handlers.set(type, callback),
      click: () => handlers.get('click')?.(),
    };
  }
  const modes = ['single', 'multiplayer'].map(mode => ({
    ...domNode(),
    dataset: { mode },
  }));
  const indicator = domNode();
  const element = id => {
    if (!elements.has(id)) {
      const node = domNode();
      if (id === 'ghost-trail-btn') node.querySelector = () => indicator;
      if (id === 'game-canvas') {
        node.width = 600;
        node.height = 600;
        node.getContext = type => type === '2d' ? canvasContext : null;
      }
      elements.set(id, node);
    }
    return elements.get(id);
  };
  const context = vm.createContext({
    // Command-runner mutants execute inside this realm, not Node's global.
    // Forward only the mutation selector; no host process/browser APIs leak in.
    __stryker__: { activeMutant: process.env.__STRYKER_ACTIVE_MUTANT__ },
    window: {},
    Math: math,
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem(key, value) {
        storage.set(key, String(value));
        writes.push([key, String(value)]);
      },
    },
    document: {
      getElementById: element,
      querySelectorAll: selector => selector === '.mode-btn' ? modes : [],
      addEventListener: (type, callback) => listeners.set(type, callback),
    },
    performance: { now: () => 1000 },
    requestAnimationFrame: () => ++frameId,
    cancelAnimationFrame: id => cancelledFrames.push(id),
    setInterval(callback) {
      const id = ++timerId;
      timers.set(id, callback);
      return id;
    },
    clearInterval: id => timers.delete(id),
  });
  for (const name of ['state', 'snake', 'food', 'controls', 'multiplayer', 'renderer', 'game', 'main']) {
    const file = new URL(`../js/${name}.js`, import.meta.url);
    vm.runInContext(readFileSync(file, 'utf8'), context, { filename: file.pathname, timeout: 1000 });
  }
  if (bootstrap) {
    listeners.get('DOMContentLoaded')();
  } else {
    // Tests that enter PLAYING directly still need real canvas setup.
    vm.runInContext('Renderer.init()', context, { timeout: 1000 });
  }
  const api = vm.runInContext(
    '({ GameState, Snake, Food, Controls, Multiplayer, Game, handleKeyDown, handleKeyUp })',
    context,
  );
  return {
    ...api, storage, writes, element, modes, listeners, timers, cancelledFrames,
  };
}

// VM objects have different prototypes; compare their data, not realm identity.
export const plain = value => JSON.parse(JSON.stringify(value));

export function keyEvent(key, extra = {}) {
  return {
    key,
    prevented: 0,
    preventDefault() { this.prevented++; },
    ...extra,
  };
}
