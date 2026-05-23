// Late Edition — HTMLAudioElement Player implementation (ICD-07 v1.3.0).
//
// The default browser-side audio engine. Implements the Player interface
// AudioBus expects:
//   loadCue(id, path)                — preload an asset
//   playCue(id, channel)             — fire a one-shot
//   setMuted(muted, channel?)        — mute one channel or all
//
// Vanilla HTMLAudioElement, no AudioContext, no external library. Three
// recorded SFX one-shots don't need real-time mixing; engine choice is
// reversible at the Player seam once AMB/MUS land and ducking matters
// (swap in a WebAudioPlayer behind the same interface — bus unchanged).
//
// Pool pattern: each cue holds a small ring of preloaded elements so
// rapid re-triggers don't fight over a single element. Safari's
// `currentTime = 0` re-trigger stalls intermittently; cloneNode-on-demand
// avoids the stall and keeps preloaded data shared.

const POOL_SIZE = 3;

export class HTMLAudioPlayer {
  constructor() {
    // id → { template: HTMLAudioElement, pool: HTMLAudioElement[], next: number, channel: string }
    this.cues = new Map();
    // channel → boolean (false = audible, true = muted). Lazy default audible.
    this.muted = new Map();
    this.masterMuted = false;
  }

  loadCue(id, path) {
    if (this.cues.has(id)) return;
    const template = new Audio(path);
    template.preload = 'auto';
    const pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      pool.push(template.cloneNode());
    }
    this.cues.set(id, { template, pool, next: 0, channel: null });
  }

  playCue(id, channel) {
    const entry = this.cues.get(id);
    if (!entry) return;
    entry.channel = channel;
    if (this._isMuted(channel)) return;
    const el = entry.pool[entry.next];
    entry.next = (entry.next + 1) % entry.pool.length;
    try {
      el.currentTime = 0;
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => { /* autoplay or user-gesture failure — drop silently */ });
    } catch (_e) {
      // Safari can throw on play() before user gesture; swallow.
    }
  }

  setMuted(muted, channel) {
    if (channel === undefined) {
      this.masterMuted = muted;
    } else {
      this.muted.set(channel, muted);
    }
  }

  // 1.4.0: getter symmetric with setMuted. The settings popover reads the
  // current state to render the toggle, then writes via setMuted on click;
  // exposing the read half here keeps the player interface uniform without
  // forcing the bus or the UI to track a mirror copy of the state.
  getMuted(channel) {
    if (channel === undefined) return this.masterMuted;
    return this.muted.get(channel) === true;
  }

  _isMuted(channel) {
    if (this.masterMuted) return true;
    return this.muted.get(channel) === true;
  }
}
