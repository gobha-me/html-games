/**
 * Oregon Trail — Party State Model
 *
 * Pure-function party management: creation, archetype definitions, HP tracking,
 * skill aggregation, shared morale, and serialization. No DOM manipulation,
 * no side effects. Fully testable with mock state.
 *
 * @module party
 */

// ─── Archetype Definitions ───────────────────────────────────────────────────

/**
 * The four party archetypes with base skills and special effects.
 * Skills are on a 1-4 scale (higher = better).
 * Effects modify event outcomes based on archetype strengths.
 */
export const ARCHETYPES = {
  teacher: {
    name: 'Teacher',
    skills: { hunting: 1, farming: 2, trading: 3, medical: 4 },
    startingMoney: 200,
    effects: {
      healing: 1.5,      // 50% bonus to medical outcomes
      eventKnowledge: 1.3 // 30% bonus to knowledge-based events
    }
  },
  carpenter: {
    name: 'Carpenter',
    skills: { hunting: 2, farming: 1, trading: 2, medical: 1 },
    startingMoney: 200,
    effects: {
      wagonRepair: 1.5,  // 50% bonus to wagon maintenance
      shelter: 1.3       // 30% bonus to shelter-related events
    }
  },
  farmer: {
    name: 'Farmer',
    skills: { hunting: 3, farming: 4, trading: 1, medical: 2 },
    startingMoney: 200,
    effects: {
      foodYield: 1.5,    // 50% bonus to food gathering/farming
      foraging: 1.3      // 30% bonus to foraging events
    }
  },
  banker: {
    name: 'Banker',
    skills: { hunting: 1, farming: 1, trading: 4, medical: 1 },
    startingMoney: 400,  // +$200 bonus
    effects: {
      tradeDiscount: 0.8, // 20% better trade prices
      negotiation: 1.3    // 30% bonus to negotiation events
    }
  }
};

/** List of valid archetype keys */
export const ARCHETYPE_KEYS = Object.keys(ARCHETYPES);

/** Default party composition (one of each archetype) */
const DEFAULT_PARTY = [
  { name: 'Teacher', archetype: 'teacher', hp: 100 },
  { name: 'Carpenter', archetype: 'carpenter', hp: 100 },
  { name: 'Farmer', archetype: 'farmer', hp: 100 },
  { name: 'Banker', archetype: 'banker', hp: 100 }
];

// ─── Constants ───────────────────────────────────────────────────────────────

const HP_MIN = 0;
const HP_MAX = 100;
const MORALE_MIN = 0;
const MORALE_MAX = 100;
const DEFAULT_MORALE = 70;
const PARTY_SIZE = 4;

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Clamp a value between min and max.
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Get the archetype definition for a given archetype key.
 * @param {string} archetypeKey - e.g., 'teacher', 'farmer'
 * @returns {object} Archetype definition
 */
export function getArchetype(archetypeKey) {
  return ARCHETYPES[archetypeKey] || ARCHETYPES.teacher;
}

/**
 * Build a full member object with skills from archetype.
 * @param {object} memberDef - { name, archetype, hp }
 * @returns {object} Full member with skills
 */
function buildMember(memberDef) {
  const archetype = getArchetype(memberDef.archetype);
  return {
    name: memberDef.name,
    archetype: memberDef.archetype,
    hp: clamp(memberDef.hp ?? 100, HP_MIN, HP_MAX),
    skills: { ...archetype.skills }
  };
}

// ─── Party State Creation ────────────────────────────────────────────────────

/**
 * Create a fresh party state with default 4 members.
 * @param {object} [overrides] — Partial overrides:
 *   - members: array of { name, archetype, hp } to replace defaults
 *   - morale: starting morale (default 70)
 * @returns {object} Party state: { members: Member[], morale: number }
 */
export function createPartyState(overrides = {}) {
  const members = (overrides.members || DEFAULT_PARTY).map(buildMember);
  const morale = clamp(overrides.morale ?? DEFAULT_MORALE, MORALE_MIN, MORALE_MAX);

  return {
    members,
    morale
  };
}

// ─── Party Queries ───────────────────────────────────────────────────────────

/**
 * Get party members who are still alive (HP > 0).
 * @param {object} party - Party state
 * @returns {Member[]} Alive members
 */
export function getAliveMembers(party) {
  return party.members.filter(m => m.hp > 0);
}

/**
 * Check if the party is still alive (at least one member with HP > 0).
 * @param {object} party - Party state
 * @returns {boolean} True if at least one member is alive
 */
export function isPartyAlive(party) {
  return party.members.some(m => m.hp > 0);
}

/**
 * Get total skill value for a given skill across all alive members.
 * @param {object} party - Party state
 * @param {string} skillName - 'hunting', 'farming', 'trading', or 'medical'
 * @returns {number} Sum of skill values for alive members
 */
export function getTotalSkill(party, skillName) {
  return getAliveMembers(party)
    .reduce((sum, m) => sum + (m.skills[skillName] || 0), 0);
}

/**
 * Calculate a skill-based modifier for event outcomes.
 * Returns a multiplier: 1.0 = baseline, >1.0 = bonus, <1.0 = penalty.
 * Formula: 1.0 + (totalSkill * 0.05) — each skill point adds 5% bonus.
 * @param {object} party - Party state
 * @param {string} skillName - Skill to calculate modifier for
 * @returns {number} Skill modifier multiplier
 */
export function getSkillModifier(party, skillName) {
  const total = getTotalSkill(party, skillName);
  return 1.0 + (total * 0.05);
}

/**
 * Get a specific member by index.
 * @param {object} party - Party state
 * @param {number} index - Member index (0-3)
 * @returns {Member|undefined} Member at index, or undefined
 */
export function getMember(party, index) {
  return party.members[index];
}

/**
 * Find a member by name.
 * @param {object} party - Party state
 * @param {string} name - Member name
 * @returns {Member|undefined} Matching member, or undefined
 */
export function findMemberByName(party, name) {
  return party.members.find(m => m.name === name);
}

// ─── HP Management ───────────────────────────────────────────────────────────

/**
 * Modify a party member's HP by a delta amount.
 * HP is clamped to [0, 100].
 * @param {object} party - Party state (mutated — returns new state)
 * @param {number} memberIndex - Index of member to modify
 * @param {number} delta - HP change (positive or negative)
 * @returns {object} New party state with updated HP
 */
export function modifyMemberHP(party, memberIndex, delta) {
  const newMembers = party.members.map((m, i) => {
    if (i === memberIndex) {
      return { ...m, hp: clamp(m.hp + delta, HP_MIN, HP_MAX) };
    }
    return { ...m };
  });
  return { ...party, members: newMembers };
}

/**
 * Set a party member's HP to a specific value.
 * @param {object} party - Party state
 * @param {number} memberIndex - Index of member to modify
 * @param {number} hp - New HP value (clamped to [0, 100])
 * @returns {object} New party state
 */
export function setMemberHP(party, memberIndex, hp) {
  const newMembers = party.members.map((m, i) => {
    if (i === memberIndex) {
      return { ...m, hp: clamp(hp, HP_MIN, HP_MAX) };
    }
    return { ...m };
  });
  return { ...party, members: newMembers };
}

/**
 * Damage all alive members by a fixed amount.
 * @param {object} party - Party state
 * @param {number} amount - Damage amount per member
 * @returns {object} New party state
 */
export function damageAllMembers(party, amount) {
  const newMembers = party.members.map(m => ({
    ...m,
    hp: m.hp > 0 ? clamp(m.hp - amount, HP_MIN, HP_MAX) : 0
  }));
  return { ...party, members: newMembers };
}

/**
 * Heal all alive members by a fixed amount.
 * @param {object} party - Party state
 * @param {number} amount - Healing amount per member
 * @returns {object} New party state
 */
export function healAllMembers(party, amount) {
  const newMembers = party.members.map(m => ({
    ...m,
    hp: m.hp > 0 ? clamp(m.hp + amount, HP_MIN, HP_MAX) : 0
  }));
  return { ...party, members: newMembers };
}

// ─── Morale System ───────────────────────────────────────────────────────────

/**
 * Modify party morale by a delta amount.
 * Morale is clamped to [0, 100].
 * @param {object} party - Party state
 * @param {number} delta - Morale change (positive or negative)
 * @returns {object} New party state with updated morale
 */
export function modifyMorale(party, delta) {
  return {
    ...party,
    morale: clamp(party.morale + delta, MORALE_MIN, MORALE_MAX)
  };
}

/**
 * Calculate morale change from daily factors.
 * @param {string} rations - 'filling', 'normal', or 'meager'
 * @param {boolean} rested - Whether the party rested today
 * @param {number} eventOutcome - Event outcome score (-1 to 1, negative = bad)
 * @returns {number} Morale delta for the day
 */
export function calculateMoraleChange(rations, rested, eventOutcome = 0) {
  let delta = 0;

  // Ration effects
  switch (rations) {
    case 'filling': delta += 2; break;
    case 'normal': delta += 0; break;
    case 'meager': delta -= 3; break;
  }

  // Rest bonus
  if (rested) {
    delta += 5;
  }

  // Event outcome impact (scale -1..1 to -5..5)
  delta += Math.round(eventOutcome * 5);

  return delta;
}

/**
 * Get the morale status tier.
 * @param {object} party - Party state
 * @returns {string} Morale tier: 'despairing', 'low', 'neutral', 'good', 'excellent'
 */
export function getMoraleStatus(party) {
  const morale = party.morale;
  if (morale <= 10) return 'despairing';
  if (morale <= 30) return 'low';
  if (morale <= 60) return 'neutral';
  if (morale <= 85) return 'good';
  return 'excellent';
}

// ─── Archetype Effects ───────────────────────────────────────────────────────

/**
 * Get the effect modifier for a specific archetype and event type.
 * @param {string} archetypeKey - e.g., 'teacher', 'farmer'
 * @param {string} eventType - e.g., 'healing', 'foodYield', 'tradeDiscount'
 * @returns {number} Effect modifier (1.0 = baseline)
 */
export function getArchetypeEffect(archetypeKey, eventType) {
  const archetype = getArchetype(archetypeKey);
  return archetype.effects[eventType] || 1.0;
}

/**
 * Calculate the combined archetype bonus for an event type across all alive members.
 * Returns a multiplier based on the best archetype bonus for the event type.
 * Uses the maximum individual bonus (not additive) to prevent runaway scaling.
 * @param {object} party - Party state
 * @param {string} eventType - Event type to check bonuses for
 * @returns {number} Best archetype modifier among alive members (1.0 = no bonus)
 */
export function getBestArchetypeBonus(party, eventType) {
  const aliveMembers = getAliveMembers(party);
  if (aliveMembers.length === 0) return 1.0;

  let bestBonus = 1.0;
  for (const member of aliveMembers) {
    const effect = getArchetypeEffect(member.archetype, eventType);
    if (effect > bestBonus) {
      bestBonus = effect;
    }
  }
  return bestBonus;
}

/**
 * Apply archetype bonuses to a base outcome value.
 * Combines skill modifier and best archetype bonus multiplicatively.
 * @param {object} party - Party state
 * @param {number} baseOutcome - Base outcome value (e.g., food gained, money saved)
 * @param {string} skillName - Primary skill for this event
 * @param {string} eventType - Event type for archetype bonuses
 * @returns {number} Modified outcome value
 */
export function applyArchetypeBonuses(party, baseOutcome, skillName, eventType) {
  const skillMod = getSkillModifier(party, skillName);
  const archetypeBonus = getBestArchetypeBonus(party, eventType);
  return Math.round(baseOutcome * skillMod * archetypeBonus);
}

// ─── Starting Resources ──────────────────────────────────────────────────────

/**
 * Calculate total starting money based on party composition.
 * Each archetype has a startingMoney value; banker gets a bonus.
 * @param {object} party - Party state
 * @returns {number} Total starting money
 */
export function getStartingMoney(party) {
  return party.members.reduce((sum, m) => {
    const archetype = getArchetype(m.archetype);
    return sum + archetype.startingMoney;
  }, 0);
}

// ─── Serialization ───────────────────────────────────────────────────────────

/**
 * Serialize party state for save/load (plain JSON-compatible object).
 * @param {object} party - Party state
 * @returns {object} Serializable party data
 */
export function serializeParty(party) {
  return {
    members: party.members.map(m => ({
      name: m.name,
      archetype: m.archetype,
      hp: m.hp,
      skills: { ...m.skills }
    })),
    morale: party.morale
  };
}

/**
 * Deserialize party state from a serialized form.
 * Validates and clamps values to safe ranges.
 * @param {object} serialized - Serialized party data
 * @returns {object} Restored party state
 */
export function deserializeParty(serialized) {
  const members = (serialized.members || []).map(m => ({
    name: m.name || 'Unknown',
    archetype: ARCHETYPE_KEYS.includes(m.archetype) ? m.archetype : 'teacher',
    hp: clamp(m.hp ?? 100, HP_MIN, HP_MAX),
    skills: {
      hunting: clamp(m.skills?.hunting ?? 1, 1, 4),
      farming: clamp(m.skills?.farming ?? 1, 1, 4),
      trading: clamp(m.skills?.trading ?? 1, 1, 4),
      medical: clamp(m.skills?.medical ?? 1, 1, 4)
    }
  }));

  // Ensure exactly 4 members (pad with defaults if needed)
  while (members.length < PARTY_SIZE) {
    const defaultDef = DEFAULT_PARTY[members.length];
    members.push(buildMember(defaultDef));
  }

  return {
    members,
    morale: clamp(serialized.morale ?? DEFAULT_MORALE, MORALE_MIN, MORALE_MAX)
  };
}

// ─── Party Summary ───────────────────────────────────────────────────────────

/**
 * Get a human-readable summary of the party state.
 * @param {object} party - Party state
 * @returns {object} Summary with alive count, morale status, and skill totals
 */
export function getPartySummary(party) {
  const alive = getAliveMembers(party);
  return {
    aliveCount: alive.length,
    totalCount: party.members.length,
    morale: party.morale,
    moraleStatus: getMoraleStatus(party),
    skills: {
      hunting: getTotalSkill(party, 'hunting'),
      farming: getTotalSkill(party, 'farming'),
      trading: getTotalSkill(party, 'trading'),
      medical: getTotalSkill(party, 'medical')
    },
    members: party.members.map(m => ({
      name: m.name,
      archetype: m.archetype,
      hp: m.hp,
      alive: m.hp > 0
    }))
  };
}
