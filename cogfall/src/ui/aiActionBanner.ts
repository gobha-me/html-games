// Phase 2n-2 — AI action banner. After each AI faction's turn, a
// non-blocking toast at the top of the screen lists the events that AI
// emitted to the player log (cities founded, combats, tech reveals,
// diplomacy, etc.) so the player can read what happened without
// scrolling the event log.
//
// Source data is G.events, snapshotted via core/log.ts's totalLogCount()
// before/after aiPlayTurn — so we don't need a new event schema or per-
// faction tagging on log entries.
//
// Replace-on-update: if a second AI's events arrive while the banner is
// still visible (back-to-back AI turns), the contents swap rather than
// queueing. The end-turn cadence already paces things; queuing felt
// laggy in practice.

import { DOM_IDS } from '../core/dom';
import type { Faction, LogEntry } from '../core/types';

const BANNER_DURATION_MS = 2500;
let dismissTimer: number | null = null;

export function showAiActionBanner(faction: Faction, events: LogEntry[]): void {
  if (events.length === 0) {
    hideBanner();
    return;
  }
  const banner = document.getElementById(DOM_IDS.AI_ACTION_BANNER);
  const heading = document.getElementById(DOM_IDS.AI_ACTION_BANNER_HEADING);
  const list = document.getElementById(DOM_IDS.AI_ACTION_BANNER_LIST);
  if (!banner || !heading || !list) return;
  heading.innerHTML = `<span class="glyph" style="color:${faction.color}">${escapeHtml(faction.glyph)}</span> ${escapeHtml(faction.name)}`;
  // G.events is unshifted (newest first). Reverse for chronological order
  // so the banner reads top-down as the AI turn unfolded.
  const inOrder = events.slice().reverse();
  list.innerHTML = inOrder
    .map((e) => `<div class="ai-action-line ${escapeHtml(e.type)}">${escapeHtml(e.msg)}</div>`)
    .join('');
  banner.classList.add('show');
  if (dismissTimer !== null) window.clearTimeout(dismissTimer);
  dismissTimer = window.setTimeout(hideBanner, BANNER_DURATION_MS);
}

export function hideBanner(): void {
  const banner = document.getElementById(DOM_IDS.AI_ACTION_BANNER);
  banner?.classList.remove('show');
  if (dismissTimer !== null) {
    window.clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Click-to-dismiss — registered at module load.
document.getElementById(DOM_IDS.AI_ACTION_BANNER)?.addEventListener('click', hideBanner);
