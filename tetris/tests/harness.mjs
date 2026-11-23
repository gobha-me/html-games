import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// Load the actual classic browser scripts. Only browser boundaries are replaced;
// no game algorithms are copied or rewritten for Node.
export function loadTetris({ seed = 1, random, saved = {} } = {}) {
  let randomState = seed >>> 0;
  const math = Object.create(Math);
  math.random = random ?? (() => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 0x100000000;
  });
  let now = 0;
  const pending = [];
  const writes = [];
  const storage = new Map(Object.entries(saved));
  const listeners = new Map();
  const context = vm.createContext({
    Math: math,
    // Stryker command-runner selection must cross the otherwise isolated VM.
    __stryker__: { activeMutant: process.env.__STRYKER_ACTIVE_MUTANT__ },
    performance: { now: () => now },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => {
        writes.push([key, value]);
        storage.set(key, value);
      },
    },
    setTimeout: (callback, delay) => {
      pending.push({ callback, delay });
      return pending.length;
    },
    document: {
      addEventListener: (name, callback) => listeners.set(name, callback),
    },
  });
  context.window = context;
  for (const name of ['state', 'game', 'controls']) {
    const path = fileURLToPath(new URL(`../js/${name}.js`, import.meta.url));
    vm.runInContext(readFileSync(path, 'utf8'), context, { filename: path });
  }
  context.GameState.board = context.createBoard();
  return {
    api: context,
    state: context.GameState,
    storage,
    writes,
    pending,
    listeners,
    setNow(value) { now = value; },
    finishLineClear() {
      if (pending.length !== 1) throw new Error(`Expected one line-clear timer, got ${pending.length}`);
      const task = pending.shift();
      task.callback();
      return task.delay;
    },
  };
}

export function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

export function block(type = 'J') {
  return { type, color: '#123456' };
}

export function key(code) {
  return { code, prevented: false, preventDefault() { this.prevented = true; } };
}
