// audio.js — Procedural Cyberpunk WebAudio Synth & Tactical Foley Engine
(function (global) {
  'use strict';

  class BreachAudio {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.overclockFactor = 1.0;
      this.bassTimer = null;
      this.stepIndex = 0;
    }

    ensureContext() {
      if (this.muted) return null;
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    setMuted(flag) {
      this.muted = !!flag;
      return this.muted;
    }

    setOverclock(active) {
      this.overclockFactor = active ? 0.55 : 1.0;
    }

    playGunshot(weaponId) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const scale = this.overclockFactor;

      // White noise burst + sub-bass punch
      const dur = weaponId === 3 ? 0.28 : weaponId === 2 ? 0.11 : 0.08;
      const bufferSize = Math.max(256, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = weaponId === 1 ? 'bandpass' : 'lowpass';
      filter.frequency.setValueAtTime((weaponId === 1 ? 2600 : weaponId === 3 ? 950 : 1650) * scale, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(weaponId === 3 ? 0.34 : weaponId === 2 ? 0.22 : 0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);

      // Sub-kick thump
      const osc = ctx.createOscillator();
      const oGain = ctx.createGain();
      osc.type = weaponId === 3 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime((weaponId === 3 ? 135 : 220) * scale, now);
      osc.frequency.exponentialRampToValueAtTime(32 * scale, now + dur * 0.9);
      oGain.gain.setValueAtTime(weaponId === 3 ? 0.35 : 0.18, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.9);

      osc.connect(oGain);
      oGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur);
    }

    playDoorBreach() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160 * this.overclockFactor, now);
      osc.frequency.exponentialRampToValueAtTime(24, now + 0.26);
      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    }

    playGlassShatter() {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const freqs = [2450, 3180, 4120, 5280];
      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f * this.overclockFactor, now + idx * 0.018);
        gain.gain.setValueAtTime(0.08, now + idx * 0.018);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.018 + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.018);
        osc.stop(now + idx * 0.018 + 0.13);
      });
    }

    playKillConfirm(combo) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const base = 360 + Math.min(combo, 10) * 45;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(base, now);
      osc.frequency.setValueAtTime(base * 1.25, now + 0.055);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.17);
    }

    playOverclockToggle(entering) {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(entering ? 520 : 180, now);
      osc.frequency.exponentialRampToValueAtTime(entering ? 110 : 480, now + 0.24);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
    }
  }

  global.BreachAudio = BreachAudio;
})(window);
