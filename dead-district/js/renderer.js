// ============================================================================
// DEAD DISTRICT // SECTOR 7 — 2.5D Urban Horror Renderer, Aligned Vehicle
// Lighting & Distance/Illumination-Modulated Threat Visibility Engine
// ============================================================================

import { WORLD_W, WORLD_H } from './config.js';

export class DeadDistrictRenderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;

    // Offscreen darkness/shadow buffer for 2D raycast flashlight & vehicle lights
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');

    this.viewW = 1280;
    this.viewH = 800;
    this.camX = 160;
    this.camY = 200;
    this._cachedVehicleCones = [];
    this.lightingQuality = 'ultra'; // 'ultra' | 'balanced'
    this.autoQualityEnabled = true;
    this._slowFrameCount = 0;

    // Top-down pixel art sprites (generated via Venice gpt-image-2-5-flare, hide_watermark: true)
    this.sprites = {};
    const spriteManifest = {
      operator: 'assets/sprites/operator.png',
      walker: 'assets/sprites/shambler.png',
      sprinter: 'assets/sprites/runner.png',
      spitter: 'assets/sprites/spitter.png',
      brute: 'assets/sprites/brute.png',
      screamer: 'assets/sprites/screamer.png',
      turret: 'assets/sprites/turret.png',
      veh_police: 'assets/sprites/veh_police.png',
      veh_ambulance: 'assets/sprites/veh_ambulance.png',
      veh_taxi: 'assets/sprites/veh_taxi.png',
      veh_swat: 'assets/sprites/veh_swat.png',
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

  // Compute world-space headlight, taillight, and roof-lightbar sockets for a street vehicle
  getVehicleLightingState(w, time) {
    const cx = w.x + w.w * 0.5;
    const cy = w.y + w.h * 0.5;
    const angle = w.angle || 0;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const dw = w.drawW || w.w;
    const dh = w.drawH || w.h;

    const toWorld = (lx, ly) => ({
      x: cx + (lx * dw) * cosA - (ly * dh) * sinA,
      y: cy + (lx * dw) * sinA + (ly * dh) * cosA,
    });

    const headlights = (w.headlights || []).map((hl) => {
      const pos = toWorld(hl.lx, hl.ly);
      let intensity = 0;
      let sparking = false;
      if (hl.state === 'on') {
        intensity = 0.96 + 0.04 * Math.sin(time * 7 + hl.ly * 10);
      } else if (hl.state === 'flicker') {
        // Damaged EMS ambulance right headlight: sputters, arcs, and drops out intermittently
        const wave = Math.sin(time * 6.2) + 0.6 * Math.sin(time * 23.7) + 0.4 * Math.cos(time * 41.3);
        if (wave > 0.15) {
          intensity = Math.min(0.92, 0.35 + wave * 0.38);
          sparking = wave > 1.15;
        } else {
          intensity = 0.04;
          sparking = Math.sin(time * 53) > 0.92;
        }
      } else if (hl.state === 'broken') {
        intensity = 0;
        sparking = Math.sin(time * 19 + cx) > 0.95;
      }
      return {
        ...hl,
        wx: pos.x,
        wy: pos.y,
        beamAngle: angle + hl.ly * 0.09,
        intensity,
        sparking,
      };
    });

    const taillights = (w.taillights || []).map((tl) => {
      const pos = toWorld(tl.lx, tl.ly);
      return { ...tl, wx: pos.x, wy: pos.y };
    });

    let lightbar = null;
    if (w.lightbar) {
      const pos = toWorld(w.lightbar.lx, w.lightbar.ly);
      const lb = w.lightbar;
      if (lb.type === 'police' || lb.type === 'swat') {
        const phase = Math.sin(time * (lb.type === 'police' ? 15 : 11));
        const isRed = phase >= 0;
        const leftPos = toWorld(lb.lx, -0.16);
        const rightPos = toWorld(lb.lx, 0.16);
        lightbar = {
          ...lb,
          wx: pos.x,
          wy: pos.y,
          leftPos,
          rightPos,
          isRed,
          activeColor: isRed ? 'rgba(239, 68, 68, 0.42)' : 'rgba(59, 130, 246, 0.44)',
          coreHex: isRed ? '#ef4444' : '#3b82f6',
          altHex: isRed ? '#3b82f6' : '#ef4444',
          sweepAngle: time * 5.2,
          intensity: 0.72 + 0.28 * Math.abs(phase),
        };
      } else if (lb.type === 'ambulance') {
        const rotAngle = time * 6.8;
        const pulse = 0.5 + 0.5 * Math.sin(time * 13.6);
        const leftPos = toWorld(lb.lx, -0.18);
        const rightPos = toWorld(lb.lx, 0.18);
        // 4 rear medical box corner beacons
        const boxCorners = [
          toWorld(-0.42, -0.36),
          toWorld(-0.42, 0.36),
          toWorld(0.02, -0.36),
          toWorld(0.02, 0.36),
        ];
        lightbar = {
          ...lb,
          wx: pos.x,
          wy: pos.y,
          leftPos,
          rightPos,
          boxCorners,
          rotAngle,
          pulse,
          activeColor: pulse > 0.5 ? 'rgba(239, 68, 68, 0.44)' : 'rgba(248, 250, 252, 0.38)',
          coreHex: pulse > 0.5 ? '#ef4444' : '#f8fafc',
          altHex: pulse > 0.5 ? '#f8fafc' : '#ef4444',
          intensity: 0.78 + 0.22 * pulse,
        };
      } else if (lb.type === 'taxi') {
        const hazardOn = Math.sin(time * 7.8) > 0.1;
        const corners = [
          toWorld(0.44, -0.32),
          toWorld(0.44, 0.32),
          toWorld(-0.45, -0.32),
          toWorld(-0.45, 0.32),
        ];
        lightbar = {
          ...lb,
          wx: pos.x,
          wy: pos.y,
          hazardOn,
          corners,
          activeColor: 'rgba(250, 204, 21, 0.25)',
          intensity: hazardOn ? 0.55 : 0.25,
        };
      }
    }

    return { cx, cy, angle, dw, dh, headlights, taillights, lightbar };
  }

  // Compute total illumination level [0..1+] at any world point (wx, wy)
  computeIlluminationAt(sim, wx, wy) {
    const p = sim.player;
    let level = 0.04; // Deep night baseline

    // 1. Player Close-Proximity Sixth-Sense / Peripheral Halo
    const distToPlayer = Math.hypot(wx - p.x, wy - p.y);
    const selfRadius = p.muzzleFlash > 0 ? 225 : 132;
    if (distToPlayer < selfRadius) {
      const prox = 1 - distToPlayer / selfRadius;
      level = Math.max(level, (p.muzzleFlash > 0 ? 0.92 : 0.52) * Math.pow(prox, 1.25));
    }

    // 2. Player Directional Raycast Flashlight Cone
    if (p.flashlightOn) {
      const coneSpread = (p.wideBeam ? 0.62 : 0.42) * (1 + sim.perks.xenonBeam * 0.16);
      const coneMaxRange = (p.wideBeam ? 395 : 535) * (1 + sim.perks.xenonBeam * 0.16);
      if (distToPlayer < coneMaxRange) {
        const angToTarget = Math.atan2(wy - p.y, wx - p.x);
        const diff = Math.abs(Math.atan2(Math.sin(angToTarget - p.angle), Math.cos(angToTarget - p.angle)));
        const softEdge = coneSpread + 0.12;
        if (diff < softEdge) {
          const wallDist = this.castLightRay(sim, p.x, p.y, angToTarget, distToPlayer + 8);
          if (wallDist >= distToPlayer - 10) {
            const radialFalloff = 1 - Math.pow(distToPlayer / coneMaxRange, 1.35);
            const angularFalloff = diff <= coneSpread ? 1 : 1 - (diff - coneSpread) / 0.12;
            level += 0.96 * radialFalloff * angularFalloff;
          }
        }
      }
    }

    // 3. Street Vehicle Headlight Cones & Emergency Roof Lightbars
    for (const w of sim.walls) {
      if (w.type !== 'vehicle') continue;
      const vState = w._vState || this.getVehicleLightingState(w, sim.time);

      // Headlights
      for (const hl of vState.headlights) {
        if (hl.intensity <= 0.02 || hl.range <= 10) continue;
        const d = Math.hypot(wx - hl.wx, wy - hl.wy);
        if (d < hl.range) {
          const ang = Math.atan2(wy - hl.wy, wx - hl.wx);
          const diff = Math.abs(Math.atan2(Math.sin(ang - hl.beamAngle), Math.cos(ang - hl.beamAngle)));
          const softSpread = hl.spread + 0.14;
          if (diff < softSpread) {
            const hitDist = this.castLightRay(sim, hl.wx, hl.wy, ang, d + 6, w);
            if (hitDist >= d - 10) {
              const rFall = 1 - d / hl.range;
              const aFall = diff <= hl.spread ? 1 : 1 - (diff - hl.spread) / 0.14;
              level += 0.88 * hl.intensity * rFall * aFall;
            }
          }
        }
      }

      // Emergency Lightbar Halo
      if (vState.lightbar) {
        const lb = vState.lightbar;
        const d = Math.hypot(wx - lb.wx, wy - lb.wy);
        if (d < lb.radius) {
          const fall = 1 - d / lb.radius;
          level += 0.46 * lb.intensity * fall;
        }
      }

      // Taillight close glow
      for (const tl of vState.taillights) {
        const d = Math.hypot(wx - tl.wx, wy - tl.wy);
        if (d < 52) {
          level += 0.24 * (1 - d / 52);
        }
      }
    }

    // 4. Streetlamps & Safe-Room Bulbs
    for (const lt of sim.lights) {
      const d = Math.hypot(wx - lt.x, wy - lt.y);
      if (d < lt.r) {
        const flick = 1 - lt.flicker * 0.5 * (Math.sin(sim.time * 19 + lt.x) + 1);
        const effR = lt.r * flick;
        if (d < effR) {
          level += 0.48 * Math.pow(1 - d / effR, 1.3);
        }
      }
    }

    // 5. Active Thermite Fire Pools, Magnesium Road Flares & Sentry Turrets
    for (const hz of sim.hazards) {
      if (hz.type !== 'fire') continue;
      const d = Math.hypot(wx - hz.x, wy - hz.y);
      const fireR = hz.r * 2.2;
      if (d < fireR) {
        level += 0.85 * (1 - d / fireR);
      }
    }

    for (const fl of sim.flares || []) {
      const d = Math.hypot(wx - fl.x, wy - fl.y);
      if (d < fl.r) {
        level += 0.92 * Math.pow(1 - d / fl.r, 1.2);
      }
    }

    for (const t of sim.turrets) {
      const d = Math.hypot(wx - t.x, wy - t.y);
      if (d < 175) {
        const ang = Math.atan2(wy - t.y, wx - t.x);
        const diff = Math.abs(Math.atan2(Math.sin(ang - t.angle), Math.cos(ang - t.angle)));
        if (diff < 0.35) {
          level += 0.55 * (1 - d / 175);
        }
      }
    }

    return Math.min(1.2, level);
  }

  render(sim) {
    this._lastSim = sim;
    const ctx = this.ctx;
    const p = sim.player;

    // Precompute vehicle lighting sockets once per frame
    for (const w of sim.walls) {
      if (w.type === 'vehicle') {
        w._vState = this.getVehicleLightingState(w, sim.time);
      }
    }

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

    // 2. 2D Raycast Flashlight, Aligned Vehicle Headlight Beams & Darkness Shroud
    this.renderLightingLayer(ctx, sim);

    // 3. Post-Light Tactical Overlays (Eye Glints in Penumbra, Distance-Gated Acoustic Footsteps, Callouts)
    ctx.save();
    ctx.translate(-this.camX, -this.camY);
    this.drawPostLightOverlays(ctx, sim);
    ctx.restore();

    ctx.restore();

    // 4. Render Circular Acoustic Motion Radar
    if (this.minimapCtx) {
      this.renderMinimap(sim);
    }
  }

  drawStreetsAndBuildings(ctx, sim) {
    // Base Wet Night Asphalt
    ctx.fillStyle = '#0b0e15';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Subtle urban paving grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.035)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.stroke();
    }
    for (let y = 0; y <= WORLD_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke();
    }

    // Sidewalks around the 4 corner blocks
    ctx.fillStyle = '#161b24';
    ctx.strokeStyle = '#283142';
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
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.30)';
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
    ctx.fillStyle = 'rgba(226, 232, 240, 0.12)';
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

    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.font = '700 12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SECTOR 7 // EVAC DZ', 0, -24);
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
      ctx.globalAlpha = 0.42;
      ctx.font = '700 14px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.w * 0.5, b.y + b.h * 0.5 - 6);
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.fillText(`${b.code} · SAFE-ROOM SHELTER`, b.x + b.w * 0.5, b.y + b.h * 0.5 + 12);
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

        ctx.strokeStyle = 'rgba(254, 243, 199, 0.35)';
        ctx.beginPath();
        ctx.moveTo(b.x + 3, b.y + 3);
        ctx.lineTo(b.x + b.w - 3, b.y + b.h - 3);
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
        ctx.setLineDash([]);
      }
      ctx.restore();
    }

    // 2. Concrete Walls, Top-Down Pixel-Art Street Vehicles & Jersey Barriers
    for (const w of sim.walls) {
      if (w.type === 'wall') {
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.5;
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.strokeRect(w.x, w.y, w.w, w.h);
      } else if (w.type === 'vehicle') {
        const vState = w._vState || this.getVehicleLightingState(w, sim.time);
        const sprite = this.sprites[w.sprite];

        ctx.save();
        ctx.translate(vState.cx, vState.cy);
        ctx.rotate(vState.angle);

        // Ground shadow under chassis
        ctx.fillStyle = 'rgba(2, 4, 8, 0.68)';
        ctx.beginPath();
        ctx.roundRect(-vState.dw * 0.48, -vState.dh * 0.45 + 4, vState.dw * 0.96, vState.dh * 0.90, 8);
        ctx.fill();

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(sprite, -vState.dw * 0.5, -vState.dh * 0.5, vState.dw, vState.dh);
        } else {
          ctx.fillStyle = w.color || '#1e293b';
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 2;
          ctx.fillRect(-w.w * 0.5, -w.h * 0.5, w.w, w.h);
          ctx.strokeRect(-w.w * 0.5, -w.h * 0.5, w.w, w.h);
        }
        ctx.restore();

        // Draw emissive bulb fixtures right at the aligned world sockets
        ctx.save();
        for (const hl of vState.headlights) {
          if (hl.intensity > 0.05) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(hl.wx, hl.wy, 3.2, 0, Math.PI * 2);
            ctx.fill();
          }
          if (hl.sparking) {
            // Broken/flickering bulb electrical arc sparks
            ctx.strokeStyle = '#fde047';
            ctx.lineWidth = 1.3;
            for (let s = 0; s < 3; s++) {
              const sa = sim.time * 37 + s * 2.1;
              ctx.beginPath();
              ctx.moveTo(hl.wx, hl.wy);
              ctx.lineTo(hl.wx + Math.cos(sa) * 7, hl.wy + Math.sin(sa) * 7);
              ctx.stroke();
            }
          }
        }
        for (const tl of vState.taillights) {
          ctx.fillStyle = tl.color;
          ctx.beginPath();
          ctx.arc(tl.wx, tl.wy, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
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
    // Field Supply Pickups (modulated slightly by light, with a subtle beacon blink so players can spot drops)
    for (const p of sim.pickups) {
      const illum = this.computeIlluminationAt(sim, p.x, p.y);
      const visAlpha = Math.max(0.32, Math.min(1, 0.25 + illum * 0.85));
      ctx.save();
      ctx.globalAlpha = visAlpha;
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

      ctx.strokeStyle = 'rgba(56, 242, 215, 0.34)';
      ctx.lineWidth = 1.4;
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

  // Distance + Illumination-Modulated Zombie Rendering
  drawEnemies(ctx, sim) {
    const p = sim.player;
    for (const e of sim.enemies) {
      const illum = this.computeIlluminationAt(sim, e.x, e.y);
      const dist = Math.hypot(e.x - p.x, e.y - p.y);
      e._illum = illum;
      e._dist = dist;

      // Burning enemies or hit-flashed enemies self-illuminate
      const effectiveIllum = e.burnTimer > 0 || e.hitFlash > 0 ? Math.max(illum, 0.85) : illum;

      // Determine visibility tier from illumination & distance:
      // - Lit (effectiveIllum >= 0.34): crisp full visibility (alpha 1.0)
      // - Penumbra / Twilight (0.11 <= effectiveIllum < 0.34): lurking dark silhouette (alpha 0.22..0.95)
      // - Deep Darkness (effectiveIllum < 0.11): body nearly invisible in pitch black (alpha 0.035)
      let bodyAlpha = 1.0;
      let filterStr = 'none';
      if (e.hitFlash > 0) {
        bodyAlpha = 1.0;
        filterStr = 'brightness(1.85) contrast(1.2)';
      } else if (effectiveIllum >= 0.34) {
        bodyAlpha = Math.min(1, 0.72 + (effectiveIllum - 0.34) * 0.65);
        const bright = Math.min(1.12, 0.78 + effectiveIllum * 0.38);
        filterStr = `brightness(${bright.toFixed(2)})`;
      } else if (effectiveIllum >= 0.11) {
        const t = (effectiveIllum - 0.11) / 0.23;
        bodyAlpha = 0.18 + t * 0.56;
        const bright = 0.26 + t * 0.52;
        filterStr = `brightness(${bright.toFixed(2)}) contrast(1.18)`;
      } else {
        bodyAlpha = 0.035;
        filterStr = 'brightness(0.15)';
      }

      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.globalAlpha = bodyAlpha;

      // Ground shadow when visible
      if (bodyAlpha > 0.15) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.arc(0, 3, e.r * 0.92, 0, Math.PI * 2);
        ctx.fill();
      }

      // Screamer acoustic aura
      if (e.def.screamer && effectiveIllum >= 0.15) {
        ctx.strokeStyle = 'rgba(232, 121, 249, 0.42)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(0, 0, e.r + 8 + Math.sin(sim.time * 8) * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Burning overlay
      if (e.burnTimer > 0) {
        ctx.fillStyle = 'rgba(249, 115, 22, 0.48)';
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
        if (filterStr !== 'none') ctx.filter = filterStr;
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

      // Mini HP bar only when illuminated (or actively taking damage)
      if (
        (effectiveIllum >= 0.22 || e.hitFlash > 0) &&
        e.hp < e.maxHp &&
        (e.def.armored || e.def.screamer || e.maxHp > 90 || effectiveIllum >= 0.45)
      ) {
        const bw = 30;
        ctx.save();
        ctx.globalAlpha = Math.min(1, effectiveIllum * 1.6);
        ctx.fillStyle = 'rgba(9, 11, 16, 0.88)';
        ctx.fillRect(e.x - bw * 0.5, e.y - e.r - 12, bw, 4);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(e.x - bw * 0.5, e.y - e.r - 12, bw * Math.max(0, e.hp / e.maxHp), 4);
        ctx.restore();
      }
    }
  }

  drawPlayerAndProjectiles(ctx, sim) {
    // Bullets & Tracer Streaks
    for (const b of sim.bullets) {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.armorPiercing ? 3 : 2.2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.024, b.y - b.vy * 0.024);
      ctx.stroke();
    }

    // Spitter Acid Globules (bioluminescent so they remain dodgeable in the dark)
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

  // Build a screen-space raycast light cone polygon from world origin (wx, wy)
  buildRaycastConeScreenPoly(sim, wx, wy, angle, spread, maxRange, rays = 32, ignoreWall = null) {
    const sx = wx - this.camX;
    const sy = wy - this.camY;
    const poly = [{ x: sx, y: sy }];
    for (let i = 0; i <= rays; i++) {
      const ang = angle - spread + (i / rays) * (spread * 2);
      const hitDist = this.castLightRay(sim, wx, wy, ang, maxRange, ignoreWall);
      poly.push({
        x: sx + Math.cos(ang) * hitDist,
        y: sy + Math.sin(ang) * hitDist,
      });
    }
    return { sx, sy, maxRange, poly };
  }

  // Return cached world-space raycast cone translated to screen space for stationary street vehicles (#31)
  getCachedVehicleConeScreenPoly(sim, wall, hl, spMult = 1.0, rMult = 1.0, rays = 26) {
    if (!wall._coneCache || wall._coneCacheRev !== (sim._mapRev || 0)) {
      wall._coneCache = new Map();
      wall._coneCacheRev = sim._mapRev || 0;
    }
    const key = `${hl.side}_${spMult.toFixed(2)}_${rMult.toFixed(2)}_${rays}`;
    let worldPoly = wall._coneCache.get(key);
    const spread = hl.spread * spMult;
    const maxRange = hl.range * rMult;
    if (!worldPoly) {
      worldPoly = [{ x: hl.wx, y: hl.wy }];
      for (let i = 0; i <= rays; i++) {
        const ang = hl.beamAngle - spread + (i / rays) * (spread * 2);
        const hitDist = this.castLightRay(sim, hl.wx, hl.wy, ang, maxRange, wall);
        worldPoly.push({
          x: hl.wx + Math.cos(ang) * hitDist,
          y: hl.wy + Math.sin(ang) * hitDist,
        });
      }
      wall._coneCache.set(key, worldPoly);
    }
    const sx = hl.wx - this.camX;
    const sy = hl.wy - this.camY;
    const poly = worldPoly.map((pt) => ({
      x: pt.x - this.camX,
      y: pt.y - this.camY,
    }));
    return { sx, sy, maxRange, poly };
  }

  // Fast raycast-free illumination lookup for atmospheric dust motes (#31)
  computeFastMoteIlluminationAt(sim, wx, wy) {
    const p = sim.player;
    let level = 0.04;
    const distToPlayer = Math.hypot(wx - p.x, wy - p.y);
    if (distToPlayer < 130) {
      level = Math.max(level, 0.45 * (1 - distToPlayer / 130));
    }
    if (p.flashlightOn) {
      const coneSpread = (p.wideBeam ? 0.62 : 0.42) * (1 + sim.perks.xenonBeam * 0.16);
      const coneMaxRange = (p.wideBeam ? 395 : 535) * (1 + sim.perks.xenonBeam * 0.16);
      if (distToPlayer < coneMaxRange) {
        const ang = Math.atan2(wy - p.y, wx - p.x);
        const diff = Math.abs(Math.atan2(Math.sin(ang - p.angle), Math.cos(ang - p.angle)));
        if (diff < coneSpread) {
          level += 0.85 * (1 - distToPlayer / coneMaxRange);
        }
      }
    }
    for (const w of sim.walls) {
      if (w.type !== 'vehicle' || !w._vState) continue;
      for (const hl of w._vState.headlights) {
        if (hl.intensity <= 0.05) continue;
        const d = Math.hypot(wx - hl.wx, wy - hl.wy);
        if (d < hl.range) {
          const ang = Math.atan2(wy - hl.wy, wx - hl.wx);
          const diff = Math.abs(Math.atan2(Math.sin(ang - hl.beamAngle), Math.cos(ang - hl.beamAngle)));
          if (diff <= hl.spread) {
            level += 0.8 * hl.intensity * (1 - d / hl.range);
          }
        }
      }
    }
    return level;
  }

  // True 2D Raycast Flashlight + Aligned Vehicle Headlights + Emergency Lightbars Shadow Layer
  renderLightingLayer(mainCtx, sim) {
    const lctx = this.lightCtx;
    const w = this.viewW;
    const h = this.viewH;
    const p = sim.player;

    lctx.save();
    lctx.clearRect(0, 0, w, h);

    // Deep blackout horror shroud (86% darkness in unlit zones so headlights & flashlight truly matter)
    lctx.fillStyle = 'rgba(3, 5, 11, 0.86)';
    lctx.fillRect(0, 0, w, h);

    lctx.globalCompositeOperation = 'destination-out';

    // 1. Player Personal Close-Awareness Halo
    const px = p.x - this.camX;
    const py = p.y - this.camY;
    const selfRadius = p.muzzleFlash > 0 ? 225 : 112;
    const selfGrad = lctx.createRadialGradient(px, py, 10, px, py, selfRadius);
    selfGrad.addColorStop(0, 'rgba(0,0,0,0.96)');
    selfGrad.addColorStop(0.6, 'rgba(0,0,0,0.52)');
    selfGrad.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = selfGrad;
    lctx.beginPath();
    lctx.arc(px, py, selfRadius, 0, Math.PI * 2);
    lctx.fill();

    // 2. Player 2D Raycast Directional Flashlight Cone
    let playerCone = null;
    if (p.flashlightOn) {
      const coneSpread = (p.wideBeam ? 0.62 : 0.42) * (1 + sim.perks.xenonBeam * 0.16);
      const coneMaxRange = (p.wideBeam ? 395 : 535) * (1 + sim.perks.xenonBeam * 0.16);
      playerCone = this.buildRaycastConeScreenPoly(sim, p.x, p.y, p.angle, coneSpread, coneMaxRange, 60);

      const coneGrad = lctx.createRadialGradient(px, py, 8, px, py, coneMaxRange);
      coneGrad.addColorStop(0, 'rgba(0,0,0,1)');
      coneGrad.addColorStop(0.75, 'rgba(0,0,0,0.88)');
      coneGrad.addColorStop(1, 'rgba(0,0,0,0)');

      lctx.fillStyle = coneGrad;
      lctx.beginPath();
      playerCone.poly.forEach((pt, idx) => (idx === 0 ? lctx.moveTo(pt.x, pt.y) : lctx.lineTo(pt.x, pt.y)));
      lctx.closePath();
      lctx.fill();
    }

    // 3. Aligned Street Vehicle Headlight Cones, Taillight Glows & Emergency Roof Lightbars
    const vehicleCones = [];
    const vehicleStrobes = [];
    for (const wall of sim.walls) {
      if (wall.type !== 'vehicle') continue;
      const vState = wall._vState || this.getVehicleLightingState(wall, sim.time);

      // Carve out each working/flickering headlight cone from its exact front socket (using cached world raycast polygon!)
      for (const hl of vState.headlights) {
        if (hl.intensity <= 0.03 || hl.range <= 10) continue;
        const cone = this.getCachedVehicleConeScreenPoly(sim, wall, hl, 1.0, 1.0, 26);
        vehicleCones.push({ ...cone, hl, wall });

        const g = lctx.createRadialGradient(cone.sx, cone.sy, 4, cone.sx, cone.sy, hl.range);
        g.addColorStop(0, `rgba(0,0,0,${Math.min(1, 0.96 * hl.intensity)})`);
        g.addColorStop(0.7, `rgba(0,0,0,${Math.min(1, 0.72 * hl.intensity)})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g;
        lctx.beginPath();
        cone.poly.forEach((pt, idx) => (idx === 0 ? lctx.moveTo(pt.x, pt.y) : lctx.lineTo(pt.x, pt.y)));
        lctx.closePath();
        lctx.fill();

        // Small bulb flare hole at the headlight lens itself
        const lensG = lctx.createRadialGradient(cone.sx, cone.sy, 1, cone.sx, cone.sy, 22);
        lensG.addColorStop(0, `rgba(0,0,0,${0.9 * hl.intensity})`);
        lensG.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = lensG;
        lctx.beginPath();
        lctx.arc(cone.sx, cone.sy, 22, 0, Math.PI * 2);
        lctx.fill();
      }

      // Carve out emergency lightbar & chassis ambient reveal so the vehicle sprite itself is readable
      const vcx = vState.cx - this.camX;
      const vcy = vState.cy - this.camY;
      const chassisR = Math.max(vState.dw, vState.dh) * 0.72;
      const cg = lctx.createRadialGradient(vcx, vcy, 12, vcx, vcy, chassisR);
      cg.addColorStop(0, 'rgba(0,0,0,0.72)');
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = cg;
      lctx.beginPath();
      lctx.arc(vcx, vcy, chassisR, 0, Math.PI * 2);
      lctx.fill();

      if (vState.lightbar) {
        const lb = vState.lightbar;
        const lbx = lb.wx - this.camX;
        const lby = lb.wy - this.camY;
        const r = lb.radius;
        const sg = lctx.createRadialGradient(lbx, lby, 6, lbx, lby, r);
        sg.addColorStop(0, `rgba(0,0,0,${0.78 * lb.intensity})`);
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = sg;
        lctx.beginPath();
        lctx.arc(lbx, lby, r, 0, Math.PI * 2);
        lctx.fill();
        vehicleStrobes.push({ vState, lb, lbx, lby });
      }
    }

    // 4. Streetlamps & Safe-Room Interior Bulbs
    for (const lt of sim.lights) {
      const lx = lt.x - this.camX;
      const ly = lt.y - this.camY;
      if (lx < -lt.r || lx > w + lt.r || ly < -lt.r || ly > h + lt.r) continue;
      const flick = 1 - lt.flicker * 0.5 * (Math.sin(sim.time * 19 + lt.x) + 1);
      const r = lt.r * flick;
      const g = lctx.createRadialGradient(lx, ly, 8, lx, ly, r);
      g.addColorStop(0, 'rgba(0,0,0,0.78)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath();
      lctx.arc(lx, ly, r, 0, Math.PI * 2);
      lctx.fill();
    }

    // 5. Active Fire Pools & Magnesium Road Flares (#33)
    for (const hz of sim.hazards) {
      if (hz.type !== 'fire') continue;
      const hx = hz.x - this.camX;
      const hy = hz.y - this.camY;
      const r = hz.r * 2.2;
      const g = lctx.createRadialGradient(hx, hy, 8, hx, hy, r);
      g.addColorStop(0, 'rgba(0,0,0,0.92)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath();
      lctx.arc(hx, hy, r, 0, Math.PI * 2);
      lctx.fill();
    }

    for (const fl of sim.flares || []) {
      const fx = fl.x - this.camX;
      const fy = fl.y - this.camY;
      const flick = 0.94 + 0.06 * Math.sin(sim.time * 28 + fl.x);
      const r = fl.r * flick;
      const g = lctx.createRadialGradient(fx, fy, 6, fx, fy, r);
      g.addColorStop(0, 'rgba(0,0,0,0.95)');
      g.addColorStop(0.65, 'rgba(0,0,0,0.68)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      lctx.fillStyle = g;
      lctx.beginPath();
      lctx.arc(fx, fy, r, 0, Math.PI * 2);
      lctx.fill();
    }

    lctx.restore();
    mainCtx.drawImage(this.lightCanvas, 0, 0);

    // ── Additive Volumetric Light Cones & Emergency Strobes ──
    mainCtx.save();
    mainCtx.globalCompositeOperation = 'lighter';

    // Helper for feathered volumetric light cone (3-pass in 'ultra', 1-pass in 'balanced'; uses cached world polys for vehicles)
    const isBalanced = this.lightingQuality === 'balanced';
    const passes = isBalanced
      ? [{ spMult: 1.04, rMult: 1.0, alphaMult: 0.92 }]
      : [
          { spMult: 1.26, rMult: 0.94, alphaMult: 0.32 }, // Soft outer penumbra feather
          { spMult: 1.0,  rMult: 1.0,  alphaMult: 0.65 }, // Main beam
          { spMult: 0.46, rMult: 0.90, alphaMult: 0.85 }, // Bright inner hot-spot core
        ];
    const drawFeatheredCone = (sx, sy, baseAng, spread, maxRange, worldX, worldY, coreCol, midCol, ignoreWall = null, cachedHl = null) => {
      for (const pass of passes) {
        const cPoly = cachedHl && ignoreWall
          ? this.getCachedVehicleConeScreenPoly(sim, ignoreWall, cachedHl, pass.spMult, pass.rMult, 24)
          : this.buildRaycastConeScreenPoly(
              sim,
              worldX,
              worldY,
              baseAng,
              spread * pass.spMult,
              maxRange * pass.rMult,
              isBalanced ? 20 : 24,
              ignoreWall
            );
        const g = mainCtx.createRadialGradient(sx, sy, 3, sx, sy, maxRange * pass.rMult);
        g.addColorStop(0, coreCol(pass.alphaMult));
        g.addColorStop(0.52, midCol(pass.alphaMult * 0.45));
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        mainCtx.fillStyle = g;
        mainCtx.beginPath();
        cPoly.poly.forEach((pt, idx) => (idx === 0 ? mainCtx.moveTo(pt.x, pt.y) : mainCtx.lineTo(pt.x, pt.y)));
        mainCtx.closePath();
        mainCtx.fill();
      }
    };

    // A. Player Flashlight Feathered Volumetric Beam
    if (playerCone) {
      const coneSpread = (p.wideBeam ? 0.62 : 0.42) * (1 + sim.perks.xenonBeam * 0.16);
      drawFeatheredCone(
        px,
        py,
        p.angle,
        coneSpread,
        playerCone.maxRange,
        p.x,
        p.y,
        (a) => `rgba(254, 249, 195, ${(0.14 * a).toFixed(3)})`,
        (a) => `rgba(186, 230, 253, ${(0.08 * a).toFixed(3)})`
      );
    }

    // B. Vehicle Headlight Feathered Volumetric Cones (aligned to each working headlight socket!)
    for (const vc of vehicleCones) {
      const { sx, sy, maxRange, hl, wall } = vc;
      const baseRgb = hl.tint === '#fde047' ? '253, 224, 71' : hl.tint === '#fef08a' ? '254, 240, 138' : '186, 230, 253';
      drawFeatheredCone(
        sx,
        sy,
        hl.beamAngle,
        hl.spread,
        maxRange,
        hl.wx,
        hl.wy,
        (a) => `rgba(${baseRgb}, ${(0.22 * hl.intensity * a).toFixed(3)})`,
        (a) => `rgba(${baseRgb}, ${(0.11 * hl.intensity * a).toFixed(3)})`,
        wall,
        hl
      );

      // Multi-stage emitter bloom corona at the headlight lens
      const flare = mainCtx.createRadialGradient(sx, sy, 1, sx, sy, 26);
      flare.addColorStop(0, `rgba(255, 255, 255, ${(0.92 * hl.intensity).toFixed(2)})`);
      flare.addColorStop(0.35, `rgba(${baseRgb}, ${(0.55 * hl.intensity).toFixed(2)})`);
      flare.addColorStop(1, 'rgba(0, 0, 0, 0)');
      mainCtx.fillStyle = flare;
      mainCtx.beginPath();
      mainCtx.arc(sx, sy, 26, 0, Math.PI * 2);
      mainCtx.fill();
    }

    // B2. Atmospheric Quarantine Dust / Ash Motes Floating Inside Light Beams
    const moteCount = isBalanced ? 24 : 56;
    for (let i = 0; i < moteCount; i++) {
      const wx = ((i * 197 + Math.sin(sim.time * 0.35 + i) * 45 + sim.time * 14) % (WORLD_W - 160)) + 80;
      const wy = ((i * 131 + Math.cos(sim.time * 0.28 + i * 1.7) * 40 + sim.time * 9) % (WORLD_H - 160)) + 80;
      const sx = wx - this.camX;
      const sy = wy - this.camY;
      if (sx < 0 || sx > w || sy < 0 || sy > h) continue;
      const illum = this.computeFastMoteIlluminationAt(sim, wx, wy);
      if (illum > 0.28) {
        const moteAlpha = Math.min(0.65, (illum - 0.25) * 0.75 * (0.6 + 0.4 * Math.sin(sim.time * 3 + i)));
        const r = 1.1 + (i % 3) * 0.55;
        mainCtx.fillStyle = `rgba(254, 243, 199, ${moteAlpha.toFixed(3)})`;
        mainCtx.beginPath();
        mainCtx.arc(sx, sy, r, 0, Math.PI * 2);
        mainCtx.fill();
      }
    }

    // C. Emergency Lightbars (Police Red/Blue, Ambulance Rotating Red/White, Taxi Hazards, SWAT Strobe)
    for (const vs of vehicleStrobes) {
      const { vState, lb, lbx, lby } = vs;
      if (lb.type === 'police' || lb.type === 'swat') {
        const lx1 = lb.leftPos.x - this.camX;
        const ly1 = lb.leftPos.y - this.camY;
        const lx2 = lb.rightPos.x - this.camX;
        const ly2 = lb.rightPos.y - this.camY;

        // Left & Right Roof Strobe Pods
        const g1 = mainCtx.createRadialGradient(lx1, ly1, 2, lx1, ly1, lb.radius * 0.75);
        g1.addColorStop(0, lb.isRed ? 'rgba(239, 68, 68, 0.55)' : 'rgba(59, 130, 246, 0.20)');
        g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        mainCtx.fillStyle = g1;
        mainCtx.beginPath();
        mainCtx.arc(lx1, ly1, lb.radius * 0.75, 0, Math.PI * 2);
        mainCtx.fill();

        const g2 = mainCtx.createRadialGradient(lx2, ly2, 2, lx2, ly2, lb.radius * 0.75);
        g2.addColorStop(0, !lb.isRed ? 'rgba(59, 130, 246, 0.58)' : 'rgba(239, 68, 68, 0.20)');
        g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
        mainCtx.fillStyle = g2;
        mainCtx.beginPath();
        mainCtx.arc(lx2, ly2, lb.radius * 0.75, 0, Math.PI * 2);
        mainCtx.fill();
      } else if (lb.type === 'ambulance') {
        // Rotating dual crimson/white beacon sweep
        for (let bIdx = 0; bIdx < 2; bIdx++) {
          const bAng = lb.rotAngle + bIdx * Math.PI;
          const bx = lbx + Math.cos(bAng) * 70;
          const by = lby + Math.sin(bAng) * 70;
          const bg = mainCtx.createRadialGradient(lbx, lby, 4, bx, by, lb.radius * 0.68);
          bg.addColorStop(0, bIdx === 0 ? 'rgba(239, 68, 68, 0.42)' : 'rgba(248, 250, 252, 0.30)');
          bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
          mainCtx.fillStyle = bg;
          mainCtx.beginPath();
          mainCtx.arc(lbx, lby, lb.radius * 0.85, bAng - 0.55, bAng + 0.55);
          mainCtx.lineTo(lbx, lby);
          mainCtx.closePath();
          mainCtx.fill();
        }
        // 4 Corner Box Strobes
        for (let cIdx = 0; cIdx < lb.boxCorners.length; cIdx++) {
          const c = lb.boxCorners[cIdx];
          const cx = c.x - this.camX;
          const cy = c.y - this.camY;
          const on = ((cIdx % 2 === 0) ? lb.pulse > 0.45 : lb.pulse <= 0.55);
          if (on) {
            const cg = mainCtx.createRadialGradient(cx, cy, 1, cx, cy, 24);
            cg.addColorStop(0, 'rgba(239, 68, 68, 0.65)');
            cg.addColorStop(1, 'rgba(239, 68, 68, 0)');
            mainCtx.fillStyle = cg;
            mainCtx.beginPath();
            mainCtx.arc(cx, cy, 24, 0, Math.PI * 2);
            mainCtx.fill();
          }
        }
      } else if (lb.type === 'taxi') {
        // Warm glowing TAXI roof sign
        const tg = mainCtx.createRadialGradient(lbx, lby, 2, lbx, lby, 42);
        tg.addColorStop(0, 'rgba(253, 224, 71, 0.35)');
        tg.addColorStop(1, 'rgba(253, 224, 71, 0)');
        mainCtx.fillStyle = tg;
        mainCtx.beginPath();
        mainCtx.arc(lbx, lby, 42, 0, Math.PI * 2);
        mainCtx.fill();

        // 4 Corner Hazard Blinkers
        if (lb.hazardOn) {
          for (const c of lb.corners) {
            const cx = c.x - this.camX;
            const cy = c.y - this.camY;
            const hg = mainCtx.createRadialGradient(cx, cy, 1, cx, cy, 20);
            hg.addColorStop(0, 'rgba(245, 158, 11, 0.65)');
            hg.addColorStop(1, 'rgba(245, 158, 11, 0)');
            mainCtx.fillStyle = hg;
            mainCtx.beginPath();
            mainCtx.arc(cx, cy, 20, 0, Math.PI * 2);
            mainCtx.fill();
          }
        }
      }

      // Taillight crimson glow pools
      for (const tl of vState.taillights) {
        const tx = tl.wx - this.camX;
        const ty = tl.wy - this.camY;
        const tg = mainCtx.createRadialGradient(tx, ty, 1, tx, ty, 30);
        tg.addColorStop(0, 'rgba(239, 68, 68, 0.42)');
        tg.addColorStop(1, 'rgba(239, 68, 68, 0)');
        mainCtx.fillStyle = tg;
        mainCtx.beginPath();
        mainCtx.arc(tx, ty, 30, 0, Math.PI * 2);
        mainCtx.fill();
      }
    }

    // D. Red Magnesium Road Flares additive crimson glow (#33)
    for (const fl of sim.flares || []) {
      const fx = fl.x - this.camX;
      const fy = fl.y - this.camY;
      const pulse = 0.85 + 0.15 * Math.sin(sim.time * 32 + fl.x);
      const fg = mainCtx.createRadialGradient(fx, fy, 2, fx, fy, fl.r * pulse);
      fg.addColorStop(0, 'rgba(255, 241, 242, 0.85)');
      fg.addColorStop(0.22, 'rgba(244, 63, 94, 0.42)');
      fg.addColorStop(0.65, 'rgba(225, 29, 72, 0.14)');
      fg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      mainCtx.fillStyle = fg;
      mainCtx.beginPath();
      mainCtx.arc(fx, fy, fl.r * pulse, 0, Math.PI * 2);
      mainCtx.fill();
    }

    mainCtx.restore();
  }

  // Fast ray-vs-AABB distance caster for 2D shadow mapping (with optional ignoreWall for vehicle self-rays)
  castLightRay(sim, ox, oy, angle, maxDist, ignoreWall = null) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let closest = maxDist;

    for (const w of sim.walls) {
      if (w === ignoreWall || w.type === 'barrier') continue;
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

    // Subtle Vehicle Stencil Callouts & Interactive [E] Hotwire / Breaker Prompts (#33)
    for (const w of sim.walls) {
      if (w.type !== 'vehicle') continue;
      const vState = w._vState;
      if (!vState) continue;
      const d = Math.hypot(vState.cx - p.x, vState.cy - p.y);
      if (d < 340) {
        ctx.save();
        ctx.globalAlpha = Math.max(0.22, (1 - d / 340) * 0.78);
        ctx.fillStyle = w.alarmTimer > 0 ? '#fde047' : '#94a3b8';
        ctx.font = '700 8.5px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        const prompt = d < 125
          ? `[E] HOTWIRE ${w.label} (ALARM + HIGH-BEAMS)`
          : w.alarmTimer > 0
            ? `🔊 ${w.label} ALARM (${Math.ceil(w.alarmTimer)}s)`
            : w.label;
        ctx.fillText(prompt, vState.cx, w.y - 8);
        ctx.restore();
      }
    }

    // Safe-Room Wall Breaker Boxes & Active Road Flares (#33)
    for (const br of sim.breakers || []) {
      const d = Math.hypot(br.x - p.x, br.y - p.y);
      ctx.save();
      ctx.fillStyle = br.activeTimer > 0 ? br.color : '#1e293b';
      ctx.strokeStyle = br.activeTimer > 0 ? '#ffffff' : br.color;
      ctx.lineWidth = 1.6;
      ctx.fillRect(br.x - 7, br.y - 7, 14, 14);
      ctx.strokeRect(br.x - 7, br.y - 7, 14, 14);
      if (d < 240 || br.activeTimer > 0) {
        ctx.fillStyle = br.activeTimer > 0 ? '#fef08a' : '#cbd5e1';
        ctx.font = '700 8px "IBM Plex Mono", monospace';
        ctx.textAlign = 'center';
        const txt = br.activeTimer > 0
          ? `💡 FLOODLIT (${Math.ceil(br.activeTimer)}s)`
          : d < 125
            ? '[E] FLIP FLOODLIGHT BREAKER'
            : 'BREAKER [E]';
        ctx.fillText(txt, br.x, br.y - 12);
      }
      ctx.restore();
    }

    for (const fl of sim.flares || []) {
      ctx.save();
      ctx.translate(fl.x, fl.y);
      ctx.fillStyle = '#e11d48';
      ctx.strokeStyle = '#fecdd3';
      ctx.lineWidth = 1.4;
      ctx.fillRect(-6, -2.5, 12, 5);
      ctx.strokeRect(-6, -2.5, 12, 5);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(6, 0, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Distance & Light-Gated Sensory Cues for Unlit / Penumbra Infected
    for (const e of sim.enemies) {
      const illum = e._illum ?? 0.5;
      const dist = e._dist ?? Math.hypot(e.x - p.x, e.y - p.y);

      // 1. Eerie Eye Glints in Penumbra or Medium-Range Darkness
      const maxEyeDist = e.def.id === 'sprinter' || e.def.screamer ? 340 : 275;
      if (illum < 0.42 && dist < maxEyeDist) {
        const proxAlpha = Math.min(1, (1 - dist / maxEyeDist) * 1.35);
        const penumbraBoost = illum >= 0.11 ? 0.85 : 0.58;
        const eyeAlpha = proxAlpha * penumbraBoost;
        if (eyeAlpha > 0.08) {
          ctx.save();
          ctx.translate(e.x, e.y);
          ctx.rotate(e.angle);
          ctx.globalAlpha = eyeAlpha;
          ctx.fillStyle = e.def.eyeColor || '#fde047';
          ctx.beginPath();
          ctx.arc(e.r * 0.42, -3.4, 1.8, 0, Math.PI * 2);
          ctx.arc(e.r * 0.42, 3.4, 1.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 2. Acoustic Footstep Ripples in Deep Darkness (only within hearing range, synced to footfall!)
      const maxHearDist = e.def.id === 'brute' ? 480 : e.def.screamer ? 520 : e.def.id === 'sprinter' ? 400 : 320;
      if (illum < 0.16 && dist < maxHearDist) {
        const strideWave = (e.stepPhase / Math.PI) % 1;
        const hearFactor = 1 - dist / maxHearDist;
        const ringAlpha = (1 - strideWave) * hearFactor * (e.def.id === 'brute' ? 0.55 : 0.36);
        if (ringAlpha > 0.04) {
          ctx.save();
          ctx.strokeStyle =
            e.def.id === 'brute'
              ? `rgba(249, 115, 22, ${ringAlpha})`
              : e.def.screamer
                ? `rgba(232, 121, 249, ${ringAlpha})`
                : e.def.id === 'sprinter'
                  ? `rgba(244, 63, 94, ${ringAlpha})`
                  : `rgba(148, 163, 184, ${ringAlpha})`;
          ctx.lineWidth = e.def.id === 'brute' ? 1.8 : 1.2;
          ctx.beginPath();
          ctx.arc(e.x, e.y, 4 + strideWave * (e.def.id === 'brute' ? 22 : 14), 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
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

  // Diegetic Circular Acoustic Motion Tracker Scope
  renderMinimap(sim) {
    const ctx = this.minimapCtx;
    const mw = this.minimapCanvas.width;
    const mh = this.minimapCanvas.height;
    const sx = mw / WORLD_W;
    const sy = mh / WORLD_H;
    const cx = mw * 0.5;
    const cy = mh * 0.5;

    ctx.clearRect(0, 0, mw, mh);

    // Dark phosphor scope background
    ctx.fillStyle = '#060a0e';
    ctx.fillRect(0, 0, mw, mh);

    // Subtle radar range rings
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.14)';
    ctx.lineWidth = 1;
    for (const r of [mw * 0.18, mw * 0.34, mw * 0.47]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, cy); ctx.lineTo(mw, cy);
    ctx.moveTo(cx, 0); ctx.lineTo(cx, mh);
    ctx.stroke();

    // Buildings
    for (const b of sim.buildings) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = b.accent;
      ctx.lineWidth = 1;
      ctx.fillRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
      ctx.strokeRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
    }

    // Street Vehicles on Radar
    ctx.fillStyle = '#475569';
    for (const w of sim.walls) {
      if (w.type !== 'vehicle') continue;
      ctx.fillRect(w.x * sx, w.y * sy, Math.max(4, w.w * sx), Math.max(3, w.h * sy));
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
      ctx.arc(t.x * sx, t.y * sy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rotating Acoustic Sweep Line centered on Player
    const px = sim.player.x * sx;
    const py = sim.player.y * sy;
    const sweepAng = (sim.time * 2.6) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(sweepAng) * 58, py + Math.sin(sweepAng) * 58);
    ctx.stroke();

    // Infected Blips (Lit enemies or enemies within acoustic motion-tracker range show clearly; very distant unlit show as faint sonar dots)
    for (const e of sim.enemies) {
      const dist = e._dist ?? Math.hypot(e.x - sim.player.x, e.y - sim.player.y);
      const illum = e._illum ?? 0.2;
      const inRange = illum >= 0.2 || dist < 520 || e.def.screamer || e.def.id === 'brute';
      ctx.globalAlpha = inRange ? 0.95 : 0.35;
      ctx.fillStyle = e.def.id === 'brute' ? '#f97316' : e.def.id === 'screamer' ? '#e879f9' : '#ef4444';
      ctx.beginPath();
      ctx.arc(e.x * sx, e.y * sy, e.def.id === 'brute' ? 3.5 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Player & Flashlight Cone on Minimap
    if (sim.player.flashlightOn) {
      ctx.fillStyle = 'rgba(253, 224, 71, 0.24)';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, 32, sim.player.angle - 0.45, sim.player.angle + 0.45);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(px, py, 3.8, 0, Math.PI * 2);
    ctx.fill();
  }
}
