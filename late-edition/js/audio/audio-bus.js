// Late Edition — audio bus (ICD-07 v0.1 first caller, v1.3.0).
//
// Routes WorldFrame.effects[] FxEvents to channel-tagged cues per the
// cue table. Sim emits FxEvent kinds (pickup / verify / print / ...);
// the bus translates kinds → cue ids per the table and forwards to an
// injected Player. The bus never names a cue id outside the cue table,
// and never imports HTMLAudioElement — that lives in html-audio-player.js
// so this module stays Node-importable for tests.
//
// Browser autoplay policy: the bus starts locked. consumeEffects is a
// silent no-op until unlock() fires. The wire-up at js/input.js calls
// unlock() on the first user pointer/key event (idempotent).
//
// v1.3.0 scope per ICD-07 §Subscriber-expectations:
//   - sfx channel only (the three recorded SFX cues); ambient/music/vo
//     wait on Supplement-C recording.
//   - ducking is unimplemented (no overlapping channels yet).
//   - CYCLE_GAME_OVER press-silence beat is deferred (no AMB-04/05
//     cue to mute). The mute(channel?) primitive ships so the second
//     caller can wire the listener as a one-liner.

import { CUE_TABLE } from './cue-table.js';

export class AudioBus {
  constructor(player, cueTable = CUE_TABLE) {
    this.player = player;
    this.cueTable = cueTable;
    this.unlocked = false;
  }

  // Preload every cue at boot so the first trigger has zero latency.
  // Returns whatever the player returns (a Promise.all or void) so the
  // caller can await preload if it wants; v1.3.0 does not.
  loadAll() {
    const loads = [];
    for (const entry of Object.values(this.cueTable)) {
      loads.push(this.player.loadCue(entry.id, entry.path));
    }
    return loads;
  }

  // Idempotent — flips the gate. Browser autoplay policy requires a user
  // gesture before HTMLAudioElement.play() will resolve; until that
  // gesture fires the bus must be silent.
  unlock() {
    this.unlocked = true;
  }

  // Drains the per-frame FxEvent[] into the player. Sim → renderer
  // already iterates the same array (renderer.js _consumeEffects);
  // the bus reads after the renderer in main.js so they stay in
  // lockstep on missed events (pre-existing snapshot-drain hazard at
  // js/main.js — affects both equally, not this milestone to fix).
  consumeEffects(events) {
    if (!this.unlocked) return;
    if (!events || events.length === 0) return;
    for (const ev of events) {
      const cue = this.cueTable[ev.kind];
      if (!cue) continue;
      this.player.playCue(cue.id, cue.channel);
    }
  }

  // Channel-scoped mute primitive. v1.3.0 has no caller (no AMB beds
  // recorded), but the second caller (press-silence beat) is one line.
  // channel = undefined → mute everything (master mute).
  mute(channel) {
    this.player.setMuted(true, channel);
  }

  unmute(channel) {
    this.player.setMuted(false, channel);
  }
}
