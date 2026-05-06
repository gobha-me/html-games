// Level definitions for Breakout
// Each level: { name, rows, cols, brickColors, layout, specialBricks, ballSpeed, paddleWidth }
// layout: 2D array (0 = empty, 1 = normal, 2 = tough (2 hits), 3 = explosive, 4 = indestructible)
// specialBricks: array of {row, col, type: 'powerup'|'boss', powerupType?}

const LEVELS = [
  {
    name: "First Light",
    rows: 5,
    cols: 10,
    brickColors: ["#f43f5e", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa"],
    ballSpeed: 5,
    paddleWidth: 100,
    layout: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1],
      [0,1,1,1,1,1,1,1,1,0],
      [0,0,1,1,1,1,1,1,0,0],
    ],
    specialBricks: [{ row: 2, col: 5, type: 'powerup', powerupType: 'paddle-extend' }]
  },
  {
    name: "Checkerboard",
    rows: 6,
    cols: 10,
    brickColors: ["#f43f5e", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa", "#f97316"],
    ballSpeed: 5.5,
    paddleWidth: 100,
    layout: [
      [1,0,1,0,1,0,1,0,1,0],
      [0,1,0,1,0,1,0,1,0,1],
      [1,0,1,0,1,0,1,0,1,0],
      [0,1,0,1,0,1,0,1,0,1],
      [1,0,1,0,1,0,1,0,1,0],
      [0,1,0,1,0,1,0,1,0,1],
    ],
    specialBricks: [
      { row: 1, col: 3, type: 'powerup', powerupType: 'multi-ball' },
      { row: 4, col: 7, type: 'powerup', powerupType: 'sticky-paddle' }
    ]
  },
  {
    name: "Fortress",
    rows: 7,
    cols: 10,
    brickColors: ["#f43f5e", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa", "#f97316", "#ec4899"],
    ballSpeed: 5.5,
    paddleWidth: 95,
    layout: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,0,1],
      [1,0,2,2,2,2,2,2,0,1],
      [1,0,2,0,0,0,0,2,0,1],
      [1,0,2,0,1,1,0,2,0,1],
      [1,0,2,2,2,2,2,2,0,1],
      [1,0,0,0,0,0,0,0,0,1],
    ],
    specialBricks: [
      { row: 4, col: 4, type: 'powerup', powerupType: 'laser' },
      { row: 4, col: 5, type: 'powerup', powerupType: 'paddle-extend' }
    ]
  },
  {
    name: "Diamond",
    rows: 7,
    cols: 10,
    brickColors: ["#f43f5e", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa", "#f97316", "#ec4899"],
    ballSpeed: 6,
    paddleWidth: 95,
    layout: [
      [0,0,0,0,1,1,0,0,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,1,1,2,2,1,1,0,0],
      [0,1,1,2,3,3,2,1,1,0],
      [0,0,1,1,2,2,1,1,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,0,0,1,1,0,0,0,0],
    ],
    specialBricks: [
      { row: 3, col: 4, type: 'powerup', powerupType: 'multi-ball' },
      { row: 3, col: 5, type: 'powerup', powerupType: 'laser' }
    ]
  },
  {
    name: "Boss Fight I",
    rows: 6,
    cols: 10,
    brickColors: ["#f43f5e", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa", "#f97316"],
    ballSpeed: 6,
    paddleWidth: 90,
    layout: [
      [0,0,0,0,4,4,0,0,0,0],
      [0,0,0,4,4,4,4,0,0,0],
      [0,0,4,4,2,2,4,4,0,0],
      [0,0,4,4,2,2,4,4,0,0],
      [0,0,0,4,4,4,4,0,0,0],
      [0,0,0,0,4,4,0,0,0,0],
    ],
    specialBricks: [
      { row: 2, col: 4, type: 'boss', hp: 10 },
      { row: 2, col: 5, type: 'boss', hp: 10 },
      { row: 3, col: 4, type: 'boss', hp: 10 },
      { row: 3, col: 5, type: 'boss', hp: 10 },
    ]
  },
  {
    name: "Zigzag",
    rows: 8,
    cols: 10,
    brickColors: ["#f43f5e", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa", "#f97316", "#ec4899", "#14b8a6"],
    ballSpeed: 6.5,
    paddleWidth: 90,
    layout: [
      [1,1,1,1,0,0,1,1,1,1],
      [0,0,0,1,0,0,1,0,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
      [1,1,1,1,0,0,1,1,1,1],
      [0,0,0,1,0,0,1,0,0,0],
      [0,0,0,1,1,1,1,0,0,0],
      [0,0,0,0,0,0,0,0,0,0],
    ],
    specialBricks: [
      { row: 0, col: 2, type: 'powerup', powerupType: 'paddle-extend' },
      { row: 4, col: 7, type: 'powerup', powerupType: 'multi-ball' },
      { row: 2, col: 5, type: 'powerup', powerupType: 'sticky-paddle' }
    ]
  },
  {
    name: "Explosive Core",
    rows: 7,
    cols: 10,
    brickColors: ["#f43f5e", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa", "#f97316", "#ec4899"],
    ballSpeed: 6.5,
    paddleWidth: 85,
    layout: [
      [1,1,1,1,1,1,1,1,1,1],
      [1,3,1,1,1,1,1,1,3,1],
      [1,1,3,1,1,1,1,3,1,1],
      [1,1,1,3,1,1,3,1,1,1],
      [1,1,1,1,3,3,1,1,1,1],
      [1,1,1,1,3,3,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1],
    ],
    specialBricks: [
      { row: 5, col: 4, type: 'powerup', powerupType: 'laser' },
      { row: 5, col: 5, type: 'powerup', powerupType: 'paddle-extend' }
    ]
  },
  {
    name: "Gauntlet",
    rows: 8,
    cols: 10,
    brickColors: ["#f43f5e", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa", "#f97316", "#ec4899", "#14b8a6"],
    ballSpeed: 7,
    paddleWidth: 85,
    layout: [
      [2,2,2,2,2,2,2,2,2,2],
      [0,0,0,0,0,0,0,0,0,0],
      [1,1,1,1,1,1,1,1,1,1],
      [0,0,0,0,0,0,0,0,0,0],
      [3,3,3,3,3,3,3,3,3,3],
      [0,0,0,0,0,0,0,0,0,0],
      [2,2,2,2,2,2,2,2,2,2],
      [0,0,0,0,0,0,0,0,0,0],
    ],
    specialBricks: [
      { row: 2, col: 0, type: 'powerup', powerupType: 'multi-ball' },
      { row: 2, col: 9, type: 'powerup', powerupType: 'multi-ball' },
      { row: 4, col: 4, type: 'powerup', powerupType: 'laser' },
      { row: 4, col: 5, type: 'powerup', powerupType: 'laser' }
    ]
  },
  {
    name: "Boss Fight II",
    rows: 7,
    cols: 10,
    brickColors: ["#f43f5e", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa", "#f97316", "#ec4899"],
    ballSpeed: 7,
    paddleWidth: 80,
    layout: [
      [0,0,0,4,4,4,4,0,0,0],
      [0,0,4,4,4,4,4,4,0,0],
      [0,4,4,2,2,2,2,4,4,0],
      [0,4,4,2,4,4,2,4,4,0],
      [0,4,4,2,2,2,2,4,4,0],
      [0,0,4,4,4,4,4,4,0,0],
      [0,0,0,4,4,4,4,0,0,0],
    ],
    specialBricks: [
      { row: 2, col: 3, type: 'boss', hp: 15 },
      { row: 2, col: 4, type: 'boss', hp: 15 },
      { row: 2, col: 5, type: 'boss', hp: 15 },
      { row: 2, col: 6, type: 'boss', hp: 15 },
      { row: 3, col: 4, type: 'boss', hp: 20 },
      { row: 3, col: 5, type: 'boss', hp: 20 },
    ]
  },
  {
    name: "Final Stand",
    rows: 8,
    cols: 10,
    brickColors: ["#f43f5e", "#f59e0b", "#10b981", "#38bdf8", "#a78bfa", "#f97316", "#ec4899", "#14b8a6"],
    ballSpeed: 7.5,
    paddleWidth: 80,
    layout: [
      [2,2,2,2,2,2,2,2,2,2],
      [2,3,2,3,2,2,3,2,3,2],
      [2,2,3,2,2,2,2,3,2,2],
      [1,1,1,1,1,1,1,1,1,1],
      [1,3,1,3,1,1,3,1,3,1],
      [1,1,1,1,1,1,1,1,1,1],
      [2,2,2,2,2,2,2,2,2,2],
      [3,3,3,3,3,3,3,3,3,3],
    ],
    specialBricks: [
      { row: 0, col: 4, type: 'powerup', powerupType: 'multi-ball' },
      { row: 0, col: 5, type: 'powerup', powerupType: 'multi-ball' },
      { row: 3, col: 2, type: 'powerup', powerupType: 'laser' },
      { row: 3, col: 7, type: 'powerup', powerupType: 'laser' },
      { row: 6, col: 4, type: 'powerup', powerupType: 'paddle-extend' },
      { row: 6, col: 5, type: 'powerup', powerupType: 'sticky-paddle' }
    ]
  }
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LEVELS };
}
