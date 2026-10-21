// ============================================================================
// BACKBEAT // OVERDRIVE — WebAudio Synth, MP3 Engine & Real-Time FFT Analyser
// Uses OfflineAudioContext to synthesize full multi-track procedural songs
// into sample-accurate AudioBuffers feeding a live 64-band AnalyserNode.
// ============================================================================

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.masterGain = null;
    this.hitGain = null;
    this.freqData = new Uint8Array(64);
    this.trackCache = new Map();
    this.trackBuffer = null;
    this.trackSource = null;
    this.hitBuffer = null;

    this.startTime = 0;
    this.pauseOffset = 0;
    this.playing = false;
    this.muted = false;
  }

  async init() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.85;

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 128;
    this.analyser.smoothingTimeConstant = 0.76;

    this.hitGain = this.ctx.createGain();
    this.hitGain.gain.value = 0.55;

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    this.hitGain.connect(this.ctx.destination);
  }

  async resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
      } catch (_) {}
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.85, this.ctx.currentTime);
      this.hitGain.gain.setValueAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime);
    }
    return this.muted;
  }

  async loadHitSfx(url) {
    try {
      await this.init();
      if (!this.ctx) return;
      const res = await fetch(url);
      if (!res.ok) return;
      const arr = await res.arrayBuffer();
      this.hitBuffer = await this.ctx.decodeAudioData(arr);
    } catch (_) {
      this.hitBuffer = null;
    }
  }

  async prepareTrack(track, chart) {
    await this.init();
    if (this.trackCache.has(track.id)) {
      this.trackBuffer = this.trackCache.get(track.id);
      return this.trackBuffer;
    }

    if (track.audioUrl && this.ctx) {
      try {
        const res = await fetch(track.audioUrl);
        if (res.ok) {
          const arr = await res.arrayBuffer();
          const decoded = await this.ctx.decodeAudioData(arr);
          this.trackCache.set(track.id, decoded);
          this.trackBuffer = decoded;
          return decoded;
        }
      } catch (_) {
        // Fall through to procedural offline synthesis
      }
    }

    const buffer = await this.renderProceduralTrack(track, chart);
    if (buffer) {
      this.trackCache.set(track.id, buffer);
    }
    this.trackBuffer = buffer;
    return buffer;
  }

  async renderProceduralTrack(track, chart) {
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtx) return null;

    const sampleRate = 44100;
    const duration = (chart && chart.duration) || track.duration || 74;
    const off = new OfflineCtx(2, Math.ceil(sampleRate * duration), sampleRate);

    const bpm = track.bpm || 120;
    const beatSec = 60 / bpm;
    const stepSec = beatSec / 2; // 8th note
    const totalSteps = Math.floor((duration - 1.5) / stepSec);

    // Scales (in Hz) per synth style
    const scales = {
      synthwave: [110.0, 130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25], // A minor pentatonic
      chiptune: [130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 659.25],  // C major / A minor arcade
      industrial: [82.41, 87.31, 98.0, 110.0, 123.47, 130.81, 164.81, 174.61, 196.0, 220.0, 246.94, 329.63],   // E Phrygian dark industrial
      anthem: [110.0, 130.81, 146.83, 164.81, 196.0, 220.0, 261.63, 329.63, 392.0, 440.0],
    };
    const scale = scales[track.synthStyle] || scales.synthwave;

    // 1. Schedule Kick, Snare, Hi-Hat & Bassline across the entire track
    for (let s = 0; s < totalSteps; s++) {
      const t = s * stepSec;
      const stepInBar = s % 8;
      const bar = Math.floor(s / 8);

      // Four-on-the-floor or breakbeat Kick
      if (stepInBar === 0 || stepInBar === 4 || (track.synthStyle === 'chiptune' && stepInBar === 6)) {
        this.scheduleKick(off, t, track.synthStyle === 'industrial' ? 145 : 120);
      }

      // Gated Snare on backbeats (steps 2 and 6)
      if (stepInBar === 2 || stepInBar === 6) {
        this.scheduleSnare(off, t, track.synthStyle);
      }

      // Crisp 8th-note Hi-Hat
      this.scheduleHat(off, t, stepInBar % 2 === 1 ? 0.11 : 0.06);

      // Driving Sub/Acid Bassline
      const rootIdx = (bar % 4) === 0 ? 0 : (bar % 4) === 1 ? 2 : (bar % 4) === 2 ? 3 : 1;
      const bassFreq = scale[rootIdx] * (stepInBar % 2 === 1 ? 2 : 1);
      this.scheduleBass(off, t, stepSec * 0.88, bassFreq, track.synthStyle);
    }

    // 2. Schedule Lead Synth Notes synced 1:1 with the playable Chart Notes!
    if (chart && chart.notes) {
      for (let i = 0; i < chart.notes.length; i++) {
        const n = chart.notes[i];
        const freq = scale[(n.lane * 2 + (i % 4)) % scale.length] * 2;
        const dur = Math.max(0.16, n.duration || stepSec * 0.85);
        this.scheduleLead(off, n.time, dur, freq, track.synthStyle, n.chord);
      }
    }

    return off.startRendering();
  }

  scheduleKick(ctx, t, startFreq = 125) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(36, t + 0.14);

    gain.gain.setValueAtTime(0.65, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.23);
  }

  scheduleSnare(ctx, t, style) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = style === 'chiptune' ? 'square' : 'triangle';
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(75, t + 0.12);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  scheduleHat(ctx, t, amp = 0.08) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(6400, t);
    gain.gain.setValueAtTime(amp, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  scheduleBass(ctx, t, dur, freq, style) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = style === 'chiptune' ? 'square' : 'sawtooth';
    osc.frequency.setValueAtTime(freq, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(style === 'industrial' ? 1100 : 720, t);
    filter.frequency.exponentialRampToValueAtTime(190, t + dur);

    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  scheduleLead(ctx, t, dur, freq, style, isChord = false) {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = style === 'chiptune' ? 'square' : style === 'industrial' ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    // Sustained Hold Ribbon pitch-bend vibrato & filter sweep (#38)
    filter.type = 'lowpass';
    if (dur >= 0.32) {
      filter.frequency.setValueAtTime(950, t);
      filter.frequency.exponentialRampToValueAtTime(2800, t + dur * 0.7);
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(6.0, t);
      lfoGain.gain.setValueAtTime(freq * 0.015, t);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + dur);
    } else {
      filter.frequency.setValueAtTime(2400, t);
    }

    gain.gain.setValueAtTime(isChord ? 0.18 : 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.008, t + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  play(offsetSec = 0) {
    if (!this.ctx || !this.trackBuffer) {
      this.startTime = performance.now() / 1000;
      this.pauseOffset = offsetSec;
      this.playing = true;
      return this.startTime;
    }
    this.stopSource();
    this.trackSource = this.ctx.createBufferSource();
    this.trackSource.buffer = this.trackBuffer;
    this.trackSource.connect(this.masterGain);
    this.startTime = this.ctx.currentTime;
    this.pauseOffset = offsetSec;
    this.trackSource.start(0, Math.max(0, offsetSec));
    this.playing = true;
    return this.startTime;
  }

  stopSource() {
    if (this.trackSource) {
      try {
        this.trackSource.stop();
      } catch (_) {}
      this.trackSource.disconnect();
      this.trackSource = null;
    }
  }

  pause() {
    if (!this.playing) return;
    this.pauseOffset = this.getTime();
    this.stopSource();
    this.playing = false;
  }

  resumeTrack() {
    if (!this.playing) {
      this.play(this.pauseOffset);
    }
  }

  getTime() {
    if (!this.playing) return this.pauseOffset;
    if (!this.ctx || !this.trackBuffer) {
      return this.pauseOffset + (performance.now() / 1000 - this.startTime);
    }
    return this.pauseOffset + (this.ctx.currentTime - this.startTime);
  }

  getDuration() {
    return this.trackBuffer ? this.trackBuffer.duration : 75;
  }

  getSpectrum() {
    if (this.analyser && this.playing && !this.muted) {
      this.analyser.getByteFrequencyData(this.freqData);
      return this.freqData;
    }
    // Synthetic beat-reactive spectrum fallback if paused or headless
    const t = this.getTime();
    for (let i = 0; i < this.freqData.length; i++) {
      const wave = Math.sin(t * 7.5 + i * 0.28) * 0.5 + 0.5;
      const bassBoost = Math.max(0, 1 - i / 36);
      this.freqData[i] = Math.floor((65 + wave * 135) * (0.45 + bassBoost * 0.55));
    }
    return this.freqData;
  }

  hit(lane = 0, isPerfect = true) {
    if (!this.ctx || this.muted) return;
    if (this.hitBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.hitBuffer;
      src.playbackRate.value = 1 + lane * 0.07;
      src.connect(this.hitGain);
      src.start();
    } else {
      this.blip((isPerfect ? 660 : 480) + lane * 110, 0.055);
    }
  }

  overdriveSfx() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    [440, 554.37, 659.25, 880].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      g.gain.setValueAtTime(0.18, now + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.25);
      osc.connect(g);
      g.connect(this.hitGain);
      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.26);
    });
  }

  blip(freq = 880, dur = 0.06) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.24, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.hitGain);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  pulse() {
    this.blip(523.25, 0.075);
  }
}
