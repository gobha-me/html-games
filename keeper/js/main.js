import { createState, step, summary, validateSchedule, NIGHT_SECONDS } from './sim.js';
import { KEYS, CONTROL_LABELS, actionFor, heldInput } from './keys.js';
import { createRenderer } from './renderer.js';
import { createHorn } from './audio.js';
import { RECORD_KEY, parseRecord } from './record.js';

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
let previousTime;
let recorded = false;
let controlsDismissed = false;
const pressed = new Set();

for (const id of ['controls-list', 'title-controls', 'watch-controls-list']) {
  for (const action of Object.keys(KEYS)) {
    const item = document.createElement('li'); item.textContent = CONTROL_LABELS[action];
    $(id).appendChild(item);
  }
}
$('controls-hint').textContent = ['slow', 'fast', 'hold', 'horn', 'pause'].map((key) => CONTROL_LABELS[key]).join('    /    ');
try {
  const record = parseRecord(localStorage.getItem(RECORD_KEY));
  if (record) {
    $('previous-record').hidden = false;
    $('previous-record').textContent = `Last watch: ${record.safe} safe · ${record.wrecked} wrecked`;
  }
} catch { /* Storage may be disabled; the watch is always available. */ }

function setMode(next) {
  mode = next;
  pressed.clear();
  state.horn = false;
  audio.set(false);
  for (const panel of ['start', 'pause', 'help', 'dawn']) $(panel + '-panel').hidden = next !== panel;
  const focus = { start: 'start', pause: 'resume', help: 'close-help', dawn: 'restart' }[next];
  if (focus) $(focus).focus({ preventScroll: true });
  else document.activeElement?.blur();
  previousTime = undefined;
}
function finishNight() {
  if (recorded) return;
  recorded = true;
  const result = summary(state);
  $('summary').textContent = `${result.safe} ship passed safely. ${result.wrecked} ship wrecked.`;
  $('record-status').textContent = result.wrecked ? 'One vessel lost at the Teeth. The light kept turning.' : 'The trawler turned clear of the Teeth. All hands safe.';
  try {
    localStorage.setItem(RECORD_KEY, JSON.stringify({ version: 1, seed: state.seed, ...result }));
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
  const minutes = Math.floor(18 * 60 + state.time / NIGHT_SECONDS * 12 * 60) % (24 * 60);
  $('clock').textContent = `${Math.floor(minutes / 60).toString().padStart(2, '0')}:${(minutes % 60).toString().padStart(2, '0')}`;
  $('bearing').textContent = `${Math.floor(state.beam).toString().padStart(3, '0')}° · ${(360 / state.speed).toFixed(1)} s / revolution`;
  $('lens-state').textContent = mode === 'play' ? (heldInput(pressed).hold ? 'Lens held' : 'Lens turning clockwise') : 'Lens at rest';
  $('horn-state').textContent = state.horn ? 'Horn sounding' : 'Horn silent';
  $('horn-state').classList.toggle('sounding', state.horn);
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
  // Space/Enter still activate a focused menu button via native keyboard semantics.
  if (mode !== 'play' && action === 'hold') return;
  event.preventDefault();
  if (event.repeat) return;
  if (action === 'pause') {
    if (mode === 'help') setMode(helpReturn);
    else if (mode === 'play') setMode('pause');
    else if (mode === 'pause') setMode('play');
  } else if (action === 'help') toggleHelp();
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

// E2E opt-in requires browser automation. Normal visits never receive the hook.
// State is a read-only snapshot; advance drives the same input/sim/dawn path as RAF.
if (testMode) {
  Object.defineProperty(window, '__keeper', { value: Object.freeze({
    get seed() { return seed; },
    get state() { return structuredClone(state); },
    get mode() { return mode; },
    advance,
  }) });
}
function frame(timestamp) {
  const elapsed = previousTime === undefined ? 0 : Math.min((timestamp - previousTime) / 1000, 0.1);
  previousTime = timestamp;
  if (mode === 'play') advance(elapsed);
  requestAnimationFrame(frame);
}
checkSchedule(); setMode('start'); draw(); requestAnimationFrame(frame);
