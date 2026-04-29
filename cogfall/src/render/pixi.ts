// PixiJS scene-graph renderer (Phase 2h.5). Replaces the imperative Canvas 2D
// paint passes from the previous render/canvas.ts module. The public API
// (canvas, render, resizeCanvas, centerOnHex, setMinimapHook) is unchanged so
// existing callers don't move; new initPixi() must be awaited from main.ts
// before the first render() call.
//
// Render order: terrain hexes → ownership borders → cultural claim (dashed)
// → cities → units → selection outline (with BlurFilter glow). The SVG
// overlay (movement/attack/sabotage indicators) and the minimap hook then
// run after the PixiJS frame, matching the prior canvas.ts sequence.
//
// Each render() rebuilds the world layer from scratch. PixiJS batches Graphics
// well, and this matches the prior canvas2D pattern of full repaints. If
// per-frame Text creation becomes a measured bottleneck, swap to BitmapText
// or pooled Text — out of scope for the migration itself.

import { Application, BlurFilter, Container, Graphics, Text } from 'pixi.js';
import { HEX_DIRS, HEX_SIZE, hexKey, hexToPixel } from '../core/hex';
import { DOM_IDS } from '../core/dom';
import { G, getCityAt, getTile } from '../core/state';
import { TERRAIN_TYPES } from '../data/terrain';
import { getResource } from '../data/resources';
import { UNIT_TYPES, isNaval, isSpy } from '../data/units';
import type { City, Tile, Unit, Visibility } from '../core/types';
import { fogLerp, getFogEdgeDistance, FOG_MAX_DISTANCE } from '../systems/visibility';
import {
  getElevationField,
  getMode,
  getVisibilityFactionsFor,
} from '../systems/debugOverlay';
import { computeCulturalPressureMap } from '../systems/culture';
import { getMilitaryScoresForUnit } from '../ai/unitAI';
import { renderSVGOverlay } from './overlay';

// Minimap hook (same pattern as old canvas.ts). main.ts wires it so every
// render() chains a minimap repaint without canvas.ts importing ui/.
let minimapHook: () => void = () => {};
export function setMinimapHook(fn: () => void): void {
  minimapHook = fn;
}

const canvas = document.getElementById(DOM_IDS.MAP_CANVAS) as HTMLCanvasElement;
if (!canvas) throw new Error(`#${DOM_IDS.MAP_CANVAS} not found`);
export { canvas };

let app: Application | null = null;
let worldLayer: Container | null = null;
let selectionFilter: BlurFilter | null = null;

export async function initPixi(): Promise<void> {
  if (app) return;
  app = new Application();
  await app.init({
    canvas,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: 0x0a0805,
    antialias: true,
    autoStart: false,
    preference: 'webgl',
  });
  app.ticker.stop();
  worldLayer = new Container();
  app.stage.addChild(worldLayer);
  selectionFilter = new BlurFilter({ strength: 8 });
}

export function resizeCanvas(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Pixi's Application is created synchronously but `.init()` is async, so
  // there's a window where `app` is non-null but `app.renderer` is still
  // undefined. The Continue-Last-Game flow can hit this if the user clicks
  // before initPixi resolves. Guard tightly — caller still drives layout.
  if (app && app.renderer) app.renderer.resize(window.innerWidth, window.innerHeight);
  const svg = document.getElementById(DOM_IDS.OVERLAY_SVG);
  if (svg) {
    svg.setAttribute('width', String(window.innerWidth));
    svg.setAttribute('height', String(window.innerHeight));
  }
  if (G.map) render();
}

window.addEventListener('resize', resizeCanvas);

function hexCorner(cx: number, cy: number, i: number): { x: number; y: number } {
  const angle = (Math.PI / 180) * (60 * i - 30);
  return { x: cx + HEX_SIZE * Math.cos(angle), y: cy + HEX_SIZE * Math.sin(angle) };
}

function hexPolygon(cx: number, cy: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const c = hexCorner(cx, cy, i);
    pts.push(c.x, c.y);
  }
  return pts;
}

// Walk the segment from (x1,y1)→(x2,y2) emitting alternating dash-gap
// move/lineTo pairs. Caller commits with .stroke(). PixiJS has no native
// setLineDash equivalent.
function drawDashedLine(
  g: Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dash: number,
  gap: number,
): void {
  const len = Math.hypot(x2 - x1, y2 - y1);
  if (len === 0) return;
  const ux = (x2 - x1) / len;
  const uy = (y2 - y1) / len;
  let d = 0;
  let on = true;
  while (d < len) {
    const seg = Math.min(on ? dash : gap, len - d);
    if (on) {
      g.moveTo(x1 + ux * d, y1 + uy * d);
      g.lineTo(x1 + ux * (d + seg), y1 + uy * (d + seg));
    }
    d += seg;
    on = !on;
  }
}

// Approximate a circle with 32 chord segments and dash each chord. Caller
// commits with .stroke(). Used for the spy aura ring.
function drawDashedCircle(
  g: Graphics,
  cx: number,
  cy: number,
  radius: number,
  dash: number,
  gap: number,
): void {
  const SEGMENTS = 32;
  let prevX = cx + radius;
  let prevY = cy;
  for (let i = 1; i <= SEGMENTS; i++) {
    const a = (i / SEGMENTS) * Math.PI * 2;
    const nx = cx + Math.cos(a) * radius;
    const ny = cy + Math.sin(a) * radius;
    drawDashedLine(g, prevX, prevY, nx, ny, dash, gap);
    prevX = nx;
    prevY = ny;
  }
}

function makeText(
  content: string,
  size: number,
  family: string,
  color: string,
  alpha: number,
  x: number,
  y: number,
  bold = false,
): Text {
  const t = new Text({
    text: content,
    style: {
      fontFamily: family,
      fontSize: size,
      fill: color,
      fontWeight: bold ? 'bold' : 'normal',
      align: 'center',
    },
  });
  t.anchor.set(0.5);
  t.position.set(x, y);
  t.alpha = alpha;
  return t;
}

export function render(): void {
  if (!app || !worldLayer) return;

  for (const child of worldLayer.removeChildren()) {
    child.destroy({ children: true });
  }

  if (!G.map) {
    app.renderer.render(app.stage);
    return;
  }

  worldLayer.position.set(G.cameraX, G.cameraY);
  worldLayer.scale.set(G.zoom);

  const playerIdx = G.playerFactionIdx;

  const terrain = new Graphics();
  worldLayer.addChild(terrain);
  for (const tile of G.map.tiles.values()) {
    const vis = tile.visibility[playerIdx];
    if (!vis || vis === 'unseen') continue;
    drawHex(terrain, worldLayer, tile, vis);
  }

  drawOwnership(worldLayer);
  drawCulturalClaim(worldLayer);
  drawDebugOverlay(worldLayer);

  for (const c of G.cities) {
    const t = getTile(c.q, c.r);
    if (!t || !t.visibility[playerIdx] || t.visibility[playerIdx] === 'unseen') continue;
    drawCity(worldLayer, c);
  }

  for (const u of G.units) {
    const t = getTile(u.q, u.r);
    if (!t || t.visibility[playerIdx] !== 'visible') continue;
    drawUnit(worldLayer, u);
  }

  drawSelection(worldLayer);

  app.renderer.render(app.stage);
  renderSVGOverlay();
  minimapHook();
}

function drawHex(g: Graphics, parent: Container, tile: Tile, vis: Visibility): void {
  const { x, y } = hexToPixel(tile.q, tile.r);
  const tt = TERRAIN_TYPES[tile.terrain];
  const pts = hexPolygon(x, y);

  g.poly(pts).fill(tt.color);

  if (vis === 'seen') {
    g.poly(pts).fill({ color: 0x000000, alpha: fogLerp(tile, 0.2, 0.45) });
  }

  g.poly(pts).stroke({ color: tt.edge, width: 1 });

  if (tile.riverEdges) {
    const riverAlpha = vis === 'seen' ? 0.5 : 1;
    for (let i = 0; i < 6; i++) {
      if (tile.riverEdges & (1 << i)) {
        const c1 = hexCorner(x, y, i);
        const c2 = hexCorner(x, y, (i + 1) % 6);
        g.moveTo(c1.x, c1.y);
        g.lineTo(c2.x, c2.y);
        g.stroke({ color: '#7fb8d6', width: 2.5, alpha: riverAlpha });
      }
    }
  }

  if (tt.glyph) {
    const alpha = vis === 'seen' ? fogLerp(tile, 0.5, 0.35) : 0.55;
    parent.addChild(makeText(tt.glyph, HEX_SIZE * 0.85, 'serif', '#f4e4bc', alpha, x, y));
  }

  if (tile.improvement && tile.improvement !== 'looted') {
    const alpha = vis === 'seen' ? fogLerp(tile, 0.55, 0.4) : 1;
    let glyph = '·';
    if (tile.improvement === 'farm') glyph = '✿';
    if (tile.improvement === 'mine') glyph = '⛏';
    if (tile.improvement === 'road') glyph = '═';
    parent.addChild(
      makeText(
        glyph,
        HEX_SIZE * 0.5,
        'serif',
        '#d4a017',
        alpha,
        x + HEX_SIZE * 0.4,
        y + HEX_SIZE * 0.4,
      ),
    );
  }

  const res = getResource(tile.resource);
  if (res) {
    const alpha = vis === 'seen' ? fogLerp(tile, 0.6, 0.45) : 1;
    parent.addChild(
      makeText(
        res.glyph,
        HEX_SIZE * 0.5,
        'serif',
        '#e8c45a',
        alpha,
        x - HEX_SIZE * 0.4,
        y + HEX_SIZE * 0.4,
      ),
    );
  }

  if (tile.improvement === 'looted') {
    parent.addChild(
      makeText(
        '×',
        HEX_SIZE * 0.5,
        'serif',
        '#000000',
        0.4,
        x + HEX_SIZE * 0.4,
        y + HEX_SIZE * 0.4,
      ),
    );
  }
}

function drawOwnership(parent: Container): void {
  if (!G.map) return;
  const playerIdx = G.playerFactionIdx;
  const g = new Graphics();
  parent.addChild(g);
  for (const tile of G.map.tiles.values()) {
    if (!tile.visibility[playerIdx] || tile.visibility[playerIdx] === 'unseen') continue;
    if (tile.owner == null) continue;
    const fac = G.factions[tile.owner];
    const { x, y } = hexToPixel(tile.q, tile.r);
    for (let i = 0; i < 6; i++) {
      const d = HEX_DIRS[i];
      const nt = getTile(tile.q + d.q, tile.r + d.r);
      if (!nt || nt.owner !== tile.owner) {
        const c1 = hexCorner(x, y, i);
        const c2 = hexCorner(x, y, (i + 1) % 6);
        g.moveTo(c1.x, c1.y);
        g.lineTo(c2.x, c2.y);
        g.stroke({ color: fac.color, width: 2 });
      }
    }
  }
}

// Cultural claim borders (Phase 2g). Dashed faction-color stroke on edges
// where the soft `claim` differs from the neighbor's claim. Runs after
// drawOwnership so harder ownership edges paint first.
function drawCulturalClaim(parent: Container): void {
  if (!G.map) return;
  const playerIdx = G.playerFactionIdx;
  const g = new Graphics();
  parent.addChild(g);
  for (const tile of G.map.tiles.values()) {
    if (!tile.visibility[playerIdx] || tile.visibility[playerIdx] === 'unseen') continue;
    if (tile.claim == null) continue;
    const fac = G.factions[tile.claim];
    if (!fac) continue;
    const { x, y } = hexToPixel(tile.q, tile.r);
    for (let i = 0; i < 6; i++) {
      const d = HEX_DIRS[i];
      const nt = getTile(tile.q + d.q, tile.r + d.r);
      if (!nt || nt.claim !== tile.claim) {
        const c1 = hexCorner(x, y, i);
        const c2 = hexCorner(x, y, (i + 1) % 6);
        drawDashedLine(g, c1.x, c1.y, c2.x, c2.y, 5, 4);
        g.stroke({ color: fac.color, width: 1.5 });
      }
    }
  }
}

// --- Debug overlay (Phase 2L) ----------------------------------------------
//
// Cycled by the backtick hotkey when the master flag is on. Each mode
// paints a single Graphics fill pass (alpha-blended over terrain) plus
// per-tile Text labels where useful. eventMode='none' so the overlay
// can never swallow click/hover events from the gameplay layers above
// it. Pre-2L saves with no mapSeed get a "no mapSeed" fallback in the
// elevation mode; everything else degrades to empty results gracefully.

function lerpColor(t: number, a: [number, number, number], b: [number, number, number]): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

function elevationToColor(v: number): string {
  // Three-stop ramp blue → green → red, clamped to [0, 1].
  const x = Math.max(0, Math.min(1, v));
  if (x < 0.5) return lerpColor(x * 2, [40, 80, 200], [60, 200, 80]);
  return lerpColor((x - 0.5) * 2, [60, 200, 80], [220, 60, 40]);
}

function drawDebugOverlay(parent: Container): void {
  const mode = getMode();
  if (mode === 'off' || !G.map) return;

  const overlay = new Container();
  overlay.eventMode = 'none';
  parent.addChild(overlay);

  const g = new Graphics();
  overlay.addChild(g);

  if (mode === 'elevation') {
    const field = getElevationField();
    if (!field) {
      // Pre-2L save: stamp a single label at the camera-relative origin.
      // Camera position is applied via worldLayer transform; (0, 0) is
      // the noise-space origin which lives on the visible map for any
      // sane size, so this is fine without per-call recomputation.
      const { x, y } = hexToPixel(0, 0);
      overlay.addChild(
        makeText('no mapSeed (pre-2L save)', 14, 'Georgia', '#ff6060', 0.95, x, y, true),
      );
      return;
    }
    for (const tile of G.map.tiles.values()) {
      const v = field.get(hexKey(tile.q, tile.r));
      if (v == null) continue;
      const { x, y } = hexToPixel(tile.q, tile.r);
      g.poly(hexPolygon(x, y)).fill({ color: elevationToColor(v), alpha: 0.45 });
    }
    return;
  }

  if (mode === 'ai') {
    const sel = G.selected;
    if (!sel || sel.type !== 'unit' || sel.ref.factionIdx !== G.playerFactionIdx) {
      const { x, y } = hexToPixel(0, 0);
      overlay.addChild(
        makeText('AI mode: select a friendly unit', 14, 'Georgia', '#f4e4bc', 0.95, x, y, true),
      );
      return;
    }
    const unit = sel.ref;
    const faction = G.factions[unit.factionIdx];
    const scores = getMilitaryScoresForUnit(faction, unit);
    if (scores.size === 0) {
      const { x, y } = hexToPixel(unit.q, unit.r);
      overlay.addChild(
        makeText('no attack targets', 12, 'Georgia', '#f4e4bc', 0.9, x, y - HEX_SIZE * 1.1),
      );
      return;
    }
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of scores.values()) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    const span = hi - lo || 1;
    for (const [key, score] of scores) {
      const [qStr, rStr] = key.split(',');
      const q = Number(qStr);
      const r = Number(rStr);
      const { x, y } = hexToPixel(q, r);
      const norm = (score - lo) / span;
      const alpha = 0.25 + norm * 0.45;
      g.poly(hexPolygon(x, y)).fill({ color: '#ffd060', alpha });
      overlay.addChild(
        makeText(String(Math.round(score)), 11, 'monospace', '#1a1108', 1, x, y, true),
      );
    }
    return;
  }

  if (mode === 'visibility') {
    const playerIdx = G.playerFactionIdx;
    for (const tile of G.map.tiles.values()) {
      const { x, y } = hexToPixel(tile.q, tile.r);
      const vis = tile.visibility[playerIdx];
      const factions = getVisibilityFactionsFor(tile);
      // Player perspective tint.
      let color = '#404040';
      if (vis === 'visible') color = '#60ff60';
      else if (vis === 'seen') color = '#a0a0ff';
      const alpha = vis === 'visible' ? 0.18 : vis === 'seen' ? 0.14 : 0.08;
      g.poly(hexPolygon(x, y)).fill({ color, alpha });
      // Edge-distance number for visible/seen player tiles.
      if (vis === 'visible' || vis === 'seen') {
        const d = getFogEdgeDistance(tile);
        if (d <= FOG_MAX_DISTANCE) {
          overlay.addChild(
            makeText(String(d), 10, 'monospace', '#101010', 0.85, x, y - HEX_SIZE * 0.35, true),
          );
        }
      }
      // List faction indices that can see this tile.
      if (factions.length > 0) {
        overlay.addChild(
          makeText(
            factions.map((f) => `F${f}`).join(' '),
            9,
            'monospace',
            '#101010',
            0.9,
            x,
            y + HEX_SIZE * 0.45,
            true,
          ),
        );
      }
    }
    return;
  }

  if (mode === 'culture') {
    const pressure = computeCulturalPressureMap();
    let hi = 0;
    for (const arr of pressure.values()) {
      for (const v of arr) if (v > hi) hi = v;
    }
    if (hi === 0) {
      const { x, y } = hexToPixel(0, 0);
      overlay.addChild(
        makeText('culture mode: no pressure yet', 14, 'Georgia', '#f4e4bc', 0.95, x, y, true),
      );
      return;
    }
    for (const tile of G.map.tiles.values()) {
      const arr = pressure.get(hexKey(tile.q, tile.r));
      if (!arr) continue;
      let bestIdx = -1;
      let bestVal = 0;
      let total = 0;
      for (let i = 0; i < arr.length; i++) {
        total += arr[i];
        if (arr[i] > bestVal) {
          bestVal = arr[i];
          bestIdx = i;
        }
      }
      if (bestIdx < 0) continue;
      const fac = G.factions[bestIdx];
      const { x, y } = hexToPixel(tile.q, tile.r);
      const intensity = Math.min(1, bestVal / hi);
      g.poly(hexPolygon(x, y)).fill({ color: fac.color, alpha: 0.15 + intensity * 0.4 });
      overlay.addChild(
        makeText(String(Math.round(total)), 10, 'monospace', '#101010', 0.85, x, y, true),
      );
    }
    return;
  }
}

function drawCity(parent: Container, c: City): void {
  const fac = G.factions[c.factionIdx];
  const { x, y } = hexToPixel(c.q, c.r);

  const g = new Graphics();
  g.circle(x, y, HEX_SIZE * 0.65)
    .fill('#1a1108')
    .stroke({ color: fac.color, width: 3 });
  parent.addChild(g);

  parent.addChild(makeText(fac.glyph, HEX_SIZE * 0.7, 'serif', fac.color, 1, x, y, true));

  if (c.isCapital) {
    parent.addChild(
      makeText('★', HEX_SIZE * 0.4, 'serif', '#f4e4bc', 1, x, y - HEX_SIZE * 0.45),
    );
  }

  parent.addChild(
    makeText(
      `${c.name} (${c.population})`,
      11,
      'Georgia',
      '#f4e4bc',
      1,
      x,
      y + HEX_SIZE * 0.85,
      true,
    ),
  );

  if (c.hp < c.maxHp) {
    const w = HEX_SIZE * 0.9;
    const bar = new Graphics();
    bar.rect(x - w / 2, y - HEX_SIZE * 0.85, w, 4).fill('#222');
    const color =
      c.hp > c.maxHp * 0.5 ? '#6fdb6f' : c.hp > c.maxHp * 0.25 ? '#ddd66f' : '#d44a3a';
    bar.rect(x - w / 2, y - HEX_SIZE * 0.85, w * (c.hp / c.maxHp), 4).fill(color);
    parent.addChild(bar);
  }
}

function drawUnit(parent: Container, u: Unit): void {
  const fac = G.factions[u.factionIdx];
  const tpl = UNIT_TYPES[u.typeId];
  const naval = isNaval(u.typeId);
  const spy = isSpy(u.typeId);
  const { x, y } = hexToPixel(u.q, u.r);
  const cityHere = getCityAt(u.q, u.r);
  const offY = cityHere ? HEX_SIZE * 0.35 : 0;

  const g = new Graphics();

  if (naval) {
    g.moveTo(x - HEX_SIZE * 0.55, y - offY + HEX_SIZE * 0.4);
    g.lineTo(x + HEX_SIZE * 0.55, y - offY + HEX_SIZE * 0.4);
    g.stroke({ color: '#7fb8d6', width: 1.2, alpha: 0.45 });
    g.moveTo(x - HEX_SIZE * 0.4, y - offY + HEX_SIZE * 0.55);
    g.lineTo(x + HEX_SIZE * 0.4, y - offY + HEX_SIZE * 0.55);
    g.stroke({ color: '#7fb8d6', width: 1.2, alpha: 0.45 });
  }

  g.circle(x, y - offY, HEX_SIZE * 0.42)
    .fill(naval ? '#0a1830' : '#0a0805')
    .stroke({ color: fac.color, width: 2.5 });

  if (spy) {
    drawDashedCircle(g, x, y - offY, HEX_SIZE * 0.52, 3, 3);
    g.stroke({ color: '#a060e0', width: 1.2 });
  }

  if (u.hp < u.maxHp) {
    const w = HEX_SIZE * 0.7;
    g.rect(x - w / 2, y - offY + HEX_SIZE * 0.5, w, 3).fill('#222');
    const color =
      u.hp > u.maxHp * 0.5 ? '#6fdb6f' : u.hp > u.maxHp * 0.25 ? '#ddd66f' : '#d44a3a';
    g.rect(x - w / 2, y - offY + HEX_SIZE * 0.5, w * (u.hp / u.maxHp), 3).fill(color);
  }

  if (u.factionIdx === G.playerFactionIdx && u.mp > 0) {
    g.circle(x + HEX_SIZE * 0.35, y - offY - HEX_SIZE * 0.3, 3.5).fill('#4ecdc4');
  }

  parent.addChild(g);

  parent.addChild(makeText(tpl.glyph, HEX_SIZE * 0.55, 'serif', fac.color, 1, x, y - offY, true));

  if (u.fortified) {
    parent.addChild(
      makeText(
        '◫',
        HEX_SIZE * 0.3,
        'serif',
        '#d4a017',
        1,
        x - HEX_SIZE * 0.35,
        y - offY - HEX_SIZE * 0.3,
      ),
    );
  }
}

function drawSelection(parent: Container): void {
  if (!G.selected) return;
  let q: number, r: number;
  if (G.selected.type === 'unit') {
    q = G.selected.ref.q;
    r = G.selected.ref.r;
  } else if (G.selected.type === 'tile' || G.selected.type === 'city') {
    q = G.selected.ref.q;
    r = G.selected.ref.r;
  } else return;
  const { x, y } = hexToPixel(q, r);
  const g = new Graphics();
  g.poly(hexPolygon(x, y)).stroke({ color: '#f4e4bc', width: 3 });
  if (selectionFilter) g.filters = [selectionFilter];
  parent.addChild(g);
}

export function centerOnHex(q: number, r: number): void {
  const { x, y } = hexToPixel(q, r);
  G.cameraX = window.innerWidth / 2 - x * G.zoom;
  G.cameraY = window.innerHeight / 2 - y * G.zoom;
}
