// Phase 2n-2 — keyboard shortcut registry (display metadata only).
//
// The actual keydown switch lives in input/handlers.ts; this module is
// the data the Stewards' Codex modal renders. Adding a new hotkey is a
// two-step: register the binding in handlers.ts AND add an entry here
// so it appears in the legend.
//
// Registry stays a pure data export (no DOM, no game-state reads) so
// tests can assert shape without spinning up jsdom modal markup.

export interface Hotkey {
  keys: string[];
  label: string;
  description: string;
}

export const HOTKEYS: Hotkey[] = [
  {
    keys: ['Space', 'Enter'],
    label: 'End turn',
    description:
      'Conclude your turn — AI factions act, then yours resumes.',
  },
  {
    keys: ['N'],
    label: 'Next unit',
    description:
      'Cycle to the next of your units that still has movement points.',
  },
  {
    keys: ['F'],
    label: 'Fortify',
    description:
      'Park the selected unit in place; it skips its turn for a small defense bump.',
  },
  {
    keys: ['T'],
    label: 'Threat range',
    description:
      'Toggle a tinted overlay marking hexes within visible enemy attack reach.',
  },
  {
    keys: ['Esc'],
    label: 'Close / deselect',
    description:
      'Closes the topmost modal, or clears the current unit / city / tile selection.',
  },
  {
    keys: ['?'],
    label: "Stewards' Codex",
    description: 'Open this list of keyboard shortcuts.',
  },
  {
    keys: ['`', '~'],
    label: 'Debug overlay',
    description:
      'Cycle visualization modes (elevation / ai / visibility / culture). Active only when the setup-modal Debug Overlay box is checked.',
  },
];
