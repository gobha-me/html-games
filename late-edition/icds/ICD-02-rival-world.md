# ICD-02 · Rival ↔ World

**Status:** v0.2.2 (in-PR §Notes addition at 0.9.3 — `RivalEventDigest.kind` vocabulary enumeration to cover `raid_succeeded` + `raid_wiped` emissions)
**Band:** strong
**First caller:** milestone 0.7 (Evening Star SCAVENGE + RAID states)
**Source:** [`../design/phase-0-roadmap.html`](../design/phase-0-roadmap.html) §03 ·
[`../design/rival-ai-spec.html`](../design/rival-ai-spec.html) §02 + §04 + §08

## Purpose

The `tick(world, dt) → Intent[]` contract that each rival paper implements. The
world hands each rival a read-only snapshot (`RivalView`); the rival returns
intents that the world applies (or rejects) under its own rules. Rivals never
mutate the world directly — they emit intents and the world's reconciler
applies them in deterministic order at end-of-tick (rival-ai-spec §02).

## Per-tick contract

```ts
type Intent =
  | { kind: 'FILE_STORY',     district: DistrictId, tier: Tier, source: SourceId }
  | { kind: 'RAID_BUREAU',    goons: number, eta_ms: number }
  | { kind: 'BRIBE_REPORTER', reporterId: ReporterId }
  | { kind: 'POISON_LEAD',    leadId: LeadId }
  | { kind: 'SCOUT_DISTRICT', district: DistrictId }
  | { kind: 'OFFER_WIRE_DEAL', terms: WireTerms }
  | { kind: 'OFFER_BUYOUT',    amount: number }
  | { kind: 'PARTNER_REQUEST', district: DistrictId }
  | { kind: 'PASS' };

interface Rival {
  id:           RivalId;            // 'herald' | 'evening_star' | 'observer'
  tickInterval: number;             // ms between ticks (Evening Star: 20_000)
  tick(world: RivalView, dt_ms: number): Intent[];
}
```

`RivalView` is a read-only projection — rivals never mutate world state
directly. `PASS` is always available and costs nothing; two consecutive PASS
ticks make a rival "quiet" (the UI surfaces nothing from them — dead air is a
state, rival-ai-spec §02).

## `RivalView` projection (v0.2)

The read-only snapshot the world hands each rival on `tick`. Mirrors the
rival-ai-spec §02 sensor list and resolves the v0.1 §Open-questions item about
past-intent visibility.

```ts
interface RivalView {
  cycle: {
    edition:      number;     // current edition (matches CYCLE_BEGIN.edition; ICD-06 §Event vocabulary)
    remaining_ms: number;     // ms until DEADLINE_FIRE (ICD-06 §Cycle timing)
  };
  player: {
    heat_noisy:        number;          // player heat ± 20 (per-rival seeded RNG noise; §02 Sensors)
    visible_leads:     LeadDigest[];    // only leads in districts the rival has presence in
    visible_reporters: ReporterDigest[];// only reporters in districts the rival has presence in
  };
  own: {
    state:        RivalState;           // own current state (e.g. 'SCAVENGE' for Evening Star)
    posture:      RivalStatusView['posture']; // derived; see §RivalStatusView below
    past_intents: Intent[];             // last N=8 intents this rival emitted (resolution of v0.1 §Open Q; see §Notes)
  };
  edition_history: EditionDigest[];     // last 10 editions' public deltas (cash gained, raids attempted/succeeded)
}

interface LeadDigest      { id: LeadId;   district: DistrictId; tier: Tier; flavor: Flavor }
interface ReporterDigest  { id: ReporterId; district: DistrictId }
interface EditionDigest   { edition: number; player_cash_delta: number; raids_attempted: number; raids_succeeded: number }
```

- **Past-intents resolution (v0.1 §Open-questions closure).** Rivals **do**
  see their own past intents, bounded to the last 8 entries — enough for
  arc-aware behavior ("did I just RAID last edition? skip"), short enough that
  the projection stays bounded. 8 = one-edition's-worth of Evening Star ticks
  at 20s cadence (12 min / 20 s = 36 ticks, but most are SCAVENGE no-ops; 8
  is the working set the cooldown checks need). The rival's own
  `RingBuffer<Intent, 20>` (rival-ai-spec §08 pseudocode) is the storage; the
  projection exposes the most-recent 8.
- **Visibility filter.** A rival's `visible_leads` / `visible_reporters` are
  filtered to districts where the rival has presence — explicit per
  rival-ai-spec §02 ("visible player leads — only ones in districts where the
  rival has a Bureau"). The 0.7 slice runs with Evening Star presence-set =
  all-shared-with-player; the per-rival district map tightens at Tier-1.
- **Noisy heat.** `heat_noisy` is `world.heat + rng.range(-20, +20)` using the
  rival's seeded RNG (deterministic per seed; replay-safe). Rivals never see
  exact heat — bounded uncertainty is the design commitment (§02).

## `RivalStatusView` projection (v0.2, medium-band)

Player-facing posture summary, derived from rival state. Vocabulary locked at
the post-0.6 re-eval (§3.5 Q5):

```ts
interface RivalStatusView {
  rival:   RivalId;                                // 'herald' | 'evening_star' | 'observer'
  posture: 'calm' | 'scheming' | 'hostile';        // medium-band vocabulary (re-eval §3.5 Q5)
}
```

**Evening Star posture mapping** (the only mapping committed at v0.2 — Herald
and Observer mappings land when their rivals enter the N-window):

| State | Posture |
|---|---|
| SCAVENGE, RUSH, BURNOUT | `calm` |
| BRIBE | `scheming` |
| RAID, PANIC | `hostile` |

- **Where `RivalStatusView` lives.** Exposed on `RivalView.own.posture` (each
  rival sees its own posture). The **player-facing surface** — whether a
  `HudState.rival_status: RivalStatusView[]` field ships at milestone 0.7 (a
  posture pill) or waits for milestone 0.9's HUD corkboard to absorb it — is
  an open question (see §Open questions below). Either way, the projection
  shape is locked at v0.2; only the surface is open.
- **Medium-band rationale.** Posture vocabulary may shrink (`'scheming'`
  drops out if BRIBE plays as a one-shot effect rather than a sustained
  posture) or grow (a `'silent'` posture for BURNOUT if the corkboard wants
  it). The state→posture mapping is the load-bearing commitment, not the
  string set.

## Evening Star state machine (v0.2)

Lifted from [`../design/rival-ai-spec.html`](../design/rival-ai-spec.html)
§04 + §08 (immutable source; this prose is the committed mirror).

**Tick cadence:** `tickInterval = 20_000` ms (1 tick / 20 s, §04 stat grid).
**States** (6): `SCAVENGE | RAID | BRIBE | RUSH | PANIC | BURNOUT`.
**0.7 slice scope:** SCAVENGE + RAID + PASS are the only states whose bodies
the milestone-0.7 code session implements. BRIBE / RUSH / PANIC / BURNOUT are
shape-committed here (so the transition table closes) but their bodies are
**caller-triggered** — they ship when the unit/system they depend on lands
(BRIBE needs reporter morale; RUSH needs the Investigation-tier lead
classifier; PANIC/BURNOUT need the multi-edition raid counter).

### State definitions

| State | Definition |
|---|---|
| `SCAVENGE` | Default. Sends own (invisible-to-player) reporters to grab leads in districts shared with the player. The 0.7 slice models this as a `PASS` intent — no in-world effect until the rival-reporter shadow system lands. |
| `RAID` | Dispatches a goon team toward the player's Bureau. Goon count scales with heat (see §`RAID_BUREAU` below). Pathfinds from a district edge; visibility via Switchboard is a Tier-1 concern. Resolves win/loss on contact with the press. |
| `BRIBE` | Sends an envelope to a randomly-selected player reporter (caller-triggered — needs morale/nerve). |
| `RUSH` | Saw a visible Investigation-tier lead. Dispatches own reporters to scoop it (caller-triggered — needs the lead-tier classifier). |
| `PANIC` | 3 raids failed in a row. Doubles raid frequency for 2 editions (caller-triggered — needs `consecutiveFailedRaids`). |
| `BURNOUT` | Forced quiet: cannot RAID or BRIBE for 3 editions. Still files Whispers. Recovery state (caller-triggered). |

### Transition table

Lifted verbatim from rival-ai-spec §04. All transitions are guarded by the
predicates below; absent any firing predicate, the state self-loops (a
`SCAVENGE` tick that finds no transition emits its `PASS` intent and stays
`SCAVENGE`).

| From → To | Predicate | First milestone |
|---|---|---|
| `SCAVENGE → RAID` | `player_heat > 40` **AND** `editionsSinceRaid > 1` **AND** `rng.chance(0.18)` | 0.7 |
| `SCAVENGE → BRIBE` | `reporterCount > 3` **AND** `!bribedThisEdition` **AND** `rng.chance(0.08)` | Tier-1 (BRIBE body deferred) |
| `SCAVENGE → RUSH` | any visible Investigation-tier lead in a shared district | Tier-1 (RUSH body deferred) |
| `RAID → SCAVENGE` | goon team resolved (succeeded **or** wiped) | 0.7 |
| `RAID → PANIC` | 3 consecutive RAIDs wiped without damaging press | Tier-1 (PANIC body deferred) |
| `PANIC → BURNOUT` | 2 editions in PANIC complete | Tier-1 |
| `BURNOUT → SCAVENGE` | 3 editions in BURNOUT complete | Tier-1 |
| `BRIBE → SCAVENGE` | bribe resolved (turned or refused) | Tier-1 |
| `RUSH → SCAVENGE` | contested lead resolves | Tier-1 |

- **Determinism.** All `rng.chance(...)` calls flow through the rival's seeded
  RNG (rival-ai-spec §02 — "given the same world state and seed, a rival
  makes the same decisions"). Critical for replay, telemetry, bug repro, and
  the save-schema work at PRE-0.8.
- **Difficulty multiplier (deferred to Tier-1 run-meta layer per re-eval
  §3.5 Q4)** scales `tickInterval`, not transition predicates. Tier-0 ships
  at the single calibrated `tickInterval = 20_000` ms.

## `RAID_BUREAU` Intent shape detail (v0.2)

The only Intent kind whose body lands at milestone 0.7. Shape was committed
at v0.1; v0.2 pins the value rules.

```ts
{ kind: 'RAID_BUREAU', goons: number, eta_ms: number, target: BuildingId }
```

- **`goons`** — count per RAID, scaled by `player_heat` (rival-ai-spec §04
  state definitions):

  | `player_heat` band | `goons` |
  |---|---|
  | `[40, 60)` | 1 |
  | `[60, 80)` | 2 |
  | `≥ 80` | 3 |

  Below 40 the `SCAVENGE → RAID` predicate fails — RAID is not entered, so
  `goons = 0` is never emitted. The PANIC state doubles this count
  (rival-ai-spec §04 — "2× RAID FREQ"; PANIC body is Tier-1).

- **`eta_ms`** — milliseconds until the goon team reaches the target,
  resolved by the world's pathfinder against the dispatch district edge.
  Constraint at 0.7: `eta_ms ≤ cycle.remaining_ms` — the raid must resolve
  inside the current edition. The multi-edition transit case (a RAID that
  spans `DEADLINE_FIRE`) is **deferred to a 0.7 §Notes resolution** when the
  Fixer/Editor interplay surfaces it; until then the goon-dispatch site
  clamps `eta_ms` to `remaining_ms - 1000` (1 s of slack before deadline).

- **`target: BuildingId`** — at 0.7, always the Bureau. The
  `BuildingView.kind === 'bureau'` filter is the selection rule. Branch and
  Switchboard targets are fuzzy until Tier-1 (re-eval §3 PRE-0.7).

- **Cooldown.** `editionsSinceRaid > 1` — one full edition rest between
  RAIDs (rival-ai-spec §04 transition predicate). The Evening Star tracks
  this on its own state; the world checks it via the transition table, not
  via Intent rejection.

## Caller-triggered scope

The vertical slice only implements `RAID_BUREAU` and `PASS` for the Evening
Star. The **full Intent vocabulary is committed today** — the bodies fill in
as their callers arrive (methodology §Phase 2). No new Intent kinds may be
added without an ICD revision.

| Intent | First implementer | First milestone | v0.2 shape detail? |
|---|---|---|---|
| `PASS` | all rivals | 0.7 | n/a (shape is the kind) |
| `RAID_BUREAU` | Evening Star | 0.7 | **yes** — see §`RAID_BUREAU` |
| `FILE_STORY` | Herald | Tier-1 | caller-triggered |
| `BRIBE_REPORTER` | Evening Star (BRIBE state) | Tier-1 | caller-triggered |
| `SCOUT_DISTRICT` | Herald | Tier-1 | caller-triggered |
| `POISON_LEAD` | Observer | Tier-1 | caller-triggered |
| `OFFER_WIRE_DEAL` | Herald | Tier-1+ | caller-triggered (`WireTerms` TBD) |
| `OFFER_BUYOUT` | Herald | Tier-1+ | caller-triggered |
| `PARTNER_REQUEST` | Observer | Tier-1+ | caller-triggered |

## Notes

- **The 0.7 slice is two states + one Intent.** Evening Star runs SCAVENGE
  and RAID; the bodies emit `PASS` (SCAVENGE) and `RAID_BUREAU` (RAID-entry
  tick). Every other state in the §Evening Star state machine table is
  shape-committed for closure of the transition graph but its body is
  caller-triggered — the milestone that needs it lights it up.
- **Player-state inputs the state machine reads.** `player_heat` (noisy ±20
  via `RivalView.player.heat_noisy`), `reporterCount` (derived from
  `RivalView.player.visible_reporters.length` at the rival's visibility
  filter), `visibleInvestigationLead` (derived from
  `RivalView.player.visible_leads.filter(tier === 'investigation')[0]`).
  None of these reach back into sim — the rival sees only the projection.
- **Rival-internal state** (`editionsSinceRaid`, `bribedThisEdition`,
  `consecutiveFailedRaids`, `editionsInPanic`, `editionsInBurnout`) lives on
  the rival object, not on `RivalView`. The world doesn't read or mutate it;
  the rival manages it from its own intent history (`past_intents`) and
  from `EDITION_DEBRIEF_END` callbacks (subscribers per ICD-06 §Subscriber
  expectations).
- **`RivalEventDigest.kind` field on ICD-06 v0.2** stays string-typed at
  v0.2. ICD-06 v0.2 §EditionSummary explicitly leaves room for a future
  tightening to a union once ICD-02's Intent vocabulary is stable; the
  PRE-0.7 promotion *does* stabilize the vocabulary, but ICD-06's v0.2
  shape is intentionally permissive and a future ICD-06 bump can tighten
  it without churning ICD-02 again. No ICD-06 bump at PRE-0.7.
- **`RivalEventDigest.kind` vocabulary at v0.2.2 (Evening Star scope):**
  `raid_attempted` (emitted on RAID_BUREAU commit · v0.7.0), `raid_succeeded`
  (emitted on first damage tick of a raid window · v0.9.3, PR-A audit C-02),
  `raid_wiped` (emitted on last-goon prune with no damage dealt · v0.9.3,
  PR-A audit C-02). Vocabulary stays open-ended per ICD-06 v0.2 §EditionSummary;
  Herald + Observer kinds land at their first-caller milestones (Tier-1).
  Outcome-event delivery is best-effort across save boundaries — the
  raid-bookkeeping map is in-memory only (ICD-04 §Notes — cadence vs. raid
  lifetime), so a save+load mid-raid loses the outcome event but preserves
  the `raid_attempted` digest already flushed to the prior edition's summary.

## Open questions

- `WireTerms` shape — defer until first wire-deal milestone (Tier-1+).
- **Multi-edition goon transit — resolved at 0.7.0.** The v0.2
  §`RAID_BUREAU` clamp `eta_ms ≤ remaining_ms - 1000` is the permanent
  Tier-0 answer: one-edition raids only, no `DEADLINE_FIRE`-spanning
  goon teams. The 0.7.0 reconciler walks goons from `GOON_SPAWN_TILE` to
  a Bureau-adjacent tile inside the active edition; if a raid is still
  in flight at deadline, the goons keep walking through the debrief
  pause (the sim freezes) and resume after `EDITION_DEBRIEF_END`. Cross-
  edition raid mechanics are a Tier-1 concern when district edges and
  patrol patterns enter the model.
- **`RivalStatusView` HUD surface — resolved at 0.7.0.** The 0.7.0 PR
  defers the surface to milestone 0.9's corkboard (option B of re-eval
  §3.5 Q5). No `HudState.rival_status` field at 0.7.0; ICD-01 stays at
  v0.5. The projection shape (`{rival, posture}`) is already locked at
  v0.2; only the surface decision was open.
- **Herald + Observer state machines.** Specced in
  [`../design/rival-ai-spec.html`](../design/rival-ai-spec.html) §03 + §05;
  their ICD-02 mirrors land when each rival's first milestone enters the
  N-window (Tier-1 for Herald and Observer per overview line 42).

## Deviation policy

Adding an Intent kind, or changing the shape of `tick` / `RivalView` /
`RivalStatusView`, requires an architecture session and a same-PR doc
update (Constraint #4). The Evening Star state machine table is now
strong-band — changing a state, a transition predicate, or the goon-count
table is an architecture session, not a deviation.

## Revision history

- **v0.2.2** (milestone 0.9.3, 2026-05-21) — §Notes one-line addition only;
  no shape change. `RivalEventDigest.kind` vocabulary enumerated for Evening
  Star scope (`raid_attempted` / `raid_succeeded` / `raid_wiped`) to cover the
  PR-A audit C-02 emit-site fix in-PR per Constraint #4. ICD-06 v0.2's
  string-typed `kind` field stays permissive — no union tightening. The
  audit's verdict at re-eval-after-0.9.md §3.5 Q2 settles this as a value-
  level bump, not a shape bump.
- **v0.2.1** (milestone 0.7.0, 2026-05-21) — §Open questions resolutions
  only; no shape change. Multi-edition goon transit settled to the v0.2
  clamp (one-edition raids; multi-edition transit deferred to Tier-1).
  `RivalStatusView` HUD surface settled to the 0.9 corkboard (no
  `HudState.rival_status` field at 0.7.0; ICD-01 stays at v0.5). All
  Evening Star state machine / `RAID_BUREAU` / `RivalView` /
  `RivalStatusView` shapes used as authored at v0.2 — no in-PR deviation
  required Constraint #4 bumping.
- **v0.2** (PRE-0.7, 2026-05-21) — Strong-band shape work landed: Evening
  Star SCAVENGE + RAID state machine lifted from rival-ai-spec §04 + §08
  into committed prose (6 states, 9 transitions, 20s tick cadence);
  `RAID_BUREAU` Intent gained `goons` heat-banded count + `eta_ms`
  cycle-clamped resolution + `target: BuildingId` rule (Bureau-only at
  0.7); `RivalView` projection authored (cycle / player / own / edition
  history sub-shapes); v0.1 §Open-questions past-intents item closed —
  rivals **do** see their own past intents, bounded to last 8;
  `RivalStatusView` posture projection authored with the
  `{calm, scheming, hostile}` vocabulary and the Evening Star
  state→posture mapping (Herald + Observer mappings deferred). The
  player-facing HUD surface decision (0.7 pill vs. 0.9 corkboard) stays
  open per §Open questions. Intent vocabulary unchanged from v0.1 — no
  kinds added or removed. See
  [`../architecture/re-eval-after-0.6.md`](../architecture/re-eval-after-0.6.md)
  §3 PRE-0.7 + §3.5 Q2 (past-intents resolution) + Q5 (posture).
- **band promotion** (post-0.6 RE-EVAL, 2026-05-21) — Band moved
  medium → strong per overview line 42's N=3-window rule with 0.7
  entering scope. **No shape change** in that PR — the v0.2 shape work
  landed at PRE-0.7 (see entry above) per METHODOLOGY §3.2's
  surface-and-schedule pattern.
- **v0.1** (PRE-0.1, Phase 0 bootstrap) — Draft. Intent vocabulary
  committed; caller-triggered scope table; v0.1 §Open questions flagged
  for the post-0.6 re-eval (past-intents resolved at v0.2 above).
