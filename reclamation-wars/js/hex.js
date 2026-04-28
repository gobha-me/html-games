// === HEX GRID MATH (axial coordinates) ===
class Hex {
    constructor(q, r) {
        this.q = q;
        this.r = r;
        this.s = -q - r;
    }

    equals(other) {
        return this.q === other.q && this.r === other.r;
    }

    add(other) {
        return new Hex(this.q + other.q, this.r + other.r);
    }

    subtract(other) {
        return new Hex(this.q - other.q, this.r - other.r);
    }

    scale(k) {
        return new Hex(this.q * k, this.r * k);
    }

    distance(other) {
        return (Math.abs(this.q - other.q) + Math.abs(this.q + this.r - other.q - other.r) + Math.abs(this.r - other.r)) / 2;
    }

    key() {
        return `${this.q},${this.r}`;
    }

    static fromKey(key) {
        const [q, r] = key.split(',').map(Number);
        return new Hex(q, r);
    }

    // Get the 6 neighbors in axial coordinates
    neighbors() {
        const directions = [
            new Hex(1, 0), new Hex(1, -1), new Hex(0, -1),
            new Hex(-1, 0), new Hex(-1, 1), new Hex(0, 1)
        ];
        return directions.map(d => this.add(d));
    }

    // Get neighbors within range
    neighborsInRange(range) {
        const results = [];
        for (let dq = -range; dq <= range; dq++) {
            for (let dr = -range; dr <= range; dr++) {
                if (Math.abs(-dq - dr) <= range) {
                    results.push(new Hex(this.q + dq, this.r + dr));
                }
            }
        }
        return results;
    }

    // Pixel position for rendering (pointy-top hex)
    toPixel(size) {
        const x = size * (Math.sqrt(3) * this.q + Math.sqrt(3) / 2 * this.r);
        const y = size * (3 / 2 * this.r);
        return { x, y };
    }

    static fromPixel(x, y, size) {
        const q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / size;
        const r = (2 / 3 * y) / size;
        return Hex.round(q, r);
    }

    static round(q, r) {
        const s = -q - r;
        let rq = Math.round(q);
        let rr = Math.round(r);
        let rs = Math.round(s);

        const qDiff = Math.abs(rq - q);
        const rDiff = Math.abs(rr - r);
        const sDiff = Math.abs(rs - s);

        if (qDiff > rDiff && qDiff > sDiff) {
            rq = -rr - rs;
        } else if (rDiff > sDiff) {
            rr = -rq - rs;
        }
        return new Hex(rq, rr);
    }
}

// Hex grid utilities
class HexGrid {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.hexes = new Map();
        this._generate();
    }

    _generate() {
        for (let r = 0; r < this.rows; r++) {
            for (let q = 0; q < this.cols; q++) {
                const offsetQ = q - Math.floor(r / 2);
                const hex = new Hex(offsetQ, r);
                this.hexes.set(hex.key(), hex);
            }
        }
    }

    getHex(q, r) {
        return this.hexes.get(`${q},${r}`);
    }

    hasHex(q, r) {
        return this.hexes.has(`${q},${r}`);
    }

    getAllHexes() {
        return Array.from(this.hexes.values());
    }

    getNeighbors(hex) {
        return hex.neighbors().filter(n => this.hasHex(n.q, n.r));
    }

    getDistance(hex1, hex2) {
        return hex1.distance(hex2);
    }

    getPath(start, end, isPassable = () => true) {
        // A* pathfinding
        const openSet = [start];
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        gScore.set(start.key(), 0);
        fScore.set(start.key(), start.distance(end));

        while (openSet.length > 0) {
            openSet.sort((a, b) => (fScore.get(a.key()) || Infinity) - (fScore.get(b.key()) || Infinity));
            const current = openSet.shift();

            if (current.equals(end)) {
                // Reconstruct path
                const path = [current];
                let curr = current;
                while (cameFrom.has(curr.key())) {
                    curr = cameFrom.get(curr.key());
                    path.unshift(curr);
                }
                return path;
            }

            for (const neighbor of this.getNeighbors(current)) {
                if (!isPassable(neighbor)) continue;

                const tentativeG = (gScore.get(current.key()) || 0) + 1;
                if (tentativeG < (gScore.get(neighbor.key()) || Infinity)) {
                    cameFrom.set(neighbor.key(), current);
                    gScore.set(neighbor.key(), tentativeG);
                    fScore.set(neighbor.key(), tentativeG + neighbor.distance(end));
                    if (!openSet.some(h => h.equals(neighbor))) {
                        openSet.push(neighbor);
                    }
                }
            }
        }
        return null; // No path found
    }

    getHexesInRange(center, range) {
        return center.neighborsInRange(range).filter(h => this.hasHex(h.q, h.r));
    }
}
