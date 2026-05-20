// Late Edition — HUD deadline ticker (ICD-01 v0.5 §HudState).
// Reads frame.hud.{edition, deadline_ms} every frame and projects them to DOM.
// Pure renderer-side projection — no subscription to CycleEvent, no reach into
// sim state. Mirrors the design doc §13 corkboard ticker pattern at minimum
// fidelity until the full corkboard layout lands at milestone 0.9.

export class HudTicker {
  constructor(rootEl) {
    this.root = rootEl;
    this._lastText = '';
  }

  apply(frame) {
    const { edition, deadline_ms } = frame.hud;
    const text = `EDITION ${edition} · ${formatMs(deadline_ms)} TO DEADLINE`;
    if (text !== this._lastText) {
      this.root.textContent = text;
      this._lastText = text;
    }
  }
}

function formatMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
