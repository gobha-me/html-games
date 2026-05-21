/**
 * Oregon Trail — End Screen
 *
 * Renders the win/lose/partial end screen overlay with journey stats,
 * party status, Trail Ledger reputation, and a "Play Again" button.
 *
 * @module end-screen
 */

// ─── Faction Labels (mirrors event-runner.js) ────────────────────────────────

const FACTION_LABELS = {
  nativeTribes: 'Native Tribes',
  fellowSettlers: 'Fellow Settlers',
  riverTraders: 'River Traders',
  outlaws: 'Outlaws'
};

const FACTION_KEYS = Object.keys(FACTION_LABELS);

const REPUTATION_LABELS = [
  { min: 75,  label: 'Revered' },
  { min: 50,  label: 'Trusted' },
  { min: 25,  label: 'Friendly' },
  { min: -24, label: 'Neutral' },
  { min: -49, label: 'Suspect' },
  { min: -74, label: 'Hostile' },
  { min: -100, label: 'Hated' }
];

// ─── End Type Determination ──────────────────────────────────────────────────

/**
 * Determine the end screen type from game state.
 * @param {object} gameState
 * @returns {{ type: 'win' | 'lose' | 'partial', reason: string }}
 */
function determineEndType(gameState) {
  const reason = gameState.endReason;

  if (reason === 'victory') {
    const deadCount = gameState.party.members.filter(m => m.hp <= 0).length;
    const wagonLow = gameState.resources.wagonCondition <= 10;
    if (deadCount >= 2 || wagonLow) {
      return { type: 'partial', reason: 'bittersweet_victory' };
    }
    return { type: 'win', reason: 'victory' };
  }

  if (reason === 'all_dead') {
    return { type: 'lose', reason: 'all_dead' };
  }

  if (reason === 'wagon_destroyed') {
    return { type: 'lose', reason: 'wagon_destroyed' };
  }

  if (reason === 'abandoned') {
    return { type: 'partial', reason: 'abandoned' };
  }

  // Fallback
  return { type: 'partial', reason: 'unknown' };
}

// ─── Reputation Label Lookup ─────────────────────────────────────────────────

/**
 * Get the qualitative label for a reputation score.
 * @param {number} score
 * @returns {string}
 */
function getReputationLabel(score) {
  for (const entry of REPUTATION_LABELS) {
    if (score >= entry.min) {
      return entry.label;
    }
  }
  return 'Hated';
}

// ─── DOM Construction ────────────────────────────────────────────────────────

/**
 * Build the end screen DOM and inject it into the overlay container.
 * @param {object} gameState
 * @param {object} trailLedger
 * @param {string} endType - 'win' | 'lose' | 'partial'
 * @param {string} endReason
 */
function buildEndScreen(gameState, trailLedger, endType, endReason) {
  const container = document.getElementById('end-screen-overlay');
  if (!container) {
    console.error('[end-screen] No #end-screen-overlay element found in DOM.');
    return;
  }

  // Clear previous content
  container.innerHTML = '';

  // Card
  const card = document.createElement('div');
  card.className = `end-screen-card theme-${endType}`;

  // Icon & Title
  const { icon, title, subtitle } = getThemeContent(endType, endReason);

  const iconEl = document.createElement('span');
  iconEl.className = 'end-screen-icon';
  iconEl.textContent = icon;
  card.appendChild(iconEl);

  const titleEl = document.createElement('h1');
  titleEl.className = 'end-screen-title';
  titleEl.textContent = title;
  card.appendChild(titleEl);

  const subtitleEl = document.createElement('p');
  subtitleEl.className = 'end-screen-subtitle';
  subtitleEl.textContent = subtitle;
  card.appendChild(subtitleEl);

  // Divider
  const divider = document.createElement('hr');
  divider.className = 'end-screen-divider';
  card.appendChild(divider);

  // Stats Grid
  const statsGrid = buildStatsGrid(gameState);
  card.appendChild(statsGrid);

  // Divider
  const divider2 = document.createElement('hr');
  divider2.className = 'end-screen-divider';
  card.appendChild(divider2);

  // Party Status
  const partySection = buildPartySection(gameState);
  card.appendChild(partySection);

  // Divider
  const divider3 = document.createElement('hr');
  divider3.className = 'end-screen-divider';
  card.appendChild(divider3);

  // Trail Ledger
  const ledgerSection = buildLedgerSection(trailLedger);
  card.appendChild(ledgerSection);

  // Play Again Button
  const playAgainBtn = document.createElement('button');
  playAgainBtn.className = 'end-screen-play-again';
  playAgainBtn.textContent = '🔄 Play Again';
  playAgainBtn.addEventListener('click', () => {
    // The callback is attached below
    if (playAgainBtn._onPlayAgain) {
      playAgainBtn._onPlayAgain();
    }
  });
  card.appendChild(playAgainBtn);

  container.appendChild(card);
}

/**
 * Get theme-specific content (icon, title, subtitle).
 */
function getThemeContent(endType, endReason) {
  switch (endType) {
    case 'win':
      return {
        icon: '🏆',
        title: 'Journey\'s End — Victory!',
        subtitle: 'You reached the Willamette Valley. The Oregon Trail is conquered!'
      };
    case 'lose':
      if (endReason === 'all_dead') {
        return {
          icon: '💀',
          title: 'Journey\'s End',
          subtitle: 'Your party has perished on the trail. The Oregon claims another.'
        };
      }
      return {
        icon: '🛑',
        title: 'Journey\'s End',
        subtitle: 'Your wagon lies broken. The trail ends here.'
      };
    case 'partial':
    default:
      if (endReason === 'abandoned') {
        return {
          icon: '🏚️',
          title: 'Journey Abandoned',
          subtitle: 'You turned back. The trail was too much to bear.'
        };
      }
      return {
        icon: '⚖️',
        title: 'A Bittersweet Arrival',
        subtitle: 'You reached Oregon, but at a heavy cost. The trail remembers.'
      };
  }
}

/**
 * Build the stats grid section.
 */
function buildStatsGrid(gameState) {
  const section = document.createElement('div');
  section.className = 'end-screen-stats';

  const stats = [
    { label: 'Days Traveled', value: `${gameState.day} days` },
    { label: 'Distance Covered', value: `${gameState.distanceTraveled} / ${gameState.totalDistance} miles` },
    { label: 'Food Remaining', value: `${gameState.resources.food} lbs` },
    { label: 'Money Remaining', value: `$${gameState.resources.money}` },
    { label: 'Ammo Remaining', value: `${gameState.resources.ammo} rounds` },
    { label: 'Wagon Condition', value: `${gameState.resources.wagonCondition}/100` }
  ];

  for (const stat of stats) {
    const item = document.createElement('div');
    item.className = 'stat-item';

    const labelEl = document.createElement('div');
    labelEl.className = 'stat-label';
    labelEl.textContent = stat.label;

    const valueEl = document.createElement('div');
    valueEl.className = 'stat-value';
    valueEl.textContent = stat.value;

    item.appendChild(labelEl);
    item.appendChild(valueEl);
    section.appendChild(item);
  }

  return section;
}

/**
 * Build the party status section.
 */
function buildPartySection(gameState) {
  const section = document.createElement('div');
  section.className = 'end-screen-party';

  const heading = document.createElement('h3');
  heading.textContent = 'Party Status';
  section.appendChild(heading);

  for (const member of gameState.party.members) {
    const row = document.createElement('div');
    row.className = 'party-member-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'party-member-name';
    nameEl.textContent = member.name;

    const statusEl = document.createElement('span');
    statusEl.className = `party-member-status ${member.hp > 0 ? 'alive' : 'deceased'}`;
    statusEl.textContent = member.hp > 0 ? `HP: ${member.hp}` : 'Deceased';

    row.appendChild(nameEl);
    row.appendChild(statusEl);
    section.appendChild(row);
  }

  return section;
}

/**
 * Build the Trail Ledger reputation section.
 */
function buildLedgerSection(trailLedger) {
  const section = document.createElement('div');
  section.className = 'end-screen-ledger';

  const heading = document.createElement('h3');
  heading.textContent = 'Trail Ledger — Reputation';
  section.appendChild(heading);

  for (const factionKey of FACTION_KEYS) {
    const score = (trailLedger && trailLedger.reputation && trailLedger.reputation[factionKey]) || 0;
    const label = getReputationLabel(score);

    const row = document.createElement('div');
    row.className = 'ledger-faction-row';

    const nameEl = document.createElement('span');
    nameEl.className = 'ledger-faction-name';
    nameEl.textContent = FACTION_LABELS[factionKey];

    const barBg = document.createElement('div');
    barBg.className = 'ledger-faction-bar-bg';

    const barFill = document.createElement('div');
    barFill.className = `ledger-faction-bar-fill ${score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral'}`;
    // Normalize score (-100 to 100) to 0-100% width
    const widthPercent = ((score + 100) / 200) * 100;
    barFill.style.width = `${Math.max(0, Math.min(100, widthPercent))}%`;

    const labelEl = document.createElement('span');
    labelEl.className = 'ledger-faction-label';
    labelEl.textContent = label;

    barBg.appendChild(barFill);
    row.appendChild(nameEl);
    row.appendChild(barBg);
    row.appendChild(labelEl);
    section.appendChild(row);
  }

  return section;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Show the end screen overlay.
 * @param {object} gameState - Current game state
 * @param {object} trailLedger - Trail Ledger reputation data
 * @param {Function} onPlayAgain - Callback to reset game and return to start
 */
function showEndScreen(gameState, trailLedger, onPlayAgain) {
  const { type, reason } = determineEndType(gameState);

  buildEndScreen(gameState, trailLedger, type, reason);

  // Attach the callback to the play-again button
  const overlay = document.getElementById('end-screen-overlay');
  if (overlay) {
    const btn = overlay.querySelector('.end-screen-play-again');
    if (btn) {
      btn._onPlayAgain = onPlayAgain;
    }
    overlay.hidden = false;
  }
}

/**
 * Hide the end screen overlay.
 */
function hideEndScreen() {
  const overlay = document.getElementById('end-screen-overlay');
  if (overlay) {
    overlay.hidden = true;
    overlay.innerHTML = '';
  }
}

export { showEndScreen, hideEndScreen };
