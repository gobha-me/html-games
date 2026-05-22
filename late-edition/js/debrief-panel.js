// Late Edition — edition debrief panel.
// Subscribes to World.subscribeCycle for the structural cycle events. Mounts
// on EDITION_DEBRIEF_BEGIN (reading summary off the event — never reaches into
// sim state), dismisses on click, which fires world.ackDebrief() and the
// EDITION_DEBRIEF_END handler tears down. Plain DOM — the corkboard layout
// (Design Doc §13) materializes at milestone 0.9.
//
// 1.0.1 (ICD-06 v0.4 §Cycle timing · audit C-05): the dismiss click is gated
// behind a 30 s minimum-elapsed clamp ("Between-edition pause: 30s · cannot
// be skipped · debrief animation" — design-doc.html §19 / §05). The gate is
// renderer-side per the ICD; World.ackDebrief() itself stays unguarded. A
// small rAF loop owned by the panel keeps the dismiss caption counting down
// while the gate is live; the loop exits at unmount. `clock` is constructor-
// injectable so tests can fake performance.now() without DOM.

export const MIN_DEBRIEF_MS = 30_000;

export class DebriefPanel {
  constructor(rootEl, world, { clock = defaultClock } = {}) {
    this.root = rootEl;
    this.world = world;
    this.clock = clock;
    this._mountedAt = null;
    this._rafHandle = null;
    this._dismissEl = null;
    this.root.addEventListener('click', () => this._onClick());
    this.world.subscribeCycle((ev) => this._onCycle(ev));
  }

  _onClick() {
    if (this._mountedAt === null) return;
    if (this.clock() - this._mountedAt < MIN_DEBRIEF_MS) return;
    this.world.ackDebrief();
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
        <div class="np-dismiss is-gated">click to continue in ${Math.ceil(MIN_DEBRIEF_MS / 1000)}s</div>
      </div>
    `;
    this.root.hidden = false;
    this._mountedAt = this.clock();
    this._dismissEl = this.root.querySelector('.np-dismiss');
    this._scheduleTick();
  }

  _unmount() {
    this._mountedAt = null;
    this._dismissEl = null;
    if (this._rafHandle !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this._rafHandle);
    }
    this._rafHandle = null;
    this.root.hidden = true;
    this.root.innerHTML = '';
  }

  _scheduleTick() {
    if (typeof requestAnimationFrame !== 'function') return;
    const tick = () => {
      if (this._mountedAt === null) return;
      this._renderDismiss();
      this._rafHandle = requestAnimationFrame(tick);
    };
    this._rafHandle = requestAnimationFrame(tick);
  }

  _renderDismiss() {
    if (!this._dismissEl) return;
    const elapsed = this.clock() - this._mountedAt;
    if (elapsed >= MIN_DEBRIEF_MS) {
      this._dismissEl.textContent = 'click to continue →';
      this._dismissEl.classList.remove('is-gated');
      return;
    }
    const remaining = Math.ceil((MIN_DEBRIEF_MS - elapsed) / 1000);
    this._dismissEl.textContent = `click to continue in ${remaining}s`;
    this._dismissEl.classList.add('is-gated');
  }
}

function defaultClock() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
