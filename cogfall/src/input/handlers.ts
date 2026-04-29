// Mouse, wheel, and keyboard handlers. Registers everything at import-time.
//
// The static-button click handlers (tech, diplo, end-turn, next-unit) also
// live here — they're keyboard/click input and tying them to the same module
// keeps the wiring discoverable.

import { pixelToHex } from '../core/hex';
import { DOM_IDS } from '../core/dom';
import { G, getCityAt, getTile, getUnitAt } from '../core/state';
import { combat } from '../systems/combat';
import { stealTech } from '../systems/espionage';
import { computeAttackTargets, computeMoveTargets, moveUnit } from '../systems/movement';
import { endTurn } from '../systems/turn';
import { canvas, centerOnHex, render } from '../render/pixi';
import { closeAllModals, openModal } from '../ui/modals';
import { renderTechTree } from '../ui/techModal';
import { renderDiploScreen } from '../ui/diploModal';
import { renderSaveModal } from '../ui/saveModal';
import { openHotkeyLegend } from '../ui/hotkeyLegend';
import { clearHoveredHex, handleHover } from '../ui/tooltip';
import { updateUI } from '../ui/topbar';
import { cycleMode, getMode, isOverlayEnabled, setMode } from '../systems/debugOverlay';

const ZOOM_FACTOR = 1.12;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 2.5;

// --- Canvas mouse / wheel ---------------------------------------------------

canvas.addEventListener('mousedown', (e) => {
  if (e.button === 2) {
    G.isDragging = true;
    G.dragStart = {
      x: e.clientX - G.cameraX,
      y: e.clientY - G.cameraY,
      cameraX: G.cameraX,
      cameraY: G.cameraY,
    };
    clearHoveredHex();
    e.preventDefault();
  }
});

window.addEventListener('mouseup', () => {
  G.isDragging = false;
});

canvas.addEventListener('mousemove', (e) => {
  if (G.isDragging && G.dragStart) {
    G.cameraX = e.clientX - G.dragStart.x;
    G.cameraY = e.clientY - G.dragStart.y;
    render();
  } else {
    handleHover(e);
  }
});

canvas.addEventListener('mouseleave', clearHoveredHex);

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

canvas.addEventListener('wheel', (e) => {
  const oldZoom = G.zoom;
  G.zoom *= e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
  G.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, G.zoom));
  const k = G.zoom / oldZoom;
  G.cameraX = e.clientX - (e.clientX - G.cameraX) * k;
  G.cameraY = e.clientY - (e.clientY - G.cameraY) * k;
  render();
  e.preventDefault();
});

// --- Canvas click (the main game-input path) --------------------------------

canvas.addEventListener('click', (e) => {
  if (G.gameOver) return;
  // Phase 2m: curtain modal blocks all canvas input until the next player
  // clicks Continue. Pre-curtain checks (gameOver) take precedence.
  if (G.passoverActive) return;
  if (G.factions[G.currentFactionIdx].isAI) return;
  const wx = (e.clientX - G.cameraX) / G.zoom;
  const wy = (e.clientY - G.cameraY) / G.zoom;
  const { q, r } = pixelToHex(wx, wy);
  const tile = getTile(q, r);
  if (!tile) return;
  if (!tile.visibility[G.playerFactionIdx] || tile.visibility[G.playerFactionIdx] === 'unseen') {
    return;
  }
  if (
    G.selected &&
    G.selected.type === 'unit' &&
    G.selected.ref.factionIdx === G.playerFactionIdx
  ) {
    const u = G.selected.ref;
    if (G.sabotageTargets.some((t) => t.q === q && t.r === r)) {
      const victim = getCityAt(q, r);
      if (victim) {
        stealTech(u, victim);
        G.selected = null;
        G.moveTargets = [];
        G.attackTargets = [];
        G.sabotageTargets = [];
        render();
        updateUI();
        return;
      }
    }
    if (G.attackTargets.some((t) => t.q === q && t.r === r)) {
      combat(u, { q, r, target: 'unit' });
      if (G.units.includes(u)) {
        G.moveTargets = computeMoveTargets(u);
        G.attackTargets = computeAttackTargets(u);
      } else {
        G.selected = null;
        G.moveTargets = [];
        G.attackTargets = [];
      }
      G.sabotageTargets = [];
      render();
      updateUI();
      return;
    }
    if (G.moveTargets.some((t) => t.q === q && t.r === r)) {
      moveUnit(u, q, r);
      G.moveTargets = computeMoveTargets(u);
      G.attackTargets = computeAttackTargets(u);
      G.sabotageTargets = [];
      render();
      updateUI();
      return;
    }
  }
  const unit = getUnitAt(q, r);
  const city = getCityAt(q, r);
  const ownUnit = unit && unit.factionIdx === G.playerFactionIdx ? unit : null;
  const ownCity = city && city.factionIdx === G.playerFactionIdx ? city : null;
  // Stacked-tile click-cycle: when both an own unit and own city share a
  // tile, the first click prefers the unit (matches pre-2m behavior). A
  // repeat click while the unit is already selected reveals the city so
  // the build menu / city panel becomes reachable. Symmetric the other
  // way — clicking while the city is selected re-selects the unit. Without
  // this cycle a city with a garrison was effectively un-clickable.
  const unitAlreadySelectedHere =
    ownUnit &&
    G.selected &&
    G.selected.type === 'unit' &&
    G.selected.ref.id === ownUnit.id;
  if (ownUnit && ownCity && unitAlreadySelectedHere) {
    G.selected = { type: 'city', ref: ownCity };
    G.moveTargets = [];
    G.attackTargets = [];
  } else if (ownUnit) {
    G.selected = { type: 'unit', ref: ownUnit };
    G.moveTargets = computeMoveTargets(ownUnit);
    G.attackTargets = computeAttackTargets(ownUnit);
  } else if (ownCity) {
    G.selected = { type: 'city', ref: ownCity };
    G.moveTargets = [];
    G.attackTargets = [];
  } else {
    G.selected = { type: 'tile', ref: tile };
    G.moveTargets = [];
    G.attackTargets = [];
  }
  G.sabotageTargets = [];
  render();
  updateUI();
});

// --- Keyboard ---------------------------------------------------------------

window.addEventListener('keydown', (e) => {
  const target = e.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
  if (G.gameOver) return;
  // Phase 2m: curtain modal blocks game hotkeys (Space/Enter/N/F/Esc/`).
  // The Continue button is browser-focused so Enter/Space activates it
  // natively without going through this listener.
  if (G.passoverActive) return;
  if (e.key === ' ' || e.key === 'Enter') {
    if (!G.factions[G.currentFactionIdx].isAI) endTurn();
    e.preventDefault();
  }
  if (e.key === 'n' || e.key === 'N') selectNextUnit();
  if (e.key === 'f' || e.key === 'F') {
    if (
      G.selected &&
      G.selected.type === 'unit' &&
      G.selected.ref.factionIdx === G.playerFactionIdx
    ) {
      G.selected.ref.fortified = true;
      G.selected.ref.mp = 0;
      render();
      updateUI();
    }
  }
  if (e.key === 't' || e.key === 'T') {
    G.showThreatRange = !G.showThreatRange;
    render();
  }
  if (e.key === 'Escape') {
    closeAllModals();
    G.selected = null;
    G.moveTargets = [];
    G.attackTargets = [];
    G.sabotageTargets = [];
    render();
    updateUI();
  }
  // Phase 2L — backtick / tilde cycles the debug overlay mode. Gated
  // by the setup-modal master flag so the key is intentionally unbound
  // for normal play.
  if (e.key === '`' || e.key === '~') {
    if (!isOverlayEnabled()) return;
    setMode(cycleMode(getMode()));
    render();
    e.preventDefault();
  }
  // Phase 2n-2 — `?` opens the Stewards' Codex (hotkey legend).
  if (e.key === '?') {
    openHotkeyLegend();
    e.preventDefault();
  }
});

export function selectNextUnit(): void {
  const myUnits = G.units.filter(
    (u) => u.factionIdx === G.playerFactionIdx && u.mp > 0 && !u.fortified
  );
  if (!myUnits.length) return;
  let idx = 0;
  if (G.selected && G.selected.type === 'unit') {
    const cur = G.selected.ref;
    const i = myUnits.findIndex((u) => u.id === cur.id);
    if (i !== -1) idx = (i + 1) % myUnits.length;
  }
  const u = myUnits[idx];
  G.selected = { type: 'unit', ref: u };
  G.moveTargets = computeMoveTargets(u);
  G.attackTargets = computeAttackTargets(u);
  G.sabotageTargets = [];
  centerOnHex(u.q, u.r);
  render();
  updateUI();
}

// --- Static button listeners ------------------------------------------------

document.getElementById(DOM_IDS.TECH_BTN)?.addEventListener('click', () => {
  renderTechTree();
  openModal(DOM_IDS.TECH_MODAL);
});
document.getElementById(DOM_IDS.DIPLO_BTN)?.addEventListener('click', () => {
  renderDiploScreen();
  openModal(DOM_IDS.DIPLO_MODAL);
});
document.getElementById(DOM_IDS.RECORDS_BTN)?.addEventListener('click', () => {
  renderSaveModal();
  openModal(DOM_IDS.SAVE_MODAL);
});
document.getElementById(DOM_IDS.END_TURN_BTN)?.addEventListener('click', () => {
  if (!G.factions[G.currentFactionIdx].isAI) endTurn();
});
document.getElementById(DOM_IDS.NEXT_UNIT_BTN)?.addEventListener('click', selectNextUnit);
