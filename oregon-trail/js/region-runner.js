/**
 * Oregon Trail — Region Runner
 *
 * Imports all three region data files and provides helper functions for
 * mapping distance traveled to the current leg, region, and flavor text.
 *
 * Pure functions only — no DOM, no side effects.
 *
 * @module region-runner
 */

import { PLAINS_REGION_DATA } from './events/regions/plains.js';
import { MOUNTAINS_REGION_DATA } from './events/regions/mountains.js';
import { DESERT_REGION_DATA } from './events/regions/desert.js';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Combined array of all 12 legs in order. */
const ALL_REGION_DATA = Object.freeze([
  ...PLAINS_REGION_DATA.legs,
  ...MOUNTAINS_REGION_DATA.legs,
  ...DESERT_REGION_DATA.legs
]);

/**
 * Region name lookup by leg index range.
 * Legs 0-3: Plains, 4-7: Mountains, 8-11: Desert & River
 */
function getRegionName(legIndex) {
  if (legIndex < 0 || legIndex >= ALL_REGION_DATA.length) return 'Unknown';
  if (legIndex < 4) return 'Plains';
  if (legIndex < 8) return 'Mountains';
  return 'Desert & River';
}

/**
 * Get the region data object for a given leg index.
 * @param {number} legIndex - 0-11
 * @returns {object} The region data object (PLAINS_REGION_DATA, etc.)
 */
function getRegionDataForLeg(legIndex) {
  if (legIndex < 0 || legIndex >= ALL_REGION_DATA.length) return null;
  if (legIndex < 4) return PLAINS_REGION_DATA;
  if (legIndex < 8) return MOUNTAINS_REGION_DATA;
  return DESERT_REGION_DATA;
}

/**
 * Calculate cumulative distance thresholds for each leg.
 * Uses the approximate distances from the region files, scaled to
 * match the game's TOTAL_DISTANCE (2000 miles).
 *
 * Raw distances:
 *   Plains:    100 + 200 + 150 + 175 = 625
 *   Mountains: 120 + 100 + 130 + 150 = 500
 *   Desert:    120 + 90  + 80  + 150 = 440
 *   Total raw: 1565
 *
 * Scale factor: 2000 / 1565 ≈ 1.278
 */
const RAW_DISTANCES = [100, 200, 150, 175, 120, 100, 130, 150, 120, 90, 80, 150];
const TOTAL_RAW = RAW_DISTANCES.reduce((a, b) => a + b, 0); // 1565
const TOTAL_DISTANCE = 2000;
const SCALE_FACTOR = TOTAL_DISTANCE / TOTAL_RAW;

/** Cumulative thresholds — distance at which each leg begins. */
const LEG_THRESHOLDS = (() => {
  const thresholds = [0]; // Leg 0 starts at 0
  let cumulative = 0;
  for (let i = 0; i < RAW_DISTANCES.length - 1; i++) {
    cumulative += Math.round(RAW_DISTANCES[i] * SCALE_FACTOR);
    thresholds.push(cumulative);
  }
  return Object.freeze(thresholds);
})();

/**
 * Map distance traveled to a leg index (0-11).
 * @param {number} distanceTraveled - Current distance in miles
 * @returns {number} Leg index (0-11), clamped to valid range
 */
function getLegForDistance(distanceTraveled) {
  const clamped = Math.max(0, Math.min(distanceTraveled, TOTAL_DISTANCE));
  let legIndex = 0;
  for (let i = LEG_THRESHOLDS.length - 1; i >= 0; i--) {
    if (clamped >= LEG_THRESHOLDS[i]) {
      legIndex = i;
      break;
    }
  }
  return Math.min(legIndex, ALL_REGION_DATA.length - 1);
}

/**
 * Get the full leg object for the current distance.
 * @param {number} distanceTraveled
 * @returns {object|null} Leg object with name, start, end, landmarks, flavorText
 */
function getLegInfo(distanceTraveled) {
  const legIndex = getLegForDistance(distanceTraveled);
  return ALL_REGION_DATA[legIndex] || null;
}

/**
 * Get flavor text for the current leg and time of day.
 * @param {number} distanceTraveled
 * @param {string} timeOfDay - 'morning', 'midday', 'evening', or 'campfire'
 * @returns {string|null} Flavor text string, or null if not available
 */
function getFlavorText(distanceTraveled, timeOfDay) {
  const leg = getLegInfo(distanceTraveled);
  if (!leg || !leg.flavorText) return null;
  return leg.flavorText[timeOfDay] || null;
}

/**
 * Check if the party has entered a new leg since the previous distance.
 * @param {number} currentDistance
 * @param {number} previousDistance
 * @returns {boolean} True if a new leg was entered
 */
function hasEnteredNewLeg(currentDistance, previousDistance) {
  return getLegForDistance(currentDistance) !== getLegForDistance(previousDistance);
}

/**
 * Get a human-readable leg label (e.g., "Leg 3/12: Fort Kearney → Nebraska Plains").
 * @param {number} distanceTraveled
 * @returns {string} Formatted leg label
 */
function getLegLabel(distanceTraveled) {
  const leg = getLegInfo(distanceTraveled);
  const legIndex = getLegForDistance(distanceTraveled);
  if (!leg) return 'Unknown Leg';
  return `Leg ${legIndex + 1}/12: ${leg.start} → ${leg.end}`;
}

/**
 * Get the arrival message for entering a new leg.
 * @param {number} legIndex - The leg that was just entered
 * @returns {string} Arrival message
 */
function getArrivalMessage(legIndex) {
  if (legIndex < 0 || legIndex >= ALL_REGION_DATA.length) return '';
  const leg = ALL_REGION_DATA[legIndex];
  return `Arrived at ${leg.end}`;
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export {
  ALL_REGION_DATA,
  LEG_THRESHOLDS,
  TOTAL_DISTANCE,
  getRegionName,
  getRegionDataForLeg,
  getLegForDistance,
  getLegInfo,
  getFlavorText,
  hasEnteredNewLeg,
  getLegLabel,
  getArrivalMessage
};
