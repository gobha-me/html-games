// Late Edition — game-over overlay (milestone 0.7.0).
// Mirrors the DebriefPanel pattern: subscribes to World.subscribeCycle, mounts
// on CYCLE_GAME_OVER (ICD-06 v0.3 event vocabulary), never reaches into sim
// state. 0.9.3 (PR-A audit C-03): the overlay now offers a "Start a new run"
// button that clears the save blob and reloads the page (the only exit from
// the terminal state — refresh used to drop the player back into the burnt
// save). The button is the only interactive element on the overlay.

import { SAVE_KEY } from './sim/save.js';

export class GameOverOverlay {
  constructor(rootEl, world) {
    this.root = rootEl;
    this.world = world;
    this.world.subscribeCycle((ev) => this._onCycle(ev));
  }

  _onCycle(ev) {
    if (ev.kind === 'CYCLE_GAME_OVER') this._mount(ev);
  }

  _mount(ev) {
    this.root.innerHTML = `
      <div class="gameover-card">
        <div class="kicker">EDITION ${ev.edition}</div>
        <div class="banner">THE PRESS BURNS</div>
        <div class="reason">${reasonText(ev.reason)}</div>
        <button type="button" class="new-run">Start a new run</button>
      </div>
    `;
    this.root.hidden = false;
    const btn = this.root.querySelector('.new-run');
    if (btn) btn.addEventListener('click', () => this._startNewRun());
  }

  _startNewRun() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* private mode / disabled — reload anyway */ }
    location.reload();
  }
}

function reasonText(reason) {
  if (reason === 'press_destroyed') return 'goons reached the bureau · the run is over';
  return String(reason ?? 'unknown');
}
