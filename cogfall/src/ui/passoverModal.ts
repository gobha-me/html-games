// Phase 2m hot-seat curtain modal.
//
// Sits between two human turns: when faction A ends their turn and the
// next faction is a different human B, the curtain blocks input + paints
// the canvas black until B clicks Continue. This is the "pass the keyboard
// to player B" gate.
//
// Contract is intentionally a Promise<void> so the same shape works for
// future PBEM (export-and-pass-file) and Plinth (network-handoff) modes —
// turn.ts's dispatchHandoff swaps the implementation, the rest of the
// engine doesn't care.
//
// G.playerFactionIdx is *not* advanced here. The caller (turn.ts) advances
// it after the Promise resolves so the visibility / fog recompute happens
// in one place and stays out of the curtain's responsibility.

import { DOM_IDS } from '../core/dom';
import { G } from '../core/state';
import { closeModal, openModal } from './modals';
import { clearAllUnitTweens } from '../render/unitTweens';
import type { Faction } from '../core/types';

let activeResolver: (() => void) | null = null;

/** Open the curtain for `next`, returning a Promise that resolves when the
 * Continue button is clicked. While the Promise is pending, G.passoverActive
 * is true and input handlers gate on it. */
export function openPassover(next: Faction): Promise<void> {
  return new Promise((resolve) => {
    G.passoverActive = true;
    // Don't bleed the previous player's last hover into player B's view
    // when the curtain comes down.
    G.hoveredHex = null;
    // Drop any AI tweens still in flight so player B doesn't see a
    // catchup-animation when the curtain comes down.
    clearAllUnitTweens();
    const titleEl = document.getElementById(DOM_IDS.PASSOVER_TITLE);
    const flavorEl = document.getElementById(DOM_IDS.PASSOVER_FLAVOR);
    const glyphEl = document.getElementById(DOM_IDS.PASSOVER_GLYPH);
    if (titleEl) {
      titleEl.textContent = `Pass to ${next.name}`;
      titleEl.style.color = next.color;
    }
    if (flavorEl) {
      flavorEl.textContent = `Step away. ${next.name}'s Steward sits.`;
    }
    if (glyphEl) {
      glyphEl.textContent = next.glyph;
      glyphEl.style.color = next.color;
    }
    activeResolver = resolve;
    openModal(DOM_IDS.PASSOVER_MODAL);
    // Defer focus to the next tick so the modal's .show class is applied
    // before focus moves — otherwise some browsers refuse focus on an
    // element inside a display:none subtree.
    setTimeout(() => {
      const btn = document.getElementById(DOM_IDS.PASSOVER_CONTINUE) as HTMLButtonElement | null;
      btn?.focus();
    }, 0);
  });
}

/** Snapshot of whether the curtain is currently up. Used by input/handlers
 * to gate canvas + keyboard while the previous player's POV is sheeted. */
export function isPassoverActive(): boolean {
  return G.passoverActive;
}

function continuePassover(): void {
  closeModal(DOM_IDS.PASSOVER_MODAL);
  G.passoverActive = false;
  const r = activeResolver;
  activeResolver = null;
  r?.();
}

document.getElementById(DOM_IDS.PASSOVER_CONTINUE)?.addEventListener('click', continuePassover);
