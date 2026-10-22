# Changelog

## Unreleased — Seeded additional ships (kspawn)

- Keep the opening trawler's lane, physical warning window and trajectory.
  Add pure deterministic `planSpawns(seed, { night })`, unique ordered ship
  ids, uint32/night rejection, and fixed-tick arrivals into the shared fleet.
  New arrivals travel only their post-spawn fraction of a tick and use the
  existing horn, trust, physics, perception and renderer paths.
- Export frozen `SPAWN` tunables: `firstMin: 24`, `firstMax: 36` seconds;
  `intervalStart: 40`, `intervalEnd: 18` seconds, linearly ramped over the
  180-second watch; `jitter: 0.25` (gap factors 0.75–1.25); `maxActive: 3`
  inclusive overlapping windows, opener included; `lastSpawn: 120` seconds;
  `minBearingGap: 20` degrees circular separation; `threatShare: 0.6`
  candidate probability before rejection. DESIGN §6 documents every field,
  the exact gap formula and conservative active-window reservations.
- Try at most eight seeded candidates per slot, rejecting capacity, bearing
  or fairness failures. Stop at an exhausted slot to preserve accepted-gap
  bounds. Threatening approaches fit the physical sweep budget inside the
  464.8 m worst-fog horizon; clear traffic sails outward beyond the reefs
  and cannot wreck unwarned. Threatening coasters require a later night's
  smaller pass quota. DESIGN §7 records the independent fairness guarantee.
- Persist multiple morning outcomes as version 2 while retaining legacy
  record reads; pluralize fleet summaries. Preserve the renderer's existing
  `state.ships` loop and verify a scheduled arrival's actual canvas pose.
- Add adversarial spawn tests: every arrival across 500 seeds, timing/jitter,
  all-night physical PNR, independently counted passes, inclusive capacity,
  circular bearings, replay, exact arrival boundaries, hitches, clear routes
  beyond dawn, held/repressed horn, rescued fleets, invalid seeds/nights and
  the unchanged opener. Update one-ship summary fixtures to inspect the
  original trawler independently and browser expectations to cover the fleet.
- Verification (Node 22.22.0): `npm run lint` passes with zero warnings;
  `npm run test:coverage` passes all 111 tests with 100% line coverage in
  `sim.js` and `physics.js`; `npm run test:e2e` passes all 17 browser tests.

## Unreleased — Lamp anchor and island pixel detail (kbeam-ISSUE)

- Export immutable chart-space `LAMP`, bearing-validated `beamOrigin()` and
  `toScreen()` using the same backing-pixel transform as drawing. Keep the
  renderer safe to import in Node without reading any browser globals.
- Centre the cone, glow, symmetric lamp housing and brightest glint on one
  lamp point at every bearing. Preserve the overhead view, compass, chart,
  labels, layout and HUD colours.
- Add stepped island tiers, shoreline shading, tower bands, gallery rails and
  lantern detail. Draw foundations below the beam. Surf animates deterministically
  from simulation time and stays static with reduced motion, alongside frozen fog.
- Add Node tests for import purity, thousands of bearings, non-finite rejection
  and screen mapping at several sizes/DPRs. Playwright checks brightest lamp
  pixels and actual cone/glow coordinates at ten bearings, two viewport sizes
  and DPR 1/2, plus deterministic surf and reduced-motion pixel comparisons.

## Unreleased — Foghorn trust and visual rings (#109)

- Bound horn danger and useful-warning credit to straight-track reef impacts
  within 120 seconds, including the endpoint. Distant future reefs hold course
  and count as false alarms. Vessel creation now requires x, y and heading.
- Trust starts at 1, loses 0.25 per false alarm with a zero floor, and recovers
  0.01 per simulated night second with a cap of 1. Lower trust delays reactions
  and reduces the chance captains follow a warning.
- The fourth blast within a strict 20-second window starts 30 seconds of
  ignored horns. Every ignored press loses trust and gives no new ship response;
  presses inside the window never extend it. Holding remains a single blast,
  including when another ship enters range. Pause creates no blasts.
- Expanding two-second horn rings remain visible when muted and after release;
  ignored rings are dimmed/dashed. Skipper trust appears in the HUD and exact
  state remains available in the read-only automation snapshot.
- Adversarial foghorn unit tests cover third/fourth spam, exact timing edges,
  ignore expiry/non-extension, trust bounds/recovery, far reefs, required vessel
  fields and held-horn range entry. Existing physics fixtures use explicit poses
  and bounded threats. Playwright checks canvas pixels/strokes, mute, trust
  recovery and pause/resume horn edges.

## Unreleased — Ship physics and broadcast horn (#120)

- Pure public physics API with four deeply frozen hull specifications, a
  rate-limited rudder, first-order Nomoto yaw, thrust/drag and turning speed
  loss. Fixed 1/60 s substeps remain deterministic through frame hitches.
- Measured tactical diameters: trawler 45.32 m / 3.78 lengths; coaster
  197.99 m / 6.60; speedboat 16.44 m / 2.74; lifeboat 21.92 m / 2.74.
- Horn broadcasts to every audible ship independent of illumination; fog
  attenuates range. Threatened honest captains turn after seeded crew delay,
  safe captains hold, dark launches ignore or veer away from the lighthouse.
  False alarms erode trust. Horn is broadcast; future Morse lamp is directed.
- Fleet simulation/rendering shares physical headings, preserving off-beam
  perception and afterimages. Escape helm anticipates yaw/rudder inertia.
- Physical PONR includes worst reaction delay, rudder/yaw lag and adjacent
  reefs. Generic sweep-budget APIs and independent budget tests are retained;
  live turnRadius carries the measured maneuver allowance. Retuned 1.1 m/s
  trawler spawns at 462.72 m (seed 108), PONR stays at 60 s, unwarned impact
  moves to 91.28 s; time/old horn fixtures updated accordingly.
- Physics shares the sim purity lint guard and coverage gate. Adversarial
  tests cover all hull diameter bands, rudder/yaw bounds, reversal, stationary
  helm, hitches, invalid inputs, seeded fleet hearing, dark launches, false
  alarms and maximum-delay PONR rescue. Browser checks verify a physical
  turning heading reaches the canvas and off-beam broadcast rescues.

## Unreleased — Sweep-budget fairness (#118)

- Pure deterministic sweep counting, backwards spawn-range derivation and
  independent per-ship schedule validation; night minima 4/4/3/3/2 at the
  default 12 s period. Exact endpoint counts include fractional bearings.
- First-watch trawler now uses the same radial speed/response/turn parameters
  as its validated schedule: 60 s of warning before PNR, unwarned wreck near
  65 s. Turned-clear ships count safe while continuing off the chart.
- Invalid schedules visibly refuse to start on load or restart. Fast ships
  expose a bearing/intensity engine-cue hook before visibility (audio in #115).
- Shared controls on the title card and first eight seconds of the watch;
  first input fades the overlay, with reduced-motion support. Bottom bar retained.
- Adversarial simulation and browser checks cover worst phase, fast and
  concurrent boats, N/N−1 boundaries, invalid content, player speed changes,
  live schedule agreement, engine cues, start refusal and control discovery.

## 0.1.0 — First playable (#108)

- Three-minute watch on Skerry Rock, warm 14° clockwise beam, drifting fog,
  charted Teeth, bearing ring and station clock.
- One seeded trawler: repeated sightings, 1.5-second fading last-seen image,
  red/green running lights, early horn avoidance, late-warning wrecks.
- Keyboard speed/hold/horn, two-tone horn with mute, start/pause/controls,
  dawn summary, restart, defensive last-watch record; reduced-motion support.
- Dedicated lint, simulation coverage and browser tooling; launcher and CI wiring.
