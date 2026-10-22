# PR #101: software-rendering performance

The old test required >100 rAF callbacks in five seconds. GitHub's 2-vCPU
SwiftShader runner supplied 66–81, so it failed before checking renderer cost.
CPU submission and software presentation need separate measurements.

## Diagnosis (local, 2026-10-21)

Chromium/ANGLE SwiftShader, 1920×1080, DPR 1, seed 89 combat preview, CDP
`Emulation.setCPUThrottlingRate: 4`. CPU affinity was additionally limited to two
cores (`taskset -c 0,1`). Displayed map backing size was 595×789, not the entire
viewport; no DPR cap was needed. The existing city/title/edge layers are already
cached, rain already shares one stroked path, and no per-frame `shadowBlur` exists.

The trace includes `late-edition:render` and `late-edition:ui` User Timing measures,
weather/sign/cache subpasses, browser layout/paint, raster flush and draw events.
Times below are local observations, not claims about remote CI:

| 4× CPU diagnostic (`before-pinned` / `after-final`) | Before | After |
| --- | ---: | ---: |
| 150 deterministic render calls, p95 | 5.5ms | 4.8ms |
| Live render submission, p95 | 10.8ms | 9.0ms |
| Live sign pass, accumulated CPU time | 110.0ms / 286 calls | 45.5ms / 289 calls |
| Live weather pass, accumulated CPU time | 63.0ms / 286 calls | 29.3ms / 289 calls |
| Live UI update, p95 | 9.1ms | 6.1ms |
| Five-second rAF intervals | 285 | 288 |
| rAF p95 | 16.8ms | 16.8ms |
| Layout / paint event totals | 26.3 / 19.4ms | 23.3 / 22.4ms |
| Raster flush / compositor draw event totals | 293.6 / 172.6ms | 261.8 / 297.3ms |

These instrumented traces include the subsequent deterministic batch. Event totals
on different threads and nested events overlap; **do not add them as wall time**.
Subpass User Timing adds overhead, and host scheduling varies substantially. An
initial pair measured deterministic render p95 5.4→3.9ms; the confirmation pair
above measured 5.5→4.8ms. The targeted sign/weather work decreased, but there is
**no reliable overall renderer speedup claim** from these noisy traces. The UI
code was unchanged; its p95 variation is not an optimization claim.

An ablation disabling the entire weather pass reproduced **66 rAF intervals** in
5.08s, frame p95 883.2ms. It spent **3210.2ms in raster flushes**, versus 121.6ms
total render submission, 7.3ms layout and 0.6ms paint. Disabling grain alone still
stalled (133 intervals, raster flushes 3590.4ms). Thus neither weather nor grain
alone explains the CI failure shape: software raster/flush scheduling dominates
the stalled traces. The original local suite passed all 68 scenarios, which is
why the CI frame-count failure was easy to miss.

## Changes

- Snapshot lead display geometry and cache sign widths/collision positions.
  In-place position/headline/value/series edits, removal and DPR changes invalidate
  the cache; progress/countdown ticks don't. This removes repeated font measurement.
- Bake drifting fog into a small sprite at displayed size/DPR, retaining its
  world-space movement and tint. Rain stays batched. Existing static city and edge
  layers, gameplay RNG/state and hit targets remain unchanged.
- Bake the original SVG turbulence into `assets/paper-grain.png` once. It retains
  the 120×120 tile, monochrome values, opacity and blend mode without runtime
  turbulence evaluation when paper repaints. Source/provenance and regeneration
  instructions live in `assets/README.md` and `e2e/bake-paper-grain.js`.

## Regression contract

The real live combat renderer is sampled for five seconds. **After** that live
window, ten warm-up calls precede 150 synchronous calls with fixed 1/60s dt and
no simulation stepping. Putting the batch first would queue raster work that
contaminates live pacing. The batch must preserve gameplay hash/RNG and cache
identity. Deterministic **and live** render p95 must be <8ms normally, <16ms with
CDP 4× CPU throttling, regardless of presentation rate. Canvas timing measures CPU
submission (and any synchronous flush), not deferred GPU execution.

Before loading the game, the same foreground page/browser/viewport/DPR measures
at least 1.5s of idle rAF and at least 1.5s with a blank, full-viewport canvas
alternating opaque fills, after 15 warm-up frames per probe. Slow probes extend
until they have 30 intervals. The canvas probe includes basic software
raster/compositing that an empty page can avoid. Both probes must supply valid
data (≥30 intervals, ≥1s, finite timings), otherwise the test **fails**.

When both probes achieve ≥55fps and p95 <20ms, the unthrottled game must also
achieve frame p95 <20ms and >100 live intervals. Otherwise only that presentation
assertion is waived and annotated; all renderer/sample/cache/gameplay assertions
remain mandatory. The game's frame rate and environment variables never control
the waiver. At 4× CPU only renderer budgets apply, and frame pacing is recorded.
The simulation's 50ms catch-up cap makes a minimum *game-second* count dependent on
presentation, so live simulation must advance but isn't required to advance a
fixed number of seconds. All calibration/cost/frame measurements are attached as
`swiftshader-frame-budget` JSON in the Playwright report.

Adversarial tests reject missing/nonfinite/short calibration, require both probes
to be validated even after a slow first probe, preserve p95 tail spikes, and force
<100 rAF samples plus a deliberately >10ms renderer. That test must still collect
150 deterministic calls and expose the excessive cost. Cache tests attack in-place
edits and lead removal, and reject radial-gradient recreation in warm weather.

## Reproduce

Use a supported Node version (see `package.json`). Start the repo's root HTTP
server on port 8123, then from `late-edition/`:

```bash
taskset -c 0,1 node e2e/profile-performance.js before-pinned --baseline=351a5f5
taskset -c 0,1 node e2e/profile-performance.js after
taskset -c 0,1 node e2e/profile-performance.js no-weather --baseline=351a5f5 --no-weather
taskset -c 0,1 node e2e/profile-performance.js no-grain --baseline=351a5f5 --no-grain
npx playwright test e2e/performance.spec.js
```

`--baseline=REV` serves that committed renderer/CSS through Playwright routes
using read-only `git show`; it never checks out or modifies files. The revision
is resolved once at startup. Bare `--baseline` means the current HEAD: pin the
original revision for before/after comparisons if another session may commit.
The original source for this task is `351a5f5`; a concurrent process created
`c6a760a` during verification, so a moving-HEAD comparison was discarded. Omit `taskset` on
platforms without Linux CPU affinity, or choose two available core IDs. Run
profiles without other tests/browsers competing for those cores. The ignored
`performance-results/` directory retains `.trace.json` (Chrome/Perfetto), metric
JSON and before/after screenshots; Playwright can clear `test-results/` without
deleting those diagnostic artifacts.

## Verification (Node 22.22.0, local)

| Check | Before | After |
| --- | ---: | ---: |
| `npm run lint` (ESLint/stylelint/HTML) | pass | pass |
| `npm run test:coverage` | 323/323 pass | 326/326 pass |
| sim line / branch coverage | 100% / 99.01% | 100% / 99.01% |
| `npm run test:e2e` | 68/68 pass | 70/70 pass |

Documentation syntax/reference checks and all 23 checker self-tests also pass.
Final e2e metrics (uninstrumented by CDP Tracing):

| 1080p SwiftShader | Normal CPU | 4× CPU |
| --- | ---: | ---: |
| Deterministic render calls | 150 | 150 |
| Deterministic render p95 | 0.4ms (<8) | 1.5ms (<16) |
| Live render calls | 163 | 302 |
| Live render p95 | 0.6ms (<8) | 3.4ms (<16) |
| Five-second rAF intervals / p95 | 162 / 16.7ms | 301 / 16.7ms |

Both empty-page and canvas calibrations sustained approximately 60fps with p95
16.7–16.8ms. The normal frame assertion was enforced and passed. The 4× run
records pacing while enforcing its renderer budget. JSON metrics are retained
as `performance-results/final-test-1x.json` and `final-test-4x.json`, alongside the
Playwright report. GitHub Actions must still execute the revised contract on its
actual runner.
