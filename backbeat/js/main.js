/**
 * BACKBEAT — entry point. Wires menu → game → results, input, calibration,
 * and high-score persistence. Timing is driven by the Web Audio clock.
 */

import { DIFFICULTY, LANE_KEYS, JUDGE } from './config.js';
import { loadManifest, loadChart } from './chart.js';
import { AudioEngine } from './audio.js';
import { Game } from './game.js';
import { Renderer } from './renderer.js';

const $ = id => document.getElementById(id);
const audio = new AudioEngine();

const state = {
  manifest: null,
  chart: null,
  trackFile: null,
  difficulty: 'normal',
  game: null,
  renderer: null,
  raf: null,
  paused: false,
  audioOffsetMs: Number(localStorage.getItem('backbeat:offset')) || 0
};

/* ── screens ── */
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

/* ── menu setup ── */
async function initMenu() {
  renderCalValue();
  try {
    state.manifest = await loadManifest();
    renderTracks(state.manifest.tracks || []);
    if ((state.manifest.tracks || []).length) selectTrack(state.manifest.tracks[0]);
  } catch (e) {
    $('track-list').innerHTML = '<div class="track-item loading">No charts found — generate a track first.</div>';
  }
  $('menu-high-score').textContent = localStorage.getItem('backbeat:highscore') || 0;
}

function renderTracks(tracks) {
  const el = $('track-list');
  el.innerHTML = '';
  tracks.forEach(t => {
    const div = document.createElement('div');
    div.className = 'track-item';
    div.dataset.file = t.file;
    div.innerHTML = `<span class="track-name">${t.title || t.file}</span><span class="track-meta">${t.bpm ? t.bpm + ' BPM' : ''}</span>`;
    div.addEventListener('click', () => selectTrack(t));
    el.appendChild(div);
  });
}

async function selectTrack(t) {
  document.querySelectorAll('.track-item').forEach(i => i.classList.toggle('selected', i.dataset.file === t.file));
  state.trackFile = t.file;
  try {
    state.chart = await loadChart('charts/', t.file);
  } catch (e) {
    state.chart = null;
  }
}

/* ── difficulty ── */
$('diff-row').addEventListener('click', e => {
  const btn = e.target.closest('.diff-btn');
  if (!btn) return;
  document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  state.difficulty = btn.dataset.diff;
});

/* ── calibration ── */
function renderCalValue() { $('cal-value').textContent = `${state.audioOffsetMs} ms`; }
function setOffset(v) {
  state.audioOffsetMs = Math.max(-300, Math.min(300, v));
  localStorage.setItem('backbeat:offset', state.audioOffsetMs);
  renderCalValue();
}
$('cal-up').addEventListener('click', () => setOffset(state.audioOffsetMs + 5));
$('cal-down').addEventListener('click', () => setOffset(state.audioOffsetMs - 5));
$('cal-test').addEventListener('click', async () => { await audio.init(); await audio.resume(); audio.pulse(); });

/* ── game flow ── */
$('start-btn').addEventListener('click', startGame);
$('retry-btn').addEventListener('click', startGame);
$('menu-btn').addEventListener('click', () => { stopLoop(); show('menu-screen'); });
$('resume-btn').addEventListener('click', resumeGame);
$('quit-btn').addEventListener('click', quitToMenu);

async function startGame() {
  if (!state.chart) { alert('No track loaded yet.'); return; }
  await audio.init();
  await audio.resume();
  audio.loadHitSfx('assets/hit.mp3'); // fire-and-forget; falls back to blip

  // load audio (chart.audio points to assets/)
  try {
    await audio.loadTrack(state.chart.audio);
  } catch (e) {
    alert('Could not load audio: ' + state.chart.audio);
    return;
  }

  state.game = new Game(state.chart, state.difficulty, state.audioOffsetMs);
  if (!state.renderer) state.renderer = new Renderer($('game-canvas'));
  state.paused = false;
  $('pause-overlay').style.display = 'none';
  updateHUD();
  show('game-screen');

  // brief lead-in so the player sees the field before the first note
  audio.play(0);
  loop();
}

function loop() {
  state.raf = requestAnimationFrame(loop);
  if (state.paused) return;
  const t = audio.getTime();
  const g = state.game;
  g.update(t);
  state.renderer.draw(g, t, DIFFICULTY[state.difficulty].noteSpeed);
  updateHUD();
  if (g.checkFinished(audio.getDuration(), t)) endGame();
}

function stopLoop() { if (state.raf) cancelAnimationFrame(state.raf); state.raf = null; }

function updateHUD() {
  const g = state.game;
  if (!g) return;
  $('score').textContent = g.score;
  $('combo').textContent = g.combo;
  $('accuracy').textContent = g.getAccuracy() + '%';
  // judgement flash
  if (g.lastJudgement && performance.now() - g.lastJudgement.at < 350) {
    const j = $('judgement');
    j.textContent = g.lastJudgement.type.toUpperCase();
    j.className = 'judgement show ' + g.lastJudgement.type;
  } else {
    $('judgement').className = 'judgement';
  }
}

function endGame() {
  stopLoop();
  audio.stopSource();
  audio.playing = false;
  const r = state.game.results();
  $('final-score').textContent = r.score;
  $('final-combo').textContent = r.maxCombo;
  $('final-accuracy').textContent = r.accuracy + '%';
  $('t-perfect').textContent = r.perfect;
  $('t-good').textContent = r.good;
  $('t-miss').textContent = r.miss;

  const prev = Number(localStorage.getItem('backbeat:highscore')) || 0;
  const isNew = r.score > prev;
  if (isNew) localStorage.setItem('backbeat:highscore', r.score);
  $('new-high-score').style.display = isNew ? 'block' : 'none';
  $('menu-high-score').textContent = localStorage.getItem('backbeat:highscore');
  show('results-screen');
}

/* ── pause ── */
function pauseGame() {
  if (state.paused) return;
  state.paused = true;
  audio.pause();
  $('pause-overlay').style.display = 'flex';
}
function resumeGame() {
  if (!state.paused) return;
  state.paused = false;
  audio.resumeTrack();
  $('pause-overlay').style.display = 'none';
}
function quitToMenu() {
  state.paused = false;
  stopLoop();
  audio.pause();
  $('pause-overlay').style.display = 'none';
  show('menu-screen');
}

/* ── input ── */
window.addEventListener('keydown', async e => {
  if (e.code === 'KeyP') {
    if ($('game-screen').classList.contains('active')) {
      state.paused ? resumeGame() : pauseGame();
    }
    return;
  }
  if (!$('game-screen').classList.contains('active') || state.paused || !state.game) return;
  const lane = LANE_KEYS.indexOf(e.code);
  if (lane === -1) return;
  const result = state.game.press(lane, audio.getTime());
  if (result) {
    state.renderer.addFlash(lane, result);
    if (result !== JUDGE.MISS) audio.hit(lane);
  }
});

/* ── touch (tap lanes) ── */
$('game-canvas').addEventListener('pointerdown', e => {
  if (state.paused || !state.game) return;
  const rect = e.target.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const lane = Math.min(3, Math.max(0, Math.floor(x * 4)));
  const result = state.game.press(lane, audio.getTime());
  if (result) {
    state.renderer.addFlash(lane, result);
    if (result !== JUDGE.MISS) audio.hit(lane);
  }
});

initMenu();
