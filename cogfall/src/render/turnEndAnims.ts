// Phase 3 S4 — turn-end toast subscriber.
//
// Subscribes to the 'turnEnd' event from the animation bus and shows a
// brief banner at the top of the viewport ("Turn N — <Faction>") only
// when control hands to a human-controlled faction. AI-batch sub-turns
// still emit the event but the toast self-suppresses so the game stays
// snappy across long AI rotations.
//
// DOM-only — no Pixi state, no game-state mutation. Toast container is
// lazily appended to <body> on first event and reused afterward. Styles
// live in styles/main.css (#cogfall-turn-toast + .show class) so this
// module stays import-light.
//
// Decision-log item 10 in core/state.ts codifies the bus seam: don't
// import this from systems/turn.ts. systems/turn.ts emits; this listens.
//
// prefers-reduced-motion: when set, the text still updates (so the
// player gets the turn-change cue) but the visibility class is left off
// so there's no fade-in transition. Hidden via opacity:0; readers using
// screen readers can still parse the live text via aria-live.

import { on } from './animations';
import { G } from '../core/state';
import { prefersReducedMotion } from './motion';

const ELEMENT_ID = 'cogfall-turn-toast';
const VISIBLE_MS = 600;

let hideTimer: ReturnType<typeof setTimeout> | null = null;

function ensureToastEl(): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  let el = document.getElementById(ELEMENT_ID) as HTMLDivElement | null;
  if (el) return el;
  el = document.createElement('div');
  el.id = ELEMENT_ID;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  document.body.appendChild(el);
  return el;
}

export function subscribeTurnEndAnim(): void {
  on('turnEnd', (e) => {
    // Gate: only show when the faction whose turn just ended is human-
    // controlled. The AI batch path emits per-faction `turnEnd` too, and
    // we don't want a toast firing on every AI sub-turn.
    if (!G.humanFactionIdxs.includes(e.factionIdx)) return;
    // Suppress during the hot-seat curtain — the passover modal is the
    // turn-change cue in that flow.
    if (G.passoverActive) return;

    const fac = G.factions[e.factionIdx];
    if (!fac) return;

    const el = ensureToastEl();
    if (!el) return;

    el.textContent = `End of Turn ${e.turn} — ${fac.name}`;

    if (prefersReducedMotion()) {
      el.classList.remove('show');
      return;
    }

    el.classList.add('show');
    if (hideTimer !== null) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      el?.classList.remove('show');
      hideTimer = null;
    }, VISIBLE_MS);
  });
}
