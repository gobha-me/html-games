// ============================================================================
// AETHERIUM // PINBALL — Table Geometry, Alchemical Rules & Boss Rituals
// Coordinate Space: 520 × 900 logical playfield units
// ============================================================================

export const TABLE_W = 520;
export const TABLE_H = 900;
export const BALL_RADIUS = 9.5;
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
    { x1: 18, y1: 250, x2: 18, y2: 798, r: 4, e: 0.7 },
    // Outer Right Shooter-Lane Wall
    { x1: 502, y1: 250, x2: 502, y2: 868, r: 4, e: 0.7 },
    // Shooter Lane Bottom Floor
    { x1: 466, y1: 868, x2: 502, y2: 868, r: 4, e: 0.4 },
    // Shooter Lane Inner Divider Wall (Right Playfield Wall, terminates cleanly at y=236 so upper arch is wide open)
    { x1: 458, y1: 224, x2: 466, y2: 246, r: 4, e: 0.72 },
    { x1: 466, y1: 246, x2: 466, y2: 798, r: 4, e: 0.72 },
    // Lower Shooter Lane Divider (below right drain corner)
    { x1: 466, y1: 798, x2: 466, y2: 868, r: 4, e: 0.72 },

    // Left Outlane -> Drain Apron
    { x1: 18, y1: 798, x2: 144, y2: 868, r: 4, e: 0.6 },
    // Right Outlane -> Drain Apron
    { x1: 466, y1: 798, x2: 340, y2: 868, r: 4, e: 0.6 },

    // Left Inlane / Outlane Divider Post & Wide-Corner Guide Rail (feeds flush onto Left Main Flipper top surface)
    { x1: 56, y1: 656, x2: 56, y2: 742, r: 3.5, e: 0.72 },
    { x1: 56, y1: 742, x2: 144, y2: 786, r: 4.0, e: 0.55 },

    // Right Inlane / Outlane Divider Post & Wide-Corner Guide Rail (feeds flush onto Right Main Flipper top surface)
    { x1: 428, y1: 656, x2: 428, y2: 742, r: 3.5, e: 0.72 },
    { x1: 428, y1: 742, x2: 340, y2: 786, r: 4.0, e: 0.55 },

    // Left Slingshot Side & Bottom Walls (44px corner clearance above Left Inlane rail)
    { x1: 96, y1: 636, x2: 96, y2: 708, r: 3.5, e: 0.75 },
    { x1: 96, y1: 708, x2: 144, y2: 738, r: 3.5, e: 0.75 },

    // Right Slingshot Side & Bottom Walls (44px corner clearance above Right Inlane rail)
    { x1: 388, y1: 636, x2: 388, y2: 708, r: 3.5, e: 0.75 },
    { x1: 388, y1: 708, x2: 340, y2: 738, r: 3.5, e: 0.75 },

    // Upper-Left Flipper Guide Rail (feeds flush onto Upper-Left Flipper top surface)
    { x1: 18, y1: 416, x2: 62, y2: 452, r: 4, e: 0.6 },

    // Philosopher's Crucible Saucer Backstop Arch (Upper-Left Alcove)
    { x1: 72, y1: 296, x2: 114, y2: 286, r: 3.5, e: 0.65 },
    { x1: 114, y1: 286, x2: 134, y2: 316, r: 3.5, e: 0.65 },

    // Right Mid Spinner Channel Inner Guide Post & Sealed Outer Bevel (no dead-end gap!)
    { x1: 374, y1: 356, x2: 374, y2: 444, r: 3.5, e: 0.75 },
    { x1: 466, y1: 326, x2: 442, y2: 358, r: 3.5, e: 0.75 },
    { x1: 442, y1: 358, x2: 442, y2: 438, r: 3.5, e: 0.75 },
    { x1: 442, y1: 438, x2: 466, y2: 468, r: 3.5, e: 0.75 },

    // Top Rollover Lane Divider Fins (SOL - LUNA - AZOTH)
    { x1: 145, y1: 88, x2: 145, y2: 146, r: 3.5, e: 0.75 },
    { x1: 209, y1: 82, x2: 209, y2: 142, r: 3.5, e: 0.75 },
    { x1: 273, y1: 82, x2: 273, y2: 142, r: 3.5, e: 0.75 },
    { x1: 337, y1: 88, x2: 337, y2: 146, r: 3.5, e: 0.75 },
  ];

  // Top Crown Arch connecting shooter lane (x=502, y=250) over the dome to left wall (x=18, y=250)
  walls.push(...arcSegments(260, 250, 242, -Math.PI, 0, 32, 0.74));

  // Active Slingshot Kicker Faces
  const slingshots = [
    {
      id: 'left_sling',
      x1: 96,
      y1: 636,
      x2: 144,
      y2: 738,
      nx: 0.903,
      ny: -0.429,
      kickSpeed: 590,
      flash: 0,
    },
    {
      id: 'right_sling',
      x1: 388,
      y1: 636,
      x2: 340,
      y2: 738,
      nx: -0.903,
      ny: -0.429,
      kickSpeed: 590,
      flash: 0,
    },
  ];

  // One-Way Gate at top of Shooter Lane: slopes DOWN-LEFT from outer arch (499,205) to divider tip (458,224)
  // so any ball above the gate naturally rolls down-left into the open playfield and can never stall!
  const gates = [
    {
      x1: 458,
      y1: 224,
      x2: 499,
      y2: 205,
      // Normal pointing UP-LEFT into playfield: balls moving up/left pass; balls moving right/down toward shooter lane bounce off
      passNx: -0.42,
      passNy: -0.91,
    },
  ];

  // 3 Flippers: Left Main, Right Main, and Upper-Left Sanctum Flipper
  const flippers = [
    {
      id: 'left',
      side: 'left',
      px: 144,
      py: 794,
      length: 76,
      rBase: 9.5,
      rTip: 6.0,
      restAngle: 0.44,    // +25.2 deg
      activeAngle: -0.50, // -28.6 deg
      angle: 0.44,
      omega: 0,
    },
    {
      id: 'right',
      side: 'right',
      px: 340,
      py: 794,
      length: 76,
      rBase: 9.5,
      rTip: 6.0,
      restAngle: Math.PI - 0.44,
      activeAngle: Math.PI + 0.50,
      angle: Math.PI - 0.44,
      omega: 0,
    },
    {
      id: 'upper_left',
      side: 'left',
      px: 62,
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
    { id: 'L0', bank: 'left',  x1: 30, y1: 520, x2: 30, y2: 548, r: 4.5, down: false, color: '#10b981', letterIdx: 0 },
    { id: 'L1', bank: 'left',  x1: 30, y1: 556, x2: 30, y2: 584, r: 4.5, down: false, color: '#10b981', letterIdx: 1 },
    { id: 'L2', bank: 'left',  x1: 30, y1: 592, x2: 30, y2: 620, r: 4.5, down: false, color: '#10b981', letterIdx: 2 },
    // Right Bank (Sulfur)
    { id: 'R0', bank: 'right', x1: 454, y1: 520, x2: 454, y2: 548, r: 4.5, down: false, color: '#f43f5e', letterIdx: 3 },
    { id: 'R1', bank: 'right', x1: 454, y1: 556, x2: 454, y2: 584, r: 4.5, down: false, color: '#f43f5e', letterIdx: 4 },
    { id: 'R2', bank: 'right', x1: 454, y1: 592, x2: 454, y2: 620, r: 4.5, down: false, color: '#f43f5e', letterIdx: 5 },
  ];

  // Top 3 Crown Rollovers (SOL - LUNA - AZOTH) + 4 Lower Inlane/Outlane Rollovers
  const rollovers = [
    { id: 'top_sol',   group: 'crown', label: 'SOL',   x: 177, y: 114, r: 13, lit: false, color: '#f59e0b' },
    { id: 'top_luna',  group: 'crown', label: 'LUNA',  x: 241, y: 110, r: 13, lit: false, color: '#38bdf8' },
    { id: 'top_azoth', group: 'crown', label: 'AZOTH', x: 305, y: 114, r: 13, lit: false, color: '#a855f7' },
    { id: 'in_left',   group: 'lane',  label: 'T',     x: 76,  y: 688, r: 10, lit: false, color: '#10b981', letterIdx: 6 },
    { id: 'in_right',  group: 'lane',  label: 'E',     x: 408, y: 688, r: 10, lit: false, color: '#10b981', letterIdx: 8 },
    { id: 'out_left',  group: 'lane',  label: 'U',     x: 37,  y: 688, r: 10, lit: false, color: '#f59e0b', letterIdx: 7 },
    { id: 'out_right', group: 'lane',  label: 'M',     x: 447, y: 688, r: 10, lit: false, color: '#f59e0b', letterIdx: 5 },
  ];

  // Philosopher's Crucible Capture Saucer (Upper-Left Sanctum)
  const saucer = {
    x: 100,
    y: 320,
    r: 17,
    holdTimer: 0,
    heldBall: null,
  };

  // Right Corridor Alchemical Spinner
  const spinner = {
    x: 408,
    y: 400,
    r: 20,
    angle: 0,
    angVel: 0,
  };

  return { walls, slingshots, gates, flippers, bumpers, dropTargets, rollovers, saucer, spinner };
}
