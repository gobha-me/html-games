// Match flow + player actions, ported 1:1 from the Claude Design component so the
// game plays byte-for-byte like the prototype. All rules/AI live in engine.js (FL).
import { state, session, setState, ping, myTurn } from './state.js';
import { AI_DECKS, COMMANDERS, shuf } from './theme.js';
import { saveStanding } from './store.js';

function flat(map) { const o = []; for (const k in map) for (let i = 0; i < map[k]; i++) o.push(k); return o; }
export function deckCountOf(d) { let n = 0; for (const k in d.cards) n += d.cards[k]; return n; }

export function startMatch(cardsMap) {
  const FL = session.FL; if (!FL) return;
  FL.CFG.life = session.prefs.startLife ?? 20;
  FL.CFG.p2Extra = 0; FL.CFG.p1SkipDraw = true;
  let mine = cardsMap;
  if (!mine) { const a = state.decks.find(d => d.id === state.activeId); mine = (a && deckCountOf(a) === 24) ? a.cards : session.starterMap; }
  const keys = [...Object.keys(AI_DECKS), 'RANDOM'];
  const key = keys[(Math.random() * keys.length) | 0];
  let aiIds;
  if (key === 'RANDOM') aiIds = shuf(FL.POOL.map(c => c.id)).slice(0, 12).flatMap(x => [x, x]);
  else if (AI_DECKS[key]) aiIds = AI_DECKS[key].flatMap(x => [x, x]);
  else aiIds = FL.STARTER.slice();
  const first = Math.random() < 0.5 ? 'p' : 'o';
  session.g = FL.newGame(flat(mine), aiIds, first);
  const oppName = COMMANDERS[(Math.random() * COMMANDERS.length) | 0];
  setState({ screen: 'match', tut: false, oppName, coin: { first }, busy: true, sel: null, mode: 'play', pendFrom: null, settingsOpen: false });
  setTimeout(() => {
    setState({ coin: null, busy: first === 'o' });
    if (first === 'o') aiLoop();
  }, 2500);
}

// ---------- Field Training: 5-drill scripted curriculum ----------
let _tuid = 50000;
function tutSpawn(g, FL, side, lane, row, id, o) {
  const d = FL.byId(id); o = o || {};
  g.board[side][lane][row] = { uid: _tuid++, id: d.id, name: d.name, pow: d.pow, rng: d.rng, hp: o.hp != null ? o.hp : d.hp, maxhp: d.hp, flanks: d.flanks.slice(), kw: { ...d.kw }, shieldUp: !!d.kw.shield, sick: false };
}

export const TUT_LESSONS = [
  { title: 'DRILL 1 · HOLD THE LINE', hand: ['foot', 'archer'], energy: 4, enemyPhase: false,
    brief: 'Every unit carries two powers, M/R. Melee (M) fights on THE LINE; Ranged (R) fires from the EMPLACEMENT behind it — and cannot be touched while the line holds. The Rifleman is M2, the Mortar Team R2: together 4, enough to flatten a 3♥ Sandbag Line.',
    goal: 'Rifleman → Sector B LINE · Mortar Team → Sector B EMPLACEMENT · then End Turn',
    setup(g, FL) { tutSpawn(g, FL, 'o', 1, 0, 'picket'); },
    allow(id, lane, row) { return (id === 'foot' && lane === 1 && row === 0) || (id === 'archer' && lane === 1 && row === 1); },
    placed(g) { const b = g.board.p; return b[1][0] && b[1][0].id === 'foot' && b[1][1] && b[1][1].id === 'archer'; },
    pass(g) { return !g.board.o[1][0]; },
    passMsg: 'Sandbags flattened — and the mortar never took a scratch. That is the whole game: hold the line, punish from behind it.' },
  { title: 'DRILL 2 · BULWARK & PLATED', hand: ['warden'], energy: 3, enemyPhase: true, entrench: true,
    brief: 'Your Mortar Team stands exposed — a battered Armored Car (M4, ♥3) will erase it next turn. The Bunker Guard has BULWARK (enemies in this sector MUST shoot it first, even before your back row) and PLATED (the first hit bounces off entirely). Fresh troops ENTRENCH for a turn before fighting (unless marked Rapid) — good: an entrenched guard keeps his plating for the enemy’s shot. Put him in front of the mortar and let the car waste it.',
    goal: 'Bunker Guard → Sector B LINE, in front of the mortar · then End Turn',
    setup(g, FL) { tutSpawn(g, FL, 'o', 1, 0, 'champ', { hp: 3 }); tutSpawn(g, FL, 'p', 1, 1, 'archer'); },
    allow(id, lane, row) { return id === 'warden' && lane === 1 && row === 0; },
    placed(g) { const b = g.board.p; return b[1][0] && b[1][0].id === 'warden'; },
    pass(g) { return !g.board.o[1][0] && !!g.board.p[1][1] && !!g.board.p[1][0]; },
    passMsg: 'Bulwark drew the shell, Plated blanked it, and the return fire finished the car. Guards exist to be shot — that is the job.' },
  { title: 'DRILL 3 · RALLY & FLANKS', hand: ['banner'], energy: 3, enemyPhase: false,
    brief: 'RALLY X: the moment it deploys, adjacent allies gain +X power — permanently. FLANKS ◀ ▶: while it stands, a unit lends its flank values to its row neighbours. The Signal Officer is ◀2 2▶ with Rally 1. Alone, neither of your soldiers can crack a 3♥ sandbag wall. Plant him BETWEEN them and watch every number turn gold.',
    goal: 'Signal Officer → Sector B LINE, between your two soldiers · then End Turn',
    setup(g, FL) { tutSpawn(g, FL, 'p', 0, 0, 'foot'); tutSpawn(g, FL, 'p', 2, 0, 'vet'); tutSpawn(g, FL, 'o', 0, 0, 'picket'); tutSpawn(g, FL, 'o', 2, 0, 'picket'); },
    allow(id, lane, row) { return id === 'banner' && lane === 1 && row === 0; },
    placed(g) { const b = g.board.p; return b[1][0] && b[1][0].id === 'banner'; },
    pass(g) { return !g.board.o[0][0] && !g.board.o[2][0]; },
    passMsg: 'Both walls fell to soldiers who could not have cracked them alone — and the Officer marched 3 straight into HQ through the open sector. Formation IS power.' },
  { title: 'DRILL 4 · GAS & OVERRUN', hand: ['adder', 'lancer'], energy: 6, enemyPhase: false,
    brief: 'GAS: any damage it deals is lethal — a 1-power grenadier fells a Land Dreadnought (♥6). OVERRUN: damage beyond the kill spills through to enemy HQ — a Breacher Tank (M4) hitting a half-dead 2♥ scout sends 2 straight to morale. Cheap answers to expensive problems; no wasted damage.',
    goal: 'Gas Grenadier → Sector A LINE · Breacher Tank → Sector C LINE · then End Turn',
    setup(g, FL) { tutSpawn(g, FL, 'o', 0, 0, 'van'); tutSpawn(g, FL, 'o', 2, 0, 'scout', { hp: 2 }); },
    allow(id, lane, row) { return (id === 'adder' && lane === 0 && row === 0) || (id === 'lancer' && lane === 2 && row === 0); },
    placed(g) { const b = g.board.p; return b[0][0] && b[0][0].id === 'adder' && b[2][0] && b[2][0].id === 'lancer'; },
    pass(g) { return !g.board.o[0][0] && !g.board.o[2][0]; },
    passMsg: 'One gas shell, one dreadnought. And the tank rolled straight over the scout into HQ. Now prove you can put it all together.' },
  { title: 'FINAL EXAM · BREAK THROUGH', hand: ['lancer', 'marks'], energy: 8, enemyPhase: true, exam: true,
    brief: 'Enemy HQ is at 5 morale — break it THIS turn. Every sector is blocked: sandbags in A, a Barricade Crew pinning your Shock Trooper in B, a wounded scout in C. Your tools: Breacher Tank (M4, Overrun) and Howitzer (R4). Remember drill 4: Overrun cracks a sector open, and a Howitzer behind the breach fires straight through the hole. Placement is everything.',
    goal: 'Deploy both units to deal 5 damage to HQ · then End Turn',
    setup(g, FL) { g.players.o.life = 5; tutSpawn(g, FL, 'p', 1, 0, 'duel'); tutSpawn(g, FL, 'o', 0, 0, 'picket'); tutSpawn(g, FL, 'o', 1, 0, 'shieldb'); tutSpawn(g, FL, 'o', 2, 0, 'scout', { hp: 2 }); },
    allow(id, lane, row) { return true; },
    placed(g) { let n = 0; for (let l = 0; l < 3; l++) for (let r = 0; r < 2; r++) { const u = g.board.p[l][r]; if (u && (u.id === 'lancer' || u.id === 'marks')) n++; } return n === 2; },
    pass(g) { return g.players.o.life <= 0; },
    passMsg: 'HQ broken. Commission granted — you are ready for the front.',
    failMsg: 'HQ still stands. Stack the breakthrough: Overrun the weakest blocker, and put the Howitzer BEHIND the tank so it fires through the hole. Reset and try again.' },
];

export function startTutorial() { if (!session.FL) return; loadLesson(0); }

export function loadLesson(i) {
  const FL = session.FL, L = TUT_LESSONS[i];
  const mk = life => ({ life, deck: [], hand: [], income: 0, energy: 0, banked: true, fatigue: 0 });
  const eb = () => [[null, null], [null, null], [null, null]];
  const g = { players: { p: mk(20), o: mk(20) }, board: { p: eb(), o: eb() }, tc: { p: 1, o: 0 }, active: 'p', first: 'p', log: [], events: [], over: false, winner: null };
  g.players.p.hand = L.hand.map(id => ({ uid: _tuid++, id }));
  g.players.p.energy = g.players.p.income = L.energy;
  L.setup(g, FL);
  g.log = ['— ' + L.title + ' —'];
  session.g = g;
  setState({ screen: 'match', tut: true, tutStep: i, tutStage: 'act', tutPass: false, oppName: 'Drill Company', coin: null, busy: false, sel: null, mode: 'play', pendFrom: null, settingsOpen: false });
}

function tutEndTurn() {
  const g = session.g, FL = session.FL, L = TUT_LESSONS[state.tutStep];
  if (state.tutStage !== 'act' || !L.placed(g)) { ping(); return; }
  setState({ busy: true, sel: null });
  FL.combat(g, 'p');
  const finish = () => setState({ busy: false, tutStage: 'review', tutPass: L.pass(g) });
  if (L.enemyPhase && !g.over) { ping(); setTimeout(() => { FL.combat(g, 'o'); ping(); setTimeout(finish, 500); }, 800); }
  else setTimeout(finish, 600);
  ping();
}

function applyResult() {
  const g = session.g;
  if (!g || !g.over || g._scored) return;
  g._scored = true;
  if (state.tut) { g._delta = 0; return; }
  if (g.winner === 'p') { g._delta = 18; session.rating += 18; session.record.w++; }
  else if (g.winner === 'o') { g._delta = -12; session.rating = Math.max(800, session.rating - 12); session.record.l++; }
  else g._delta = 0;
  saveStanding(session.rating, session.record);
}

function aiDelay() { return session.prefs.fastAi ? 140 : 620; }

export function endTurn() {
  if (state.tut) return tutEndTurn();
  const g = session.g, FL = session.FL;
  if (!g || g.over || state.busy || g.active !== 'p') return;
  setState({ busy: true, sel: null, mode: 'play', pendFrom: null });
  FL.combat(g, 'p');
  applyResult(); ping();
  if (g.over) return;
  setTimeout(() => {
    g.active = 'o'; FL.beginTurn(g); applyResult(); ping();
    if (g.over) return;
    aiLoop();
  }, aiDelay());
}

function aiLoop() {
  const g = session.g, FL = session.FL;
  if (!g || g.over) { applyResult(); ping(); return; }
  if (FL.aiAct(g, 'o')) { ping(); setTimeout(() => aiLoop(), aiDelay()); return; }
  setTimeout(() => {
    FL.combat(g, 'o'); applyResult(); ping();
    if (g.over) return;
    setTimeout(() => {
      g.active = 'p'; FL.beginTurn(g); applyResult();
      setState({ busy: false });
    }, aiDelay());
  }, Math.max(300, aiDelay() * 0.7));
}

export function concede() {
  if (state.tut) { setState({ screen: 'home', tut: false }); return; }
  const g = session.g; if (!g || g.over) return; g.over = true; g.winner = 'o'; applyResult(); ping();
}

// ---------- player actions ----------
export function tapCard(uid) {
  const g = session.g, FL = session.FL;
  if (!myTurn()) return;
  if (state.mode === 'bank') { if (FL.bank(g, 'p', uid)) setState({ mode: 'play', sel: null }); else ping(); return; }
  const card = g.players.p.hand.find(c => c.uid === uid); if (!card) return;
  const def = FL.byId(card.id);
  const sel = state.sel;
  if (sel === uid && def.type === 'spell' && (def.spell.kind === 'volley' || def.spell.kind === 'insight')) {
    if (FL.castSpell(g, 'p', uid, null)) setState({ sel: null }); else ping();
    return;
  }
  setState({ sel: sel === uid ? null : uid, pendFrom: null });
}

export function tapCell(side, lane, row) {
  const g = session.g, FL = session.FL;
  if (!myTurn()) return;
  const uid = state.sel;
  if (uid == null) return;
  const card = g.players.p.hand.find(c => c.uid === uid); if (!card) return;
  const def = FL.byId(card.id);
  if (state.tut) {
    const L = TUT_LESSONS[state.tutStep];
    if (state.tutStage !== 'act' || side !== 'p' || def.type !== 'unit' || !L.allow(def.id, lane, row)) { ping(); return; }
    if (!g.board.p[lane][row] && FL.deploy(g, 'p', uid, lane, row)) {
      const u = g.board.p[lane][row]; if (u) u.sick = !!L.entrench;
      setState({ sel: null });
    } else ping();
    return;
  }
  if (def.type === 'unit') {
    if (side === 'p' && !g.board.p[lane][row] && FL.deploy(g, 'p', uid, lane, row)) setState({ sel: null });
    else ping();
    return;
  }
  const k = def.spell.kind;
  if (k === 'bolt' && side === 'o' && g.board.o[lane][row]) {
    if (FL.castSpell(g, 'p', uid, { side: 'o', lane, row })) setState({ sel: null }); else ping();
  } else if (k === 'reinforce' && side === 'p' && g.board.p[lane][row]) {
    if (FL.castSpell(g, 'p', uid, { side: 'p', lane, row })) setState({ sel: null }); else ping();
  } else if (k === 'redeploy' && side === 'p') {
    const pf = state.pendFrom;
    if (!pf) { if (g.board.p[lane][row]) setState({ pendFrom: { lane, row } }); return; }
    if (!g.board.p[lane][row]) {
      if (FL.castSpell(g, 'p', uid, { lane: pf.lane, row: pf.row, toLane: lane, toRow: row })) setState({ sel: null, pendFrom: null });
      else setState({ pendFrom: null });
    } else setState({ pendFrom: { lane, row } });
  }
}

export function toggleBank() { if (!myTurn()) return; setState({ mode: state.mode === 'bank' ? 'play' : 'bank', sel: null, pendFrom: null }); }
