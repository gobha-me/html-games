// ============================================================================
// BACKBEAT // OVERDRIVE — Track Roster, Difficulties, Judgement & Lane Config
// ============================================================================

export const LANES = 4;
export const LANE_KEYS = ['KeyD', 'KeyF', 'KeyJ', 'KeyK'];
export const LANE_ALT_KEYS = ['ArrowLeft', 'ArrowDown', 'ArrowUp', 'ArrowRight'];
export const LANE_LABELS = ['D', 'F', 'J', 'K'];
export const LANE_COLORS = ['#00d4ff', '#ff2ec4', '#ffd21f', '#10b981'];
export const LANE_GLOWS = [
  'rgba(0, 212, 255, 0.45)',
  'rgba(255, 46, 196, 0.45)',
  'rgba(255, 210, 31, 0.45)',
  'rgba(16, 185, 129, 0.45)',
];

export const DIFFICULTY = {
  club: {
    id: 'club',
    label: 'CLUB',
    perfect: 85,
    good: 155,
    leadSec: 2.1,
    scoreMul: 1.0,
    density: 0.55,
    allowChords: false,
    allowHolds: true,
  },
  tour: {
    id: 'tour',
    label: 'TOUR',
    perfect: 60,
    good: 120,
    leadSec: 1.65,
    scoreMul: 1.25,
    density: 0.8,
    allowChords: true,
    allowHolds: true,
  },
  hyperdrive: {
    id: 'hyperdrive',
    label: 'HYPERDRIVE',
    perfect: 45,
    good: 95,
    leadSec: 1.32,
    scoreMul: 1.5,
    density: 1.0,
    allowChords: true,
    allowHolds: true,
  },
  encore: {
    id: 'encore',
    label: 'ENCORE',
    perfect: 34,
    good: 78,
    leadSec: 1.08,
    scoreMul: 2.4,
    density: 1.35,
    allowChords: true,
    allowHolds: true,
  },
};
// Backward-compatible aliases
DIFFICULTY.easy = DIFFICULTY.club;
DIFFICULTY.normal = DIFFICULTY.tour;
DIFFICULTY.hard = DIFFICULTY.hyperdrive;

export const JUDGE = {
  PERFECT: 'perfect',
  GOOD: 'good',
  MISS: 'miss',
};

export const SCORE = {
  perfect: 350,
  good: 140,
  miss: 0,
  holdTick: 35,
};

export const TRACK_ROSTER = [
  {
    id: 'anthem',
    title: 'BACKBEAT ANTHEM',
    artist: 'Venice Studio Original',
    genre: 'ELECTRO ANTHEM',
    bpm: 120,
    duration: 88,
    cover: 'assets/art/cover_anthem.png',
    audioUrl: 'assets/backbeat-track.mp3',
    chartUrl: 'charts/backbeat-anthem.json',
    accent: '#00d4ff',
    synthStyle: 'anthem',
  },
  {
    id: 'synthwave',
    title: 'NEON HORIZON',
    artist: 'FM-84 // Procedural Synth',
    genre: 'OUTRUN SYNTHWAVE',
    bpm: 118,
    duration: 74,
    cover: 'assets/art/cover_synthwave.png',
    audioUrl: null, // Real-time WebAudio multi-track synth
    chartUrl: null,
    accent: '#ff2ec4',
    synthStyle: 'synthwave',
  },
  {
    id: 'chiptune',
    title: 'CHIPTUNE OVERDRIVE',
    artist: 'YM2612 // Bitcrusher Core',
    genre: '16-BIT BOSS RUSH',
    bpm: 140,
    duration: 72,
    cover: 'assets/art/cover_chiptune.png',
    audioUrl: null,
    chartUrl: null,
    accent: '#ffd21f',
    synthStyle: 'chiptune',
  },
  {
    id: 'industrial',
    title: 'CYBERPUNK GRIND',
    artist: 'Sector-9 // Acid 303 Rig',
    genre: 'DARK INDUSTRIAL',
    bpm: 132,
    duration: 76,
    cover: 'assets/art/cover_industrial.png',
    audioUrl: null,
    chartUrl: null,
    accent: '#10b981',
    synthStyle: 'industrial',
  },
];

export const TRACK_CATALOG = TRACK_ROSTER;

export const TOUR_VENUES = [
  {
    stage: 1,
    id: 'rustbelt',
    name: 'RUSTBELT BASEMENT ARCADE',
    trackId: 'anthem',
    diffId: 'club',
    goalScore: 10000,
    skyColor: '#120828',
    accent: '#00d4ff',
    gearBadge: 'CASIO SK-1 SAMPLER',
  },
  {
    stage: 2,
    id: 'starlight',
    name: 'STARLIGHT NEON ROLLER RINK',
    trackId: 'synthwave',
    diffId: 'tour',
    goalScore: 18000,
    skyColor: '#2a0636',
    accent: '#ff2ec4',
    gearBadge: 'JUNO-106 CHORUS',
  },
  {
    stage: 3,
    id: 'sunset',
    name: 'SUNSET STRIP AMPHITHEATER',
    trackId: 'chiptune',
    diffId: 'tour',
    goalScore: 26000,
    skyColor: '#2b1206',
    accent: '#ffd21f',
    gearBadge: 'SH-101 KEYTAR',
  },
  {
    stage: 4,
    id: 'miami',
    name: 'MIAMI VICE PIER BROADCAST',
    trackId: 'industrial',
    diffId: 'hyperdrive',
    goalScore: 34000,
    skyColor: '#052420',
    accent: '#10b981',
    gearBadge: 'TR-808 BOOM RIG',
  },
  {
    stage: 5,
    id: 'tokyo',
    name: 'TOKYO DOME MIDNIGHT FINALE',
    trackId: 'anthem',
    diffId: 'encore',
    goalScore: 48000,
    skyColor: '#280640',
    accent: '#e879f9',
    gearBadge: 'GOLDEN FAIRLIGHT CMI',
  },
];

export function judgeOffset(absOffsetMs, difficultyId) {
  const w = DIFFICULTY[difficultyId] || DIFFICULTY.tour;
  if (absOffsetMs <= w.perfect) return JUDGE.PERFECT;
  if (absOffsetMs <= w.good) return JUDGE.GOOD;
  return null;
}

export function computeLetterGrade(accuracy) {
  if (accuracy >= 97) return { grade: 'S+', color: '#00ffcc' };
  if (accuracy >= 92) return { grade: 'S', color: '#38bdf8' };
  if (accuracy >= 84) return { grade: 'A', color: '#10b981' };
  if (accuracy >= 72) return { grade: 'B', color: '#ffd21f' };
  return { grade: 'C', color: '#ff4d6d' };
}
