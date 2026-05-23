// Late Edition — audio cue table (ICD-07 §FxEvent ↔ SFX cue-table).
// Maps WorldFrame.effects[].kind → { id, channel, path }. The v1.3.0 first
// caller ships the three Supplement-C cues already recorded against the
// venice.ai workflow (2026-05-22): SFX-01 typewriter on pickup, SFX-05
// camera shutter on verify, SFX-07 press fires on print.
//
// The §FxEvent-cue-table at ICD-07 lines 121-128 lists the *aspirational*
// mapping (SFX-02 for verify, SFX-06 for print, plus SFX-08..10 / SFX-14
// for death/raid that are unrecorded). ICD-07 line 130 explicitly pins
// the deviation policy: "cue ids may shift as the Supplement-C catalog
// is recorded; the channels and trigger sites are locked." This table
// honors the channel commitments and binds to whichever subset is
// recorded — a §Notes addendum in ICD-07 acknowledges the v1.3.0 binding.
// When SFX-08..10 / SFX-14 record, the death / raid_warning rows append
// here without an ICD bump.
//
// Unknown FxEvent.kind values map to undefined; AudioBus.consumeEffects
// treats undefined as a silent pass-through.

export const CUE_TABLE = Object.freeze({
  pickup: Object.freeze({ id: 'SFX-01', channel: 'sfx', path: 'assets/audio/SFX-01-reporter-dispatched.mp3' }),
  verify: Object.freeze({ id: 'SFX-05', channel: 'sfx', path: 'assets/audio/SFX-05-camera-shutter.mp3' }),
  print:  Object.freeze({ id: 'SFX-07', channel: 'sfx', path: 'assets/audio/SFX-07-press-fires.mp3' }),
});
