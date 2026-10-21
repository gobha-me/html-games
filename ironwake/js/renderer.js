// ============================================================================
// IRONWAKE // CONVOY — 2.5D Salt-Flat & Armored Train Battlefield Renderer
// ============================================================================

import {
  WORLD_W,
  WORLD_H,
  TRACK_Y,
} from './config.js';

export class IronwakeRenderer {
  constructor(canvas, onAssetsReady = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = {};
    this.onAssetsReady = onAssetsReady;
    this.scrollOffset = 0;
    this.hoverEnemyId = null;
    this.hoverCarId = null;

    // Pre-generate parallax salt-flat cracks, canyon mesas, and rail signal gantries
    this.desertFeatures = Array.from({ length: 48 }, (_, i) => ({
      x: (i * 79) % WORLD_W,
      y:
        i % 2 === 0
          ? 38 + ((i * 59) % (TRACK_Y - 135))
          : TRACK_Y + 88 + ((i * 67) % (WORLD_H - TRACK_Y - 135)),
      w: 32 + (i % 5) * 18,
      h: 12 + (i % 4) * 7,
      kind: i % 4 === 0 ? 'mesa' : i % 7 === 0 ? 'wreck' : 'salt',
    }));

    this.smokeParticles = [];
    this._loadSprites();
  }

  _loadSprites() {
    const manifest = {
      raider_skiff: 'assets/sprites/raider_skiff.png',
      harpoon_rig: 'assets/sprites/harpoon_rig.png',
      gyrocopter: 'assets/sprites/gyrocopter.png',
      siege_boss: 'assets/sprites/siege_boss.png',
    };
    let remaining = Object.keys(manifest).length;
    for (const [key, src] of Object.entries(manifest)) {
      const img = new Image();
      img.onload = () => {
        remaining -= 1;
        if (remaining <= 0 && typeof this.onAssetsReady === 'function') {
          this.onAssetsReady();
        }
      };
      img.src = src;
      this.sprites[key] = img;
    }
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = (clientX - rect.left) / Math.max(1, rect.width);
    const sy = (clientY - rect.top) / Math.max(1, rect.height);
    return {
      x: sx * WORLD_W,
      y: sy * WORLD_H,
    };
  }

  render(sim, dt = 0.016) {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    const mph = sim.getTrainSpeedMph();
    if (!sim.paused && !sim.gameOver) {
      this.scrollOffset = (this.scrollOffset + mph * 5.2 * dt) % 100000;
    }

    ctx.save();
    ctx.scale(cw / WORLD_W, ch / WORLD_H);

    this._drawScorchedSaltFlat(ctx, sim, dt, mph);
    this._drawRailroadTrackBed(ctx, sim);
    this._drawHarpoonTethers(ctx, sim);
    this._drawAegisShieldDome(ctx, sim);
    this._drawArmoredTrain25D(ctx, sim, dt);
    this._drawEnemies(ctx, sim);
    this._drawProjectilesAndExplosions(ctx, sim);
    this._drawCalloutsAndVignette(ctx, sim);

    ctx.restore();
  }

  _drawScorchedSaltFlat(ctx, sim, dt, mph) {
    const bg = ctx.createLinearGradient(0, 0, 0, WORLD_H);
    bg.addColorStop(0, '#18110c');
    bg.addColorStop(0.28, '#2b1d14');
    bg.addColorStop(0.5, '#19130f');
    bg.addColorStop(0.72, '#2b1d14');
    bg.addColorStop(1, '#160f0b');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Parallel raider combat lane tire tracks (top & bottom salt flat intercept corridors)
    for (const laneY of [190, 730]) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.11)';
      ctx.lineWidth = 46;
      ctx.beginPath();
      ctx.moveTo(0, laneY);
      ctx.lineTo(WORLD_W, laneY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(253, 224, 71, 0.14)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([18, 14]);
      ctx.beginPath();
      ctx.moveTo(0, laneY - 14);
      ctx.lineTo(WORLD_W, laneY - 14);
      ctx.moveTo(0, laneY + 14);
      ctx.lineTo(WORLD_W, laneY + 14);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Scrolling salt-flat polygons, canyon rock mesas & rusted wreckage
    const scroll = this.scrollOffset;
    for (const f of this.desertFeatures) {
      const fx =
        (((f.x - scroll * (f.kind === 'mesa' ? 0.65 : 0.92)) % WORLD_W) +
          WORLD_W) %
        WORLD_W;
      ctx.save();
      if (f.kind === 'mesa') {
        // 2.5D Canyon Rock Outcrop with warm sunlit bevel
        ctx.fillStyle = 'rgba(8, 5, 3, 0.68)';
        ctx.fillRect(fx + 7, f.y + 7, f.w, f.h + 10);
        ctx.fillStyle = '#3d281c';
        ctx.strokeStyle = '#785038';
        ctx.lineWidth = 1.6;
        ctx.fillRect(fx, f.y, f.w, f.h + 10);
        ctx.strokeRect(fx, f.y, f.w, f.h + 10);
      } else if (f.kind === 'wreck') {
        // Rusted wasteland girder / hulk
        ctx.strokeStyle = 'rgba(180, 83, 9, 0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(fx, f.y, f.w * 0.6, f.h * 0.7);
      } else {
        // Alkali salt-crust streak
        ctx.fillStyle = 'rgba(253, 230, 138, 0.09)';
        ctx.fillRect(fx, f.y, f.w * 1.45, 3);
      }
      ctx.restore();
    }
  }

  _drawRailroadTrackBed(ctx, sim) {
    ctx.save();
    // Raised gravel ballast embankment
    const ballastGrad = ctx.createLinearGradient(
      0,
      TRACK_Y - 64,
      0,
      TRACK_Y + 64
    );
    ballastGrad.addColorStop(0, 'rgba(12, 10, 9, 0)');
    ballastGrad.addColorStop(0.18, '#1c1815');
    ballastGrad.addColorStop(0.5, '#2b2522');
    ballastGrad.addColorStop(0.82, '#1c1815');
    ballastGrad.addColorStop(1, 'rgba(12, 10, 9, 0)');
    ctx.fillStyle = ballastGrad;
    ctx.fillRect(0, TRACK_Y - 64, WORLD_W, 128);

    // Scrolling heavy timber crossties
    const tieStep = 24;
    const tieOffset = this.scrollOffset % tieStep;
    ctx.fillStyle = '#3f2e21';
    ctx.strokeStyle = '#1c140d';
    ctx.lineWidth = 1;
    for (let x = -tieOffset; x < WORLD_W + tieStep; x += tieStep) {
      ctx.fillRect(x, TRACK_Y - 38, 10, 76);
      ctx.strokeRect(x, TRACK_Y - 38, 10, 76);
    }

    // Twin specular steel rails
    for (const ry of [TRACK_Y - 23, TRACK_Y + 23]) {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, ry - 3, WORLD_W, 6);
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(0, ry - 1, WORLD_W, 2);
    }

    // Scrolling trackside signal kilometer posts
    const postStep = 280;
    const postOffset = this.scrollOffset % postStep;
    for (let px = -postOffset; px < WORLD_W + postStep; px += postStep) {
      ctx.fillStyle = '#475569';
      ctx.fillRect(px, TRACK_Y - 56, 4, 14);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(px - 2, TRACK_Y - 58, 8, 4);
    }
    ctx.restore();
  }

  _drawHarpoonTethers(ctx, sim) {
    if (sim.harpoons.length === 0) return;
    ctx.save();
    for (const h of sim.harpoons) {
      const en = sim.enemies.find((e) => e.id === h.enemyId);
      const car = sim.cars.find((c) => c.id === h.carId);
      if (!en || !car) continue;

      // High-tension steel cable with red warning pulse
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(en.x, en.y);
      ctx.lineTo(car.x, car.y);
      ctx.stroke();

      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(en.x, en.y);
      ctx.lineTo(car.x, car.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cable warning tag positioned near the enemy winch so it never obscures the train cars
      const mx = en.x * 0.65 + car.x * 0.35;
      const my = en.y * 0.65 + car.y * 0.35;
      ctx.fillStyle = 'rgba(127, 29, 29, 0.94)';
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1.3;
      ctx.fillRect(mx - 44, my - 9, 88, 18);
      ctx.strokeRect(mx - 44, my - 9, 88, 18);
      ctx.font = '800 9.5px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fef2f2';
      ctx.textAlign = 'center';
      ctx.fillText('⚓ TETHER [Q]', mx, my + 3.5);

      // Harpoon anchor head on car
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(car.x, car.y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawAegisShieldDome(ctx, sim) {
    if (sim.shieldHp <= 2) return;
    const ratio = sim.shieldHp / sim.maxShieldHp;
    ctx.save();
    const cx = WORLD_W * 0.5 - 12;
    const cy = TRACK_Y;
    const rx = 435;
    const ry = 88;

    const shieldGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, rx);
    shieldGrad.addColorStop(0, 'rgba(56, 189, 248, 0.02)');
    shieldGrad.addColorStop(
      0.84,
      `rgba(56, 189, 248, ${(0.08 + ratio * 0.14).toFixed(3)})`
    );
    shieldGrad.addColorStop(
      1,
      `rgba(56, 189, 248, ${(0.24 + ratio * 0.26).toFixed(3)})`
    );

    ctx.fillStyle = shieldGrad;
    ctx.strokeStyle = `rgba(56, 189, 248, ${(0.38 + ratio * 0.45).toFixed(3)})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawArmoredTrain25D(ctx, sim, dt) {
    ctx.save();

    // Draw heavy steel couplings & dual steam manifolds between adjacent cars
    for (let i = 0; i < sim.cars.length - 1; i++) {
      const a = sim.cars[i];
      const b = sim.cars[i + 1];
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(a.x - a.width * 0.5, a.y);
      ctx.lineTo(b.x + b.width * 0.5, b.y);
      ctx.stroke();

      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(a.x - a.width * 0.5, a.y - 8);
      ctx.lineTo(b.x + b.width * 0.5, b.y - 8);
      ctx.moveTo(a.x - a.width * 0.5, a.y + 8);
      ctx.lineTo(b.x + b.width * 0.5, b.y + 8);
      ctx.stroke();
    }

    for (const car of sim.cars) {
      const isSelected = car.id === sim.selectedCarId;
      const isHovered = car.id === this.hoverCarId;
      const w = car.width;
      const h = car.height;
      const x = car.x - w * 0.5;
      const y = car.y - h * 0.5;

      ctx.save();
      // Drop shadow on track
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(x + 6, y + 10, w, h);

      // Heavy steel wheel bogies protruding slightly top/bottom
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.4;
      for (const bx of [x + 14, x + w - 34]) {
        ctx.fillRect(bx, y - 4, 20, 4);
        ctx.strokeRect(bx, y - 4, 20, 4);
        ctx.fillRect(bx, y + h, 20, 4);
        ctx.strokeRect(bx, y + h, 20, 4);
      }

      // Selection / hover outline
      if (isSelected || isHovered) {
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.8;
        ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
      }

      // 2.5D Armored Hull Base with distinct profile per car class
      const hullGrad = ctx.createLinearGradient(x, y, x, y + h);
      if (car.hitFlash > 0) {
        hullGrad.addColorStop(0, '#fef08a');
        hullGrad.addColorStop(1, '#f59e0b');
      } else if (car.id === 'loco') {
        hullGrad.addColorStop(0, '#473628');
        hullGrad.addColorStop(0.5, '#291f17');
        hullGrad.addColorStop(1, '#140f0b');
      } else {
        hullGrad.addColorStop(0, '#334155');
        hullGrad.addColorStop(0.5, '#1e293b');
        hullGrad.addColorStop(1, '#0f172a');
      }
      ctx.fillStyle = hullGrad;
      ctx.strokeStyle = car.color;
      ctx.lineWidth = 2.4;

      if (car.id === 'aegis') {
        // Tapered rear observation caboose profile
        ctx.beginPath();
        ctx.moveTo(x + 18, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + 18, y + h);
        ctx.lineTo(x, y + h - 14);
        ctx.lineTo(x, y + 14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (car.id === 'autocannon') {
        // Chamfered sloped-armor rotary gunboat hull
        const ch = 11;
        ctx.beginPath();
        ctx.moveTo(x + ch, y);
        ctx.lineTo(x + w - ch, y);
        ctx.lineTo(x + w, y + ch);
        ctx.lineTo(x + w, y + h - ch);
        ctx.lineTo(x + w - ch, y + h);
        ctx.lineTo(x + ch, y + h);
        ctx.lineTo(x, y + h - ch);
        ctx.lineTo(x, y + ch);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
      }

      // Armored rivet ribs along car roof
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.34)';
      ctx.lineWidth = 1.5;
      for (let rx = x + 20; rx < x + w - 16; rx += 22) {
        ctx.beginPath();
        ctx.moveTo(rx, y + 4);
        ctx.lineTo(rx, y + h - 4);
        ctx.stroke();
      }

      // Bespoke car superstructure details
      if (car.id === 'loco') {
        // Reciprocating brass side piston rods
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(x + 16, y - 3, w - 32, 3);
        ctx.fillRect(x + 16, y + h, w - 32, 3);

        // Glowing boiler furnace grates & twin smokestacks
        ctx.fillStyle = 'rgba(249, 115, 22, 0.9)';
        ctx.fillRect(x + 12, y + 10, 24, 15);
        ctx.fillRect(x + 12, y + h - 25, 24, 15);
        ctx.fillStyle = '#090705';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x + w - 26, car.y - 14, 6, 0, Math.PI * 2);
        ctx.arc(x + w - 26, car.y + 14, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Red-hot cowcatcher wedge on front (+X)
        ctx.fillStyle = '#ea580c';
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x + w, y + 3);
        ctx.lineTo(x + w + 34, car.y);
        ctx.lineTo(x + w, y + h - 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Locomotive forward floodlight cone
        const cone = ctx.createLinearGradient(x + w + 22, car.y, x + w + 300, car.y);
        cone.addColorStop(0, 'rgba(253, 224, 71, 0.42)');
        cone.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(x + w + 22, car.y - 14);
        ctx.lineTo(x + w + 300, car.y - 90);
        ctx.lineTo(x + w + 300, car.y + 90);
        ctx.lineTo(x + w + 22, car.y + 14);
        ctx.closePath();
        ctx.fill();

        // Spawn exhaust smoke/ember particles
        if (!sim.paused && Math.random() < 0.65) {
          this.smokeParticles.push({
            x: car.x + 18,
            y: car.y + (Math.random() - 0.5) * 14,
            vx: -140 - Math.random() * 80,
            vy: (Math.random() - 0.5) * 28,
            r: 6 + Math.random() * 6,
            alpha: 0.65,
            ember: Math.random() < 0.35,
          });
        }
      } else if (car.id === 'autocannon') {
        // Dual brass rotary ammo drums flanking turret
        ctx.fillStyle = '#b45309';
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 1.4;
        ctx.fillRect(x + 14, y + 10, 16, 14);
        ctx.strokeRect(x + 14, y + 10, 16, 14);
        ctx.fillRect(x + w - 30, y + h - 24, 16, 14);
        ctx.strokeRect(x + w - 30, y + h - 24, 16, 14);
      } else if (car.id === 'flak') {
        // Anti-air octagonal flak deck & radar dish
        ctx.strokeStyle = '#e9d5ff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 10, y + 8, w - 20, h - 16);
        ctx.beginPath();
        ctx.arc(x + 22, car.y, 7, 0, Math.PI * 1.4);
        ctx.stroke();
      } else if (car.id === 'aegis') {
        // Glowing cyan Aegis shield projector dome on caboose roof
        ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(car.x - 28, car.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else if (car.id === 'mortar') {
        // Twin glowing thermal plasma vats on artillery flatbed
        ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1.4;
        ctx.fillRect(x + 12, y + 9, 18, h - 18);
        ctx.strokeRect(x + 12, y + 9, 18, h - 18);
        ctx.fillRect(x + w - 30, y + 9, 18, h - 18);
        ctx.strokeRect(x + w - 30, y + 9, 18, h - 18);
      }

      // Rotating Turret Sponson on roof
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.turretAngle);

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = car.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Distinct gun barrels by weaponType
      ctx.fillStyle = car.accent;
      if (car.weaponType === 'flak') {
        // Quad 88mm flak barrels
        ctx.fillRect(5, -9, 21, 3);
        ctx.fillRect(5, -4, 24, 3);
        ctx.fillRect(5, 1, 24, 3);
        ctx.fillRect(5, 6, 21, 3);
      } else if (car.weaponType === 'plasma') {
        // Heavy siege mortar barrel
        ctx.fillRect(4, -6, 22, 12);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(22, -4, 5, 8);
      } else {
        // Twin high-velocity rotary barrels
        ctx.fillRect(6, -6, 24, 4);
        ctx.fillRect(6, 2, 24, 4);
      }
      ctx.restore();

      // Car index badge & HP bar below car
      const hpPct = Math.max(0, car.hp / car.maxHp);
      ctx.fillStyle = 'rgba(9, 13, 22, 0.92)';
      ctx.fillRect(x + 8, y + h + 7, w - 16, 7);
      ctx.fillStyle =
        hpPct > 0.5 ? '#10b981' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(x + 8, y + h + 7, (w - 16) * hpPct, 7);

      ctx.font = '800 10.5px "JetBrains Mono", monospace';
      ctx.fillStyle = isSelected ? '#fde047' : car.accent;
      ctx.textAlign = 'center';
      ctx.fillText(
        `[${car.index + 1}] ${car.name.split(' ')[0]} MK-${car.weaponLevel}`,
        car.x,
        y - 9
      );

      // Selected car upgrade callout under car
      if (isSelected) {
        ctx.font = '800 9.5px "JetBrains Mono", monospace';
        ctx.fillStyle = '#fde68a';
        ctx.fillText('▲ SELECTED [U: UPGRADE]', car.x, y + h + 26);
      }

      ctx.restore();
    }

    // Update & render locomotive steam/ember plume
    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const sp = this.smokeParticles[i];
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.r += 18 * dt;
      sp.alpha -= 0.75 * dt;
      if (sp.alpha <= 0) {
        this.smokeParticles.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = Math.max(0, sp.alpha);
      ctx.fillStyle = sp.ember ? '#f97316' : 'rgba(148, 163, 184, 0.45)';
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.ember ? 3.5 : sp.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  _drawEnemies(ctx, sim) {
    for (const en of sim.enemies) {
      const isSelected = en.id === sim.selectedEnemyId;
      const isHovered = en.id === this.hoverEnemyId;
      const sprite = this.sprites[en.sprite];

      ctx.save();
      ctx.translate(en.x, en.y);

      // Dust plume behind ground vehicles
      if (!en.isAir) {
        ctx.fillStyle = 'rgba(217, 119, 6, 0.18)';
        ctx.beginPath();
        ctx.ellipse(-en.radius * 0.85, 6, en.radius * 0.7, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // Target focus reticle ring
      if (isSelected || isHovered) {
        const pulse = 0.5 + 0.5 * Math.sin(sim.time * 7);
        ctx.strokeStyle = isSelected ? '#ef4444' : '#ffffff';
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, en.radius + 11 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Shadow on salt flat
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.ellipse(
        6,
        en.isAir ? 26 : 8,
        en.radius * 0.9,
        en.radius * 0.55,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Draw pixel-art vehicle sprite
      ctx.save();
      if (en.isBoss) {
        ctx.rotate(0);
      } else {
        ctx.rotate(en.vx < -20 ? Math.PI : 0);
      }

      const drawSz = en.isBoss ? 156 : en.radius * 2.25;
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        if (en.hitFlash > 0) {
          ctx.filter = 'brightness(2.2) contrast(1.2)';
        }
        ctx.drawImage(sprite, -drawSz * 0.5, -drawSz * 0.5, drawSz, drawSz);
        ctx.filter = 'none';
      } else {
        ctx.fillStyle = en.color;
        ctx.beginPath();
        ctx.arc(0, 0, en.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // HP Bar & Subsystem status pills above enemy
      const barW = en.isBoss ? 136 : 90;
      const barY = -en.radius - 22;
      ctx.fillStyle = 'rgba(9, 13, 22, 0.92)';
      ctx.fillRect(-barW * 0.5, barY, barW, 8);
      ctx.fillStyle = en.color;
      ctx.fillRect(
        -barW * 0.5,
        barY,
        barW * Math.max(0, en.hp / en.maxHp),
        8
      );
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-barW * 0.5, barY, barW, 8);

      // Name & active subsystem tags
      ctx.font = '800 10.5px "JetBrains Mono", monospace';
      ctx.fillStyle = isSelected ? '#fde047' : '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${isSelected ? '🎯 ' : ''}${en.name}`,
        0,
        barY - 6
      );

      // Starting-state onboarding prompt above the primary target War-Rig
      if (isSelected && !sim.userLockedTarget) {
        const promptText = '▼ CLICK ANY WAR-RIG TO FOCUS TURRETS';
        ctx.font = '900 10.5px "JetBrains Mono", monospace';
        const pw = ctx.measureText(promptText).width + 18;
        const py = barY - 40;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 1.5;
        ctx.fillRect(-pw * 0.5, py, pw, 20);
        ctx.strokeRect(-pw * 0.5, py, pw, 20);
        ctx.fillStyle = '#090604';
        ctx.fillText(promptText, 0, py + 13.5);
      }

      // Subsystem mini-indicators below vehicle
      const subs = [
        { k: 'weapons', code: 'WPN' },
        { k: 'engine', code: 'ENG' },
        ...(en.canHarpoon ? [{ k: 'winch', code: 'HARP' }] : []),
      ];
      const pillW = 36;
      const totalW = subs.length * (pillW + 4) - 4;
      subs.forEach((s, idx) => {
        const st = en.subsystems[s.k];
        const px = -totalW * 0.5 + idx * (pillW + 4);
        const py = en.radius + 8;
        ctx.fillStyle = st.destroyed
          ? 'rgba(127, 29, 29, 0.92)'
          : 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle =
          isSelected && sim.targetSubsystem === s.k ? '#fde047' : '#475569';
        ctx.lineWidth = 1.3;
        ctx.fillRect(px, py, pillW, 14);
        ctx.strokeRect(px, py, pillW, 14);

        ctx.font = '800 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = st.destroyed ? '#fca5a5' : '#e2e8f0';
        ctx.fillText(st.destroyed ? 'OUT' : s.code, px + pillW * 0.5, py + 10);
      });

      ctx.restore();
    }
  }

  _drawProjectilesAndExplosions(ctx, sim) {
    ctx.save();
    for (const p of sim.projectiles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const ang = Math.atan2(p.vy, p.vx);
      ctx.rotate(ang);

      ctx.fillStyle = p.color;
      ctx.fillRect(-p.radius * 2.4, -p.radius * 0.65, p.radius * 4.8, p.radius * 1.3);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.radius, 0, p.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const ex of sim.explosions) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ex.alpha);
      const g = ctx.createRadialGradient(ex.x, ex.y, 2, ex.x, ex.y, ex.r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, ex.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(ex.x, ex.y, ex.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  _drawCalloutsAndVignette(ctx, sim) {
    ctx.save();
    for (const c of sim.callouts) {
      const alpha = Math.max(0, Math.min(1, c.life / 1.35));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const w = ctx.measureText(c.text).width + 18;
      ctx.fillStyle = 'rgba(9, 13, 22, 0.92)';
      ctx.fillRect(c.x - w * 0.5, c.y - 14, w, 20);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }

    // Desert heat-haze edge vignette
    const vig = ctx.createRadialGradient(
      WORLD_W * 0.5,
      WORLD_H * 0.5,
      WORLD_W * 0.38,
      WORLD_W * 0.5,
      WORLD_H * 0.5,
      WORLD_W * 0.72
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(10, 6, 4, 0.58)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }
}
