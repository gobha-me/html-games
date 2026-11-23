import assert from 'node:assert/strict';
import test from 'node:test';
import { keyEvent, loadSnake, plain } from './harness.mjs';

test('initialization centers three segments, resets queued growth and preserves player identity', () => {
  const { Snake, GameState } = loadSnake();
  GameState.gridSize = 31;
  Snake.grow();
  Snake.init(3);
  assert.deepEqual(plain(Snake.body), [{ x: 15, y: 15 }, { x: 14, y: 15 }, { x: 13, y: 15 }]);
  assert.deepEqual(plain(Snake.direction), { x: 1, y: 0 });
  assert.deepEqual(plain(Snake.nextDirection), { x: 1, y: 0 });
  assert.equal(Snake.growing, false);
  assert.equal(Snake.playerId, 3);
  assert.equal(Snake.color, '#ff00ff');
  Snake.init(99);
  assert.equal(Snake.color, '#00d4ff');
});

test('movement shifts the body and consumes exactly one queued growth', () => {
  const { Snake } = loadSnake();
  Snake.init();
  Snake.update();
  assert.deepEqual(plain(Snake.body), [{ x: 16, y: 15 }, { x: 15, y: 15 }, { x: 14, y: 15 }]);
  Snake.grow();
  Snake.setDirection(0, -1);
  Snake.update();
  assert.deepEqual(plain(Snake.getHead()), { x: 16, y: 14 });
  assert.equal(Snake.getLength(), 4);
  assert.equal(Snake.growing, false);
  Snake.update();
  assert.equal(Snake.getLength(), 4);
  assert.deepEqual(plain(Snake.body.at(-1)), { x: 15, y: 15 });
});

test('queued turns reject reversal against the current direction until the next update', () => {
  const { Snake } = loadSnake();
  Snake.init();
  Snake.setDirection(-1, 0);
  assert.deepEqual(plain(Snake.nextDirection), { x: 1, y: 0 });
  Snake.setDirection(0, -1);
  Snake.setDirection(1, 0);
  assert.deepEqual(plain(Snake.nextDirection), { x: 0, y: -1 });
  Snake.setDirection(-1, 0);
  assert.deepEqual(plain(Snake.nextDirection), { x: 0, y: -1 });
  Snake.update();
  Snake.setDirection(-1, 0);
  assert.deepEqual(plain(Snake.nextDirection), { x: -1, y: 0 });
  assert.deepEqual(plain(Snake.direction), { x: 0, y: -1 });
});

for (const [x, y, collides] of [
  [-1, 10, true], [30, 10, true], [10, -1, true], [10, 30, true],
  [0, 0, false], [29, 29, false], [0, 29, false], [29, 0, false],
]) {
  test(`wall collision at (${x}, ${y}) is ${collides}`, () => {
    const { Snake } = loadSnake();
    Snake.body = [{ x, y }];
    assert.equal(Snake.checkWallCollision(), collides);
  });
}

test('self collision compares both coordinates and skips the head itself', () => {
  const { Snake } = loadSnake();
  Snake.body = [{ x: 2, y: 3 }];
  assert.equal(Snake.checkSelfCollision(), false);
  Snake.body.push({ x: 2, y: 4 }, { x: 3, y: 3 });
  assert.equal(Snake.checkSelfCollision(), false);
  assert.equal(Snake.collidesWithBody(2, 3), true);
  assert.equal(Snake.collidesWithBody(2, 4), true);
  assert.equal(Snake.collidesWithBody(3, 4), false);
  Snake.body.push({ x: 2, y: 3 });
  assert.equal(Snake.checkSelfCollision(), true);
});

test('moving into the vacated tail is allowed unless growth retains that cell', () => {
  for (const growing of [false, true]) {
    const { Snake } = loadSnake();
    Snake.body = [{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 1, y: 3 }, { x: 1, y: 2 }];
    Snake.direction = { x: 0, y: -1 };
    Snake.nextDirection = { x: -1, y: 0 };
    Snake.growing = growing;
    Snake.update();
    assert.equal(Snake.checkSelfCollision(), growing);
  }
});

for (const [level, speed, increase] of [['easy', 120, 2], ['normal', 100, 3], ['hard', 80, 4]]) {
  test(`${level} difficulty sets speed and reset restores it while retaining high score`, () => {
    const { GameState } = loadSnake();
    GameState.setDifficulty(level);
    assert.equal(GameState.speed, speed);
    assert.equal(GameState.speedIncrease, increase);
    GameState.addScore(20);
    GameState.increaseSpeed();
    assert.equal(GameState.speed, speed - increase);
    GameState.reset();
    assert.equal(GameState.score, 0);
    assert.equal(GameState.highScore, 20);
    assert.equal(GameState.difficulty, level);
    assert.equal(GameState.speed, speed);
  });
}

test('speed reduction reaches but never crosses 30 ms', () => {
  const { GameState } = loadSnake();
  GameState.setDifficulty('hard');
  GameState.speed = 34;
  GameState.increaseSpeed();
  assert.equal(GameState.speed, 30);
  GameState.increaseSpeed();
  assert.equal(GameState.speed, 30);
  GameState.speed = 32;
  GameState.increaseSpeed();
  assert.equal(GameState.speed, 30);
});

test('high-score persistence writes only records and distinguishes zero and a tied positive best', () => {
  const { GameState, storage, writes } = loadSnake({ saved: { snakeHighScore: '20' } });
  GameState.init();
  assert.equal(GameState.highScore, 20);
  assert.equal(GameState.isNewHighScore(), false);
  GameState.addScore(10);
  assert.deepEqual(writes, []);
  GameState.addScore(10);
  assert.equal(GameState.isNewHighScore(), true);
  assert.deepEqual(writes, []);
  GameState.addScore(10);
  assert.equal(GameState.highScore, 30);
  assert.equal(storage.get('snakeHighScore'), '30');
  assert.deepEqual(writes, [['snakeHighScore', '30']]);
  const fresh = loadSnake({ saved: Object.fromEntries(storage) });
  fresh.GameState.init();
  assert.equal(fresh.GameState.highScore, 30);
  assert.equal(fresh.GameState.score, 0);
});

test('missing high score and ghost option initialize safely, and the option round-trips', () => {
  const { GameState, storage } = loadSnake();
  GameState.init();
  assert.equal(GameState.highScore, 0);
  assert.equal(GameState.ghostTrail, false);
  assert.equal(GameState.isNewHighScore(), false);
  GameState.toggleGhostTrail();
  assert.equal(GameState.ghostTrail, true);
  assert.equal(storage.get('snakeGhostTrail'), 'true');
  const fresh = loadSnake({ saved: Object.fromEntries(storage) });
  fresh.GameState.init();
  assert.equal(fresh.GameState.ghostTrail, true);
  fresh.GameState.toggleGhostTrail();
  assert.equal(fresh.storage.get('snakeGhostTrail'), 'false');
});

test('ghost option accepts only the serialized true value', () => {
  for (const saved of ['false', 'TRUE', '1', '']) {
    const { GameState } = loadSnake({ saved: { snakeGhostTrail: saved } });
    GameState.loadGhostTrail();
    assert.equal(GameState.ghostTrail, false);
  }
});

test('mode and player count select multiplayer and clamp to 2–4 players', () => {
  const { GameState } = loadSnake();
  assert.equal(GameState.isMultiplayer(), false);
  GameState.setGameMode('multiplayer');
  assert.equal(GameState.isMultiplayer(), true);
  for (const [input, expected] of [[1, 2], [2, 2], [3, 3], [4, 4], [10, 4]]) {
    GameState.setPlayerCount(input);
    assert.equal(GameState.playerCount, expected);
  }
  GameState.setGameMode('single');
  assert.equal(GameState.isMultiplayer(), false);
});

test('food retries occupied cells and floors bounded randomness into grid coordinates', () => {
  const { Snake, Food, GameState } = loadSnake({ random: [0.5, 0.5, 0.9999, 0] });
  Snake.init();
  Food.spawn();
  assert.deepEqual(plain(Food.position), { x: 29, y: 0 });
  assert.equal(Food.collidesWithSnake(15, 15), true);
  assert.equal(Food.collidesWithSnake(15, 16), false);
  Snake.body[0] = { x: 29, y: 0 };
  assert.equal(Food.checkCollision(), true);
  Snake.body[0] = { x: 29, y: 1 };
  assert.equal(Food.checkCollision(), false);
  Snake.body[0] = { x: 28, y: 0 };
  assert.equal(Food.checkCollision(), false);
  assert.equal(GameState.isMultiplayer(), false);
});

test('multiplayer initializes separate snakes, colors, controls and clears old winners', () => {
  const { Multiplayer, Controls } = loadSnake();
  Multiplayer.winner = { id: 99 };
  Multiplayer.initMultiplayer(4);
  assert.equal(Multiplayer.playerCount, 4);
  assert.equal(Multiplayer.winner, null);
  assert.equal(Multiplayer.isMultiplayer(), true);
  assert.deepEqual(plain(Controls.activePlayers), [1, 2, 3, 4]);
  assert.deepEqual(plain(Multiplayer.players.map(p => p.snake.body[0])), [
    { x: 15, y: 15 }, { x: 5, y: 5 }, { x: 24, y: 5 }, { x: 5, y: 24 },
  ]);
  assert.deepEqual(plain(Multiplayer.players.map(p => [p.id, p.score, p.alive])),
    [[1, 0, true], [2, 0, true], [3, 0, true], [4, 0, true]]);
  assert.equal(new Set(Multiplayer.players.map(p => p.color)).size, 4);
  Multiplayer.players[0].snake.body[0].x = 0;
  assert.equal(Multiplayer.players[1].snake.body[0].x, 5);
  Multiplayer.resetToSinglePlayer();
  assert.equal(Multiplayer.isMultiplayer(), false);
  assert.equal(Multiplayer.playerCount, 1);
  assert.equal(Multiplayer.winner, null);
  assert.deepEqual(plain(Multiplayer.players), []);
  assert.deepEqual(plain(Controls.activePlayers), [1]);
});

test('multiplayer direction changes ignore unknown/dead players and reject reversal', () => {
  const { Multiplayer } = loadSnake();
  Multiplayer.initMultiplayer(2);
  const player = Multiplayer.getPlayer(1);
  Multiplayer.setPlayerDirection(99, { x: 0, y: -1 });
  Multiplayer.setPlayerDirection(1, { x: -1, y: 0 });
  assert.deepEqual(plain(player.snake.nextDirection), { x: 1, y: 0 });
  Multiplayer.setPlayerDirection(1, { x: 0, y: -1 });
  Multiplayer.setPlayerDirection(1, { x: 1, y: 0 });
  assert.deepEqual(plain(player.snake.nextDirection), { x: 0, y: -1 });
  Multiplayer.update();
  assert.deepEqual(plain(player.snake.body[0]), { x: 15, y: 14 });
  assert.deepEqual(plain(player.snake.direction), { x: 0, y: -1 });
  player.alive = false;
  const before = plain(player.snake);
  Multiplayer.setPlayerDirection(1, { x: -1, y: 0 });
  Multiplayer.update();
  assert.deepEqual(plain(player.snake), before);
});

test('multiplayer food rejects all living bodies and ignores eliminated bodies', () => {
  const { Multiplayer, GameState, Food } = loadSnake({ random: [0.5, 0.5, 0.17, 0.17, 0, 0] });
  GameState.setGameMode('multiplayer');
  Multiplayer.initMultiplayer(2);
  Food.spawn();
  assert.deepEqual(plain(Food.position), { x: 0, y: 0 });
  assert.equal(Food.collidesWithSnake(5, 5), true);
  assert.equal(Multiplayer.getAllSnakeBodies().length, 6);
  Multiplayer.getPlayer(2).alive = false;
  assert.equal(Food.collidesWithSnake(5, 5), false);
  assert.equal(Multiplayer.getAllSnakeBodies().length, 3);
});

test('only a living player with both matching food coordinates scores and grows once', () => {
  const { Multiplayer, Food, GameState } = loadSnake();
  GameState.setGameMode('multiplayer');
  Multiplayer.initMultiplayer(3);
  const player = Multiplayer.getPlayer(2);
  Food.position = { x: 5, y: 6 };
  assert.equal(Food.checkCollision(), false);
  Food.position = { x: 6, y: 5 };
  assert.equal(Food.checkCollision(), false);
  Food.position = { x: 5, y: 5 };
  assert.equal(Food.checkCollision(), true);
  assert.equal(player.score, 10);
  assert.equal(player.snake.growing, true);
  assert.equal(Multiplayer.getPlayer(1).score, 0);
  Multiplayer.update();
  assert.equal(player.snake.body.length, 4);
  assert.equal(player.snake.growing, false);
  Multiplayer.update();
  assert.equal(player.snake.body.length, 4);
  player.alive = false;
  Food.position = { ...player.snake.body[0] };
  assert.equal(Food.checkCollision(), false);
  assert.equal(player.score, 10);
});

test('multiplayer walls and self collision eliminate only the colliding player', () => {
  for (const body of [
    [{ x: -1, y: 0 }], [{ x: 30, y: 0 }], [{ x: 0, y: -1 }], [{ x: 0, y: 30 }],
    [{ x: 8, y: 8 }, { x: 8, y: 8 }],
  ]) {
    const { Multiplayer } = loadSnake();
    Multiplayer.initMultiplayer(2);
    Multiplayer.getPlayer(1).snake.body = body;
    Multiplayer.checkCollisions();
    assert.equal(Multiplayer.getPlayer(1).alive, false);
    assert.equal(Multiplayer.getPlayer(2).alive, true);
  }
});

test('multiplayer head-to-head collisions eliminate both and result in a draw', () => {
  const { Multiplayer } = loadSnake();
  Multiplayer.initMultiplayer(2);
  Multiplayer.getPlayer(1).snake.body = [{ x: 8, y: 8 }, { x: 7, y: 8 }];
  Multiplayer.getPlayer(2).snake.body = [{ x: 8, y: 8 }, { x: 9, y: 8 }];
  Multiplayer.checkCollisions();
  assert.equal(Multiplayer.getAliveCount(), 0);
  assert.equal(Multiplayer.isGameOver(), true);
  assert.equal(Multiplayer.winner, null);
});

test('multiplayer collision includes the other snake tail, while near misses keep both alive', () => {
  const { Multiplayer } = loadSnake();
  Multiplayer.initMultiplayer(2);
  const first = Multiplayer.getPlayer(1);
  const other = Multiplayer.getPlayer(2);
  first.snake.body = [{ x: 3, y: 6 }, { x: 2, y: 6 }];
  other.snake.body = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  Multiplayer.checkCollisions();
  assert.equal(Multiplayer.getAliveCount(), 2);
  assert.equal(Multiplayer.isGameOver(), false);
  first.snake.body[0] = { x: 3, y: 5 };
  Multiplayer.checkCollisions();
  assert.equal(first.alive, false);
  assert.equal(other.alive, true);
  assert.equal(Multiplayer.isGameOver(), true);
  assert.equal(Multiplayer.winner, other);
});

test('all four control schemes map each direction and ignore inactive or unknown keys', () => {
  const { Controls } = loadSnake();
  const mappings = [
    ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
    ['w', 's', 'a', 'd'], ['i', 'k', 'j', 'l'], ['Num8', 'Num5', 'Num4', 'Num6'],
  ];
  const directions = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
  assert.equal(Controls.getPlayerFromKey('w'), null);
  Controls.setActivePlayers(4);
  mappings.forEach((keys, index) => keys.forEach((key, directionIndex) => {
    assert.equal(Controls.getPlayerFromKey(key), index + 1);
    assert.equal(Controls.isGameKey(key), true);
    assert.deepEqual(plain(Controls.getDirectionFromKey(key, index + 1)), directions[directionIndex]);
  }));
  assert.equal(Controls.getPlayerFromKey('Escape'), null);
  assert.equal(Controls.isGameKey('Escape'), false);
  assert.equal(Controls.getDirectionFromKey('Escape', 1), null);
  assert.equal(Controls.getDirectionFromKey('w', 99), null);
  assert.equal(Controls.getPlayerKeys(2).up, 'w');
  assert.deepEqual(plain(Controls.getControlScheme().map(p => p.playerId)), [1, 2, 3, 4]);
});

test('multiplayer controls suppress repeats until key release and leave unrelated keys alone', () => {
  const { Controls, Multiplayer } = loadSnake();
  Multiplayer.initMultiplayer(2);
  const calls = [];
  Multiplayer.setPlayerDirection = (...args) => calls.push(plain(args));
  const down = keyEvent('w');
  Controls.handleKeyDown(down);
  Controls.handleKeyDown(down);
  assert.equal(down.prevented, 2);
  assert.deepEqual(calls, [[2, { x: 0, y: -1 }]]);
  Controls.handleKeyUp(keyEvent('w'));
  Controls.handleKeyDown(down);
  assert.equal(calls.length, 2);
  const unrelated = keyEvent('Escape');
  Controls.handleKeyDown(unrelated);
  assert.equal(unrelated.prevented, 0);
  assert.equal(calls.length, 2);
});

test('single-player input maps arrow keys and both WASD cases only during play or pause', () => {
  const { GameState, Snake, handleKeyDown } = loadSnake();
  const calls = [];
  Snake.setDirection = (x, y) => calls.push([x, y]);
  const mappings = [
    [['ArrowUp', 'w', 'W'], [0, -1]], [['ArrowDown', 's', 'S'], [0, 1]],
    [['ArrowLeft', 'a', 'A'], [-1, 0]], [['ArrowRight', 'd', 'D'], [1, 0]],
  ];
  for (const state of [GameState.MENU, GameState.GAMEOVER]) {
    GameState.currentState = state;
    const event = keyEvent('ArrowUp');
    handleKeyDown(event);
    assert.equal(event.prevented, 0);
  }
  assert.deepEqual(calls, []);
  for (const state of [GameState.PLAYING, GameState.PAUSED]) {
    GameState.currentState = state;
    for (const [keys, expected] of mappings) for (const key of keys) {
      const event = keyEvent(key);
      handleKeyDown(event);
      assert.deepEqual(calls.at(-1), expected);
      assert.equal(event.prevented, 1);
    }
  }
  const before = calls.length;
  const unrelated = keyEvent('Escape');
  handleKeyDown(unrelated);
  assert.equal(unrelated.prevented, 0);
  assert.equal(calls.length, before);
});

test('pause keys dispatch in both active states and multiplayer input reaches the correct snake', () => {
  const { Game, GameState, Multiplayer, Controls, Snake, handleKeyDown, handleKeyUp } = loadSnake();
  let paused = 0;
  Game.togglePause = () => paused++;
  for (const state of [GameState.PLAYING, GameState.PAUSED]) {
    GameState.currentState = state;
    for (const key of [' ', 'p', 'P']) {
      const event = keyEvent(key);
      handleKeyDown(event);
      assert.equal(event.prevented, 1);
    }
  }
  assert.equal(paused, 6);
  GameState.setGameMode('multiplayer');
  Multiplayer.initMultiplayer(2);
  Snake.setDirection = () => assert.fail('multiplayer input reached single-player snake');
  handleKeyDown(keyEvent('w'));
  assert.deepEqual(plain(Multiplayer.getPlayer(2).snake.nextDirection), { x: 0, y: -1 });
  assert.equal(Controls.pressedKeys.has('w'), true);
  handleKeyUp(keyEvent('w'));
  assert.equal(Controls.pressedKeys.has('w'), false);
});

test('single-player update integrates movement, food score, next-tick growth and UI', () => {
  const { Game, GameState, Snake, Food, element, storage } = loadSnake();
  GameState.init();
  Snake.init();
  Food.position = { x: 16, y: 15 };
  Game.update();
  assert.deepEqual(plain(Snake.getHead()), { x: 16, y: 15 });
  assert.equal(GameState.score, 10);
  assert.equal(GameState.highScore, 10);
  assert.equal(GameState.speed, 97);
  assert.equal(Snake.getLength(), 3);
  assert.equal(Snake.growing, true);
  assert.deepEqual(plain(Food.position), { x: 0, y: 0 });
  assert.equal(element('score').textContent, 10);
  assert.equal(element('high-score').textContent, 10);
  assert.equal(storage.get('snakeHighScore'), '10');
  Game.update();
  assert.equal(Snake.getLength(), 4);
  assert.equal(Snake.growing, false);
  assert.equal(GameState.score, 10);
});

test('collision ends the game before food can score and displays final results', () => {
  const { Game, GameState, Snake, Food, element, cancelledFrames } = loadSnake();
  Snake.init();
  Snake.body[0] = { x: 29, y: 15 };
  Food.position = { x: 30, y: 15 };
  GameState.currentState = GameState.PLAYING;
  GameState.addScore(20);
  Game.animationFrameId = 17;
  Game.update();
  assert.equal(GameState.currentState, GameState.GAMEOVER);
  assert.equal(GameState.score, 20);
  assert.deepEqual(cancelledFrames, [17]);
  assert.equal(element('final-score').textContent, 20);
  assert.equal(element('final-length').textContent, 3);
  assert.equal(element('new-high-score').style.display, 'block');
  assert.equal(element('gameover-screen').style.display, 'block');
  assert.equal(element('game-screen').style.display, 'none');
});

test('multiplayer update integrates food score then winner detection on the next collision', () => {
  const { Game, GameState, Multiplayer, Food, element } = loadSnake();
  GameState.setGameMode('multiplayer');
  Multiplayer.initMultiplayer(2);
  Food.position = { x: 6, y: 5 };
  Game.update();
  assert.equal(Multiplayer.getPlayer(2).score, 10);
  assert.equal(Multiplayer.getPlayer(2).snake.growing, true);
  assert.equal(element('player2-score').textContent, 10);
  Multiplayer.getPlayer(1).snake.body[0] = { x: 29, y: 15 };
  Game.update();
  assert.equal(GameState.currentState, GameState.GAMEOVER);
  assert.equal(Multiplayer.winner.id, 2);
  assert.equal(Multiplayer.getPlayer(2).snake.body.length, 4);
  assert.equal(element('winner-text').textContent, 'Player 2 Wins!');
  assert.equal(element('winner-score').textContent, 'Score: 10');
});

test('pause and resume preserve the run and reject transitions outside their active state', () => {
  const { Game, GameState, element, cancelledFrames } = loadSnake();
  Game.animationFrameId = 5;
  GameState.score = 20;
  Game.pause();
  assert.deepEqual(cancelledFrames, []);
  GameState.currentState = GameState.PLAYING;
  Game.pause();
  assert.equal(GameState.currentState, GameState.PAUSED);
  assert.equal(element('pause-overlay').style.display, 'flex');
  assert.deepEqual(cancelledFrames, [5]);
  Game.pause();
  assert.deepEqual(cancelledFrames, [5]);
  Game.resume();
  assert.equal(GameState.currentState, GameState.PLAYING);
  assert.equal(element('pause-overlay').style.display, 'none');
  assert.equal(Game.lastUpdateTime, 1000);
  assert.equal(GameState.score, 20);
  const frame = Game.animationFrameId;
  Game.resume();
  assert.equal(Game.animationFrameId, frame);
});

test('corrupt saved high scores should fall back to zero', {
  skip: process.env.SNAKE_RUN_KNOWN_BUGS !== '1' &&
    'Finding: state.js loadHighScore accepts parseInt("broken") as NaN; product fix is outside this tests-only PR.',
}, () => {
  const { GameState } = loadSnake({ saved: { snakeHighScore: 'broken' } });
  GameState.init();
  assert.equal(GameState.highScore, 0);
});

test('player four should respond to a real browser numpad key event', {
  skip: process.env.SNAKE_RUN_KNOWN_BUGS !== '1' &&
    'Finding: controls.js expects synthetic Num8/Num5/Num4/Num6 key strings; browsers emit key "8" / code "Numpad8".',
}, () => {
  const { Controls, Multiplayer } = loadSnake();
  Multiplayer.initMultiplayer(4);
  Controls.handleKeyDown(keyEvent('8', { code: 'Numpad8' }));
  assert.deepEqual(plain(Multiplayer.getPlayer(4).snake.nextDirection), { x: 0, y: -1 });
});
