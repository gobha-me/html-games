// Fixed overlays layered above the current screen: card zoom preview, initiative coin/weathervane,
// game-over card, Syndicate matchmaking modal (Hexwire), and playtest settings.
import { h } from '../dom.js';
import { state, session, setState, ping } from '../state.js';
import { savePrefs } from '../store.js';
import { startMatch } from '../match.js';
import { focalY, cardImgSrc } from '../art.js';
import { SPELL_LINE, KW_NAMES_FL, KW_NAMES_HW, KW_REMINDER } from '../theme.js';

let _zTimer = null, _zEl = null, _zId = null, _zEsc = null, _zAway = null;

export function scheduleCardZoom(id, anchorEl) {
  clearTimeout(_zTimer);
  _zTimer = setTimeout(() => showCardZoom(id, anchorEl), 250);
  new Image().src = cardImgSrc(id);
}
export function cancelCardZoom() { clearTimeout(_zTimer); closeCardZoom(); }
export function toggleCardZoom(id, anchorEl) {
  clearTimeout(_zTimer);
  if (_zId === id) closeCardZoom(); else showCardZoom(id, anchorEl);
}
export function closeCardZoom() {
  clearTimeout(_zTimer);
  if (_zEl) _zEl.remove();
  _zEl = null; _zId = null;
  if (_zEsc) { window.removeEventListener('keydown', _zEsc); _zEsc = null; }
  if (_zAway) { document.removeEventListener('pointerdown', _zAway, true); _zAway = null; }
}

function showCardZoom(id, anchorEl) {
  closeCardZoom();
  const c = (session.FL?.POOL || []).find(x => x.id === id);
  if (!c) return;
  const r = anchorEl.getBoundingClientRect();
  const side = (r.left + r.right) / 2 < window.innerWidth / 2 ? 'right' : 'left';
  _zEl = zoomCard(c, side);
  _zId = id;
  document.body.append(_zEl);
  _zEsc = e => { if (e.key === 'Escape') closeCardZoom(); };
  window.addEventListener('keydown', _zEsc);
  _zAway = e => { if (_zEl && !_zEl.contains(e.target) && !anchorEl.contains(e.target)) closeCardZoom(); };
  setTimeout(() => _zAway && document.addEventListener('pointerdown', _zAway, true), 0);
}

function statChip(label, val, accent, hex) {
  return h('div', { style: `display:flex;align-items:baseline;gap:3px;padding:4px 9px;background:${hex ? '#0e1117' : '#26221a'};border:1px solid ${hex ? '#232a38' : '#4a422e'};border-radius:${hex ? '6px' : '0'}` },
    h('span', { style: `font:700 10px 'IBM Plex Mono';letter-spacing:.1em;color:${hex ? '#7c8596' : '#8a8065'}` }, label),
    h('span', { style: `font:700 17px 'IBM Plex Mono';color:${accent}` }, val),
  );
}

function zoomCard(c, side) {
  const hex = state.style === 'hexwire';
  const accent = hex ? '#c77dff' : '#c9a227';
  const kwNames = hex ? KW_NAMES_HW : KW_NAMES_FL;
  const isSpell = c.type === 'spell';
  const pos = side === 'left' ? 'left:24px' : 'right:24px';
  const wrap = h('div', {
    onmouseleave: () => { if (window.matchMedia('(hover:hover)').matches) closeCardZoom(); },
    style: `position:fixed;${pos};top:50%;transform:translateY(-50%);width:420px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:auto;background:${hex ? '#131720' : '#2f2a1f'};border:2px solid ${accent};border-radius:${hex ? '14px' : '0'};box-shadow:0 30px 70px -20px rgba(0,0,0,.85);z-index:70;animation:flPop .16s ease`,
  });

  const art = h('div', { style: 'position:relative;height:300px;background:#111;overflow:hidden' });
  const img = h('img', { src: cardImgSrc(c.id), alt: '', style: `width:100%;height:100%;object-fit:cover;object-position:50% ${focalY(c.id)};display:block` });
  img.addEventListener('error', () => { art.style.height = '120px'; });
  const scrim = h('div', { style: `position:absolute;inset:0;background:linear-gradient(180deg,rgba(19,23,32,0) 55%,${hex ? 'rgba(19,23,32,.92)' : 'rgba(38,34,26,.85)'} 100%)` });
  const cost = h('div', { style: `position:absolute;top:0;left:0;min-width:32px;height:32px;padding:0 7px;background:${accent};color:#111;display:flex;align-items:center;justify-content:center;font:700 20px 'IBM Plex Mono'` }, c.cost);
  const kind = h('div', { style: 'position:absolute;top:8px;right:10px;font:700 10px \'IBM Plex Mono\';letter-spacing:.16em;color:#e8dfc6;text-shadow:0 1px 3px rgba(0,0,0,.8)' }, isSpell ? (hex ? 'HEX' : 'ORDER') : (hex ? c.f.toUpperCase() : 'UNIT'));
  art.append(img, scrim, cost, kind);

  const rPow = session.FL ? session.FL.backRowPower(c) : (c.rng || 0);
  const stats = isSpell
    ? h('div', { style: `font:600 15px 'Barlow Condensed';letter-spacing:.03em;color:${accent};margin-bottom:4px` }, SPELL_LINE[c.spell.kind])
    : h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px' },
        statChip(hex ? 'STR' : 'M', c.pow, '#e8dfc6', hex),
        rPow > 0 ? statChip(hex ? 'OVW' : 'R', rPow, hex ? '#53c7ff' : '#9db35e', hex) : null,
        statChip('♥', c.hp, '#d06a52', hex),
        (c.flanks && (c.flanks[0] || c.flanks[1])) ? statChip('◀▶', c.flanks[0] + '·' + c.flanks[1], accent, hex) : null,
      );

  const kwRows = [];
  if (!isSpell) {
    for (const k of ['guard', 'shield', 'rally', 'haste', 'venom', 'pierce', 'subvert']) {
      if (!c.kw[k]) continue;
      kwRows.push(h('div', { style: 'margin-top:9px' },
        h('div', { style: `font:700 12px 'Barlow Condensed';letter-spacing:.06em;text-transform:uppercase;color:${accent}` }, kwNames[k] + (k === 'rally' || k === 'subvert' ? ' ' + c.kw[k] : '')),
        h('div', { style: `font:500 12px/1.5 'IBM Plex Mono';color:${hex ? '#9aa3b2' : '#b3a88a'}` }, KW_REMINDER[k].replace('{n}', c.kw[k])),
      ));
    }
    const role = rPow > 0
      ? (hex ? 'Fires from Overwatch (back row) while your Street in front holds.' : 'Fires from the emplacement (back row), over the line it holds.')
      : (hex ? 'Brawls on the Street (front row) down its block.' : 'Fights on the line (front row), down its sector.');
    kwRows.push(h('div', { style: `margin-top:12px;padding-top:9px;border-top:1px dashed ${hex ? '#232a38' : '#4a422e'};font:500 11px/1.5 'IBM Plex Mono';color:${hex ? '#7c8596' : '#6e654d'}` }, role));
  }

  const body = h('div', { style: 'padding:14px 16px 16px' },
    h('div', { style: 'font:700 22px \'Barlow Condensed\';letter-spacing:.03em;text-transform:uppercase;color:#e8dfc6;margin-bottom:8px' }, c.name),
    stats,
    ...kwRows,
  );

  wrap.append(art, body);
  return wrap;
}

function coinOverlay() {
  const hex = state.style === 'hexwire';
  const first = state.coin.first;
  const mine = first === 'p';

  if (hex) {
    return h('div', { style: 'position:fixed;inset:0;background:rgba(8,10,15,.78);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:60' },
      h('div', { style: 'background:#131720;color:#ece8df;padding:28px 40px;text-align:center;border-radius:14px;border:2px solid #c77dff;box-shadow:0 30px 60px -20px rgba(0,0,0,.85);animation:flPop .2s ease' },
        h('div', { style: 'font:700 11px \'IBM Plex Mono\';letter-spacing:.2em;color:#7c8596;margin-bottom:10px' }, 'CREDSTICK TOSS'),
        h('div', { style: 'width:84px;height:84px;margin:0 auto 14px;border-radius:50%;background:radial-gradient(circle,#c77dff,#53c7ff);display:flex;align-items:center;justify-content:center;font:700 22px \'IBM Plex Mono\';color:#0b0d11;animation:flCoin 1.1s ease forwards' }, mine ? 'YOU' : 'FOE'),
        h('div', { style: `font:400 24px 'Saira Stencil One';text-transform:uppercase;color:${mine ? '#53c7ff' : '#d06a52'}` }, mine ? 'You Have Initiative' : state.oppName + ' Moves First'),
        h('div', { style: 'font:500 11.5px \'IBM Plex Mono\';color:#9aa3b2;margin-top:8px' }, 'second player draws +1 extra card on turn 1'),
      ),
    );
  }

  const win = mine ? '#6b7a3f' : '#a4402c';
  const text = mine ? 'The wind favors you' : 'The wind favors ' + state.oppName;
  const sub = mine ? 'You move first' : state.oppName + ' moves first';

  const needle = h('div', { style: `position:absolute;left:50%;top:50%;width:22px;height:70px;margin:-35px 0 0 -11px;background:#c9a227;clip-path:polygon(50% 0,100% 40%,63% 40%,63% 100%,37% 100%,37% 40%,0 40%);transform-origin:50% 50%;animation:${mine ? 'flVaneDown' : 'flVaneUp'} 1.4s cubic-bezier(.16,.84,.28,1.04) forwards;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))` });

  const poleLabel = (txt, top) => h('div', {
    style: `position:absolute;left:0;right:0;${top ? 'top:5px' : 'bottom:5px'};text-align:center;font:700 9px 'IBM Plex Mono';letter-spacing:.16em;color:#6e654d`,
  }, txt);

  const dial = h('div', { style: 'position:relative;width:112px;height:112px;margin:6px auto 18px;border-radius:50%;background:radial-gradient(circle at 50% 45%,#efe6cf,#d8ceb0);border:3px double #b39a3a;box-shadow:inset 0 0 16px rgba(120,100,50,.35),0 4px 10px -4px rgba(0,0,0,.4)' },
    poleLabel('FOE', true),
    poleLabel('YOU', false),
    needle,
    h('div', { style: 'position:absolute;left:50%;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;border-radius:50%;background:#8a6f26;box-shadow:0 0 0 2px #efe6cf' }),
  );

  return h('div', { style: 'position:fixed;inset:0;background:rgba(20,17,11,.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:60' },
    h('div', { style: 'background:#efe6cf;color:#2a2517;padding:28px 40px;text-align:center;box-shadow:0 30px 60px -20px rgba(0,0,0,.7);animation:flPop .2s ease;border:2px solid #c9a227' },
      h('div', { style: 'font:700 11px \'IBM Plex Mono\';letter-spacing:.2em;color:#7a7052;margin-bottom:6px' }, 'READING THE WIND'),
      dial,
      h('div', { style: `font:400 24px 'Saira Stencil One';text-transform:uppercase;color:${win};animation:flFade .3s ease 1.35s backwards` }, text),
      h('div', { style: 'font:600 13px \'Barlow Condensed\';letter-spacing:.08em;text-transform:uppercase;color:#5a5138;margin-top:2px;animation:flFade .3s ease 1.45s backwards' }, sub),
      h('div', { style: 'font:500 11.5px \'IBM Plex Mono\';color:#7a7052;margin-top:8px;animation:flFade .3s ease 1.55s backwards' }, 'first to move forfeits its first draw'),
    ),
  );
}

function gameOverOverlay() {
  const hex = state.style === 'hexwire';
  const g = session.g, P = g.players.p, O = g.players.o;
  const win = g.winner === 'p';
  const delta = g._delta || 0;
  const standing = state.tut ? 'Training engagement — no standing change.'
    : delta > 0 ? '+' + delta + ' rating → ' + session.rating + '.'
    : delta < 0 ? delta + ' rating → ' + session.rating + '.' : '';
  const title = g.winner === 'draw' ? 'Stalemate' : win ? 'Victory' : 'Defeat';
  const sub = (hex ? 'Life ' : 'Morale ') + Math.max(0, P.life) + '–' + Math.max(0, O.life) + ' · ' + g.tc.p + ' turns · vs ' + state.oppName + '. ' + standing;
  return h('div', { style: 'position:fixed;inset:0;background:rgba(12,14,18,.76);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50' },
    h('div', { style: `background:${hex ? '#131720' : '#efe6cf'};color:${hex ? '#ece8df' : '#2a2517'};padding:28px 30px;max-width:420px;width:100%;box-shadow:0 30px 60px -20px rgba(0,0,0,.7);animation:flPop .25s ease;border:2px solid ${hex ? '#c77dff' : '#c9a227'};border-radius:${hex ? '14px' : '0'}` },
      h('div', { style: `font:700 11px 'IBM Plex Mono';letter-spacing:.2em;color:${hex ? '#c77dff' : '#7a7052'}` }, hex ? 'RUN COMPLETE' : 'ARMISTICE'),
      h('h2', { style: 'font:400 32px \'Saira Stencil One\';margin:6px 0 14px;text-transform:uppercase' }, title),
      h('div', { style: `font-size:15px;line-height:1.6;color:${hex ? '#9aa3b2' : '#5a5138'};margin-bottom:22px` }, sub),
      h('div', { style: 'display:flex;gap:10px' },
        h('button', { onclick: () => setState({ screen: 'home' }), style: `flex:0 0 auto;background:transparent;color:${hex ? '#9aa3b2' : '#5a5138'};border:1px solid ${hex ? '#2b3548' : '#a89c78'};border-radius:${hex ? '8px' : '0'};padding:13px 18px;font:600 14px 'Barlow Condensed';letter-spacing:.06em;text-transform:uppercase;cursor:pointer` }, hex ? 'Hub' : 'HQ'),
        h('button', { onclick: () => startMatch(), style: `flex:1;background:${hex ? '#c77dff' : '#2a2517'};color:${hex ? '#0b0d11' : '#efe6cf'};border:none;border-radius:${hex ? '8px' : '0'};padding:13px;font:700 15px 'Barlow Condensed';letter-spacing:.08em;text-transform:uppercase;cursor:pointer` }, hex ? 'Run Again' : 'Re-engage'),
      ),
    ),
  );
}

function queueOverlay() {
  const q = state.queue;
  return h('div', { style: 'position:fixed;inset:0;background:rgba(8,10,15,.82);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:65' },
    h('div', { style: 'background:#131720;color:#ece8df;padding:26px 32px;text-align:center;border-radius:14px;border:1px solid #c77dff' },
      h('div', { style: 'font:700 11px \'IBM Plex Mono\';letter-spacing:.18em;color:#c77dff;margin-bottom:8px' }, q.mode === 'ranked' ? 'SYNDICATE FLOOR · RANKED' : 'THE BLOCK · CASUAL'),
      h('div', { style: 'font:700 20px \'Barlow Condensed\';letter-spacing:.05em;text-transform:uppercase' }, 'Matching vs ' + q.opp.h + ' (' + q.opp.r + ')…'),
    ),
  );
}

function settingsButton() {
  const hex = state.style === 'hexwire';
  return h('button', {
    title: 'playtest settings',
    onclick: () => setState({ settingsOpen: !state.settingsOpen }),
    style: `position:fixed;top:14px;right:14px;z-index:45;width:38px;height:38px;background:${hex ? '#131720' : '#2f2a1f'};border:1px solid ${hex ? '#2b3548' : '#5a5238'};border-radius:${hex ? '8px' : '0'};color:${hex ? '#c77dff' : '#c9a227'};font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center`,
  }, '⚙');
}

function settingsPanel() {
  const hex = state.style === 'hexwire';
  const accent = hex ? '#c77dff' : '#c9a227';
  const p = session.prefs;
  const valLabel = h('span', { style: `font:700 13px 'IBM Plex Mono';color:${accent}` }, p.startLife + ' HP');
  const slider = h('input', {
    type: 'range', min: '5', max: '40', value: String(p.startLife),
    style: `width:100%;accent-color:${accent};cursor:pointer`,
    oninput: e => { valLabel.textContent = e.target.value + ' HP'; },
    onchange: e => { session.prefs.startLife = +e.target.value; savePrefs(session.prefs); },
  });
  const fastBtn = h('button', {
    onclick: () => { session.prefs.fastAi = !session.prefs.fastAi; savePrefs(session.prefs); ping(); },
    style: `flex:none;background:${p.fastAi ? accent : 'transparent'};color:${p.fastAi ? '#111' : '#8a8065'};border:1px solid ${p.fastAi ? accent : '#5a5238'};padding:6px 14px;font:700 12px 'Barlow Condensed';letter-spacing:.06em;text-transform:uppercase;cursor:pointer`,
  }, p.fastAi ? 'On' : 'Off');
  const muteBtn = h('button', {
    onclick: () => { session.prefs.muted = !session.prefs.muted; savePrefs(session.prefs); ping(); },
    style: `flex:none;background:${!p.muted ? accent : 'transparent'};color:${!p.muted ? '#111' : '#8a8065'};border:1px solid ${!p.muted ? accent : '#5a5238'};padding:6px 14px;font:700 12px 'Barlow Condensed';letter-spacing:.06em;text-transform:uppercase;cursor:pointer`,
  }, p.muted ? 'Muted' : 'On');

  const backdrop = h('div', { onclick: () => setState({ settingsOpen: false }), style: 'position:fixed;inset:0;z-index:44' });
  const panel = h('div', { style: `position:fixed;top:60px;right:14px;z-index:46;width:250px;background:${hex ? '#131720' : '#2f2a1f'};border:1px solid ${hex ? '#2b3548' : '#5a5238'};border-radius:${hex ? '10px' : '0'};padding:16px;box-shadow:0 18px 40px -18px rgba(0,0,0,.7)` },
    h('div', { style: 'font:700 10px \'IBM Plex Mono\';letter-spacing:.16em;color:#8a8065;margin-bottom:12px' }, 'PLAYTEST SETTINGS'),
    h('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px' },
      h('span', { style: 'font:600 13px \'Barlow Condensed\';letter-spacing:.04em;text-transform:uppercase;color:#e8dfc6' }, 'Starting life'),
      valLabel,
    ),
    slider,
    h('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-top:16px' },
      h('span', { style: 'font:600 13px \'Barlow Condensed\';letter-spacing:.04em;text-transform:uppercase;color:#e8dfc6' }, 'Fast AI'),
      fastBtn,
    ),
    h('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-top:12px' },
      h('span', { style: 'font:600 13px \'Barlow Condensed\';letter-spacing:.04em;text-transform:uppercase;color:#e8dfc6' }, 'Synth SFX'),
      muteBtn,
    ),
    h('div', { style: 'font:500 10px/1.5 \'IBM Plex Mono\';color:#6e654d;margin-top:14px' }, 'Applies across all 3 ruleset styles.'),
  );
  return [backdrop, panel];
}

export function overlays() {
  const out = [settingsButton()];
  if (state.settingsOpen) out.push(...settingsPanel());
  if (state.queue) out.push(queueOverlay());
  if (state.coin) out.push(coinOverlay());
  else if (state.screen === 'match' && session.g && session.g.over && !state.tut) out.push(gameOverOverlay());
  return out;
}
