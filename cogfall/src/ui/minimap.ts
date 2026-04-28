// Phase 2h-2 minimap. A small canvas hugging the bottom-right of the screen,
// painted from the same render hook as the main map. Shows seen+visible
// tiles in terrain color, an owner-tint overlay, cities as bright dots, and
// the current camera viewport as a thin rectangle. Click anywhere on the
// minimap to recenter the main camera.
//
// All math fits inside a single render pass; no OffscreenCanvas, no caching.
// Map sizes top out near 1200 tiles, so a from-scratch repaint per turn-end
// or click is in the sub-millisecond range and not worth the complexity.

import { DOM_IDS } from '../core/dom';
import { HEX_SIZE, hexToPixel, SQRT3 } from '../core/hex';
import { G } from '../core/state';
import { canvas as mapCanvas, render } from '../render/canvas';
import { TERRAIN_TYPES } from '../data/terrain';

const MINIMAP_TOGGLE_KEY = 'cogfall:ui:minimap';

const minimap = document.getElementById(DOM_IDS.MINIMAP) as HTMLCanvasElement | null;
const mctx = minimap?.getContext('2d') ?? null;

// Approx world-pixel half-extent of one hex (pointy-top with HEX_SIZE = 30).
// Used to grow the world bounding box so the outermost tiles render fully.
const HEX_HALF = HEX_SIZE * SQRT3 * 0.5;

let visible = readToggle();
applyVisibility();

export function isMinimapVisible(): boolean {
  return visible;
}

export function setMinimapVisible(b: boolean): void {
  visible = b;
  applyVisibility();
  writeToggle();
  if (visible) renderMinimap();
}

export function renderMinimap(): void {
  if (!minimap || !mctx || !visible || !G.map) return;

  const W = minimap.width;
  const H = minimap.height;
  mctx.clearRect(0, 0, W, H);

  const transform = computeTransform(W, H);
  if (!transform) return;
  const { sx, sy, scale } = transform;

  const playerIdx = G.playerFactionIdx;
  const tilePx = Math.max(1, Math.ceil(scale * HEX_SIZE * SQRT3));
  const halfTile = tilePx / 2;

  for (const tile of G.map.tiles.values()) {
    const v = tile.visibility[playerIdx];
    if (!v || v === 'unseen') continue;
    const wp = hexToPixel(tile.q, tile.r);
    const x = (wp.x + sx) * scale - halfTile;
    const y = (wp.y + sy) * scale - halfTile;
    const tt = TERRAIN_TYPES[tile.terrain];
    mctx.fillStyle = tt.color;
    if (v === 'seen') mctx.globalAlpha = 0.55;
    mctx.fillRect(x, y, tilePx, tilePx);
    mctx.globalAlpha = 1;

    if (tile.owner != null) {
      const fac = G.factions[tile.owner];
      mctx.fillStyle = fac.color;
      mctx.globalAlpha = v === 'seen' ? 0.25 : 0.4;
      mctx.fillRect(x, y, tilePx, tilePx);
      mctx.globalAlpha = 1;
    }
  }

  // Cities: small bright dot in faction color. Drawn on top of the terrain
  // grid so even a player-occupied city pops out at minimap scale.
  for (const c of G.cities) {
    const t = G.map.tiles.get(`${c.q},${c.r}` as `${number},${number}`);
    if (!t) continue;
    const v = t.visibility[playerIdx];
    if (!v || v === 'unseen') continue;
    const wp = hexToPixel(c.q, c.r);
    const x = (wp.x + sx) * scale;
    const y = (wp.y + sy) * scale;
    const fac = G.factions[c.factionIdx];
    mctx.fillStyle = fac.color;
    mctx.beginPath();
    mctx.arc(x, y, c.isCapital ? 2.6 : 1.8, 0, Math.PI * 2);
    mctx.fill();
  }

  // Camera viewport rect. Convert main-canvas world bounds → minimap pixels.
  const wLeft = -G.cameraX / G.zoom;
  const wTop = -G.cameraY / G.zoom;
  const wRight = wLeft + mapCanvas.width / G.zoom;
  const wBottom = wTop + mapCanvas.height / G.zoom;
  const rx = (wLeft + sx) * scale;
  const ry = (wTop + sy) * scale;
  const rw = (wRight - wLeft) * scale;
  const rh = (wBottom - wTop) * scale;
  mctx.strokeStyle = '#f4e4bc';
  mctx.lineWidth = 1;
  mctx.strokeRect(
    Math.max(0, rx),
    Math.max(0, ry),
    Math.min(W, rw),
    Math.min(H, rh)
  );
}

function computeTransform(W: number, H: number): { sx: number; sy: number; scale: number } | null {
  if (!G.map) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const tile of G.map.tiles.values()) {
    const p = hexToPixel(tile.q, tile.r);
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return null;
  // Pad bounds by half a hex so edge tiles fully appear.
  minX -= HEX_HALF;
  maxX += HEX_HALF;
  minY -= HEX_SIZE;
  maxY += HEX_SIZE;
  const worldW = maxX - minX;
  const worldH = maxY - minY;
  const padding = 4;
  const innerW = W - padding * 2;
  const innerH = H - padding * 2;
  const scale = Math.min(innerW / worldW, innerH / worldH);
  // Center within the inner box.
  const drawnW = worldW * scale;
  const drawnH = worldH * scale;
  const offsetX = padding + (innerW - drawnW) / 2;
  const offsetY = padding + (innerH - drawnH) / 2;
  // sx/sy translate world → minimap-pre-scale; multiply by scale to get pixels.
  // Final formula: minimapPx = (worldX + sx) * scale, where sx encodes both
  // the world-min offset and the centering padding (after dividing by scale).
  const sx = -minX + offsetX / scale;
  const sy = -minY + offsetY / scale;
  return { sx, sy, scale };
}

function applyVisibility(): void {
  if (!minimap) return;
  minimap.classList.toggle('hidden', !visible);
}

function readToggle(): boolean {
  try {
    const v = localStorage.getItem(MINIMAP_TOGGLE_KEY);
    if (v === null) return true;
    return v === '1';
  } catch {
    return true;
  }
}

function writeToggle(): void {
  try {
    localStorage.setItem(MINIMAP_TOGGLE_KEY, visible ? '1' : '0');
  } catch {
    // localStorage disabled (private mode); silently keep in-memory state.
  }
}

// Click-to-pan. Convert minimap pixel back to world pixel using the inverse
// of computeTransform, then point the camera so the clicked world point lands
// at the center of the main canvas.
minimap?.addEventListener('click', (e) => {
  if (!G.map) return;
  const rect = minimap.getBoundingClientRect();
  const mx = ((e.clientX - rect.left) / rect.width) * minimap.width;
  const my = ((e.clientY - rect.top) / rect.height) * minimap.height;
  const t = computeTransform(minimap.width, minimap.height);
  if (!t) return;
  const worldX = mx / t.scale - t.sx;
  const worldY = my / t.scale - t.sy;
  G.cameraX = mapCanvas.width / 2 - worldX * G.zoom;
  G.cameraY = mapCanvas.height / 2 - worldY * G.zoom;
  render();
  renderMinimap();
});
