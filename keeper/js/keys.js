// Physical codes keep WASD stable across keyboard layouts. Each binding has one owner.
export const KEYS = Object.freeze({
  slow: Object.freeze(['ArrowLeft', 'KeyA']),
  fast: Object.freeze(['ArrowRight', 'KeyD']),
  hold: Object.freeze(['Space']),
  horn: Object.freeze(['KeyH']),
  lamp: Object.freeze(['KeyK']),
  log: Object.freeze(['KeyL']),
  pause: Object.freeze(['Escape', 'KeyP']),
  help: Object.freeze(['Slash']),
});
export const CONTROL_LABELS = Object.freeze({
  slow: '← / A · slow', fast: '→ / D · fast', hold: 'Space · hold',
  horn: 'H · horn', lamp: 'K · signal lamp', log: 'L · keeper’s log', pause: 'Esc / P · pause', help: '? · controls',
});
const actionsByCode = new Map();
for (const [action, codes] of Object.entries(KEYS)) {
  if (!Object.hasOwn(CONTROL_LABELS, action)) throw new Error(`Missing control label: ${action}`);
  for (const code of codes) {
    if (typeof code !== 'string' || !code || actionsByCode.has(code)) {
      throw new Error(`Invalid or duplicate control code: ${code}`);
    }
    actionsByCode.set(code, action);
  }
}
// Unknown codes and invalid values are unbound; never coerce caller input.
export function actionFor(code) {
  return typeof code === 'string' ? actionsByCode.get(code) : undefined;
}
export function heldInput(pressed) {
  if (!(pressed instanceof Set)) throw new TypeError('Pressed keys must be a Set of physical codes.');
  return Object.fromEntries(['slow', 'fast', 'hold', 'horn', 'lamp'].map((action) =>
    [action, KEYS[action].some((code) => pressed.has(code))]));
}
