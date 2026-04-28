// SVG overlay for movement and attack indicators. Painted on top of the
// canvas (CSS pointer-events: none) so it doesn't intercept clicks. Cleared
// and rewritten as innerHTML on each render — fast enough for the small
// number of indicators we ever show at once.

import { HEX_SIZE, hexToPixel } from '../core/hex';
import { DOM_IDS } from '../core/dom';
import { G } from '../core/state';

const svg = document.getElementById(DOM_IDS.OVERLAY_SVG) as SVGSVGElement | null;

export { svg };

const MOVE_INDICATOR_RADIUS = 0.3;
const ATTACK_INDICATOR_RADIUS = 0.45;
const ATTACK_GLYPH_SIZE = 18;
const SABOTAGE_INDICATOR_RADIUS = 0.45;
const SABOTAGE_GLYPH_SIZE = 18;

export function renderSVGOverlay(): void {
  if (!svg) return;
  let html = '';
  for (const t of G.moveTargets) {
    const { x, y } = hexToPixel(t.q, t.r);
    const px = x * G.zoom + G.cameraX;
    const py = y * G.zoom + G.cameraY;
    const r = HEX_SIZE * MOVE_INDICATOR_RADIUS * G.zoom;
    html += `<circle cx="${px}" cy="${py}" r="${r}" fill="rgba(78,205,196,0.5)" stroke="#4ecdc4" stroke-width="2"/>`;
  }
  for (const t of G.attackTargets) {
    const { x, y } = hexToPixel(t.q, t.r);
    const px = x * G.zoom + G.cameraX;
    const py = y * G.zoom + G.cameraY;
    const r = HEX_SIZE * ATTACK_INDICATOR_RADIUS * G.zoom;
    html += `<circle cx="${px}" cy="${py}" r="${r}" fill="rgba(212,74,58,0.4)" stroke="#d44a3a" stroke-width="3"/>`;
    html += `<text x="${px}" y="${py + 6}" text-anchor="middle" font-size="${
      ATTACK_GLYPH_SIZE * G.zoom
    }" fill="#f4e4bc" font-family="serif">⚔</text>`;
  }
  for (const t of G.sabotageTargets) {
    const { x, y } = hexToPixel(t.q, t.r);
    const px = x * G.zoom + G.cameraX;
    const py = y * G.zoom + G.cameraY;
    const r = HEX_SIZE * SABOTAGE_INDICATOR_RADIUS * G.zoom;
    html += `<circle cx="${px}" cy="${py}" r="${r}" fill="rgba(160,96,224,0.35)" stroke="#a060e0" stroke-width="3" stroke-dasharray="6 3"/>`;
    html += `<text x="${px}" y="${py + 6}" text-anchor="middle" font-size="${
      SABOTAGE_GLYPH_SIZE * G.zoom
    }" fill="#f4e4bc" font-family="serif">ƒ</text>`;
  }
  svg.innerHTML = html;
}
