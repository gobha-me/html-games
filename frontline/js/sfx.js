// Synthesized WebAudio SFX tailored to the active ruleset style:
// - 'frontline': brass, mechanical clicks, artillery thud, trench whistle
// - 'hexwire' / 'rift': cyberpunk synth bleeps, arcane resonance, grid surge
import { state, session } from './state.js';

let _ctx = null;
function ctx() {
  if (session.prefs && session.prefs.muted) return null;
  if (!_ctx && typeof window !== 'undefined') {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) _ctx = new AC();
  }
  if (_ctx && _ctx.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

function tone(freq, endFreq, dur, type = 'triangle', vol = 0.08, delay = 0) {
  const c = ctx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq && endFreq !== freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
  }
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.01);
}

export const sfx = {
  select() {
    const hex = state.style === 'hexwire';
    tone(hex ? 680 : 320, hex ? 920 : 380, 0.055, hex ? 'sine' : 'triangle', 0.06);
  },
  deploy() {
    const hex = state.style === 'hexwire';
    if (hex) {
      tone(240, 520, 0.09, 'sawtooth', 0.06);
      tone(520, 780, 0.11, 'sine', 0.06, 0.04);
    } else {
      tone(150, 85, 0.11, 'square', 0.07);
      tone(290, 210, 0.08, 'triangle', 0.06, 0.04);
    }
  },
  bank() {
    const hex = state.style === 'hexwire';
    tone(hex ? 520 : 360, hex ? 780 : 480, 0.08, 'triangle', 0.07);
    tone(hex ? 880 : 540, hex ? 1140 : 680, 0.11, 'sine', 0.07, 0.06);
  },
  spell() {
    const hex = state.style === 'hexwire';
    tone(hex ? 740 : 220, hex ? 180 : 75, 0.22, 'sawtooth', 0.08);
    tone(hex ? 480 : 140, hex ? 960 : 60, 0.18, 'triangle', 0.06, 0.04);
  },
  subvert() {
    tone(330, 660, 0.14, 'sawtooth', 0.07);
    tone(660, 220, 0.22, 'sine', 0.08, 0.08);
  },
  combat() {
    const hex = state.style === 'hexwire';
    tone(hex ? 190 : 120, 55, 0.16, 'sawtooth', 0.08);
  },
  win() {
    [440, 554, 659, 880].forEach((f, i) => tone(f, f * 1.02, 0.16, 'triangle', 0.08, i * 0.08));
  },
  lose() {
    [330, 293, 247, 185].forEach((f, i) => tone(f, f * 0.96, 0.18, 'sawtooth', 0.07, i * 0.09));
  },
  styleSwitch() {
    const hex = state.style === 'hexwire';
    tone(hex ? 420 : 280, hex ? 840 : 420, 0.12, 'sine', 0.07);
  },
};
