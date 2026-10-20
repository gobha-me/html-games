// Match board view supporting Frontline (Dieselpunk), Hexwire (Cyberpunk), and Rift Crossover.
// Renders positional M/R vs. Street/Overwatch stats, Subvert beneath badges, and both
// Frontline's 5-drill Field Training and Hexwire's 8-step interactive tutorial.
import { h } from '../dom.js';
import { state, session, setState, myTurn } from '../state.js';
import { SPELL_LINE, FCOL, HW_LESSONS } from '../theme.js';
import { kwTags, defTags } from '../labels.js';
import { cardArt, cardArtBand, boardField } from '../art.js';
import { tapCard, tapCell, toggleBank, endTurn, concede, TUT_LESSONS, loadLesson, loadHwLesson, tutGoal } from '../match.js';
import { scheduleCardZoom, cancelCardZoom } from './overlays.js';

function cellView(side, lane, row) {
  const g = session.g, FL = session.FL;
  const hex = state.style === 'hexwire';
  const u = g.board[side][lane][row];
  const mine = side === 'p';
  const selCard = state.sel != null ? g.players.p.hand.find(c => c.uid === state.sel) : null;
  const selDef = selCard ? FL.byId(selCard.id, g) : null;
  const my = myTurn();
  let clickable = false;

  if (my && selDef) {
    if (selDef.type === 'unit' && mine && !u && g.players.p.energy >= selDef.cost) clickable = true;
    else if (selDef.type === 'spell') {
      const k = selDef.spell.kind;
      if (k === 'bolt' && !mine && u) clickable = true;
      if (k === 'reinforce' && mine && u) clickable = true;
      if (k === 'redeploy' && mine && (state.pendFrom ? !u : !!u)) clickable = true;
      if (k === 'possess') {
        if (!mine && u && (u.cost || 1) <= selDef.spell.cap && !u.beneath) clickable = true;
        if (mine && state.pendFrom && !u) clickable = true;
      }
    }
  }

  if (clickable && state.tut) {
    if (hex && typeof state.tut === 'object') {
      const goal = tutGoal();
      if (!goal || goal.do !== 'deploy' || !mine) clickable = false;
      else if (goal.lane != null && goal.lane !== lane) clickable = false;
      else if (goal.row != null && goal.row !== row) clickable = false;
    } else {
      const L = TUT_LESSONS[state.tutStep];
      if (state.tutStage !== 'act' || !mine || !selDef || selDef.type !== 'unit' || !L.allow(selDef.id, lane, row)) clickable = false;
    }
  }

  const isPossessSrc = selDef && selDef.type === 'spell' && selDef.spell.kind === 'possess';
  const pendHere = state.pendFrom && ((isPossessSrc ? !mine : mine) && state.pendFrom.lane === lane && state.pendFrom.row === row);

  const accent = hex ? '#c77dff' : '#c9a227';
  const border = pendHere
    ? `2px solid ${hex ? '#53c7ff' : '#e8dfc6'}`
    : clickable
      ? `2px dashed ${accent}`
      : row === 0
        ? `1.5px solid ${hex ? (mine ? '#29384a' : '#4a2938') : (mine ? '#4e5535' : '#5c3b31')}`
        : `1.5px dashed ${hex ? (mine ? '#222d3b' : '#3b222d') : (mine ? '#454b30' : '#50352c')}`;
  const bg = u
    ? (hex ? (mine ? 'rgba(24,36,48,.72)' : 'rgba(48,24,36,.72)') : (mine ? 'rgba(57,64,42,.62)' : 'rgba(70,48,42,.62)'))
    : (hex ? 'rgba(16,20,28,.45)' : 'rgba(42,38,28,.3)');

  const cell = h('div', {
    onclick: () => tapCell(side, lane, row),
    style: `position:relative;overflow:hidden;min-height:108px;border:${border};border-radius:${hex ? '9px' : '0'};background:${bg};display:flex;align-items:${u ? 'flex-end' : 'center'};justify-content:center;padding:6px 4px;cursor:${clickable ? 'pointer' : 'default'};box-shadow:${clickable ? `0 0 0 3px ${hex ? 'rgba(199,125,255,.22)' : 'rgba(201,162,39,.18)'}` : 'none'};transition:.12s`,
  });

  if (u) {
    const eff = FL.effPow(g, side, lane, row);
    const bonus = eff - u.pow;
    const rPow = FL.backRowPower(u, g);
    const sickTag = hex ? 'ZZZ' : 'DIG IN';
    const tags = kwTags(u) + (u.sick ? (kwTags(u) ? ' · ' : '') + sickTag : '');
    const subBadge = u.beneath
      ? h('div', {
          title: 'Subverted by ' + u.beneath.name + ' (emerges when destroyed)',
          style: 'position:absolute;top:4px;left:4px;z-index:2;padding:2px 5px;background:#c77dff;color:#0b0d11;font:700 8.5px \'IBM Plex Mono\';letter-spacing:.06em;border-radius:4px',
        }, '☍ ' + u.beneath.name)
      : u.viaSpell
        ? h('div', {
            style: 'position:absolute;top:4px;left:4px;z-index:2;padding:2px 5px;background:#53c7ff;color:#0b0d11;font:700 8.5px \'IBM Plex Mono\';letter-spacing:.06em;border-radius:4px',
          }, '☍ POSSESSED')
        : null;

    cell.append(
      cardArt(u.id),
      subBadge,
      h('div', { style: `position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:2px;color:${hex ? '#ece8df' : '#e8dfc6'};opacity:${u.sick ? .62 : 1};text-shadow:0 1px 3px rgba(0,0,0,.85),0 0 2px rgba(0,0,0,.7);animation:flPop .22s ease` },
        h('div', { style: 'font:700 12px/1.1 \'Barlow Condensed\';letter-spacing:.04em;text-transform:uppercase;text-align:center' }, u.name),
        h('div', { style: 'display:flex;gap:7px;align-items:baseline;justify-content:center' },
          h('span', { style: `font:700 17px 'IBM Plex Mono';color:${bonus > 0 ? accent : mine ? (hex ? '#53c7ff' : '#b7cb76') : '#e08a70'}` }, (bonus > 0 ? u.pow + '+' + bonus : String(u.pow)) + '/' + rPow),
          h('span', { style: 'font:600 11px \'IBM Plex Mono\';opacity:.85' }, '♥' + u.hp),
        ),
        h('div', { style: `font:600 8.5px 'IBM Plex Mono';letter-spacing:.05em;color:${mine ? (hex ? '#53c7ff' : '#9db35e') : '#d06a52'};opacity:.92;min-height:10px;text-align:center` }, tags),
      ),
    );
  } else {
    const label = hex
      ? (row === 0 ? (mine ? 'STREET' : 'RIVAL STREET') : (mine ? 'OVERWATCH' : 'RIVAL BACK'))
      : (row === 0 ? (mine ? 'THE LINE' : 'THEIR LINE') : (mine ? 'EMPLACEMENT' : 'REAR'));
    cell.append(h('span', { style: `position:relative;z-index:1;font:700 8.5px 'IBM Plex Mono';letter-spacing:.16em;color:${hex ? (mine ? '#556982' : '#7a4b5d') : (mine ? '#8a9068' : '#a06d5f')};text-shadow:0 1px 2px rgba(0,0,0,.8)` }, label));
  }
  return cell;
}

function lifeBox(bg, life, hex) {
  return h('div', { style: `width:46px;height:46px;background:${bg};color:#f0e8d2;display:flex;align-items:center;justify-content:center;font:700 20px 'IBM Plex Mono';flex:none;${hex ? 'border-radius:10px' : 'clip-path:polygon(8% 0,100% 0,92% 100%,0 100%)'}` }, Math.max(0, life));
}

function logTicker(g, hex) {
  const col = t => /^(⚔ |☍ )?You|^Your/.test(t) ? (hex ? '#53c7ff' : '#9db35e') : /^(⚔ |☍ )?AI/.test(t) ? '#d06a52' : (hex ? '#7c8596' : '#8a8065');
  const latest = g.log[0] || '—';
  const header = h('div', { onclick: () => setState({ logOpen: !state.logOpen }), style: 'display:flex;align-items:center;gap:8px;cursor:pointer' },
    h('span', { style: `font:700 9px 'IBM Plex Mono';letter-spacing:.16em;color:${hex ? '#7c8596' : '#6e654d'};flex:none` }, hex ? 'STREET WIRE' : 'DISPATCHES'),
    h('span', { style: `font:700 9px 'IBM Plex Mono';color:${hex ? '#7c8596' : '#6e654d'};flex:none;transition:.15s;transform:rotate(${state.logOpen ? 90 : 0}deg)` }, '▸'),
    state.logOpen ? null : h('span', { style: `flex:1;min-width:0;font:500 11.5px 'IBM Plex Mono';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${col(latest)}` }, latest),
  );
  return h('div', { style: `margin-top:10px;padding-top:8px;border-top:1px solid ${hex ? '#232a38' : '#4a422e'}` },
    header,
    state.logOpen ? h('div', { style: 'font:500 11.5px/1.7 \'IBM Plex Mono\';margin-top:4px' },
      g.log.slice(0, 6).map((t, i) => h('div', { style: `opacity:${1 - i * .14};color:${col(t)}` }, t))) : null,
  );
}

function tutPanel() {
  if (state.style === 'hexwire' && typeof state.tut === 'object') {
    const t = state.tut;
    const L = HW_LESSONS[t.les];
    const last = HW_LESSONS.length - 1;
    const goal = tutGoal();
    const isRecap = t.phase === 'recap' || t.phase === 'done';
    const isFail = t.phase === 'fail';
    return h('div', { style: 'margin:12px 0 0;background:#141822;color:#ece8df;border-left:4px solid #c77dff;border-radius:8px;padding:14px 18px' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap' },
        h('div', { style: 'font:700 12px \'IBM Plex Mono\';letter-spacing:.18em;color:#c77dff' }, L.title),
        h('div', { style: 'font:600 10px \'IBM Plex Mono\';color:#7c8596' }, 'STREET LESSON · ' + (t.les + 1) + ' / ' + HW_LESSONS.length),
      ),
      h('div', { style: 'font:500 16px/1.5 \'Barlow Condensed\';margin-top:6px;color:#d6d2c8' },
        t.phase === 'done' ? '✓ Solved! Exact lethal delivered to the rival.' : (goal ? goal.text : '')),
      h('div', { style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center' },
        isRecap ? h('button', {
          onclick: () => t.les >= last ? setState({ screen: 'home', tut: false }) : loadHwLesson(t.les + 1),
          style: 'background:#c77dff;color:#0b0d11;border:none;border-radius:6px;padding:10px 18px;font:700 14px \'Barlow Condensed\';letter-spacing:.08em;text-transform:uppercase;cursor:pointer',
        }, t.les >= last ? 'Finish training' : 'Next lesson →') : null,
        isFail ? h('button', {
          onclick: () => loadHwLesson(t.les),
          style: 'background:#d06a52;color:#0b0d11;border:none;border-radius:6px;padding:10px 18px;font:700 14px \'Barlow Condensed\';letter-spacing:.08em;text-transform:uppercase;cursor:pointer',
        }, 'Retry puzzle') : null,
        h('button', {
          onclick: () => loadHwLesson(t.les),
          style: 'background:transparent;color:#9aa3b2;border:1px solid #2b3548;border-radius:6px;padding:10px 16px;font:600 13px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer',
        }, 'Reset'),
        h('button', {
          onclick: () => setState({ screen: 'home', tut: false }),
          style: 'background:transparent;color:#7c8596;border:none;padding:10px 8px;font:600 13px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer',
        }, 'Exit'),
      ),
    );
  }

  const step = state.tutStep, last = TUT_LESSONS.length - 1, L = TUT_LESSONS[step];
  const passOk = state.tutStage === 'review' && state.tutPass;
  const btn = (label, style, onclick) => h('button', { onclick, style }, label);
  return h('div', { style: 'margin:12px 0 0;background:#efe6cf;color:#2a2517;border-left:4px solid #c9a227;padding:14px 18px' },
    h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap' },
      h('div', { style: 'font:700 12px \'IBM Plex Mono\';letter-spacing:.18em;color:#a4402c' }, L.title),
      h('div', { style: 'font:600 10px \'IBM Plex Mono\';color:#7a7052' }, 'FIELD TRAINING · ' + (step + 1) + ' / ' + TUT_LESSONS.length),
    ),
    h('div', { style: 'font:500 16px/1.5 \'Barlow Condensed\';margin-top:6px' }, L.brief),
    h('div', { style: 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center' },
      passOk ? btn(step >= last ? 'Complete training' : 'Next drill →',
        'background:#2a2517;color:#efe6cf;border:none;padding:11px 20px;font:700 14px \'Barlow Condensed\';letter-spacing:.08em;text-transform:uppercase;cursor:pointer',
        () => step >= last ? setState({ screen: 'home', tut: false }) : loadLesson(step + 1)) : null,
      btn('Reset drill', 'background:transparent;color:#5a5138;border:1px solid #a89c78;padding:11px 18px;font:600 13px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer', () => loadLesson(step)),
      btn('Exit training', 'background:transparent;color:#7a7052;border:none;padding:11px 8px;font:600 13px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer', () => setState({ screen: 'home', tut: false })),
    ),
  );
}

export function matchView() {
  const g = session.g, FL = session.FL;
  if (!g) return h('div', {});
  const hex = state.style === 'hexwire';
  const P = g.players.p, O = g.players.o;
  const my = myTurn();

  const cellsTop = [], cellsBot = [];
  for (let l = 0; l < 3; l++) cellsTop.push(cellView('o', l, 1));
  for (let l = 0; l < 3; l++) cellsTop.push(cellView('o', l, 0));
  for (let l = 0; l < 3; l++) cellsBot.push(cellView('p', l, 0));
  for (let l = 0; l < 3; l++) cellsBot.push(cellView('p', l, 1));

  const grid = kids => h('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:7px' }, kids);
  const laneMid = h('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:7px 0' },
    [0, 1, 2].map(l => h('div', { style: `display:flex;align-items:center;justify-content:space-between;background:${hex ? 'repeating-linear-gradient(135deg,#141822 0 8px,#10141c 8px 16px)' : 'repeating-linear-gradient(135deg,#3a3526 0 8px,#332e21 8px 16px)'};padding:5px 10px;border:1px solid ${hex ? '#232a38' : '#4a422e'};border-radius:${hex ? '6px' : '0'}` },
      h('span', { style: 'font:700 11px \'IBM Plex Mono\';color:#d06a52' }, '↓' + FL.laneThreat(g, 'o', l)),
      h('span', { style: `font:600 10px 'IBM Plex Mono';letter-spacing:.14em;color:${hex ? '#7c8596' : '#8a8065'}` }, hex ? ('BLOCK ' + (l + 1)) : ('SECTOR ' + 'ABC'[l])),
      h('span', { style: `font:700 11px 'IBM Plex Mono';color:${hex ? '#53c7ff' : '#9db35e'}` }, '↑' + FL.laneThreat(g, 'p', l)),
    )));

  const hand = P.hand.map(c => {
    const d = FL.byId(c.id, g);
    const isSel = state.sel === c.uid;
    const aff = my && P.energy >= d.cost;
    const bankMode = state.mode === 'bank';
    const isSpell = d.type === 'spell';
    const fCol = FCOL[d.f] || '#c9a227';
    const rPow = FL.backRowPower(d, g);

    const card = h('div', {
      onclick: () => tapCard(c.uid),
      onmouseenter: e => scheduleCardZoom(c.id, e.currentTarget),
      onmouseleave: () => cancelCardZoom(),
      style: `position:relative;overflow:hidden;flex:none;width:110px;min-height:154px;display:flex;flex-direction:column;background:${hex ? '#151923' : '#efe6cf'};border:2px solid ${isSel ? (hex ? '#c77dff' : '#c9a227') : bankMode ? '#a4402c' : hex ? fCol : (isSpell ? '#8a7f9e' : '#b9ad8b')};border-radius:${hex ? '10px' : '0'};cursor:pointer;transform:translateY(${isSel ? '-8px' : '0'});box-shadow:${isSel ? '0 12px 22px -10px rgba(0,0,0,.6)' : '0 2px 5px -3px rgba(0,0,0,.5)'};opacity:${(aff || bankMode || !my) ? 1 : .55};transition:.13s`,
    },
      cardArtBand(c.id),
      h('div', { style: 'position:relative;z-index:1;display:flex;flex-direction:column;flex:1;min-height:0;padding:8px 9px' },
        h('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' },
          h('div', { style: `width:22px;height:22px;background:${(aff || bankMode) ? (hex ? fCol : '#2a2517') : (hex ? '#2a3140' : '#988d70')};color:${hex && (aff || bankMode) ? '#0b0d11' : '#f0e8d2'};border-radius:${hex ? '5px' : '0'};display:flex;align-items:center;justify-content:center;font:700 12px 'IBM Plex Mono'` }, d.cost),
          h('div', { style: `font:600 8.5px 'IBM Plex Mono';letter-spacing:.08em;color:${hex ? fCol : '#988d70'}` }, isSpell ? (hex ? 'HEX' : 'ORDER') : (hex ? d.f.toUpperCase() : 'UNIT')),
        ),
        h('div', { style: `font:700 13.5px/1.1 'Barlow Condensed';letter-spacing:.03em;text-transform:uppercase;margin-top:6px;color:${hex ? '#ece8df' : '#2a2517'}` }, d.name),
        h('div', { style: 'flex:1' }),
        h('div', { style: `font:500 9.5px/1.35 'IBM Plex Mono';color:${hex ? '#9aa3b2' : '#7a7052'};min-height:13px` }, isSpell ? SPELL_LINE[d.spell.kind] : defTags(d)),
        h('div', { style: 'display:flex;justify-content:space-between;align-items:flex-end;margin-top:4px' },
          h('div', { style: `font:700 17px 'IBM Plex Mono';color:${hex ? '#ece8df' : '#2a2517'}` }, isSpell ? '✦' : d.pow + '/' + rPow),
          h('div', { style: `font:600 11px 'IBM Plex Mono';color:${hex ? '#9aa3b2' : '#7a7052'}` }, isSpell ? '' : '♥' + d.hp),
        ),
      ),
    );
    return card;
  });

  // ----- banner state machine -----
  let bannerText, bannerCol = hex ? '#9aa3b2' : '#b3a88a';
  const accent = hex ? '#c77dff' : '#c9a227';
  const selCard = state.sel != null ? P.hand.find(c => c.uid === state.sel) : null;
  const selDef = selCard ? FL.byId(selCard.id, g) : null;
  if (g.over && !state.tut) bannerText = hex ? 'Run flatlined.' : 'Engagement over.';
  else if (state.coin) bannerText = hex ? 'Flipping the credstick…' : 'Awaiting field orders…';
  else if (state.busy) { bannerText = g.active === 'o' ? (hex ? 'Rival crew is moving…' : 'Enemy command is deliberating…') : (hex ? 'Executing street combat…' : 'The guns speak…'); bannerCol = '#d06a52'; }
  else if (state.mode === 'bank') { bannerText = P.banked ? (hex ? 'Already fenced a card this turn.' : 'Already requisitioned this turn.') : (hex ? 'Tap a card in hand to fence it: +1 energy (+2 if cost 4+).' : 'Tap a card to requisition it: +1 supply, +2 if it costs 4+.'); bannerCol = accent; }
  else if (selDef && selDef.type === 'unit') {
    bannerText = P.energy >= selDef.cost
      ? (hex ? 'Tap an empty slot — Street brawls in front, Overwatch fires from behind.' : 'Tap an empty position — M power fights on the line, R power fires from emplacements.')
      : 'Not enough ' + (hex ? 'energy' : 'supply') + ' for ' + selDef.name + '.';
    bannerCol = accent;
  }
  else if (selDef && selDef.type === 'spell') {
    const k = selDef.spell.kind;
    bannerText = k === 'bolt' ? 'Tap an enemy unit to strike it for 3.'
      : k === 'reinforce' ? 'Tap one of your units to buff (+1/+2).'
      : k === 'redeploy' ? (state.pendFrom ? 'Now tap an empty position to move to.' : 'Tap one of your units to move.')
      : k === 'possess' ? (state.pendFrom ? 'Now tap an empty slot on your side to claim it.' : 'Tap an enemy unit of cost ≤2 to possess.')
      : 'Tap the card again to cast ' + selDef.name + '.';
    bannerCol = accent;
  }
  else if (state.tut) {
    if (hex && typeof state.tut === 'object') {
      const goal = tutGoal();
      bannerText = goal ? goal.text : 'Follow the street lesson prompt.';
      bannerCol = '#c77dff';
    } else {
      const L = TUT_LESSONS[state.tutStep];
      if (state.tutStage === 'review') { bannerText = state.tutPass ? '✓ ' + L.passMsg : '✗ ' + (L.failMsg || 'Not quite — reset the drill and follow the orders exactly.'); bannerCol = state.tutPass ? '#9db35e' : '#d06a52'; }
      else if (L.placed(g)) { bannerText = '✓ In position — press End Turn to execute.'; bannerCol = '#9db35e'; }
      else { bannerText = 'ORDERS: ' + L.goal; bannerCol = '#c9a227'; }
    }
  }
  else bannerText = hex ? 'Your turn — deploy to Street or Overwatch, Fence once for energy, End Turn to fight.' : 'Your move — tap a card, then a position. Requisition once for supply. End turn to fight.';

  const endReady = my && (
    !state.tut
    || (hex && typeof state.tut === 'object' && tutGoal()?.do === 'end')
    || (!hex && state.tutStage === 'act' && TUT_LESSONS[state.tutStep].placed(g))
  );

  const board = h('div', { style: `position:relative;overflow:hidden;border:1px solid ${hex ? '#232a38' : '#4a422e'};border-radius:${hex ? '12px' : '0'};padding:10px` },
    boardField(),
    h('div', { style: 'position:relative;z-index:1' }, grid(cellsTop), laneMid, grid(cellsBot)),
  );

  const tutLabel = state.tut
    ? (hex && typeof state.tut === 'object'
        ? 'LESSON ' + (state.tut.les + 1) + '/' + HW_LESSONS.length
        : 'DRILL ' + (state.tutStep + 1) + '/' + TUT_LESSONS.length)
    : 'TURN ' + Math.max(1, g.tc.p);

  return h('div', { 'data-screen-label': 'Match' },
    // header: enemy · tag · you
    h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap' },
      h('div', { style: 'display:flex;align-items:center;gap:11px' },
        lifeBox('#a4402c', O.life, hex),
        h('div', {},
          h('div', { style: 'font:700 16px/1.1 \'Barlow Condensed\';letter-spacing:.05em;text-transform:uppercase' }, state.oppName),
          h('div', { style: `font:500 11px 'IBM Plex Mono';color:${hex ? '#7c8596' : '#8a8065'}` }, O.hand.length + ' hand · ' + O.deck.length + ' deck · ⚡' + O.energy + '/' + O.income),
        ),
      ),
      h('div', { style: `font:700 12px 'IBM Plex Mono';letter-spacing:.16em;color:${accent}` }, tutLabel),
      h('div', { style: 'display:flex;align-items:center;gap:11px;flex-direction:row-reverse' },
        lifeBox(hex ? '#2b6cb0' : '#6b7a3f', P.life, hex),
        h('div', { style: 'text-align:right' },
          h('div', { style: 'font:700 16px/1.1 \'Barlow Condensed\';letter-spacing:.05em;text-transform:uppercase' }, 'You'),
          h('div', { style: `font:500 11px 'IBM Plex Mono';color:${hex ? '#7c8596' : '#8a8065'}` }, P.hand.length + ' hand · ' + P.deck.length + ' deck'),
        ),
      ),
    ),
    board,
    state.tut ? tutPanel() : null,
    // banner
    h('div', { style: `margin:12px 0 8px;padding:11px 16px;background:${hex ? '#131720' : '#2f2a1f'};border:1px solid ${state.tut && !g.over && !state.busy ? accent : (hex ? '#232a38' : '#4a422e')};border-radius:${hex ? '8px' : '0'};font:500 15px 'Barlow Condensed';letter-spacing:.03em;color:${bannerCol};text-align:center` }, bannerText),
    // hand scroller
    h('div', { class: 'fl-scroll', style: 'display:flex;gap:8px;overflow-x:auto;padding:4px 2px 10px;min-height:130px' }, hand),
    // controls
    h('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px' },
      h('div', { style: `display:flex;align-items:center;gap:8px;background:${hex ? '#131720' : '#2f2a1f'};border:1px solid ${hex ? '#232a38' : '#4a422e'};border-radius:${hex ? '8px' : '0'};padding:8px 12px` },
        h('span', { style: `font:700 10px 'IBM Plex Mono';letter-spacing:.12em;color:${hex ? '#7c8596' : '#8a8065'}` }, hex ? 'ENERGY' : 'SUPPLY'),
        h('span', { style: `font:700 20px 'IBM Plex Mono';color:${accent};line-height:1` }, P.energy),
        h('span', { style: `font:600 13px 'IBM Plex Mono';color:${hex ? '#556070' : '#6e654d'}` }, '/' + P.income),
      ),
      h('button', { onclick: () => toggleBank(), style: `background:${state.mode === 'bank' ? '#a4402c' : 'transparent'};color:${state.mode === 'bank' ? '#f0e8d2' : P.banked || !my ? '#6e654d' : accent};border:1.5px solid ${state.mode === 'bank' ? '#a4402c' : P.banked || !my ? (hex ? '#232a38' : '#4a422e') : accent};border-radius:${hex ? '8px' : '0'};padding:9px 14px;font:700 13.5px 'Barlow Condensed';letter-spacing:.06em;text-transform:uppercase;cursor:pointer` },
        state.mode === 'bank' ? 'Cancel' : P.banked ? (hex ? 'Fenced ✓' : 'Requisitioned ✓') : (hex ? 'Fence a card +1/+2' : 'Requisition +1/+2')),
      h('div', { style: 'flex:1' }),
      h('button', { onclick: () => concede(), style: `background:none;border:none;color:${hex ? '#7c8596' : '#6e654d'};font:600 13px 'Barlow Condensed';letter-spacing:.06em;text-transform:uppercase;cursor:pointer` }, hex ? 'fold' : 'surrender'),
      h('button', { onclick: () => endTurn(), style: `background:${endReady ? accent : (hex ? '#1e2433' : '#3a3526')};color:${endReady ? '#0b0d11' : '#6e654d'};border:none;border-radius:${hex ? '8px' : '0'};padding:11px 22px;font:700 15px 'Barlow Condensed';letter-spacing:.08em;text-transform:uppercase;cursor:${endReady ? 'pointer' : 'default'}` }, 'End turn ⚔'),
    ),
    logTicker(g, hex),
  );
}
