# Late Edition

A noir RTS where the player runs a 1940s newspaper that's a front for an
information empire. Deploy reporters across a fog-soaked city, convert leads
into stories, hit the print deadline every 12 in-game minutes, and defend the
press from rival papers and crime bosses. Build → defend → upgrade fused with
resource optimization on a print-cycle clock.

## Status

**v0.6.0 — milestone 0.6 (cash · ink · heat).** The economy lights up.
Each printed Story now carries a `cash_yield` / `heat_yield` / `ink_cost`
set at the plated step from [`js/sim/resources.js`](js/sim/resources.js)
(Design Doc §06 + §19 first-pass numbers, medium-band). `EditionSummary`
aggregates the deltas, `World.resources` accumulates them across editions,
and `ackDebrief()` applies the §19 baseline heat decay between editions.
The HUD ticker now reads
`EDITION N · MM:SS · X LD · X ST · X INK · $X · X HEAT` —
single-line strip preserved so the corkboard layout at milestone 0.9 can
grow it without churning [`js/main.js`](js/main.js). Sim still under
[`js/sim/`](js/sim) (state + A* pathfinder + `cycle-clock.js` + new
`resources.js`), renderer under [`js/render/`](js/render). 53 node tests
cover the pure sim modules. Next is the **post-0.6 RE-EVAL** (paper +
code-aware) — does the loop play? Promote rival AI contract to strong
for 0.7–0.8? See [`roadmap.md`](roadmap.md) and [`CHANGELOG.md`](CHANGELOG.md).

## How to navigate

1. Open `index.html` in a browser (or click the **Late Edition** card
   from the arcade launcher). You'll see the cel-shaded world with two
   buildings (Bureau in the center, Darkroom to the southeast), two
   units (Reporter north of the Bureau, Photog south of it), a lead at
   the northwest district tile, and a HUD ticker top-right showing
   `EDITION 1 · 12:00 · 1 LD · 0 ST · 20 INK · $0 · 0 HEAT` counting
   down. **Left-click a unit** to select (a yellow ring appears).
   **Right-click anywhere on the street grid** to dispatch — the unit
   walks the A*-shortest path. Left-click empty ground to deselect. The
   story flow: Reporter to the lead (auto-pickup; LD drops to 0),
   Reporter back to a Bureau-adjacent tile (auto-drop); Photog to a
   Bureau-adjacent tile (picks up the held lead), Photog to a
   Darkroom-adjacent tile (drop flips state to `'verified'`; ST ticks to 1).
   The verified story then waits at the Darkroom; when the 12-minute
   deadline fires, the debrief panel mounts with the front page and the
   resources reconcile (cash earned, ink consumed, heat applied). Click
   anywhere on the panel to dismiss; heat decays by the §19 baseline and
   the next edition opens.
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
    └── world.js            # milestone 0.1 — scene · camera · toon · rain
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
