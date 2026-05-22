/**
 * Oregon Trail — Stats Panel Module
 *
 * Tracks cumulative gameplay statistics and renders a toggleable
 * slide-out panel showing: total days, miles, food consumed, money
 * spent, events by category, party deaths, and reputation tiers.
 *
 * Stats persist across save/load cycles.
 */

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const EVENT_CATEGORY_LABELS = Object.freeze({
  encounter: 'Encounters',
  weather: 'Weather',
  terrain: 'Terrain',
  trade: 'Trade',
  illness: 'Illness',
  milestone: 'Milestones',
  random: 'Random Events',
  opportunity: 'Opportunities',
  moral: 'Moral Dilemmas'
});

const FACTION_LABELS = Object.freeze({
  nativeTribes: 'Native Tribes',
  fellowSettlers: 'Fellow Settlers',
  riverTraders: 'River Traders',
  outlaws: 'Outlaws'
});

const REPUTATION_TIERS = Object.freeze([
  { min: 80, label: 'Revered' },
  { min: 50, label: 'Trusted' },
  { min: 20, label: 'Friendly' },
  { min: -20, label: 'Neutral' },
  { min: -50, label: 'Suspect' },
  { min: -80, label: 'Hostile' },
  { min: -100, label: 'Hated' }
]);

/* ─── Stats Tracker ─────────────────────────────────────────────────────────── */

/**
 * Create a fresh stats tracker.
 * @param {object} [overrides] — Partial stats to seed (for deserialization)
 * @returns {object} Stats tracker with accumulator methods
 */
function createStatsTracker(overrides = {}) {
  const stats = {
    totalDays: overrides.totalDays ?? 0,
    totalMiles: overrides.totalMiles ?? 0,
    foodConsumed: overrides.foodConsumed ?? 0,
    moneySpent: overrides.moneySpent ?? 0,
    eventsByCategory: overrides.eventsByCategory ?? {},
    partyDeaths: overrides.partyDeaths ?? 0,
    _prevFood: overrides._prevFood ?? null,
    _prevMoney: overrides._prevMoney ?? null
  };

  return {
    /**
     * Record a turn's deltas. Call after advanceTurn but before render.
     * @param {object} state — Current game state (post-turn)
     * @param {string} [eventCategory] — The event category that fired this turn
     */
    recordTurn(state, eventCategory) {
      stats.totalDays = state.day ?? stats.totalDays;
      stats.totalMiles = state.distanceTraveled ?? stats.totalMiles;

      // Track food consumed (delta from previous turn)
      const currentFood = state.resources?.food ?? 0;
      if (stats._prevFood !== null) {
        const delta = stats._prevFood - currentFood;
        if (delta > 0) {
          stats.foodConsumed += delta;
        }
      }
      stats._prevFood = currentFood;

      // Track money spent (delta from previous turn)
      const currentMoney = state.resources?.money ?? 0;
      if (stats._prevMoney !== null) {
        const delta = stats._prevMoney - currentMoney;
        if (delta > 0) {
          stats.moneySpent += delta;
        }
      }
      stats._prevMoney = currentMoney;

      // Track event category
      if (eventCategory) {
        stats.eventsByCategory[eventCategory] =
          (stats.eventsByCategory[eventCategory] ?? 0) + 1;
      }
    },

    /**
     * Update party death count from current state.
     * @param {object} state — Current game state
     */
    updatePartyDeaths(state) {
      const members = state.party?.members ?? [];
      const deadCount = members.filter(m => m.hp <= 0).length;
      stats.partyDeaths = deadCount;
    },

    /** Get a plain-object snapshot for serialization */
    snapshot() {
      return {
        totalDays: stats.totalDays,
        totalMiles: stats.totalMiles,
        foodConsumed: stats.foodConsumed,
        moneySpent: stats.moneySpent,
        eventsByCategory: { ...stats.eventsByCategory },
        partyDeaths: stats.partyDeaths,
        _prevFood: stats._prevFood,
        _prevMoney: stats._prevMoney
      };
    }
  };
}

/* ─── Serialization ─────────────────────────────────────────────────────────── */

function serializeStats(tracker) {
  return tracker.snapshot();
}

function deserializeStats(data) {
  return createStatsTracker(data ?? {});
}

/* ─── UI Renderer ───────────────────────────────────────────────────────────── */

/**
 * Create the stats panel UI.
 * @param {object} tracker — Stats tracker from createStatsTracker
 * @returns {{ render: Function, toggle: Function, isVisible: Function }}
 */
function createStatsPanelUI(tracker) {
  let visible = false;
  let overlayEl = null;
  let panelEl = null;

  function _buildDOM() {
    if (overlayEl) return; // already built

    overlayEl = document.createElement('div');
    overlayEl.className = 'stats-overlay';
    overlayEl.id = 'stats-overlay';

    panelEl = document.createElement('div');
    panelEl.className = 'stats-panel';
    panelEl.id = 'stats-panel';

    overlayEl.appendChild(panelEl);

    // Close on overlay click (outside panel)
    overlayEl.addEventListener('click', (e) => {
      if (e.target === overlayEl) {
        _hide();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && visible) {
        _hide();
      }
    });

    document.body.appendChild(overlayEl);
  }

  function _hide() {
    visible = false;
    if (overlayEl) overlayEl.classList.remove('visible');
  }

  function _show() {
    _buildDOM();
    visible = true;
    overlayEl.classList.add('visible');
  }

  function toggle() {
    visible ? _hide() : _show();
  }

  function isVisible() {
    return visible;
  }

  /**
   * Render the panel with current state and ledger.
   * @param {object} state — Current game state (for party info)
   * @param {object} ledger — Current Trail Ledger
   */
  function render(state, ledger) {
    if (!panelEl) return;

    const stats = tracker.snapshot();
    const members = state?.party?.members ?? [];

    panelEl.innerHTML = `
      <div class="stats-panel-header">
        <h2 class="stats-panel-title">📊 Trail Stats</h2>
        <button class="stats-close-btn" id="stats-close-btn" aria-label="Close stats panel">&times;</button>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-icon">📅</span>
          <span class="stat-value">${stats.totalDays}</span>
          <span class="stat-label">Days Elapsed</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🛤️</span>
          <span class="stat-value">${stats.totalMiles.toLocaleString()}</span>
          <span class="stat-label">Miles Traveled</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🍖</span>
          <span class="stat-value">${stats.foodConsumed.toLocaleString()}</span>
          <span class="stat-label">Lbs Food Consumed</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">💰</span>
          <span class="stat-value">$${stats.moneySpent.toLocaleString()}</span>
          <span class="stat-label">Money Spent</span>
        </div>
      </div>

      <h3 class="stats-section-title">📜 Events Encountered</h3>
      <ul class="stats-events-list">
        ${_renderEventList(stats.eventsByCategory)}
      </ul>

      <h3 class="stats-section-title">👥 Party Status</h3>
      <ul class="stats-party-list">
        ${_renderPartyList(members)}
      </ul>
      ${stats.partyDeaths > 0 ? `<p style="font-size:0.8rem;color:#b94a48;margin:0.25rem 0 0;">⚠️ ${stats.partyDeaths} party member${stats.partyDeaths > 1 ? 's' : ''} lost</p>` : ''}

      <h3 class="stats-section-title">🏛️ Trail Ledger — Reputation</h3>
      <div class="stats-reputation-list">
        ${_renderReputationBars(ledger)}
      </div>
    `;

    // Bind close button
    const closeBtn = panelEl.querySelector('#stats-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', _hide);
    }
  }

  function _renderEventList(eventsByCategory) {
    const entries = Object.entries(eventsByCategory).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) {
      return '<li style="color:var(--text-muted);font-style:italic;">No events yet</li>';
    }
    return entries.map(([cat, count]) => {
      const label = EVENT_CATEGORY_LABELS[cat] ?? cat;
      return `<li><span>${label}</span><span class="event-count">${count}</span></li>`;
    }).join('');
  }

  function _renderPartyList(members) {
    if (members.length === 0) {
      return '<li style="color:var(--text-muted);font-style:italic;">No party members</li>';
    }
    return members.map(m => {
      const status = m.hp > 0 ? 'Alive' : 'Deceased';
      const cls = m.hp > 0 ? 'alive' : 'deceased';
      return `<li><span>${m.name ?? 'Unknown'}</span><span class="party-member-status ${cls}">${status}</span></li>`;
    }).join('');
  }

  function _renderReputationBars(ledger) {
    if (!ledger) return '<p style="color:var(--text-muted);font-style:italic;">Ledger not available</p>';

    return Object.entries(FACTION_LABELS).map(([key, label]) => {
      const score = ledger[key] ?? 0;
      const tier = _getReputationTier(score);
      const barWidth = Math.abs(score) / 2; // 0-100 maps to 0-50% of bar
      const barClass = score >= 0 ? 'positive' : 'negative';
      return `
        <div class="reputation-row">
          <div class="reputation-header">
            <span class="reputation-faction">${label}</span>
            <span class="reputation-label">${tier} (${score >= 0 ? '+' : ''}${score})</span>
          </div>
          <div class="reputation-bar-track">
            <div class="reputation-bar-fill ${barClass}" style="width:${barWidth}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function _getReputationTier(score) {
    for (const tier of REPUTATION_TIERS) {
      if (score >= tier.min) return tier.label;
    }
    return 'Hated';
  }

  return { render, toggle, isVisible };
}

/* ─── Exports ───────────────────────────────────────────────────────────────── */

// For browser <script type="module"> usage
if (typeof window !== 'undefined') {
  window.StatsPanel = {
    createStatsTracker,
    createStatsPanelUI,
    serializeStats,
    deserializeStats
  };
}

// For ES module usage
export { createStatsTracker, createStatsPanelUI, serializeStats, deserializeStats };
