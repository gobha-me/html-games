// ============================================================================
// BACKBEAT // OVERDRIVE — Studio Deck Controller, Input & Stage Telemetry
// ============================================================================

import {
  TRACK_ROSTER,
  TOUR_VENUES,
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
const STORAGE_KEY_GRADES = 'backbeat.grades.v2';
const STORAGE_KEY_TOUR = 'backbeat.tourStage.v1';

const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas);
const audio = new AudioEngine();

const urlParams = new URLSearchParams(window.location.search);
let selectedTrackIdx = 0;
let selectedDiffId = 'tour';
let customSeed = urlParams.get('seed') || '';
if (urlParams.get('track')) {
  const idx = TRACK_ROSTER.findIndex((t) => t.id === urlParams.get('track'));
  if (idx >= 0) selectedTrackIdx = idx;
}
if (urlParams.get('diff') && DIFFICULTY[urlParams.get('diff')]) {
  selectedDiffId = DIFFICULTY[urlParams.get('diff')].id;
}
let playMode = 'jukebox'; // 'jukebox' | 'tour'
let tourStageIdx = Math.min(TOUR_VENUES.length - 1, Math.max(0, Number(localStorage.getItem(STORAGE_KEY_TOUR)) || 0));
let audioOffsetMs = Number(localStorage.getItem(STORAGE_KEY_OFFSET)) || 0;
let highScores = {};
let bestGrades = {};
try {
  highScores = JSON.parse(localStorage.getItem(STORAGE_KEY_SCORES) || '{}') || {};
  bestGrades = JSON.parse(localStorage.getItem(STORAGE_KEY_GRADES) || '{}') || {};
} catch (_) {
  highScores = {};
  bestGrades = {};
}

let currentTrack = TRACK_ROSTER[selectedTrackIdx];
let currentChart = generateProceduralChart(currentTrack, DIFFICULTY[selectedDiffId], customSeed);
let game = new Game(currentChart, selectedDiffId, audioOffsetMs);

// Idle preview time (2.15s) so the 3D highway shows incoming notes, chords & hold ribbons immediately
let idlePreviewSec = 2.15;
let paused = false;
let trackStarted = false;
const previewParam = new URLSearchParams(window.location.search).get('preview');
const isShowcasePreview = previewParam === 'showcase' || previewParam === 'combat';

function setBtnLabel(id, text) {
  const el = document.getElementById(id);
  if (!el) return;
  const span = el.querySelector('span');
  if (span) span.textContent = text;
  else el.textContent = text;
}

function getBestScore(trackId, diffId) {
  return Number(highScores[`${trackId}:${diffId}`]) || 0;
}

function getBestGrade(trackId, diffId) {
  return bestGrades[`${trackId}:${diffId}`] || '';
}

function saveBestScore(trackId, diffId, score, grade = '') {
  const key = `${trackId}:${diffId}`;
  const prev = Number(highScores[key]) || 0;
  if (score > prev) {
    highScores[key] = score;
    if (grade) bestGrades[key] = grade;
    try {
      localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(highScores));
      localStorage.setItem(STORAGE_KEY_GRADES, JSON.stringify(bestGrades));
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
    const grade = getBestGrade(tr.id, selectedDiffId);
    const mins = Math.floor(tr.duration / 60);
    const secs = String(tr.duration % 60).padStart(2, '0');

    card.innerHTML = `
      <img src="${tr.cover}" alt="${tr.title}" class="track-cover">
      <div class="tc-info">
        <div class="tc-title">${tr.title}</div>
        <div class="tc-sub">${tr.genre}</div>
        <div class="tc-badges">
          <span style="color:${tr.accent}">${tr.bpm} BPM</span>
          <span style="color:#ffd21f;margin-left:auto">${best > 0 ? `${grade ? grade + ' · ' : ''}${best.toLocaleString()}` : `${mins}:${secs}`}</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => {
      selectTrack(idx);
    });
    listEl.appendChild(card);
  });

  const vinylCover = document.getElementById('vinyl-cover');
  if (vinylCover && currentTrack) {
    vinylCover.src = currentTrack.cover;
    vinylCover.alt = currentTrack.title;
  }
}

async function selectTrack(idx, autoStart = false) {
  selectedTrackIdx = idx;
  currentTrack = TRACK_ROSTER[selectedTrackIdx];
  audio.pause();
  trackStarted = false;
  paused = false;
  document.body.classList.toggle('playing', isShowcasePreview);
  const overlay = document.getElementById('stage-overlay');
  if (overlay) overlay.style.display = 'none';

  // Immediately build procedural fallback chart so UI/canvas updates synchronously
  currentChart = generateProceduralChart(currentTrack, DIFFICULTY[selectedDiffId], customSeed);
  game = new Game(currentChart, selectedDiffId, audioOffsetMs);
  renderTrackCrate();
  syncHud(idlePreviewSec);

  // Load JSON chart if external URL exists
  const loadedChart = await buildTrackChart(currentTrack, selectedDiffId, customSeed);
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
  document.body.classList.add('playing');
  audio.play(0);
}

function openTrackCrate() {
  audio.pause();
  trackStarted = false;
  paused = false;
  document.body.classList.remove('playing');
  const overlay = document.getElementById('stage-overlay');
  if (overlay) overlay.style.display = 'none';
  syncHud(idlePreviewSec);
}

function updateOverlay(mode, results = null) {
  const overlay = document.getElementById('stage-overlay');
  if (!overlay) return;

  if (mode === 'ready') {
    overlay.style.display = 'none';
    return;
  }
  overlay.style.display = 'block';

  const eye = document.getElementById('ov-eyebrow');
  const title = document.getElementById('ov-title');
  const sub = document.getElementById('ov-sub');

  if (mode === 'complete' && results) {
    eye.textContent = `TRACK COMPLETE // GRADE ${results.grade}`;
    title.textContent = `${results.score.toLocaleString()} PTS (${results.accuracy}%)`;
    sub.innerHTML = `Max Combo: <b>${results.maxCombo}×</b> · Perfect: <b>${results.perfect}</b> · Good: <b>${results.good}</b> · Hold Ticks: <b>${results.holds}</b> · Miss: <b>${results.miss}</b>`;
    setBtnLabel('btn-ov-start', '↻ Play Again [Enter]');
    setBtnLabel('btn-ov-demo', '💿 Select Another Track');
  } else if (mode === 'paused') {
    eye.textContent = 'STUDIO DECK PAUSED';
    title.textContent = currentTrack.title;
    sub.innerHTML = 'Press <b>[P]</b> or click below to resume the highway.';
    setBtnLabel('btn-ov-start', '▶ Resume Track');
    setBtnLabel('btn-ov-demo', '💿 Change Track');
  }
}

function updateAutoBtn() {
  const btn = document.getElementById('btn-auto');
  if (!btn) return;
  setBtnLabel('btn-auto', game.autoPlay ? '🤖 AUTO-DJ: ON' : '🤖 AUTO-DJ [A]');
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

  const genreTag = document.getElementById('hud-genre-tag');
  if (genreTag) {
    genreTag.textContent = `${currentTrack.genre.toUpperCase()} // ${trackStarted || isShowcasePreview ? 'NOW SPINNING' : 'ATTRACT PREVIEW'}`;
  }

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

  const accDetail = document.getElementById('hud-acc-detail');
  if (accDetail) {
    accDetail.textContent = `${acc.toFixed(1)}%`;
    accDetail.style.color = color;
  }
  document.getElementById('hud-max-combo').textContent = `${game.maxCombo}×`;

  const meanMs = game.getMeanOffsetMs();
  const meanEl = document.getElementById('hud-mean-offset');
  if (meanEl) {
    meanEl.textContent = `${meanMs > 0 ? '+' : ''}${meanMs} ms`;
  }

  // Timing offset needle gauge (-60ms .. +60ms mapped to 10% .. 90%)
  const needleEl = document.getElementById('tm-needle');
  if (needleEl) {
    const sampleMs = game.lastJudgement ? game.lastOffsetMs : meanMs;
    const clamped = Math.max(-60, Math.min(60, sampleMs));
    const pct = 50 + (clamped / 60) * 40;
    needleEl.style.left = `${pct.toFixed(1)}%`;
    const absMs = Math.abs(sampleMs);
    const nCol = absMs <= 22 ? '#00ffcc' : absMs <= 45 ? '#ffd21f' : '#ff3b5c';
    needleEl.style.background = nCol;
    needleEl.style.boxShadow = `0 0 10px ${nCol}`;
  }

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

  // Vertical Plasma Overdrive Capacitor Tube
  const odBar = document.getElementById('hud-od-bar');
  const odStatus = document.getElementById('hud-od-status');
  if (game.overdriveActive) {
    const pct = Math.min(100, (game.overdriveTimer / 7.5) * 100);
    odBar.style.height = `${pct}%`;
    odStatus.textContent = `2× FEVER (${game.overdriveTimer.toFixed(1)}S)`;
    odStatus.style.color = '#00ffcc';
  } else {
    const pct = Math.round(game.overdriveCharge);
    odBar.style.height = `${pct}%`;
    odStatus.textContent =
      pct >= 50 ? `READY (${pct}%) [SPC]` : `${pct}% CHARGE`;
    odStatus.style.color = pct >= 50 ? '#00ffcc' : '#ffd21f';
  }
}

function onNoteJudged(lane, judgement, _offsetMs, note) {
  renderer.addFlash(lane, judgement, Boolean(note && note.chord));
  if (judgement !== JUDGE.MISS) {
    audio.hit(lane, judgement === JUDGE.PERFECT);
  }
}

function syncTourBanner() {
  const banner = document.getElementById('tour-banner');
  if (!banner) return;
  banner.style.display = playMode === 'tour' ? 'flex' : 'none';
  const venue = TOUR_VENUES[tourStageIdx] || TOUR_VENUES[0];
  renderer.activeTourVenue = playMode === 'tour' ? venue : null;
  if (playMode === 'tour') {
    document.getElementById('tour-venue-name').textContent = `STAGE ${venue.stage}/5 · ${venue.name}`;
    document.getElementById('tour-goal-score').textContent = `GOAL: ${venue.goalScore.toLocaleString()}`;
    const unlocked = TOUR_VENUES.slice(0, tourStageIdx).map((v) => v.gearBadge);
    document.getElementById('tour-gear-unlocked').textContent =
      unlocked.length > 0 ? `GEAR: ${unlocked.join(' · ')}` : `CLEAR GOAL TO UNLOCK: ${venue.gearBadge}`;
  }
}

document.getElementById('mode-row')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-pill');
  if (!btn) return;
  document.querySelectorAll('.mode-pill').forEach((b) => b.classList.remove('selected'));
  btn.classList.add('selected');
  playMode = btn.dataset.mode;
  if (playMode === 'tour') {
    const venue = TOUR_VENUES[tourStageIdx] || TOUR_VENUES[0];
    selectedDiffId = venue.diffId;
    document.querySelectorAll('.diff-btn').forEach((b) => {
      b.classList.toggle('selected', b.dataset.diff === selectedDiffId);
    });
    const tIdx = TRACK_ROSTER.findIndex((t) => t.id === venue.trackId);
    if (tIdx >= 0) selectTrack(tIdx, false);
  }
  syncTourBanner();
});

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
  audioOffsetMs = Math.max(-100, audioOffsetMs - 5);
  updateCalLabel();
});
document.getElementById('cal-up').addEventListener('click', () => {
  audioOffsetMs = Math.min(100, audioOffsetMs + 5);
  updateCalLabel();
});

// Interactive 4-Beat 120 BPM Cowbell Tap Calibration (#40)
let calStartPerf = 0;
let calTaps = [];
let calActive = false;
document.getElementById('cal-test').addEventListener('click', async () => {
  await audio.init();
  await audio.resume();
  const now = performance.now();
  if (calActive && now - calStartPerf < 2400) {
    // Record player tap against nearest 500ms beat
    const elapsed = now - calStartPerf;
    const nearestBeat = Math.round(elapsed / 500) * 500;
    const errMs = Math.round(elapsed - nearestBeat);
    if (Math.abs(errMs) <= 160) {
      calTaps.push(errMs);
    }
    audio.pulse();
    if (calTaps.length >= 3) {
      const avg = Math.round(calTaps.reduce((a, b) => a + b, 0) / calTaps.length);
      audioOffsetMs = Math.max(-100, Math.min(100, avg));
      updateCalLabel();
      calActive = false;
      document.getElementById('cal-test').textContent = '✓ SYNC';
      setTimeout(() => {
        document.getElementById('cal-test').textContent = '🥁 TAP';
      }, 1500);
    }
    return;
  }
  calActive = true;
  calStartPerf = now;
  calTaps = [];
  document.getElementById('cal-test').textContent = 'TAP 4×';
  for (let b = 0; b < 4; b++) {
    setTimeout(() => {
      if (calActive) audio.pulse();
    }, b * 500);
  }
  setTimeout(() => {
    if (calActive) {
      calActive = false;
      document.getElementById('cal-test').textContent = '🥁 TAP';
    }
  }, 2450);
});

// Shareable Beatmap Seed URL generator (#40)
document.getElementById('btn-share-seed')?.addEventListener('click', () => {
  if (!customSeed) {
    customSeed = `bb89-${Math.floor(1000 + Math.random() * 9000)}`;
  } else {
    customSeed = `bb89-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  const shareUrl = `${window.location.pathname}?track=${currentTrack.id}&diff=${selectedDiffId}&seed=${customSeed}`;
  window.history.replaceState(null, '', shareUrl);
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
  }
  const btn = document.getElementById('btn-share-seed');
  if (btn) {
    btn.textContent = `✓ ${customSeed.toUpperCase()}`;
    setTimeout(() => {
      btn.textContent = '🔗 SEED';
    }, 1800);
  }
  selectTrack(selectedTrackIdx, false);
});

// Jukebox & Transport buttons
document.getElementById('btn-play').addEventListener('click', () => {
  startPlayback(false);
});
document.getElementById('btn-tracks').addEventListener('click', openTrackCrate);
document.getElementById('btn-ov-start').addEventListener('click', () => {
  if (paused && trackStarted) {
    togglePause();
  } else {
    startPlayback(false);
  }
});
document.getElementById('btn-ov-demo').addEventListener('click', openTrackCrate);
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
  setBtnLabel('btn-mute', muted ? '🔇 Muted' : '🔊 Audio');
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
    if (!trackStarted) {
      startPlayback(true);
    } else {
      game.autoPlay = !game.autoPlay;
      updateAutoBtn();
    }
    return;
  }
  if (e.code === 'KeyM') {
    e.preventDefault();
    const muted = audio.toggleMute();
    setBtnLabel('btn-mute', muted ? '🔇 Muted' : '🔊 Audio');
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
if (isShowcasePreview) {
  document.body.classList.add('playing');
  selectedTrackIdx = 1; // NEON HORIZON (Outrun Synthwave)
  selectedDiffId = 'hard';
  currentTrack = TRACK_ROSTER[1];
  currentChart = generateProceduralChart(currentTrack, DIFFICULTY.hard);
  game = new Game(currentChart, 'hard', 0);
  document.querySelectorAll('.diff-btn').forEach((b) => {
    b.classList.toggle('selected', b.dataset.diff === 'hard');
  });
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
}

let hudTimer = 0;
function loop() {
  if (!trackStarted && !isShowcasePreview) {
    idlePreviewSec += 0.012;
    if (idlePreviewSec > 18.0) idlePreviewSec = 2.15;
  }
  if (isShowcasePreview && game.lastJudgement) {
    game.lastJudgement.at = performance.now() - 80;
    if (renderer.flashes.length === 0) {
      renderer.addFlash(1, JUDGE.PERFECT);
      renderer.addFlash(2, JUDGE.PERFECT);
    }
  }
  const tSec = trackStarted ? audio.getTime() : idlePreviewSec;

  if (trackStarted && !paused) {
    game.update(tSec, onNoteJudged);
    if (game.checkFinished(audio.getDuration(), tSec)) {
      trackStarted = false;
      audio.pause();
      const res = game.results();
      saveBestScore(currentTrack.id, selectedDiffId, res.score, res.grade);
      if (playMode === 'tour') {
        const venue = TOUR_VENUES[tourStageIdx] || TOUR_VENUES[0];
        if (res.score >= venue.goalScore && tourStageIdx < TOUR_VENUES.length - 1) {
          tourStageIdx++;
          try {
            localStorage.setItem(STORAGE_KEY_TOUR, String(tourStageIdx));
          } catch (_) {}
          syncTourBanner();
        }
      }
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
