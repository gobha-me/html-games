// AI diplomacy. Each turn:
//   - Convert 'unmet' → 'peace' on first sighting (a faction's city visible
//     to the other side).
//   - Score each known relationship and probabilistically transition
//     peace ↔ war based on grudges, military ratio, personality aggression,
//     and a cooldown after the last declaration.
//   - Decay grudges by 1 per turn.
//
// aiTelegraph() emits a flavor-text warning to the player when the AI is
// massing military units near them. Both call Math.random() for thresholds;
// kept that way for Phase 1 (preserves prototype behavior).

import { hexDistance } from '../core/hex';
import { log } from '../core/log';
import { G, getCityAt } from '../core/state';
import type { Faction } from '../core/types';
import { UNIT_TYPES } from '../data/units';
import { PERSONALITIES, AI_THINKING_LINES } from '../data/personalities';
import { aiFactionMilitaryStrength } from './strategy';

const WAR_DECLARATION_COOLDOWN_TURNS = 8;
const WAR_DECLARATION_COOLDOWN_PENALTY = 50;
const WAR_THRESHOLD = 60;
const WAR_TRIGGER_CHANCE = 0.25;
const PEACE_THRESHOLD = 35;
const PEACE_TRIGGER_CHANCE = 0.2;
const PEACE_GRUDGE_FORGIVENESS = 50;
const TELEGRAPH_NEARBY_RADIUS = 5;
const TELEGRAPH_REQUIRED_NEARBY = 2;
const TELEGRAPH_CHANCE = 0.4;
const TELEGRAPH_MIN_ATK = 4;

export function aiDiplomacy(faction: Faction): void {
  const mem = G.aiMemory[faction.idx];
  if (!mem || !G.map) return;
  const p = PERSONALITIES[faction.personality];
  const myStr = aiFactionMilitaryStrength(faction.idx);

  for (const other of G.factions) {
    if (!other.alive || other.idx === faction.idx) continue;
    const cur = faction.diplo[other.idx] || 'unmet';
    if (cur === 'unmet') {
      const sawMe = [...G.map.tiles.values()].some((t) => {
        if (!t.cityId) return false;
        const c = getCityAt(t.q, t.r);
        return c?.factionIdx === faction.idx && t.visibility[other.idx] === 'visible';
      });
      if (sawMe) {
        faction.diplo[other.idx] = 'peace';
        other.diplo[faction.idx] = 'peace';
        log(
          `${faction.name} has met ${other.name}.`,
          'diplo',
          faction.idx === G.playerFactionIdx || other.idx === G.playerFactionIdx
        );
      }
      continue;
    }
    const grudge = mem.grudges[other.idx] || 0;
    const otherStr = aiFactionMilitaryStrength(other.idx);
    const ratio = myStr / Math.max(1, otherStr);
    if (cur === 'peace') {
      let warScore = grudge * 0.5 + p.agg * 30 + (ratio - 1) * 50;
      if (G.turn - mem.lastDeclareWarTurn < WAR_DECLARATION_COOLDOWN_TURNS) {
        warScore -= WAR_DECLARATION_COOLDOWN_PENALTY;
      }
      if (warScore > WAR_THRESHOLD && Math.random() < WAR_TRIGGER_CHANCE) {
        faction.diplo[other.idx] = 'war';
        other.diplo[faction.idx] = 'war';
        mem.lastDeclareWarTurn = G.turn;
        log(`${faction.name} declares war on ${other.name}!`, 'warning', true);
      }
    } else if (cur === 'war') {
      const peaceScore = (1 - ratio) * 40 + (1 - p.agg) * 20 - grudge * 0.3;
      if (peaceScore > PEACE_THRESHOLD && Math.random() < PEACE_TRIGGER_CHANCE) {
        faction.diplo[other.idx] = 'peace';
        other.diplo[faction.idx] = 'peace';
        mem.grudges[other.idx] = Math.max(0, (mem.grudges[other.idx] || 0) - PEACE_GRUDGE_FORGIVENESS);
        log(`${faction.name} sues for peace with ${other.name}.`, 'diplo', true);
      }
    }
  }
  for (const k of Object.keys(mem.grudges)) {
    const idx = Number(k);
    mem.grudges[idx] = Math.max(0, (mem.grudges[idx] || 0) - 1);
  }
}

export function aiTelegraph(faction: Faction): void {
  if (faction.idx === G.playerFactionIdx) return;
  const player = G.factions[G.playerFactionIdx];
  if (!player.alive) return;
  if (faction.diplo[G.playerFactionIdx] !== 'war') return;

  const playerSighted: { q: number; r: number }[] = G.units
    .filter((u) => u.factionIdx === G.playerFactionIdx)
    .map((u) => ({ q: u.q, r: u.r }));
  for (const c of G.cities) {
    if (c.factionIdx === G.playerFactionIdx) playerSighted.push({ q: c.q, r: c.r });
  }
  const aiMil = G.units.filter(
    (u) => u.factionIdx === faction.idx && UNIT_TYPES[u.typeId].atk >= TELEGRAPH_MIN_ATK
  );
  let nearbyCount = 0;
  for (const m of aiMil) {
    for (const ps of playerSighted) {
      if (hexDistance(m, ps) <= TELEGRAPH_NEARBY_RADIUS) {
        nearbyCount++;
        break;
      }
    }
  }
  if (nearbyCount >= TELEGRAPH_REQUIRED_NEARBY && Math.random() < TELEGRAPH_CHANCE) {
    const lines = AI_THINKING_LINES[faction.personality];
    const line = lines[Math.floor(Math.random() * lines.length)];
    log(
      `${faction.name} ${line.replace('...', '')} — ${nearbyCount} hostile companies near your borders.`,
      'warning',
      true
    );
  }
}
