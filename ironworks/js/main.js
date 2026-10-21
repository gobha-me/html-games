// ============================================================================
// IRONWORKS // CORE — Main Entry, Input Controller & HUD Synchronization
// ============================================================================

import {
  GRID_W, GRID_H, TILE_SIZE, CORE_X, CORE_Y, DIRS,
  RESOURCES, RECIPES, BUILDINGS, BUILDING_BY_ID, WAVES
} from './config.js';
import { audio } from './audio.js';
import { IronworksSim } from './sim.js';
import { IronworksRenderer } from './renderer.js';

const SAVE_KEY = 'ironworks_core_save_v1';

const sim = new IronworksSim();
const canvas = document.getElementById('viewport');
const minimap = document.getElementById('minimap');
const renderer = new IronworksRenderer(canvas, minimap);

const uiState = {
  selectedBuilding: 'belt',
  buildDir: 1, // East
  inspectTile: null, // { x, y }
  keysDown: new Set(),
  draggingMap: false,
  paintingLeft: false,
  paintingRight: false,
  lastDragX: 0,
  lastDragY: 0,
  lastPaintTile: null,
};

function showToast(msg, color = '#38bdf8') {
  const el = document.getElementById('toast-banner');
  if (!el) return;
  el.textContent = msg;
  el.style.borderColor = color;
  el.style.color = color;
  el.classList.add('visible');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove('visible'), 2400);
}

// Build Palette UI
function initPalette() {
  const container = document.getElementById('build-palette');
  container.innerHTML = '';
  for (const b of BUILDINGS) {
    const costHtml = Object.entries(b.cost)
      .map(([k, v]) => {
        const res = RESOURCES[k];
        const label = res?.short || k;
        const col = res?.glow || '#cbd5e1';
        return `<span class="cost-item" style="color:${col}"><b>${v}</b> ${label}</span>`;
      })
      .join('<span class="cost-sep">·</span>');
    const card = document.createElement('button');
    card.className = 'build-card';
    card.dataset.id = b.id;
    card.innerHTML = `
      <div class="bc-top">
        <span class="bc-swatch" style="background:${b.color};border-color:${b.accent}"></span>
        <span class="bc-name">${b.name}</span>
        <span class="bc-key">[${b.key}]</span>
      </div>
      <div class="bc-cost">${costHtml}</div>
    `;
    card.addEventListener('click', () => {
      uiState.selectedBuilding = uiState.selectedBuilding === b.id ? null : b.id;
      syncPaletteSelection();
    });
    container.appendChild(card);
  }
  syncPaletteSelection();
}

function syncPaletteSelection() {
  const cards = document.querySelectorAll('.build-card');
  cards.forEach(c => {
    const active = c.dataset.id === uiState.selectedBuilding;
    c.classList.toggle('active', active);
  });
  const def = uiState.selectedBuilding ? BUILDING_BY_ID[uiState.selectedBuilding] : null;
  const info = document.getElementById('selected-tool-desc');
  if (info) {
    if (def) {
      const displayTitle = def.fullName || def.name;
      info.innerHTML = `<b>${displayTitle}</b> ${def.rotatable ? `(Facing: <b style="color:#fbbf24">${DIRS[uiState.buildDir].name} ${DIRS[uiState.buildDir].arrow}</b> · <b>[R]</b> Rotate)` : ''}<br><span>${def.desc}</span>`;
    } else {
      info.innerHTML = `<b>Inspect / Hand-Mine Mode</b><br><span>Click any exposed mineral vein to mine by hand, or click a placed Smelter/Fabricator to switch its recipe.</span>`;
    }
  }
}

// Inspector Panel for clicked Smelter / Fabricator / Spire / Turret
function updateInspector() {
  const box = document.getElementById('inspector-panel');
  if (!uiState.inspectTile) {
    box.style.display = 'none';
    return;
  }
  const { x, y } = uiState.inspectTile;
  const b = sim.inBounds(x, y) ? sim.buildings[y][x] : null;
  if (!b) {
    uiState.inspectTile = null;
    box.style.display = 'none';
    return;
  }
  const def = BUILDING_BY_ID[b.id];
  box.style.display = 'block';
  const fullName = def.fullName || def.name;
  let html = `<div class="insp-head"><span>${fullName} (${x},${y})</span><button id="insp-close">×</button></div>`;
  html += `<div class="insp-stat">Integrity: ${Math.ceil(b.hp)} / ${b.maxHp} HP</div>`;

  if (def.recipes) {
    html += `<div class="insp-sub">Select Production Recipe:</div><div class="insp-recipes">`;
    for (const rid of def.recipes) {
      const r = RECIPES[rid];
      const active = b.recipe === rid;
      const inText = Object.entries(r.inputs).map(([k, v]) => `${v} ${RESOURCES[k].name}`).join(' + ');
      html += `<button class="rec-btn ${active ? 'active' : ''}" data-rec="${rid}">
        <div><b>${r.name}</b> → ${r.count}× ${RESOURCES[r.output].name}</div>
        <div class="rec-in">Requires: ${inText}</div>
      </button>`;
    }
    html += `</div>`;
  } else if (def.turret) {
    const res = RESOURCES[def.turret.ammoType];
    html += `<div class="insp-stat">Ordnance Buffer: <b>${b.ammo.toFixed(1)} / ${def.turret.maxBuffer}</b> (${res.name})</div>`;
  } else if (b.id === 'spire') {
    html += `<div class="insp-stat">Ascension Charge: <b>${sim.stats.spireProgress}%</b></div>`;
    html += `<button class="action-btn spire-btn" id="btn-charge-spire">⚡ Inject Core Batch (+20%)</button>`;
  }

  box.innerHTML = html;
  document.getElementById('insp-close')?.addEventListener('click', () => {
    uiState.inspectTile = null;
    updateInspector();
  });
  box.querySelectorAll('.rec-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      b.recipe = btn.dataset.rec;
      b.autoRecipe = false;
      audio.craft();
      updateInspector();
    });
  });
  document.getElementById('btn-charge-spire')?.addEventListener('click', () => {
    const res = sim.chargeSpireFromStock();
    showToast(res.msg, res.ok ? '#c084fc' : '#f87171');
    updateInspector();
  });
}

function applyBrushAt(tx, ty, isRightClick) {
  if (!sim.inBounds(tx, ty)) return;
  const key = `${tx},${ty},${isRightClick ? 'R' : 'L'}`;
  if (uiState.lastPaintTile === key) return;
  uiState.lastPaintTile = key;

  if (isRightClick) {
    sim.removeBuilding(tx, ty);
    if (uiState.inspectTile && uiState.inspectTile.x === tx && uiState.inspectTile.y === ty) {
      uiState.inspectTile = null;
      updateInspector();
    }
    return;
  }

  const existing = sim.buildings[ty][tx];
  // If clicking an existing Smelter/Fabricator/Spire without dragging a belt over it, open Inspector
  if (existing && (existing.id === 'smelter' || existing.id === 'fabricator' || existing.id === 'spire')) {
    if (!uiState.selectedBuilding || uiState.selectedBuilding === existing.id) {
      uiState.inspectTile = { x: tx, y: ty };
      updateInspector();
      return;
    }
  }

  if (uiState.selectedBuilding) {
    const check = sim.canPlace(uiState.selectedBuilding, tx, ty);
    if (check.ok || (existing && existing.id === uiState.selectedBuilding)) {
      sim.placeBuilding(uiState.selectedBuilding, tx, ty, uiState.buildDir);
      document.getElementById('canvas-hud-guide')?.classList.add('hidden');
      if (uiState.selectedBuilding === 'smelter' || uiState.selectedBuilding === 'fabricator' || uiState.selectedBuilding === 'spire') {
        uiState.inspectTile = { x: tx, y: ty };
        updateInspector();
      }
    } else {
      // Allow hand-mining if clicking an ore vein and not placing a drill
      if (!sim.handMine(tx, ty) && check.reason) {
        showToast(check.reason, '#f87171');
      }
    }
  } else {
    if (existing) {
      uiState.inspectTile = { x: tx, y: ty };
      updateInspector();
    } else {
      sim.handMine(tx, ty);
    }
  }
}

// Mouse & Keyboard Event Listeners
canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', e => {
  const rect = canvas.getBoundingClientRect();
  const { tx, ty } = renderer.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  renderer.hoverTile = { tx, ty };

  if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
    uiState.draggingMap = true;
    uiState.lastDragX = e.clientX;
    uiState.lastDragY = e.clientY;
    return;
  }
  uiState.lastPaintTile = null;
  if (e.button === 2) {
    uiState.paintingRight = true;
    applyBrushAt(tx, ty, true);
  } else if (e.button === 0) {
    uiState.paintingLeft = true;
    // Smart belt auto-direction when dragging belts
    uiState.prevBeltTile = { tx, ty };
    applyBrushAt(tx, ty, false);
  }
});

window.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const { tx, ty } = renderer.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
  renderer.hoverTile = { tx, ty };

  if (uiState.draggingMap) {
    const dx = e.clientX - uiState.lastDragX;
    const dy = e.clientY - uiState.lastDragY;
    uiState.lastDragX = e.clientX;
    uiState.lastDragY = e.clientY;
    renderer.camX -= dx / renderer.zoom;
    renderer.camY -= dy / renderer.zoom;
    return;
  }

  if (uiState.paintingLeft) {
    // Auto-orient belt direction toward drag motion
    if (uiState.selectedBuilding === 'belt' && uiState.prevBeltTile) {
      const dx = tx - uiState.prevBeltTile.tx;
      const dy = ty - uiState.prevBeltTile.ty;
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        const dIdx = DIRS.findIndex(d => d.dx === dx && d.dy === dy);
        if (dIdx >= 0) {
          uiState.buildDir = dIdx;
          const prevB = sim.buildings[uiState.prevBeltTile.ty]?.[uiState.prevBeltTile.tx];
          if (prevB && prevB.id === 'belt') prevB.dir = dIdx;
          syncPaletteSelection();
        }
        uiState.prevBeltTile = { tx, ty };
      }
    }
    applyBrushAt(tx, ty, false);
  } else if (uiState.paintingRight) {
    applyBrushAt(tx, ty, true);
  }
});

window.addEventListener('mouseup', () => {
  uiState.draggingMap = false;
  uiState.paintingLeft = false;
  uiState.paintingRight = false;
  uiState.lastPaintTile = null;
});

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.12 : 0.89;
  renderer.zoom = Math.max(0.45, Math.min(2.2, renderer.zoom * factor));
}, { passive: false });

// Click on minimap to jump camera
minimap.addEventListener('mousedown', e => {
  const rect = minimap.getBoundingClientRect();
  const nx = (e.clientX - rect.left) / rect.width;
  const ny = (e.clientY - rect.top) / rect.height;
  renderer.camX = nx * GRID_W * TILE_SIZE;
  renderer.camY = ny * GRID_H * TILE_SIZE;
});

window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toUpperCase();
  uiState.keysDown.add(k);

  if (k === 'R') {
    uiState.buildDir = (uiState.buildDir + 1) & 3;
    audio.rotate();
    syncPaletteSelection();
  } else if (k === 'ESCAPE' || k === 'Q') {
    uiState.selectedBuilding = null;
    uiState.inspectTile = null;
    syncPaletteSelection();
    updateInspector();
  } else if (k === 'P') {
    sim.paused = !sim.paused;
    showToast(sim.paused ? 'SIMULATION PAUSED' : 'SIMULATION RESUMED', '#fbbf24');
  } else if (k === ' ') {
    e.preventDefault();
    if (sim.triggerOverdrive()) {
      showToast('⚡ CORE OVERDRIVE SHOCKWAVE ACTIVATED!', '#38bdf8');
    }
  } else if (e.key === 'F5') {
    e.preventDefault();
    saveGame();
  } else if (e.key === 'F9') {
    e.preventDefault();
    loadGame();
  } else {
    const match = BUILDINGS.find(b => b.key.toUpperCase() === k);
    if (match) {
      uiState.selectedBuilding = match.id;
      syncPaletteSelection();
    }
  }
});

window.addEventListener('keyup', e => {
  uiState.keysDown.delete(e.key.toUpperCase());
});

// Wire top/side action buttons
document.getElementById('btn-rotate')?.addEventListener('click', () => {
  uiState.buildDir = (uiState.buildDir + 1) & 3;
  audio.rotate();
  syncPaletteSelection();
});
document.getElementById('btn-overdrive')?.addEventListener('click', () => {
  if (!sim.triggerOverdrive()) {
    showToast(`Overdrive cooling down (${Math.ceil(sim.overdriveCooldown)}s)`, '#f87171');
  }
});
document.getElementById('btn-send-wave')?.addEventListener('click', () => {
  if (!sim.waveActive) {
    sim.launchWave();
    showToast('⚔ NEXT SIEGE WAVE CALLED EARLY!', '#fb923c');
  }
});
document.getElementById('btn-pause')?.addEventListener('click', e => {
  sim.paused = !sim.paused;
  e.currentTarget.textContent = sim.paused ? '▶ Resume' : '⏸ Pause';
});
document.getElementById('btn-center')?.addEventListener('click', () => {
  renderer.camX = (CORE_X + 1) * TILE_SIZE;
  renderer.camY = (CORE_Y + 1) * TILE_SIZE;
});
document.getElementById('btn-dismiss-guide')?.addEventListener('click', () => {
  document.getElementById('canvas-hud-guide')?.classList.add('hidden');
});
document.getElementById('btn-mute')?.addEventListener('click', e => {
  const m = audio.toggleMute();
  e.currentTarget.textContent = m ? '🔇 Mute' : '🔊 SFX';
});

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, sim.serialize());
    showToast('✓ Factory blueprint & telemetry saved to localStorage', '#34d399');
  } catch (err) {
    showToast('Save failed', '#ef4444');
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { showToast('No saved factory found', '#f87171'); return; }
    sim.deserialize(raw);
    showToast('✓ Factory blueprint loaded', '#34d399');
  } catch (err) {
    showToast('Load failed', '#ef4444');
  }
}

document.getElementById('btn-save')?.addEventListener('click', saveGame);
document.getElementById('btn-load')?.addEventListener('click', loadGame);
document.getElementById('btn-reset')?.addEventListener('click', () => {
  sim.reset();
  document.getElementById('modal-gameover').style.display = 'none';
  showToast('New sector generated', '#38bdf8');
});
document.getElementById('btn-modal-restart')?.addEventListener('click', () => {
  sim.reset();
  document.getElementById('modal-gameover').style.display = 'none';
});

document.querySelectorAll('[data-craft]').forEach(btn => {
  btn.addEventListener('click', () => {
    const r = btn.dataset.craft;
    if (!sim.manualCraft(r)) {
      showToast('Insufficient raw ingots in Core stock', '#f87171');
    }
  });
});

// Periodic HUD sync
const stockIds = ['iron', 'copper', 'coal', 'steel', 'circuit', 'ammo', 'shell', 'cell', 'aether'];
function syncHud() {
  for (const id of stockIds) {
    const el = document.getElementById(`res-${id}`);
    if (el) el.textContent = Math.floor(sim.stock[id] || 0);
  }

  // Palette affordability states
  document.querySelectorAll('.build-card').forEach(card => {
    const def = BUILDING_BY_ID[card.dataset.id];
    card.classList.toggle('unaffordable', !sim.canAfford(def.cost));
  });

  // Top telemetry bar
  const corePct = Math.max(0, Math.round((sim.coreHp / sim.coreMaxHp) * 100));
  document.getElementById('hud-core-hp').textContent = `${Math.ceil(sim.coreHp)}/${sim.coreMaxHp}`;
  document.getElementById('hud-core-bar').style.width = `${corePct}%`;

  const wDef = WAVES[Math.min(WAVES.length - 1, sim.waveIndex)];
  const waveEl = document.getElementById('hud-wave-status');
  if (sim.waveActive) {
    const rem = sim.enemies.length + sim.spawnQueue.length;
    waveEl.textContent = `WAVE ${sim.waveIndex + 1}/${WAVES.length} · ${wDef.title} (${rem} HOSTILES)`;
    waveEl.style.color = '#fb7185';
  } else {
    waveEl.textContent = `WAVE ${sim.waveIndex + 1}/${WAVES.length} IN ${Math.ceil(sim.waveTimer)}s · ${wDef.title}`;
    waveEl.style.color = '#38bdf8';
  }

  const odBtn = document.getElementById('btn-overdrive');
  if (odBtn) {
    if (sim.overdriveCooldown > 0) {
      odBtn.textContent = `⚡ ${Math.ceil(sim.overdriveCooldown)}s`;
      odBtn.disabled = true;
    } else {
      odBtn.textContent = `⚡ Overdrive`;
      odBtn.disabled = false;
    }
  }

  // Mission Objectives checklist
  const setObj = (id, done, text) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'obj-row' + (done ? ' done' : '');
    el.textContent = (done ? '✓ ' : '○ ') + text;
  };
  setObj('obj-1', sim.stats.drillsBuilt >= 2, `Deploy Excavator Drills (${sim.stats.drillsBuilt}/2)`);
  setObj('obj-2', sim.stats.turretsBuilt >= 4, `Fortify with Defense Turrets (${sim.stats.turretsBuilt}/4)`);
  setObj('obj-3', sim.stats.smelted >= 25, `Smelt & Fabricate Ordnance (${sim.stats.smelted}/25)`);
  setObj('obj-4', sim.stats.wavesCleared >= 5, `Repel Siege Crawler Waves (${sim.stats.wavesCleared}/5)`);
  setObj('obj-5', sim.stats.spireProgress >= 100, `Charge Orbital Ascension Spire (${sim.stats.spireProgress}%)`);

  if (sim.over) {
    const modal = document.getElementById('modal-gameover');
    if (modal && modal.style.display !== 'flex') {
      modal.style.display = 'flex';
      document.getElementById('modal-title').textContent = sim.won ? 'ORBITAL ASCENSION COMPLETE' : 'REACTOR CORE BREACHED';
      document.getElementById('modal-title').style.color = sim.won ? '#34d399' : '#f87171';
      document.getElementById('modal-summary').textContent =
        `Waves Cleared: ${sim.stats.wavesCleared} · Hostiles Eliminated: ${sim.stats.kills} · Ore Extracted: ${sim.stats.mined} · Spire Charge: ${sim.stats.spireProgress}%`;
    }
  }
}

// Main 60fps Loop
window.addEventListener('resize', () => renderer.resize());
renderer.resize();
initPalette();

let lastTime = performance.now();
let hudAccum = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  // WASD / Arrow camera pan
  const panSpeed = (340 / renderer.zoom) * dt;
  if (uiState.keysDown.has('W') || uiState.keysDown.has('ARROWUP')) renderer.camY -= panSpeed;
  if (uiState.keysDown.has('S') || uiState.keysDown.has('ARROWDOWN')) renderer.camY += panSpeed;
  if (uiState.keysDown.has('A') || uiState.keysDown.has('ARROWLEFT')) renderer.camX -= panSpeed;
  if (uiState.keysDown.has('D') || uiState.keysDown.has('ARROWRIGHT')) renderer.camX += panSpeed;

  sim.step(dt);
  renderer.render(sim, uiState);

  hudAccum += dt;
  if (hudAccum >= 0.12) {
    hudAccum = 0;
    syncHud();
  }

  requestAnimationFrame(frame);
}

syncHud();
window.__ironworks = { sim, renderer, uiState, updateInspector };

// Optional ?preview=showcase query hook for visual regression & combat inspection
if (new URLSearchParams(window.location.search).get('preview') === 'showcase') {
  sim.stock.steel = 200;
  sim.stock.circuit = 200;
  sim.stock.cell = 100;
  sim.stock.iron = 500;
  sim.stock.copper = 500;
  sim.placeBuilding('fabricator', CORE_X - 2, CORE_Y + 2, 1);
  sim.placeBuilding('splitter', CORE_X - 1, CORE_Y + 2, 1);
  sim.placeBuilding('tesla', CORE_X - 4, CORE_Y - 2, 0);
  sim.placeBuilding('mortar', CORE_X + 4, CORE_Y - 2, 0);
  sim.placeBuilding('railgun', CORE_X - 3, CORE_Y + 4, 2);
  sim.placeBuilding('spire', CORE_X + 2, CORE_Y - 3, 0);
  sim.stats.spireProgress = 60;
  uiState.inspectTile = { x: CORE_X - 2, y: CORE_Y + 2 };
  updateInspector();
  // Spawn a sample combat wave near the perimeter and advance simulation 2.5s
  sim.launchWave();
  for (const type of ['skitter', 'carapace', 'spitter', 'breacher', 'leviathan']) {
    sim.spawnEnemyOnEdge(type);
    const e = sim.enemies[sim.enemies.length - 1];
    e.x = CORE_X - 6 + (sim.rng() * 13);
    e.y = CORE_Y - 5 + (sim.rng() * 11);
    if (Math.hypot(e.x - (CORE_X + 1), e.y - (CORE_Y + 1)) < 3.5) e.x -= 4;
  }
  for (let i = 0; i < 40; i++) sim.step(0.05);
  syncHud();
}

requestAnimationFrame(frame);
