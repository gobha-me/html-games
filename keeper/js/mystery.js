// Story identifiers are stable across watches; they never reveal a sighting.
export const MYSTERY = Object.freeze({ launch: 'mystery-launch', distress: 'mystery-distress',
  coaster: 'mystery-coaster', skipper: 'mystery-skipper', crate: 'mystery-crate', hour: 480 });

// Historical pages, explicitly dated before the player's appointment. They do
// not describe the player's watches or predict any of the scripted encounters.
export const PREVIOUS_PAGES = Object.freeze([
  'Before your appointment · 04:40 · A launch without running lights. Entered it in the station log.',
  'Before your appointment · Next watch, 04:40 · The dark launch again. Same course. No answer to the lamp.',
  'Before your appointment · Last page · Keep the light turning. Leave a line for the next keeper.',
  'The remaining pages are blank.',
]);

// Pure ending table. A wreck takes priority even over malformed log evidence.
// Exact booleans only; missing/contradictory evidence cannot earn Report.
// Repeated nights add no weight; invalid nights invalidate the completeness claim.
export function resolveEnding(facts = {}) {
  if (facts?.launchWrecked === true) return 'Lost';
  if (facts?.launchWrecked !== false || facts.distressAnswered !== true
    || facts.distressLogged !== true || facts.crateLogged !== true
    || !Array.isArray(facts.launchNights)
    || !facts.launchNights.every((night) => Number.isInteger(night) && night >= 1 && night <= 5)) return 'Silence';
  return new Set(facts.launchNights).size === 5 ? 'Report' : 'Silence';
}
