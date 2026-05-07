// Breakout — main game engine
const Game = (() => {
  // ── canvas setup ──
  const canvas = document.getElementById('game');
  const c = canvas.getContext('2d');
  const W = 800, H = 600;
  canvas.width = W;
  canvas.height = H;

  // ── DOM refs ──
  const overlay      = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlaySub   = document.getElementById('overlay-sub');
  const overlayBody  = document.getElementById('overlay-body');
  const overlayBtn   = document.getElementById('overlay-btn');
  const scoreEl      = document.getElementById('score-display');
  const levelEl      = document.getElementById('level-display');
  const livesEl      = document.getElementById('lives-display');

  // ── constants ──
  const BRICK_W = 68, BRICK_H = 22, BRICK_PAD = 4, BRICK_TOP = 60;
  const BALL_R = 7, PADDLE_H = 14, PADDLE_Y = H - 40;
  const POWERUP_SIZE = 18, LASER_W = 4, LASER_H = 14;
  const PARTICLE_COUNT = 12;

  // ── state ──
  let state = 'menu'; // menu | playing | paused | levelComplete | gameOver
  let score = 0, lives = 3, currentLevel = 0;
  let paddle, balls, bricks, powerups, lasers, particles;
  let keys = {};
  let mouseX = W / 2;
  let useMouseControl = false;
  let stickyActive = false;
  let laserActive = false;
  let laserTimer = 0;
  let extendTimer = 0;
  let lastTime = 0;
  let animFrame;

  // ── helpers ──
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function randInt(lo, hi) { return Math.floor(rand(lo, hi + 1)); }

  function showOverlay(title, sub, bodyHTML, btnText) {
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    overlayBody.innerHTML = bodyHTML;
    overlayBtn.textContent = btnText;
    overlay.classList.remove('hidden');
  }
  function hideOverlay() { overlay.classList.add('hidden'); }

  function updateHUD() {
    scoreEl.textContent = score;
    levelEl.textContent = currentLevel + 1;
    livesEl.textContent = '♥'.repeat(Math.max(0, lives));
  }

  // ── ball creation ──
  function createBall(x, y, dx, dy) {
    return { x: x ?? W / 2, y: y ?? PADDLE_Y - BALL_R - 2, dx: dx ?? 0, dy: dy ?? 0, stuck: !dx && !dy };
  }

  // ── level init ──
  function initLevel(idx) {
    const lvl = LEVELS[idx];
    const cols = lvl.cols, rows = lvl.rows;
    const totalW = cols * (BRICK_W + BRICK_PAD) - BRICK_PAD;
    const offsetX = (W - totalW) / 2;

    bricks = [];
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const type = lvl.layout[r]?.[col] ?? 0;
        if (type === 0) continue;
        const sp = lvl.specialBricks?.find(s => s.row === r && s.col === col);
        bricks.push({
          x: offsetX + col * (BRICK_W + BRICK_PAD),
          y: BRICK_TOP + r * (BRICK_H + BRICK_PAD),
          w: BRICK_W, h: BRICK_H,
          type, // 1=normal, 2=tough, 3=explosive, 4=indestructible
          hp: type === 2 ? 2 : (sp?.type === 'boss' ? sp.hp : 1),
          maxHp: type === 2 ? 2 : (sp?.type === 'boss' ? sp.hp : 1),
          color: lvl.brickColors[r % lvl.brickColors.length],
          special: sp?.type || null,
          powerupType: sp?.powerupType || null,
          alive: true
        });
      }
    }

    paddle = { x: W / 2 - (lvl.paddleWidth || 100) / 2, y: PADDLE_Y, w: lvl.paddleWidth || 100, h: PADDLE_H };
    balls = [createBall()];
    powerups = [];
    lasers = [];
    particles = [];
    stickyActive = false;
    laserActive = false;
    laserTimer = 0;
    extendTimer = 0;
    updateHUD();
  }

  // ── particles ──
  function spawnParticles(x, y, color, count = PARTICLE_COUNT) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x, y,
        dx: rand(-3, 3),
        dy: rand(-4, 1),
        life: rand(20, 50),
        maxLife: 50,
        color,
        size: rand(2, 5)
      });
    }
  }

  // ── powerup drop ──
  function tryDropPowerup(x, y, type) {
    if (type === 'boss' || type === 4) return; // no powerup from boss/indestructible
    if (Math.random() > 0.25) return; // 25% chance
    const types = ['multi-ball', 'paddle-extend', 'sticky-paddle', 'laser'];
    const puType = type === 'powerup' ? null : types[randInt(0, 3)]; // special brick guarantees its type
    powerups.push({
      x, y, dy: 2.5,
      type: puType || types[randInt(0, 3)],
      size: POWERUP_SIZE
    });
  }

  // ── apply powerup ──
  function applyPowerup(type) {
    Audio.powerup();
    switch (type) {
      case 'multi-ball':
        const newBalls = [];
        balls.forEach(b => {
          if (!b.stuck) {
            newBalls.push(createBall(b.x, b.y, b.dx + rand(-2, 2), b.dy));
            newBalls.push(createBall(b.x, b.y, b.dx - rand(-2, 2), b.dy));
          }
        });
        balls.push(...newBalls);
        break;
      case 'paddle-extend':
        paddle.w = Math.min(paddle.w + 40, 200);
        extendTimer = 600; // ~10 seconds at 60fps
        break;
      case 'sticky-paddle':
        stickyActive = true;
        break;
      case 'laser':
        laserActive = true;
        laserTimer = 500; // ~8 seconds
        break;
    }
  }

  // ── collision: ball vs brick ──
  function ballBrickCollision(ball, brick) {
    if (!brick.alive) return false;
    const bx = clamp(ball.x, brick.x, brick.x + brick.w);
    const by = clamp(ball.y, brick.y, brick.y + brick.h);
    const dist = Math.hypot(ball.x - bx, ball.y - by);
    return dist < BALL_R;
  }

  function resolveBallBrick(ball, brick) {
    const overlapX = BALL_R - Math.abs(ball.x - (brick.x + brick.w / 2)) + brick.w / 2;
    const overlapY = BALL_R - Math.abs(ball.y - (brick.y + brick.h / 2)) + brick.h / 2;
    if (overlapX < overlapY) {
      ball.dx = -ball.dx;
    } else {
      ball.dy = -ball.dy;
    }
  }

  // ── update ──
  function update() {
    if (state !== 'playing') return;

    // paddle movement
    const speed = 8;
    if (useMouseControl) {
      paddle.x = mouseX - paddle.w / 2;
    } else {
      if (keys['ArrowLeft'] || keys['KeyA']) paddle.x -= speed;
      if (keys['ArrowRight'] || keys['KeyD']) paddle.x += speed;
    }
    paddle.x = clamp(paddle.x, 0, W - paddle.w);

    // laser shooting
    if (laserActive && (keys['Space'] || keys['KeyF'])) {
      if (!laserCooldown) {
        lasers.push({ x: paddle.x + 4, y: paddle.y - LASER_H, w: LASER_W, h: LASER_H, dy: -8 });
        lasers.push({ x: paddle.x + paddle.w - 4 - LASER_W, y: paddle.y - LASER_H, w: LASER_W, h: LASER_H, dy: -8 });
        Audio.laser();
        laserCooldown = 12;
      }
    }
    if (laserCooldown > 0) laserCooldown--;

    // timers
    if (extendTimer > 0) {
      extendTimer--;
      if (extendTimer === 0) {
        const lvl = LEVELS[currentLevel];
        paddle.w = lvl.paddleWidth || 100;
      }
    }
    if (laserTimer > 0) {
      laserTimer--;
      if (laserTimer === 0) laserActive = false;
    }

    // balls
    for (let i = balls.length - 1; i >= 0; i--) {
      const b = balls[i];

      if (b.stuck) {
        b.x = paddle.x + paddle.w / 2;
        b.y = PADDLE_Y - BALL_R - 2;
        if (keys['Space'] || keys['ArrowUp'] || keys['KeyW']) {
          const lvl = LEVELS[currentLevel];
          const angle = rand(-0.4, 0.4);
          b.dx = lvl.ballSpeed * Math.sin(angle);
          b.dy = -lvl.ballSpeed * Math.cos(angle);
          b.stuck = false;
        }
        continue;
      }

      b.x += b.dx;
      b.y += b.dy;

      // wall bounce
      if (b.x - BALL_R < 0) { b.x = BALL_R; b.dx = Math.abs(b.dx); Audio.hitWall(); }
      if (b.x + BALL_R > W) { b.x = W - BALL_R; b.dx = -Math.abs(b.dx); Audio.hitWall(); }
      if (b.y - BALL_R < 0) { b.y = BALL_R; b.dy = Math.abs(b.dy); Audio.hitWall(); }

      // paddle collision
      if (b.dy > 0 && b.y + BALL_R >= paddle.y && b.y + BALL_R <= paddle.y + paddle.h + 6 &&
          b.x >= paddle.x - BALL_R && b.x <= paddle.x + paddle.w + BALL_R) {
        const hitPos = (b.x - paddle.x) / paddle.w; // 0..1
        const angle = (hitPos - 0.5) * Math.PI * 0.7; // -63°..+63°
        const lvl = LEVELS[currentLevel];
        const spd = Math.hypot(b.dx, b.dy);
        b.dx = spd * Math.sin(angle);
        b.dy = -spd * Math.cos(angle);
        b.y = paddle.y - BALL_R - 1;
        Audio.hitPaddle();

        if (stickyActive && !b.stuck) {
          b.stuck = true;
          b.dx = 0;
          b.dy = 0;
        }
      }

      // brick collision
      for (const brick of bricks) {
        if (!brick.alive || brick.type === 4) continue; // skip indestructible
        if (!ballBrickCollision(b, brick)) continue;

        resolveBallBrick(b, brick);

        if (brick.special === 'boss') {
          brick.hp--;
          Audio.bossHit();
          spawnParticles(b.x, b.y, brick.color, 6);
          if (brick.hp <= 0) {
            brick.alive = false;
            score += 50;
            spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 20);
            Audio.explode();
          }
        } else {
          brick.hp--;
          Audio.hitBrick();
          spawnParticles(b.x, b.y, brick.color, 8);
          if (brick.hp <= 0) {
            brick.alive = false;
            score += (brick.type === 2 ? 20 : brick.type === 3 ? 15 : 10);
            tryDropPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.type);
            if (brick.type === 3) {
              // explosive: destroy adjacent bricks
              Audio.explode();
              spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, '#f59e0b', 25);
              bricks.forEach(other => {
                if (other === brick || !other.alive || other.type === 4) return;
                const dist = Math.hypot(other.x + other.w / 2 - brick.x - brick.w / 2, other.y + other.h / 2 - brick.y - brick.h / 2);
                if (dist < BRICK_W * 1.5) {
                  other.alive = false;
                  score += 5;
                  spawnParticles(other.x + other.w / 2, other.y + other.h / 2, other.color, 6);
                  tryDropPowerup(other.x + other.w / 2, other.y + other.h / 2, other.type);
                }
              });
            }
          }
        }
        break; // one brick per frame per ball
      }

      // ball lost
      if (b.y - BALL_R > H) {
        balls.splice(i, 1);
      }
    }

    // all balls lost
    if (balls.length === 0) {
      lives--;
      Audio.loseLife();
      if (lives <= 0) {
        state = 'gameOver';
        Audio.gameOver();
        showOverlay('GAME OVER', `Final Score: ${score}`,
          `<p>Level reached: ${currentLevel + 1}</p>`, 'PLAY AGAIN');
      } else {
        balls = [createBall()];
        stickyActive = false;
      }
      updateHUD();
    }

    // powerups
    for (let i = powerups.length - 1; i >= 0; i--) {
      const p = powerups[i];
      p.y += p.dy;
      if (p.y > H) { powerups.splice(i, 1); continue; }
      // paddle catch
      if (p.y + p.size >= paddle.y && p.y <= paddle.y + paddle.h &&
          p.x + p.size >= paddle.x && p.x <= paddle.x + paddle.w) {
        applyPowerup(p.type);
        powerups.splice(i, 1);
      }
    }

    // lasers
    for (let i = lasers.length - 1; i >= 0; i--) {
      const l = lasers[i];
      l.y += l.dy;
      if (l.y < 0) { lasers.splice(i, 1); continue; }
      // laser vs brick
      let hit = false;
      for (const brick of bricks) {
        if (!brick.alive || brick.type === 4) continue;
        if (l.x < brick.x + brick.w && l.x + l.w > brick.x && l.y < brick.y + brick.h && l.y + l.h > brick.y) {
          if (brick.special === 'boss') {
            brick.hp--;
            Audio.bossHit();
            if (brick.hp <= 0) {
              brick.alive = false;
              score += 50;
              spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.color, 20);
              Audio.explode();
            }
          } else {
            brick.hp--;
            Audio.hitBrick();
            if (brick.hp <= 0) {
              brick.alive = false;
              score += 10;
              tryDropPowerup(brick.x + brick.w / 2, brick.y + brick.h / 2, brick.type);
              if (brick.type === 3) {
                Audio.explode();
                spawnParticles(brick.x + brick.w / 2, brick.y + brick.h / 2, '#f59e0b', 25);
                bricks.forEach(other => {
                  if (other === brick || !other.alive || other.type === 4) return;
                  const dist = Math.hypot(other.x + other.w / 2 - brick.x - brick.w / 2, other.y + other.h / 2 - brick.y - brick.h / 2);
                  if (dist < BRICK_W * 1.5) {
                    other.alive = false;
                    score += 5;
                    spawnParticles(other.x + other.w / 2, other.y + other.h / 2, other.color, 6);
                  }
                });
              }
            }
          }
          hit = true;
          break;
        }
      }
      if (hit) lasers.splice(i, 1);
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.dx;
      p.y += p.dy;
      p.dy += 0.1; // gravity
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }

    // level complete check
    const destructible = bricks.filter(b => b.alive && b.type !== 4);
    if (destructible.length === 0) {
      Audio.levelComplete();
      if (currentLevel + 1 >= LEVELS.length) {
        state = 'gameOver';
        showOverlay('🎉 YOU WIN!', `Final Score: ${score}`,
          `<p>All ${LEVELS.length} levels cleared!</p>`, 'PLAY AGAIN');
      } else {
        state = 'levelComplete';
        currentLevel++;
        showOverlay('LEVEL COMPLETE', LEVELS[currentLevel].name,
          `<p>Score: ${score} | Lives: ${'♥'.repeat(lives)}</p>`, 'NEXT LEVEL');
      }
    }

    updateHUD();
  }

  // ── draw ──
  function draw() {
    c.clearRect(0, 0, W, H);

    // background grid
    c.strokeStyle = 'rgba(255,255,255,0.02)';
    c.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }

    // bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      c.fillStyle = b.color;
      c.shadowColor = b.color;
      c.shadowBlur = 8;
      c.beginPath();
      c.roundRect(b.x, b.y, b.w, b.h, 4);
      c.fill();
      c.shadowBlur = 0;

      // HP indicator for tough/boss bricks
      if (b.maxHp > 1) {
        c.fillStyle = 'rgba(0,0,0,0.3)';
        c.font = 'bold 12px Orbitron, monospace';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(b.hp, b.x + b.w / 2, b.y + b.h / 2);
      }

      // boss glow
      if (b.special === 'boss') {
        c.strokeStyle = 'rgba(255,255,255,0.3)';
        c.lineWidth = 2;
        c.beginPath();
        c.roundRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4, 6);
        c.stroke();
      }
    }

    // paddle
    const paddleGrad = c.createLinearGradient(paddle.x, paddle.y, paddle.x + paddle.w, paddle.y);
    paddleGrad.addColorStop(0, '#818cf8');
    paddleGrad.addColorStop(1, '#38bdf8');
    c.fillStyle = paddleGrad;
    c.shadowColor = '#818cf8';
    c.shadowBlur = 12;
    c.beginPath();
    c.roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 7);
    c.fill();
    c.shadowBlur = 0;

    // laser indicators on paddle
    if (laserActive) {
      c.fillStyle = '#f43f5e';
      c.fillRect(paddle.x + 4, paddle.y - 4, 4, 4);
      c.fillRect(paddle.x + paddle.w - 8, paddle.y - 4, 4, 4);
    }

    // balls
    for (const b of balls) {
      c.fillStyle = '#fff';
      c.shadowColor = '#38bdf8';
      c.shadowBlur = 10;
      c.beginPath();
      c.arc(b.x, b.y, BALL_R, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    }

    // powerups
    for (const p of powerups) {
      const colors = { 'multi-ball': '#a78bfa', 'paddle-extend': '#10b981', 'sticky-paddle': '#f59e0b', 'laser': '#f43f5e' };
      const icons = { 'multi-ball': '●●', 'paddle-extend': '↔', 'sticky-paddle': '⊂', 'laser': '↑' };
      c.fillStyle = colors[p.type] || '#fff';
      c.shadowColor = colors[p.type] || '#fff';
      c.shadowBlur = 8;
      c.beginPath();
      c.roundRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, 4);
      c.fill();
      c.shadowBlur = 0;
      c.fillStyle = '#fff';
      c.font = 'bold 10px Inter, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(icons[p.type] || '?', p.x, p.y);
    }

    // lasers
    c.fillStyle = '#f43f5e';
    c.shadowColor = '#f43f5e';
    c.shadowBlur = 6;
    for (const l of lasers) {
      c.fillRect(l.x, l.y, l.w, l.h);
    }
    c.shadowBlur = 0;

    // particles
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      c.globalAlpha = alpha;
      c.fillStyle = p.color;
      c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    c.globalAlpha = 1;

    // sticky indicator
    if (stickyActive) {
      c.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      c.lineWidth = 2;
      c.setLineDash([4, 4]);
      c.strokeRect(paddle.x - 4, paddle.y - 4, paddle.w + 8, paddle.h + 8);
      c.setLineDash([]);
    }
  }

  // ── game loop ──
  function loop() {
    update();
    draw();
    animFrame = requestAnimationFrame(loop);
  }

  // ── start / restart ──
  function startGame() {
    score = 0;
    lives = 3;
    currentLevel = 0;
    hideOverlay();
    initLevel(0);
    state = 'playing';
    if (!animFrame) loop();
  }

  function nextLevel() {
    hideOverlay();
    initLevel(currentLevel);
    state = 'playing';
  }

  function restartGame() {
    hideOverlay();
    startGame();
  }

  // ── input ──
  document.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Escape') {
      if (state === 'playing') {
        state = 'paused';
        showOverlay('PAUSED', '', '<p>Press ESC to resume</p>', 'RESUME');
      } else if (state === 'paused') {
        state = 'playing';
        hideOverlay();
      }
    }
    if (e.code === 'Space') e.preventDefault();
  });
  document.addEventListener('keyup', e => { keys[e.code] = false; });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (e.clientX - rect.left) * (W / rect.width);
    useMouseControl = true;
  });
  canvas.addEventListener('mouseleave', () => { useMouseControl = false; });
  canvas.addEventListener('click', () => {
    Audio.init();
    if (state === 'menu') {
      startGame();
    } else if (state === 'playing') {
      // Launch any stuck ball on click (mouse-friendly launch)
      balls.forEach(b => {
        if (b.stuck) {
          const lvl = LEVELS[currentLevel];
          const angle = rand(-0.4, 0.4);
          b.dx = lvl.ballSpeed * Math.sin(angle);
          b.dy = -lvl.ballSpeed * Math.cos(angle);
          b.stuck = false;
        }
      });
    }
  });
  overlayBtn.addEventListener('click', () => {
    Audio.init();
    if (state === 'menu' || state === 'gameOver') startGame();
    else if (state === 'levelComplete') nextLevel();
    else if (state === 'paused') { state = 'playing'; hideOverlay(); }
  });

  // ── init ──
  function init() {
    showOverlay('BREAKOUT', 'Brick Breaker',
      `<dl class="controls">
        <dt>← → / A D</dt><dd>Move paddle</dd>
        <dt>Mouse</dt><dd>Move paddle (hover over canvas)</dd>
        <dt>Space / ↑ / W</dt><dd>Launch ball</dd>
        <dt>F</dt><dd>Fire lasers (when active)</dd>
        <dt>ESC</dt><dd>Pause</dd>
      </dl>
      <p style="margin-top:16px;color:var(--muted)">Break all bricks to advance. Watch for power-ups!</p>`,
      'START GAME');
    state = 'menu';
    initLevel(0);
    loop();
  }

  let laserCooldown = 0;

  return { init };
})();

// boot
window.addEventListener('DOMContentLoaded', Game.init);
