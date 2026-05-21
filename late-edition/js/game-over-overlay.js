// Late Edition — game-over overlay (milestone 0.7.0).
// Mirrors the DebriefPanel pattern: subscribes to World.subscribeCycle, mounts
// on CYCLE_GAME_OVER (ICD-06 v0.3 event vocabulary), never reaches into sim
// state. The overlay is terminal — there is no dismiss handler, the run is over.

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
      </div>
    `;
    this.root.hidden = false;
  }
}

function reasonText(reason) {
  if (reason === 'press_destroyed') return 'goons reached the bureau · the run is over';
  return String(reason ?? 'unknown');
}
