# Late Edition

A noir RTS where the player runs a 1940s newspaper that's a front for an
information empire. Deploy reporters across a fog-soaked city, convert leads
into stories, hit the print deadline every 12 in-game minutes, and defend the
press from rival papers and crime bosses. Build → defend → upgrade fused with
resource optimization on a print-cycle clock.

## Status

**v0.7.1 — milestone 0.7.1 (editor · ink hard gate).** The inner three
rings close. The Editor unit
([`js/sim/world-state.js`](js/sim/world-state.js), `kind: 'editor'`)
spawns at `EDITOR_SPAWN_TILE = (4, 5)` — Bureau-adjacent west, the
remaining cardinal slot after Reporter N, Photog S, Fixer E. It is
stationary at the Bureau (Design Doc §17 "Stationed at the Bureau"):
speed 0 in the per-kind table and a `dispatch()` reject pin it to its
tile. At `DEADLINE_FIRE` the plating step substitutes the Editor's
`UnitId` for the placeholder `AUTO_PLATE_SENTINEL` on
`Story.plated_by` per ICD-05 v0.4 §Notes — the sentinel constant
stays exported as the defensive fallback. The ink plate-time hard gate
(ICD-05 v0.4 §Notes) walks the verified queue against a projected
ink budget and admits only stories whose `inkCostFor(story)` keeps
`World.resources.ink ≥ 0`. Skipped stories stay `verified` at the
Darkroom and retry next edition; `EditionSummary.ink_consumed`
reflects the admitted set only. Pure code milestone — no ICD bumps;
ICD-05 stays at v0.4, ICD-01 at v0.5, ICD-02 at v0.2, ICD-06 at v0.3.
85 → 94 node tests (new `editor.test.mjs` + `ink-gate.test.mjs`).
Next slot per the roadmap is **PRE-0.8** — architecture session for
ICD-04 (save schema). See [`roadmap.md`](roadmap.md) and
[`CHANGELOG.md`](CHANGELOG.md).

## How to navigate

1. Open `index.html` in a browser (or click the **Late Edition** card
   from the arcade launcher). You'll see the cel-shaded world with two
   buildings (Bureau in the center, Darkroom to the southeast), four
   units (Reporter north of the Bureau, Photog south, Fixer east —
   distinguishable by trench coat + brim + red kerchief — Editor west
   in a green visor + dark vest), a lead at the northwest district
   tile, and a HUD ticker top-right showing
   `EDITION 1 · 12:00 · 1 LD · 0 ST · 20 INK · $0 · 0 HEAT · 90 HP`
   counting down. **Left-click a unit** to select (a yellow ring
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
5. Open the [`icds/`](icds) directory for the five interface contracts (01,
   02, 03, 05, 06) that gate the next code sessions; ICD-04 is deferred to
   PRE-0.8.

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
    │   └── evening-star.js # 0.7.0 rival state machine (ICD-02)
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
