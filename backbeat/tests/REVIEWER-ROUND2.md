# Reviewer round 2 public regressions

These three additive cases implement the exact public examples in
[PR #149 FINDINGS round 2](https://github.com/gobha-me/html-games/pull/149#issuecomment-7108546524):

- Nine fetched notes at whole-second times zero through eight on Encore must
  produce the complete fill cadence `0.25, 4.25, 6.25, 8.25`, with no fill
  inside the time-two hold. A present hold and later notes make the exclusion
  meaningful. The chart adapter runs unchanged; only `fetch` is replaced at
  its real network boundary, and the returned input must remain unchanged.
- A fetched 33-note Tour chart's time-32 downbeat remains exactly
  `[32, 0, 0.75, false]`: one hold, with no simultaneous chord partner.
- A Club tap at time one, hit early at time `0.9`, remains judged `good` with
  score 140 after Auto-DJ is enabled and updates run at `0.9` and `1`. It
  acquires no active hold, holding/completion flag, hold tick or completion
  bonus. The actual `Game` receives its real public input transition.

No product implementation, unit, PRNG, chart adapter or game state output is
faked. No existing assertion, timeout, tolerance, gate or known-bug skip is
changed. Expected values come from the independent reviewer examples rather
than captured implementation output.

From the repository root, the normal dependency-free checks are:

```sh
node --test --test-concurrency=2 backbeat/tests/reviewer-round2.test.mjs
node --test --test-concurrency=2 --experimental-test-coverage --test-coverage-include='backbeat/js/*.js' backbeat/tests/*.test.mjs
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s backbeat/tests -p 'test_*.py' -v
node --check backbeat/tests/reviewer-round2.test.mjs
git diff --check
```

The focused cases passed 3/3. The full suite passed 114 JS cases with the one
unchanged named hold-scoring bug skipped, and 12 Python cases with two
unchanged named analysis bugs skipped. Loaded chart/config/game coverage was
100% lines / 98.61% reported branches / 100% functions. No Backbeat JS/Python
linter, formatter or build is configured for this dependency-free slice.
Browser rendering, keyboard integration, decoding and audible synchronization
remain outside these checks.

The optional full-file mutation command from `backbeat/` is unchanged:

```sh
HEAVY_WAIT=0 agent-mutate node "$CODEX_BURN_WORK/toon37-face-tools/node_modules/@stryker-mutator/core/bin/stryker.js" run stryker.config.mjs
```

Stryker 9.6.1 still selects all `js/{config,game,chart}.js` with concurrency two,
coverage analysis off, timeout 2000 ms and factor 1.5. No configured mutation
minimum exists. The wildcard command already includes the new test; no config
change is required. Both complete Stryker runs exited zero with the same 876
ID/operator/location/replacement descriptors, identical complete source and
unchanged config. Baseline temporarily empties only the new round 2 file;
final restores its frozen bytes. Counts changed from 779 killed / 3 timeout /
94 survived to 785 / 3 / 88: strict killed/total 88.93% -> 89.61%, or
89.27% -> 89.95% including timeouts. Every prior kill and timeout remains;
only survivors 86, 115, 121, 123, 756 and 757 become Killed. No timeout
receives strict credit, no survivor is excluded, and the whole selection
remains below 90%.

Each of those six actual-source descriptors was also applied in its own
external disposable copy. The old suite passes 111 cases with one unchanged
known-bug skip; the expanded suite exits one with 113 passes, exactly one
ERR_ASSERTION failure and the same skip. The Encore case rejects 115/121/123,
the Tour case rejects 86, and the Auto-DJ case rejects 756/757. No syntax,
import, runtime failure or outside-set seeded fault supplies kill credit.
The product checkout and all existing test assertions remain unchanged.

The full raw reports, keyed comparison, six control summaries/helpers and
exact commands are retained in the slot report
`iteration9-backbeat-round2-completion.md`. Prior resource-busy attempts
launched no mutants and supply no score or kill. The 88 remaining survivors
are retained integration/default/metadata/guard/random-boundary gaps, detailed
in the PR body; no blanket equivalence claim is made.
