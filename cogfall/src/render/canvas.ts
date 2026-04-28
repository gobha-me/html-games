// Canvas renderer. Owns the <canvas> ref, the 2D context, and the camera
// transform; SVG overlay (move/attack indicators) lives in render/overlay.ts.
//
// Render order: tiles (visible/seen only) → ownership borders → cities →
// units → selection outline → SVG overlay. No z-sorting; matches prototype.

import { HEX_DIRS, HEX_SIZE, hexToPixel } from '../core/hex';
import { DOM_IDS } from '../core/dom';
import { G, getCityAt, getTile } from '../core/state';
import { TERRAIN_TYPES } from '../data/terrain';
import { getResource } from '../data/resources';
import { UNIT_TYPES, isNaval, isSpy } from '../data/units';
import type { Tile, Visibility } from '../core/types';
import { renderSVGOverlay } from './overlay';

const canvas = document.getElementById(DOM_IDS.MAP_CANVAS) as HTMLCanvasElement;
if (!canvas) throw new Error(`#${DOM_IDS.MAP_CANVAS} not found`);
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

export { canvas, ctx };

export function resizeCanvas(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const svg = document.getElementById(DOM_IDS.OVERLAY_SVG);
  if (svg) {
    svg.setAttribute('width', String(window.innerWidth));
    svg.setAttribute('height', String(window.innerHeight));
  }
  if (G.map) render();
}

window.addEventListener('resize', resizeCanvas);

export function hexCorner(cx: number, cy: number, i: number): { x: number; y: number } {
  const angle = (Math.PI / 180) * (60 * i - 30);
  return { x: cx + HEX_SIZE * Math.cos(angle), y: cy + HEX_SIZE * Math.sin(angle) };
}

export function render(): void {
  if (!G.map) return;
  ctx.save();
  ctx.fillStyle = '#0a0805';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(G.cameraX, G.cameraY);
  ctx.scale(G.zoom, G.zoom);

  const playerIdx = G.playerFactionIdx;
  for (const tile of G.map.tiles.values()) {
    const vis = tile.visibility[playerIdx];
    if (!vis || vis === 'unseen') continue;
    drawHex(tile, vis);
  }
  drawOwnership();
  for (const c of G.cities) {
    const t = getTile(c.q, c.r);
    if (!t || !t.visibility[playerIdx] || t.visibility[playerIdx] === 'unseen') continue;
    drawCity(c);
  }
  for (const u of G.units) {
    const t = getTile(u.q, u.r);
    if (!t || t.visibility[playerIdx] !== 'visible') continue;
    drawUnit(u);
  }
  drawSelection();
  ctx.restore();
  renderSVGOverlay();
}

function drawHex(tile: Tile, vis: Visibility): void {
  const { x, y } = hexToPixel(tile.q, tile.r);
  const tt = TERRAIN_TYPES[tile.terrain];
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const c = hexCorner(x, y, i);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  }
  ctx.closePath();
  ctx.fillStyle = tt.color;
  ctx.fill();
  if (vis === 'seen') {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fill();
  }
  ctx.strokeStyle = tt.edge;
  ctx.lineWidth = 1;
  ctx.stroke();
  if (tile.riverEdges) {
    ctx.strokeStyle = vis === 'seen' ? 'rgba(127,184,214,0.5)' : '#7fb8d6';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 6; i++) {
      if (tile.riverEdges & (1 << i)) {
        const c1 = hexCorner(x, y, i);
        const c2 = hexCorner(x, y, (i + 1) % 6);
        ctx.beginPath();
        ctx.moveTo(c1.x, c1.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.stroke();
      }
    }
  }
  if (tt.glyph) {
    ctx.fillStyle = vis === 'seen' ? 'rgba(244,228,188,0.35)' : 'rgba(244,228,188,0.55)';
    ctx.font = `${HEX_SIZE * 0.85}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tt.glyph, x, y);
  }
  if (tile.improvement && tile.improvement !== 'looted') {
    ctx.fillStyle = vis === 'seen' ? 'rgba(212,160,23,0.4)' : '#d4a017';
    ctx.font = `${HEX_SIZE * 0.5}px serif`;
    let g = '·';
    if (tile.improvement === 'farm') g = '✿';
    if (tile.improvement === 'mine') g = '⛏';
    if (tile.improvement === 'road') g = '═';
    ctx.fillText(g, x + HEX_SIZE * 0.4, y + HEX_SIZE * 0.4);
  }
  const res = getResource(tile.resource);
  if (res) {
    ctx.fillStyle = vis === 'seen' ? 'rgba(232,196,90,0.45)' : '#e8c45a';
    ctx.font = `${HEX_SIZE * 0.5}px serif`;
    ctx.fillText(res.glyph, x - HEX_SIZE * 0.4, y + HEX_SIZE * 0.4);
  }
  if (tile.improvement === 'looted') {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.font = `${HEX_SIZE * 0.5}px serif`;
    ctx.fillText('×', x + HEX_SIZE * 0.4, y + HEX_SIZE * 0.4);
  }
}

function drawOwnership(): void {
  if (!G.map) return;
  const playerIdx = G.playerFactionIdx;
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
        ctx.strokeStyle = fac.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(c1.x, c1.y);
        ctx.lineTo(c2.x, c2.y);
        ctx.stroke();
      }
    }
  }
}

function drawCity(c: {
  q: number;
  r: number;
  factionIdx: number;
  isCapital: boolean;
  name: string;
  population: number;
  hp: number;
  maxHp: number;
}): void {
  const fac = G.factions[c.factionIdx];
  const { x, y } = hexToPixel(c.q, c.r);
  ctx.beginPath();
  ctx.arc(x, y, HEX_SIZE * 0.65, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1108';
  ctx.fill();
  ctx.strokeStyle = fac.color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = fac.color;
  ctx.font = `bold ${HEX_SIZE * 0.7}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fac.glyph, x, y);
  if (c.isCapital) {
    ctx.fillStyle = '#f4e4bc';
    ctx.font = `${HEX_SIZE * 0.4}px serif`;
    ctx.fillText('★', x, y - HEX_SIZE * 0.45);
  }
  ctx.fillStyle = '#f4e4bc';
  ctx.font = `bold 11px Georgia`;
  ctx.fillText(c.name + ' (' + c.population + ')', x, y + HEX_SIZE * 0.85);
  if (c.hp < c.maxHp) {
    const w = HEX_SIZE * 0.9;
    ctx.fillStyle = '#222';
    ctx.fillRect(x - w / 2, y - HEX_SIZE * 0.85, w, 4);
    ctx.fillStyle =
      c.hp > c.maxHp * 0.5 ? '#6fdb6f' : c.hp > c.maxHp * 0.25 ? '#ddd66f' : '#d44a3a';
    ctx.fillRect(x - w / 2, y - HEX_SIZE * 0.85, w * (c.hp / c.maxHp), 4);
  }
}

function drawUnit(u: {
  q: number;
  r: number;
  factionIdx: number;
  typeId: keyof typeof UNIT_TYPES;
  hp: number;
  maxHp: number;
  mp: number;
  fortified: boolean;
}): void {
  const fac = G.factions[u.factionIdx];
  const tpl = UNIT_TYPES[u.typeId];
  const naval = isNaval(u.typeId);
  const spy = isSpy(u.typeId);
  const { x, y } = hexToPixel(u.q, u.r);
  const cityHere = getCityAt(u.q, u.r);
  const offY = cityHere ? HEX_SIZE * 0.35 : 0;
  if (naval) {
    ctx.strokeStyle = 'rgba(127,184,214,0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - HEX_SIZE * 0.55, y - offY + HEX_SIZE * 0.4);
    ctx.lineTo(x + HEX_SIZE * 0.55, y - offY + HEX_SIZE * 0.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - HEX_SIZE * 0.4, y - offY + HEX_SIZE * 0.55);
    ctx.lineTo(x + HEX_SIZE * 0.4, y - offY + HEX_SIZE * 0.55);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(x, y - offY, HEX_SIZE * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = naval ? '#0a1830' : '#0a0805';
  ctx.fill();
  ctx.strokeStyle = fac.color;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = fac.color;
  ctx.font = `bold ${HEX_SIZE * 0.55}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tpl.glyph, x, y - offY);
  if (spy) {
    ctx.save();
    ctx.strokeStyle = '#a060e0';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(x, y - offY, HEX_SIZE * 0.52, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  if (u.hp < u.maxHp) {
    const w = HEX_SIZE * 0.7;
    ctx.fillStyle = '#222';
    ctx.fillRect(x - w / 2, y - offY + HEX_SIZE * 0.5, w, 3);
    ctx.fillStyle =
      u.hp > u.maxHp * 0.5 ? '#6fdb6f' : u.hp > u.maxHp * 0.25 ? '#ddd66f' : '#d44a3a';
    ctx.fillRect(x - w / 2, y - offY + HEX_SIZE * 0.5, w * (u.hp / u.maxHp), 3);
  }
  if (u.factionIdx === G.playerFactionIdx && u.mp > 0) {
    ctx.fillStyle = '#4ecdc4';
    ctx.beginPath();
    ctx.arc(x + HEX_SIZE * 0.35, y - offY - HEX_SIZE * 0.3, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (u.fortified) {
    ctx.fillStyle = '#d4a017';
    ctx.font = `${HEX_SIZE * 0.3}px serif`;
    ctx.fillText('◫', x - HEX_SIZE * 0.35, y - offY - HEX_SIZE * 0.3);
  }
}

function drawSelection(): void {
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
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const c = hexCorner(x, y, i);
    if (i === 0) ctx.moveTo(c.x, c.y);
    else ctx.lineTo(c.x, c.y);
  }
  ctx.closePath();
  ctx.strokeStyle = '#f4e4bc';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#f4e4bc';
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

export function centerOnHex(q: number, r: number): void {
  const { x, y } = hexToPixel(q, r);
  G.cameraX = window.innerWidth / 2 - x * G.zoom;
  G.cameraY = window.innerHeight / 2 - y * G.zoom;
}
