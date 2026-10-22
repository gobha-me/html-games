# Keeper

Keep the light on Skerry Rock through a black, fog-bound night. A trawler's
course crosses the Teeth. Find her with the beam, then hold the horn early
enough for her to turn away. Failure stays with you until morning.

## How to play

Open `keeper/` from the arcade using a static server at the repository root.
Select **Take the watch**. The first watch lasts three real minutes; the
unwarned trawler reaches the reef around 75 seconds. The default sweep gives
several chances to spot her before danger.

- **← / A**, **→ / D**: slow / accelerate clockwise rotation (30–6 seconds
  per revolution; default 12). Release to keep the selected speed.
- **Space**, held: clutch the lens on its current bearing.
- **H**, held: sound the horn. A lit or close vessel reacts, with a two-second
  delay and a turning circle. Last-second warnings can still end in a wreck.
- **Esc / P**: pause. **?**: controls. Focus loss also pauses and releases keys.
- **Mute horn** silences audio without changing the warning mechanic.

The faint dotted marks are the keeper's chart, not visible rocks. A ship's hull
is visible only in the cone or a fading 1.5-second remembered image. Running
lights can show within half the fog reach. Repeated horn blasts (more than
three in 20 seconds) cause skippers to ignore the horn for 20 seconds.

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

## File layout

- `index.html`, `css/keeper.css` — interface and layout.
- `js/sim.js` — seeded world, beam, perception, horn reaction, collisions, dawn.
- `js/main.js` — keyboard, browser clock, panels, storage adapter.
- `js/renderer.js`, `js/audio.js` — canvas and horn adapters.
- `js/keys.js` — shared bindings and control labels.
- `js/record.js` — defensive versioned morning-record parser.
- `tests/`, `e2e/` — adversarial Node tests and Playwright browser tests.
