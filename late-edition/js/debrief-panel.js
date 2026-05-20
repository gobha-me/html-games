// Late Edition — edition debrief panel.
// Subscribes to World.subscribeCycle for the structural cycle events. Mounts
// on EDITION_DEBRIEF_BEGIN (reading summary off the event — never reaches into
// sim state), dismisses on click, which fires world.ackDebrief() and the
// EDITION_DEBRIEF_END handler tears down. Plain DOM — the corkboard layout
// (Design Doc §13) materializes at milestone 0.9.

export class DebriefPanel {
  constructor(rootEl, world) {
    this.root = rootEl;
    this.world = world;
    this.root.addEventListener('click', () => this.world.ackDebrief());
    this.world.subscribeCycle((ev) => this._onCycle(ev));
  }

  _onCycle(ev) {
    if (ev.kind === 'EDITION_DEBRIEF_BEGIN') this._mount(ev.summary);
    else if (ev.kind === 'EDITION_DEBRIEF_END') this._unmount();
  }

  _mount(summary) {
    const rows = summary.stories_printed
      .map((d) => `
        <li class="story-row">
          <span class="headline">${escapeHtml(d.headline)}</span>
          <span class="meta-row">${escapeHtml(d.flavor)} · ${escapeHtml(d.tier)}</span>
        </li>
      `).join('');
    this.root.innerHTML = `
      <div class="debrief-card">
        <div class="kicker">EDITION ${summary.edition}</div>
        <div class="banner">FRONT PAGE</div>
        <ul class="story-list">${rows || '<li class="empty">(no stories printed)</li>'}</ul>
        <div class="dismiss">click to continue &rarr;</div>
      </div>
    `;
    this.root.hidden = false;
  }

  _unmount() {
    this.root.hidden = true;
    this.root.innerHTML = '';
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
