# Changelog

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
