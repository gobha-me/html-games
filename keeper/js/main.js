import { createState, step, summary, validateSchedule, resetLamp, NIGHT_SECONDS } from './sim.js';
import { MORSE, decodeKeying } from './morse.js';
import { KEYS, CONTROL_LABELS, actionFor, heldInput } from './keys.js';
import { createRenderer } from './renderer.js';
import { createHorn } from './audio.js';
import { RECORD_KEY, parseRecord } from './record.js';
import { LOG_KEY, LOG_VERSION, LOG_NOTES, LOG_TYPES, revealedThings, assembleEntry, parseLog } from './log.js';

const $ = (id) => document.getElementById(id);
const renderer = createRenderer($('sea'));
const audio = createHorn();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const testMode = navigator.webdriver && new URLSearchParams(window.location.search).get('e2e') === '1';
const seedParam = testMode ? Number(new URLSearchParams(window.location.search).get('seed') ?? 108) : 108;
const seed = Number.isSafeInteger(seedParam) && seedParam >= 0 && seedParam <= 0xffffffff ? seedParam : 108;
let state = createState(seed);
let mode = 'start';
let helpReturn = 'start';
let logReturn = 'start';
let log = { version: LOG_VERSION, entries: [] };
let logStatus = 'Entries are kept in this browser.';
let previousTime;
let recorded = false;
let controlsDismissed = false;
const pressed = new Set();
const frameCapacity = 600;
const frameSamples = testMode ? [] : null;
let warmupRemaining = 120;
let previousSampleTimestamp;

// Keep unchanged HUD text out of layout; only scroll newly keyed Morse text.
function setText(id, text, scroll = false) {
  const element = $(id);
  if (element.textContent === text) return;
  element.textContent = text;
  if (scroll) element.scrollLeft = element.scrollWidth;
}

function resetFrameTiming({ warmupFrames = 120 } = {}) {
  if (!Number.isSafeInteger(warmupFrames) || warmupFrames < 0) {
    throw new RangeError('Warm-up frames must be a nonnegative safe integer.');
  }
  frameSamples.length = 0;
  warmupRemaining = warmupFrames;
  previousSampleTimestamp = undefined;
}

for (const id of ['controls-list', 'title-controls', 'watch-controls-list']) {
  for (const action of Object.keys(KEYS)) {
    const item = document.createElement('li'); item.textContent = CONTROL_LABELS[action];
    $(id).appendChild(item);
  }
}
$('controls-hint').textContent = ['slow', 'fast', 'hold', 'horn', 'lamp', 'log', 'pause'].map((key) => CONTROL_LABELS[key]).join('    /    ');
for (const note of LOG_NOTES) {
  const option = document.createElement('option');
  option.value = note; option.textContent = note || 'No note';
  $('log-note').appendChild(option);
}
for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
  const item = document.createElement('span');
  item.textContent = `${letter} ${MORSE[letter]}`;
  $('morse-alphabet').appendChild(item);
}
try {
  const record = parseRecord(localStorage.getItem(RECORD_KEY));
  if (record) {
    $('previous-record').hidden = false;
    $('previous-record').textContent = `Last watch: ${record.safe} safe · ${record.wrecked} wrecked`;
  }
} catch { /* Storage may be disabled; the watch is always available. */ }
try {
  const raw = localStorage.getItem(LOG_KEY);
  const saved = parseLog(raw);
  if (saved) log = saved;
  else if (raw !== null) logStatus = 'The saved log could not be read. A fresh page is ready.';
} catch {
  logStatus = 'This browser cannot keep the log. Entries remain for this visit.';
}

function watchTime(time) {
  const minutes = Math.floor(18 * 60 + time / NIGHT_SECONDS * 12 * 60) % (24 * 60);
  return `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
}
const logBearing = (bearing) => `${Math.floor(bearing).toString().padStart(3, '0')}°`;
function renderLog() {
  $('log-stamp').textContent = `Night ${state.nightParams.night} · ${watchTime(state.time)} · ${logBearing(state.beam)}`;
  $('log-entries').replaceChildren();
  for (const entry of log.entries) {
    const item = document.createElement('li');
    item.textContent = `Night ${entry.night} · ${watchTime(entry.time)} · ${logBearing(entry.bearing)} · ${LOG_TYPES[entry.what.type]}${entry.note ? ` · ${entry.note}` : ''}`;
    $('log-entries').appendChild(item);
  }
  $('log-no-entries').hidden = log.entries.length > 0;
  $('log-status').textContent = logStatus;
}
function toggleLog() {
  if (mode === 'log') setMode(logReturn);
  else {
    logReturn = mode;
    const things = revealedThings(state);
    $('log-what').replaceChildren();
    for (const [index, thing] of things.entries()) {
      const option = document.createElement('option');
      option.value = thing.id; option.textContent = `${LOG_TYPES[thing.type]} · sighting ${index + 1}`;
      $('log-what').appendChild(option);
    }
    $('log-what').disabled = things.length === 0;
    $('add-log-entry').disabled = things.length === 0;
    $('log-empty').hidden = things.length > 0;
    $('log-note').value = '';
    renderLog();
    setMode('log');
  }
  draw();
}

function setMode(next) {
  mode = next;
  pressed.clear();
  state.horn = false;
  state = resetLamp(state);
  audio.set(false);
  for (const panel of ['start', 'pause', 'help', 'dawn']) $(panel + '-panel').hidden = next !== panel;
  if (next === 'log') $('log-panel').showModal();
  else if ($('log-panel').open) $('log-panel').close();
  // An empty watch can still have a long saved history. Start its review at
  // the heading rather than focusing the close button below the visible page.
  const focus = { start: 'start', pause: 'resume', help: 'close-help', dawn: 'restart',
    log: $('log-what').disabled ? 'log-title' : 'log-what' }[next];
  if (focus) $(focus).focus({ preventScroll: true });
  else document.activeElement?.blur();
  previousTime = undefined;
  previousSampleTimestamp = undefined;
}
function finishNight() {
  if (recorded) return;
  recorded = true;
  const result = summary(state);
  $('summary').textContent = `${result.safe} ship${result.safe === 1 ? '' : 's'} passed safely. ${result.wrecked} ship${result.wrecked === 1 ? '' : 's'} wrecked.${result.lost ? ` ${result.lost} lost in distress.` : ''}${result.unseen ? ` ${result.unseen} passed unseen.` : ''}`;
  $('record-status').textContent = result.wrecked ? `${result.wrecked} vessel${result.wrecked === 1 ? '' : 's'} lost at the Teeth. The light kept turning.` : 'The watch is over. The light kept turning.';
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify({ version: 2, seed: state.seed, safe: result.safe, wrecked: result.wrecked }));
  } catch {
    $('record-status').textContent += ' This browser could not keep the morning record.';
  }
  setMode('dawn');
}
function draw() {
  renderer.draw(state, reducedMotion.matches);
  const showControls = mode === 'play' && state.time < 8 && !controlsDismissed;
  $('watch-controls').classList.toggle('is-faded', !showControls);
  $('watch-controls').setAttribute('aria-hidden', String(!showControls));
  setText('clock', watchTime(state.time));
  setText('bearing', `${Math.floor(state.beam).toString().padStart(3, '0')}° · ${(360 / state.speed).toFixed(1)} s / revolution`);
  setText('lens-state', mode === 'play' ? (heldInput(pressed).hold ? 'Lens held' : 'Lens turning clockwise') : 'Lens at rest');
  setText('horn-state', state.horn ? 'Horn sounding' : 'Horn silent');
  $('horn-state').classList.toggle('sounding', state.horn);
  setText('trust-state', `Skipper trust · ${Math.round(state.trust * 100)}%`);
  const keying = state.morse;
  const sent = keying.lastMessage;
  const preview = state.lamp && state.time * 1000 > keying.down
    ? decodeKeying([...keying.events, { down: keying.down, up: state.time * 1000 }]) : keying;
  const symbols = preview.symbols || sent?.symbols || '';
  const text = preview.text || sent?.text || '';
  setText('lamp-state', state.lamp ? '● Lamp open' : '○ Lamp shuttered');
  $('lamp-state').classList.toggle('sounding', state.lamp);
  setText('morse-symbols', symbols.replaceAll('.', '·').replaceAll('-', '−') || '—', true);
  setText('morse-text', text || 'Key K to signal', true);
  setText('morse-delivery', keying.events.length || state.lamp ? 'Keying…'
    : sent ? (sent.recipient === null ? 'Sent · no vessel in beam' : 'Sent · vessel in beam') : 'Directed to the vessel in the beam');
  audio.set(mode === 'play' && state.horn);
}
function advance(seconds) {
  if (mode === 'play') {
    state = step(state, heldInput(pressed), seconds);
    if (state.phase === 'dawn') finishNight();
  }
  draw();
}
function start() {
  state = createState(seed);
  state.settings.incomingWpm = Number($('incoming-wpm').value);
  if (!checkSchedule()) { setMode('start'); draw(); return; }
  audio.unlock(); recorded = false; controlsDismissed = false; setMode('play'); draw();
}
function checkSchedule() {
  const result = validateSchedule(state.schedule, state.nightParams);
  $('schedule-error').hidden = result.ok;
  $('schedule-error').textContent = result.ok ? '' : `Cannot start watch: invalid ship schedule (${result.violations.map((v) => `${v.index + 1}: ${v.reason}, ${v.passes}/${v.required} passes`).join('; ')}).`;
  $('start').disabled = !result.ok;
  return result.ok;
}
function toggleHelp() {
  if (mode === 'help') setMode(helpReturn);
  else { helpReturn = mode; setMode('help'); }
  draw();
}
$('start').addEventListener('click', start);
$('restart').addEventListener('click', start);
$('resume').addEventListener('click', () => { setMode('play'); draw(); });
$('help').addEventListener('click', toggleHelp);
$('close-help').addEventListener('click', toggleHelp);
$('close-log').addEventListener('click', toggleLog);
$('log-panel').addEventListener('cancel', (event) => { event.preventDefault(); toggleLog(); });
$('log-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (mode !== 'log') return;
  const entry = assembleEntry(state, $('log-what').value, $('log-note').value);
  if (!entry) {
    logStatus = 'Choose a vessel revealed during this watch and a note from the list.';
  } else {
    log.entries.push(entry);
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
      logStatus = 'Entry saved in this browser.';
    } catch {
      logStatus = 'Entry added for this visit. This browser could not save the log.';
    }
    $('log-note').value = '';
  }
  renderLog();
});
$('incoming-wpm').addEventListener('change', () => {
  state.settings.incomingWpm = Number($('incoming-wpm').value);
});
$('show-reference').addEventListener('change', () => {
  $('morse-reference').hidden = !$('show-reference').checked;
});
$('mute').addEventListener('click', () => {
  const muted = audio.toggleMute();
  $('mute').setAttribute('aria-pressed', String(muted));
  $('mute').textContent = muted ? 'Unmute horn' : 'Mute horn';
  draw();
});
window.addEventListener('keydown', (event) => {
  if (mode === 'play') { controlsDismissed = true; draw(); }
  const action = actionFor(event.code);
  if (!action || event.ctrlKey || event.metaKey || event.altKey) return;
  // Modal form controls retain native arrows, type-ahead and Space/Enter.
  // No gameplay key is queued; closing the page requires fresh presses.
  if (mode === 'log') {
    if (action === 'log' || action === 'pause') {
      event.preventDefault();
      if (!event.repeat) toggleLog();
    }
    return;
  }
  // Space/Enter still activate a focused menu button via native keyboard semantics.
  if (mode !== 'play' && action === 'hold') return;
  event.preventDefault();
  if (event.repeat) return;
  if (action === 'pause') {
    if (mode === 'help') setMode(helpReturn);
    else if (mode === 'play') setMode('pause');
    else if (mode === 'pause') setMode('play');
  } else if (action === 'log') toggleLog();
  else if (action === 'help') toggleHelp();
  else if (mode === 'play') pressed.add(event.code);
  draw();
});
window.addEventListener('keyup', (event) => { pressed.delete(event.code); });
window.addEventListener('pointerdown', () => {
  if (mode === 'play') { controlsDismissed = true; draw(); }
});
function suspend() {
  if (mode === 'play') { setMode('pause'); draw(); }
  else pressed.clear();
}
window.addEventListener('blur', suspend);
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
window.addEventListener('resize', () => { renderer.resize(); draw(); });
reducedMotion.addEventListener?.('change', draw);

// E2E opt-in requires browser automation. Normal visits never receive the hook.
// State is a read-only snapshot; advance drives the same input/sim/dawn path as RAF.
if (testMode) {
  Object.defineProperty(window, '__keeper', { value: Object.freeze({
    get seed() { return seed; },
    get state() { return structuredClone(state); },
    get mode() { return mode; },
    get frameTiming() {
      return { capacity: frameCapacity, warmupRemaining, samples: frameSamples.map((sample) => ({ ...sample })) };
    },
    resetFrameTiming,
    advance,
  }) });
}
function frame(timestamp) {
  const sampling = frameSamples && mode === 'play' && !document.hidden;
  const started = sampling ? performance.now() : 0;
  const elapsed = previousTime === undefined ? 0 : Math.min((timestamp - previousTime) / 1000, 0.1);
  previousTime = timestamp;
  if (mode === 'play') advance(elapsed);
  if (sampling && mode === 'play') {
    const workMs = performance.now() - started;
    if (warmupRemaining > 0) {
      warmupRemaining--;
      previousSampleTimestamp = undefined;
    } else {
      if (previousSampleTimestamp !== undefined) {
        frameSamples.push({ timestamp, intervalMs: timestamp - previousSampleTimestamp, workMs });
        if (frameSamples.length > frameCapacity) frameSamples.shift();
      }
      previousSampleTimestamp = timestamp;
    }
  } else previousSampleTimestamp = undefined;
  requestAnimationFrame(frame);
}
checkSchedule(); setMode('start'); draw(); requestAnimationFrame(frame);
