// SUNBREAK // V'BALL — 2v2 Arcade Volleyball & 1-4P Partner Auto-Handoff Engine
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
    gravity: 490
  };

  class SunbreakGame {
    constructor() {
      this.glCanvas = document.getElementById('gl-canvas');
      this.hudCanvas = document.getElementById('hud-canvas');
      this.renderer = new Renderer(this.glCanvas, this.hudCanvas);

      this.physicsPreset = 'doax';
      this.lightingTheme = 'sunset';
      this.mode = 'solo'; // solo | coop | versus2p | party4p

      this.score = [0, 0];
      this.solar = [35, 25];
      this.servingTeam = 0;
      this.serverSlot = 0;
      this.rallyState = 'serve'; // serve | play | point_scored
      this.pointTimer = 0;

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
        solarSpike: false,
        tandemSync: false,
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
          actionState: 'idle', // idle | dig | set | spike | dive | block
          actionTimer: 0,
          diveLockTimer: 0,
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
        { val: 'kb1', label: 'P1 (WASD + J/K/L)' },
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
            fp.posePreviewTimer = 0;
            fp.vz = 240;
            fp.rig.applyActionImpulse('jump', 1.35);
            AudioSys.playHit(0.7, 1.1);
          } else if (e.code === 'KeyK') {
            const fp = this.players[this.poseCamPlayerIdx];
            fp.actionState = 'spike';
            fp.actionTimer = 0.55;
            fp.posePreviewTimer = 0.65;
            fp.rig.applyActionImpulse('spike', 1.35);
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

      // Dismiss modal on Enter
      window.addEventListener('keydown', (e) => {
        const modal = document.getElementById('lobby-modal');
        if (!modal.classList.contains('hidden') && e.code === 'Enter') {
          this.toggleLobbyModal(false);
          AudioSys.playWhistle(false);
        }
      });
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
      this.callouts.push({ text, x, y, color, timer: 1.15 });
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
      document.getElementById('solar-left-pct').textContent = `SOLAR ${Math.round(this.solar[0])}%`;
      document.getElementById('solar-right-pct').textContent = `SOLAR ${Math.round(this.solar[1])}%`;
      document.getElementById('solar-left-fill').style.width = `${Math.min(100, this.solar[0])}%`;
      document.getElementById('solar-right-fill').style.width = `${Math.min(100, this.solar[1])}%`;
    }

    resetServe(servingTeam) {
      this.servingTeam = servingTeam;
      this.touchTeam = servingTeam;
      this.touchCount = 0;
      this.lastTouchPlayer = -1;
      this.rallyState = 'serve';
      this.ball.solarSpike = false;
      this.ball.tandemSync = false;
      this.ball.trail = [];
      this.requestedSetType = [null, null];

      // Position players cleanly for serve
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
        p.facing = p.team === 0 ? 1 : -1;
      });

      // Ensure human controls the server if that team has a single human + AI partner
      this.enforceAutoHandoffOnTeam(servingTeam, this.serverSlot);

      const srv = this.players[this.serverSlot];
      this.ball.x = srv.x + srv.facing * 18;
      this.ball.y = srv.y - 4;
      this.ball.z = 42;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.vz = 0;
      this.ballLanding = null;
      this.aiServeTimer = 0.85;

      this.updateTouchHud();
      document.getElementById('match-meta').textContent =
        servingTeam === 0 ? 'SUNSET SERVE • PRESS J OR K' : 'RIPTIDE SERVE';
    }

    /**
     * Role-Locked Auto-Handoff for 1-Human + 1-AI teams:
     * Transfers the human's controller assignment to `targetSlot` on their team
     * so solo players never have to panic-mash a switch button.
     */
    enforceAutoHandoffOnTeam(team, targetSlot) {
      const s0 = team === 0 ? 0 : 2;
      const s1 = team === 0 ? 1 : 3;
      const p0 = this.players[s0];
      const p1 = this.players[s1];

      // Only auto-swap if one slot is Human and the other is AI
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

    predictBallLanding() {
      const b = this.ball;
      if (Math.abs(b.vx) < 1 && Math.abs(b.vy) < 1 && b.vz === 0) {
        this.ballLanding = null;
        return;
      }
      // Solve z(t) = z0 + vz*t - 0.5*g*t^2 = 8
      const g = COURT.gravity;
      const disc = b.vz * b.vz + 2 * g * Math.max(0, b.z - 8);
      const tFlight = (b.vz + Math.sqrt(disc)) / g;
      const lx = Math.max(COURT.leftX - 35, Math.min(COURT.rightX + 35, b.x + b.vx * tFlight));
      const ly = Math.max(COURT.topY - 25, Math.min(COURT.botY + 25, b.y + b.vy * tFlight));
      this.ballLanding = { x: lx, y: ly, t: tFlight };
    }

    readControllerInput(ctrlType) {
      const out = { mx: 0, my: 0, btnA: false, btnB: false, btnSwitch: false };
      if (ctrlType === 'kb1') {
        if (this.keys['KeyA']) out.mx -= 1;
        if (this.keys['KeyD']) out.mx += 1;
        if (this.keys['KeyW']) out.my -= 1;
        if (this.keys['KeyS']) out.my += 1;
        out.btnA = this.justPressed('KeyJ') || this.justPressed('Space');
        out.btnB = this.justPressed('KeyK');
        out.btnSwitch = this.justPressed('KeyL') || this.justPressed('ShiftLeft');
      } else if (ctrlType === 'kb2') {
        if (this.keys['ArrowLeft']) out.mx -= 1;
        if (this.keys['ArrowRight']) out.mx += 1;
        if (this.keys['ArrowUp']) out.my -= 1;
        if (this.keys['ArrowDown']) out.my += 1;
        out.btnA = this.justPressed('KeyM') || this.justPressed('Numpad1');
        out.btnB = this.justPressed('Comma') || this.justPressed('Numpad2');
        out.btnSwitch = this.justPressed('Period') || this.justPressed('Numpad3');
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

          out.btnA = b0 && !this.prevGpButtons[gpIdx][0];
          out.btnB = (b1 && !this.prevGpButtons[gpIdx][1]) || (b2 && !this.prevGpButtons[gpIdx][2]);
          out.btnSwitch = b4 && !this.prevGpButtons[gpIdx][4];

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
      const out = { mx: 0, my: 0, btnA: false, btnB: false, btnSwitch: false };
      const team = p.team;
      const isLeft = team === 0;
      const partnerSlot = p.slot % 2 === 0 ? p.slot + 1 : p.slot - 1;
      const partner = this.players[partnerSlot];

      if (this.rallyState === 'serve') {
        if (this.serverSlot === p.slot) {
          this.aiServeTimer -= dt;
          if (this.aiServeTimer <= 0) {
            out.btnB = Math.random() < 0.55;
            out.btnA = !out.btnB;
          }
        }
        return out;
      }

      if (this.rallyState !== 'play') return out;

      // Determine whether ball is on our side or heading to our side
      const ballOnOurSide =
        this.ballLanding &&
        ((isLeft && this.ballLanding.x <= COURT.netX + 10) ||
          (!isLeft && this.ballLanding.x >= COURT.netX - 10));

      let targetX = isLeft ? 410 : 870;
      let targetY = p.slot % 2 === 0 ? 395 : 545;

      if (ballOnOurSide && this.ballLanding) {
        const myDist = Math.hypot(p.x - this.ballLanding.x, p.y - this.ballLanding.y);
        const partnerDist = Math.hypot(partner.x - this.ballLanding.x, partner.y - this.ballLanding.y);

        // Who takes the next touch?
        const iMustTakeBall =
          this.lastTouchPlayer === partner.slot ||
          (this.lastTouchPlayer !== p.slot &&
            (partner.controllerType !== 'ai'
              ? this.touchCount === 1 // AI partner ALWAYS takes Touch 2 (the Set) so Human can spike!
              : myDist <= partnerDist));

        if (iMustTakeBall) {
          targetX = this.ballLanding.x - p.facing * 8;
          targetY = this.ballLanding.y;

          const distToBall = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
          // Dive if ball is low and slightly out of reach
          if (
            this.touchCount === 0 &&
            this.ball.z < 46 &&
            this.ball.vz < 0 &&
            distToBall > 34 &&
            distToBall < 92
          ) {
            out.btnB = true;
          } else if (distToBall < 48 && this.ball.z > 28 && this.ball.z < 128 && this.touchCount === 2) {
            // Jump to spike on 3rd touch
            out.btnB = true;
          }
        } else {
          // Move to ideal Setter / Attack support position near the net
          targetX = isLeft ? 545 : 735;
          targetY = partner.y < 475 ? 535 : 410;
        }
      } else {
        // Ball is on opponent's side: Front player shadows the net to Block, Back player covers deep court
        const isFrontBlocker = p.slot % 2 === 0;
        if (isFrontBlocker) {
          targetX = isLeft ? COURT.netX - 42 : COURT.netX + 42;
          targetY = Math.max(COURT.topY + 35, Math.min(COURT.botY - 35, this.ball.y));
          // Jump block when opposing attacker jumps near net
          const oppJumpingAtNet = this.players.some(
            (op) =>
              op.team !== team &&
              op.z > 24 &&
              Math.abs(op.x - COURT.netX) < 120 &&
              Math.hypot(this.ball.x - op.x, this.ball.y - op.y) < 65
          );
          if (oppJumpingAtNet && p.z === 0 && Math.random() < 0.18) {
            out.btnA = true;
          }
        } else {
          targetX = isLeft ? 360 : 920;
          targetY = 480 + (this.ball.y - 480) * 0.45;
        }
      }

      const dx = targetX - p.x;
      const dy = targetY - p.y;
      if (Math.abs(dx) > 8) out.mx = Math.max(-1, Math.min(1, dx / 36));
      if (Math.abs(dy) > 8) out.my = Math.max(-1, Math.min(1, dy / 36));
      return out;
    }

    executeServeHit(p, isPowerJumpServe, aimInput) {
      this.rallyState = 'play';
      this.touchTeam = p.team;
      this.touchCount = 1; // crossing net resets on crossing
      this.lastTouchPlayer = p.slot;

      const dir = p.team === 0 ? 1 : -1;
      const speedX = isPowerJumpServe ? 430 + p.profile.power * 90 : 345 + p.profile.control * 55;
      this.ball.vx = dir * speedX;
      this.ball.vy = (aimInput.my || (Math.random() - 0.5) * 0.8) * 145;
      this.ball.vz = isPowerJumpServe ? 225 : 285;
      this.ball.z = Math.max(46, p.z + 44);
      this.ball.solarSpike = false;

      if (isPowerJumpServe) {
        p.vz = 195;
        p.actionState = 'spike';
        p.actionTimer = 0.32;
        p.rig.applyActionImpulse('spike', 1.15);
        this.addCallout('JUMP SERVE!', p.x, p.y - 80, '#ffb84d');
      } else {
        p.actionState = 'set';
        p.actionTimer = 0.25;
        p.rig.applyActionImpulse('set', 0.9);
      }

      AudioSys.playHit(isPowerJumpServe ? 0.85 : 0.55, 1.0);
      this.predictBallLanding();

      // Auto-assign the receiving team's closest defender to human control
      const recvTeam = 1 - p.team;
      this.assignClosestDefender(recvTeam);
    }

    assignClosestDefender(team) {
      if (!this.ballLanding) return;
      const s0 = team === 0 ? 0 : 2;
      const s1 = team === 0 ? 1 : 3;
      const d0 = Math.hypot(this.players[s0].x - this.ballLanding.x, this.players[s0].y - this.ballLanding.y);
      const d1 = Math.hypot(this.players[s1].x - this.ballLanding.x, this.players[s1].y - this.ballLanding.y);
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

      // Check for Net Block (jumping at the net as ball crosses)
      const nearNet = Math.abs(p.x - COURT.netX) < 62;
      if (this.touchCount === 0 && p.z > 18 && nearNet && this.ball.z > COURT.netHeight - 8) {
        this.touchCount = 0;
        this.touchTeam = team;
        this.lastTouchPlayer = p.slot;
        this.ball.vx = dir * (280 + p.profile.power * 90);
        this.ball.vy = (Math.random() - 0.5) * 150;
        this.ball.vz = -95;
        this.ball.solarSpike = false;
        p.rig.applyActionImpulse('spike', 1.25);
        this.solar[team] = Math.min(100, this.solar[team] + 18);
        this.addCallout('ROOF BLOCK!', p.x, p.y - 95, '#2ce6ff');
        AudioSys.playHit(0.95, 0.82);
        this.predictBallLanding();
        this.assignClosestDefender(1 - team);
        this.updateTouchHud();
        this.updateScoreHud();
        return;
      }

      this.touchCount += 1;
      this.lastTouchPlayer = p.slot;

      if (this.touchCount === 1) {
        // TOUCH 1: DIG / RECEPTION PASS TO SETTER SPOT
        const setterTargetX = isLeft ? COURT.netX - 78 : COURT.netX + 78;
        const setterTargetY = Math.max(COURT.topY + 55, Math.min(COURT.botY - 55, partner.y * 0.65 + 475 * 0.35));

        const tFlight = 1.08;
        this.ball.vz = 0.5 * COURT.gravity * tFlight + (36 - this.ball.z) / tFlight;
        this.ball.vx = (setterTargetX - this.ball.x) / tFlight;
        this.ball.vy = (setterTargetY - this.ball.y) / tFlight;

        const wasSolar = this.ball.solarSpike;
        this.ball.solarSpike = false;

        p.actionState = p.diveLockTimer > 0 ? 'dive' : 'dig';
        p.actionTimer = 0.28;
        p.rig.applyActionImpulse('dig', wasSolar ? 1.45 : 1.0);

        this.solar[team] = Math.min(100, this.solar[team] + (wasSolar ? 22 : 10));
        this.addCallout(wasSolar ? 'MIRACLE DIG!' : 'NICE DIG!', p.x, p.y - 72, '#2ce6ff');
        AudioSys.playHit(0.65, 1.05);

        // Critical UX: In 1P mode, the digger stays controlled by the Human so they can run their spike approach,
        // while the AI partner automatically moves under the ball to Set!
        this.enforceAutoHandoffOnTeam(team, p.slot);
      } else if (this.touchCount === 2) {
        // TOUCH 2: SET TO PARTNER (OR SNEAKY 2ND-TOUCH SETTER DUMP!)
        const wantsSetterDump =
          p.controllerType !== 'ai' && (input.btnSwitch || (isLeft ? input.mx > 0.7 : input.mx < -0.7) && p.z > 14);

        if (wantsSetterDump) {
          // Surprise 2nd-touch Setter Dump over the net!
          const targetX = isLeft ? COURT.netX + 135 : COURT.netX - 135;
          const targetY = p.y < 475 ? COURT.botY - 70 : COURT.topY + 70;
          const tFlight = 0.72;
          this.ball.vz = 0.5 * COURT.gravity * tFlight + (12 - this.ball.z) / tFlight;
          this.ball.vx = (targetX - this.ball.x) / tFlight;
          this.ball.vy = (targetY - this.ball.y) / tFlight;
          p.actionState = 'set';
          p.actionTimer = 0.28;
          p.rig.applyActionImpulse('spike', 1.0);
          this.addCallout('SETTER DUMP!', p.x, p.y - 78, '#ffb84d');
          AudioSys.playHit(0.7, 1.2);
          this.predictBallLanding();
          this.assignClosestDefender(1 - team);
        } else {
          // Toss High or Quick Set toward attacker's approach line
          const setType = this.requestedSetType[team] || (input.btnB ? 'quick' : 'high');
          this.requestedSetType[team] = null;

          const tFlight = setType === 'quick' ? 0.78 : 1.18;
          const attackX = isLeft
            ? Math.max(COURT.leftX + 95, Math.min(COURT.netX - 48, partner.x + 75))
            : Math.max(COURT.netX + 48, Math.min(COURT.rightX - 95, partner.x - 75));
          const attackY = Math.max(
            COURT.topY + 40,
            Math.min(COURT.botY - 40, partner.y + (input.my || 0) * 65)
          );

          const peakHeight = setType === 'quick' ? 68 : 96;
          this.ball.vz = 0.5 * COURT.gravity * tFlight + (peakHeight - this.ball.z) / tFlight;
          this.ball.vx = (attackX - this.ball.x) / tFlight;
          this.ball.vy = (attackY - this.ball.y) / tFlight;

          // Check Co-Op Human-to-Human Tandem Sync
          this.ball.tandemSync = p.controllerType !== 'ai' && partner.controllerType !== 'ai';

          p.actionState = 'set';
          p.actionTimer = 0.28;
          p.rig.applyActionImpulse('set', 1.05);
          this.solar[team] = Math.min(100, this.solar[team] + 12);
          this.addCallout(
            setType === 'quick' ? 'QUICK SET!' : 'HIGH SET!',
            p.x,
            p.y - 75,
            '#ffb84d'
          );
          AudioSys.playHit(0.55, 1.18);

          // Ensure attacker has human control for Touch 3
          this.enforceAutoHandoffOnTeam(team, partner.slot);
        }
      } else {
        // TOUCH 3: SPIKE / CUT SHOT / SOLAR OVERDRIVE SUPER-SPIKE!
        const airborne = p.z > 16;
        const canSolar = airborne && this.solar[team] >= 100;

        let targetX, targetY, tFlight;
        if (canSolar) {
          this.solar[team] = 0;
          this.ball.solarSpike = true;
          tFlight = 0.42;
          targetX = isLeft ? COURT.netX + 240 : COURT.netX - 240;
          targetY =
            Math.abs(input.my) > 0.25
              ? input.my < 0
                ? COURT.topY + 45
                : COURT.botY - 45
              : p.y < 475
              ? COURT.botY - 55
              : COURT.topY + 55;

          this.cutInTimer = 1.65;
          this.cutInLabel = p.profile.signatureMove;
          this.poseCamPlayerIdx = p.slot;
          p.posePreviewTimer = 1.65;
          this.addCallout(`★ ${p.profile.signatureMove}! ★`, p.x, p.y - 105, p.profile.signatureColor);
          AudioSys.playSolarSpike();
        } else if (airborne) {
          const isCutShot = input.btnA && !input.btnB;
          tFlight = isCutShot ? 0.76 : this.ball.tandemSync ? 0.48 : 0.55;
          const depth = isCutShot ? 130 : 265 + p.profile.power * 65;
          targetX = isLeft ? COURT.netX + depth : COURT.netX - depth;
          targetY =
            Math.abs(input.my) > 0.2
              ? Math.max(COURT.topY + 35, Math.min(COURT.botY - 35, p.y + input.my * 165))
              : p.y < 475
              ? COURT.botY - 65
              : COURT.topY + 65;

          const label = this.ball.tandemSync
            ? 'TANDEM FLASH SPIKE!'
            : isCutShot
            ? 'CUT DROP!'
            : 'POWER SPIKE!';
          this.addCallout(label, p.x, p.y - 92, '#ff477e');
          this.solar[team] = Math.min(100, this.solar[team] + (this.ball.tandemSync ? 28 : 16));
          AudioSys.playHit(0.92, isCutShot ? 1.12 : 0.88);
        } else {
          // Grounded safety free-ball lob over net
          tFlight = 1.05;
          targetX = isLeft ? COURT.netX + 210 : COURT.netX - 210;
          targetY = 475 + (input.my || 0) * 110;
          this.addCallout('FREE BALL', p.x, p.y - 70, '#9ab0c9');
          AudioSys.playHit(0.55, 1.0);
        }

        this.ball.vz = 0.5 * COURT.gravity * tFlight + (10 - this.ball.z) / tFlight;
        this.ball.vx = (targetX - this.ball.x) / tFlight;
        this.ball.vy = (targetY - this.ball.y) / tFlight;

        p.actionState = 'spike';
        p.actionTimer = 0.34;
        p.rig.applyActionImpulse('spike', canSolar ? 1.65 : 1.28);

        this.predictBallLanding();
        this.assignClosestDefender(1 - team);
      }

      this.predictBallLanding();
      this.updateTouchHud();
      this.updateScoreHud();
    }

    scorePoint(winnerTeam, reason) {
      this.rallyState = 'point_scored';
      this.pointTimer = 1.9;
      this.score[winnerTeam] += 1;

      // Check 15-point match win (win by 2)
      let matchWon = false;
      if (this.score[winnerTeam] >= 15 && this.score[winnerTeam] - this.score[1 - winnerTeam] >= 2) {
        matchWon = true;
      }

      const teamName = winnerTeam === 0 ? 'SUNSET' : 'RIPTIDE';
      const banner = matchWon
        ? `MATCH POINT! ${teamName} WINS ${this.score[0]} - ${this.score[1]}!`
        : `${reason} • ${teamName} POINT!`;
      this.addCallout(banner, 640, 235, winnerTeam === 0 ? '#ffb84d' : '#2ce6ff');
      document.getElementById('match-meta').textContent = banner;

      // Trigger celebratory soft-body bounce & pose cut-in on scoring team
      const celebSlot = winnerTeam === 0 ? 0 : 2;
      this.poseCamPlayerIdx = celebSlot;
      this.cutInTimer = 1.75;
      this.cutInLabel = 'POINT CELEBRATION!';

      this.players.forEach((p) => {
        if (p.team === winnerTeam) {
          p.vz = 175;
          p.rig.applyActionImpulse('celebrate', 1.35);
        }
      });

      AudioSys.playWhistle(matchWon);
      AudioSys.playPointFanfare();
      this.updateScoreHud();

      if (matchWon) {
        setTimeout(() => {
          this.score = [0, 0];
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

    update(dt) {
      this.renderer.updateTrails(dt);
      this.updateGamepadStatusBanner();

      if (this.cutInTimer > 0) {
        this.cutInTimer = Math.max(0, this.cutInTimer - dt);
      }

      for (let i = this.callouts.length - 1; i >= 0; i--) {
        this.callouts[i].y -= 24 * dt;
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

        // Manual partner switch or set callout
        if (p.controllerType !== 'ai') {
          if (input.btnSwitch && this.rallyState === 'play') {
            this.manualSwapTeamControl(p.team);
          }
          // Calling for Quick vs High set while AI partner prepares Touch 2
          if (this.rallyState === 'play' && this.touchTeam === p.team && this.touchCount === 1) {
            if (input.btnA) this.requestedSetType[p.team] = 'high';
            if (input.btnB) this.requestedSetType[p.team] = 'quick';
          }
        }

        if (this.rallyState === 'serve' && this.serverSlot === p.slot) {
          // Server can move up/down along baseline before serving
          p.vy = input.my * 165;
          p.y = Math.max(COURT.topY + 25, Math.min(COURT.botY - 25, p.y + p.vy * dt));
          this.ball.x = p.x + p.facing * 18;
          this.ball.y = p.y - 4;

          if (input.btnA || input.btnB) {
            this.executeServeHit(p, input.btnB, input);
          }
        } else if (this.rallyState === 'play') {
          if (p.diveLockTimer > 0) {
            p.diveLockTimer -= dt;
            p.vx *= 0.92;
            p.vy *= 0.92;
          } else {
            const maxSpd = 215 + p.profile.speed * 75;
            p.vx = input.mx * maxSpd;
            p.vy = input.my * maxSpd * 0.86;

            // Jump (Action A or B near the ball / net, or when preparing Touch 3 spike)
            if ((input.btnA || input.btnB) && p.z === 0) {
              const distToBall = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
              const wantDive =
                input.btnB &&
                this.touchTeam !== p.team &&
                this.ball.z < 52 &&
                distToBall > 35 &&
                distToBall < 115 &&
                (Math.abs(input.mx) > 0.1 || Math.abs(input.my) > 0.1);

              if (wantDive) {
                const dx = this.ball.x - p.x;
                const dy = this.ball.y - p.y;
                const d = Math.hypot(dx, dy) || 1;
                p.vx = (dx / d) * 370;
                p.vy = (dy / d) * 320;
                p.vz = 85;
                p.diveLockTimer = 0.42;
                p.actionState = 'dive';
                p.actionTimer = 0.42;
                p.rig.applyActionImpulse('dive', 1.35);
                this.renderer.addSandTrail(p.x, p.y, 26);
                AudioSys.playSandDive();
              } else {
                p.vz = 235 + p.profile.jump * 55;
                p.rig.applyActionImpulse('jump', 1.15);
                this.renderer.addSandTrail(p.x, p.y, 18);
              }
            }
          }

          p.x += p.vx * dt;
          p.y += p.vy * dt;

          // Keep players on their side of the net
          if (p.team === 0) {
            p.x = Math.max(COURT.leftX - 45, Math.min(COURT.netX - 18, p.x));
          } else {
            p.x = Math.max(COURT.netX + 18, Math.min(COURT.rightX + 45, p.x));
          }
          p.y = Math.max(COURT.topY - 30, Math.min(COURT.botY + 30, p.y));

          // Footprints in sand while running
          if (p.z === 0 && Math.hypot(p.vx, p.vy) > 45 && Math.random() < 0.22) {
            this.renderer.addSandTrail(p.x, p.y, 11);
          }

          // Check ball contact sphere
          const reachZ = p.z + 44;
          const distXY = Math.hypot(this.ball.x - p.x, this.ball.y - p.y);
          const distZ = Math.abs(this.ball.z - reachZ);
          const hitRadius = p.actionState === 'dive' ? 46 : 36;

          if (
            distXY < hitRadius &&
            distZ < 36 &&
            this.lastTouchPlayer !== p.slot
          ) {
            this.handleBallContact(p, input);
          }
        }

        // Vertical gravity & landing on sand
        if (p.z > 0 || p.vz !== 0) {
          p.vz -= COURT.gravity * dt;
          p.z += p.vz * dt;
          if (p.z <= 0) {
            p.z = 0;
            p.vz = 0;
            p.rig.applyActionImpulse('land', 1.2);
            this.renderer.addSandTrail(p.x, p.y, 20);
          }
        }

        if (p.actionTimer > 0) {
          p.actionTimer -= dt;
          if (p.actionTimer <= 0 && p.z === 0) {
            p.actionState = 'idle';
          }
        }
        if (p.posePreviewTimer > 0) {
          p.posePreviewTimer = Math.max(0, p.posePreviewTimer - dt);
        }

        p.rig.update(dt, p, this.physicsPreset);
      });

      // Step Volleyball Physics
      if (this.rallyState === 'play') {
        const b = this.ball;
        const prevX = b.x;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vz -= COURT.gravity * dt;
        b.z += b.vz * dt;
        b.spinAngle += (b.vx * 0.03 + 6.0) * dt;

        b.trail.push({ x: b.x, y: b.y, z: b.z });
        if (b.trail.length > 10) b.trail.shift();

        // Check Net Crossing & Net Cord Collision
        if ((prevX < COURT.netX && b.x >= COURT.netX) || (prevX > COURT.netX && b.x <= COURT.netX)) {
          if (b.z < COURT.netHeight) {
            if (b.z > COURT.netHeight - 12) {
              // Dramatic Net Cord Let-Roll!
              b.vx *= 0.45;
              b.vz = Math.max(65, Math.abs(b.vz) * 0.4);
              b.z = COURT.netHeight + 2;
              this.addCallout('NET CORD!', COURT.netX, b.y - 75, '#ffb84d');
              AudioSys.playHit(0.4, 0.7);
              this.predictBallLanding();
            } else {
              // Hit into the net
              b.vx *= -0.28;
              b.vz = -40;
              AudioSys.playHit(0.5, 0.6);
            }
          } else {
            // Clean net crossing resets touch count for receiving side
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
          this.renderer.addSandTrail(b.x, b.y, 24);
          AudioSys.playSandDive();

          // Check IN vs OUT of bounds on court trapezoid
          const inY = b.y >= COURT.topY - 8 && b.y <= COURT.botY + 8;
          const inX = b.x >= COURT.leftX - 8 && b.x <= COURT.rightX + 8;
          const landedSide = b.x < COURT.netX ? 0 : 1;

          if (inX && inY) {
            // Landed IN bounds on `landedSide` -> other team scores
            const winner = 1 - landedSide;
            this.servingTeam = winner;
            this.scorePoint(winner, 'IN BOUNDS');
          } else {
            // Landed OUT of bounds -> team that last touched loses the point
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

  window.addEventListener('DOMContentLoaded', () => {
    const g = new SunbreakGame();
    window.SUNBREAK_GAME = g;
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot === 'pose') {
      g.toggleLobbyModal(false);
      g.poseCamActive = true;
      g.rallyState = 'serve';
      const aParam = params.get('athlete');
      if (aParam !== null) {
        const aIdx = parseInt(aParam, 10);
        g.players[0].profile = ROSTER[aIdx % ROSTER.length];
        g.players[0].rig = new SoftBodyRig(g.players[0].profile);
      }
      g.poseCamPlayerIdx = 0;
      g.players[0].rig.applyActionImpulse('celebrate', 1.45);
      g.players[1].actionState = 'set';
      g.players[1].actionTimer = 4.0;
      g.players[2].actionState = 'dig';
      g.players[2].actionTimer = 4.0;
    } else if (shot === 'neon') {
      g.toggleLobbyModal(false);
      g.lightingTheme = 'neon';
      g.renderer.theme = 'neon';
      g.physicsPreset = 'overdrive';
      g.rallyState = 'serve';
      g.poseCamPlayerIdx = 0;
      g.cutInTimer = 4.0;
      g.cutInLabel = g.players[0].profile.signatureMove;
      g.players[0].x = 555;
      g.players[0].y = 445;
      g.players[0].z = 52;
      g.players[0].vz = 140;
      g.players[0].actionState = 'spike';
      g.players[0].actionTimer = 4.0;
      g.players[0].posePreviewTimer = 4.0;
      g.players[0].rig.applyActionImpulse('spike', 1.65);
      g.addCallout(`★ ${g.players[0].profile.signatureMove}! ★`, 555, 315, '#ff477e');
      g.ball.x = 590;
      g.ball.y = 445;
      g.ball.z = 86;
      g.ball.solarSpike = true;
      g.ball.trail = [
        { x: 545, y: 445, z: 98 },
        { x: 560, y: 445, z: 94 },
        { x: 575, y: 445, z: 90 }
      ];
      g.players[1].x = 425;
      g.players[1].y = 535;
      g.players[1].actionState = 'set';
      g.players[1].actionTimer = 4.0;
      g.players[2].x = 760;
      g.players[2].y = 465;
      g.players[2].actionState = 'dive';
      g.players[2].actionTimer = 4.0;
      g.players[2].diveLockTimer = 4.0;
      g.players[3].x = 910;
      g.players[3].y = 545;
      g.players[3].actionState = 'dig';
      g.players[3].actionTimer = 4.0;
    }
  });
})();
