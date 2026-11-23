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
