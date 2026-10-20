// ============================================================================
// IRONWORKS // CORE — Simulation Engine
// Spatial terrain generation, conveyor packet transport, machine recipes,
// BFS flow-field enemy pathfinding, turret ballistics, and Core Overdrive.
// ============================================================================

import {
  GRID_W, GRID_H, CORE_X, CORE_Y, DIRS, TERRAIN,
  RESOURCES, INITIAL_STOCK, RECIPES, BUILDING_BY_ID, ENEMY_TYPES, WAVES
} from './config.js';
import { audio } from './audio.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class IronworksSim {
  constructor(seed = 19182099) {
    this.reset(seed);
  }

  reset(seed = (Date.now() & 0xffffff)) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.time = 0;
    this.paused = false;
    this.over = false;
    this.won = false;

    this.coreHp = 1200;
    this.coreMaxHp = 1200;
    this.overdriveCooldown = 0;
    this.overdriveMaxCooldown = 28;
    this.autoFeedTurrets = true; // Allow turrets to pull ammo from Core stock if not belt-fed

    this.stock = { ...INITIAL_STOCK };
    for (const k of Object.keys(RESOURCES)) {
      if (this.stock[k] == null) this.stock[k] = 0;
    }

    // 2D arrays [y][x]
    this.terrain = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(TERRAIN.FLOOR));
    this.buildings = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(null));
    this.flowField = Array.from({ length: GRID_H }, () => Array(GRID_W).fill(9999));

    this.enemies = [];
    this.projectiles = [];
    this.beams = [];
    this.particles = [];
    this.floatTexts = [];

    this.waveIndex = 0; // 0-based into WAVES
    this.waveActive = false;
    this.waveTimer = WAVES[0].prepTime;
    this.spawnQueue = [];
    this.spawnCooldown = 0;

    this.stats = {
      mined: 0,
      smelted: 0,
      kills: 0,
      builtCount: 0,
      turretsBuilt: 0,
      drillsBuilt: 0,
      wavesCleared: 0,
      spireProgress: 0,
      spireGoal: 100,
    };

    this.generateWorld();
    this.starterFactory();
    this.rebuildFlowField();
  }

  isCoreTile(x, y) {
    return x >= CORE_X && x <= CORE_X + 1 && y >= CORE_Y && y <= CORE_Y + 1;
  }

  inBounds(x, y) {
    return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
  }

  generateWorld() {
    const cx = CORE_X + 0.5;
    const cy = CORE_Y + 0.5;

    const placeCluster = (tx, ty, type, radius) => {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const x = Math.round(tx + dx);
          const y = Math.round(ty + dy);
          if (!this.inBounds(x, y)) continue;
          if (Math.hypot(x - cx, y - cy) < 4.5) continue;
          if (Math.hypot(dx, dy) <= radius * (0.65 + this.rng() * 0.45)) {
            this.terrain[y][x] = type;
          }
        }
      }
    };

    // Guaranteed inner resource veins near the Reactor Core so the player can build immediately
    placeCluster(CORE_X - 5, CORE_Y, TERRAIN.IRON_VEIN, 2.2);
    placeCluster(CORE_X + 6, CORE_Y + 1, TERRAIN.COPPER_VEIN, 2.1);
    placeCluster(CORE_X, CORE_Y - 5, TERRAIN.IRON_VEIN, 2.0);
    placeCluster(CORE_X + 1, CORE_Y + 6, TERRAIN.COAL_SEAM, 2.1);

    // Mid-ring and outer veins
    const rings = [
      { dist: 10, count: 7, types: [TERRAIN.IRON_VEIN, TERRAIN.COPPER_VEIN, TERRAIN.COAL_SEAM] },
      { dist: 16, count: 10, types: [TERRAIN.IRON_VEIN, TERRAIN.COPPER_VEIN, TERRAIN.COAL_SEAM, TERRAIN.AETHER_VENT] },
      { dist: 20, count: 8, types: [TERRAIN.BASALT, TERRAIN.AETHER_VENT, TERRAIN.IRON_VEIN] },
    ];

    for (const ring of rings) {
      for (let i = 0; i < ring.count; i++) {
        const ang = (i / ring.count) * Math.PI * 2 + (this.rng() - 0.5) * 0.35;
        const r = ring.dist + (this.rng() - 0.5) * 2.5;
        const tx = cx + Math.cos(ang) * r;
        const ty = cy + Math.sin(ang) * r;
        const t = ring.types[i % ring.types.length];
        placeCluster(tx, ty, t, t === TERRAIN.BASALT ? 1.8 : 2.2);
      }
    }

    // Ensure guaranteed starter coordinates are exact
    this.terrain[CORE_Y][CORE_X - 4] = TERRAIN.IRON_VEIN;
    this.terrain[CORE_Y + 1][CORE_X - 4] = TERRAIN.IRON_VEIN;
    this.terrain[CORE_Y][CORE_X + 5] = TERRAIN.COPPER_VEIN;
    this.terrain[CORE_Y + 1][CORE_X + 5] = TERRAIN.COPPER_VEIN;
  }

  // Pre-build a working West Iron Smelting line + East Copper Extraction line + defensive bastions
  // so the player immediately sees physical items riding belts into the Reactor Core!
  starterFactory() {
    const y = CORE_Y;
    // West line: Drill -> Arc Smelter -> Belt -> Belt -> Core
    this.buildings[y][CORE_X - 4] = this.makeBuilding('drill', CORE_X - 4, y, 1);
    this.buildings[y][CORE_X - 4].progress = 0.55;
    this.buildings[y][CORE_X - 3] = this.makeBuilding('smelter', CORE_X - 3, y, 1);
    this.buildings[y][CORE_X - 3].recipe = 'smelt_iron';
    this.buildings[y][CORE_X - 3].inBuf.iron_ore = 1;
    this.buildings[y][CORE_X - 3].progress = 0.62;
    this.buildings[y][CORE_X - 2] = this.makeBuilding('belt', CORE_X - 2, y, 1);
    this.buildings[y][CORE_X - 2].item = { type: 'iron', progress: 0.35 };
    this.buildings[y][CORE_X - 1] = this.makeBuilding('belt', CORE_X - 1, y, 1);
    this.buildings[y][CORE_X - 1].item = { type: 'iron', progress: 0.78 };

    // East line: Copper Drill -> Belts -> Core
    this.buildings[y + 1][CORE_X + 5] = this.makeBuilding('drill', CORE_X + 5, y + 1, 3);
    this.buildings[y + 1][CORE_X + 5].progress = 0.4;
    this.buildings[y + 1][CORE_X + 4] = this.makeBuilding('belt', CORE_X + 4, y + 1, 3);
    this.buildings[y + 1][CORE_X + 4].item = { type: 'copper_ore', progress: 0.25 };
    this.buildings[y + 1][CORE_X + 3] = this.makeBuilding('belt', CORE_X + 3, y + 1, 3);
    this.buildings[y + 1][CORE_X + 3].item = { type: 'copper_ore', progress: 0.65 };
    this.buildings[y + 1][CORE_X + 2] = this.makeBuilding('belt', CORE_X + 2, y + 1, 3);
    this.buildings[y + 1][CORE_X + 2].item = { type: 'copper_ore', progress: 0.9 };

    // Two starter Vulcan Gatlings + corner Ferrocrete Bulkhead bastions
    this.buildings[CORE_Y - 2][CORE_X - 2] = this.makeBuilding('gatling', CORE_X - 2, CORE_Y - 2, 0);
    this.buildings[CORE_Y - 3][CORE_X - 2] = this.makeBuilding('wall', CORE_X - 2, CORE_Y - 3, 0);
    this.buildings[CORE_Y - 3][CORE_X - 1] = this.makeBuilding('wall', CORE_X - 1, CORE_Y - 3, 0);

    this.buildings[CORE_Y + 3][CORE_X + 3] = this.makeBuilding('gatling', CORE_X + 3, CORE_Y + 3, 2);
    this.buildings[CORE_Y + 4][CORE_X + 3] = this.makeBuilding('wall', CORE_X + 3, CORE_Y + 4, 0);
    this.buildings[CORE_Y + 4][CORE_X + 2] = this.makeBuilding('wall', CORE_X + 2, CORE_Y + 4, 0);
    this.recountBuildings();
  }

  makeBuilding(id, x, y, dir = 1) {
    const def = BUILDING_BY_ID[id];
    return {
      id: def.id,
      x,
      y,
      dir: dir & 3,
      hp: def.hp,
      maxHp: def.hp,
      item: null,         // For belts/splitters: { type, progress: 0..1 }
      inBuf: {},          // For smelters/fabricators: { resourceId: count }
      outItem: null,      // Ready output item waiting to eject
      progress: 0,
      recipe: def.defaultRecipe || null,
      autoRecipe: id === 'smelter',
      splitIdx: 0,
      ammo: def.turret ? def.turret.maxBuffer * 0.5 : 0,
      cooldown: 0,
      angle: DIRS[dir & 3].angle,
      recoil: 0,
    };
  }

  canAfford(cost) {
    for (const [k, v] of Object.entries(cost)) {
      if ((this.stock[k] || 0) < v) return false;
    }
    return true;
  }

  payCost(cost) {
    for (const [k, v] of Object.entries(cost)) {
      this.stock[k] = Math.max(0, (this.stock[k] || 0) - v);
    }
  }

  refundCost(cost, ratio = 0.75) {
    for (const [k, v] of Object.entries(cost)) {
      this.stock[k] = (this.stock[k] || 0) + Math.ceil(v * ratio);
    }
  }

  canPlace(id, x, y) {
    if (!this.inBounds(x, y) || this.isCoreTile(x, y)) return { ok: false, reason: 'Cannot build on Reactor Core' };
    const t = this.terrain[y][x];
    if (t === TERRAIN.BASALT) return { ok: false, reason: 'Blocked by basalt crag' };
    const existing = this.buildings[y][x];
    if (existing && existing.id === id) return { ok: false, reason: 'Already placed' };
    if (id === 'drill') {
      if (t !== TERRAIN.IRON_VEIN && t !== TERRAIN.COPPER_VEIN && t !== TERRAIN.COAL_SEAM && t !== TERRAIN.AETHER_VENT) {
        return { ok: false, reason: 'Excavator Drill must be placed on an Ore, Coal, or Aether vein' };
      }
    }
    const def = BUILDING_BY_ID[id];
    if (!this.canAfford(def.cost)) return { ok: false, reason: 'Insufficient materials in Core stock' };
    return { ok: true };
  }

  placeBuilding(id, x, y, dir = 1) {
    if (!this.inBounds(x, y) || this.isCoreTile(x, y)) return false;
    const existing = this.buildings[y][x];
    // Allow rotating an existing rotatable building by placing same id with new dir
    if (existing && existing.id === id && BUILDING_BY_ID[id].rotatable && existing.dir !== (dir & 3)) {
      existing.dir = dir & 3;
      audio.rotate();
      return true;
    }
    const check = this.canPlace(id, x, y);
    if (!check.ok) return false;
    if (existing) {
      this.refundCost(BUILDING_BY_ID[existing.id].cost, 0.75);
    }
    const def = BUILDING_BY_ID[id];
    this.payCost(def.cost);
    this.buildings[y][x] = this.makeBuilding(id, x, y, dir);
    this.recountBuildings();
    if (!def.walkable) this.rebuildFlowField();
    audio.place(id === 'belt' || id === 'splitter');
    this.spawnBurst((x + 0.5), (y + 0.5), def.accent, 6);
    return true;
  }

  removeBuilding(x, y) {
    if (!this.inBounds(x, y)) return false;
    const b = this.buildings[y][x];
    if (!b) return false;
    const def = BUILDING_BY_ID[b.id];
    this.refundCost(def.cost, 0.75);
    this.buildings[y][x] = null;
    this.recountBuildings();
    if (!def.walkable) this.rebuildFlowField();
    audio.deconstruct();
    this.spawnBurst(x + 0.5, y + 0.5, '#94a3b8', 8);
    return true;
  }

  recountBuildings() {
    let total = 0, turrets = 0, drills = 0;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const b = this.buildings[y][x];
        if (!b) continue;
        total++;
        if (BUILDING_BY_ID[b.id].turret) turrets++;
        if (b.id === 'drill') drills++;
      }
    }
    this.stats.builtCount = total;
    this.stats.turretsBuilt = turrets;
    this.stats.drillsBuilt = drills;
  }

  // Hand-mining when clicking an exposed resource vein without a building selected
  handMine(x, y) {
    if (!this.inBounds(x, y)) return false;
    const t = this.terrain[y][x];
    let gained = null;
    if (t === TERRAIN.IRON_VEIN) { this.stock.iron += 2; gained = '+2 Iron'; }
    else if (t === TERRAIN.COPPER_VEIN) { this.stock.copper += 2; gained = '+2 Copper'; }
    else if (t === TERRAIN.COAL_SEAM) { this.stock.coal += 2; gained = '+2 Coal'; }
    else if (t === TERRAIN.AETHER_VENT) { this.stock.aether += 1; gained = '+1 Aether'; }
    if (!gained) return false;
    this.stats.mined += 2;
    audio.mine();
    this.spawnBurst(x + 0.5, y + 0.5, '#fbbf24', 7);
    this.addFloatText(x + 0.5, y + 0.2, gained, '#fde047');
    return true;
  }

  // Manual quick-fabrication from Core stock
  manualCraft(recipeId) {
    const r = RECIPES[recipeId];
    if (!r) return false;
    // Allow smelt_steel, fab_ammo, fab_circuit, fab_shell, fab_cell from Core stock
    if (!this.canAfford(r.inputs)) return false;
    this.payCost(r.inputs);
    this.stock[r.output] = (this.stock[r.output] || 0) + r.count;
    this.stats.smelted += r.count;
    audio.craft();
    this.addFloatText(CORE_X + 1, CORE_Y, `+${r.count} ${RESOURCES[r.output].name}`, RESOURCES[r.output].glow);
    return true;
  }

  // Trigger Core Overdrive shockwave + temporary 2x factory & turret speed
  triggerOverdrive() {
    if (this.overdriveCooldown > 0 || this.over) return false;
    this.overdriveCooldown = this.overdriveMaxCooldown;
    this.overdriveActiveTimer = 8.0;
    audio.pulse();
    const cx = CORE_X + 1;
    const cy = CORE_Y + 1;
    this.spawnBurst(cx, cy, '#38bdf8', 42, 6.5);
    this.addFloatText(cx, cy - 1, '⚡ CORE OVERDRIVE ENGAGED!', '#38bdf8');
    // Deal heavy shockwave damage to enemies within 9 tiles of Core and push them back
    for (const e of this.enemies) {
      const dist = Math.hypot(e.x - cx, e.y - cy);
      if (dist <= 9.5) {
        e.hp -= 140;
        const ang = Math.atan2(e.y - cy, e.x - cx);
        e.x += Math.cos(ang) * 1.4;
        e.y += Math.sin(ang) * 1.4;
      }
    }
    return true;
  }

  // Charge Orbital Spire directly from Core Stock if built
  chargeSpireFromStock() {
    let spire = null;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        if (this.buildings[y][x]?.id === 'spire') spire = this.buildings[y][x];
      }
    }
    if (!spire) return { ok: false, msg: 'Build an Orbital Ascension Spire [Key O] first!' };
    const batchCost = { steel: 5, circuit: 3, cell: 2 };
    if (!this.canAfford(batchCost)) {
      return { ok: false, msg: 'Need 5 Steel, 3 Circuits, and 2 Plasma Cells per +20% Spire charge.' };
    }
    this.payCost(batchCost);
    this.stats.spireProgress = Math.min(100, this.stats.spireProgress + 20);
    audio.craft();
    this.spawnBurst(spire.x + 0.5, spire.y + 0.5, '#c084fc', 24, 3.5);
    this.addFloatText(spire.x + 0.5, spire.y, `SPIRE ${this.stats.spireProgress}%`, '#c084fc');
    if (this.stats.spireProgress >= 100 && !this.won) {
      this.won = true;
      this.over = true;
      audio.victory();
    }
    return { ok: true, msg: `Spire charged to ${this.stats.spireProgress}%!` };
  }

  // BFS Flow-Field from the 2x2 Reactor Core
  rebuildFlowField() {
    const dist = this.flowField;
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) dist[y][x] = 9999;
    }
    const q = [];
    for (let y = CORE_Y; y <= CORE_Y + 1; y++) {
      for (let x = CORE_X; x <= CORE_X + 1; x++) {
        dist[y][x] = 0;
        q.push([x, y]);
      }
    }
    let head = 0;
    while (head < q.length) {
      const [x, y] = q[head++];
      const d = dist[y][x];
      for (const dir of DIRS) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (!this.inBounds(nx, ny)) continue;
        if (this.terrain[ny][nx] === TERRAIN.BASALT) continue;
        const b = this.buildings[ny][nx];
        // Non-walkable buildings add a path cost penalty so crawlers walk around walls
        // unless completely walled-in, in which case they chew through the thinnest wall
        const stepCost = (b && !BUILDING_BY_ID[b.id].walkable) ? 14 : 1;
        if (d + stepCost < dist[ny][nx]) {
          dist[ny][nx] = d + stepCost;
          q.push([nx, ny]);
        }
      }
    }
  }

  // Check if a target tile can accept a physical resource packet
  canAcceptItem(x, y, resType) {
    if (!this.inBounds(x, y)) return false;
    if (this.isCoreTile(x, y)) return true; // Core absorbs everything into global stock
    const b = this.buildings[y][x];
    if (!b) return false;
    if (b.id === 'belt' || b.id === 'splitter') {
      return b.item === null;
    }
    if (b.id === 'smelter' || b.id === 'fabricator') {
      // Check if any recipe in this machine uses resType, or auto-switch smelter
      if (b.autoRecipe && b.id === 'smelter') {
        if (resType === 'iron_ore') b.recipe = 'smelt_iron';
        else if (resType === 'copper_ore') b.recipe = 'smelt_copper';
        else if (resType === 'iron' || resType === 'coal') b.recipe = 'smelt_steel';
      }
      const rec = RECIPES[b.recipe];
      if (!rec || !rec.inputs[resType]) return false;
      return (b.inBuf[resType] || 0) < rec.inputs[resType] * 3;
    }
    const def = BUILDING_BY_ID[b.id];
    if (def.turret) {
      return def.turret.ammoType === resType && b.ammo < def.turret.maxBuffer;
    }
    if (b.id === 'spire') {
      return (resType === 'steel' || resType === 'circuit' || resType === 'cell' || resType === 'aether') && this.stats.spireProgress < 100;
    }
    return false;
  }

  deliverItem(x, y, resType) {
    if (this.isCoreTile(x, y)) {
      // Delivering raw ore directly to Core auto-refines at 1:1 so newbie belts still reward the player
      if (resType === 'iron_ore') this.stock.iron = (this.stock.iron || 0) + 1;
      else if (resType === 'copper_ore') this.stock.copper = (this.stock.copper || 0) + 1;
      else this.stock[resType] = (this.stock[resType] || 0) + 1;
      return true;
    }
    const b = this.buildings[y][x];
    if (!b) return false;
    if (b.id === 'belt' || b.id === 'splitter') {
      b.item = { type: resType, progress: 0 };
      return true;
    }
    if (b.id === 'smelter' || b.id === 'fabricator') {
      b.inBuf[resType] = (b.inBuf[resType] || 0) + 1;
      return true;
    }
    const def = BUILDING_BY_ID[b.id];
    if (def.turret && def.turret.ammoType === resType) {
      b.ammo = Math.min(def.turret.maxBuffer, b.ammo + 4);
      return true;
    }
    if (b.id === 'spire') {
      this.stats.spireProgress = Math.min(100, this.stats.spireProgress + (resType === 'aether' || resType === 'cell' ? 4 : 2));
      if (this.stats.spireProgress >= 100 && !this.won) {
        this.won = true;
        this.over = true;
        audio.victory();
      }
      return true;
    }
    return false;
  }

  step(dt) {
    if (this.paused || this.over) return;
    this.time += dt;
    if (this.overdriveCooldown > 0) this.overdriveCooldown = Math.max(0, this.overdriveCooldown - dt);
    const speedMult = (this.overdriveActiveTimer && this.overdriveActiveTimer > 0) ? 1.85 : 1.0;
    if (this.overdriveActiveTimer > 0) this.overdriveActiveTimer = Math.max(0, this.overdriveActiveTimer - dt);

    this.stepLogistics(dt * speedMult);
    this.stepTurrets(dt * speedMult);
    this.stepWaves(dt);
    this.stepEnemies(dt);
    this.stepProjectiles(dt);
    this.stepEffects(dt);
  }

  stepLogistics(dt) {
    const beltSpeed = 2.4; // tiles per second

    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const b = this.buildings[y][x];
        if (!b) continue;

        // 1. EXCAVATOR DRILL
        if (b.id === 'drill') {
          const t = this.terrain[y][x];
          const outRes = t === TERRAIN.IRON_VEIN ? 'iron_ore'
            : t === TERRAIN.COPPER_VEIN ? 'copper_ore'
            : t === TERRAIN.COAL_SEAM ? 'coal'
            : t === TERRAIN.AETHER_VENT ? 'aether' : null;
          if (!outRes) continue;
          b.progress += dt / 1.15;
          if (b.progress >= 1) {
            const d = DIRS[b.dir];
            const nx = x + d.dx, ny = y + d.dy;
            if (this.canAcceptItem(nx, ny, outRes)) {
              this.deliverItem(nx, ny, outRes);
              b.progress = 0;
              this.stats.mined++;
            } else {
              b.progress = 1;
            }
          }
        }

        // 2. SMELTER & FABRICATOR
        else if (b.id === 'smelter' || b.id === 'fabricator') {
          const rec = RECIPES[b.recipe];
          if (!rec) continue;
          // Try to eject pending output item first
          if (b.outItem) {
            const d = DIRS[b.dir];
            const nx = x + d.dx, ny = y + d.dy;
            if (this.canAcceptItem(nx, ny, b.outItem)) {
              this.deliverItem(nx, ny, b.outItem);
              b.outItem = null;
            }
            continue;
          }
          // Check if inputs are satisfied in local buffer
          let hasInputs = true;
          for (const [rk, rv] of Object.entries(rec.inputs)) {
            if ((b.inBuf[rk] || 0) < rv) { hasInputs = false; break; }
          }
          // Fabricators can also pull refined ingots/coal from Core stock if belt inputs aren't connected yet
          if (!hasInputs && b.id === 'fabricator') {
            if (this.canAfford(rec.inputs)) {
              this.payCost(rec.inputs);
              for (const [rk, rv] of Object.entries(rec.inputs)) {
                b.inBuf[rk] = (b.inBuf[rk] || 0) + rv;
              }
              hasInputs = true;
            }
          }
          if (hasInputs) {
            b.progress += dt / rec.time;
            if (b.progress >= 1) {
              for (const [rk, rv] of Object.entries(rec.inputs)) {
                b.inBuf[rk] -= rv;
              }
              b.progress = 0;
              b.outItem = rec.output;
              this.stats.smelted += rec.count;
              // Eject immediately if forward tile is free
              const d = DIRS[b.dir];
              if (this.canAcceptItem(x + d.dx, y + d.dy, b.outItem)) {
                this.deliverItem(x + d.dx, y + d.dy, b.outItem);
                b.outItem = null;
              }
            }
          }
        }

        // 3. CONVEYOR BELT & SPLITTER
        else if ((b.id === 'belt' || b.id === 'splitter') && b.item) {
          b.item.progress = Math.min(1, b.item.progress + dt * beltSpeed);
          if (b.item.progress >= 1) {
            if (b.id === 'belt') {
              const d = DIRS[b.dir];
              const nx = x + d.dx, ny = y + d.dy;
              if (this.canAcceptItem(nx, ny, b.item.type)) {
                const t = b.item.type;
                b.item = null;
                this.deliverItem(nx, ny, t);
              }
            } else {
              // Splitter tries forward (0), left (-1), right (+1) in round-robin order
              const offsets = [0, 3, 1];
              for (let k = 0; k < 3; k++) {
                const tryDir = (b.dir + offsets[(b.splitIdx + k) % 3]) & 3;
                const d = DIRS[tryDir];
                const nx = x + d.dx, ny = y + d.dy;
                if (this.canAcceptItem(nx, ny, b.item.type)) {
                  const t = b.item.type;
                  b.item = null;
                  b.splitIdx = (b.splitIdx + 1) % 3;
                  this.deliverItem(nx, ny, t);
                  break;
                }
              }
            }
          }
        }
      }
    }
  }

  stepTurrets(dt) {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const b = this.buildings[y][x];
        if (!b) continue;
        const def = BUILDING_BY_ID[b.id];
        if (!def.turret) continue;
        const t = def.turret;

        if (b.recoil > 0) b.recoil = Math.max(0, b.recoil - dt * 5);
        if (b.cooldown > 0) b.cooldown -= dt;

        // Auto-resupply from Core stock if local buffer runs low
        if (b.ammo < t.ammoPerShot && this.autoFeedTurrets && (this.stock[t.ammoType] || 0) >= 1) {
          this.stock[t.ammoType] -= 1;
          b.ammo += 2;
        }
        if (b.ammo < t.ammoPerShot || this.enemies.length === 0) continue;

        const cx = x + 0.5, cy = y + 0.5;
        let best = null, bestDist = t.range;
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - cx, e.y - cy);
          if (d <= t.range && (!t.minRange || d >= t.minRange)) {
            if (d < bestDist) {
              bestDist = d;
              best = e;
            }
          }
        }
        if (!best) continue;

        b.angle = Math.atan2(best.y - cy, best.x - cx);
        if (b.cooldown > 0) continue;

        b.cooldown = 1 / t.fireRate;
        b.ammo = Math.max(0, b.ammo - t.ammoPerShot);
        b.recoil = 1;

        if (b.id === 'tesla') {
          audio.tesla();
          this.fireArcChain(cx, cy, best, t);
        } else if (b.id === 'railgun') {
          audio.railgun();
          this.fireRailBeam(cx, cy, b.angle, t);
        } else {
          if (b.id === 'gatling') audio.gatling();
          else if (b.id === 'mortar') audio.mortar();
          this.projectiles.push({
            x: cx + Math.cos(b.angle) * 0.4,
            y: cy + Math.sin(b.angle) * 0.4,
            tx: best.x,
            ty: best.y,
            target: best,
            vx: Math.cos(b.angle) * t.projSpeed,
            vy: Math.sin(b.angle) * t.projSpeed,
            damage: t.damage,
            splash: t.splash || 0,
            color: t.color,
            fromEnemy: false,
          });
        }
      }
    }
  }

  fireArcChain(sx, sy, firstTarget, t) {
    const hitSet = new Set([firstTarget]);
    const points = [[sx, sy], [firstTarget.x, firstTarget.y]];
    this.damageEnemy(firstTarget, t.damage);
    firstTarget.slowTimer = 1.5;

    let cur = firstTarget;
    for (let i = 0; i < (t.chains || 3); i++) {
      let next = null, bestD = 3.2;
      for (const e of this.enemies) {
        if (hitSet.has(e) || e.hp <= 0) continue;
        const d = Math.hypot(e.x - cur.x, e.y - cur.y);
        if (d < bestD) { bestD = d; next = e; }
      }
      if (!next) break;
      hitSet.add(next);
      points.push([next.x, next.y]);
      this.damageEnemy(next, t.damage * 0.8);
      next.slowTimer = 1.5;
      cur = next;
    }
    this.beams.push({ points, color: t.color, life: 0.18, maxLife: 0.18, width: 2.5 });
  }

  fireRailBeam(sx, sy, angle, t) {
    const ex = sx + Math.cos(angle) * t.range;
    const ey = sy + Math.sin(angle) * t.range;
    const dx = ex - sx, dy = ey - sy;
    const lenSq = dx * dx + dy * dy;

    for (const e of this.enemies) {
      const u = Math.max(0, Math.min(1, ((e.x - sx) * dx + (e.y - sy) * dy) / lenSq));
      const px = sx + u * dx, py = sy + u * dy;
      if (Math.hypot(e.x - px, e.y - py) <= e.radius + 0.35) {
        this.damageEnemy(e, t.damage);
        this.spawnBurst(e.x, e.y, t.color, 10);
      }
    }
    this.beams.push({ points: [[sx, sy], [ex, ey]], color: t.color, life: 0.28, maxLife: 0.28, width: 4.5 });
  }

  damageEnemy(e, dmg) {
    e.hp -= dmg;
    e.hitFlash = 0.12;
  }

  stepWaves(dt) {
    if (!this.waveActive) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) {
        this.launchWave();
      }
      return;
    }

    if (this.spawnQueue.length > 0) {
      this.spawnCooldown -= dt;
      if (this.spawnCooldown <= 0) {
        const typeId = this.spawnQueue.shift();
        this.spawnEnemyOnEdge(typeId);
        this.spawnCooldown = 0.35;
      }
    } else if (this.enemies.length === 0) {
      // Wave cleared!
      this.waveActive = false;
      this.stats.wavesCleared++;
      const nextIdx = Math.min(WAVES.length - 1, this.waveIndex + 1);
      this.waveIndex++;
      this.waveTimer = WAVES[nextIdx].prepTime;
      this.addFloatText(CORE_X + 1, CORE_Y - 1, `WAVE ${this.stats.wavesCleared} CLEARED!`, '#34d399');
      // surviving all 8 waves also counts as a victory if player hasn't launched Spire yet
      if (this.stats.wavesCleared >= WAVES.length && !this.won) {
        this.won = true;
        this.over = true;
        audio.victory();
      }
    }
  }

  launchWave() {
    if (this.waveActive) return;
    const def = WAVES[Math.min(WAVES.length - 1, this.waveIndex)];
    const scale = 1 + Math.max(0, this.waveIndex - (WAVES.length - 1)) * 0.25;
    this.spawnQueue = [];
    for (const g of def.groups) {
      const cnt = Math.round(g.count * scale);
      for (let i = 0; i < cnt; i++) this.spawnQueue.push(g.type);
    }
    this.waveActive = true;
    this.spawnCooldown = 0.1;
    audio.waveStart();
  }

  spawnEnemyOnEdge(typeId) {
    const def = ENEMY_TYPES[typeId];
    const side = (this.rng() * 4) | 0;
    let x = 1, y = 1;
    if (side === 0) { x = 2 + (this.rng() * (GRID_W - 4)) | 0; y = 1; }
    else if (side === 1) { x = GRID_W - 2; y = 2 + (this.rng() * (GRID_H - 4)) | 0; }
    else if (side === 2) { x = 2 + (this.rng() * (GRID_W - 4)) | 0; y = GRID_H - 2; }
    else { x = 1; y = 2 + (this.rng() * (GRID_H - 4)) | 0; }

    this.enemies.push({
      type: typeId,
      name: def.name,
      x: x + 0.5,
      y: y + 0.5,
      hp: def.hp * (1 + this.waveIndex * 0.12),
      maxHp: def.hp * (1 + this.waveIndex * 0.12),
      speed: def.speed,
      damage: def.damage,
      range: def.range || 0,
      radius: def.radius,
      color: def.color,
      glow: def.glow,
      boss: !!def.boss,
      loot: def.loot,
      atkCooldown: 0,
      slowTimer: 0,
      hitFlash: 0,
      angle: 0,
    });
  }

  stepEnemies(dt) {
    const coreCx = CORE_X + 1;
    const coreCy = CORE_Y + 1;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hp <= 0) {
        this.stats.kills++;
        for (const [rk, rv] of Object.entries(e.loot)) {
          this.stock[rk] = (this.stock[rk] || 0) + rv;
        }
        this.spawnBurst(e.x, e.y, e.glow, e.boss ? 28 : 10, e.boss ? 4.2 : 2.2);
        this.enemies.splice(i, 1);
        continue;
      }

      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.slowTimer > 0) e.slowTimer -= dt;
      if (e.atkCooldown > 0) e.atkCooldown -= dt;

      const distToCore = Math.hypot(e.x - coreCx, e.y - coreCy);
      if (distToCore <= 1.55) {
        if (e.atkCooldown <= 0) {
          this.coreHp = Math.max(0, this.coreHp - e.damage);
          e.atkCooldown = 0.9;
          this.spawnBurst(coreCx, coreCy, '#ef4444', 8);
          if (this.coreHp <= 0 && !this.over) {
            this.over = true;
            this.won = false;
            audio.defeat();
          }
        }
        continue;
      }

      // Check if an adjacent non-walkable building is blocking the path
      const gx = Math.max(0, Math.min(GRID_W - 1, Math.floor(e.x)));
      const gy = Math.max(0, Math.min(GRID_H - 1, Math.floor(e.y)));

      let bestDir = null;
      let bestCost = 99999;
      for (const dir of DIRS) {
        const nx = gx + dir.dx;
        const ny = gy + dir.dy;
        if (!this.inBounds(nx, ny)) continue;
        if (this.terrain[ny][nx] === TERRAIN.BASALT) continue;
        const c = this.flowField[ny][nx];
        if (c < bestCost) {
          bestCost = c;
          bestDir = { nx, ny, dx: dir.dx, dy: dir.dy };
        }
      }

      if (bestDir) {
        const blocker = this.buildings[bestDir.ny][bestDir.nx];
        if (blocker && !BUILDING_BY_ID[blocker.id].walkable) {
          // Attack the blocking structure
          e.angle = Math.atan2(bestDir.dy, bestDir.dx);
          if (e.atkCooldown <= 0) {
            blocker.hp -= e.damage;
            e.atkCooldown = 0.85;
            this.spawnBurst(bestDir.nx + 0.5, bestDir.ny + 0.5, '#f97316', 5);
            if (blocker.hp <= 0) {
              this.buildings[bestDir.ny][bestDir.nx] = null;
              this.recountBuildings();
              this.rebuildFlowField();
              audio.deconstruct();
            }
          }
          continue;
        }

        const tx = bestDir.nx + 0.5;
        const ty = bestDir.ny + 0.5;
        const ang = Math.atan2(ty - e.y, tx - e.x);
        e.angle = ang;
        const spd = e.speed * (e.slowTimer > 0 ? 0.55 : 1.0);
        e.x += Math.cos(ang) * spd * dt;
        e.y += Math.sin(ang) * spd * dt;
      }
    }
  }

  stepProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (!this.inBounds(Math.floor(p.x), Math.floor(p.y))) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.splash > 0) {
        // Mortar shell detonates near target coordinate
        if (Math.hypot(p.x - p.tx, p.y - p.ty) <= 0.45) {
          this.spawnBurst(p.x, p.y, p.color, 20, 3.2);
          for (const e of this.enemies) {
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d <= p.splash) {
              this.damageEnemy(e, p.damage * (1 - (d / p.splash) * 0.4));
            }
          }
          this.projectiles.splice(i, 1);
        }
      } else {
        // Direct-hit slug
        let hit = false;
        for (const e of this.enemies) {
          if (Math.hypot(e.x - p.x, e.y - p.y) <= e.radius + 0.22) {
            this.damageEnemy(e, p.damage);
            this.spawnBurst(p.x, p.y, p.color, 5);
            hit = true;
            break;
          }
        }
        if (hit) this.projectiles.splice(i, 1);
      }
    }
  }

  stepEffects(dt) {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      ft.y -= dt * 0.9;
      ft.life -= dt;
      if (ft.life <= 0) this.floatTexts.splice(i, 1);
    }
  }

  spawnBurst(x, y, color, count = 8, speed = 2.0) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color,
        life: 0.25 + Math.random() * 0.3,
        maxLife: 0.55,
        size: 2 + Math.random() * 2.5,
      });
    }
  }

  addFloatText(x, y, text, color = '#fde047') {
    this.floatTexts.push({ x, y, text, color, life: 1.35, maxLife: 1.35 });
  }

  // Serialize to localStorage
  serialize() {
    return JSON.stringify({
      seed: this.seed,
      time: this.time,
      coreHp: this.coreHp,
      stock: this.stock,
      waveIndex: this.waveIndex,
      waveTimer: this.waveTimer,
      stats: this.stats,
      terrain: this.terrain,
      buildings: this.buildings,
    });
  }

  deserialize(json) {
    const data = JSON.parse(json);
    this.seed = data.seed || 19182099;
    this.time = data.time || 0;
    this.coreHp = data.coreHp ?? 1200;
    this.stock = { ...INITIAL_STOCK, ...(data.stock || {}) };
    this.waveIndex = data.waveIndex || 0;
    this.waveTimer = data.waveTimer || 30;
    this.waveActive = false;
    this.enemies = [];
    this.projectiles = [];
    this.stats = { ...this.stats, ...(data.stats || {}) };
    if (data.terrain) this.terrain = data.terrain;
    if (data.buildings) this.buildings = data.buildings;
    this.recountBuildings();
    this.rebuildFlowField();
  }
}
