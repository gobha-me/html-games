// Setup modal — faction picker + world-seed input + mod loader. The actual
// game start (mapgen, faction creation, starting units, etc.) happens in
// systems/setup.ts; this module is just the form/picker UI.

import { DOM_IDS } from '../core/dom';
import { applyMod, clearMod, getActiveMod } from '../core/mod';
import { AUTOSAVE_KEY, readSlot } from '../core/save';
import { FACTIONS } from '../data/factions';
import { isMinimapVisible, setMinimapVisible } from './minimap';
import { isAudioMuted, setAudioMuted } from '../systems/audio';
import { isTelemetryEnabled, setTelemetryEnabled } from '../systems/telemetry';
import { isReplayEnabled, setReplayEnabled } from '../systems/replay';
import { isOverlayEnabled, setOverlayEnabled } from '../systems/debugOverlay';

let setupSelectedFaction = 0;
// Phase 2m — hot-seat state. When false, behavior is byte-identical to today
// (single-pick, opponent-count slot fills AIs). When true, every FACTION in
// the live pool plays and the user marks individual cards Human; the rest
// auto-become AI ("AI picks what's left"). humanSeats stores FACTIONS-pool
// indices, NOT runtime faction.idx values — those are assigned in setup.ts
// based on push order (humans first, AIs after).
let setupHotSeatEnabled = false;
let humanSeats = new Set<number>([0]);

export function getSelectedFactionIdx(): number {
  return setupSelectedFaction;
}

/** Phase 2m — sorted FACTIONS-pool indices marked human in the setup modal.
 * Single-player mode returns [setupSelectedFaction] for a uniform setup.ts
 * code path. Always non-empty (UI prevents zero-human selection). */
export function getHumanFactionIndices(): number[] {
  if (!setupHotSeatEnabled) return [setupSelectedFaction];
  return [...humanSeats].sort((a, b) => a - b);
}

/** Phase 2m — derived control mode. Coerces back to 'single' when hot-seat
 * is enabled but only one human is marked (the toggle is a no-op below 2). */
export function getSetupControlMode(): 'single' | 'hotseat' {
  return setupHotSeatEnabled && humanSeats.size >= 2 ? 'hotseat' : 'single';
}

/**
 * Read the world-seed value from the setup form. Clamped to a 32-bit
 * unsigned int so it fits mulberry32's state. Falls back to a fresh random
 * seed if the field is missing or non-numeric (defensive — the populate
 * helper below should always have run by the time the user clicks Begin).
 */
export function getSetupSeed(): number {
  const el = document.getElementById(DOM_IDS.SETUP_SEED) as HTMLInputElement | null;
  if (!el) return freshSeed();
  const raw = parseInt(el.value, 10);
  if (!Number.isFinite(raw)) return freshSeed();
  return raw >>> 0;
}

function freshSeed(): number {
  return (Math.random() * 0x100000000) >>> 0;
}

export function populateSeedInput(): void {
  const el = document.getElementById(DOM_IDS.SETUP_SEED) as HTMLInputElement | null;
  if (!el) return;
  el.value = String(freshSeed());
}

function randomizeSetupSeed(): void {
  populateSeedInput();
}

export function renderFactionList(): void {
  const el = document.getElementById(DOM_IDS.FACTION_LIST);
  if (!el) return;
  el.innerHTML = FACTIONS.map((f, i) => {
    const isHuman = setupHotSeatEnabled ? humanSeats.has(i) : i === setupSelectedFaction;
    const role = setupHotSeatEnabled
      ? `<div class="role" style="font-size:11px;color:${isHuman ? f.color : 'var(--parchment-d)'};font-style:italic;margin-top:4px">${isHuman ? '👤 Human' : '🤖 AI'}</div>`
      : '';
    return `<div class="faction-card ${isHuman ? 'selected' : ''}" onclick="setupSelectFaction(${i})"><div class="swatch" style="background:${f.color}33;border-color:${f.color}">${f.glyph}</div><div class="info"><div class="title" style="color:${f.color}">${f.name}</div><div class="desc">${f.desc}</div><div class="traits">${f.traits}</div>${role}</div></div>`;
  }).join('');
}

function setupSelectFaction(i: number): void {
  if (setupHotSeatEnabled) {
    if (humanSeats.has(i)) {
      humanSeats.delete(i);
      // Never empty — flipping the only human back to AI re-adds it.
      if (humanSeats.size === 0) humanSeats.add(i);
    } else {
      humanSeats.add(i);
    }
    // Keep setupSelectedFaction pointed at the lowest-index human so a
    // hot-seat → single toggle flip lands on a sensible card.
    setupSelectedFaction = Math.min(...humanSeats);
  } else {
    setupSelectedFaction = i;
  }
  renderFactionList();
}

(
  window as Window & typeof globalThis & { setupSelectFaction: typeof setupSelectFaction }
).setupSelectFaction = setupSelectFaction;

// Wire the 🎲 button. Inline onclick would also work, but the button has no
// other handler so a single addEventListener at module load is cleaner.
document.getElementById(DOM_IDS.SEED_REGEN)?.addEventListener('click', randomizeSetupSeed);

// Phase 2h-2: hydrate the minimap checkbox from the persisted preference so
// the user sees their last setting reflected when the modal opens. Toggle
// is live — flipping the box hides/shows the minimap immediately, no need
// to wait for Begin.
const minimapCheckbox = document.getElementById(DOM_IDS.SHOW_MINIMAP) as HTMLInputElement | null;
if (minimapCheckbox) {
  minimapCheckbox.checked = isMinimapVisible();
  minimapCheckbox.addEventListener('change', () => {
    setMinimapVisible(minimapCheckbox.checked);
  });
}

// Phase 2h-3: same live-toggle pattern for the sound checkbox. Checkbox is
// "Sound on", so checked ↔ unmuted.
const soundCheckbox = document.getElementById(DOM_IDS.SOUND_ON) as HTMLInputElement | null;
if (soundCheckbox) {
  soundCheckbox.checked = !isAudioMuted();
  soundCheckbox.addEventListener('change', () => {
    setAudioMuted(!soundCheckbox.checked);
  });
}

// Phase 2j-5: telemetry checkbox. Default-on; live toggle so a player who
// flips it mid-setup gets the new state when they hit Begin.
const telemetryCheckbox = document.getElementById(
  DOM_IDS.TELEMETRY_ENABLED
) as HTMLInputElement | null;
if (telemetryCheckbox) {
  telemetryCheckbox.checked = isTelemetryEnabled();
  telemetryCheckbox.addEventListener('change', () => {
    setTelemetryEnabled(telemetryCheckbox.checked);
  });
}

// Phase 2k-4: replay checkbox. Same default-on / live-toggle shape as
// telemetry — flipping it before Begin captures the new state.
const replayCheckbox = document.getElementById(
  DOM_IDS.REPLAY_ENABLED
) as HTMLInputElement | null;
if (replayCheckbox) {
  replayCheckbox.checked = isReplayEnabled();
  replayCheckbox.addEventListener('change', () => {
    setReplayEnabled(replayCheckbox.checked);
  });
}

// Phase 2L: debug overlay master flag. Default-OFF (debug-only) so
// the backtick hotkey is unbound for normal play. Live toggle —
// disabling resets the active mode to off (idempotence handled
// inside setOverlayEnabled).
const debugOverlayCheckbox = document.getElementById(
  DOM_IDS.DEBUG_OVERLAY_ENABLED
) as HTMLInputElement | null;
if (debugOverlayCheckbox) {
  debugOverlayCheckbox.checked = isOverlayEnabled();
  debugOverlayCheckbox.addEventListener('change', () => {
    setOverlayEnabled(debugOverlayCheckbox.checked);
  });
}

// Phase 2m: hot-seat toggle. Default-OFF (single-player byte-identical to
// pre-2m). Flipping ON seeds humanSeats with the currently-selected card so
// the user starts from a sensible "1 human" state and adds seats by clicking
// other cards. Flipping OFF projects back to single-pick on the lowest
// human-seat index. Opponent-count input is hidden in hot-seat — every
// FACTION in the live pool plays, AIs fill what humans don't claim.
const hotSeatCheckbox = document.getElementById(
  DOM_IDS.HOT_SEAT_ENABLED,
) as HTMLInputElement | null;
const opponentCountSection = document.getElementById(DOM_IDS.OPPONENT_COUNT_SECTION);
if (hotSeatCheckbox) {
  hotSeatCheckbox.addEventListener('change', () => {
    setupHotSeatEnabled = hotSeatCheckbox.checked;
    if (setupHotSeatEnabled) {
      humanSeats = new Set([setupSelectedFaction]);
    } else {
      setupSelectedFaction = humanSeats.size > 0 ? Math.min(...humanSeats) : 0;
    }
    if (opponentCountSection) {
      opponentCountSection.style.display = setupHotSeatEnabled ? 'none' : '';
    }
    renderFactionList();
  });
}

/**
 * Reflects autosave-vs-active-mod state on the Continue button. Called at
 * page init and again after every mod load/clear so the button stays in
 * sync with which mod (if any) the user has active.
 *
 *   no autosave        ⇒ hidden
 *   autosave matches   ⇒ visible + enabled
 *   autosave mismatch  ⇒ visible + disabled, with a tooltip pointing at
 *                        the mod the user needs to load
 */
export function refreshContinueButton(): void {
  const btn = document.getElementById(DOM_IDS.CONTINUE_BTN) as HTMLButtonElement | null;
  if (!btn) return;
  const auto = readSlot(AUTOSAVE_KEY);
  if (!auto) {
    btn.style.display = 'none';
    return;
  }
  btn.style.display = 'inline-block';
  const saveHash = auto.state.modHash;
  const activeHash = getActiveMod()?.hash;
  if (saveHash === activeHash) {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.title = '';
  } else {
    btn.disabled = true;
    btn.style.opacity = '0.55';
    btn.title = saveHash
      ? `Autosave was made with mod "${auto.state.modName ?? '?'}". Load that mod first.`
      : 'Autosave was made without a mod — clear the mod to continue.';
  }
}

// Phase 2i-4: mod loader. File input → JSON.parse → applyMod. On success
// the status line shows "Mod: name vX loaded" and the faction picker
// re-renders (mods may add/remove factions). On error the status line
// turns red with the validation message and the data tables stay clean
// (applyMod is transactional).
const modFileInput = document.getElementById(DOM_IDS.MOD_FILE) as HTMLInputElement | null;
const modClearBtn = document.getElementById(DOM_IDS.MOD_CLEAR_BTN) as HTMLButtonElement | null;
const modStatusEl = document.getElementById(DOM_IDS.MOD_STATUS);

function setModStatus(text: string, isError: boolean): void {
  if (!modStatusEl) return;
  modStatusEl.textContent = text;
  modStatusEl.style.color = isError ? '#c44a4a' : 'var(--parchment-d)';
}

if (modFileInput) {
  modFileInput.addEventListener('change', () => {
    const file = modFileInput.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        const json: unknown = JSON.parse(text);
        const mod = applyMod(json);
        setModStatus(`Mod: ${mod.name} v${mod.version} loaded`, false);
        setupSelectedFaction = 0;
        renderFactionList();
        refreshContinueButton();
      })
      .catch((e: unknown) => {
        setModStatus(e instanceof Error ? e.message : String(e), true);
      });
  });
}

if (modClearBtn) {
  modClearBtn.addEventListener('click', () => {
    clearMod();
    if (modFileInput) modFileInput.value = '';
    setModStatus('', false);
    setupSelectedFaction = 0;
    renderFactionList();
    refreshContinueButton();
  });
}
