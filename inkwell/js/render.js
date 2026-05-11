import {
  CELL,
  CANVAS_W,
  CANVAS_H,
  TILE,
  KIND,
  PALETTE,
  FONT_GLYPH,
} from './constants.js';
import { tileAt } from './map.js';

const KIND_COLOR = {
  [KIND.PLAYER]: PALETTE.player,
  [KIND.DRIP]:   PALETTE.drip,
  [KIND.SMEAR]:  PALETTE.smear,
  [KIND.SCRAWL]: PALETTE.scrawl,
  [KIND.STAIRS]: PALETTE.stairs,
};

function colorForKind(kind) {
  return KIND_COLOR[kind] || PALETTE.ink;
}

let _ctx = null;
let _bgPattern = null;

export function init(canvas) {
  _ctx = canvas.getContext('2d');
  _ctx.imageSmoothingEnabled = false;
  _bgPattern = buildParchmentPattern();
}

export function render(state) {
  const ctx = _ctx;
  if (!ctx) return;
  ctx.fillStyle = PALETTE.parchment;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  if (_bgPattern) {
    ctx.fillStyle = _bgPattern;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  const camera = computeCamera(state);
  drawTiles(ctx, state, camera);
  drawEntities(ctx, state, camera);
  drawAnimations(ctx, state, camera);
  drawVignette(ctx);
}

function computeCamera(state) {
  const viewCols = Math.floor(CANVAS_W / CELL);
  const viewRows = Math.floor(CANVAS_H / CELL);
  const cx = clamp(state.player.x - Math.floor(viewCols / 2), 0, Math.max(0, state.page.width - viewCols));
  const cy = clamp(state.player.y - Math.floor(viewRows / 2), 0, Math.max(0, state.page.height - viewRows));
  return { x: cx, y: cy, cols: viewCols, rows: viewRows };
}

function drawTiles(ctx, state, cam) {
  for (let row = 0; row < cam.rows; row++) {
    for (let col = 0; col < cam.cols; col++) {
      const mx = col + cam.x;
      const my = row + cam.y;
      const t = tileAt(state.page, mx, my);
      const px = col * CELL;
      const py = row * CELL;
      if (t === TILE.FLOOR) {
        const shade = (mx * 7 + my * 13) % 5 === 0;
        ctx.fillStyle = shade ? PALETTE.floorShade : PALETTE.floor;
        ctx.fillRect(px, py, CELL, CELL);
      } else if (t === TILE.WALL) {
        ctx.fillStyle = PALETTE.wallInk;
        ctx.fillRect(px, py, CELL, CELL);
        if ((mx * 3 + my * 5) % 7 === 0) {
          ctx.fillStyle = PALETTE.wallStain;
          ctx.fillRect(px + 2, py + 2, CELL - 4, CELL - 4);
        }
      } else {
        ctx.fillStyle = PALETTE.parchmentDeep;
        ctx.fillRect(px, py, CELL, CELL);
      }
    }
  }
}

function drawEntities(ctx, state, cam) {
  ctx.font = FONT_GLYPH;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  for (const e of state.entities) {
    if (!e.alive) continue;
    paintGlyph(ctx, e, cam, colorForKind(e.kind));
  }
  if (state.player.alive) {
    paintGlyph(ctx, state.player, cam, PALETTE.player);
  }
}

function paintGlyph(ctx, e, cam, color) {
  const px = (e.x - cam.x) * CELL;
  const py = (e.y - cam.y) * CELL;
  if (px < -CELL || py < -CELL || px > CANVAS_W || py > CANVAS_H) return;
  ctx.fillStyle = 'rgba(20, 14, 8, 0.18)';
  ctx.beginPath();
  ctx.ellipse(px + CELL / 2, py + CELL / 2 + 2, CELL / 2.2, CELL / 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(e.glyph, px + CELL / 2, py + CELL / 2 + 1);
}

function drawAnimations(ctx, state, cam) {
  if (!state.animations.length) return;
  const keep = [];
  for (const a of state.animations) {
    const age = state.turn - a.turn;
    if (age > 1) continue;
    if (a.type === 'strike') {
      const px = (a.x - cam.x) * CELL + CELL / 2;
      const py = (a.y - cam.y) * CELL + CELL / 2;
      ctx.fillStyle = PALETTE.blood;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(px, py, CELL * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      keep.push(a);
    }
  }
  state.animations = keep;
}

function drawVignette(ctx) {
  const grad = ctx.createRadialGradient(
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.4,
    CANVAS_W / 2, CANVAS_H / 2, CANVAS_H * 0.9,
  );
  grad.addColorStop(0, 'rgba(40,28,12,0)');
  grad.addColorStop(1, 'rgba(40,28,12,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function buildParchmentPattern() {
  const off = document.createElement('canvas');
  off.width = 64;
  off.height = 64;
  const c = off.getContext('2d');
  c.fillStyle = 'rgba(0,0,0,0)';
  c.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 64;
    const y = Math.random() * 64;
    const a = 0.04 + Math.random() * 0.06;
    c.fillStyle = `rgba(80, 50, 20, ${a})`;
    c.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.random() * 64;
    const y = Math.random() * 64;
    c.fillStyle = `rgba(120, 80, 30, ${0.05 + Math.random() * 0.06})`;
    c.beginPath();
    c.arc(x, y, 4 + Math.random() * 6, 0, Math.PI * 2);
    c.fill();
  }
  return _ctx.createPattern(off, 'repeat');
}

function clamp(n, lo, hi) {
  return n < lo ? lo : n > hi ? hi : n;
}
