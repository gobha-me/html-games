// ICD-03 — Unit ↔ Pathfinder.
// Pure A* over a precomputed walkability grid. No three.js, no DOM.
//
// GridCell = { x, y }   (open question closed at 0.2: plain object)
// cost     = tiles      (open question closed at 0.2: tiles)
// recomputeOn returns [] at 0.2 — buildings are baked, never move.

const cellKey = (c) => c.y * 65536 + c.x;

export function pathfind(req, grid) {
  const { from, to, unitKind } = req;
  const W = grid.width;
  const H = grid.height;
  void unitKind; // accepted by contract; per-kind costs land later (0.7).

  if (!inBounds(from, W, H) || !inBounds(to, W, H) || !grid.walkable[to.y][to.x]) {
    return { found: false, cells: [], cost: 0, recomputeOn: [] };
  }
  if (from.x === to.x && from.y === to.y) {
    return { found: true, cells: [{ x: from.x, y: from.y }], cost: 0, recomputeOn: [] };
  }

  const open = new Map();
  const closed = new Set();
  const startKey = cellKey(from);
  open.set(startKey, { x: from.x, y: from.y, g: 0, f: manhattan(from, to), parent: null });

  while (open.size > 0) {
    let curKey = null;
    let cur = null;
    for (const [k, n] of open) {
      if (cur === null || n.f < cur.f) { cur = n; curKey = k; }
    }
    if (cur.x === to.x && cur.y === to.y) {
      const cells = [];
      let n = cur;
      while (n) { cells.push({ x: n.x, y: n.y }); n = n.parent; }
      cells.reverse();
      return { found: true, cells, cost: cur.g, recomputeOn: [] };
    }
    open.delete(curKey);
    closed.add(curKey);

    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inBounds({ x: nx, y: ny }, W, H)) continue;
      if (!grid.walkable[ny][nx]) continue;
      const nk = nx + ny * 65536;
      if (closed.has(nk)) continue;
      const g = cur.g + 1;
      const existing = open.get(nk);
      if (existing && existing.g <= g) continue;
      open.set(nk, { x: nx, y: ny, g, f: g + manhattan({ x: nx, y: ny }, to), parent: cur });
    }
  }

  return { found: false, cells: [], cost: 0, recomputeOn: [] };
}

function inBounds(c, W, H) { return c.x >= 0 && c.y >= 0 && c.x < W && c.y < H; }
function manhattan(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }
