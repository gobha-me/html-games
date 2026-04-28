// Phase 2k Replay viewer modal. Opens from the save modal's "🎬 Open
// replay viewer" button. Stashes the live G via serializeGameState on
// open, mutates G to each scrubbed snapshot via applyReplayTurn, and
// restores the stash on close — so the live game is untouched by
// scrubbing.
//
// The modal absorbs clicks (it's a `.modal.show` overlay), so the canvas
// behind doesn't receive input events. updateUI + render run after every
// scrub so the top bar, event log, minimap, and canvas all reflect the
// snapshot. The stash is written through serializeGameState (full save
// shape) and restored through applySerializedStateToG (field copy only,
// no RNG re-init / log clears) — scrubbing stays read-only with respect
// to the live RNG cursor and the runtime telemetry/replay logs.

import { DOM_IDS } from '../core/dom';
import { G } from '../core/state';
import {
  applySerializedStateToG,
  serializeGameState,
  type SaveData,
} from '../core/save';
import {
  ReplayValidationError,
  applyReplayTurn,
  dumpReplay,
  getReplayLog,
  loadReplay,
  type ReplayDump,
} from '../systems/replay';
import type { TelemetryEvent } from '../systems/telemetry';
import { closeModal, openModal } from './modals';
import { render } from '../render/pixi';
import { updateUI } from './topbar';

const PLAY_INTERVAL_MS = 600;

let stash: SaveData | null = null;
let currentReplay: ReplayDump | null = null;
let currentIdx = 0;
let playTimer: number | null = null;

// --- Public API ------------------------------------------------------------

/** Entry point. Stashes the live G (if any), defaults to the in-memory
 * replay log when present, and renders the modal. */
export function openReplayModal(): void {
  if (G.map !== null) {
    stash = serializeGameState();
  } else {
    stash = null;
  }

  const log = getReplayLog();
  if (log.length > 0) {
    currentReplay = dumpReplay();
    currentIdx = 0;
    applyReplayTurn(currentReplay, currentIdx);
    updateUI();
    render();
    setStatus(
      `${currentReplay.turns.length} snapshots from this game · seed ${currentReplay.seed}`
    );
  } else {
    currentReplay = null;
    setStatus('No in-memory replay yet — upload a JSON, or play a few turns.');
  }

  refreshControls();
  refreshEventPanel();
  openModal(DOM_IDS.REPLAY_MODAL);
}

// --- Internal --------------------------------------------------------------

function closeAndRestore(): void {
  stopPlayback();
  if (stash) {
    applySerializedStateToG(stash.state);
    updateUI();
    render();
  }
  stash = null;
  currentReplay = null;
  currentIdx = 0;
  closeModal(DOM_IDS.REPLAY_MODAL);
}

function scrubTo(idx: number): void {
  if (!currentReplay) return;
  const max = currentReplay.turns.length - 1;
  const clamped = Math.max(0, Math.min(idx, max));
  if (clamped === currentIdx) return;
  currentIdx = clamped;
  try {
    applyReplayTurn(currentReplay, currentIdx);
  } catch (err) {
    setStatus(
      `Error: ${err instanceof Error ? err.message : 'unknown'}`,
      true
    );
    return;
  }
  updateUI();
  render();
  refreshControls();
  refreshEventPanel();
}

function startPlayback(): void {
  if (!currentReplay) return;
  if (playTimer !== null) return;
  const playBtn = document.getElementById(
    DOM_IDS.REPLAY_PLAY
  ) as HTMLButtonElement | null;
  if (playBtn) playBtn.textContent = '⏸';
  playTimer = window.setInterval(() => {
    if (!currentReplay) {
      stopPlayback();
      return;
    }
    if (currentIdx >= currentReplay.turns.length - 1) {
      stopPlayback();
      return;
    }
    scrubTo(currentIdx + 1);
  }, PLAY_INTERVAL_MS);
}

function stopPlayback(): void {
  if (playTimer !== null) {
    window.clearInterval(playTimer);
    playTimer = null;
  }
  const playBtn = document.getElementById(
    DOM_IDS.REPLAY_PLAY
  ) as HTMLButtonElement | null;
  if (playBtn) playBtn.textContent = '▶';
}

function handleFileLoad(file: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(reader.result as string);
      const replay = loadReplay(json);
      currentReplay = replay;
      currentIdx = 0;
      applyReplayTurn(replay, 0);
      updateUI();
      render();
      setStatus(
        `Loaded ${replay.turns.length} snapshots · seed ${replay.seed} · faction ${replay.factionName}`
      );
      refreshControls();
      refreshEventPanel();
    } catch (err) {
      const reason =
        err instanceof ReplayValidationError
          ? err.message
          : err instanceof SyntaxError
            ? `JSON parse failed: ${err.message}`
            : err instanceof Error
              ? err.message
              : 'unknown error';
      setStatus(reason, true);
    }
  };
  reader.onerror = () => setStatus('Could not read file.', true);
  reader.readAsText(file);
}

// --- DOM refresh -----------------------------------------------------------

function refreshControls(): void {
  const slider = document.getElementById(
    DOM_IDS.REPLAY_SLIDER
  ) as HTMLInputElement | null;
  const label = document.getElementById(DOM_IDS.REPLAY_TURN_LABEL);
  const stepPrev = document.getElementById(
    DOM_IDS.REPLAY_STEP_PREV
  ) as HTMLButtonElement | null;
  const stepNext = document.getElementById(
    DOM_IDS.REPLAY_STEP_NEXT
  ) as HTMLButtonElement | null;
  const playBtn = document.getElementById(
    DOM_IDS.REPLAY_PLAY
  ) as HTMLButtonElement | null;

  if (!currentReplay) {
    if (slider) {
      slider.disabled = true;
      slider.max = '0';
      slider.value = '0';
    }
    if (label) label.textContent = 'Turn —';
    if (stepPrev) stepPrev.disabled = true;
    if (stepNext) stepNext.disabled = true;
    if (playBtn) playBtn.disabled = true;
    return;
  }

  const max = currentReplay.turns.length - 1;
  if (slider) {
    slider.disabled = false;
    slider.max = String(max);
    slider.value = String(currentIdx);
  }
  const turn = currentReplay.turns[currentIdx].turn;
  if (label) {
    label.textContent = `Turn ${turn} (${currentIdx + 1}/${currentReplay.turns.length})`;
  }
  if (stepPrev) stepPrev.disabled = currentIdx === 0;
  if (stepNext) stepNext.disabled = currentIdx === max;
  if (playBtn) playBtn.disabled = currentIdx === max;
}

function refreshEventPanel(): void {
  const panel = document.getElementById(DOM_IDS.REPLAY_EVENTS);
  if (!panel) return;
  if (!currentReplay) {
    panel.innerHTML =
      '<i style="color:var(--parchment-d)">Load or record a replay to see events.</i>';
    return;
  }
  const turn = currentReplay.turns[currentIdx].turn;
  const events = currentReplay.telemetry?.filter((e) => e.turn === turn) ?? [];
  if (events.length === 0) {
    panel.innerHTML =
      '<i style="color:var(--parchment-d)">No telemetry recorded for this turn.</i>';
    return;
  }
  panel.innerHTML = events.map(formatEvent).join('');
}

function formatEvent(e: TelemetryEvent): string {
  if (e.kind === 'aiTurn') {
    return `<div>· AI faction ${e.faction} thought for ${e.durationMs.toFixed(1)}ms</div>`;
  }
  if (e.kind === 'combat') {
    const target = e.vsCity ? "city" : 'unit';
    return `<div>· faction ${e.attacker} hit faction ${e.defender}'s ${target} for ${e.dmg}</div>`;
  }
  return `<div>· faction ${e.faction} city #${e.cityId} began ${e.pick}</div>`;
}

function setStatus(text: string, isError = false): void {
  const status = document.getElementById(DOM_IDS.REPLAY_STATUS);
  if (!status) return;
  status.textContent = text;
  status.style.color = isError ? 'var(--danger)' : 'var(--parchment-d)';
}

// --- Wiring ----------------------------------------------------------------

const fileInput = document.getElementById(
  DOM_IDS.REPLAY_FILE
) as HTMLInputElement | null;
fileInput?.addEventListener('change', () => {
  const f = fileInput.files?.[0];
  if (f) handleFileLoad(f);
});

const slider = document.getElementById(
  DOM_IDS.REPLAY_SLIDER
) as HTMLInputElement | null;
slider?.addEventListener('input', () => {
  stopPlayback();
  scrubTo(parseInt(slider.value, 10));
});

document
  .getElementById(DOM_IDS.REPLAY_STEP_PREV)
  ?.addEventListener('click', () => {
    stopPlayback();
    scrubTo(currentIdx - 1);
  });
document
  .getElementById(DOM_IDS.REPLAY_STEP_NEXT)
  ?.addEventListener('click', () => {
    stopPlayback();
    scrubTo(currentIdx + 1);
  });
document.getElementById(DOM_IDS.REPLAY_PLAY)?.addEventListener('click', () => {
  if (playTimer !== null) stopPlayback();
  else startPlayback();
});
document
  .getElementById(DOM_IDS.REPLAY_CLOSE)
  ?.addEventListener('click', closeAndRestore);

// Expose for the save-modal "Open replay viewer" button (wired in 2k-4).
const w = window as Window &
  typeof globalThis & { openReplayModal: typeof openReplayModal };
w.openReplayModal = openReplayModal;
