// ============================================================================
// BACKBEAT // OVERDRIVE — Studio Deck Controller, Input & HUD Telemetry
// ============================================================================

import {
  TRACK_ROSTER,
  DIFFICULTY,
  LANE_KEYS,
  LANE_ALT_KEYS,
  JUDGE,
} from './config.js';
import { buildTrackChart, generateProceduralChart } from './chart.js';
import { AudioEngine } from './audio.js';
import { Game } from './game.js';
import { Renderer } from './renderer.js';

const STORAGE_KEY_OFFSET = 'backbeat.offsetMs.v2';
const STORAGE_KEY_SCORES = 'backbeat.scores.v2';

const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const audio = new AudioEngine();

let selectedTrackIdx = 0;
let selectedDiffId = 'normal';
let audioOffsetMs = Number(localStorage.getItem(STORAGE_KEY_OFFSET)) || 0;
let highScores = {};
try {
  highScores = JSON.parse(localStorage.getItem(STORAGE_KEY_SCORES) || '{}') || {};
} catch (_) {
  highScores = {};
}

let currentTrack = TRACK_ROSTER[0];
let currentChart = generateProceduralChart(currentTrack, DIFFICULTY[selectedDiffId]);
let game = new Game(currentChart, selectedDiffId, audioOffsetMs);

// Idle preview time (2.15s) so the 3D highway shows incoming notes, chords & hold ribbons immediately
let idlePreviewSec = 2.15;
let paused = false;
let trackStarted = false;

function getBestScore(trackId, diffId) {
  return Number(highScores[`${trackId}:${diffId}`]) || 0;
}

function saveBestScore(trackId, diffId, score) {
  const key = `${trackId}:${diffId}`;
  const prev = Number(highScores[key]) || 0;
  if (score > prev) {
    highScores[key] = score;
    try {
      localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(highScores));
    } catch (_) {}
    return true;
  }
  return false;
}

function renderTrackCrate() {
  const listEl = document.getElementById('track-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  TRACK_ROSTER.forEach((tr, idx) => {
    const card = document.createElement('div');
    card.className = 'track-card' + (idx === selectedTrackIdx ? ' selected' : '');
    const best = getBestScore(tr.id, selectedDiffId);
    const mins = Math.floor(tr.duration / 60);
    const secs = String(tr.duration % 60).padStart(2, '0');

    card.innerHTML = `
      <img src="${tr.cover}" alt="${tr.title}" class="track-cover">
      <div class="tc-info">
        <div class="tc-title">${tr.title}</div>
        <div class="tc-sub">${tr.artist}</div>
        <div class="tc-badges">
          <span style="color:${tr.accent}">${tr.bpm} BPM</span>
          <span style="color:#94a3b8">· ${mins}:${secs}</span>
          <span style="color:#ffd21f;margin-left:auto">${best > 0 ? best.toLocaleString() : tr.genre}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => {
      selectTrack(idx);
    });
    listEl.appendChild(card);
  });
}

async function selectTrack(idx, autoStart = false) {
  selectedTrackIdx = idx;
  currentTrack = TRACK_ROSTER[selectedTrackIdx];
  audio.pause();
  trackStarted = false;
  paused = false;

  // Immediately build procedural fallback chart so UI/canvas updates synchronously
  currentChart = generateProceduralChart(currentTrack, DIFFICULTY[selectedDiffId]);
  game = new Game(currentChart, selectedDiffId, audioOffsetMs);
  renderTrackCrate();
  updateOverlay('ready');
  syncHud(idlePreviewSec);

  // Load JSON chart if external URL exists
  const loadedChart = await buildTrackChart(currentTrack, selectedDiffId);
  if (currentTrack === TRACK_ROSTER[selectedTrackIdx]) {
    currentChart = loadedChart;
    game = new Game(currentChart, selectedDiffId, audioOffsetMs);
    syncHud(idlePreviewSec);
  }

  if (autoStart) {
    startPlayback(false);
  }
}

async function startPlayback(enableAutoDj = false) {
  const overlay = document.getElementById('stage-overlay');
  if (overlay) overlay.style.display = 'none';

  await audio.init();
  await audio.resume();
  await audio.loadHitSfx('assets/hit.mp3');
  await audio.prepareTrack(currentTrack, currentChart);

  game = new Game(currentChart, selectedDiffId, audioOffsetMs);
  game.autoPlay = Boolean(enableAutoDj);
  updateAutoBtn();

  trackStarted = true;
  paused = false;
  audio.play(0);
  document.getElementById('btn-play').textContent = '↻ Restart Track';
}

function updateOverlay(mode, results = null) {
  const overlay = document.getElementById('stage-overlay');
  if (!overlay) return;
  overlay.style.display = 'block';

  const eye = document.getElementById('ov-eyebrow');
  const title = document.getElementById('ov-title');
  const sub = document.getElementById('ov-sub');
  const startBtn = document.getElementById('btn-ov-start');

  if (mode === 'complete' && results) {
    eye.textContent = `TRACK COMPLETE // GRADE ${results.grade}`;
    title.textContent = `${results.score.toLocaleString()} PTS (${results.accuracy}%)`;
    sub.innerHTML = `Max Combo: <b>${results.maxCombo}×</b> · Perfect: <b>${results.perfect}</b> · Good: <b>${results.good}</b> · Hold Ticks: <b>${results.holds}</b> · Miss: <b>${results.miss}</b>`;
    startBtn.textContent = '↻ Play Again [Enter]';
  } else if (mode === 'paused') {
    eye.textContent = 'STUDIO DECK PAUSED';
    title.textContent = currentTrack.title;
    sub.innerHTML = 'Press <b>[P]</b> or click below to resume the highway.';
    startBtn.textContent = '▶ Resume Track';
  } else {
    eye.textContent = `${currentTrack.genre} // ${currentTrack.bpm} BPM`;
    title.textContent = currentTrack.title;
    sub.innerHTML = `Select any track &amp; difficulty on the left, then press <b>▶ Drop The Beat</b> or strike <b>[D] [F] [J] [K]</b>.`;
    startBtn.textContent = '▶ Drop The Beat [Enter]';
  }
}

function updateAutoBtn() {
  const btn = document.getElementById('btn-auto');
  if (!btn) return;
  btn.textContent = game.autoPlay ? '🤖 Auto-DJ: ON' : '🤖 Auto-DJ: OFF';
  btn.style.borderColor = game.autoPlay ? '#00ffcc' : '';
  btn.style.color = game.autoPlay ? '#00ffcc' : '';
}

function formatSec(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, '0');
  return `${String(m).padStart(2, '0')}:${r}`;
}

function syncHud(timeSec) {
  const acc = game.getAccuracy();
  const { grade, color } = game.getGradeInfo();
  const dur = currentChart.duration || currentTrack.duration || 75;

  document.getElementById('hud-track-pill').textContent = currentTrack.title;
  document.getElementById('hud-track-pill').style.color = currentTrack.accent;
  document.getElementById('hud-bpm-tag').textContent = `${currentTrack.bpm} BPM`;
  document.getElementById('hud-note-count').textContent = `${game.notes.length} NOTES`;

  document.getElementById('hud-score').textContent = game.score.toLocaleString();
  document.getElementById('hud-combo').textContent = `${game.combo}×`;
  document.getElementById('hud-accuracy').textContent = `${acc.toFixed(1)}% · ${grade}`;
  document.getElementById('hud-accuracy').style.color = color;

  const badge = document.getElementById('hud-grade-badge');
  badge.textContent = grade;
  badge.style.color = color;
  badge.style.borderColor = color;

  document.getElementById('hud-acc-detail').textContent = `${acc.toFixed(1)}%`;
  document.getElementById('hud-acc-detail').style.color = color;
  document.getElementById('hud-max-combo').textContent = `${game.maxCombo}×`;

  const meanMs = game.getMeanOffsetMs();
  document.getElementById('hud-mean-offset').textContent =
    `${meanMs > 0 ? '+' : ''}${meanMs} ms`;
  document.getElementById('hud-high-score').textContent =
    getBestScore(currentTrack.id, selectedDiffId).toLocaleString();

  document.getElementById('t-perfect').textContent = game.tally.perfect;
  document.getElementById('t-good').textContent = game.tally.good;
  document.getElementById('t-holds').textContent = game.tally.holds;
  document.getElementById('t-miss').textContent = game.tally.miss;

  document.getElementById('hud-time-clock').textContent =
    `${formatSec(timeSec)} / ${formatSec(dur)}`;
  const progPct = Math.min(100, Math.max(0, (timeSec / dur) * 100));
  document.getElementById('stage-progress-bar').style.width = `${progPct.toFixed(1)}%`;

  // Overdrive Core
  const odBar = document.getElementById('hud-od-bar');
  const odStatus = document.getElementById('hud-od-status');
  if (game.overdriveActive) {
    const pct = Math.min(100, (game.overdriveTimer / 7.5) * 100);
    odBar.style.width = `${pct}%`;
    odStatus.textContent = `2× FEVER (${game.overdriveTimer.toFixed(1)}S)`;
    odStatus.style.color = '#00ffcc';
  } else {
    odBar.style.width = `${Math.round(game.overdriveCharge)}%`;
    odStatus.textContent =
      game.overdriveCharge >= 50
        ? `READY (${Math.round(game.overdriveCharge)}%) [SPC]`
        : `${Math.round(game.overdriveCharge)}% CHARGE`;
    odStatus.style.color = game.overdriveCharge >= 50 ? '#00ffcc' : '#ffd21f';
  }
}

function onNoteJudged(lane, judgement) {
  renderer.addFlash(lane, judgement);
  if (judgement !== JUDGE.MISS) {
    audio.hit(lane, judgement === JUDGE.PERFECT);
  }
}

// Difficulty buttons
document.getElementById('diff-row').addEventListener('click', (e) => {
  const btn = e.target.closest('.diff-btn');
  if (!btn) return;
  document
    .querySelectorAll('.diff-btn')
    .forEach((b) => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedDiffId = btn.dataset.diff;
  selectTrack(selectedTrackIdx, false);
});

// Calibration buttons
function updateCalLabel() {
  const sign = audioOffsetMs > 0 ? '+' : '';
  document.getElementById('cal-value').textContent = `${sign}${audioOffsetMs} ms`;
  localStorage.setItem(STORAGE_KEY_OFFSET, String(audioOffsetMs));
  game.audioOffsetSec = (audioOffsetMs + (currentChart.offset || 0) * 1000) / 1000;
}
updateCalLabel();

document.getElementById('cal-down').addEventListener('click', () => {
  audioOffsetMs = Math.max(-150, audioOffsetMs - 5);
  updateCalLabel();
});
document.getElementById('cal-up').addEventListener('click', () => {
  audioOffsetMs = Math.min(150, audioOffsetMs + 5);
  updateCalLabel();
});
document.getElementById('cal-test').addEventListener('click', async () => {
  await audio.init();
  await audio.resume();
  audio.pulse();
});

// Top bar & overlay buttons
document.getElementById('btn-play').addEventListener('click', () => {
  startPlayback(game.autoPlay);
});
document.getElementById('btn-ov-start').addEventListener('click', () => {
  if (paused && trackStarted) {
    togglePause();
  } else {
    startPlayback(false);
  }
});
document.getElementById('btn-ov-demo').addEventListener('click', () => {
  startPlayback(true);
});
document.getElementById('btn-overdrive').addEventListener('click', () => {
  if (game.activateOverdrive()) {
    audio.overdriveSfx();
  }
});
document.getElementById('btn-auto').addEventListener('click', () => {
  if (!trackStarted) {
    startPlayback(true);
  } else {
    game.autoPlay = !game.autoPlay;
    updateAutoBtn();
  }
});

function togglePause() {
  if (!trackStarted) return;
  paused = !paused;
  if (paused) {
    audio.pause();
    updateOverlay('paused');
  } else {
    document.getElementById('stage-overlay').style.display = 'none';
    audio.resumeTrack();
  }
}

document.getElementById('btn-pause').addEventListener('click', togglePause);
document.getElementById('btn-mute').addEventListener('click', () => {
  const muted = audio.toggleMute();
  document.getElementById('btn-mute').textContent = muted ? '🔇 Muted' : '🔊 Audio';
});

// Keyboard Controls (D F J K or Arrow Keys)
const heldKeys = new Set();
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;

  if (e.code === 'Enter') {
    e.preventDefault();
    startPlayback(game.autoPlay);
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    togglePause();
    return;
  }
  if (e.code === 'KeyA') {
    e.preventDefault();
    game.autoPlay = !game.autoPlay;
    updateAutoBtn();
    return;
  }
  if (e.code === 'KeyM') {
    e.preventDefault();
    const muted = audio.toggleMute();
    document.getElementById('btn-mute').textContent = muted ? '🔇 Muted' : '🔊 Audio';
    return;
  }
  if (e.code === 'Space') {
    e.preventDefault();
    if (game.activateOverdrive()) {
      audio.overdriveSfx();
    }
    return;
  }

  let lane = LANE_KEYS.indexOf(e.code);
  if (lane < 0) lane = LANE_ALT_KEYS.indexOf(e.code);
  if (lane < 0) return;

  e.preventDefault();
  heldKeys.add(e.code);

  if (!trackStarted) {
    startPlayback(false);
    return;
  }
  if (paused) return;

  game.press(lane, audio.getTime(), onNoteJudged);
});

window.addEventListener('keyup', (e) => {
  heldKeys.delete(e.code);
  let lane = LANE_KEYS.indexOf(e.code);
  if (lane < 0) lane = LANE_ALT_KEYS.indexOf(e.code);
  if (lane >= 0) {
    game.release(lane, trackStarted ? audio.getTime() : idlePreviewSec);
  }
});

// Mouse / Touch on Highway Lanes
canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const relX = (e.clientX - rect.left) / rect.width;
  const lane = Math.min(3, Math.max(0, Math.floor(relX * 4)));
  if (!trackStarted) {
    startPlayback(false);
    return;
  }
  if (!paused) {
    game.press(lane, audio.getTime(), onNoteJudged);
    setTimeout(() => game.release(lane, audio.getTime()), 140);
  }
});

window.addEventListener('resize', () => renderer.resize());
renderer.resize();
renderTrackCrate();

// Optional ?preview=showcase query hook for visual verification of mid-track Overdrive Fever, Hold Ribbons & Chords
if (new URLSearchParams(window.location.search).get('preview') === 'showcase') {
  selectedTrackIdx = 1; // NEON HORIZON (Outrun Synthwave)
  selectedDiffId = 'hard';
  currentTrack = TRACK_ROSTER[1];
  currentChart = generateProceduralChart(currentTrack, DIFFICULTY.hard);
  game = new Game(currentChart, 'hard', 0);
  renderTrackCrate();

  // Simulate Perfect hits up to t = 14.2s
  idlePreviewSec = 14.2;
  for (const n of game.notes) {
    if (n.time < 13.95) {
      game.applyJudge(n, JUDGE.PERFECT, n.time, -2);
    }
  }
  game.overdriveCharge = 100;
  game.activateOverdrive();
  game.overdriveTimer = 6.4;
  game.laneHeld[1] = true;
  game.laneHeld[2] = true;
  renderer.addFlash(1, JUDGE.PERFECT);
  renderer.addFlash(2, JUDGE.PERFECT);
  const ov = document.getElementById('stage-overlay');
  if (ov) ov.style.display = 'none';
}

let hudTimer = 0;
function loop() {
  const tSec = trackStarted ? audio.getTime() : idlePreviewSec;

  if (trackStarted && !paused) {
    game.update(tSec, onNoteJudged);
    if (game.checkFinished(audio.getDuration(), tSec)) {
      trackStarted = false;
      audio.pause();
      const res = game.results();
      saveBestScore(currentTrack.id, selectedDiffId, res.score);
      renderTrackCrate();
      updateOverlay('complete', res);
    }
  }

  const spectrum = audio.getSpectrum();
  renderer.draw(game, tSec, spectrum, currentTrack);

  hudTimer++;
  if (hudTimer % 4 === 0) {
    syncHud(tSec);
  }

  requestAnimationFrame(loop);
}

// Synchronous first frame render so headless browser screenshots always capture a painted stage
syncHud(idlePreviewSec);
renderer.draw(game, idlePreviewSec, audio.getSpectrum(), currentTrack);
window.__backbeat = { game, renderer, audio };
requestAnimationFrame(loop);
