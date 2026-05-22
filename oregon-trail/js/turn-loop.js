/**
 * Oregon Trail — Turn Loop
 * 
 * Pure-function day cycle: player picks pace/ration/action → game advances state.
 * No DOM manipulation, no side effects. Fully testable with mock state.
 * 
 * @module turn-loop
 */

import {
  getLegForDistance,
  getLegInfo,
  getFlavorText,
  hasEnteredNewLeg,
  getRegionName,
  getArrivalMessage
} from './region-runner.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const TOTAL_DISTANCE = 2000; // miles from Independence to Willamette Valley

const PACE_EFFECTS = {
  steady: {
    distance: 15,
    foodMultiplier: 1.0,
    wagonWear: 1,
    illnessRisk: 0.05,
    moraleImpact: 0
  },
  fast: {
    distance: 22,
    foodMultiplier: 1.5,
    wagonWear: 2,
    illnessRisk: 0.12,
    moraleImpact: -2
  },
  grueling: {
    distance: 30,
    foodMultiplier: 2.0,
    wagonWear: 4,
    illnessRisk: 0.20,
    moraleImpact: -5
  }
};

const RATION_EFFECTS = {
  filling: {
    foodConsumption: 1.0,
    moraleImpact: 2,
    healthImpact: 1
  },
  normal: {
    foodConsumption: 0.7,
    moraleImpact: 0,
    healthImpact: 0
  },
  meager: {
    foodConsumption: 0.4,
    moraleImpact: -3,
    healthImpact: -1
  }
};

const BASE_FOOD_PER_DAY = 15; // lbs for a party of 4 at full rations

// ─── Seeded RNG (for testability) ────────────────────────────────────────────

/**
 * Simple seeded PRNG (mulberry32) — deterministic given the same seed.
 * @param {number} seed
 * @returns {() => number} Function returning [0, 1)
 */
function createRNG(seed = Date.now()) {
  let s = seed | 0;
  return function() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ─── State Creation ──────────────────────────────────────────────────────────

/**
 * Create a fresh initial game state.
 * @param {object} [overrides] — Partial state to override defaults
 * @param {number} [seed] — RNG seed for deterministic testing
 * @returns {object} Initial game state
 */
function createInitialState(overrides = {}, seed = undefined) {
  const state = {
    day: 1,
    distanceTraveled: 0,
    totalDistance: TOTAL_DISTANCE,
    resources: {
      food: 200,       // lbs
      money: 200,      // dollars
      ammo: 100,       // rounds
      morale: 70,      // 0-100
      wagonCondition: 100 // 0-100
    },
    party: {
      members: [
        { name: 'Teacher', archetype: 'teacher', hp: 100, skills: { hunting: 1, farming: 2, trading: 3, medical: 4 } },
        { name: 'Carpenter', archetype: 'carpenter', hp: 100, skills: { hunting: 2, farming: 1, trading: 2, medical: 1 } },
        { name: 'Farmer', archetype: 'farmer', hp: 100, skills: { hunting: 3, farming: 4, trading: 1, medical: 2 } },
        { name: 'Banker', archetype: 'banker', hp: 100, skills: { hunting: 1, farming: 1, trading: 4, medical: 1 } }
      ]
    },
    pace: 'steady',
    ration: 'normal',
    action: 'none',
    gameOver: false,
    endReason: null,
    rng: createRNG(seed),
    _turnLog: [] // Internal log of turn events (for debugging/UI)
  };

  // Apply overrides deeply
  return deepMerge(state, overrides);
}

/**
 * Deep merge two objects (shallow for arrays).
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

// ─── Effect Calculators ──────────────────────────────────────────────────────

/**
 * Get the effects of a given pace.
 * @param {string} pace - 'steady' | 'fast' | 'grueling'
 * @returns {object} Pace effects
 */
function getPaceEffects(pace) {
  return PACE_EFFECTS[pace] || PACE_EFFECTS.steady;
}

/**
 * Get the effects of a given ration level.
 * @param {string} ration - 'filling' | 'normal' | 'meager'
 * @returns {object} Ration effects
 */
function getRationEffects(ration) {
  return RATION_EFFECTS[ration] || RATION_EFFECTS.normal;
}

/**
 * Calculate food consumption for a day based on pace and ration.
 * @param {string} pace
 * @param {string} ration
 * @returns {number} Food consumed in lbs
 */
function calculateFoodConsumption(pace, ration) {
  const paceFx = getPaceEffects(pace);
  const rationFx = getRationEffects(ration);
  return Math.round(BASE_FOOD_PER_DAY * paceFx.foodMultiplier * rationFx.foodConsumption);
}

// ─── Action Resolution ───────────────────────────────────────────────────────

/**
 * Resolve the chosen action and return resource deltas.
 * @param {string} action - 'hunt' | 'trade' | 'rest' | 'none'
 * @param {object} state - Current game state
 * @param {Function} rng - Random number generator
 * @returns {object} { food: number, money: number, ammo: number, morale: number, wagonCondition: number, log: string[] }
 */
function resolveAction(action, state, rng) {
  const deltas = { food: 0, money: 0, ammo: 0, morale: 0, wagonCondition: 0 };
  const log = [];

  switch (action) {
    case 'hunt': {
      const ammoSpent = Math.floor(rng() * 11) + 5; // 5-15 ammo
      if (state.resources.ammo >= ammoSpent) {
        // Hunt success based on party hunting skills
        const totalHunting = state.party.members
          .filter(m => m.hp > 0)
          .reduce((sum, m) => sum + (m.skills.hunting || 0), 0);
        const successChance = Math.min(0.9, 0.3 + totalHunting * 0.08);
        
        if (rng() < successChance) {
          const foodGained = Math.floor(rng() * 171) + 30; // 30-200 lbs
          deltas.ammo = -ammoSpent;
          deltas.food = foodGained;
          deltas.morale = 3;
          log.push(`Hunting successful! Gained ${foodGained} lbs of food (spent ${ammoSpent} ammo).`);
        } else {
          deltas.ammo = -ammoSpent;
          deltas.morale = -2;
          log.push(`Hunting yielded nothing. Lost ${ammoSpent} ammo.`);
        }
      } else {
        log.push('Not enough ammo to hunt.');
      }
      break;
    }

    case 'trade': {
      // Trade: spend money for supplies (food or ammo)
      const tradeAmount = Math.floor(rng() * 3) + 1; // 1-3 trade events
      for (let i = 0; i < tradeAmount; i++) {
        if (state.resources.money >= 10) {
          const cost = Math.floor(rng() * 11) + 10; // $10-20
          if (state.resources.money >= cost) {
            const buyAmmo = rng() < 0.4; // 40% chance to buy ammo
            if (buyAmmo) {
              const ammoGained = Math.floor(rng() * 16) + 10; // 10-25 rounds
              deltas.money -= cost;
              deltas.ammo += ammoGained;
              log.push(`Traded $${cost} for ${ammoGained} rounds of ammo.`);
            } else {
              const foodGained = Math.floor(rng() * 31) + 20; // 20-50 lbs
              deltas.money -= cost;
              deltas.food += foodGained;
              log.push(`Traded $${cost} for ${foodGained} lbs of food.`);
            }
          }
        }
      }
      if (deltas.money === 0) {
        log.push('No money available for trading.');
      }
      break;
    }
    }

    case 'rest': {
      // Rest: recover health and morale, but lose a day
      const recoveryAmount = Math.floor(rng() * 11) + 5; // 5-15 HP
      for (const member of state.party.members) {
        if (member.hp > 0 && member.hp < 100) {
          member.hp = Math.min(100, member.hp + recoveryAmount);
        }
      }
      deltas.morale = 5;
      deltas.wagonCondition = 2; // Minor wagon maintenance
      log.push(`Party rested. Recovered up to ${recoveryAmount} HP per member.`);
      break;
    }

    case 'none':
    default:
      log.push('No special action taken.');
      break;
  }

  return { deltas, log };
}

// ─── Illness Check ───────────────────────────────────────────────────────────

/**
 * Check if any party member falls ill based on pace illness risk.
 * @param {object} state - Current game state
 * @param {number} illnessRisk - Base illness risk from pace
 * @param {Function} rng - Random number generator
 * @returns {object} { affected: Array<{memberName, hpLost}>, log: string[] }
 */
function checkIllness(state, illnessRisk, rng) {
  const affected = [];
  const log = [];

  for (const member of state.party.members) {
    if (member.hp > 0 && rng() < illnessRisk) {
      const hpLost = Math.floor(rng() * 16) + 5; // 5-20 HP
      member.hp = Math.max(0, member.hp - hpLost);
      affected.push({ memberName: member.name, hpLost });
      log.push(`${member.name} fell ill and lost ${hpLost} HP.`);
    }
  }

  return { affected, log };
}

// ─── Core Turn Advancement ───────────────────────────────────────────────────

/**
 * Advance the game by one turn (day).
 * 
 * Pure function: given state and decisions, returns new state.
 * No side effects, no DOM manipulation.
 * 
 * @param {object} state - Current game state
 * @param {object} decisions - Player's choices for this turn
 * @param {string} decisions.pace - 'steady' | 'fast' | 'grueling'
 * @param {string} decisions.ration - 'filling' | 'normal' | 'meager'
 * @param {string} decisions.action - 'hunt' | 'trade' | 'rest' | 'none'
 * @param {number} [seed] - Optional RNG seed for deterministic testing
 * @returns {object} New game state after advancing one day
 */
function advanceTurn(state, decisions, seed = undefined) {
  // Clone state to maintain immutability
  const newState = JSON.parse(JSON.stringify(state));
  // Restore RNG function (not serializable via JSON)
  newState.rng = state.rng || createRNG(seed);

  const pace = decisions.pace || state.pace;
  const ration = decisions.ration || state.ration;
  const action = decisions.action || 'none';

  const paceFx = getPaceEffects(pace);
  const rationFx = getRationEffects(ration);
  const turnLog = [];

  // 1. Calculate and consume food
  const foodConsumed = calculateFoodConsumption(pace, ration);
  const actualFoodConsumed = Math.min(newState.resources.food, foodConsumed);
  newState.resources.food -= actualFoodConsumed;

  if (actualFoodConsumed < foodConsumed) {
    turnLog.push(`Food shortage! Only ${actualFoodConsumed}/${foodConsumed} lbs consumed.`);
    // Starvation penalty
    for (const member of newState.party.members) {
      if (member.hp > 0) {
        member.hp = Math.max(0, member.hp - 10);
      }
    }
    newState.resources.morale = Math.max(0, newState.resources.morale - 10);
  }

  // 2. Apply pace effects (distance, wagon wear)
  const previousDistance = newState.distanceTraveled;
  newState.distanceTraveled += paceFx.distance;
  newState.resources.wagonCondition = Math.max(
    0,
    newState.resources.wagonCondition - paceFx.wagonWear
  );

  // 2b. Regional flavor: check for leg transitions and add flavor text
  if (hasEnteredNewLeg(newState.distanceTraveled, previousDistance)) {
    const newLegIndex = getLegForDistance(newState.distanceTraveled);
    const arrivalMsg = getArrivalMessage(newLegIndex);
    const regionName = getRegionName(newLegIndex);
    turnLog.push(`📍 ${arrivalMsg} (${regionName} region)`);

    // Add atmospheric flavor text based on day rotation
    const timeSlots = ['morning', 'midday', 'evening', 'campfire'];
    const timeOfDay = timeSlots[newState.day % 4];
    const flavor = getFlavorText(newState.distanceTraveled, timeOfDay);
    if (flavor) {
      turnLog.push(flavor);
    }
  }

  // 3. Apply ration morale/health effects
  newState.resources.morale = clamp(
    newState.resources.morale + rationFx.moraleImpact + paceFx.moraleImpact,
    0, 100
  );

  // 4. Resolve action
  const { deltas: actionDeltas, log: actionLog } = resolveAction(action, newState, newState.rng);
  turnLog.push(...actionLog);

  newState.resources.food = Math.max(0, newState.resources.food + actionDeltas.food);
  newState.resources.money = Math.max(0, newState.resources.money + actionDeltas.money);
  newState.resources.ammo = Math.max(0, newState.resources.ammo + actionDeltas.ammo);
  newState.resources.morale = clamp(
    newState.resources.morale + actionDeltas.morale,
    0, 100
  );
  newState.resources.wagonCondition = clamp(
    newState.resources.wagonCondition + actionDeltas.wagonCondition,
    0, 100
  );

  // 5. Check for illness
  const { affected: illMembers, log: illnessLog } = checkIllness(
    newState,
    paceFx.illnessRisk,
    newState.rng
  );
  turnLog.push(...illnessLog);

  // 6. Advance day
  newState.day += 1;

  // 7. Store decisions
  newState.pace = pace;
  newState.ration = ration;
  newState.action = action;

  // 8. Append turn log
  newState._turnLog = [...(state._turnLog || []), { day: state.day, pace, ration, action, events: turnLog }];

  // 9. Check game-over conditions
  const gameOverResult = checkGameOver(newState);
  newState.gameOver = gameOverResult.gameOver;
  newState.endReason = gameOverResult.reason;

  return newState;
}

// ─── Game-Over Checking ──────────────────────────────────────────────────────

/**
 * Check if the game should end.
 * @param {object} state - Current game state
 * @returns {{ gameOver: boolean, reason: string | null }}
 */
function checkGameOver(state) {
  // Victory: reached destination
  if (state.distanceTraveled >= state.totalDistance) {
    return { gameOver: true, reason: 'victory' };
  }

  // All party members dead
  const aliveMembers = state.party.members.filter(m => m.hp > 0);
  if (aliveMembers.length === 0) {
    return { gameOver: true, reason: 'all_dead' };
  }

  // Wagon destroyed (can't continue without it)
  if (state.resources.wagonCondition <= 0) {
    return { gameOver: true, reason: 'wagon_destroyed' };
  }

  // Food completely depleted and no way to recover (morale collapse)
  if (state.resources.food <= 0 && state.resources.morale <= 0) {
    return { gameOver: true, reason: 'abandoned' };
  }

  return { gameOver: false, reason: null };
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Clamp a value between min and max.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get a summary of the current game state for display/debugging.
 * @param {object} state
 * @returns {object} Human-readable summary
 */
function getStateSummary(state) {
  const aliveMembers = state.party.members.filter(m => m.hp > 0);
  return {
    day: state.day,
    distance: `${state.distanceTraveled}/${state.totalDistance} miles`,
    progress: `${Math.round((state.distanceTraveled / state.totalDistance) * 100)}%`,
    resources: {
      food: `${state.resources.food} lbs`,
      money: `$${state.resources.money}`,
      ammo: `${state.resources.ammo} rounds`,
      morale: `${state.resources.morale}/100`,
      wagon: `${state.resources.wagonCondition}/100`
    },
    party: `${aliveMembers.length}/${state.party.members.length} alive`,
    gameOver: state.gameOver,
    endReason: state.endReason
  };
}

/**
 * Serialize state for save/load (removes non-serializable RNG function).
 * @param {object} state
 * @returns {object} Serializable state
 */
function serializeState(state) {
  const { rng, _turnLog, ...serializable } = state;
  return serializable;
}

/**
 * Deserialize state (restores RNG).
 * @param {object} serialized
 * @param {number} [seed]
 * @returns {object} Restored state
 */
function deserializeState(serialized, seed = undefined) {
  return {
    ...serialized,
    rng: createRNG(seed),
    _turnLog: serialized._turnLog || []
  };
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export {
  // Core
  createInitialState,
  advanceTurn,
  checkGameOver,
  
  // Effect calculators
  getPaceEffects,
  getRationEffects,
  calculateFoodConsumption,
  resolveAction,
  
  // Utilities
  getStateSummary,
  serializeState,
  deserializeState,
  createRNG,
  
  // Constants
  TOTAL_DISTANCE,
  PACE_EFFECTS,
  RATION_EFFECTS,
  BASE_FOOD_PER_DAY
};
