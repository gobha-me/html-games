// Late Edition — HUD deadline ticker (ICD-01 v0.5 §HudState).
// Reads frame.hud.{edition, deadline_ms, resources} every frame and projects
// them to DOM. Pure renderer-side projection — no subscription to CycleEvent,
// no reach into sim state. Mirrors the design doc §13 corkboard ticker pattern
// at minimum fidelity until the full corkboard layout lands at milestone 0.9.
//
// Milestone 0.6 extends the line with four resource segments (LD / ST / INK /
// $ / HEAT). Single-line strip preserved so 0.9 can grow it without churning
// main.js (per the v0.5 changelog rationale).
// Milestone 0.7.0 appends a Press HP segment (`X HP`) derived from
// `frame.buildings[bureau].hp`. HP already lives on BuildingView (ICD-01 v0.5)
// — the HUD just reads it. No HudState shape change → no ICD-01 bump.

export class HudTicker {
  constructor(rootEl) {
    this.root = rootEl;
    this._lastText = '';
  }

  apply(frame) {
    const { edition, deadline_ms, resources } = frame.hud;
    const bureau = frame.buildings.find((b) => b.kind === 'bureau');
    const hp = bureau ? Math.ceil(bureau.hp) : 0;
    const text =
      `EDITION ${edition} · ${formatMs(deadline_ms)}` +
      ` · ${resources.leads} LD` +
      ` · ${resources.stories} ST` +
      ` · ${resources.ink} INK` +
      ` · $${resources.cash}` +
      ` · ${resources.heat} HEAT` +
      ` · ${hp} HP`;
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
