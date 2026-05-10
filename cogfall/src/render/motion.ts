// Phase 3 S4 — accessibility helper for the animation subscribers.
//
// Every render-side subscriber that schedules a timed animation reads this
// before doing any visual work. When the OS reports prefers-reduced-motion,
// subscribers no-op (or fall through to an instant text update) so the
// game stays playable for users who can't tolerate motion. Read each call
// — the user can flip the OS setting mid-session and we want it to take
// effect on the next event without a reload.

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  return mql?.matches === true;
}
