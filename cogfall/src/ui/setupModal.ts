// Setup modal — faction picker + world-seed input. The actual game start
// (mapgen, faction creation, starting units, etc.) happens in
// systems/setup.ts; this module is just the form/picker UI.

import { DOM_IDS } from '../core/dom';
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
