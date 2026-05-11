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
};

export const PLAYER_START = {
  hp: 20,
  hpMax: 20,
  attack: 5,
  inkMax: 6,
};

export const ENEMY_STATS = {
  drip: { hp: 4, hpMax: 4, attack: 2, glyph: '~', name: 'ink-drip' },
};

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
