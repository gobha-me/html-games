/**
 * Oregon Trail — Resource State Model
 *
 * Pure-function resource management: creation, consumption, modification,
 * daily decay, and serialization. No DOM manipulation, no side effects.
 * Fully testable with mock state.
 *
 * @module resources
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const RESOURCE_RANGES = {
  food: { min: 0, max: Infinity },
  money: { min: 0, max: Infinity },
  ammo: { min: 0, max: Infinity },
  morale: { min: 0, max: 100 },
  wagonCondition: { min: 0, max: 100 }
};

// Default starting values per DESIGN.md § Resource Model
const DEFAULT_RESOURCES = {
  food: 800,           // lbs
  money: 200,          // dollars
  ammo: 50,            // rounds
  morale: 60,          // 0-100
  wagonCondition: 80   // 0-100
};

const DEFAULT_HEALTH_PER_MEMBER = 100;
const DEFAULT_PARTY_SIZE = 4;

// Daily decay rates per DESIGN.md
const FOOD_SPOILAGE_BY_PACE = {
  steady: 2,    // lbs/day
  fast: 3,      // lbs/day
  grueling: 5   // lbs/day
};

const WAGON_DEGRADE_BASELINE = 1;  // condition points/day
const MORALE_DROP_BASELINE = 2;    // points/day

// Morale modifiers by ration level (added to baseline morale loss)
const MORALE_RATION_MODIFIER = {
  filling: -2,   // well-fed party loses 2 less morale/day
  normal: 0,     // neutral
  meager: 3      // hungry party loses 3 extra morale/day
};

// Wagon degradation modifiers by pace
const WAGON_PACE_MODIFIER = {
  steady: 0,     // baseline
  fast: 1,       // extra wear
  grueling: 3    // heavy wear
};

// ─── Resource State Creation ─────────────────────────────────────────────────

/**
 * Create a fresh resource state with DESIGN.md defaults.
 * @param {object} [overrides] — Partial resource values to override defaults
 * @param {number} [partySize=4] — Number of party members for health array
 * @returns {{food: number, money: number, ammo: number, health: number[], morale: number, wagonCondition: number}}
 */
export function createResourceState(overrides = {}, partySize = DEFAULT_PARTY_SIZE) {
  const health = Array.from(
    { length: partySize },
    () => overrides.health && Array.isArray(overrides.health)
      ? (overrides.health[0] ?? DEFAULT_HEALTH_PER_MEMBER)
      : DEFAULT_HEALTH_PER_MEMBER
  );

  // If health override is an array, use it directly
  const finalHealth = overrides.health && Array.isArray(overrides.health)
    ? overrides.health.map(h => clamp(h, 0, 100))
    : health;

  const state = {
    food: DEFAULT_RESOURCES.food,
    money: DEFAULT_RESOURCES.money,
    ammo: DEFAULT_RESOURCES.ammo,
    health: finalHealth,
    morale: DEFAULT_RESOURCES.morale,
    wagonCondition: DEFAULT_RESOURCES.wagonCondition
  };

  // Apply scalar overrides (excluding health which is handled above)
  for (const key of Object.keys(overrides)) {
    if (key === 'health') continue;
    if (key in RESOURCE_RANGES) {
      state[key] = clamp(overrides[key], RESOURCE_RANGES[key].min, RESOURCE_RANGES[key].max);
    }
  }

  return state;
}

// ─── Resource Consumption ────────────────────────────────────────────────────

/**
 * Consume a resource — deducts the specified amount, capped at what's available.
 * @param {object} state — Current resource state
 * @param {string} type — Resource type ('food' | 'money' | 'ammo' | 'morale' | 'wagonCondition')
 * @param {number} amount — Amount to consume (must be >= 0)
 * @returns {{state: object, consumed: number}} New state and actual amount consumed
 */
export function consumeResource(state, type, amount) {
  if (!(type in RESOURCE_RANGES) || type === 'health') {
    throw new Error(`Invalid resource type for consumption: ${type}`);
  }
  if (amount < 0) {
    throw new Error(`Consumption amount must be non-negative: ${amount}`);
  }

  const available = state[type];
  const consumed = Math.min(amount, available);
  const newValue = available - consumed;

  return {
    state: { ...state, [type]: newValue },
    consumed
  };
}

// ─── Resource Modification ───────────────────────────────────────────────────

/**
 * Modify a resource by a delta (positive or negative), clamped to valid range.
 * @param {object} state — Current resource state
 * @param {string} type — Resource type ('food' | 'money' | 'ammo' | 'morale' | 'wagonCondition' | 'health')
 * @param {number} delta — Amount to add (positive) or subtract (negative)
 * @param {number} [healthIndex] — Index of party member (required when type === 'health')
 * @returns {object} New resource state
 */
export function modifyResource(state, type, delta, healthIndex) {
  if (type === 'health') {
    if (healthIndex === undefined || healthIndex === null) {
      throw new Error('healthIndex is required when modifying health');
    }
    if (healthIndex < 0 || healthIndex >= state.health.length) {
      throw new Error(`healthIndex out of range: ${healthIndex} (party size: ${state.health.length})`);
    }

    const newHealth = [...state.health];
    newHealth[healthIndex] = clamp(newHealth[healthIndex] + delta, 0, 100);
    return { ...state, health: newHealth };
  }

  if (!(type in RESOURCE_RANGES)) {
    throw new Error(`Invalid resource type: ${type}`);
  }

  const range = RESOURCE_RANGES[type];
  const newValue = clamp(state[type] + delta, range.min, range.max);

  return { ...state, [type]: newValue };
}

// ─── Daily Decay ─────────────────────────────────────────────────────────────

/**
 * Apply daily decay to resources based on pace and ration level.
 * @param {object} state — Current resource state
 * @param {object} [options] — Decay configuration
 * @param {string} [options.pace='steady'] — Travel pace ('steady' | 'fast' | 'grueling')
 * @param {string} [options.ration='normal'] — Ration level ('filling' | 'normal' | 'meager')
 * @param {number} [options.distanceToday=0] — Miles traveled today (affects wagon wear)
 * @param {boolean} [options.rested=false] — Whether the party rested today (reduces morale decay)
 * @returns {{state: object, decay: {foodLost: number, wagonLost: number, moraleLost: number}}}
 */
export function applyDailyDecay(state, options = {}) {
  const pace = options.pace || 'steady';
  const ration = options.ration || 'normal';
  const distanceToday = options.distanceToday || 0;
  const rested = options.rested || false;

  let newState = { ...state };
  const decay = { foodLost: 0, wagonLost: 0, moraleLost: 0 };

  // Food spoilage based on pace
  const foodSpoilage = FOOD_SPOILAGE_BY_PACE[pace] ?? FOOD_SPOILAGE_BY_PACE.steady;
  if (newState.food > 0) {
    const lost = Math.min(foodSpoilage, newState.food);
    newState.food -= lost;
    decay.foodLost = lost;
  }

  // Wagon degradation: baseline + pace modifier + distance factor
  const wagonPaceMod = WAGON_PACE_MODIFIER[pace] ?? 0;
  const distanceWear = distanceToday > 0 ? Math.floor(distanceToday / 10) : 0;
  const wagonLoss = WAGON_DEGRADE_BASELINE + wagonPaceMod + distanceWear;
  if (newState.wagonCondition > 0) {
    const lost = Math.min(wagonLoss, newState.wagonCondition);
    newState.wagonCondition -= lost;
    decay.wagonLost = lost;
  }

  // Morale decay: baseline + ration modifier, reduced if rested
  const rationMod = MORALE_RATION_MODIFIER[ration] ?? 0;
  let moraleLoss = MORALE_DROP_BASELINE + rationMod;
  if (rested) {
    moraleLoss = Math.max(0, moraleLoss - 2); // Resting reduces morale decay by 2
  }
  if (moraleLoss > 0 && newState.morale > 0) {
    const lost = Math.min(moraleLoss, newState.morale);
    newState.morale -= lost;
    decay.moraleLost = lost;
  }

  return { state: newState, decay };
}

// ─── Serialization ───────────────────────────────────────────────────────────

/**
 * Serialize resource state to a plain JSON-compatible object.
 * @param {object} state — Current resource state
 * @returns {object} Plain serializable object
 */
export function serializeResources(state) {
  return {
    food: state.food,
    money: state.money,
    ammo: state.ammo,
    health: [...state.health],
    morale: state.morale,
    wagonCondition: state.wagonCondition
  };
}

/**
 * Deserialize resource state from a plain object (e.g., from localStorage).
 * @param {object} data — Serialized resource data
 * @param {number} [partySize=4] — Expected party size (fills missing health slots)
 * @returns {object} Restored resource state
 */
export function deserializeResources(data, partySize = DEFAULT_PARTY_SIZE) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid serialized resource data');
  }

  const health = Array.isArray(data.health)
    ? data.health.map(h => clamp(Number(h) || 0, 0, 100))
    : Array.from({ length: partySize }, () => DEFAULT_HEALTH_PER_MEMBER);

  // Fill missing health slots if party grew
  while (health.length < partySize) {
    health.push(DEFAULT_HEALTH_PER_MEMBER);
  }

  return {
    food: clamp(Number(data.food) || 0, 0, Infinity),
    money: clamp(Number(data.money) || 0, 0, Infinity),
    ammo: clamp(Number(data.ammo) || 0, 0, Infinity),
    health,
    morale: clamp(Number(data.morale) || 0, 0, 100),
    wagonCondition: clamp(Number(data.wagonCondition) || 0, 0, 100)
  };
}

// ─── Resource Status ─────────────────────────────────────────────────────────

/**
 * Get qualitative status labels for each resource.
 * @param {object} state — Current resource state
 * @returns {{food: string, money: string, ammo: string, health: string[], morale: string, wagonCondition: string}}
 */
export function getResourceStatus(state) {
  return {
    food: _statusLabel(state.food, [
      { threshold: 400, label: 'well-stocked' },
      { threshold: 200, label: 'adequate' },
      { threshold: 50, label: 'low' },
      { threshold: 0, label: 'critical' }
    ]),
    money: _statusLabel(state.money, [
      { threshold: 300, label: 'wealthy' },
      { threshold: 100, label: 'comfortable' },
      { threshold: 25, label: 'tight' },
      { threshold: 0, label: 'broke' }
    ]),
    ammo: _statusLabel(state.ammo, [
      { threshold: 100, label: 'well-armed' },
      { threshold: 30, label: 'adequate' },
      { threshold: 10, label: 'low' },
      { threshold: 0, label: 'nearly empty' }
    ]),
    health: state.health.map(hp => _statusLabel(hp, [
      { threshold: 80, label: 'healthy' },
      { threshold: 50, label: 'injured' },
      { threshold: 20, label: 'critical' },
      { threshold: 0, label: 'incapacitated' }
    ])),
    morale: _statusLabel(state.morale, [
      { threshold: 80, label: 'high' },
      { threshold: 50, label: 'stable' },
      { threshold: 20, label: 'low' },
      { threshold: 0, label: 'despairing' }
    ]),
    wagonCondition: _statusLabel(state.wagonCondition, [
      { threshold: 80, label: 'excellent' },
      { threshold: 50, label: 'fair' },
      { threshold: 20, label: 'poor' },
      { threshold: 0, label: 'broken' }
    ])
  };
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Clamp a value between min and max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get a status label based on thresholds (highest matching threshold wins).
 * @param {number} value
 * @param {{threshold: number, label: string}[]} tiers
 * @returns {string}
 */
function _statusLabel(value, tiers) {
  for (const tier of tiers) {
    if (value >= tier.threshold) {
      return tier.label;
    }
  }
  return tiers[tiers.length - 1].label;
}

// ─── Inline Unit Tests ───────────────────────────────────────────────────────

/**
 * Lightweight test runner — runs when executed directly (not imported as module).
 * Usage: Run in browser console or Node.js with `node resources.js`.
 */
function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      passed++;
      console.log(`  ✓ ${message}`);
    } else {
      failed++;
      console.error(`  ✗ ${message}`);
    }
  }

  function assertEqual(actual, expected, message) {
    const actualStr = JSON.stringify(actual);
    const expectedStr = JSON.stringify(expected);
    assert(actualStr === expectedStr, `${message} (expected ${expectedStr}, got ${actualStr})`);
  }

  console.log('\n=== Resource State Model Tests ===\n');

  // ── createResourceState ──
  console.log('createResourceState:');
  {
    const state = createResourceState();
    assertEqual(state.food, 800, 'default food is 800');
    assertEqual(state.money, 200, 'default money is 200');
    assertEqual(state.ammo, 50, 'default ammo is 50');
    assertEqual(state.morale, 60, 'default morale is 60');
    assertEqual(state.wagonCondition, 80, 'default wagonCondition is 80');
    assertEqual(state.health.length, 4, 'default party has 4 members');
    assertEqual(state.health, [100, 100, 100, 100], 'default health is 100 per member');
  }
  {
    const state = createResourceState({ food: 500, morale: 30 });
    assertEqual(state.food, 500, 'override food to 500');
    assertEqual(state.morale, 30, 'override morale to 30');
    assertEqual(state.money, 200, 'non-overridden money stays default');
  }
  {
    const state = createResourceState({ food: -50, morale: 150 });
    assertEqual(state.food, 0, 'negative food clamped to 0');
    assertEqual(state.morale, 100, 'morale > 100 clamped to 100');
  }
  {
    const state = createResourceState({ health: [80, 60, 40, 20] }, 4);
    assertEqual(state.health, [80, 60, 40, 20], 'custom health array');
  }
  {
    const state = createResourceState({}, 6);
    assertEqual(state.health.length, 6, 'party size 6 creates 6 health entries');
  }

  // ── consumeResource ──
  console.log('\nconsumeResource:');
  {
    const state = createResourceState({ food: 100 });
    const result = consumeResource(state, 'food', 30);
    assertEqual(result.state.food, 70, 'food reduced by 30');
    assertEqual(result.consumed, 30, 'consumed amount is 30');
    assertEqual(state.food, 100, 'original state unchanged (immutability)');
  }
  {
    const state = createResourceState({ food: 10 });
    const result = consumeResource(state, 'food', 50);
    assertEqual(result.state.food, 0, 'food reduced to 0 when over-consumed');
    assertEqual(result.consumed, 10, 'consumed amount capped at available');
  }
  {
    const state = createResourceState({ money: 100 });
    const result = consumeResource(state, 'money', 0);
    assertEqual(result.state.money, 100, 'zero consumption leaves state unchanged');
    assertEqual(result.consumed, 0, 'consumed amount is 0');
  }
  {
    try {
      consumeResource(createResourceState(), 'health', 10);
      assert(false, 'consuming health throws error');
    } catch (e) {
      assert(true, 'consuming health throws error');
    }
  }
  {
    try {
      consumeResource(createResourceState(), 'food', -5);
      assert(false, 'negative consumption throws error');
    } catch (e) {
      assert(true, 'negative consumption throws error');
    }
  }

  // ── modifyResource ──
  console.log('\nmodifyResource:');
  {
    const state = createResourceState({ food: 100 });
    const result = modifyResource(state, 'food', 50);
    assertEqual(result.food, 150, 'food increased by 50');
    assertEqual(state.food, 100, 'original state unchanged');
  }
  {
    const state = createResourceState({ food: 100 });
    const result = modifyResource(state, 'food', -150);
    assertEqual(result.food, 0, 'food clamped to 0 on negative overflow');
  }
  {
    const state = createResourceState({ morale: 90 });
    const result = modifyResource(state, 'morale', 20);
    assertEqual(result.morale, 100, 'morale clamped to 100 on positive overflow');
  }
  {
    const state = createResourceState({ health: [80, 60, 40, 20] });
    const result = modifyResource(state, 'health', -30, 1);
    assertEqual(result.health, [80, 30, 40, 20], 'health modified for specific member');
  }
  {
    const state = createResourceState({ health: [80, 60, 40, 20] });
    const result = modifyResource(state, 'health', -100, 3);
    assertEqual(result.health[3], 0, 'health clamped to 0');
  }
  {
    const state = createResourceState({ health: [80, 60, 40, 20] });
    const result = modifyResource(state, 'health', 50, 0);
    assertEqual(result.health[0], 100, 'health clamped to 100');
  }
  {
    try {
      modifyResource(createResourceState(), 'health', 10);
      assert(false, 'missing healthIndex throws error');
    } catch (e) {
      assert(true, 'missing healthIndex throws error');
    }
  }
  {
    try {
      modifyResource(createResourceState(), 'health', 10, 99);
      assert(false, 'out-of-range healthIndex throws error');
    } catch (e) {
      assert(true, 'out-of-range healthIndex throws error');
    }
  }

  // ── applyDailyDecay ──
  console.log('\napplyDailyDecay:');
  {
    const state = createResourceState({ food: 100, morale: 60, wagonCondition: 80 });
    const result = applyDailyDecay(state, { pace: 'steady', ration: 'normal' });
    assertEqual(result.decay.foodLost, 2, 'steady pace spoils 2 food/day');
    assertEqual(result.decay.moraleLost, 2, 'normal ration drops 2 morale/day');
    assertEqual(result.decay.wagonLost, 1, 'baseline wagon degradation is 1/day');
    assertEqual(result.state.food, 98, 'food after steady decay');
    assertEqual(result.state.morale, 58, 'morale after normal decay');
    assertEqual(result.state.wagonCondition, 79, 'wagon after baseline decay');
  }
  {
    const state = createResourceState({ food: 100, morale: 60, wagonCondition: 80 });
    const result = applyDailyDecay(state, { pace: 'grueling', ration: 'meager' });
    assertEqual(result.decay.foodLost, 5, 'grueling pace spoils 5 food/day');
    assertEqual(result.decay.moraleLost, 5, 'meager ration: 2 baseline + 3 modifier');
    assertEqual(result.decay.wagonLost, 4, 'grueling: 1 baseline + 3 pace modifier');
  }
  {
    const state = createResourceState({ food: 100, morale: 60, wagonCondition: 80 });
    const result = applyDailyDecay(state, { pace: 'fast', ration: 'filling', rested: true });
    assertEqual(result.decay.foodLost, 3, 'fast pace spoils 3 food/day');
    assertEqual(result.decay.moraleLost, 0, 'filling + rested: 2 baseline - 2 modifier - 2 rest = 0');
    assertEqual(result.decay.wagonLost, 2, 'fast: 1 baseline + 1 pace modifier');
  }
  {
    const state = createResourceState({ food: 1, morale: 1, wagonCondition: 1 });
    const result = applyDailyDecay(state, { pace: 'grueling', ration: 'meager' });
    assertEqual(result.state.food, 0, 'food cannot go below 0');
    assertEqual(result.state.morale, 0, 'morale cannot go below 0');
    assertEqual(result.state.wagonCondition, 0, 'wagonCondition cannot go below 0');
  }
  {
    const state = createResourceState({ food: 100, wagonCondition: 80 });
    const result = applyDailyDecay(state, { pace: 'steady', distanceToday: 25 });
    assertEqual(result.decay.wagonLost, 3, 'distance wear: 1 baseline + 0 pace + 2 (25/10 floored)');
  }

  // ── Serialization ──
  console.log('\nSerialization:');
  {
    const state = createResourceState({ food: 500, health: [80, 60, 40, 20] });
    const serialized = serializeResources(state);
    assertEqual(serialized.food, 500, 'serialize preserves food');
    assertEqual(serialized.health, [80, 60, 40, 20], 'serialize preserves health array');
    assert(typeof JSON.stringify(serialized) === 'string', 'serialized is JSON-stringifiable');
  }
  {
    const state = createResourceState({ food: 500, health: [80, 60, 40, 20] });
    const serialized = serializeResources(state);
    const restored = deserializeResources(serialized);
    assertEqual(restored.food, 500, 'deserialize restores food');
    assertEqual(restored.money, 200, 'deserialize restores default money');
    assertEqual(restored.health, [80, 60, 40, 20], 'deserialize restores health array');
    assertEqual(restored.morale, 60, 'deserialize restores default morale');
  }
  {
    const restored = deserializeResources({ food: -10, morale: 200, wagonCondition: -5 });
    assertEqual(restored.food, 0, 'deserialize clamps negative food to 0');
    assertEqual(restored.morale, 100, 'deserialize clamps morale > 100 to 100');
    assertEqual(restored.wagonCondition, 0, 'deserialize clamps negative wagonCondition to 0');
  }
  {
    const restored = deserializeResources({ health: [50, 30] }, 4);
    assertEqual(restored.health.length, 4, 'deserialize fills missing health slots');
    assertEqual(restored.health, [50, 30, 100, 100], 'deserialize preserves existing health, fills rest');
  }

  // ── getResourceStatus ──
  console.log('\ngetResourceStatus:');
  {
    const state = createResourceState({ food: 500, money: 400, ammo: 150, morale: 90, wagonCondition: 95, health: [100, 100, 100, 100] });
    const status = getResourceStatus(state);
    assertEqual(status.food, 'well-stocked', '500 food = well-stocked');
    assertEqual(status.money, 'wealthy', '400 money = wealthy');
    assertEqual(status.ammo, 'well-armed', '150 ammo = well-armed');
    assertEqual(status.morale, 'high', '90 morale = high');
    assertEqual(status.wagonCondition, 'excellent', '95 wagon = excellent');
    assertEqual(status.health, ['healthy', 'healthy', 'healthy', 'healthy'], '100 hp = healthy');
  }
  {
    const state = createResourceState({ food: 10, money: 5, ammo: 3, morale: 5, wagonCondition: 5, health: [5, 5, 5, 5] });
    const status = getResourceStatus(state);
    assertEqual(status.food, 'critical', '10 food = critical');
    assertEqual(status.money, 'broke', '5 money = broke');
    assertEqual(status.ammo, 'nearly empty', '3 ammo = nearly empty');
    assertEqual(status.morale, 'despairing', '5 morale = despairing');
    assertEqual(status.wagonCondition, 'broken', '5 wagon = broken');
    assertEqual(status.health, ['incapacitated', 'incapacitated', 'incapacitated', 'incapacitated'], '5 hp = incapacitated');
  }

  // ── Summary ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  return { passed, failed };
}

// Run tests if executed directly (not imported as ES module)
if (typeof window !== 'undefined' || (typeof process !== 'undefined' && process.argv[1]?.endsWith('resources.js'))) {
  runTests();
}
