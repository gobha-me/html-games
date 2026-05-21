# Late Edition

A noir RTS where the player runs a 1940s newspaper that's a front for an
information empire. Deploy reporters across a fog-soaked city, convert leads
into stories, hit the print deadline every 12 in-game minutes, and defend the
press from rival papers and crime bosses. Build → defend → upgrade fused with
resource optimization on a print-cycle clock.

## Status

**v0.9 — HUD corkboard · deadline ticker · dossier.** The HUD lifts
from a single-line ticker to the corkboard the design doc §13 always
called for. Seven pinned index cards along the top (Edition / Deadline
/ Leads / Stories / Ink / Cash / Heat); a typewriter-ribbon deadline
strip across the top of the 3D viewport (red at ≤60s, pulsing red at
≤10s); three dossier panels along the bottom — Selected (kind / state
/ carrying), Story queue (active leads + tier & flavor histograms +
in-flight count), and Threats (goon count + Press HP). Pure renderer-
side reorganization on top of the already-locked
[`HudState`](icds/ICD-01-world-renderer.md) / `UnitView` /
`BuildingView` / `LeadView` projections. The `<body>` becomes a
four-row CSS grid; `#world` keeps its full-bleed canvas in the `1fr`
row because the renderer already reads
`root.clientWidth/Height`. [`js/hud.js`](js/hud.js) becomes a
`HudCorkboard` facade with three sibling region projectors
(`TopCards`, `DeadlineStrip`, `Dossier`) — each diffs its own DOM at
its natural change cadence. Projection helpers (`pickSelected`,
`countByKind`, `tierHistogram`, `formatMs`, `formatEdition`) are
named exports so [`tests/hud.test.mjs`](tests/hud.test.mjs)
exercises them in node without jsdom. **Zero ICD changes** — every
field consumed at 0.9 was already projected at v0.8 or earlier.
ICD-01 bump candidates surfaced by 0.9 (UnitView stat badges,
LeadView.district, WorldFrame.rivals for raid ETA) are parked for
the post-0.9 re-eval. Tests at 113 cases (106 → 113). See
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
