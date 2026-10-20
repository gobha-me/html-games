// ============================================================================
// IRONWAKE // CONVOY — 2.5D Salt-Flat & Armored Train Battlefield Renderer
// ============================================================================

import {
  WORLD_W,
  WORLD_H,
  TRACK_Y,
} from './config.js';

export class IronwakeRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = {};
    this.scrollOffset = 0;
    this.hoverEnemyId = null;
    this.hoverCarId = null;

    // Pre-generate parallax salt-flat cracks, boulders, and ember particles
    this.desertFeatures = Array.from({ length: 42 }, (_, i) => ({
      x: (i * 83) % WORLD_W,
      y:
        i % 2 === 0
          ? 45 + ((i * 59) % (TRACK_Y - 125))
          : TRACK_Y + 85 + ((i * 67) % (WORLD_H - TRACK_Y - 130)),
      w: 28 + (i % 5) * 16,
      h: 10 + (i % 4) * 6,
      kind: i % 4 === 0 ? 'mesa' : 'salt',
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
    for (const [key, src] of Object.entries(manifest)) {
      const img = new Image();
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
    bg.addColorStop(0, '#1c1410');
    bg.addColorStop(0.35, '#2b1d15');
    bg.addColorStop(0.5, '#191310');
    bg.addColorStop(0.65, '#2b1d15');
    bg.addColorStop(1, '#18110d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Parallel raider combat lane tracks (top and bottom desert trails)
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.lineWidth = 38;
    ctx.beginPath();
    ctx.moveTo(0, 200);
    ctx.lineTo(WORLD_W, 200);
    ctx.moveTo(0, 720);
    ctx.lineTo(WORLD_W, 720);
    ctx.stroke();

    // Scrolling salt-flat polygons & canyon rock mesas
    const scroll = this.scrollOffset;
    for (const f of this.desertFeatures) {
      const fx =
        (((f.x - scroll * (f.kind === 'mesa' ? 0.65 : 0.9)) % WORLD_W) +
          WORLD_W) %
        WORLD_W;
      ctx.save();
      if (f.kind === 'mesa') {
        // 2.5D Canyon Rock Outcrop
        ctx.fillStyle = 'rgba(10, 7, 5, 0.65)';
        ctx.fillRect(fx + 6, f.y + 6, f.w, f.h + 8);
        ctx.fillStyle = '#3d281d';
        ctx.strokeStyle = '#6b4733';
        ctx.lineWidth = 1.5;
        ctx.fillRect(fx, f.y, f.w, f.h + 8);
        ctx.strokeRect(fx, f.y, f.w, f.h + 8);
      } else {
        // Alkali salt-crust streak
        ctx.fillStyle = 'rgba(234, 179, 8, 0.08)';
        ctx.fillRect(fx, f.y, f.w * 1.4, 3);
      }
      ctx.restore();
    }
  }

  _drawRailroadTrackBed(ctx, sim) {
    ctx.save();
    // Raised gravel ballast embankment
    const ballastGrad = ctx.createLinearGradient(
      0,
      TRACK_Y - 58,
      0,
      TRACK_Y + 58
    );
    ballastGrad.addColorStop(0, 'rgba(12, 10, 9, 0)');
    ballastGrad.addColorStop(0.2, '#1c1917');
    ballastGrad.addColorStop(0.5, '#292524');
    ballastGrad.addColorStop(0.8, '#1c1917');
    ballastGrad.addColorStop(1, 'rgba(12, 10, 9, 0)');
    ctx.fillStyle = ballastGrad;
    ctx.fillRect(0, TRACK_Y - 58, WORLD_W, 116);

    // Scrolling heavy timber crossties
    const tieStep = 24;
    const tieOffset = this.scrollOffset % tieStep;
    ctx.fillStyle = '#3f2e21';
    ctx.strokeStyle = '#1c140d';
    ctx.lineWidth = 1;
    for (let x = -tieOffset; x < WORLD_W + tieStep; x += tieStep) {
      ctx.fillRect(x, TRACK_Y - 36, 10, 72);
      ctx.strokeRect(x, TRACK_Y - 36, 10, 72);
    }

    // Twin specular steel rails
    for (const ry of [TRACK_Y - 22, TRACK_Y + 22]) {
      ctx.fillStyle = '#64748b';
      ctx.fillRect(0, ry - 3, WORLD_W, 6);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, ry - 1, WORLD_W, 2);
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
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(en.x, en.y);
      ctx.lineTo(car.x, car.y);
      ctx.stroke();

      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(en.x, en.y);
      ctx.lineTo(car.x, car.y);
      ctx.stroke();
      ctx.setLineDash([]);

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
    const rx = 425;
    const ry = 82;

    const shieldGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, rx);
    shieldGrad.addColorStop(0, 'rgba(56, 189, 248, 0.02)');
    shieldGrad.addColorStop(
      0.85,
      `rgba(56, 189, 248, ${(0.08 + ratio * 0.14).toFixed(3)})`
    );
    shieldGrad.addColorStop(
      1,
      `rgba(56, 189, 248, ${(0.22 + ratio * 0.25).toFixed(3)})`
    );

    ctx.fillStyle = shieldGrad;
    ctx.strokeStyle = `rgba(56, 189, 248, ${(0.35 + ratio * 0.45).toFixed(3)})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawArmoredTrain25D(ctx, sim, dt) {
    ctx.save();

    // Draw heavy steel couplings between adjacent cars
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 8;
    for (let i = 0; i < sim.cars.length - 1; i++) {
      const a = sim.cars[i];
      const b = sim.cars[i + 1];
      ctx.beginPath();
      ctx.moveTo(a.x - a.width * 0.5, a.y);
      ctx.lineTo(b.x + b.width * 0.5, b.y);
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
      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(x + 6, y + 10, w, h);

      // Selection / hover outline
      if (isSelected || isHovered) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.6;
        ctx.strokeRect(x - 5, y - 5, w + 10, h + 10);
      }

      // 2.5D Armored Hull Base
      const hullGrad = ctx.createLinearGradient(x, y, x, y + h);
      if (car.hitFlash > 0) {
        hullGrad.addColorStop(0, '#fef08a');
        hullGrad.addColorStop(1, '#f59e0b');
      } else {
        hullGrad.addColorStop(0, '#334155');
        hullGrad.addColorStop(0.5, '#1e293b');
        hullGrad.addColorStop(1, '#0f172a');
      }
      ctx.fillStyle = hullGrad;
      ctx.strokeStyle = car.color;
      ctx.lineWidth = 2.2;
      ctx.fillRect(x, y, w, h);
      ctx.strokeRect(x, y, w, h);

      // Armored rivet ribs along car roof
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
      ctx.lineWidth = 1.5;
      for (let rx = x + 18; rx < x + w - 14; rx += 22) {
        ctx.beginPath();
        ctx.moveTo(rx, y + 4);
        ctx.lineTo(rx, y + h - 4);
        ctx.stroke();
      }

      // Locomotive glowing furnace cowcatcher & headlight cone
      if (car.id === 'loco') {
        // Red-hot cowcatcher wedge on front (+X)
        ctx.fillStyle = '#ea580c';
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x + w, y + 4);
        ctx.lineTo(x + w + 28, car.y);
        ctx.lineTo(x + w, y + h - 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Locomotive forward floodlight cone
        const cone = ctx.createLinearGradient(x + w + 20, car.y, x + w + 260, car.y);
        cone.addColorStop(0, 'rgba(253, 224, 71, 0.36)');
        cone.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = cone;
        ctx.beginPath();
        ctx.moveTo(x + w + 20, car.y - 12);
        ctx.lineTo(x + w + 260, car.y - 78);
        ctx.lineTo(x + w + 260, car.y + 78);
        ctx.lineTo(x + w + 20, car.y + 12);
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
      }

      // Rotating Turret Sponson on roof
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.turretAngle);

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = car.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Twin gun barrels
      ctx.fillStyle = car.accent;
      ctx.fillRect(6, -6, 22, 4);
      ctx.fillRect(6, 2, 22, 4);
      ctx.restore();

      // Car index badge & HP bar below car
      const hpPct = Math.max(0, car.hp / car.maxHp);
      ctx.fillStyle = 'rgba(9, 13, 22, 0.9)';
      ctx.fillRect(x + 8, y + h + 6, w - 16, 7);
      ctx.fillStyle =
        hpPct > 0.5 ? '#10b981' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(x + 8, y + h + 6, (w - 16) * hpPct, 7);

      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillStyle = car.accent;
      ctx.textAlign = 'center';
      ctx.fillText(
        `[${car.index + 1}] ${car.name.split(' ')[0]} MK-${car.weaponLevel}`,
        car.x,
        y - 8
      );

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

      // Target focus reticle ring
      if (isSelected || isHovered) {
        const pulse = 0.5 + 0.5 * Math.sin(sim.time * 7);
        ctx.strokeStyle = isSelected ? '#ef4444' : '#ffffff';
        ctx.lineWidth = 2.8;
        ctx.setLineDash([10, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, en.radius + 10 + pulse * 4, 0, Math.PI * 2);
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
        // Boss sprite faces left natively; orient slightly toward track
        ctx.rotate(0);
      } else {
        // Raider sprites face right (+X) along the train direction
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
      const barW = en.isBoss ? 130 : 84;
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
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-barW * 0.5, barY, barW, 8);

      // Name & active subsystem tags
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillStyle = isSelected ? '#fde047' : '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${isSelected ? '🎯 ' : ''}${en.name}`,
        0,
        barY - 5
      );

      // Subsystem mini-indicators below vehicle
      const subs = [
        { k: 'weapons', code: 'WPN' },
        { k: 'engine', code: 'ENG' },
        ...(en.canHarpoon ? [{ k: 'winch', code: 'HARP' }] : []),
      ];
      const pillW = 34;
      const totalW = subs.length * (pillW + 4) - 4;
      subs.forEach((s, idx) => {
        const st = en.subsystems[s.k];
        const px = -totalW * 0.5 + idx * (pillW + 4);
        const py = en.radius + 8;
        ctx.fillStyle = st.destroyed
          ? 'rgba(127, 29, 29, 0.9)'
          : 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle =
          isSelected && sim.targetSubsystem === s.k ? '#fde047' : '#475569';
        ctx.lineWidth = 1.2;
        ctx.fillRect(px, py, pillW, 13);
        ctx.strokeRect(px, py, pillW, 13);

        ctx.font = '700 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = st.destroyed ? '#fca5a5' : '#e2e8f0';
        ctx.fillText(st.destroyed ? 'OUT' : s.code, px + pillW * 0.5, py + 9.5);
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
      ctx.fillRect(-p.radius * 2.2, -p.radius * 0.6, p.radius * 4.4, p.radius * 1.2);
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
      WORLD_W * 0.36,
      WORLD_W * 0.5,
      WORLD_H * 0.5,
      WORLD_W * 0.7
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(10, 6, 4, 0.62)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }
}
