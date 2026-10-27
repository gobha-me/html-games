// Minimal DOM/Storage/RAF harness to boot the real js/main.js controller.
// Only browser platform objects are stand-ins; every Keeper module is real.
import { createRecordingCanvas } from './canvas-recorder.mjs';

let bootSequence = 0;

export async function bootMain({
  search = '?e2e=1&seed=108', webdriver = true, reducedMotion = false, initialStorage = {}, now = 0,
} = {}) {
  const listeners = new Map();
  const docListeners = new Map();
  const elements = new Map();
  let activeElement = null;
  const recording = createRecordingCanvas();
  const frames = [];
  const clock = { now };
  const media = {
    matches: reducedMotion,
    media: '(prefers-reduced-motion: reduce)',
    listeners: [],
    addEventListener(type, fn) { if (type === 'change') this.listeners.push(fn); },
  };

  function makeClassList() {
    const set = new Set();
    return {
      add: (...names) => names.forEach((n) => set.add(n)),
      remove: (...names) => names.forEach((n) => set.delete(n)),
      toggle: (name, force) => {
        const next = force === undefined ? !set.has(name) : Boolean(force);
        if (next) set.add(name); else set.delete(name);
        return next;
      },
      contains: (name) => set.has(name),
    };
  }
  function makeElement(id, tag = 'div') {
    const elListeners = new Map();
    const attrs = new Map();
    let text = '';
    const el = {
      id,
      tagName: tag.toUpperCase(),
      textWrites: 0,
      get textContent() { return text; },
      set textContent(value) { text = String(value); this.textWrites++; this.scrollWidth = text.length * 10; },
      value: '',
      hidden: false,
      disabled: false,
      checked: false,
      open: false,
      scrollLeft: 0,
      scrollWidth: 0,
      children: [],
      classList: makeClassList(),
      appendChild(child) {
        this.children.push(child);
        if (this.tagName === 'SELECT' && this.children.length === 1 && this.value === '') this.value = child.value ?? '';
        return child;
      },
      replaceChildren(...next) {
        this.children = [...next];
        if (this.tagName === 'SELECT') this.value = this.children[0]?.value ?? '';
      },
      setAttribute(name, val) { attrs.set(name, String(val)); },
      getAttribute(name) { return attrs.get(name) ?? null; },
      addEventListener(type, fn) {
        if (!elListeners.has(type)) elListeners.set(type, []);
        elListeners.get(type).push(fn);
      },
      dispatchEvent(event) {
        for (const fn of elListeners.get(event.type) ?? []) fn(event);
        return !event.defaultPrevented;
      },
      click() { this.dispatchEvent({ type: 'click', preventDefault() {} }); },
      focus() { activeElement = this; },
      blur() { if (activeElement === this) activeElement = null; },
      showModal() { this.open = true; },
      close() { this.open = false; },
    };
    return el;
  }

  const ids = [
    ['clock', 'time'], ['bearing', 'p'],
    ['lens-state', 'span'], ['horn-state', 'span'], ['trust-state', 'span'],
    ['lamp-state', 'span'], ['morse-symbols', 'output'], ['morse-text', 'output'], ['morse-delivery', 'span'],
    ['start-panel', 'div'], ['title-controls', 'ul'], ['schedule-error', 'p'], ['start', 'button'], ['previous-record', 'p'],
    ['pause-panel', 'div'], ['resume', 'button'],
    ['help-panel', 'div'], ['controls-list', 'ul'], ['incoming-wpm', 'select'], ['show-reference', 'input'], ['close-help', 'button'],
    ['dawn-panel', 'div'], ['summary', 'p'], ['record-status', 'p'], ['restart', 'button'],
    ['log-panel', 'dialog'], ['log-title', 'h2'], ['log-guidance', 'p'], ['log-form', 'form'],
    ['log-stamp', 'p'], ['log-what', 'select'], ['log-empty', 'p'], ['log-note', 'select'],
    ['add-log-entry', 'button'], ['log-status', 'p'], ['log-no-entries', 'p'], ['log-entries', 'ol'], ['close-log', 'button'],
    ['watch-controls', 'aside'], ['watch-controls-list', 'ul'],
    ['morse-reference', 'aside'], ['morse-alphabet', 'div'],
    ['controls-hint', 'p'], ['help', 'button'], ['mute', 'button'],
  ];
  for (const [id, tag] of ids) elements.set(id, makeElement(id, tag));
  const sea = Object.assign(makeElement('sea', 'canvas'), recording.canvas);
  sea.getContext = recording.canvas.getContext;
  sea.getBoundingClientRect = recording.canvas.getBoundingClientRect;
  elements.set('sea', sea);
  elements.get('incoming-wpm').value = '8';
  for (const id of ['previous-record', 'pause-panel', 'help-panel', 'dawn-panel', 'log-empty', 'morse-reference']) {
    elements.get(id).hidden = true;
  }

  const store = new Map(Object.entries(initialStorage));
  const doc = {
    hidden: false,
    get activeElement() { return activeElement; },
    getElementById(id) { return elements.get(id) ?? null; },
    createElement(tag) { return makeElement('', tag); },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    dispatchEvent(event) { for (const fn of docListeners.get(event.type) ?? []) fn(event); },
  };
  const win = {
    devicePixelRatio: 1,
    location: { search },
    matchMedia: () => media,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatchEvent(event) {
      for (const fn of listeners.get(event.type) ?? []) fn(event);
      return !event.defaultPrevented;
    },
  };
  const define = (name, value) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  define('window', win);
  define('document', doc);
  define('navigator', { webdriver });
  define('localStorage', {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, val) => { store.set(key, String(val)); },
  });
  define('requestAnimationFrame', (callback) => { frames.push(callback); return frames.length; });
  define('performance', { now: () => clock.now });

  await import(new URL(`../js/main.js?harness=${++bootSequence}`, import.meta.url).href);

  // Run the most recently requested animation frame at `timestamp`, letting
  // the page spend `workMs` of (fake) performance time inside it.
  function frame(timestamp, { workMs = 0 } = {}) {
    const callback = frames.at(-1);
    const before = frames.length;
    const start = clock.now;
    const realNow = globalThis.performance.now;
    let calls = 0;
    globalThis.performance.now = () => (calls++ === 0 ? start : start + workMs);
    try { callback(timestamp); } finally { globalThis.performance.now = realNow; }
    clock.now = start + workMs;
    if (frames.length !== before + 1) throw new Error('frame did not request exactly one successor');
  }
  function keydown(code, opts = {}) {
    let defaultPrevented = false;
    const event = {
      type: 'keydown', code, repeat: Boolean(opts.repeat),
      ctrlKey: Boolean(opts.ctrlKey), metaKey: Boolean(opts.metaKey), altKey: Boolean(opts.altKey),
      preventDefault() { defaultPrevented = true; },
      get defaultPrevented() { return defaultPrevented; },
    };
    win.dispatchEvent(event);
    return event;
  }
  function keyup(code) { win.dispatchEvent({ type: 'keyup', code }); }
  function setMotion(reduced) {
    media.matches = reduced;
    for (const fn of media.listeners) fn({ type: 'change', matches: reduced, media: media.media });
  }
  function setHidden(hidden) {
    doc.hidden = hidden;
    doc.dispatchEvent({ type: 'visibilitychange' });
  }

  return {
    win, doc, elements, store, media, recording, frames, clock,
    $: (id) => elements.get(id),
    keeper: win.__keeper,
    frame, keydown, keyup, setMotion, setHidden,
  };
}
