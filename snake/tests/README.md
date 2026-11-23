# Snake logic tests

Run from the repository root with Node 22.22+:

```sh
node --test --test-concurrency=2 snake/tests/*.test.mjs
```

No npm install, browser or build is required. `harness.mjs` evaluates the real
classic scripts unchanged in isolated `node:vm` contexts. It supplies in-memory
storage, DOM nodes, timers, animation frames and a finite random sequence. The
finite sequence makes an accidental unbounded food-spawn retry fail promptly.
The renderer is a port stub; these tests do not verify pixels or DOM layout.

Coverage includes single- and multiplayer movement, growth, direction queuing,
edge/self/other-snake collisions, winners and draws, food rejection, ten-point
scoring, difficulty and speed limits, persisted settings/high scores, input
mapping and repeat suppression, pause/resume and game-update integration.

Three skipped regressions record existing defects without changing shipped code:

- A malformed persisted `snakeHighScore` becomes `NaN` instead of zero, preventing
  later comparisons from recording a new best (`js/state.js`, `loadHighScore`).
- Player four's control map uses `Num8`/`Num5`/`Num4`/`Num6` as `event.key` values.
  A browser numpad event has `key: '8'` and `code: 'Numpad8'` for numpad up, so the
  current map does not recognize it (`js/controls.js`, `handleKeyDown`).
- A multiplayer key held through game over can remain marked pressed after the
  menu switches to single mode. Releasing it in single mode skips multiplayer
  keyup cleanup, and restarting multiplayer retains the stale pressed state; the
  next press is ignored (`js/main.js`, `handleKeyUp`; `js/controls.js`,
  `setActivePlayers`). The regression runs the real game reset/countdown path,
  changes modes as the menu does, and sends the release through the real input
  handler.

To reproduce all three defects, opt into the skipped assertions (expected exit 1 on
the current product):

```sh
SNAKE_RUN_KNOWN_BUGS=1 node --test --test-concurrency=2 snake/tests/*.test.mjs
```

The tests control `Math.random` for repeatability; the shipped game has no seeded
RNG API. They do not add one. Storage-denial behavior, canvas drawing, touch and
the real browser event pipeline need separate browser coverage.

Mutation scope and interpretation:

- `stryker.config.mjs` mutates `state.js`, `snake.js`, `food.js`, `controls.js`
  and `multiplayer.js`. `game.js` and `main.js` are loaded for integration tests
  but are not included in that mutation score.
- The VM forwards the command runner's active-mutant selector into its own
  `__stryker__` object. Without this bridge, instrumented classic scripts would
  execute the unmutated path inside the isolated realm.
- Survivor follow-up tests cover valid multiplayer corners, full starting-body
  contiguity, vertical reversal with a queued turn, coordinate near misses,
  third-player collision scanning, positive scores below the best, and countdown
  completion/cancellation. The countdown tests exercise the exported
  `Multiplayer.startCountdown` helper; the visible game-start countdown is a
  separate `Game.startMultiplayer` path.
- Baseline survivors also include cosmetic labels/colors, initial values replaced
  by initialization, an unused local offset, and guards/early exits whose removal
  can preserve the result for normal cardinal directions. These are triage
  categories, not a claim that every remaining mutant is equivalent. Keep the
  full report and disclose survivors instead of feeding unsupported directions,
  arbitrary player IDs or cosmetic strings into tests merely to improve a score.

DOM-node stubs accept any requested ID, and animation-frame stubs do not execute
callbacks. Assertions involving UI validate writes to those ports; they do not
prove the IDs exist in HTML, the real event listeners are wired, or rendering and
frame scheduling work in a browser.

## Optional mutation checks

The normal tests require no npm dependencies. `stryker.config.mjs` supports the
optional Stryker 9.6.1 command runner, with two mutation workers and two Node test
workers. From `snake/`, with Stryker installed or supplied by npm exec:

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

Measured on main `79053cc` with Stryker 9.6.1: assertion kills increased from
421/531 (79.28%) to 472/531 (88.89%). Stryker's timeout-inclusive score rose
from 85.31% to 89.08%; timeouts fell from 32 to 1, survivors from 78 to 58.
The remaining timeout is an empty infinite food-spawn loop. Remaining survivors
include cosmetic/initial values and redundant cardinal-direction/early-exit
guards; they remain in the denominator. This is a five-module score, not a
whole-game or browser confidence claim. No all-survivors-killed claim is made.
