# Late Edition

A noir RTS where the player runs a 1940s newspaper that's a front for an
information empire. Deploy reporters across a fog-soaked city, convert leads
into stories, hit the print deadline every 12 in-game minutes, and defend the
press from rival papers and crime bosses. Build → defend → upgrade fused with
resource optimization on a print-cycle clock.

## Status

**v0.7.0 — milestone 0.7.0 (adversarial ring · raid · fixer).** The
adversarial ring closes. The Evening Star rival
([`js/sim/evening-star.js`](js/sim/evening-star.js)) ticks every 20 s
through SCAVENGE + RAID + PASS state bodies (the other four states are
shape-committed and caller-triggered to Tier-1); deterministic via a
new seeded PRNG ([`js/sim/seeded-rng.js`](js/sim/seeded-rng.js)). On
heat > 40 with cooldown clear, the rival emits `RAID_BUREAU` with the
heat-banded `goons = 1/2/3` count; the world spawns Goon units at the
NW grid edge walking toward a Bureau-adjacent tile. Adjacent goons
damage the Press at 1 dmg/s (Design Doc §17). The Fixer unit (HP 3,
3.0 u/s) is dispatchable via the existing input model; on adjacency it
1-hit kills the goon; if 2+ goons swarm it, the fixer dies (Design Doc
§rivals "two goons beat one fixer"). Press HP at 0 emits the new
`CYCLE_GAME_OVER` event (ICD-06 → v0.3); the "THE PRESS BURNS" overlay
mounts and the sim freezes. HUD ticker gained an `X HP` segment derived
from `BuildingView.hp` — no `HudState` shape change. The 0.7 milestone
was split at session open into 0.7.0 (this ship — adversarial ring) and
0.7.1 (next ship — Editor unit + ink plate-time hard gate) to keep each
code session inside one milestone's scope. 85 node tests cover the pure
sim modules. See [`roadmap.md`](roadmap.md) and
[`CHANGELOG.md`](CHANGELOG.md).

## How to navigate

1. Open `index.html` in a browser (or click the **Late Edition** card
   from the arcade launcher). You'll see the cel-shaded world with two
   buildings (Bureau in the center, Darkroom to the southeast), three
   units (Reporter north of the Bureau, Photog south, Fixer east —
   distinguishable by trench coat + brim + red kerchief), a lead at the
   northwest district tile, and a HUD ticker top-right showing
   `EDITION 1 · 12:00 · 1 LD · 0 ST · 20 INK · $0 · 0 HEAT · 90 HP`
   counting down. **Left-click a unit** to select (a yellow ring
   appears). **Right-click anywhere on the street grid** to dispatch —
   the unit walks the A*-shortest path. Left-click empty ground to
   deselect. The story flow: Reporter to the lead (auto-pickup; LD
   drops to 0), Reporter back to a Bureau-adjacent tile (auto-drop);
   Photog to a Bureau-adjacent tile (picks up the held lead), Photog to
   a Darkroom-adjacent tile (drop flips state to `'verified'`; ST ticks
   to 1). The verified story then waits at the Darkroom; when the
   12-minute deadline fires, the debrief panel mounts with the front
   page and the resources reconcile (cash earned, ink consumed, heat
   applied). Click anywhere on the panel to dismiss; heat decays by the
   §19 baseline and the next edition opens. After the second edition
   with heat above 40, the Evening Star may fire a `RAID_BUREAU` —
   look for a Goon (dark coat, no select ring) at the NW grid edge
   walking toward the Bureau. **Right-click the goon's tile while the
   Fixer is selected** to intercept — Fixer beats one goon, two goons
   beat one Fixer. If goons reach the Bureau, the `X HP` segment
   drains at 1/s; at 0, the "THE PRESS BURNS" overlay mounts and the
   run ends.
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
