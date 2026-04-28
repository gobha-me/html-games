// Setup modal — faction picker + world-seed input + mod loader. The actual
// game start (mapgen, faction creation, starting units, etc.) happens in
// systems/setup.ts; this module is just the form/picker UI.

import { DOM_IDS } from '../core/dom';
import { applyMod, clearMod } from '../core/mod';
import { FACTIONS } from '../data/factions';
import { isMinimapVisible, setMinimapVisible } from './minimap';
import { isAudioMuted, setAudioMuted } from '../systems/audio';

let setupSelectedFaction = 0;

export function getSelectedFactionIdx(): number {
  return setupSelectedFaction;
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
  el.innerHTML = FACTIONS.map(
    (f, i) =>
      `<div class="faction-card ${i === setupSelectedFaction ? 'selected' : ''}" onclick="setupSelectFaction(${i})"><div class="swatch" style="background:${f.color}33;border-color:${f.color}">${f.glyph}</div><div class="info"><div class="title" style="color:${f.color}">${f.name}</div><div class="desc">${f.desc}</div><div class="traits">${f.traits}</div></div></div>`
  ).join('');
}

function setupSelectFaction(i: number): void {
  setupSelectedFaction = i;
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
  });
}
