// Match flow + player actions for the unified Frontline / Hexwire / Rift engine.
// Supports both Frontline's 5-drill Field Training and Hexwire's 8-step interactive tutorial
// (ending with THE SOLVE exact-lethal puzzle), plus Subvert/Possession targeting and WebAudio SFX.
import { state, session, setState, ping, myTurn } from './state.js';
import { AI_DECKS, HW_AI_DECKS, COMMANDERS, HW_LESSONS, shuf } from './theme.js';
import { saveStanding, loadDecks, loadActive, loadRating, loadRecord, buildSimLadder, saveStyle } from './store.js';
import { sfx } from './sfx.js';

function flat(map) { const o = []; for (const k in map) for (let i = 0; i < map[k]; i++) o.push(k); return o; }
export function deckCountOf(d) { let n = 0; for (const k in d.cards) n += d.cards[k]; return n; }

export function syncBodyTheme(style = state.style) {
  if (typeof document === 'undefined') return;
  document.body.dataset.style = style;
  if (style === 'hexwire') {
    document.body.style.background = '#0b0d11';
    document.body.style.color = '#ece8df';
    document.title = 'HEXWIRE · 2099 Street Magic (Dual-Style Engine)';
  } else if (style === 'rift') {
    document.body.style.background = '#18141f';
    document.body.style.color = '#ece4d4';
    document.title = 'FRONTLINE // HEXWIRE · Rift Crossover';
  } else {
    document.body.style.background = '#26221a';
    document.body.style.color = '#e8dfc6';
    document.title = 'Frontline // Hexwire — Dual-Style Tactical Card Battler';
  }
}

export function switchStyle(newStyle) {
  const FL = session.FL;
  if (!FL || !FL.POOLS[newStyle]) return;
  FL.setStyle(newStyle);
  saveStyle(newStyle);
  const validIds = new Set(FL.POOL.map(c => c.id));
  const decks = loadDecks(validIds, session.starterMap, newStyle);
  const activeId = loadActive(decks, newStyle);
  session.rating = loadRating(newStyle);
  session.record = loadRecord(newStyle);
  session.simLadder = buildSimLadder(newStyle);
  syncBodyTheme(newStyle);
  sfx.styleSwitch();
  setState({
    style: newStyle,
    screen: 'home',
    tut: false,
    decks,
    activeId,
    editId: activeId,
    sel: null,
    mode: 'play',
    pendFrom: null,
    coin: null,
  });
}

export function startMatch(cardsMap, opts = {}) {
  const FL = session.FL; if (!FL) return;
  FL.setStyle(state.style);
  FL.CFG.life = session.prefs.startLife ?? 20;
  if (state.style === 'hexwire') {
    FL.CFG.p2Extra = 1;
    FL.CFG.p1SkipDraw = false;
  } else {
    FL.CFG.p2Extra = 0;
    FL.CFG.p1SkipDraw = true;
  }
  let mine = cardsMap;
  if (!mine) {
    const a = state.decks.find(d => d.id === state.activeId);
    mine = (a && deckCountOf(a) === 24) ? a.cards : session.starterMap;
  }
  let aiIds, oppName;
  if (state.style === 'hexwire') {
    const ck = opts.crewKey || state.crewKey || 'MID';
    const spec = HW_AI_DECKS[ck] || HW_AI_DECKS.MID;
    if (ck === 'RANDOM') aiIds = shuf(FL.POOL.map(c => c.id)).slice(0, 12).flatMap(x => [x, x]);
    else if (spec.ids) aiIds = spec.ids.flatMap(x => [x, x]);
    else aiIds = FL.STARTER.slice();
    oppName = opts.oppName || ('AI · ' + spec.name);
  } else {
    const keys = [...Object.keys(AI_DECKS), 'RANDOM'];
    const key = keys[(Math.random() * keys.length) | 0];
    if (key === 'RANDOM') aiIds = shuf(FL.POOL.map(c => c.id)).slice(0, 12).flatMap(x => [x, x]);
    else if (AI_DECKS[key]) aiIds = AI_DECKS[key].flatMap(x => [x, x]);
    else aiIds = FL.STARTER.slice();
    oppName = opts.oppName || COMMANDERS[(Math.random() * COMMANDERS.length) | 0];
  }
  const first = Math.random() < 0.5 ? 'p' : 'o';
  session.g = FL.newGame(flat(mine), aiIds, first, state.style);
  session.g._ranked = !!opts.ranked;
  const coinDelay = state.style === 'hexwire' ? 1400 : 2200;
  setState({ screen: 'match', tut: false, oppName, coin: { first }, busy: true, sel: null, mode: 'play', pendFrom: null, settingsOpen: false });
  setTimeout(() => {
    setState({ coin: null, busy: first === 'o' });
    if (first === 'o') aiLoop();
  }, coinDelay);
}

// ---------- Field Training (Frontline & Rift): 5-drill scripted curriculum ----------
let _tuid = 50000;
function tutSpawn(g, FL, side, lane, row, id, o) {
  const d = FL.byId(id, g); o = o || {};
  g.board[side][lane][row] = {
    uid: _tuid++, id: d.id, name: d.name, cost: d.cost, f: d.f,
    pow: d.pow, rng: d.rng || (d.kw && d.kw.strike) || 0,
    hp: o.hp != null ? o.hp : d.hp, maxhp: d.hp,
    flanks: d.flanks.slice(), kw: { ...d.kw }, shieldUp: !!d.kw.shield, sick: false
  };
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

// ---------- Hexwire 8-Step Interactive Curriculum ----------
function mkHwTutUnit(FL, g, id, hpOverride) {
  const c = FL.byId(id, g);
  return {
    uid: _tuid++, id: c.id, name: c.name, cost: c.cost, f: c.f,
    pow: c.pow, rng: (c.kw && c.kw.strike) || 0,
    hp: hpOverride || c.hp, maxhp: c.hp,
    flanks: c.flanks.slice(), kw: { ...c.kw }, shieldUp: !!c.kw.shield, sick: false
  };
}

export function loadHwLesson(idx) {
  const FL = session.FL;
  FL.setStyle('hexwire');
  const L = HW_LESSONS[idx];
  const emptyB = () => [[null, null], [null, null], [null, null]];
  const g = {
    style: 'hexwire',
    players: {
      p: { life: 20, deck: [], hand: L.hand.map(id => ({ uid: _tuid++, id })), income: L.energy, energy: L.energy, banked: false, fatigue: 0 },
      o: { life: L.oppLife || 20, deck: [], hand: [], income: 0, energy: 0, banked: false, fatigue: 0 },
    },
    board: { p: emptyB(), o: emptyB() },
    tc: { p: 1, o: 0 }, active: 'p', first: 'p',
    log: ['— Lesson ' + (idx + 1) + ': ' + L.title + ' —'], events: [], over: false, winner: null,
  };
  (L.p || []).forEach(([l, r, id, hp]) => { g.board.p[l][r] = mkHwTutUnit(FL, g, id, hp); });
  (L.o || []).forEach(([l, r, id, hp]) => { g.board.o[l][r] = mkHwTutUnit(FL, g, id, hp); });
  session.g = g;
  const firstStep = L.steps[0];
  const autoCard = firstStep.card ? g.players.p.hand.find(c => c.id === firstStep.card) : null;
  setState({
    screen: 'match',
    tut: { les: idx, step: 0, phase: 'act' },
    tutStep: idx,
    oppName: 'Training Dummy',
    coin: null,
    busy: false,
    sel: firstStep.do === 'deploy' && autoCard ? autoCard.uid : null,
    mode: 'play',
    pendFrom: null,
    settingsOpen: false,
  });
}

export function tutGoal() {
  const t = state.tut;
  if (!t || typeof t !== 'object') return null;
  const L = HW_LESSONS[t.les];
  return t.phase === 'act' ? L.steps[t.step] : { do: t.phase, text: t.phase === 'recap' ? L.recap : L.fail };
}

function advanceHwTut() {
  const t = state.tut, L = HW_LESSONS[t.les];
  if (t.step + 1 < L.steps.length) {
    const next = L.steps[t.step + 1];
    const g = session.g;
    const autoCard = next.card ? g.players.p.hand.find(c => c.id === next.card) : null;
    setState({
      tut: { ...t, step: t.step + 1 },
      sel: next.do === 'deploy' && autoCard ? autoCard.uid : null,
      mode: 'play',
    });
  }
}

export function startTutorial() {
  if (!session.FL) return;
  if (state.style === 'hexwire') loadHwLesson(0);
  else loadLesson(0);
}

export function loadLesson(i) {
  if (state.style === 'hexwire') return loadHwLesson(i);
  const FL = session.FL, L = TUT_LESSONS[i];
  FL.setStyle(state.style);
  const mk = life => ({ life, deck: [], hand: [], income: 0, energy: 0, banked: true, fatigue: 0 });
  const eb = () => [[null, null], [null, null], [null, null]];
  const g = { style: state.style, players: { p: mk(20), o: mk(20) }, board: { p: eb(), o: eb() }, tc: { p: 1, o: 0 }, active: 'p', first: 'p', log: [], events: [], over: false, winner: null };
  g.players.p.hand = L.hand.map(id => ({ uid: _tuid++, id }));
  g.players.p.energy = g.players.p.income = L.energy;
  L.setup(g, FL);
  g.log = ['— ' + L.title + ' —'];
  session.g = g;
  setState({ screen: 'match', tut: true, tutStep: i, tutStage: 'act', tutPass: false, oppName: 'Drill Company', coin: null, busy: false, sel: null, mode: 'play', pendFrom: null, settingsOpen: false });
}

function tutEndTurn() {
  const g = session.g, FL = session.FL;
  if (state.style === 'hexwire' && typeof state.tut === 'object') {
    const goal = tutGoal();
    if (!goal || goal.do !== 'end') return;
    setState({ busy: true, sel: null, mode: 'play' });
    sfx.combat();
    FL.combat(g, 'p');
    const L = HW_LESSONS[state.tut.les];
    if (L.puzzle) {
      setTimeout(() => setState({ busy: false, tut: { ...state.tut, phase: g.over && g.winner === 'p' ? 'done' : 'fail' } }), 450);
      return;
    }
    setTimeout(() => {
      FL.combat(g, 'o');
      ping();
      setTimeout(() => setState({ busy: false, tut: { ...state.tut, phase: 'recap' } }), 450);
    }, 520);
    ping();
    return;
  }
  const L = TUT_LESSONS[state.tutStep];
  if (state.tutStage !== 'act' || !L.placed(g)) { ping(); return; }
  setState({ busy: true, sel: null });
  sfx.combat();
  FL.combat(g, 'p');
  const finish = () => setState({ busy: false, tutStage: 'review', tutPass: L.pass(g) });
  if (L.enemyPhase && !g.over) { ping(); setTimeout(() => { sfx.combat(); FL.combat(g, 'o'); ping(); setTimeout(finish, 500); }, 800); }
  else setTimeout(finish, 600);
  ping();
}

function applyResult() {
  const g = session.g;
  if (!g || !g.over || g._scored) return;
  g._scored = true;
  if (state.tut) { g._delta = 0; return; }
  if (g.winner === 'p') {
    sfx.win();
    g._delta = 18;
    session.rating += 18;
    session.record.w++;
  } else if (g.winner === 'o') {
    sfx.lose();
    const minR = state.style === 'hexwire' ? 1000 : 800;
    g._delta = -12;
    session.rating = Math.max(minR, session.rating - 12);
    session.record.l++;
  } else g._delta = 0;
  saveStanding(session.rating, session.record, state.style);
}

function aiDelay() { return session.prefs.fastAi ? 140 : 600; }

export function endTurn() {
  if (state.tut) return tutEndTurn();
  const g = session.g, FL = session.FL;
  if (!g || g.over || state.busy || g.active !== 'p') return;
  setState({ busy: true, sel: null, mode: 'play', pendFrom: null });
  sfx.combat();
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
  if (FL.aiAct(g, 'o')) { sfx.deploy(); ping(); setTimeout(() => aiLoop(), aiDelay()); return; }
  setTimeout(() => {
    sfx.combat();
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
  const card = g.players.p.hand.find(c => c.uid === uid); if (!card) return;
  if (state.style === 'hexwire' && typeof state.tut === 'object') {
    const goal = tutGoal();
    if (!goal || (goal.do !== 'bank' && goal.do !== 'deploy') || (goal.card && goal.card !== card.id)) return;
  }
  if (state.mode === 'bank') {
    if (FL.bank(g, 'p', uid)) {
      sfx.bank();
      if (state.style === 'hexwire' && typeof state.tut === 'object') advanceHwTut();
      else setState({ mode: 'play', sel: null });
    } else ping();
    return;
  }
  const def = FL.byId(card.id, g);
  const sel = state.sel;
  if (sel === uid && def.type === 'spell' && (def.spell.kind === 'volley' || def.spell.kind === 'insight')) {
    if (FL.castSpell(g, 'p', uid, null)) { sfx.spell(); setState({ sel: null }); } else ping();
    return;
  }
  sfx.select();
  setState({ sel: sel === uid ? null : uid, pendFrom: null });
}

export function tapCell(side, lane, row) {
  const g = session.g, FL = session.FL;
  if (!myTurn()) return;
  const uid = state.sel;
  if (uid == null) return;
  const card = g.players.p.hand.find(c => c.uid === uid); if (!card) return;
  const def = FL.byId(card.id, g);

  if (state.tut) {
    if (state.style === 'hexwire' && typeof state.tut === 'object') {
      const goal = tutGoal();
      if (!goal || goal.do !== 'deploy' || side !== 'p') return;
      if (goal.lane != null && goal.lane !== lane) return;
      if (goal.row != null && goal.row !== row) return;
      if (!g.board.p[lane][row] && FL.deploy(g, 'p', uid, lane, row)) {
        sfx.deploy();
        advanceHwTut();
      } else ping();
      return;
    }
    const L = TUT_LESSONS[state.tutStep];
    if (state.tutStage !== 'act' || side !== 'p' || def.type !== 'unit' || !L.allow(def.id, lane, row)) { ping(); return; }
    if (!g.board.p[lane][row] && FL.deploy(g, 'p', uid, lane, row)) {
      const u = g.board.p[lane][row]; if (u) u.sick = !!L.entrench;
      sfx.deploy();
      setState({ sel: null });
    } else ping();
    return;
  }

  if (def.type === 'unit') {
    if (side === 'p' && !g.board.p[lane][row] && FL.deploy(g, 'p', uid, lane, row)) {
      if (def.kw && def.kw.subvert) sfx.subvert(); else sfx.deploy();
      setState({ sel: null });
    } else ping();
    return;
  }
  const k = def.spell.kind;
  if (k === 'bolt' && side === 'o' && g.board.o[lane][row]) {
    if (FL.castSpell(g, 'p', uid, { side: 'o', lane, row })) { sfx.spell(); setState({ sel: null }); } else ping();
  } else if (k === 'reinforce' && side === 'p' && g.board.p[lane][row]) {
    if (FL.castSpell(g, 'p', uid, { side: 'p', lane, row })) { sfx.spell(); setState({ sel: null }); } else ping();
  } else if (k === 'redeploy' && side === 'p') {
    const pf = state.pendFrom;
    if (!pf) { if (g.board.p[lane][row]) { sfx.select(); setState({ pendFrom: { lane, row } }); } return; }
    if (!g.board.p[lane][row]) {
      if (FL.castSpell(g, 'p', uid, { lane: pf.lane, row: pf.row, toLane: lane, toRow: row })) { sfx.spell(); setState({ sel: null, pendFrom: null }); }
      else setState({ pendFrom: null });
    } else setState({ pendFrom: { lane, row } });
  } else if (k === 'possess') {
    const pf = state.pendFrom;
    const u = g.board[side][lane][row];
    if (side === 'o') {
      if (u && (u.cost || 1) <= def.spell.cap && !u.beneath) { sfx.select(); setState({ pendFrom: { lane, row } }); }
      return;
    }
    if (pf && side === 'p' && !u) {
      if (FL.castSpell(g, 'p', uid, { lane: pf.lane, row: pf.row, toLane: lane, toRow: row })) { sfx.subvert(); setState({ sel: null, pendFrom: null }); }
      else setState({ pendFrom: null });
    }
  }
}

export function toggleBank() {
  if (!myTurn()) return;
  if (state.style === 'hexwire' && typeof state.tut === 'object') {
    const goal = tutGoal();
    if (!goal || goal.do !== 'bank') return;
  }
  sfx.select();
  setState({ mode: state.mode === 'bank' ? 'play' : 'bank', sel: null, pendFrom: null });
}
