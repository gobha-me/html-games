// Late Edition — diegetic tutorial beat derivation (milestone 0.10.1, G-09).
//
// Pure module. Reads a WorldFrame, returns which "old man's note" should be
// pinned to the corkboard right now. No persistence — the beat re-derives
// every frame from authoritative state, so a mid-tutorial save/load lands
// on the correct note without an ICD-04 bump.
//
// Spine settled in discussion/tutorial-first-edition.md (committed direction,
// settled at the post-0.6 re-eval §3.5 Q3):
//
//   1. "Send a reporter to The Docks, kid."           — fresh edition 1
//   2. "That's a lead. Send it down to the darkroom." — reporter carrying lead
//   3. "Now plate it. Press goes at 6."               — verified at darkroom
//   4. "Welcome to the paper."                        — first 30 s of edition 2
//
// Beat 1 carries the control-hint paren — G-09 couples to G-07 because the
// note is the only diegetic surface that tells the player WASD / [ / ] / Space
// exist (the masthead lists them too but that's chrome). After edition 2's
// welcome window the tutorial card hides forever.
//
// Edition 1 ordering: a reporter holding a lead reads as 'verify' even if
// stories>0 elsewhere (e.g. a second lead already at the darkroom) — the
// active carry is the player's current verb. stories>0 with no carry means
// the verified story is waiting at the darkroom for plating.
//
// Welcome window: edition===2 AND deadline_ms > (12min - 30s) → first 30 s
// only. Long enough to read; short enough that the tutorial card vacates
// the corkboard before the player engages edition 2's gameplay.
//
// 0.10.1 ships against ICD-01 v0.6.1 with no bumps. All inputs are existing
// WorldFrame fields: hud.edition, hud.deadline_ms, hud.resources.stories,
// units[].kind/carrying.

export const TUTORIAL_BEATS = ['send-reporter', 'verify', 'plate', 'welcome'];

export const BEAT_COPY = {
  'send-reporter':
    'Send a reporter to The Docks, kid. ' +
    '(WASD pans · [ ] zoom · Space slows time)',
  'verify':
    "That's a lead. Send it down to the darkroom to verify it.",
  'plate':
    'Now plate it. Press goes at 6.',
  'welcome':
    'Welcome to the paper.',
};

// Edition 2 welcome shows while remaining > (FULL - WELCOME_WINDOW_MS).
// FULL is the cycle length carried into deadline_ms at CYCLE_BEGIN; we don't
// import CYCLE_FULL_MS to stay decoupled from sim/cycle-clock, so the threshold
// is expressed as "below this remaining we're past the welcome window".
const WELCOME_WINDOW_MS = 30_000;
const CYCLE_FULL_MS = 12 * 60 * 1000;

export function currentTutorialBeat(frame) {
  const edition = frame.hud.edition;
  if (edition >= 3) return null;
  if (edition === 2) {
    return frame.hud.deadline_ms > CYCLE_FULL_MS - WELCOME_WINDOW_MS
      ? 'welcome'
      : null;
  }

  // Edition 1.
  const reporterCarrying = frame.units.some(
    (u) => u.kind === 'reporter' && u.carrying === 'lead',
  );
  if (reporterCarrying) return 'verify';
  if (frame.hud.resources.stories > 0) return 'plate';
  return 'send-reporter';
}
