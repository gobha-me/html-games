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
  }, 1900);
}

export function startTutorial() {
  const FL = session.FL; if (!FL) return;
  FL.CFG.life = 20; FL.CFG.p2Extra = 0; FL.CFG.p1SkipDraw = true;
  const enemyDeck = [...Array(8)].flatMap(() => ['scout', 'picket', 'foot']);
  session.g = FL.newGame(FL.STARTER.slice(), enemyDeck, 'p');
  const g = session.g;
  let uid = 9001;
  g.players.p.hand = ['foot', 'archer', 'scout', 'bolt'].map(id => ({ uid: uid++, id }));
  g.players.p.income = 4; g.players.p.energy = 4;
  g.players.o.hand = ['scout', 'picket', 'scout'].map(id => ({ uid: uid++, id }));
  g.players.o.life = 10;
  g.log = ['— FIELD TRAINING · follow the orders in the amber panel —'];
  setState({ screen: 'match', tut: true, oppName: 'Drill Company', coin: null, busy: false, sel: null, mode: 'play', pendFrom: null, settingsOpen: false });
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
  const g = session.g, FL = session.FL;
  if (!g || g.over || state.busy || g.active !== 'p') return;
  if (state.tut && g.tc.p === 1 && !tutTurn1Done()) { ping(); return; }
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

export function concede() { const g = session.g; if (!g || g.over) return; g.over = true; g.winner = 'o'; applyResult(); ping(); }

export function tutTurn1Done() {
  const g = session.g; if (!g) return false;
  const P = g.players.p;
  let front = false, back = false;
  for (let l = 0; l < 3; l++) { if (g.board.p[l][0]) front = true; if (g.board.p[l][1]) back = true; }
  return P.banked && front && back;
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
