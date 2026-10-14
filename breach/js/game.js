// game.js — BREACH // 2099 Core Simulation, Raycast Visibility, Weapons, Door Breaching & Overclock
(function (global) {
  'use strict';

  const WEAPONS = {
    1: {
      id: 1,
      name: '1: SILENCED FLECHETTE',
      magSize: 12,
      fireDelay: 0.19,
      reloadTime: 0.95,
      damage: 55,
      speed: 1180,
      pellets: 1,
      spread: 0.015,
      noiseRadius: 95, // Suppressed — only alerts adjacent guards
      ricochet: 0,
      breachDoors: false,
      color: '#00f0ff',
      width: 2.4,
    },
    2: {
      id: 2,
      name: '2: SMART-SMG (RICOCHET)',
      magSize: 30,
      fireDelay: 0.075,
      reloadTime: 1.15,
      damage: 28,
      speed: 1080,
      pellets: 1,
      spread: 0.065,
      noiseRadius: 360,
      ricochet: 1, // Bounces once off steel bulkheads
      breachDoors: false,
      color: '#ff2a85',
      width: 2.2,
    },
    3: {
      id: 3,
      name: '3: GAUSS SCATTERGUN',
      magSize: 6,
      fireDelay: 0.52,
      reloadTime: 1.35,
      damage: 34,
      speed: 1260,
      pellets: 7,
      spread: 0.19,
      noiseRadius: 480,
      ricochet: 0,
      breachDoors: true, // Blows closed blast doors straight off their hinges
      color: '#ffb800',
      width: 3.0,
    },
  };

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  class BreachGame {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.sprites = global.BreachSprites.buildAtlases();
      this.audio = new global.BreachAudio();
      this.renderer = new global.BreachRenderer(this.canvas, this.sprites);

      this.cols = global.BreachLevels.COLS;
      this.rows = global.BreachLevels.ROWS;
      this.tileSize = global.BreachLevels.TILE_SIZE;

      this.mode = 'campaign'; // 'campaign' | 'daily'
      this.floorIndex = 0;
      this.totalCampaignScore = 0;
      this.bestScore = Number(localStorage.getItem('breach2099_best') || 0);

      this.keys = {};
      this.mouse = { x: 640, y: 360, down: false };
      this.phase = 'menu'; // 'menu' | 'playing' | 'paused' | 'cleared' | 'dead' | 'victory'

      this.hitStopTimer = 0;
      this.shakeMag = 0;
      this.shakeX = 0;
      this.shakeY = 0;
      this.elapsedTime = 0;

      this.bindUI();
      this.bindInput();
      this.loadFloor(0, 'campaign');

      // Show menu overlay initially while rendering live floor in background
      this.phase = 'menu';
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1' || params.get('demo')) {
        this.startCampaign();
        if (params.get('demo') === 'combat' || params.get('demo') === 'overclock') {
          // Position operative near central door (col=5, row=2), kick it open, and fire a burst
          this.player.x = 4.6 * this.tileSize;
          this.player.y = 2.5 * this.tileSize;
          this.mouse.x = 9.5 * this.tileSize;
          this.mouse.y = 2.5 * this.tileSize;
          this.player.angle = 0;
          this.breachTile(5, 2, 1, 0);
          this.selectWeapon(3);
          this.tryFire();
          if (params.get('demo') === 'overclock') {
            this.setOverclock(true);
            this.overclockVisual = 1.0;
          }
          this.update(0.05);
        }
      }
      this.updateHUD();

      this.lastFrame = performance.now();
      requestAnimationFrame((ts) => this.loop(ts));
    }

    bindUI() {
      const bestEl = document.getElementById('menu-best-score');
      if (bestEl) bestEl.textContent = String(this.bestScore);

      const renEl = document.getElementById('menu-renderer-tag');
      if (renEl) {
        renEl.textContent = this.renderer.isWebGL2
          ? 'WEBGL2 2.5D NORMAL + LOS SHADER'
          : 'CANVAS2D SOFTWARE FALLBACK';
      }

      document.getElementById('btn-start-campaign').addEventListener('click', () => {
        this.startCampaign();
      });
      document.getElementById('btn-start-daily').addEventListener('click', () => {
        this.startDaily();
      });
      document.getElementById('btn-mode-campaign').addEventListener('click', () => {
        this.startCampaign();
      });
      document.getElementById('btn-mode-daily').addEventListener('click', () => {
        this.startDaily();
      });
      document.getElementById('btn-mute').addEventListener('click', () => {
        this.toggleMute();
      });
      document.getElementById('btn-next-action').addEventListener('click', () => {
        this.handleNextAction();
      });
      document.getElementById('btn-retry-floor').addEventListener('click', () => {
        this.retryCurrentFloor();
      });
    }

    bindInput() {
      window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        this.keys[k] = true;

        if (k === 'm') {
          this.toggleMute();
        } else if (k === 'p' || k === 'escape') {
          if (this.phase === 'playing') {
            this.phase = 'paused';
            document.getElementById('hud-prompt').textContent =
              'SYSTEM PAUSED — PRESS [P] OR [ESC] TO RESUME';
          } else if (this.phase === 'paused') {
            this.phase = 'playing';
          }
        } else if (k === '1' || k === '2' || k === '3') {
          this.selectWeapon(Number(k));
        } else if (k === 'q') {
          const next = (this.player.weaponId % 3) + 1;
          this.selectWeapon(next);
        } else if (k === 'r') {
          if (this.phase === 'dead' || this.phase === 'cleared' || this.phase === 'victory') {
            this.retryCurrentFloor();
          } else if (this.phase === 'playing') {
            this.startReload();
          }
        } else if (k === 'e' || k === 'f') {
          if (this.phase === 'playing') {
            this.tryKickDoor();
          }
        } else if (k === ' ') {
          e.preventDefault();
          if (this.phase === 'playing') {
            this.setOverclock(true);
          }
        }
      });

      window.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        this.keys[k] = false;
        if (k === ' ') {
          this.setOverclock(false);
        }
      });

      const updateMouseWorld = (e) => {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;

        // Account for object-fit: contain letterbox/pillarbox scaling
        const canvasAspect = this.canvas.width / this.canvas.height;
        const rectAspect = rect.width / rect.height;
        let renderW = rect.width;
        let renderH = rect.height;
        let offsetX = 0;
        let offsetY = 0;

        if (rectAspect > canvasAspect) {
          renderW = rect.height * canvasAspect;
          offsetX = (rect.width - renderW) * 0.5;
        } else {
          renderH = rect.width / canvasAspect;
          offsetY = (rect.height - renderH) * 0.5;
        }

        const normX = clamp((e.clientX - rect.left - offsetX) / renderW, 0, 1);
        const normY = clamp((e.clientY - rect.top - offsetY) / renderH, 0, 1);
        this.mouse.x = normX * this.canvas.width;
        this.mouse.y = normY * this.canvas.height;
      };

      this.canvas.addEventListener('mousemove', updateMouseWorld);
      this.canvas.addEventListener('mousedown', (e) => {
        updateMouseWorld(e);
        if (e.button === 0) {
          this.mouse.down = true;
          if (this.phase === 'playing') {
            this.tryFire();
          }
        } else if (e.button === 2) {
          e.preventDefault();
          if (this.phase === 'playing') {
            this.setOverclock(!this.overclockActive);
          }
        } else if (e.button === 1) {
          e.preventDefault();
          if (this.phase === 'playing') {
            this.tryKickDoor();
          }
        }
      });

      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) {
          this.mouse.down = false;
        }
      });

      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    toggleMute() {
      const m = this.audio.setMuted(!this.audio.muted);
      const btn = document.getElementById('btn-mute');
      if (btn) btn.textContent = m ? '🔇' : '🔊';
    }

    startCampaign() {
      this.mode = 'campaign';
      this.totalCampaignScore = 0;
      document.getElementById('btn-mode-campaign').classList.add('active');
      document.getElementById('btn-mode-daily').classList.remove('active');
      this.loadFloor(0, 'campaign');
      this.hideOverlays();
      this.phase = 'playing';
    }

    startDaily() {
      this.mode = 'daily';
      this.totalCampaignScore = 0;
      document.getElementById('btn-mode-daily').classList.add('active');
      document.getElementById('btn-mode-campaign').classList.remove('active');
      this.loadFloor(0, 'daily');
      this.hideOverlays();
      this.phase = 'playing';
    }

    retryCurrentFloor() {
      this.loadFloor(this.floorIndex, this.mode);
      this.hideOverlays();
      this.phase = 'playing';
    }

    handleNextAction() {
      if (this.mode === 'campaign' && this.floorIndex + 1 < global.BreachLevels.CAMPAIGN_FLOORS.length) {
        this.loadFloor(this.floorIndex + 1, 'campaign');
        this.hideOverlays();
        this.phase = 'playing';
      } else {
        this.startCampaign();
      }
    }

    hideOverlays() {
      document.getElementById('overlay-menu').classList.remove('visible');
      document.getElementById('overlay-status').classList.remove('visible');
    }

    loadFloor(idx, mode) {
      this.floorIndex = idx;
      this.mode = mode;

      const levelDef =
        mode === 'daily'
          ? global.BreachLevels.buildDailyContract()
          : global.BreachLevels.CAMPAIGN_FLOORS[idx];

      this.levelId = levelDef.id;
      this.levelName = levelDef.name;
      this.floorTile = levelDef.floorTile;
      this.ambient = levelDef.ambient.slice();
      this.grid = levelDef.map.map((row) => row.split(''));

      // Locate spawn pad 'E'
      this.spawnPad = { x: 1.5 * this.tileSize, y: 1.5 * this.tileSize };
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          if (this.grid[r][c] === 'E') {
            this.spawnPad = {
              x: (c + 0.5) * this.tileSize,
              y: (r + 0.5) * this.tileSize,
            };
          }
        }
      }

      this.player = {
        x: this.spawnPad.x,
        y: this.spawnPad.y,
        vx: 0,
        vy: 0,
        radius: 16,
        angle: 0,
        hp: 100,
        maxHp: 100,
        overclock: 100,
        weaponId: 1,
        ammo: { 1: 12, 2: 30, 3: 6 },
        fireCooldown: 0,
        reloadTimer: 0,
        hitFlash: 0,
      };

      this.overclockActive = false;
      this.overclockVisual = 0;
      this.audio.setOverclock(false);

      this.enemies = levelDef.spawns.map((s, i) => {
        const isHeavy = s.type === 'heavy';
        const isExec = s.type === 'exec';
        const isTurret = s.type === 'turret';
        return {
          id: i,
          x: (s.col + 0.5) * this.tileSize,
          y: (s.row + 0.5) * this.tileSize,
          type: s.type,
          angle: s.angle || 0,
          hp: isExec ? 150 : isHeavy ? 115 : isTurret ? 90 : 50,
          maxHp: isExec ? 150 : isHeavy ? 115 : isTurret ? 90 : 50,
          speed: isTurret ? 0 : isHeavy ? 105 : isExec ? 145 : 135,
          fireCooldown: 0.4 + (i % 3) * 0.2,
          alerted: false,
          stunTimer: 0,
          hitFlash: 0,
          patrolTimer: 1.5 + (i % 4) * 0.6,
        };
      });

      this.staticLights = levelDef.lights.map((L) => ({
        x: L.col * this.tileSize,
        y: L.row * this.tileSize,
        color: L.color,
        radius: L.radius,
        intensity: L.intensity,
      }));
      this.dynamicLights = [];
      this.activeLights = [];

      this.bullets = [];
      this.particles = [];
      this.decals = [];
      this.corpses = [];
      this.callouts = [];

      this.floorScore = 0;
      this.combo = 1;
      this.maxCombo = 1;
      this.comboTimer = 0;
      this.floorTime = 0;
      this.enemiesRemaining = this.enemies.length;

      this.computeVisibilityPolygon();
      this.updateHUD();
    }

    selectWeapon(id) {
      if (!WEAPONS[id] || this.player.weaponId === id) return;
      this.player.weaponId = id;
      this.player.reloadTimer = 0;
      this.updateHUD();
    }

    startReload() {
      const w = WEAPONS[this.player.weaponId];
      if (this.player.reloadTimer > 0 || this.player.ammo[w.id] === w.magSize) return;
      this.player.reloadTimer = w.reloadTime;
      this.addCallout(this.player.x, this.player.y - 26, 'RELOADING...', '#ffb800');
      this.updateHUD();
    }

    setOverclock(flag) {
      const next = !!flag && this.player.overclock > 8;
      if (next !== this.overclockActive) {
        this.overclockActive = next;
        this.audio.setOverclock(next);
        this.audio.playOverclockToggle(next);
      }
    }

    addDynamicLight(x, y, color, radius, intensity, life) {
      this.dynamicLights.push({ x, y, color, radius, intensity, life, maxLife: life });
    }

    addCallout(x, y, text, color) {
      this.callouts.push({ x, y, text, color, life: 0.85, maxLife: 0.85 });
    }

    isSolidTile(c, r) {
      if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return true;
      const t = this.grid[r][c];
      return t === '#' || t === 'D' || t === 'G' || t === 'S' || t === 'T';
    }

    isBulletBlockingTile(c, r) {
      if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return true;
      const t = this.grid[r][c];
      // Bullets fly over low executive desks ('T')
      return t === '#' || t === 'D' || t === 'G' || t === 'S';
    }

    isOpaqueTile(c, r) {
      if (c < 0 || c >= this.cols || r < 0 || r >= this.rows) return true;
      const t = this.grid[r][c];
      // Glass ('G') and low desks ('T') let light and vision through!
      return t === '#' || t === 'D' || t === 'S';
    }

    raycast(x0, y0, angle, maxDist, blockFn) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const step = 6;
      let dist = 0;
      let x = x0;
      let y = y0;
      while (dist < maxDist) {
        x = x0 + dx * dist;
        y = y0 + dy * dist;
        const c = Math.floor(x / this.tileSize);
        const r = Math.floor(y / this.tileSize);
        if (blockFn.call(this, c, r)) {
          return { x, y, dist, col: c, row: r, hit: true };
        }
        dist += step;
      }
      return {
        x: x0 + dx * maxDist,
        y: y0 + dy * maxDist,
        dist: maxDist,
        col: -1,
        row: -1,
        hit: false,
      };
    }

    computeVisibilityPolygon() {
      const rays = 140;
      const poly = [];
      for (let i = 0; i < rays; i++) {
        const ang = (i / rays) * Math.PI * 2;
        const res = this.raycast(this.player.x, this.player.y, ang, 720, this.isOpaqueTile);
        poly.push({ x: res.x, y: res.y });
      }
      this.visibilityPoly = poly;
      this.laserEnd = this.raycast(
        this.player.x,
        this.player.y,
        this.player.angle,
        680,
        this.isBulletBlockingTile
      );
    }

    tryKickDoor() {
      const reach = 74;
      const checkAngles = [0, -0.35, 0.35];
      for (let i = 0; i < checkAngles.length; i++) {
        const ang = this.player.angle + checkAngles[i];
        const tx = this.player.x + Math.cos(ang) * reach;
        const ty = this.player.y + Math.sin(ang) * reach;
        const c = Math.floor(tx / this.tileSize);
        const r = Math.floor(ty / this.tileSize);
        if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) {
          const tile = this.grid[r][c];
          if (tile === 'D' || tile === 'G') {
            this.breachTile(c, r, Math.cos(this.player.angle), Math.sin(this.player.angle));
            return;
          }
        }
      }

      // Also check any adjacent tile within 1 cell
      const pc = Math.floor(this.player.x / this.tileSize);
      const pr = Math.floor(this.player.y / this.tileSize);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dc, dr] of dirs) {
        const nc = pc + dc;
        const nr = pr + dr;
        if (nc >= 0 && nc < this.cols && nr >= 0 && nr < this.rows) {
          if (this.grid[nr][nc] === 'D') {
            this.breachTile(nc, nr, dc, dr);
            return;
          }
        }
      }
    }

    breachTile(c, r, dirX, dirY) {
      const tile = this.grid[r][c];
      this.grid[r][c] = '.';
      const wx = (c + 0.5) * this.tileSize;
      const wy = (r + 0.5) * this.tileSize;

      if (tile === 'D') {
        this.audio.playDoorBreach();
        this.shakeMag = Math.max(this.shakeMag, 11);
        this.addDynamicLight(wx, wy, [1.0, 0.58, 0.12], 320, 2.2, 0.25);
        this.particles.push({
          x: wx,
          y: wy,
          ring: true,
          radius: 135,
          color: '#ffb800',
          life: 0.25,
          maxLife: 0.25,
        });
        this.addCallout(wx, wy - 18, 'DOOR BREACHED!', '#ffb800');

        // Stun & knock back any guard within 155px of the breached door
        this.enemies.forEach((en) => {
          if (en.hp <= 0) return;
          const d = Math.hypot(en.x - wx, en.y - wy);
          if (d < 155) {
            en.stunTimer = 2.6;
            en.alerted = true;
            en.hp -= 20;
            this.addCallout(en.x, en.y - 20, '⚡ BREACH STUN', '#00f0ff');
            if (en.hp <= 0) {
              this.handleEnemyKilled(en, dirX, dirY, true);
            }
          } else if (d < 340) {
            en.alerted = true;
          }
        });
      } else if (tile === 'G') {
        this.audio.playGlassShatter();
        this.shakeMag = Math.max(this.shakeMag, 5);
        for (let i = 0; i < 14; i++) {
          this.decals.push({
            kind: 'glass',
            x: wx + (Math.random() - 0.5) * 44,
            y: wy + (Math.random() - 0.5) * 44,
            angle: Math.random() * Math.PI,
            size: 5 + Math.random() * 5,
            color: 'rgba(0, 240, 255, 0.55)',
          });
        }
      }
    }

    tryFire() {
      if (this.player.hp <= 0 || this.player.fireCooldown > 0 || this.player.reloadTimer > 0) return;
      const w = WEAPONS[this.player.weaponId];
      if (this.player.ammo[w.id] <= 0) {
        this.startReload();
        return;
      }

      this.player.ammo[w.id]--;
      this.player.fireCooldown = w.fireDelay;

      const muzX = this.player.x + Math.cos(this.player.angle) * 26;
      const muzY = this.player.y + Math.sin(this.player.angle) * 26;

      this.audio.playGunshot(w.id);
      this.shakeMag = Math.max(this.shakeMag, w.id === 3 ? 9.5 : w.id === 2 ? 4.0 : 2.5);

      const lightCol =
        w.id === 1 ? [0.0, 0.95, 1.0] : w.id === 2 ? [1.0, 0.2, 0.65] : [1.0, 0.72, 0.15];
      this.addDynamicLight(muzX, muzY, lightCol, w.id === 3 ? 310 : 220, 1.9, 0.09);

      // Eject spent brass casing onto persistent floor decal buffer
      const sideAng = this.player.angle + Math.PI * 0.5 + (Math.random() - 0.5) * 0.4;
      this.decals.push({
        kind: 'casing',
        x: this.player.x + Math.cos(sideAng) * (14 + Math.random() * 10),
        y: this.player.y + Math.sin(sideAng) * (14 + Math.random() * 10),
        angle: Math.random() * Math.PI,
        size: 5,
        color: '#eab308',
      });

      for (let p = 0; p < w.pellets; p++) {
        const spreadOffset = (Math.random() - 0.5) * w.spread;
        const shotAngle = this.player.angle + spreadOffset;
        this.bullets.push({
          x: muzX,
          y: muzY,
          vx: Math.cos(shotAngle) * w.speed,
          vy: Math.sin(shotAngle) * w.speed,
          damage: w.damage,
          fromPlayer: true,
          bouncesLeft: w.ricochet,
          breachDoors: w.breachDoors,
          color: w.color,
          width: w.width,
          life: 0.85,
        });
      }

      // Alert enemies within weapon noise radius
      this.enemies.forEach((en) => {
        if (en.hp <= 0) return;
        const d = Math.hypot(en.x - this.player.x, en.y - this.player.y);
        if (d <= w.noiseRadius) {
          en.alerted = true;
        }
      });

      if (this.player.ammo[w.id] === 0) {
        this.startReload();
      }
      this.updateHUD();
    }

    handleEnemyKilled(en, dirX, dirY, isBreachKill) {
      en.hp = 0;
      this.enemiesRemaining = this.enemies.filter((e) => e.hp > 0).length;

      // Hit-stop micro-freeze for tactile punch
      this.hitStopTimer = 0.032;
      this.shakeMag = Math.max(this.shakeMag, 7.5);

      // Persistent neon-crimson + cyber-coolant blood pool on floor
      for (let i = 0; i < 4; i++) {
        this.decals.push({
          kind: 'blood',
          x: en.x + (Math.random() - 0.5) * 26,
          y: en.y + (Math.random() - 0.5) * 26,
          angle: 0,
          size: 7 + Math.random() * 9,
          color: i === 0 ? 'rgba(0, 240, 255, 0.48)' : 'rgba(220, 20, 60, 0.68)',
        });
      }

      this.corpses.push({
        x: en.x + dirX * 10,
        y: en.y + dirY * 10,
        angle: Math.atan2(dirY, dirX),
      });

      // Recharge Adrenaline Overclock on kills
      this.player.overclock = clamp(this.player.overclock + 22, 0, 100);

      // Score & combo escalation
      const basePts = en.type === 'exec' ? 500 : en.type === 'heavy' ? 250 : 150;
      const bonus = isBreachKill ? 200 : this.overclockActive ? 100 : 0;
      const pts = (basePts + bonus) * this.combo;
      this.floorScore += pts;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.comboTimer = 3.6;

      this.audio.playKillConfirm(this.combo);
      this.addCallout(
        en.x,
        en.y - 16,
        `+${pts} ${this.combo > 2 ? 'x' + this.combo : ''}`,
        en.type === 'exec' ? '#ffb800' : '#00ff9d'
      );

      if (this.enemiesRemaining === 0) {
        this.completeFloor();
      }
      this.updateHUD();
    }

    completeFloor() {
      this.setOverclock(false);
      const timeBonus = Math.max(0, Math.round((45 - this.floorTime) * 40));
      this.floorScore += timeBonus;
      this.totalCampaignScore += this.floorScore;

      if (this.totalCampaignScore > this.bestScore) {
        this.bestScore = this.totalCampaignScore;
        localStorage.setItem('breach2099_best', String(this.bestScore));
        const bestEl = document.getElementById('menu-best-score');
        if (bestEl) bestEl.textContent = String(this.bestScore);
      }

      const rank =
        this.maxCombo >= 6 && this.floorTime < 28
          ? 'S+'
          : this.maxCombo >= 4
          ? 'S'
          : this.floorTime < 40
          ? 'A'
          : 'B';

      const isFinalCampaign =
        this.mode === 'campaign' &&
        this.floorIndex + 1 >= global.BreachLevels.CAMPAIGN_FLOORS.length;

      this.phase = isFinalCampaign || this.mode === 'daily' ? 'victory' : 'cleared';

      document.getElementById('status-eyebrow').textContent =
        this.phase === 'victory' ? 'MEGACITY SPIRE SECURED' : 'SECTOR SECURED';
      document.getElementById('status-title').textContent =
        this.phase === 'victory' ? 'CONTRACT COMPLETE' : 'FLOOR CLEARED';
      document.getElementById('status-desc').textContent =
        this.phase === 'victory'
          ? `Total Contract Score: ${this.totalCampaignScore.toLocaleString()} PTS`
          : 'All syndicate hostiles neutralized. Ascend to the next Spire floor.';

      document.getElementById('stat-score').textContent = this.floorScore.toLocaleString();
      document.getElementById('stat-combo').textContent = 'x' + this.maxCombo;
      document.getElementById('stat-time').textContent = this.floorTime.toFixed(1) + 's';
      document.getElementById('stat-rank').textContent = rank;

      const nextBtn = document.getElementById('btn-next-action');
      nextBtn.textContent =
        this.phase === 'victory' ? 'NEW SPIRE CAMPAIGN' : 'BREACH NEXT FLOOR';

      document.getElementById('overlay-status').classList.add('visible');
      this.updateHUD();
    }

    triggerPlayerDeath() {
      this.setOverclock(false);
      this.phase = 'dead';
      document.getElementById('status-eyebrow').textContent = 'BIOMONITOR FLATLINE // KIA';
      document.getElementById('status-title').textContent = 'OPERATIVE DOWN';
      document.getElementById('status-desc').textContent =
        'Use [E] to kick doors into guards and [SPACE] Adrenaline Overclock before breaching crossfire.';
      document.getElementById('stat-score').textContent = this.floorScore.toLocaleString();
      document.getElementById('stat-combo').textContent = 'x' + this.maxCombo;
      document.getElementById('stat-time').textContent = this.floorTime.toFixed(1) + 's';
      document.getElementById('stat-rank').textContent = 'F';
      document.getElementById('btn-next-action').textContent = 'RESTART CAMPAIGN';
      document.getElementById('overlay-status').classList.add('visible');
      this.updateHUD();
    }

    moveWithCollisions(entity, dx, dy, radius) {
      const tryAxis = (nx, ny) => {
        const minC = Math.floor((nx - radius) / this.tileSize);
        const maxC = Math.floor((nx + radius) / this.tileSize);
        const minR = Math.floor((ny - radius) / this.tileSize);
        const maxR = Math.floor((ny + radius) / this.tileSize);
        for (let r = minR; r <= maxR; r++) {
          for (let c = minC; c <= maxC; c++) {
            if (this.isSolidTile(c, r)) return false;
          }
        }
        return true;
      };

      if (tryAxis(entity.x + dx, entity.y)) entity.x += dx;
      if (tryAxis(entity.x, entity.y + dy)) entity.y += dy;
    }

    update(rawDt) {
      this.elapsedTime += rawDt;

      // Decay camera shake
      if (this.shakeMag > 0.1) {
        this.shakeX = (Math.random() - 0.5) * this.shakeMag * 2;
        this.shakeY = (Math.random() - 0.5) * this.shakeMag * 2;
        this.shakeMag *= Math.pow(0.001, rawDt);
      } else {
        this.shakeMag = 0;
        this.shakeX = 0;
        this.shakeY = 0;
      }

      if (this.phase !== 'playing') {
        this.activeLights = this.staticLights.slice();
        return;
      }

      if (this.hitStopTimer > 0) {
        this.hitStopTimer -= rawDt;
        return;
      }

      // Adrenaline Overclock time dilation
      if (this.overclockActive) {
        this.player.overclock = Math.max(0, this.player.overclock - rawDt * 28);
        if (this.player.overclock <= 0) {
          this.setOverclock(false);
        }
      } else {
        this.player.overclock = Math.min(100, this.player.overclock + rawDt * 9);
      }

      this.overclockVisual += ((this.overclockActive ? 1.0 : 0.0) - this.overclockVisual) * Math.min(1, rawDt * 12);
      const worldDt = rawDt * (this.overclockActive ? 0.30 : 1.0);
      const playerDt = rawDt * (this.overclockActive ? 0.72 : 1.0);

      this.floorTime += worldDt;

      // Combo decay
      if (this.combo > 1) {
        this.comboTimer -= worldDt;
        if (this.comboTimer <= 0) {
          this.combo = 1;
          this.updateHUD();
        }
      }

      // Operative movement & aiming
      let mx = 0;
      let my = 0;
      if (this.keys['w'] || this.keys['arrowup']) my -= 1;
      if (this.keys['s'] || this.keys['arrowdown']) my += 1;
      if (this.keys['a'] || this.keys['arrowleft']) mx -= 1;
      if (this.keys['d'] || this.keys['arrowright']) mx += 1;
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        mx /= len;
        my /= len;
      }

      const moveSpeed = 245;
      this.moveWithCollisions(
        this.player,
        mx * moveSpeed * playerDt,
        my * moveSpeed * playerDt,
        this.player.radius
      );

      this.player.angle = Math.atan2(
        this.mouse.y - this.player.y,
        this.mouse.x - this.player.x
      );

      if (this.player.fireCooldown > 0) this.player.fireCooldown -= playerDt;
      if (this.player.hitFlash > 0) this.player.hitFlash -= rawDt * 4;

      if (this.player.reloadTimer > 0) {
        this.player.reloadTimer -= playerDt;
        if (this.player.reloadTimer <= 0) {
          const w = WEAPONS[this.player.weaponId];
          this.player.ammo[w.id] = w.magSize;
          this.updateHUD();
        }
      }

      if (this.mouse.down && this.player.fireCooldown <= 0) {
        this.tryFire();
      }

      // Update Bullets
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        const dt = b.fromPlayer ? playerDt : worldDt;
        const steps = 3;
        let removed = false;

        for (let s = 0; s < steps && !removed; s++) {
          const nx = b.x + (b.vx * dt) / steps;
          const ny = b.y + (b.vy * dt) / steps;
          const c = Math.floor(nx / this.tileSize);
          const r = Math.floor(ny / this.tileSize);

          if (this.isBulletBlockingTile(c, r)) {
            const tile = c >= 0 && c < this.cols && r >= 0 && r < this.rows ? this.grid[r][c] : '#';
            if (tile === 'G') {
              this.breachTile(c, r, Math.sign(b.vx), Math.sign(b.vy));
            } else if (tile === 'D' && b.breachDoors) {
              this.breachTile(c, r, Math.sign(b.vx), Math.sign(b.vy));
            } else if (b.bouncesLeft > 0) {
              b.bouncesLeft--;
              const prevC = Math.floor(b.x / this.tileSize);
              if (prevC !== c) b.vx = -b.vx;
              else b.vy = -b.vy;
              this.addDynamicLight(b.x, b.y, [1.0, 0.3, 0.75], 120, 1.2, 0.08);
            } else {
              this.addDynamicLight(b.x, b.y, [0.9, 0.8, 0.5], 95, 1.0, 0.06);
              removed = true;
            }
          } else {
            b.x = nx;
            b.y = ny;

            if (b.fromPlayer) {
              for (let j = 0; j < this.enemies.length; j++) {
                const en = this.enemies[j];
                if (en.hp <= 0) continue;
                if (Math.hypot(en.x - b.x, en.y - b.y) < 20) {
                  en.hp -= b.damage;
                  en.hitFlash = 1.0;
                  en.alerted = true;
                  removed = true;
                  if (en.hp <= 0) {
                    const len = Math.hypot(b.vx, b.vy) || 1;
                    this.handleEnemyKilled(en, b.vx / len, b.vy / len, false);
                  }
                  break;
                }
              }
            } else {
              if (Math.hypot(this.player.x - b.x, this.player.y - b.y) < 17) {
                this.player.hp = Math.max(0, this.player.hp - b.damage);
                this.player.hitFlash = 1.0;
                this.shakeMag = Math.max(this.shakeMag, 8.0);
                removed = true;
                this.updateHUD();
                if (this.player.hp <= 0) {
                  this.triggerPlayerDeath();
                }
              }
            }
          }
        }

        b.life -= dt;
        if (b.life <= 0 || removed) {
          this.bullets.splice(i, 1);
        }
      }

      // Update Enemy Tactical AI
      this.enemies.forEach((en) => {
        if (en.hp <= 0) return;
        if (en.hitFlash > 0) en.hitFlash -= rawDt * 4;
        if (en.stunTimer > 0) {
          en.stunTimer -= worldDt;
          return;
        }

        const dx = this.player.x - en.x;
        const dy = this.player.y - en.y;
        const dist = Math.hypot(dx, dy);
        const angleToPlayer = Math.atan2(dy, dx);

        // Check line of sight to player
        let angleDiff = Math.atan2(
          Math.sin(angleToPlayer - en.angle),
          Math.cos(angleToPlayer - en.angle)
        );
        const inVisionCone = Math.abs(angleDiff) < 1.15 || en.alerted || dist < 110;

        let canSeePlayer = false;
        if (dist < 560 && inVisionCone) {
          const ray = this.raycast(en.x, en.y, angleToPlayer, dist, this.isOpaqueTile);
          if (!ray.hit || ray.dist >= dist - 18) {
            canSeePlayer = true;
            en.alerted = true;
          }
        }

        if (canSeePlayer) {
          en.angle = angleToPlayer;
          if (en.type !== 'turret' && dist > 165) {
            this.moveWithCollisions(
              en,
              Math.cos(en.angle) * en.speed * worldDt,
              Math.sin(en.angle) * en.speed * worldDt,
              15
            );
          }

          en.fireCooldown -= worldDt;
          if (en.fireCooldown <= 0) {
            en.fireCooldown =
              en.type === 'heavy' ? 0.35 : en.type === 'turret' ? 0.28 : 0.62;
            const spread = (Math.random() - 0.5) * 0.14;
            const sAng = en.angle + spread;
            this.bullets.push({
              x: en.x + Math.cos(en.angle) * 22,
              y: en.y + Math.sin(en.angle) * 22,
              vx: Math.cos(sAng) * 640,
              vy: Math.sin(sAng) * 640,
              damage: en.type === 'heavy' ? 16 : 12,
              fromPlayer: false,
              bouncesLeft: 0,
              breachDoors: false,
              color: '#ff3b30',
              width: 2.5,
              life: 1.1,
            });
            this.addDynamicLight(en.x, en.y, [1.0, 0.25, 0.2], 190, 1.4, 0.08);
          }
        } else if (en.alerted && en.type !== 'turret') {
          // Move toward player's last known direction if alerted by gunfire
          en.angle = angleToPlayer;
          this.moveWithCollisions(
            en,
            Math.cos(en.angle) * en.speed * 0.75 * worldDt,
            Math.sin(en.angle) * en.speed * 0.75 * worldDt,
            15
          );
        } else if (en.type !== 'turret') {
          en.patrolTimer -= worldDt;
          if (en.patrolTimer <= 0) {
            en.patrolTimer = 2.0 + Math.random() * 1.5;
            en.angle += Math.PI * 0.5;
          }
        }
      });

      // Update particles, callouts, and dynamic point lights
      for (let i = this.particles.length - 1; i >= 0; i--) {
        this.particles[i].life -= rawDt;
        if (this.particles[i].life <= 0) this.particles.splice(i, 1);
      }
      for (let i = this.callouts.length - 1; i >= 0; i--) {
        this.callouts[i].y -= rawDt * 24;
        this.callouts[i].life -= rawDt;
        if (this.callouts[i].life <= 0) this.callouts.splice(i, 1);
      }
      for (let i = this.dynamicLights.length - 1; i >= 0; i--) {
        const L = this.dynamicLights[i];
        L.life -= rawDt;
        L.intensity = Math.max(0, (L.life / L.maxLife) * 1.9);
        if (L.life <= 0) this.dynamicLights.splice(i, 1);
      }

      this.activeLights = this.dynamicLights.concat(this.staticLights);
      this.computeVisibilityPolygon();
      this.updateHUD();
    }

    updateHUD() {
      const w = WEAPONS[this.player.weaponId];
      document.getElementById('hud-sector-name').textContent = this.levelName;
      document.getElementById('bar-health').style.width = `${this.player.hp}%`;
      document.getElementById('val-health').textContent = String(Math.ceil(this.player.hp));
      document.getElementById('bar-overclock').style.width = `${this.player.overclock}%`;
      document.getElementById('val-overclock').textContent = `${Math.round(this.player.overclock)}%`;

      document.getElementById('hud-weapon').textContent = w.name;
      document.getElementById('hud-ammo').textContent =
        this.player.reloadTimer > 0
          ? 'RELOADING MAGAZINE...'
          : `MAG: ${this.player.ammo[w.id]} / ${w.magSize} · [R] RELOAD`;

      document.getElementById('hud-hostiles').textContent = String(
        this.enemiesRemaining
      ).padStart(2, '0');
      document.getElementById('hud-score').textContent = String(
        this.totalCampaignScore + this.floorScore
      ).padStart(6, '0');
      document.getElementById('hud-combo').textContent = 'x' + this.combo;
      document.getElementById('hud-seed').textContent = 'SEED: ' + this.levelId;
    }

    loop(ts) {
      const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastFrame) / 1000));
      this.lastFrame = ts;

      this.update(dt);
      this.renderer.render(this);

      requestAnimationFrame((nextTs) => this.loop(nextTs));
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    global.breachGame = new BreachGame();
  });
})(window);
