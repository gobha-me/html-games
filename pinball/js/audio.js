// ============================================================================
// AETHERIUM // PINBALL — Procedural WebAudio Solenoid & FM Chime Synthesizer
// ============================================================================

class PinballAudio {
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

  tone(freq, dur = 0.08, type = 'triangle', gainVal = 0.08, endFreq = null) {
    const ctx = this.ensure();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + dur);
    }
    g.gain.setValueAtTime(gainVal, now);
    g.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  flipperUp() {
    // Crisp mechanical solenoid clack
    this.tone(185, 0.045, 'square', 0.07, 520);
    this.tone(92, 0.035, 'triangle', 0.09, 60);
  }

  flipperDown() {
    this.tone(130, 0.03, 'triangle', 0.04, 75);
  }

  launch(powerRatio = 1) {
    this.tone(140, 0.22, 'sawtooth', 0.08, 420 + powerRatio * 260);
  }

  bumper(id = 'mercury') {
    const pitchMap = {
      mercury: [587.33, 880],
      sulfur:  [523.25, 783.99],
      aurum:   [659.25, 987.77],
      salt_coil: [440, 659.25],
      vitriol_coil: [493.88, 739.99],
    };
    const [f1, f2] = pitchMap[id] || [523.25, 783.99];
    this.tone(f1, 0.11, 'triangle', 0.09, f1 * 0.98);
    this.tone(f2, 0.16, 'sine', 0.07, f2 * 1.01);
  }

  slingshot() {
    this.tone(310, 0.07, 'sawtooth', 0.075, 160);
  }

  dropTarget(bankComplete = false) {
    this.tone(420, 0.08, 'square', 0.06, 260);
    if (bankComplete) {
      setTimeout(() => this.tone(523.25, 0.1, 'triangle', 0.08), 55);
      setTimeout(() => this.tone(659.25, 0.12, 'triangle', 0.08), 110);
      setTimeout(() => this.tone(783.99, 0.18, 'triangle', 0.09), 165);
    }
  }

  rollover() {
    this.tone(880, 0.07, 'sine', 0.06, 1174.66);
  }

  spinnerTick() {
    this.tone(1240, 0.022, 'sine', 0.035, 980);
  }

  saucerCatch() {
    this.tone(330, 0.14, 'sine', 0.07, 220);
  }

  saucerEject() {
    this.tone(220, 0.22, 'sawtooth', 0.09, 660);
    setTimeout(() => this.tone(880, 0.18, 'triangle', 0.08, 1320), 60);
  }

  bossHit(defeated = false) {
    this.tone(110, 0.14, 'sawtooth', 0.1, 65);
    this.tone(587.33, 0.09, 'square', 0.06, 440);
    if (defeated) {
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99];
      notes.forEach((n, i) => {
        setTimeout(() => this.tone(n, 0.22, 'sawtooth', 0.085), i * 65);
      });
    }
  }

  multiball() {
    const chord = [293.66, 369.99, 440.00, 587.33, 739.99, 880.00];
    chord.forEach((n, i) => {
      setTimeout(() => this.tone(n, 0.28, 'triangle', 0.09), i * 70);
    });
  }

  nudge() {
    this.tone(85, 0.09, 'sawtooth', 0.09, 48);
  }

  tilt() {
    this.tone(155, 0.45, 'sawtooth', 0.11, 72);
  }

  drain() {
    this.tone(240, 0.32, 'sawtooth', 0.08, 75);
  }
}

export const audio = new PinballAudio();
