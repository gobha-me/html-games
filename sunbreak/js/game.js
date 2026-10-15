// SUNBREAK // V'BALL v0.3 — 2v2 NBA Jam / NFL Blitz Paced Beach Volleyball & Keyframed Hand-Socket Engine
(function () {
  const ROSTER = window.SUNBREAK_ROSTER;
  const SoftBodyRig = window.SunbreakSoftBodyRig;
  const Renderer = window.SunbreakRenderer;
  const AudioSys = window.SunbreakAudio;

  const COURT = {
    leftX: 245,
    rightX: 1035,
    netX: 640,
    topY: 305,
    botY: 645,
    netHeight: 76,
    gravity: 515
  };

  class SunbreakGame {
    constructor() {
      this.glCanvas = document.getElementById('gl-canvas');
      this.hudCanvas = document.getElementById('hud-canvas');
      this.renderer = new Renderer(this.glCanvas, this.hudCanvas);

      this.physicsPreset = 'doax';
      this.serveRules = 'arcade'; // arcade (No Faults) | pro (Net/Out Risk)
      this.lightingTheme = 'sunset';
      this.mode = 'solo'; // solo | coop | versus2p | party4p

      this.score = [0, 0];
      this.solar = [35, 25];
      this.streak = [0, 0]; // Consecutive points / clean spikes for NBA Jam "ON FIRE!" state
      this.teamOnFire = [false, false];

      this.servingTeam = 0;
      this.serverSlot = 0;
      this.rallyState = 'serve'; // serve | play | point_scored
      this.servePhase = 'hold'; // hold | toss
      this.serveType = 'float'; // float | jump
      this.serveCharge = 0; // 0.0 -> 1.0 power & sweet-spot bar
      this.serveHoldMode = false;
      this.serveAimDrop = false;
      this.aiServeTargetCharge = 0.84;
      this.pointTimer = 0;
      this.hitStopTimer = 0; // 3-4 frame impact hit-stop freeze on spikes & blocks

      this.touchTeam = 0;
      this.touchCount = 0;
      this.lastTouchPlayer = -1;
      this.requestedSetType = [null, null]; // 'high' | 'quick'

      this.poseCamActive = false;
      this.poseCamPlayerIdx = 0;
      this.cutInTimer = 0;
      this.cutInLabel = '';

      this.callouts = [];
      this.keys = {};
      this.prevKeys = {};
      this.prevGpButtons = [{}, {}, {}, {}];

      // 4 Court Slots: [0, 1] = Team 0 (Left), [2, 3] = Team 1 (Right)
      this.slotConfig = [
        { rosterIdx: 0, controller: 'kb1' },
        { rosterIdx: 1, controller: 'ai' },
        { rosterIdx: 3, controller: 'ai' },
        { rosterIdx: 5, controller: 'ai' }
      ];

      this.players = [];
      this.ball = {
        x: 320,
        y: 480,
        z: 36,
        vx: 0,
        vy: 0,
        vz: 0,
        spinAngle: 0,
        topspin: 0,
        curveY: 0,
        knuckle: 0,
        knucklePhase: 0,
        solarSpike: false,
        onFireBall: false,
        tandemSync: false,
        impactSquash: 0,
        trail: []
      };
      this.ballLanding = null;

      this.setupPlayersFromConfig();
      this.resetServe(0);
      this.bindUI();
      this.renderLobbySlots();

      this.lastTime = performance.now();
      requestAnimationFrame((t) => this.loop(t));
    }

    setupPlayersFromConfig() {
      const homePositions = [
        { x: 350, y: 415 },
        { x: 470, y: 535 },
        { x: 810, y: 415 },
        { x: 930, y: 535 }
      ];

      this.players = this.slotConfig.map((cfg, idx) => {
        const prof = ROSTER[cfg.rosterIdx % ROSTER.length];
        const team = idx < 2 ? 0 : 1;
        const pos = homePositions[idx];
        return {
          slot: idx,
          team,
          profile: prof,
          controllerType: cfg.controller,
          badgeText: this.getBadgeLabel(idx, cfg.controller, prof),
          x: pos.x,
          y: pos.y,
          z: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          facing: team === 0 ? 1 : -1,
          actionState: 'idle', // idle | jump_coil | dig | set | spike | spike_follow | dive
          actionTimer: 0,
          jumpCoilTimer: 0,
          pendingJumpImpulse: 0,
          diveLockTimer: 0,
          activeDigTimer: 0,
          posePreviewTimer: 0,
          turbo: 100,
          turboActive: false,
          onFire: this.teamOnFire[team],
          ghostTrail: [],
          ghostTimer: 0,
          isPartnerTarget: false,
          rig: new SoftBodyRig(prof)
        };
      });

      this.updateTeamHudLabels();
    }

    getBadgeLabel(slotIdx, ctrl, prof) {
      if (ctrl === 'ai') return `CPU • ${prof.name}`;
      if (ctrl === 'kb1') return `P1 • ${prof.name}`;
      if (ctrl === 'kb2') return `P2 • ${prof.name}`;
      if (ctrl.startsWith('gp')) {
        const gpNum = parseInt(ctrl.slice(2), 10) + 1;
        return `GP${gpNum} • ${prof.name}`;
      }
      return prof.name;
    }

    updateTeamHudLabels() {
      const p0 = this.players[0].profile.name;
      const p1 = this.players[1].profile.name;
      const p2 = this.players[2].profile.name;
      const p3 = this.players[3].profile.name;
      document.getElementById('hud-left-name').textContent = `${p0} & ${p1}`;
      document.getElementById('hud-right-name').textContent = `${p2} & ${p3}`;

      const leftControllers = `${this.players[0].controllerType.toUpperCase()} + ${this.players[1].controllerType.toUpperCase()}`;
      const rightControllers = `${this.players[2].controllerType.toUpperCase()} + ${this.players[3].controllerType.toUpperCase()}`;
      document.getElementById('p1-p2-tags').textContent =
        this.mode === 'solo' || this.mode === 'versus2p'
          ? `${leftControllers} (AUTO-HANDOFF)`
          : `${leftControllers} (CO-OP TANDEM)`;
      document.getElementById('p3-p4-tags').textContent = rightControllers;
    }

    applyModePreset(mode) {
      this.mode = mode;
      if (mode === 'solo') {
        this.slotConfig[0].controller = 'kb1';
        this.slotConfig[1].controller = 'ai';
        this.slotConfig[2].controller = 'ai';
        this.slotConfig[3].controller = 'ai';
      } else if (mode === 'coop') {
        this.slotConfig[0].controller = 'kb1';
        this.slotConfig[1].controller = 'kb2';
        this.slotConfig[2].controller = 'ai';
        this.slotConfig[3].controller = 'ai';
      } else if (mode === 'versus2p') {
        this.slotConfig[0].controller = 'kb1';
        this.slotConfig[1].controller = 'ai';
        this.slotConfig[2].controller = 'kb2';
        this.slotConfig[3].controller = 'ai';
      } else if (mode === 'party4p') {
        this.slotConfig[0].controller = 'kb1';
        this.slotConfig[1].controller = 'kb2';
        this.slotConfig[2].controller = 'gp0';
        this.slotConfig[3].controller = 'gp1';
      }
      this.setupPlayersFromConfig();
      this.renderLobbySlots();
    }

    renderLobbySlots() {
      const container = document.getElementById('slots-grid');
      if (!container) return;
      container.innerHTML = '';

      const ctrlOptions = [
        { val: 'kb1', label: 'P1 (WASD + J/K/L + Shift Turbo)' },
        { val: 'kb2', label: 'P2 (Arrows + M/,/. or Num1-3)' },
        { val: 'gp0', label: 'Gamepad 1 (Controller 0)' },
        { val: 'gp1', label: 'Gamepad 2 (Controller 1)' },
        { val: 'gp2', label: 'Gamepad 3 (Controller 2)' },
        { val: 'gp3', label: 'Gamepad 4 (Controller 3)' },
        { val: 'ai', label: 'CPU Partner / Boss AI' }
      ];

      this.slotConfig.forEach((cfg, idx) => {
        const teamClass = idx < 2 ? 'team-a' : 'team-b';
        const teamLabel = idx < 2 ? `SUNSET SLOT ${idx + 1}` : `RIPTIDE SLOT ${idx - 1}`;
        const prof = ROSTER[cfg.rosterIdx];

        const card = document.createElement('div');
        card.className = `slot-card ${teamClass}`;
        card.innerHTML = `
          <div class="slot-title">
            <span>${teamLabel}</span>
            <span style="color:${prof.signatureColor}">${prof.epithet}</span>
          </div>
          <select data-slot="${idx}" class="select-athlete">
            ${ROSTER.map(
              (r, rIdx) =>
                `<option value="${rIdx}" ${rIdx === cfg.rosterIdx ? 'selected' : ''}>${r.name} — ${r.archetype}</option>`
            ).join('')}
          </select>
          <select data-slot="${idx}" class="select-controller">
            ${ctrlOptions
              .map(
                (c) =>
                  `<option value="${c.val}" ${c.val === cfg.controller ? 'selected' : ''}>${c.label}</option>`
              )
              .join('')}
          </select>
          <div class="slot-stats">
            PWR ${Math.round(prof.power * 100)} • SPD ${Math.round(prof.speed * 100)} • JMP ${Math.round(prof.jump * 100)}<br/>
            Overdrive: <strong style="color:${prof.signatureColor}">${prof.signatureMove}</strong>
          </div>
        `;
        container.appendChild(card);
      });

      container.querySelectorAll('.select-athlete').forEach((sel) => {
        sel.addEventListener('change', (e) => {
          const s = parseInt(e.target.dataset.slot, 10);
          this.slotConfig[s].rosterIdx = parseInt(e.target.value, 10);
          this.setupPlayersFromConfig();
          this.renderLobbySlots();
        });
      });

      container.querySelectorAll('.select-controller').forEach((sel) => {
        sel.addEventListener('change', (e) => {
          const s = parseInt(e.target.dataset.slot, 10);
          this.slotConfig[s].controller = e.target.value;
          this.setupPlayersFromConfig();
        });
      });
    }

    bindUI() {
      window.addEventListener('keydown', (e) => {
        this.keys[e.code] = true;
        if (e.code === 'KeyC') {
          this.togglePoseCam();
        } else if (e.code === 'Escape') {
          this.toggleLobbyModal();
        } else if (e.code === 'KeyM') {
          const on = AudioSys.toggle();
          document.getElementById('btn-audio').textContent = `SFX: ${on ? 'ON' : 'OFF'}`;
        } else if (this.poseCamActive) {
          if (e.code >= 'Digit1' && e.code <= 'Digit6') {
            const rIdx = parseInt(e.code.replace('Digit', ''), 10) - 1;
            this.players[this.poseCamPlayerIdx].profile = ROSTER[rIdx];
            this.players[this.poseCamPlayerIdx].rig = new SoftBodyRig(ROSTER[rIdx]);
          } else if (e.code === 'Space') {
            const fp = this.players[this.poseCamPlayerIdx];
            this.triggerKeyedJump(fp, 245);
            fp.posePreviewTimer = 0.85;
            AudioSys.playHit(0.7, 1.1);
          } else if (e.code === 'KeyK') {
            const fp = this.players[this.poseCamPlayerIdx];
            fp.actionState = 'spike';
            fp.actionTimer = 0.22;
            fp.posePreviewTimer = 0.85;
            fp.rig.applyActionImpulse('spike', 1.35);
            setTimeout(() => {
              fp.actionState = 'spike_follow';
              fp.actionTimer = 0.38;
              fp.rig.applyActionImpulse('spike', 1.15);
            }, 190);
            AudioSys.playSolarSpike();
          } else if (e.code === 'KeyL') {
            const fp = this.players[this.poseCamPlayerIdx];
            fp.actionState = 'dive';
            fp.actionTimer = 0.55;
            fp.posePreviewTimer = 0.65;
            fp.rig.applyActionImpulse('dive', 1.3);
            AudioSys.playSandDive();
          }
        }
      });

      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
      });

      document.getElementById('select-physics').addEventListener('change', (e) => {
        this.physicsPreset = e.target.value;
      });

      const serveRulesSel = document.getElementById('select-serve-rules');
      if (serveRulesSel) {
        serveRulesSel.addEventListener('change', (e) => {
          this.serveRules = e.target.value;
        });
      }

      document.getElementById('select-lighting').addEventListener('change', (e) => {
        this.lightingTheme = e.target.value;
        this.renderer.theme = e.target.value;
      });

      document.getElementById('btn-pose-cam').addEventListener('click', () => {
        this.togglePoseCam();
      });

      document.getElementById('btn-lobby').addEventListener('click', () => {
        this.toggleLobbyModal(true);
      });

      document.getElementById('btn-close-lobby').addEventListener('click', () => {
        this.toggleLobbyModal(false);
      });

      document.getElementById('btn-start-match').addEventListener('click', () => {
        this.toggleLobbyModal(false);
        this.score = [0, 0];
        this.streak = [0, 0];
        this.teamOnFire = [false, false];
        this.updateScoreHud();
        this.resetServe(0);
        AudioSys.playWhistle(false);
      });

      document.getElementById('btn-open-pose-showcase').addEventListener('click', () => {
        this.toggleLobbyModal(false);
        if (!this.poseCamActive) this.togglePoseCam();
      });

      document.getElementById('btn-audio').addEventListener('click', () => {
        const on = AudioSys.toggle();
        document.getElementById('btn-audio').textContent = `SFX: ${on ? 'ON' : 'OFF'}`;
      });

      document.querySelectorAll('.mode-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.applyModePreset(btn.dataset.mode);
        });
      });

      window.addEventListener('keydown', (e) => {
        const modal = document.getElementById('lobby-modal');
        if (!modal.classList.contains('hidden') && e.code === 'Enter') {
          this.toggleLobbyModal(false);
          AudioSys.playWhistle(false);
        }
      });
    }

    /**
     * Initiates a keyed 2-stage jump sequence:
     * Stage 1 (`pose_jump_coil`, 95ms): Deep crouch coil with downward soft-body compression.
     * Stage 2 (`pose_spike`, airborne): Upward launch into mid-air bow-and-arrow arch with hangtime!
     */
    triggerKeyedJump(p, launchVz) {
      if (p.z > 0 || p.jumpCoilTimer > 0) return;
      p.actionState = 'jump_coil';
      p.jumpCoilTimer = 0.095;
      p.actionTimer = 0.55;
      p.pendingJumpImpulse = launchVz * (p.onFire ? 1.14 : 1.0);
      p.rig.applyActionImpulse('jump', 1.25);
      this.renderer.addSandTrail(p.x, p.y, 18);
    }

    togglePoseCam() {
      this.poseCamActive = !this.poseCamActive;
      document.getElementById('btn-pose-cam').classList.toggle('active', this.poseCamActive);
      if (this.poseCamActive) {
        this.players[this.poseCamPlayerIdx].rig.applyActionImpulse('celebrate', 1.2);
      }
    }

    toggleLobbyModal(forceState) {
      const modal = document.getElementById('lobby-modal');
      const show = typeof forceState === 'boolean' ? forceState : modal.classList.contains('hidden');
      modal.classList.toggle('hidden', !show);
    }

    addCallout(text, x, y, color = '#ffb84d') {
      this.callouts.push({ text, x, y, color, timer: 1.25 });
    }

    updateTouchHud() {
      const pips = document.querySelectorAll('#touch-indicator .pip');
      pips.forEach((pip) => {
        pip.className = 'pip';
        const t = parseInt(pip.dataset.touch, 10);
        if (t === this.touchCount) {
          pip.classList.add(`active-${t}`);
        }
      });
    }

    updateScoreHud() {
      document.getElementById('score-left').textContent = this.score[0];
      document.getElementById('score-right').textContent = this.score[1];
      const fireL = this.teamOnFire[0] ? ' 🔥 ON FIRE!' : '';
      const fireR = this.teamOnFire[1] ? ' 🔥 ON FIRE!' : '';
      document.getElementById('solar-left-pct').textContent = `SOLAR ${Math.round(this.solar[0])}%${fireL}`;
      document.getElementById('solar-right-pct').textContent = `SOLAR ${Math.round(this.solar[1])}%${fireR}`;
      document.getElementById('solar-left-fill').style.width = `${Math.min(100, this.solar[0])}%`;
      document.getElementById('solar-right-fill').style.width = `${Math.min(100, this.solar[1])}%`;
    }

    resetServe(servingTeam) {
      this.servingTeam = servingTeam;
      this.touchTeam = servingTeam;
      this.touchCount = 0;
      this.lastTouchPlayer = -1;
      this.rallyState = 'serve';
      this.servePhase = 'hold';
      this.serveType = 'float';
      this.serveCharge = 0;
      this.serveHoldMode = false;
      this.serveAimDrop = false;
      this.aiServeTargetCharge = 0.78 + Math.random() * 0.12;

      this.ball.topspin = 0;
      this.ball.curveY = 0;
      this.ball.knuckle = 0;
      this.ball.knucklePhase = 0;
      this.ball.solarSpike = false;
      this.ball.onFireBall = this.teamOnFire[servingTeam];
      this.ball.tandemSync = false;
      this.ball.impactSquash = 0;
      this.ball.trail = [];
      this.requestedSetType = [null, null];

      const positions =
        servingTeam === 0
          ? [
              { x: 255, y: 500 },
              { x: 525, y: 425 },
              { x: 810, y: 420 },
              { x: 920, y: 535 }
            ]
          : [
              { x: 350, y: 420 },
              { x: 465, y: 535 },
              { x: 755, y: 425 },
              { x: 1025, y: 500 }
            ];

      this.serverSlot = servingTeam === 0 ? 0 : 3;

      this.players.forEach((p, idx) => {
        p.x = positions[idx].x;
        p.y = positions[idx].y;
        p.z = 0;
        p.vx = 0;
        p.vy = 0;
        p.vz = 0;
        p.actionState = 'idle';
        p.actionTimer = 0;
        p.jumpCoilTimer = 0;
        p.activeDigTimer = 0;
        p.facing = p.team === 0 ? 1 : -1;
        p.onFire = this.teamOnFire[p.team];
        p.ghostTrail = [];
      });

      this.enforceAutoHandoffOnTeam(servingTeam, this.serverSlot);

      // Anchor the volleyball directly onto the server's calibrated handSocket!
      const srv = this.players[this.serverSlot];
      const hs = this.renderer.getHandSocketWorld(srv, 'pose_ready');
      this.ball.x = hs.x;
      this.ball.y = hs.y;
      this.ball.z = hs.z;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.vz = 0;
      this.ballLanding = null;
      this.aiServeTimer = 0.65;

      this.updateTouchHud();
      document.getElementById('match-meta').textContent =
        servingTeam === 0 ? 'SUNSET SERVE • HOLD/TAP J OR K' : 'RIPTIDE SERVE';
    }

    enforceAutoHandoffOnTeam(team, targetSlot) {
      const s0 = team === 0 ? 0 : 2;
      const s1 = team === 0 ? 1 : 3;
      const p0 = this.players[s0];
      const p1 = this.players[s1];

      const p0Human = p0.controllerType !== 'ai';
      const p1Human = p1.controllerType !== 'ai';
      if (p0Human === p1Human) return;

      const humanCtrl = p0Human ? p0.controllerType : p1.controllerType;
      const activeSlot = targetSlot === s0 ? s0 : s1;
      const partnerSlot = activeSlot === s0 ? s1 : s0;

      this.players[activeSlot].controllerType = humanCtrl;
      this.players[partnerSlot].controllerType = 'ai';
      this.players[activeSlot].isPartnerTarget = false;
      this.players[partnerSlot].isPartnerTarget = true;

      this.players[activeSlot].badgeText = this.getBadgeLabel(
        activeSlot,
        humanCtrl,
        this.players[activeSlot].profile
      );
      this.players[partnerSlot].badgeText = `PARTNER • ${this.players[partnerSlot].profile.name}`;
    }

    manualSwapTeamControl(team) {
      const s0 = team === 0 ? 0 : 2;
      const s1 = team === 0 ? 1 : 3;
      const p0 = this.players[s0];
      const p1 = this.players[s1];
      if (p0.controllerType === 'ai' && p1.controllerType !== 'ai') {
        this.enforceAutoHandoffOnTeam(team, s0);
      } else if (p1.controllerType === 'ai' && p0.controllerType !== 'ai') {
        this.enforceAutoHandoffOnTeam(team, s1);
      }
    }

    /**
     * Predicts both where the ball will hit the sand (z = 8) AND where a defender's
     * dig forearm platform (`z = 42`) will intercept it so athletes position their HANDS
     * under the ball rather than their knees/feet! Accounts for topspin gravity & curve!
     */
    predictBallLanding() {
      const b = this.ball;
      if (Math.abs(b.vx) < 1 && Math.abs(b.vy) < 1 && b.vz === 0) {
        this.ballLanding = null;
        return;
      }
      const g = COURT.gravity * (1.0 + (b.topspin || 0) * 0.34);
      // Sand impact time (z = 8)
      const discSand = b.vz * b.vz + 2 * g * Math.max(0, b.z - 8);
      const tSand = (b.vz + Math.sqrt(discSand)) / g;

      // Hand/forearm reception platform intercept time (z = 44 on descent)
      const discHand = Math.max(0, b.vz * b.vz + 2 * g * (b.z - 44));
      const tHand = Math.max(0.05, (b.vz + Math.sqrt(discHand)) / g);

      const curveAcc = b.curveY || 0;
      const lx = Math.max(COURT.leftX - 35, Math.min(COURT.rightX + 35, b.x + b.vx * tSand));
      const ly = Math.max(
        COURT.topY - 25,
        Math.min(COURT.botY + 25, b.y + b.vy * tSand + 0.5 * curveAcc * tSand * tSand)
      );

      const hx = Math.max(COURT.leftX - 35, Math.min(COURT.rightX + 35, b.x + b.vx * tHand));
      const hy = Math.max(
        COURT.topY - 25,
        Math.min(COURT.botY + 25, b.y + b.vy * tHand + 0.5 * curveAcc * tHand * tHand)
      );

      this.ballLanding = {
        x: lx,
        y: ly,
        t: tSand,
        handX: hx,
        handY: hy,
        tHand
      };
    }

    readControllerInput(ctrlType) {
      const out = {
        mx: 0,
        my: 0,
        btnA: false,
        btnB: false,
        holdA: false,
        holdB: false,
        btnSwitch: false,
        turbo: false
      };
      if (ctrlType === 'kb1') {
        if (this.keys['KeyA']) out.mx -= 1;
        if (this.keys['KeyD']) out.mx += 1;
        if (this.keys['KeyW']) out.my -= 1;
        if (this.keys['KeyS']) out.my += 1;
        out.btnA = this.justPressed('KeyJ') || this.justPressed('Space');
        out.btnB = this.justPressed('KeyK');
        out.holdA = !!(this.keys['KeyJ'] || this.keys['Space']);
        out.holdB = !!this.keys['KeyK'];
        out.btnSwitch = this.justPressed('KeyL');
        out.turbo = !!(this.keys['ShiftLeft'] || this.keys['KeyL']);
      } else if (ctrlType === 'kb2') {
        if (this.keys['ArrowLeft']) out.mx -= 1;
        if (this.keys['ArrowRight']) out.mx += 1;
        if (this.keys['ArrowUp']) out.my -= 1;
        if (this.keys['ArrowDown']) out.my += 1;
        out.btnA = this.justPressed('KeyM') || this.justPressed('Numpad1');
        out.btnB = this.justPressed('Comma') || this.justPressed('Numpad2');
        out.holdA = !!(this.keys['KeyM'] || this.keys['Numpad1']);
        out.holdB = !!(this.keys['Comma'] || this.keys['Numpad2']);
        out.btnSwitch = this.justPressed('Period') || this.justPressed('Numpad3');
        out.turbo = !!(this.keys['ShiftRight'] || this.keys['Period']);
      } else if (ctrlType.startsWith('gp')) {
        const gpIdx = parseInt(ctrlType.slice(2), 10);
        const pads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = pads[gpIdx];
        if (gp) {
          const ax0 = gp.axes[0] || 0;
          const ax1 = gp.axes[1] || 0;
          if (Math.abs(ax0) > 0.18) out.mx = ax0;
          if (Math.abs(ax1) > 0.18) out.my = ax1;
          if (gp.buttons[14] && gp.buttons[14].pressed) out.mx = -1;
          if (gp.buttons[15] && gp.buttons[15].pressed) out.mx = 1;
          if (gp.buttons[12] && gp.buttons[12].pressed) out.my = -1;
          if (gp.buttons[13] && gp.buttons[13].pressed) out.my = 1;

          const b0 = !!(gp.buttons[0] && gp.buttons[0].pressed);
          const b1 = !!(gp.buttons[1] && gp.buttons[1].pressed);
          const b2 = !!(gp.buttons[2] && gp.buttons[2].pressed);
          const b4 = !!(gp.buttons[4] && gp.buttons[4].pressed);
          const b7 = !!(gp.buttons[7] && gp.buttons[7].pressed); // RT Turbo

          out.btnA = b0 && !this.prevGpButtons[gpIdx][0];
          out.btnB = (b1 && !this.prevGpButtons[gpIdx][1]) || (b2 && !this.prevGpButtons[gpIdx][2]);
          out.holdA = b0;
          out.holdB = b1 || b2;
          out.btnSwitch = b4 && !this.prevGpButtons[gpIdx][4];
          out.turbo = b7 || b5Pressed(gp);

          this.prevGpButtons[gpIdx][0] = b0;
          this.prevGpButtons[gpIdx][1] = b1;
          this.prevGpButtons[gpIdx][2] = b2;
          this.prevGpButtons[gpIdx][4] = b4;
        }
      }
      return out;
    }

    justPressed(code) {
      return !!this.keys[code] && !this.prevKeys[code];
    }

    computeAIInput(p, dt) {
      const out = {
        mx: 0,
        my: 0,
        btnA: false,
        btnB: false,
        holdA: false,
        holdB: false,
        btnSwitch: false,
        turbo: false
      };
      const team = p.team;
      const isLeft = team === 0;
      const partnerSlot = p.slot % 2 === 0 ? p.slot + 1 : p.slot - 1;
      const partner = this.players[partnerSlot];

      if (this.rallyState === 'serve') {
        if (this.serverSlot === p.slot) {
          if (this.servePhase === 'hold') {
            this.aiServeTimer -= dt;
            if (this.aiServeTimer <= 0) {
              out.btnB = p.onFire || Math.random() < 0.68;
              out.btnA = !out.btnB;
              out.holdB = out.btnB;
              out.holdA = out.btnA;
            }
          } else if (this.servePhase === 'toss') {
            const keepHolding = this.serveCharge < (this.aiServeTargetCharge || 0.84);
            out.holdB = keepHolding && this.serveType === 'jump';
            out.holdA = keepHolding && this.serveType === 'float';
            out.my = Math.sin(performance.now() * 0.003) * 0.65;
          }
        }
        return out;
      }

      if (this.rallyState !== 'play') return out;

      const ballOnOurSide =
        this.ballLanding &&
        ((isLeft && this.ballLanding.x <= COURT.netX + 10) ||
          (!isLeft && this.ballLanding.x >= COURT.netX - 10));

      let targetX = isLeft ? 410 : 870;
      let targetY = p.slot % 2 === 0 ? 395 : 545;

      if (ballOnOurSide && this.ballLanding) {
        const interceptX = this.ballLanding.handX;
        const interceptY = this.ballLanding.handY;
        const myDist = Math.hypot(p.x - interceptX, p.y - interceptY);
        const partnerDist = Math.hypot(partner.x - interceptX, partner.y - interceptY);

        const iMustTakeBall =
          this.lastTouchPlayer === partner.slot ||
          (this.lastTouchPlayer !== p.slot &&
            (partner.controllerType !== 'ai'
              ? this.touchCount === 1
              : myDist <= partnerDist));

        if (iMustTakeBall) {
          // Offset body target X so the athlete's outstretched forearm/handSocket lands directly under interceptX!
          const desiredPose = this.touchCount === 0 ? 'pose_dig' : this.touchCount === 1 ? 'pose_set' : 'pose_spike';
          const hs = this.renderer.getHandSocketWorld(p, desiredPose);
          const handOffsetX = hs.x - p.x;
          targetX = interceptX - handOffsetX;
          targetY = interceptY;

          const distToIntercept = Math.hypot(targetX - p.x, targetY - p.y);
          if (distToIntercept > 55) out.turbo = true;

          const distToBall = Math.hypot(this.ball.x - hs.x, this.ball.y - hs.y);
          if (
            this.touchCount === 0 &&
            this.ball.z < 52 &&
            this.ball.vz < 0 &&
            distToBall > 34 &&
            distToBall < 98
          ) {
            out.btnB = true;
          } else if (
            distToBall < 62 &&
            this.ball.z > 32 &&
            this.ball.z < 138 &&
            this.touchCount === 2 &&
            p.z === 0 &&
            p.jumpCoilTimer <= 0
          ) {
            out.btnB = true;
          }
        } else {
          targetX = isLeft ? 545 : 735;
          targetY = partner.y < 475 ? 535 : 410;
        }
      } else {
        const isFrontBlocker = p.slot % 2 === 0;
        if (isFrontBlocker) {
          targetX = isLeft ? COURT.netX - 42 : COURT.netX + 42;
          targetY = Math.max(COURT.topY + 35, Math.min(COURT.botY - 35, this.ball.y));
          const oppJumpingAtNet = this.players.some(
            (op) =>
              op.team !== team &&
              (op.z > 20 || op.jumpCoilTimer > 0) &&
              Math.abs(op.x - COURT.netX) < 120 &&
              Math.hypot(this.ball.x - op.x, this.ball.y - op.y) < 68
          );
          if (oppJumpingAtNet && p.z === 0 && p.jumpCoilTimer <= 0 && Math.random() < 0.22) {
            out.btnA = true;
          }
        } else {
          targetX = isLeft ? 360 : 920;
          targetY = 480 + (this.ball.y - 480) * 0.45;
        }
      }

      const dx = targetX - p.x;
      const dy = targetY - p.y;
      if (Math.abs(dx) > 6) out.mx = Math.max(-1, Math.min(1, dx / 32));
      if (Math.abs(dy) > 6) out.my = Math.max(-1, Math.min(1, dy / 32));
      return out;
    }

    /**
     * Phase 1 of Serve: Toss the volleyball upward from the server's calibrated handSocket
     * and start filling the Serve Power & Sweet-Spot Bar (`0.0 -> 1.0`).
     */
    startServeToss(p, isJumpServe) {
      this.servePhase = 'toss';
      this.serveType = isJumpServe || p.onFire ? 'jump' : 'float';
      this.serveCharge = 0.03;
      this.serveHoldMode = true;
      this.serveAimDrop = false;

      const dir = p.team === 0 ? 1 : -1;
      const hs = this.renderer.getHandSocketWorld(p, 'pose_ready');
      this.ball.x = hs.x;
      this.ball.y = hs.y;
      this.ball.z = hs.z;
      this.ball.vx = dir * (this.serveType === 'jump' ? 30 : 12);
      this.ball.vy = 0;
      this.ball.vz = this.serveType === 'jump' ? 235 : 168;
      this.ball.spinAngle = 0;

      if (this.serveType === 'jump') {
        this.triggerKeyedJump(p, p.onFire ? 268 : 235);
      } else {
        p.actionState = 'set';
        p.actionTimer = 0.65;
        p.rig.applyActionImpulse('set', 0.85);
      }
      AudioSys.playHit(0.35, 1.35);
    }

    /**
     * Phase 2 of Serve: Strike the tossed volleyball at `charge` (`0.0 -> 1.0`).
     * Supports 4 distinct archetypes (Meteor On-Fire Jump Serve, Topspin Jump Laser,
     * Knuckle Float Serve, and Short Cut Drop Serve) plus configurable Arcade/Pro Overcharge rules!
     */
    executeServeHit(p, isPowerJumpServe, aimInput, charge = 0.84) {
      this.rallyState = 'play';
      this.servePhase = 'hold';
      this.serveCharge = 0;
      this.touchTeam = p.team;
      this.touchCount = 1;
      this.lastTouchPlayer = p.slot;

      const isLeft = p.team === 0;
      const dir = isLeft ? 1 : -1;
      const forwardStick = (aimInput.mx || 0) * dir;
      const isJump = isPowerJumpServe || this.serveType === 'jump' || p.onFire;
      const isDrop = !isJump && forwardStick < -0.22;

      const isSweetSpot = charge >= 0.74 && charge <= 0.92;
      const isOvercharged = charge > 0.92;
      const isEarly = charge < 0.45;

      // Keyed strike follow-through pose (fixed: use 'spike_follow' / 'set' without 'pose_' prefix!)
      p.actionState = isJump || isSweetSpot ? 'spike_follow' : 'set';
      p.actionTimer = 0.38;
      p.rig.applyActionImpulse(isJump ? 'spike' : 'set', isSweetSpot ? 1.45 : 1.1);

      const contactPose = isJump ? 'pose_spike_follow' : 'pose_set';
      const hs = this.renderer.getHandSocketWorld(p, contactPose);
      this.ball.x = hs.x;
      this.ball.y = hs.y;
      this.ball.z = Math.max(isJump ? 52 : 44, hs.z);
      this.ball.topspin = 0;
      this.ball.curveY = 0;
      this.ball.knuckle = 0;
      this.ball.knucklePhase = 0;
      this.ball.solarSpike = false;
      this.ball.onFireBall = false;
      this.ball.impactSquash = isSweetSpot ? 1.0 : 0.8;

      let targetX = isLeft ? COURT.netX + 235 : COURT.netX - 235;
      let targetY = Math.max(
        COURT.topY + 42,
        Math.min(COURT.botY - 42, p.y + (aimInput.my || (Math.random() - 0.5) * 0.7) * 145)
      );
      let tFlight = 0.85;
      let ringColor = '#ffb84d';

      if (isOvercharged) {
        if (this.serveRules === 'pro') {
          // Pro Risk Mode: Overcharging past 92% faults into the net or sails long out of bounds!
          const netFault = Math.random() < 0.5;
          if (netFault) {
            targetX = COURT.netX;
            tFlight = 0.44;
            this.ball.vz = -35;
            this.ball.vx = (targetX - this.ball.x) / tFlight;
            this.ball.vy = (targetY - this.ball.y) / tFlight;
            this.addCallout('OVERCHARGED! NET FAULT!', p.x, p.y - 105, '#ff3864');
          } else {
            targetX = isLeft ? COURT.rightX + 65 : COURT.leftX - 65;
            tFlight = 0.68;
            this.ball.vz = 0.5 * COURT.gravity * tFlight + (10 - this.ball.z) / tFlight;
            this.ball.vx = (targetX - this.ball.x) / tFlight;
            this.ball.vy = (targetY - this.ball.y) / tFlight;
            this.addCallout('OVERCHARGED! LONG OUT!', p.x, p.y - 105, '#ff3864');
          }
          ringColor = '#ff3864';
        } else {
          // Arcade Mode (No Faults): Overcharging clips the net tape for a dramatic Net Cord Trickle!
          const tNet = 0.46;
          this.ball.vz = 0.5 * COURT.gravity * tNet + (COURT.netHeight - 4 - this.ball.z) / tNet;
          this.ball.vx = (COURT.netX + dir * 6 - this.ball.x) / tNet;
          this.ball.vy = (targetY - this.ball.y) / (tNet * 1.6);
          this.addCallout('OVERCHARGED! NET TAPE!', p.x, p.y - 105, '#ff3864');
          ringColor = '#ff3864';
        }
      } else if (isEarly) {
        // Early release (< 45%): High, slow meatball lob that opponents can tee off on
        tFlight = 1.18;
        targetX = isLeft ? COURT.netX + 195 : COURT.netX - 195;
        this.ball.vz = 0.5 * COURT.gravity * tFlight + (10 - this.ball.z) / tFlight;
        this.ball.vx = (targetX - this.ball.x) / tFlight;
        this.ball.vy = (targetY - this.ball.y) / tFlight;
        this.addCallout('EARLY RELEASE • SOFT SERVE', p.x, p.y - 95, '#9ab0c9');
        ringColor = '#9ab0c9';
      } else if (p.onFire) {
        // 🔥 ON FIRE! METEOR JUMP SERVE: Screaming low-arc fireball with heavy topspin dive & lateral curve!
        this.ball.onFireBall = true;
        this.ball.solarSpike = true;
        this.ball.topspin = isSweetSpot ? 1.68 : 1.38;
        this.ball.curveY = ((aimInput.my || (Math.random() > 0.5 ? 1 : -1)) >= 0 ? 1 : -1) * 165;
        tFlight = isSweetSpot ? 0.54 : 0.62;
        const depth = isSweetSpot ? 305 : 265;
        targetX = isLeft ? COURT.netX + depth : COURT.netX - depth;
        const effG = COURT.gravity * (1.0 + this.ball.topspin * 0.34);
        this.ball.vz = 0.5 * effG * tFlight + (10 - this.ball.z) / tFlight;
        this.ball.vx = (targetX - this.ball.x) / tFlight;
        this.ball.vy = (targetY - this.ball.y) / tFlight - 0.5 * this.ball.curveY * tFlight;
        this.hitStopTimer = 0.055;
        this.cutInTimer = 1.35;
        this.cutInLabel = '🔥 METEOR JUMP SERVE!';
        this.poseCamPlayerIdx = p.slot;
        p.posePreviewTimer = 1.35;
        ringColor = '#ff5500';
        this.addCallout(
          isSweetSpot ? '🔥 SWEET SPOT! METEOR SERVE! 🔥' : '🔥 ON FIRE JUMP SERVE! 🔥',
          p.x,
          p.y - 115,
          '#ff5500'
        );
        AudioSys.playSolarSpike();
      } else if (isJump) {
        // ⚡ TOPSPIN JUMP-SERVE LASER (K / B): Flat high-speed trajectory that dives hard over the net!
        this.ball.topspin = isSweetSpot ? 1.52 : 1.25;
        tFlight = isSweetSpot ? 0.62 : 0.72;
        const depth = Math.max(175, Math.min(340, (isSweetSpot ? 295 : 250) + forwardStick * 55));
        targetX = isLeft ? COURT.netX + depth : COURT.netX - depth;
        const effG = COURT.gravity * (1.0 + this.ball.topspin * 0.34);
        this.ball.vz = 0.5 * effG * tFlight + (10 - this.ball.z) / tFlight;
        this.ball.vx = (targetX - this.ball.x) / tFlight;
        this.ball.vy = (targetY - this.ball.y) / tFlight;
        if (isSweetSpot) {
          this.hitStopTimer = 0.04;
          this.solar[p.team] = Math.min(100, this.solar[p.team] + 14);
        }
        ringColor = isSweetSpot ? '#34d399' : '#ffb84d';
        this.addCallout(
          isSweetSpot ? '⚡ SWEET SPOT! LASER SERVE!' : 'TOPSPIN JUMP SERVE!',
          p.x,
          p.y - 105,
          ringColor
        );
      } else if (isDrop) {
        // 🎯 SHORT CUT / RAZOR DROP SERVE (J + Stick Back): Barely clears net and dies in shallow sand!
        this.ball.topspin = 1.22;
        tFlight = isSweetSpot ? 0.72 : 0.80;
        const shallowDepth = isSweetSpot ? 105 : 135;
        targetX = isLeft ? COURT.netX + shallowDepth : COURT.netX - shallowDepth;
        const effG = COURT.gravity * (1.0 + this.ball.topspin * 0.34);
        this.ball.vz = 0.5 * effG * tFlight + (10 - this.ball.z) / tFlight;
        this.ball.vx = (targetX - this.ball.x) / tFlight;
        this.ball.vy = (targetY - this.ball.y) / tFlight;
        ringColor = '#2ce6ff';
        this.addCallout(
          isSweetSpot ? '🎯 SWEET SPOT! RAZOR DROP!' : 'SHORT DROP SERVE!',
          p.x,
          p.y - 100,
          '#2ce6ff'
        );
      } else {
        // 🌀 KNUCKLE FLOAT SERVE (J + Neutral/Forward): Zero spin, dances sideways in mid-air!
        this.ball.knuckle = isSweetSpot ? 1.45 : 0.95;
        this.ball.knucklePhase = Math.random() * Math.PI * 2;
        tFlight = isSweetSpot ? 0.78 : 0.88;
        const depth = Math.max(180, Math.min(325, 245 + forwardStick * 55));
        targetX = isLeft ? COURT.netX + depth : COURT.netX - depth;
        this.ball.vz = 0.5 * COURT.gravity * tFlight + (10 - this.ball.z) / tFlight;
        this.ball.vx = (targetX - this.ball.x) / tFlight;
        this.ball.vy = (targetY - this.ball.y) / tFlight;
        ringColor = isSweetSpot ? '#34d399' : '#2ce6ff';
        this.addCallout(
          isSweetSpot ? '🌀 SWEET SPOT! KNUCKLE FLOAT!' : 'FLOAT SERVE!',
          p.x,
          p.y - 100,
          ringColor
        );
      }

      this.renderer.addImpactRing(hs.screenX, hs.screenY, ringColor, isSweetSpot ? 48 : 36);
      AudioSys.playHit(isJump ? 0.92 : 0.68, isSweetSpot ? 1.15 : 0.98);
      this.predictBallLanding();

      const recvTeam = 1 - p.team;
      this.assignClosestDefender(recvTeam);
    }

    /**
     * Defensive Counter-Play Rule: Any active defensive counter-play (Timed Counter Dig,
     * Sand Dive Save, or Net Roof Block) ALWAYS extinguishes the opponent's 🔥 ON FIRE state!
     */
    extinguishFireByCounterPlay(defender, reasonText) {
      const oppTeam = 1 - defender.team;
      const wasOppOnFire = this.teamOnFire[oppTeam] || this.ball.onFireBall || this.ball.solarSpike;
      if (!wasOppOnFire) return false;

      this.teamOnFire[oppTeam] = false;
      this.streak[oppTeam] = 0;
      this.players.forEach((pl) => {
        if (pl.team === oppTeam) pl.onFire = false;
      });
      this.ball.onFireBall = false;
      this.ball.solarSpike = false;

      this.solar[defender.team] = Math.min(100, this.solar[defender.team] + 35);
      this.hitStopTimer = 0.06;
      const hs = this.renderer.getHandSocketWorld(defender, this.renderer.selectPoseKey(defender, false));
      this.renderer.addImpactRing(hs.screenX, hs.screenY, '#2ce6ff', 58);
      this.addCallout(`🧯 FIRE EXTINGUISHED! ${reasonText}`, defender.x, defender.y - 115, '#2ce6ff');
      this.updateScoreHud();
      return true;
    }

    assignClosestDefender(team) {
      if (!this.ballLanding) return;
      const s0 = team === 0 ? 0 : 2;
      const s1 = team === 0 ? 1 : 3;
      const d0 = Math.hypot(this.players[s0].x - this.ballLanding.handX, this.players[s0].y - this.ballLanding.handY);
      const d1 = Math.hypot(this.players[s1].x - this.ballLanding.handX, this.players[s1].y - this.ballLanding.handY);
      this.enforceAutoHandoffOnTeam(team, d0 <= d1 ? s0 : s1);
    }

    handleBallContact(p, input) {
      const team = p.team;
      const isLeft = team === 0;
      const dir = isLeft ? 1 : -1;
      const partnerSlot = p.slot % 2 === 0 ? p.slot + 1 : p.slot - 1;
      const partner = this.players[partnerSlot];

      if (this.touchTeam !== team) {
        this.touchTeam = team;
        this.touchCount = 0;
      }

      // Clear any serve spin/curve properties on contact
      this.ball.topspin = 0;
      this.ball.curveY = 0;
      this.ball.knuckle = 0;

      // Check for Net Block (jumping at the net as ball crosses — ALWAYS counts as a Counter-Play!)
      const nearNet = Math.abs(p.x - COURT.netX) < 66;
      if (this.touchCount === 0 && p.z > 16 && nearNet && this.ball.z > COURT.netHeight - 10) {
        const hs = this.renderer.getHandSocketWorld(p, 'pose_set');
        const extinguished = this.extinguishFireByCounterPlay(p, 'ROOF BLOCK!');
        this.touchCount = 0;
        this.touchTeam = team;
        this.lastTouchPlayer = p.slot;
        this.ball.x = hs.x;
        this.ball.y = hs.y;
        this.ball.z = Math.max(COURT.netHeight + 6, hs.z);
        this.ball.vx = dir * (320 + p.profile.power * 110);
        this.ball.vy = (Math.random() - 0.5) * 165;
        this.ball.vz = -125;
        this.ball.solarSpike = false;
        this.ball.onFireBall = p.onFire;
        this.ball.impactSquash = 1.0;

        p.actionState = 'spike_follow';
        p.actionTimer = 0.35;
        p.rig.applyActionImpulse('spike', 1.35);
        this.hitStopTimer = 0.055; // NBA Jam block freeze!
        this.solar[team] = Math.min(100, this.solar[team] + 22);
        if (!extinguished) {
          this.addCallout('REJECTED! ROOF BLOCK!', p.x, p.y - 115, '#2ce6ff');
          this.renderer.addImpactRing(hs.screenX, hs.screenY, '#2ce6ff', 48);
        }
        AudioSys.playHit(1.0, 0.78);
        this.predictBallLanding();
        this.assignClosestDefender(1 - team);
        this.updateTouchHud();
        this.updateScoreHud();
        return;
      }

      this.touchCount += 1;
      this.lastTouchPlayer = p.slot;

      if (this.touchCount === 1) {
        // TOUCH 1: DIG / RECEPTION PASS FROM FOREARM PLATFORM TO SETTER SPOT
        const contactPose = p.diveLockTimer > 0 ? 'pose_dive' : 'pose_dig';
        const hs = this.renderer.getHandSocketWorld(p, contactPose);

        // Snap ball cleanly to the athlete's forearm/hand socket on reception!
        this.ball.x = hs.x;
        this.ball.y = hs.y;
        this.ball.z = Math.max(22, hs.z);

        const wasSolarOrFire =
          this.ball.solarSpike || this.ball.onFireBall || this.teamOnFire[1 - team];
        const isCounterPlay =
          p.diveLockTimer > 0 ||
          p.activeDigTimer > 0 ||
          (p.controllerType === 'ai' && Math.random() < 0.44);

        let setterTargetX = isLeft ? COURT.netX - 82 : COURT.netX + 82;
        let setterTargetY = Math.max(
          COURT.topY + 55,
          Math.min(COURT.botY - 55, partner.y * 0.65 + 475 * 0.35)
        );
        let tFlight = 0.98;

        if (wasSolarOrFire && isCounterPlay) {
          // Active Defensive Counter-Play ALWAYS extinguishes opponent's ON FIRE state!
          this.extinguishFireByCounterPlay(p, p.diveLockTimer > 0 ? 'DIVING SAVE!' : 'COUNTER DIG!');
          p.vx = -dir * 95;
          this.renderer.addSandTrail(p.x, p.y, 24);
        } else if (wasSolarOrFire && !isCounterPlay) {
          // Passive auto-bump on an ON FIRE / Solar ball: blasts defender back & scrambles pass!
          this.ball.solarSpike = false;
          this.ball.onFireBall = false;
          p.vx = -dir * 215;
          this.renderer.addSandTrail(p.x, p.y, 32);
          this.hitStopTimer = 0.055;
          tFlight = 1.24;
          setterTargetX += (Math.random() - 0.5) * 135;
          setterTargetY = Math.max(
            COURT.topY + 40,
            Math.min(COURT.botY - 40, setterTargetY + (Math.random() - 0.5) * 130)
          );
          this.addCallout('🔥 SCRAMBLED RECEPTION!', p.x, p.y - 102, '#ff7b29');
          this.renderer.addImpactRing(hs.screenX, hs.screenY, '#ff7b29', 42);
        } else {
          this.ball.solarSpike = false;
          this.ball.onFireBall = false;
          this.solar[team] = Math.min(100, this.solar[team] + (isCounterPlay ? 18 : 12));
          this.addCallout(isCounterPlay ? 'LOCKED-IN DIG!' : 'CLEAN DIG!', p.x, p.y - 95, '#2ce6ff');
          this.renderer.addImpactRing(hs.screenX, hs.screenY, '#2ce6ff', 34);
        }

        this.ball.vz = 0.5 * COURT.gravity * tFlight + (58 - this.ball.z) / tFlight;
        this.ball.vx = (setterTargetX - this.ball.x) / tFlight;
        this.ball.vy = (setterTargetY - this.ball.y) / tFlight;
        this.ball.impactSquash = 0.85;

        p.actionState = p.diveLockTimer > 0 ? 'dive' : 'dig';
        p.actionTimer = 0.32;
        p.activeDigTimer = 0;
        p.rig.applyActionImpulse('dig', wasSolarOrFire ? 1.55 : 1.05);
        AudioSys.playHit(0.7, 1.05);

        this.enforceAutoHandoffOnTeam(team, p.slot);
      } else if (this.touchCount === 2) {
        // TOUCH 2: OVERHEAD SET FROM HANDS WINDOW TO ATTACKER (OR 2ND-TOUCH SETTER DUMP)
        const hs = this.renderer.getHandSocketWorld(p, 'pose_set');
        this.ball.x = hs.x;
        this.ball.y = hs.y;
        this.ball.z = Math.max(48, hs.z);
        this.ball.impactSquash = 0.65;

        const wantsSetterDump =
          p.controllerType !== 'ai' && (input.btnSwitch || ((isLeft ? input.mx > 0.7 : input.mx < -0.7) && p.z > 14));

        if (wantsSetterDump) {
          const targetX = isLeft ? COURT.netX + 145 : COURT.netX - 145;
          const targetY = p.y < 475 ? COURT.botY - 65 : COURT.topY + 65;
          const tFlight = 0.64;
          this.ball.vz = 0.5 * COURT.gravity * tFlight + (12 - this.ball.z) / tFlight;
          this.ball.vx = (targetX - this.ball.x) / tFlight;
          this.ball.vy = (targetY - this.ball.y) / tFlight;
          p.actionState = 'spike_follow';
          p.actionTimer = 0.32;
          p.rig.applyActionImpulse('spike', 1.1);
          this.addCallout('SNEAKY DUMP!', p.x, p.y - 95, '#ffb84d');
          this.renderer.addImpactRing(hs.screenX, hs.screenY, '#ffb84d', 36);
          AudioSys.playHit(0.75, 1.2);
          this.predictBallLanding();
          this.assignClosestDefender(1 - team);
        } else {
          const setType = this.requestedSetType[team] || (input.btnB ? 'quick' : 'high');
          this.requestedSetType[team] = null;

          const tFlight = setType === 'quick' ? 0.72 : 1.08;
          const attackX = isLeft
            ? Math.max(COURT.leftX + 95, Math.min(COURT.netX - 46, partner.x + 75))
            : Math.max(COURT.netX + 46, Math.min(COURT.rightX - 95, partner.x - 75));
          const attackY = Math.max(
            COURT.topY + 40,
            Math.min(COURT.botY - 40, partner.y + (input.my || 0) * 65)
          );

          // Aim set trajectory so it peaks right at the attacker's overhead spike handSocket height (~96)!
          const peakHeight = setType === 'quick' ? 82 : 104;
          this.ball.vz = 0.5 * COURT.gravity * tFlight + (peakHeight - this.ball.z) / tFlight;
          this.ball.vx = (attackX - this.ball.x) / tFlight;
          this.ball.vy = (attackY - this.ball.y) / tFlight;

          this.ball.tandemSync = p.controllerType !== 'ai' && partner.controllerType !== 'ai';

          p.actionState = 'set';
          p.actionTimer = 0.34;
          p.rig.applyActionImpulse('set', 1.1);
          this.solar[team] = Math.min(100, this.solar[team] + 14);
          this.addCallout(
            setType === 'quick' ? 'TURBO QUICK SET!' : 'ALLEY-OOP SET!',
            p.x,
            p.y - 95,
            '#ffb84d'
          );
          this.renderer.addImpactRing(hs.screenX, hs.screenY, '#ffb84d', 32);
          AudioSys.playHit(0.6, 1.18);

          this.enforceAutoHandoffOnTeam(team, partner.slot);
        }
      } else {
        // TOUCH 3: KEYED BOW-ARCH SPIKE -> WHIP FOLLOW-THROUGH SNAP!
        const airborne = p.z > 14;
        const canSolar = airborne && (this.solar[team] >= 100 || p.onFire);
        const hs = this.renderer.getHandSocketWorld(p, airborne ? 'pose_spike' : 'pose_set');

        // Snap ball cleanly to the overhead hitting hand socket at the moment of whip impact!
        this.ball.x = hs.x;
        this.ball.y = hs.y;
        this.ball.z = Math.max(46, hs.z);
        this.ball.impactSquash = 1.0;

        let targetX, targetY, tFlight;
        if (canSolar) {
          if (!p.onFire) this.solar[team] = 0;
          this.ball.solarSpike = true;
          this.ball.onFireBall = p.onFire;
          tFlight = p.onFire ? 0.34 : 0.38;
          targetX = isLeft ? COURT.netX + 245 : COURT.netX - 245;
          targetY =
            Math.abs(input.my) > 0.25
              ? input.my < 0
                ? COURT.topY + 45
                : COURT.botY - 45
              : p.y < 475
              ? COURT.botY - 55
              : COURT.topY + 55;

          this.cutInTimer = 1.65;
          this.cutInLabel = p.onFire ? '🔥 ON FIRE SLAM!' : p.profile.signatureMove;
          this.poseCamPlayerIdx = p.slot;
          p.posePreviewTimer = 1.65;
          this.hitStopTimer = 0.065; // Crispy 4-frame NBA Jam monster dunk/spike freeze!
          this.addCallout(
            p.onFire ? `🔥 ${p.profile.name} IS ON FIRE! 🔥` : `★ ${p.profile.signatureMove}! ★`,
            p.x,
            p.y - 120,
            p.onFire ? '#ff5500' : p.profile.signatureColor
          );
          this.renderer.addImpactRing(hs.screenX, hs.screenY, '#ff5500', 58);
          AudioSys.playSolarSpike();
        } else if (airborne) {
          const isCutShot = input.btnA && !input.btnB;
          tFlight = isCutShot ? 0.68 : this.ball.tandemSync ? 0.42 : 0.48;
          const depth = isCutShot ? 130 : 270 + p.profile.power * 70;
          targetX = isLeft ? COURT.netX + depth : COURT.netX - depth;
          targetY =
            Math.abs(input.my) > 0.2
              ? Math.max(COURT.topY + 35, Math.min(COURT.botY - 35, p.y + input.my * 165))
              : p.y < 475
              ? COURT.botY - 65
              : COURT.topY + 65;

          const label = this.ball.tandemSync
            ? 'ALLEY-OOP SLAM!'
            : isCutShot
            ? 'CUT DROP!'
            : 'BOOMSHAKALAKA!';
          this.hitStopTimer = 0.045;
          this.addCallout(label, p.x, p.y - 108, '#ff477e');
          this.renderer.addImpactRing(hs.screenX, hs.screenY, '#ff477e', 44);
          this.solar[team] = Math.min(100, this.solar[team] + (this.ball.tandemSync ? 30 : 18));
          AudioSys.playHit(0.95, isCutShot ? 1.12 : 0.86);
        } else {
          tFlight = 0.95;
          targetX = isLeft ? COURT.netX + 210 : COURT.netX - 210;
          targetY = 475 + (input.my || 0) * 110;
          this.addCallout('FREE BALL', p.x, p.y - 88, '#9ab0c9');
          this.renderer.addImpactRing(hs.screenX, hs.screenY, '#9ab0c9', 28);
          AudioSys.playHit(0.55, 1.0);
        }

        this.ball.vz = 0.5 * COURT.gravity * tFlight + (10 - this.ball.z) / tFlight;
        this.ball.vx = (targetX - this.ball.x) / tFlight;
        this.ball.vy = (targetY - this.ball.y) / tFlight;

        // Keyed Transition: Bow-Arch (`pose_spike`) snaps into Forward Whip Follow-Through (`pose_spike_follow`)!
        p.actionState = airborne ? 'spike_follow' : 'set';
        p.actionTimer = 0.38;
        p.rig.applyActionImpulse('spike', canSolar ? 1.7 : 1.35);

        this.predictBallLanding();
        this.assignClosestDefender(1 - team);
      }

      this.predictBallLanding();
      this.updateTouchHud();
      this.updateScoreHud();
    }

    scorePoint(winnerTeam, reason) {
      this.rallyState = 'point_scored';
      this.pointTimer = 1.75;
      this.score[winnerTeam] += 1;

      // Update NBA Jam Heating Up / ON FIRE Streak!
      this.streak[winnerTeam] += 1;
      this.streak[1 - winnerTeam] = 0;
      this.teamOnFire[1 - winnerTeam] = false;
      if (this.streak[winnerTeam] >= 3) {
        this.teamOnFire[winnerTeam] = true;
      }

      this.players.forEach((p) => {
        p.onFire = this.teamOnFire[p.team];
      });

      let matchWon = false;
      if (this.score[winnerTeam] >= 15 && this.score[winnerTeam] - this.score[1 - winnerTeam] >= 2) {
        matchWon = true;
      }

      const teamName = winnerTeam === 0 ? 'SUNSET' : 'RIPTIDE';
      const streakTag =
        this.streak[winnerTeam] >= 3
          ? ' 🔥 ON FIRE!!'
          : this.streak[winnerTeam] === 2
          ? ' • HEATING UP!'
          : '';
      const banner = matchWon
        ? `MATCH POINT! ${teamName} WINS ${this.score[0]} - ${this.score[1]}!`
        : `${reason} • ${teamName} POINT!${streakTag}`;
      this.addCallout(banner, 640, 235, this.teamOnFire[winnerTeam] ? '#ff5500' : winnerTeam === 0 ? '#ffb84d' : '#2ce6ff');
      document.getElementById('match-meta').textContent = banner;

      const celebSlot = winnerTeam === 0 ? 0 : 2;
      this.poseCamPlayerIdx = celebSlot;
      this.cutInTimer = 1.65;
      this.cutInLabel = this.teamOnFire[winnerTeam] ? '🔥 ON FIRE STREAK!' : 'POINT CELEBRATION!';

      this.players.forEach((p) => {
        if (p.team === winnerTeam) {
          this.triggerKeyedJump(p, 185);
          p.rig.applyActionImpulse('celebrate', 1.35);
        }
      });

      AudioSys.playWhistle(matchWon);
      AudioSys.playPointFanfare();
      this.updateScoreHud();

      if (matchWon) {
        setTimeout(() => {
          this.score = [0, 0];
          this.streak = [0, 0];
          this.teamOnFire = [false, false];
          this.updateScoreHud();
        }, 1850);
      }
    }

    updateGamepadStatusBanner() {
      const pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : [];
      const el = document.getElementById('gamepad-status-text');
      if (!el) return;
      if (pads.length > 0) {
        el.textContent = `Connected Gamepads (${pads.length}/4): ${pads
          .map((g, i) => `GP${i + 1}: ${g.id.slice(0, 24)}`)
          .join(' • ')}`;
      }
    }

    /**
     * Pre-Contact Anticipation Pose Selector:
     * Transitions the receiving/setting athlete into `pose_dig` or `pose_set` 240ms *before*
     * the ball reaches their hands so you see a strong keyed Pose A -> Pose B anticipation!
     */
    updatePreContactAnticipation(p) {
      if (this.rallyState !== 'play' || p.z > 2 || p.diveLockTimer > 0 || p.jumpCoilTimer > 0 || p.actionTimer > 0) {
        return;
      }
      if (!this.ballLanding) {
        if (p.actionState === 'dig' || p.actionState === 'set') p.actionState = 'idle';
        return;
      }

      const isLeft = p.team === 0;
      const ballOnOurSide =
        (isLeft && this.ballLanding.x <= COURT.netX + 15) ||
        (!isLeft && this.ballLanding.x >= COURT.netX - 15);

      if (!ballOnOurSide) {
        if (p.actionState === 'dig' || p.actionState === 'set') p.actionState = 'idle';
        return;
      }

      const distToHandTarget = Math.hypot(p.x - this.ballLanding.handX, p.y - this.ballLanding.handY);
      const timeToHand = this.ballLanding.tHand || 1.0;

      if (distToHandTarget < 95 && timeToHand < 0.34 && this.lastTouchPlayer !== p.slot) {
        const nextTouch = this.touchTeam === p.team ? this.touchCount + 1 : 1;
        if (nextTouch === 1) {
          p.actionState = 'dig';
        } else if (nextTouch === 2) {
          p.actionState = 'set';
        }
      } else if (p.actionState === 'dig' || p.actionState === 'set') {
        p.actionState = 'idle';
      }
    }

    update(dt) {
      if (this.demoFreeze) {
        if (
          this.keys['KeyW'] ||
          this.keys['KeyA'] ||
          this.keys['KeyS'] ||
          this.keys['KeyD'] ||
          this.keys['KeyJ'] ||
          this.keys['KeyK'] ||
          this.keys['Space'] ||
          this.keys['ArrowUp'] ||
          this.keys['ArrowDown'] ||
          this.keys['ArrowLeft'] ||
          this.keys['ArrowRight']
        ) {
          this.demoFreeze = false;
        } else {
          this.renderer.updateTrails(dt, this.players, true);
          this.players.forEach((p) => p.rig.update(dt, p, this.physicsPreset));
          this.ball.spinAngle = (this.ball.spinAngle || 0) + 5.5 * dt;
          this.prevKeys = { ...this.keys };
          return;
        }
      }

      this.renderer.updateTrails(dt, this.players, false);
      this.updateGamepadStatusBanner();

      if (this.cutInTimer > 0) {
        this.cutInTimer = Math.max(0, this.cutInTimer - dt);
      }

      // Hit-stop freeze on heavy spikes / roof blocks (soft-body springs continue vibrating during freeze!)
      if (this.hitStopTimer > 0) {
        this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
        this.players.forEach((p) => p.rig.update(dt, p, this.physicsPreset));
        return;
      }

      for (let i = this.callouts.length - 1; i >= 0; i--) {
        this.callouts[i].y -= 26 * dt;
        this.callouts[i].timer -= dt;
        if (this.callouts[i].timer <= 0) {
          this.callouts.splice(i, 1);
        }
      }

      if (this.rallyState === 'point_scored') {
        this.pointTimer -= dt;
        if (this.pointTimer <= 0) {
          this.resetServe(this.servingTeam);
        }
      }

      // Step all 4 athletes
      this.players.forEach((p) => {
        const input =
          p.controllerType === 'ai' ? this.computeAIInput(p, dt) : this.readControllerInput(p.controllerType);

        // NBA Jam Turbo Sprint meter management
        const moving = Math.hypot(input.mx, input.my) > 0.15;
        if (input.turbo && moving && (p.turbo > 8 || p.onFire)) {
          p.turboActive = true;
          if (!p.onFire) p.turbo = Math.max(0, p.turbo - dt * 38);
        } else {
          p.turboActive = false;
          p.turbo = Math.min(100, p.turbo + dt * (p.onFire ? 45 : 22));
        }

        // Record afterimage ghost trail when Turbo sprinting or airborne ON FIRE
        p.ghostTimer -= dt;
        if ((p.turboActive || p.onFire || p.diveLockTimer > 0 || p.z > 22) && p.ghostTimer <= 0) {
          p.ghostTimer = 0.045;
          p.ghostTrail.push({
            x: p.x,
            y: p.y,
            z: p.z,
            poseKey: this.renderer.selectPoseKey(p, false)
          });
          if (p.ghostTrail.length > 3) p.ghostTrail.shift();
        } else if (!p.turboActive && !p.onFire && p.z === 0 && p.ghostTrail.length > 0 && p.ghostTimer <= 0) {
          p.ghostTimer = 0.04;
          p.ghostTrail.shift();
        }

        if (p.controllerType !== 'ai') {
          if (input.btnSwitch && this.rallyState === 'play') {
            this.manualSwapTeamControl(p.team);
          }
          if (this.rallyState === 'play' && this.touchTeam === p.team && this.touchCount === 1) {
            if (input.btnA) this.requestedSetType[p.team] = 'high';
            if (input.btnB) this.requestedSetType[p.team] = 'quick';
          }
        }

        if (this.rallyState === 'serve' && this.serverSlot === p.slot) {
          p.vy = input.my * 185;
          p.y = Math.max(COURT.topY + 25, Math.min(COURT.botY - 25, p.y + p.vy * dt));

          if (this.servePhase === 'hold') {
            const hs = this.renderer.getHandSocketWorld(p, 'pose_ready');
            this.ball.x = hs.x;
            this.ball.y = hs.y;
            this.ball.z = hs.z;

            if (input.btnA || input.btnB) {
              this.startServeToss(p, input.btnB);
            }
          } else if (this.servePhase === 'toss') {
            const dir = p.team === 0 ? 1 : -1;
            this.serveAimDrop = this.serveType === 'float' && input.mx * dir < -0.22;
            this.serveCharge = Math.min(1.0, this.serveCharge + dt * 1.75);

            // Step tossed ball rising in front of server
            this.ball.x += this.ball.vx * dt;
            this.ball.vz -= COURT.gravity * 0.72 * dt;
            this.ball.z = Math.max(28, this.ball.z + this.ball.vz * dt);
            this.ball.spinAngle = (this.ball.spinAngle || 0) + 9.5 * dt;

            const holdingAny = input.holdA || input.holdB;
            if (!holdingAny && this.serveCharge < 0.18) {
              // Quick tap-and-release: switches to Double-Tap / Single-Tap auto-sweet-spot mode!
              this.serveHoldMode = false;
            }

            if (this.serveHoldMode) {
              if (!holdingAny || this.serveCharge >= 1.0) {
                this.executeServeHit(p, this.serveType === 'jump', input, this.serveCharge);
              }
            } else {
              if (input.btnA || input.btnB) {
                this.executeServeHit(p, this.serveType === 'jump' || input.btnB, input, this.serveCharge);
              } else if (this.serveCharge >= 0.82) {
                // Non-gamer single-tap helper: auto-strikes cleanly inside the Sweet Spot at apex!
                this.executeServeHit(p, this.serveType === 'jump', input, 0.80);
              }
            }
          }
        } else if (this.rallyState === 'play') {
          if (p.activeDigTimer > 0) {
            p.activeDigTimer = Math.max(0, p.activeDigTimer - dt);
          }

          if (p.diveLockTimer > 0) {
            p.diveLockTimer -= dt;
            p.vx *= 0.92;
            p.vy *= 0.92;
          } else {
            const turboBoost = p.onFire ? 1.38 : p.turboActive ? 1.32 : 1.0;
            const maxSpd = (235 + p.profile.speed * 80) * turboBoost;
            p.vx = input.mx * maxSpd;
            p.vy = input.my * maxSpd * 0.88;

            if ((input.btnA || input.btnB) && p.z === 0 && p.jumpCoilTimer <= 0) {
              const hsDig = this.renderer.getHandSocketWorld(p, 'pose_dive');
              const distToBall = Math.hypot(this.ball.x - hsDig.x, this.ball.y - hsDig.y);
              const onDefense = this.touchTeam !== p.team;
              const nearNet = Math.abs(p.x - COURT.netX) <= 78;

              if (onDefense) {
                // Register active defensive Counter-Play timing window (extinguishes ON FIRE!)
                p.activeDigTimer = 0.36;
              }

              const wantDive =
                input.btnB &&
                onDefense &&
                this.ball.z < 64 &&
                distToBall > 24 &&
                distToBall < 135 &&
                (Math.abs(input.mx) > 0.1 || Math.abs(input.my) > 0.1);

              const wantCounterDig =
                input.btnA && onDefense && !nearNet && this.ball.z < 78;

              if (wantDive) {
                const dx = this.ball.x - hsDig.x;
                const dy = this.ball.y - hsDig.y;
                const d = Math.hypot(dx, dy) || 1;
                p.vx = (dx / d) * 410;
                p.vy = (dy / d) * 340;
                p.vz = 90;
                p.diveLockTimer = 0.44;
                p.actionState = 'dive';
                p.actionTimer = 0.44;
                p.rig.applyActionImpulse('dive', 1.35);
                this.renderer.addSandTrail(p.x, p.y, 26);
                AudioSys.playSandDive();
              } else if (wantCounterDig) {
                // Active Counter-Dig stance in backcourt (locks forearm platform without jumping over the ball!)
                p.actionState = 'dig';
                p.actionTimer = 0.34;
                p.rig.applyActionImpulse('dig', 1.15);
              } else {
                const jumpVel = 248 + p.profile.jump * 62;
                this.triggerKeyedJump(p, jumpVel);
              }
            }
          }

          p.x += p.vx * dt;
          p.y += p.vy * dt;

          if (p.team === 0) {
            p.x = Math.max(COURT.leftX - 45, Math.min(COURT.netX - 18, p.x));
          } else {
            p.x = Math.max(COURT.netX + 18, Math.min(COURT.rightX + 45, p.x));
          }
          p.y = Math.max(COURT.topY - 30, Math.min(COURT.botY + 30, p.y));

          if (p.z === 0 && Math.hypot(p.vx, p.vy) > 45 && Math.random() < (p.turboActive ? 0.45 : 0.22)) {
            this.renderer.addSandTrail(p.x, p.y, p.turboActive ? 15 : 11);
          }

          // Update pre-contact anticipation pose (coils into dig/set before ball arrives!)
          this.updatePreContactAnticipation(p);

          // True Hand/Forearm Socket Collision Check!
          const activePose = this.renderer.selectPoseKey(p, false);
          const hs = this.renderer.getHandSocketWorld(p, activePose);
          const distHandXY = Math.hypot(this.ball.x - hs.x, this.ball.y - hs.y);
          const distHandZ = Math.abs(this.ball.z - hs.z);
          const hitRadiusXY = p.actionState === 'dive' ? 54 : p.activeDigTimer > 0 ? 48 : 42;
          const hitRadiusZ = p.z > 14 ? 44 : 38;

          if (
            distHandXY < hitRadiusXY &&
            distHandZ < hitRadiusZ &&
            this.lastTouchPlayer !== p.slot
          ) {
            this.handleBallContact(p, input);
          }
        }

        // Step Keyed Jump Coil -> Airborne Bow-Arch Launch!
        if (p.jumpCoilTimer > 0) {
          p.jumpCoilTimer -= dt;
          if (p.jumpCoilTimer <= 0) {
            p.vz = p.pendingJumpImpulse || 260;
            p.pendingJumpImpulse = 0;
            p.actionState = 'spike';
            p.actionTimer = 0.55;
            p.rig.applyActionImpulse('jump', 1.35);
          }
        }

        // Vertical gravity with NBA Jam Apex Hangtime (reduced gravity near apex of jump!)
        if (p.z > 0 || p.vz !== 0) {
          const nearApex = p.z > 32 && Math.abs(p.vz) < 85;
          const effGrav = nearApex ? COURT.gravity * 0.48 : COURT.gravity;
          p.vz -= effGrav * dt;
          p.z += p.vz * dt;
          if (p.z <= 0) {
            p.z = 0;
            p.vz = 0;
            // Brief landing compression crouch (`pose_jump_coil`) on touchdown!
            p.actionState = 'jump_coil';
            p.actionTimer = 0.11;
            p.rig.applyActionImpulse('land', 1.25);
            this.renderer.addSandTrail(p.x, p.y, 20);
          }
        }

        if (p.actionTimer > 0) {
          p.actionTimer -= dt;
          if (p.actionTimer <= 0 && p.z === 0 && p.jumpCoilTimer <= 0) {
            p.actionState = 'idle';
          }
        }
        if (p.posePreviewTimer > 0) {
          p.posePreviewTimer = Math.max(0, p.posePreviewTimer - dt);
        }

        p.rig.update(dt, p, this.physicsPreset);
      });

      // Step Volleyball Physics
      if (this.ball.impactSquash > 0) {
        this.ball.impactSquash = Math.max(0, this.ball.impactSquash - dt * 6.5);
      }

      if (this.rallyState === 'play') {
        const b = this.ball;
        const prevX = b.x;

        // Apply Topspin downward dive, Meteor lateral curve, and Knuckle-Float aerodynamic wobble!
        const gravMult = 1.0 + (b.topspin || 0) * 0.34;
        if (b.curveY) {
          b.vy += b.curveY * dt;
        }
        if (b.knuckle > 0) {
          b.knucklePhase = (b.knucklePhase || 0) + 14.5 * dt;
          b.vy += Math.cos(b.knucklePhase) * 265 * b.knuckle * dt;
          this.predictBallLanding();
        }

        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vz -= COURT.gravity * gravMult * dt;
        b.z += b.vz * dt;
        const spinSpd = b.knuckle > 0 ? 1.4 : b.vx * 0.035 + (b.topspin ? 13.5 : 7.5);
        b.spinAngle += spinSpd * dt;

        b.trail.push({ x: b.x, y: b.y, z: b.z });
        if (b.trail.length > 12) b.trail.shift();

        // Check Net Crossing & Net Cord Collision
        if ((prevX < COURT.netX && b.x >= COURT.netX) || (prevX > COURT.netX && b.x <= COURT.netX)) {
          if (b.z < COURT.netHeight) {
            if (b.z > COURT.netHeight - 12 || this.serveRules === 'arcade') {
              b.vx *= 0.45;
              b.vz = Math.max(65, Math.abs(b.vz) * 0.4);
              b.z = COURT.netHeight + 2;
              b.topspin = 0;
              b.curveY = 0;
              b.knuckle = 0;
              b.impactSquash = 0.7;
              this.addCallout('NET CORD TRICKLE!', COURT.netX, b.y - 75, '#ffb84d');
              AudioSys.playHit(0.4, 0.7);
              this.predictBallLanding();
            } else {
              b.vx *= -0.28;
              b.vz = -40;
              b.topspin = 0;
              b.impactSquash = 0.9;
              AudioSys.playHit(0.5, 0.6);
            }
          } else {
            const newSide = b.vx > 0 ? 1 : 0;
            if (this.touchTeam !== newSide) {
              this.touchTeam = newSide;
              this.touchCount = 0;
              this.lastTouchPlayer = -1;
              this.updateTouchHud();
              this.assignClosestDefender(newSide);
            }
          }
        }

        // Check Sand Bounce (Point Scored!)
        if (b.z <= 6) {
          b.z = 6;
          b.impactSquash = 1.0;
          this.renderer.addSandTrail(b.x, b.y, b.onFireBall ? 34 : 24);
          this.renderer.addImpactRing(b.x, b.y - 6, b.onFireBall ? '#ff5500' : '#ffb84d', 42);
          AudioSys.playSandDive();

          const inY = b.y >= COURT.topY - 8 && b.y <= COURT.botY + 8;
          const inX = b.x >= COURT.leftX - 8 && b.x <= COURT.rightX + 8;
          const landedSide = b.x < COURT.netX ? 0 : 1;

          if (inX && inY) {
            const winner = 1 - landedSide;
            this.servingTeam = winner;
            this.scorePoint(winner, 'IN BOUNDS');
          } else {
            const hitterTeam = this.lastTouchPlayer >= 0 ? this.players[this.lastTouchPlayer].team : 1 - landedSide;
            const winner = 1 - hitterTeam;
            this.servingTeam = winner;
            this.scorePoint(winner, 'OUT OF BOUNDS');
          }
        }
      }

      this.prevKeys = { ...this.keys };
    }

    loop(now) {
      const dt = Math.min(0.033, (now - this.lastTime) / 1000);
      this.lastTime = now;

      this.update(dt);
      this.renderer.renderScene(now * 0.001, this);

      requestAnimationFrame((t) => this.loop(t));
    }
  }

  function b5Pressed(gp) {
    return !!(gp.buttons[5] && gp.buttons[5].pressed);
  }

  window.addEventListener('DOMContentLoaded', () => {
    const g = new SunbreakGame();
    window.SUNBREAK_GAME = g;
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot === 'pose') {
      g.toggleLobbyModal(false);
      g.poseCamActive = true;
      g.rallyState = 'serve';
      g.servePhase = 'toss';
      g.serveType = 'jump';
      g.serveCharge = 0.84; // Showcase the new Serve Power & Sweet-Spot Bar right in the ★ SWEET ★ zone!
      g.demoFreeze = true;
      const aParam = params.get('athlete');
      if (aParam !== null) {
        const aIdx = parseInt(aParam, 10);
        g.players[0].profile = ROSTER[aIdx % ROSTER.length];
        g.players[0].rig = new SoftBodyRig(g.players[0].profile);
      }
      g.poseCamPlayerIdx = 0;
      g.players[0].z = 36;
      g.players[0].actionState = 'spike';
      g.players[0].actionTimer = 4.0;
      g.players[0].ghostTrail = [{ x: 248, y: 502, z: 8, poseKey: 'pose_jump_coil' }];
      g.players[0].rig.applyActionImpulse('celebrate', 1.45);
      // Showcase keyed Jump Coil on Partner Elena and Dig on Nyx!
      g.players[1].actionState = 'jump_coil';
      g.players[1].actionTimer = 4.0;
      g.players[2].actionState = 'dig';
      g.players[2].actionTimer = 4.0;
      const hs0 = g.renderer.getHandSocketWorld(g.players[0], 'pose_spike');
      g.ball.x = hs0.x + 8;
      g.ball.y = hs0.y;
      g.ball.z = hs0.z + 6;
    } else if (shot === 'neon') {
      g.toggleLobbyModal(false);
      g.lightingTheme = 'neon';
      g.renderer.theme = 'neon';
      g.physicsPreset = 'overdrive';
      g.rallyState = 'play';
      g.demoFreeze = true;
      g.teamOnFire = [true, false];
      g.streak = [3, 0];
      g.players[0].onFire = true;
      g.players[1].onFire = true;
      g.updateScoreHud();

      g.poseCamPlayerIdx = 0;
      g.cutInTimer = 4.0;
      g.cutInLabel = '🔥 ON FIRE SLAM!';

      // P1 Kasumi in mid-air post-spike whip follow-through (`pose_spike_follow`) with afterimage ghost trail from `pose_spike`!
      g.players[0].x = 560;
      g.players[0].y = 445;
      g.players[0].z = 52;
      g.players[0].vz = 90;
      g.players[0].actionState = 'spike_follow';
      g.players[0].actionTimer = 4.0;
      g.players[0].posePreviewTimer = 4.0;
      g.players[0]._prevPoseKey = 'pose_spike';
      g.players[0]._renderPoseKey = 'pose_spike_follow';
      g.players[0]._poseBlend = 0.85;
      g.players[0].ghostTrail = [
        { x: 516, y: 452, z: 18, poseKey: 'pose_jump_coil' },
        { x: 538, y: 448, z: 46, poseKey: 'pose_spike' }
      ];
      g.players[0].rig.applyActionImpulse('spike', 1.7);
      g.addCallout('🔥 KASUMI IS ON FIRE! BOOMSHAKALAKA! 🔥', 525, 278, '#ff5500');
      g.addCallout('🧯 FIRE EXTINGUISHED! DIVING SAVE!', 805, 342, '#2ce6ff');

      const hsSpike = g.renderer.getHandSocketWorld(g.players[0], 'pose_spike_follow');
      g.ball.x = hsSpike.x + 28;
      g.ball.y = hsSpike.y + 8;
      g.ball.z = hsSpike.z - 10;
      g.ball.vx = 520;
      g.ball.vy = 45;
      g.ball.vz = -180;
      g.ball.solarSpike = true;
      g.ball.onFireBall = true;
      g.ball.trail = [
        { x: hsSpike.x - 18, y: hsSpike.y - 6, z: hsSpike.z + 24 },
        { x: hsSpike.x - 4, y: hsSpike.y, z: hsSpike.z + 12 },
        { x: hsSpike.x + 12, y: hsSpike.y + 4, z: hsSpike.z }
      ];
      g.renderer.addImpactRing(hsSpike.screenX, hsSpike.screenY, '#ff5500', 52);
      g.renderer.impactRings[g.renderer.impactRings.length - 1].age = 0.32;

      // Partner Elena in overhead Set pose (`pose_set`), Nyx in horizontal Sand Dive (`pose_dive`), Freya in Jump Coil (`pose_jump_coil`)
      g.players[1].x = 420;
      g.players[1].y = 535;
      g.players[1].actionState = 'set';
      g.players[1].actionTimer = 4.0;

      g.players[2].x = 760;
      g.players[2].y = 465;
      g.players[2].actionState = 'dive';
      g.players[2].actionTimer = 4.0;
      g.players[2].diveLockTimer = 4.0;
      const hsDive = g.renderer.getHandSocketWorld(g.players[2], 'pose_dive');
      g.renderer.addImpactRing(hsDive.screenX, hsDive.screenY, '#2ce6ff', 54);
      g.renderer.impactRings[g.renderer.impactRings.length - 1].age = 0.25;

      g.players[3].x = 910;
      g.players[3].y = 545;
      g.players[3].actionState = 'jump_coil';
      g.players[3].actionTimer = 4.0;
    }
  });
})();
