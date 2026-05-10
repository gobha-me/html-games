// Phase 3 S4 — tech-unlock pop subscriber.
//
// Subscribes to 'techComplete' from the animation bus and shows a brief
// "Discovery: <Tech>" pop in the center of the viewport when the local
// player's faction(s) finishes a tech. Other factions' tech completions
// stay silent — otherwise the screen would flash on every AI research
// tick in a long game.
//
// DOM-only and lazy: the pop element is appended to <body> on first use.
// Styles in main.css; no Pixi or game-state side effects. prefers-
// reduced-motion gates the fade/scale class; the underlying text still
// updates so the screen reader path keeps working.

import { on } from './animations';
import { G } from '../core/state';
import { TECHS } from '../data/techs';
import { prefersReducedMotion } from './motion';

const ELEMENT_ID = 'cogfall-tech-pop';
const VISIBLE_MS = 1200;

let hideTimer: ReturnType<typeof setTimeout> | null = null;

function ensurePopEl(): HTMLDivElement | null {
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

export function subscribeTechCompleteAnim(): void {
  on('techComplete', (e) => {
    if (!G.humanFactionIdxs.includes(e.factionIdx)) return;
    if (G.passoverActive) return;

    const tech = TECHS[e.techId];
    if (!tech) return;

    const el = ensurePopEl();
    if (!el) return;

    el.textContent = `Discovery: ${tech.name}`;

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
