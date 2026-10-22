import { mulberry32 } from './rng.js';

export const AUDIO_SETTINGS_KEY = 'lateEdition.audio';
export const AUDIO_SETTINGS_VERSION = 1;
export const DEFAULT_AUDIO_SETTINGS = Object.freeze({ music: 0.45, ambience: 0.35, sfx: 0.65, muted: false });
const CHANNELS = ['music', 'ambience', 'sfx'];

export function readAudioSettings(json) {
  const settings = { ...DEFAULT_AUDIO_SETTINGS };
  try {
    const value = JSON.parse(json);
    if (value?.version !== AUDIO_SETTINGS_VERSION || !value.volumes || typeof value.volumes !== 'object') return settings;
    for (const channel of CHANNELS) {
      const volume = value.volumes[channel];
      if (typeof volume === 'number' && Number.isFinite(volume)) settings[channel] = Math.max(0, Math.min(1, volume));
    }
    if (typeof value.muted === 'boolean') settings.muted = value.muted;
  } catch { /* Truncated or blocked storage must never prevent taking the desk. */ }
  return settings;
}

// All sound is generated locally. No fetch, samples, speech service or gameplay RNG.
// Only resume(), called by a trusted gesture in main.js, may construct a context.
export class NoirAudio {
  constructor({ getContext = () => globalThis.AudioContext || globalThis.webkitAudioContext,
    getStorage = () => globalThis.localStorage } = {}) {
    this.getContext = getContext;
    this.getStorage = getStorage;
    this.ctx = null;
    this.settings = { ...DEFAULT_AUDIO_SETTINGS };
    try { this.settings = readAudioSettings(getStorage()?.getItem(AUDIO_SETTINGS_KEY)); } catch { /* Private browsing. */ }
    this.blocked = false;
    this.scene = { active: false, progress: 0 };
    this.voices = new Set();
    this.beds = [];
    this.buses = {};
    this.transition = null;
  }

  get muted() { return this.settings.muted; }

  _persist() {
    try {
      this.getStorage()?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({ version: AUDIO_SETTINGS_VERSION,
        muted: this.muted, volumes: Object.fromEntries(CHANNELS.map((channel) => [channel, this.settings[channel]])) }));
    } catch { /* Quota/security errors leave controls usable in memory. */ }
  }

  setVolume(channel, volume) {
    if (!CHANNELS.includes(channel) || typeof volume !== 'number' || !Number.isFinite(volume)) return;
    this.settings[channel] = Math.max(0, Math.min(1, volume));
    this._persist();
    this._mix();
  }

  toggleMute() {
    this.settings.muted = !this.muted;
    this._persist();
    if (this.muted) this.cancel();
    this._mix();
    return this.muted;
  }

  _gain(param, value) {
    param.setTargetAtTime(value, this.ctx.currentTime, 0.08);
  }

  _mix() {
    if (!this.ctx) return;
    try {
      this._gain(this.master.gain, this.muted || this.blocked ? 0 : 0.7);
      for (const channel of CHANNELS) this._gain(this.buses[channel].gain, this.settings[channel]);
      const level = this.scene.active ? 0.25 + 0.75 * this.scene.progress : 0;
      for (const bed of this.beds) this._gain(bed.gain.gain, bed.level * level);
    } catch { /* An interrupted/closed device is optional, just like a missing device. */ }
  }

  setScene({ active, progress }) {
    this.scene = { active: Boolean(active), progress: Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0 };
    this._mix();
  }

  setSuspended(blocked) {
    if (this.blocked === Boolean(blocked)) return;
    this.blocked = Boolean(blocked);
    this._mix();
    return this._reconcile();
  }

  async _reconcile() {
    // Serialize transitions: a hide during a pending resume must finish suspended.
    // A failed resume is retried only on the next gesture, never every frame.
    if (!this.ctx || this.transition) return;
    const ctx = this.ctx;
    const blocked = this.blocked;
    this.transition = (async () => {
      try {
        if (this.blocked && ctx.state === 'running') await ctx.suspend();
        else if (!this.blocked && ctx.state === 'suspended') await ctx.resume();
      } catch { /* Autoplay/device rejection must not escape as an unhandled promise. */ }
    })();
    await this.transition;
    this.transition = null;
    if (this.blocked !== blocked) await this._reconcile();
  }

  async resume() {
    if (this.blocked) return;
    if (!this.ctx) {
      let ctx;
      try {
        const AudioContext = this.getContext();
        if (!AudioContext) return;
        ctx = new AudioContext();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.7;
        this.master.connect(ctx.destination);
        for (const channel of CHANNELS) {
          this.buses[channel] = ctx.createGain();
          this.buses[channel].gain.value = this.settings[channel];
          this.buses[channel].connect(this.master);
        }
        this._buildBed();
        this._mix();
      } catch {
        // Construction/graph setup can throw even when AudioContext is present.
        this.ctx = null;
        this.beds = [];
        try { await ctx?.close(); } catch { /* Device already gone. */ }
        return;
      }
    }
    await this._reconcile();
  }

  _buildBed() {
    const ctx = this.ctx;
    const random = mulberry32(1947); // Independent cosmetic noise, never the sim's stream.
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = random.nextFloat() * 2 - 1;
    for (const [frequency, q, level] of [[2200, 0.4, 0.22], [420, 2, 0.12]]) {
      const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
      source.buffer = this.noise;
      source.loop = true;
      filter.type = 'bandpass';
      filter.frequency.value = frequency;
      filter.Q.value = q;
      gain.gain.value = 0;
      source.connect(filter).connect(gain).connect(this.buses.ambience);
      source.start();
      this.beds.push({ source, filter, gain, level });
    }
    // Low mechanical newsroom hum under the rain and filtered voice-like murmur.
    const source = ctx.createOscillator(), gain = ctx.createGain();
    source.type = 'triangle';
    source.frequency.value = 58;
    gain.gain.value = 0;
    source.connect(gain).connect(this.buses.ambience);
    source.start();
    this.beds.push({ source, gain, level: 0.035 });
  }

  _ready(channel) {
    return this.ctx?.state === 'running' && !this.blocked && !this.muted && this.settings[channel] > 0;
  }

  _voice(source, nodes, start, duration, group) {
    if (this.voices.size >= 64) { nodes.forEach((node) => node.disconnect()); return; }
    const voice = { source, nodes, group };
    this.voices.add(voice);
    source.onended = () => {
      nodes.forEach((node) => node.disconnect());
      this.voices.delete(voice);
    };
    source.start(start);
    source.stop(start + duration + 0.04);
  }

  cancel(group) {
    for (const voice of this.voices) {
      if (group && voice.group !== group) continue;
      try { voice.source.stop(); } catch { /* May already have ended during suspension. */ }
      voice.nodes.forEach((node) => node.disconnect());
      this.voices.delete(voice);
    }
  }

  tone(f0, f1, duration, type = 'triangle', amp = 0.12, delay = 0, channel = 'sfx', group = 'cue', formants = []) {
    if (!this._ready(channel)) return;
    const ctx = this.ctx, start = ctx.currentTime + delay;
    const source = ctx.createOscillator(), gain = ctx.createGain();
    source.type = type;
    source.frequency.setValueAtTime(f0, start);
    source.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(amp, start + Math.min(0.025, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    const nodes = [source, gain];
    if (formants.length) {
      // Parallel resonances shape a muted horn or the newsboy's voiced syllables.
      for (const frequency of formants) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = frequency;
        filter.Q.value = 5;
        source.connect(filter).connect(gain);
        nodes.push(filter);
      }
    } else source.connect(gain);
    gain.connect(this.buses[channel]);
    this._voice(source, nodes, start, duration, group);
  }

  _burst(frequency, duration, amp, delay = 0, group = 'cue') {
    if (!this._ready('sfx')) return;
    const ctx = this.ctx, start = ctx.currentTime + delay;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = this.noise;
    source.loop = true;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 1;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(amp, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(this.buses.sfx);
    this._voice(source, [source, filter, gain], start, duration, group);
  }

  emit(event) {
    // Device loss must never interrupt a simulation input or frame.
    try { this[event]?.(); } catch { /* Silent fallback is the playable desk. */ }
  }

  dispatch() { this.tone(540, 680, 0.09); }
  shutter() { this._burst(2200, 0.09, 0.3); }
  typewriter() { this._burst(920, 0.04, 0.22); }
  bribe() { this.tone(330, 220, 0.16, 'sawtooth'); }
  wireBell() {
    for (let i = 0; i < 7; i++) this._burst(1800, 0.025, 0.16, i * 0.045);
    this.tone(1318.5, 1318.5, 0.3, 'sine', 0.17, 0.36);
  }
  phoneRing() {
    for (const delay of [0, 0.12, 0.24, 0.5, 0.62, 0.74]) {
      this.tone(1180, 1180, 0.09, 'sine', 0.12, delay);
      this.tone(1480, 1480, 0.09, 'sine', 0.08, delay);
    }
  }
  editionStart() { this._jazz([146.83, 174.61, 220]); }
  deadline() { this._jazz([349.23, 329.63, 293.66, 220]); }
  _jazz(notes) {
    notes.forEach((note, i) => this.tone(note, note * 0.99, 0.65, 'sawtooth', 0.14, i * 0.28, 'music', 'cue', [900, 1600]));
    this.tone(73.42, 73.42, 1.2, 'triangle', 0.2, 0, 'music');
  }
  pressRun() {
    this.cancel('press');
    this.tone(32, 125, 2.6, 'sawtooth', 0.16, 0, 'sfx', 'press');
    for (let i = 0; i < 14; i++) this._burst(300 + i * 80, 0.16, 0.24, i * 0.16, 'press');
    // Source-filter speech: EH + /ks/ + /tr/ + AH, pitched like a street cry.
    // Captions carry the word too; there is no platform voice/network dependency.
    this.tone(190, 245, 0.28, 'sawtooth', 0.3, 2.25, 'sfx', 'press', [640, 1850, 2500]);
    this._burst(4200, 0.13, 0.24, 2.48, 'press');
    this._burst(2100, 0.06, 0.24, 2.65, 'press');
    this.tone(210, 145, 0.5, 'sawtooth', 0.35, 2.7, 'sfx', 'press', [800, 1200, 2500]);
  }
}
