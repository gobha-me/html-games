# Architecture overview — Late Edition

Source of truth: [`../design/phase-0-roadmap.html`](../design/phase-0-roadmap.html)
§02 (Architecture Banding). This document is the markdown mirror — when the two
disagree, the supplement wins. Section headers carry their band; **unlabeled is
strong**.

## Band legend

| Band | Meaning |
|---|---|
| **strong** | Load-bearing for the next 3 milestones. Code sessions comply as written. Deviation requires an architecture session and a doc update. |
| **medium** | Committed direction. Wording tightens into strong as the milestone window approaches. |
| **fuzzy** | Sketch beyond the horizon. Narrative coherence, not authority. Code sessions do not cite these as constraints. |
| **discussion** | Pre-architecture. Open questions parked in [`../discussion/`](../discussion). Not a commitment. |
| **re-eval** | Paper session. No code. Tightens bands, ratifies deviations. |

Horizon: **N = 3 milestones, M = 7** (small-team / high-cadence defaults from
[`../METHODOLOGY.md`](../METHODOLOGY.md)). Re-eval cadence: every 3 milestones,
plus before every band-tier transition.

## Strong — load-bearing for the vertical slice

| Commitment | Notes | Source |
|---|---|---|
| **The print cycle (12 min/edition)** | The heartbeat. Everything is on the clock. Tested by milestones 0.1–0.5. | Design Doc §05 |
| **Five resources (Leads, Stories, Ink, Cash, Heat)** | Names locked. Heat is reverse currency. Cash is least interesting on purpose. | Design Doc §06 |
| **Single fail-state — the Press** | One Bureau, one press, 90 HP. Loss of press = run end. No other terminal conditions. | Design Doc §10 |
| **Cel-shaded toon pipeline** | MeshToonMaterial · 3-step gradient map · EdgesGeometry outlines @ 25° · linear fog 22→60. Proved in the feel test. | Design Doc §03 · §15 |
| **Camera + input model** | Orthographic isometric, WASD pan, click-to-dispatch. Touch is supported, not optimized. | Design Doc §13 · §17 (decisions locked) |
| **Reporter unit core** | HP 2, walk 3.5 u/s, carries 1 lead, dispatched by click. Other units inherit this skeleton. | Design Doc §08 · §19 |
| **Lead → Story lifecycle** | Lead spawns in district · reporter picks up · returns to bureau · photog verifies · editor plates · prints in next edition. The data model. | Design Doc §05 |
| **Save = single localStorage JSON** | One blob. Versioned. Migrations defined. MVP only — no backend. | Design Doc §17 (locked) |
| **Browser-only, single-player MVP** | No netcode, no auth, no backend. Architecture must *not* foreclose later MP. | Design Doc §17 (locked) |
| **HUD corkboard layout** | §13 pixel-honest layout shipped at milestone 0.9; load-bearing for ICD-01 v0.6's `UnitView.stats` · `LeadView.district` · `WorldFrame.rivals` additions. **Promoted medium → strong at the post-0.9 re-eval.** | Design Doc §13 · promoted post-0.9 |
| **Arc framework (three-tier story engine · slot grammar · spawn engine)** | §18 three-tier shape (Whispers ~70% · Investigations ~25% · Arcs ~5%) + §18 slot grammar + §19 spawn rate / tier roll / decay all shipped end-to-end at the Whisper level via [`../js/sim/headlines.js`](../js/sim/headlines.js) + [`../js/sim/districts.js`](../js/sim/districts.js) + [`../js/sim/lead-spawner.js`](../js/sim/lead-spawner.js) (0.10.0 substrate). Load-bearing for every Tier-1 story milestone (Investigation chain wiring · Arc trigger conditions · Observer counter-narrative slots). **Promoted fuzzy → strong at the Tier-0 → Tier-1 re-eval.** Investigation chains stay medium; the eight authored Arcs stay fuzzy (content, not framework). | Design Doc §18 · §19 · promoted Tier-0→Tier-1 |

## Medium — committed direction, tightens later

| Commitment | Notes | Source |
|---|---|---|
| **Full 8-building catalogue** | Only 3 needed for vertical slice (Bureau, Branch, Darkroom). Other 5 tighten as Tier-1 approaches. | Design Doc §07 · medium until 1.x |
| **Full 6 unit types** | Only 3 in slice (Reporter, Photog, Fixer). Editor/Tipster/Stringer tighten when needed. | Design Doc §08 · medium until 1.x |
| **Rival AI state machines** | Specced in [`../design/rival-ai-spec.html`](../design/rival-ai-spec.html); pseudocode is illustrative. Each rival's contract goes to strong when its milestone enters the N-window. | Rival AI Spec · medium |
| ~~Story slot grammar~~ | *Subsumed by the arc-framework promotion to Strong at the Tier-0 → Tier-1 re-eval. The slot grammar is part of the framework; `headlines.js` implements it deterministically against the §18 spec.* | Design Doc §18 · **subsumed** |
| **Investigation chains (3-step)** | Design Doc §18 line 1370 — verifying one Investigation lead spawns a follow-up lead, which spawns a third. Substrate ([`../js/sim/lead-spawner.js`](../js/sim/lead-spawner.js)) tier-rolls `'investigation'`; chain wiring lands at Tier-1 (ICD-10's `parent_story_id`). Tightens to strong when 1.x chain milestone enters the N-window. | Design Doc §18 · medium |
| **First-pass balancing numbers** | §19 numbers are *starting points* — they will move during playtest. Treat as medium, not strong. | Design Doc §19 · medium |
| ~~HUD corkboard layout~~ | *Moved → strong band at the post-0.9 re-eval (PRE-0.10 carries the overview edit). §13 pixel-honest layout shipped at milestone 0.9; load-bearing for ICD-01 v0.6.* | Design Doc §13 · **promoted** |
| **Heat economy thresholds (40/60/80)** | Tiered triggers are committed; specific numbers shift in playtest. | Design Doc §19 · medium |

## Fuzzy — sketch beyond the horizon

| Commitment | Notes | Source |
|---|---|---|
| **18+ districts of the canonical city** | 4 in vertical slice, more later. District-as-data shape needs to be strong; district contents are fuzzy. | Design Doc §04 · fuzzy |
| **8 authored arcs — content** | The **framework** is promoted to Strong (above) at the Tier-0 → Tier-1 re-eval. Actual arc **content** (headlines, branch tables, episode copy — ~12 working days of narrative writing per Design Doc §18) stays fuzzy until late-T1/T2 content slots. ICD-10 (PRE-1.0) authors the `StoryArc` record shape that the eight arcs slot into. | Design Doc §18 · fuzzy content (framework strong) |
| **Tech tree branches (Yellow / Establishment)** | The branch detection heuristic, ending content, all fuzzy. | Design Doc §11 · §20 TBD |
| **Procedural city generation** | Post-MP feature. City-as-data shape must not foreclose it. Implementation is fuzzy. | §17 locked (decision) |
| **Multiplayer + accounts + cloud saves** | Future. Architecture's job today is to avoid hardcoded single-player assumptions in authoritative state. | §17 locked (decision) |
| **Radio announcer VO** | Hand-written + recorded. No code dependency. Fuzzy until T2. | Design Doc §14 · fuzzy |
| **Audio system at large** | Direction is set; asset list and engine selection are unspecified. | Design Doc §14 · §20 TBD |

## Discussion — pre-architecture, not commitments

The six files in [`../discussion/`](../discussion). Code sessions do not cite
these as constraints; they're parking spots until they get promoted to
architecture or deferred.

- [`observer-violence.md`](../discussion/observer-violence.md) — should the Observer ever fight back?
- [`rival-state-visibility.md`](../discussion/rival-state-visibility.md) — direct visibility vs inference
- [`difficulty-selector.md`](../discussion/difficulty-selector.md) — frequency-scaling vs aggression-scaling
- [`tutorial-first-edition.md`](../discussion/tutorial-first-edition.md) — diegetic onboarding beat
- [`accessibility.md`](../discussion/accessibility.md) — motion, audio cues, color, deadline non-visual signal
- [`yellow-establishment-branch.md`](../discussion/yellow-establishment-branch.md) — cumulative-heat heuristic
