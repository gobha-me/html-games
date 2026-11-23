# Backbeat logic and chart-tool tests

Run from the repository root with Node 22.22+ and Python 3:

```sh
node --test --test-concurrency=2 backbeat/tests/*.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s backbeat/tests -p 'test_*.py' -v
```

No npm install, browser, audio device, ffmpeg installation or build is required.
Node loads the shipped ES modules directly; on Node 22 it may print a module-type
detection warning because this game has no package.json. Python imports the real
chart generator with bytecode writes disabled and mocks the ffmpeg subprocess
port and analysis pipeline for CLI tests. CLI JSON output uses temporary files
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

These tests measure pure logic and mocked ports. They do not verify decoded real
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
536 (61.19% without timeout credit) to 770 (87.90%). Stryker 9.6.1's score
including timeouts rose from 61.42% to 88.24%. After hardening, chart.js has
361 kills / 2 timeouts / 18 survivors, game.js has 310 / 1 / 13 and config.js
has 99 / 0 / 72. All 103 survivors stay in the aggregate denominator; many
config survivors are cosmetic metadata or renderer-only values. The whole
selection remains below 90%. Python is tested separately and is not included
in this Stryker score. No product code, targets or thresholds were changed
to improve the reported result.
