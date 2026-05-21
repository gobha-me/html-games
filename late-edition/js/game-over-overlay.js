// Late Edition — game-over overlay (milestone 0.7.0 banner + 0.10.0 run summary).
// Mirrors the DebriefPanel pattern: subscribes to World.subscribeCycle, mounts
// on CYCLE_GAME_OVER (ICD-06 v0.3 event vocabulary), never reaches into sim
// state beyond `world.runStats`. 0.9.3 (PR-A audit C-03): "Start a new run"
// button clears the save blob + reloads. 0.10.0 (audit G-13): the same
// terminal mount now renders the run summary (editions survived · total
// revenue · top headline · high-score rank) and writes a high-score entry
// via save.js saveScore — the run is preserved in `'late-edition.scores.v1'`
// before the save blob is cleared by the new-run button.

import { SAVE_KEY, saveScore } from './sim/save.js';

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
    const stats = this.world.runStats ?? { total_revenue: 0, editions_survived: 0, top_story: null };
    const entry = {
      editions_survived: stats.editions_survived,
      total_revenue:     stats.total_revenue,
      ended_at_ms:       Date.now(),
      cause:             ev.kind === 'CYCLE_GAME_OVER' ? 'game_over' : 'arc_end',
    };
    const { rank, blob } = saveScore(entry);
    const ranking = renderRanking(blob, rank);
    const topHeadline = stats.top_story?.headline ?? '—';
    const topCash = stats.top_story?.cash ?? 0;

    this.root.innerHTML = `
      <div class="gameover-card">
        <div class="kicker">EDITION ${ev.edition}</div>
        <div class="banner">THE PRESS BURNS</div>
        <div class="reason">${reasonText(ev.reason)}</div>
        <section class="run-summary">
          <div class="summary-row"><span class="lbl">Editions survived</span><span class="val">${stats.editions_survived}</span></div>
          <div class="summary-row"><span class="lbl">Total revenue</span><span class="val">$ ${formatCash(stats.total_revenue)}</span></div>
          <div class="summary-row top-story">
            <span class="lbl">Top headline</span>
            <span class="headline">${escapeHtml(topHeadline)}</span>
            <span class="cash">$ ${formatCash(topCash)}</span>
          </div>
          <div class="summary-row rank-row">
            <span class="lbl">Rank</span>
            <span class="val">${rank ? `№ ${rank}` : 'unranked'}</span>
          </div>
          ${ranking}
        </section>
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

function renderRanking(blob, currentRank) {
  if (!blob || !Array.isArray(blob.scores) || blob.scores.length === 0) return '';
  const rows = blob.scores.slice(0, 5).map((e, i) => {
    const isYou = i + 1 === currentRank;
    return `
      <li class="${isYou ? 'is-you' : ''}">
        <span class="rank">№ ${i + 1}</span>
        <span class="editions">${e.editions_survived} ed.</span>
        <span class="revenue">$ ${formatCash(e.total_revenue)}</span>
      </li>
    `;
  }).join('');
  return `<ol class="scoreboard">${rows}</ol>`;
}

function formatCash(n) {
  return new Intl.NumberFormat('en-US').format(Math.round(n ?? 0));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
