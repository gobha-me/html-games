// ============================================================================
// AETHERIUM // PINBALL — 480Hz Sub-Stepped Physics & Boss Ritual Simulation
// ============================================================================

import {
  TABLE_W, TABLE_H, BALL_RADIUS, GRAVITY, SUBSTEPS,
  TRANSMUTE_WORD, BOSS_RITUALS, buildTableGeometry
} from './config.js';
import { audio } from './audio.js';

const HIGH_SCORE_KEY = 'aetherium_pinball_hi_v1';

export class AetheriumPinballSim {
  constructor() {
    let savedHi = 250000;
    try {
      if (typeof localStorage !== 'undefined') {
        savedHi = Number(localStorage.getItem(HIGH_SCORE_KEY) || 250000);
      }
    } catch (_) {}
    this.highScore = savedHi;
    this.reset();
  }

  reset() {
    const geom = buildTableGeometry();
    this.walls = geom.walls;
    this.slingshots = geom.slingshots;
    this.gates = geom.gates;
    this.flippers = geom.flippers;
    this.bumpers = geom.bumpers;
    this.dropTargets = geom.dropTargets;
    this.rollovers = geom.rollovers;
    this.saucer = geom.saucer;
    this.spinner = geom.spinner;

    this.time = 0;
    this.paused = false;
    this.gameOver = false;

    this.score = 0;
    this.ballNumber = 1;
    this.maxBalls = 3;
    this.multiplier = 1;
    this.bonusScore = 0;

    // Input state
    this.leftFlipperDown = false;
    this.rightFlipperDown = false;
    this.plungerCharging = false;
    this.plungerPull = 0; // 0..1
    this.magnetActive = false;

    // Alchemical Reagents (0..100)
    this.reagents = {
      salt: 20,
      sulfur: 20,
      mercury: 35,
      azoth: 0,
    };
    this.magnetCharge = 100; // 0..100 capacitor for Magnetkinesis [W]

    // T-R-A-N-S-M-U-T-E letters
    this.transmuteLit = Array(TRANSMUTE_WORD.length).fill(false);

    // Crucible locks toward 3-ball Multiball
    this.crucibleLocks = 0;

    // Defensive table aids
    this.aegisTimer = 18.0; // Center drain post active timer
    this.kickbackLit = true; // Left outlane kickback

    // Nudge & Tilt state
    this.tiltMeter = 0; // 0..100
    this.tilted = false;
    this.shakeX = 0;
    this.shakeY = 0;

    // Boss Ritual state
    this.bossIdx = 0;
    this.bossDefeatedCount = 0;
    this.initBoss(0);

    // Active balls, particles, floating callouts
    this.balls = [];
    this.particles = [];
    this.floatTexts = [];
    this.dmdBanner = { text: 'PULL PLUNGER [SPACE / ↓]', sub: 'STRIKE THE BRASS GARGOYLE', timer: 4.0 };

    this.spawnBallInShooter();
  }

  initBoss(idx) {
    this.bossIdx = idx;
    const def = BOSS_RITUALS[idx % BOSS_RITUALS.length];
    const scale = 1 + Math.floor(idx / BOSS_RITUALS.length) * 0.35;
    this.boss = {
      def,
      x: 241,
      y: 376,
      r: def.radius,
      hp: Math.round(def.maxHp * scale),
      maxHp: Math.round(def.maxHp * scale),
      shieldAngle: 0,
      hitFlash: 0,
      orbTimer: 4.5,
    };
    // Spawn 2 Clockwork Homunculus sentries flanking the Boss Sanctum
    this.homunculi = [
      { x: 162, y: 422, baseX: 162, baseY: 422, r: 14, hp: 60, maxHp: 60, alive: true, phase: 0, hitFlash: 0 },
      { x: 320, y: 422, baseX: 320, baseY: 422, r: 14, hp: 60, maxHp: 60, alive: true, phase: Math.PI, hitFlash: 0 },
    ];
    this.orbs = [];
  }

  setDmd(text, sub = '', duration = 2.8) {
    this.dmdBanner = { text, sub, timer: duration };
  }

  addScore(pts, x = null, y = null, color = '#fde047') {
    if (this.tilted) return;
    const total = Math.round(pts * this.multiplier);
    this.score += total;
    this.bonusScore += Math.round(pts * 0.15);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try { localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore)); } catch (_) {}
    }
    if (x !== null && y !== null && total >= 1000) {
      this.addFloatText(x, y, `+${total.toLocaleString()}`, color);
    }
  }

  addReagent(type, amount) {
    if (this.reagents[type] !== undefined) {
      this.reagents[type] = Math.min(100, this.reagents[type] + amount);
    }
    this.magnetCharge = Math.min(100, this.magnetCharge + amount * 0.45);
  }

  lightTransmuteLetter(idx) {
    if (idx < 0 || idx >= this.transmuteLit.length) return;
    if (!this.transmuteLit[idx]) {
      this.transmuteLit[idx] = true;
      const letter = TRANSMUTE_WORD[idx];
      this.setDmd(`SIGIL '${letter}' IGNITED`, this.transmuteLit.map((v, i) => v ? TRANSMUTE_WORD[i] : '·').join(' '), 2.2);
      if (this.transmuteLit.every(Boolean)) {
        // Completed T-R-A-N-S-M-U-T-E!
        this.addScore(100000, 241, 480, '#38f2d7');
        this.multiplier = Math.min(10, this.multiplier + 2);
        this.aegisTimer = Math.max(this.aegisTimer, 25.0);
        this.kickbackLit = true;
        this.setDmd('MAGNUM OPUS COMPLETE!', '+100,000 · MULTIPLIER +2X · AEGIS LIT', 4.0);
        audio.multiball();
        this.transmuteLit.fill(false);
      }
    }
  }

  spawnBallInShooter() {
    this.tilted = false;
    this.tiltMeter = 0;
    this.aegisTimer = Math.max(this.aegisTimer, 16.0);
    this.balls.push({
      x: 484,
      y: 842,
      vx: 0,
      vy: 0,
      r: BALL_RADIUS,
      inShooter: true,
      captured: false,
      stuckTime: 0,
      trail: [],
      tint: '#e2e8f0',
    });
  }

  spawnMultiball(count = 2) {
    audio.multiball();
    this.aegisTimer = Math.max(this.aegisTimer, 22.0);
    const tints = ['#fde047', '#38bdf8', '#fb7185'];
    for (let i = 0; i < count; i++) {
      if (this.balls.length >= 4) break;
      const ang = -Math.PI * 0.35 + (i - 0.5) * 0.35;
      const spd = 560 + i * 70;
      this.balls.push({
        x: this.saucer.x + 18 + i * 14,
        y: this.saucer.y + 18,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        r: BALL_RADIUS,
        inShooter: false,
        captured: false,
        stuckTime: 0,
        trail: [],
        tint: tints[i % tints.length],
      });
    }
  }

  // Launch ball from Shooter Lane
  releasePlunger(minRatio = 0.25) {
    const ratio = Math.max(minRatio, this.plungerPull);
    this.plungerCharging = false;
    this.plungerPull = 0;

    let launched = false;
    for (const b of this.balls) {
      if (b.x > 466 && b.y > 740 && Math.abs(b.vy) < 120) {
        // Skill-shot velocity up the shooter lane
        const jitter = (Math.sin(this.time * 37) * 18);
        b.vy = -(1060 + ratio * 460 + jitter);
        b.vx = -8;
        b.inShooter = true;
        launched = true;
      }
    }
    if (launched) {
      audio.launch(ratio);
      this.setDmd('MERCURY SPHERE LAUNCHED', 'AIM FOR TOP CROWN LANES (SOL · LUNA · AZOTH)', 2.4);
    }
  }

  // Table Nudge (Left / Right / Up)
  nudge(dx, dy) {
    if (this.tilted || this.gameOver || this.paused) return;
    audio.nudge();
    this.shakeX = dx * 7;
    this.shakeY = dy * 6;
    this.tiltMeter = Math.min(100, this.tiltMeter + 34);

    for (const b of this.balls) {
      if (!b.inShooter && !b.captured) {
        b.vx += dx * 125;
        b.vy += dy * 95;
      }
    }

    if (this.tiltMeter >= 100) {
      this.tilted = true;
      this.leftFlipperDown = false;
      this.rightFlipperDown = false;
      audio.tilt();
      this.setDmd('⚠ TILT! PENDULUM FAULT ⚠', 'FLIPPERS LOCKED UNTIL DRAIN', 4.0);
    } else if (this.tiltMeter >= 65) {
      this.setDmd('CAREFUL — DANGER OF TILT!', `PENDULUM AT ${Math.round(this.tiltMeter)}%`, 1.6);
    }
  }

  step(dt) {
    if (this.paused || this.gameOver) return;
    this.time += dt;

    // Decay table shake & tilt pendulum
    this.shakeX *= Math.pow(0.001, dt);
    this.shakeY *= Math.pow(0.001, dt);
    if (!this.tilted && this.tiltMeter > 0) {
      this.tiltMeter = Math.max(0, this.tiltMeter - dt * 16);
    }
    if (this.aegisTimer > 0) {
      this.aegisTimer = Math.max(0, this.aegisTimer - dt);
    }
    if (this.dmdBanner.timer > 0) {
      this.dmdBanner.timer = Math.max(0, this.dmdBanner.timer - dt);
    }

    // Plunger pull charge
    if (this.plungerCharging) {
      this.plungerPull = Math.min(1, this.plungerPull + dt * 1.35);
    }

    // Magnetkinesis active drain
    const magnetOn = this.magnetActive && !this.tilted && this.magnetCharge > 2;
    if (magnetOn) {
      this.magnetCharge = Math.max(0, this.magnetCharge - dt * 36);
    } else {
      this.magnetCharge = Math.min(100, this.magnetCharge + dt * 4.5);
    }

    // Step Crucible Saucer hold timer
    if (this.saucer.heldBall) {
      this.saucer.holdTimer -= dt;
      this.saucer.heldBall.x = this.saucer.x;
      this.saucer.heldBall.y = this.saucer.y;
      this.saucer.heldBall.vx = 0;
      this.saucer.heldBall.vy = 0;
      if (this.saucer.holdTimer <= 0) {
        const b = this.saucer.heldBall;
        this.saucer.heldBall = null;
        b.captured = false;
        // Eject toward center-right playfield
        const ejectAng = 0.42 + Math.sin(this.time * 7) * 0.14;
        b.vx = Math.cos(ejectAng) * 640;
        b.vy = Math.sin(ejectAng) * 640;
        audio.saucerEject();
        this.spawnBurst(this.saucer.x, this.saucer.y, '#fde047', 16);

        if (this.crucibleLocks >= 3) {
          this.crucibleLocks = 0;
          this.reagents.azoth = 0;
          this.setDmd('⚡ AZOTH MULTIBALL UNLEASHED! ⚡', '3-BALL PHILOSOPHER FRENZY · JACKPOTS LIT', 4.5);
          this.spawnMultiball(2);
        }
      }
    }

    // Step Spinner rotation
    if (Math.abs(this.spinner.angVel) > 0.1) {
      const prevHalf = Math.floor(this.spinner.angle / Math.PI);
      this.spinner.angle += this.spinner.angVel * dt;
      const curHalf = Math.floor(this.spinner.angle / Math.PI);
      if (curHalf !== prevHalf) {
        this.addScore(450);
        this.addReagent('mercury', 1.8);
        audio.spinnerTick();
      }
      this.spinner.angVel *= Math.pow(0.18, dt);
    }

    // Step Boss Ritual & Homunculi
    this.stepBossAndHomunculi(dt);

    // 8x Sub-Stepped Rigid-Body Physics Solver (480Hz)
    const subDt = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      this.stepFlippers(subDt);
      this.stepBallsSub(subDt, magnetOn);
    }

    // Update trails, particles, and check ball drain
    this.stepPostPhysics(dt);
  }

  stepBossAndHomunculi(dt) {
    const b = this.boss;
    b.shieldAngle += b.def.shieldSpeed * dt;
    if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt * 4);

    // Homunculi gentle orbital sway
    for (const h of this.homunculi) {
      if (!h.alive) continue;
      h.phase += dt * 2.2;
      h.x = h.baseX + Math.sin(h.phase) * 12;
      h.y = h.baseY + Math.cos(h.phase * 0.7) * 6;
      if (h.hitFlash > 0) h.hitFlash = Math.max(0, h.hitFlash - dt * 4);
    }

    // Boss periodically Conjures Cinnabar Orbs that drift across the mid-table
    b.orbTimer -= dt;
    if (b.orbTimer <= 0 && this.orbs.length < 3 && this.balls.some(ball => !ball.inShooter)) {
      b.orbTimer = 5.5;
      const ang = Math.PI * 0.25 + (Math.sin(this.time * 3.1) * 0.5 + 0.5) * Math.PI * 0.5;
      this.orbs.push({
        x: b.x + Math.cos(ang) * (b.r + 14),
        y: b.y + Math.sin(ang) * (b.r + 14),
        vx: Math.cos(ang) * 58,
        vy: Math.sin(ang) * 58,
        r: 9,
        life: 9.0,
      });
    }

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.life -= dt;
      if (o.life <= 0 || o.x < 30 || o.x > 450 || o.y > 760) {
        this.orbs.splice(i, 1);
      }
    }
  }

  stepFlippers(dt) {
    const speedUp = 26.0;   // Fast solenoid snap up (rad/s)
    const speedDown = 14.5; // Return spring down (rad/s)

    for (const f of this.flippers) {
      const wantActive = !this.tilted && (f.side === 'left' ? this.leftFlipperDown : this.rightFlipperDown);
      const target = wantActive ? f.activeAngle : f.restAngle;
      const diff = target - f.angle;
      if (Math.abs(diff) < 0.001) {
        f.angle = target;
        f.omega = 0;
      } else {
        const rate = wantActive ? speedUp : speedDown;
        const step = Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
        f.omega = step / dt;
        f.angle += step;
      }
    }
  }

  stepBallsSub(dt, magnetOn) {
    for (let i = 0; i < this.balls.length; i++) {
      const ball = this.balls[i];
      if (ball.captured) continue;

      // Gravity + Magnetkinesis attractor
      ball.vy += GRAVITY * dt;

      if (magnetOn && !ball.inShooter) {
        // Arcane Magnetkinesis pulls the ball toward the safe center sanctum (241, 560) and upward out of the drain!
        const mx = 241 - ball.x;
        const my = 540 - ball.y;
        const mDist = Math.hypot(mx, my) + 1;
        const pull = 980 / Math.max(60, mDist * 0.45);
        ball.vx += (mx / mDist) * pull * dt;
        ball.vy += ((my / mDist) * pull - 420) * dt;
      }

      // Air drag & velocity clamp
      ball.vx *= 0.9995;
      ball.vy *= 0.9995;
      const spd = Math.hypot(ball.vx, ball.vy);
      if (spd > 1580) {
        const s = 1580 / spd;
        ball.vx *= s;
        ball.vy *= s;
      }

      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      if (ball.x < 462) ball.inShooter = false;

      // 1. Collide with Static Capsule Walls
      for (const w of this.walls) {
        this.collideBallSegment(ball, w.x1, w.y1, w.x2, w.y2, w.r, w.e);
      }

      // 2. Collide with One-Way Gates
      for (const g of this.gates) {
        const dot = ball.vx * g.passNx + ball.vy * g.passNy;
        // If moving against the pass direction (trying to re-enter shooter lane), block it!
        if (dot < 0) {
          this.collideBallSegment(ball, g.x1, g.y1, g.x2, g.y2, 4, 0.72);
        }
      }

      // 3. Collide with Active Slingshot Faces
      for (const sl of this.slingshots) {
        if (this.collideBallSegment(ball, sl.x1, sl.y1, sl.x2, sl.y2, 4.5, 0.85)) {
          // Check if ball is on the front (playfield-facing) side of the slingshot
          const midX = (sl.x1 + sl.x2) * 0.5;
          const midY = (sl.y1 + sl.y2) * 0.5;
          if ((ball.x - midX) * sl.nx + (ball.y - midY) * sl.ny > 0) {
            ball.vx = sl.nx * sl.kickSpeed;
            ball.vy = sl.ny * sl.kickSpeed;
            sl.flash = 1.0;
            this.addScore(750, midX, midY, '#f59e0b');
            audio.slingshot();
          }
        }
      }

      // 4. Collide with Drop Targets
      for (const dtgt of this.dropTargets) {
        if (dtgt.down) continue;
        if (this.collideBallSegment(ball, dtgt.x1, dtgt.y1, dtgt.x2, dtgt.y2, dtgt.r, 0.82)) {
          dtgt.down = true;
          const mx = (dtgt.x1 + dtgt.x2) * 0.5;
          const my = (dtgt.y1 + dtgt.y2) * 0.5;
          this.addScore(3500, mx, my, dtgt.color);
          this.addReagent(dtgt.bank === 'left' ? 'salt' : 'sulfur', 18);
          this.lightTransmuteLetter(dtgt.letterIdx);
          this.spawnBurst(mx, my, dtgt.color, 10);

          // Check if entire 3-target bank is completed
          const bankTargets = this.dropTargets.filter(t => t.bank === dtgt.bank);
          if (bankTargets.every(t => t.down)) {
            audio.dropTarget(true);
            this.addScore(15000, mx, my - 18, '#fde047');
            this.kickbackLit = true;
            this.aegisTimer = Math.max(this.aegisTimer, 14.0);
            this.setDmd(
              dtgt.bank === 'left' ? 'SALT BANK PURIFIED!' : 'SULFUR BANK CALCINATED!',
              '+15,000 BONUS · KICKBACK & AEGIS RE-LIT',
              3.0
            );
            setTimeout(() => {
              bankTargets.forEach(t => { t.down = false; });
            }, 900);
          } else {
            audio.dropTarget(false);
          }
        }
      }

      // 5. Collide with Tapered Rotating Flippers
      for (const f of this.flippers) {
        this.collideBallFlipper(ball, f);
      }

      // 6. Collide with Pop Bumpers
      for (const bmp of this.bumpers) {
        const dx = ball.x - bmp.x;
        const dy = ball.y - bmp.y;
        const dist = Math.hypot(dx, dy);
        const minDist = ball.r + bmp.r;
        if (dist < minDist && dist > 0.0001) {
          const nx = dx / dist;
          const ny = dy / dist;
          ball.x = bmp.x + nx * minDist;
          ball.y = bmp.y + ny * minDist;
          ball.vx = nx * bmp.kick + (Math.random() - 0.5) * 40;
          ball.vy = ny * bmp.kick;
          bmp.flash = 1.0;
          this.addScore(bmp.score, bmp.x, bmp.y - bmp.r, bmp.glow);
          this.addReagent(bmp.reagent, 12);
          this.spawnBurst(bmp.x + nx * bmp.r, bmp.y + ny * bmp.r, bmp.glow, 9);
          audio.bumper(bmp.id);
        }
      }

      // 7. Collide with Center Aegis Drain Post (when active)
      if (this.aegisTimer > 0) {
        const px = 241, py = 828, pr = 9;
        const dx = ball.x - px, dy = ball.y - py;
        const dist = Math.hypot(dx, dy);
        if (dist < ball.r + pr && dist > 0.001) {
          const nx = dx / dist, ny = dy / dist;
          ball.x = px + nx * (ball.r + pr);
          ball.y = py + ny * (ball.r + pr);
          ball.vx = nx * 420;
          ball.vy = -Math.abs(ny * 460) - 120;
          this.spawnBurst(px, py, '#10b981', 8);
          audio.slingshot();
        }
      }

      // 8. Left Outlane Kickback (when lit)
      if (this.kickbackLit && ball.x < 50 && ball.y > 768 && ball.y < 815 && ball.vy > 0) {
        ball.vy = -780;
        ball.vx = 65;
        this.kickbackLit = false;
        this.addScore(5000, 34, 780, '#38bdf8');
        this.spawnBurst(34, 785, '#38bdf8', 14);
        this.setDmd('⚡ ALCHEMICAL KICKBACK! ⚡', 'BALL SAVED FROM LEFT OUTLANE', 2.4);
        audio.saucerEject();
      }

      // 9. Collide with Boss Ritual Shield & Core + Homunculi + Orbs
      this.collideBallBoss(ball);
    }

    // 10. Ball-to-Ball Collisions (during Multiball!)
    for (let i = 0; i < this.balls.length; i++) {
      for (let j = i + 1; j < this.balls.length; j++) {
        const b1 = this.balls[i], b2 = this.balls[j];
        if (b1.captured || b2.captured) continue;
        const dx = b2.x - b1.x, dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);
        const minDist = b1.r + b2.r;
        if (dist < minDist && dist > 0.001) {
          const nx = dx / dist, ny = dy / dist;
          const overlap = (minDist - dist) * 0.5;
          b1.x -= nx * overlap; b1.y -= ny * overlap;
          b2.x += nx * overlap; b2.y += ny * overlap;
          const dvx = b1.vx - b2.vx, dvy = b1.vy - b2.vy;
          const vn = dvx * nx + dvy * ny;
          if (vn > 0) {
            b1.vx -= vn * nx * 0.92; b1.vy -= vn * ny * 0.92;
            b2.vx += vn * nx * 0.92; b2.vy += vn * ny * 0.92;
          }
        }
      }
    }
  }

  collideBallSegment(ball, x1, y1, x2, y2, segR, restitution = 0.72) {
    const vx = x2 - x1, vy = y2 - y1;
    const lenSq = vx * vx + vy * vy;
    let t = 0;
    if (lenSq > 0.0001) {
      t = Math.max(0, Math.min(1, ((ball.x - x1) * vx + (ball.y - y1) * vy) / lenSq));
    }
    const cx = x1 + t * vx;
    const cy = y1 + t * vy;
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.hypot(dx, dy);
    const minDist = ball.r + segR;

    if (dist < minDist && dist > 0.0001) {
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = cx + nx * minDist;
      ball.y = cy + ny * minDist;

      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        ball.vx -= (1 + restitution) * vn * nx;
        ball.vy -= (1 + restitution) * vn * ny;
      }
      return true;
    }
    return false;
  }

  collideBallFlipper(ball, f) {
    const cos = Math.cos(f.angle);
    const sin = Math.sin(f.angle);
    const tx = f.px + cos * f.length;
    const ty = f.py + sin * f.length;

    const vx = tx - f.px, vy = ty - f.py;
    const lenSq = vx * vx + vy * vy;
    const t = Math.max(0, Math.min(1, ((ball.x - f.px) * vx + (ball.y - f.py) * vy) / lenSq));
    const cx = f.px + t * vx;
    const cy = f.py + t * vy;
    const rFlip = f.rBase + (f.rTip - f.rBase) * t;

    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.hypot(dx, dy);
    const minDist = ball.r + rFlip;

    if (dist < minDist && dist > 0.0001) {
      const nx = dx / dist;
      const ny = dy / dist;
      ball.x = cx + nx * minDist;
      ball.y = cy + ny * minDist;

      // Surface velocity of the flipper at contact distance (t * f.length) from pivot
      const radiusAtContact = t * f.length;
      const surfVx = -sin * f.omega * radiusAtContact;
      const surfVy =  cos * f.omega * radiusAtContact;

      const relVx = ball.vx - surfVx;
      const relVy = ball.vy - surfVy;
      const relVn = relVx * nx + relVy * ny;

      if (relVn < 0) {
        const restitution = Math.abs(f.omega) > 1 ? 0.82 : 0.45; // Lower bounce when holding flipper still for live catches!
        ball.vx -= (1 + restitution) * relVn * nx;
        ball.vy -= (1 + restitution) * relVn * ny;

        // Add direct kinetic transfer when flipper is snapping upward
        if (Math.abs(f.omega) > 2) {
          const boost = 1.18 + t * 0.35;
          ball.vx += surfVx * boost * 0.48;
          ball.vy += surfVy * boost * 0.48;
        }
      }
    }
  }

  collideBallBoss(ball) {
    const b = this.boss;
    const dx = ball.x - b.x;
    const dy = ball.y - b.y;
    const dist = Math.hypot(dx, dy);

    // Check Boss Outer Shield Ring (at radius b.r + 13)
    const shieldR = b.r + 13;
    if (Math.abs(dist - shieldR) < ball.r + 4) {
      const ang = Math.atan2(dy, dx);
      // Determine if angle falls on one of the rotating brass shield arcs
      const count = b.def.shieldCount;
      const sector = (Math.PI * 2) / count;
      let rel = ((ang - b.shieldAngle) % sector + sector) % sector;
      if (rel < sector * 0.52) {
        // Hit rotating shield arc! Deflect ball & chip boss HP slightly
        const nx = dx / (dist || 1), ny = dy / (dist || 1);
        const pushR = dist >= shieldR ? shieldR + ball.r + 4 : shieldR - ball.r - 4;
        ball.x = b.x + nx * pushR;
        ball.y = b.y + ny * pushR;
        ball.vx = nx * 510;
        ball.vy = ny * 510;
        this.damageBoss(8, ball.x, ball.y, false);
        return;
      }
    }

    // Direct Hit on Boss Core!
    if (dist < ball.r + b.r && dist > 0.001) {
      const nx = dx / dist, ny = dy / dist;
      ball.x = b.x + nx * (ball.r + b.r + 2);
      ball.y = b.y + ny * (ball.r + b.r + 2);
      ball.vx = nx * 590;
      ball.vy = ny * 590;
      this.damageBoss(45, b.x, b.y, true);
    }

    // Collide with Homunculi
    for (const h of this.homunculi) {
      if (!h.alive) continue;
      const hx = ball.x - h.x, hy = ball.y - h.y;
      const hd = Math.hypot(hx, hy);
      if (hd < ball.r + h.r && hd > 0.001) {
        const nx = hx / hd, ny = hy / hd;
        ball.x = h.x + nx * (ball.r + h.r);
        ball.y = h.y + ny * (ball.r + h.r);
        ball.vx = nx * 520;
        ball.vy = ny * 520;
        h.hp -= 30;
        h.hitFlash = 1.0;
        this.spawnBurst(h.x, h.y, '#38f2d7', 12);
        if (h.hp <= 0) {
          h.alive = false;
          this.addScore(12000, h.x, h.y, '#38f2d7');
          this.damageBoss(55, b.x, b.y, true);
          this.setDmd('HOMUNCULUS SHATTERED!', '+12,000 · BOSS SEAL WEAKENED', 2.4);
        } else {
          this.addScore(3000, h.x, h.y, '#a7f3d0');
          audio.bossHit(false);
        }
      }
    }

    // Collide with Cinnabar Orbs
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      if (Math.hypot(ball.x - o.x, ball.y - o.y) < ball.r + o.r) {
        this.addScore(5000, o.x, o.y, '#fb7185');
        this.addReagent('azoth', 10);
        this.spawnBurst(o.x, o.y, '#fb7185', 12);
        audio.bumper('sulfur');
        this.orbs.splice(i, 1);
      }
    }
  }

  damageBoss(dmg, hx, hy, direct) {
    const b = this.boss;
    b.hp = Math.max(0, b.hp - dmg);
    b.hitFlash = 1.0;
    this.addScore(direct ? 6500 : 1200, hx, hy, b.def.glow);
    this.addReagent('azoth', direct ? 12 : 3);
    this.spawnBurst(hx, hy, b.def.glow, direct ? 16 : 7);

    if (b.hp <= 0) {
      // Boss Defeated!
      audio.bossHit(true);
      this.bossDefeatedCount++;
      this.addScore(b.def.rewardScore, b.x, b.y, '#fde047');
      this.multiplier = Math.min(10, this.multiplier + 1);
      this.spawnBurst(b.x, b.y, '#fde047', 36);
      this.setDmd(
        `★ ${b.def.name} BANISHED! ★`,
        `+${b.def.rewardScore.toLocaleString()} JACKPOT · MULTIBALL RITUAL`,
        4.5
      );
      this.spawnMultiball(1);
      this.bossIdx++;
      this.initBoss(this.bossIdx);
    } else {
      audio.bossHit(false);
    }
  }

  stepPostPhysics(dt) {
    // Decay visual flashes on bumpers & slingshots
    for (const bmp of this.bumpers) {
      if (bmp.flash > 0) bmp.flash = Math.max(0, bmp.flash - dt * 5);
    }
    for (const sl of this.slingshots) {
      if (sl.flash > 0) sl.flash = Math.max(0, sl.flash - dt * 5);
    }

    for (let i = this.balls.length - 1; i >= 0; i--) {
      const ball = this.balls[i];

      // Record mercury comet trail
      if (!ball.captured) {
        ball.trail.push({ x: ball.x, y: ball.y });
        if (ball.trail.length > 12) ball.trail.shift();
      }

      // Check Rollover Triggers (Crown SOL-LUNA-AZOTH + Inlanes/Outlanes)
      for (const ro of this.rollovers) {
        const inside = Math.hypot(ball.x - ro.x, ball.y - ro.y) < ro.r + ball.r * 0.6;
        if (inside && !ro._touching) {
          ro._touching = true;
          ro.lit = true;
          audio.rollover();
          this.addScore(2000, ro.x, ro.y, ro.color);
          this.addReagent('mercury', 8);
          if (ro.letterIdx !== undefined) this.lightTransmuteLetter(ro.letterIdx);

          if (ro.group === 'crown') {
            const crown = this.rollovers.filter(r => r.group === 'crown');
            if (crown.every(r => r.lit)) {
              this.multiplier = Math.min(10, this.multiplier + 1);
              this.addScore(12000, 241, 114, '#fde047');
              this.setDmd(`CROWN ALIGNED · ${this.multiplier}X MULTIPLIER!`, '+12,000 SOLAR BONUS', 2.8);
              setTimeout(() => crown.forEach(r => { r.lit = false; }), 650);
            }
          }
        } else if (!inside) {
          ro._touching = false;
        }
      }

      // Check Spinner Trigger
      const sp = this.spinner;
      const spInside = Math.hypot(ball.x - sp.x, ball.y - sp.y) < sp.r;
      if (spInside && !sp._touching) {
        sp._touching = true;
        const spd = Math.hypot(ball.vx, ball.vy);
        sp.angVel += Math.max(18, spd * 0.085);
        this.addScore(1500, sp.x, sp.y, '#38bdf8');
      } else if (!spInside) {
        sp._touching = false;
      }

      // Check Philosopher's Crucible Saucer Capture
      const sc = this.saucer;
      if (!ball.captured && !sc.heldBall) {
        const dSaucer = Math.hypot(ball.x - sc.x, ball.y - sc.y);
        if (dSaucer < sc.r && Math.hypot(ball.vx, ball.vy) < 720) {
          ball.captured = true;
          ball.trail = [];
          sc.heldBall = ball;
          sc.holdTimer = 1.15;
          this.crucibleLocks = Math.min(3, this.crucibleLocks + 1);
          this.addReagent('azoth', 34);
          this.addScore(10000 * this.crucibleLocks, sc.x, sc.y, '#c084fc');
          audio.saucerCatch();
          if (this.crucibleLocks < 3) {
            this.setDmd(`CRUCIBLE LOCK ${this.crucibleLocks} OF 3`, `${3 - this.crucibleLocks} MORE FOR AZOTH MULTIBALL`, 2.6);
          } else {
            this.setDmd('CRUCIBLE SEAL 3/3 CHARGED!', 'PREPARE FOR AZOTH MULTIBALL!', 2.6);
          }
        }
      }

      // Anti-stuck watchdog
      if (!ball.inShooter && !ball.captured) {
        if (Math.hypot(ball.vx, ball.vy) < 18) {
          ball.stuckTime += dt;
          if (ball.stuckTime > 2.2) {
            ball.vy = -340;
            ball.vx = (ball.x < 241 ? 180 : -180);
            ball.stuckTime = 0;
          }
        } else {
          ball.stuckTime = 0;
        }
      }

      // Check Drain below bottom of table
      if (ball.y > TABLE_H - 12) {
        // If Aegis Ball-Save is active and this is the only ball, save it immediately!
        if (this.aegisTimer > 0 && this.balls.length === 1 && !this.tilted) {
          ball.x = 484;
          ball.y = 820;
          ball.vx = -6;
          ball.vy = -1280;
          ball.inShooter = true;
          ball.trail = [];
          audio.saucerEject();
          this.setDmd('🛡 AEGIS BALL SAVE! 🛡', 'SPHERE RETURNED TO ORBIT', 2.8);
          continue;
        }

        this.balls.splice(i, 1);
        audio.drain();

        if (this.balls.length === 0) {
          // End of Ball! Award End-of-Ball Bonus if not tilted
          if (!this.tilted) {
            const totalBonus = this.bonusScore * this.multiplier;
            this.score += totalBonus;
            if (this.score > this.highScore) {
              this.highScore = this.score;
              try { localStorage.setItem(HIGH_SCORE_KEY, String(this.highScore)); } catch (_) {}
            }
          }
          this.bonusScore = 0;

          if (this.ballNumber < this.maxBalls) {
            this.ballNumber++;
            this.multiplier = 1;
            this.kickbackLit = true;
            this.spawnBallInShooter();
            this.setDmd(`BALL ${this.ballNumber} OF ${this.maxBalls}`, 'PULL PLUNGER [SPACE / ↓] TO LAUNCH', 3.5);
          } else {
            this.gameOver = true;
            this.setDmd('RITUAL COMPLETE — GAME OVER', `FINAL SCORE: ${this.score.toLocaleString()}`, 99);
          }
        }
      }
    }

    // Step Particles & Floating Text
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      ft.y -= 28 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatTexts.splice(i, 1);
    }
  }

  spawnBurst(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const spd = 60 + Math.random() * 160;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        color,
        size: 2.5 + Math.random() * 2.5,
        life: 0.35 + Math.random() * 0.25,
        maxLife: 0.55,
      });
    }
  }

  addFloatText(x, y, text, color = '#fde047') {
    this.floatTexts.push({ x, y, text, color, life: 0.95, maxLife: 0.95 });
  }

  // Flipcrown lane lights left/right when player presses Left/Right Flipper (classic pinball lane-change skill!)
  cycleCrownLanes(dir) {
    const crown = this.rollovers.filter(r => r.group === 'crown');
    if (crown.length !== 3) return;
    const states = crown.map(r => r.lit);
    if (dir > 0) {
      crown[0].lit = states[2];
      crown[1].lit = states[0];
      crown[2].lit = states[1];
    } else {
      crown[0].lit = states[1];
      crown[1].lit = states[2];
      crown[2].lit = states[0];
    }
  }
}
