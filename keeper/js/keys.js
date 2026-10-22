// Physical codes keep WASD stable across keyboard layouts. Each binding has one owner.
export const KEYS = Object.freeze({
  slow: ['ArrowLeft', 'KeyA'],
  fast: ['ArrowRight', 'KeyD'],
  hold: ['Space'],
  horn: ['KeyH'],
  pause: ['Escape', 'KeyP'],
  help: ['Slash'],
});
export const CONTROL_LABELS = Object.freeze({
  slow: '← / A · slow', fast: '→ / D · fast', hold: 'Space · hold',
  horn: 'H · horn', pause: 'Esc / P · pause', help: '? · controls',
});
export function actionFor(code) {
  return Object.keys(KEYS).find((action) => KEYS[action].includes(code));
}
export function heldInput(pressed) {
  return Object.fromEntries(['slow', 'fast', 'hold', 'horn'].map((action) =>
    [action, KEYS[action].some((code) => pressed.has(code))]));
}
