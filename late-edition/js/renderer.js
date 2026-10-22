import { PALETTE, alpha as withAlpha } from './palette.js';
import { CITY_SEED, generateDistrict } from './city.js';
import { mulberry32 } from './rng.js';
import { drawSilhouette } from './silhouettes.js';
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
    this.city = DISTRICTS.map((district) => ({ district, buildings: generateDistrict(district) }));
    this.cosmeticTime = 0;
    this.cache = null;
    this.previousLeads = [];
    this.lastScoops = 0;
    this.scoopFlashes = [];
    const rainRng = mulberry32(CITY_SEED);
    this.hoverLeadId = null;
    this.hoverOperativeId = null;
    this.mouseWorld = { x: WORLD_W * 0.5, y: WORLD_H * 0.5 };

    // Pre-generate deterministic cosmetic rain, independent of the run seed
    this.rain = Array.from({ length: 160 }, () => ({
      x: rainRng.nextFloat() * WORLD_W,
      y: rainRng.nextFloat() * WORLD_H,
      len: 16 + rainRng.nextFloat() * 18,
      speed: 440 + rainRng.nextFloat() * 220,
    }));

  }

  // Static geometry is rasterized once per backing-size/DPR change. Keeping
  // world coordinates unchanged preserves every legacy input target.
  _ensureLayers() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * dpr));
    const height = Math.max(1, Math.round(rect.height * dpr));
    const key = `${width}:${height}:${dpr}`;
    if (this.cache?.key === key) return true;
    // Wait for the initial local font load before baking signs. Otherwise the
    // cache would retain fallback glyphs until resize; no font-triggered rebuild
    // is needed. Failed/blocked fonts settle and use the period fallback stacks.
    if (!this.cache && document.fonts?.status === 'loading') return false;
    this.canvas.width = width;
    this.canvas.height = height;
    const layer = (paint) => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.scale(width / WORLD_W, height / WORLD_H);
      paint(ctx);
      return canvas;
    };
    this.cache = {
      key,
      city: layer((ctx) => {
        this._drawWetAsphaltBase(ctx);
        this._drawStreetNetwork(ctx);
        this._drawStreetlampPools(ctx);
        this._drawDistrictBuildings25D(ctx);
      }),
      fog: layer((ctx) => this._drawFogEdges(ctx)),
      skyline: [0, 1, 2].map((depth) => layer((ctx) => this._drawSkyline(ctx, depth))),
    };
    return true;
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
    if (!this._ensureLayers()) return;
    dt = this.reducedMotion || !Number.isFinite(dt) ? 0 : Math.max(0, Math.min(dt, 0.1));
    this.cosmeticTime += dt;
    const ctx = this.ctx;
    ctx.drawImage(this.cache.city, 0, 0);
    ctx.save();
    ctx.scale(this.canvas.width / WORLD_W, this.canvas.height / WORLD_H);
    this._drawTrafficCabs(ctx, sim);
    this._drawSyndicateStringBoard(ctx, sim);
    this._drawDispatchVectors(ctx, sim);
    this._drawStoryLeads(ctx, sim);
    this._drawRivals(ctx, sim);
    this._drawOperatives(ctx, sim);
    if (sim.scoopsTotal > this.lastScoops && !this.reducedMotion) {
      for (const lead of this.previousLeads) {
        if (sim.scoopedStories.some((story) => story.uid === lead.uid)) this.scoopFlashes.push({ x: lead.x, y: lead.y, life: 0.22 });
      }
    }
    this.lastScoops = sim.scoopsTotal;
    this.previousLeads = sim.leads.map(({ uid, x, y }) => ({ uid, x, y }));
    this.scoopFlashes = this.scoopFlashes.filter((flash) => (flash.life -= dt) > 0);
    this._drawFlashesAndCallouts(ctx, sim);
    this._drawRainAndVignette(ctx, dt);
    ctx.restore();
    ctx.drawImage(this.cache.fog, 0, 0);
    ctx.save();
    ctx.scale(this.canvas.width / WORLD_W, this.canvas.height / WORLD_H);
    this._drawBannerOverlay(ctx, sim);
    ctx.restore();
  }

  renderTitle(dt = 0.016) {
    if (!this._ensureLayers()) return;
    dt = this.reducedMotion || !Number.isFinite(dt) ? 0 : Math.max(0, Math.min(dt, 0.1));
    this.cosmeticTime += dt;
    const time = this.reducedMotion ? 0 : this.cosmeticTime;
    const ctx = this.ctx;
    ctx.fillStyle = PALETTE.nightInk;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.cache.skyline.forEach((layer, depth) => {
      const offset = Math.sin(time * 0.06) * (depth + 1) * 5;
      ctx.drawImage(layer, offset, 0);
    });
    ctx.save();
    ctx.scale(this.canvas.width / WORLD_W, this.canvas.height / WORLD_H);
    // A municipal searchlight: police blue is reserved for actual raids below.
    ctx.save();
    ctx.translate(980, 750);
    ctx.rotate(-0.4 + Math.sin(time * 0.12) * 0.45);
    const light = ctx.createLinearGradient(0, 0, 0, -650);
    light.addColorStop(0, withAlpha(PALETTE.newsprint, 0.09));
    light.addColorStop(1, withAlpha(PALETTE.newsprint, 0));
    ctx.fillStyle = light;
    polygon(ctx, [[0, 0], [-190, -650], [130, -650]]);
    ctx.restore();
    this._drawRainAndVignette(ctx, this.reducedMotion ? 0 : dt);
    ctx.restore();
    ctx.drawImage(this.cache.fog, 0, 0);
  }

  _drawSkyline(ctx, depth) {
    const mass = [withAlpha(PALETTE.smoke, 0.55), PALETTE.mahogany, PALETTE.nightInk][depth];
    const skylineRng = mulberry32(CITY_SEED + depth);
    ctx.fillStyle = mass;
    const baseline = 610 + depth * 150;
    for (let i = 0; i < 22; i++) {
      const x = i * 70 - 30;
      const height = 90 + skylineRng.nextInt(0, 285);
      const width = 45 + skylineRng.nextInt(0, 37);
      const top = baseline - height;
      ctx.fillRect(x, top, width, height + 240);
      ctx.fillRect(x + 5, top - 5, width - 10, 5);
      if (i % 3 === 0) {
        ctx.fillRect(x + 8, top - 19, width - 16, 18);
        ctx.fillRect(x + 15, top - 30, width - 30, 12);
      }
      if (i % 5 === 1) polygon(ctx, [[x, top], [x + width / 2, top - 28], [x + width, top]]);
      if (i % 4 === 0) drawWaterTower(ctx, x + 30, top);
      ctx.fillStyle = withAlpha(PALETTE.sodium, depth === 0 ? 0.2 : 0.55);
      for (let j = 0; j < 12; j++) {
        if ((i * 7 + j * 13 + depth) % 5 === 0) ctx.fillRect(x + 10 + (j % 3) * 15, top + 18 + Math.floor(j / 3) * 25, 4, 7);
      }
      ctx.fillStyle = mass;
      // Anchor the sign to a foreground roof outside the central title paper.
      if (depth === 2 && i === 17) drawSign(ctx, 'EVENING STAR', x + 3, top - 5, true);
    }
    if (depth === 2) {
      ctx.save();
      ctx.translate(0, 180);
      ctx.strokeStyle = PALETTE.smoke;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, 650); ctx.lineTo(650, 650);
      ctx.moveTo(120, 660); ctx.lineTo(120, 410);
      ctx.moveTo(540, 660); ctx.lineTo(540, 410);
      ctx.moveTo(0, 530); ctx.quadraticCurveTo(330, 780, 650, 530);
      ctx.stroke();
      ctx.lineWidth = 1;
      for (let x = 0; x <= 650; x += 30) {
        ctx.beginPath(); ctx.moveTo(x, 650); ctx.lineTo(x, 530 + Math.sin(x / 650 * Math.PI) * 120); ctx.stroke();
      }
      ctx.restore();
    }
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
    grad.addColorStop(0, PALETTE.nightInk);
    grad.addColorStop(0.65, PALETTE.nightInk);
    grad.addColorStop(1, PALETTE.nightInk);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  _drawStreetNetwork(ctx) {
    ctx.save();
    const avenuesY = [365, 615];
    const streetsX = [420, 485, 915, 980];

    // Horizontal avenues
    for (const y of avenuesY) {
      ctx.fillStyle = withAlpha(PALETTE.nightInk, 0.95);
      ctx.fillRect(0, y - 28, WORLD_W, 56);

      ctx.strokeStyle = withAlpha(PALETTE.newsprintAged, 0.18);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y - 28);
      ctx.lineTo(WORLD_W, y - 28);
      ctx.moveTo(0, y + 28);
      ctx.lineTo(WORLD_W, y + 28);
      ctx.stroke();

      ctx.strokeStyle = withAlpha(PALETTE.sodium, 0.34);
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
      ctx.fillStyle = withAlpha(PALETTE.nightInk, 0.95);
      ctx.fillRect(x - 24, 0, 48, WORLD_H);

      ctx.strokeStyle = withAlpha(PALETTE.newsprintAged, 0.16);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - 24, 0);
      ctx.lineTo(x - 24, WORLD_H);
      ctx.moveTo(x + 24, 0);
      ctx.lineTo(x + 24, WORLD_H);
      ctx.stroke();

      ctx.strokeStyle = withAlpha(PALETTE.sodium, 0.25);
      ctx.setLineDash([16, 14]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_H);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  _drawStreetlampPools(ctx) {
    ctx.save();
    for (const lamp of STREETLAMPS) {
      const g = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, 68);
      g.addColorStop(0, withAlpha(PALETTE.sodium, 0.28));
      g.addColorStop(0.5, withAlpha(PALETTE.sodium, 0.09));
      g.addColorStop(1, withAlpha(PALETTE.nightInk, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 68, 0, Math.PI * 2);
      ctx.fill();

      const reflection = ctx.createLinearGradient(0, lamp.y, 0, lamp.y + 105);
      reflection.addColorStop(0, withAlpha(PALETTE.sodium, 0.16));
      reflection.addColorStop(1, withAlpha(PALETTE.sodium, 0));
      ctx.fillStyle = reflection;
      ctx.fillRect(lamp.x - 5, lamp.y, 10, 105);
      ctx.fillStyle = PALETTE.sodium;
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
      cone.addColorStop(0, withAlpha(PALETTE.sodium, 0.35));
      cone.addColorStop(1, withAlpha(PALETTE.sodium, 0));
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.moveTo(10, -6);
      ctx.lineTo(82, -24);
      ctx.lineTo(82, 24);
      ctx.lineTo(10, 6);
      ctx.closePath();
      ctx.fill();

      // 1947 Checker Cab chassis
      ctx.fillStyle = PALETTE.nightInk;
      ctx.fillRect(-15, -9, 30, 18);
      ctx.fillStyle = PALETTE.sodium;
      ctx.fillRect(-13, -7, 26, 14);
      ctx.fillStyle = PALETTE.smoke;
      ctx.fillRect(-5, -6, 11, 12);
      ctx.restore();
    }
    ctx.restore();
  }

  _drawDistrictBuildings25D(ctx) {
    for (const { district: d, buildings } of this.city) {
      for (const b of buildings) drawBuilding(ctx, b);
      this._drawLandmark(ctx, d, buildings[4]);
      drawSign(ctx, STREET_SIGNS[d.id], d.x + 8, d.y + d.h - 4);
    }
  }

  _drawLandmark(ctx, d, b) {
    const x = b.x + b.width / 2, y = b.y - b.height;
    ctx.save();
    ctx.fillStyle = PALETTE.nightInk;
    ctx.strokeStyle = PALETTE.smoke;
    ctx.lineWidth = 2;
    if (d.id === 'cityhall') {
      ctx.beginPath(); ctx.arc(x, y, 29, Math.PI, 0); ctx.fill(); ctx.stroke();
      ctx.fillRect(x - 3, y - 40, 6, 16);
    } else if (d.id === 'docks') {
      ctx.fillStyle = PALETTE.mahogany;
      ctx.fillRect(d.x, d.y + d.h - 25, d.w, 13);
      for (const craneX of [d.x + 44, d.x + 205]) {
        ctx.beginPath();
        ctx.moveTo(craneX, y + 45); ctx.lineTo(craneX, y - 75);
        ctx.lineTo(craneX + 65, y - 100); ctx.lineTo(craneX + 80, y - 100);
        ctx.moveTo(craneX + 65, y - 100); ctx.lineTo(craneX + 65, y - 20); ctx.stroke();
      }
    } else if (d.id === 'herald_hq') {
      ctx.fillRect(x - 18, y - 80, 36, 85);
      ctx.strokeRect(x - 18, y - 80, 36, 85);
      ctx.fillStyle = PALETTE.newsprintAged;
      ctx.beginPath(); ctx.arc(x, y - 55, 12, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = PALETTE.nightInk;
      ctx.beginPath(); ctx.moveTo(x, y - 64); ctx.lineTo(x, y - 55); ctx.lineTo(x + 7, y - 52); ctx.stroke();
    } else if (d.id === 'hq') {
      drawSign(ctx, 'EVENING STAR', x - 72, y - 26, true);
      ctx.fillStyle = withAlpha(PALETTE.sodium, 0.65);
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 26 + i * 10, y + 18, 6, 14);
    } else if (d.id === 'observer_hq') {
      ctx.globalAlpha = 0.5;
      drawSign(ctx, 'OBSERVER', x - 42, y + 10);
    } else if (d.id === 'wallst') {
      polygon(ctx, [[x - 44, y + 8], [x, y - 15], [x + 44, y + 8]]);
      ctx.fillStyle = PALETTE.smoke;
      for (let i = 0; i < 5; i++) ctx.fillRect(x - 35 + i * 16, y + 12, 5, 34);
    } else if (d.id === 'slaughterhouse') {
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(x - 28 + i * 22, y - 58 - i * 8, 13, 65 + i * 8);
        ctx.strokeRect(x - 28 + i * 22, y - 58 - i * 8, 13, 65 + i * 8);
      }
    } else if (d.id === 'redlight') {
      drawSign(ctx, 'VELVET', x - 32, y + 35, true);
      ctx.fillStyle = PALETTE.mahogany;
      polygon(ctx, [[x - 40, y + 48], [x + 40, y + 48], [x + 50, y + 62], [x - 45, y + 62]]);
    }
    ctx.restore();
  }

  _drawSyndicateStringBoard(ctx, sim) {
    const arcLeads = sim.leads.filter((l) => Boolean(l.arcId));
    if (arcLeads.length === 0) return;

    const hqX = sim.hq.x + sim.hq.w * 0.5;
    const hqY = sim.hq.y + sim.hq.h * 0.5;

    ctx.save();
    for (const lead of arcLeads) {
      // Crimson investigative string from Evening Star HQ to the active Arc Lead
      ctx.strokeStyle = withAlpha(PALETTE.stampRed, 0.52);
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
      ctx.fillStyle = PALETTE.stampRed;
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

      ctx.strokeStyle = PALETTE.sodium;
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
      const pulse = 0.5 + 0.5 * Math.sin(this.cosmeticTime * 5 + lead.x);
      const auraR = (isSelected ? 48 : 36) + pulse * 8;
      const aura = ctx.createRadialGradient(0, 0, 5, 0, 0, auraR);
      aura.addColorStop(0, withAlpha(PALETTE.sodium, 0.467));
      aura.addColorStop(1, withAlpha(PALETTE.sodium, 0.000));
      ctx.fillStyle = aura;
      ctx.beginPath();
      ctx.arc(0, 0, auraR, 0, Math.PI * 2);
      ctx.fill();

      if (isSelected || isHovered) {
        ctx.strokeStyle = PALETTE.newsprint;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 30, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Pin is exactly at the unchanged address; the telegram is decoration.
      ctx.strokeStyle = PALETTE.brass;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -24); ctx.stroke();
      ctx.fillStyle = PALETTE.telegram;
      polygon(ctx, [[0, -24], [29, -24], [24, -15], [29, -6], [0, -6]]);
      ctx.fillStyle = PALETTE.stampRed;
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();

      // TTL countdown arc
      ctx.strokeStyle = ttlRatio < 0.3 ? PALETTE.stampRed : PALETTE.newsprint;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ttlRatio);
      ctx.stroke();

      // Player investigation progress arc
      if (lead.progress > 0) {
        ctx.strokeStyle = PALETTE.newsprintAged;
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
        ctx.strokeStyle = PALETTE.stampRed;
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
      ctx.font = '800 10px "Courier Prime", "Courier New", monospace';
      ctx.fillStyle = PALETTE.sodium;
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.nightInk;
      ctx.fillText(lead.beat.slice(0, 5), 14, -12);

      // Headline callout pill above node
      const label = `$${lead.baseValue} · ${lead.headline.slice(0, 24)}…`;
      ctx.font = '700 11px "Courier Prime", "Courier New", monospace';
      const tw = ctx.measureText(label).width + 16;
      ctx.fillStyle = withAlpha(PALETTE.nightInk, 0.94);
      ctx.strokeStyle = isSelected ? PALETTE.newsprint : PALETTE.sodium;
      ctx.lineWidth = 1.4;
      ctx.fillRect(-tw / 2, -46, tw, 19);
      ctx.strokeRect(-tw / 2, -46, tw, 19);

      ctx.fillStyle = PALETTE.newsprint;
      ctx.fillText(label, 0, -32.5);

      if (lead.seriesBadge) {
        ctx.font = '800 9.5px "Courier Prime", "Courier New", monospace';
        const sw = ctx.measureText(lead.seriesBadge).width + 14;
        ctx.fillStyle = PALETTE.stampRed;
        ctx.strokeStyle = PALETTE.sodium;
        ctx.lineWidth = 1.2;
        ctx.fillRect(-sw / 2, -65, sw, 16);
        ctx.strokeRect(-sw / 2, -65, sw, 16);
        ctx.fillStyle = PALETTE.sodium;
        ctx.fillText(lead.seriesBadge, 0, -54);
      }

      if (lead.photoVerified) {
        ctx.fillStyle = PALETTE.newsprintAged;
        ctx.fillRect(16, -22, 26, 14);
        ctx.fillStyle = PALETTE.nightInk;
        ctx.font = '800 9.5px "Courier Prime", "Courier New", monospace';
        ctx.fillText('1.8×', 29, -12);
      } else if (lead.scoopedByRival) {
        ctx.fillStyle = PALETTE.stampRed;
        ctx.fillRect(-38, -22, 24, 14);
        ctx.fillStyle = PALETTE.newsprint;
        ctx.font = '800 9px "Courier Prime", "Courier New", monospace';
        ctx.fillText('0.5×', -26, -12);
      }

      // First-launch onboarding prompt on the selected lead when all units are idle at HQ
      const allIdle = sim.operatives.every(
        (op) => !op.targetLeadId && !op.targetRivalId
      );
      if (allIdle && isSelected && sim.scoopsTotal === 0) {
        const bounce = Math.sin(this.cosmeticTime * 6) * 4;
        const prompt = '▲ CLICK HERE TO DISPATCH UNIT [1] JACK VANCE';
        ctx.font = '800 11.5px "Courier Prime", "Courier New", monospace';
        const pw = ctx.measureText(prompt).width + 20;
        ctx.fillStyle = PALETTE.sodium;
        ctx.strokeStyle = PALETTE.nightInk;
        ctx.lineWidth = 2;
        ctx.fillRect(-pw / 2, 34 + bounce, pw, 22);
        ctx.strokeRect(-pw / 2, 34 + bounce, pw, 22);
        ctx.fillStyle = PALETTE.nightInk;
        ctx.fillText(prompt, 0, 49 + bounce);
      }

      ctx.restore();
    }
  }

  _drawRivals(ctx, sim) {
    for (const rv of sim.rivals) {
      ctx.save();
      ctx.translate(rv.x, rv.y);
      const goon = rv.type === 'goon';
      if (rv.targetLeadId && !goon) {
        // Herald sedan headlights are sodium; only a raid gets police blue.
        ctx.save(); ctx.rotate(rv.angle);
        const beam = ctx.createLinearGradient(10, 0, 100, 0);
        beam.addColorStop(0, withAlpha(PALETTE.sodium, 0.22));
        beam.addColorStop(1, withAlpha(PALETTE.sodium, 0));
        ctx.fillStyle = beam;
        polygon(ctx, [[10, -7], [100, -30], [100, 30], [10, 7]]);
        ctx.fillStyle = PALETTE.nightInk;
        ctx.fillRect(-23, -11, 46, 22);
        ctx.strokeStyle = PALETTE.smoke; ctx.strokeRect(-23, -11, 46, 22);
        ctx.fillStyle = PALETTE.smoke; ctx.fillRect(-5, -8, 15, 16);
        ctx.restore();
      }
      if (goon) {
        ctx.save(); ctx.rotate(rv.angle);
        ctx.fillStyle = withAlpha(PALETTE.policeBlue, 0.15);
        polygon(ctx, [[0, 0], [90, -28], [90, 28]]);
        ctx.restore();
      }
      drawSilhouette(ctx, goon ? 'fixer' : 'reporter', { herald: !goon, goon,
        bob: rv.stunTimer > 0 ? 0 : Math.sin(this.cosmeticTime * 10 + rv.x * 0.01) * 1.5 });
      if (rv.stunTimer > 0) {
        ctx.strokeStyle = PALETTE.newsprint;
        ctx.beginPath(); ctx.arc(0, -22, 27, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawOperatives(ctx, sim) {
    sim.operatives.forEach((op, i) => {
      if (!sim.operativeAvailable(op)) return;
      ctx.save();
      ctx.translate(op.x, op.y);
      if (op.id === sim.selectedOpId || op.id === this.hoverOperativeId) {
        ctx.strokeStyle = PALETTE.sodium;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 3, 24, 11, 0, 0, Math.PI * 2); ctx.stroke();
      }
      const walking = Math.hypot(op.targetX - op.x, op.targetY - op.y) > 10;
      drawSilhouette(ctx, op.role, { bob: walking ? Math.sin(this.cosmeticTime * 10 + i) * 1.5 : 0 });
      ctx.fillStyle = PALETTE.sodium;
      ctx.fillRect(-20, -41, 11, 12);
      ctx.fillStyle = PALETTE.nightInk;
      ctx.font = '10px "Courier Prime", monospace';
      ctx.textAlign = 'center'; ctx.fillText(String(i + 1), -14.5, -32);
      ctx.restore();
    });
  }

  _drawFlashesAndCallouts(ctx, sim) {
    ctx.save();
    for (const flash of this.reducedMotion ? [] : this.scoopFlashes) {
      ctx.globalAlpha = flash.life / 0.22;
      ctx.fillStyle = PALETTE.newsprint;
      polygon(ctx, [[flash.x, flash.y - 45], [flash.x + 8, flash.y - 8], [flash.x + 45, flash.y],
        [flash.x + 8, flash.y + 8], [flash.x, flash.y + 45], [flash.x - 8, flash.y + 8],
        [flash.x - 45, flash.y], [flash.x - 8, flash.y - 8]]);
    }
    for (const fl of this.reducedMotion ? [] : sim.flashes) {
      ctx.strokeStyle = PALETTE.newsprint;
      ctx.globalAlpha = Math.max(0, fl.alpha);
      // A flashbulb star, rather than a screen flash, keeps the address legible.
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        ctx.moveTo(fl.x + Math.cos(angle) * fl.r * 0.5, fl.y + Math.sin(angle) * fl.r * 0.5);
        ctx.lineTo(fl.x + Math.cos(angle) * fl.r * 1.4, fl.y + Math.sin(angle) * fl.r * 1.4);
      }
      ctx.stroke();
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
      ctx.font = '800 13px "Courier Prime", "Courier New", monospace';
      ctx.textAlign = 'center';
      const w = ctx.measureText(c.text).width + 18;
      ctx.fillStyle = withAlpha(PALETTE.nightInk, 0.92);
      ctx.fillRect(c.x - w / 2, c.y - 14, w, 20);
      ctx.fillStyle = PALETTE.sodium;
      ctx.fillText(c.text, c.x, c.y);
      ctx.restore();
    }
    ctx.restore();
  }

  _drawRainAndVignette(ctx, dt, ink = withAlpha(PALETTE.newsprint, 0.24)) {
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (const drop of this.rain) {
      drop.x -= drop.speed * 0.22 * dt;
      drop.y += drop.speed * dt;
      if (drop.y > WORLD_H) {
        drop.y = -24;
        drop.x = (drop.x + 613) % (WORLD_W + 180);
      }
      if (drop.x < -20) drop.x = WORLD_W + 20;
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - drop.len * 0.22, drop.y + drop.len);
    }
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const x = 150 + i * 530 + Math.sin(this.cosmeticTime * 0.08 + i) * 90;
      const y = i % 2 === 0 ? 950 : 40;
      ctx.save();
      ctx.translate(x, y); ctx.scale(3, 0.35);
      const fog = ctx.createRadialGradient(0, 0, 0, 0, 0, 140);
      fog.addColorStop(0, withAlpha(PALETTE.smoke, 0.13));
      fog.addColorStop(1, withAlpha(PALETTE.smoke, 0));
      ctx.fillStyle = fog; ctx.fillRect(-140, -140, 280, 280);
      ctx.restore();
    }
    ctx.restore();
  }

  _drawFogEdges(ctx) {
    // Opaque edges obscure the outskirts; transparent center keeps addresses clear.
    const fog = ctx.createRadialGradient(700, 500, 330, 700, 500, 830);
    fog.addColorStop(0, withAlpha(PALETTE.smoke, 0));
    fog.addColorStop(0.75, withAlpha(PALETTE.smoke, 0.12));
    fog.addColorStop(1, withAlpha(PALETTE.smoke, 0.75));
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  _drawBannerOverlay(ctx, sim) {
    if (!sim.banner || sim.banner.timer <= 0) return;
    // Only show top-center toast after first dispatch so bottom telegram slips stay 100% clear
    if (sim.time < 0.8 && sim.scoopsTotal === 0) return;
    const alpha = Math.min(1, sim.banner.timer / 0.8);
    const by = 14;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = withAlpha(PALETTE.mahogany, 0.94);
    ctx.strokeStyle = PALETTE.sodium;
    ctx.lineWidth = 2;
    ctx.fillRect(WORLD_W * 0.5 - 290, by, 580, 48);
    ctx.strokeRect(WORLD_W * 0.5 - 290, by, 580, 48);

    ctx.textAlign = 'center';
    ctx.font = '800 13.5px "League Gothic", Impact, "Arial Narrow", sans-serif';
    ctx.fillStyle = PALETTE.sodium;
    ctx.fillText(sim.banner.title, WORLD_W * 0.5, by + 20);

    ctx.font = '700 10px "Courier Prime", "Courier New", monospace';
    ctx.fillStyle = PALETTE.newsprint;
    ctx.fillText(sim.banner.sub, WORLD_W * 0.5, by + 38);
    ctx.restore();
  }
}

const STREET_SIGNS = {
  hq: 'PRESS ROW', docks: 'PIER 14', cityhall: 'CITY HALL', redlight: 'VELVET CLUB',
  wallst: 'TRUST BANK', slaughterhouse: 'MEATPACKING', herald_hq: 'HERALD SQ.', observer_hq: 'OBSERVER',
};
function polygon(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath(); ctx.fill();
}
function drawSign(ctx, text, x, y, rooftop = false) {
  ctx.save();
  ctx.font = rooftop ? '22px "League Gothic", Impact, sans-serif' : '12px "Courier Prime", monospace';
  const width = ctx.measureText(text).width + 12;
  ctx.strokeStyle = PALETTE.smoke; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 3, y); ctx.lineTo(x + 3, y + 25); ctx.stroke();
  ctx.fillStyle = PALETTE.nightInk; ctx.fillRect(x, y - 18, width, 23);
  ctx.strokeRect(x, y - 18, width, 23);
  ctx.fillStyle = rooftop ? PALETTE.sodium : PALETTE.newsprintAged;
  ctx.fillText(text, x + 6, y);
  ctx.restore();
}
function drawWaterTower(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = PALETTE.nightInk; ctx.strokeStyle = PALETTE.smoke; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x - 7, y - 18);
  ctx.moveTo(x + 9, y); ctx.lineTo(x + 7, y - 18); ctx.stroke();
  ctx.fillRect(x - 12, y - 36, 24, 20);
  polygon(ctx, [[x - 15, y - 36], [x, y - 44], [x + 15, y - 36]]);
  ctx.strokeRect(x - 12, y - 36, 24, 20);
  ctx.restore();
}
function drawBuilding(ctx, b) {
  const { x, y, width: w, depth: d, height: h } = b;
  const skew = d * 0.577; // 30-degree oblique roof, purely cosmetic projection.
  ctx.fillStyle = PALETTE.mahogany;
  polygon(ctx, [[x, y], [x + w, y], [x + w, y - h], [x, y - h]]);
  ctx.fillStyle = PALETTE.nightInk;
  polygon(ctx, [[x + w, y], [x + w + skew, y - d], [x + w + skew, y - d - h], [x + w, y - h]]);
  ctx.fillStyle = PALETTE.nightInk;
  polygon(ctx, [[x, y - h], [x + skew, y - h - d], [x + w + skew, y - h - d], [x + w, y - h]]);
  ctx.strokeStyle = withAlpha(PALETTE.smoke, 0.65); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x, y - h + 3); ctx.lineTo(x + w, y - h + 3);
  ctx.lineTo(x + w + skew, y - h - d + 3); ctx.stroke();
  if (b.setback) {
    ctx.fillStyle = PALETTE.mahogany;
    ctx.fillRect(x + skew + 4, y - h - d + 4, w * 0.6, 9);
  }
  if (b.tank) drawWaterTower(ctx, x + w / 2 + skew, y - h - d / 2);
  b.windows.forEach((lit, i) => {
    if (!lit) return;
    ctx.fillStyle = withAlpha(i % 4 === 0 ? PALETTE.telegram : PALETTE.sodium, 0.65);
    ctx.fillRect(x + 7 + (i % 5) * (w - 12) / 5, y - h + 10 + Math.floor(i / 5) * (h - 15) / 3, 3, 4);
  });
  if (b.escape) {
    ctx.strokeStyle = withAlpha(PALETTE.smoke, 0.5);
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const top = y - h + 13 + i * 13;
      ctx.moveTo(x + w - 15, top); ctx.lineTo(x + w - 3, top);
      ctx.lineTo(x + w - 15, top + 13);
    }
    ctx.stroke();
  }
}
