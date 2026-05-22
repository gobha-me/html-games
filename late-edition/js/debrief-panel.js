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
    // 0.10.2 (D-07): each printed story becomes a newspaper-column <article>.
    // The drop cap on .np-headline::first-letter, the multi-column grid, and
    // the .is-fresh slap-down keyframe carry the "front page just dropped"
    // beat referenced in Design Doc §05 + §13.
    const pages = summary.stories_printed
      .map((d) => `
        <article class="np-page">
          <h2 class="np-headline">${escapeHtml(d.headline)}</h2>
          <div class="np-byline">${escapeHtml(d.flavor)} &middot; ${escapeHtml(d.tier)}</div>
        </article>
      `).join('');
    this.root.innerHTML = `
      <div class="debrief-card is-fresh">
        <div class="np-masthead">
          <span class="np-kicker">Morning Edition</span>
          <span class="np-nameplate">Late Edition</span>
          <span class="np-edition">No. ${summary.edition}</span>
        </div>
        <div class="np-pages">${pages || '<div class="np-empty">(no stories printed this cycle)</div>'}</div>
        <div class="np-dismiss">click to continue &rarr;</div>
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
