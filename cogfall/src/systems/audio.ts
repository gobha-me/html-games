// Phase 2h-3 SFX. Procedural Web Audio synthesis only — no committed audio
// assets. Four short envelopes for the moments that mattered enough to log
// loud: end-of-turn, build complete, combat hit, victory. Lazy AudioContext
// init dodges the browser autoplay policy: nothing plays until the player
// interacts (a click, key, etc.) and triggers the first sound.
//
// All callers go through playSfx(). The implementation tolerates missing
// AudioContext (jsdom test env, ancient browsers) and a muted state by
// returning early; we still record the event in `sfxLog` so tests can
// verify trigger sites without touching the audio backend.

const MUTE_KEY = 'cogfall:audio:muted';

export type SfxEvent = 'endTurn' | 'buildComplete' | 'combatHit' | 'victory';

let ctx: AudioContext | null = null;
let muted = readMute();
const sfxLog: SfxEvent[] = [];

export function isAudioMuted(): boolean {
  return muted;
}

export function setAudioMuted(b: boolean): void {
  muted = b;
  try {
    localStorage.setItem(MUTE_KEY, b ? '1' : '0');
  } catch {
    // localStorage unavailable; keep in-memory state.
  }
}

export function playSfx(name: SfxEvent): void {
  sfxLog.push(name);
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  switch (name) {
    case 'endTurn':
      envelopeOsc(c, 'sine', 220, 180, 0.08, 0.18);
      return;
    case 'buildComplete':
      envelopeOsc(c, 'square', 440, 660, 0.12, 0.1);
      return;
    case 'combatHit':
      noiseBurst(c, 0.03, 0.18);
      return;
    case 'victory':
      arpeggio(c, [261.63, 329.63, 392.0], 0.13, 0.18);
      return;
  }
}

/** Test helper — returns a snapshot of the SfxEvent log. Production callers
 * should not depend on this; it exists so unit tests can verify that each
 * trigger site fires the right event without instantiating a real
 * AudioContext. */
export function getRecentSfxEvents(): readonly SfxEvent[] {
  return sfxLog.slice();
}

/** Test helper — wipes the log so each test starts from an empty state. */
export function clearSfxLog(): void {
  sfxLog.length = 0;
}

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const w = window as Window &
    typeof globalThis & {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

function envelopeOsc(
  c: AudioContext,
  type: OscillatorType,
  fStart: number,
  fEnd: number,
  dur: number,
  volume: number
): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(fStart, c.currentTime);
  osc.frequency.linearRampToValueAtTime(fEnd, c.currentTime + dur);
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(volume, c.currentTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime);
  osc.stop(c.currentTime + dur + 0.02);
}

function noiseBurst(c: AudioContext, dur: number, volume: number): void {
  const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, c.currentTime);
  src.connect(gain).connect(c.destination);
  src.start(c.currentTime);
}

function arpeggio(c: AudioContext, freqs: number[], noteDur: number, volume: number): void {
  for (let i = 0; i < freqs.length; i++) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    const t0 = c.currentTime + i * noteDur;
    osc.frequency.setValueAtTime(freqs[i], t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + noteDur);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + noteDur + 0.02);
  }
}

function readMute(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}
