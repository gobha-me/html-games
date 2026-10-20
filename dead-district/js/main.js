// ============================================================================
// DEAD DISTRICT // SECTOR 7 — Input Controller, HUD Sync & Showcase Hook
// ============================================================================

import { audio } from './audio.js';
import { DeadDistrictSim } from './sim.js';
import { DeadDistrictRenderer } from './renderer.js';

const sim = new DeadDistrictSim();
const gameCanvas = document.getElementById('game-canvas');
const minimapCanvas = document.getElementById('minimap-canvas');
const renderer = new DeadDistrictRenderer(gameCanvas, minimapCanvas);

const keys = new Set();
let pointerDown = false;
let aimWorldX = 960;
let aimWorldY = 520;

window.addEventListener('keydown', e => {
  const k = e.key.toUpperCase();
  keys.add(k);

  if (k >= '1' && k <= '5') {
    sim.selectWeapon(Number(k) - 1);
    syncHud();
  } else if (k === 'R') {
    sim.startReload();
  } else if (k === 'G') {
    sim.throwMolotov(aimWorldX, aimWorldY);
  } else if (k === 'T') {
    sim.deployTurret();
  } else if (k === 'H') {
    sim.useMedkit();
  } else if (k === 'F') {
    sim.repairNearestBarricade();
  } else if (k === 'L') {
    if (!sim.player.wideBeam) {
      sim.player.wideBeam = true;
    } else {
      sim.player.wideBeam = false;
    }
    document.getElementById('btn-flashlight').textContent =
      sim.player.wideBeam ? '🔦 Beam: Flood [L]' : '🔦 Beam: Spot [L]';
  } else if (k === ' ') {
    e.preventDefault();
    const { mx, my } = getMoveAxes();
    sim.triggerDash(mx, my);
  } else if (k === 'P') {
    sim.paused = !sim.paused;
    document.getElementById('btn-pause').textContent = sim.paused ? '▶ Resume' : '⏸ Pause';
  } else if (k === 'M') {
    const m = audio.toggleMute();
    document.getElementById('btn-mute').textContent = m ? '🔇 Mute' : '🔊 SFX';
  }
});

window.addEventListener('keyup', e => {
  keys.delete(e.key.toUpperCase());
});

function getMoveAxes() {
  let mx = 0;
  let my = 0;
  if (keys.has('W') || keys.has('ARROWUP')) my -= 1;
  if (keys.has('S') || keys.has('ARROWDOWN')) my += 1;
  if (keys.has('A') || keys.has('ARROWLEFT')) mx -= 1;
  if (keys.has('D') || keys.has('ARROWRIGHT')) mx += 1;
  return { mx, my };
}

gameCanvas.addEventListener('pointermove', e => {
  const pt = renderer.screenToWorld(e.clientX, e.clientY);
  aimWorldX = pt.x;
  aimWorldY = pt.y;
});

gameCanvas.addEventListener('pointerdown', e => {
  if (e.button === 0) {
    pointerDown = true;
    const pt = renderer.screenToWorld(e.clientX, e.clientY);
    aimWorldX = pt.x;
    aimWorldY = pt.y;
    sim.fireWeapon();
  }
});

window.addEventListener('pointerup', () => {
  pointerDown = false;
});

gameCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  const dir = e.deltaY > 0 ? 1 : -1;
  const next = (sim.currentWeaponIdx + dir + sim.weapons.length) % sim.weapons.length;
  if (sim.weapons[next].unlocked) {
    sim.selectWeapon(next);
    syncHud();
  }
}, { passive: false });

// Wire Top & Belt Buttons
document.getElementById('btn-flashlight')?.addEventListener('click', e => {
  sim.player.wideBeam = !sim.player.wideBeam;
  e.currentTarget.textContent = sim.player.wideBeam ? '🔦 Beam: Flood [L]' : '🔦 Beam: Spot [L]';
});

document.getElementById('btn-repair-all')?.addEventListener('click', () => {
  sim.repairNearestBarricade();
  syncHud();
});

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
  syncHud();
});

document.getElementById('btn-modal-restart')?.addEventListener('click', () => {
  sim.reset();
  document.getElementById('modal-gameover').style.display = 'none';
  syncHud();
});

document.getElementById('btn-reload')?.addEventListener('click', () => sim.startReload());
document.getElementById('btn-use-med')?.addEventListener('click', () => { sim.useMedkit(); syncHud(); });
document.getElementById('btn-use-molotov')?.addEventListener('click', () => { sim.throwMolotov(aimWorldX, aimWorldY); syncHud(); });
document.getElementById('btn-use-turret')?.addEventListener('click', () => { sim.deployTurret(); syncHud(); });
document.getElementById('btn-use-dash')?.addEventListener('click', () => {
  const { mx, my } = getMoveAxes();
  sim.triggerDash(mx, my);
});

document.querySelectorAll('.shop-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const req = btn.getAttribute('data-req');
    sim.requisitionAction(req);
    syncHud();
  });
});

function renderWeaponRack() {
  const rack = document.getElementById('hud-weapon-rack');
  if (!rack) return;
  rack.innerHTML = '';
  sim.weapons.forEach((w, idx) => {
    const btn = document.createElement('button');
    btn.className = `weapon-slot ${idx === sim.currentWeaponIdx ? 'active' : ''} ${!w.unlocked ? 'locked' : ''}`;
    const rightLabel = w.unlocked
      ? `${w.mag}/${w.infiniteReserve ? '∞' : w.reserve}`
      : `UNLOCK $${w.cost}`;
    btn.innerHTML = `
      <span class="ws-left">
        <span class="ws-key">[${w.slot}]</span>
        <strong style="color:${w.color}">${w.name}</strong>
      </span>
      <span class="ws-right">${rightLabel}</span>
    `;
    btn.addEventListener('click', () => {
      sim.selectWeapon(idx);
      syncHud();
    });
    rack.appendChild(btn);
  });
}

function syncHud() {
  const p = sim.player;
  document.getElementById('hud-wave').textContent = sim.waveActive
    ? `${sim.wave}`
    : `PREP ${Math.ceil(sim.breatherTimer)}s`;
  const rem = sim.enemies.length + sim.enemiesToSpawn.length;
  document.getElementById('hud-hostiles').textContent = `${rem}`;
  document.getElementById('hud-scrap').textContent = `$${sim.scrap.toLocaleString()}`;
  document.getElementById('hud-score').textContent = `${sim.score.toLocaleString()} / ${sim.highScore.toLocaleString()}`;

  // Vitals
  document.getElementById('hud-hp-text').textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
  document.getElementById('hud-hp-bar').style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
  document.getElementById('hud-armor-text').textContent = `${Math.ceil(p.armor)} / ${p.maxArmor}`;
  document.getElementById('hud-armor-bar').style.width = `${Math.max(0, (p.armor / p.maxArmor) * 100)}%`;

  document.getElementById('hud-med-count').textContent = String(p.medkits);
  document.getElementById('hud-molotov-count').textContent = String(p.molotovs);
  document.getElementById('hud-turret-count').textContent = String(p.turretKits);
  document.getElementById('hud-dash-state').textContent =
    p.dashCooldown > 0 ? `${p.dashCooldown.toFixed(1)}s` : 'READY';

  // Barricades
  let intactCount = 0;
  for (const b of sim.barricades) {
    if (b.hp > 0) intactCount++;
    const el = document.getElementById(`bc-${b.id}`);
    if (el) {
      const pct = Math.max(0, (b.hp / b.maxHp) * 100);
      el.style.width = `${pct}%`;
      el.style.background = pct > 50 ? '#10b981' : pct > 0 ? '#f59e0b' : '#ef4444';
    }
  }
  const bSum = document.getElementById('hud-barricade-summary');
  bSum.textContent = `${intactCount} / 8 INTACT`;
  bSum.style.color = intactCount >= 6 ? '#10b981' : intactCount >= 3 ? '#f59e0b' : '#ef4444';

  // Active Weapon
  const w = sim.currentWeapon;
  document.getElementById('hud-caliber').textContent = w.caliber.toUpperCase();
  document.getElementById('hud-caliber').style.color = w.color;
  document.getElementById('hud-weapon-name').textContent = w.name;
  document.getElementById('hud-ammo-mag').textContent =
    sim.reloadTimer > 0 ? 'RELOADING...' : `${w.mag} / ${w.magSize}`;
  document.getElementById('hud-ammo-res').textContent =
    w.infiniteReserve ? 'RESERVE: ∞' : `RESERVE: ${w.reserve}`;
  document.getElementById('hud-ammo-bar').style.width = `${(w.mag / w.magSize) * 100}%`;
  document.getElementById('hud-ammo-bar').style.background = w.color;

  renderWeaponRack();

  // Perk shop costs
  document.getElementById('req-dmg-cost').textContent =
    sim.perks.hollowPoint >= 4 ? 'MAX' : `$${90 + sim.perks.hollowPoint * 50}`;
  document.getElementById('req-rel-cost').textContent =
    sim.perks.speedLoader >= 4 ? 'MAX' : `$${80 + sim.perks.speedLoader * 45}`;

  // Banner
  const bannerEl = document.getElementById('sector-banner');
  if (sim.banner.timer > 0) {
    bannerEl.style.opacity = '1';
    document.getElementById('banner-title').textContent = sim.banner.title;
    document.getElementById('banner-sub').textContent = sim.banner.sub;
  } else {
    bannerEl.style.opacity = '0';
  }

  // Game Over Modal
  if (sim.gameOver) {
    const modal = document.getElementById('modal-gameover');
    if (modal && modal.style.display !== 'flex') {
      modal.style.display = 'flex';
      document.getElementById('modal-summary').textContent =
        `Wave Reached: ${sim.wave} · Hostiles Eliminated: ${sim.kills} · Score: ${sim.score.toLocaleString()} (Best: ${sim.highScore.toLocaleString()})`;
    }
  }
}

window.addEventListener('resize', () => renderer.resize());
renderer.resize();

// Optional ?preview=showcase query hook for visual inspection of active wave combat, fire pools & 2D shadows
if (new URLSearchParams(window.location.search).get('preview') === 'showcase') {
  sim.wave = 3;
  sim.score = 1850;
  sim.scrap = 320;
  sim.weapons[2].unlocked = true; // MP5-K
  sim.weapons[3].unlocked = true; // FN-FAL
  sim.currentWeaponIdx = 3;
  sim.player.x = 760;
  sim.player.y = 580;
  aimWorldX = 940;
  aimWorldY = 510;
  sim.deployTurret();
  sim.spawnFireExplosion(885, 535, 72);
  sim.spawnEnemy('brute', 920, 500);
  sim.spawnEnemy('screamer', 680, 480);
  sim.spawnEnemy('spitter', 860, 680);
  sim.spawnEnemy('sprinter', 640, 630);
  sim.spawnEnemy('walker', 950, 610);
  sim.barricades[0].hp = 120;
  sim.barricades[2].hp = 60;
  sim.step(0.05, { moveX: 0, moveY: 0, aimWorldX, aimWorldY, firing: false });
  sim.fireWeapon();
  sim.setBanner('WAVE 3 // REDLINE CROSSROADS SIEGE', 'FN-FAL 7.62 AP + AEGIS SENTRY OVERWATCH ACTIVE', 10.0);
}

let lastTime = performance.now();
let hudAccum = 0;

function frame(now) {
  const dt = Math.min(0.04, (now - lastTime) / 1000);
  lastTime = now;

  const { mx, my } = getMoveAxes();
  sim.step(dt, {
    moveX: mx,
    moveY: my,
    aimWorldX,
    aimWorldY,
    firing: pointerDown,
  });
  renderer.render(sim);

  hudAccum += dt;
  if (hudAccum >= 0.1) {
    hudAccum = 0;
    syncHud();
  }

  requestAnimationFrame(frame);
}

renderer.render(sim);
syncHud();
window.__deadDistrict = { sim, renderer };
requestAnimationFrame(frame);
