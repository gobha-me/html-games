// Late Edition — game-over overlay (milestone 0.7.0 banner + 0.10.0 run summary
// + 1.5.0 Establishment ending). Mirrors the DebriefPanel pattern: subscribes
// to World.subscribeCycle, mounts on CYCLE_GAME_OVER or (1.5.0)
// CYCLE_ESTABLISHMENT_ENDING (ICD-06 §Notes addendum — the dual-path ending
// vocabulary), never reaches into sim state beyond `world.runStats` +
// `world.endingState`. 0.9.3 (PR-A audit C-03): "Start a new run" button
// clears the save blob + reloads. 0.10.0 (audit G-13): the same terminal
// mount renders the run summary (editions survived · total revenue · top
// headline · high-score rank) and writes a high-score entry via save.js
// saveScore — the run is preserved in `'late-edition.scores.v1'` before the
// save blob is cleared by the new-run button.

import { SAVE_KEY, saveScore } from './sim/save.js';

// 1.5.0 (ICD-06 §Notes addendum). Two ending kinds, both dispatch via the
// World's cycle event channel; the overlay routes by kind to the right
// banner + reason copy + high-score cause string.
const ENDING_COPY = {
  CYCLE_GAME_OVER: {
    banner:        'THE PRESS BURNS',
    reasonFor:     (ev) => reasonText(ev.reason),
    highScoreCause: 'game_over',
  },
  CYCLE_ESTABLISHMENT_ENDING: {
    banner:        'THE PRESS WAS BOUGHT',
    reasonFor:     () => 'The Herald absorbs the paper · the Establishment wins',
    highScoreCause: 'establishment_ending',
  },
};

export class GameOverOverlay {
  constructor(rootEl, world) {
    this.root = rootEl;
    this.world = world;
    this.world.subscribeCycle((ev) => this._onCycle(ev));
  }

  _onCycle(ev) {
    if (ev.kind === 'CYCLE_GAME_OVER' || ev.kind === 'CYCLE_ESTABLISHMENT_ENDING') {
      this._mount(ev);
    }
  }

  _mount(ev) {
    const stats = this.world.runStats ?? { total_revenue: 0, editions_survived: 0, top_story: null };
    const copy = ENDING_COPY[ev.kind] ?? ENDING_COPY.CYCLE_GAME_OVER;
    const entry = {
      editions_survived: stats.editions_survived,
      total_revenue:     stats.total_revenue,
      ended_at_ms:       Date.now(),
      cause:             copy.highScoreCause,
    };
    const { rank, blob } = saveScore(entry);
    const ranking = renderRanking(blob, rank);
    const topHeadline = stats.top_story?.headline ?? '—';
    const topCash = stats.top_story?.cash ?? 0;

    this.root.innerHTML = `
      <div class="gameover-card">
        <div class="kicker">EDITION ${ev.edition}</div>
        <div class="banner">${escapeHtml(copy.banner)}</div>
        <div class="reason">${escapeHtml(copy.reasonFor(ev))}</div>
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
