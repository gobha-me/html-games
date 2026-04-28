// Save / load UI. Renders the slot list with metadata (turn, faction,
// timestamp) and Save / Load / Delete buttons per slot. Window-bound
// handlers preserve the Phase 1 inline-onclick pattern; Phase 2's
// data-attribute migration can sweep all of them at once.

import { DOM_IDS } from '../core/dom';
import { G } from '../core/state';
import {
  AUTOSAVE_KEY,
  deleteSlot,
  listSlots,
  loadGameState,
  ModMismatchError,
  readSlot,
  SaveDataMismatchError,
  SaveVersionMismatchError,
  serializeGameState,
  writeSlot,
  type SaveData,
  type Slot,
} from '../core/save';
import { log } from '../core/log';
import { closeModal } from './modals';
import { updateUI } from './topbar';
import { render } from '../render/pixi';
import { dumpTelemetry, getTelemetryLog } from '../systems/telemetry';

export function renderSaveModal(): void {
  const slots = listSlots();
  const inGame = G.map !== null;
  const html = slots.map((s) => renderSlotRow(s, inGame)).join('');
  const content = document.getElementById(DOM_IDS.SAVE_CONTENT);
  if (content) content.innerHTML = html;
  refreshTelemetryButton();
}

function renderSlotRow(slot: Slot, inGame: boolean): string {
  const filled = slot.data !== null;
  const meta = filled ? formatSaveMeta(slot.data!) : 'Empty';
  const swatchStyle = filled
    ? `background:${slot.data!.factionColor}33;border-color:${slot.data!.factionColor};color:${slot.data!.factionColor}`
    : 'background:var(--bg-3);border-color:var(--brass-d);color:var(--parchment-d)';
  const swatchGlyph = filled ? slot.data!.factionGlyph : '·';

  let actions = '';
  if (filled) {
    actions += `<button class="btn small" onclick="loadFromSlot('${slot.key}')">Load</button>`;
  }
  if (inGame && !slot.isAuto) {
    const verb = filled ? 'Overwrite' : 'Save';
    actions += `<button class="btn small primary" onclick="saveToSlot('${slot.key}')">${verb}</button>`;
  }
  if (filled) {
    actions += `<button class="btn small danger" onclick="deleteFromSlot('${slot.key}')">Delete</button>`;
  }

  return `
    <div class="diplo-row" style="margin-bottom:8px">
      <div class="swatch" style="${swatchStyle}">${swatchGlyph}</div>
      <div class="info">
        <div class="name" style="color:${filled ? slot.data!.factionColor : 'var(--parchment)'}">${slot.label}${slot.isAuto ? ' <span style="color:var(--parchment-d);font-size:11px">(auto)</span>' : ''}</div>
        <div style="font-size:11px;color:var(--parchment-d);margin-top:2px">${meta}</div>
      </div>
      <div class="actions" style="display:flex;gap:6px">${actions}</div>
    </div>`;
}

function formatSaveMeta(data: SaveData): string {
  const date = new Date(data.timestamp);
  const dateStr = date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const modTag = data.state.modName ? ` · mod: ${data.state.modName}` : '';
  return `${data.factionName} · Turn ${data.turn} · ${data.mapSize.w}×${data.mapSize.h} · ${dateStr}${modTag}`;
}

// --- Window-bound handlers ------------------------------------------------

function saveToSlot(key: string): void {
  if (!G.map) return;
  try {
    writeSlot(key, serializeGameState());
    log('Records updated.', 'good');
    renderSaveModal();
  } catch (err) {
    log(
      `Could not save: ${err instanceof Error ? err.message : 'unknown error'}.`,
      'warning'
    );
  }
}

function loadFromSlot(key: string): void {
  const data = readSlot(key);
  if (!data) return;
  if (G.map !== null) {
    const ok = window.confirm(
      `Load this save? Your current game (Turn ${G.turn}) will be discarded.`
    );
    if (!ok) return;
  }
  try {
    loadGameState(data);
  } catch (err) {
    if (err instanceof SaveVersionMismatchError) {
      window.alert(
        `This save was made with version ${err.got}; current is ${err.want}. Cannot load.`
      );
    } else if (err instanceof ModMismatchError) {
      window.alert(err.message);
    } else if (err instanceof SaveDataMismatchError) {
      window.alert(`Cannot load: ${err.message}.`);
    } else {
      window.alert(
        `Failed to load: ${err instanceof Error ? err.message : 'unknown error'}.`
      );
    }
    return;
  }
  closeModal(DOM_IDS.SAVE_MODAL);
  closeModal(DOM_IDS.SETUP_MODAL);
  log(`Records read. The Awakening resumes at turn ${G.turn}.`, 'flavor');
  updateUI();
  render();
}

function deleteFromSlot(key: string): void {
  const data = readSlot(key);
  if (!data) return;
  const ok = window.confirm(
    `Delete the save for ${data.factionName} (Turn ${data.turn})?`
  );
  if (!ok) return;
  if (key === AUTOSAVE_KEY) {
    // Autosave is replaced on next end-of-turn; deleting it is allowed
    // but transient. Still useful for a clean reset.
  }
  deleteSlot(key);
  renderSaveModal();
}

const w = window as Window &
  typeof globalThis & {
    saveToSlot: typeof saveToSlot;
    loadFromSlot: typeof loadFromSlot;
    deleteFromSlot: typeof deleteFromSlot;
  };
w.saveToSlot = saveToSlot;
w.loadFromSlot = loadFromSlot;
w.deleteFromSlot = deleteFromSlot;

// Phase 2j-5: telemetry download. Greys out when there's nothing to dump
// (no events recorded) — mirrors the Continue-button greying pattern.
const telemetryBtn = document.getElementById(
  DOM_IDS.TELEMETRY_DOWNLOAD_BTN
) as HTMLButtonElement | null;

export function refreshTelemetryButton(): void {
  if (!telemetryBtn) return;
  const empty = getTelemetryLog().length === 0;
  telemetryBtn.disabled = empty;
  telemetryBtn.style.opacity = empty ? '0.55' : '';
  telemetryBtn.title = empty
    ? 'No telemetry recorded yet — start a game and play a few turns.'
    : 'Download a JSON log of this game\'s AI turns, combats, and build picks';
}

if (telemetryBtn) {
  telemetryBtn.addEventListener('click', () => {
    const data = dumpTelemetry();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cogfall-telemetry-seed${data.seed}-turn${data.turn}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}
