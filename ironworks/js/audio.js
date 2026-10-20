// ============================================================================
// IRONWORKS // CORE — Procedural Industrial WebAudio Synthesizer
// Zero external audio files: all mechanical thuds, turret fire, arc zaps,
// artillery booms, and ambient foundry hum are synthesized in real time.
// ============================================================================

let _ctx = null;
let _muted = false;
let _masterVol = 0.7;

function ctx() {
  if (_muted) return null;
  if (!_ctx && typeof window !== 'undefined') {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) _ctx = new AC();
  }
  if (_ctx && _ctx.state === 'suspended') {
    _ctx.resume().catch(() => {});
  }
  return _ctx;
}

function tone(freq, endFreq, dur, type = 'triangle', vol = 0.1, delay = 0) {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), t0);
  if (endFreq && endFreq !== freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
  }
  const v = Math.max(0.001, vol * _masterVol);
  gain.gain.setValueAtTime(v, t0);
  gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.015);
}

function noiseBurst(dur = 0.12, vol = 0.08, cutoff = 900, delay = 0) {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, t0);
  const gain = c.createGain();
  gain.gain.setValueAtTime(Math.max(0.001, vol * _masterVol), t0);
  gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(t0);
}

export const audio = {
  setMuted(m) { _muted = !!m; },
  isMuted() { return _muted; },
  toggleMute() { _muted = !_muted; return _muted; },
  setVolume(v) { _masterVol = Math.max(0, Math.min(1, Number(v) || 0)); },
  getVolume() { return _masterVol; },

  place(isBelt = false) {
    if (isBelt) {
      tone(260, 340, 0.045, 'triangle', 0.07);
    } else {
      tone(140, 68, 0.11, 'square', 0.11);
      tone(320, 480, 0.07, 'triangle', 0.08, 0.03);
      noiseBurst(0.06, 0.06, 1200);
    }
  },
  deconstruct() {
    tone(320, 110, 0.1, 'sawtooth', 0.08);
    noiseBurst(0.07, 0.05, 800);
  },
  rotate() {
    tone(480, 620, 0.04, 'sine', 0.06);
  },
  mine() {
    tone(520 + Math.random() * 140, 220, 0.07, 'triangle', 0.09);
    noiseBurst(0.04, 0.05, 1600);
  },
  craft() {
    tone(360, 540, 0.08, 'triangle', 0.09);
    tone(540, 720, 0.1, 'sine', 0.09, 0.05);
  },
  gatling() {
    tone(190 + Math.random() * 40, 70, 0.045, 'sawtooth', 0.055);
    noiseBurst(0.035, 0.045, 1800);
  },
  tesla() {
    tone(880, 260, 0.09, 'sawtooth', 0.07);
    tone(1320, 440, 0.07, 'square', 0.05, 0.02);
  },
  mortar() {
    tone(110, 38, 0.26, 'sawtooth', 0.14);
    noiseBurst(0.24, 0.12, 520);
  },
  railgun() {
    tone(680, 120, 0.28, 'sawtooth', 0.14);
    tone(1240, 280, 0.22, 'triangle', 0.1, 0.02);
    noiseBurst(0.18, 0.1, 2400);
  },
  pulse() {
    tone(90, 480, 0.35, 'sawtooth', 0.16);
    tone(220, 45, 0.55, 'triangle', 0.18, 0.12);
    noiseBurst(0.45, 0.15, 1100, 0.1);
  },
  waveStart() {
    tone(165, 220, 0.28, 'sawtooth', 0.12);
    tone(123, 98, 0.45, 'sawtooth', 0.14, 0.18);
  },
  victory() {
    [261.6, 329.6, 392.0, 523.3, 659.3].forEach((f, i) => {
      tone(f, f * 1.01, 0.28, 'triangle', 0.13, i * 0.1);
    });
  },
  defeat() {
    [240, 210, 175, 130].forEach((f, i) => {
      tone(f, f * 0.92, 0.32, 'sawtooth', 0.13, i * 0.14);
    });
  },
};
