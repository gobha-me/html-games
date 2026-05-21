// Late Edition — resource yields + edition-boundary constants (Design Doc §06 + §19).
// Pure module. World imports the helpers and applies them at the verified→plated
// step (per-story yields) and across ackDebrief (heat decay).
//
// First-pass numbers are medium-band per architecture/00-overview.md §"First-pass
// balancing numbers" — single representative per dimension, no district modifier,
// no lie/front-page multipliers. Those land at 0.7+ when districts and rival AI
// (ICD-02) materialize.

export const STARTING_INK = 20;             // §19 "$200 per 20 units" Docks purchase scale → first-edition runway
export const HEAT_DECAY_PER_EDITION  = 8;   // §19 baseline — applied when at least one controversial story plated this edition
export const HEAT_DECAY_QUIET_EDITION = 12; // §19 bonus — applied when summary.heat_applied === 0 ("no controversial stories" — D-04)
export const HEAT_DECAY_STALL_THRESHOLD = 80; // §19 — at heat > 80 pre-decay, decay stalls to 0 ("the room won't cool" beat)

// Midpoints of §19 ranges. Whisper $80–250 → 165; Investigation $400–1200 → 800;
// Arc $2000+ → 2000 (floor, not a range — §19 lists it open-ended).
export const CASH_BY_TIER = { whisper: 165, investigation: 800, arc: 2000 };

// §19 verbatim — already deterministic per tier.
export const INK_BY_TIER = { whisper: 1, investigation: 3, arc: 8 };

// Midpoints of §19 ranges. Vice 4–12 → 8; Violence 6–18 → 12; Money 8–22 → 15.
// Labor has no §19 entry — assigned 4 (gentlest of the four) as a sane default
// until §19 expands. Story Engine (§18) will eventually own this; today the
// flavors come from LeadView (ICD-01 v0.5 §LeadView).
export const HEAT_BY_FLAVOR = { vice: 8, violence: 12, money: 15, labor: 4 };

export function cashYieldFor(story) {
  return CASH_BY_TIER[story.tier] ?? 0;
}

export function inkCostFor(story) {
  return INK_BY_TIER[story.tier] ?? 0;
}

export function heatYieldFor(story) {
  return HEAT_BY_FLAVOR[story.flavor] ?? 0;
}
