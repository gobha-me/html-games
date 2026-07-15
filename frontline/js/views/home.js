import { h } from '../dom.js';
import { state, session, setState } from '../state.js';
import { tierOf } from '../theme.js';
import { deckCountOf } from '../deck.js';
import { startMatch, startTutorial } from '../match.js';

function ladderPos() {
  if (!session.simLadder) return '—';
  return session.simLadder.filter(e => e.r > session.rating).length + 1;
}

export function homeView() {
  const active = state.decks.find(d => d.id === state.activeId);
  const activeValid = active && deckCountOf(active) === 24;
  const tier = tierOf(session.rating);

  const btn = (label, on, extra) => h('button', {
    onclick: on,
    style: 'flex:1;background:transparent;color:#b3a88a;border:1px solid #5a5238;padding:12px;font:600 14px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer' + (extra || ''),
  }, label);

  return h('div', { 'data-screen-label': 'Home' },
    h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap' },
      h('div', { style: 'font:700 11px/1 \'IBM Plex Mono\';letter-spacing:.16em;background:#c9a227;color:#26221a;padding:5px 9px' }, 'THEME TEST · DIESELPUNK'),
      h('div', { style: 'font:500 11px/1 \'IBM Plex Mono\';letter-spacing:.06em;color:#8a8065' }, 'same v0.2 rules & balance · visual direction only'),
    ),
    h('h1', { style: 'font:400 clamp(44px,8vw,76px)/0.95 \'Saira Stencil One\';letter-spacing:.02em;margin:18px 0 2px;color:#e8dfc6;text-transform:uppercase' }, 'Frontline'),
    h('div', { style: 'display:flex;align-items:center;gap:10px;margin:2px 0 14px' },
      h('div', { style: 'height:3px;flex:0 0 46px;background:#a4402c' }),
      h('div', { style: 'font:600 14px \'Barlow Condensed\';letter-spacing:.34em;color:#c9a227;text-transform:uppercase' }, 'The Great Works War'),
      h('div', { style: 'height:3px;flex:1;background:#3a3526' }),
    ),
    h('p', { style: 'max-width:620px;font-size:16px;line-height:1.5;color:#b3a88a;margin:0 0 26px' },
      'The trenches are dug three sectors wide. Field your infantry on the line, dig your artillery in behind it, and requisition supply from the rear. ',
      h('b', { style: 'color:#e8dfc6' }, '20 morale — the first HQ to break loses.'),
    ),
    h('div', { style: 'display:flex;flex-wrap:wrap;gap:22px;align-items:flex-start' },
      h('div', { style: 'flex:1 1 330px;min-width:290px;background:#2f2a1f;border:1px solid #4a422e;padding:20px 22px' },
        h('div', { style: 'font:700 11px/1 \'IBM Plex Mono\';letter-spacing:.14em;color:#8a8065;margin-bottom:14px' }, 'YOUR COMMISSION'),
        h('div', { style: 'display:flex;align-items:center;gap:14px;margin-bottom:18px;padding:12px 14px;background:#26221a;border:1px solid #4a422e' },
          h('div', { style: 'width:52px;height:52px;flex:none;border-radius:50%;border:3px double #c9a227;display:flex;align-items:center;justify-content:center;font:700 17px \'IBM Plex Mono\';color:#c9a227' }, '№' + ladderPos()),
          h('div', { style: 'flex:1' },
            h('div', { style: 'font:700 19px/1.1 \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;color:' + tier[2] }, tier[1]),
            h('div', { style: 'font:500 11px \'IBM Plex Mono\';color:#8a8065' }, session.rating + ' standing · ' + session.record.w + 'W–' + session.record.l + 'L'),
          ),
        ),
        h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
          h('button', { onclick: () => startMatch(), style: 'background:#c9a227;color:#26221a;border:none;padding:15px 18px;font:700 17px \'Barlow Condensed\';letter-spacing:.08em;text-transform:uppercase;cursor:pointer' }, '⚔ Skirmish vs AI'),
          h('div', { style: 'display:flex;gap:8px' },
            btn('Field training', () => startTutorial()),
            btn('Rosters', () => setState({ screen: 'deck' })),
            btn('War ladder', () => setState({ screen: 'ladder' })),
          ),
        ),
        h('div', { style: 'font:500 11px \'IBM Plex Mono\';color:#6e654d;margin-top:12px' },
          activeValid ? 'deploying with: ' + active.name + ' (default roster)' : 'default roster invalid — falls back to Standard Issue'),
      ),
      h('div', { style: 'flex:1 1 300px;min-width:260px' },
        h('div', { style: 'font:700 11px/1 \'IBM Plex Mono\';letter-spacing:.14em;color:#8a8065;margin-bottom:12px' }, 'FIELD MANUAL'),
        h('ul', { style: 'margin:0;padding-left:18px;font-size:15px;line-height:1.65;color:#b3a88a' },
          h('li', {}, h('b', { style: 'color:#e8dfc6' }, 'Requisition'), ' a card once per turn: +1 permanent supply (+2 if it costs 4+). Supply refills each turn.'),
          h('li', {}, h('b', { style: 'color:#e8dfc6' }, 'The line'), ' (front row) fights down its sector; ', h('b', { style: 'color:#e8dfc6' }, 'emplacements'), ' (back row) fire over it — safe while your line holds.'),
          h('li', {}, 'Combat is ', h('b', { style: 'color:#e8dfc6' }, 'automatic'), ' at end of turn. Fresh troops are entrenching unless marked Rapid.'),
          h('li', {}, h('b', { style: 'color:#e8dfc6' }, 'Flanks ◀ ▶'), ' lend firepower to row neighbours — order your formation.'),
          h('li', {}, 'An empty supply deck bleeds escalating morale.'),
        ),
        h('div', { style: 'margin-top:14px;border-top:1px dashed #4a422e;padding-top:12px;font:500 11.5px/1.6 \'IBM Plex Mono\';color:#6e654d' },
          'New to the front? Run ', h('b', { style: 'color:#8a8065' }, 'Field training'), ' — one guided turn, then a live finish against a green conscript company.'),
      ),
    ),
  );
}
