// Phase 2n-2 — Stewards' Codex modal renderer. Pulls the registry from
// input/hotkeys.ts and paints it into the codex modal frame defined in
// index.html. Bound to the `?` key in input/handlers.ts.

import { DOM_IDS } from '../core/dom';
import { HOTKEYS } from '../input/hotkeys';
import { openModal } from './modals';

export function openHotkeyLegend(): void {
  const content = document.getElementById(DOM_IDS.HOTKEY_CONTENT);
  if (content) {
    const rows = HOTKEYS.map(
      (h) => `
      <tr>
        <td class="keys">${h.keys.map((k) => `<kbd>${escapeHtml(k)}</kbd>`).join(' <span class="sep">/</span> ')}</td>
        <td class="label">${escapeHtml(h.label)}</td>
        <td class="desc">${escapeHtml(h.description)}</td>
      </tr>`
    ).join('');
    content.innerHTML = `<table class="hotkey-table"><tbody>${rows}</tbody></table>`;
  }
  openModal(DOM_IDS.HOTKEY_MODAL);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
