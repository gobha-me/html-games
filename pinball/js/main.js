// ============================================================================
// AETHERIUM // PINBALL — Main Entry, Input Controller & HUD Synchronization
// ============================================================================

import { audio } from './audio.js';
import { AetheriumPinballSim } from './physics.js';
import { AetheriumRenderer } from './renderer.js';

const sim = new AetheriumPinballSim();
const tableCanvas = document.getElementById('table-canvas');
const dmdCanvas = document.getElementById('dmd-canvas');
const renderer = new AetheriumRenderer(tableCanvas, dmdCanvas);

function setLeftFlipper(down) {
  if (down && !sim.leftFlipperDown && !sim.tilted) {
    audio.flipperUp();
    sim.cycleCrownLanes(-1);
  } else if (!down && sim.leftFlipperDown) {
    audio.flipperDown();
  }
  sim.leftFlipperDown = down;
  document.getElementById('btn-flip-left')?.classList.toggle('pressed', down);
}

function setRightFlipper(down) {
  if (down && !sim.rightFlipperDown && !sim.tilted) {
    audio.flipperUp();
    sim.cycleCrownLanes(1);
  } else if (!down && sim.rightFlipperDown) {
    audio.flipperDown();
  }
  sim.rightFlipperDown = down;
  document.getElementById('btn-flip-right')?.classList.toggle('pressed', down);
}

// Keyboard Controls
window.addEventListener('keydown', e => {
  if (e.repeat) return;
  const k = e.key.toUpperCase();

  if (k === 'Z' || k === 'ARROWLEFT' || e.code === 'ShiftLeft') {
    e.preventDefault();
    setLeftFlipper(true);
  } else if (k === 'M' || k === '/' || k === 'ARROWRIGHT' || e.code === 'ShiftRight') {
    e.preventDefault();
    setRightFlipper(true);
  } else if (k === ' ' || k === 'ARROWDOWN' || k === 'ENTER') {
    e.preventDefault();
    sim.plungerCharging = true;
    document.getElementById('btn-plunger-hold')?.classList.add('pressed');
  } else if (k === 'W' || k === 'ARROWUP') {
    e.preventDefault();
    sim.magnetActive = true;
    document.getElementById('btn-magnet')?.classList.add('pressed');
  } else if (k === 'A') {
    sim.nudge(-1, 0);
  } else if (k === 'D') {
    sim.nudge(1, 0);
  } else if (k === 'X') {
    sim.nudge(0, -1);
  } else if (k === 'P') {
    sim.paused = !sim.paused;
    document.getElementById('btn-pause').textContent = sim.paused ? '▶ Resume' : '⏸ Pause';
  } else if (k === 'R') {
    sim.reset();
    document.getElementById('modal-gameover').style.display = 'none';
  }
});

window.addEventListener('keyup', e => {
  const k = e.key.toUpperCase();
  if (k === 'Z' || k === 'ARROWLEFT' || e.code === 'ShiftLeft') {
    setLeftFlipper(false);
  } else if (k === 'M' || k === '/' || k === 'ARROWRIGHT' || e.code === 'ShiftRight') {
    setRightFlipper(false);
  } else if (k === ' ' || k === 'ARROWDOWN' || k === 'ENTER') {
    sim.releasePlunger(0.65);
    document.getElementById('btn-plunger-hold')?.classList.remove('pressed');
  } else if (k === 'W' || k === 'ARROWUP') {
    sim.magnetActive = false;
    document.getElementById('btn-magnet')?.classList.remove('pressed');
  }
});

// Wire On-Screen Cabinet Buttons
function bindHoldButton(id, onDown, onUp) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('pointerdown', e => { e.preventDefault(); onDown(); });
  el.addEventListener('pointerup', e => { e.preventDefault(); onUp(); });
  el.addEventListener('pointerleave', () => onUp());
}

bindHoldButton('btn-flip-left', () => setLeftFlipper(true), () => setLeftFlipper(false));
bindHoldButton('btn-flip-right', () => setRightFlipper(true), () => setRightFlipper(false));
bindHoldButton(
  'btn-plunger-hold',
  () => { sim.plungerCharging = true; },
  () => { if (sim.plungerCharging) sim.releasePlunger(0.75); }
);
bindHoldButton(
  'btn-magnet',
  () => { sim.magnetActive = true; },
  () => { sim.magnetActive = false; }
);

document.getElementById('btn-launch')?.addEventListener('click', () => {
  sim.releasePlunger(0.85);
});

document.getElementById('btn-multiball-demo')?.addEventListener('click', () => {
  // First launch shooter ball if still sitting in shooter lane
  if (sim.balls.some(b => b.inShooter)) {
    sim.releasePlunger(0.9);
  }
  sim.setDmd('⚡ AZOTH MULTIBALL UNLEASHED! ⚡', '3-BALL PHILOSOPHER FRENZY', 4.0);
  sim.spawnMultiball(2);
});

document.getElementById('btn-nudge-left')?.addEventListener('click', () => sim.nudge(-1, 0));
document.getElementById('btn-nudge-up')?.addEventListener('click', () => sim.nudge(0, -1));
document.getElementById('btn-nudge-right')?.addEventListener('click', () => sim.nudge(1, 0));

document.getElementById('btn-pause')?.addEventListener('click', e => {
  sim.paused = !sim.paused;
  e.currentTarget.textContent = sim.paused ? '▶ Resume' : '⏸ Pause';
});

document.getElementById('btn-mute')?.addEventListener('click', e => {
  const m = audio.toggleMute();
  e.currentTarget.textContent = m ? '🔇 Mute' : '🔊 SFX';
});

document.getElementById('btn-reset')?.addEventListener('click', () => {
  sim.reset();
  document.getElementById('modal-gameover').style.display = 'none';
});

document.getElementById('btn-modal-restart')?.addEventListener('click', () => {
  sim.reset();
  document.getElementById('modal-gameover').style.display = 'none';
});

// Synchronize DOM Telemetry
function syncHud() {
  document.getElementById('hud-score').textContent = sim.score.toLocaleString();
  document.getElementById('hud-hi').textContent = sim.highScore.toLocaleString();
  document.getElementById('hud-ball').textContent = `${sim.ballNumber} / ${sim.maxBalls}`;
  document.getElementById('hud-mult').textContent = `${sim.multiplier}×`;
  document.getElementById('hud-locks').textContent = `${sim.crucibleLocks} / 3`;

  const aegisEl = document.getElementById('hud-aegis');
  if (sim.aegisTimer > 0) {
    aegisEl.textContent = `ACTIVE (${Math.ceil(sim.aegisTimer)}s)`;
    aegisEl.style.color = '#34d399';
  } else {
    aegisEl.textContent = `OFFLINE`;
    aegisEl.style.color = '#64748b';
  }

  // Boss HUD
  const b = sim.boss;
  document.getElementById('hud-boss-tier').textContent = b.def.tier;
  document.getElementById('hud-boss-name').textContent = b.def.name;
  document.getElementById('hud-boss-sub').textContent = b.def.subtitle;
  document.getElementById('hud-boss-desc').textContent = b.def.desc;
  document.getElementById('hud-boss-hp-text').textContent = `${Math.ceil(b.hp)} / ${b.maxHp} HP`;
  document.getElementById('hud-boss-banished').textContent = `Banished: ${sim.bossDefeatedCount}`;
  document.getElementById('hud-boss-hp-bar').style.width = `${Math.max(0, (b.hp / b.maxHp) * 100)}%`;

  // Ritual Seals & Temple Bonus
  const activeSealIdx = sim.bossIdx % 3;
  const cycleNum = Math.floor(sim.bossIdx / 3) + 1;
  const cycleEl = document.getElementById('hud-cycle-tag');
  if (cycleEl) cycleEl.textContent = `CYCLE ${cycleNum}`;
  document.querySelectorAll('#hud-seal-grid .seal-pill').forEach((el, idx) => {
    el.classList.toggle('active', idx === activeSealIdx);
    el.classList.toggle('done', idx < activeSealIdx);
  });
  const bonusEl = document.getElementById('hud-bonus');
  if (bonusEl) bonusEl.textContent = `+${(sim.bonusScore * sim.multiplier).toLocaleString()}`;
  const spheresEl = document.getElementById('hud-spheres');
  if (spheresEl) {
    spheresEl.textContent = sim.balls.length > 1 ? `${sim.balls.length} MULTIBALL` : `${sim.balls.length} ACTIVE`;
  }

  // Reagents
  for (const k of ['salt', 'sulfur', 'mercury', 'azoth']) {
    const pct = Math.round(sim.reagents[k] || 0);
    const bar = document.getElementById(`rg-${k}`);
    const val = document.getElementById(`rg-${k}-val`);
    if (bar) bar.style.width = `${pct}%`;
    if (val) val.textContent = `${pct}%`;
  }

  // Tilt & Safeguards
  const tiltPct = Math.round(sim.tiltMeter);
  document.getElementById('hud-tilt-bar').style.width = `${tiltPct}%`;
  const tiltSt = document.getElementById('hud-tilt-status');
  if (sim.tilted) {
    tiltSt.textContent = 'TILT FAULT!';
    tiltSt.style.color = '#ef4444';
  } else if (tiltPct > 55) {
    tiltSt.textContent = `WARNING (${tiltPct}%)`;
    tiltSt.style.color = '#f59e0b';
  } else {
    tiltSt.textContent = 'STABLE';
    tiltSt.style.color = '#34d399';
  }

  const kbBadge = document.getElementById('badge-kickback');
  kbBadge.textContent = `⚡ KICKBACK: ${sim.kickbackLit ? 'LIT' : 'SPENT'}`;
  kbBadge.style.color = sim.kickbackLit ? '#38bdf8' : '#64748b';

  const agBadge = document.getElementById('badge-aegis');
  agBadge.textContent = `🛡 AEGIS: ${sim.aegisTimer > 0 ? 'LIT' : 'OFF'}`;
  agBadge.style.color = sim.aegisTimer > 0 ? '#34d399' : '#64748b';

  // Transmute Matrix
  const cells = document.querySelectorAll('#hud-transmute-grid .sigil-cell');
  cells.forEach((cell, i) => {
    cell.classList.toggle('lit', !!sim.transmuteLit[i]);
  });

  // Magnetkinesis
  const magPct = Math.round(sim.magnetCharge);
  document.getElementById('hud-mag-pct').textContent = `${magPct}%`;
  document.getElementById('hud-mag-bar').style.width = `${magPct}%`;

  // Game Over Modal
  if (sim.gameOver) {
    const modal = document.getElementById('modal-gameover');
    if (modal && modal.style.display !== 'flex') {
      modal.style.display = 'flex';
      document.getElementById('modal-summary').textContent =
        `Final Score: ${sim.score.toLocaleString()} · Grand Record: ${sim.highScore.toLocaleString()} · Bosses Banished: ${sim.bossDefeatedCount}`;
    }
  }
}

window.addEventListener('resize', () => renderer.resize());
renderer.resize();

// Optional ?preview=showcase query hook for visual testing & multiball combat inspection
if (new URLSearchParams(window.location.search).get('preview') === 'showcase') {
  sim.releasePlunger(0.95);
  sim.bossDefeatedCount = 1;
  sim.initBoss(1); // The Ouroboros Engine
  sim.boss.hp = 310;
  sim.score = 184500;
  sim.multiplier = 3;
  sim.crucibleLocks = 2;
  sim.transmuteLit = [true, true, true, true, false, true, true, false, false];
  sim.reagents = { salt: 80, sulfur: 65, mercury: 90, azoth: 75 };
  sim.spawnMultiball(2);
  sim.setDmd('⚡ AZOTH MULTIBALL UNLEASHED! ⚡', 'THE OUROBOROS ENGINE · 3X MULTIPLIER', 10.0);
  for (let i = 0; i < 35; i++) sim.step(0.016);
}

let lastTime = performance.now();
let hudAccum = 0;

function frame(now) {
  const dt = Math.min(0.04, (now - lastTime) / 1000);
  lastTime = now;

  sim.step(dt);
  renderer.render(sim);

  hudAccum += dt;
  if (hudAccum >= 0.08) {
    hudAccum = 0;
    syncHud();
  }

  requestAnimationFrame(frame);
}

syncHud();
window.__pinball = { sim, renderer };
requestAnimationFrame(frame);
