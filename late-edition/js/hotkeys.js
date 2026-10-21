// Application shortcuts, using lower-case KeyboardEvent.key values. Native
// Tab/Enter/Space activation on focused controls stays with the browser; modal
// activation/focus are intercepted explicitly. Overlay phases replace desk keys.
// Keep bindings as entries: an object keyed by key would silently hide duplicates.
export const HOTKEYS = [
  { action: 'start-shift', keys: ['enter'], phases: ['title'] },
  { action: 'skip-intro', keys: ['escape'], phases: ['cold-open'] },
  { action: 'toggle-drawer', keys: ['d'], phases: ['desk', 'paste-up', 'drawer-open'] },
  { action: 'close-drawer', keys: ['escape'], phases: ['drawer-open'] },
  { action: 'focus-modal', keys: ['tab'], phases: ['modal'] },
  { action: 'activate-modal', keys: ['enter', ' '], phases: ['modal'] },
  { action: 'cancel-drag', keys: ['escape'], phases: ['paste-up'] },
  { action: 'next-story', keys: ['arrowdown', 'arrowright'], phases: ['paste-up'] },
  { action: 'previous-story', keys: ['arrowup', 'arrowleft'], phases: ['paste-up'] },
  { action: 'place:banner', keys: ['1', 'b'], phases: ['paste-up'] },
  { action: 'place:above_fold', keys: ['2', 'f'], phases: ['paste-up'] },
  { action: 'place:photo_expose', keys: ['3', 'p'], phases: ['paste-up'] },
  { action: 'place:editorial', keys: ['4', 'e'], phases: ['paste-up'] },
  { action: 'place:inside', keys: ['5', 'i'], phases: ['paste-up'] },
  { action: 'place:spike', keys: ['6', 's'], phases: ['paste-up'] },
  { action: 'unplace', keys: ['u', 'delete'], phases: ['paste-up'] },
  { action: 'select-operative:0', keys: ['1'], phases: ['desk'] },
  { action: 'select-operative:1', keys: ['2'], phases: ['desk'] },
  { action: 'select-operative:2', keys: ['3'], phases: ['desk'] },
  { action: 'select-operative:3', keys: ['4'], phases: ['desk'] },
  { action: 'fortify', keys: ['e'], phases: ['desk'] },
  { action: 'pause', keys: ['p'], phases: ['desk'] },
  { action: 'lock-up', keys: ['l'], phases: ['desk', 'paste-up'] },
  { action: 'assist', keys: ['a'], phases: ['desk', 'paste-up'] },
  { action: 'wiretap', keys: ['q'], phases: ['desk', 'paste-up'] },
  { action: 'bribe', keys: ['w'], phases: ['desk', 'paste-up'] },
  { action: 'phone', keys: ['t'], phases: ['desk', 'paste-up'] },
  { action: 'accept-dilemma', keys: ['y'], phases: ['desk', 'paste-up'] },
  { action: 'reject-dilemma', keys: ['n'], phases: ['desk', 'paste-up'] },
  { action: 'mute', keys: ['m'], phases: ['desk', 'paste-up'] },
  { action: 'publish', keys: [' '], phases: ['desk', 'paste-up'] },
];

export function hotkeyAction(phase, key) {
  return HOTKEYS.find((binding) => binding.phases.includes(phase) && binding.keys.includes(key.toLowerCase()))?.action;
}
