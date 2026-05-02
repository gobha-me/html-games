// Per-faction AI behavior dispatch (Phase 3 S2).
//
// Every AI scoring path used to read `PERSONALITIES[faction.personality]`
// directly. That meant five named templates and no way for one faction to
// diverge from another that shared the same template — Iron Legion couldn't
// telegraph war earlier than the militaristic baseline, Aetheric Order
// couldn't max science differently than the scientific scalars allow.
//
// `resolveBehavior(faction)` returns the merged scalars: the personality
// template overlaid with `faction.behavior`'s scalar overrides (if any).
// Default factions ship without `behavior` set, so the resolver returns the
// same `PersonalityDef` PERSONALITIES held — behavior byte-identical to
// pre-S2.
//
// Hook overrides (`pickTech`, `pickBuild`, `unitPriority`) are opt-in
// short-circuits: a faction can plug in custom selection logic that runs
// *instead of* the default scoring. Returning `null` from a hook means
// "defer to default" — the AI module's scoring loop runs as usual. This
// keeps the call-site shape simple (a one-line guard) and preserves the
// existing default code path untouched for factions without overrides.
//
// Decision-log item 11 in core/state.ts codifies the carry-forward: don't
// add direct `PERSONALITIES[...]` reads in new AI code — go through the
// resolver so S5 / S7 per-faction overrides take effect.

import type { Rng } from '../core/rng';
import type { BuildQueue, City, Faction, TechId, Unit } from '../core/types';
import { PERSONALITIES, type PersonalityDef } from '../data/personalities';

export interface AIBehavior extends Partial<PersonalityDef> {
  /** Override the tech pick for this faction. Return null to defer to the
   * default scoring in aiPickTech. */
  pickTech?: (faction: Faction, rng: Rng) => TechId | null;
  /** Override the city build pick. Return null to defer to aiPickBuild. */
  pickBuild?: (faction: Faction, city: City, rng: Rng) => BuildQueue | null;
  /** Override the unit-processing priority for sort-order in aiPlayTurn.
   * Lower numbers run first. Return null to defer to aiUnitPriority. */
  unitPriority?: (faction: Faction, unit: Unit) => number | null;
}

/** Resolve the effective `PersonalityDef` for a faction. Falls back to the
 * static PERSONALITIES table when no per-faction override is present;
 * otherwise overlays `faction.behavior`'s scalar fields on top. Hook fields
 * on AIBehavior are not part of PersonalityDef and are filtered by the
 * spread (TS type guarantees only Partial<PersonalityDef> keys merge in). */
export function resolveBehavior(faction: Faction): PersonalityDef {
  const base = PERSONALITIES[faction.personality];
  if (!faction.behavior) return base;
  // Spread only the scalar fields. Hooks (pickTech etc.) live alongside the
  // scalars on AIBehavior but aren't keys of PersonalityDef, so the resulting
  // shape stays a clean PersonalityDef.
  return { ...base, ...stripHooks(faction.behavior) };
}

function stripHooks(b: AIBehavior): Partial<PersonalityDef> {
  const { pickTech: _pt, pickBuild: _pb, unitPriority: _up, ...scalars } = b;
  return scalars;
}

/** Returns the hook's tech pick, or null when no override is configured or
 * the hook itself returns null (meaning "defer to default"). */
export function pickTechOverride(faction: Faction, rng: Rng): TechId | null {
  return faction.behavior?.pickTech?.(faction, rng) ?? null;
}

export function pickBuildOverride(
  faction: Faction,
  city: City,
  rng: Rng
): BuildQueue | null {
  return faction.behavior?.pickBuild?.(faction, city, rng) ?? null;
}

export function unitPriorityOverride(faction: Faction, unit: Unit): number | null {
  return faction.behavior?.unitPriority?.(faction, unit) ?? null;
}
