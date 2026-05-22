// Late Edition — arc framework + authored arc content (ICD-10 v0.1.1).
// Pure module. World imports `ARCS` (registry) plus the evaluator/finder
// helpers; ActiveArc represents one in-progress instance and serializes
// through ICD-04 v0.1.4 §SaveBlobV1.active_arcs[].
//
// 1.1.0 scope per AGENTS.md "Next: Tier-1.x content + adversarial maturation":
//   - Registry: ARCS = [THE_LONGSHOREMAN_STRIKE]. Other authored arcs
//     (Mayor's Mistress · Empty Vault · …) land at later 1.x sessions.
//   - Trigger predicate vocabulary: all eight ICD-10 v0.1 named kinds + the
//     two composers (all_of · any_of). The §Notes nested-NOT idiom is the
//     `negate: true` flag on a composer AST node (closes §Open-Q1 by
//     pinning the flag shape; the explicit `not` kind stays deferred).
//   - ActiveArc tracks {arcId, currentEpisode, chosenPath, spawnEdition};
//     `pickBranch` advances by label or returns the terminal outcomeId.
//   - One active instance per arc id (enforced by World, not here).

// THE_LONGSHOREMAN_STRIKE — first authored arc. Lifted from design-doc.html
// §18 lines 1382-1422 via ICD-10 v0.1 §Spec-validation. v0.1.1 update: the
// nested-NOT wrapper around district_uncovered carries `negate: true`
// explicitly (the idiom was implicit at v0.1 — see §Notes).
export const THE_LONGSHOREMAN_STRIKE = {
  id: 'longshoreman_strike',
  // 1.1.0 (ICD-10 v0.1.1 §Notes): optional `district` field constrains the
  // spawn to the named district. The world's arc dispatcher only fires arcs
  // whose district matches the current spawn cycle's district (or arcs with
  // no district constraint). Keeps Longshoreman geographically faithful even
  // when the 5% `arc` roll lands in Hillside (it doesn't fire there).
  district: 'docks',
  trigger: {
    kind: 'all_of',
    children: [
      { kind: 'district_heat_above', district: 'docks', threshold: 60 },
      // "player has 1+ Bureau in Docks" — ICD-10 v0.1.1 negate-flag idiom:
      // read as "Docks must NOT be uncovered" → "Docks must have a covering
      // Bureau." See §Notes — negate is a single-node flip flag on the AST.
      { kind: 'all_of', negate: true, children: [
        { kind: 'district_uncovered', district: 'docks' },
      ]},
      { kind: 'observer_silent_n_editions', n: 3 },
    ],
  },
  episodes: [
    { id: 'longshoreman_strike.walkout',
      headline: 'THE WALKOUT — Longshoremen halt the harbor',
      branch_table: { choices: [
        { label: 'bury',   next: 'terminal', outcome: 'bury_outcome' },
        { label: 'splash', next: 'longshoreman_strike.foremans_wife' },
      ]},
    },
    { id: 'longshoreman_strike.foremans_wife',
      headline: "THE FOREMAN'S WIFE — A personal angle",
      branch_table: { choices: [
        { label: 'humanize',       next: 'longshoreman_strike.company_man' },
        { label: 'vilify',         next: 'longshoreman_strike.company_man' },
        { label: 'kill the story', next: 'terminal', outcome: 'kill_outcome' },
      ]},
    },
    { id: 'longshoreman_strike.company_man',
      headline: 'THE COMPANY MAN — The planted source',
      branch_table: { choices: [
        { label: 'print his version',   next: 'longshoreman_strike.deal' },
        { label: 'counter-investigate', next: 'longshoreman_strike.deal' },
        { label: 'blackmail him',       next: 'longshoreman_strike.deal' },
      ]},
    },
    { id: 'longshoreman_strike.deal',
      headline: 'THE DEAL — The strike ends',
      branch_table: { choices: [
        { label: 'celebrate labor', next: 'terminal', outcome: 'labor_outcome' },
        { label: 'bury labor',      next: 'terminal', outcome: 'corp_outcome' },
      ]},
    },
  ],
  outcomes: [
    { id: 'bury_outcome',  district_disposition: { district: 'docks', value: 'grudging'        }, cash_one_time:  300 },
    { id: 'kill_outcome',  district_disposition: { district: 'docks', value: 'bitter'          },                       heat_one_time: -10 },
    { id: 'labor_outcome', district_disposition: { district: 'docks', value: 'loyal'           }, cash_one_time: 2000, heat_one_time: +20 },
    { id: 'corp_outcome',  district_disposition: { district: 'docks', value: 'open hostility' }, cash_one_time: 3500, heat_one_time: +35 },
  ],
};

export const ARCS = [THE_LONGSHOREMAN_STRIKE];

// Pure trigger evaluator (ICD-10 v0.1 §Trigger predicate vocabulary).
// Takes a predicate AST + context; returns boolean. The context is supplied
// by the caller (World builds it once per spawn-cycle tick) so the evaluator
// can be unit-tested without a live World.
//
// Context shape:
//   {
//     heat:                  number,                  // world.resources.heat
//     edition:               number,                  // world.cycle.edition
//     districtHeat:          { [id]: number },        // per-district accumulators
//     coveredDistricts:      Set<DistrictId>,         // districts with a live bureau-family
//     observerRecentStates:  string[],                // last N Observer states (ring)
//     rivalStates:           { [id]: string },        // current state per rival
//   }
//
// `negate: true` on any node flips the result (ICD-10 v0.1.1 §Notes —
// nested-NOT idiom; an explicit `not` kind stays deferred per §Open-Q1).
export function evalTrigger(predicate, ctx) {
  const raw = evalPredicate(predicate, ctx);
  return predicate.negate ? !raw : raw;
}

function evalPredicate(p, ctx) {
  switch (p.kind) {
    case 'heat_above':
      return (ctx.heat ?? 0) > p.threshold;
    case 'district_heat_above':
      return (ctx.districtHeat?.[p.district] ?? 0) > p.threshold;
    case 'district_uncovered':
      return !(ctx.coveredDistricts?.has?.(p.district) ?? false);
    case 'observer_silent_n_editions': {
      const recent = ctx.observerRecentStates ?? [];
      if (recent.length < p.n) return false;
      const tail = recent.slice(-p.n);
      // ICD-10 v0.1's "SILENCED or PASS" wording is sloppy (PASS is an intent
      // kind, not a state name). Implemented as "not loud" — Observer's loud
      // states are PUBLISH (PUBLISH_COUNTER) and WARN (POISON_LEAD); every
      // other state (INVESTIGATE / DESPERATE / SILENCED) reads as silent.
      // v0.1.1 §Notes pins this interpretation.
      return tail.every((s) => s !== 'PUBLISH' && s !== 'WARN');
    }
    case 'rival_state':
      return ctx.rivalStates?.[p.rival] === p.state;
    case 'edition_at_least':
      return (ctx.edition ?? 0) >= p.edition;
    case 'all_of':
      return (p.children ?? []).every((c) => evalTrigger(c, ctx));
    case 'any_of':
      return (p.children ?? []).some((c) => evalTrigger(c, ctx));
    default:
      return false;
  }
}

export function findArc(arcId) {
  return ARCS.find((a) => a.id === arcId) ?? null;
}

export function findArcEpisode(arcId, episodeId) {
  const arc = findArc(arcId);
  if (!arc) return null;
  return arc.episodes.find((e) => e.id === episodeId) ?? null;
}

export function findArcOutcome(arcId, outcomeId) {
  const arc = findArc(arcId);
  if (!arc) return null;
  return arc.outcomes.find((o) => o.id === outcomeId) ?? null;
}

// ActiveArc — one in-progress arc instance. Snap/restore via ICD-04 v0.1.4
// §SaveBlobV1.active_arcs[]. World keeps an `activeArcs: ActiveArc[]` and
// enforces one-instance-per-arc-id at dispatch time.
export class ActiveArc {
  constructor({ arcId, currentEpisode, chosenPath = [], spawnEdition }) {
    this.arcId = arcId;
    this.currentEpisode = currentEpisode;
    this.chosenPath = chosenPath.slice();
    this.spawnEdition = spawnEdition;
  }

  static fromSnap(snap) {
    return new ActiveArc({
      arcId:          snap.arc_id,
      currentEpisode: snap.current_episode,
      chosenPath:     snap.chosen_path ?? [],
      spawnEdition:   snap.spawn_edition,
    });
  }

  snap() {
    return {
      arc_id:          this.arcId,
      current_episode: this.currentEpisode,
      chosen_path:     this.chosenPath.slice(),
      spawn_edition:   this.spawnEdition,
    };
  }

  // Apply a branch choice by label. Returns one of:
  //   { ok: true,  kind: 'advance' }                       — currentEpisode moved.
  //   { ok: true,  kind: 'terminal', outcomeId: string? }  — arc ended; caller
  //     looks up the outcome record and applies effects.
  //   { ok: false, reason: string }                        — unknown episode /
  //     unknown label; no mutation.
  pickBranch(label) {
    const episode = findArcEpisode(this.arcId, this.currentEpisode);
    if (!episode) return { ok: false, reason: 'no_episode' };
    const choice = episode.branch_table.choices.find((c) => c.label === label);
    if (!choice) return { ok: false, reason: 'invalid_choice' };
    this.chosenPath.push(label);
    if (choice.next === 'terminal') {
      return { ok: true, kind: 'terminal', outcomeId: choice.outcome ?? null };
    }
    this.currentEpisode = choice.next;
    return { ok: true, kind: 'advance' };
  }
}
