// ============================================================================
// AETHERIUM // PINBALL — Table Geometry, Alchemical Rules & Boss Rituals
// Coordinate Space: 520 × 900 logical playfield units
// ============================================================================

export const TABLE_W = 520;
export const TABLE_H = 900;
export const BALL_RADIUS = 10.5;
export const GRAVITY = 610; // Downward table slope acceleration (px/s^2)
export const SUBSTEPS = 8;  // 60Hz * 8 = 480Hz sub-stepped collision solver

export const TRANSMUTE_WORD = ['T', 'R', 'A', 'N', 'S', 'M', 'U', 'T', 'E'];

export const BOSS_RITUALS = [
  {
    id: 'gargoyle',
    tier: 'RITUAL I',
    name: 'THE BRASS GARGOYLE',
    subtitle: 'Clockwork Sentinel of the First Seal',
    maxHp: 320,
    radius: 30,
    color: '#d4a853',
    glow: '#fde047',
    accent: '#f59e0b',
    shieldCount: 2,
    shieldSpeed: 1.5,
    rewardScore: 75000,
    desc: 'Strike the Gargoyle past its rotating brass shields or shatter its Homunculi.',
  },
  {
    id: 'ouroboros',
    tier: 'RITUAL II',
    name: 'THE OUROBOROS ENGINE',
    subtitle: 'Serpent of Perpetual Calcination',
    maxHp: 480,
    radius: 32,
    color: '#f43f5e',
    glow: '#fb7185',
    accent: '#eab308',
    shieldCount: 3,
    shieldSpeed: -2.1,
    rewardScore: 150000,
    desc: 'Evade or shatter Cinnabar Orbs and pierce the Serpent Core to ignite Multiball.',
  },
  {
    id: 'alchemist',
    tier: 'RITUAL III',
    name: 'THE GRAND ALCHEMIST',
    subtitle: 'Architect of the Magnum Opus',
    maxHp: 680,
    radius: 34,
    color: '#a855f7',
    glow: '#e879f9',
    accent: '#38bdf8',
    shieldCount: 4,
    shieldSpeed: 2.6,
    rewardScore: 300000,
    desc: 'Shatter the 4-Seal Aether Barrier to complete the Philosopher’s Stone!',
  },
];

// Generate smooth polyline segments for curved playfield arches & loops
function arcSegments(cx, cy, r, startAngle, endAngle, steps, restitution = 0.72) {
  const segs = [];
  for (let i = 0; i < steps; i++) {
    const a0 = startAngle + ((endAngle - startAngle) * i) / steps;
    const a1 = startAngle + ((endAngle - startAngle) * (i + 1)) / steps;
    segs.push({
      x1: cx + Math.cos(a0) * r,
      y1: cy + Math.sin(a0) * r,
      x2: cx + Math.cos(a1) * r,
      y2: cy + Math.sin(a1) * r,
      r: 4,
      e: restitution,
    });
  }
  return segs;
}

export function buildTableGeometry() {
  const walls = [
    // Outer Left Wall (below upper arch)
    { x1: 14, y1: 250, x2: 14, y2: 790, r: 5, e: 0.7 },
    // Outer Right Shooter-Lane Wall
    { x1: 506, y1: 250, x2: 506, y2: 868, r: 5, e: 0.7 },
    // Shooter Lane Bottom Floor
    { x1: 468, y1: 868, x2: 506, y2: 868, r: 5, e: 0.4 },
    // Shooter Lane Inner Divider Wall
    { x1: 468, y1: 225, x2: 468, y2: 868, r: 4.5, e: 0.72 },

    // Left Outlane -> Drain Apron
    { x1: 14, y1: 790, x2: 138, y2: 874, r: 5, e: 0.6 },
    // Right Outlane -> Drain Apron
    { x1: 468, y1: 790, x2: 344, y2: 874, r: 5, e: 0.6 },

    // Left Inlane / Outlane Divider Post & Guide Rail (feeds Left Main Flipper)
    { x1: 54, y1: 668, x2: 54, y2: 744, r: 4, e: 0.72 },
    { x1: 54, y1: 744, x2: 146, y2: 795, r: 4.5, e: 0.65 },

    // Right Inlane / Outlane Divider Post & Guide Rail (feeds Right Main Flipper)
    { x1: 428, y1: 668, x2: 428, y2: 744, r: 4, e: 0.72 },
    { x1: 428, y1: 744, x2: 336, y2: 795, r: 4.5, e: 0.65 },

    // Left Slingshot Side & Bottom Walls
    { x1: 88, y1: 662, x2: 88, y2: 736, r: 4, e: 0.75 },
    { x1: 88, y1: 736, x2: 138, y2: 765, r: 4, e: 0.75 },

    // Right Slingshot Side & Bottom Walls
    { x1: 394, y1: 662, x2: 394, y2: 736, r: 4, e: 0.75 },
    { x1: 394, y1: 736, x2: 344, y2: 765, r: 4, e: 0.75 },

    // Upper-Left Flipper Guide Rail
    { x1: 14, y1: 418, x2: 60, y2: 458, r: 4.5, e: 0.7 },

    // Philosopher's Crucible Saucer Backstop Arch (Upper-Left Alcove)
    { x1: 68, y1: 298, x2: 112, y2: 288, r: 4, e: 0.65 },
    { x1: 112, y1: 288, x2: 132, y2: 318, r: 4, e: 0.65 },

    // Right Mid Spinner Channel Guide Post
    { x1: 368, y1: 356, x2: 368, y2: 446, r: 4, e: 0.75 },
    { x1: 424, y1: 340, x2: 448, y2: 458, r: 4, e: 0.75 },

    // Top Rollover Lane Divider Fins (S - U - N)
    { x1: 145, y1: 88, x2: 145, y2: 146, r: 3.5, e: 0.75 },
    { x1: 209, y1: 82, x2: 209, y2: 142, r: 3.5, e: 0.75 },
    { x1: 273, y1: 82, x2: 273, y2: 142, r: 3.5, e: 0.75 },
    { x1: 337, y1: 88, x2: 337, y2: 146, r: 3.5, e: 0.75 },
  ];

  // Top Crown Arch connecting shooter lane (x=506, y=250) over the dome to left wall (x=14, y=250)
  walls.push(...arcSegments(260, 250, 246, -Math.PI, 0, 32, 0.74));

  // Inner Upper Right Guide Arch (separates shooter lane top from playfield right orbit)
  walls.push(...arcSegments(388, 225, 80, -Math.PI * 0.48, 0, 12, 0.72));

  // Active Slingshot Kicker Faces
  const slingshots = [
    {
      id: 'left_sling',
      x1: 88,
      y1: 662,
      x2: 138,
      y2: 765,
      nx: 0.899,
      ny: -0.438,
      kickSpeed: 590,
      flash: 0,
    },
    {
      id: 'right_sling',
      x1: 394,
      y1: 662,
      x2: 344,
      y2: 765,
      nx: -0.899,
      ny: -0.438,
      kickSpeed: 590,
      flash: 0,
    },
  ];

  // One-Way Gate at top of Shooter Lane so launched balls enter the playfield and never fall back into shooter lane
  const gates = [
    {
      x1: 468,
      y1: 225,
      x2: 506,
      y2: 192,
      // Normal pointing UP-LEFT into playfield: balls moving up/left pass; balls moving right/down toward shooter lane bounce off
      passNx: -0.75,
      passNy: -0.66,
    },
  ];

  // 3 Flippers: Left Main, Right Main, and Upper-Left Sanctum Flipper
  const flippers = [
    {
      id: 'left',
      side: 'left',
      px: 146,
      py: 795,
      length: 77,
      rBase: 10,
      rTip: 6.5,
      restAngle: 0.44,    // +25.2 deg
      activeAngle: -0.50, // -28.6 deg
      angle: 0.44,
      omega: 0,
    },
    {
      id: 'right',
      side: 'right',
      px: 336,
      py: 795,
      length: 77,
      rBase: 10,
      rTip: 6.5,
      restAngle: Math.PI - 0.44,
      activeAngle: Math.PI + 0.50,
      angle: Math.PI - 0.44,
      omega: 0,
    },
    {
      id: 'upper_left',
      side: 'left',
      px: 60,
      py: 458,
      length: 56,
      rBase: 8.5,
      rTip: 5.5,
      restAngle: 0.50,
      activeAngle: -0.42,
      angle: 0.50,
      omega: 0,
    },
  ];

  // 5 Pop Bumpers (3 Upper Astrolabe + 2 Mid Alchemical Coils)
  const bumpers = [
    { id: 'mercury', x: 175, y: 206, r: 23, kick: 560, score: 1500, reagent: 'mercury', label: 'Hg', color: '#38bdf8', glow: '#bae6fd', flash: 0 },
    { id: 'sulfur',  x: 307, y: 206, r: 23, kick: 560, score: 1500, reagent: 'sulfur',  label: 'S',  color: '#f43f5e', glow: '#fecdd3', flash: 0 },
    { id: 'aurum',   x: 241, y: 268, r: 25, kick: 600, score: 2500, reagent: 'azoth',   label: 'Au', color: '#f59e0b', glow: '#fef08a', flash: 0 },
    { id: 'salt_coil', x: 156, y: 522, r: 18, kick: 510, score: 1200, reagent: 'salt',  label: 'Na', color: '#10b981', glow: '#a7f3d0', flash: 0 },
    { id: 'vitriol_coil', x: 326, y: 522, r: 18, kick: 510, score: 1200, reagent: 'mercury', label: 'Vi', color: '#a855f7', glow: '#e9d5ff', flash: 0 },
  ];

  // 2 Banks of 3 Drop Targets (Left = SALT Bank, Right = SULFUR Bank)
  const dropTargets = [
    // Left Bank (Salt)
    { id: 'L0', bank: 'left',  x1: 28, y1: 520, x2: 28, y2: 548, r: 5, down: false, color: '#10b981', letterIdx: 0 },
    { id: 'L1', bank: 'left',  x1: 28, y1: 556, x2: 28, y2: 584, r: 5, down: false, color: '#10b981', letterIdx: 1 },
    { id: 'L2', bank: 'left',  x1: 28, y1: 592, x2: 28, y2: 620, r: 5, down: false, color: '#10b981', letterIdx: 2 },
    // Right Bank (Sulfur)
    { id: 'R0', bank: 'right', x1: 454, y1: 520, x2: 454, y2: 548, r: 5, down: false, color: '#f43f5e', letterIdx: 3 },
    { id: 'R1', bank: 'right', x1: 454, y1: 556, x2: 454, y2: 584, r: 5, down: false, color: '#f43f5e', letterIdx: 4 },
    { id: 'R2', bank: 'right', x1: 454, y1: 592, x2: 454, y2: 620, r: 5, down: false, color: '#f43f5e', letterIdx: 5 },
  ];

  // Top 3 Crown Rollovers (SOL - LUNA - AZOTH) + 4 Lower Inlane/Outlane Rollovers
  const rollovers = [
    { id: 'top_sol',   group: 'crown', label: 'SOL',   x: 177, y: 114, r: 13, lit: false, color: '#f59e0b' },
    { id: 'top_luna',  group: 'crown', label: 'LUNA',  x: 241, y: 110, r: 13, lit: false, color: '#38bdf8' },
    { id: 'top_azoth', group: 'crown', label: 'AZOTH', x: 305, y: 114, r: 13, lit: false, color: '#a855f7' },
    { id: 'in_left',   group: 'lane',  label: 'T',     x: 71,  y: 702, r: 11, lit: false, color: '#10b981', letterIdx: 6 },
    { id: 'in_right',  group: 'lane',  label: 'E',     x: 411, y: 702, r: 11, lit: false, color: '#10b981', letterIdx: 8 },
    { id: 'out_left',  group: 'lane',  label: 'U',     x: 34,  y: 702, r: 11, lit: false, color: '#f59e0b', letterIdx: 7 },
    { id: 'out_right', group: 'lane',  label: 'M',     x: 448, y: 702, r: 11, lit: false, color: '#f59e0b', letterIdx: 5 },
  ];

  // Philosopher's Crucible Capture Saucer (Upper-Left Sanctum)
  const saucer = {
    x: 96,
    y: 322,
    r: 17,
    holdTimer: 0,
    heldBall: null,
  };

  // Right Corridor Alchemical Spinner
  const spinner = {
    x: 396,
    y: 402,
    r: 20,
    angle: 0,
    angVel: 0,
  };

  return { walls, slingshots, gates, flippers, bumpers, dropTargets, rollovers, saucer, spinner };
}
