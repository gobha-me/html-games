// Procedural WebAudio Synthesizer for SUNBREAK // V'BALL
(function () {
  class SunbreakAudio {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggle() {
      this.enabled = !this.enabled;
      return this.enabled;
    }

    playHit(power = 0.6, pitchScale = 1.0) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;
      // Crisp leather volleyball thud + slap harmonic
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const baseFreq = (115 + power * 70) * pitchScale;
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.exponentialRampToValueAtTime(38, t + 0.14);

      gain.gain.setValueAtTime(Math.min(0.45, 0.18 + power * 0.25), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.16);
    }

    playSolarSpike() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      sub.type = 'sine';
      osc.frequency.setValueAtTime(340, t);
      osc.frequency.exponentialRampToValueAtTime(55, t + 0.36);
      sub.frequency.setValueAtTime(140, t);
      sub.frequency.exponentialRampToValueAtTime(32, t + 0.38);

      gain.gain.setValueAtTime(0.42, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      sub.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      sub.start(t);
      osc.stop(t + 0.4);
      sub.stop(t + 0.4);
    }

    playSandDive() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.22);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.45));
      }

      const src = this.ctx.createBufferSource();
      src.buffer = buf;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, t);
      filter.frequency.linearRampToValueAtTime(420, t + 0.22);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.24, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(t);
    }

    playWhistle(doubleTweet = false) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const t = this.ctx.currentTime;
      const playTweet = (start, dur) => {
        const osc = this.ctx.createOscillator();
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(2850, start);
        lfo.frequency.setValueAtTime(42, start);
        lfoGain.gain.setValueAtTime(95, start);

        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        lfo.start(start);
        osc.stop(start + dur + 0.01);
        lfo.stop(start + dur + 0.01);
      };

      playTweet(t, 0.14);
      if (doubleTweet) {
        playTweet(t + 0.17, 0.24);
      }
    }

    playPointFanfare() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5];
      const t = this.ctx.currentTime;
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t + idx * 0.07);
        gain.gain.setValueAtTime(0.16, t + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t + idx * 0.07);
        osc.stop(t + idx * 0.07 + 0.26);
      });
    }
  }

  window.SunbreakAudio = new SunbreakAudio();
})();
