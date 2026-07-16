// Dieselpunk theme layer for Frontline. Names + ladder tiers + AI decks, ported
// verbatim from the Claude Design prototype (Frontline Dieselpunk.dc.html). The
// engine keeps its neutral ids; only display names change.

export const THEME_NAMES = {
  scout: 'Recon Runner', skirm: 'Trench Raider', picket: 'Sandbag Line', foot: 'Rifleman', archer: 'Mortar Team',
  shieldb: 'Barricade Crew', duel: 'Shock Trooper', adder: 'Gas Grenadier', banner: 'Signal Officer', vet: 'Line Sergeant',
  cross: 'Field Gun', warden: 'Bunker Guard', champ: 'Armored Car', lancer: 'Breacher Tank', marks: 'Howitzer',
  outrider: 'Dispatch Rider', van: 'Land Dreadnought', ballista: 'Rail Cannon', warlord: 'Field Marshal',
  bolt: 'Artillery Strike', volley: 'Creeping Barrage', reinf: 'Fortify', insight: 'Intel Report', redeploy: 'Forced March',
};

export const KW_NAMES = { guard: 'Bulwark', shield: 'Plated', rally: 'Rally', haste: 'Rapid', venom: 'Gas', pierce: 'Overrun' };

export const SPELL_LINE = { bolt: '3 dmg to a unit', volley: '1 dmg to all enemies', reinforce: '+1 pow / +2 ♥', insight: 'draw 2 cards', redeploy: 'move your unit' };

export const AI_DECKS = {
  MID: null,
  AGGRO: ['skirm', 'duel', 'scout', 'foot', 'adder', 'outrider', 'lancer', 'banner', 'vet', 'reinf', 'bolt', 'champ'],
  GUARDIAN: ['picket', 'shieldb', 'warden', 'banner', 'vet', 'champ', 'van', 'warlord', 'cross', 'reinf', 'bolt', 'insight'],
  RANGED: ['archer', 'cross', 'marks', 'ballista', 'picket', 'shieldb', 'warden', 'foot', 'bolt', 'insight', 'vet', 'volley'],
};

export const COMMANDERS = ['Col. Vesta Kray', 'Maj. Odo Brandt', 'Capt. Iris Falke', 'Cmdr. Silas Vane', 'Lt. Mara Voss', 'Sgt. Ruben Falk', 'Capt. Elka Dorn', 'Maj. Casimir Roth', 'Col. Petra Steel', 'Cmdr. Anselm Grey', 'Lt. Freya Holt', 'Sgt. Viktor Lange'];

export const TIERS = [[950, 'Conscript', '#8a8065'], [1000, 'Private', '#988d70'], [1050, 'Corporal', '#b3a88a'], [1100, 'Sergeant', '#9db35e'], [1150, 'Lieutenant', '#c9a227'], [1200, 'Captain', '#c9a227'], [1300, 'Major', '#d06a52'], [9999, 'Field Marshal', '#e8dfc6']];

export function tierOf(r) { for (const t of TIERS) if (r < t[0]) return t; return TIERS[TIERS.length - 1]; }

export function shuf(a) { for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
