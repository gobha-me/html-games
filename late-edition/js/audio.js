// ============================================================================
// LATE EDITION // 1947 — Noir Newsroom & Street Audio Engine
// Combines assets/audio/*.mp3 with procedural WebAudio typewriter & telegraph
// ============================================================================

export class NoirAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.buffers = {};
    this.sfxUrls = {
      dispatch: 'assets/audio/SFX-01-reporter-dispatched.mp3',
      shutter: 'assets/audio/SFX-05-camera-shutter.mp3',
      press: 'assets/audio/SFX-07-press-fires.mp3',
    };
  }

  async init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();

    for (const [key, url] of Object.entries(this.sfxUrls)) {
      fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .then((arr) => (arr && this.ctx ? this.ctx.decodeAudioData(arr) : null))
        .then((buf) => {
          if (buf) this.buffers[key] = buf;
        })
        .catch(() => {});
    }
  }

  async resume() {
    await this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (_) {}
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playBufferOrFallback(key, fallbackFn) {
    if (this.muted) return;
    if (this.ctx && this.buffers[key]) {
      const src = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      gain.gain.value = 0.65;
      src.buffer = this.buffers[key];
      src.connect(gain);
      gain.connect(this.ctx.destination);
      src.start();
    } else if (fallbackFn) {
      fallbackFn();
    }
  }

  dispatch() {
    this.playBufferOrFallback('dispatch', () => this.tone(540, 680, 0.09, 'triangle', 0.16));
  }

  shutter() {
    this.playBufferOrFallback('shutter', () => {
      this.tone(1400, 320, 0.08, 'sawtooth', 0.2);
    });
  }

  pressRun() {
    this.playBufferOrFallback('press', () => {
      this.tone(120, 260, 0.45, 'sawtooth', 0.22);
      setTimeout(() => this.tone(440, 880, 0.22, 'triangle', 0.2), 140);
    });
  }

  typewriter() {
    if (this.muted || !this.ctx) return;
    this.tone(920, 420, 0.04, 'square', 0.12);
  }

  wireBell() {
    if (this.muted || !this.ctx) return;
    this.tone(1318.5, 1318.5, 0.18, 'sine', 0.18);
  }

  bribe() {
    if (this.muted || !this.ctx) return;
    this.tone(330, 220, 0.16, 'sawtooth', 0.16);
  }

  phoneRing() {
    if (this.muted || !this.ctx) return;
    this.tone(1180, 1480, 0.08, 'square', 0.16);
    setTimeout(() => this.tone(1180, 1480, 0.09, 'square', 0.16), 110);
  }

  tone(f0, f1, dur, type = 'triangle', amp = 0.15) {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, f1), now + dur);
    g.gain.setValueAtTime(amp, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.01);
  }
}
