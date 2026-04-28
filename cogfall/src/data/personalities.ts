// AI personality weights. Each faction's personality maps to a row of these
// scores, which drive the AI's tech/build/diplomacy decisions. AI_THINKING_LINES
// supplies flavor text for the "thinking" spinner shown during AI turns.

export const PERSONALITIES = {
  industrial: {
    mil: 0.5,
    sci: 0.55,
    econ: 0.7,
    expand: 0.55,
    agg: 0.3,
    defenseFocus: 0.55,
    prefBranch: 'industry',
  },
  scientific: {
    mil: 0.3,
    sci: 0.9,
    econ: 0.4,
    expand: 0.4,
    agg: 0.2,
    defenseFocus: 0.7,
    prefBranch: 'science',
  },
  militaristic: {
    mil: 0.95,
    sci: 0.3,
    econ: 0.4,
    expand: 0.7,
    agg: 0.85,
    defenseFocus: 0.4,
    prefBranch: 'industry',
  },
  defensive: {
    mil: 0.55,
    sci: 0.55,
    econ: 0.5,
    expand: 0.5,
    agg: 0.15,
    defenseFocus: 0.95,
    prefBranch: 'expansion',
  },
  economic: {
    mil: 0.4,
    sci: 0.4,
    econ: 0.95,
    expand: 0.7,
    agg: 0.4,
    defenseFocus: 0.5,
    prefBranch: 'economy',
  },
} as const;

export const AI_THINKING_LINES = {
  industrial: ['gauges its forges...', 'consults its blueprints...', 'oils its gears...'],
  scientific: [
    'traces aether currents...',
    'whispers to old machines...',
    'reads forbidden tomes...',
  ],
  militaristic: ['mobilizes its forces...', 'sharpens its bayonets...', 'plots its march...'],
  defensive: ['tends its walls...', 'walks the perimeter...', 'reads the weather...'],
  economic: ['counts its coin...', 'studies the markets...', 'cuts new contracts...'],
} as const;

export type PersonalityId = keyof typeof PERSONALITIES;
export type PersonalityDef = (typeof PERSONALITIES)[PersonalityId];
