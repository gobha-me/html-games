// ============================================================================
// DEAD DISTRICT // SECTOR 7 — 2.5D Urban Renderer & 2D Raycast Shadow Engine
// ============================================================================

import { WORLD_W, WORLD_H } from './config.js';

export class DeadDistrictRenderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

    // Offscreen darkness/shadow buffer for 2D raycast flashlight & dynamic lights
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');

    this.viewW = 900;
    this.viewH = 800;
    this.camX = 350;
    this.camY = 200;

    // Top-down 32-bit pixel art sprites (generated via Venice gpt-image-2-5-flare, hide_watermark: true)
    this.sprites = {};
    const spriteManifest = {
      operator: 'assets/sprites/operator.png',
      walker: 'assets/sprites/shambler.png',
      sprinter: 'assets/sprites/runner.png',
      spitter: 'assets/sprites/spitter.png',
      brute: 'assets/sprites/brute.png',
      screamer: 'assets/sprites/screamer.png',
      turret: 'assets/sprites/turret.png',
    };
    for (const [key, src] of Object.entries(spriteManifest)) {
      const img = new Image();
      img.onload = () => {
        if (this._lastSim) this.render(this._lastSim);
      };
      img.src = src;
      this.sprites[key] = img;
    }
  }

  resize() {
    const stage = document.getElementById('viewport-stage') || this.canvas.parentElement;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    this.viewW = Math.max(480, Math.floor(rect.width));
    this.viewH = Math.max(400, Math.floor(rect.height));

    this.canvas.style.width = `${this.viewW}px`;
    this.canvas.style.height = `${this.viewH}px`;
    this.canvas.width = Math.floor(this.viewW * dpr);
    this.canvas.height = Math.floor(this.viewH * dpr);

    this.lightCanvas.width = this.viewW;
    this.lightCanvas.height = this.viewH;
    this.dpr = dpr;
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: sx + this.camX,
      y: sy + this.camY,
    };
  }

  render(sim) {
    this._lastSim = sim;
    const ctx = this.ctx;
    const p = sim.player;

    // Smooth camera clamped to 1600x1200 world
    const targetCamX = Math.max(0, Math.min(WORLD_W - this.viewW, p.x - this.viewW * 0.5));
    const targetCamY = Math.max(0, Math.min(WORLD_H - this.viewH, p.y - this.viewH * 0.5));
    this.camX += (targetCamX - this.camX) * 0.18;
    this.camY += (targetCamY - this.camY) * 0.18;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);

    // 1. World Space Layer
    ctx.save();
    ctx.translate(-this.camX, -this.camY);

    this.drawStreetsAndBuildings(ctx, sim);
    this.drawDecalsAndHazards(ctx, sim);
    this.drawBarricadesAndCover(ctx, sim);
    this.drawPickupsAndTurrets(ctx, sim);
    this.drawEnemies(ctx, sim);
    this.drawPlayerAndProjectiles(ctx, sim);

    ctx.restore();

    // 2. 2D Raycast Flashlight & Dynamic Darkness Overlay
    this.renderLightingLayer(ctx, sim);

    // 3. Post-Light Tactical Overlays (Bio-Sonar Blips, Floating Callouts, Crosshair Banner)
    ctx.save();
    ctx.translate(-this.camX, -this.camY);
    this.drawPostLightOverlays(ctx, sim);
    ctx.restore();

    ctx.restore();

    // 4. Render Tactical Minimap
    if (this.minimapCtx) {
      this.renderMinimap(sim);
    }
  }

  drawStreetsAndBuildings(ctx, sim) {
    // Base Asphalt
    ctx.fillStyle = '#0d1017';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Subtle urban grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.stroke();
    }
    for (let y = 0; y <= WORLD_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke();
    }

    // Sidewalks around the 4 corner blocks
    ctx.fillStyle = '#171c26';
    ctx.strokeStyle = '#293242';
    ctx.lineWidth = 2;
    for (const [sx, sy, sw, sh] of [
      [50, 50, 500, 400],
      [1050, 50, 500, 400],
      [50, 750, 500, 400],
      [1050, 750, 500, 400],
    ]) {
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeRect(sx, sy, sw, sh);
    }

    // Roadway Double-Yellow Centerlines (North-South at x=800, East-West at y=600)
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.28)';
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 14]);
    ctx.beginPath();
    ctx.moveTo(800, 20); ctx.lineTo(800, 430);
    ctx.moveTo(800, 770); ctx.lineTo(800, 1180);
    ctx.moveTo(20, 600); ctx.lineTo(540, 600);
    ctx.moveTo(1060, 600); ctx.lineTo(1580, 600);
    ctx.stroke();
    ctx.setLineDash([]);

    // Zebra Crosswalks around Central Intersection
    ctx.fillStyle = 'rgba(226, 232, 240, 0.11)';
    for (let i = -3; i <= 3; i++) {
      ctx.fillRect(790 + i * 28, 432, 14, 34); // North crosswalk
      ctx.fillRect(790 + i * 28, 734, 14, 34); // South crosswalk
      ctx.fillRect(532, 590 + i * 24, 34, 12); // West crosswalk
      ctx.fillRect(1034, 590 + i * 24, 34, 12); // East crosswalk
    }

    // Central Evacuation / Supply Drop Helipad Circle at (800, 600)
    ctx.save();
    ctx.translate(800, 600);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, 76, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 56, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.font = '700 13px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EVAC // DROP ZONE', 0, -24);
    ctx.font = '700 26px "Barlow Condensed", sans-serif';
    ctx.fillText('H', 0, 8);
    ctx.restore();

    // 4 Enterable Corner Buildings
    for (const b of sim.buildings) {
      ctx.fillStyle = b.floorColor;
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // Interior tile checker
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let tx = b.x + 32; tx < b.x + b.w; tx += 32) {
        ctx.beginPath(); ctx.moveTo(tx, b.y); ctx.lineTo(tx, b.y + b.h); ctx.stroke();
      }
      for (let ty = b.y + 32; ty < b.y + b.h; ty += 32) {
        ctx.beginPath(); ctx.moveTo(b.x, ty); ctx.lineTo(b.x + b.w, ty); ctx.stroke();
      }

      // Building stencil label
      ctx.fillStyle = b.accent;
      ctx.globalAlpha = 0.35;
      ctx.font = '700 14px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w * 0.5, b.y + b.h * 0.5 - 6);
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.fillText(`${b.code} · SAFE-ROOM`, b.x + b.w * 0.5, b.y + b.h * 0.5 + 12);
      ctx.globalAlpha = 1;
    }
  }

  drawDecalsAndHazards(ctx, sim) {
    // Blood Splatters
    for (const d of sim.bloodDecals) {
      ctx.fillStyle = `rgba(127, 29, 29, ${d.alpha})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Spent Shell Casings
    for (const s of sim.shells) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillStyle = s.color;
      ctx.fillRect(-2.5, -1, 5, 2);
      ctx.restore();
    }

    // Active Fire & Acid Pools
    for (const h of sim.hazards) {
      const alpha = Math.min(1, h.life / 1.2);
      ctx.save();
      ctx.translate(h.x, h.y);
      if (h.type === 'fire') {
        const pulse = 0.88 + 0.12 * Math.sin(sim.time * 16);
        const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, h.r * pulse);
        grad.addColorStop(0, `rgba(254, 240, 138, ${0.75 * alpha})`);
        grad.addColorStop(0.5, `rgba(249, 115, 22, ${0.55 * alpha})`);
        grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, h.r * pulse, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const grad = ctx.createRadialGradient(0, 0, 6, 0, 0, h.r);
        grad.addColorStop(0, `rgba(52, 211, 153, ${0.55 * alpha})`);
        grad.addColorStop(0.7, `rgba(16, 185, 129, ${0.32 * alpha})`);
        grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, h.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawBarricadesAndCover(ctx, sim) {
    // 1. Destructible Doorway Barricades
    for (const b of sim.barricades) {
      const ratio = b.hp / b.maxHp;
      ctx.save();
      if (b.hp > 0) {
        ctx.fillStyle = ratio > 0.5 ? '#78350f' : '#991b1b';
        ctx.strokeStyle = ratio > 0.5 ? '#f59e0b' : '#f87171';
        ctx.lineWidth = 1.5;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeRect(b.x, b.y, b.w, b.h);

        // Diagonal wooden/steel reinforcement planks
        ctx.strokeStyle = 'rgba(254, 243, 199, 0.35)';
        ctx.beginPath();
        ctx.moveTo(b.x + 3, b.y + 3);
        ctx.lineTo(b.x + b.w - 3, b.y + b.h - 3);
        ctx.stroke();
      } else {
        // Breached doorway outline
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // 2. Concrete Walls, Abandoned Vehicles & Jersey Barriers
    for (const w of sim.walls) {
      if (w.type === 'wall') {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeRect(w.x, w.y, w.w, w.h);
      } else if (w.type === 'vehicle') {
        ctx.save();
        ctx.fillStyle = w.color || '#1e293b';
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 2;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeRect(w.x, w.y, w.w, w.h);

        // Windshield & Rear Window
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(w.x + 16, w.y + 6, 22, w.h - 12);
        ctx.fillRect(w.x + w.w - 32, w.y + 6, 18, w.h - 12);

        // Emergency Police/EMS Lightbar
        const flashRed = Math.sin(sim.time * 14) > 0;
        ctx.fillStyle = flashRed ? '#ef4444' : '#3b82f6';
        ctx.fillRect(w.x + w.w * 0.5 - 4, w.y + 8, 8, w.h - 16);

        ctx.fillStyle = '#cbd5e1';
        ctx.font = '700 8.5px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(w.label || 'WRECK', w.x + w.w * 0.5, w.y - 5);
        ctx.restore();
      } else {
        // Jersey barrier
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 1.5;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeRect(w.x, w.y, w.w, w.h);
      }
    }
  }

  drawPickupsAndTurrets(ctx, sim) {
    // Field Supply Pickups
    for (const p of sim.pickups) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const col = p.type === 'med' ? '#10b981' : p.type === 'ammo' ? '#f59e0b' : '#38bdf8';
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = col;
      ctx.font = '700 9px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.type === 'med' ? '+' : p.type === 'ammo' ? 'A' : '$', 0, 0.5);
      ctx.restore();
    }

    // Deployed Aegis Auto-Turrets
    const turretSprite = this.sprites.turret;
    for (const t of sim.turrets) {
      ctx.save();
      ctx.translate(t.x, t.y);

      // Laser sight beam
      ctx.strokeStyle = 'rgba(56, 242, 215, 0.28)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(t.angle) * 165, Math.sin(t.angle) * 165);
      ctx.stroke();

      ctx.rotate(t.angle);
      if (turretSprite && turretSprite.complete && turretSprite.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(turretSprite, -23, -23, 46, 46);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#38f2d7';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#38f2d7';
        ctx.fillRect(0, -2.5, 16, 5);
      }
      ctx.restore();
    }
  }

  drawEnemies(ctx, sim) {
    for (const e of sim.enemies) {
      ctx.save();
      ctx.translate(e.x, e.y);

      // Screamer acoustic aura
      if (e.def.screamer) {
        ctx.strokeStyle = 'rgba(232, 121, 249, 0.38)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 8 + Math.sin(sim.time * 8) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Burning overlay
      if (e.burnTimer > 0) {
        ctx.fillStyle = 'rgba(249, 115, 22, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 6, 0, Math.PI * 2);
        ctx.fill();
      }

      const swayAngle = Math.sin(e.stepPhase) * (e.def.id === 'sprinter' ? 0.13 : 0.08);
      ctx.rotate(e.angle + swayAngle);

      const sprite = this.sprites[e.def.id];
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        const size = e.def.id === 'brute' ? 68 : e.def.id === 'screamer' ? 52 : e.def.id === 'spitter' ? 50 : 46;
        ctx.imageSmoothingEnabled = false;
        if (e.hitFlash > 0) {
          ctx.filter = 'brightness(1.85) contrast(1.2)';
        }
        ctx.drawImage(sprite, -size * 0.46, -size * 0.5, size, size);
        ctx.filter = 'none';
      } else {
        const sway = Math.sin(e.stepPhase) * 2.5;
        ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.def.color;
        ctx.strokeStyle = '#090b10';
        ctx.lineWidth = 1.8;

        ctx.fillRect(2, -e.r * 0.85 + sway, e.r * 0.85, 5);
        ctx.fillRect(2, e.r * 0.85 - 5 - sway, e.r * 0.85, 5);

        ctx.beginPath();
        ctx.arc(0, 0, e.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();

      // Mini HP bar for damaged Brutes / Screamers
      if (e.hp < e.maxHp && (e.def.armored || e.def.screamer || e.maxHp > 90)) {
        const bw = 30;
        ctx.fillStyle = 'rgba(9, 11, 16, 0.85)';
        ctx.fillRect(e.x - bw * 0.5, e.y - e.r - 12, bw, 4);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(e.x - bw * 0.5, e.y - e.r - 12, bw * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
  }

  drawPlayerAndProjectiles(ctx, sim) {
    // Bullets
    for (const b of sim.bullets) {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.armorPiercing ? 3 : 2.2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022);
      ctx.stroke();
    }

    // Spitter Acid Globules
    for (const a of sim.acidProjectiles) {
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(a.x, a.y, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Operator Player
    const p = sim.player;
    const w = sim.currentWeapon;
    ctx.save();
    ctx.translate(p.x, p.y);

    // Subtle tactical weapon-tier ring under operator
    ctx.strokeStyle = w.color;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, p.r + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.rotate(p.angle);

    // Muzzle flash star
    if (p.muzzleFlash > 0) {
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(27, 2, 9.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const opSprite = this.sprites.operator;
    if (opSprite && opSprite.complete && opSprite.naturalWidth > 0) {
      ctx.imageSmoothingEnabled = false;
      if (p.hitFlash > 0) {
        ctx.filter = 'brightness(1.6) sepia(1) hue-rotate(-50deg) saturate(3)';
      }
      ctx.drawImage(opSprite, -24, -27, 54, 54);
      ctx.filter = 'none';
    } else {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(8, 1, 16, 4.5);

      ctx.fillStyle = p.hitFlash > 0 ? '#ef4444' : '#1e293b';
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(4, -5, 6, 10);
    }

    ctx.restore();

    // Reload progress ring around player
    if (sim.reloadTimer > 0) {
      const total = sim.currentWeapon.reloadTime / (1 + sim.perks.speedLoader * 0.25);
      const prog = 1 - sim.reloadTimer / total;
      ctx.strokeStyle = '#fde047';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + 7, -Math.PI * 0.5, -Math.PI * 0.5 + prog * Math.PI * 2);
      ctx.stroke();
    }

    // Particles
    for (const pt of sim.particles) {
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size * 0.5, pt.y - pt.size * 0.5, pt.size, pt.size);
    }
  }

  // True 2D Raycast Flashlight Cone + Ambient Streetlamps Shadow Layer
  renderLightingLayer(mainCtx, sim) {
    const lctx = this.lightCtx;
    const w = this.viewW;
    const h = this.viewH;
    const p = sim.player;

    lctx.save();
    lctx.clearRect(0, 0, w, h);

    // Base night darkness (74% opacity so tactical street geometry stays readable while atmospheric)
    lctx.fillStyle = 'rgba(4, 6, 12, 0.74)';
    lctx.fillRect(0, 0, w, h);

    lctx.globalCompositeOperation = 'destination-out';

    // 1. Player Personal Ambient Halo
    const px = p.x - this.camX;
    const py = p.y - this.camY;
    const selfRadius = p.muzzleFlash > 0 ? 220 : 88;
    const selfGrad = lctx.createRadialGradient(px, py, 12, px, py, selfRadius);
    selfGrad.addColorStop(0, 'rgba(0,0,0,1)');
    selfGrad.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = selfGrad;
    lctx.beginPath();
    lctx.arc(px, py, selfRadius, 0, Math.PI * 2);
    lctx.fill();

    // 2. 2D Raycast Directional Flashlight Cone (casts crisp real shadows behind building walls & vehicles!)
    let conePoly = null;
    let coneMaxRange = 480;
    if (p.flashlightOn) {
      const coneSpread = (p.wideBeam ? 0.62 : 0.42) * (1 + sim.perks.xenonBeam * 0.16);
      coneMaxRange = (p.wideBeam ? 380 : 510) * (1 + sim.perks.xenonBeam * 0.16);
      const rays = 64;

      conePoly = [{ x: px, y: py }];
      for (let i = 0; i <= rays; i++) {
        const ang = p.angle - coneSpread + (i / rays) * (coneSpread * 2);
        const hitDist = this.castLightRay(sim, p.x, p.y, ang, coneMaxRange);
        conePoly.push({
          x: px + Math.cos(ang) * hitDist,
          y: py + Math.sin(ang) * hitDist,
        });
      }

      const coneGrad = lctx.createRadialGradient(px, py, 10, px, py, coneMaxRange);
      coneGrad.addColorStop(0, 'rgba(0,0,0,0.98)');
      coneGrad.addColorStop(0.75, 'rgba(0,0,0,0.85)');
      coneGrad.addColorStop(1, 'rgba(0,0,0,0)');

      lctx.fillStyle = coneGrad;
      lctx.beginPath();
      conePoly.forEach((pt, idx) => (idx === 0 ? lctx.moveTo(pt.x, pt.y) : lctx.lineTo(pt.x, pt.y)));
      lctx.closePath();
      lctx.fill();
    }

    // 3. Streetlamps & Active Fire Pools Carve Out Darkness
    for (const lt of sim.lights) {
      const lx = lt.x - this.camX;
      const ly = lt.y - this.camY;
      if (lx < -lt.r || lx > w + lt.r || ly < -lt.r || ly > h + lt.r) continue;
      const flick = 1 - lt.flicker * 0.5 * (Math.sin(sim.time * 19 + lt.x) + 1);
      const r = lt.r * flick;
      const g = lctx.createRadialGradient(lx, ly, 8, lx, ly, r);
      g.addColorStop(0, 'rgba(0,0,0,0.82)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath();
      lctx.arc(lx, ly, r, 0, Math.PI * 2);
      lctx.fill();
    }

    for (const hz of sim.hazards) {
      if (hz.type !== 'fire') continue;
      const hx = hz.x - this.camX;
      const hy = hz.y - this.camY;
      const r = hz.r * 2.1;
      const g = lctx.createRadialGradient(hx, hy, 8, hx, hy, r);
      g.addColorStop(0, 'rgba(0,0,0,0.9)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath();
      lctx.arc(hx, hy, r, 0, Math.PI * 2);
      lctx.fill();
    }

    lctx.restore();
    mainCtx.drawImage(this.lightCanvas, 0, 0);

    // Additive Xenon Beam Tint inside the Raycast Flashlight Polygon
    if (conePoly) {
      mainCtx.save();
      const beamGrad = mainCtx.createRadialGradient(px, py, 8, px, py, coneMaxRange);
      beamGrad.addColorStop(0, 'rgba(254, 249, 195, 0.16)');
      beamGrad.addColorStop(0.45, 'rgba(186, 230, 253, 0.08)');
      beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      mainCtx.fillStyle = beamGrad;
      mainCtx.beginPath();
      conePoly.forEach((pt, idx) => (idx === 0 ? mainCtx.moveTo(pt.x, pt.y) : mainCtx.lineTo(pt.x, pt.y)));
      mainCtx.closePath();
      mainCtx.fill();
      mainCtx.restore();
    }
  }

  // Fast ray-vs-AABB distance caster for 2D shadow mapping
  castLightRay(sim, ox, oy, angle, maxDist) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let closest = maxDist;

    for (const w of sim.walls) {
      if (w.type === 'barrier') continue; // Low concrete barriers don't block high-mounted flashlight
      const d = this.rayRectDistance(ox, oy, dx, dy, w.x, w.y, w.w, w.h, closest);
      if (d < closest) closest = d;
    }
    return closest;
  }

  rayRectDistance(ox, oy, dx, dy, rx, ry, rw, rh, maxDist) {
    let tmin = 0;
    let tmax = maxDist;

    if (Math.abs(dx) < 1e-6) {
      if (ox < rx || ox > rx + rw) return maxDist;
    } else {
      const inv = 1 / dx;
      let t1 = (rx - ox) * inv;
      let t2 = (rx + rw - ox) * inv;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return maxDist;
    }

    if (Math.abs(dy) < 1e-6) {
      if (oy < ry || oy > ry + rh) return maxDist;
    } else {
      const inv = 1 / dy;
      let t1 = (ry - oy) * inv;
      let t2 = (ry + rh - oy) * inv;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return maxDist;
    }

    return tmin > 0 ? tmin : maxDist;
  }

  drawPostLightOverlays(ctx, sim) {
    const p = sim.player;

    // Acoustic Bio-Sonar rings on unseen infected outside the flashlight beam
    for (const e of sim.enemies) {
      const angToE = Math.atan2(e.y - p.y, e.x - p.x);
      const diff = Math.atan2(Math.sin(angToE - p.angle), Math.cos(angToE - p.angle));
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (Math.abs(diff) > 0.5 || d > 420) {
        const pulse = (sim.time * 2.5 + e.stepPhase) % 1;
        ctx.strokeStyle = `rgba(244, 63, 94, ${(1 - pulse) * 0.45})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 6 + pulse * 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Screamer Shockwave Ripples
    for (const sr of sim.sonarRipples) {
      ctx.strokeStyle = sr.color;
      ctx.globalAlpha = Math.max(0, sr.alpha);
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(sr.x, sr.y, sr.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Floating Combat Callouts
    for (const ft of sim.floatTexts) {
      ctx.fillStyle = ft.color;
      ctx.font = '700 12px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
    }
  }

  renderMinimap(sim) {
    const ctx = this.minimapCtx;
    const mw = this.minimapCanvas.width;
    const mh = this.minimapCanvas.height;
    const sx = mw / WORLD_W;
    const sy = mh / WORLD_H;

    ctx.fillStyle = '#090c12';
    ctx.fillRect(0, 0, mw, mh);

    // Buildings
    for (const b of sim.buildings) {
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = b.accent;
      ctx.lineWidth = 1;
      ctx.fillRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
      ctx.strokeRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
    }

    // Barricades (Green = Intact, Amber = Damaged, Red = Breached)
    for (const b of sim.barricades) {
      const ratio = b.hp / b.maxHp;
      ctx.fillStyle = ratio > 0.5 ? '#10b981' : ratio > 0 ? '#f59e0b' : '#ef4444';
      ctx.fillRect(b.x * sx - 1, b.y * sy - 1, Math.max(4, b.w * sx), Math.max(4, b.h * sy));
    }

    // Auto-Turrets
    ctx.fillStyle = '#38f2d7';
    for (const t of sim.turrets) {
      ctx.beginPath();
      ctx.arc(t.x * sx, t.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Infected Blips
    for (const e of sim.enemies) {
      ctx.fillStyle = e.def.id === 'brute' ? '#f97316' : e.def.id === 'screamer' ? '#e879f9' : '#ef4444';
      ctx.beginPath();
      ctx.arc(e.x * sx, e.y * sy, e.def.id === 'brute' ? 3.5 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player & Flashlight Cone on Minimap
    const px = sim.player.x * sx;
    const py = sim.player.y * sy;
    ctx.fillStyle = 'rgba(253, 224, 71, 0.22)';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, 34, sim.player.angle - 0.45, sim.player.angle + 0.45);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(px, py, 3.8, 0, Math.PI * 2);
    ctx.fill();
  }
}
