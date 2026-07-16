// Match flow + player actions, ported 1:1 from the Hexwire prototype so the game
// plays byte-for-byte. All rules/AI live in engine.js (FL). Also holds the
// simulated wallet connect/disconnect (non-custodial flavor only).
import { state, session, setState, ping, myTurn } from './state.js';
import { AI_DECKS, TUT, shuf, fakeAddr } from './theme.js';
import { saveRecord, saveWallet, clearWallet } from './store.js';

function flat(map) { const o = []; for (const k in map) for (let i = 0; i < map[k]; i++) o.push(k); return o; }
export function deckCountOf(d) { let n = 0; for (const k in d.cards) n += d.cards[k]; return n; }
export function tut() { return state.tut != null ? TUT[state.tut] : null; }

// ---------- wallet (simulated, non-custodial) ----------
export function connect(provider) {
  setState({ connecting: provider });
  setTimeout(() => {
    const wallet = { addr: fakeAddr(), provider };
    saveWallet(wallet);
    setState({ wallet, connecting: null, showConnect: false });
  }, 900);
}
export function disconnect() { clearWallet(); setState({ wallet: null }); }

// ---------- match flow ----------
export function startMatch(cardsMap, opts) {
  opts = opts || {};
  const FL = session.FL; if (!FL) return;
  FL.CFG.life = session.prefs.startLife ?? 20;
  FL.CFG.p2Extra = 0; FL.CFG.p1SkipDraw = true;
  let mine = cardsMap;
  if (!mine) { const a = state.decks.find(d => d.id === state.activeId); mine = (a && deckCountOf(a) === 24) ? a.cards : session.starterMap; }
  const keys = ['MID', 'CHROME', 'STREET', 'HEX', 'RANDOM'];
  const crewKey = opts.crewKey || keys[(Math.random() * keys.length) | 0];
  let aiIds;
  if (crewKey === 'RANDOM') aiIds = shuf(FL.POOL.map(c => c.id)).slice(0, 12).flatMap(x => [x, x]);
  else if (AI_DECKS[crewKey].ids) aiIds = AI_DECKS[crewKey].ids.flatMap(x => [x, x]);
  else aiIds = FL.STARTER.slice();
  if (opts.tutorial) {
    session.g = FL.newGame(flat(session.starterMap), FL.STARTER.slice(), 'p');
    session.g.players.p.hand = ['skirm', 'archer', 'bolt', 'picket'].map((id, i) => ({ uid: -(i + 1), id }));
    setState({ screen: 'match', crewKey: 'MID', tut: 0, coin: null, busy: false, sel: null, mode: 'play', pendFrom: null, queue: null });
    return;
  }
  const first = Math.random() < 0.5 ? 'p' : 'o';
  session.g = FL.newGame(flat(mine), aiIds, first);
  setState({ screen: 'match', crewKey, tut: null, coin: { first }, busy: true, sel: null, mode: 'play', pendFrom: null, queue: null });
  setTimeout(() => {
    setState({ coin: null, busy: first === 'o' });
    if (first === 'o') aiLoop();
  }, 2600);
}

export function startTutorial() { startMatch(null, { tutorial: true }); }

export function applyResult() {
  const g = session.g;
  if (!g || !g.over || g._scored || state.coin) return;
  g._scored = true;
  if (state.tut != null || g.winner === 'draw') return;
  if (g.winner === 'p') session.record.w++; else session.record.l++;
  saveRecord(session.record);
}

function aiDelay() { return session.prefs.fastAi ? 140 : 620; }

export function endTurn() {
  const g = session.g, FL = session.FL, t = tut();
  if (!g || g.over || state.busy || g.active !== 'p') return;
  if (t && t.allow !== 'end') return;
  const patch = { busy: true, sel: null, mode: 'play', pendFrom: null };
  if (state.tut != null) patch.tut = Math.min(state.tut + 1, TUT.length - 1);
  setState(patch);
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

// ---------- player actions ----------
export function tapCard(uid) {
  const g = session.g, FL = session.FL, t = tut();
  if (!myTurn()) return;
  const card = g.players.p.hand.find(c => c.uid === uid); if (!card) return;
  if (state.mode === 'bank') {
    if (t && (t.allow !== 'bank' || card.id !== t.bankId)) return;
    if (FL.bank(g, 'p', uid)) {
      const patch = { mode: 'play', sel: null };
      if (t) patch.tut = state.tut + 1;
      setState(patch);
    } else ping();
    return;
  }
  if (t && (t.allow !== 'deploy' || card.id !== t.cardId)) return;
  const def = FL.byId(card.id);
  const sel = state.sel;
  if (sel === uid && def.type === 'spell' && (def.spell.kind === 'volley' || def.spell.kind === 'insight')) {
    if (FL.castSpell(g, 'p', uid, null)) setState({ sel: null }); else ping();
    return;
  }
  setState({ sel: sel === uid ? null : uid, pendFrom: null });
}

export function tapCell(side, lane, row) {
  const g = session.g, FL = session.FL, t = tut();
  if (!myTurn()) return;
  const uid = state.sel;
  if (uid == null) return;
  const card = g.players.p.hand.find(c => c.uid === uid); if (!card) return;
  const def = FL.byId(card.id);
  if (def.type === 'unit') {
    if (t && (t.allow !== 'deploy' || card.id !== t.cardId || row !== t.row)) return;
    if (side === 'p' && !g.board.p[lane][row] && FL.deploy(g, 'p', uid, lane, row)) {
      const patch = { sel: null };
      if (t) patch.tut = state.tut + 1;
      setState(patch);
    } else ping();
    return;
  }
  if (t) return;
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
  } else if (k === 'possess') {
    const pf = state.pendFrom;
    if (side === 'o') {
      const u = g.board.o[lane][row];
      if (u && u.cost <= def.spell.cap && !u.beneath) setState({ pendFrom: { lane, row } });
      return;
    }
    if (pf && side === 'p' && !g.board.p[lane][row]) {
      if (FL.castSpell(g, 'p', uid, { lane: pf.lane, row: pf.row, toLane: lane, toRow: row })) setState({ sel: null, pendFrom: null });
      else setState({ pendFrom: null });
    }
  }
}

export function toggleBank() {
  if (!myTurn()) return;
  const t = tut();
  if (t && t.allow !== 'bank') return;
  setState({ mode: state.mode === 'bank' ? 'play' : 'bank', sel: null, pendFrom: null });
}
