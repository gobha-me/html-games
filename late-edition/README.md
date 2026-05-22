# Late Edition

A noir RTS where the player runs a 1940s newspaper that's a front for an
information empire. Deploy reporters across a fog-soaked city, convert leads
into stories, hit the print deadline every 12 in-game minutes, and defend the
press from rival papers and crime bosses. Build → defend → upgrade fused with
resource optimization on a print-cycle clock.

## Status

**v0.10.2 — PR-D visual feedback (Tier-0 closes).**
The closing post-0.9 audit PR — rain ramp at deadline (C-06), the
`WorldFrame.effects` channel wired end-to-end (C-07 — `pickup` · `verify` ·
`print` · `death` · `raid_warning`), debrief panel as newspaper pages
(D-07), and lit windows + fog-pull-on-deadline (D-09). Pure renderer +
DOM/CSS layered on top of five small sim emit sites. ICD-01 → v0.6.2
(`rain.intensity` range-comment widen; no shape change). Tests at
199 cases (179 → 199). Closes Gitea issue #299; Tier-0 audit (post-0.9)
fully landed. Next: Tier-0 → Tier-1 re-eval slot. See
[`roadmap.md`](roadmap.md) and [`CHANGELOG.md`](CHANGELOG.md).

**v0.10.1 — Onboarding (WASD pan · Block zoom · slow-mo · diegetic tutorial).**
G-07 minimum control surface and G-09 diegetic tutorial coupled as the
second half of the Tier-0 closer.

**v0.10.0 — PR-C substrate (Tier-0 closer · substrate half).**
Code session against the milestone 0.10 closer authored at PRE-0.10.
The roadmap's authorized 0.10.0/0.10.1 split (precedent: 0.7.0 / 0.7.1)
lands five of the seven items here; the remaining two (G-09 diegetic
tutorial · G-07 minimum control surface) defer to **0.10.1 (onboarding)**.
**C-04 — Lead-spawn engine.** New pure module
[`js/sim/lead-spawner.js`](js/sim/lead-spawner.js) — Design Doc §19's
"1 lead per ~90s per covered district, ×0.5 if uncovered, 70/25/5 tier
roll, 180s decay" — replaces the 0.3-era hardcoded single-lead spawn so
every edition after the first no longer fires with zero stories
(*"reads as a game"* per the post-0.9 re-eval §3.5 Q1). Deterministic
via a `SeededRng` stream that round-trips through the save blob.
**G-04 — Districts as data.** New pure module
[`js/sim/districts.js`](js/sim/districts.js) ships two records at
Tier-0 — **The Docks** (vice/violence-leaning · SW) and **Hillside**
(money-heavy · NE) — each with a spawn rect, a covering bureau-family
tag, per-district flavor weights, and an actor pool. `DistrictId`
becomes a real union per ICD-01 v0.6's `LeadView.district` projection.
**G-01 — Branch Bureau.** Second bureau-family building at tile (8, 3)
inside the Hillside spawn rect. HP 20 (squishy per §15 *"1 goon takes
them out in 20s"*). Reporters drop at either bureau-family building;
photogs likewise pick up from either. Branch destruction does NOT
trigger `CYCLE_GAME_OVER` — only the main Bureau drives the §17 single
fail-state. **G-05 — Slot-grammar headlines.** New pure module
[`js/sim/headlines.js`](js/sim/headlines.js) implements Design Doc §18's
actor-verb-object grammar with flavor-tagged verbs and tier prefixes
("EXCLUSIVE · " for Investigation). Story shape gains an optional
`headline` field set deterministically at spawn time. **G-13 — Run-end
summary + high-score persistence.** New `World.runStats` rolls revenue
+ editions + top headline across the run; `'late-edition.scores.v1'`
hosts a cross-run sorted-desc cap-at-10 high-score list; the existing
game-over overlay now renders the run summary card (editions · revenue
· top headline · rank · top-5 board) inside the same terminal mount,
preserving the "Start a new run" exit. **ICD bumps (Constraint #4):**
ICD-01 → v0.6.1 widens `BuildingKind` for `'branch_bureau'`; ICD-04 →
v0.1.1 settles the `rng_seed` semantics (live PRNG state, not initial
seed), adds the `lead_spawner` + `run_stats` blocks, and documents the
new `SCORES_KEY` with full `HighScoreBlobV1` schema — all
backward-compatible via optional-field reads (no migration). Tests at
**159 cases** (124 → 159 — five new test files covering the substrate
modules). Next: **0.10.1 (onboarding)** — diegetic tutorial copy + WASD
pan / Block zoom / slow-mo control surface. See
[`roadmap.md`](roadmap.md) and [`CHANGELOG.md`](CHANGELOG.md).

## How to navigate

1. Open `index.html` in a browser (or click the **Late Edition** card
   from the arcade launcher). You'll see the cel-shaded world with two
   buildings (Bureau in the center, Darkroom to the southeast), four
   units (Reporter north of the Bureau, Photog south, Fixer east —
   distinguishable by trench coat + brim + red kerchief — Editor west
   in a green visor + dark vest), a lead at the northwest district
   tile, and a HUD ticker top-right showing
   the corkboard HUD (top: seven pinned index cards · viewport: a
   torn-edge deadline ticker · bottom: Selected / Story queue /
   Threats dossier panels) counting down from 12:00. **Left-click a unit** to select (a yellow ring
   appears — the Editor and Goon don't get rings, they're not player
   controlled). **Right-click anywhere on the street grid** to
   dispatch — the unit walks the A*-shortest path. Left-click empty
   ground to deselect. The story flow: Reporter to the lead
   (auto-pickup; LD drops to 0), Reporter back to a Bureau-adjacent
   tile (auto-drop); Photog to a Bureau-adjacent tile (picks up the
   held lead), Photog to a Darkroom-adjacent tile (drop flips state to
   `'verified'`; ST ticks to 1). The verified story then waits at the
   Darkroom; when the 12-minute deadline fires, the Editor plates and
   the debrief panel mounts with the front page and the resources
   reconcile (cash earned, ink consumed, heat applied). **If
   `INK` is too low for the story's ink cost, the plating is
   rejected** — the story stays `verified` at the Darkroom and tries
   again next edition (ink stays where it was). Click anywhere on the
   panel to dismiss; heat decays by the §19 baseline and the next
   edition opens. After the second edition with heat above 40, the
   Evening Star may fire a `RAID_BUREAU` — look for a Goon (dark coat,
   no select ring) at the NW grid edge walking toward the Bureau.
   **Right-click the goon's tile while the Fixer is selected** to
   intercept — Fixer beats one goon, two goons beat one Fixer. If
   goons reach the Bureau, the `X HP` segment drains at 1/s; at 0,
   the "THE PRESS BURNS" overlay mounts and the run ends.
2. The in-page **Phase 0 + Roadmap →** link (top-right of the scene) opens
   the architectural supplement (also reachable directly at
   [`design/phase-0-roadmap.html`](design/phase-0-roadmap.html)).
3. Read [`roadmap.md`](roadmap.md) for the milestone list in plain markdown.
4. Read [`architecture/00-overview.md`](architecture/00-overview.md) for the
   strong/medium/fuzzy banding in markdown.
5. Open the [`icds/`](icds) directory for the six interface contracts (01,
   02, 03, 04, 05, 06) that gate the code sessions. All six are now
   authored — ICD-04 (save schema) shipped at PRE-0.8.

## Tech stack (planned)

- **three.js** (via ES module CDN) for cel-shaded toon 3D — MeshToonMaterial,
  3-step gradient map, EdgesGeometry outlines @ 25°, linear fog 22→60.
- **Orthographic isometric** camera, WASD pan, click-to-dispatch.
- **localStorage JSON** for saves (one versioned blob).
- **Browser-only, single-player MVP.** No backend, no netcode, no auth.

Architecture must not foreclose later multiplayer / cloud saves / procedural
city generation — those are post-MVP. See
[`architecture/00-overview.md`](architecture/00-overview.md) for the fuzzy band.

## File layout

```
late-edition/
├── index.html              # the playable scene host (milestone 0.1+)
├── README.md               # this file
├── CHANGELOG.md            # version history
├── AGENTS.md               # routing doc for future code sessions
├── METHODOLOGY.md          # LLM-assisted-development methodology, verbatim
├── roadmap.md              # milestone list (markdown mirror of §04)
├── architecture/
│   └── 00-overview.md      # strong/medium/fuzzy banding (markdown)
├── icds/                   # interface control documents (draft)
│   ├── ICD-01-world-renderer.md
│   ├── ICD-02-rival-world.md
│   ├── ICD-03-unit-pathfinder.md
│   ├── ICD-04-save-schema.md
│   ├── ICD-05-story-lifecycle.md
│   └── ICD-06-print-cycle.md
├── discussion/             # pre-architecture parking spots
│   ├── observer-violence.md
│   ├── rival-state-visibility.md
│   ├── difficulty-selector.md
│   ├── tutorial-first-edition.md
│   ├── accessibility.md
│   └── yellow-establishment-branch.md
├── deferred/               # explicit deferrals (empty until something lands)
├── design/                 # the original design package (pixel-perfect)
│   ├── design-doc.html         # master design doc
│   ├── phase-0-roadmap.html    # Supplement B (was the landing; now linked)
│   ├── rival-ai-spec.html      # Supplement A
│   └── audio-manifest.html     # Supplement C
└── js/
    ├── main.js             # entry point — sim loop + interp
    ├── input.js            # left-click select / right-click dispatch
    ├── hud.js              # ticker DOM projection
    ├── debrief-panel.js    # edition debrief overlay
    ├── game-over-overlay.js# 0.7.0 fail-state overlay
    ├── sim/
    │   ├── world-state.js  # authoritative grid + units + stories + rivals
    │   ├── pathfinder.js   # A* (ICD-03)
    │   ├── cycle-clock.js  # 12-min print cycle (ICD-06)
    │   ├── resources.js    # cash/ink/heat yield tables
    │   ├── seeded-rng.js   # 0.7.0 deterministic PRNG
    │   ├── evening-star.js # 0.7.0 rival state machine (ICD-02)
    │   └── save.js         # 0.8 localStorage save/load (ICD-04 v0.1)
    └── render/
        └── renderer.js     # three.js cel-shaded toon world
```

## Design package

The four design HTMLs in [`design/`](design) are the **source of truth** —
authored in Claude Design (claude.ai/design), checked in unchanged. The
markdown docs in this directory mirror specific sections for code-session use;
when the two disagree, the source HTML wins.

- [`design/design-doc.html`](design/design-doc.html) — the master design doc
  (pitch, visual system, world, core loop, resources, buildings, units,
  rivals, defense, tech tree, camera/HUD/audio, three.js notes, story engine,
  balancing, decisions locked, still-TBD).
- [`design/phase-0-roadmap.html`](design/phase-0-roadmap.html) — **Supplement
  B**, this page. Architecture banding, ICDs, roadmap, paper-vs-design
  triage, Monday plan.
- [`design/rival-ai-spec.html`](design/rival-ai-spec.html) — **Supplement
  A**. State machines for Herald / Evening Star / Observer, transition
  tables, interaction matrix, difficulty curve, pseudocode.
- [`design/audio-manifest.html`](design/audio-manifest.html) — **Supplement
  C**. 60 audio prompts: 6 ambient beds, 6 music stems, 24 SFX, 60 VO lines,
  phased to milestones.
