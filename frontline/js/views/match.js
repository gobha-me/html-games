// Match board view — ported 1:1 from the DC prototype's cellView + matchView.
// Layout: enemy rear+line on top, sector-threat strip, my line+emplacements below;
// banner state machine; hand scroller; supply/requisition/end-turn; dispatches log.
import { h } from '../dom.js';
import { state, session, myTurn } from '../state.js';
import { SPELL_LINE } from '../theme.js';
import { kwTags, defTags } from '../labels.js';
import { cardArt, cardArtBand, boardField } from '../art.js';
import { tapCard, tapCell, toggleBank, endTurn, concede, tutTurn1Done } from '../match.js';

function cellView(side, lane, row) {
  const g = session.g, FL = session.FL;
  const u = g.board[side][lane][row];
  const mine = side === 'p';
  const selCard = state.sel != null ? g.players.p.hand.find(c => c.uid === state.sel) : null;
  const selDef = selCard ? FL.byId(selCard.id) : null;
  const my = myTurn();
  let clickable = false;
  if (my && selDef) {
    if (selDef.type === 'unit' && mine && !u && g.players.p.energy >= selDef.cost) clickable = true;
    else if (selDef.type === 'spell') {
      const k = selDef.spell.kind;
      if (k === 'bolt' && !mine && u) clickable = true;
      if (k === 'reinforce' && mine && u) clickable = true;
      if (k === 'redeploy' && mine && (state.pendFrom ? !u : !!u)) clickable = true;
    }
  }
  const pendHere = state.pendFrom && mine && state.pendFrom.lane === lane && state.pendFrom.row === row;
  const border = pendHere ? '2px solid #e8dfc6' : clickable ? '2px dashed #c9a227' : row === 0 ? `1.5px solid ${mine ? '#4e5535' : '#5c3b31'}` : `1.5px dashed ${mine ? '#454b30' : '#50352c'}`;
  const bg = u ? (mine ? '#39402a' : '#46302a') : '#2a261c';
  const cell = h('div', {
    onclick: () => tapCell(side, lane, row),
    style: `position:relative;overflow:hidden;min-height:80px;border:${border};background:${bg};display:flex;align-items:center;justify-content:center;padding:6px 4px;cursor:${clickable ? 'pointer' : 'default'};box-shadow:${clickable ? '0 0 0 3px rgba(201,162,39,.18)' : 'none'};transition:.12s`,
  });
  if (u) {
    const eff = FL.effPow(g, side, lane, row);
    const bonus = eff - u.pow;
    const tags = kwTags(u) + (u.sick ? (kwTags(u) ? ' · ' : '') + 'DIG IN' : '');
    cell.append(
      cardArt(u.id),
      h('div', { style: `position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:2px;color:#e8dfc6;opacity:${u.sick ? .6 : 1};animation:flPop .22s ease` },
        h('div', { style: 'font:700 12px/1.1 \'Barlow Condensed\';letter-spacing:.04em;text-transform:uppercase;text-align:center' }, u.name),
        h('div', { style: 'display:flex;gap:7px;align-items:baseline;justify-content:center' },
          h('span', { style: `font:700 17px 'IBM Plex Mono';color:${bonus > 0 ? '#c9a227' : mine ? '#b7cb76' : '#e08a70'}` }, (bonus > 0 ? u.pow + '+' + bonus : String(u.pow)) + '/' + u.rng),
          h('span', { style: 'font:600 11px \'IBM Plex Mono\';opacity:.8' }, '♥' + u.hp),
        ),
        h('div', { style: `font:600 8.5px 'IBM Plex Mono';letter-spacing:.05em;color:${mine ? '#9db35e' : '#d06a52'};opacity:.9;min-height:10px;text-align:center` }, tags),
      ),
    );
  } else {
    cell.append(h('span', { style: `position:relative;z-index:1;font:700 8.5px 'IBM Plex Mono';letter-spacing:.16em;color:${mine ? '#4e5535' : '#5c3b31'}` },
      row === 0 ? (mine ? 'THE LINE' : 'THEIR LINE') : (mine ? 'EMPLACEMENT' : 'REAR')));
  }
  return cell;
}

function lifeBox(bg, life) {
  return h('div', { style: `width:46px;height:46px;background:${bg};color:#f0e8d2;display:flex;align-items:center;justify-content:center;font:700 20px 'IBM Plex Mono';flex:none;clip-path:polygon(8% 0,100% 0,92% 100%,0 100%)` }, Math.max(0, life));
}

export function matchView() {
  const g = session.g, FL = session.FL;
  if (!g) return h('div', {});
  const P = g.players.p, O = g.players.o;
  const my = myTurn();

  const cellsTop = [], cellsBot = [];
  for (let l = 0; l < 3; l++) cellsTop.push(cellView('o', l, 1));
  for (let l = 0; l < 3; l++) cellsTop.push(cellView('o', l, 0));
  for (let l = 0; l < 3; l++) cellsBot.push(cellView('p', l, 0));
  for (let l = 0; l < 3; l++) cellsBot.push(cellView('p', l, 1));

  const grid = kids => h('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:7px' }, kids);
  const laneMid = h('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:7px 0' },
    [0, 1, 2].map(l => h('div', { style: 'display:flex;align-items:center;justify-content:space-between;background:repeating-linear-gradient(135deg,#3a3526 0 8px,#332e21 8px 16px);padding:5px 10px;border:1px solid #4a422e' },
      h('span', { style: 'font:700 11px \'IBM Plex Mono\';color:#d06a52' }, '↓' + FL.laneThreat(g, 'o', l)),
      h('span', { style: 'font:600 10px \'IBM Plex Mono\';letter-spacing:.14em;color:#8a8065' }, 'SECTOR ' + 'ABC'[l]),
      h('span', { style: 'font:700 11px \'IBM Plex Mono\';color:#9db35e' }, '↑' + FL.laneThreat(g, 'p', l)),
    )));

  const hand = P.hand.map(c => {
    const d = FL.byId(c.id);
    const isSel = state.sel === c.uid;
    const aff = my && P.energy >= d.cost;
    const bankMode = state.mode === 'bank';
    const isSpell = d.type === 'spell';
    const card = h('div', {
      onclick: () => tapCard(c.uid),
      style: `position:relative;overflow:hidden;flex:none;width:106px;min-height:150px;display:flex;flex-direction:column;background:#efe6cf;border:2px solid ${isSel ? '#c9a227' : bankMode ? '#a4402c' : isSpell ? '#8a7f9e' : '#b9ad8b'};cursor:pointer;transform:translateY(${isSel ? '-8px' : '0'});box-shadow:${isSel ? '0 12px 22px -10px rgba(0,0,0,.6)' : '0 2px 5px -3px rgba(0,0,0,.5)'};opacity:${(aff || bankMode || !my) ? 1 : .55};transition:.13s`,
    },
      cardArtBand(c.id),
      h('div', { style: 'position:relative;z-index:1;display:flex;flex-direction:column;flex:1;min-height:0;padding:8px 9px' },
        h('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' },
          h('div', { style: `width:22px;height:22px;background:${(aff || bankMode) ? '#2a2517' : '#988d70'};color:#f0e8d2;display:flex;align-items:center;justify-content:center;font:700 12px 'IBM Plex Mono'` }, d.cost),
          h('div', { style: 'font:600 8.5px \'IBM Plex Mono\';letter-spacing:.08em;color:#988d70' }, isSpell ? 'ORDER' : 'UNIT'),
        ),
        h('div', { style: 'font:700 13.5px/1.1 \'Barlow Condensed\';letter-spacing:.03em;text-transform:uppercase;margin-top:6px;color:#2a2517' }, d.name),
        h('div', { style: 'flex:1' }),
        h('div', { style: 'font:500 9.5px/1.35 \'IBM Plex Mono\';color:#7a7052;min-height:13px' }, isSpell ? SPELL_LINE[d.spell.kind] : defTags(d)),
        h('div', { style: 'display:flex;justify-content:space-between;align-items:flex-end;margin-top:4px' },
          h('div', { style: 'font:700 17px \'IBM Plex Mono\';color:#2a2517' }, isSpell ? '✦' : d.pow + '/' + d.rng),
          h('div', { style: 'font:600 11px \'IBM Plex Mono\';color:#7a7052' }, isSpell ? '' : '♥' + d.hp),
        ),
      ),
    );
    return card;
  });

  // ----- banner state machine -----
  let bannerText, bannerCol = '#b3a88a';
  const selCard = state.sel != null ? P.hand.find(c => c.uid === state.sel) : null;
  const selDef = selCard ? FL.byId(selCard.id) : null;
  if (g.over) bannerText = 'Engagement over.';
  else if (state.coin) bannerText = 'Awaiting field orders…';
  else if (state.busy) { bannerText = g.active === 'o' ? 'Enemy command is deliberating…' : 'The guns speak…'; bannerCol = '#d06a52'; }
  else if (state.mode === 'bank') { bannerText = P.banked ? 'Already requisitioned this turn.' : 'Tap a card to requisition it: +1 supply, +2 if it costs 4+.'; bannerCol = '#c9a227'; }
  else if (selDef && selDef.type === 'unit') { bannerText = P.energy >= selDef.cost ? 'Tap an empty position — M power fights on the line, R power fires from emplacements.' : 'Not enough supply for ' + selDef.name + '.'; bannerCol = '#c9a227'; }
  else if (selDef && selDef.type === 'spell') {
    const k = selDef.spell.kind;
    bannerText = k === 'bolt' ? 'Tap an enemy unit to shell it.' : k === 'reinforce' ? 'Tap one of your units to Fortify.' : k === 'redeploy' ? (state.pendFrom ? 'Now tap an empty position to march to.' : 'Tap one of your units to march.') : 'Tap the card again to issue ' + selDef.name + '.';
    bannerCol = '#c9a227';
  }
  else if (state.tut && my) {
    let front = false, back = false;
    for (let l = 0; l < 3; l++) { if (g.board.p[l][0]) front = true; if (g.board.p[l][1]) back = true; }
    if (g.tc.p === 1) {
      bannerText = 'TRAINING — ' + (P.banked ? '✓ requisitioned' : '① press Requisition, then tap a card to bank it') +
        ' · ' + (front ? '✓ line held' : '② deploy the Rifleman on THE LINE') +
        ' · ' + (back ? '✓ guns dug in' : '③ deploy the Mortar Team in the EMPLACEMENT behind him');
    } else {
      bannerText = 'TRAINING — free fire. Flanks ◀▶ lend power to row neighbours; Bulwark units must be shot first; open sectors hit HQ. Break their morale (' + Math.max(0, O.life) + ' left).';
    }
    bannerCol = '#c9a227';
  }
  else bannerText = 'Your move — tap a card, then a position. Requisition once for supply. End turn to fight.';

  const endReady = my && !(state.tut && g.tc.p === 1 && !tutTurn1Done());

  const board = h('div', { style: 'position:relative;overflow:hidden;background:#2f2a1f;border:1px solid #4a422e;padding:10px' },
    boardField(),
    h('div', { style: 'position:relative;z-index:1' }, grid(cellsTop), laneMid, grid(cellsBot)),
  );

  return h('div', { 'data-screen-label': 'Match' },
    // header: enemy · tag · you
    h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap' },
      h('div', { style: 'display:flex;align-items:center;gap:11px' },
        lifeBox('#a4402c', O.life),
        h('div', {},
          h('div', { style: 'font:700 16px/1.1 \'Barlow Condensed\';letter-spacing:.05em;text-transform:uppercase' }, state.oppName),
          h('div', { style: 'font:500 11px \'IBM Plex Mono\';color:#8a8065' }, O.hand.length + ' hand · ' + O.deck.length + ' supply · ⚡' + O.energy + '/' + O.income),
        ),
      ),
      h('div', { style: 'font:700 12px \'IBM Plex Mono\';letter-spacing:.16em;color:#c9a227' }, state.tut ? 'FIELD TRAINING' : 'TURN ' + Math.max(1, g.tc.p)),
      h('div', { style: 'display:flex;align-items:center;gap:11px;flex-direction:row-reverse' },
        lifeBox('#6b7a3f', P.life),
        h('div', { style: 'text-align:right' },
          h('div', { style: 'font:700 16px/1.1 \'Barlow Condensed\';letter-spacing:.05em;text-transform:uppercase' }, 'You'),
          h('div', { style: 'font:500 11px \'IBM Plex Mono\';color:#8a8065' }, P.hand.length + ' hand · ' + P.deck.length + ' supply'),
        ),
      ),
    ),
    board,
    // banner
    h('div', { style: `margin:12px 0 8px;padding:11px 16px;background:#2f2a1f;border:1px solid ${state.tut && !g.over && !state.busy ? '#c9a227' : '#4a422e'};font:500 15px 'Barlow Condensed';letter-spacing:.03em;color:${bannerCol};text-align:center` }, bannerText),
    // hand scroller
    h('div', { class: 'fl-scroll', style: 'display:flex;gap:8px;overflow-x:auto;padding:4px 2px 10px;min-height:130px' }, hand),
    // controls
    h('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px' },
      h('div', { style: 'display:flex;align-items:center;gap:8px;background:#2f2a1f;border:1px solid #4a422e;padding:8px 12px' },
        h('span', { style: 'font:700 10px \'IBM Plex Mono\';letter-spacing:.12em;color:#8a8065' }, 'SUPPLY'),
        h('span', { style: 'font:700 20px \'IBM Plex Mono\';color:#c9a227;line-height:1' }, P.energy),
        h('span', { style: 'font:600 13px \'IBM Plex Mono\';color:#6e654d' }, '/' + P.income),
      ),
      h('button', { onclick: () => toggleBank(), style: `background:${state.mode === 'bank' ? '#a4402c' : 'transparent'};color:${state.mode === 'bank' ? '#f0e8d2' : P.banked || !my ? '#6e654d' : '#c9a227'};border:1.5px solid ${state.mode === 'bank' ? '#a4402c' : P.banked || !my ? '#4a422e' : '#c9a227'};padding:9px 14px;font:700 13.5px 'Barlow Condensed';letter-spacing:.06em;text-transform:uppercase;cursor:pointer` },
        state.mode === 'bank' ? 'Cancel' : P.banked ? 'Requisitioned ✓' : 'Requisition +1/+2'),
      h('div', { style: 'flex:1' }),
      h('button', { onclick: () => concede(), style: 'background:none;border:none;color:#6e654d;font:600 13px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer' }, 'surrender'),
      h('button', { onclick: () => endTurn(), style: `background:${endReady ? '#c9a227' : '#3a3526'};color:${endReady ? '#26221a' : '#6e654d'};border:none;padding:11px 22px;font:700 15px 'Barlow Condensed';letter-spacing:.08em;text-transform:uppercase;cursor:${endReady ? 'pointer' : 'default'}` }, 'End turn ⚔'),
    ),
    // dispatches log
    h('div', { style: 'margin-top:12px;padding-top:10px;border-top:1px solid #4a422e;font:500 11.5px/1.7 \'IBM Plex Mono\';min-height:20px' },
      h('div', { style: 'font:700 9px \'IBM Plex Mono\';letter-spacing:.16em;color:#6e654d;margin-bottom:3px' }, 'DISPATCHES'),
      g.log.slice(0, 6).map((t, i) => h('div', { style: `opacity:${1 - i * .14};color:${/^(⚔ )?You|^Your/.test(t) ? '#9db35e' : /^(⚔ )?AI/.test(t) ? '#d06a52' : '#8a8065'}` }, t)),
    ),
  );
}
