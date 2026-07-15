// Fixed overlays layered above the current screen: coin-flip (1900ms), game-over
// armistice card, and a gear settings popover for playtest knobs (start life,
// fast AI). main.js appends whatever overlays() returns after the screen view.
import { h } from '../dom.js';
import { state, session, setState, ping } from '../state.js';
import { savePrefs } from '../store.js';
import { startMatch } from '../match.js';

function coinOverlay() {
  const first = state.coin.first;
  const face = first === 'p' ? 'YOU' : 'FOE';
  const text = first === 'p' ? 'You move first' : state.oppName + ' moves first';
  const dot = first === 'p' ? '#6b7a3f' : '#a4402c';
  return h('div', { style: 'position:fixed;inset:0;background:rgba(20,17,11,.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:60' },
    h('div', { style: 'background:#efe6cf;color:#2a2517;padding:30px 40px;text-align:center;box-shadow:0 30px 60px -20px rgba(0,0,0,.7);animation:flPop .2s ease;border:2px solid #c9a227' },
      h('div', { style: 'font:700 11px \'IBM Plex Mono\';letter-spacing:.2em;color:#7a7052;margin-bottom:16px' }, 'FIELD ORDERS'),
      h('div', { style: `width:68px;height:68px;border-radius:50%;background:${dot};color:#f0e8d2;display:flex;align-items:center;justify-content:center;font:700 16px 'IBM Plex Mono';margin:0 auto 16px;animation:flCoin .85s ease;border:3px double #efe6cf;box-shadow:0 0 0 3px ${dot}` }, face),
      h('div', { style: 'font:400 26px \'Saira Stencil One\';text-transform:uppercase;animation:flFade .3s ease .85s backwards' }, text),
      h('div', { style: 'font:500 11.5px \'IBM Plex Mono\';color:#7a7052;margin-top:8px;animation:flFade .3s ease .95s backwards' }, 'first to move forfeits its first draw'),
    ),
  );
}

function gameOverOverlay() {
  const g = session.g, P = g.players.p, O = g.players.o;
  const win = g.winner === 'p';
  const delta = g._delta || 0;
  const standing = state.tut ? 'Training engagement — no standing change.'
    : delta > 0 ? '+' + delta + ' standing → ' + session.rating + '.'
    : delta < 0 ? delta + ' standing → ' + session.rating + '.' : '';
  const title = g.winner === 'draw' ? 'Stalemate' : win ? 'Victory' : 'Defeat';
  const sub = 'Morale ' + Math.max(0, P.life) + '–' + Math.max(0, O.life) + ' · ' + g.tc.p + ' turns · vs ' + state.oppName + '. ' + standing;
  return h('div', { style: 'position:fixed;inset:0;background:rgba(20,17,11,.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:50' },
    h('div', { style: 'background:#efe6cf;color:#2a2517;padding:28px 30px;max-width:420px;width:100%;box-shadow:0 30px 60px -20px rgba(0,0,0,.7);animation:flPop .25s ease;border:2px solid #c9a227' },
      h('div', { style: 'font:700 11px \'IBM Plex Mono\';letter-spacing:.2em;color:#7a7052' }, 'ARMISTICE'),
      h('h2', { style: 'font:400 32px \'Saira Stencil One\';margin:6px 0 14px;text-transform:uppercase' }, title),
      h('div', { style: 'font-size:15px;line-height:1.6;color:#5a5138;margin-bottom:22px' }, sub),
      h('div', { style: 'display:flex;gap:10px' },
        h('button', { onclick: () => setState({ screen: 'home' }), style: 'flex:0 0 auto;background:transparent;color:#5a5138;border:1px solid #a89c78;padding:13px 18px;font:600 14px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer' }, 'HQ'),
        h('button', { onclick: () => startMatch(), style: 'flex:1;background:#2a2517;color:#efe6cf;border:none;padding:13px;font:700 15px \'Barlow Condensed\';letter-spacing:.08em;text-transform:uppercase;cursor:pointer' }, state.tut ? 'To the front' : 'Re-engage'),
      ),
    ),
  );
}

function settingsButton() {
  return h('button', {
    title: 'playtest settings',
    onclick: () => setState({ settingsOpen: !state.settingsOpen }),
    style: 'position:fixed;top:14px;right:14px;z-index:45;width:38px;height:38px;background:#2f2a1f;border:1px solid #5a5238;color:#c9a227;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center',
  }, '⚙');
}

function settingsPanel() {
  const p = session.prefs;
  const valLabel = h('span', { style: 'font:700 13px \'IBM Plex Mono\';color:#c9a227' }, p.startLife + ' HP');
  const slider = h('input', {
    type: 'range', min: '5', max: '40', value: String(p.startLife),
    style: 'width:100%;accent-color:#c9a227;cursor:pointer',
    oninput: e => { valLabel.textContent = e.target.value + ' HP'; },
    onchange: e => { session.prefs.startLife = +e.target.value; savePrefs(session.prefs); },
  });
  const fastBtn = h('button', {
    onclick: () => { session.prefs.fastAi = !session.prefs.fastAi; savePrefs(session.prefs); ping(); },
    style: `flex:none;background:${p.fastAi ? '#c9a227' : 'transparent'};color:${p.fastAi ? '#26221a' : '#8a8065'};border:1px solid ${p.fastAi ? '#c9a227' : '#5a5238'};padding:6px 14px;font:700 12px 'Barlow Condensed';letter-spacing:.06em;text-transform:uppercase;cursor:pointer`,
  }, p.fastAi ? 'On' : 'Off');

  const backdrop = h('div', { onclick: () => setState({ settingsOpen: false }), style: 'position:fixed;inset:0;z-index:44' });
  const panel = h('div', { style: 'position:fixed;top:60px;right:14px;z-index:46;width:250px;background:#2f2a1f;border:1px solid #5a5238;padding:16px;box-shadow:0 18px 40px -18px rgba(0,0,0,.7)' },
    h('div', { style: 'font:700 10px \'IBM Plex Mono\';letter-spacing:.16em;color:#8a8065;margin-bottom:12px' }, 'PLAYTEST SETTINGS'),
    h('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:6px' },
      h('span', { style: 'font:600 13px \'Barlow Condensed\';letter-spacing:.04em;text-transform:uppercase;color:#e8dfc6' }, 'Starting morale'),
      valLabel,
    ),
    slider,
    h('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-top:16px' },
      h('span', { style: 'font:600 13px \'Barlow Condensed\';letter-spacing:.04em;text-transform:uppercase;color:#e8dfc6' }, 'Fast AI'),
      fastBtn,
    ),
    h('div', { style: 'font:500 10px/1.5 \'IBM Plex Mono\';color:#6e654d;margin-top:14px' }, 'Applies to your next skirmish.'),
  );
  return [backdrop, panel];
}

// Everything that layers over the current screen, bottom-to-top.
export function overlays() {
  const out = [settingsButton()];
  if (state.settingsOpen) out.push(...settingsPanel());
  if (state.coin) out.push(coinOverlay());
  else if (state.screen === 'match' && session.g && session.g.over) out.push(gameOverOverlay());
  return out;
}
