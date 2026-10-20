// ============================================================================
// IRONWAKE // CONVOY — Main Application & HUD Controller
// ============================================================================

import {
  STEAM_SYSTEMS,
  TOTAL_STEAM_BARS,
  SUBSYSTEM_TYPES,
  SECTOR_NODES,
} from './config.js';
import { IronwakeSim } from './sim.js';
import { IronwakeRenderer } from './renderer.js';
import { IronwakeAudio } from './audio.js';

const COMMANDER_QUOTES = [
  '"Harpoon rigs on the starboard salt flat! Keep steam in the Skyburst Flak Wagon and sever those cables!"',
  '"Canyon ambushes ahead — route steam to Aegis Void Shields or target their weapon mounts first!"',
  '"Valkyrie gyrocopters incoming! 88mm proximity flak shreds their rotors for 1.6× damage."',
  '"Goliath Siege Crawler on the ridge! Melt its harpoon winch and main cannon with the Hellfire Plasma Mortar!"',
];

class IronwakeApp {
  constructor() {
    this.audio = new IronwakeAudio();
    this.sim = new IronwakeSim(this.audio);
    this.canvas = document.getElementById('convoy-canvas');
    this.renderer = new IronwakeRenderer(this.canvas);
    this.lastFrameTime = performance.now();
    this.uiAccum = 0;

    this._bindEvents();

    const params = new URLSearchParams(window.location.search);
    if (params.get('preview') === 'showcase') {
      this._setupShowcaseState();
    }

    this._syncFullUI();
    requestAnimationFrame((t) => this._loop(t));
  }

  _setupShowcaseState() {
    // Advance into intense combat with Goliath Siege Crawler Boss, Gyrocopter, Harpoon Rig & active tether
    this.sim.enemies = [];
    const boss = this.sim.spawnEnemy('boss', 960, 175);
    const gyro = this.sim.spawnEnemy('gyro', 430, 165);
    const harp = this.sim.spawnEnemy('harpoon', 690, 745);
    const skiff = this.sim.spawnEnemy('skiff', 1050, 735);

    if (boss) {
      boss.hp = 640;
      this.sim.selectedEnemyId = boss.id;
    }
    if (harp) {
      this.sim.harpoons.push({
        id: 'hp_showcase',
        enemyId: harp.id,
        carId: 'flak',
        hp: 45,
      });
    }
    this.sim.cars[1].weaponLevel = 2;
    this.sim.cars[2].weaponLevel = 2;
    this.sim.score = 2480;
    this.sim.kills = 6;
    this.sim.scrap = 240;

    for (let i = 0; i < 16; i++) {
      this.sim.step(0.08);
    }
    this.sim.explosions.push({
      x: 940,
      y: 190,
      r: 28,
      maxR: 72,
      color: '#f59e0b',
      alpha: 0.9,
    });
  }

  _bindEvents() {
    const unlock = () => this.audio.ensureContext();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });

    this.canvas.addEventListener('mousemove', (e) => {
      const pt = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.sim.aimWorld = pt;

      let hoverEn = null;
      for (const en of this.sim.enemies) {
        if (Math.hypot(en.x - pt.x, en.y - pt.y) <= en.radius + 14) {
          hoverEn = en.id;
          break;
        }
      }
      this.renderer.hoverEnemyId = hoverEn;

      let hoverCar = null;
      for (const car of this.sim.cars) {
        if (
          Math.abs(pt.x - car.x) <= car.width * 0.52 &&
          Math.abs(pt.y - car.y) <= car.height * 0.58
        ) {
          hoverCar = car.id;
          break;
        }
      }
      this.renderer.hoverCarId = hoverCar;
    });

    this.canvas.addEventListener('click', (e) => {
      const pt = this.renderer.screenToWorld(e.clientX, e.clientY);

      // Check enemy click -> designate primary focus target
      for (const en of this.sim.enemies) {
        if (Math.hypot(en.x - pt.x, en.y - pt.y) <= en.radius + 18) {
          this.sim.selectedEnemyId = en.id;
          this.audio.playClick();
          this.sim.addCallout(en.x, en.y - 30, '🎯 TARGET LOCKED', '#fde047');
          this._syncFullUI();
          return;
        }
      }

      // Check railcar click -> select car for inspection/upgrade
      for (const car of this.sim.cars) {
        if (
          Math.abs(pt.x - car.x) <= car.width * 0.55 &&
          Math.abs(pt.y - car.y) <= car.height * 0.65
        ) {
          this.sim.selectedCarId = car.id;
          this.audio.playClick();
          this._syncFullUI();
          return;
        }
      }
    });

    document.getElementById('btn-pause').addEventListener('click', () => {
      this.sim.paused = !this.sim.paused;
      this._syncSpeedButtons();
    });
    document.getElementById('btn-speed-1').addEventListener('click', () => {
      this.sim.paused = false;
      this.sim.speed = 1;
      this._syncSpeedButtons();
    });
    document.getElementById('btn-speed-2').addEventListener('click', () => {
      this.sim.paused = false;
      this.sim.speed = 2;
      this._syncSpeedButtons();
    });

    const btnAudio = document.getElementById('btn-audio');
    btnAudio.addEventListener('click', () => {
      const enabled = this.audio.toggleMute();
      btnAudio.textContent = enabled ? 'SOUND: ON' : 'SOUND: OFF';
      btnAudio.classList.toggle('active', enabled);
    });

    document.getElementById('btn-overdrive-cta').addEventListener('click', () => {
      this.sim.triggerOverdriveBarrage();
      this._syncFullUI();
    });

    // Commander Tactical Orders
    document.getElementById('ord-flak').addEventListener('click', () => {
      this.sim.triggerSeverHarpoons();
      this._syncFullUI();
    });
    document.getElementById('ord-purge').addEventListener('click', () => {
      this.sim.triggerThermalPurge();
      this._syncFullUI();
    });
    document.getElementById('ord-overdrive').addEventListener('click', () => {
      this.sim.triggerOverdriveBarrage();
      this._syncFullUI();
    });

    // Steam Presets
    document.querySelectorAll('.btn-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sim.setSteamPreset(btn.dataset.preset);
        this._syncFullUI();
      });
    });

    // Upgrade Selected Car
    document.getElementById('btn-upgrade-car').addEventListener('click', () => {
      this.sim.upgradeSelectedCar();
      this._syncFullUI();
    });

    // Jump to Next Sector Node
    document.getElementById('btn-next-sector').addEventListener('click', () => {
      this.sim.advanceToNextNode();
      this._syncFullUI();
    });

    // Modal continue
    document.getElementById('btn-modal-continue').addEventListener('click', () => {
      if (this.sim.gameOver) {
        this.sim.resetCampaign();
      } else {
        this.sim.advanceToNextNode();
      }
      this._syncFullUI();
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (['1', '2', '3', '4', '5'].includes(k)) {
        const idx = Number(k) - 1;
        if (this.sim.cars[idx]) {
          this.sim.selectedCarId = this.sim.cars[idx].id;
          this.audio.playClick();
          this._syncFullUI();
        }
      } else if (k === 'q') {
        this.sim.triggerSeverHarpoons();
        this._syncFullUI();
      } else if (k === 'w') {
        this.sim.triggerThermalPurge();
        this._syncFullUI();
      } else if (k === 'e' || e.code === 'Space') {
        if (e.code === 'Space') e.preventDefault();
        if (this.sim.nodeSummary) {
          if (this.sim.gameOver) this.sim.resetCampaign();
          else this.sim.advanceToNextNode();
        } else {
          this.sim.triggerOverdriveBarrage();
        }
        this._syncFullUI();
      } else if (k === 'u') {
        this.sim.upgradeSelectedCar();
        this._syncFullUI();
      } else if (k === 'n') {
        this.sim.advanceToNextNode();
        this._syncFullUI();
      } else if (k === 'z') {
        this.sim.targetSubsystem = 'weapons';
        this._syncFullUI();
      } else if (k === 'x') {
        this.sim.targetSubsystem = 'engine';
        this._syncFullUI();
      } else if (k === 'c') {
        this.sim.targetSubsystem = 'winch';
        this._syncFullUI();
      } else if (k === 'p') {
        this.sim.paused = !this.sim.paused;
        this._syncSpeedButtons();
      }
    });
  }

  _syncSpeedButtons() {
    document
      .getElementById('btn-pause')
      .classList.toggle('active', this.sim.paused);
    document
      .getElementById('btn-speed-1')
      .classList.toggle('active', !this.sim.paused && this.sim.speed === 1);
    document
      .getElementById('btn-speed-2')
      .classList.toggle('active', !this.sim.paused && this.sim.speed === 2);
  }

  _syncTopBar() {
    const hull = this.sim.getTotalHullHp();
    document.getElementById('hud-sector').textContent =
      `${this.sim.nodeIndex + 1} / ${SECTOR_NODES.length}`;
    document.getElementById('hud-speed').textContent =
      `${this.sim.getTrainSpeedMph()} MPH`;
    document.getElementById('hud-distance').textContent =
      `${this.sim.distanceTraveledKm.toFixed(1)} / ${this.sim.currentNode.distanceKm} KM`;
    document.getElementById('hud-hull').textContent = `${hull.pct}%`;
    document.getElementById('hud-shield').textContent =
      `${Math.round(this.sim.shieldHp)}`;
    document.getElementById('hud-heat').textContent =
      `${Math.round(this.sim.boilerHeat)}%`;
    document.getElementById('hud-scrap').textContent =
      `${this.sim.scrap} ⚙`;
    document.getElementById('hud-score').textContent =
      this.sim.score.toLocaleString();

    const hBadge = document.getElementById('harpoon-badge');
    hBadge.textContent = `TETHERS: ${this.sim.harpoons.length} ACTIVE`;
  }

  _renderSteamManifold() {
    const used = this.sim.getUsedSteam();
    document.getElementById('steam-budget-label').textContent =
      `${used} / ${TOTAL_STEAM_BARS} BARS`;

    const el = document.getElementById('steam-manifold');
    el.innerHTML = STEAM_SYSTEMS.map((sys) => {
      const val = this.sim.steam[sys.id] || 0;
      const pips = Array.from({ length: sys.maxBars }, (_, i) => {
        const lit = i < val;
        return `<div class="steam-pip" style="${lit ? `background:${sys.color};border-color:${sys.color}` : ''}"></div>`;
      }).join('');

      return `
        <div class="steam-row">
          <div class="steam-row-top">
            <span style="color:${sys.color}">${sys.label}</span>
            <span>${val} / ${sys.maxBars}</span>
          </div>
          <div class="steam-controls">
            <button class="btn-steam-step" data-sys="${sys.id}" data-delta="-1">−</button>
            <div class="steam-pips">${pips}</div>
            <button class="btn-steam-step" data-sys="${sys.id}" data-delta="1">+</button>
          </div>
        </div>
      `;
    }).join('');

    el.querySelectorAll('.btn-steam-step').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sim.adjustSteam(btn.dataset.sys, Number(btn.dataset.delta));
        this._syncFullUI();
      });
    });
  }

  _renderSubsystemScanner() {
    const container = document.getElementById('subsystem-scanner');
    const target =
      this.sim.enemies.find((e) => e.id === this.sim.selectedEnemyId) ||
      this.sim.enemies[0] ||
      null;

    const spriteMap = {
      raider_skiff: 'assets/sprites/raider_skiff.png',
      harpoon_rig: 'assets/sprites/harpoon_rig.png',
      gyrocopter: 'assets/sprites/gyrocopter.png',
      siege_boss: 'assets/sprites/siege_boss.png',
    };

    const keys = ['Z', 'X', 'C'];
    const subButtons = SUBSYSTEM_TYPES.map((sub, i) => {
      const isAct = this.sim.targetSubsystem === sub.id;
      const st = target ? target.subsystems[sub.id] : null;
      const statusLabel = !st
        ? 'READY'
        : st.destroyed
          ? 'CRIPPLED'
          : `${Math.round(st.hp)}%`;

      return `
        <button class="btn-subsystem ${isAct ? 'active' : ''}" data-sub-id="${sub.id}">
          <span>[${keys[i]}] ${sub.label} (${sub.code})</span>
          <span>${statusLabel}</span>
        </button>
      `;
    }).join('');

    if (!target) {
      container.innerHTML = `
        <div class="target-summary">
          <div class="target-meta">
            <div class="target-title">NO HOSTILE LOCKED</div>
            <div style="font-size:10px;color:#94a3b8">Scanning salt flat for incoming raiders…</div>
          </div>
        </div>
        <div class="sub-btn-list">${subButtons}</div>
      `;
    } else {
      container.innerHTML = `
        <div class="target-summary">
          <img src="${spriteMap[target.sprite]}" alt="${target.name}" class="target-sprite" />
          <div class="target-meta">
            <div class="target-title">🎯 ${target.name}</div>
            <div style="font-size:10px;color:#cbd5e1;font-family:var(--font-mono)">
              HULL ${Math.max(0, target.hp)} / ${target.maxHp} · REWARD +${target.scrapReward}⚙
            </div>
          </div>
        </div>
        <div class="sub-btn-list">${subButtons}</div>
      `;
    }

    container.querySelectorAll('.btn-subsystem').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.sim.targetSubsystem = btn.dataset.subId;
        this.audio.playClick();
        this._syncFullUI();
      });
    });
  }

  _renderRailcarConsist() {
    const listEl = document.getElementById('railcar-list');
    listEl.innerHTML = this.sim.cars
      .map((car) => {
        const isSel = car.id === this.sim.selectedCarId;
        const pct = Math.max(0, Math.round((car.hp / car.maxHp) * 100));
        const tethered = this.sim.harpoons.some((h) => h.carId === car.id);

        return `
          <div class="car-item ${isSel ? 'selected' : ''}" data-car-id="${car.id}">
            <div class="car-item-top">
              <span style="color:${car.color}">[${car.index + 1}] ${car.code}</span>
              <span>MK-${car.weaponLevel} ${tethered ? '· ⚓ TETHERED' : ''}</span>
            </div>
            <div class="car-item-title">
              <span>${car.name}</span>
              <span>${Math.round(car.hp)}/${car.maxHp}</span>
            </div>
            <div class="car-item-sub">${car.weaponLabel} · DMG ${car.damage}</div>
            <div class="hp-track">
              <div class="hp-fill" style="width:${pct}%;background:${car.color}"></div>
            </div>
          </div>
        `;
      })
      .join('');

    listEl.querySelectorAll('.car-item').forEach((el) => {
      el.addEventListener('click', () => {
        this.sim.selectedCarId = el.dataset.carId;
        this.audio.playClick();
        this._syncFullUI();
      });
    });

    const selCar =
      this.sim.cars.find((c) => c.id === this.sim.selectedCarId) ||
      this.sim.cars[0];
    if (selCar) {
      const cost = 60 + (selCar.weaponLevel - 1) * 35;
      document.getElementById('inspected-car-code').textContent =
        `${selCar.code} // MK-${selCar.weaponLevel}`;
      document.getElementById('inspected-car-name').textContent = selCar.name;
      document.getElementById('inspected-car-desc').textContent = selCar.desc;
      document.getElementById('btn-upgrade-car').textContent =
        `[U] UPGRADE ${selCar.name.split(' ')[0]} (${cost} ⚙) — +22% DMG & +40 HULL`;
    }
  }

  _renderRouteAndLog() {
    const routeEl = document.getElementById('sector-route-strip');
    routeEl.innerHTML = SECTOR_NODES.map((node, idx) => {
      const stateClass =
        idx < this.sim.nodeIndex
          ? 'done'
          : idx === this.sim.nodeIndex
            ? 'active'
            : '';
      return `
        <div class="route-node-card ${stateClass}">
          <div class="rn-kicker">STAGE ${idx + 1} · ${node.threat}</div>
          <div class="rn-title">${node.name}</div>
          <div class="rn-sub">${node.type} (${node.distanceKm} KM)</div>
        </div>
      `;
    }).join('');

    const logEl = document.getElementById('combat-log');
    logEl.innerHTML = this.sim.combatLog
      .slice(0, 6)
      .map(
        (entry) =>
          `<div class="log-entry ${entry.tone}">[${entry.time}] ${entry.text}</div>`
      )
      .join('');
  }

  _renderModal() {
    const modal = document.getElementById('sector-modal');
    const sum = this.sim.nodeSummary;
    if (!sum) {
      modal.classList.add('hidden');
      return;
    }
    modal.classList.remove('hidden');

    document.getElementById('modal-kicker').textContent = this.sim.gameOver
      ? 'FINAL CONVOY CAMPAIGN REPORT'
      : `SECTOR STAGE ${this.sim.nodeIndex + 1} CLEARED`;
    document.getElementById('modal-title').textContent = this.sim.gameOver
      ? this.sim.victory
        ? 'CITADEL BREACHED — IRONWAKE CONVOY VICTORIOUS!'
        : 'CONVOY DERAILED IN THE SALT FLATS'
      : `${sum.nodeName} CLEARED!`;
    document.getElementById('modal-subtitle').textContent =
      `Commander Vane Kael logs sector salvage and prepares the dreadnought consist:`;

    document.getElementById('modal-metrics').innerHTML = `
      <div class="modal-metric-box">
        <span>SECTOR SALVAGE BONUS</span>
        <strong class="accent-amber">+${sum.bonusScrap} ⚙ (${this.sim.scrap} ⚙)</strong>
      </div>
      <div class="modal-metric-box">
        <span>RAIDERS DESTROYED</span>
        <strong class="accent-emerald">${sum.kills} HOSTILES</strong>
      </div>
      <div class="modal-metric-box">
        <span>HARPOONS SEVERED</span>
        <strong class="accent-cyan">${this.sim.harpoonsSevered} CABLES</strong>
      </div>
      <div class="modal-metric-box">
        <span>CONVOY RUN SCORE</span>
        <strong class="accent-amber">${sum.score.toLocaleString()}</strong>
      </div>
    `;

    document.getElementById('btn-modal-continue').textContent = this.sim
      .gameOver
      ? 'LAUNCH NEW CONVOY RUN'
      : `ENTER STAGE ${this.sim.nodeIndex + 2}`;
  }

  _syncFullUI() {
    this._syncTopBar();
    this._syncSpeedButtons();
    this._renderSteamManifold();
    this._renderSubsystemScanner();
    this._renderRailcarConsist();
    this._renderRouteAndLog();
    this._renderModal();

    const qIdx = (this.sim.nodeIndex + this.sim.kills) % COMMANDER_QUOTES.length;
    document.getElementById('commander-quote').textContent =
      COMMANDER_QUOTES[qIdx];
  }

  _loop(now) {
    const rawDt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;
    const dt = rawDt * (this.sim.speed || 1);

    this.sim.step(dt);
    this.renderer.render(this.sim, rawDt);

    this.uiAccum += rawDt;
    if (this.uiAccum >= 0.25) {
      this.uiAccum = 0;
      this._syncTopBar();
      this._renderSubsystemScanner();
      this._renderRailcarConsist();
      this._renderRouteAndLog();
      this._renderModal();
    }

    requestAnimationFrame((t) => this._loop(t));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.ironwakeApp = new IronwakeApp();
});
