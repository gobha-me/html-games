// ============================================================================
// AETHERIUM // PINBALL — 2.5D Hermetic Brass, Mercury & DMD Canvas Renderer
// ============================================================================

import { TABLE_W, TABLE_H, TRANSMUTE_WORD } from './config.js';

export class AetheriumRenderer {
  constructor(canvas, dmdCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dmdCanvas = dmdCanvas;
    this.dmdCtx = dmdCanvas ? dmdCanvas.getContext('2d') : null;
    this.scale = 1;
  }

  resize() {
    const stage = document.getElementById('table-stage') || this.canvas.parentElement;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    // Fit 520x900 logical playfield to fill 96% of #table-stage height
    const availW = Math.max(260, rect.width - 28);
    const availH = Math.max(420, rect.height - 24);
    const scale = Math.min(availW / TABLE_W, availH / TABLE_H);

    const cssW = Math.floor(TABLE_W * scale);
    const cssH = Math.floor(TABLE_H * scale);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.floor(cssW * dpr);
    this.canvas.height = Math.floor(cssH * dpr);
    this.scale = scale * dpr;
  }

  render(sim) {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.scale, this.scale);

    // Apply subtle table nudge shake
    ctx.translate(sim.shakeX, sim.shakeY);

    // 1. Playfield Base Slate & Vignette
    this.drawPlayfieldFloor(ctx, sim);

    // 2. Floor Inlays: Sacred Geometry, Astrolabe Rings, TRANSMUTE Medallions & Lane Arrows
    this.drawFloorInlays(ctx, sim);

    // 3. Rollover Sensors, Crucible Saucer & Spinner
    this.drawRolloversAndDevices(ctx, sim);

    // 4. Slingshot Kickers & Drop Targets
    this.drawSlingshotsAndTargets(ctx, sim);

    // 5. Embossed Brass Playfield Walls & One-Way Gate
    this.drawWallsAndGates(ctx, sim);

    // 6. Pop Bumpers
    this.drawBumpers(ctx, sim);

    // 7. Boss Ritual Entity, Homunculi & Cinnabar Orbs
    this.drawBossAndEnemies(ctx, sim);

    // 8. Shooter Plunger Assembly & Aegis Drain Post
    this.drawPlungerAndAegis(ctx, sim);

    // 9. Tapered Brass/Crimson Flippers
    this.drawFlippers(ctx, sim);

    // 10. Liquid-Mercury Pinballs & Comet Trails
    this.drawBalls(ctx, sim);

    // 11. Particles & Floating Score Callouts
    this.drawEffects(ctx, sim);

    ctx.restore();

    // 12. Render Amber Dot-Matrix Display (DMD)
    if (this.dmdCtx) {
      this.renderDmd(sim);
    }
  }

  drawPlayfieldFloor(ctx, sim) {
    const grad = ctx.createLinearGradient(0, 0, 0, TABLE_H);
    grad.addColorStop(0, '#0c0914');
    grad.addColorStop(0.45, '#130e1f');
    grad.addColorStop(1, '#09070f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, TABLE_W, TABLE_H);

    // Subtle alchemical grid lines
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.04)';
    ctx.lineWidth = 1;
    for (let x = 40; x < TABLE_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, TABLE_H); ctx.stroke();
    }
    for (let y = 40; y < TABLE_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(TABLE_W, y); ctx.stroke();
    }
  }

  drawFloorInlays(ctx, sim) {
    // Ornate Top-Left & Top-Right Spandrel Filigree (outside the dome arch)
    ctx.save();
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.22)';
    ctx.lineWidth = 1.5;
    for (const sx of [38, TABLE_W - 38]) {
      ctx.beginPath();
      ctx.arc(sx, 38, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(sx, 38, 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    const cx = 241, cy = 376;

    // Grand Astrolabe Brass Circles around Center Boss Sanctum
    ctx.save();
    ctx.translate(cx, cy);

    ctx.strokeStyle = 'rgba(212, 168, 83, 0.16)';
    ctx.lineWidth = 1.5;
    for (const r of [64, 96, 134]) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Rotating celestial degree ticks
    ctx.save();
    ctx.rotate(sim.time * 0.12);
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.22)';
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 90, Math.sin(a) * 90);
      ctx.lineTo(Math.cos(a) * 96, Math.sin(a) * 96);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();

    // Directional Shot Callout Chevrons (Crucible Lock & Spinner Channel)
    ctx.save();
    ctx.fillStyle = 'rgba(192, 132, 252, 0.35)';
    ctx.font = '700 8.5px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('▲ LOCK', 100, 366);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.38)';
    ctx.fillText('▲ SPIN', 408, 444);
    ctx.restore();

    // Magnetkinesis Field Ring (Lower-Mid Sanctum at (241, 585))
    const magOn = sim.magnetActive && !sim.tilted && sim.magnetCharge > 2;
    ctx.save();
    ctx.translate(241, 585);
    if (magOn) {
      const pulse = 0.4 + 0.25 * Math.sin(sim.time * 18);
      const mGrad = ctx.createRadialGradient(0, 0, 6, 0, 0, 74);
      mGrad.addColorStop(0, `rgba(56, 189, 248, ${pulse})`);
      mGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = mGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 74, 0, Math.PI * 2);
      ctx.fill();
    }

    // Engraved T-R-A-N-S-M-U-T-E Sigil Arc on Playfield Floor (wide symmetric upward arch, zero overlap)
    for (let i = 0; i < TRANSMUTE_WORD.length; i++) {
      const ang = -Math.PI * 0.5 + (i - 4) * 0.235;
      const rx = Math.cos(ang) * 104;
      const ry = Math.sin(ang) * 68 + 52;
      const lit = sim.transmuteLit[i];

      ctx.fillStyle = lit ? 'rgba(16, 185, 129, 0.32)' : 'rgba(15, 23, 42, 0.9)';
      ctx.strokeStyle = lit ? '#34d399' : 'rgba(212, 168, 83, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rx, ry, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = lit ? '#ecfdf5' : '#94a3b8';
      ctx.font = '700 9.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(TRANSMUTE_WORD[i], rx, ry + 0.5);
    }

    // Center Multiplier Medallion
    ctx.fillStyle = '#141022';
    ctx.strokeStyle = '#d4a853';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 48, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fde047';
    ctx.font = '700 14px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${sim.multiplier}×`, 0, 48);

    // Diegetic Magnetkinesis Keycap Badge inside Sanctum Ring
    this.drawKeycapBadge(
      ctx,
      0,
      90,
      'W',
      magOn ? 'MAGNET ON' : `MAGNET ${Math.round(sim.magnetCharge)}%`,
      '#38bdf8',
      magOn
    );
    ctx.restore();

    // 5 Radial Shot-Guide Chevrons above Flippers
    ctx.save();
    ctx.translate(242, 745);
    const shotAngles = [-0.68, -0.34, 0, 0.34, 0.68];
    const shotColors = [
      'rgba(52, 211, 153, 0.28)',
      'rgba(192, 132, 252, 0.32)',
      'rgba(251, 191, 36, 0.36)',
      'rgba(56, 189, 248, 0.32)',
      'rgba(251, 113, 133, 0.28)',
    ];
    for (let i = 0; i < shotAngles.length; i++) {
      ctx.save();
      ctx.rotate(shotAngles[i]);
      ctx.strokeStyle = shotColors[i];
      ctx.lineWidth = 1.8;
      for (const rOff of [36, 48]) {
        ctx.beginPath();
        ctx.moveTo(-6, -rOff + 5);
        ctx.lineTo(0, -rOff);
        ctx.lineTo(6, -rOff + 5);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();

    // Hermetic Lower Cabinet Apron (Left & Right Bottom Triangles below Drain Walls)
    ctx.save();
    const apronGrad = ctx.createLinearGradient(0, 805, 0, 895);
    apronGrad.addColorStop(0, '#161124');
    apronGrad.addColorStop(1, '#09070f');
    ctx.fillStyle = apronGrad;
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.38)';
    ctx.lineWidth = 1.5;

    // Left Apron Plate
    ctx.beginPath();
    ctx.moveTo(20, 811);
    ctx.lineTo(190, 873);
    ctx.lineTo(190, 892);
    ctx.lineTo(20, 892);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right Apron Plate
    ctx.beginPath();
    ctx.moveTo(464, 811);
    ctx.lineTo(294, 873);
    ctx.lineTo(294, 892);
    ctx.lineTo(464, 892);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Apron Brass Rivets & Inscriptions
    ctx.fillStyle = 'rgba(212, 168, 83, 0.45)';
    for (const [rx, ry] of [[32, 828], [32, 880], [174, 880], [452, 828], [452, 880], [310, 880]]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(212, 168, 83, 0.36)';
    ctx.font = '700 8.5px "Cinzel", serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLVE // OPUS I', 42, 878);
    ctx.textAlign = 'right';
    ctx.fillText('COAGULA // OPUS II', 442, 878);

    // Diegetic Flipper & Nudge Keycap Badges on Lower Cabinet Apron
    this.drawKeycapBadge(ctx, 76, 860, 'Z / ←', 'LEFT FLIP', '#f59e0b', sim.leftFlipperDown);
    this.drawKeycapBadge(ctx, 408, 860, 'M / →', 'RIGHT FLIP', '#f59e0b', sim.rightFlipperDown);
    this.drawKeycapBadge(ctx, 242, 864, 'A·X·D', 'NUDGE', '#94a3b8', false);

    ctx.fillStyle = 'rgba(212, 168, 83, 0.34)';
    ctx.font = '700 8.5px "Cinzel", serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE GRAND ATHANOR · 1618', 242, 886);
    ctx.restore();

    // Left Outlane Kickback Indicator Arrow
    ctx.save();
    ctx.translate(34, 775);
    ctx.fillStyle = sim.kickbackLit ? '#38bdf8' : 'rgba(148, 163, 184, 0.18)';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(8, 6);
    ctx.lineTo(-8, 6);
    ctx.closePath();
    ctx.fill();
    ctx.font = '700 8px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('KICK', 0, 16);
    ctx.restore();
  }

  drawRolloversAndDevices(ctx, sim) {
    // 1. Rollover Lamps
    for (const ro of sim.rollovers) {
      ctx.save();
      ctx.translate(ro.x, ro.y);
      ctx.fillStyle = ro.lit ? ro.color : '#161324';
      ctx.strokeStyle = ro.lit ? '#ffffff' : ro.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, ro.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = ro.lit ? '#09070f' : '#cbd5e1';
      ctx.font = '700 8.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ro.label, 0, 0.5);
      ctx.restore();
    }

    // 2. Philosopher's Crucible Capture Saucer (Upper-Left)
    const sc = sim.saucer;
    ctx.save();
    ctx.translate(sc.x, sc.y);
    ctx.fillStyle = '#1b112c';
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(0, 0, sc.r + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 3 Lock Gems around Crucible rim
    for (let i = 0; i < 3; i++) {
      const a = -Math.PI * 0.75 + i * 0.65;
      const gx = Math.cos(a) * (sc.r + 9);
      const gy = Math.sin(a) * (sc.r + 9);
      const locked = i < sim.crucibleLocks;
      ctx.fillStyle = locked ? '#38f2d7' : '#1e293b';
      ctx.strokeStyle = '#d4a853';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(gx, gy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = '#e9d5ff';
    ctx.font = '700 8px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CRUCIBLE', 0, sc.r + 16);
    ctx.restore();

    // 3. Right Corridor Alchemical Spinner
    const sp = sim.spinner;
    ctx.save();
    ctx.translate(sp.x, sp.y);
    ctx.strokeStyle = '#d4a853';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(18, 0);
    ctx.stroke();

    const vaneH = Math.max(2, Math.abs(Math.cos(sp.angle)) * 12);
    ctx.fillStyle = '#fde047';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 1.2;
    ctx.fillRect(-14, -vaneH, 28, vaneH * 2);
    ctx.strokeRect(-14, -vaneH, 28, vaneH * 2);
    ctx.restore();
  }

  drawSlingshotsAndTargets(ctx, sim) {
    // Twin Slingshot Triangles (matching wide-corner config.js coordinates)
    const leftTri = [[96, 636], [96, 708], [144, 738]];
    const rightTri = [[388, 636], [388, 708], [340, 738]];
    const pairs = [
      { pts: leftTri, sling: sim.slingshots[0] },
      { pts: rightTri, sling: sim.slingshots[1] },
    ];

    for (const { pts, sling } of pairs) {
      ctx.save();
      ctx.fillStyle = sling.flash > 0 ? 'rgba(251, 191, 36, 0.55)' : 'rgba(159, 18, 57, 0.32)';
      ctx.strokeStyle = sling.flash > 0 ? '#fef08a' : '#d4a853';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Corner brass posts
      ctx.fillStyle = '#f7dfa0';
      for (const [x, y] of pts) {
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Drop Targets (Left = Salt Emerald, Right = Sulfur Crimson)
    for (const dtgt of sim.dropTargets) {
      ctx.save();
      ctx.strokeStyle = dtgt.down ? 'rgba(148, 163, 184, 0.22)' : dtgt.color;
      ctx.lineWidth = dtgt.down ? 2 : 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(dtgt.x1, dtgt.y1);
      ctx.lineTo(dtgt.x2, dtgt.y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawWallsAndGates(ctx, sim) {
    // Outer brass shadow pass
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#4a3514';
    ctx.lineWidth = 8;
    ctx.beginPath();
    for (const w of sim.walls) {
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
    }
    ctx.stroke();

    // Burnished brass core pass
    ctx.strokeStyle = '#d4a853';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    for (const w of sim.walls) {
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
    }
    ctx.stroke();

    // Specular gold highlight pass
    ctx.strokeStyle = '#fef3c7';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const w of sim.walls) {
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
    }
    ctx.stroke();

    // One-Way Shooter Gate
    for (const g of sim.gates) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(g.x1, g.y1);
      ctx.lineTo(g.x2, g.y2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawBumpers(ctx, sim) {
    for (const bmp of sim.bumpers) {
      ctx.save();
      ctx.translate(bmp.x, bmp.y);
      const scale = 1 + bmp.flash * 0.16;
      ctx.scale(scale, scale);

      // Radial glow halo
      const grad = ctx.createRadialGradient(0, 0, bmp.r * 0.2, 0, 0, bmp.r * 1.45);
      grad.addColorStop(0, bmp.glow);
      grad.addColorStop(0.55, bmp.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, bmp.r * 1.45, 0, Math.PI * 2);
      ctx.fill();

      // Brass outer bezel ring
      ctx.fillStyle = '#171324';
      ctx.strokeStyle = bmp.flash > 0 ? '#ffffff' : '#f7dfa0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, bmp.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner jewel core
      ctx.fillStyle = bmp.flash > 0 ? '#ffffff' : bmp.color;
      ctx.beginPath();
      ctx.arc(0, 0, bmp.r * 0.62, 0, Math.PI * 2);
      ctx.fill();

      // Alchemical symbol label
      ctx.fillStyle = '#09070f';
      ctx.font = '700 11px "Cinzel", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(bmp.label, 0, 1);

      ctx.restore();
    }
  }

  drawBossAndEnemies(ctx, sim) {
    const b = sim.boss;
    ctx.save();
    ctx.translate(b.x, b.y);

    // 1. Rotating Arcane Shield Arcs
    const shieldR = b.r + 13;
    const count = b.def.shieldCount;
    const sector = (Math.PI * 2) / count;
    ctx.strokeStyle = b.def.accent;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const a0 = b.shieldAngle + i * sector;
      const a1 = a0 + sector * 0.48;
      ctx.beginPath();
      ctx.arc(0, 0, shieldR, a0, a1);
      ctx.stroke();
    }

    // 2. Boss Ambient Aura
    const aura = ctx.createRadialGradient(0, 0, 6, 0, 0, b.r * 1.6);
    aura.addColorStop(0, b.def.glow);
    aura.addColorStop(0.5, b.def.color);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, b.r * 1.6, 0, Math.PI * 2);
    ctx.fill();

    // 3. Boss Sculpted Body
    ctx.fillStyle = '#151022';
    ctx.strokeStyle = b.hitFlash > 0 ? '#ffffff' : b.def.glow;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Inner sacred 6-pointed hexagram star polygon
    ctx.save();
    ctx.rotate(-sim.time * 0.8);
    ctx.strokeStyle = b.def.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      const rIn = i % 2 === 0 ? b.r * 0.82 : b.r * 0.44;
      if (i === 0) ctx.moveTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
      else ctx.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Glowing Boss Eyes / Core
    ctx.fillStyle = b.hitFlash > 0 ? '#ffffff' : b.def.glow;
    ctx.beginPath();
    ctx.arc(-9, -4, 4.5, 0, Math.PI * 2);
    ctx.arc(9, -4, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Boss HP Arc
    const hpRatio = Math.max(0, b.hp / b.maxHp);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, b.r - 5, -Math.PI / 2, -Math.PI / 2 + hpRatio * Math.PI * 2);
    ctx.stroke();

    // On-Table Boss Ritual Callout & Shield Gap Prompt (below Homunculi orbit)
    ctx.fillStyle = 'rgba(12, 9, 20, 0.88)';
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-80, b.r + 42, 160, 17, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = b.hitFlash > 0 ? '#ffffff' : '#fde047';
    ctx.font = '700 8.5px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const bossPrompt = b.hitFlash > 0
      ? '✦ DIRECT CORE STRIKE! ✦'
      : `⚡ AIM PAST SHIELDS (${Math.ceil(b.hp)} HP)`;
    ctx.fillText(bossPrompt, 0, b.r + 50.5);

    ctx.restore();

    // 4. Clockwork Homunculi Sentries
    for (const h of sim.homunculi) {
      if (!h.alive) continue;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.fillStyle = h.hitFlash > 0 ? '#ffffff' : '#0f172a';
      ctx.strokeStyle = '#38f2d7';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, h.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#38f2d7';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 5. Drifting Cinnabar Orbs
    for (const o of sim.orbs) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.fillStyle = '#fb7185';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, o.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  drawPlungerAndAegis(ctx, sim) {
    // Shooter Lane Spring Plunger (centered in 468..500 lane at x=484)
    const px = 484;
    const topY = 852 + sim.plungerPull * 14;
    ctx.save();

    // Launch Gauge Tick Marks along Shooter Lane
    ctx.strokeStyle = 'rgba(212, 168, 83, 0.25)';
    ctx.lineWidth = 1;
    for (let gy = 760; gy <= 835; gy += 15) {
      ctx.beginPath();
      ctx.moveTo(471, gy);
      ctx.lineTo(476, gy);
      ctx.moveTo(492, gy);
      ctx.lineTo(497, gy);
      ctx.stroke();
    }

    // Coiled Brass Spring under Plunger Head
    const bottomY = 882;
    const coils = 5;
    const span = Math.max(6, bottomY - (topY + 5));
    ctx.strokeStyle = '#b48a3e';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(px, topY + 5);
    for (let i = 0; i < coils; i++) {
      const y1 = topY + 5 + ((i + 0.25) / coils) * span;
      const y2 = topY + 5 + ((i + 0.75) / coils) * span;
      ctx.lineTo(px - 7, y1);
      ctx.lineTo(px + 7, y2);
    }
    ctx.lineTo(px, bottomY);
    ctx.stroke();

    // Brass Plunger Strike Plate
    ctx.fillStyle = '#d4a853';
    ctx.strokeStyle = '#fef08a';
    ctx.lineWidth = 1.2;
    ctx.fillRect(px - 10, topY, 20, 5);
    ctx.strokeRect(px - 10, topY, 20, 5);

    // Diegetic Plunger Keycap Prompt in Shooter Lane
    const shooterWaiting = sim.balls.some(b => b.inShooter);
    if (shooterWaiting || sim.plungerCharging) {
      ctx.fillStyle = 'rgba(12, 9, 20, 0.92)';
      ctx.strokeStyle = sim.plungerCharging ? '#fde047' : '#d4a853';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(px - 15, 718, 30, 32, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.font = '700 7.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPACE', px, 730);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '700 7px "IBM Plex Mono", monospace';
      ctx.fillText('LAUNCH', px, 742);
    }
    ctx.restore();

    // Center Aegis Drain Save Post (between main flippers at (241, 828))
    const active = sim.aegisTimer > 0;
    ctx.save();
    ctx.translate(241, 828);
    if (active) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = active ? '#10b981' : '#1e293b';
    ctx.strokeStyle = active ? '#a7f3d0' : '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawFlippers(ctx, sim) {
    for (const f of sim.flippers) {
      ctx.save();
      ctx.translate(f.px, f.py);
      ctx.rotate(f.angle);

      // Tapered flipper body from (0,0) radius rBase to (f.length, 0) radius rTip
      ctx.fillStyle = '#b45309';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, f.rBase, Math.PI * 0.5, Math.PI * 1.5);
      ctx.arc(f.length, 0, f.rTip, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Inner crimson rubber inlay
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.roundRect(6, -3.5, f.length - 12, 7, 3);
      ctx.fill();

      // Brass pivot cap
      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  drawBalls(ctx, sim) {
    for (const ball of sim.balls) {
      // Comet velocity trail
      for (let i = 0; i < ball.trail.length; i++) {
        const pt = ball.trail[i];
        const alpha = ((i + 1) / ball.trail.length) * 0.28;
        const rad = ball.r * ((i + 1) / ball.trail.length) * 0.85;
        ctx.fillStyle = `rgba(226, 232, 240, ${alpha})`;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, rad, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3D Chrome / Liquid-Mercury Sphere
      ctx.save();
      ctx.translate(ball.x, ball.y);

      // Drop shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.beginPath();
      ctx.arc(2, 3, ball.r, 0, Math.PI * 2);
      ctx.fill();

      const g = ctx.createRadialGradient(-ball.r * 0.35, -ball.r * 0.35, 1.5, 0, 0, ball.r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.45, ball.tint || '#cbd5e1');
      g.addColorStop(0.85, '#475569');
      g.addColorStop(1, '#0f172a');

      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, ball.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  drawEffects(ctx, sim) {
    for (const p of sim.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    ctx.font = '700 12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    for (const ft of sim.floatTexts) {
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
  }

  renderDmd(sim) {
    const ctx = this.dmdCtx;
    const W = this.dmdCanvas.width;
    const H = this.dmdCanvas.height;

    ctx.fillStyle = '#140b04';
    ctx.fillRect(0, 0, W, H);

    // Subtle LED dot matrix grid
    ctx.fillStyle = 'rgba(255, 159, 28, 0.08)';
    for (let y = 3; y < H; y += 4) {
      for (let x = 3; x < W; x += 4) {
        ctx.fillRect(x, y, 2, 2);
      }
    }

    // Active banner or live telemetry
    const mainText = sim.dmdBanner.timer > 0
      ? sim.dmdBanner.text
      : `${sim.boss.def.tier}: ${sim.boss.def.name}`;
    const subText = sim.dmdBanner.timer > 0
      ? sim.dmdBanner.sub
      : `BALL ${sim.ballNumber}/${sim.maxBalls} · MULT ${sim.multiplier}X · LOCKS ${sim.crucibleLocks}/3`;

    ctx.fillStyle = '#ff9f1c';
    ctx.font = '700 12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(mainText, W / 2, 26);

    ctx.fillStyle = '#fde047';
    ctx.font = '600 9.5px "IBM Plex Mono", monospace';
    ctx.fillText(subText, W / 2, 46);
  }

  drawKeycapBadge(ctx, x, y, keyText, labelText, accent, active = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.font = '700 8px "IBM Plex Mono", monospace';
    const keyW = Math.max(22, ctx.measureText(keyText).width + 10);
    const labelW = labelText ? ctx.measureText(labelText).width + 8 : 0;
    const totalW = keyW + labelW;
    const h = 16;

    // Outer pill
    ctx.fillStyle = active ? 'rgba(251, 191, 36, 0.25)' : 'rgba(12, 9, 20, 0.88)';
    ctx.strokeStyle = active ? '#fde047' : accent;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-totalW / 2, -h / 2, totalW, h, 4);
    ctx.fill();
    ctx.stroke();

    // Keycap box on left
    ctx.fillStyle = active ? '#fde047' : 'rgba(212, 168, 83, 0.22)';
    ctx.beginPath();
    ctx.roundRect(-totalW / 2 + 1.5, -h / 2 + 1.5, keyW - 2, h - 3, 3);
    ctx.fill();

    ctx.fillStyle = active ? '#09070f' : '#fef08a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(keyText, -totalW / 2 + keyW / 2, 0.5);

    if (labelText) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(labelText, -totalW / 2 + keyW + labelW / 2 - 1, 0.5);
    }
    ctx.restore();
  }
}
