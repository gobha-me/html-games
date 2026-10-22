// #88: the sole source of canvas colors; keep in sync with CSS :root.
export const PALETTE = Object.freeze({
  'nightInk': '#0E0D0C',
  'mahogany': '#2A1710',
  'smoke': '#6B655C',
  'newsprint': '#EDE4CE',
  'newsprintAged': '#D9CBA8',
  'sodium': '#E8A23A',
  'brass': '#B5893F',
  'stampRed': '#A3221B',
  'telegram': '#EAD58A',
  'policeBlue': '#3E5A78'
});

// Relative colors preserve the art tokens, including translucent canvas effects.
export const alpha = (color, opacity) =>
  `color-mix(in srgb, ${color} ${Math.max(0, Math.min(1, opacity)) * 100}%, transparent)`;
