// Pointy-top hex math, axial coordinates. Pure functions; no game-state
// dependencies. The math matches the prototype byte-for-byte; types add a
// `TileKey` template literal so any string returned by hexKey() is
// distinguishable from arbitrary strings at compile time.

export const HEX_SIZE = 30;
export const SQRT3 = Math.sqrt(3);

export interface AxialCoord {
  q: number;
  r: number;
}

export type TileKey = `${number},${number}`;

export const HEX_DIRS: readonly AxialCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexToPixel(q: number, r: number): { x: number; y: number } {
  return { x: HEX_SIZE * SQRT3 * (q + r / 2), y: HEX_SIZE * 1.5 * r };
}

export function roundHex(q: number, r: number): AxialCoord {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

export function pixelToHex(x: number, y: number): AxialCoord {
  const q = ((SQRT3 / 3) * x - y / 3) / HEX_SIZE;
  const r = ((2 / 3) * y) / HEX_SIZE;
  return roundHex(q, r);
}

export function hexNeighbors(q: number, r: number): AxialCoord[] {
  return HEX_DIRS.map((d) => ({ q: q + d.q, r: r + d.r }));
}

export function hexDistance(a: AxialCoord, b: AxialCoord): number {
  return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

export function hexKey(q: number, r: number): TileKey {
  return `${q},${r}`;
}
