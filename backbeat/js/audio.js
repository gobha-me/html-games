/**
 * BACKBEAT — Web Audio engine.
 * Loads the track, exposes a sample-accurate clock, plays hit sounds.
 * All game timing derives from audioCtx.currentTime for tight sync.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.trackBuffer = null;
    this.trackSource = null;
    this.startTime = 0;      // ctx.currentTime when playback started
    this.pauseOffset = 0;    // seconds into track when paused
    this.playing = false;
    this.hitGain = null;
    this.hitBuffer = null;  // optional loaded sfx for note hits
  }

  async init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.hitGain = this.ctx.createGain();
    this.hitGain.gain.value = 0.6;
    this.hitGain.connect(this.ctx.destination);
  }

  async resume() { if (this.ctx && this.ctx.state === 'suspended') await this.ctx.resume(); }

  /** Load a hit-sound file; falls back to synthesized blip on failure. */
  async loadHitSfx(url) {
    try {
      await this.init();
      const res = await fetch(url);
      const arr = await res.arrayBuffer();
      this.hitBuffer = await this.ctx.decodeAudioData(arr);
    } catch (e) {
      this.hitBuffer = null;
    }
  }

  /** Play the loaded hit sfx, or a blip if none. */
  hit(lane = 0) {
    if (!this.ctx) return;
    if (this.hitBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.hitBuffer;
      // slight pitch variation per lane for texture
      src.playbackRate.value = 1 + lane * 0.06;
      src.connect(this.hitGain || this.ctx.destination);
      src.start();
    } else {
      this.blip(660 + lane * 110, 0.05);
    }
  }

  async loadTrack(url) {
    await this.init();
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    this.trackBuffer = await this.ctx.decodeAudioData(arr);
  }

  /** Play the loaded track from `offsetSec`. Returns the ctx start time. */
  play(offsetSec = 0) {
    if (!this.trackBuffer) throw new Error('no track loaded');
    this.stopSource();
    this.trackSource = this.ctx.createBufferSource();
    this.trackSource.buffer = this.trackBuffer;
    this.trackSource.connect(this.ctx.destination);
    this.startTime = this.ctx.currentTime;
    this.pauseOffset = offsetSec;
    this.trackSource.start(0, offsetSec);
    this.playing = true;
    return this.startTime;
  }

  stopSource() {
    if (this.trackSource) {
      try { this.trackSource.stop(); } catch (e) { /* already stopped */ }
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

  resumeTrack() { if (!this.playing) this.play(this.pauseOffset); }

  /** Current position in the track, in seconds (audio-clock accurate). */
  getTime() {
    if (!this.playing) return this.pauseOffset;
    return this.pauseOffset + (this.ctx.currentTime - this.startTime);
  }

  getDuration() { return this.trackBuffer ? this.trackBuffer.duration : 0; }
  isPlaying() { return this.playing; }

  /** Short synthesized hit blip (fallback if no sfx file). */
  blip(freq = 880, dur = 0.06) {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.25, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.hitGain || this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  /** Calibration pulse: a click at a fixed interval for offset tuning. */
  pulse() { this.blip(440, 0.08); }
}
