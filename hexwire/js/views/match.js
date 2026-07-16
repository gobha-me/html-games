// Match board view — ported 1:1 from the Hexwire prototype's cellView + matchView.
// Layout: enemy overwatch+street on top, block-threat strip, my street+overwatch
// below; banner state machine (incl. subvert/possess prompts); hand scroller;
// energy/fence bar; STREET FEED log. Card art layers behind cells + hand bands.
import { h } from '../dom.js';
import { state, session, myTurn, setState } from '../state.js';
import { SPELL_LINE, FCOL, LESSONS } from '../theme.js';
import { kwTags, defTags } from '../labels.js';
import { cardArt, cardArtBand, boardField } from '../art.js';
import { tapCard, tapCell, toggleBank, endTurn, concede, tutStep, loadLesson } from '../match.js';

function cellView(side, lane, row) {
  const g = session.g, FL = session.FL, s = state, st = tutStep();
  const u = g.board[side][lane][row];
  const mine = side === 'p';
  const selCard = s.sel != null ? g.players.p.hand.find(c => c.uid === s.sel) : null;
  const selDef = selCard ? FL.byId(selCard.id) : null;
  const my = myTurn();
  let clickable = false;
  if (my && selDef) {
    if (selDef.type === 'unit' && mine && !u && g.players.p.energy >= selDef.cost) {
      clickable = !s.tut || (st && st.do === 'deploy' && row === st.row && (st.lane == null || lane === st.lane));
    } else if (selDef.type === 'spell' && g.players.p.energy >= selDef.cost && !s.tut) {
      const k = selDef.spell.kind;
      if (k === 'bolt' && !mine && u) clickable = true;
      if (k === 'reinforce' && mine && u) clickable = true;
      if (k === 'redeploy' && mine && (s.pendFrom ? !u : !!u)) clickable = true;
      if (k === 'possess') {
        if (!mine && u && u.cost <= selDef.spell.cap && !u.beneath) clickable = true;
        if (mine && s.pendFrom && !u) clickable = true;
      }
    }
  }
  const isPossess = selDef && selDef.spell && selDef.spell.kind === 'possess';
  const pendHere = s.pendFrom && (isPossess ? !mine : mine) && s.pendFrom.lane === lane && s.pendFrom.row === row;
  const hexSel = clickable && isPossess;
  const accent = hexSel ? '#c77dff' : '#ff8a3d';
  const border = pendHere ? '2px solid #c77dff' : clickable ? (u ? `2px solid ${accent}` : `2px dashed ${accent}`) : row === 0 ? `1.5px solid ${mine ? '#1e4a41' : '#4a1e28'}` : `1.5px dashed ${mine ? '#1a3a34' : '#3a1a22'}`;
  const bg = u ? (mine ? 'rgba(47,214,184,.07)' : 'rgba(255,77,105,.07)') : 'rgba(14,17,23,.48)';
  const cell = h('div', {
    onclick: () => tapCell(side, lane, row),
    style: `position:relative;overflow:hidden;min-height:122px;border-radius:9px;border:${border};background:${bg};display:flex;align-items:${u ? 'flex-end' : 'center'};justify-content:center;padding:6px 4px;cursor:${clickable ? 'pointer' : 'default'};box-shadow:${clickable ? `0 0 0 3px ${hexSel ? 'rgba(199,125,255,.15)' : 'rgba(255,138,61,.14)'}` : 'none'};transition:.12s`,
  });
  if (u) {
    const eff = FL.effPow(g, side, lane, row);
    const bonus = eff - u.pow;
    const rng = u.kw.strike || 0;
    const meleeOn = row === 0, rngOn = row === 1 && rng > 0;
    const powTxt = bonus > 0 ? u.pow + '+' + bonus : String(u.pow);
    const powStyle = `font:800 ${meleeOn ? 17 : 12}px monospace;color:${meleeOn ? (bonus > 0 ? '#ff8a3d' : mine ? '#2fd6b8' : '#ff4d69') : '#5a6474'}`;
    const rngStyle = `font:800 ${rngOn ? 17 : 12}px monospace;color:${rngOn ? (mine ? '#2fd6b8' : '#ff4d69') : '#5a6474'}`;
    const tags = kwTags(u) + (u.sick ? (kwTags(u) ? ' · ' : '') + 'zzz' : '');
    const under = u.beneath ? '▼ ' + u.beneath.name + ' · channeling' : u.viaSpell ? '▼ possessed' : null;
    cell.append(
      cardArt(u.id),
      h('div', { style: `position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:2px;color:#e6eaf0;opacity:${u.sick ? .62 : 1};text-shadow:0 1px 4px rgba(0,0,0,.9);animation:flPop .22s ease` },
        h('div', { style: 'font:700 11px/1.1 Helvetica;text-align:center' }, u.name),
        h('div', { style: 'display:flex;gap:4px;align-items:baseline;justify-content:center' },
          h('span', { style: powStyle }, powTxt),
          h('span', { style: 'font:700 11px monospace;color:#3c4454' }, '/'),
          h('span', { style: rngStyle }, String(rng)),
          h('span', { style: 'font:600 11px monospace;opacity:.75;margin-left:5px' }, '♥' + u.hp),
        ),
        h('div', { style: `font:600 8.5px monospace;letter-spacing:.03em;color:${mine ? '#2fd6b8' : '#ff4d69'};opacity:.85;min-height:10px;text-align:center` }, tags),
        under && h('div', { style: 'margin-top:3px;font:700 8px monospace;letter-spacing:.06em;color:#c77dff;background:rgba(199,125,255,.12);border:1px solid rgba(199,125,255,.35);border-radius:4px;padding:2px 6px' }, under),
      ),
    );
  } else {
    cell.append(h('span', { style: `position:relative;z-index:1;font:700 9px monospace;letter-spacing:.14em;color:${mine ? '#1e4a41' : '#4a1e28'}` }, row === 0 ? 'STREET' : 'OVERWATCH'));
  }
  return cell;
}

function lifeBox(bg, life) {
  return h('div', { style: `width:44px;height:44px;border-radius:9px;background:${bg};color:#0b0d11;display:flex;align-items:center;justify-content:center;font:800 19px monospace;flex:none` }, Math.max(0, life));
}

export function matchView() {
  const g = session.g, FL = session.FL, s = state, t = tutStep();
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
    [0, 1, 2].map(l => h('div', { style: 'display:flex;align-items:center;justify-content:space-between;background:#0e1117;border:1px solid #1c222d;border-radius:7px;padding:4px 10px' },
      h('span', { style: 'font:700 11px monospace;color:#ff4d69' }, '↓' + FL.laneThreat(g, 'o', l)),
      h('span', { style: 'font:600 9px monospace;letter-spacing:.08em;color:#3c4454' }, 'BLOCK ' + (l + 1)),
      h('span', { style: 'font:700 11px monospace;color:#2fd6b8' }, '↑' + FL.laneThreat(g, 'p', l)),
    )));

  const hand = P.hand.map(c => {
    const d = FL.byId(c.id);
    const isSel = s.sel === c.uid;
    const aff = my && P.energy >= d.cost;
    const bankMode = s.mode === 'bank';
    const isSpell = d.type === 'spell';
    const fc = FCOL[d.f] || '#5a6474';
    const tutOk = !s.tut || (t && ((t.do === 'bank' && bankMode && c.id === t.card) || (t.do === 'deploy' && !bankMode && c.id === t.card)));
    const costBg = (aff || bankMode) && tutOk ? '#e6eaf0' : '#5a6474';
    return h('div', {
      onclick: () => tapCard(c.uid),
      style: `position:relative;overflow:hidden;flex:none;width:104px;min-height:180px;display:flex;flex-direction:column;border-radius:11px;background:#171c26;border:1.5px solid ${isSel ? '#ff8a3d' : (t && tutOk) ? '#53c7ff' : bankMode ? '#ff8a3d55' : fc + '44'};border-top:2.5px solid ${fc};cursor:pointer;transform:translateY(${isSel ? '-8px' : '0'});box-shadow:${isSel ? '0 12px 22px -10px rgba(0,0,0,.7)' : (t && tutOk) ? '0 0 0 3px rgba(83,199,255,.15)' : '0 2px 5px -3px rgba(0,0,0,.5)'};opacity:${((aff || bankMode) && tutOk) || !my ? 1 : .5};transition:.13s`,
    },
      cardArtBand(c.id, 74),
      h('div', { style: 'position:relative;z-index:1;display:flex;flex-direction:column;flex:1;min-height:0;padding:9px 10px' },
        h('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' },
          h('div', { style: `width:22px;height:22px;border-radius:6px;background:${costBg};color:#0b0d11;display:flex;align-items:center;justify-content:center;font:700 12px monospace` }, d.cost),
          h('div', { style: `font:600 8.5px monospace;color:${fc}` }, isSpell ? 'SPELL' : 'UNIT'),
        ),
        h('div', { style: 'font-weight:700;font-size:12.5px;line-height:1.15;margin-top:6px;color:#e6eaf0' }, d.name),
        h('div', { style: 'flex:1' }),
        h('div', { style: 'font:500 9.5px/1.35 monospace;color:#7a8494;min-height:13px' }, isSpell ? SPELL_LINE[d.spell.kind] : defTags(d)),
        h('div', { style: 'display:flex;justify-content:space-between;align-items:flex-end;margin-top:4px' },
          h('div', { style: 'font:700 16px monospace;color:#e6eaf0' }, isSpell ? '✦' : d.pow + '/' + (d.kw.strike || 0)),
          h('div', { style: 'font:600 11px monospace;color:#7a8494' }, isSpell ? '' : '♥' + d.hp),
        ),
      ),
    );
  });

  // ----- banner state machine -----
  let bannerText, bannerCol = '#9aa4b4', bannerBg = '#131720', onBanner = null;
  const selCard = s.sel != null ? P.hand.find(c => c.uid === s.sel) : null;
  const selDef = selCard ? FL.byId(selCard.id) : null;
  if (s.tut && !g.over) {
    const L = LESSONS[s.tut.les];
    bannerCol = '#53c7ff'; bannerBg = '#101a24';
    if (s.busy) bannerText = 'Combat resolves…';
    else if (s.tut.phase === 'recap') {
      if (L.puzzle) {
        bannerText = '✗ Rival survives at ' + Math.max(0, O.life) + '♥. ' + L.fail + ' Tap to retry the solve.';
        bannerCol = '#ff8a3d';
        onBanner = () => loadLesson(s.tut.les);
      } else {
        bannerText = '✓ ' + L.recap + '  (tap for lesson ' + (s.tut.les + 2) + '/' + LESSONS.length + ')';
        bannerCol = '#2fd6b8';
        onBanner = () => loadLesson(s.tut.les + 1);
      }
    } else bannerText = 'LESSON ' + (s.tut.les + 1) + '/' + LESSONS.length + ' · ' + L.title + ' — ' + L.steps[s.tut.step].text;
  } else if (g.over) bannerText = 'Match over.';
  else if (s.coin) bannerText = 'Init chip in the air…';
  else if (s.busy) { bannerText = g.active === 'o' ? 'Rival crew is thinking…' : 'Combat resolves…'; bannerCol = '#ff4d69'; }
  else if (s.mode === 'bank') { bannerText = P.banked ? 'Already fenced this turn.' : 'Tap a card to fence it: +1 income, +2 if it costs 4+.'; bannerCol = '#ff8a3d'; }
  else if (selDef && selDef.type === 'unit') {
    if (P.energy < selDef.cost) { bannerText = 'Not enough energy for ' + selDef.name + '.'; bannerCol = '#ff8a3d'; }
    else if (selDef.kw && selDef.kw.subvert) { bannerText = 'Tap an empty cell — if the closest enemy in that block costs ≤' + selDef.kw.subvert + ', the Puppeteer seizes it and hides beneath.'; bannerCol = '#c77dff'; }
    else { bannerText = 'Tap an empty cell — power reads street/overwatch: ' + selDef.pow + ' up front, ' + (selDef.kw.strike || 0) + ' from the back.'; bannerCol = '#ff8a3d'; }
  } else if (selDef && selDef.type === 'spell') {
    const k = selDef.spell.kind;
    bannerText = k === 'bolt' ? 'Tap an enemy unit to Hexbolt it.' : k === 'reinforce' ? 'Tap one of your units to stim.' : k === 'redeploy' ? (s.pendFrom ? 'Now tap an empty cell to blink it there.' : 'Tap one of your units to move.') : k === 'possess' ? (s.pendFrom ? 'Now tap an empty cell on your side — it switches sides for good.' : 'Tap an enemy unit (cost ≤2) to possess.') : 'Tap the card again to cast ' + selDef.name + '.';
    bannerCol = k === 'possess' ? '#c77dff' : '#ff8a3d';
  } else bannerText = 'Your turn — tap a card, then a cell. Fence once for income. End turn to fight.';

  const board = h('div', { style: 'position:relative;overflow:hidden;background:#131720;border:1px solid #232a36;border-radius:14px;padding:10px' },
    boardField(),
    h('div', { style: 'position:relative;z-index:1' }, grid(cellsTop), laneMid, grid(cellsBot)),
  );

  const oppName = s.tut != null ? 'Training Daemon' : 'Rival Crew';

  return h('div', { 'data-screen-label': 'Match' },
    // header
    h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;flex-wrap:wrap' },
      h('div', { style: 'display:flex;align-items:center;gap:11px' },
        lifeBox('#ff4d69', O.life),
        h('div', {},
          h('div', { style: 'font-weight:700;font-size:14px;line-height:1.15' }, oppName, ' ', h('span', { style: 'font-weight:400;color:#5a6474;font-size:11px' }, '(AI)')),
          h('div', { style: 'font:500 11px monospace;color:#5a6474' }, O.hand.length + ' hand · ' + O.deck.length + ' deck · ⚡' + O.energy + '/' + O.income),
        ),
      ),
      h('div', { style: 'font:700 11px monospace;letter-spacing:.12em;color:#5a6474' }, 'TURN ' + Math.max(1, g.tc.p)),
      h('div', { style: 'display:flex;align-items:center;gap:11px;flex-direction:row-reverse' },
        lifeBox('#2fd6b8', P.life),
        h('div', { style: 'text-align:right' },
          h('div', { style: 'font-weight:700;font-size:14px;line-height:1.15' }, 'You'),
          h('div', { style: 'font:500 11px monospace;color:#5a6474' }, P.hand.length + ' hand · ' + P.deck.length + ' deck'),
        ),
      ),
    ),
    board,
    // banner
    h('div', { onclick: onBanner || undefined, style: `margin:12px 0 8px;padding:11px 16px;border-radius:10px;background:${bannerBg};border:1px solid ${s.tut && !g.over ? (s.tut.phase === 'recap' && !s.busy ? '#2fd6b855' : '#2a4a5e') : '#232a36'};font:500 13px Helvetica;color:${bannerCol};text-align:center;cursor:${onBanner ? 'pointer' : 'default'}` }, bannerText),
    // hand scroller
    h('div', { class: 'hw-scroll', style: 'display:flex;gap:8px;overflow-x:auto;padding:4px 2px 10px;min-height:190px' }, hand),
    // controls
    h('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:4px' },
      h('div', { style: 'display:flex;align-items:center;gap:8px;background:#131720;border:1px solid #232a36;border-radius:9px;padding:8px 12px' },
        h('span', { style: 'font:700 10px monospace;letter-spacing:.1em;color:#5a6474' }, 'ENERGY'),
        h('span', { style: 'font:800 20px monospace;color:#2fd6b8;line-height:1' }, P.energy),
        h('span', { style: 'font:600 13px monospace;color:#3c4454' }, '/' + P.income),
      ),
      h('button', { onclick: () => toggleBank(), style: `background:${s.mode === 'bank' ? '#ff8a3d' : 'transparent'};color:${s.mode === 'bank' ? '#0b0d11' : P.banked || !my ? '#3c4454' : '#ff8a3d'};border:1.5px solid ${P.banked || !my ? '#232a36' : '#ff8a3d'};border-radius:9px;padding:9px 14px;font:700 12.5px Helvetica;cursor:pointer;box-shadow:${t && t.do === 'bank' && s.mode !== 'bank' ? '0 0 0 3px rgba(83,199,255,.25)' : 'none'}` },
        s.mode === 'bank' ? 'Cancel fence' : P.banked ? 'Fenced ✓' : 'Fence a card +1/+2'),
      h('div', { style: 'flex:1' }),
      h('button', { onclick: () => concede(), style: 'background:none;border:none;color:#3c4454;font:600 12px Helvetica;cursor:pointer' }, 'concede'),
      h('button', { onclick: () => endTurn(), style: `background:${my ? '#ff8a3d' : '#1c222d'};color:${my ? '#0b0d11' : '#3c4454'};border:none;border-radius:9px;padding:11px 22px;font:700 13.5px Helvetica;cursor:${my ? 'pointer' : 'default'};box-shadow:${t && t.do === 'end' && my ? '0 0 0 3px rgba(83,199,255,.25)' : 'none'}` }, 'End turn ⚔'),
    ),
    // STREET FEED
    h('div', { style: 'margin-top:12px;padding-top:10px;border-top:1px solid #232a36;font:500 11.5px/1.7 monospace;min-height:20px' },
      h('div', { style: 'font:700 9px monospace;letter-spacing:.14em;color:#3c4454;margin-bottom:3px' }, 'STREET FEED'),
      g.log.slice(0, 6).map((x, i) => h('div', { style: `opacity:${1 - i * .14};color:${/^(⚔ |☍ )?You|^Your/.test(x) ? '#2fd6b8' : /^(⚔ |☍ )?AI/.test(x) ? '#ff4d69' : '#5a6474'}` }, x)),
    ),
  );
}
