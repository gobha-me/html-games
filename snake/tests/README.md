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

Two skipped regressions record existing defects without changing shipped code:

- A malformed persisted `snakeHighScore` becomes `NaN` instead of zero, preventing
  later comparisons from recording a new best (`js/state.js`, `loadHighScore`).
- Player four's control map uses `Num8`/`Num5`/`Num4`/`Num6` as `event.key` values.
  A browser numpad event has `key: '8'` and `code: 'Numpad8'` for numpad up, so the
  current map does not recognize it (`js/controls.js`, `handleKeyDown`).

To reproduce both defects, opt into the skipped assertions (expected exit 1 on
the current product):

```sh
SNAKE_RUN_KNOWN_BUGS=1 node --test --test-concurrency=2 snake/tests/*.test.mjs
```

The tests control `Math.random` for repeatability; the shipped game has no seeded
RNG API. They do not add one. Storage-denial behavior, canvas drawing, touch and
the real browser event pipeline need separate browser coverage.
