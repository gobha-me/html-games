# Backbeat logic and chart-tool tests

Run from the repository root with Node 22.22+ and Python 3:

```sh
node --test --test-concurrency=2 backbeat/tests/*.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s backbeat/tests -p 'test_*.py' -v
```

No npm install, browser, audio device, ffmpeg installation or build is required.
Node loads the shipped ES modules directly; on Node 22 it may print a module-type
detection warning because this game has no package.json. Python imports the real
chart generator with bytecode writes disabled and fakes only the ffmpeg
subprocess boundary for CLI tests. Signed PCM impulses pass through the real
decoder, envelope, onset detection, BPM estimation and chart generation.
CLI JSON output uses temporary files
under the environment's TMPDIR. There are no product source edits.

The JS suite covers judgement and grade thresholds, calibration, nearest-note
selection, chords, scoring/combo limits, accuracy/timing statistics, misses,
holds/release/completion, Overdrive, Auto-DJ, finished state, chart immutability,
seed repeatability, note ranges/order/hold overlap and chart fetch fallback.
Python covers signed PCM decoding, energy flux, onset gaps/thresholds, BPM
estimation, density/lane generation and analyze/generate CLI output.

Skipped regressions record existing defects:

- Hold ticks award at most one overdue tick per update call, so score varies with
  frame frequency for identical hold input and elapsed audio time.
- A silent, all-zero energy envelope produces false onsets (`detect_onsets`).
- A buffer of exactly one complete analysis window produces no envelope sample;
  the loop excludes the final complete window (`onset_envelope`).

To reproduce the skipped assertions, opt in (both commands are expected to exit
nonzero with the current product):

```sh
BACKBEAT_RUN_KNOWN_BUGS=1 node --test --test-concurrency=2 --test-name-pattern='update frequency' backbeat/tests/*.test.mjs
BACKBEAT_RUN_KNOWN_BUGS=1 PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s backbeat/tests -p 'test_*.py' -v
```

These tests measure pure logic and external boundary fakes. They do not verify decoded real
audio, audible synchronization, synthesis, canvas rendering, actual keyboard
events or browser performance. The procedural chart matrix covers the current
four tracks/four canonical difficulties with two seeds; it is not an exhaustive
proof over arbitrary input tracks or seed strings.

## Frozen shared-seed regression fixtures

`chart-golden-79053cc.mjs` contains 32 gameplay chart hashes: four roster tracks,
four canonical difficulties and the default seed plus `talos-🕹️-20261123` (including
Unicode). They were captured once with Node 22.23.4 from `config.js` and
`chart.js` obtained by `git show` at unchanged main commit
`79053ccd8c39b87032c9e977946d5cbfa0d596b4`, imported from a temporary directory
under the lane work root. The temporary copy was removed afterward. The product
files in this review checkout were also confirmed unchanged from that commit.

The fixture records the source SHA-256 hashes for provenance:

- `config.js`: `d7032686fa95ce96bc995cfe6a848de745d452e75ec33c3a719d9a56f51a2cf0`
- `chart.js`: `968c8334d26b3ca6a4538be2fddf19e044db1da57a4fd7b4efab6e7586b7652b`

The tested SHA-256 payload is UTF-8 `JSON.stringify` of this ordered shape:
`{bpm, offset, duration, notes: [[time, lane, duration, chord], ...]}`.
It omits generated note IDs, title/artist text, colors, cover URLs and other
presentation metadata. Tests hash the generated gameplay output, never the
current source text; source instrumentation must not itself fail a test.

These hashes preserve regression parity for shareable charts. They are not
independent mathematical proof that a chart is fair or correct. The hand-written
adapter and game boundary cases provide separate expectations for lane filters,
hold/chord/fill spacing, timing, scoring and state transitions. No automatic
fixture-regeneration or repinning command is supplied. A fixture change requires
review of its gameplay effect and provenance, rather than capturing whatever
the current code happens to produce.

The suite does not pin every config label/color or renderer-only lead time to
improve a mutation number. Some constructor values are overwritten before use,
and some mutation changes are equivalent for sorted reachable charts. Such
survivors must remain visible in the mutation report and be assessed there;
they are not silently excluded from the denominator.

## Reviewer regression controls

`reviewer-regressions.test.mjs` checks wrong-lane-only input and a wrong-lane
note closer than the chosen lane's note. Neither can intercept the chosen lane's
press or award its score. Hold-gap fixtures translate the same notes from zero
to 4 and 20 seconds and require identical durations and relative chart shape.
An actual local read of `charts/backbeat-anthem.json` supplies the fetch response
for the shipped Anthem's 169-note / one-hold regression; only the network
boundary is faked. The optional mutation sandbox includes that shipped JSON,
without adding a mutation target.

The exported tour must contain a playable venue before any per-stage checks
run. Stages need distinct nonempty public IDs, supported track/difficulty
references and finite positive goals. This catches complete feature removal
without freezing stage names, colors or a particular number of stages.

Python CLI fixtures place isolated signed PCM impulses 22 analysis hops apart at
22050 Hz. Their first twelve onsets are literal sample-clock expectations, and
their rounded median spacing gives 117.4 BPM. The analyze command must find all
15 impulses while printing only its first twelve. Generate must use actual
detected timing, honor an explicit BPM and thin notes at density 0.5; an empty
decoded buffer still exercises the fallback. There are no patches of
`read_pcm_mono`, `onset_envelope` or `detect_onsets`.

Executed disposable-copy red controls verify assertion failures for all three
reviewed faults: the CLI passing `([], 0)` to the real envelope, removing
`Game.press`'s lane filter, and replacing hold-gap subtraction with addition.
Product files in the working branch remain unchanged. Exact commands/results
and raw transcripts are retained in the slot report and PR verification notes.

## Optional mutation checks

The normal tests require no npm dependencies. `stryker.config.mjs` supports the
optional Stryker 9.6.1 command runner, with two mutation workers and two Node test
workers. From `backbeat/`, with Stryker installed or supplied by npm exec:

```sh
agent-mutate npm exec --yes --package=@stryker-mutator/core@9.6.1 -- stryker run stryker.config.mjs
```

`agent-mutate` is the lane's heavy-work guard; outside this environment, use the
corresponding local resource guard. This command may download optional tooling;
it is separate from the dependency-free unit run. JSON output goes to
`reports/mutation.json`; temporary sandboxes/reports are ignored by git. Coverage
analysis is off, so Stryker runs the whole command for each mutant and reports one
command outcome rather than the individual Node test count. Disclose timeouts
separately from assertion kills and retain survivors in the denominator.

## Measured mutation results

With the same 876 whole-file mutants on main `79053cc`, test kills rose from
536 (61.19% without timeout credit) to the original published 770 (87.90%), then
779 (88.93%) after reviewer repairs. Stryker 9.6.1's score including timeouts
rose from 61.42% to 88.24%, then 89.27%. The final repair run preserves every
prior kill and timeout and kills nine prior survivors: hold-gap subtraction
(60), chart URL (440), lane filter (617), empty tour (467) and five empty
stage IDs (469/477/485/493/501).

Final chart.js: 362 kills / 2 timeouts / 17 survivors; game.js: 311 / 1 / 12;
config.js: 106 / 0 / 65. All 94 survivors stay in the denominator. The original
per-venue checks were vacuous for an empty `TOUR_VENUES`; the new independent
nonemptiness and public-reference case kills that removal and empty IDs.
Stage names, non-C grade colors and the audio URL remain unasserted; the 65
config survivors are not all equivalent or unreachable. Other metadata/render
values are outside this logic suite's intended assertion scope.

Remaining chart/game mutants include default/initialization values, guards not
distinguished by the selected cases, and exact random/occupancy boundary values.
These remain disclosed test gaps, not blanket equivalence claims. The complete
ID/range/replacement inventory and classification are in the repair report and
PR body. The whole selection remains below 90%. Python is tested separately
and is not included in Stryker. No product code, targets or thresholds changed.
