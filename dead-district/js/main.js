// ============================================================================
// DEAD DISTRICT // SECTOR 7 — Full-Bleed Horror HUD, ECG Telemetry,
// Brass Cartridge Counter, Safe-Room Armory Workbench & Input Controller
// ============================================================================

import { audio } from './audio.js';
import { DeadDistrictSim } from './sim.js';
import { DeadDistrictRenderer } from './renderer.js';

const sim = new DeadDistrictSim();
const gameCanvas = document.getElementById('game-canvas');
const minimapCanvas = document.getElementById('minimap-canvas');
const ecgCanvas = document.getElementById('ecg-canvas');
const ecgCtx = ecgCanvas ? ecgCanvas.getContext('2d') : null;
const renderer = new DeadDistrictRenderer(gameCanvas, minimapCanvas);

const keys = new Set();
let pointerDown = false;
let aimWorldX = 960;
let aimWorldY = 520;
let workbenchOpen = false;
let pausedBeforeWorkbench = false;

// Build stable 5-slot weapon holster buttons once (avoids innerHTML thrashing on hover/focus)
const holsterSlotEls = [];
function initWeaponRack() {
  const rack = document.getElementById('hud-weapon-rack');
  if (!rack) return;
  rack.innerHTML = '';
  sim.weapons.forEach((w, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'weapon-slot';
    const keyEl = document.createElement('span');
    keyEl.className = 'ws-key';
    keyEl.textContent = `[${w.slot}]`;

    const nameEl = document.createElement('span');
    nameEl.className = 'ws-name';
    nameEl.textContent = w.name.split(' ')[0];
    nameEl.style.color = w.color;

    const stateEl = document.createElement('span');
    stateEl.className = 'ws-state';

    btn.append(keyEl, nameEl, stateEl);
    btn.addEventListener('click', () => {
      sim.selectWeapon(idx);
      syncHud();
    });
    rack.appendChild(btn);
    holsterSlotEls.push({ btn, stateEl, weapon: w, idx });
  });
}

// Build Workbench Weapon Rows inside the Safe-Room Armory Drawer
function renderWorkbenchWeapons() {
  const listEl = document.getElementById('wb-weapon-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  sim.weapons.forEach((w, idx) => {
    const row = document.createElement('div');
    row.className = `wb-weapon-row ${idx === sim.currentWeaponIdx ? 'active' : ''}`;

    const info = document.createElement('div');
    info.className = 'wb-w-info';
    const title = document.createElement('strong');
    title.style.color = w.color;
    title.textContent = `[${w.slot}] ${w.name}`;
    const sub = document.createElement('span');
    sub.textContent = w.unlocked
      ? `${w.caliber} · MAG ${w.mag}/${w.magSize} · RES ${w.infiniteReserve ? '∞' : w.reserve}`
      : `${w.caliber} · LOCKED FIREARM`;
    info.append(title, sub);

    const actions = document.createElement('div');
    actions.className = 'wb-w-actions';

    if (!w.unlocked) {
      const unlockBtn = document.createElement('button');
      unlockBtn.type = 'button';
      unlockBtn.className = 'wb-act-btn';
      unlockBtn.textContent = `BUY $${w.cost}`;
      unlockBtn.addEventListener('click', () => {
        sim.selectWeapon(idx);
        syncHud();
        renderWorkbenchWeapons();
      });
      actions.appendChild(unlockBtn);
    } else {
      const equipBtn = document.createElement('button');
      equipBtn.type = 'button';
      equipBtn.className = 'wb-act-btn';
      equipBtn.textContent = idx === sim.currentWeaponIdx ? 'EQUIPPED' : 'EQUIP';
      equipBtn.addEventListener('click', () => {
        sim.selectWeapon(idx);
        syncHud();
        renderWorkbenchWeapons();
      });
      actions.appendChild(equipBtn);

      if (!w.infiniteReserve) {
        const ammoBtn = document.createElement('button');
        ammoBtn.type = 'button';
        ammoBtn.className = 'wb-act-btn';
        ammoBtn.textContent = `+${w.ammoPack} AMMO ($${w.ammoCost})`;
        ammoBtn.addEventListener('click', () => {
          sim.requisitionAction(`ammo_w_${idx}`);
          syncHud();
          renderWorkbenchWeapons();
        });
        actions.appendChild(ammoBtn);
      }
    }

    row.append(info, actions);
    listEl.appendChild(row);
  });
}

function toggleWorkbench(forceState) {
  const drawer = document.getElementById('workbench-drawer');
  if (!drawer) return;
  const next = typeof forceState === 'boolean' ? forceState : !workbenchOpen;
  if (next === workbenchOpen) return;
  workbenchOpen = next;
  if (workbenchOpen) {
    pausedBeforeWorkbench = sim.paused;
    sim.paused = true;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    renderWorkbenchWeapons();
    syncHud();
  } else {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    sim.paused = pausedBeforeWorkbench;
    syncHud();
  }
}

function toggleSitrep(forceHide = false) {
  const card = document.getElementById('sitrep-card');
  if (!card) return;
  if (forceHide) {
    card.classList.add('hidden');
  } else {
    card.classList.toggle('hidden');
  }
}

window.addEventListener('keydown', (e) => {
  const k = e.key.toUpperCase();
  if (e.key === 'Tab' || k === 'B') {
    e.preventDefault();
    toggleWorkbench();
    return;
  }
  if (e.key === 'Escape' && workbenchOpen) {
    e.preventDefault();
    toggleWorkbench(false);
    return;
  }
  if (e.key === '?' || e.key === '/') {
    toggleSitrep();
    return;
  }
  if (sim.gameOver && e.key === 'Enter') {
    sim.reset();
    document.getElementById('modal-gameover').style.display = 'none';
    syncHud();
    return;
  }

  keys.add(k);

  if (k >= '1' && k <= '5') {
    sim.selectWeapon(Number(k) - 1);
    syncHud();
    if (workbenchOpen) renderWorkbenchWeapons();
  } else if (k === 'R') {
    sim.startReload();
  } else if (k === 'G') {
    sim.throwMolotov(aimWorldX, aimWorldY);
    syncHud();
  } else if (k === 'T') {
    sim.deployTurret();
    syncHud();
  } else if (k === 'H') {
    sim.useMedkit();
    syncHud();
  } else if (k === 'F') {
    sim.repairNearestBarricade();
    syncHud();
  } else if (k === 'L') {
    // Cycle Flashlight: Wide Flood -> Focused Spot -> Stealth Off
    if (sim.player.flashlightOn && sim.player.wideBeam) {
      sim.player.wideBeam = false;
    } else if (sim.player.flashlightOn && !sim.player.wideBeam) {
      sim.player.flashlightOn = false;
    } else {
      sim.player.flashlightOn = true;
      sim.player.wideBeam = true;
    }
    syncHud();
  } else if (k === ' ') {
    e.preventDefault();
    const { mx, my } = getMoveAxes();
    sim.triggerDash(mx, my);
  } else if (k === 'P') {
    sim.paused = !sim.paused;
    syncHud();
  } else if (k === 'M') {
    audio.toggleMute();
  }
});

window.addEventListener('keyup', (e) => {
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

gameCanvas.addEventListener('pointermove', (e) => {
  const pt = renderer.screenToWorld(e.clientX, e.clientY);
  aimWorldX = pt.x;
  aimWorldY = pt.y;
});

gameCanvas.addEventListener('pointerdown', (e) => {
  if (e.button === 0 && !workbenchOpen) {
    pointerDown = true;
    const pt = renderer.screenToWorld(e.clientX, e.clientY);
    aimWorldX = pt.x;
    aimWorldY = pt.y;
    sim.fireWeapon();
    syncHud();
  }
});

window.addEventListener('pointerup', () => {
  pointerDown = false;
});

gameCanvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    const next = (sim.currentWeaponIdx + dir + sim.weapons.length) % sim.weapons.length;
    if (sim.weapons[next].unlocked) {
      sim.selectWeapon(next);
      syncHud();
    }
  },
  { passive: false }
);

// Wire HUD & Workbench Controls
document.getElementById('btn-workbench')?.addEventListener('click', () => toggleWorkbench());
document.getElementById('btn-close-workbench')?.addEventListener('click', () => toggleWorkbench(false));
document.getElementById('wb-backdrop')?.addEventListener('click', () => toggleWorkbench(false));
document.getElementById('btn-dossier')?.addEventListener('click', () => toggleSitrep());
document.getElementById('btn-dismiss-sitrep')?.addEventListener('click', () => {
  sim.awaitingFirstInput = false;
  toggleSitrep(true);
});

document.getElementById('btn-pause')?.addEventListener('click', () => {
  sim.paused = !sim.paused;
  syncHud();
});

document.getElementById('btn-reset')?.addEventListener('click', () => {
  sim.reset();
  document.getElementById('modal-gameover').style.display = 'none';
  syncHud();
});

document.getElementById('btn-restart-modal')?.addEventListener('click', () => {
  sim.reset();
  document.getElementById('modal-gameover').style.display = 'none';
  syncHud();
});

document.getElementById('btn-reload')?.addEventListener('click', () => sim.startReload());
document.getElementById('belt-medkit')?.addEventListener('click', () => {
  sim.useMedkit();
  syncHud();
});
document.getElementById('belt-molotov')?.addEventListener('click', () => {
  sim.throwMolotov(aimWorldX, aimWorldY);
  syncHud();
});
document.getElementById('belt-turret')?.addEventListener('click', () => {
  sim.deployTurret();
  syncHud();
});
document.getElementById('belt-repair')?.addEventListener('click', () => {
  sim.repairNearestBarricade();
  syncHud();
});
document.getElementById('belt-light')?.addEventListener('click', () => {
  if (sim.player.flashlightOn && sim.player.wideBeam) {
    sim.player.wideBeam = false;
  } else if (sim.player.flashlightOn && !sim.player.wideBeam) {
    sim.player.flashlightOn = false;
  } else {
    sim.player.flashlightOn = true;
    sim.player.wideBeam = true;
  }
  syncHud();
});
document.getElementById('belt-dash')?.addEventListener('click', () => {
  const { mx, my } = getMoveAxes();
  sim.triggerDash(mx, my);
});

document.querySelectorAll('.shop-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const action = btn.getAttribute('data-buy') || btn.getAttribute('data-req');
    sim.requisitionAction(action);
    syncHud();
    if (workbenchOpen) renderWorkbenchWeapons();
  });
});

// Render Brass Cartridge Pips inside #ammo-pips
function syncAmmoPips(w) {
  const container = document.getElementById('ammo-pips');
  if (!container) return;
  const maxPips = Math.min(32, w.magSize);
  while (container.children.length < maxPips) {
    const pip = document.createElement('span');
    pip.className = 'ammo-pip';
    container.appendChild(pip);
  }
  while (container.children.length > maxPips) {
    container.removeChild(container.lastChild);
  }
  const activePips = Math.round((w.mag / w.magSize) * maxPips);
  for (let i = 0; i < maxPips; i++) {
    const child = container.children[i];
    if (i < activePips) {
      child.classList.remove('spent');
    } else {
      child.classList.add('spent');
    }
  }
}

// Live ECG Heartbeat Waveform Renderer
let ecgPhase = 0;
function renderEcg(dt) {
  if (!ecgCtx || !ecgCanvas) return;
  const p = sim.player;
  const hpRatio = Math.max(0, p.hp / p.maxHp);
  const bpm = Math.round(74 + (1 - hpRatio) * 86 + (sim.enemies.length > 8 ? 16 : 0));
  ecgPhase += dt * (bpm / 60) * Math.PI * 2;

  const w = ecgCanvas.width;
  const h = ecgCanvas.height;
  ecgCtx.fillStyle = '#05080c';
  ecgCtx.fillRect(0, 0, w, h);

  // Grid lines
  ecgCtx.strokeStyle = 'rgba(16, 185, 129, 0.1)';
  ecgCtx.lineWidth = 1;
  ecgCtx.beginPath();
  ecgCtx.moveTo(0, h * 0.5);
  ecgCtx.lineTo(w, h * 0.5);
  ecgCtx.stroke();

  const strokeCol = hpRatio > 0.55 ? '#10b981' : hpRatio > 0.28 ? '#f59e0b' : '#ef4444';
  ecgCtx.strokeStyle = strokeCol;
  ecgCtx.lineWidth = 1.6;
  ecgCtx.beginPath();
  for (let x = 0; x < w; x++) {
    const t = ((x / w) * 2.2 + ecgPhase / (Math.PI * 2)) % 1;
    let y = h * 0.54;
    if (t > 0.35 && t < 0.40) y -= 4;
    else if (t >= 0.40 && t < 0.44) y += 5;
    else if (t >= 0.44 && t < 0.49) y -= 13;
    else if (t >= 0.49 && t < 0.54) y += 8;
    else if (t >= 0.60 && t < 0.68) y -= 3.5;
    if (x === 0) ecgCtx.moveTo(x, y);
    else ecgCtx.lineTo(x, y);
  }
  ecgCtx.stroke();

  const bpmEl = document.getElementById('hud-bpm');
  const condEl = document.getElementById('hud-cond');
  if (bpmEl) bpmEl.textContent = `${bpm} BPM`;
  if (condEl) {
    condEl.textContent = hpRatio > 0.55 ? 'STABLE' : hpRatio > 0.28 ? 'ELEVATED' : 'CRITICAL';
    condEl.className = hpRatio > 0.55 ? 'cond-ok' : hpRatio > 0.28 ? 'cond-warn' : 'cond-crit';
  }
}

function syncHud() {
  const p = sim.player;
  const rem = sim.enemies.length + sim.enemiesToSpawn.length;

  // Top-left telemetry
  const waveEl = document.getElementById('hud-wave');
  if (waveEl) waveEl.textContent = `#0${sim.wave}`.slice(-3);
  const hostilesEl = document.getElementById('hud-hostiles');
  if (hostilesEl) hostilesEl.textContent = `${rem}`;
  const scrapEl = document.getElementById('hud-scrap');
  if (scrapEl) scrapEl.textContent = `$${sim.scrap.toLocaleString()}`;
  const wbScrapEl = document.getElementById('wb-scrap-val');
  if (wbScrapEl) wbScrapEl.textContent = `$${sim.scrap.toLocaleString()}`;
  const scoreEl = document.getElementById('hud-score');
  if (scoreEl) scoreEl.textContent = sim.score.toLocaleString();

  // Vitals
  const hpColor = p.hp > p.maxHp * 0.5 ? '#10b981' : p.hp > p.maxHp * 0.25 ? '#f59e0b' : '#ef4444';
  const hudHp = document.getElementById('hud-hp');
  if (hudHp) {
    hudHp.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    hudHp.style.color = hpColor;
  }
  const barHp = document.getElementById('bar-hp');
  if (barHp) {
    barHp.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    barHp.style.background = hpColor;
  }
  const topLeftBox = document.getElementById('hud-top-left');
  if (topLeftBox) topLeftBox.style.borderLeftColor = hpColor;

  const hudArmor = document.getElementById('hud-armor');
  if (hudArmor) hudArmor.textContent = `${Math.ceil(p.armor)} / ${p.maxArmor}`;
  const barArmor = document.getElementById('bar-armor');
  if (barArmor) barArmor.style.width = `${Math.max(0, (p.armor / p.maxArmor) * 100)}%`;

  // Belt counts
  const medEl = document.getElementById('hud-medkits');
  if (medEl) medEl.textContent = String(p.medkits);
  const molEl = document.getElementById('hud-molotovs');
  if (molEl) molEl.textContent = String(p.molotovs);
  const turEl = document.getElementById('hud-turrets');
  if (turEl) turEl.textContent = String(p.turretKits);
  const beamEl = document.getElementById('hud-beam');
  if (beamEl) {
    beamEl.textContent = !p.flashlightOn ? 'OFF' : p.wideBeam ? 'WIDE' : 'SPOT';
  }
  const stamEl = document.getElementById('hud-stamina');
  if (stamEl) {
    stamEl.textContent = p.dashCooldown > 0 ? `${p.dashCooldown.toFixed(1)}s` : '100%';
  }

  // Barricades
  let breachedCount = 0;
  for (const b of sim.barricades) {
    if (b.hp <= 0) breachedCount++;
    const el = document.getElementById(`bc-${b.id}`);
    if (el) {
      const pct = Math.max(0, (b.hp / b.maxHp) * 100);
      el.style.width = `${pct}%`;
      el.style.background = pct > 50 ? '#10b981' : pct > 0 ? '#f59e0b' : '#ef4444';
    }
  }

  // Active Weapon & Brass Cartridge Pips
  const w = sim.currentWeapon;
  const calEl = document.getElementById('hud-weapon-caliber');
  if (calEl) {
    calEl.textContent = `${w.caliber.toUpperCase()} // SLOT [${w.slot}]`;
    calEl.style.color = w.color;
  }
  const wNameEl = document.getElementById('hud-weapon-name');
  if (wNameEl) wNameEl.textContent = w.name;
  const magEl = document.getElementById('hud-ammo-mag');
  if (magEl) magEl.textContent = sim.reloadTimer > 0 ? 'RLD' : String(w.mag);
  const resEl = document.getElementById('hud-ammo-res');
  if (resEl) resEl.textContent = w.infiniteReserve ? '/ ∞ RESERVE' : `/ ${w.reserve} RES`;
  const barAmmo = document.getElementById('bar-ammo');
  if (barAmmo) {
    barAmmo.style.width = `${(w.mag / w.magSize) * 100}%`;
    barAmmo.style.background = w.color;
  }
  syncAmmoPips(w);

  // Update 5-Slot Holster without rebuilding DOM
  for (const item of holsterSlotEls) {
    const isAct = item.idx === sim.currentWeaponIdx;
    item.btn.className = `weapon-slot ${isAct ? 'active' : ''} ${!item.weapon.unlocked ? 'locked' : ''}`;
    item.stateEl.textContent = item.weapon.unlocked
      ? `${item.weapon.mag}/${item.weapon.infiniteReserve ? '∞' : item.weapon.reserve}`
      : `$${item.weapon.cost}`;
  }

  // Workbench Perk Labels
  const dmgLvl = document.getElementById('perk-dmg-lvl');
  const dmgCost = document.getElementById('perk-dmg-cost');
  if (dmgLvl) dmgLvl.textContent = `Tier ${sim.perks.hollowPoint} / 5`;
  if (dmgCost) dmgCost.textContent = sim.perks.hollowPoint >= 5 ? 'MAX' : `$${85 + sim.perks.hollowPoint * 45}`;

  const kw = sim.perks.kevlarWeave || 0;
  const hpLvl = document.getElementById('perk-hp-lvl');
  const hpCost = document.getElementById('perk-hp-cost');
  if (hpLvl) hpLvl.textContent = `Tier ${kw} / 5`;
  if (hpCost) hpCost.textContent = kw >= 5 ? 'MAX' : `$${80 + kw * 45}`;

  const relLvl = document.getElementById('perk-rel-lvl');
  const relCost = document.getElementById('perk-rel-cost');
  if (relLvl) relLvl.textContent = `Tier ${sim.perks.speedLoader} / 4`;
  if (relCost) relCost.textContent = sim.perks.speedLoader >= 4 ? 'MAX' : `$${75 + sim.perks.speedLoader * 45}`;

  // Pause button & Armory button pulse
  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) {
    pauseBtn.querySelector('.tb-txt').textContent = sim.paused && !workbenchOpen ? 'RESUME [P]' : 'PAUSE [P]';
  }
  const armoryBtn = document.getElementById('btn-workbench');
  const armoryBadge = document.getElementById('armory-badge');
  if (armoryBtn && armoryBadge) {
    if (!sim.waveActive) {
      armoryBtn.classList.add('pulse-ready');
      armoryBadge.textContent = `PREP ${Math.ceil(sim.breatherTimer)}s`;
    } else if (sim.scrap >= 110) {
      armoryBtn.classList.add('pulse-ready');
      armoryBadge.textContent = `$${sim.scrap} READY`;
    } else {
      armoryBtn.classList.remove('pulse-ready');
      armoryBadge.textContent = `$${sim.scrap}`;
    }
  }

  // Top-Center Live Tactical Directive Banner (Always visible so player knows exact current objective!)
  const phaseEl = document.getElementById('hud-phase');
  const bTitle = document.getElementById('banner-title');
  const bSub = document.getElementById('banner-sub');
  if (sim.banner.timer > 0) {
    if (phaseEl) phaseEl.textContent = sim.waveActive ? `WAVE 0${sim.wave} // ALERT` : 'SAFE-ROOM BREATHER';
    if (bTitle) bTitle.textContent = sim.banner.title;
    if (bSub) bSub.textContent = sim.banner.sub;
  } else if (!sim.waveActive) {
    if (phaseEl) phaseEl.textContent = `SAFE-ROOM BREATHER // ${Math.ceil(sim.breatherTimer)}s REMAINING`;
    if (bTitle) bTitle.textContent = `WAVE ${sim.wave} CLEARED — OPEN ARMORY WORKBENCH [B]`;
    if (bSub) bSub.textContent = `SPEND $${sim.scrap} SCRAP ON WEAPONS, AMMO, TURRETS & BARRICADES BEFORE WAVE ${sim.wave + 1}`;
  } else if (breachedCount > 0) {
    if (phaseEl) phaseEl.textContent = `PERIMETER WARNING // ${breachedCount} DOOR${breachedCount > 1 ? 'S' : ''} BREACHED`;
    if (bTitle) bTitle.textContent = `WAVE 0${sim.wave} // ${rem} HOSTILES REMAINING`;
    if (bSub) bSub.textContent = 'STAND NEAR SAFE-ROOM DOORS & PRESS [F] TO REINFORCE BARRICADES OR FIGHT NEAR VEHICLE BEAMS';
  } else {
    if (phaseEl) phaseEl.textContent = `ACTIVE SWARM // ${rem} HOSTILES IN SECTOR`;
    if (bTitle) bTitle.textContent = `WAVE 0${sim.wave} // DEFEND THE CROSSROADS`;
    if (bSub) bSub.textContent = 'SWEEP FLASHLIGHT [MOUSE] & FIGHT NEAR VEHICLE HEADLIGHTS TO SPOT LURKING INFECTED';
  }

  // Game Over Modal
  if (sim.gameOver) {
    const modal = document.getElementById('modal-gameover');
    if (modal && modal.style.display !== 'flex') {
      modal.style.display = 'flex';
      const goStats = document.getElementById('go-stats');
      if (goStats) {
        goStats.textContent = `Wave Reached: ${sim.wave} · Infected Neutralized: ${sim.kills} · Score: ${sim.score.toLocaleString()} (Best: ${sim.highScore.toLocaleString()})`;
      }
    }
  }
}

initWeaponRack();
window.addEventListener('resize', () => renderer.resize());
renderer.resize();

// Support ?preview=showcase, ?preview=combat, or ?preview=workbench for visual verification
const previewMode = new URLSearchParams(window.location.search).get('preview');
if (previewMode === 'showcase' || previewMode === 'combat' || previewMode === 'workbench') {
  sim.awaitingFirstInput = false;
  sim.enemies = [];
  sim.wave = 3;
  sim.score = 1850;
  sim.scrap = 320;
  sim.weapons[2].unlocked = true; // MP5-K
  sim.weapons[3].unlocked = true; // FN-FAL
  sim.currentWeaponIdx = 3;
  sim.player.x = 760;
  sim.player.y = 580;
  aimWorldX = 950;
  aimWorldY = 530;
  sim.deployTurret();
  sim.spawnFireExplosion(885, 535, 72);
  // Spawn enemies in both lit vehicle beams and dark penumbra/blackout zones to showcase light-distance visibility!
  sim.spawnEnemy('brute', 925, 525);      // Lit in flashlight & fire pool
  sim.spawnEnemy('screamer', 915, 315);   // Lit in PD-Cruiser 04 twin xenon headlights
  sim.spawnEnemy('spitter', 1225, 588);   // Lit in SWAT Bearcat twin floodlights
  sim.spawnEnemy('walker', 625, 862);     // Lit in EMS Ambulance halogen headlight
  sim.spawnEnemy('sprinter', 655, 645);   // Lurking in penumbra (dark silhouette + glowing eyes)
  sim.spawnEnemy('walker', 610, 470);     // Lurking in deep darkness (acoustic footstep ripple + faint eyes)
  sim.barricades[0].hp = 120;
  sim.barricades[2].hp = 60;
  sim.step(0.05, { moveX: 0, moveY: 0, aimWorldX, aimWorldY, firing: false });
  sim.fireWeapon();
  sim.awaitingFirstInput = true;
  sim.setBanner(
    'WAVE 03 // REDLINE CROSSROADS SIEGE',
    'ALIGNED VEHICLE HIGH-BEAMS, RAYCAST FLASHLIGHT & LIGHT-DISTANCE THREAT VISIBILITY',
    10.0
  );
  if (previewMode === 'combat') {
    toggleSitrep(true);
  } else if (previewMode === 'workbench') {
    toggleWorkbench(true);
  }
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
  renderEcg(dt);

  hudAccum += dt;
  if (hudAccum >= 0.1) {
    hudAccum = 0;
    syncHud();
  }

  requestAnimationFrame(frame);
}

renderer.render(sim);
renderEcg(0.016);
syncHud();
window.__deadDistrict = { sim, renderer, toggleWorkbench };
requestAnimationFrame(frame);
