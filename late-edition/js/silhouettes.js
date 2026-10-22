import { PALETTE, alpha } from './palette.js';

export const FIGURE_SCALE = 1.6 * 1.4;
export const MARKER_SCALE = 1.4;

// Includes coat, camera/flash, badge, stroke and the full walking-bob range.
// The cast shadow is street decoration, not part of the opaque figure box.
export const figureBox = (x, y) => ({ x: x - 21 * FIGURE_SCALE,
  y: y - 43 * FIGURE_SCALE, w: 42 * FIGURE_SCALE, h: 49 * FIGURE_SCALE });

// Shared geometry for street figures and press-pass portraits. Coordinates are
// relative to the feet; the art deliberately has no input/hit-test information.
export function drawSilhouette(ctx, role = 'reporter', { bob = 0, herald = false, goon = false } = {}) {
  ctx.save();
  ctx.fillStyle = alpha(PALETTE.nightInk, 0.65);
  ctx.beginPath();
  ctx.moveTo(-7, 0); ctx.lineTo(7, 0);
  ctx.lineTo(64, 19); ctx.lineTo(57, 24); ctx.lineTo(4, 4);
  ctx.closePath();
  ctx.fill();
  ctx.translate(0, bob);
  const broad = role === 'fixer' || goon;
  ctx.fillStyle = PALETTE.nightInk;
  ctx.strokeStyle = PALETTE.smoke;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, -27);
  ctx.lineTo(broad ? -14 : -10, -21);
  ctx.lineTo(-12, -3);
  ctx.lineTo(-5, -3);
  ctx.lineTo(-4, 3);
  ctx.lineTo(-1, 3);
  ctx.lineTo(1, -4);
  ctx.lineTo(4, 3);
  ctx.lineTo(7, 3);
  ctx.lineTo(6, -3);
  ctx.lineTo(12, -3);
  ctx.lineTo(broad ? 14 : 10, -21);
  ctx.lineTo(5, -27);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.smoke;
  ctx.fillRect(-4, -33, 8, 7);
  ctx.fillStyle = herald ? PALETTE.brass : PALETTE.nightInk;
  ctx.fillRect(-7, -39, 13, 7);
  ctx.fillRect(-12, -33, 24, 3);
  ctx.fillStyle = PALETTE.brass;
  ctx.fillRect(-6, -35, 11, 1);
  if (role === 'photographer') {
    ctx.fillStyle = PALETTE.smoke;
    ctx.fillRect(2, -24, 17, 12);
    ctx.fillRect(5, -28, 5, 4);
    ctx.fillStyle = PALETTE.nightInk;
    ctx.fillRect(8, -22, 9, 8);
    ctx.fillStyle = PALETTE.newsprintAged;
    ctx.fillRect(10, -20, 4, 4);
    ctx.fillStyle = PALETTE.newsprintAged;
    ctx.beginPath();
    ctx.arc(16, -29, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (goon) {
    ctx.fillStyle = PALETTE.stampRed;
    ctx.fillRect(6, -28, 2, 2);
  }
  ctx.restore();
}
