/**
 * Arcade SFX — Shared Web Audio sound-effect helper (opt-in module)
 *
 * Usage:
 *   ArcadeSFX.beep(440, 0.1);
 *   ArcadeSFX.blip();
 *   ArcadeSFX.explosion();
 *   ArcadeSFX.whoosh();
 *   ArcadeSFX.playPattern([440, 554, 659], 0.15, 0.1);
 *
 * AudioContext is lazily initialised on first call.
 * Safe to include in any game — does not interfere with per-game audio modules.
 */
const ArcadeSFX = (() => {
  let ctx;

  /** Lazy-init the AudioContext (call once on first user interaction) */
  function init() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
  }

  /** Play a single tone */
  function beep(freq = 440, duration = 0.1, type = 'square', volume = 0.1) {
    init();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  /** Short high-pitched blip */
  function blip(duration = 0.05, volume = 0.08) {
    beep(880, duration, 'sine', volume);
  }

  /** Noise-burst explosion */
  function explosion(duration = 0.2, volume = 0.2) {
    init();
    if (!ctx) return;
    const sampleRate = ctx.sampleRate;
    const bufferSize = sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  /** Descending whoosh / swipe */
  function whoosh(duration = 0.15, volume = 0.1) {
    init();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  /** Play a sequence of notes with equal spacing */
  function playPattern(notes = [440, 554, 659], noteDuration = 0.1, gap = 0.05, type = 'sine', volume = 0.1) {
    notes.forEach((freq, i) => {
      setTimeout(() => beep(freq, noteDuration, type, volume), i * (noteDuration + gap) * 1000);
    });
  }

  return { init, beep, blip, explosion, whoosh, playPattern };
})();
