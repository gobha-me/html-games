// levels.js — 3 Spire Campaign Floors + Mulberry32 Deterministic Daily Contract Generator
(function (global) {
  'use strict';

  // Grid dimensions: 20x11 tiles at 64x64 world units = 1280x704 world space
  const COLS = 20;
  const ROWS = 11;
  const TILE_SIZE = 64;

  // Tile legend:
  // '#' = wall_bulkhead (solid & blocks light)
  // 'D' = door_closed (breachable, blocks light when closed)
  // 'G' = glass_wall (shootable/shatterable, lets light through!)
  // 'S' = server_rack (solid cover, glowing neon)
  // 'T' = exec_desk (low cover, bullets pass over unless crouched, blocks walk)
  // 'E' = elevator_pad (spawn / extraction)
  // '.' = open floor

  const CAMPAIGN_FLOORS = [
    {
      id: 'CAMPAIGN-01',
      name: '01 // KOWLOON CHECKPOINT',
      floorTile: 'floor_slate',
      ambient: [0.10, 0.14, 0.22],
      map: [
        '####################',
        '#E...#......G......#',
        '#....D..T...G..S...#',
        '#....#......#......#',
        '####D########D######',
        '#.......G..........#',
        '#..S....G....T..S..#',
        '#####D#######G######',
        '#.......#..........#',
        '#...T...D....T.....#',
        '####################',
      ],
      spawns: [
        { col: 7,  row: 2, type: 'patrol', angle: Math.PI },
        { col: 14, row: 2, type: 'patrol', angle: Math.PI * 0.5 },
        { col: 5,  row: 5, type: 'patrol', angle: 0 },
        { col: 11, row: 5, type: 'patrol', angle: Math.PI },
        { col: 15, row: 6, type: 'heavy',  angle: Math.PI },
        { col: 6,  row: 9, type: 'patrol', angle: 0 },
        { col: 11, row: 9, type: 'patrol', angle: Math.PI },
        { col: 17, row: 9, type: 'heavy',  angle: Math.PI },
      ],
      lights: [
        { col: 2.5,  row: 2.0, color: [0.0, 0.92, 1.0], radius: 290, intensity: 1.25 },
        { col: 9.0,  row: 2.0, color: [1.0, 0.20, 0.6], radius: 310, intensity: 1.20 },
        { col: 16.0, row: 2.5, color: [0.0, 0.88, 1.0], radius: 310, intensity: 1.25 },
        { col: 5.0,  row: 5.8, color: [0.0, 0.95, 0.8], radius: 320, intensity: 1.20 },
        { col: 14.5, row: 5.8, color: [1.0, 0.55, 0.1], radius: 330, intensity: 1.25 },
        { col: 13.5, row: 9.0, color: [1.0, 0.18, 0.5], radius: 320, intensity: 1.30 },
      ],
    },
    {
      id: 'CAMPAIGN-02',
      name: '02 // CRYO-VAULT SUB-44',
      floorTile: 'floor_vault',
      ambient: [0.08, 0.13, 0.24],
      map: [
        '####################',
        '#E..#...S...#......#',
        '#...D.......G..S...#',
        '#...#...S...#......#',
        '##D######D######D###',
        '#...G..........G...#',
        '#...G..S....S..G...#',
        '##D######G######D###',
        '#......#....#......#',
        '#..S...D....D...S..#',
        '####################',
      ],
      spawns: [
        { col: 6,  row: 2, type: 'patrol', angle: Math.PI },
        { col: 10, row: 2, type: 'heavy',  angle: Math.PI },
        { col: 17, row: 2, type: 'turret', angle: Math.PI },
        { col: 2,  row: 6, type: 'patrol', angle: -Math.PI * 0.5 },
        { col: 9,  row: 5, type: 'heavy',  angle: Math.PI },
        { col: 11, row: 6, type: 'patrol', angle: 0 },
        { col: 17, row: 6, type: 'heavy',  angle: -Math.PI * 0.5 },
        { col: 5,  row: 9, type: 'patrol', angle: 0 },
        { col: 9,  row: 9, type: 'turret', angle: -Math.PI * 0.5 },
        { col: 14, row: 9, type: 'heavy',  angle: Math.PI },
      ],
      lights: [
        { col: 2.0,  row: 2.0, color: [0.0, 0.95, 1.0], radius: 280, intensity: 1.25 },
        { col: 8.5,  row: 2.0, color: [0.0, 0.75, 1.0], radius: 320, intensity: 1.3 },
        { col: 16.0, row: 2.0, color: [1.0, 0.15, 0.3], radius: 300, intensity: 1.3 },
        { col: 9.5,  row: 5.5, color: [0.0, 0.95, 1.0], radius: 350, intensity: 1.3 },
        { col: 4.0,  row: 9.0, color: [1.0, 0.25, 0.7], radius: 290, intensity: 1.2 },
        { col: 15.5, row: 9.0, color: [0.0, 0.90, 1.0], radius: 310, intensity: 1.25 },
      ],
    },
    {
      id: 'CAMPAIGN-03',
      name: '03 // EXECUTIVE SKY-PENTHOUSE',
      floorTile: 'floor_exec',
      ambient: [0.14, 0.09, 0.18],
      map: [
        '####################',
        '#E..G.......#......#',
        '#...G...T...D..T...#',
        '###D#####G######D###',
        '#.......#...#......#',
        '#..T....D...D...S..#',
        '#.......#...#......#',
        '###G#####G######D###',
        '#.......G..........#',
        '#..S....D....T.....#',
        '####################',
      ],
      spawns: [
        { col: 6,  row: 2, type: 'patrol', angle: Math.PI },
        { col: 10, row: 2, type: 'heavy',  angle: Math.PI },
        { col: 17, row: 2, type: 'heavy',  angle: Math.PI },
        { col: 5,  row: 5, type: 'patrol', angle: -Math.PI * 0.5 },
        { col: 10, row: 5, type: 'turret', angle: Math.PI },
        { col: 14, row: 5, type: 'heavy',  angle: Math.PI * 0.5 },
        { col: 5,  row: 8, type: 'heavy',  angle: 0 },
        { col: 11, row: 8, type: 'patrol', angle: Math.PI },
        { col: 15, row: 9, type: 'exec',   angle: Math.PI },
        { col: 17, row: 8, type: 'heavy',  angle: Math.PI },
      ],
      lights: [
        { col: 2.0,  row: 2.0, color: [0.0, 1.0, 0.65], radius: 250, intensity: 1.15 },
        { col: 8.0,  row: 2.0, color: [1.0, 0.72, 0.2], radius: 300, intensity: 1.25 },
        { col: 16.0, row: 2.0, color: [1.0, 0.20, 0.6], radius: 290, intensity: 1.30 },
        { col: 10.0, row: 5.5, color: [0.0, 0.90, 1.0], radius: 320, intensity: 1.25 },
        { col: 5.0,  row: 9.0, color: [1.0, 0.20, 0.5], radius: 280, intensity: 1.20 },
        { col: 16.0, row: 9.0, color: [1.0, 0.80, 0.2], radius: 340, intensity: 1.45 },
      ],
    },
  ];

  // Mulberry32 PRNG for deterministic Daily Contracts
  function hashSeed(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildDailyContract(seedStr) {
    const today = seedStr || new Date().toISOString().slice(0, 10);
    const rng = mulberry32(hashSeed('BREACH-DAILY-' + today));
    const tiles = ['floor_slate', 'floor_vault', 'floor_exec'];
    const floorTile = tiles[Math.floor(rng() * tiles.length)];

    // Start from blank shell and carve 3 horizontal zones & 3 vertical rooms
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) {
        if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
          row.push('#');
        } else {
          row.push('.');
        }
      }
      grid.push(row);
    }

    grid[1][1] = 'E';

    // Horizontal partition walls at row 4 and row 7
    const hRows = [4, 7];
    hRows.forEach((hr) => {
      for (let c = 1; c < COLS - 1; c++) {
        grid[hr][c] = rng() < 0.22 ? 'G' : '#';
      }
      // Guarantee 3 doors across each horizontal partition
      const d1 = 2 + Math.floor(rng() * 4);
      const d2 = 8 + Math.floor(rng() * 4);
      const d3 = 14 + Math.floor(rng() * 4);
      grid[hr][d1] = 'D';
      grid[hr][d2] = 'D';
      grid[hr][d3] = 'D';
    });

    // Vertical dividers in each band
    const bands = [[1, 3], [5, 6], [8, 9]];
    bands.forEach(([r0, r1]) => {
      const vc1 = 5 + Math.floor(rng() * 3);
      const vc2 = 12 + Math.floor(rng() * 3);
      [vc1, vc2].forEach((vc) => {
        for (let r = r0; r <= r1; r++) {
          grid[r][vc] = rng() < 0.35 ? 'G' : '#';
        }
        const doorRow = r0 + Math.floor(rng() * (r1 - r0 + 1));
        grid[doorRow][vc] = 'D';
      });
    });

    // Add cover props ('S' or 'T') in open spaces
    const spawns = [];
    for (let r = 1; r < ROWS - 1; r++) {
      for (let c = 3; c < COLS - 1; c++) {
        if (grid[r][c] !== '.') continue;
        // Don't block doors
        const nearDoor =
          grid[r - 1][c] === 'D' ||
          grid[r + 1][c] === 'D' ||
          grid[r][c - 1] === 'D' ||
          grid[r][c + 1] === 'D';
        if (nearDoor) continue;

        const roll = rng();
        if (roll < 0.09) {
          grid[r][c] = rng() < 0.5 ? 'S' : 'T';
        } else if (roll > 0.87 && spawns.length < 10 && (c > 4 || r > 3)) {
          const tRoll = rng();
          const type =
            spawns.length === 9
              ? 'exec'
              : tRoll < 0.55
              ? 'patrol'
              : tRoll < 0.85
              ? 'heavy'
              : 'turret';
          spawns.push({
            col: c,
            row: r,
            type,
            angle: Math.floor(rng() * 4) * (Math.PI * 0.5),
          });
        }
      }
    }

    // Guarantee at least 7 enemies including an HVT exec
    if (spawns.length < 7) {
      spawns.push({ col: 16, row: 9, type: 'exec', angle: Math.PI });
    }

    const lights = [
      { col: 3.0,  row: 2.0, color: [0.0, 0.95, 1.0], radius: 280, intensity: 1.2 },
      { col: 10.0, row: 2.0, color: [1.0, 0.22, 0.65], radius: 300, intensity: 1.2 },
      { col: 16.5, row: 2.0, color: [0.0, 0.85, 1.0], radius: 280, intensity: 1.2 },
      { col: 9.5,  row: 5.5, color: [1.0, 0.65, 0.15], radius: 330, intensity: 1.25 },
      { col: 4.5,  row: 9.0, color: [0.0, 0.95, 0.75], radius: 290, intensity: 1.2 },
      { col: 15.5, row: 9.0, color: [1.0, 0.20, 0.55], radius: 320, intensity: 1.35 },
    ];

    return {
      id: 'DAILY-' + today,
      name: 'DAILY // CONTRACT ' + today,
      floorTile,
      ambient: [0.10, 0.13, 0.22],
      map: grid.map((r) => r.join('')),
      spawns,
      lights,
    };
  }

  global.BreachLevels = {
    COLS,
    ROWS,
    TILE_SIZE,
    CAMPAIGN_FLOORS,
    buildDailyContract,
  };
})(window);
