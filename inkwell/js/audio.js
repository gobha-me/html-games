let ctx = null;
let unavailable = false;

function ensure() {
  if (ctx || unavailable) return ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) {
    unavailable = true;
    return null;
  }
  try {
    ctx = new Ctx();
  } catch (e) {
    unavailable = true;
    return null;
  }
  return ctx;
}

export function resume() {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') {
    try { c.resume(); } catch (e) { /* ignore */ }
  }
}

function tone(freq, freqEnd, duration, oscType = 'sine', startGain = 0.18) {
  const c = ensure();
  if (!c) return;
  try {
    const t0 = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = oscType;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + duration);
    }
    gain.gain.setValueAtTime(startGain, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch (e) {
    // Audio can fail mid-game (context closed, etc.) — never throw into gameplay.
  }
}

const SFX = {
  hit:     () => tone(180, 90,   0.08, 'square',   0.18),
  pickup:  () => tone(820, 1100, 0.10, 'triangle', 0.14),
  descend: () => tone(560, 180,  0.28, 'sine',     0.16),
  cast:    () => tone(660, 660,  0.12, 'sawtooth', 0.10),
  death:   () => tone(220, 55,   0.60, 'sine',     0.22),
};

export function playSfx(name) {
  const fn = SFX[name];
  if (fn) fn();
}
