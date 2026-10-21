// ============================================================================
// IRONWAKE // CONVOY — Deterministic Armored-Train & Convoy Combat Simulation
// ============================================================================

import {
  WORLD_W,
  WORLD_H,
  TRACK_Y,
  RAILCAR_TEMPLATES,
  STEAM_SYSTEMS,
  TOTAL_STEAM_BARS,
  ENEMY_ARCHETYPES,
  SECTOR_NODES,
} from './config.js';

const STORAGE_KEY_BEST = 'ironwake.highScore.v1';

export class IronwakeSim {
  constructor(audio = null) {
    this.audio = audio;
    this.bestScore =
      (typeof localStorage !== 'undefined' &&
        Number(localStorage.getItem(STORAGE_KEY_BEST))) ||
      6400;
    this.resetCampaign();
  }

  resetCampaign() {
    this.time = 0;
    this.paused = false;
    this.speed = 1;
    this.gameOver = false;
    this.victory = false;
    this.nodeSummary = null;

    this.nodeIndex = 0;
    this.currentNode = { ...SECTOR_NODES[0] };
    this.distanceTraveledKm = 0;

    this.scrap = 185;
    this.score = 0;
    this.kills = 0;
    this.harpoonsSevered = 0;

    this.maxShieldHp = 180;
    this.shieldHp = 180;
    this.boilerHeat = 22; // 0..100

    // Reactor Steam Allocation (sum <= TOTAL_STEAM_BARS = 10)
    this.steam = {
      weapons: 3,
      shields: 3,
      thrusters: 2,
      repair: 2,
    };

    // Modular 5-car dreadnought train
    const trainCenterX = WORLD_W * 0.5;
    this.cars = RAILCAR_TEMPLATES.map((tpl) => ({
      ...tpl,
      x: trainCenterX + tpl.offsetX,
      y: TRACK_Y,
      hp: tpl.maxHp,
      maxHp: tpl.maxHp,
      turretAngle: -Math.PI * 0.5,
      reloadTimer: 0.2 * tpl.index,
      weaponLevel: 1,
      armorLevel: 1,
      hitFlash: 0,
    }));
    this.selectedCarId = this.cars[1].id; // Default to Vulcan-8 Autocannon Car

    // Target designation & subsystem focus
    this.selectedEnemyId = null;
    this.targetSubsystem = 'weapons'; // 'weapons' | 'engine' | 'winch'
    this.aimWorld = { x: WORLD_W * 0.55, y: 190 };
    this.manualAimActive = false;

    // Entities on battlefield
    this.enemies = [];
    this.projectiles = [];
    this.harpoons = []; // { id, enemyId, carId, tension, hp }
    this.explosions = []; // { x, y, r, maxR, color, alpha }
    this.callouts = []; // { x, y, text, color, life }
    this.combatLog = [];

    this.spawnTimer = 1.5;
    this.overdriveTimer = 0;
    this.bossSpawnedForNode = false;

    this.logEvent(
      `SECTOR 1 // Outpost 9 departed. Turrets online.`,
      'ops'
    );

    // Spawn initial raider escort pack so the battlefield is immediately alive
    this.spawnEnemy('skiff', 480, 175);
    this.spawnEnemy('harpoon', 880, 745);
  }

  logEvent(text, tone = 'info') {
    const mins = Math.floor(this.time / 60);
    const secs = Math.floor(this.time % 60);
    const stamp = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.combatLog.unshift({ time: stamp, text, tone });
    if (this.combatLog.length > 22) this.combatLog.length = 22;
  }

  addCallout(x, y, text, color = '#fde68a') {
    this.callouts.push({ x, y, text, color, life: 1.35 });
  }

  getUsedSteam() {
    return (
      this.steam.weapons +
      this.steam.shields +
      this.steam.thrusters +
      this.steam.repair
    );
  }

  adjustSteam(sysId, delta) {
    if (!(sysId in this.steam)) return false;
    const cur = this.steam[sysId];
    const next = Math.max(0, Math.min(5, cur + delta));
    if (next === cur) return false;
    if (delta > 0 && this.getUsedSteam() >= TOTAL_STEAM_BARS) {
      // Borrow 1 bar from another system with lowest priority
      const donors = ['repair', 'thrusters', 'shields', 'weapons'].filter(
        (k) => k !== sysId && this.steam[k] > 0
      );
      if (donors.length === 0) return false;
      this.steam[donors[0]] -= 1;
    }
    this.steam[sysId] = next;
    if (this.audio) this.audio.playClick();
    return true;
  }

  setSteamPreset(preset) {
    if (preset === 'balanced') {
      this.steam = { weapons: 3, shields: 3, thrusters: 2, repair: 2 };
    } else if (preset === 'barrage') {
      this.steam = { weapons: 5, shields: 2, thrusters: 2, repair: 1 };
    } else if (preset === 'fortress') {
      this.steam = { weapons: 2, shields: 5, thrusters: 1, repair: 2 };
    } else if (preset === 'throttle') {
      this.steam = { weapons: 2, shields: 2, thrusters: 5, repair: 1 };
    }
    if (this.audio) this.audio.playClick();
  }

  getTrainSpeedMph() {
    const base = 52 + this.steam.thrusters * 13;
    const harpoonDrag = this.harpoons.length * 14;
    const overdriveBonus = this.overdriveTimer > 0 ? 18 : 0;
    return Math.max(22, Math.round(base - harpoonDrag + overdriveBonus));
  }

  getTotalHullHp() {
    let cur = 0;
    let max = 0;
    for (const c of this.cars) {
      cur += Math.max(0, Math.round(c.hp));
      max += c.maxHp;
    }
    return { cur, max, pct: Math.round((cur / Math.max(1, max)) * 100) };
  }

  spawnEnemy(typeKey = null, customX = null, customY = null) {
    if (this.enemies.length >= 6) return null;

    let key = typeKey;
    if (!key) {
      const roll = Math.random();
      if (this.nodeIndex === 0) {
        key = roll < 0.6 ? 'skiff' : 'harpoon';
      } else if (this.nodeIndex === 1) {
        key = roll < 0.45 ? 'harpoon' : roll < 0.8 ? 'skiff' : 'gyro';
      } else {
        key = roll < 0.38 ? 'gyro' : roll < 0.72 ? 'harpoon' : 'skiff';
      }
    }

    const arch = ENEMY_ARCHETYPES[key] || ENEMY_ARCHETYPES.skiff;
    const topLane =
      customY !== null ? customY < TRACK_Y : Math.random() < 0.52;
    const laneY =
      customY !== null
        ? customY
        : topLane
          ? 135 + Math.random() * 145
          : 640 + Math.random() * 145;
    const spawnX =
      customX !== null
        ? customX
        : 180 + Math.random() * (WORLD_W - 360);

    const scale = 1 + this.nodeIndex * 0.16;
    const enemy = {
      id: `en_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
      type: arch.id,
      name: arch.name,
      sprite: arch.sprite,
      x: spawnX,
      y: laneY,
      vx: (Math.random() - 0.5) * 40,
      vy: 0,
      targetX: Math.max(220, Math.min(WORLD_W - 220, spawnX + (Math.random() - 0.5) * 240)),
      targetY: laneY,
      angle: topLane ? Math.PI * 0.5 : -Math.PI * 0.5,
      hp: Math.round(arch.maxHp * scale),
      maxHp: Math.round(arch.maxHp * scale),
      speed: arch.speed,
      fireRate: arch.fireRate,
      fireTimer: 0.9 + Math.random() * 0.8,
      harpoonTimer: arch.canHarpoon ? 2.4 : 999,
      damage: Math.round(arch.damage * scale),
      scrapReward: arch.scrapReward,
      scoreReward: arch.scoreReward,
      radius: arch.radius,
      color: arch.color,
      canHarpoon: arch.canHarpoon,
      isAir: arch.isAir,
      isBoss: Boolean(arch.isBoss),
      hitFlash: 0,
      subsystems: {
        weapons: { hp: 100, maxHp: 100, destroyed: false },
        engine: { hp: 100, maxHp: 100, destroyed: false },
        winch: { hp: 100, maxHp: 100, destroyed: !arch.canHarpoon },
      },
    };

    this.enemies.push(enemy);
    if (!this.selectedEnemyId || enemy.isBoss) {
      this.selectedEnemyId = enemy.id;
    }
    return enemy;
  }

  // Tactical Commander Orders
  triggerSeverHarpoons() {
    if (this.scrap < 35 && this.harpoons.length === 0) return false;
    if (this.scrap >= 35) this.scrap -= 35;

    const count = this.harpoons.length;
    this.harpoons = [];
    this.harpoonsSevered += count;

    // Deal flak burst damage to all enemies
    for (const en of this.enemies) {
      en.hp -= 28;
      en.hitFlash = 0.25;
      this.explosions.push({
        x: en.x,
        y: en.y,
        r: 10,
        maxR: 62,
        color: '#a855f7',
        alpha: 0.9,
      });
    }
    if (this.audio) this.audio.playExplosion(false);
    this.logEvent(
      `SKYBURST COUNTER-FLAK: ${count} harpoon tethers severed & raiders shrapnel-blasted!`,
      'ops'
    );
    this.addCallout(WORLD_W * 0.5, TRACK_Y - 52, '💥 HARPOONS SEVERED + FLAK BURST', '#a855f7');
    return true;
  }

  triggerThermalPurge() {
    this.boilerHeat = Math.max(0, this.boilerHeat - 45);
    this.shieldHp = Math.min(this.maxShieldHp, this.shieldHp + 55);
    for (const c of this.cars) {
      this.explosions.push({
        x: c.x,
        y: c.y,
        r: 12,
        maxR: 78,
        color: '#38bdf8',
        alpha: 0.85,
      });
    }
    if (this.audio) this.audio.playSteamWhistle();
    this.logEvent(
      'THERMAL STEAM VENT PURGE: Boiler cooled (-45% heat) & Aegis Void Shield surged (+55).',
      'ops'
    );
    this.addCallout(WORLD_W * 0.5, TRACK_Y - 52, '💨 STEAM VENT PURGE (+55 SHIELD)', '#38bdf8');
    return true;
  }

  triggerOverdriveBarrage() {
    if (this.scrap < 55) return false;
    this.scrap -= 55;
    this.overdriveTimer = 7.0;
    this.boilerHeat = Math.min(100, this.boilerHeat + 18);
    if (this.audio) this.audio.playSteamWhistle();
    this.logEvent(
      'OVERDRIVE BARRAGE ENGAGED (7s): All railcar turrets firing at 1.9× cyclic rate!',
      'scoop'
    );
    this.addCallout(WORLD_W * 0.5, TRACK_Y - 52, '⚡ OVERDRIVE BARRAGE (7.0s)', '#f59e0b');
    return true;
  }

  upgradeSelectedCar() {
    const car = this.cars.find((c) => c.id === this.selectedCarId) || this.cars[0];
    const cost = 60 + (car.weaponLevel - 1) * 35;
    if (this.scrap < cost) return false;
    this.scrap -= cost;
    car.weaponLevel += 1;
    car.armorLevel += 1;
    car.maxHp += 40;
    car.hp = Math.min(car.maxHp, car.hp + 75);
    car.damage = Math.round(car.damage * 1.22);
    if (this.audio) this.audio.playClick();
    this.logEvent(
      `UPGRADED ${car.name} to MK-${car.weaponLevel} (+22% DMG, +40 MAX HULL).`,
      'scoop'
    );
    this.addCallout(car.x, car.y - 42, `⬆ MK-${car.weaponLevel} UPGRADED`, '#10b981');
    return true;
  }

  advanceToNextNode() {
    if (this.nodeIndex + 1 >= SECTOR_NODES.length) {
      this.victory = true;
      this.gameOver = true;
      return;
    }
    this.nodeIndex += 1;
    this.currentNode = { ...SECTOR_NODES[this.nodeIndex] };
    this.distanceTraveledKm = 0;
    this.nodeSummary = null;
    this.bossSpawnedForNode = false;
    this.harpoons = [];
    this.enemies = [];
    this.projectiles = [];
    this.shieldHp = this.maxShieldHp;

    for (const c of this.cars) {
      c.hp = Math.min(c.maxHp, c.hp + 60);
    }

    if (this.currentNode.isBossNode) {
      this.spawnEnemy('boss', 720, 165);
      this.spawnEnemy('harpoon', 420, 745);
      this.bossSpawnedForNode = true;
      this.logEvent(
        `WARNING // GOLIATH CANYON SIEGE CRAWLER INTERCEPTED ON PARALLEL RIDGE!`,
        'danger'
      );
    } else {
      this.spawnEnemy('skiff', 460, 175);
      this.spawnEnemy('harpoon', 860, 745);
      if (this.nodeIndex >= 2) this.spawnEnemy('gyro', 720, 160);
      this.logEvent(`ENTERING ${this.currentNode.name} — Weapons free.`, 'ops');
    }
  }

  step(dt) {
    if (this.paused || this.gameOver || this.nodeSummary) return;

    this.time += dt;
    if (this.overdriveTimer > 0) {
      this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);
    }

    // 1. Advance train distance along sector route
    const mph = this.getTrainSpeedMph();
    const kmPerSec = mph * 0.011;
    this.distanceTraveledKm = Math.min(
      this.currentNode.distanceKm,
      this.distanceTraveledKm + kmPerSec * dt
    );

    // Check sector node completion (for boss node, boss must also be destroyed)
    const bossAlive = this.enemies.some((e) => e.isBoss);
    if (
      this.distanceTraveledKm >= this.currentNode.distanceKm &&
      (!this.currentNode.isBossNode || !bossAlive)
    ) {
      const bonusScrap = 75 + this.nodeIndex * 35;
      this.scrap += bonusScrap;
      this.score += 600 + this.nodeIndex * 250;
      if (this.score > this.bestScore) {
        this.bestScore = this.score;
        try {
          localStorage.setItem(STORAGE_KEY_BEST, String(this.bestScore));
        } catch (_) {}
      }

      if (this.nodeIndex + 1 >= SECTOR_NODES.length) {
        this.victory = true;
        this.gameOver = true;
      }
      this.nodeSummary = {
        nodeName: this.currentNode.name,
        bonusScrap,
        kills: this.kills,
        score: this.score,
        isFinalNode: this.nodeIndex + 1 >= SECTOR_NODES.length,
      };
      return;
    }

    // 2. Shield recharge, Repair Drones & Boiler Heat dynamics
    const shieldRegen = this.steam.shields * 3.4;
    this.shieldHp = Math.min(this.maxShieldHp, this.shieldHp + shieldRegen * dt);

    const repairRate = this.steam.repair * 2.6;
    if (repairRate > 0) {
      for (const c of this.cars) {
        if (c.hp > 0 && c.hp < c.maxHp) {
          c.hp = Math.min(c.maxHp, c.hp + repairRate * dt);
        }
      }
    }

    const heatGen = (this.steam.weapons - 2.2) * 1.4 - this.steam.repair * 1.2;
    this.boilerHeat = Math.max(0, Math.min(100, this.boilerHeat + heatGen * dt));

    // 3. Spawn Raider Waves
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(2.6, 5.2 - this.nodeIndex * 0.55);
      if (this.currentNode.isBossNode && !this.bossSpawnedForNode) {
        this.spawnEnemy('boss', 720, 165);
        this.bossSpawnedForNode = true;
      } else if (this.enemies.length < 4) {
        this.spawnEnemy();
      }
    }

    // 4. Update Railcar Turrets & Fire at Target
    const weapMul =
      (0.65 + this.steam.weapons * 0.24) * (this.overdriveTimer > 0 ? 1.55 : 1.0);

    for (const car of this.cars) {
      if (car.hitFlash > 0) car.hitFlash = Math.max(0, car.hitFlash - dt * 3);
      if (car.hp <= 0) continue;

      // Pick primary target or nearest enemy
      let target =
        this.enemies.find((e) => e.id === this.selectedEnemyId) ||
        this.enemies[0] ||
        null;

      if (target) {
        // Lead target position slightly
        const dist = Math.hypot(target.x - car.x, target.y - car.y);
        const tFlight = dist / Math.max(300, car.projSpeed);
        const aimX = target.x + target.vx * tFlight;
        const aimY = target.y + target.vy * tFlight;
        car.turretAngle = Math.atan2(aimY - car.y, aimX - car.x);

        car.reloadTimer -= dt * weapMul;
        if (car.reloadTimer <= 0) {
          car.reloadTimer = car.reloadSec;
          this._fireCarTurret(car, aimX, aimY, target.id);
        }
      } else if (this.manualAimActive) {
        car.turretAngle = Math.atan2(
          this.aimWorld.y - car.y,
          this.aimWorld.x - car.x
        );
      }
    }

    // 5. Update Enemies & Harpoon Tethers
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (en.hitFlash > 0) en.hitFlash = Math.max(0, en.hitFlash - dt * 3);

      const engFactor = en.subsystems.engine.destroyed ? 0.45 : 1.0;
      const wpnFactor = en.subsystems.weapons.destroyed ? 0.45 : 1.0;

      // Patrol parallel to the armored train along top/bottom salt-flat lanes
      const dx = en.targetX - en.x;
      const dy = en.targetY - en.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 28) {
        en.targetX = 220 + Math.random() * (WORLD_W - 440);
        en.targetY =
          en.y < TRACK_Y
            ? 135 + Math.random() * 145
            : 640 + Math.random() * 145;
      } else {
        const moveSpd = en.speed * engFactor;
        en.vx = (dx / dist) * moveSpd;
        en.vy = (dy / dist) * moveSpd;
        en.x += en.vx * dt;
        en.y += en.vy * dt;
      }

      // Keep horizontal spacing between raiders on the same salt-flat lane
      for (const other of this.enemies) {
        if (other.id === en.id) continue;
        if (Math.abs(other.y - en.y) < 140) {
          const sepX = en.x - other.x;
          const minGap = en.radius + other.radius + 115;
          if (Math.abs(sepX) < minGap) {
            const dir = sepX >= 0 ? 1 : -1;
            en.x = Math.max(160, Math.min(WORLD_W - 160, en.x + dir * 95 * dt));
          }
        }
      }

      // Face along track (+X) or toward nearest railcar
      const nearestCar = this._findNearestAliveCar(en.x, en.y);
      if (nearestCar) {
        en.angle = Math.atan2(nearestCar.y - en.y, nearestCar.x - en.x);
      }

      // Fire harpoon cable if Harpoon Rig / Boss and winch intact
      if (
        en.canHarpoon &&
        !en.subsystems.winch.destroyed &&
        nearestCar &&
        !this.harpoons.some((h) => h.enemyId === en.id)
      ) {
        en.harpoonTimer -= dt;
        if (en.harpoonTimer <= 0) {
          en.harpoonTimer = 7.5;
          this.harpoons.push({
            id: `hp_${en.id}`,
            enemyId: en.id,
            carId: nearestCar.id,
            hp: 45,
          });
          if (this.audio) this.audio.playHarpoonClang();
          this.addCallout(
            nearestCar.x,
            nearestCar.y - 28,
            '⚓ HARPOON LATCHED!',
            '#ef4444'
          );
          this.logEvent(
            `${en.name} latched a steel harpoon onto ${nearestCar.name}!`,
            'danger'
          );
        }
      }

      // Fire ballistic rounds at nearest railcar
      en.fireTimer -= dt * wpnFactor;
      if (en.fireTimer <= 0 && nearestCar) {
        en.fireTimer = en.fireRate;
        const ang = Math.atan2(nearestCar.y - en.y, nearestCar.x - en.x);
        const spd = 430;
        this.projectiles.push({
          fromPlayer: false,
          x: en.x + Math.cos(ang) * 24,
          y: en.y + Math.sin(ang) * 24,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          damage: en.damage,
          color: '#f43f5e',
          radius: en.isBoss ? 6 : 4,
          life: 2.2,
        });
      }
    }

    // Clean up harpoons whose owner was destroyed
    this.harpoons = this.harpoons.filter((h) =>
      this.enemies.some((e) => e.id === h.enemyId)
    );

    // 6. Update Projectiles & Collisions
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (
        p.life <= 0 ||
        p.x < -40 ||
        p.x > WORLD_W + 40 ||
        p.y < -40 ||
        p.y > WORLD_H + 40
      ) {
        this.projectiles.splice(i, 1);
        continue;
      }

      if (p.fromPlayer) {
        let hit = false;
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const en = this.enemies[j];
          const d = Math.hypot(p.x - en.x, p.y - en.y);
          const triggerDist =
            p.weaponType === 'flak' ? en.radius + 18 : en.radius;

          if (d <= triggerDist) {
            hit = true;
            this._applyPlayerProjectileHit(p, en);
            break;
          }
        }
        if (hit) {
          this.projectiles.splice(i, 1);
        }
      } else {
        // Enemy projectile vs Player Railcars
        for (const car of this.cars) {
          if (car.hp <= 0) continue;
          if (
            Math.abs(p.x - car.x) <= car.width * 0.52 &&
            Math.abs(p.y - car.y) <= car.height * 0.58
          ) {
            this._applyEnemyHitToCar(car, p.damage, p.x, p.y);
            this.projectiles.splice(i, 1);
            break;
          }
        }
      }
    }

    // 7. Update Explosions & Callouts
    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const ex = this.explosions[i];
      ex.r += (ex.maxR - ex.r) * Math.min(1, dt * 9);
      ex.alpha -= dt * 1.9;
      if (ex.alpha <= 0) this.explosions.splice(i, 1);
    }

    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const c = this.callouts[i];
      c.y -= dt * 20;
      c.life -= dt;
      if (c.life <= 0) this.callouts.splice(i, 1);
    }

    // Check total hull loss
    if (this.cars[0].hp <= 0 || this.getTotalHullHp().cur <= 0) {
      this.gameOver = true;
      this.victory = false;
      this.nodeSummary = {
        nodeName: this.currentNode.name,
        bonusScrap: 0,
        kills: this.kills,
        score: this.score,
        isFinalNode: false,
      };
    }
  }

  _findNearestAliveCar(x, y) {
    let best = null;
    let bestDist = Infinity;
    for (const c of this.cars) {
      if (c.hp <= 0) continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  _fireCarTurret(car, aimX, aimY, targetId) {
    const ang = Math.atan2(aimY - car.y, aimX - car.x);
    const muzzleX = car.x + Math.cos(ang) * 28;
    const muzzleY = car.y + Math.sin(ang) * 28;

    this.projectiles.push({
      fromPlayer: true,
      weaponType: car.weaponType,
      targetId,
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(ang) * car.projSpeed,
      vy: Math.sin(ang) * car.projSpeed,
      damage: car.damage,
      splashRadius: car.splashRadius || 0,
      color: car.color,
      radius: car.weaponType === 'plasma' ? 6.5 : 4,
      life: 1.9,
    });

    if (this.audio && Math.random() < 0.35) {
      this.audio.playShot(car.weaponType);
    }
  }

  _applyPlayerProjectileHit(p, en) {
    let dmg = p.damage;
    if (p.weaponType === 'flak' && en.isAir) {
      dmg = Math.round(dmg * 1.6);
    }

    en.hp -= dmg;
    en.hitFlash = 0.22;

    // Apply subsystem damage if this enemy is focused
    const subKey = this.targetSubsystem || 'weapons';
    const sub = en.subsystems[subKey];
    if (sub && !sub.destroyed) {
      sub.hp = Math.max(0, sub.hp - dmg * 0.85);
      if (sub.hp <= 0) {
        sub.destroyed = true;
        this.addCallout(
          en.x,
          en.y - en.radius - 46,
          `🎯 ${subKey.toUpperCase()} CRIPPLED!`,
          '#38bdf8'
        );
        if (subKey === 'winch') {
          this.harpoons = this.harpoons.filter((h) => h.enemyId !== en.id);
        }
      }
    }

    // Flak also severs active harpoons on hit
    if (p.weaponType === 'flak' && this.harpoons.some((h) => h.enemyId === en.id)) {
      this.harpoons = this.harpoons.filter((h) => h.enemyId !== en.id);
      this.harpoonsSevered += 1;
      this.addCallout(en.x, en.y - 18, '✂ TETHER SEVERED', '#a855f7');
    }

    this.explosions.push({
      x: p.x,
      y: p.y,
      r: 6,
      maxR: p.splashRadius ? p.splashRadius * 0.65 : 28,
      color: p.color,
      alpha: 0.85,
    });

    if (en.hp <= 0) {
      this._handleEnemyDestroyed(en);
    }
  }

  _handleEnemyDestroyed(en) {
    this.enemies = this.enemies.filter((e) => e.id !== en.id);
    this.harpoons = this.harpoons.filter((h) => h.enemyId !== en.id);
    this.kills += 1;
    this.scrap += en.scrapReward;
    this.score += en.scoreReward;

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      try {
        localStorage.setItem(STORAGE_KEY_BEST, String(this.bestScore));
      } catch (_) {}
    }

    this.explosions.push({
      x: en.x,
      y: en.y,
      r: 14,
      maxR: en.isBoss ? 120 : 68,
      color: '#f59e0b',
      alpha: 1.0,
    });
    if (this.audio) this.audio.playExplosion(en.isBoss);

    this.addCallout(
      en.x,
      en.y - 20,
      `💥 +${en.scrapReward} SCRAP`,
      '#fde68a'
    );
    this.logEvent(
      `DESTROYED ${en.name} (+${en.scrapReward} Scrap, +${en.scoreReward} Score).`,
      'scoop'
    );

    if (this.selectedEnemyId === en.id) {
      this.selectedEnemyId = this.enemies[0] ? this.enemies[0].id : null;
    }
  }

  _applyEnemyHitToCar(car, damage, hx, hy) {
    let rem = damage;
    if (this.shieldHp > 0) {
      const absorbed = Math.min(this.shieldHp, rem * 0.75);
      this.shieldHp -= absorbed;
      rem -= absorbed;
      this.explosions.push({
        x: hx,
        y: hy,
        r: 8,
        maxR: 32,
        color: '#38bdf8',
        alpha: 0.75,
      });
    }
    if (rem > 0) {
      car.hp = Math.max(0, car.hp - rem);
      car.hitFlash = 0.2;
      this.explosions.push({
        x: hx,
        y: hy,
        r: 6,
        maxR: 24,
        color: '#ef4444',
        alpha: 0.8,
      });
    }
  }
}
