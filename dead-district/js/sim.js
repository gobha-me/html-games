// ============================================================================
// DEAD DISTRICT // SECTOR 7 — Tactical Survival Horror Simulation Engine
// ============================================================================

import { WORLD_W, WORLD_H, WEAPONS, INFECTED_TYPES, buildDistrictMap } from './config.js';
import { audio } from './audio.js';

const HI_SCORE_KEY = 'dead_district_sector7_hi_v2';

export class DeadDistrictSim {
  constructor() {
    let savedHi = 2400;
    try {
      if (typeof localStorage !== 'undefined') {
        savedHi = Number(localStorage.getItem(HI_SCORE_KEY) || 2400);
      }
    } catch (_) {}
    this.highScore = savedHi;
    this.reset();
  }

  reset() {
    const map = buildDistrictMap();
    this.buildings = map.buildings;
    this.walls = map.walls;
    this.barricades = map.barricades;
    this.lights = map.lights;
    this.breakers = map.breakers || [];
    this._mapRev = (this._mapRev || 0) + 1;

    this.time = 0;
    this.paused = false;
    this.gameOver = false;
    this.awaitingFirstInput = true;

    this.score = 0;
    this.kills = 0;
    this.scrap = 140; // Starting Requisition Bounty ($)

    // Wave state
    this.wave = 1;
    this.waveActive = true;
    this.breatherTimer = 0;
    this.enemiesToSpawn = [];
    this.spawnTimer = 0;

    // Player Operator State (starts at Central Evacuation Plaza)
    this.player = {
      x: 800,
      y: 600,
      vx: 0,
      vy: 0,
      r: 14,
      angle: -Math.PI * 0.25,
      hp: 100,
      maxHp: 100,
      armor: 50,
      maxArmor: 100,
      speed: 205,
      dashTimer: 0,
      dashCooldown: 0,
      dashDx: 0,
      dashDy: 0,
      muzzleFlash: 0,
      flashlightOn: true,
      wideBeam: false,
      medkits: 2,
      molotovs: 2,
      flares: 3,
      turretKits: 1,
      hitFlash: 0,
    };

    // Perks
    this.perks = {
      hollowPoint: 0, // +20% weapon damage per rank
      speedLoader: 0, // +25% reload speed per rank
      xenonBeam: 0,   // +22% flashlight range & cone width per rank
    };

    // Weapon Loadout
    this.weapons = WEAPONS.map(w => ({
      ...w,
      mag: w.magSize,
      reserve: w.startReserve,
    }));
    this.currentWeaponIdx = 1; // Start with Remington 870 in hands (and M9 sidearm unlocked)
    this.fireCooldown = 0;
    this.reloadTimer = 0;

    // Entities & Effects
    this.enemies = [];
    this.bullets = [];
    this.acidProjectiles = [];
    this.hazards = []; // { x, y, r, type: 'fire' | 'acid', life, maxLife, tickTimer }
    this.flares = [];  // { x, y, r, life, maxLife } — Red Magnesium Road Flares (#33)
    this.turrets = []; // { x, y, angle, ammo, maxAmmo, fireTimer, life }
    this.pickups = []; // { x, y, type: 'med' | 'ammo' | 'scrap', life }
    this.bloodDecals = []; // { x, y, r, alpha }
    this.shells = []; // { x, y, vx, vy, angle, life, color }
    this.particles = [];
    this.floatTexts = [];
    this.sonarRipples = []; // { x, y, r, maxR, alpha, color }

    this.banner = {
      title: 'SECTOR 7 // QUARANTINE BREACH',
      sub: 'WAVE 1 INCOMING — HOLD THE CROSSROADS OR FORTIFY SAFE-ROOMS',
      timer: 4.0,
    };

    this.queueWave(1);
  }

  get currentWeapon() {
    return this.weapons[this.currentWeaponIdx];
  }

  setBanner(title, sub = '', duration = 3.0) {
    this.banner = { title, sub, timer: duration };
  }

  addFloatText(x, y, text, color = '#fde047') {
    this.floatTexts.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  }

  addScore(pts) {
    this.score += pts;
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(HI_SCORE_KEY, String(this.highScore));
        }
      } catch (_) {}
    }
  }

  queueWave(waveNum) {
    this.wave = waveNum;
    this.waveActive = true;
    this.enemiesToSpawn = [];

    const baseCount = 8 + waveNum * 5;
    for (let i = 0; i < baseCount; i++) {
      const r = ((i * 37 + waveNum * 13) % 100) / 100;
      if (waveNum >= 3 && i % 9 === 0) {
        this.enemiesToSpawn.push('brute');
      } else if (waveNum >= 2 && r < 0.16) {
        this.enemiesToSpawn.push('spitter');
      } else if (waveNum >= 2 && r >= 0.16 && r < 0.28) {
        this.enemiesToSpawn.push('screamer');
      } else if (r < 0.56) {
        this.enemiesToSpawn.push('sprinter');
      } else {
        this.enemiesToSpawn.push('walker');
      }
    }
    // Immediately spawn vanguard infected in vehicle headlight zones & dark penumbra
    const vanguards = [
      ['walker', 905, 312],    // Caught in PD-Cruiser 04 twin xenon beams (North)
      ['sprinter', 1225, 588], // Caught in SWAT Bearcat twin floodlights (East)
      ['walker', 625, 862],    // Caught in EMS Ambulance halogen beam (South)
      ['walker', 565, 518],    // Caught in Metro Taxi single amber beam (West)
      ['sprinter', 660, 655],  // Lurking in twilight penumbra (dark silhouette + glowing eyes)
      ['walker', 650, 465],    // Lurking in deep darkness (acoustic footstep ripple + faint eye glints)
    ];
    for (const [vt, vx, vy] of vanguards) {
      if (this.enemiesToSpawn.length > 0) this.enemiesToSpawn.pop();
      this.spawnEnemy(vt, vx, vy);
    }
    this.spawnTimer = 0.65;
  }

  spawnEnemy(typeId, customX = null, customY = null) {
    const def = INFECTED_TYPES[typeId] || INFECTED_TYPES.walker;
    const hpScale = 1 + (this.wave - 1) * 0.14;
    const spdScale = 1 + Math.min(0.45, (this.wave - 1) * 0.04);

    // Spawn along the 4 street entrances (North, South, East, West avenues)
    const lanes = [
      { x: 620 + Math.random() * 360, y: 24 },   // North Avenue
      { x: 620 + Math.random() * 360, y: 1176 }, // South Avenue
      { x: 24, y: 470 + Math.random() * 260 },   // West Street
      { x: 1576, y: 470 + Math.random() * 260 }, // East Street
    ];
    const lane = lanes[Math.floor(Math.random() * lanes.length)];
    const x = customX !== null ? customX : lane.x;
    const y = customY !== null ? customY : lane.y;

    this.enemies.push({
      type: def.id,
      def,
      x,
      y,
      vx: 0,
      vy: 0,
      r: def.radius,
      hp: Math.round(def.hp * hpScale),
      maxHp: Math.round(def.hp * hpScale),
      speed: def.speed * spdScale,
      angle: Math.atan2(this.player.y - y, this.player.x - x),
      attackCooldown: 0,
      spitCooldown: 1.5 + Math.random() * 1.5,
      screamCooldown: 3.2,
      frenzyTimer: 0,
      burnTimer: 0,
      hitFlash: 0,
      stepPhase: Math.random() * Math.PI * 2,
    });
  }

  selectWeapon(idx) {
    if (idx < 0 || idx >= this.weapons.length) return false;
    const w = this.weapons[idx];
    if (!w.unlocked) {
      // Allow instant unlock if player has enough Scrap!
      if (this.scrap >= w.cost) {
        this.scrap -= w.cost;
        w.unlocked = true;
        this.currentWeaponIdx = idx;
        this.reloadTimer = 0;
        audio.buy();
        this.setBanner(`${w.name} REQUISITIONED`, `${w.caliber} READY`, 2.2);
        return true;
      }
      this.setBanner(`LOCKED: ${w.name}`, `REQUIRES $${w.cost} SCRAP IN ARMORY`, 1.8);
      return false;
    }
    if (this.currentWeaponIdx !== idx) {
      this.currentWeaponIdx = idx;
      this.reloadTimer = 0;
    }
    return true;
  }

  startReload() {
    const w = this.currentWeapon;
    if (this.reloadTimer > 0 || w.mag >= w.magSize) return;
    if (!w.infiniteReserve && w.reserve <= 0) {
      this.setBanner('OUT OF AMMUNITION!', 'SWITCH TO [1] M9 SIDEARM OR BUY AMMO IN ARMORY', 2.0);
      return;
    }
    const speedMult = 1 + this.perks.speedLoader * 0.25;
    this.reloadTimer = w.reloadTime / speedMult;
    audio.reload();
  }

  finishReload() {
    const w = this.currentWeapon;
    const needed = w.magSize - w.mag;
    if (w.infiniteReserve) {
      w.mag = w.magSize;
    } else {
      const load = Math.min(needed, w.reserve);
      w.mag += load;
      w.reserve -= load;
    }
  }

  fireWeapon() {
    if (this.paused || this.gameOver || this.fireCooldown > 0 || this.reloadTimer > 0) return false;
    const w = this.weapons[this.currentWeaponIdx];
    if (w.mag <= 0) {
      this.startReload();
      return false;
    }

    w.mag--;
    this.fireCooldown = w.fireRate;
    this.player.muzzleFlash = 0.085;
    audio.shoot(w.id);

    const dmgMult = 1 + this.perks.hollowPoint * 0.2;
    const muzzleX = this.player.x + Math.cos(this.player.angle) * 20;
    const muzzleY = this.player.y + Math.sin(this.player.angle) * 20;

    for (let i = 0; i < w.pellets; i++) {
      const spreadOffset = (Math.random() - 0.5) * w.spread * 2;
      const ang = this.player.angle + spreadOffset;
      this.bullets.push({
        x: muzzleX,
        y: muzzleY,
        vx: Math.cos(ang) * w.speed,
        vy: Math.sin(ang) * w.speed,
        damage: Math.round(w.damage * dmgMult),
        pierce: w.pierce,
        knockback: w.knockback,
        explosiveFire: !!w.explosiveFire,
        armorPiercing: w.id === 'rifle',
        color: w.color,
        life: 0.85,
        hitIds: new Set(),
      });
    }

    // Eject brass shell casing
    const sideAng = this.player.angle + Math.PI * 0.5 + (Math.random() - 0.5) * 0.4;
    const spd = 65 + Math.random() * 45;
    this.shells.push({
      x: this.player.x,
      y: this.player.y,
      vx: Math.cos(sideAng) * spd,
      vy: Math.sin(sideAng) * spd,
      angle: Math.random() * Math.PI * 2,
      life: 6.0,
      color: w.id === 'shotgun' ? '#ef4444' : '#eab308',
    });
    if (this.shells.length > 90) this.shells.shift();

    if (w.mag === 0) {
      this.startReload();
    }
    return true;
  }

  // Throw Incendiary Molotov [G] toward cursor
  throwMolotov(targetX, targetY) {
    if (this.paused || this.gameOver || this.player.molotovs <= 0) return false;
    this.player.molotovs--;
    const dx = targetX - this.player.x;
    const dy = targetY - this.player.y;
    const dist = Math.min(340, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);
    const hitX = Math.max(40, Math.min(WORLD_W - 40, this.player.x + Math.cos(ang) * dist));
    const hitY = Math.max(40, Math.min(WORLD_H - 40, this.player.y + Math.sin(ang) * dist));

    this.spawnFireExplosion(hitX, hitY, 78);
    this.setBanner('INCENDIARY MOLOTOV DETONATED', 'THERMITE POOL ACTIVE FOR 6.5s', 2.0);
    return true;
  }

  spawnFireExplosion(x, y, radius = 72) {
    audio.explosion();
    this.hazards.push({
      x,
      y,
      r: radius,
      type: 'fire',
      life: 6.5,
      maxLife: 6.5,
      tickTimer: 0,
    });
    this.spawnParticles(x, y, '#fb923c', 22, 220);
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < radius + e.r) {
        this.damageEnemy(e, 75, Math.atan2(e.y - y, e.x - x), 160, true);
        e.burnTimer = 4.0;
      }
    }
  }

  // Throw Red Magnesium Road Flare [X] toward cursor (#33)
  throwFlare(targetX, targetY) {
    if (this.paused || this.gameOver) return false;
    if (this.player.flares <= 0) {
      if (this.scrap >= 15) {
        this.scrap -= 15;
        this.player.flares += 2;
      } else {
        this.setBanner('NO MAGNESIUM FLARES REMAINING', 'REQUIRES $15 SCRAP IN ARMORY', 1.8);
        return false;
      }
    }
    this.player.flares--;
    const dx = targetX - this.player.x;
    const dy = targetY - this.player.y;
    const dist = Math.min(360, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);
    const fx = Math.max(40, Math.min(WORLD_W - 40, this.player.x + Math.cos(ang) * dist));
    const fy = Math.max(40, Math.min(WORLD_H - 40, this.player.y + Math.sin(ang) * dist));

    this.flares.push({
      x: fx,
      y: fy,
      r: 205,
      life: 35.0,
      maxLife: 35.0,
      sparkTimer: 0,
    });
    audio.buy();
    this.spawnParticles(fx, fy, '#fb7185', 14, 150);
    this.addFloatText(fx, fy - 14, 'MAGNESIUM FLARE (35s)', '#fb7185');
    this.setBanner('RED MAGNESIUM ROAD FLARE IGNITED', 'ILLUMINATING DARK ALLEYWAY FOR 35s', 2.0);
    return true;
  }

  // Interactive Environmental Lighting [E]: Hotwire Vehicle High-Beams + Car Alarm OR Flip Safe-Room Breaker (#33)
  interactEnvironmental() {
    if (this.paused || this.gameOver) return false;

    // 1. Check nearby street vehicle (< 120px from center)
    for (const w of this.walls) {
      if (w.type !== 'vehicle') continue;
      const cx = w.x + w.w * 0.5;
      const cy = w.y + w.h * 0.5;
      if (Math.hypot(this.player.x - cx, this.player.y - cy) < 120) {
        w.hotwireTimer = 25.0;
        w.alarmTimer = 12.0;
        for (const hl of w.headlights || []) {
          hl._origState = hl._origState || hl.state;
          hl._origRange = hl._origRange ?? hl.range;
          hl.state = 'on';
          hl.range = Math.max(hl.range, hl.baseRange || 340);
        }
        w._coneCache = null; // Invalidate cached raycast cones so newly restored beam renders immediately
        this._mapRev = (this._mapRev || 0) + 1;
        audio.repair();
        this.sonarRipples.push({ x: cx, y: cy, r: 14, maxR: 280, alpha: 0.95, color: '#fde047' });
        this.addFloatText(cx, cy - 24, '⚡ HIGH-BEAMS & CAR ALARM ACTIVE!', '#fde047');
        this.setBanner(
          `${w.label} HOTWIRED!`,
          'HIGH-BEAMS BOOSTED (25s) & CAR ALARM LURING HORDE INTO KILL-ZONE (12s)',
          2.8
        );
        return true;
      }
    }

    // 2. Check nearby Safe-Room Wall Breaker Box (< 125px)
    for (const br of this.breakers) {
      if (Math.hypot(this.player.x - br.x, this.player.y - br.y) < 125) {
        br.activeTimer = 40.0;
        const lt = this.lights[br.lightIdx];
        if (lt) {
          lt.r = 320;
          lt.flicker = 0;
        }
        audio.repair();
        this.addFloatText(br.x, br.y - 18, '💡 BREAKER ON (40s)', br.color);
        this.setBanner(`${br.name.toUpperCase()} ENGAGED`, 'SAFE-ROOM & DOORWAYS FLOODED WITH HIGH-BAY LIGHT FOR 40s', 2.6);
        return true;
      }
    }

    return false;
  }

  // Deploy 360-Degree Aegis Auto-Turret [T]
  deployTurret() {
    if (this.paused || this.gameOver) return false;
    if (this.player.turretKits <= 0) {
      if (this.scrap >= 95) {
        this.scrap -= 95;
        this.player.turretKits++;
      } else {
        this.setBanner('NO SENTRY TURRET KITS', 'REQUIRES $95 SCRAP TO FABRICATE', 1.8);
        return false;
      }
    }
    this.player.turretKits--;
    const tx = this.player.x + Math.cos(this.player.angle) * 36;
    const ty = this.player.y + Math.sin(this.player.angle) * 36;
    this.turrets.push({
      x: tx,
      y: ty,
      angle: this.player.angle,
      ammo: 140,
      maxAmmo: 140,
      fireTimer: 0,
    });
    audio.buy();
    this.setBanner('AEGIS AUTO-TURRET DEPLOYED', '140 ROUNDS 9MM SENTRY OVERWATCH', 2.2);
    return true;
  }

  // Use Emergency Med-Stim [H]
  useMedkit() {
    if (this.paused || this.gameOver) return false;
    if (this.player.hp >= this.player.maxHp) return false;
    if (this.player.medkits <= 0) {
      if (this.scrap >= 50) {
        this.scrap -= 50;
        this.player.medkits++;
      } else {
        this.setBanner('NO MED-STIMS REMAINING', 'REQUIRES $50 SCRAP', 1.8);
        return false;
      }
    }
    this.player.medkits--;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + 55);
    audio.buy();
    this.addFloatText(this.player.x, this.player.y - 18, '+55 HP STIM', '#34d399');
    return true;
  }

  // Repair nearest Barricade [F] (or all damaged barricades within 95px)
  repairNearestBarricade() {
    let repaired = false;
    for (const b of this.barricades) {
      const cx = b.x + b.w * 0.5;
      const cy = b.y + b.h * 0.5;
      const dist = Math.hypot(this.player.x - cx, this.player.y - cy);
      if (dist < 115 && b.hp < b.maxHp) {
        b.hp = Math.min(b.maxHp, b.hp + 75);
        repaired = true;
        this.addFloatText(cx, cy, '+REINFORCED', '#38bdf8');
      }
    }
    if (repaired) {
      audio.repair();
      return true;
    }
    // If not standing next to a barricade, offer remote fortification for $35 Scrap
    const damaged = this.barricades.filter(b => b.hp < b.maxHp);
    if (damaged.length > 0 && this.scrap >= 35) {
      this.scrap -= 35;
      for (const b of damaged) b.hp = b.maxHp;
      audio.repair();
      this.setBanner('ALL 8 BARRICADES REINFORCED', 'SECTOR DOORWAYS SEALED (100% HP)', 2.2);
      return true;
    }
    return false;
  }

  // Combat Dash [SPACE]
  triggerDash(moveX, moveY) {
    if (this.player.dashCooldown > 0 || this.player.dashTimer > 0) return false;
    let dx = moveX;
    let dy = moveY;
    if (Math.hypot(dx, dy) < 0.1) {
      dx = Math.cos(this.player.angle);
      dy = Math.sin(this.player.angle);
    } else {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    }
    this.player.dashDx = dx;
    this.player.dashDy = dy;
    this.player.dashTimer = 0.18;
    this.player.dashCooldown = 1.6;
    this.spawnParticles(this.player.x, this.player.y, '#38bdf8', 8, 90);
    return true;
  }

  // Armory Requisition Actions
  requisitionAction(actionId) {
    if (actionId && actionId.startsWith('ammo_w_')) {
      const idx = Number(actionId.replace('ammo_w_', ''));
      const w = this.weapons[idx];
      if (!w || !w.unlocked || w.infiniteReserve) return false;
      const cost = w.ammoCost || 40;
      if (this.scrap < cost) return false;
      this.scrap -= cost;
      w.reserve += w.ammoPack || 30;
      w.mag = w.magSize;
      audio.buy();
      this.setBanner(`${w.name} AMMO RESUPPLIED`, `+${w.ammoPack || 30} ROUNDS ADDED TO RESERVE`, 2.0);
      return true;
    }
    if (actionId === 'ammo_all') {
      if (this.scrap < 45) return false;
      this.scrap -= 45;
      for (const w of this.weapons) {
        if (!w.infiniteReserve) w.reserve += w.ammoPack || 30;
        w.mag = w.magSize;
      }
      audio.buy();
      this.setBanner('FULL AMMO CRATE RESUPPLIED', 'ALL MAGAZINES & RESERVES TOPPED UP', 2.0);
      return true;
    }
    if (actionId === 'medkit') {
      if (this.scrap < 40) return false;
      this.scrap -= 40;
      if (this.player.hp < this.player.maxHp) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 55);
      } else {
        this.player.medkits += 1;
      }
      audio.buy();
      this.addFloatText(this.player.x, this.player.y - 18, '+MED-STIM', '#10b981');
      return true;
    }
    if (actionId === 'armor_plate' || actionId === 'armor') {
      const cost = actionId === 'armor' ? 50 : 40;
      if (this.scrap < cost || this.player.armor >= this.player.maxArmor) return false;
      this.scrap -= cost;
      this.player.armor = Math.min(this.player.maxArmor, this.player.armor + 60);
      audio.buy();
      this.addFloatText(this.player.x, this.player.y - 18, '+60 KEVLAR', '#38bdf8');
      return true;
    }
    if (actionId === 'molotov_pack' || actionId === 'molotov') {
      if (this.scrap < 45) return false;
      this.scrap -= 45;
      this.player.molotovs += 2;
      audio.buy();
      this.addFloatText(this.player.x, this.player.y - 18, '+2 THERMITE', '#fb923c');
      return true;
    }
    if (actionId === 'flare') {
      if (this.scrap < 15) return false;
      this.scrap -= 15;
      this.player.flares += 3;
      audio.buy();
      this.addFloatText(this.player.x, this.player.y - 18, '+3 FLARES', '#fb7185');
      return true;
    }
    if (actionId === 'turret_kit' || actionId === 'turret') {
      const cost = actionId === 'turret' ? 110 : 95;
      if (this.scrap < cost) return false;
      this.scrap -= cost;
      this.player.turretKits += 1;
      this.deployTurret();
      return true;
    }
    if (actionId === 'barricadeAll') {
      const damaged = this.barricades.filter(b => b.hp < b.maxHp);
      if (damaged.length === 0 || this.scrap < 65) return false;
      this.scrap -= 65;
      for (const b of this.barricades) b.hp = b.maxHp;
      audio.repair();
      this.setBanner('STEEL BULKHEAD OVERHAUL', 'ALL 8 SAFE-ROOM DOORS RESTORED TO 100%', 2.2);
      return true;
    }
    if (actionId === 'perk_dmg' || actionId === 'perkDamage') {
      const cost = 85 + this.perks.hollowPoint * 45;
      if (this.scrap < cost || this.perks.hollowPoint >= 5) return false;
      this.scrap -= cost;
      this.perks.hollowPoint++;
      audio.buy();
      this.setBanner(`HOLLOW-POINT ROUNDS TIER ${this.perks.hollowPoint}`, `+${this.perks.hollowPoint * 18}% BALLISTIC DAMAGE`, 2.2);
      return true;
    }
    if (actionId === 'perkArmor') {
      this.perks.kevlarWeave = this.perks.kevlarWeave || 0;
      const cost = 80 + this.perks.kevlarWeave * 45;
      if (this.scrap < cost || this.perks.kevlarWeave >= 5) return false;
      this.scrap -= cost;
      this.perks.kevlarWeave++;
      this.player.maxHp += 25;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
      audio.buy();
      this.setBanner(`KEVLAR WEAVE TIER ${this.perks.kevlarWeave}`, `MAX TRAUMA HP INCREASED TO ${this.player.maxHp}`, 2.2);
      return true;
    }
    if (actionId === 'perk_reload' || actionId === 'perkReload') {
      const cost = 75 + this.perks.speedLoader * 45;
      if (this.scrap < cost || this.perks.speedLoader >= 4) return false;
      this.scrap -= cost;
      this.perks.speedLoader++;
      audio.buy();
      this.setBanner(`SPEED-LOADER RIG TIER ${this.perks.speedLoader}`, `+${this.perks.speedLoader * 25}% RELOAD VELOCITY`, 2.2);
      return true;
    }
    return false;
  }

  step(dt, input = { moveX: 0, moveY: 0, aimWorldX: 800, aimWorldY: 500, firing: false }) {
    if (this.paused || this.gameOver) return;
    this.time += dt;

    if (input.moveX || input.moveY || input.firing) {
      this.awaitingFirstInput = false;
    }

    if (this.banner.timer > 0 && !this.awaitingFirstInput) {
      this.banner.timer = Math.max(0, this.banner.timer - dt);
    }
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (this.player.muzzleFlash > 0) this.player.muzzleFlash = Math.max(0, this.player.muzzleFlash - dt);
    if (this.player.hitFlash > 0) this.player.hitFlash = Math.max(0, this.player.hitFlash - dt * 3);
    if (this.player.dashCooldown > 0) this.player.dashCooldown = Math.max(0, this.player.dashCooldown - dt);

    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloadTimer = 0;
        this.finishReload();
      }
    }

    // 1. Step Player Movement & Aim
    this.player.angle = Math.atan2(input.aimWorldY - this.player.y, input.aimWorldX - this.player.x);

    if (this.player.dashTimer > 0) {
      this.player.dashTimer = Math.max(0, this.player.dashTimer - dt);
      this.player.vx = this.player.dashDx * 540;
      this.player.vy = this.player.dashDy * 540;
    } else {
      let mx = input.moveX || 0;
      let my = input.moveY || 0;
      const mLen = Math.hypot(mx, my);
      if (mLen > 1) {
        mx /= mLen;
        my /= mLen;
      }
      this.player.vx = mx * this.player.speed;
      this.player.vy = my * this.player.speed;
    }

    this.player.x += this.player.vx * dt;
    this.player.y += this.player.vy * dt;
    this.resolveCircleWorldCollisions(this.player, false);

    if (input.firing) {
      this.fireWeapon();
    }

    // 2. Step Wave Spawner & Breather Timer
    if (this.awaitingFirstInput) {
      for (const e of this.enemies) {
        e.stepPhase += dt * 5.5;
        e.angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      }
      this.stepEffects(dt);
      return;
    }

    if (this.waveActive) {
      if (this.enemiesToSpawn.length > 0) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0 && this.enemies.length < 34) {
          const nextType = this.enemiesToSpawn.shift();
          this.spawnEnemy(nextType);
          this.spawnTimer = Math.max(0.28, 1.05 - this.wave * 0.06);
        }
      } else if (this.enemies.length === 0) {
        // Wave Cleared!
        this.waveActive = false;
        this.breatherTimer = 8.0;
        const waveBonus = 60 + this.wave * 25;
        this.scrap += waveBonus;
        this.addScore(250 * this.wave);
        this.setBanner(`WAVE ${this.wave} CLEARED!`, `+$${waveBonus} REQUISITION SCRAP · NEXT HORDE IN 8s`, 4.5);
      }
    } else {
      this.breatherTimer -= dt;
      if (this.breatherTimer <= 0) {
        this.queueWave(this.wave + 1);
        this.setBanner(`WAVE ${this.wave} — HORDE ASSAULT`, 'DEFEND THE BARRICADES & EVACUATION PLAZA', 3.5);
      }
    }

    // 3. Step Auto-Turrets
    this.stepTurrets(dt);

    // 4. Step Bullets & Acid Projectiles
    this.stepProjectiles(dt);

    // 5. Step Fire & Acid Hazards
    this.stepHazards(dt);

    // 6. Step Infected AI & Combat
    this.stepEnemies(dt);

    // 7. Step Pickups, Shells, Particles & Sonar Ripples
    this.stepEffects(dt);
  }

  resolveCircleWorldCollisions(entity, blockByBarricades = true) {
    entity.x = Math.max(entity.r + 8, Math.min(WORLD_W - entity.r - 8, entity.x));
    entity.y = Math.max(entity.r + 8, Math.min(WORLD_H - entity.r - 8, entity.y));

    for (const w of this.walls) {
      this.resolveCircleRect(entity, w.x, w.y, w.w, w.h);
    }

    if (blockByBarricades) {
      for (const b of this.barricades) {
        if (b.hp > 0) {
          if (this.resolveCircleRect(entity, b.x, b.y, b.w, b.h)) {
            entity._touchingBarricade = b;
          }
        }
      }
    }
  }

  resolveCircleRect(circle, rx, ry, rw, rh) {
    const closestX = Math.max(rx, Math.min(circle.x, rx + rw));
    const closestY = Math.max(ry, Math.min(circle.y, ry + rh));
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    const distSq = dx * dx + dy * dy;
    if (distSq >= circle.r * circle.r) return false;

    const dist = Math.sqrt(distSq);
    if (dist > 0.0001) {
      const pen = circle.r - dist;
      circle.x += (dx / dist) * pen;
      circle.y += (dy / dist) * pen;
    } else {
      // Inside AABB: push out along minimum penetration axis
      const leftPen = circle.x - rx;
      const rightPen = rx + rw - circle.x;
      const topPen = circle.y - ry;
      const botPen = ry + rh - circle.y;
      const minPen = Math.min(leftPen, rightPen, topPen, botPen);
      if (minPen === leftPen) circle.x = rx - circle.r;
      else if (minPen === rightPen) circle.x = rx + rw + circle.r;
      else if (minPen === topPen) circle.y = ry - circle.r;
      else circle.y = ry + rh + circle.r;
    }
    return true;
  }

  stepTurrets(dt) {
    for (let i = this.turrets.length - 1; i >= 0; i--) {
      const t = this.turrets[i];
      if (t.fireTimer > 0) t.fireTimer -= dt;

      // Find nearest visible enemy within 360px
      let best = null;
      let bestDist = 360;
      for (const e of this.enemies) {
        const d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d < bestDist && !this.segmentHitsWall(t.x, t.y, e.x, e.y)) {
          bestDist = d;
          best = e;
        }
      }

      if (best) {
        t.angle = Math.atan2(best.y - t.y, best.x - t.x);
        if (t.fireTimer <= 0 && t.ammo > 0) {
          t.ammo--;
          t.fireTimer = 0.14;
          audio.shoot('smg');
          this.bullets.push({
            x: t.x + Math.cos(t.angle) * 14,
            y: t.y + Math.sin(t.angle) * 14,
            vx: Math.cos(t.angle) * 1050,
            vy: Math.sin(t.angle) * 1050,
            damage: 20,
            pierce: 1,
            knockback: 28,
            explosiveFire: false,
            armorPiercing: false,
            color: '#38f2d7',
            life: 0.55,
            hitIds: new Set(),
          });
        }
      }
      if (t.ammo <= 0) {
        this.turrets.splice(i, 1);
      }
    }
  }

  segmentHitsWall(x1, y1, x2, y2) {
    for (const w of this.walls) {
      if (w.type !== 'wall') continue; // Bullets/LOS pass over low jersey barriers
      if (this.lineIntersectsRect(x1, y1, x2, y2, w.x, w.y, w.w, w.h)) return true;
    }
    return false;
  }

  lineIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    // Slab intersection test
    let tmin = 0;
    let tmax = 1;
    const dx = x2 - x1;
    const dy = y2 - y1;

    if (Math.abs(dx) < 1e-6) {
      if (x1 < rx || x1 > rx + rw) return false;
    } else {
      const inv = 1 / dx;
      let t1 = (rx - x1) * inv;
      let t2 = (rx + rw - x1) * inv;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }

    if (Math.abs(dy) < 1e-6) {
      if (y1 < ry || y1 > ry + rh) return false;
    } else {
      const inv = 1 / dy;
      let t1 = (ry - y1) * inv;
      let t2 = (ry + rh - y1) * inv;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
    return tmin <= tmax;
  }

  stepProjectiles(dt) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const prevX = b.x;
      const prevY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      if (b.life <= 0 || b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Check solid wall collision
      if (this.segmentHitsWall(prevX, prevY, b.x, b.y)) {
        if (b.explosiveFire) {
          this.spawnFireExplosion(prevX, prevY, 72);
        } else {
          this.spawnParticles(prevX, prevY, '#fde047', 4, 90);
        }
        this.bullets.splice(i, 1);
        continue;
      }

      // Check enemy hits
      let removed = false;
      for (const e of this.enemies) {
        if (b.hitIds.has(e)) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d < e.r + 6) {
          b.hitIds.add(e);
          const hitAng = Math.atan2(b.vy, b.vx);
          if (b.explosiveFire) {
            this.spawnFireExplosion(b.x, b.y, 76);
            this.bullets.splice(i, 1);
            removed = true;
            break;
          }
          this.damageEnemy(e, b.damage, hitAng, b.knockback, b.armorPiercing);
          b.pierce--;
          if (b.pierce <= 0) {
            this.bullets.splice(i, 1);
            removed = true;
            break;
          }
        }
      }
      if (removed) continue;
    }

    // Step Spitter Acid Globules
    for (let i = this.acidProjectiles.length - 1; i >= 0; i--) {
      const a = this.acidProjectiles[i];
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.life -= dt;
      const hitPlayer = Math.hypot(a.x - this.player.x, a.y - this.player.y) < this.player.r + 8;
      if (hitPlayer || a.life <= 0 || this.segmentHitsWall(a.x - a.vx * dt, a.y - a.vy * dt, a.x, a.y)) {
        if (hitPlayer) {
          this.damagePlayer(10);
        }
        this.hazards.push({
          x: a.x,
          y: a.y,
          r: 44,
          type: 'acid',
          life: 4.5,
          maxLife: 4.5,
          tickTimer: 0,
        });
        this.spawnParticles(a.x, a.y, '#10b981', 10, 110);
        this.acidProjectiles.splice(i, 1);
      }
    }
  }

  stepHazards(dt) {
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.life -= dt;
      h.tickTimer -= dt;
      if (h.tickTimer <= 0) {
        h.tickTimer = 0.25;
        if (h.type === 'fire') {
          for (const e of this.enemies) {
            if (Math.hypot(e.x - h.x, e.y - h.y) < h.r + e.r) {
              this.damageEnemy(e, 14, 0, 0, true);
              e.burnTimer = 2.0;
            }
          }
        } else if (h.type === 'acid') {
          if (Math.hypot(this.player.x - h.x, this.player.y - h.y) < h.r + this.player.r) {
            this.damagePlayer(4);
          }
        }
      }
      if (h.life <= 0) this.hazards.splice(i, 1);
    }
  }

  damageEnemy(e, rawDmg, hitAngle, knockback, ignoreArmor = false) {
    let dmg = rawDmg;
    if (e.def.armored && !ignoreArmor) {
      dmg = Math.max(4, Math.round(dmg * 0.45));
      this.spawnParticles(e.x, e.y, '#94a3b8', 4, 120);
    } else {
      this.spawnParticles(e.x, e.y, '#dc2626', 6, 130);
    }

    e.hp -= dmg;
    e.hitFlash = 1.0;
    if (knockback > 0) {
      const kbScale = e.def.armored ? 0.3 : 1.0;
      e.x += Math.cos(hitAngle) * knockback * 0.08 * kbScale;
      e.y += Math.sin(hitAngle) * knockback * 0.08 * kbScale;
    }
    audio.hit();
  }

  damagePlayer(dmg) {
    if (this.player.dashTimer > 0 || this.gameOver) return; // Dash gives brief i-frames
    audio.playerHit();
    this.player.hitFlash = 1.0;

    if (this.player.armor > 0) {
      const absorb = Math.min(this.player.armor, Math.ceil(dmg * 0.65));
      this.player.armor -= absorb;
      dmg -= absorb;
    }
    this.player.hp = Math.max(0, this.player.hp - dmg);
    if (this.player.hp <= 0) {
      this.gameOver = true;
      this.setBanner('OPERATOR KIA — SECTOR OVERRUN', `SURVIVED TO WAVE ${this.wave} · ${this.kills} KILLS`, 99);
    }
  }

  stepEnemies(dt) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
      if (e.frenzyTimer > 0) e.frenzyTimer = Math.max(0, e.frenzyTimer - dt);
      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        e.hp -= 18 * dt;
      }

      if (e.hp <= 0) {
        this.kills++;
        this.scrap += e.def.bounty;
        this.addScore(e.def.score);
        audio.kill();

        this.bloodDecals.push({ x: e.x, y: e.y, r: e.r * (1.1 + Math.random() * 0.5), alpha: 0.75 });
        if (this.bloodDecals.length > 120) this.bloodDecals.shift();
        this.spawnParticles(e.x, e.y, '#991b1b', 12, 160);

        // Chance to drop field supply pickup
        if (Math.random() < 0.22 || e.def.id === 'brute') {
          const types = ['scrap', 'ammo', 'med'];
          const pType = types[Math.floor(Math.random() * types.length)];
          this.pickups.push({ x: e.x, y: e.y, type: pType, life: 18.0 });
        }
        this.enemies.splice(i, 1);
        continue;
      }

      // Necro Screamer periodic frenzy shockwave
      if (e.def.screamer) {
        e.screamCooldown -= dt;
        if (e.screamCooldown <= 0) {
          e.screamCooldown = 5.5;
          audio.scream();
          this.sonarRipples.push({ x: e.x, y: e.y, r: 10, maxR: 220, alpha: 0.9, color: '#e879f9' });
          for (const ally of this.enemies) {
            if (Math.hypot(ally.x - e.x, ally.y - e.y) < 220) {
              ally.frenzyTimer = 3.5;
            }
          }
        }
      }

      // Steering toward player (or toward an active hotwired Vehicle Car Alarm within 440px!)
      let targetX = this.player.x;
      let targetY = this.player.y;
      for (const w of this.walls) {
        if (w.type === 'vehicle' && w.alarmTimer > 0) {
          const vcx = w.x + w.w * 0.5;
          const vcy = w.y + w.h * 0.5;
          if (Math.hypot(vcx - e.x, vcy - e.y) < 440) {
            targetX = vcx + Math.cos(w.angle || 0) * 110;
            targetY = vcy + Math.sin(w.angle || 0) * 110;
            break;
          }
        }
      }
      const dx = targetX - e.x;
      const dy = targetY - e.y;
      const distToPlayer = Math.hypot(this.player.x - e.x, this.player.y - e.y);
      let targetAngle = Math.atan2(dy, dx);

      // If direct line to player is blocked by a solid wall, steer toward the nearest corridor opening or doorway
      if (this.segmentHitsWall(e.x, e.y, this.player.x, this.player.y)) {
        const probeLeft = targetAngle - 0.65;
        const probeRight = targetAngle + 0.65;
        const leftBlocked = this.segmentHitsWall(e.x, e.y, e.x + Math.cos(probeLeft) * 65, e.y + Math.sin(probeLeft) * 65);
        const rightBlocked = this.segmentHitsWall(e.x, e.y, e.x + Math.cos(probeRight) * 65, e.y + Math.sin(probeRight) * 65);
        if (!leftBlocked && rightBlocked) targetAngle = probeLeft;
        else if (leftBlocked && !rightBlocked) targetAngle = probeRight;
      }

      e.angle = targetAngle;
      const spdMult = e.frenzyTimer > 0 ? 1.38 : 1.0;

      // Bile Spitter stops at medium range to lob acid if it has LOS
      if (e.def.ranged && distToPlayer < 290 && distToPlayer > 110 && !this.segmentHitsWall(e.x, e.y, this.player.x, this.player.y)) {
        e.spitCooldown -= dt;
        if (e.spitCooldown <= 0) {
          e.spitCooldown = 2.6;
          this.acidProjectiles.push({
            x: e.x,
            y: e.y,
            vx: Math.cos(e.angle) * 320,
            vy: Math.sin(e.angle) * 320,
            life: 1.1,
          });
        }
      } else {
        e.x += Math.cos(e.angle) * e.speed * spdMult * dt;
        e.y += Math.sin(e.angle) * e.speed * spdMult * dt;
      }

      e.stepPhase += dt * 8;
      e._touchingBarricade = null;
      this.resolveCircleWorldCollisions(e, true);

      // Soft separation between infected so hordes form wide fronts rather than stacking on 1 pixel
      for (let j = i - 1; j >= 0; j--) {
        const o = this.enemies[j];
        const sdx = e.x - o.x;
        const sdy = e.y - o.y;
        const sd = Math.hypot(sdx, sdy);
        const minD = e.r + o.r;
        if (sd > 0.01 && sd < minD) {
          const push = (minD - sd) * 0.35;
          e.x += (sdx / sd) * push;
          e.y += (sdy / sd) * push;
          o.x -= (sdx / sd) * push;
          o.y -= (sdy / sd) * push;
        }
      }

      // Attack Barricade if touching one
      if (e._touchingBarricade && e._touchingBarricade.hp > 0) {
        e.attackCooldown -= dt;
        if (e.attackCooldown <= 0) {
          e.attackCooldown = 0.75;
          e._touchingBarricade.hp = Math.max(0, e._touchingBarricade.hp - e.def.damage);
          this.spawnParticles(e.x, e.y, '#d97706', 4, 70);
          if (e._touchingBarricade.hp === 0) {
            this.setBanner(`⚠ ${e._touchingBarricade.name.toUpperCase()} BREACHED!`, 'PRESS [F] TO REINFORCE DOORWAY', 2.6);
          }
        }
      }

      // Melee Attack Player on contact
      if (distToPlayer < e.r + this.player.r + 4) {
        e.attackCooldown -= dt;
        if (e.attackCooldown <= 0) {
          e.attackCooldown = 0.85;
          this.damagePlayer(e.def.damage);
        }
      }
    }
  }

  stepEffects(dt) {
    // Pickups
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life -= dt;
      if (Math.hypot(p.x - this.player.x, p.y - this.player.y) < this.player.r + 18) {
        audio.buy();
        if (p.type === 'med') {
          if (this.player.hp < this.player.maxHp) {
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + 30);
            this.addFloatText(p.x, p.y, '+30 HP', '#34d399');
          } else {
            this.player.medkits++;
            this.addFloatText(p.x, p.y, '+1 MED-STIM', '#34d399');
          }
        } else if (p.type === 'ammo') {
          for (const w of this.weapons) {
            if (!w.infiniteReserve) w.reserve += Math.ceil((w.ammoPack || 24) * 0.5);
          }
          this.addFloatText(p.x, p.y, '+AMMO CACHE', '#fde047');
        } else {
          this.scrap += 35;
          this.addFloatText(p.x, p.y, '+$35 SCRAP', '#38bdf8');
        }
        this.pickups.splice(i, 1);
        continue;
      }
      if (p.life <= 0) this.pickups.splice(i, 1);
    }

    // Shells
    for (let i = this.shells.length - 1; i >= 0; i--) {
      const s = this.shells[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= Math.pow(0.02, dt);
      s.vy *= Math.pow(0.02, dt);
      s.life -= dt;
      if (s.life <= 0) this.shells.splice(i, 1);
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    // Float texts
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      ft.y -= 26 * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatTexts.splice(i, 1);
    }

    // Sonar ripples
    for (let i = this.sonarRipples.length - 1; i >= 0; i--) {
      const sr = this.sonarRipples[i];
      sr.r += 190 * dt;
      sr.alpha -= dt * 0.85;
      if (sr.alpha <= 0 || sr.r >= sr.maxR) this.sonarRipples.splice(i, 1);
    }

    // Magnesium Road Flares (#33)
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const fl = this.flares[i];
      fl.life -= dt;
      fl.sparkTimer -= dt;
      if (fl.sparkTimer <= 0) {
        fl.sparkTimer = 0.14;
        this.spawnParticles(fl.x, fl.y, '#fb7185', 2, 55);
      }
      if (fl.life <= 0) this.flares.splice(i, 1);
    }

    // Hotwired Vehicle Timers & Car Alarms (#33)
    for (const w of this.walls) {
      if (w.type !== 'vehicle') continue;
      if (w.alarmTimer > 0) {
        const prev = Math.floor(w.alarmTimer * 1.5);
        w.alarmTimer = Math.max(0, w.alarmTimer - dt);
        if (Math.floor(w.alarmTimer * 1.5) !== prev) {
          this.sonarRipples.push({
            x: w.x + w.w * 0.5,
            y: w.y + w.h * 0.5,
            r: 12,
            maxR: 260,
            alpha: 0.75,
            color: '#f59e0b',
          });
        }
      }
      if (w.hotwireTimer > 0) {
        w.hotwireTimer = Math.max(0, w.hotwireTimer - dt);
        if (w.hotwireTimer === 0) {
          for (const hl of w.headlights || []) {
            if (hl._origState) hl.state = hl._origState;
            if (hl._origRange !== undefined) hl.range = hl._origRange;
          }
          w._coneCache = null;
          this._mapRev = (this._mapRev || 0) + 1;
        }
      }
    }

    // Safe-Room Wall Breaker Timers (#33)
    for (const br of this.breakers) {
      if (br.activeTimer > 0) {
        br.activeTimer = Math.max(0, br.activeTimer - dt);
        if (br.activeTimer === 0) {
          const lt = this.lights[br.lightIdx];
          if (lt) {
            lt.r = lt.baseR || 185;
            lt.flicker = 0.12;
          }
        }
      }
    }
  }

  spawnParticles(x, y, color, count = 8, maxSpd = 120) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 25 + Math.random() * maxSpd;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        color,
        size: 2 + Math.random() * 2.5,
        life: 0.25 + Math.random() * 0.25,
      });
    }
  }
}
