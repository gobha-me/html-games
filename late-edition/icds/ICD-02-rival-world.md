# ICD-02 · Rival ↔ World

**Status:** v0.3 (PRE-1.0 — Herald + Observer state machines authored; two Intent kinds added; `RivalStatusView` posture mapping extended to all three rivals; inter-rival §Notes paragraph lifted from rival-ai-spec.html §06)
**Prior:** v0.2.2 (in-PR §Notes addition at 0.9.3 — `RivalEventDigest.kind` vocabulary enumeration to cover `raid_succeeded` + `raid_wiped` emissions)
**Band:** strong
**First caller:** milestone 0.7 (Evening Star SCAVENGE + RAID states); milestone 1.0 lights Herald + Observer
**Source:** [`../design/phase-0-roadmap.html`](../design/phase-0-roadmap.html) §03 ·
[`../design/rival-ai-spec.html`](../design/rival-ai-spec.html) §02 + §03 + §04 + §05 + §06 + §08

## Purpose

The `tick(world, dt) → Intent[]` contract that each rival paper implements. The
world hands each rival a read-only snapshot (`RivalView`); the rival returns
intents that the world applies (or rejects) under its own rules. Rivals never
mutate the world directly — they emit intents and the world's reconciler
applies them in deterministic order at end-of-tick (rival-ai-spec §02).

## Per-tick contract

```ts
type Intent =
  | { kind: 'FILE_STORY',       district: DistrictId, tier: Tier, source: SourceId }
  | { kind: 'RAID_BUREAU',      goons: number, eta_ms: number, target: BuildingId }
  | { kind: 'BRIBE_REPORTER',   reporterId: ReporterId }
  | { kind: 'POISON_LEAD',      leadId: LeadId }
  | { kind: 'SCOUT_DISTRICT',   district: DistrictId }
  | { kind: 'OFFER_WIRE_DEAL',  terms: WireTerms }
  | { kind: 'OFFER_BUYOUT',     amount: number }
  | { kind: 'PARTNER_REQUEST',  district: DistrictId }
  | { kind: 'PUBLISH_COUNTER',  storyId: StoryId }                // v0.3 — Observer PUBLISH state
  | { kind: 'INVESTIGATE_LEAD', leadId: LeadId, editions: number } // v0.3 — Observer INVESTIGATE state (multi-edition)
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

## `RivalStatusView` projection (v0.2; mappings extended to all three rivals at v0.3)

Player-facing posture summary, derived from rival state. Vocabulary locked at
the post-0.6 re-eval (§3.5 Q5):

```ts
interface RivalStatusView {
  rival:   RivalId;                                // 'herald' | 'evening_star' | 'observer'
  posture: 'calm' | 'scheming' | 'hostile';        // medium-band vocabulary (re-eval §3.5 Q5)
}
```

**Evening Star posture mapping** (committed at v0.2):

| State | Posture |
|---|---|
| SCAVENGE, RUSH, BURNOUT | `calm` |
| BRIBE | `scheming` |
| RAID, PANIC | `hostile` |

**Herald posture mapping** (committed at v0.3 · PRE-1.0):

| State | Posture |
|---|---|
| IDLE, COURT, WIRED | `calm` |
| PUNISH, BUYOUT | `scheming` |

The Herald never reaches `hostile` — by design, the Herald *never sends
goons* (rival-ai-spec.html §03 PUNISH state: *"Never sends goons"*). Its
worst posture is `scheming` (PUNISH scoops the player's queued
Investigation; BUYOUT offers $50k to absorb the paper — both pressure
mechanisms without physical violence).

**Observer posture mapping** (committed at v0.3 · PRE-1.0):

| State | Posture |
|---|---|
| INVESTIGATE, SILENCED | `calm` |
| WARN, DESPERATE | `scheming` |
| PUBLISH | `scheming` |

The Observer never reaches `hostile` either (rival-ai-spec.html §05
description: *"never hostile except via information"*). PUBLISH maps
to `scheming` rather than `hostile` because the harm is informational
(+25 player heat, discredited stories) rather than physical. SILENCED
is `calm` because the Observer cannot act for 3 editions — dead air is
a calm posture from the player's view (rival-ai-spec.html §02 PASS
semantics).

- **Where `RivalStatusView` lives.** Exposed on `RivalView.own.posture` (each
  rival sees its own posture) and on `WorldFrame.rivals: RivalStatusView[]`
  (top-level array per ICD-01 v0.6 — the player-facing surface settled at
  PRE-0.10). The 0.7.0 deferral closed when the corkboard's Threats dossier
  shipped at 0.9; v0.3 adds the Herald + Observer mappings to round out
  the array's three entries at milestone 1.0.
- **Medium-band rationale.** Posture vocabulary may shrink (`'scheming'`
  drops out if BRIBE plays as a one-shot effect rather than a sustained
  posture) or grow (a `'silent'` posture for BURNOUT / SILENCED if the
  corkboard wants it — both states currently map to `calm`, but the
  three-state Threats dossier may want a distinct *"dead air"* visual at
  milestone 1.x). The state→posture mapping is the load-bearing commitment,
  not the string set.

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

## Herald state machine (v0.3)

Lifted from [`../design/rival-ai-spec.html`](../design/rival-ai-spec.html)
§03 (FIG. H1) and the §03 state-definition + transition tables. The
Herald is the *low-aggression / high-reach* rival — paper of record,
slow thinker, genteel knife (rival-ai-spec.html §03 tag).

**Tick cadence:** `tickInterval = ONE_EDITION` — one tick per
`EDITION_DEBRIEF_END` (rival-ai-spec.html §03 stat-grid: `TICK 1 / EDITION`).
Unlike Evening Star's 20s wall-clock cadence, Herald ticks on the
edition boundary; the rival object's `tickInterval` is a sentinel
constant meaning *"poll me at EDITION_DEBRIEF_END."* The world's tick
dispatcher reads `tickInterval === ONE_EDITION` and routes accordingly.
**States** (5): `IDLE | COURT | WIRED | PUNISH | BUYOUT`. (The
re-eval-tier-0-to-1.md doc used `LURK` as informal shorthand for the
entry state; rival-ai-spec.html §03 FIG. H1 + the state-definition
table both name it `IDLE` — source HTML wins per
[`../AGENTS.md`](../AGENTS.md) "When you're stuck" rule.)
**1.0 slice scope:** IDLE + COURT + WIRED are the three states whose
bodies the milestone-1.0 code session implements (entry to the
adversarial triangle without endgame mechanics). PUNISH and BUYOUT are
shape-committed for transition-graph closure but caller-triggered —
PUNISH needs the player's Investigation-tier queue surface; BUYOUT
needs the run-meta edition counter at edition ≥ 25 plus the
acceptance-flow UI.

### State definitions

| State | Definition |
|---|---|
| `IDLE` | Default. Files 2–3 procedural society/finance stories per edition matching Hillside/Diamond Row flavor. Does not pursue the player. Generates ~$1k cash, ~5 heat ambient — invisible except in the morning recap. The 1.0 slice models this as a `FILE_STORY` intent per edition (caller-triggered against the Whisper-tier slot grammar in [`../js/sim/headlines.js`](../js/sim/headlines.js)). |
| `COURT` | Triggered when player heat > 60 for two consecutive editions. Sends an in-game letter offering `OFFER_WIRE_DEAL`: player files for the Herald at 50% cash yield, in exchange for −20 heat immediate. Holds for 2 editions awaiting answer. |
| `WIRED` | Wire deal accepted. Player's story cash yield halved; player's heat passively bleeds −4/edition extra. Persists until broken or BUYOUT. Stable, slow attrition. |
| `PUNISH` | Triggered if the player declines / breaks a deal, OR if heat > 80 with no Wire. Once per 3 editions, emits `FILE_STORY` against the player's queued Investigation tier (the "scoop"). **Never sends goons** (rival-ai-spec.html §03 — load-bearing tone commitment). One-edition state then cools to IDLE. Caller-triggered at 1.0 (PUNISH body deferred — needs the player Investigation-queue surface). |
| `BUYOUT` | Endgame state. Only reachable from WIRED at edition ≥ 25 with player heat < 30. Emits `OFFER_BUYOUT` for $50k flat to absorb the paper. Acceptance = "Establishment ending." Rejection = Herald flips to PUNISH for the rest of the run. Caller-triggered at 1.0+. |

### Transition table

Lifted verbatim from rival-ai-spec.html §03. All transitions guarded by
the predicates below; absent any firing predicate, the state self-loops.
Tick cadence is per-edition; the `editions` counters below count
ticks, not wall-clock time.

| From → To | Predicate | First milestone |
|---|---|---|
| `IDLE → COURT` | `player_heat > 60` for 2 consecutive editions | 1.0 |
| `IDLE → PUNISH` | `edition ≥ 10` **AND** `player_heat > 80` **AND** `!isWired` | 1.0+ (PUNISH body deferred) |
| `COURT → WIRED` | player accepts wire deal | 1.0 |
| `COURT → PUNISH` | player declines wire deal | 1.0+ (PUNISH body deferred) |
| `COURT → IDLE` | 2 editions pass with no response | 1.0 |
| `PUNISH → IDLE` | 1 edition cooldown after a scoop | 1.0+ |
| `WIRED → BUYOUT` | `edition ≥ 25` **AND** `player_heat < 30` | 1.0+ |
| `WIRED → PUNISH` | player breaks deal (files a story the Herald flagged off-limits) | 1.0+ |

- **Determinism.** Same rule as Evening Star — all coin-flips flow
  through the rival's seeded RNG (rival-ai-spec.html §02). The Herald
  has fewer branch points (most transitions are deterministic on
  player heat / acceptance state), so the rng surface is small.
- **`isWired` predicate.** Internal flag on the Herald rival object;
  set on `COURT → WIRED`, cleared on `WIRED → PUNISH` or
  `WIRED → BUYOUT`. Not on `RivalView`; the world consults the rival's
  state name via the transition table.
- **Authoring tone (rival-ai-spec.html §03 authoring note).** The
  Herald should feel like a person, not a system. The wire-deal letter
  is hand-written copy; the scoop has a specific story attached. The
  state machine is the spine; the dialogue is the flesh. The 1.0 slice
  ships the spine — flesh is content authoring at Tier-1.x.

## Observer state machine (v0.3)

Lifted from [`../design/rival-ai-spec.html`](../design/rival-ai-spec.html)
§05 (FIG. O1) and the §05 state-definition + transition tables. The
Observer is the *zero-aggression / low-reach* rival — worker-owned,
broke, honest, slow (rival-ai-spec.html §05 tag).

**Tick cadence:** `tickInterval = TWO_EDITIONS` — one tick per **two**
`EDITION_DEBRIEF_END` events (rival-ai-spec.html §05 stat-grid: `TICK 1 / 2 ED.`,
diagram caption "DAILY OBSERVER STATE MACHINE"). The slowest of the
three rivals by design — the Observer is the moral landscape, not the
adversary.
**States** (5): `INVESTIGATE | PUBLISH | WARN | DESPERATE | SILENCED`.
(The re-eval-tier-0-to-1.md doc used `WATCH` as informal shorthand for
the entry state and omitted PUBLISH from its five-state count;
rival-ai-spec.html §05 FIG. O1 + the state-definition table both name
the entry state `INVESTIGATE` and the five states above — source HTML
wins per [`../AGENTS.md`](../AGENTS.md) "When you're stuck" rule.)
**1.0 slice scope:** INVESTIGATE + PUBLISH + WARN are the three states
whose bodies the milestone-1.0 code session implements. DESPERATE
(`PARTNER_REQUEST` flow) and SILENCED (post-"Frame the Observer" arc)
are shape-committed but caller-triggered — DESPERATE needs the
partner-acceptance UI; SILENCED needs the Tier-IV "Frame the Observer"
arc which is a content slot at Tier-1.x.

### State definitions

| State | Definition |
|---|---|
| `INVESTIGATE` | Default. Emits `INVESTIGATE_LEAD` at entry — quietly works on a single multi-edition story matching the worst lie the player has printed recently. Takes 3 editions to complete. Reveals progress only via a corkboard rumor (the player has to be listening). |
| `PUBLISH` | Files the counter-narrative on its own front page. Emits `PUBLISH_COUNTER` — effects: **+25 heat** to player · player's matching lie becomes *"discredited"* in the next edition (cash refund minus 50%) · player's source on that story is burned. One-edition state. |
| `WARN` | Sends a reporter to interview a player source mid-investigation. Emits `POISON_LEAD` — one player lead in that district is poisoned (picking it up costs +5 heat for misinformation). Used when an investigation is ongoing but the player is about to commit. |
| `DESPERATE` | Triggered when Observer cash < $200. Emits `PARTNER_REQUEST` one-time: $500 keeps the Observer alive for 5 editions in exchange for the player NOT printing in one district they nominate. Accepting prevents PUBLISH against the player for 5 editions. Caller-triggered at 1.0+ (`PARTNER_REQUEST` acceptance UI deferred). |
| `SILENCED` | Triggered when the player succeeds at framing the Observer (a Tier IV move at Tier-1.x). Observer cannot publish, warn, or investigate for 3 editions. Heat decays slower for the player while Observer is silenced (the city notices the silence). Caller-triggered at Tier-1.x (depends on "Frame the Observer" arc content). |

### Transition table

Lifted verbatim from rival-ai-spec.html §05. Tick cadence is
per-two-editions; the `3 editions in X complete` predicates count
those slower ticks.

| From → To | Predicate | First milestone |
|---|---|---|
| `INVESTIGATE → PUBLISH` | 3 editions in INVESTIGATE complete on a player lie | 1.0 |
| `INVESTIGATE → WARN` | player picks up a lead the Observer is investigating | 1.0 |
| `INVESTIGATE → DESPERATE` | `observer_cash < $200` | 1.0+ (DESPERATE body deferred) |
| `PUBLISH → INVESTIGATE` | publish resolved (one-edition state) | 1.0 |
| `WARN → INVESTIGATE` | poison applied (one-edition state) | 1.0 |
| `DESPERATE → INVESTIGATE` | partner accepted **OR** declined (does not loop) | 1.0+ |
| `* → SILENCED` | player completes the "Frame the Observer" arc (cannot reach otherwise) | Tier-1.x |
| `SILENCED → INVESTIGATE` | 3 editions pass | Tier-1.x |

- **`observer_cash` internal state.** Tracked on the Observer rival
  object, not on `RivalView`. Decrements on `PUBLISH_COUNTER` cost
  (running the paper costs money); increments on the Observer's own
  ambient story revenue (modeled as `+$80/edition` until the Tier-1.x
  economy ships).
- **Single counter-narrative target per INVESTIGATE → PUBLISH cycle.**
  The Observer fixates on the *worst* recent player lie at INVESTIGATE
  entry (selected from the last N=5 player Story records where
  `truthful === false`, weighted by `heat_yield`); the `PUBLISH_COUNTER`
  emit at PUBLISH carries the chosen `storyId`.
- **WARN does not bump posture beyond `scheming`.** The §RivalStatusView
  Observer mapping treats WARN as `scheming` (informational pressure)
  rather than `hostile` (physical pressure); the design's *"never
  hostile except via information"* §05 commitment is the spec anchor.
- **Tone (rival-ai-spec.html §05 tone note).** The Observer should
  make the player feel *watched*, never threatened. Their stories
  appear on the morning corkboard as printed pages next to the
  player's. The visual moment matters more than the heat penalty.
  The 1.0 slice ships the state machine + intent emit sites; the
  corkboard-page treatment is a HUD job at the same milestone.

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

The Tier-0 slice implements `RAID_BUREAU` and `PASS` for the Evening
Star. Milestone 1.0 (Tier-1 opener) adds Herald (IDLE / COURT / WIRED
bodies) and Observer (INVESTIGATE / PUBLISH / WARN bodies). The **full
Intent vocabulary is committed today** — the bodies fill in as their
callers arrive (methodology §Phase 2). No new Intent kinds may be added
without an ICD revision.

| Intent | First implementer | First milestone | shape detail? |
|---|---|---|---|
| `PASS` | all rivals | 0.7 | n/a (shape is the kind) |
| `RAID_BUREAU` | Evening Star | 0.7 | **yes** — see §`RAID_BUREAU` |
| `FILE_STORY` | Herald (IDLE state) | 1.0 | shape committed at v0.1 |
| `OFFER_WIRE_DEAL` | Herald (COURT state) | 1.0 | shape committed at v0.1 (`WireTerms` shape resolved at 1.0+ when the wire-deal UI lands) |
| `INVESTIGATE_LEAD` | Observer (INVESTIGATE state) | 1.0 | **yes — v0.3** (shape: `{leadId, editions}`; `editions` defaults to 3 per rival-ai-spec.html §05 INVESTIGATE state) |
| `PUBLISH_COUNTER` | Observer (PUBLISH state) | 1.0 | **yes — v0.3** (shape: `{storyId}`; effect rule is +25 player heat, discredit lie, burn source — applied by world's intent reconciler, not the rival) |
| `POISON_LEAD` | Observer (WARN state) | 1.0 | shape committed at v0.1 |
| `BRIBE_REPORTER` | Evening Star (BRIBE state) | Tier-1+ | caller-triggered |
| `SCOUT_DISTRICT` | Herald | Tier-1+ | caller-triggered |
| `OFFER_BUYOUT` | Herald (BUYOUT state) | Tier-1+ | caller-triggered (acceptance-flow UI) |
| `PARTNER_REQUEST` | Observer (DESPERATE state) | Tier-1+ | caller-triggered (acceptance-flow UI) |

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
- **Inter-rival event handling (v0.3 · cite rival-ai-spec.html §06
  interaction matrix).** Rivals share a city. When two rivals act on
  the same target in the same tick, the simulation resolves conflicts
  using the §06 matrix. The intent reconciler runs **after** all rivals
  have ticked — `RivalView` is the projection each rival ticks against,
  *not* a live cross-rival channel. Rivals see other rivals' postures
  indirectly through `RivalView.edition_history` (last 10 editions'
  public deltas) and through the player-facing posture surface they
  read by side-effect (a rival ticking after another in the same
  edition does NOT see the other's intents-this-tick). The §06 matrix
  has three meaningful cells: (1) **Herald vs. Evening Star same-story
  collision** — both rivals emit `FILE_STORY` against the same district
  same edition; resolver picks Evening Star for Whisper-tier collisions
  (Star is louder), Herald for Investigation+ (Herald has higher reach).
  (2) **Herald absorbs Observer counter-narrative** — Herald may
  preempt an Observer `PUBLISH_COUNTER` by emitting a softer version
  first; the player-heat penalty is multiplied by 0.7 when both fire
  in the same edition. (3) **Star raids Observer** — if the Observer
  has been publishing against the Star instead of the player for ≥ 3
  consecutive editions, Evening Star may emit `RAID_BUREAU` targeting
  the Observer's bureau (not the player's). The Observer burning down
  triggers SILENCED. The raid is the only inter-rival violence;
  rival-ai-spec.html §06 closing line — *"It's a beat that should
  happen ~once per long run and the player should hear about it on the
  radio announcer's broadcast"* — pins the cadence. **At milestone
  1.0, only cell (1) wires** (Herald + Observer both emit `FILE_STORY`
  + `PUBLISH_COUNTER` against shared districts; resolver picks by
  tier). Cells (2) and (3) are shape-committed here but caller-
  triggered — they ship when the Herald `FILE_STORY` body and the
  Star-vs-Observer raid mechanic land at Tier-1.x.
- **Observer DESPERATE reconciles `discussion/observer-violence.md`
  (v0.3 · PRE-1.0).** The discussion doc parked a Tier-IV "partner-
  fund violence" mechanism (the Observer funds another rival's raid
  in exchange for survival). v0.3 settles it: the design HTML's
  `PARTNER_REQUEST` ($500 keeps the Observer alive for 5 editions in
  exchange for the player NOT printing in one district) at
  rival-ai-spec.html §05 line ~750 **is** the survival mechanism the
  Observer ships with. The discussion doc's funding-violence variant
  is **out of scope for Tier-1** — the Observer's only DESPERATE move
  is the `PARTNER_REQUEST` against the player, not a cross-rival
  laundered raid. The discussion doc moves from "parked behind
  first-consumer milestone" to "settled at PRE-1.0 by Observer
  §DESPERATE" (see
  [`../discussion/observer-violence.md`](../discussion/observer-violence.md)).

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
- ~~**Herald + Observer state machines.** Specced in
  [`../design/rival-ai-spec.html`](../design/rival-ai-spec.html) §03 + §05;
  their ICD-02 mirrors land when each rival's first milestone enters the
  N-window (Tier-1 for Herald and Observer per overview line 42).~~
  **Resolved at v0.3 (PRE-1.0).** Both state machines authored above —
  Herald (IDLE / COURT / WIRED / PUNISH / BUYOUT, tick 1/edition) and
  Observer (INVESTIGATE / PUBLISH / WARN / DESPERATE / SILENCED, tick
  1/2 editions). `RivalStatusView` posture mappings extended to all
  three rivals. Two Intent kinds added (`PUBLISH_COUNTER`,
  `INVESTIGATE_LEAD`); the other Tier-1 rival intents (`FILE_STORY`,
  `OFFER_WIRE_DEAL`, `POISON_LEAD`) reuse v0.1 shapes. First caller is
  milestone 1.0 (Tier-1 opener).
- **Star-vs-Observer raid mechanics — open for Tier-1.x.** v0.3 §Notes
  inter-rival paragraph cell (3) commits the shape (Evening Star may
  emit `RAID_BUREAU` against the Observer if Observer has been
  publishing against Star ≥ 3 editions); the trigger predicate's exact
  numeric thresholds + the radio-announcer event channel land at the
  Tier-1.x milestone that wires it. Until then, milestone 1.0 ships
  with cell (3) shape-only.

## Deviation policy

Adding an Intent kind, or changing the shape of `tick` / `RivalView` /
`RivalStatusView`, requires an architecture session and a same-PR doc
update (Constraint #4). The Evening Star state machine table is now
strong-band — changing a state, a transition predicate, or the goon-count
table is an architecture session, not a deviation.

## Revision history

- **v0.3** (PRE-1.0, 2026-05-22) — Herald + Observer state machines
  authored ahead of milestone 1.0 (Tier-1 opener). Three blocks of
  shape work landed: (1) **Herald state machine** lifted verbatim from
  [`../design/rival-ai-spec.html`](../design/rival-ai-spec.html) §03
  FIG. H1 + state-definition table — five states `IDLE | COURT |
  WIRED | PUNISH | BUYOUT`, tick cadence `1/EDITION` (per-edition
  sentinel rather than wall-clock ms), 8 transitions guarded by player
  heat / acceptance state. IDLE + COURT + WIRED bodies wire at 1.0;
  PUNISH + BUYOUT are shape-committed for graph closure but caller-
  triggered. (2) **Observer state machine** lifted verbatim from
  rival-ai-spec.html §05 FIG. O1 + state-definition table — five
  states `INVESTIGATE | PUBLISH | WARN | DESPERATE | SILENCED`, tick
  cadence `1 / 2 EDITIONS`, 8 transitions. INVESTIGATE + PUBLISH +
  WARN bodies wire at 1.0; DESPERATE + SILENCED are caller-triggered
  (need partner-acceptance UI + Tier-IV "Frame the Observer" arc
  respectively). (3) **`RivalStatusView` posture mapping extended** to
  all three rivals — Herald never reaches `hostile` (design-load-
  bearing §03 *"Never sends goons"* commitment); Observer never
  reaches `hostile` either (§05 *"never hostile except via
  information"* commitment); the v0.7.0 surface-deferral §Open
  questions item closes (`WorldFrame.rivals` array per ICD-01 v0.6 is
  the player-facing surface).
  Two **new Intent kinds** added to the per-tick union for Observer
  scope: `PUBLISH_COUNTER` (storyId-keyed counter-narrative for the
  PUBLISH state — effect rule: +25 player heat, discredit lie, burn
  source) and `INVESTIGATE_LEAD` (leadId-keyed multi-edition
  investigation for the INVESTIGATE state — `editions` count defaults
  to 3 per rival-ai-spec.html §05). Both are caller-triggered until
  milestone 1.0 wires them. The Herald PUNISH-state scoop reuses the
  existing `FILE_STORY` shape (no new kind needed; tier filter
  selects the player's Investigation queue at the reconciler).
  One **inter-rival §Notes paragraph** added against
  rival-ai-spec.html §06 interaction matrix — three matrix cells named
  (Herald vs. Star same-story collision; Herald-absorbs-Observer
  counter; Star raids Observer); only cell (1) wires at milestone 1.0,
  cells (2) and (3) ship with the Herald `FILE_STORY` body and the
  Star-vs-Observer raid mechanic at Tier-1.x. Observer DESPERATE
  state's `PARTNER_REQUEST` formally settles the
  `discussion/observer-violence.md` partner-fund-violence parking note
  — the design HTML's $500-for-5-editions mechanism is the Tier-1
  survival path; the discussion doc's funding-violence variant is
  out-of-scope for Tier-1.
  Two **source-HTML-name reconciliations** against
  [`../architecture/re-eval-tier-0-to-1.md`](../architecture/re-eval-tier-0-to-1.md)
  §3 informal naming: re-eval used `LURK` for Herald's entry state
  (HTML names it `IDLE`); re-eval used `WATCH` for Observer's entry
  state and listed five states without `PUBLISH` (HTML names the
  entry state `INVESTIGATE` and the five states above). Per
  [`../AGENTS.md`](../AGENTS.md) hard rules, source HTML wins; the
  re-eval doc's informal names were not load-bearing.
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
