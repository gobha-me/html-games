// ============================================================================
// IRONWORKS // CORE — 60fps Spatial Canvas2D + Lighting & Minimap Renderer
// ============================================================================

import {
  GRID_W, GRID_H, TILE_SIZE, CORE_X, CORE_Y, DIRS, TERRAIN,
  RESOURCES, BUILDING_BY_ID
} from './config.js';

export class IronworksRenderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.miniCanvas = minimapCanvas;
    this.miniCtx = minimapCanvas.getContext('2d');

    this.camX = (CORE_X + 1) * TILE_SIZE;
    this.camY = (CORE_Y + 1) * TILE_SIZE;
    this.zoom = 1.05;
    this.hoverTile = { x: -1, y: -1 };
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(320, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(240, Math.floor(rect.height * dpr));
    this.dpr = dpr;
    this.viewW = rect.width;
    this.viewH = rect.height;
  }

  screenToWorld(sx, sy) {
    const wx = (sx - this.viewW / 2) / this.zoom + this.camX;
    const wy = (sy - this.viewH / 2) / this.zoom + this.camY;
    return {
      wx,
      wy,
      tx: Math.floor(wx / TILE_SIZE),
      ty: Math.floor(wy / TILE_SIZE),
    };
  }

  render(sim, uiState) {
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Background foundry slate
    ctx.fillStyle = '#0c0f16';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // Camera transform
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);

    // Visible tile bounds
    const halfW = (this.viewW / 2) / this.zoom;
    const halfH = (this.viewH / 2) / this.zoom;
    const x0 = Math.max(0, Math.floor((this.camX - halfW) / TILE_SIZE) - 1);
    const x1 = Math.min(GRID_W - 1, Math.ceil((this.camX + halfW) / TILE_SIZE) + 1);
    const y0 = Math.max(0, Math.floor((this.camY - halfH) / TILE_SIZE) - 1);
    const y1 = Math.min(GRID_H - 1, Math.ceil((this.camY + halfH) / TILE_SIZE) + 1);

    // 2. Terrain & Resource Veins
    this.drawTerrain(ctx, sim, x0, y0, x1, y1);

    // 3. Conveyor Belts & Splitters (underneath taller structures)
    this.drawBelts(ctx, sim, x0, y0, x1, y1);

    // 4. Physical Resource Packets riding on Belts
    this.drawBeltItems(ctx, sim, x0, y0, x1, y1);

    // 5. Production Machines, Walls, Turrets & Orbital Spire
    this.drawStructures(ctx, sim, x0, y0, x1, y1);

    // 6. Central 2x2 Reactor Core
    this.drawReactorCore(ctx, sim);

    // 7. Siege Crawlers
    this.drawEnemies(ctx, sim);

    // 8. Projectiles, Beams & Particles
    this.drawProjectilesAndBeams(ctx, sim);

    // 9. Placement Ghost & Range Preview
    this.drawBuildGhost(ctx, sim, uiState);

    // 10. Floating Combat / Mining Text
    this.drawFloatTexts(ctx, sim);

    ctx.restore();

    // Update Minimap
    this.renderMinimap(sim);
  }

  drawTerrain(ctx, sim, x0, y0, x1, y1) {
    const T = TILE_SIZE;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const px = x * T, py = y * T;
        const ter = sim.terrain[y][x];

        // Base metal/slate tile
        ctx.fillStyle = ((x + y) & 1) ? '#131822' : '#151b26';
        ctx.fillRect(px, py, T, T);

        // Subtle grid line
        ctx.strokeStyle = 'rgba(255,255,255,0.035)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);

        if (ter === TERRAIN.BASALT) {
          ctx.fillStyle = '#252b37';
          ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
          ctx.fillStyle = '#333c4d';
          ctx.beginPath();
          ctx.moveTo(px + 6, py + T - 6);
          ctx.lineTo(px + T * 0.5, py + 6);
          ctx.lineTo(px + T - 6, py + T - 6);
          ctx.closePath();
          ctx.fill();
        } else if (ter !== TERRAIN.FLOOR) {
          const col = ter === TERRAIN.IRON_VEIN ? '#60a5fa'
            : ter === TERRAIN.COPPER_VEIN ? '#f97316'
            : ter === TERRAIN.COAL_SEAM ? '#475569'
            : '#2dd4bf';
          const glow = ter === TERRAIN.IRON_VEIN ? 'rgba(96,165,250,0.18)'
            : ter === TERRAIN.COPPER_VEIN ? 'rgba(249,115,22,0.18)'
            : ter === TERRAIN.COAL_SEAM ? 'rgba(148,163,184,0.12)'
            : 'rgba(45,212,191,0.24)';
          ctx.fillStyle = glow;
          ctx.fillRect(px + 2, py + 2, T - 4, T - 4);

          // Ore crystal nodules
          ctx.fillStyle = col;
          const seed = (x * 73 + y * 139) & 15;
          ctx.fillRect(px + 8 + (seed % 5), py + 9, 9, 9);
          ctx.fillRect(px + 22, py + 14 + (seed % 4), 11, 10);
          ctx.fillRect(px + 12, py + 24, 10, 9);
        }
      }
    }
  }

  drawBelts(ctx, sim, x0, y0, x1, y1) {
    const T = TILE_SIZE;
    const animOffset = (sim.time * 28) % 12;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const b = sim.buildings[y][x];
        if (!b || (b.id !== 'belt' && b.id !== 'splitter')) continue;

        const cx = (x + 0.5) * T;
        const cy = (y + 0.5) * T;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(DIRS[b.dir].angle);

        // Belt track bed
        ctx.fillStyle = b.id === 'splitter' ? '#1e293b' : '#263040';
        ctx.fillRect(-T * 0.42, -T * 0.34, T * 0.84, T * 0.68);
        ctx.strokeStyle = b.id === 'splitter' ? '#38bdf8' : '#64748b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-T * 0.42, -T * 0.34, T * 0.84, T * 0.68);

        // Animated chevrons moving along +X in rotated space
        ctx.strokeStyle = b.id === 'splitter' ? '#38bdf8' : '#f59e0b';
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          const ox = i * 11 + (animOffset - 6);
          if (ox < -T * 0.35 || ox > T * 0.35) continue;
          ctx.beginPath();
          ctx.moveTo(ox - 4, -7);
          ctx.lineTo(ox + 3, 0);
          ctx.lineTo(ox - 4, 7);
          ctx.stroke();
        }

        if (b.id === 'splitter') {
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(-5, -T * 0.42, 10, 6);
          ctx.fillRect(-5, T * 0.36, 10, 6);
        }

        ctx.restore();
      }
    }
  }

  drawBeltItems(ctx, sim, x0, y0, x1, y1) {
    const T = TILE_SIZE;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const b = sim.buildings[y][x];
        if (!b || !b.item) continue;
        const res = RESOURCES[b.item.type];
        if (!res) continue;

        const d = DIRS[b.dir];
        const prog = b.item.progress - 0.5; // -0.5 (entry) to +0.5 (exit)
        const ix = (x + 0.5 + d.dx * prog * 0.78) * T;
        const iy = (y + 0.5 + d.dy * prog * 0.78) * T;

        ctx.fillStyle = res.glow;
        ctx.beginPath();
        ctx.arc(ix, iy, 6.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = res.color;
        ctx.beginPath();
        ctx.arc(ix, iy, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawStructures(ctx, sim, x0, y0, x1, y1) {
    const T = TILE_SIZE;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const b = sim.buildings[y][x];
        if (!b || b.id === 'belt' || b.id === 'splitter') continue;

        const def = BUILDING_BY_ID[b.id];
        const px = x * T, py = y * T;
        const cx = px + T / 2, cy = py + T / 2;

        // Base chassis
        ctx.fillStyle = def.color;
        ctx.fillRect(px + 3, py + 3, T - 6, T - 6);
        ctx.strokeStyle = def.accent;
        ctx.lineWidth = 1.6;
        ctx.strokeRect(px + 3, py + 3, T - 6, T - 6);

        if (b.id === 'wall') {
          ctx.fillStyle = '#64748b';
          ctx.fillRect(px + 7, py + 7, T - 14, T - 14);
          ctx.strokeStyle = '#1e293b';
          ctx.beginPath();
          ctx.moveTo(px + 4, py + 4); ctx.lineTo(px + T - 4, py + T - 4);
          ctx.moveTo(px + T - 4, py + 4); ctx.lineTo(px + 4, py + T - 4);
          ctx.stroke();
        } else if (b.id === 'drill') {
          // Rotating drill head + output arrow
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(sim.time * 4.5);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-8, -8, 16, 16);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(-6, -6, 12, 12);
          ctx.restore();
          this.drawEjectPort(ctx, cx, cy, b.dir, '#fde047');
        } else if (b.id === 'smelter' || b.id === 'fabricator') {
          // Glowing furnace crucible or assembler core
          const pulse = 0.55 + 0.45 * Math.sin(sim.time * 6 + x);
          ctx.fillStyle = b.id === 'smelter'
            ? `rgba(251, 146, 60, ${0.4 + 0.5 * pulse})`
            : `rgba(52, 211, 153, ${0.4 + 0.5 * pulse})`;
          ctx.beginPath();
          ctx.arc(cx, cy, 10, 0, Math.PI * 2);
          ctx.fill();
          // Progress arc
          if (b.progress > 0) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.arc(cx, cy, 12, -Math.PI / 2, -Math.PI / 2 + b.progress * Math.PI * 2);
            ctx.stroke();
          }
          this.drawEjectPort(ctx, cx, cy, b.dir, def.accent);
        } else if (def.turret) {
          // Turret rotating gun barrel
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(b.angle);
          const kick = (b.recoil || 0) * 4;
          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(0, 0, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = def.accent;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Barrel
          ctx.fillStyle = def.accent;
          if (b.id === 'gatling') {
            ctx.fillRect(4 - kick, -5, 15, 3);
            ctx.fillRect(4 - kick, 2, 15, 3);
          } else if (b.id === 'railgun') {
            ctx.fillRect(2 - kick, -4, 20, 8);
          } else if (b.id === 'mortar') {
            ctx.fillRect(0 - kick, -6, 14, 12);
          } else {
            // Arc coil
            ctx.beginPath();
            ctx.arc(0, 0, 6 + Math.sin(sim.time * 8) * 1.5, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          // Low-ammo warning pip
          if (b.ammo < def.turret.ammoPerShot) {
            ctx.fillStyle = '#ef4444';
            ctx.font = '700 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('NO AMMO', cx, py + 11);
          }
        } else if (b.id === 'spire') {
          const pulse = 0.6 + 0.4 * Math.sin(sim.time * 5);
          ctx.fillStyle = `rgba(192, 132, 252, ${pulse})`;
          ctx.beginPath();
          ctx.arc(cx, cy, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = '700 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${sim.stats.spireProgress}%`, cx, cy + 3);
        }

        // Health bar if damaged
        if (b.hp < b.maxHp) {
          const w = T - 8;
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillRect(px + 4, py + T - 7, w, 4);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(px + 4, py + T - 7, w * Math.max(0, b.hp / b.maxHp), 4);
        }
      }
    }
  }

  drawEjectPort(ctx, cx, cy, dir, color) {
    const d = DIRS[dir];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cx + d.dx * (TILE_SIZE * 0.36), cy + d.dy * (TILE_SIZE * 0.36), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawReactorCore(ctx, sim) {
    const T = TILE_SIZE;
    const px = CORE_X * T;
    const py = CORE_Y * T;
    const size = T * 2;
    const cx = px + T;
    const cy = py + T;

    // Outer ambient thermal halo
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, T * 2.2);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.32)');
    grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.14)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, T * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Armored 2x2 Reactor Pad
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(px + 2, py + 2, size - 4, size - 4);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);

    // Spinning turbine rings
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sim.time * 1.2);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(-22, -22, 44, 44);
    ctx.rotate(-sim.time * 2.4);
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, 15 + Math.sin(sim.time * 6) * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CORE', cx, cy + 3);
  }

  drawEnemies(ctx, sim) {
    const T = TILE_SIZE;
    for (const e of sim.enemies) {
      const ex = e.x * T, ey = e.y * T;
      const r = e.radius * T;

      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(e.angle);

      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = e.glow;
      ctx.lineWidth = e.boss ? 3 : 1.5;
      ctx.stroke();

      // Mandibles
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(r * 0.3, -r * 0.45, r * 0.65, r * 0.28);
      ctx.fillRect(r * 0.3, r * 0.17, r * 0.65, r * 0.28);
      ctx.restore();

      if (e.hp < e.maxHp || e.boss) {
        const bw = r * 2.2;
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(ex - bw / 2, ey - r - 8, bw, 4);
        ctx.fillStyle = e.boss ? '#ec4899' : '#ef4444';
        ctx.fillRect(ex - bw / 2, ey - r - 8, bw * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
  }

  drawProjectilesAndBeams(ctx, sim) {
    const T = TILE_SIZE;
    for (const p of sim.projectiles) {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x * T, p.y * T, p.splash > 0 ? 5.5 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const b of sim.beams) {
      const alpha = Math.max(0, b.life / b.maxLife);
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = b.width;
      ctx.beginPath();
      b.points.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x * T, y * T);
        else ctx.lineTo(x * T, y * T);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    for (const pt of sim.particles) {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillRect(pt.x * T - pt.size / 2, pt.y * T - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  drawBuildGhost(ctx, sim, uiState) {
    const { tx, ty } = this.hoverTile;
    if (!sim.inBounds(tx, ty)) return;
    const T = TILE_SIZE;
    const px = tx * T, py = ty * T;

    const selId = uiState.selectedBuilding;
    if (!selId) {
      // Hover cursor outline
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 1, py + 1, T - 2, T - 2);
      return;
    }

    const def = BUILDING_BY_ID[selId];
    const check = sim.canPlace(selId, tx, ty);
    ctx.fillStyle = check.ok ? 'rgba(52, 211, 153, 0.25)' : 'rgba(239, 68, 68, 0.28)';
    ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
    ctx.strokeStyle = check.ok ? '#34d399' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, T - 4, T - 4);

    if (def.rotatable) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(DIRS[uiState.buildDir & 3].arrow, px + T / 2, py + T / 2 + 6);
    }

    if (def.turret) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px + T / 2, py + T / 2, def.turret.range * T, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  drawFloatTexts(ctx, sim) {
    const T = TILE_SIZE;
    ctx.font = '700 12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    for (const ft of sim.floatTexts) {
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x * T, ft.y * T);
    }
    ctx.globalAlpha = 1;
  }

  renderMinimap(sim) {
    const mctx = this.miniCtx;
    const W = this.miniCanvas.width;
    const H = this.miniCanvas.height;
    const sx = W / GRID_W;
    const sy = H / GRID_H;

    mctx.fillStyle = '#090c12';
    mctx.fillRect(0, 0, W, H);

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const ter = sim.terrain[y][x];
        const b = sim.buildings[y][x];
        if (b) {
          mctx.fillStyle = BUILDING_BY_ID[b.id].accent;
          mctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
        } else if (ter !== TERRAIN.FLOOR) {
          mctx.fillStyle = ter === TERRAIN.IRON_VEIN ? '#60a5fa'
            : ter === TERRAIN.COPPER_VEIN ? '#f97316'
            : ter === TERRAIN.COAL_SEAM ? '#64748b'
            : ter === TERRAIN.AETHER_VENT ? '#2dd4bf' : '#1e293b';
          mctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
        }
      }
    }

    // Core
    mctx.fillStyle = '#38bdf8';
    mctx.fillRect(CORE_X * sx, CORE_Y * sy, sx * 2, sy * 2);

    // Enemies
    mctx.fillStyle = '#ef4444';
    for (const e of sim.enemies) {
      mctx.fillRect(e.x * sx - 1.5, e.y * sy - 1.5, 3, 3);
    }

    // Camera viewport box
    const halfW = (this.viewW / 2) / this.zoom / TILE_SIZE;
    const halfH = (this.viewH / 2) / this.zoom / TILE_SIZE;
    const cx = this.camX / TILE_SIZE;
    const cy = this.camY / TILE_SIZE;
    mctx.strokeStyle = 'rgba(255,255,255,0.65)';
    mctx.lineWidth = 1;
    mctx.strokeRect((cx - halfW) * sx, (cy - halfH) * sy, halfW * 2 * sx, halfH * 2 * sy);
  }
}
