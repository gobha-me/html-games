export const CELL = 18;
export const MAP_W = 52;
export const MAP_H = 30;
export const CANVAS_W = 960;
export const CANVAS_H = 600;

export const TILE = {
  VOID: 0,
  FLOOR: 1,
  WALL: 2,
};

export const KIND = {
  PLAYER: 'player',
  DRIP: 'drip',
  SMEAR: 'smear',
  SCRAWL: 'scrawl',
  MARGINALIA: 'marginalia',
  FOXING: 'foxing',
  ERRATUM: 'erratum',
  BOSS_MARGIN_LORD: 'boss_margin_lord',
  BOSS_FRONTISPIECE: 'boss_frontispiece',
  BOSS_COLOPHON: 'boss_colophon',
  STAIRS: 'stairs',
  ITEM_INKPOT: 'item_inkpot',
  ITEM_CLOTH: 'item_cloth',
  ITEM_SEAL: 'item_seal',
  ITEM_NIB: 'item_nib',
  ITEM_MARGINALIA: 'item_marginalia',
  ITEM_FOUNTAIN_PEN: 'item_fountain_pen',
  ITEM_REED_PEN: 'item_reed_pen',
  GLYPH_STRIKE: 'glyph_strike',
  GLYPH_WARD: 'glyph_ward',
  GLYPH_SIGHT: 'glyph_sight',
  GLYPH_BIND: 'glyph_bind',
  GLYPH_ERASE: 'glyph_erase',
};

export const SPELLS = {
  strike: { name: 'Strike', cost: 2, effect: 'damage', power: 6, range: 1 },
  ward:   { name: 'Ward',   cost: 3, effect: 'buff',   turns: 4 },
  sight:  { name: 'Sight',  cost: 2, effect: 'fov',    bonus: 6, turns: 6 },
  bind:   { name: 'Bind',   cost: 4, effect: 'bind',   turns: 4 },
  erase:  { name: 'Erase',  cost: 5, effect: 'erase',  range: 4, hpMaxDmg: 8, bossHpMaxDmg: 3 },
};

export const GLYPHS = {
  glyph_strike: {
    spell: 'strike',
    glyph: '*',
    color: '#8a2a22',
    name: 'glyph of Strike',
    pickup: 'A glyph of Strike burns into your memory.',
  },
  glyph_ward: {
    spell: 'ward',
    glyph: '+',
    color: '#5a4ea0',
    name: 'glyph of Ward',
    pickup: 'A glyph of Ward burns into your memory.',
  },
  glyph_sight: {
    spell: 'sight',
    glyph: '?',
    color: '#b8923d',
    name: 'glyph of Sight',
    pickup: 'A glyph of Sight burns into your memory.',
  },
  glyph_bind: {
    spell: 'bind',
    glyph: '-',
    color: '#4a3018',
    name: 'glyph of Bind',
    pickup: 'A glyph of Bind burns into your memory.',
  },
  glyph_erase: {
    spell: 'erase',
    glyph: '/',
    color: '#7a1d18',
    name: 'glyph of Erase',
    pickup: 'A glyph of Erase burns into your memory.',
  },
};

export const ITEMS = {
  item_inkpot: {
    glyph: 'i',
    name: 'inkpot',
    color: '#3b3478',
    effect: 'ink',
    amount: 3,
    pickup: 'You pocket the inkpot.',
    use: 'You uncork the inkpot — your nib drinks deep.',
  },
  item_cloth: {
    glyph: 'c',
    name: 'blotting cloth',
    color: '#8c6a3a',
    effect: 'heal',
    amount: 5,
    pickup: 'You tuck the blotting cloth into your sleeve.',
    use: 'You press the blotting cloth to your wounds.',
  },
  item_seal: {
    glyph: 'o',
    name: 'wax seal',
    color: '#5a1d18',
    effect: 'seal',
    pickup: 'A wax seal — heavy in the palm.',
    use: 'You break the wax seal. Sigils crawl over your skin.',
  },
  item_nib: {
    glyph: 'n',
    name: 'quill nib',
    color: '#2a1f14',
    effect: 'nibUpgrade',
    amount: 1,
    pickup: 'A spare nib, finely cut.',
    use: 'You fit the new nib to your quill — sharper, surer.',
  },
  item_marginalia: {
    glyph: 'm',
    name: 'marginalia',
    color: '#4a3018',
    effect: 'marginalia',
    amount: 2,
    pickup: 'A scrap of marginalia, ink still wet.',
    use: 'You smear the marginalia along your sleeve — the next kills will leave glyphs.',
  },
  item_fountain_pen: {
    glyph: 'F',
    name: 'fountain pen',
    color: '#1a0e06',
    effect: 'fountainUpgrade',
    amount: 2,
    pickup: 'A fountain pen, heavy with reservoir.',
    use: 'You hand your quill the fountain pen — the nib drinks twice as wide.',
  },
  item_reed_pen: {
    glyph: 'r',
    name: 'reed pen',
    color: '#8c6a3a',
    effect: 'reedUpgrade',
    amount: 1,
    pickup: 'A cut reed, sharpened to a chisel.',
    use: 'You exchange your quill briefly for the reed — every glyph costs one less ink.',
  },
};

export const ITEMS_PER_PAGE = [1, 2];

export const PLAYER_START = {
  hp: 20,
  hpMax: 20,
  attack: 5,
  inkMax: 6,
};

export const ENEMY_STATS = {
  drip:       { hp: 4,  hpMax: 4,  attack: 2, glyph: '~', name: 'ink-drip' },
  smear:      { hp: 9,  hpMax: 9,  attack: 3, glyph: '&', name: 'ink-smear' },
  scrawl:     { hp: 3,  hpMax: 3,  attack: 3, glyph: '%', name: 'ink-scrawl' },
  marginalia: { hp: 2,  hpMax: 2,  attack: 2, glyph: ',', name: 'marginalia' },
  foxing:     { hp: 6,  hpMax: 6,  attack: 1, glyph: 'f', name: 'foxing' },
  erratum:    { hp: 5,  hpMax: 5,  attack: 4, glyph: '!', name: 'erratum' },
};

export const FOXING_HEAL = 1;
export const ERRATUM_TELEPORT_PERIOD = 4;
export const INK_FAMILY_KINDS = ['drip', 'smear', 'scrawl'];

export const BOSS_STATS = {
  boss_margin_lord:  { hp: 28, hpMax: 28, attack: 5, glyph: 'M', name: 'Margin-Lord' },
  boss_frontispiece: { hp: 40, hpMax: 40, attack: 6, glyph: 'F', name: 'Frontispiece' },
  boss_colophon:     { hp: 60, hpMax: 60, attack: 7, glyph: 'C', name: 'Colophon' },
};

export const FRONTISPIECE_DRIP_PERIOD = 3;

export const PALETTE = {
  parchment: '#f3e8c8',
  parchmentDeep: '#e6d5a8',
  wallInk: '#3a2a1a',
  wallStain: '#5a4030',
  floor: '#d8c393',
  floorShade: '#cab47e',
  ink: '#1a120a',
  inkSoft: '#2a1f14',
  blood: '#5a1d18',
  player: '#1a1208',
  drip: '#3a2018',
  smear: '#1a0e06',
  scrawl: '#3b3478',
  marginalia: '#6b4a2a',
  foxing: '#8a4a1d',
  erratum: '#5a1d18',
  bossMarginLord: '#2a1d6b',
  bossFrontispiece: '#5a1d18',
  bossColophon: '#1a0e06',
  stairs: '#5a3a18',
  accent: '#3b3478',
  highlight: '#b8923d',
};

export const FONT_GLYPH = '600 18px "JetBrains Mono", "Courier New", monospace';
export const FONT_UI = '"IM Fell English", "Crimson Pro", Georgia, serif';

export const DRIPS_MIN = 6;
export const DRIPS_MAX = 10;

export const ROOMS_MIN = 6;
export const ROOMS_MAX = 10;
export const ROOM_W = [4, 9];
export const ROOM_H = [3, 6];

export const FOV_RADIUS = 8;
