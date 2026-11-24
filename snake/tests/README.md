# Snake logic tests

Run from the repository root with Node 22.22+:

```sh
node --test --test-concurrency=2 snake/tests/*.test.mjs
```

No npm install, browser or build is required. `harness.mjs` evaluates the real
classic scripts unchanged in isolated `node:vm` contexts. It supplies in-memory
storage, DOM nodes, timers, animation frames and a finite random sequence. The
finite sequence makes an accidental unbounded food-spawn retry fail promptly.
The real renderer is loaded and initialized against an explicit standard Canvas2D
port; no renderer/game method is replaced. These tests do not verify pixels or
DOM layout.

Coverage includes single- and multiplayer movement, growth, direction queuing,
edge/self/other-snake collisions, winners and draws, food rejection, ten-point
scoring, difficulty and speed limits, persisted settings/high scores, input
mapping and repeat suppression, pause/resume and game-update integration.
First-start coverage dispatches DOMContentLoaded, selects Multiplayer via the
registered menu click, and dispatches Start through its registered listener.
It checks the Length display and holds ArrowUp across the real countdown,
using the timer and keyboard ports to send a repeat, release, and fresh press.

Three skipped regressions record existing defects without changing shipped code:

- A malformed persisted `snakeHighScore` becomes `NaN` instead of zero, preventing
  later comparisons from recording a new best (`js/state.js`, `loadHighScore`).
- Player four's control map uses `Num8`/`Num5`/`Num4`/`Num6` as `event.key` values.
  A browser numpad event has `key: '8'` and `code: 'Numpad8'` for numpad up, so the
  current map does not recognize it (`js/controls.js`, `handleKeyDown`). The same
  named regression now keeps that original up expectation and checks all four
  documented numpad directions from fresh perpendicular headings; it remains
  one named skip, not a synthetic-input success claim.
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
- Reviewer repairs remove the internal setter/pause spies and use real input,
  movement, changed-heading repeat suppression, pause UI and release lifecycle.
  Each arrow/WASD alias/state starts with a fresh perpendicular heading. Working
  multiplayer players 1–3 are tested across supported player counts; player 4's
  actual browser-key defect remains the named regression above.
- Public HTML player/control colors and names supply independent metadata
  expectations. Every supported primary color is usable and matches the legend;
  glow data cannot be empty, and a normal two-player collision produces player
  one's cyan victory UI. Uniqueness alone no longer accepts `undefined`.
- The 36 round-one survivors are assessed by individual ID/public outcome in
  `REVIEWER-ROUND1.md`. They remain in the denominator. No blanket cosmetic,
  guard-equivalence or reachability claim is used, and no unsupported direction,
  player identity or synthetic browser key is invented to raise the score.

DOM-node stubs accept any requested ID, and animation-frame stubs leave
callbacks queued. UI assertions check writes to those ports and the first-start
tests exercise the listeners registered with them. HTML IDs, native browser
dispatch, rendering and frame scheduling are outside these checks.

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

Historical measurements on main `79053cc` with Stryker 9.6.1 increased assertion
kills from 421/531 (79.28%) to the published 472/531 (88.89%). Timeout-inclusive
score rose from 85.31% to 89.08%; timeouts fell from 32 to one, survivors from
78 to 58. The earlier invalid VM-selector diagnostic is excluded.

The fresh reviewer-repair comparison independently reproduced that published
baseline, then ran the frozen repaired suite with identical complete source,
config and all 531 ID/operator/location/replacement descriptors:

| Snapshot | Killed | Timeout | Survived | Strict killed/total | Including timeout |
| --- | ---: | ---: | ---: | ---: | ---: |
| Published 49-case suite | 472 | 1 | 58 | 88.89% | 89.08% |
| Repaired 53-case suite | 494 | 1 | 36 | 93.03% | 93.22% |

All prior kills and the single timeout remain. Twenty-two survivors become
Killed: control legend names/colors, multiplayer color/glow data (including
exact 126) and missing supported single-player color cases. All 36 survivors
remain in the denominator; the infinite food-loop timeout receives no strict
credit. No configured numeric mutation break threshold or new gate exists.

Six actual-source red controls independently verify sensitivity: deleting each
of the four WASD setter statements, emptying real Game.togglePause, and exact
Stryker 126 replacing player one's config with an empty object. Each published
suite passes 49 cases with three known skips. The repaired suite rejects each
WASD/pause fault with one ERR_ASSERTION (52 other passes), and rejects126 with
two real color assertions (51 other passes); skips stay three. No syntax/import/
runtime failure supplies credit. Main/game seeded controls remain outside the
five-module score and get no extra mutation score credit.

The repaired normal suite passes53 with three existing named skips. The focused
opt-in bug command produces exactly three ERR_ASSERTION failures and no skips.
Loaded-module native coverage is85.35% lines/94.69% reported branches/87.50% functions;
all five mutation targets report100% lines. Renderer is exercised against a fake
Canvas browser port, so this does not prove visual quality or physical browser
behavior. Full repair contracts, exact assertion-edit ledger, per-ID survivor
assessment and owner attribution-label handoff are in `REVIEWER-ROUND1.md`.

Round two uses the same five files and 531 generated mutants. Stryker kills
498, reports one timeout, and leaves 32 survivors, up from 494 kills in round
one. Mutants 30 and 368 fail their dedicated first-start assertions. Mutants
474 and 478 fail the menu-state precondition. The round-one assessments for
the other 32 remain applicable, including the stated ghost-toggle coverage limit.
