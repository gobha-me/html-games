// ============================================================================
// DEAD DISTRICT // SECTOR 7 — Procedural WebAudio Gunfire & Horror Synthesizer
// ============================================================================

class DistrictAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  ensure() {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(freq, type, duration, gainVal = 0.12, endFreq = null) {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  noise(duration, gainVal = 0.14, cutoff = 1400) {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  shoot(weaponId) {
    if (weaponId === 'pistol') {
      this.noise(0.09, 0.18, 2200);
      this.tone(240, 'triangle', 0.08, 0.15, 70);
    } else if (weaponId === 'shotgun') {
      this.noise(0.19, 0.28, 1200);
      this.tone(130, 'sawtooth', 0.16, 0.22, 38);
    } else if (weaponId === 'smg') {
      this.noise(0.065, 0.15, 2800);
      this.tone(310, 'square', 0.055, 0.11, 95);
    } else if (weaponId === 'rifle') {
      this.noise(0.14, 0.24, 1800);
      this.tone(175, 'sawtooth', 0.13, 0.2, 45);
    } else if (weaponId === 'incinerator') {
      this.noise(0.26, 0.22, 900);
      this.tone(110, 'sine', 0.22, 0.2, 52);
    }
  }

  reload() {
    this.tone(520, 'triangle', 0.05, 0.09, 780);
    setTimeout(() => this.tone(680, 'triangle', 0.06, 0.1, 420), 140);
  }

  explosion() {
    this.noise(0.45, 0.32, 650);
    this.tone(95, 'sawtooth', 0.38, 0.24, 28);
  }

  hit() {
    this.noise(0.045, 0.08, 950);
  }

  kill() {
    this.tone(160, 'sine', 0.11, 0.1, 55);
  }

  scream() {
    this.tone(540, 'sawtooth', 0.45, 0.14, 880);
    setTimeout(() => this.tone(860, 'sawtooth', 0.35, 0.12, 320), 150);
  }

  repair() {
    this.noise(0.06, 0.12, 1600);
    this.tone(340, 'square', 0.06, 0.1, 480);
  }

  buy() {
    this.tone(587.3, 'triangle', 0.09, 0.12, 880);
  }

  playerHit() {
    this.noise(0.15, 0.22, 600);
    this.tone(110, 'sawtooth', 0.18, 0.18, 45);
  }
}

export const audio = new DistrictAudio();
