// Phase 3 S10 — Endgame derivation helpers. Pure functions that turn the
// live G snapshot and the in-memory telemetry / replay logs into the
// structured rows the game-over modal and the replay highlight strip
// render. No new persistent state, no SAVE_VERSION change — everything
// here is derived at view time.
//
// Score breakdown decomposes computeFactionScore (turn.ts) into three
// buckets that sum back to the same total (rounded), so a player can
// trace the leaderboard ranking down to the line items without the
// numbers drifting from the scorecard.

import { G } from '../core/state';
import type { Faction, FactionIdx } from '../core/types';
import type { TelemetryEvent } from './telemetry';
import type { ReplayDump } from './replay';

// Mirror of the per-component weights in turn.ts:computeFactionScore.
// Kept in sync by the breakdown unit test (sums-to-total assertion).
const SCORE_PER_CITY_BASE = 10;
const SCORE_PER_POP = 4;
const SCORE_PER_UNIT = 3;
const SCORE_PER_TECH = 8;
const SCORE_GOLD_WEIGHT = 0.05;
const SCORE_AETHER_WEIGHT = 0.1;

export interface ScoreBreakdown {
  /** Coin + aether contribution (gold * 0.05 + aether * 0.1). */
  resources: number;
  /** Cities (10 each + pop * 4) + units (3 each). The territorial / military
   *  half of the score; labelled "Banners & Engines" in the modal. */
  dominion: number;
  /** Techs known × 8. */
  lore: number;
  /** Sum of the three rows. Equals turn.ts computeFactionScore for the
   *  same faction up to rounding. */
  total: number;
}

export function computeScoreBreakdown(faction: Faction): ScoreBreakdown {
  const cityScore = G.cities
    .filter((c) => c.factionIdx === faction.idx)
    .reduce((acc, c) => acc + SCORE_PER_CITY_BASE + c.population * SCORE_PER_POP, 0);
  const unitScore = G.units.filter((u) => u.factionIdx === faction.idx).length * SCORE_PER_UNIT;
  const dominion = cityScore + unitScore;
  const lore = faction.techs.size * SCORE_PER_TECH;
  const resources =
    faction.resources.gold * SCORE_GOLD_WEIGHT + faction.resources.aether * SCORE_AETHER_WEIGHT;
  return {
    resources: Math.round(resources),
    dominion: Math.round(dominion),
    lore: Math.round(lore),
    total: Math.round(resources + dominion + lore),
  };
}

export interface RetroStats {
  /** G.turn at game-over. */
  turnsPlayed: number;
  /** G.cities owned by the faction at game-over. */
  citiesHeld: number;
  /** G.units owned by the faction at game-over. */
  unitsAfield: number;
  /** faction.techs.size at game-over. */
  techsMastered: number;
  /** Combat events where this faction was attacker or defender. */
  battlesJoined: number;
  /** Sum of dmg dealt as attacker. */
  blowsStruck: number;
  /** Sum of dmg taken as defender. */
  blowsBorne: number;
}

export function computeRetroStats(
  faction: Faction,
  log: readonly TelemetryEvent[]
): RetroStats {
  let battlesJoined = 0;
  let blowsStruck = 0;
  let blowsBorne = 0;
  for (const ev of log) {
    if (ev.kind !== 'combat') continue;
    if (ev.attacker === faction.idx) {
      battlesJoined++;
      blowsStruck += ev.dmg;
    } else if (ev.defender === faction.idx) {
      battlesJoined++;
      blowsBorne += ev.dmg;
    }
  }
  return {
    turnsPlayed: G.turn,
    citiesHeld: G.cities.filter((c) => c.factionIdx === faction.idx).length,
    unitsAfield: G.units.filter((u) => u.factionIdx === faction.idx).length,
    techsMastered: faction.techs.size,
    battlesJoined,
    blowsStruck,
    blowsBorne,
  };
}

export type HighlightKind = 'firstCity' | 'firstWar' | 'firstTech' | 'victory';

export interface Highlight {
  /** The turn snapshot index that the replay slider should jump to. */
  snapshotIdx: number;
  /** The snapshot.turn value at that index — used for the button label. */
  turn: number;
  kind: HighlightKind;
  /** Optional faction context — undefined for events that are not faction-
   *  specific (e.g. victory uses the winning faction; first war flags the
   *  first declarer). */
  factionIdx?: FactionIdx;
  /** Short literary-register label rendered on the highlight button. */
  label: string;
}

/** Scan a replay's turn snapshots and surface the first occurrence of each
 *  highlight kind for the player faction (plus a global victory marker).
 *  Returns an empty array when the replay is empty or no transitions are
 *  detected. Bounded by `MAX_REPLAY_TURNS = 200` per the replay log cap —
 *  in a longer game the early-turn first-of-kind may be off the front of
 *  the rolling window, which is fine (highlights are best-effort markers,
 *  not authoritative). */
export function findReplayHighlights(replay: ReplayDump): Highlight[] {
  if (replay.turns.length === 0) return [];
  // Anchor on the player faction recorded in the dump. The replay header
  // pins this at record time; if the snapshot doesn't carry the name we
  // fall back to playerFactionIdx of the first snapshot.
  const firstSnap = replay.turns[0];
  const playerIdx = firstSnap.playerFactionIdx;
  const initialTechs = firstSnap.factions[playerIdx]?.techs.length ?? 0;

  let firstCityIdx: number | null = null;
  let firstWarIdx: number | null = null;
  let firstWarFaction: FactionIdx | undefined = undefined;
  let firstTechIdx: number | null = null;
  let victoryIdx: number | null = null;
  let victoryFaction: FactionIdx | undefined = undefined;

  for (let i = 0; i < replay.turns.length; i++) {
    const snap = replay.turns[i];

    if (firstCityIdx === null && snap.cities.some((c) => c.factionIdx === playerIdx)) {
      firstCityIdx = i;
    }

    if (firstWarIdx === null) {
      for (const f of snap.factions) {
        for (const statusRaw of Object.values(f.diplo)) {
          if (statusRaw === 'war') {
            firstWarIdx = i;
            firstWarFaction = f.idx;
            break;
          }
        }
        if (firstWarIdx !== null) break;
      }
    }

    if (firstTechIdx === null) {
      const fac = snap.factions[playerIdx];
      if (fac && fac.techs.length > initialTechs) firstTechIdx = i;
    }

    if (victoryIdx === null && snap.gameOver) {
      victoryIdx = i;
      // The victor isn't directly serialized, but at gameOver only the
      // surviving faction(s) remain `alive`. Pick the highest-score alive
      // faction as the victor; falls back to undefined if ambiguous.
      const alive = snap.factions.filter((f) => f.alive);
      if (alive.length > 0) {
        const winner = alive.reduce((best, f) => (f.score > best.score ? f : best), alive[0]);
        victoryFaction = winner.idx;
      }
    }
  }

  const out: Highlight[] = [];
  if (firstCityIdx !== null) {
    out.push({
      snapshotIdx: firstCityIdx,
      turn: replay.turns[firstCityIdx].turn,
      kind: 'firstCity',
      factionIdx: playerIdx,
      label: `First Hearth — turn ${replay.turns[firstCityIdx].turn}`,
    });
  }
  if (firstWarIdx !== null) {
    out.push({
      snapshotIdx: firstWarIdx,
      turn: replay.turns[firstWarIdx].turn,
      kind: 'firstWar',
      factionIdx: firstWarFaction,
      label: `First Drum — turn ${replay.turns[firstWarIdx].turn}`,
    });
  }
  if (firstTechIdx !== null) {
    out.push({
      snapshotIdx: firstTechIdx,
      turn: replay.turns[firstTechIdx].turn,
      kind: 'firstTech',
      factionIdx: playerIdx,
      label: `First Lore — turn ${replay.turns[firstTechIdx].turn}`,
    });
  }
  if (victoryIdx !== null) {
    out.push({
      snapshotIdx: victoryIdx,
      turn: replay.turns[victoryIdx].turn,
      kind: 'victory',
      factionIdx: victoryFaction,
      label: `The Banner Settles — turn ${replay.turns[victoryIdx].turn}`,
    });
  }
  return out;
}
