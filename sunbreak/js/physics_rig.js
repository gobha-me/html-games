// Coupled 2.5D Spring-Damper Soft-Body & Verlet Hair/Ribbon Rig for SUNBREAK // V'BALL
(function () {
  const PRESETS = {
    realistic: {
      omegaBust: 23.5,
      zetaBust: 0.29,
      omegaHip: 25.0,
      zetaHip: 0.32,
      gainZ: 0.032,
      gainXY: 0.022,
      twistGain: 1.9,
      coupleK: 14.0,
      maxDisp: 4.5,
      gravitySag: 0.9
    },
    doax: {
      omegaBust: 17.2,
      zetaBust: 0.125,
      omegaHip: 19.0,
      zetaHip: 0.15,
      gainZ: 0.058,
      gainXY: 0.042,
      twistGain: 3.6,
      coupleK: 22.0,
      maxDisp: 8.2,
      gravitySag: 1.45
    },
    overdrive: {
      omegaBust: 14.0,
      zetaBust: 0.072,
      omegaHip: 15.5,
      zetaHip: 0.088,
      gainZ: 0.085,
      gainXY: 0.064,
      twistGain: 5.2,
      coupleK: 30.0,
      maxDisp: 11.5,
      gravitySag: 2.0
    }
  };

  class SpringNode2D {
    constructor() {
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
    }

    impulse(ix, iy) {
      this.vx += ix;
      this.vy += iy;
    }

    step(dt, omega, zeta, targetX, targetY, maxDisp) {
      const k = omega * omega;
      const c = 2.0 * zeta * omega;
      const ax = -k * (this.x - targetX) - c * this.vx;
      const ay = -k * (this.y - targetY) - c * this.vy;
      this.vx += ax * dt;
      this.vy += ay * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;

      const mag = Math.hypot(this.x, this.y);
      if (mag > maxDisp) {
        const s = maxDisp / mag;
        this.x *= s;
        this.y *= s;
        this.vx *= 0.75;
        this.vy *= 0.75;
      }
    }
  }

  class SoftBodyRig {
    constructor(athleteProfile) {
      this.profile = athleteProfile;
      this.bustL = new SpringNode2D();
      this.bustR = new SpringNode2D();
      this.hipL = new SpringNode2D();
      this.hipR = new SpringNode2D();

      // 5-link Verlet ponytail chain in local character space
      this.hairNodes = [];
      for (let i = 0; i < 5; i++) {
        this.hairNodes.push({
          x: -i * 4.5,
          y: i * 3.2,
          px: -i * 4.5,
          py: i * 3.2
        });
      }

      this.prevVx = 0;
      this.prevVy = 0;
      this.prevVz = 0;
      this.phase = Math.random() * Math.PI * 2;
      this.stridePhase = 0;
      this.torsoTwist = 0;
      this.torsoTwistVel = 0;
      this.armSwingPhase = 0;

      // Modern shader surface properties: dynamic sweat/ocean sheen & clinging sand
      this.wetness = 0.32;
      this.sandCoat = 0.08;
    }

    applyActionImpulse(type, intensity = 1.0) {
      const scaleB = this.profile.bustScale || 1.1;
      const scaleH = this.profile.hipScale || 1.1;
      if (type === 'jump') {
        // Sudden upward launch compresses downward initially then springs up
        this.bustL.impulse(-12 * intensity, 95 * intensity * scaleB);
        this.bustR.impulse(12 * intensity, 102 * intensity * scaleB);
        this.hipL.impulse(-8 * intensity, 78 * intensity * scaleH);
        this.hipR.impulse(8 * intensity, 78 * intensity * scaleH);
      } else if (type === 'land') {
        // Heavy downward landing G-load + outward bounce
        this.bustL.impulse(-28 * intensity * scaleB, 145 * intensity * scaleB);
        this.bustR.impulse(28 * intensity * scaleB, 138 * intensity * scaleB);
        this.hipL.impulse(-22 * intensity * scaleH, 125 * intensity * scaleH);
        this.hipR.impulse(22 * intensity * scaleH, 125 * intensity * scaleH);
      } else if (type === 'spike') {
        // Whipping torso rotation + downward snap
        this.torsoTwistVel += 18.0 * intensity;
        this.bustL.impulse(65 * intensity * scaleB, -95 * intensity * scaleB);
        this.bustR.impulse(-72 * intensity * scaleB, 85 * intensity * scaleB);
        this.hipL.impulse(32 * intensity * scaleH, -40 * intensity * scaleH);
        this.hipR.impulse(-32 * intensity * scaleH, 45 * intensity * scaleH);
        this.wetness = Math.min(1.0, this.wetness + 0.04 * intensity);
      } else if (type === 'dig' || type === 'set') {
        // Upward shoulder shrug & chest pop
        this.bustL.impulse(-16 * intensity, -82 * intensity * scaleB);
        this.bustR.impulse(16 * intensity, -76 * intensity * scaleB);
        this.hipL.impulse(-12 * intensity, -50 * intensity * scaleH);
        this.hipR.impulse(12 * intensity, -50 * intensity * scaleH);
      } else if (type === 'dive') {
        // Horizontal sand slide impact + sand accumulation
        this.bustL.impulse(85 * intensity * scaleB, 110 * intensity * scaleB);
        this.bustR.impulse(-60 * intensity * scaleB, 125 * intensity * scaleB);
        this.hipL.impulse(70 * intensity * scaleH, 95 * intensity * scaleH);
        this.hipR.impulse(-70 * intensity * scaleH, 95 * intensity * scaleH);
        this.sandCoat = Math.min(1.0, this.sandCoat + 0.42);
        this.wetness = Math.min(1.0, this.wetness + 0.12);
      } else if (type === 'celebrate') {
        this.bustL.impulse(-38 * intensity * scaleB, -115 * intensity * scaleB);
        this.bustR.impulse(42 * intensity * scaleB, -95 * intensity * scaleB);
        this.hipL.impulse(-35 * intensity * scaleH, -85 * intensity * scaleH);
        this.hipR.impulse(35 * intensity * scaleH, 85 * intensity * scaleH);
      }
    }

    update(dt, state, presetName = 'doax', windX = 18.0) {
      const clampedDt = Math.min(dt, 0.033);
      const p = PRESETS[presetName] || PRESETS.doax;
      const scaleB = this.profile.bustScale || 1.1;
      const scaleH = this.profile.hipScale || 1.1;

      this.phase += clampedDt * 3.4;
      const speedXY = Math.hypot(state.vx || 0, state.vy || 0);
      if (state.z <= 1.0 && speedXY > 12) {
        const prevStride = Math.floor(this.stridePhase / Math.PI);
        this.stridePhase += clampedDt * (6.5 + speedXY * 0.045);
        const curStride = Math.floor(this.stridePhase / Math.PI);
        if (curStride !== prevStride) {
          // Alternating footstep impact drives hip sway & counter-phase bust bounce
          const side = (curStride % 2 === 0) ? 1 : -1;
          this.bustL.impulse(side * 16 * scaleB, 42 * scaleB);
          this.bustR.impulse(-side * 16 * scaleB, 36 * scaleB);
          this.hipL.impulse(side * 26 * scaleH, 48 * scaleH);
          this.hipR.impulse(side * 26 * scaleH, -38 * scaleH);
        }
      }

      // Compute world acceleration impulses (dV / dt)
      const ax = ((state.vx || 0) - this.prevVx) / Math.max(clampedDt, 0.008);
      const ay = ((state.vy || 0) - this.prevVy) / Math.max(clampedDt, 0.008);
      const az = ((state.vz || 0) - this.prevVz) / Math.max(clampedDt, 0.008);
      this.prevVx = state.vx || 0;
      this.prevVy = state.vy || 0;
      this.prevVz = state.vz || 0;

      // Apply clamped inertial reaction forces to soft-body nodes
      const reactX = Math.max(-180, Math.min(180, -ax * p.gainXY)) * scaleB;
      const reactY = Math.max(-220, Math.min(220, (az * p.gainZ - ay * p.gainXY * 0.35))) * scaleB;

      this.bustL.impulse(reactX * 0.95, reactY * 1.04);
      this.bustR.impulse(reactX * 1.05, reactY * 0.96);
      this.hipL.impulse(reactX * 0.7 * scaleH, reactY * 0.75 * scaleH);
      this.hipR.impulse(reactX * 0.7 * scaleH, reactY * 0.75 * scaleH);

      // Torso twist spring relaxation & cross-coupling between bustL and bustR
      const twistK = 36.0;
      const twistC = 7.5;
      const twistAcc = -twistK * this.torsoTwist - twistC * this.torsoTwistVel;
      this.torsoTwistVel += twistAcc * clampedDt;
      this.torsoTwist += this.torsoTwistVel * clampedDt;

      // Cross-coupling & anti-symmetric twist torque
      const dxBust = this.bustR.x - this.bustL.x;
      const dyBust = this.bustR.y - this.bustL.y;
      const coupleFx = dxBust * p.coupleK * clampedDt;
      const coupleFy = dyBust * p.coupleK * 0.65 * clampedDt;
      const twistTorque = this.torsoTwistVel * p.twistGain * clampedDt;

      this.bustL.vx += coupleFx + twistTorque;
      this.bustR.vx -= coupleFx - twistTorque;
      this.bustL.vy += coupleFy - twistTorque * 0.7;
      this.bustR.vy -= coupleFy + twistTorque * 0.7;

      // Breathing + gravity sag equilibrium target
      const breathY = Math.sin(this.phase) * 0.55 * scaleB + p.gravitySag * scaleB;
      const breathX = Math.cos(this.phase * 0.5) * 0.35 * scaleB;

      this.bustL.step(clampedDt, p.omegaBust, p.zetaBust, -breathX, breathY, p.maxDisp * scaleB);
      this.bustR.step(clampedDt, p.omegaBust * 0.97, p.zetaBust, breathX, breathY, p.maxDisp * scaleB);

      const hipSwayX = Math.sin(this.stridePhase) * 0.8 * scaleH;
      this.hipL.step(clampedDt, p.omegaHip, p.zetaHip, hipSwayX, p.gravitySag * 0.65 * scaleH, p.maxDisp * 0.85 * scaleH);
      this.hipR.step(clampedDt, p.omegaHip, p.zetaHip, hipSwayX, -p.gravitySag * 0.35 * scaleH, p.maxDisp * 0.85 * scaleH);

      // Step 5-link Verlet hair ponytail chain
      const facing = state.facing || 1;
      this.hairNodes[0].x = -facing * 4.0;
      this.hairNodes[0].y = -22.0;
      const segLen = 4.6;
      for (let i = 1; i < this.hairNodes.length; i++) {
        const n = this.hairNodes[i];
        const vx = (n.x - n.px) * 0.88;
        const vy = (n.y - n.py) * 0.88;
        n.px = n.x;
        n.py = n.y;
        n.x += vx + (-state.vx * 0.015 + windX * 0.12 - facing * 8.0) * clampedDt;
        n.y += vy + (38.0 + state.vz * 0.025) * clampedDt;

        // Distance constraint to parent link
        const prev = this.hairNodes[i - 1];
        const dx = n.x - prev.x;
        const dy = n.y - prev.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        n.x = prev.x + (dx / dist) * segLen;
        n.y = prev.y + (dy / dist) * segLen;
      }

      // Gradual sand brushing off during movement & sweat build-up
      if (speedXY > 25 || Math.abs(state.vz || 0) > 20) {
        this.sandCoat = Math.max(0.04, this.sandCoat - clampedDt * 0.06);
        this.wetness = Math.min(0.95, this.wetness + clampedDt * 0.012);
      }
    }
  }

  window.SunbreakSoftBodyRig = SoftBodyRig;
})();
