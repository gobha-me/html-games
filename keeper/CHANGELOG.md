# Changelog

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
