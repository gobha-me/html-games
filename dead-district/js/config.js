// ============================================================================
// DEAD DISTRICT // SECTOR 7 — Urban Quarantine Map, Arsenal & Infected Config
// World Coordinate Space: 1600 × 1200 (Crossroads + 4 Enterable Corner Buildings)
// ============================================================================

export const WORLD_W = 1600;
export const WORLD_H = 1200;

export const WEAPONS = [
  {
    id: 'pistol',
    slot: 1,
    name: 'M9 TACTICAL',
    caliber: '9MM PARA',
    damage: 34,
    fireRate: 0.19,
    magSize: 15,
    reloadTime: 1.05,
    pellets: 1,
    spread: 0.04,
    speed: 1080,
    pierce: 1,
    knockback: 45,
    infiniteReserve: true,
    startReserve: 999,
    unlocked: true,
    cost: 0,
    ammoCost: 0,
    color: '#fde047',
  },
  {
    id: 'shotgun',
    slot: 2,
    name: 'REMINGTON 870',
    caliber: '12-GA BUCK',
    damage: 24,
    fireRate: 0.68,
    magSize: 8,
    reloadTime: 1.65,
    pellets: 7,
    spread: 0.24,
    speed: 960,
    pierce: 1,
    knockback: 140,
    infiniteReserve: false,
    startReserve: 48,
    unlocked: true,
    cost: 0,
    ammoCost: 35,
    ammoPack: 24,
    color: '#fb923c',
  },
  {
    id: 'smg',
    slot: 3,
    name: 'MP5-K PDW',
    caliber: '9MM SUBSONIC',
    damage: 25,
    fireRate: 0.085,
    magSize: 32,
    reloadTime: 1.35,
    pellets: 1,
    spread: 0.095,
    speed: 1120,
    pierce: 1,
    knockback: 32,
    infiniteReserve: false,
    startReserve: 160,
    unlocked: false,
    cost: 120,
    ammoCost: 40,
    ammoPack: 96,
    color: '#38bdf8',
  },
  {
    id: 'rifle',
    slot: 4,
    name: 'FN-FAL 7.62 AP',
    caliber: '7.62 NATO AP',
    damage: 78,
    fireRate: 0.18,
    magSize: 20,
    reloadTime: 1.55,
    pellets: 1,
    spread: 0.025,
    speed: 1380,
    pierce: 3, // Punches through 3 infected & ignores Riot Brute armor
    knockback: 110,
    infiniteReserve: false,
    startReserve: 100,
    unlocked: false,
    cost: 220,
    ammoCost: 55,
    ammoPack: 60,
    color: '#a855f7',
  },
  {
    id: 'incinerator',
    slot: 5,
    name: 'M79 THERMITE',
    caliber: '40MM INCEND',
    damage: 95,
    fireRate: 0.95,
    magSize: 4,
    reloadTime: 1.9,
    pellets: 1,
    spread: 0.04,
    speed: 680,
    pierce: 1,
    knockback: 160,
    explosiveFire: true,
    infiniteReserve: false,
    startReserve: 16,
    unlocked: false,
    cost: 300,
    ammoCost: 70,
    ammoPack: 8,
    color: '#f43f5e',
  },
];

export const INFECTED_TYPES = {
  walker: {
    id: 'walker',
    name: 'Shambler',
    hp: 68,
    speed: 78,
    radius: 13,
    damage: 14,
    bounty: 14,
    score: 25,
    color: '#65a30d',
    eyeColor: '#fde047',
  },
  sprinter: {
    id: 'sprinter',
    name: 'Feral Sprinter',
    hp: 46,
    speed: 148,
    radius: 11.5,
    damage: 11,
    bounty: 18,
    score: 35,
    color: '#dc2626',
    eyeColor: '#fca5a5',
  },
  spitter: {
    id: 'spitter',
    name: 'Bile Spitter',
    hp: 62,
    speed: 68,
    radius: 13,
    damage: 12,
    bounty: 24,
    score: 45,
    color: '#10b981',
    eyeColor: '#6ee7b7',
    ranged: true,
  },
  brute: {
    id: 'brute',
    name: 'Riot Juggernaut',
    hp: 290,
    speed: 52,
    radius: 20,
    damage: 28,
    bounty: 55,
    score: 100,
    armored: true,
    color: '#475569',
    eyeColor: '#f97316',
  },
  screamer: {
    id: 'screamer',
    name: 'Necro Screamer',
    hp: 115,
    speed: 92,
    radius: 14,
    damage: 16,
    bounty: 40,
    score: 75,
    screamer: true,
    color: '#9333ea',
    eyeColor: '#e879f9',
  },
};

export function buildDistrictMap() {
  // 4 Enterable Corner Buildings with interior floors, solid concrete walls, and Barricade doorways/windows
  const buildings = [
    {
      id: 'pharmacy',
      name: 'ST. JUDE PHARMACY',
      code: 'BLDG-NW',
      x: 80,
      y: 80,
      w: 440,
      h: 340,
      floorColor: '#131822',
      accent: '#10b981',
    },
    {
      id: 'precinct',
      name: 'PRECINCT 7 ARMORY',
      code: 'BLDG-NE',
      x: 1080,
      y: 80,
      w: 440,
      h: 340,
      floorColor: '#121624',
      accent: '#38bdf8',
    },
    {
      id: 'garage',
      name: 'REDLINE AUTO GARAGE',
      code: 'BLDG-SW',
      x: 80,
      y: 780,
      w: 440,
      h: 340,
      floorColor: '#1a1518',
      accent: '#f59e0b',
    },
    {
      id: 'diner',
      name: 'BLACKOUT DINER',
      code: 'BLDG-SE',
      x: 1080,
      y: 780,
      w: 440,
      h: 340,
      floorColor: '#181320',
      accent: '#f43f5e',
    },
  ];

  const t = 18; // Wall thickness

  // Solid Concrete Building Walls (with 84px doorway/window openings for the 8 Barricades)
  const walls = [
    // --- NW Building (Pharmacy: x=80..520, y=80..420) ---
    { x: 80, y: 80, w: 440, h: t, type: 'wall' },                     // North wall
    { x: 80, y: 80, w: t, h: 340, type: 'wall' },                     // West wall
    // South wall (y=402) with doorway gap x=250..334
    { x: 80, y: 402, w: 170, h: t, type: 'wall' },
    { x: 334, y: 402, w: 186, h: t, type: 'wall' },
    // East wall (x=502) with doorway gap y=210..294
    { x: 502, y: 80, w: t, h: 130, type: 'wall' },
    { x: 502, y: 294, w: t, h: 126, type: 'wall' },

    // --- NE Building (Precinct 7: x=1080..1520, y=80..420) ---
    { x: 1080, y: 80, w: 440, h: t, type: 'wall' },                   // North wall
    { x: 1502, y: 80, w: t, h: 340, type: 'wall' },                   // East wall
    // South wall (y=402) with doorway gap x=1266..1350
    { x: 1080, y: 402, w: 186, h: t, type: 'wall' },
    { x: 1350, y: 402, w: 170, h: t, type: 'wall' },
    // West wall (x=1080) with doorway gap y=210..294
    { x: 1080, y: 80, w: t, h: 130, type: 'wall' },
    { x: 1080, y: 294, w: t, h: 126, type: 'wall' },

    // --- SW Building (Garage: x=80..520, y=780..1120) ---
    { x: 80, y: 1102, w: 440, h: t, type: 'wall' },                   // South wall
    { x: 80, y: 780, w: t, h: 340, type: 'wall' },                    // West wall
    // North wall (y=780) with doorway gap x=250..334
    { x: 80, y: 780, w: 170, h: t, type: 'wall' },
    { x: 334, y: 780, w: 186, h: t, type: 'wall' },
    // East wall (x=502) with doorway gap y=906..990
    { x: 502, y: 780, w: t, h: 126, type: 'wall' },
    { x: 502, y: 990, w: t, h: 130, type: 'wall' },

    // --- SE Building (Diner: x=1080..1520, y=780..1120) ---
    { x: 1080, y: 1102, w: 440, h: t, type: 'wall' },                 // South wall
    { x: 1502, y: 780, w: t, h: 340, type: 'wall' },                  // East wall
    // North wall (y=780) with doorway gap x=1266..1350
    { x: 1080, y: 780, w: 186, h: t, type: 'wall' },
    { x: 1350, y: 780, w: 170, h: t, type: 'wall' },
    // West wall (x=1080) with doorway gap y=906..990
    { x: 1080, y: 780, w: t, h: 126, type: 'wall' },
    { x: 1080, y: 990, w: t, h: 130, type: 'wall' },

    // --- Street Cover: Abandoned Vehicles with Aligned Headlights & Emergency Lightbars ---
    {
      x: 722,
      y: 300,
      w: 136,
      h: 64,
      type: 'vehicle',
      id: 'veh_police',
      sprite: 'veh_police',
      label: 'PD-CRUISER 04',
      subLabel: 'INTERCEPTOR // DUAL XENON + STROBE',
      color: '#1e293b',
      angle: -0.16,
      drawW: 148,
      drawH: 76,
      headlights: [
        { side: 'left', lx: 0.45, ly: -0.26, range: 360, spread: 0.28, color: 'rgba(186, 230, 253, 0.46)', tint: '#bae6fd', state: 'on' },
        { side: 'right', lx: 0.45, ly: 0.26, range: 345, spread: 0.28, color: 'rgba(186, 230, 253, 0.42)', tint: '#bae6fd', state: 'on' },
      ],
      taillights: [
        { lx: -0.46, ly: -0.28, color: '#ef4444' },
        { lx: -0.46, ly: 0.28, color: '#ef4444' },
      ],
      lightbar: {
        type: 'police',
        lx: -0.02,
        ly: 0,
        radius: 195,
      },
    },
    {
      x: 736,
      y: 834,
      w: 148,
      h: 72,
      type: 'vehicle',
      id: 'veh_ambulance',
      sprite: 'veh_ambulance',
      label: 'EMS AMBULANCE 12',
      subLabel: 'TRIAGE RIG // R-BEAM DAMAGED + BEACON',
      color: '#334155',
      angle: 2.98,
      drawW: 164,
      drawH: 88,
      headlights: [
        { side: 'left', lx: 0.46, ly: -0.24, range: 370, spread: 0.30, color: 'rgba(254, 243, 199, 0.44)', tint: '#fef08a', state: 'on' },
        { side: 'right', lx: 0.46, ly: 0.24, range: 290, spread: 0.25, color: 'rgba(254, 243, 199, 0.38)', tint: '#fde047', state: 'flicker' },
      ],
      taillights: [
        { lx: -0.46, ly: -0.34, color: '#ef4444' },
        { lx: -0.46, ly: 0.34, color: '#ef4444' },
      ],
      lightbar: {
        type: 'ambulance',
        lx: 0.15,
        ly: 0,
        radius: 215,
      },
    },
    {
      x: 418,
      y: 556,
      w: 132,
      h: 64,
      type: 'vehicle',
      id: 'veh_taxi',
      sprite: 'veh_taxi',
      label: 'METRO TAXI 718',
      subLabel: 'WRECKED SEDAN // SINGLE AMBER BEAM',
      color: '#422006',
      angle: -0.34,
      drawW: 144,
      drawH: 74,
      headlights: [
        { side: 'left', lx: 0.45, ly: -0.27, range: 310, baseRange: 310, spread: 0.29, color: 'rgba(253, 224, 71, 0.38)', tint: '#fde047', state: 'on' },
        { side: 'right', lx: 0.45, ly: 0.27, range: 0, baseRange: 310, spread: 0.29, color: 'rgba(253, 224, 71, 0.38)', tint: '#fde047', state: 'broken' },
      ],
      taillights: [
        { lx: -0.46, ly: -0.28, color: '#dc2626' },
        { lx: -0.46, ly: 0.28, color: '#dc2626' },
      ],
      lightbar: {
        type: 'taxi',
        lx: -0.04,
        ly: 0,
        radius: 85,
      },
    },
    {
      x: 1048,
      y: 552,
      w: 148,
      h: 72,
      type: 'vehicle',
      id: 'veh_swat',
      sprite: 'veh_swat',
      label: 'SWAT BEARCAT 01',
      subLabel: 'ARMORED VAN // TWIN TACTICAL FLOODS',
      color: '#0f172a',
      angle: 0.14,
      drawW: 162,
      drawH: 86,
      headlights: [
        { side: 'left', lx: 0.46, ly: -0.26, range: 410, spread: 0.32, color: 'rgba(224, 242, 254, 0.48)', tint: '#e0f2fe', state: 'on' },
        { side: 'right', lx: 0.46, ly: 0.26, range: 410, spread: 0.32, color: 'rgba(224, 242, 254, 0.48)', tint: '#e0f2fe', state: 'on' },
      ],
      taillights: [
        { lx: -0.46, ly: -0.28, color: '#3b82f6' },
        { lx: -0.46, ly: 0.28, color: '#ef4444' },
      ],
      lightbar: {
        type: 'swat',
        lx: 0.18,
        ly: 0,
        radius: 185,
      },
    },

    // Central Evacuation Plaza Sandbag / Concrete Pillars (leave wide 140px lanes around center)
    { x: 648, y: 478, w: 46, h: 22, type: 'barrier' },
    { x: 906, y: 478, w: 46, h: 22, type: 'barrier' },
    { x: 648, y: 700, w: 46, h: 22, type: 'barrier' },
    { x: 906, y: 700, w: 46, h: 22, type: 'barrier' },
  ];

  // 8 Destructible / Repairable Doorway Barricades (Players can walk/shoot through; Infected claw down unless breached)
  const barricades = [
    { id: 'nw_s', name: 'Pharmacy South Door',  x: 250,  y: 404, w: 84, h: 14, hp: 200, maxHp: 200, orient: 'h' },
    { id: 'nw_e', name: 'Pharmacy East Door',   x: 504,  y: 210, w: 14, h: 84, hp: 200, maxHp: 200, orient: 'v' },
    { id: 'ne_s', name: 'Precinct South Door',  x: 1266, y: 404, w: 84, h: 14, hp: 200, maxHp: 200, orient: 'h' },
    { id: 'ne_w', name: 'Precinct West Door',   x: 1082, y: 210, w: 14, h: 84, hp: 200, maxHp: 200, orient: 'v' },
    { id: 'sw_n', name: 'Garage North Bay',     x: 250,  y: 782, w: 84, h: 14, hp: 200, maxHp: 200, orient: 'h' },
    { id: 'sw_e', name: 'Garage East Door',     x: 504,  y: 906, w: 14, h: 84, hp: 200, maxHp: 200, orient: 'v' },
    { id: 'se_n', name: 'Diner North Entry',    x: 1266, y: 782, w: 84, h: 14, hp: 200, maxHp: 200, orient: 'h' },
    { id: 'se_w', name: 'Diner West Patio',     x: 1082, y: 906, w: 14, h: 84, hp: 200, maxHp: 200, orient: 'v' },
  ];

  // Flickering Streetlamps & Building Emergency Lights
  const lights = [
    { x: 565, y: 455, r: 175, color: 'rgba(251, 191, 36, 0.22)', flicker: 0.1 },
    { x: 1035, y: 455, r: 175, color: 'rgba(251, 191, 36, 0.22)', flicker: 0.25 },
    { x: 565, y: 745, r: 175, color: 'rgba(251, 191, 36, 0.22)', flicker: 0.18 },
    { x: 1035, y: 745, r: 175, color: 'rgba(251, 191, 36, 0.22)', flicker: 0.08 },
    { x: 800, y: 600, r: 210, color: 'rgba(56, 189, 248, 0.18)', flicker: 0.04 }, // Central Supply Drop Beacon
    // Interior emergency bulbs
    { x: 300, y: 250, r: 185, baseR: 185, color: 'rgba(16, 185, 129, 0.16)', flicker: 0.12 },
    { x: 1300, y: 250, r: 185, baseR: 185, color: 'rgba(56, 189, 248, 0.16)', flicker: 0.12 },
    { x: 300, y: 950, r: 185, baseR: 185, color: 'rgba(245, 158, 11, 0.16)', flicker: 0.12 },
    { x: 1300, y: 950, r: 185, baseR: 185, color: 'rgba(244, 63, 94, 0.16)', flicker: 0.12 },
  ];

  // 4 Safe-Room Interior Wall Breaker Boxes ([E] floods safe-room & doorway approaches with 310px light for 40s)
  const breakers = [
    { id: 'nw_breaker', bldgId: 'pharmacy', name: 'Pharmacy Floodlight Breaker', x: 126, y: 126, lightIdx: 5, activeTimer: 0, color: '#10b981' },
    { id: 'ne_breaker', bldgId: 'precinct', name: 'Precinct Armory Breaker',     x: 1474, y: 126, lightIdx: 6, activeTimer: 0, color: '#38bdf8' },
    { id: 'sw_breaker', bldgId: 'garage',   name: 'Garage High-Bay Breaker',     x: 126, y: 1074, lightIdx: 7, activeTimer: 0, color: '#f59e0b' },
    { id: 'se_breaker', bldgId: 'diner',    name: 'Diner Neon Grid Breaker',     x: 1474, y: 1074, lightIdx: 8, activeTimer: 0, color: '#f43f5e' },
  ];

  return { buildings, walls, barricades, lights, breakers };
}
