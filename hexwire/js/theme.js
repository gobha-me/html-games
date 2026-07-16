// Neon-noir theme layer for Hexwire, ported verbatim from the Claude Design
// prototype (Hexwire Prototype.dc.html). Card display names live in engine.js
// POOL already, so there is no name-override map here — only faction colors,
// spell lines, AI crews, the sim ladder and the tutorial script.

// Faction accent colors — must match ART-DIRECTION §3.
export const FCOL = { chrome: '#53c7ff', hex: '#c77dff', street: '#ffb02e' };

export const SPELL_LINE = {
  bolt: '3 dmg to a unit', volley: '1 dmg to all enemies', reinforce: '+1 pow / +2 ♥',
  insight: 'draw 2 cards', redeploy: 'move your unit', possess: 'steal enemy (cost ≤2)',
};

// Rival crew playbooks. `null` ids => the engine STARTER deck.
export const AI_DECKS = {
  MID: { name: 'Mixed Crew', ids: null },
  CHROME: { name: 'Chrome', ids: ['skirm', 'duel', 'scout', 'foot', 'adder', 'outrider', 'lancer', 'banner', 'vet', 'reinf', 'bolt', 'champ'] },
  STREET: { name: 'Street', ids: ['picket', 'shieldb', 'warden', 'banner', 'vet', 'champ', 'van', 'warlord', 'cross', 'reinf', 'bolt', 'insight'] },
  HEX: { name: 'Hex', ids: ['adder', 'warden', 'puppet', 'possess', 'bolt', 'redeploy', 'banner', 'vet', 'shieldb', 'champ', 'insight', 'van'] },
  RANDOM: { name: 'Scratch', ids: null },
};

// Fixed simulated ladder (handles + rating/record) — the street leaderboard.
export const LADDER = [
  { h: 'nullpntr', r: 1873, w: 61, l: 22 }, { h: 'hex_maria', r: 1841, w: 55, l: 25 }, { h: 'GhostOnMain', r: 1790, w: 48, l: 26 },
  { h: 'w1tchdoc', r: 1742, w: 44, l: 29 }, { h: 'chromefiend', r: 1701, w: 39, l: 30 }, { h: 'BackAlleyOracle', r: 1666, w: 36, l: 31 },
  { h: 'sig_lost', r: 1620, w: 31, l: 30 }, { h: 'daemon_dot', r: 1588, w: 28, l: 33 },
];

// Seven-step guided tutorial. `allow` gates which action the step permits.
export const TUT = [
  { allow: 'bank', bankId: 'bolt', text: 'TUTORIAL 1/6 — Energy comes from fencing. Tap "Fence a card", then fence the Hexbolt (+1 permanent income).' },
  { allow: 'deploy', cardId: 'skirm', row: 0, text: '2/6 — Deploy the Ripper (1⚡) to a STREET cell. It is WIRED: it fights the turn it lands.' },
  { allow: 'end', text: '3/6 — End your turn. Combat is automatic: your Ripper swings down its block, and empty blocks hit the enemy face.' },
  { allow: 'bank', bankId: 'picket', text: '4/6 — Fence the Bouncer. Income is permanent — energy refills to it every turn.' },
  { allow: 'deploy', cardId: 'archer', row: 1, text: '5/6 — Deploy the Watch Drone (2⚡) to OVERWATCH. It strikes with no retaliation — but stays safe only while a friendly unit holds the street in front.' },
  { allow: 'end', text: '6/6 — End turn. Watch the lane meters (↓↑): an unanswered block is a damage clock on your face.' },
  { allow: null, text: 'You are live — win it. Links ◀▶ boost neighbors; Hex crews can steal units (kill the stolen unit to expose the Puppeteer). Tap this banner to dismiss.' },
];

export function shuf(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

// Simulated Algorand wallet address helpers (non-custodial flavor only).
const A32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function fakeAddr() { let s = ''; for (let i = 0; i < 58; i++) s += A32[(Math.random() * 32) | 0]; return s; }
export const trunc = a => a ? a.slice(0, 4) + '…' + a.slice(-4) : '';
