import { h } from '../dom.js';
import { state, session, setState } from '../state.js';
import { tierOf } from '../theme.js';
import { startMatch } from '../match.js';
import { styleBar } from './stylebar.js';

export function ladderView() {
  const hex = state.style === 'hexwire';
  const accent = hex ? '#c77dff' : state.style === 'rift' ? '#53c7ff' : '#c9a227';
  const rows = [...session.simLadder.map(e => ({ ...e, you: false })), { name: 'You', r: session.rating, w: session.record.w, l: session.record.l, you: true }]
    .sort((a, b) => b.r - a.r);

  return h('div', { 'data-screen-label': hex ? 'Standings' : 'War Ladder' },
    styleBar(),
    h('button', { onclick: () => setState({ screen: 'home' }), style: `background:none;border:none;color:${hex ? '#7c8596' : '#8a8065'};font:600 14px 'Barlow Condensed';letter-spacing:.06em;cursor:pointer;padding:0 0 6px;text-transform:uppercase` }, '← back'),
    h('h2', { style: 'font:400 clamp(26px,4vw,38px) \'Saira Stencil One\';margin:0 0 4px;text-transform:uppercase;color:#e8dfc6' }, hex ? 'Syndicate Standings' : 'War Ladder'),
    h('div', { style: `font:500 12px 'IBM Plex Mono';color:${hex ? '#7c8596' : '#8a8065'};margin-bottom:18px` },
      hex
        ? 'SEASON 0 · SYNDICATE FLOOR · standings update after every run (+18 victory / −12 defeat)'
        : 'SEASON I · THE MERIDIAN CAMPAIGN · standings update after every skirmish (+18 victory / −12 defeat)'),
    h('div', { style: `background:${hex ? '#131720' : '#2f2a1f'};border:1px solid ${hex ? '#232a38' : '#4a422e'};border-radius:${hex ? '10px' : '0'};overflow:hidden` },
      h('div', { style: `display:grid;grid-template-columns:44px 1fr 110px 70px 70px;gap:0;padding:10px 16px;border-bottom:1px solid ${hex ? '#232a38' : '#4a422e'};font:700 10px 'IBM Plex Mono';letter-spacing:.14em;color:${hex ? '#7c8596' : '#6e654d'}` },
        h('div', {}, '#'), h('div', {}, hex ? 'RUNNER' : 'OFFICER'), h('div', {}, hex ? 'TIER' : 'GRADE'),
        h('div', { style: 'text-align:right' }, 'RATING'), h('div', { style: 'text-align:right' }, 'W–L'),
      ),
      rows.map((e, i) => {
        const t = tierOf(e.r);
        return h('div', { style: `display:grid;grid-template-columns:44px 1fr 110px 70px 70px;align-items:center;padding:9px 16px;border-bottom:1px solid ${hex ? '#1a202c' : '#3a3526'};color:${e.you ? '#e8dfc6' : (hex ? '#9aa3b2' : '#b3a88a')};background:${e.you ? (hex ? '#1b2232' : '#3a3423') : 'transparent'};${e.you ? `border-left:3px solid ${accent}` : ''}` },
          h('div', { style: `font:700 13px 'IBM Plex Mono';color:${e.you ? accent : '#6e654d'}` }, i + 1),
          h('div', { style: 'font:700 16px \'Barlow Condensed\';letter-spacing:.04em;text-transform:uppercase' }, e.you ? 'You' : e.name),
          h('div', { style: `font:600 13px 'Barlow Condensed';letter-spacing:.06em;text-transform:uppercase;color:${hex ? '#53c7ff' : t[2]}` }, hex ? (e.r >= 1750 ? 'Syndicate' : e.r >= 1600 ? 'Fixer' : 'Runner') : t[1]),
          h('div', { style: 'text-align:right;font:600 13px \'IBM Plex Mono\'' }, e.r),
          h('div', { style: `text-align:right;font:500 12px 'IBM Plex Mono';color:${hex ? '#7c8596' : '#8a8065'}` }, e.w + '–' + e.l),
        );
      }),
    ),
    h('button', { onclick: () => startMatch(), style: `margin-top:16px;background:${accent};color:#111;border:none;border-radius:${hex ? '8px' : '0'};padding:14px 26px;font:700 16px 'Barlow Condensed';letter-spacing:.08em;text-transform:uppercase;cursor:pointer` }, hex ? '⚡ Solo Run' : '⚔ Skirmish'),
  );
}
