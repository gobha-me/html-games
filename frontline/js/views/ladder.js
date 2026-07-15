import { h } from '../dom.js';
import { session, setState } from '../state.js';
import { tierOf } from '../theme.js';
import { startMatch } from '../match.js';

export function ladderView() {
  const rows = [...session.simLadder.map(e => ({ ...e, you: false })), { name: 'You', r: session.rating, w: session.record.w, l: session.record.l, you: true }]
    .sort((a, b) => b.r - a.r);

  return h('div', { 'data-screen-label': 'War Ladder' },
    h('button', { onclick: () => setState({ screen: 'home' }), style: 'background:none;border:none;color:#8a8065;font:600 14px \'Barlow Condensed\';letter-spacing:.06em;cursor:pointer;padding:0 0 6px;text-transform:uppercase' }, '← back'),
    h('h2', { style: 'font:400 clamp(26px,4vw,38px) \'Saira Stencil One\';margin:0 0 4px;text-transform:uppercase;color:#e8dfc6' }, 'War Ladder'),
    h('div', { style: 'font:500 12px \'IBM Plex Mono\';color:#8a8065;margin-bottom:18px' }, 'SEASON I · THE MERIDIAN CAMPAIGN · standings update after every skirmish (+18 victory / −12 defeat)'),
    h('div', { style: 'background:#2f2a1f;border:1px solid #4a422e' },
      h('div', { style: 'display:grid;grid-template-columns:44px 1fr 110px 70px 70px;gap:0;padding:10px 16px;border-bottom:1px solid #4a422e;font:700 10px \'IBM Plex Mono\';letter-spacing:.14em;color:#6e654d' },
        h('div', {}, '#'), h('div', {}, 'OFFICER'), h('div', {}, 'GRADE'),
        h('div', { style: 'text-align:right' }, 'STANDING'), h('div', { style: 'text-align:right' }, 'W–L'),
      ),
      rows.map((e, i) => {
        const t = tierOf(e.r);
        return h('div', { style: `display:grid;grid-template-columns:44px 1fr 110px 70px 70px;align-items:center;padding:9px 16px;border-bottom:1px solid #3a3526;color:${e.you ? '#e8dfc6' : '#b3a88a'};background:${e.you ? '#3a3423' : 'transparent'};${e.you ? 'border-left:3px solid #c9a227' : ''}` },
          h('div', { style: `font:700 13px 'IBM Plex Mono';color:${e.you ? '#c9a227' : '#6e654d'}` }, i + 1),
          h('div', { style: 'font:700 16px \'Barlow Condensed\';letter-spacing:.04em;text-transform:uppercase' }, e.you ? 'You' : e.name),
          h('div', { style: `font:600 13px 'Barlow Condensed';letter-spacing:.06em;text-transform:uppercase;color:${t[2]}` }, t[1]),
          h('div', { style: 'text-align:right;font:600 13px \'IBM Plex Mono\'' }, e.r),
          h('div', { style: 'text-align:right;font:500 12px \'IBM Plex Mono\';color:#8a8065' }, e.w + '–' + e.l),
        );
      }),
    ),
    h('button', { onclick: () => startMatch(), style: 'margin-top:16px;background:#c9a227;color:#26221a;border:none;padding:14px 26px;font:700 16px \'Barlow Condensed\';letter-spacing:.08em;text-transform:uppercase;cursor:pointer' }, '⚔ Skirmish'),
  );
}
