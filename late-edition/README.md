# Late Edition

A noir RTS where the player runs a 1940s newspaper that's a front for an
information empire. Deploy reporters across a fog-soaked city, convert leads
into stories, hit the print deadline every 12 in-game minutes, and defend the
press from rival papers and crime bosses. Build → defend → upgrade fused with
resource optimization on a print-cycle clock.

## Status

**v0.0.1 — Phase 0 (architecture-only).** The game is not yet playable. This PR
ships the design package, the architecture skeleton, and the first six ICDs.
First playable milestone is **0.1** (scene + camera + toon pipeline + fog +
rain + ground grid, lifted from the feel test). See
[`roadmap.md`](roadmap.md).

## How to navigate

1. Open `index.html` in a browser (or click the **Late Edition** card from the
   arcade launcher). You'll see **Phase 0 + Roadmap** — the supplement that
   bands every architectural commitment and lays out the Tier-0 roadmap.
2. Read [`roadmap.md`](roadmap.md) for the milestone list in plain markdown.
3. Read [`architecture/00-overview.md`](architecture/00-overview.md) for the
   strong/medium/fuzzy banding in markdown.
4. Open the [`icds/`](icds) directory for the six interface contracts that
   gate the next code session.

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
├── index.html              # Phase 0 + Roadmap (pixel-perfect from design)
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
│   ├── phase-0-roadmap.html    # this page, as standalone
│   ├── rival-ai-spec.html      # Supplement A
│   └── audio-manifest.html     # Supplement C
└── js/
    └── feel-test.js        # three.js cel-shaded feel-test (for milestone 0.1)
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
