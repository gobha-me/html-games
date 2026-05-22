// Late Edition — lead-spawn engine (Design Doc §19 line 1436 + §16).
// Pure module. World owns one instance; ticks it post-rival-tick and merges
// the returned `spawns` into this.stories and applies the returned
// `expiredIds` to prune dead leads. Replaces the 0.3 hard-coded single-lead
// spawn — until 0.10.0 the world spawned one lead at construction and never
// spawned another (audit C-04, the "loop reads as a game" critical).
//
// Rate (§19 line 1436):
//   - 1 lead per ~90s per district covered by its bureau (Tip Line ×1.5
//     boost is Tier-1; not in 0.10.0)
//   - ×0.5 per district with no covering bureau ("rumors only")
//
// Tier roll (§19): 70% Whisper / 25% Investigation / 5% Arc. 1.1.0 retires
// the Tier-0 placeholder collapse — `tier === 'arc'` now flows through to
// the World, which consults the ICD-10 arc registry and either fires an
// authored arc (if any arc's trigger predicate + district constraint matches)
// or downgrades to investigation as the no-arc fallback.
//
// Decay (§19 line 887): leads expire 180s after spawned_at_ms if not picked
// up. The spawner returns expired ids; World prunes from this.stories.
//
// Determinism: spawner draws from a SeededRng instance owned by World.
// Save round-trip preserves the rng state so post-load decisions match a
// hypothetical no-save replay (ICD-04 §Notes determinism, the "first
// plausible caller" the rng_seed slot was reserved for).

import { DISTRICTS, getDistrict, pickSpawnTile, pickWeighted } from './districts.js';
import { synthesizeHeadline } from './headlines.js';

// §19 line 1436. ~90s mean → 90000 ms expected interval between spawns in
// a fully-covered district. Stored as ms so the Poisson-process gate works
// at the dt scale the World runs on.
export const SPAWN_INTERVAL_MS = 90_000;
// §19 — the "rumors only" rate for an uncovered district.
export const UNCOVERED_RATE_MULT = 0.5;
// §19 line 887. Lead state expires 180s after spawn if not picked up.
export const LEAD_DECAY_MS = 180_000;

// §19 line 1372 (slot grammar header). 70 / 25 / 5 — Arc gets remapped to
// Investigation at Tier-0 (see header comment).
export const TIER_WEIGHTS = { whisper: 70, investigation: 25, arc: 5 };

export class LeadSpawner {
  constructor(opts = {}) {
    // Accumulator per district. Crossings of SPAWN_INTERVAL_MS / rateMult
    // trigger a spawn. Persisted-on-save shape: { [districtId]: number }.
    this._accumByDistrict = {};
    for (const d of DISTRICTS) this._accumByDistrict[d.id] = 0;
    // Restore-path: a save blob carries the per-district accumulators so a
    // post-load run doesn't lose its place in the spawn cadence.
    if (opts.snap) {
      for (const id of Object.keys(opts.snap.accum_by_district ?? {})) {
        this._accumByDistrict[id] = opts.snap.accum_by_district[id];
      }
    }
  }

  // Called by World.tick. Returns:
  //   { spawns: PartialStory[], expiredIds: StoryId[] }
  // The PartialStory shape carries enough for World to mint an id and push
  // it into this.stories (spawner stays free of id-mint concerns).
  tick(dtMs, ctx) {
    const spawns = [];
    for (const district of DISTRICTS) {
      const rateMult = this._coverageMult(district, ctx);
      if (rateMult <= 0) continue;
      const effectiveInterval = SPAWN_INTERVAL_MS / rateMult;
      this._accumByDistrict[district.id] += dtMs;
      while (this._accumByDistrict[district.id] >= effectiveInterval) {
        this._accumByDistrict[district.id] -= effectiveInterval;
        const story = this._rollSpawn(district, ctx);
        if (story) spawns.push(story);
      }
    }
    const expiredIds = this._collectExpired(ctx);
    return { spawns, expiredIds };
  }

  // Convenience for tests + the run-summary panel: force the next spawn for
  // a district to land on the next tick by saturating its accumulator. Not
  // used in production paths.
  forceSpawnNext(districtId) {
    this._accumByDistrict[districtId] = SPAWN_INTERVAL_MS * 1000;
  }

  // ICD-04 §Notes — spawner state snapshot. World.save threads this through.
  snap() {
    return { accum_by_district: { ...this._accumByDistrict } };
  }

  _coverageMult(district, ctx) {
    const covered = ctx.buildings.some(
      (b) => b.kind === district.coveredByKind && (b.hp === undefined || b.hp > 0),
    );
    return covered ? 1.0 : UNCOVERED_RATE_MULT;
  }

  _rollSpawn(district, ctx) {
    const tile = pickSpawnTile(district, ctx, ctx.rng);
    if (!tile) return null;
    // 1.1.0 (ICD-10 v0.1.1): tier='arc' flows through to the World; the
    // dispatch in _runSpawnerTick decides whether to upgrade to an authored
    // arc instance or downgrade to investigation (no-arc fallback).
    const tier = pickWeighted(TIER_WEIGHTS, ctx.rng);
    const flavor = pickWeighted(district.flavorWeights, ctx.rng);
    const story = {
      state: 'lead',
      district: district.id,
      flavor,
      tier,
      truthful: true,
      spawned_at_ms: ctx.simTimeMs,
      tile,
      picked_up_by: null,
      held_by_building: null,
    };
    // Headline lives on the Story so the digest projection is deterministic
    // across save round-trips (audit G-05). Spawner owns generation because
    // it owns the rng stream tied to ICD-04 §Notes determinism.
    story.headline = synthesizeHeadline(story, ctx.rng);
    return story;
  }

  _collectExpired(ctx) {
    const expired = [];
    for (const s of ctx.stories) {
      if (s.state !== 'lead') continue;
      if (s.picked_up_by || s.held_by_building) continue;
      const age = ctx.simTimeMs - s.spawned_at_ms;
      if (age >= LEAD_DECAY_MS) expired.push(s.id);
    }
    return expired;
  }
}

// Convenience constructor for the snap restore path so save.js doesn't
// hand-roll the opts shape.
LeadSpawner.fromSnap = (snap) => new LeadSpawner({ snap });
