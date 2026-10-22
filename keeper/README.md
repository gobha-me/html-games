# Keeper

Keep the light on Skerry Rock through a black, fog-bound night. A trawler's
course crosses the Teeth. Find her with the beam and broadcast the horn early
enough for her crew to turn away. Failure stays with you until morning.

## How to play

Open `keeper/` from the arcade using a static server at the repository root.
Select **Take the watch**. The first watch lasts three real minutes; the
unwarned trawler reaches the reef around 91 seconds. The default 12-second
sweep guarantees at least four passes before the last safe warning time.
Slowing or holding deliberately trades those chances for attention elsewhere.

- **← / A**, **→ / D**: slow / accelerate clockwise rotation (30–6 seconds
  per revolution; default 12). Release to keep the selected speed.
- **Space**, held: clutch the lens on its current bearing.
- **H**, held: sound the broadcast horn. Every ship in fog-limited audible
  range hears it, even off-beam. Endangered captains turn after a seeded crew
  delay; safe ships hold course. Last-second warnings can still end in a wreck.
- **Esc / P**: pause. **?**: controls. Focus loss also pauses and releases keys.
- **Mute horn** silences audio without changing the warning mechanic.

Controls appear on the title card and briefly over the watch (eight seconds,
or until first input), as well as the persistent bottom bar and **?** card.

The faint dotted marks are the keeper's chart, not visible rocks. A ship's hull
is visible only in the cone or a fading 1.5-second remembered image. Running
lights can show within half the fog reach. False alarms reduce captain trust,
slowing reactions and making warnings less likely to be followed. Each press
is one broadcast; holding sustains the sound without warning newly arriving
ships. Only a reef impact within 120 seconds counts as danger. Trust recovers
by 1% per simulated second. The fourth blast in under 20 seconds makes skippers
ignore horns for 30 seconds; ignored blasts also erode trust and do not extend
that window. Expanding rings show each blast even when muted; dashed, dim rings
mean it was ignored. The HUD shows current skipper trust. The future Morse
lamp addresses only the vessel in the beam.

## Tech

Vanilla HTML/CSS/ES modules, Canvas 2D, a pure deterministic seeded simulation,
and a synthesized WebAudio horn. No build step or runtime dependencies.
Respects reduced motion by stopping fog drift. Designed for desktop ≥1280×720.

From `keeper/` (Node ^22.22 or ≥24.8):

```sh
npm ci
npm run lint
npm run test:coverage
npx playwright install chromium
npm run test:e2e
```

Playwright serves the repository root with `python3 -m http.server` on port
8124. Its explicit `?e2e=1` mode, only under browser automation, exposes
`window.__keeper` with read-only seed/state snapshots and a simulation advance
helper. It does not exist during normal play. Tests use real keyboard input;
the helper compresses the wait for dawn without altering the course or outcome.

## Status

Issue #108: first playable, one trawler / one three-minute watch. Start, pause,
controls, restart, safe/wrecked dawn summary, and a versioned last-watch record
in localStorage. Invalid or inaccessible storage never prevents play. In-progress
resume, the keeper's log, Morse (K/L), additional ships/nights, and ambient
wind/sea audio belong to later milestones. The full design is in
[docs/DESIGN.md](docs/DESIGN.md); this milestone intentionally shortens the night.
Issue #118 adds pure sweep-budget helpers, schedule rejection on load/start,
a retuned radial trawler and a fast-ship engine-cue stub for #115. The five
night pass minima are defined; additional nights and engine audio remain future work.
Issue #120 adds deterministic rudder/Nomoto hull physics, broadcast horns for
the fleet, physical PONR budgeting, and smooth rendered turns. Four hull types
are tuned and tested; the first watch still spawns only one trawler.
Issue #109 completes the foghorn trust/recovery and spam rules, with muted-play
visual rings and a trust readout.

## File layout

- `index.html`, `css/keeper.css` — interface and layout.
- `js/physics.js` — pure hull dynamics, tactical diameter, horn broadcast and PONR.
- `js/sim.js` — seeded world, beam, perception, horn reaction, collisions, dawn.
- `js/main.js` — keyboard, browser clock, panels, storage adapter.
- `js/renderer.js`, `js/audio.js` — canvas and horn adapters.
- `js/keys.js` — shared bindings and control labels.
- `js/record.js` — defensive versioned morning-record parser.
- `tests/`, `e2e/` — adversarial Node tests and Playwright browser tests.
