/**
 * Oregon Trail — Main Game UI
 * 
 * Handles all DOM rendering: resource bars, decision panel, event display,
 * day counter, and turn log. Integrates with existing game modules.
 * 
 * @module ui
 */

import {
  createInitialState,
  advanceTurn,
  checkGameOver,
  serializeState,
  deserializeState,
  TOTAL_DISTANCE,
  PACE_EFFECTS,
  RATION_EFFECTS
} from './turn-loop.js';

import {
  createResourceState,
  getResourceStatus
} from './resources.js';

import {
  createPartyState,
  ARCHETYPES
} from './party.js';

import {
  dispatchEvent,
  createLedger,
  selectVoiceQuote
} from './event-runner.js';
import {
  saveGame,
  loadGame,
  hasSave,
  deleteSave,
} from './save-load.js';

import {
  getLegForDistance,
  getLegLabel,
  getRegionName
} from './region-runner.js';

import {
  showEndScreen,
  hideEndScreen,
} from './end-screen.js';

// ─── Utility ─────────────────────────────────────────────────────────────────

const RESOURCE_RANGES = {
  food: { min: 0, max: Infinity },
  money: { min: 0, max: Infinity },
  ammo: { min: 0, max: Infinity },
  morale: { min: 0, max: 100 },
  wagonCondition: { min: 0, max: 100 }
};

function clampResource(value, type) {
  const range = RESOURCE_RANGES[type];
  if (!range) return value;
  return Math.max(range.min, Math.min(range.max, value));
}

// ─── Party Voice Display Labels ──────────────────────────────────────────────

/** Map PARTY_VOICES archetype keys to human-readable display names. */
const PARTY_VOICE_LABELS = {
  pragmatist: 'The Pragmatist',
  optimist: 'The Optimist',
  skeptic: 'The Skeptic',
  tender: 'The Tender'
};

// ─── Game State ──────────────────────────────────────────────────────────────

let gameState = null;
let trailLedger = null;
let currentEvent = null;
let turnLog = [];

// ─── DOM References ──────────────────────────────────────────────────────────

const DOM = {};

function cacheDOM() {
  DOM.dayLabel = document.getElementById('day-label');
  DOM.distanceLabel = document.getElementById('distance-label');
  DOM.regionLabel = document.getElementById('region-label');
  DOM.progressBarFill = document.getElementById('progress-bar-fill');
  DOM.foodBarFill = document.getElementById('food-bar-fill');
  DOM.foodValue = document.getElementById('food-value');
  DOM.moneyBarFill = document.getElementById('money-bar-fill');
  DOM.moneyValue = document.getElementById('money-value');
  DOM.ammoBarFill = document.getElementById('ammo-bar-fill');
  DOM.ammoValue = document.getElementById('ammo-value');
  DOM.moraleBarFill = document.getElementById('morale-bar-fill');
  DOM.moraleValue = document.getElementById('morale-value');
  DOM.wagonBarFill = document.getElementById('wagon-bar-fill');
  DOM.wagonValue = document.getElementById('wagon-value');
  
  DOM.healthSection = document.getElementById('health-section');
  
  DOM.eventTitle = document.getElementById('event-title');
  DOM.eventDescription = document.getElementById('event-description');
  DOM.eventChoices = document.getElementById('event-choices');
  DOM.eventDisplay = document.getElementById('event-display');
  
  DOM.paceOptions = document.getElementById('pace-options');
  DOM.rationOptions = document.getElementById('ration-options');
  DOM.actionOptions = document.getElementById('action-options');
  DOM.nextDayBtn = document.getElementById('next-day-btn');
  
  DOM.turnLogEntries = document.getElementById('turn-log-entries');
  DOM.turnLogPanel = document.getElementById('turn-log-panel');
}

// ─── Initialization ──────────────────────────────────────────────────────────

/**
 * Initialize the game UI and state.
 */
function init() {
  cacheDOM();
  
  // Try to load a saved game first
  if (hasSave()) {
    const saved = loadGame(createRNGStub);
    if (saved && !saved.gameOver) {
      gameState = deserializeState(saved);
      trailLedger = createLedger();
      turnLog = ['Loaded saved game.'];
    } else {
      startNewGame();
    }
  } else {
    startNewGame();
  }
  
  bindEvents();
  render();
}

/**
 * Start a fresh game.
 */
function startNewGame() {
  gameState = createInitialState();
  trailLedger = createLedger();
  turnLog = ['Day 1: The journey begins from Independence, Missouri.'];
  currentEvent = null;
  hideEndScreen();
}

/**
 * Stub RNG factory for deserialization (turn-loop creates its own).
 */
function createRNGStub(seed) {
  let s = seed || Date.now();
  return function() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ─── Event Binding ───────────────────────────────────────────────────────────

function bindEvents() {
  // Pace selection
  DOM.paceOptions.addEventListener('click', (e) => {
    if (e.target.classList.contains('option-btn')) {
      const pace = e.target.dataset.value;
      gameState.pace = pace;
      renderDecisionPanel();
    }
  });
  
  // Ration selection
  DOM.rationOptions.addEventListener('click', (e) => {
    if (e.target.classList.contains('option-btn')) {
      const ration = e.target.dataset.value;
      gameState.ration = ration;
      renderDecisionPanel();
    }
  });
  
  // Action selection
  DOM.actionOptions.addEventListener('click', (e) => {
    if (e.target.classList.contains('option-btn')) {
      const action = e.target.dataset.value;
      gameState.action = action;
      renderDecisionPanel();
    }
  });
  
  // Next Day button
  DOM.nextDayBtn.addEventListener('click', handleNextDay);
}

// ─── Turn Processing ─────────────────────────────────────────────────────────

/**
 * Handle the "Next Day" button click.
 */
function handleNextDay() {
  if (gameState.gameOver) return;

  const decisions = {
    pace: gameState.pace,
    ration: gameState.ration,
    action: gameState.action
  };

  gameState = advanceTurn(gameState, decisions);

  const lastTurn = gameState._turnLog && gameState._turnLog[gameState._turnLog.length - 1];
  if (lastTurn && lastTurn.events && lastTurn.events.length > 0) {
    lastTurn.events.forEach(entry => {
      turnLog.unshift(`Day ${lastTurn.day}: ${entry}`);
    });
  }

  if (gameState.gameOver) {
    render();
    showEndScreen(gameState, trailLedger, () => {
      deleteSave();
      startNewGame();
      render();
    });
    return;
  }

  const eventCategory = selectEventCategory();
  const result = dispatchEvent(eventCategory, gameState, trailLedger, gameState.rng);
  gameState = { ...result.state, rng: gameState.rng, _turnLog: gameState._turnLog };
  trailLedger = result.ledger;
  currentEvent = result.event;

  render();
}

/**
 * Select a random event category based on weighted distribution.
 */
function selectEventCategory() {
  const roll = gameState.rng();
  if (roll < 0.20) return 'weather';
  if (roll < 0.35) return 'illness';
  if (roll < 0.55) return 'encounter';
  if (roll < 0.70) return 'terrain';
  if (roll < 0.85) return 'opportunity';
  return 'moral';
}

/**
 * Handle an event choice selection.
 */
function handleEventChoice(choiceIndex) {
  if (!currentEvent) return;
  
  const choice = currentEvent.choices[choiceIndex];
  if (!choice) return;
  
  // Apply choice effects
  if (choice.effects) {
    applyChoiceEffects(choice.effects);
  }
  
  // Log the choice
  turnLog.unshift(`Day ${gameState.day}: ${currentEvent.title} — Chose: ${choice.text}`);
  
  // Clear the event
  currentEvent = null;
  
  // Auto-save
  saveGame(gameState);
  
  render();
}

/**
 * Apply the effects of an event choice to the game state.
 */
function applyChoiceEffects(effects) {
  const res = gameState.resources;
  
  if (effects.food) res.food = clampResource(res.food + effects.food, 'food');
  if (effects.money) res.money = clampResource(res.money + effects.money, 'money');
  if (effects.ammo) res.ammo = clampResource(res.ammo + effects.ammo, 'ammo');
  if (effects.morale) res.morale = clampResource(res.morale + effects.morale, 'morale');
  if (effects.wagonCondition) res.wagonCondition = clampResource(res.wagonCondition + effects.wagonCondition, 'wagonCondition');
  
  if (effects.health) {
    effects.health.forEach((delta, i) => {
      if (gameState.party.members[i]) {
        gameState.party.members[i].hp = Math.max(0, Math.min(100, gameState.party.members[i].hp + delta));
      }
    });
  }
}

// ─── Rendering ───────────────────────────────────────────────────────────────

/**
 * Render all UI components.
 */
function render() {
  renderDayCounter();
  renderResourceBars();
  renderHealthBars();
  renderDecisionPanel();
  renderEventDisplay();
  renderTurnLog();
}

/**
 * Render the day counter at the top.
 */
function renderDayCounter() {
  DOM.dayLabel.textContent = `Day ${gameState.day}`;
  DOM.distanceLabel.textContent = `${gameState.distanceTraveled} / ${gameState.totalDistance} miles`;
  
  const progress = (gameState.distanceTraveled / gameState.totalDistance) * 100;
  DOM.progressBarFill.style.width = `${Math.min(progress, 100)}%`;
  
  // Update region label
  if (DOM.regionLabel) {
    const legIndex = getLegForDistance(gameState.distanceTraveled);
    const regionName = getRegionName(legIndex);
    DOM.regionLabel.textContent = `${regionName} — Leg ${legIndex + 1}/12`;
  }
}

/**
 * Render resource bars (food, money, ammo, morale, wagon).
 */
function renderResourceBars() {
  const res = gameState.resources;
  
  // Food (0-1000 scale for bar, but show actual value)
  const foodPercent = Math.min((res.food / 1000) * 100, 100);
  DOM.foodBarFill.style.width = `${foodPercent}%`;
  DOM.foodValue.textContent = `${res.food} lbs`;
  
  // Money (0-500 scale)
  const moneyPercent = Math.min((res.money / 500) * 100, 100);
  DOM.moneyBarFill.style.width = `${moneyPercent}%`;
  DOM.moneyValue.textContent = `$${res.money}`;
  
  // Ammo (0-200 scale)
  const ammoPercent = Math.min((res.ammo / 200) * 100, 100);
  DOM.ammoBarFill.style.width = `${ammoPercent}%`;
  DOM.ammoValue.textContent = `${res.ammo} rounds`;
  
  // Morale (0-100)
  DOM.moraleBarFill.style.width = `${res.morale}%`;
  DOM.moraleValue.textContent = `${res.morale}/100`;
  
  // Wagon Condition (0-100)
  DOM.wagonBarFill.style.width = `${res.wagonCondition}%`;
  DOM.wagonValue.textContent = `${res.wagonCondition}/100`;
}

/**
 * Render health bars for each party member.
 */
function renderHealthBars() {
  DOM.healthSection.innerHTML = '';
  
  const heading = document.createElement('h3');
  heading.textContent = 'Party Health';
  DOM.healthSection.appendChild(heading);
  
  gameState.party.members.forEach((member, index) => {
    const barDiv = document.createElement('div');
    barDiv.className = 'health-bar';
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'member-name';
    nameDiv.textContent = member.name;
    if (member.hp <= 0) {
      nameDiv.textContent += ' (Deceased)';
      nameDiv.style.color = '#f44336';
    }
    
    const bgDiv = document.createElement('div');
    bgDiv.className = 'bar-bg';
    
    const fillDiv = document.createElement('div');
    fillDiv.className = 'bar-fill';
    fillDiv.style.width = `${member.hp}%`;
    
    if (member.hp <= 25) {
      fillDiv.classList.add('low');
    } else if (member.hp <= 50) {
      fillDiv.classList.add('medium');
    }
    
    bgDiv.appendChild(fillDiv);
    barDiv.appendChild(nameDiv);
    barDiv.appendChild(bgDiv);
    DOM.healthSection.appendChild(barDiv);
  });
}

/**
 * Render the decision panel (pace, ration, action options).
 */
function renderDecisionPanel() {
  // Pace options
  DOM.paceOptions.innerHTML = '';
  const paces = [
    { value: 'steady', label: 'Steady', desc: '15 mi/day, moderate cost' },
    { value: 'fast', label: 'Fast', desc: '22 mi/day, higher cost' },
    { value: 'grueling', label: 'Grueling', desc: '30 mi/day, heavy toll' }
  ];
  
  paces.forEach(pace => {
    const btn = document.createElement('button');
    btn.className = 'option-btn' + (gameState.pace === pace.value ? ' selected' : '');
    btn.dataset.value = pace.value;
    btn.innerHTML = `<strong>${pace.label}</strong><br><small>${pace.desc}</small>`;
    DOM.paceOptions.appendChild(btn);
  });
  
  // Ration options
  DOM.rationOptions.innerHTML = '';
  const rations = [
    { value: 'filling', label: 'Filling', desc: 'Well-fed, +morale' },
    { value: 'normal', label: 'Normal', desc: 'Balanced consumption' },
    { value: 'meager', label: 'Meager', desc: 'Save food, -morale' }
  ];
  
  rations.forEach(ration => {
    const btn = document.createElement('button');
    btn.className = 'option-btn' + (gameState.ration === ration.value ? ' selected' : '');
    btn.dataset.value = ration.value;
    btn.innerHTML = `<strong>${ration.label}</strong><br><small>${ration.desc}</small>`;
    DOM.rationOptions.appendChild(btn);
  });
  
  // Action options
  DOM.actionOptions.innerHTML = '';
  const actions = [
    { value: 'none', label: 'None', desc: 'Just travel' },
    { value: 'hunt', label: 'Hunt', desc: 'Risk ammo for food' },
    { value: 'rest', label: 'Rest', desc: 'Recover health, no progress' },
    { value: 'trade', label: 'Trade', desc: 'Buy supplies at outpost' }
  ];
  
  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = 'option-btn' + (gameState.action === action.value ? ' selected' : '');
    btn.dataset.value = action.value;
    btn.innerHTML = `<strong>${action.label}</strong><br><small>${action.desc}</small>`;
    DOM.actionOptions.appendChild(btn);
  });
  
  // Update Next Day button state
  if (gameState.gameOver) {
    DOM.nextDayBtn.disabled = true;
    DOM.nextDayBtn.textContent = 'Game Over';
  } else {
    DOM.nextDayBtn.disabled = false;
    DOM.nextDayBtn.textContent = '☀️ Advance to Next Day';
  }
}

/**
 * Render the event display area.
 */
function renderEventDisplay() {
  if (!currentEvent) {
    DOM.eventTitle.textContent = 'On the Trail';
    DOM.eventDescription.textContent = 'The wagon rolls onward. The prairie stretches before you, endless and unforgiving. Choose your pace and rations, then press forward.';
    DOM.eventChoices.innerHTML = '';
    return;
  }

  DOM.eventTitle.textContent = currentEvent.title;

  // Render party voice quote if available
  if (currentEvent.voiceQuote) {
    const voiceEl = document.createElement('div');
    voiceEl.className = 'voice-quote';
    const archetypeLabel = PARTY_VOICE_LABELS[currentEvent.voiceQuote.archetype]
      || currentEvent.voiceQuote.archetype;
    voiceEl.innerHTML =
      `<span class="voice-archetype">${archetypeLabel}</span>` +
      `<span class="voice-text">"${currentEvent.voiceQuote.quote}"</span>`;
    DOM.eventDescription.innerHTML = '';
    DOM.eventDescription.appendChild(voiceEl);
    // Append the event description text after the voice quote
    const descP = document.createElement('p');
    descP.className = 'event-desc';
    descP.textContent = currentEvent.description;
    DOM.eventDescription.appendChild(descP);
  } else {
    DOM.eventDescription.textContent = currentEvent.description;
  }

  DOM.eventChoices.innerHTML = '';

  if (currentEvent.choices && currentEvent.choices.length > 0) {
    currentEvent.choices.forEach((choice, index) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = choice.text;
      btn.addEventListener('click', () => handleEventChoice(index));
      DOM.eventChoices.appendChild(btn);
    });
  }
}

/**
 * Render the turn log.
 */
function renderTurnLog() {
  DOM.turnLogEntries.innerHTML = '';
  
  const maxEntries = 20;
  const entries = turnLog.slice(0, maxEntries);
  
  entries.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'log-entry';
    div.textContent = entry;
    DOM.turnLogEntries.appendChild(div);
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export {
  init,
  startNewGame,
  handleNextDay,
  handleEventChoice,
  render
};
