import { h } from '../dom.js';
import { state, session, setState } from '../state.js';
import { SPELL_LINE } from '../theme.js';
import { defTags } from '../labels.js';
import { deckCountOf, editDeck, addCard, remCard, newDeck, deleteDeck, setDefault, renameDeck } from '../deck.js';
import { startMatch } from '../match.js';

export function rostersView() {
  const FL = session.FL;
  const ed = editDeck() || { name: '', cards: {} };
  const cnt = deckCountOf(ed);
  const isDefault = state.activeId === state.editId;
  const valid = cnt === 24;

  const stepBtn = dis => `width:24px;height:24px;border:1px solid #5a5238;background:${dis ? '#2a261c' : '#3a3423'};color:${dis ? '#5a5238' : '#e8dfc6'};font:700 15px 'IBM Plex Mono';cursor:${dis ? 'default' : 'pointer'};line-height:1;display:flex;align-items:center;justify-content:center`;

  const rosterList = state.decks.map(d => {
    const n = deckCountOf(d), open = d.id === state.editId, def = d.id === state.activeId;
    return h('div', {
      onclick: () => setState({ editId: d.id }),
      style: `display:flex;align-items:center;gap:8px;padding:10px 12px;border:1.5px solid ${open ? '#c9a227' : '#4a422e'};background:${open ? '#3a3423' : 'transparent'};cursor:pointer;color:#e8dfc6`,
    },
      h('div', { style: 'flex:1;min-width:0' },
        h('div', { style: 'font:700 15px \'Barlow Condensed\';letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, d.name),
        h('div', { style: 'font:500 10px \'IBM Plex Mono\';color:#8a8065' }, n + '/24' + (n === 24 ? '' : ' · incomplete') + (def ? ' · default' : '')),
      ),
      h('button', { title: 'set as default', onclick: e => { e.stopPropagation(); setState({ editId: d.id }); setDefault(); }, style: `background:none;border:none;font-size:15px;cursor:pointer;color:${def ? '#c9a227' : '#4a422e'};padding:2px` }, '★'),
      h('button', { title: 'delete', onclick: e => { e.stopPropagation(); deleteDeck(d.id); }, style: `background:none;border:none;font-size:16px;cursor:pointer;color:#5a5238;padding:2px;${state.decks.length <= 1 ? 'visibility:hidden' : ''}` }, '×'),
    );
  });

  const pool = FL.POOL.map(c => {
    const n = ed.cards[c.id] || 0;
    const line = c.type === 'spell' ? 'order · ' + SPELL_LINE[c.spell.kind] : `${c.pow}/${c.hp}${defTags(c) ? ' · ' + defTags(c) : ''}`;
    return h('div', { style: `display:flex;align-items:center;gap:9px;padding:9px 11px;background:${n ? '#3a3423' : '#2f2a1f'};border:1px solid ${n ? '#c9a227' : '#4a422e'};color:#e8dfc6` },
      h('div', { style: 'width:26px;height:26px;flex:none;background:#c9a227;color:#26221a;display:flex;align-items:center;justify-content:center;font:700 13px \'IBM Plex Mono\'' }, c.cost),
      h('div', { style: 'flex:1;min-width:0' },
        h('div', { style: 'font:700 14px \'Barlow Condensed\';letter-spacing:.03em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, c.name),
        h('div', { style: 'font:500 10px \'IBM Plex Mono\';color:#8a8065' }, line),
      ),
      h('div', { style: 'display:flex;align-items:center;gap:6px;flex:none' },
        h('button', { onclick: () => remCard(c.id), style: stepBtn(n <= 0) }, '−'),
        h('div', { style: 'width:15px;text-align:center;font:700 14px \'IBM Plex Mono\'' }, n),
        h('button', { onclick: () => addCard(c.id), style: stepBtn(n >= 2 || cnt >= 24) }, '+'),
      ),
    );
  });

  return h('div', { 'data-screen-label': 'Rosters' },
    h('div', { style: 'display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px' },
      h('div', {},
        h('button', { onclick: () => setState({ screen: 'home' }), style: 'background:none;border:none;color:#8a8065;font:600 14px \'Barlow Condensed\';letter-spacing:.06em;cursor:pointer;padding:0 0 6px;text-transform:uppercase' }, '← back'),
        h('h2', { style: 'font:400 clamp(26px,4vw,38px) \'Saira Stencil One\';margin:0;text-transform:uppercase;color:#e8dfc6' }, 'Rosters'),
      ),
      h('div', { style: 'display:flex;align-items:center;gap:16px' },
        h('div', { style: 'text-align:right' },
          h('div', { style: `font:700 26px 'IBM Plex Mono';color:${valid ? '#9db35e' : '#d06a52'};line-height:1` }, cnt, h('span', { style: 'font-size:14px;color:#6e654d' }, '/24')),
          h('div', { style: 'font:500 11px \'IBM Plex Mono\';color:#8a8065' }, valid ? 'roster complete' : cnt < 24 ? (24 - cnt) + ' more needed' : 'remove ' + (cnt - 24)),
        ),
        h('button', { onclick: valid ? () => startMatch(ed.cards) : () => {}, style: `background:${valid ? '#c9a227' : '#3a3526'};color:${valid ? '#26221a' : '#6e654d'};border:none;padding:12px 22px;font:700 16px 'Barlow Condensed';letter-spacing:.08em;text-transform:uppercase;cursor:${valid ? 'pointer' : 'default'}` }, 'Deploy →'),
      ),
    ),
    h('div', { style: 'display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start' },
      h('div', { style: 'flex:0 1 260px;min-width:230px' },
        h('div', { style: 'font:700 10px \'IBM Plex Mono\';letter-spacing:.14em;color:#8a8065;margin-bottom:8px' }, 'ROSTERS'),
        h('div', { style: 'display:flex;flex-direction:column;gap:6px;margin-bottom:10px' }, rosterList),
        h('button', { onclick: () => newDeck(), style: 'width:100%;background:transparent;border:1px dashed #5a5238;color:#8a8065;padding:10px;font:600 14px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer' }, '+ New roster'),
        h('div', { style: 'font:500 10.5px/1.6 \'IBM Plex Mono\';color:#6e654d;margin-top:12px' }, '★ = default roster. All cards are ', h('b', { style: 'color:#8a8065' }, 'Standard issue'), ' — infinite copies. Requisitioned (bought) cards will lock to one roster at a time.'),
      ),
      h('div', { style: 'flex:1 1 420px;min-width:300px' },
        h('div', { style: 'display:flex;gap:10px;align-items:center;margin-bottom:12px' },
          h('input', { value: ed.name, onchange: e => renameDeck(e.target.value), style: 'flex:1;background:#2f2a1f;border:1px solid #5a5238;padding:10px 12px;font:700 15px \'Barlow Condensed\';letter-spacing:.04em;color:#e8dfc6' }),
          h('button', { onclick: () => setDefault(), style: `flex:none;background:${isDefault ? '#c9a227' : 'transparent'};color:${isDefault ? '#26221a' : '#8a8065'};border:1px solid ${isDefault ? '#c9a227' : '#5a5238'};padding:10px 14px;font:600 13px 'Barlow Condensed';letter-spacing:.06em;text-transform:uppercase;cursor:pointer` }, isDefault ? '★ Default' : 'Set default'),
        ),
        h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:9px' }, pool),
      ),
    ),
  );
}
