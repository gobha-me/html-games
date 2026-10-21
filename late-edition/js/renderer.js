// ============================================================================
// LATE EDITION // 1947 — 2.5D Rain-Slicked Noir Metropolis Renderer
// ============================================================================

import {
  WORLD_W,
  WORLD_H,
  DISTRICTS,
  STREETLAMPS,
} from './config.js';

export class NoirCityRenderer {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.reducedMotion = reducedMotion;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sprites = {};
    this.hoverLeadId = null;
    this.hoverOperativeId = null;
    this.mouseWorld = { x: WORLD_W * 0.5, y: WORLD_H * 0.5 };

    // Pre-generate diagonal rain drops and puddle ripples
    this.rain = Array.from({ length: 160 }, () => ({
      x: Math.random() * WORLD_W,
      y: Math.random() * WORLD_H,
      len: 16 + Math.random() * 18,
      speed: 440 + Math.random() * 220,
    }));

    this.ripples = Array.from({ length: 34 }, () => ({
      x: Math.random() * WORLD_W,
      y: Math.random() * WORLD_H,
      r: Math.random() * 16,
      maxR: 12 + Math.random() * 14,
      speed: 14 + Math.random() * 10,
    }));

    this._loadSprites();
  }

  _loadSprites() {
    const manifest = {
      reporter: 'assets/sprites/unit_reporter.png',
      photographer: 'assets/sprites/unit_photographer.png',
      fixer: 'assets/sprites/unit_fixer.png',
      rival: 'assets/sprites/unit_rival.png',
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
    if (this.reducedMotion) dt = 0;
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.save();
    ctx.scale(cw / WORLD_W, ch / WORLD_H);

    this._drawWetAsphaltBase(ctx);
    this._drawStreetNetwork(ctx, sim);
    this._drawStreetlampPools(ctx);
    this._drawTrafficCabs(ctx, sim);
    this._drawDistrictBuildings25D(ctx, sim);
    this._drawSyndicateStringBoard(ctx, sim);
    this._drawDispatchVectors(ctx, sim);
    this._drawStoryLeads(ctx, sim);
    this._drawRivals(ctx, sim);
    this._drawOperatives(ctx, sim);
    this._drawFlashesAndCallouts(ctx, sim);
    this._drawRainAndVignette(ctx, dt);
    this._drawBannerOverlay(ctx, sim);

    ctx.restore();
  }

  renderTitle(dt = 0.016) {
    const ctx = this.ctx;
    ctx.save();
    ctx.scale(this.canvas.width / WORLD_W, this.canvas.height / WORLD_H);
    ctx.fillStyle = '#0e0d0c';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    // Silhouette-only skyline for the masthead; no legacy sprites or neon labels.
    for (let i = 0; i < 18; i++) {
      const height = 160 + ((i * 173) % 310);
      const x = i * 84 - 30;
      ctx.fillStyle = i % 3 === 0 ? '#2a1710' : '#0e0d0c';
      ctx.fillRect(x, 810 - height, 78, height + 190);
      ctx.fillStyle = '#b5893f';
      for (let row = 0; row < 4; row++) {
        if ((i + row) % 3 === 0) ctx.fillRect(x + 16, 840 - height + row * 42, 9, 14);
      }
    }
    this._drawRainAndVignette(ctx, this.reducedMotion ? 0 : dt, '#6b655c');
    ctx.restore();
  }

  _drawWetAsphaltBase(ctx) {
    const grad = ctx.createRadialGradient(
      WORLD_W * 0.5,
      WORLD_H * 0.48,
      100,
      WORLD_W * 0.5,
      WORLD_H * 0.5,
      920
    );
    grad.addColorStop(0, '#131a28');
    grad.addColorStop(0.65, '#0b101a');
    grad.addColorStop(1, '#06090f');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  _drawStreetNetwork(ctx) {
    ctx.save();
    const avenuesY = [365, 615];
    const streetsX = [420, 485, 915, 980];

    // Horizontal avenues
    for (const y of avenuesY) {
      ctx.fillStyle = 'rgba(18, 25, 38, 0.95)';
      ctx.fillRect(0, y - 28, WORLD_W, 56);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y - 28);
      ctx.lineTo(WORLD_W, y - 28);
      ctx.moveTo(0, y + 28);
      ctx.lineTo(WORLD_W, y + 28);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(245, 183, 59, 0.34)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([18, 14]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_W, y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Vertical streets
    for (const x of streetsX) {
      ctx.fillStyle = 'rgba(18, 25, 38, 0.95)';
      ctx.fillRect(x - 24, 0, 48, WORLD_H);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 24, 0);
      ctx.lineTo(x - 24, WORLD_H);
      ctx.moveTo(x + 24, 0);
      ctx.lineTo(x + 24, WORLD_H);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(245, 183, 59, 0.25)';
      ctx.setLineDash([16, 14]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_H);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Puddle ripples on wet asphalt
    for (const rp of this.ripples) {
      const rx = Math.max(0.5, rp.r);
      const alpha = Math.max(0, 1 - rx / rp.maxR) * 0.25;
      ctx.strokeStyle = `rgba(165, 210, 255, ${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(rp.x, rp.y, rx, rx * 0.55, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawStreetlampPools(ctx) {
    ctx.save();
    for (const lamp of STREETLAMPS) {
      const g = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, 68);
      g.addColorStop(0, 'rgba(255, 219, 138, 0.28)');
      g.addColorStop(0.5, 'rgba(245, 183, 59, 0.09)');
      g.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 68, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawTrafficCabs(ctx, sim) {
    ctx.save();
    for (const cab of sim.cabs) {
      ctx.save();
      ctx.translate(cab.x, cab.y);
      const angle = Math.atan2(cab.vy, cab.vx);
      ctx.rotate(angle);

      // Headlight cone
      const cone = ctx.createLinearGradient(12, 0, 82, 0);
      cone.addColorStop(0, 'rgba(255, 235, 153, 0.35)');
      cone.addColorStop(1, 'rgba(255, 235, 153, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(10, -6);
      ctx.lineTo(82, -24);
      ctx.lineTo(82, 24);
      ctx.lineTo(10, 6);
      ctx.closePath();
      ctx.fill();

      // 1947 Checker Cab chassis
      ctx.fillStyle = '#090d16';
      ctx.fillRect(-15, -9, 30, 18);
      ctx.fillStyle = '#eab308';
      ctx.fillRect(-13, -7, 26, 14);
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-5, -6, 11, 12);
      ctx.restore();
    }
    ctx.restore();
  }

  _drawDistrictBuildings25D(ctx, sim) {
    const cx = WORLD_W * 0.5;
    const cy = WORLD_H * 0.5;

    for (const d of DISTRICTS) {
      const h3d = d.isHQ ? 42 : d.isRival ? 34 : 30;
      const bx = d.x + d.w * 0.5;
      const by = d.y + d.h * 0.5;
      const ox = ((bx - cx) / WORLD_W) * h3d * 0.65;
      const oy = ((by - cy) / WORLD_H) * h3d * 0.55 - h3d * 0.42;

      const rx = d.x + ox;
      const ry = d.y + oy;

      ctx.save();

      // Neon reflection pool around building footprint
      const pool = ctx.createRadialGradient(
        bx,
        by,
        20,
        bx,
        by,
        Math.max(d.w, d.h) * 0.72
      );
      pool.addColorStop(0, d.accent + '28');
      pool.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pool;
      ctx.fillRect(d.x - 30, d.y - 30, d.w + 60, d.h + 60);

      // Street drop shadow
      ctx.fillStyle = 'rgba(2, 4, 9, 0.72)';
      ctx.fillRect(d.x + 8, d.y + 10, d.w, d.h);

      // 2.5D Extruded South/Side Facade Walls
      ctx.fillStyle = d.color;
      ctx.strokeStyle = d.accent + '66';
      ctx.lineWidth = 1.4;

      // Bottom wall
      ctx.beginPath();
      ctx.moveTo(d.x, d.y + d.h);
      ctx.lineTo(d.x + d.w, d.y + d.h);
      ctx.lineTo(rx + d.w, ry + d.h);
      ctx.lineTo(rx, ry + d.h);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Side wall
      if (ox < 0) {
        ctx.beginPath();
        ctx.moveTo(d.x + d.w, d.y);
        ctx.lineTo(d.x + d.w, d.y + d.h);
        ctx.lineTo(rx + d.w, ry + d.h);
        ctx.lineTo(rx + d.w, ry);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, d.y + d.h);
        ctx.lineTo(rx, ry + d.h);
        ctx.lineTo(rx, ry);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Roof Deck
      const roofGrad = ctx.createLinearGradient(rx, ry, rx + d.w, ry + d.h);
      roofGrad.addColorStop(0, d.color);
      roofGrad.addColorStop(1, '#0b101b');
      ctx.fillStyle = roofGrad;
      ctx.fillRect(rx, ry, d.w, d.h);

      ctx.strokeStyle = d.accent;
      ctx.lineWidth = d.isHQ ? 2.4 : 1.5;
      ctx.strokeRect(rx, ry, d.w, d.h);

      // Inner Art-Deco Rooftop Setback & Architectural Details
      ctx.strokeStyle = d.accent + '44';
      ctx.lineWidth = 1;
      ctx.strokeRect(rx + 10, ry + 10, d.w - 20, d.h - 20);

      if (d.id === 'cityhall') {
        // Classical Rotunda Dome & Sweeping Searchlight
        const domeX = rx + d.w * 0.5;
        const domeY = ry + d.h * 0.62;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.55)';
        ctx.beginPath();
        ctx.arc(domeX, domeY, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(domeX, domeY, 16, 0, Math.PI * 2);
        ctx.stroke();
      } else if (d.id === 'docks') {
        // Waterfront Cargo Pier Cranes & Slip Lines
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
        for (const cxOff of [42, d.w - 42]) {
          ctx.strokeRect(rx + cxOff - 14, ry + d.h - 68, 28, 26);
          ctx.beginPath();
          ctx.moveTo(rx + cxOff, ry + d.h - 55);
          ctx.lineTo(rx + cxOff + (cxOff < 100 ? -26 : 26), ry + d.h - 82);
          ctx.stroke();
        }
      } else if (d.id === 'redlight') {
        // Neon Lounge Rooftop Skylight & Cocktail Sign Ring
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
        ctx.strokeRect(rx + d.w * 0.5 - 56, ry + d.h - 72, 112, 26);
      } else if (d.id === 'wallst') {
        // Neoclassical Colonnade Steps & Vault Skylight
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.45)';
        for (let p = 0; p < 6; p++) {
          ctx.strokeRect(rx + 36 + p * 42, ry + 14, 16, 8);
        }
      } else if (d.id === 'slaughterhouse') {
        // Brick Smokestacks & Water Tower Circles
        ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        for (const sx of [rx + 46, rx + d.w - 46]) {
          ctx.beginPath();
          ctx.arc(sx, ry + d.h - 58, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Lit Art Deco window strips on roof/facade
      const cols = Math.floor((d.w - 28) / 22);
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < 2; r++) {
          const wx = rx + 16 + c * 22;
          const wy = ry + d.h - 28 + r * 10;
          const lit = ((c * 7 + r * 3 + d.x) % 4) !== 0;
          ctx.fillStyle = lit
            ? d.isHQ
              ? 'rgba(255, 212, 122, 0.85)'
              : d.accent + '77'
            : 'rgba(15, 23, 42, 0.7)';
          ctx.fillRect(wx, wy, 12, 5);
        }
      }

      // District Code Badge & Title on Roof
      ctx.textAlign = 'center';
      ctx.font = '700 12px "JetBrains Mono", monospace';
      ctx.fillStyle = d.accent;
      ctx.fillText(d.code, rx + d.w * 0.5, ry + 26);

      ctx.font = '800 15px "Playfair Display", Georgia, serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(d.name, rx + d.w * 0.5, ry + 48);

      // Neon Marquee Sign
      ctx.font = '600 10.5px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(226, 232, 240, 0.75)';
      ctx.fillText(d.neon, rx + d.w * 0.5, ry + 68);

      if (d.isHQ) {
        // Press Integrity Bar on HQ Roof
        const barW = d.w - 48;
        const barX = rx + 24;
        const barY = ry + 84;
        ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
        ctx.fillRect(barX, barY, barW, 10);
        ctx.fillStyle = sim.pressHp > 45 ? '#10b981' : '#ef4444';
        ctx.fillRect(barX, barY, (barW * sim.pressHp) / 100, 10);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.strokeRect(barX, barY, barW, 10);
      }

      ctx.restore();
    }
  }

  _drawSyndicateStringBoard(ctx, sim) {
    const arcLeads = sim.leads.filter((l) => Boolean(l.arcId));
    if (arcLeads.length === 0) return;

    const hqX = sim.hq.x + sim.hq.w * 0.5;
    const hqY = sim.hq.y + sim.hq.h * 0.5;

    ctx.save();
    for (const lead of arcLeads) {
      // Crimson investigative string from Evening Star HQ to the active Arc Lead
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.52)';
      ctx.lineWidth = 2.0;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(hqX, hqY);
      ctx.lineTo(lead.x, lead.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Brass pushpin at HQ & midpoint evidence tag
      const mx = (hqX + lead.x) * 0.5;
      const my = (hqY + lead.y) * 0.5;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawDispatchVectors(ctx, sim) {
    ctx.save();
    for (const op of sim.operatives) {
      if (!sim.operativeAvailable(op)) continue;
      const dist = Math.hypot(op.targetX - op.x, op.targetY - op.y);
      if (dist < 10) continue;

      ctx.strokeStyle = op.color;
      ctx.lineWidth = op.id === sim.selectedOpId ? 2.6 : 1.6;
      ctx.setLineDash([10, 7]);
      ctx.beginPath();
      ctx.moveTo(op.x, op.y);
      ctx.lineTo(op.targetX, op.targetY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.beginPath();
      ctx.arc(op.targetX, op.targetY, 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawStoryLeads(ctx, sim) {
    for (const lead of sim.leads) {
      const isSelected = lead.uid === sim.selectedLeadId;
      const isHovered = lead.uid === this.hoverLeadId;
      const ttlRatio = Math.max(0, Math.min(1, lead.timeLeft / 48));

      ctx.save();
      ctx.translate(lead.x, lead.y);

      // Radial beacon pulse
      const pulse = 0.5 + 0.5 * Math.sin(sim.time * 5 + lead.x);
      const auraR = (isSelected ? 48 : 36) + pulse * 8;
      const aura = ctx.createRadialGradient(0, 0, 5, 0, 0, auraR);
      aura.addColorStop(0, lead.color + '77');
      aura.addColorStop(1, lead.color + '00');
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, auraR, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected || isHovered) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Dark brass node badge
      ctx.fillStyle = '#0b101d';
      ctx.strokeStyle = lead.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // TTL countdown arc
      ctx.strokeStyle = ttlRatio < 0.3 ? '#ef4444' : '#f8fafc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ttlRatio);
      ctx.stroke();

      // Player investigation progress arc
      if (lead.progress > 0) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          17,
          -Math.PI / 2,
          -Math.PI / 2 + (Math.PI * 2 * lead.progress) / 100
        );
        ctx.stroke();
      }

      // Rival investigation progress arc
      if (lead.rivalProgress > 0) {
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          13,
          -Math.PI / 2,
          -Math.PI / 2 + (Math.PI * 2 * lead.rivalProgress) / 100
        );
        ctx.stroke();
      }

      // Beat label inside node
      ctx.font = '800 10px "JetBrains Mono", monospace';
      ctx.fillStyle = lead.color;
      ctx.textAlign = 'center';
      ctx.fillText(lead.beat.slice(0, 5), 0, 3.5);

      // Headline callout pill above node
      const label = `$${lead.baseValue} · ${lead.headline.slice(0, 24)}…`;
      ctx.font = '700 11px "JetBrains Mono", monospace';
      const tw = ctx.measureText(label).width + 16;
      ctx.fillStyle = 'rgba(9, 13, 22, 0.94)';
      ctx.strokeStyle = isSelected ? '#ffffff' : lead.color;
      ctx.lineWidth = 1.4;
      ctx.fillRect(-tw / 2, -46, tw, 19);
      ctx.strokeRect(-tw / 2, -46, tw, 19);

      ctx.fillStyle = '#f8fafc';
      ctx.fillText(label, 0, -32.5);

      if (lead.seriesBadge) {
        ctx.font = '800 9.5px "IBM Plex Mono", monospace';
        const sw = ctx.measureText(lead.seriesBadge).width + 14;
        ctx.fillStyle = '#991b1b';
        ctx.strokeStyle = '#fde68a';
        ctx.lineWidth = 1.2;
        ctx.fillRect(-sw / 2, -65, sw, 16);
        ctx.strokeRect(-sw / 2, -65, sw, 16);
        ctx.fillStyle = '#fef08a';
        ctx.fillText(lead.seriesBadge, 0, -54);
      }

      if (lead.photoVerified) {
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(16, -22, 26, 14);
        ctx.fillStyle = '#090d16';
        ctx.font = '800 9.5px "JetBrains Mono", monospace';
        ctx.fillText('1.8×', 29, -12);
      } else if (lead.scoopedByRival) {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(-38, -22, 24, 14);
        ctx.fillStyle = '#fef2f2';
        ctx.font = '800 9px "JetBrains Mono", monospace';
        ctx.fillText('0.5×', -26, -12);
      }

      // First-launch onboarding prompt on the selected lead when all units are idle at HQ
      const allIdle = sim.operatives.every(
        (op) => !op.targetLeadId && !op.targetRivalId
      );
      if (allIdle && isSelected && sim.scoopsTotal === 0) {
        const bounce = Math.sin(sim.time * 6) * 4;
        const prompt = '▲ CLICK HERE TO DISPATCH UNIT [1] JACK VANCE';
        ctx.font = '800 11.5px "IBM Plex Mono", monospace';
        const pw = ctx.measureText(prompt).width + 20;
        ctx.fillStyle = '#f5b73b';
        ctx.strokeStyle = '#14100a';
        ctx.lineWidth = 2;
        ctx.fillRect(-pw / 2, 34 + bounce, pw, 22);
        ctx.strokeRect(-pw / 2, 34 + bounce, pw, 22);
        ctx.fillStyle = '#14100a';
        ctx.fillText(prompt, 0, 49 + bounce);
      }

      ctx.restore();
    }
  }

  _drawRivals(ctx, sim) {
    const rivalImg = this.sprites.rival;
    for (const rv of sim.rivals) {
      if (rv.type === 'herald' && rv.targetLeadId) {
        const tgt = sim.leads.find((l) => l.uid === rv.targetLeadId);
        if (tgt) {
          ctx.save();
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.5)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([7, 6]);
          ctx.beginPath();
          ctx.moveTo(rv.x, rv.y);
          ctx.lineTo(tgt.x, tgt.y);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.restore();
        }
      }

      ctx.save();
      ctx.translate(rv.x, rv.y);

      const ringColor = rv.type === 'goon' ? '#f43f5e' : '#eab308';
      // Press cruiser / saboteur searchlight cone
      ctx.save();
      ctx.rotate(rv.angle);
      const beam = ctx.createLinearGradient(12, 0, 78, 0);
      beam.addColorStop(0, ringColor + '44');
      beam.addColorStop(1, ringColor + '00');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(10, -6);
      ctx.lineTo(78, -26);
      ctx.lineTo(78, 26);
      ctx.lineTo(10, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = 'rgba(244, 63, 94, 0.18)';
      ctx.strokeStyle = rv.stunTimer > 0 ? '#94a3b8' : ringColor;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.rotate(rv.angle);
      if (rivalImg && rivalImg.complete && rivalImg.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(rivalImg, -28, -28, 56, 56);
      } else {
        ctx.fillStyle = ringColor;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(9, 13, 22, 0.92)';
      ctx.fillRect(-48, 24, 96, 15);
      ctx.fillStyle = rv.stunTimer > 0 ? '#cbd5e1' : ringColor;
      ctx.fillText(
        rv.stunTimer > 0
          ? 'FLASH STUNNED'
          : rv.type === 'goon'
            ? 'MOB SABOTEUR'
            : 'DAILY HERALD',
        0,
        35
      );
      ctx.restore();
    }
  }

  _drawOperatives(ctx, sim) {
    for (let i = 0; i < sim.operatives.length; i++) {
      const op = sim.operatives[i];
      if (!sim.operativeAvailable(op)) continue;
      const isSelected = op.id === sim.selectedOpId;
      const isHovered = op.id === this.hoverOperativeId;
      const sprite = this.sprites[op.sprite];

      ctx.save();
      ctx.translate(op.x, op.y);

      // Flashlight / Camera light cone
      ctx.save();
      ctx.rotate(op.angle);
      const beam = ctx.createLinearGradient(14, 0, 96, 0);
      beam.addColorStop(0, op.color + '48');
      beam.addColorStop(1, op.color + '00');
      ctx.fillStyle = beam;
      ctx.beginPath();
      ctx.moveTo(10, -7);
      ctx.lineTo(96, -32);
      ctx.lineTo(96, 32);
      ctx.lineTo(10, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      if (isSelected || isHovered) {
        const pulse = 0.5 + 0.5 * Math.sin(sim.time * 7);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(0, 0, 30 + pulse * 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Base tactical ring
      ctx.fillStyle = 'rgba(9, 13, 22, 0.78)';
      ctx.strokeStyle = op.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Top-down pixel-art sprite rotated toward heading
      ctx.save();
      ctx.rotate(op.angle);
      if (sprite && sprite.complete && sprite.naturalWidth > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sprite, -30, -30, 60, 60);
      } else {
        ctx.fillStyle = op.color;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Hotkey badge [1..4]
      ctx.fillStyle = op.color;
      ctx.fillRect(-30, -32, 18, 16);
      ctx.fillStyle = '#090d16';
      ctx.font = '800 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(i + 1), -21, -20);

      // Callsign plate underneath
      ctx.fillStyle = 'rgba(9, 13, 22, 0.94)';
      ctx.strokeStyle = op.color + '99';
      ctx.lineWidth = 1.2;
      ctx.fillRect(-38, 24, 76, 17);
      ctx.strokeRect(-38, 24, 76, 17);

      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillText(op.callsign, 0, 36);

      ctx.restore();
    }
  }

  _drawFlashesAndCallouts(ctx, sim) {
    ctx.save();
    for (const fl of sim.flashes) {
      ctx.strokeStyle = fl.color || '#ffffff';
      ctx.globalAlpha = Math.max(0, fl.alpha);
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, fl.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    for (const c of sim.callouts) {
      const alpha = Math.max(0, Math.min(1, c.life / 1.4));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '800 13px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const w = ctx.measureText(c.text).width + 18;
      ctx.fillStyle = 'rgba(9, 13, 22, 0.92)';
      ctx.fillRect(c.x - w / 2, c.y - 14, w, 20);
      ctx.fillStyle = c.color;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }
    ctx.restore();
  }

  _drawRainAndVignette(ctx, dt, ink = 'rgba(186, 218, 255, 0.24)') {
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (const drop of this.rain) {
      drop.x -= drop.speed * 0.22 * dt;
      drop.y += drop.speed * dt;
      if (drop.y > WORLD_H) {
        drop.y = -24;
        drop.x = Math.random() * (WORLD_W + 180);
      }
      if (drop.x < -20) drop.x = WORLD_W + 20;
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - drop.len * 0.22, drop.y + drop.len);
    }
    ctx.stroke();

    for (const rp of this.ripples) {
      rp.r += rp.speed * dt;
      if (rp.r >= rp.maxR) {
        rp.r = 0.5;
        rp.x = Math.random() * WORLD_W;
        rp.y = Math.random() * WORLD_H;
      }
    }

    const vig = ctx.createRadialGradient(
      WORLD_W * 0.5,
      WORLD_H * 0.5,
      WORLD_W * 0.34,
      WORLD_W * 0.5,
      WORLD_H * 0.5,
      WORLD_W * 0.68
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(2, 4, 9, 0.62)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }

  _drawBannerOverlay(ctx, sim) {
    if (!sim.banner || sim.banner.timer <= 0) return;
    // Only show top-center toast after first dispatch so bottom telegram slips stay 100% clear
    if (sim.time < 0.8 && sim.scoopsTotal === 0) return;
    const alpha = Math.min(1, sim.banner.timer / 0.8);
    const by = 14;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(20, 13, 8, 0.94)';
    ctx.strokeStyle = '#f5b73b';
    ctx.lineWidth = 2;
    ctx.fillRect(WORLD_W * 0.5 - 290, by, 580, 48);
    ctx.strokeRect(WORLD_W * 0.5 - 290, by, 580, 48);

    ctx.textAlign = 'center';
    ctx.font = '800 13.5px "Playfair Display", Georgia, serif';
    ctx.fillStyle = '#f7c968';
    ctx.fillText(sim.banner.title, WORLD_W * 0.5, by + 20);

    ctx.font = '700 10px "IBM Plex Mono", monospace';
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(sim.banner.sub, WORLD_W * 0.5, by + 38);
    ctx.restore();
  }
}
