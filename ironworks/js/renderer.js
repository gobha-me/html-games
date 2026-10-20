// ============================================================================
// IRONWORKS // CORE — 60fps Spatial Canvas2D + Lighting & Minimap Renderer
// ============================================================================

import {
  GRID_W, GRID_H, TILE_SIZE, CORE_X, CORE_Y, DIRS, TERRAIN,
  RESOURCES, RECIPES, BUILDING_BY_ID
} from './config.js';

export class IronworksRenderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.miniCanvas = minimapCanvas;
    this.miniCtx = minimapCanvas.getContext('2d');

    this.camX = (CORE_X + 1) * TILE_SIZE;
    this.camY = (CORE_Y + 1) * TILE_SIZE;
    this.zoom = 1.08;
    this.hoverTile = { tx: -1, ty: -1 };
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

    // 1. Deep foundry abyss slate
    ctx.fillStyle = '#090c12';
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

    // 2. Terrain & Crystalline Resource Veins
    this.drawTerrain(ctx, sim, x0, y0, x1, y1);

    // 3. Conveyor Belts & Splitters
    this.drawBelts(ctx, sim, x0, y0, x1, y1);

    // 4. Physical Resource Packets riding on Belts
    this.drawBeltItems(ctx, sim, x0, y0, x1, y1);

    // 5. Production Machines, Connected Walls, Turrets & Orbital Spire
    this.drawStructures(ctx, sim, x0, y0, x1, y1, uiState);

    // 6. Central 2x2 Reactor Core
    this.drawReactorCore(ctx, sim);

    // 7. Articulated Siege Crawlers
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
        const h = ((x * 374761393 + y * 668265263) ^ 0x5bf03635) >>> 0;

        // Industrial steel deck plate
        ctx.fillStyle = ((x + y) & 1) ? '#111620' : '#131924';
        ctx.fillRect(px, py, T, T);

        // Subtle recessed plate seam
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.05)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);

        // Corner bolts on every 4th tile for foundry floor texture
        if ((h & 7) === 0 && ter === TERRAIN.FLOOR) {
          ctx.fillStyle = 'rgba(148, 163, 184, 0.08)';
          ctx.fillRect(px + 3, py + 3, 2, 2);
          ctx.fillRect(px + T - 5, py + 3, 2, 2);
          ctx.fillRect(px + 3, py + T - 5, 2, 2);
          ctx.fillRect(px + T - 5, py + T - 5, 2, 2);
        }

        // 8x8 sector divider lines
        if (x % 8 === 0) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.045)';
          ctx.fillRect(px, py, 1, T);
        }
        if (y % 8 === 0) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.045)';
          ctx.fillRect(px, py, T, 1);
        }

        if (ter === TERRAIN.BASALT) {
          // Layered volcanic basalt crag
          ctx.fillStyle = '#1e2430';
          ctx.beginPath();
          ctx.roundRect(px + 2, py + 2, T - 4, T - 4, 6);
          ctx.fill();

          ctx.fillStyle = '#2b3344';
          ctx.beginPath();
          ctx.moveTo(px + 6, py + T - 6);
          ctx.lineTo(px + 10 + (h % 6), py + 9);
          ctx.lineTo(px + T - 10, py + 7 + ((h >> 3) % 6));
          ctx.lineTo(px + T - 5, py + T - 7);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#3b465c';
          ctx.beginPath();
          ctx.moveTo(px + 12, py + T - 10);
          ctx.lineTo(px + T * 0.48, py + 11);
          ctx.lineTo(px + T - 12, py + T - 11);
          ctx.closePath();
          ctx.fill();
        } else if (ter !== TERRAIN.FLOOR) {
          // Mineral vein bed + varied crystal shards
          let baseGlow, darkCol, mainCol, hiCol;
          if (ter === TERRAIN.IRON_VEIN) {
            baseGlow = 'rgba(59, 130, 246, 0.16)';
            darkCol = '#1e3a5f';
            mainCol = '#60a5fa';
            hiCol = '#bfdbfe';
          } else if (ter === TERRAIN.COPPER_VEIN) {
            baseGlow = 'rgba(249, 115, 22, 0.16)';
            darkCol = '#5c2810';
            mainCol = '#f97316';
            hiCol = '#fed7aa';
          } else if (ter === TERRAIN.COAL_SEAM) {
            baseGlow = 'rgba(100, 116, 139, 0.15)';
            darkCol = '#1e2530';
            mainCol = '#475569';
            hiCol = '#94a3b8';
          } else {
            // AETHER_VENT
            const pulse = 0.16 + 0.1 * Math.sin(sim.time * 4 + x + y);
            baseGlow = `rgba(45, 212, 191, ${pulse})`;
            darkCol = '#114e48';
            mainCol = '#2dd4bf';
            hiCol = '#ccfbf1';
          }

          // Crater bed
          ctx.fillStyle = baseGlow;
          ctx.beginPath();
          ctx.roundRect(px + 3, py + 3, T - 6, T - 6, 7);
          ctx.fill();

          ctx.fillStyle = darkCol;
          ctx.beginPath();
          ctx.arc(px + T * 0.5, py + T * 0.5, T * 0.34, 0, Math.PI * 2);
          ctx.fill();

          // 4 procedural crystal/mineral clusters per tile with distinct angles & sizes
          for (let i = 0; i < 4; i++) {
            const sub = (h >>> (i * 6)) & 63;
            const ang = (i * Math.PI * 0.5) + ((sub & 7) - 3.5) * 0.18;
            const dist = 5 + (sub % 7);
            const cx = px + T * 0.5 + Math.cos(ang) * dist;
            const cy = py + T * 0.5 + Math.sin(ang) * dist;
            const rad = 4.2 + ((sub >> 3) % 4) * 0.9;

            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(ang + 0.4);

            // Main crystal facet
            ctx.fillStyle = mainCol;
            ctx.beginPath();
            ctx.moveTo(0, -rad * 1.25);
            ctx.lineTo(rad * 0.95, 0);
            ctx.lineTo(0, rad * 1.1);
            ctx.lineTo(-rad * 0.95, 0);
            ctx.closePath();
            ctx.fill();

            // Specular highlight facet
            ctx.fillStyle = hiCol;
            ctx.beginPath();
            ctx.moveTo(0, -rad * 1.25);
            ctx.lineTo(rad * 0.55, -rad * 0.1);
            ctx.lineTo(0, rad * 0.35);
            ctx.lineTo(-rad * 0.45, -rad * 0.15);
            ctx.closePath();
            ctx.fill();

            ctx.restore();
          }
        }
      }
    }
  }

  drawBelts(ctx, sim, x0, y0, x1, y1) {
    const T = TILE_SIZE;
    const rollerPhase = (sim.time * 32) % 11;

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const b = sim.buildings[y][x];
        if (!b || (b.id !== 'belt' && b.id !== 'splitter')) continue;

        const cx = (x + 0.5) * T;
        const cy = (y + 0.5) * T;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(DIRS[b.dir].angle);

        const isSplitter = b.id === 'splitter';

        // Outer metallic side rails
        ctx.fillStyle = isSplitter ? '#0f172a' : '#1e2636';
        ctx.fillRect(-T * 0.48, -T * 0.36, T * 0.96, T * 0.72);

        // Recessed rubber conveyor bed
        ctx.fillStyle = '#0d121a';
        ctx.fillRect(-T * 0.48, -T * 0.26, T * 0.96, T * 0.52);

        // Top & bottom structural guide rails
        ctx.fillStyle = isSplitter ? '#38bdf8' : '#64748b';
        ctx.fillRect(-T * 0.48, -T * 0.36, T * 0.96, 3.5);
        ctx.fillRect(-T * 0.48, T * 0.36 - 3.5, T * 0.96, 3.5);

        // Animated steel rollers & directional chevrons
        for (let i = -2; i <= 2; i++) {
          const ox = i * 11 + (rollerPhase - 5.5);
          if (ox < -T * 0.42 || ox > T * 0.42) continue;

          // Roller bar
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(ox, -T * 0.23);
          ctx.lineTo(ox, T * 0.23);
          ctx.stroke();

          // Directional chevron
          ctx.strokeStyle = isSplitter ? '#38bdf8' : '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ox - 3.5, -6);
          ctx.lineTo(ox + 3, 0);
          ctx.lineTo(ox - 3.5, 6);
          ctx.stroke();
        }

        if (isSplitter) {
          // Splitter housing bridge + left/right diverter chutes
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.5;
          ctx.fillRect(-9, -T * 0.44, 18, T * 0.88);
          ctx.strokeRect(-9, -T * 0.44, 18, T * 0.88);

          // Diverter status LEDs
          const activeMod = b.splitIdx % 3;
          ctx.fillStyle = activeMod === 0 ? '#38f2d7' : '#334155';
          ctx.fillRect(3, -2, 4, 4);
          ctx.fillStyle = activeMod === 1 ? '#38f2d7' : '#334155';
          ctx.fillRect(-2, -T * 0.38, 4, 4);
          ctx.fillStyle = activeMod === 2 ? '#38f2d7' : '#334155';
          ctx.fillRect(-2, T * 0.38 - 4, 4, 4);
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
        const type = b.item.type;
        const res = RESOURCES[type];
        if (!res) continue;

        const d = DIRS[b.dir];
        const prog = b.item.progress - 0.5;
        const ix = (x + 0.5 + d.dx * prog * 0.78) * T;
        const iy = (y + 0.5 + d.dy * prog * 0.78) * T;

        ctx.save();
        ctx.translate(ix, iy);

        // Ambient glow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.beginPath();
        ctx.arc(0, 1.5, 6.5, 0, Math.PI * 2);
        ctx.fill();

        if (type === 'iron' || type === 'copper' || type === 'steel') {
          // Refined metallic ingot bar
          ctx.fillStyle = res.color;
          ctx.strokeStyle = res.glow;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.roundRect(-6, -4, 12, 8, 2);
          ctx.fill();
          ctx.stroke();
        } else if (type === 'circuit') {
          // Green logic microchip with gold pins
          ctx.fillStyle = '#065f46';
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.2;
          ctx.fillRect(-5, -5, 10, 10);
          ctx.strokeRect(-5, -5, 10, 10);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(-2, -2, 4, 4);
        } else if (type === 'ammo' || type === 'shell') {
          // Ordnance cartridge / warhead
          ctx.fillStyle = res.color;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(-4.5, -5.5, 9, 11, 2.5);
          ctx.fill();
          ctx.stroke();
        } else if (type === 'cell' || type === 'aether') {
          // Glowing energy diamond
          ctx.fillStyle = res.glow;
          ctx.beginPath();
          ctx.moveTo(0, -6.5);
          ctx.lineTo(6.5, 0);
          ctx.lineTo(0, 6.5);
          ctx.lineTo(-6.5, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          // Raw ore chunk
          ctx.fillStyle = res.glow;
          ctx.beginPath();
          ctx.arc(0, 0, 5.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = res.color;
          ctx.beginPath();
          ctx.arc(-0.5, -0.5, 4.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }
  }

  drawStructures(ctx, sim, x0, y0, x1, y1, uiState) {
    const T = TILE_SIZE;
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const b = sim.buildings[y][x];
        if (!b || b.id === 'belt' || b.id === 'splitter') continue;

        const def = BUILDING_BY_ID[b.id];
        const px = x * T, py = y * T;
        const cx = px + T / 2, cy = py + T / 2;

        // Highlight if currently inspected
        if (uiState?.inspectTile && uiState.inspectTile.x === x && uiState.inspectTile.y === y) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(px + 1, py + 1, T - 2, T - 2);
        }

        if (b.id === 'wall') {
          // Connected Ferrocrete Bulkhead Wall
          ctx.fillStyle = '#293242';
          ctx.fillRect(px + 4, py + 4, T - 8, T - 8);

          // Draw neighbor connectors
          ctx.fillStyle = '#3f4b5e';
          if (sim.buildings[y - 1]?.[x]?.id === 'wall') ctx.fillRect(px + 10, py, T - 20, 8);
          if (sim.buildings[y + 1]?.[x]?.id === 'wall') ctx.fillRect(px + 10, py + T - 8, T - 20, 8);
          if (sim.buildings[y]?.[x - 1]?.id === 'wall') ctx.fillRect(px, py + 10, 8, T - 20);
          if (sim.buildings[y]?.[x + 1]?.id === 'wall') ctx.fillRect(px + T - 8, py + 10, 8, T - 20);

          // Octagonal armor cap
          ctx.fillStyle = '#475569';
          ctx.strokeStyle = '#94a3b8';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.roundRect(px + 5, py + 5, T - 10, T - 10, 5);
          ctx.fill();
          ctx.stroke();

          // Cross-bracing
          ctx.strokeStyle = '#1e293b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px + 9, py + 9); ctx.lineTo(px + T - 9, py + T - 9);
          ctx.moveTo(px + T - 9, py + 9); ctx.lineTo(px + 9, py + T - 9);
          ctx.stroke();

          // Center rivet boss
          ctx.fillStyle = '#cbd5e1';
          ctx.beginPath();
          ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (b.id === 'drill') {
          // Excavator Drill: heavy industrial gantry + twin counter-rotating bore heads
          ctx.fillStyle = '#451a03';
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.roundRect(px + 3, py + 3, T - 6, T - 6, 5);
          ctx.fill();
          ctx.stroke();

          // Diagonal gantry struts
          ctx.strokeStyle = '#78350f';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px + 6, py + 6); ctx.lineTo(px + T - 6, py + T - 6);
          ctx.moveTo(px + T - 6, py + 6); ctx.lineTo(px + 6, py + T - 6);
          ctx.stroke();

          // Rotating tungsten bore head
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(sim.time * 5.2);
          ctx.fillStyle = '#d97706';
          ctx.fillRect(-9, -9, 18, 18);
          ctx.rotate(Math.PI / 4);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(-7, -7, 14, 14);
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          this.drawEjectPort(ctx, cx, cy, b.dir, '#fde047');
        } else if (b.id === 'smelter' || b.id === 'fabricator') {
          const isSmelter = b.id === 'smelter';
          ctx.fillStyle = isSmelter ? '#431407' : '#064e3b';
          ctx.strokeStyle = def.accent;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.roundRect(px + 3, py + 3, T - 6, T - 6, 6);
          ctx.fill();
          ctx.stroke();

          // Recessed core chamber
          ctx.fillStyle = '#090d16';
          ctx.beginPath();
          ctx.arc(cx, cy, 12.5, 0, Math.PI * 2);
          ctx.fill();

          // Glowing molten crucible or plasma fabricator ring
          const pulse = 0.6 + 0.4 * Math.sin(sim.time * 6 + x);
          ctx.fillStyle = isSmelter
            ? `rgba(251, 146, 60, ${0.45 + 0.45 * pulse})`
            : `rgba(52, 211, 153, ${0.45 + 0.45 * pulse})`;
          ctx.beginPath();
          ctx.arc(cx, cy, 9.5, 0, Math.PI * 2);
          ctx.fill();

          // Recipe output badge in center
          const rec = RECIPES[b.recipe];
          if (rec && RESOURCES[rec.output]) {
            ctx.fillStyle = RESOURCES[rec.output].glow;
            ctx.beginPath();
            ctx.arc(cx, cy, 4, 0, Math.PI * 2);
            ctx.fill();
          }

          // Radial production progress arc
          if (b.progress > 0) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.arc(cx, cy, 12.5, -Math.PI / 2, -Math.PI / 2 + b.progress * Math.PI * 2);
            ctx.stroke();
          }

          this.drawEjectPort(ctx, cx, cy, b.dir, def.accent);
        } else if (def.turret) {
          // Armored turret plinth
          ctx.fillStyle = '#161f30';
          ctx.strokeStyle = def.accent;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.roundRect(px + 3, py + 3, T - 6, T - 6, 7);
          ctx.fill();
          ctx.stroke();

          // Ammo reserve arc around turret mount
          const ammoRatio = Math.min(1, b.ammo / def.turret.maxBuffer);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(cx, cy, 14, 0, Math.PI * 2);
          ctx.stroke();

          if (ammoRatio > 0) {
            ctx.strokeStyle = def.accent;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(cx, cy, 14, -Math.PI / 2, -Math.PI / 2 + ammoRatio * Math.PI * 2);
            ctx.stroke();
          }

          // Rotating gun housing
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(b.angle);
          const kick = (b.recoil || 0) * 4.5;

          ctx.fillStyle = '#0f172a';
          ctx.beginPath();
          ctx.arc(0, 0, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = def.accent;
          ctx.lineWidth = 1.8;
          ctx.stroke();

          ctx.fillStyle = def.accent;
          if (b.id === 'gatling') {
            // Twin rotary autocannon barrels
            ctx.fillRect(3 - kick, -5.5, 16, 3.2);
            ctx.fillRect(3 - kick, 2.3, 16, 3.2);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(15 - kick, -5.5, 4, 3.2);
            ctx.fillRect(15 - kick, 2.3, 4, 3.2);
          } else if (b.id === 'railgun') {
            // Dual magnetic accelerator rails + glowing plasma core
            ctx.fillStyle = '#0d9488';
            ctx.fillRect(0 - kick, -6, 21, 3.5);
            ctx.fillRect(0 - kick, 2.5, 21, 3.5);
            ctx.fillStyle = '#5eead4';
            ctx.fillRect(2 - kick, -1.5, 18, 3);
          } else if (b.id === 'mortar') {
            // Heavy Siege Howitzer cannon barrel + recoil cradle
            ctx.fillStyle = '#9f1239';
            ctx.fillRect(-4 - kick, -7, 14, 14);
            ctx.fillStyle = '#fb7185';
            ctx.fillRect(2 - kick, -4.5, 16, 9);
          } else {
            // Arc Coil: concentric copper induction rings + lightning orb
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#bae6fd';
            ctx.beginPath();
            ctx.arc(0, 0, 3.5 + Math.sin(sim.time * 10) * 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();

          if (b.ammo < def.turret.ammoPerShot) {
            ctx.fillStyle = '#ef4444';
            ctx.font = '700 8.5px "IBM Plex Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('LOW', cx, py + 11);
          }
        } else if (b.id === 'spire') {
          // Orbital Ascension Spire
          ctx.fillStyle = '#2e1065';
          ctx.strokeStyle = '#c084fc';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(px + 2, py + 2, T - 4, T - 4, 8);
          ctx.fill();
          ctx.stroke();

          const pulse = 0.65 + 0.35 * Math.sin(sim.time * 5);
          ctx.fillStyle = `rgba(192, 132, 252, ${pulse})`;
          ctx.beginPath();
          ctx.arc(cx, cy, 13, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = '700 10px "IBM Plex Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${sim.stats.spireProgress}%`, cx, cy + 3.5);
        }

        // Health bar if damaged
        if (b.hp < b.maxHp) {
          const w = T - 8;
          ctx.fillStyle = 'rgba(0,0,0,0.8)';
          ctx.fillRect(px + 4, py + T - 7, w, 4);
          ctx.fillStyle = '#22c55e';
          ctx.fillRect(px + 4, py + T - 7, w * Math.max(0, b.hp / b.maxHp), 4);
        }
      }
    }
  }

  drawEjectPort(ctx, cx, cy, dir, color) {
    const d = DIRS[dir];
    ctx.save();
    ctx.translate(cx + d.dx * (TILE_SIZE * 0.37), cy + d.dy * (TILE_SIZE * 0.37));
    ctx.rotate(d.angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-3.5, -4.5);
    ctx.lineTo(4.5, 0);
    ctx.lineTo(-3.5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawReactorCore(ctx, sim) {
    const T = TILE_SIZE;
    const px = CORE_X * T;
    const py = CORE_Y * T;
    const size = T * 2;
    const cx = px + T;
    const cy = py + T;

    // Outer ambient thermal halo
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, T * 2.4);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    grad.addColorStop(0.5, 'rgba(245, 158, 11, 0.14)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, T * 2.4, 0, Math.PI * 2);
    ctx.fill();

    // Armored 2x2 Reactor Pad with hazard corner bevels
    ctx.fillStyle = '#131c2b';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(px + 2, py + 2, size - 4, size - 4, 10);
    ctx.fill();
    ctx.stroke();

    // Corner intake ports on all 4 sides
    ctx.fillStyle = '#f59e0b';
    for (let o = 0.25; o <= 0.75; o += 0.5) {
      ctx.fillRect(px + size * o - 5, py + 1, 10, 4);
      ctx.fillRect(px + size * o - 5, py + size - 5, 10, 4);
      ctx.fillRect(px + 1, py + size * o - 5, 4, 10);
      ctx.fillRect(px + size - 5, py + size * o - 5, 4, 10);
    }

    // Counter-rotating containment rings
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sim.time * 1.1);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.2;
    ctx.strokeRect(-23, -23, 46, 46);

    ctx.rotate(-sim.time * 2.2);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 21, 0, Math.PI * 2);
    ctx.stroke();

    // Pulsing plasma heart
    const rPulse = 14 + Math.sin(sim.time * 6) * 2;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(0, 0, rPulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(0, 0, rPulse * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#090d16';
    ctx.font = '700 10px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CORE', cx, cy + 3.5);
  }

  drawEnemies(ctx, sim) {
    const T = TILE_SIZE;
    for (const e of sim.enemies) {
      const ex = e.x * T, ey = e.y * T;
      const r = e.radius * T;

      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(e.angle);

      // Articulated crawler legs (3 pairs)
      const stride = Math.sin(sim.time * 16 + e.x * 3 + e.y * 3) * 0.28;
      ctx.strokeStyle = e.hitFlash > 0 ? '#ffffff' : e.glow;
      ctx.lineWidth = e.boss ? 2.6 : 1.6;
      for (let i = -1; i <= 1; i++) {
        const legAng = i * 0.55 + (i % 2 === 0 ? stride : -stride);
        ctx.beginPath();
        ctx.moveTo(i * r * 0.25, -r * 0.7);
        ctx.lineTo(Math.sin(legAng) * r * 0.9, -r * 1.35);
        ctx.moveTo(i * r * 0.25, r * 0.7);
        ctx.lineTo(Math.sin(-legAng) * r * 0.9, r * 1.35);
        ctx.stroke();
      }

      // Segmented carapace body
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.12, r * 0.88, 0, 0, Math.PI * 2);
      ctx.fill();

      // Inner dorsal armor plate
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(-r * 0.12, 0, r * 0.62, r * 0.48, 0, 0, Math.PI * 2);
      ctx.fill();

      if (e.hitFlash > 0) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.12, r * 0.88, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = e.glow;
      ctx.lineWidth = e.boss ? 3 : 1.6;
      ctx.stroke();

      // Pincer mandibles & glowing eyes
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(r * 0.4, -r * 0.48, r * 0.7, r * 0.26);
      ctx.fillRect(r * 0.4, r * 0.22, r * 0.7, r * 0.26);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(r * 0.45, -r * 0.32, 2.5, 2.5);
      ctx.fillRect(r * 0.45, r * 0.12, 2.5, 2.5);
      ctx.restore();

      if (e.hp < e.maxHp || e.boss) {
        const bw = r * 2.3;
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(ex - bw / 2, ey - r - 9, bw, 4);
        ctx.fillStyle = e.boss ? '#ec4899' : '#ef4444';
        ctx.fillRect(ex - bw / 2, ey - r - 9, bw * Math.max(0, e.hp / e.maxHp), 4);
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
      ctx.strokeStyle = 'rgba(255,255,255,0.28)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px + 1, py + 1, T - 2, T - 2);
      return;
    }

    const def = BUILDING_BY_ID[selId];
    const check = sim.canPlace(selId, tx, ty);
    ctx.fillStyle = check.ok ? 'rgba(52, 211, 153, 0.24)' : 'rgba(239, 68, 68, 0.28)';
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
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.32)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(px + T / 2, py + T / 2, def.turret.range * T, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
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
