import { PALETTE, alpha } from './palette.js';

// Shared geometry for street figures and press-pass portraits. Coordinates are
// relative to the feet; the art deliberately has no input/hit-test information.
export function drawSilhouette(ctx, role = 'reporter', { bob = 0, herald = false, goon = false } = {}) {
  ctx.save();
  ctx.fillStyle = alpha(PALETTE.nightInk, 0.65);
  ctx.beginPath();
  ctx.ellipse(19, 9, 31, 5, 0.35, 0, Math.PI * 2);
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
    ctx.fillRect(3, -23, 14, 9);
    ctx.fillStyle = PALETTE.nightInk;
    ctx.fillRect(7, -21, 6, 6);
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
