# RE-EVAL after 0.9 — paper + code-aware session

**Slot:** [`../roadmap.md`](../roadmap.md) line 33 — *"After 0.9 · paper +
code-aware · Code-arch divergence check. Tighten HUD spec. Confirm Tier-0
exit criteria."*
**Scope:** [`../METHODOLOGY.md`](../METHODOLOGY.md) §3 both halves
(structural + code-aware) plus the **forward ICD presence check** for the
next-N window (PRE-0.10 / 0.10), plus the band-tier transition gate (Tier-0
→ Tier-1 is one milestone away). The bulk of the line-item evidence lives
in [`../design/spec-vs-code-review-0.9.html`](../design/spec-vs-code-review-0.9.html)
— a code-aware audit authored by Claude Design alongside this slot. This
markdown is the formal landing site; the HTML is the supplement.
**Output:** band movements, scheduled paper slots, roadmap label updates,
discussion-doc status, four Gitea tickets for the next code sequence. No JS.

This is the fourth paper-session entry in the changelog (v0.1.1 PRE-0.2 ·
v0.3.1 RE-EVAL after 0.3 · v0.6.1 RE-EVAL after 0.6 are the prior three).
It runs after 0.7.0 / 0.7.1 / 0.8 / 0.9 shipped (plus the PRE-0.7 paper
slot at v0.6.2 and the PRE-0.8 paper slot at v0.7.2) and before 0.10 can
open as a code session.

## 1. Code-aware pass

Read against the six authored ICDs:

| ICD | Version | First caller | Latest implementing files |
|---|---|---|---|
| ICD-01 (World ↔ Renderer) | v0.5 — `HudState`, locked projection rule | 0.5 ticker → 0.9 corkboard | [`../js/sim/world-state.js`](../js/sim/world-state.js) `snapshot()`, [`../js/hud.js`](../js/hud.js) `HudCorkboard.apply()` |
| ICD-02 (Rival ↔ World) | v0.2.1 — Evening Star state machine, RivalView/RivalStatusView | 0.7.0 Evening Star + Goon | [`../js/sim/evening-star.js`](../js/sim/evening-star.js), [`../js/sim/world-state.js`](../js/sim/world-state.js) (`_reconcileIntent`, `_pruneDeadUnits`) |
| ICD-03 (Unit ↔ Pathfinder) | v0.2 — `GridCell` / `cost` / heuristic | 0.2 reporter dispatch | [`../js/sim/pathfinder.js`](../js/sim/pathfinder.js) |
| ICD-04 (Save Schema) | v0.1 — single-blob, versioned, migration chain, per-rival RNG | 0.8 save/load | [`../js/sim/save.js`](../js/sim/save.js), `World.fromSnap`, `CycleClock.fromSnap`, `EveningStar.fromSnap` |
| ICD-05 (Story Lifecycle) | v0.4.1 — `AUTO_PLATE_SENTINEL` path + ink plate-time gate notes | 0.3 → 0.7.1 (all five rows lit) | [`../js/sim/world-state.js`](../js/sim/world-state.js) `_handleArrival`, `_fireDebrief` |
| ICD-06 (Print Cycle) | v0.3 — `CYCLE_GAME_OVER` added at 0.7.0 | 0.5 deadline + 0.7 game-over | [`../js/sim/cycle-clock.js`](../js/sim/cycle-clock.js), [`../js/sim/world-state.js`](../js/sim/world-state.js) `subscribeCycle` |

Findings keyed to METHODOLOGY §3.1.1 classification. The audit HTML
(§03–§06) carries the full per-finding bodies, fix sites, and test plans;
this section is the classifier + verdict layer.

### Drift (interface, code-from-arch, arch-silent)

**None at the contract level.** All six ICDs survived code-aware re-read
with zero interface drift. The audit's §07 ("What's Actually Right") spot-
checks this against `WorldFrame` sub-shapes, Intent vocabularies, State
transitions, and event kinds — every comparison passes. Constraint #4
(in-PR ICD bumps on deviation) has been honored across all twelve
milestones; the [`../CHANGELOG.md`](../CHANGELOG.md) ledger of *no ICD
bump · everything used as authored* at 0.5 / 0.6 / 0.7.1 / 0.8 / 0.9 is
the rolling proof.

**Drift exists below the ICD layer** — at the design-doc-to-code level.
Nine items, all flagged in code comments at the deviation site
(audit §04 D-01 through D-09). They are real divergences against
[`../design/design-doc.html`](../design/design-doc.html) §03 / §05 / §12 /
§13 / §19, but each is an *acknowledged* drift, not a surprise. Pin
each to its scheduled fix slot in §4 below.

### Decision-embedded-in-comments

Three observations from 0.7.0–0.9 deserve documented homes; two are
already absorbed by their next ICD bump, the third is captured by §3.5
Q3 below.

1. **`_buildEditionSummary` filter reads a counter nothing writes**
   ([`../js/sim/world-state.js`](../js/sim/world-state.js)
   `_pendingRivalEvents.filter(e => e.kind === 'raid_succeeded')`).
   The Evening Star pushes `raid_attempted` from `_reconcileIntent` but
   never pushes `raid_succeeded` or `raid_wiped`. The PANIC transition
   (ICD-02 §Evening Star state machine: *"3 consecutive failed raids →
   PANIC"*) reads from a counter that is permanently 0. The
   comment-at-the-emit-site is missing — there is no acknowledged-drift
   marker on this one. The audit flags it as **C-02 (critical)**.
   Action: §4 schedules a ticket (PR-A) and an ICD-02 §Notes one-line
   addition for the `raid_succeeded` / `raid_wiped` vocabulary as a
   value-level (not shape-level) bump.

2. **`SaveBlobV1.rng_seed = 0`** —
   [`../js/sim/save.js:42`](../js/sim/save.js) carries the comment
   *"World RNG owner doesn't exist at 0.8; reserved for later"*. ICD-04
   §Notes names this exact slot as *"reserved for systems that don't
   have a per-rival owner (lead spawn jitter at milestone 0.9+ is the
   first plausible caller)"*. The first plausible caller (C-04 lead-spawn
   engine) lands at 0.10; the comment is the navigation aid. **No
   extraction needed** — the §Notes paragraph the ICD already carries is
   the architectural home.

3. **`AUTO_PLATE_SENTINEL` continues to absorb plating when no Editor
   action is needed** — [`../js/sim/world-state.js`](../js/sim/world-state.js)
   `_fireDebrief` keeps the sentinel path as defensive fallback even
   after the Editor unit shipped at 0.7.1. The PRE-0.7 §Notes amendment
   (ICD-05 v0.4) names this explicitly: *"Editor unit substitutes its
   `UnitId` in the same slot; the field type stays `EditorId`. The
   pre-Editor sentinel path is preserved as defensive fallback if the
   Editor is absent or fails to act in a given edition."* This is
   arch-silent → arch-aligned at v0.7.2 and stays so.

### Missing-test-for-arch-claim

The audit notes that all 113 cases under [`../tests/`](../tests) lock
the inner three rings, the cycle, the save round-trip, the rival state
machine, and the HUD projection helpers. Two strong-band claims fall
short of *tested* today:

| Claim (overview line) | Status after 0.7–0.9 | Evidence |
|---|---|---|
| Single fail-state — Press @ 90 HP | **Half-lit.** | `bureau.hp` damages under
[`../tests/press-hp.test.mjs`](../tests/press-hp.test.mjs); `CYCLE_GAME_OVER`
fires once. **The "fully repaired between editions if > 0" rule (Design Doc
§19) is unimplemented and untested** — see C-01 in §4. |
| Camera + input model | **Aligned to milestone scope.** | Click-to-dispatch and selection are tested via integration around `_handleArrival` /
`dispatch()`. WASD pan / Block zoom / slow-mo from Design Doc §13 are gaps,
not drift — first caller is milestone 0.10 (audit G-07). |

No demotions warranted on the strong-band table — every strong-band claim
either has a current test or has its first testable caller inside the N=3
window from 0.9. Two strong-band claims promote in §2 below.

### Arch-silent-on-code

Two facts live in code without architecture mention. Both are small enough
that promotion to a standalone architecture line is overkill but worth a
documented home in the next ICD bumps.

1. **The HUD `WARNING_MS = 60_000` / `CRITICAL_MS = 10_000` thresholds in
   [`../js/hud.js`](../js/hud.js)** are silent on both architecture
   and design — they were a 0.9 implementation choice. The design doc's
   §12 strip-turns-red beat is at T-30s, and ICD-06 already fires
   `DEADLINE_WARNING` at T-30s. The HUD picks its own thresholds against
   `deadline_ms` instead of subscribing to the event. Audit **D-06**.
   Resolution: §4 schedules the threshold fix into PR-A and the
   *subscribe-vs-poll* cleanup as optional follow-up. ICD-06 §Subscriber
   expectations table already names the subscription path — no ICD bump.

2. **`WorldFrame.effects` and `WorldFrame.rain.intensity` are both
   *declared at the ICD-01 contract* and *dead at both producer and
   consumer*.** Audit **C-07** + **C-06** respectively. The fields
   were authored at ICD-01 v0.3 against the §03 / §12 design beats, but
   nothing pushes events into `effects[]` and nothing reads `rain.intensity`
   — the renderer constants and sim emit sites are both off. This is the
   single biggest *contract-present, beat-absent* mismatch in the
   codebase. Resolution: §3 schedules PRE-0.10 to author the `FxEvent`
   union as ICD-01 v0.6 alongside the v0.6 additions for §3.5 Q1; PR-D
   wires the producers and consumers after that lands.

Two items, both already drawing fix tickets — the arch-silent finding is
that they should have surfaced at one of the earlier re-evals. Reading
them this re-eval is on-time enough; the previous re-evals were each
scoped tighter (0.3 / 0.6) and these beats first read as load-bearing at
0.9 when the HUD corkboard made the deadline ramp diegetic.

## 2. Structural pass

Reviewed [`00-overview.md`](00-overview.md) against shipped 0.7–0.9 reality.

### Strong band — promotions and confirmations

| Commitment | Status after 0.7–0.9 |
|---|---|
| Print cycle (12 min/edition) | Tested. Unchanged. |
| Five resources — names locked | Tested. Unchanged. |
| Single fail-state — Press @ 90 HP | **Lit at 0.7.0.** `CYCLE_GAME_OVER` fires once when Bureau HP hits 0; `GameOverOverlay` mounts; save round-trips the flag (ICD-04 §Notes). Repair rule (C-01) is the one open beat. |
| Cel-shaded toon pipeline | Preserved byte-for-byte across 0.7–0.9. |
| Camera + input model | Preserved at the click-to-dispatch minimum; full §13 control surface is milestone 0.10 (audit G-07). |
| Reporter unit core | HP 2 spec drift (D-02) — code omits the field but pattern is intact. Pinned for PR-A. |
| Lead → Story lifecycle | All five transition rows lit and tested (0.3 → 0.7.1). |
| Save = single localStorage JSON | Lit at 0.8 against ICD-04 v0.1. 12 round-trip cases. |
| Browser-only single-player MVP | Preserved. No netcode/auth/backend introduced. |

Two band-table edits this re-eval:

- **HUD corkboard layout** — overview line 45 — **medium → strong.** The
  0.9 PR shipped the pixel-honest §13 layout; the four-row CSS grid and
  three sibling region projectors are now load-bearing for any future
  HUD work (G-10 / G-11 / G-12 all assume the corkboard substrate). The
  ICD-01 v0.6 additions in §3 below cement this — `UnitView.stats`,
  `LeadView.district`, `WorldFrame.rivals` only make sense on the
  corkboard. Per the N=3 horizon rule, strong applies through milestone
  0.12 (or whatever the second Tier-1 milestone numbers as).
- **Rival AI state machines** — overview line 42 — Evening Star is
  strong (since 0.6.1 re-eval); Herald and Observer stay medium until
  their first milestone enters the N-window (audit G-03). No movement
  this re-eval, but call it out so the next reader sees the partial
  promotion.

### Medium band

| Line | Decision |
|---|---|
| Full 8-building catalogue (line 40) | Stay medium. Bureau + Darkroom live; Branch arrives at 0.10 (G-01). |
| Full 6 unit types (line 41) | Stay medium. Five of six live (Reporter / Photog / Editor / Goon / Fixer); Tipster + Stringer are Tier-1 (G-02). |
| Rival AI state machines (line 42) | See above — partial promotion. |
| Story slot grammar (line 43) | Stay medium. Placeholder `storyDigest()` is acknowledged drift (G-05). Real grammar lands at 0.10 alongside districts. |
| First-pass balancing numbers (line 44) | Stay medium. D-01 / D-03 / D-04 are §19-numbers drift; promotion gate is playtest, not implementation. |
| HUD corkboard layout (line 45) | **Promoted → strong.** |
| Heat economy thresholds 40/60/80 (line 46) | Stay medium. D-04 (heat decay nuances) is the §19 commitment; lands at PR-A. |

### Fuzzy band

The Tier-0 → Tier-1 RE-EVAL slot (roadmap line 35) remains the next
opportunity for fuzzy-to-medium movement (procedural city, MP, audio
asset list, Tech tree branches). Milestone 0.10 is the gate; no fuzzy
movement at this re-eval.

The one fuzzy-band line that *does* deserve a forward note: **Audio
system at large.** Design Doc §14 + Supplement C (audio manifest) carry
60 prompts across 6 ambient beds / 6 music stems / 24 SFX / 60 VO lines.
Audit **G-08** flags that no `js/audio/` directory exists and no `Audio`
API hooks. The asset-list-and-engine-selection commitment in overview
line 58 has been fuzzy-since-PRE-0.1; the Tier-0 closer doesn't strictly
require audio, but the press-silence beat (Design Doc §05) cannot land
without it, and asset generation is parallel-to-code work that wants the
bus contract authored first. §3 schedules **ICD-07 (Audio bus)** as a
new contract during PRE-0.10.

### Discussion docs

No status changes this re-eval. The three docs settled at the post-0.6
re-eval (tutorial / difficulty / rival-state visibility) stay committed-
direction; the three remaining (observer violence / accessibility /
yellow-establishment branch) stay parked behind their first-consumer
milestones (all Tier-1+).

## 3. Forward ICD presence check (next-N window: PRE-0.10 / 0.10)

Per METHODOLOGY §3.1, every `[strong]` milestone inside the next-N
window must have its ICDs authored to the level the band claims.

| Milestone | Required ICDs | Status | Action |
|---|---|---|---|
| **PRE-0.10** | Itself the paper slot — authors ICD-01 v0.6, ICD-06 v0.4, ICD-07 v0.1 | Slot is the action. | Schedule below. |
| **0.10** — Tier-0 closer (5-edition arc · run-end summary · high-score persistence · lead-spawn engine · districts · Branch Bureau · slot-grammar headlines · tutorial · minimum controls) | ICD-01 v0.6 (stats / district / rivals / FxEvent), ICD-04 §Notes (high-score key + lead-spawn RNG slot already reserved), ICD-06 v0.4 (30s minimum debrief), ICD-07 v0.1 (audio bus) | **Not code-ready.** ICD-01 v0.5 surfaced three bump candidates at v0.9 (parked); ICD-06 §Cycle timing wording disagrees with Design Doc §19 (audit C-05); ICD-07 doesn't exist. | **Schedule PRE-0.10.** Authors the four bumps below. |

### Scheduled paper slot — PRE-0.10

A single architecture session, paper-only, no code. Authors:

1. **ICD-01 v0.5 → v0.6** — four additions:
   - `UnitView.stats: {nerve: number, nose: number, legs: number} | undefined`
     (audit G-10). Optional because only Reporter carries the trio at
     Tier-0; other unit kinds keep the field absent. Reporter naming
     (audit G-09 tutorial — named reporters from Design Doc §08) is the
     coupled feature; the field set is the projection.
   - `LeadView.district: DistrictId` projection (audit G-11). The field
     exists at the sim layer (`Story.district`) since 0.3 — this lifts
     it into the projection so per-district Story queue in the Dossier
     row can render the Design Doc §13 mock (*"Docks: Strike Threat ·
     Hillside: Mayor's Mistress"*). Couples to G-04 (districts as data).
   - `WorldFrame.rivals: RivalStatusView[]` top-level key (audit G-12).
     Resolves the post-0.6 §3.5 Q5 carryover: the HUD surface for
     `{calm, scheming, hostile}` posture lands as a top-level
     `WorldFrame` field, not nested inside `hud`. Threats dossier reads
     posture + raid ETA + source direction from this array.
   - `FxEvent` union under §`WorldFrame.effects` (audit C-07).
     Vocabulary: `'flash' | 'print' | 'death' | 'pickup' | 'verify' |
     'raid_warning'`. Drained queue (one-frame lifetime) per the
     existing §Notes wording. Producers and consumers wire at PR-D, not
     PRE-0.10 — this is the contract authoring only.
2. **ICD-06 v0.3 → v0.4** — single §Cycle timing line edit (audit C-05).
   Change *"Duration is player-controlled (click to dismiss)"* to *"30s
   minimum debrief animation; dismissable after the minimum elapses
   (Design Doc §19)"*. No shape change, no new event. The code-side
   gate lands at PR-A alongside the wording bump per Constraint #4.
3. **ICD-07 v0.1 — new — Audio bus** (audit G-08). Authors the
   contract so audio assets can land in parallel to code work. Channel
   vocabulary (`'ambient' | 'music' | 'sfx' | 'vo'`), ducking rules,
   the press-silence beat (Design Doc §05), reference Supplement C for
   the 60-prompt manifest. Initial author at v0.1 (medium-band, since
   no caller until Tier-1's audio milestone enters the N-window).

Plus three roadmap-shape commitments folded into the same slot:

4. **Author `architecture/re-eval-after-0.9.md`** — this document.
   Lands at v0.9.1 paper, alongside the four ICD edits. (You are reading
   the deliverable.)
5. **Confirm Tier-0 exit criteria** — roadmap line 34's *"5-edition arc
   · run-end summary screen · high-score persistence"* implies C-04
   (lead spawn) and G-09 (tutorial copy) must be in 0.10. §3.5 Q1
   below ratifies. The audit's PR-C scope (seven items) is the locked
   shape of milestone 0.10.
6. **Open four Gitea tickets** mirroring the audit's §08 PR triage
   (PR-A polish · PR-B paper · PR-C closer · PR-D visual feedback).
   These give the next code session named handles for the four PRs
   instead of re-deriving them from this doc.

PRE-0.10 ships at v0.9.3 paper-only patch following the PRE-0.7 / PRE-0.8
precedents. This PR (the one that lands this re-eval doc + the file move
+ the roadmap rewire + the four tickets) is **v0.9.2 — re-eval landing**,
not PRE-0.10 itself. PRE-0.10 is the *next* paper PR; this one is its
scheduler. (v0.9.1 is already taken by the WebGL context fallback hot-fix
that shipped between v0.9 and this re-eval.)

## 3.5 Open questions

Three questions surfaced by the audit's read against the design package.

### Q1: Does the loop *read as a game* — is C-04 the only blocker for 0.10?

The audit's §02 callout: *"The simulation spawns one lead at construction
and never spawns another. After the player ferries that lead through the
pipeline, the world is empty — every subsequent edition fires with zero
stories."* The 12-minute cycle keeps ticking; nothing pulls on it. The
four-ring *"loop plays"* verdict at the post-0.6 re-eval was true for
one edition's worth of motion — true under the testing-rig conditions of
that re-eval, but not under the *"first thing a friend can play"* bar.

Three candidate readings:

- **(a) C-04 only.** Lead-spawn engine lands; the four rings spin
  indefinitely; districts (G-04) + Branch (G-01) + grammar (G-05) are
  texture, not blockers. Milestone 0.10 ships at the spawner.
- **(b) C-04 + districts + grammar.** The audit's §02 *"reads as a
  game"* bar wants per-district leads with real headlines because
  *"DOCKS · STRIKE THREAT"* is the moment a friend sees a paper, not
  a tech demo. Spawner alone leaves the dossier histograms reading
  *"3 whisper · 1 investigation"* against a single `'d-default'`
  district, which is the same not-a-game read the v0.9 dossier has
  today.
- **(c) C-04 + districts + grammar + Branch + minimum controls + tutorial
  + scores.** The audit's PR-C scope — all seven items. The Tier-0
  closer as the design doc imagined it.

**Verdict: (c).** Milestone 0.10 is the Tier-0 closer; the roadmap pins
it as *"the first thing a friend can play · verifies the loop reads as
a game."* That phrasing is the bar, not C-04 alone. The audit's PR-C
groups all seven into one milestone slot for a reason — they're
mutually load-bearing. If 0.10's scope creeps past one code session,
split into 0.10.0 (lead spawn + districts + Branch + grammar + scores)
and 0.10.1 (tutorial + minimum controls) at session open, mirroring the
0.7.0 / 0.7.1 split. Both halves are ICD-ready once PRE-0.10 ships.

### Q2: ICD-02 `raid_succeeded` / `raid_wiped` — value bump or shape bump?

The Evening Star pushes `raid_attempted` but never the success/failure
counterparts (audit C-02). ICD-02 §RivalEventDigest already declares
`kind: string` open-vocabulary; the value-level addition (two new
allowed strings + emit sites) doesn't break the shape. But the PANIC
transition reads `raid_succeeded` count as a typed branch, and a
schema-aware reader of ICD-02 might reasonably expect the vocabulary
enumerated.

**Verdict: one-line §Notes addition at ICD-02 v0.2.1 → v0.2.2 in the
same PR as the emit-site fix (PR-A).** Constraint #4 in-PR pattern.
Don't open PRE-0.10 to authorize a one-line value addition; PR-A carries
the §Notes patch alongside the JS change.

The active-raid tracking shape (per-goon `raid_id` tag or
`EveningStar.activeRaidGoonsRemaining` counter) is an implementation
detail — the audit recommends the lighter of the two; PR-A's session
picks at code time. No ICD-02 shape impact either way.

### Q3: Should the post-0.9 audit HTML stay in `design/` permanently, or move to `architecture/` once the re-eval ships?

The audit was authored by Claude Design as a code-aware re-read against
the design package — the same shop that produced the four immutable
design HTMLs already in [`../design/`](../design). It cites those four
HTMLs throughout and self-describes as the supplement to *this* document.

Three readings:

- **(a) Permanent in `design/`.** The HTML is a Claude Design output;
  its sibling files live there; readers who open `design/` to read the
  package get the audit as the *"v0.9 update"* of that package. The
  AGENTS.md *"design HTMLs are immutable"* rule applies (the audit
  itself isn't immutable — it's a snapshot — but the **file** is, like
  the design HTMLs themselves).
- **(b) Move to `architecture/`.** Re-evals are architecture artifacts;
  the audit functions as one; co-locating with `re-eval-after-0.9.md`
  is the cleanest find-path.
- **(c) Mirror.** Keep the HTML in `design/`, link from `architecture/`
  via the markdown.

**Verdict: (a) permanent in `design/`.** The find-path argument loses
to the authorship argument — the HTML is a Claude Design artifact, not
an architecture-session output. This markdown is the architecture-session
output; it cites the HTML the same way the prior re-evals cite the
design HTMLs. Future audits at v1.x land in `design/` next to this one.

## 4. Roadmap label updates

1. **Tick** the "RE-EVAL after 0.9" row (roadmap line 33).
2. **Insert** a new `PRE-0.10` row above the existing `0.10` row:
   `PRE-0.10 | Author **ICD-01 v0.6** (UnitView.stats · LeadView.district ·
   WorldFrame.rivals · FxEvent) + **ICD-06 v0.4** (30s minimum debrief
   wording) + **ICD-07 v0.1** (audio bus, new) | Architecture session ·
   paper-only · gates milestone 0.10 | strong`.
3. **Expand** the `0.10` row's description to name the seven-item PR-C
   scope: *"Tier-0 closer · lead-spawn engine · districts as data ·
   Branch Bureau · slot-grammar headlines · run-end summary + high-score
   persistence · diegetic tutorial · minimum control surface (WASD pan,
   Block zoom, slow-mo)."*
4. **Append** a follow-up `0.10.x` row for visual feedback (PR-D):
   `0.10.x | Visual feedback · rain ramp at deadline (C-06) ·
   WorldFrame.effects wired end-to-end (C-07) · debrief panel as
   newspaper pages (D-07) · lit windows + fog-on-deadline (D-09) |
   Renderer-side polish on FxEvent contract from PRE-0.10 | strong`.
5. **Advance** the "Current status" block: v0.9 shipped; v0.9.1 ships the
   re-eval (this PR); PRE-0.10 is the next paper slot.
6. **Append** a `- [x] **RE-EVAL after 0.9**` history entry below the
   v0.9 entry, mirroring the v0.6.1 entry's shape, citing this document
   and [`../design/spec-vs-code-review-0.9.html`](../design/spec-vs-code-review-0.9.html).

## 5. Out of scope (preserved boundaries)

- **No JS / test changes** in this session — strict paper-only per
  [`../AGENTS.md`](../AGENTS.md) §Hard rules and METHODOLOGY §3.2. The
  audit's 7 criticals + 9 drifts all wait on their tickets.
- **ICD-01 v0.6 / ICD-06 v0.4 / ICD-07 v0.1 authoring** — surfaced here,
  scheduled to PRE-0.10 (paper-only) per the surface-and-schedule
  pattern.
- **The four Gitea tickets** — created out-of-tree alongside this PR;
  named in §3 step 6. Ticket content cites this document and the audit
  HTML; the markdown is the source of truth for scope.
- **ICD-02 v0.2.1 → v0.2.2** — surfaced at §3.5 Q2; lands at PR-A in-PR
  per Constraint #4, not at PRE-0.10.
- **Tier-1 architecture** — gated behind the Tier-0 → Tier-1 RE-EVAL
  slot (roadmap line 35). Audit P-01 / P-03 / P-06 / P-07 / P-09 / P-10
  / P-11 all park there.

## 6. Summary

- **Six ICDs intact.** Twelve code milestones in, zero interface drift.
  Constraint #4 honored every time. The methodology is working.
- **Nine acknowledged drifts** at the design-doc-to-code level (audit
  D-01 through D-09). All flagged in code comments at the deviation
  site. None require breaking an ICD.
- **Seven critical findings** (audit C-01 through C-07). Three are
  10-LOC mechanical fixes (C-01 Press HP repair · C-02 raid_succeeded
  emit · C-03 new-run button); one is the load-bearing 0.10 spawner
  (C-04); one is a 30s-debrief wording fix coupled to an ICD-06 edit
  (C-05); two are visual-feedback beats blocked on the ICD-01 v0.6
  `FxEvent` authoring (C-06 rain ramp · C-07 effects channel).
- **Fourteen gaps** (audit G-01 through G-14). Seven land at milestone
  0.10 (PR-C); seven are Tier-1.
- **Eleven explicit parks** (audit P-01 through P-11). Discussion docs,
  ICD §Open questions, fuzzy-band notes. Carried forward.
- **One band promotion:** HUD corkboard medium → strong (overview line
  45). Justified by the §13 pixel-honest layout shipping at 0.9 and the
  ICD-01 v0.6 additions being load-bearing on it.
- **One scheduled paper slot — PRE-0.10** — authors ICD-01 v0.6 +
  ICD-06 v0.4 + ICD-07 v0.1 (new audio bus). Gates milestone 0.10.
  Ships at v0.9.2.
- **Tier-0 exit criteria confirmed:** *"5-edition arc · run-end summary
  · high-score persistence"* + lead-spawn engine + districts + Branch
  + grammar + tutorial + minimum controls. The audit's PR-C scope is
  the locked shape of 0.10; split into 0.10.0 / 0.10.1 at session open
  if scope creeps.
- **0.10 is gated by PRE-0.10.** Once PRE-0.10 ships, milestone 0.10
  opens as a code session with all required ICD bumps in hand.

The contracts are ready to carry the closer. The gap between the
codebase and the design package today is content (districts, grammar,
tutorial, audio) and feedback (rain ramp, effects channel, debrief
animation) — not contract drift. Milestone 0.10 is the substrate that
turns *the loop plays* into *the loop reads as a game.*
