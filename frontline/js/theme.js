// Unified theme & curriculum definitions for Frontline (Dieselpunk), Hexwire (Cyberpunk), and Rift Crossover.

export const THEME_NAMES = {
  scout: 'Recon Runner', skirm: 'Trench Raider', picket: 'Sandbag Line', foot: 'Rifleman', archer: 'Mortar Team',
  shieldb: 'Barricade Crew', duel: 'Shock Trooper', adder: 'Gas Grenadier', banner: 'Signal Officer', vet: 'Line Sergeant',
  cross: 'Field Gun', warden: 'Bunker Guard', champ: 'Armored Car', lancer: 'Breacher Tank', marks: 'Howitzer',
  outrider: 'Dispatch Rider', van: 'Land Dreadnought', ballista: 'Rail Cannon', warlord: 'Field Marshal',
  puppet: 'Rift Puppeteer',
  bolt: 'Artillery Strike', volley: 'Creeping Barrage', reinf: 'Fortify', insight: 'Intel Report', redeploy: 'Forced March',
  possess: 'Rift Possession',
};

export const FCOL = { chrome: '#53c7ff', hex: '#c77dff', street: '#ffb02e', trench: '#c9a227' };

export const KW_NAMES_FL = {
  guard: 'Bulwark', shield: 'Plated', rally: 'Rally', haste: 'Rapid', venom: 'Gas', pierce: 'Overrun', subvert: 'Subvert'
};

export const KW_NAMES_HW = {
  guard: 'Guard', shield: 'Ward', rally: 'Rally', haste: 'Wired', venom: 'Curse', pierce: 'Pierce', subvert: 'Subvert'
};

export const KW_NAMES = KW_NAMES_FL;

export const KW_REMINDER = {
  guard: 'Enemies in this sector/block must strike this unit first — before your back row.',
  shield: 'The first hit each engagement bounces off with no damage.',
  rally: 'On deploy: +{n} power to adjacent allies in its row.',
  haste: 'Fights the turn it deploys — no dig-in / sleep.',
  venom: 'Any damage it deals reduces the target to 0 ♥.',
  pierce: 'Damage past the target’s ♥ carries through to the enemy HQ / face.',
  subvert: 'On deploy: seizes an enemy unit in this lane of cost ≤{n} and hides beneath it until destroyed.',
};

export const SPELL_LINE = {
  bolt: '3 dmg to a unit',
  volley: '1 dmg to all enemies',
  reinforce: '+1 pow / +2 ♥',
  insight: 'draw 2 cards',
  redeploy: 'move your unit',
  possess: 'steal enemy (cost ≤2)',
};

export const AI_DECKS = {
  MID: null,
  AGGRO: ['skirm', 'duel', 'scout', 'foot', 'adder', 'outrider', 'lancer', 'banner', 'vet', 'reinf', 'bolt', 'champ'],
  GUARDIAN: ['picket', 'shieldb', 'warden', 'banner', 'vet', 'champ', 'van', 'warlord', 'cross', 'reinf', 'bolt', 'insight'],
  RANGED: ['archer', 'cross', 'marks', 'ballista', 'picket', 'shieldb', 'warden', 'foot', 'bolt', 'insight', 'vet', 'volley'],
};

export const HW_AI_DECKS = {
  MID: { name: 'Mixed Crew', ids: null },
  CHROME: { name: 'Chrome', ids: ['skirm', 'duel', 'scout', 'foot', 'adder', 'outrider', 'lancer', 'banner', 'vet', 'reinf', 'bolt', 'champ'] },
  STREET: { name: 'Street', ids: ['picket', 'shieldb', 'warden', 'banner', 'vet', 'champ', 'van', 'warlord', 'cross', 'reinf', 'bolt', 'insight'] },
  HEX: { name: 'Hex', ids: ['adder', 'warden', 'puppet', 'possess', 'bolt', 'redeploy', 'banner', 'vet', 'shieldb', 'champ', 'insight', 'van'] },
  RANDOM: { name: 'Scratch', ids: null },
};

export const COMMANDERS = [
  'Col. Vesta Kray', 'Maj. Odo Brandt', 'Capt. Iris Falke', 'Cmdr. Silas Vane',
  'Lt. Mara Voss', 'Sgt. Ruben Falk', 'Capt. Elka Dorn', 'Maj. Casimir Roth',
  'Col. Petra Steel', 'Cmdr. Anselm Grey', 'Lt. Freya Holt', 'Sgt. Viktor Lange'
];

export const TIERS = [
  [950, 'Conscript', '#8a8065'], [1000, 'Private', '#988d70'], [1050, 'Corporal', '#b3a88a'],
  [1100, 'Sergeant', '#9db35e'], [1150, 'Lieutenant', '#c9a227'], [1200, 'Captain', '#c9a227'],
  [1300, 'Major', '#d06a52'], [9999, 'Field Marshal', '#e8dfc6']
];

export function tierOf(r) {
  for (const t of TIERS) if (r < t[0]) return t;
  return TIERS[TIERS.length - 1];
}

export const HW_LADDER = [
  { h: 'nullpntr', r: 1873, w: 61, l: 22 }, { h: 'hex_maria', r: 1841, w: 55, l: 25 },
  { h: 'GhostOnMain', r: 1790, w: 48, l: 26 }, { h: 'w1tchdoc', r: 1742, w: 44, l: 29 },
  { h: 'chromefiend', r: 1701, w: 39, l: 30 }, { h: 'BackAlleyOracle', r: 1666, w: 36, l: 31 },
  { h: 'sig_lost', r: 1620, w: 31, l: 30 }, { h: 'daemon_dot', r: 1588, w: 28, l: 33 },
];

export const HW_LESSONS = [
  { title: 'FENCE & THE CLOCK', p: [[1, 0, 'foot']], hand: ['bolt'], energy: 0, steps: [
    { do: 'bank', card: 'bolt', text: 'Energy comes from fencing stolen goods. Tap "Fence a card", then the Hexbolt — +1 income, permanently.' },
    { do: 'end', text: 'Your Ganger (2/0) owns Block 2 and nobody is home across the street. End turn.' }],
    recap: 'Unanswered blocks hit the face — 2 straight to the rival. Income refills every turn: the fence is your economy, the open lane is your clock.' },
  { title: 'STREET vs OVERWATCH', o: [[0, 0, 'shieldb']], p: [[0, 1, 'archer']], hand: ['picket'], energy: 1, steps: [
    { do: 'deploy', card: 'picket', row: 0, lane: 0, text: 'Your Watch Drone (1/2) is exposed — Block 1\'s street is empty, and melee walks straight into the back row. Tap the Bouncer, then Block 1 STREET.' },
    { do: 'end', text: 'End turn — the drone strikes from safety while the Bouncer takes the hit.' }],
    recap: 'Power reads street/overwatch: 2 from the back — but only while someone holds the street in front.' },
  { title: 'GUARD', o: [[1, 0, 'champ']], p: [[1, 0, 'duel', 1]], hand: ['picket'], energy: 1, steps: [
    { do: 'deploy', card: 'picket', row: 1, lane: 1, text: 'A rival Enforcer (4/0) is about to gut your 3/2 Switchblade. Deploy the Bouncer — GUARD — to Block 2 OVERWATCH, behind it.' },
    { do: 'end', text: 'End turn. Guard drags every attack in the block onto itself — even from the back row.' }],
    recap: 'The Enforcer was forced to hit the Bouncer instead — your Switchblade lives to swing next turn. Guards are cheap bodies that decide who takes the damage.' },
  { title: 'WARD', o: [[0, 0, 'champ']], hand: ['warden'], energy: 3, steps: [
    { do: 'deploy', card: 'warden', row: 0, lane: 0, text: 'Another Enforcer, Block 1. Deploy the Wardkeeper — its WARD eats the first hit entirely. Block 1 STREET.' },
    { do: 'end', text: 'End turn and watch 4 damage hit the ward.' }],
    recap: 'Ward deleted the whole hit — 4 damage, gone. One-time only: the WRD tag disappears once spent. Wards buy tempo against big single hits, not swarms.' },
  { title: 'WIRED', o: [[2, 1, 'archer']], hand: ['skirm'], energy: 1, steps: [
    { do: 'deploy', card: 'skirm', row: 0, lane: 2, text: 'A rival drone sits in Block 3 overwatch with an EMPTY street — fully exposed. Deploy the Ripper (WIRED) to Block 3 STREET.' },
    { do: 'end', text: 'End turn. Wired units fight the turn they land.' }],
    recap: 'Kill confirmed. Normal units arrive napping (zzz) and fight next turn — Wired ones swing immediately. Wired is how you punish an open street right now.' },
  { title: 'PIERCE', o: [[0, 0, 'scout']], hand: ['lancer'], energy: 4, steps: [
    { do: 'deploy', card: 'lancer', row: 0, lane: 0, text: 'A 1-power, 2♥ Lookout is chump-blocking Block 1. Deploy the Breacher (4/0, PIERCE) right into it — Block 1 STREET.' },
    { do: 'end', text: 'End turn — 4 damage into a 2♥ body. Watch the overflow.' }],
    recap: 'Pierce carries the excess through: 2 killed the Lookout, 2 hit the face. Chump-blockers blunt Pierce — they never stop it.' },
  { title: 'LINKS & RALLY', p: [[0, 0, 'foot'], [2, 0, 'foot']], hand: ['banner'], energy: 3, steps: [
    { do: 'deploy', card: 'banner', row: 0, lane: 1, text: 'Two Gangers hold Blocks 1 and 3. Deploy the Fixer (◀2 2▶, RALLY 1) between them — Block 2 STREET.' },
    { do: 'end', text: 'End turn. Watch the +bonus light up on your power numbers.' }],
    recap: 'Rally gave both neighbors +1 forever; Links (◀ ▶) lend +2 sideways every turn. Placement order is a puzzle — and removal that snipes the middle of a line breaks two links at once.' },
  { title: 'THE SOLVE', puzzle: true, oppLife: 6, o: [[0, 0, 'shieldb'], [1, 0, 'adder']], p: [[0, 0, 'champ'], [2, 1, 'marks']], hand: ['skirm'], energy: 2, steps: [
    { do: 'deploy', card: 'skirm', row: 0, text: 'Final exam — rival at 6♥, your whole crew attacks when you end turn. Place the Ripper so EXACTLY 6 reaches the face. Who is blocked? Where is nobody home?' },
    { do: 'end', text: 'End turn — prove it.' }],
    fail: 'Trades feel good, but face damage wins games. The Riot Shield guards Block 1, the Curseblade holds Block 2…' },
];

export function shuf(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
