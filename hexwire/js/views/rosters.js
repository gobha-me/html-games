// Deck manager: deck list (★ default, × delete), rename input (onchange so the
// full rebuild never nukes the caret mid-type), and the pool grid with faction
// dots + optional card-art thumbnails. Ported from the Hexwire prototype.
import { h } from '../dom.js';
import { state, session, setState } from '../state.js';
import { SPELL_LINE, FCOL } from '../theme.js';
import { defTags } from '../labels.js';
import { deckCountOf, editDeck, addCard, remCard, newDeck, deleteDeck, setDefault, renameDeck } from '../deck.js';
import { startMatch } from '../match.js';
import { cardThumb } from '../art.js';

export function rostersView() {
  const FL = session.FL;
  const ed = editDeck() || { name: '', cards: {} };
  const cnt = deckCountOf(ed);
  const isDefault = state.activeId === state.editId;
  const valid = cnt === 24;

  const stepBtn = dis => `width:24px;height:24px;border-radius:6px;border:1px solid #2a3140;background:${dis ? '#131720' : '#1c222d'};color:${dis ? '#3c4454' : '#e6eaf0'};font:700 15px monospace;cursor:${dis ? 'default' : 'pointer'};line-height:1;display:flex;align-items:center;justify-content:center`;

  const deckRows = state.decks.map(d => {
    const n = deckCountOf(d), open = d.id === state.editId, def = d.id === state.activeId;
    return h('div', {
      onclick: () => setState({ editId: d.id }),
      style: `display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:9px;border:1.5px solid ${open ? '#ff8a3d' : '#232a36'};background:${open ? '#181d29' : '#131720'};cursor:pointer`,
    },
      h('div', { style: 'flex:1;min-width:0' },
        h('div', { style: 'font:700 13px Helvetica;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, d.name),
        h('div', { style: 'font:500 10px monospace;color:#5a6474' }, n + '/24' + (n === 24 ? '' : ' · incomplete') + (def ? ' · default' : '')),
      ),
      h('button', { title: 'set as default', onclick: e => { e.stopPropagation(); setState({ editId: d.id }); setDefault(); }, style: `background:none;border:none;font-size:15px;cursor:pointer;color:${def ? '#ff8a3d' : '#2a3140'};padding:2px` }, '★'),
      h('button', { title: 'delete', onclick: e => { e.stopPropagation(); deleteDeck(d.id); }, style: `background:none;border:none;font-size:16px;cursor:pointer;color:#3c4454;padding:2px;${state.decks.length <= 1 ? 'visibility:hidden' : ''}` }, '×'),
    );
  });

  const pool = FL.POOL.map(c => {
    const n = ed.cards[c.id] || 0;
    const line = c.type === 'spell' ? 'spell · ' + SPELL_LINE[c.spell.kind] : `${c.pow}/${c.hp}${defTags(c) ? ' · ' + defTags(c) : ''}`;
    const thumb = h('div', { title: 'Zoom art', onclick: () => setState({ zoom: c.id }), style: 'position:relative;flex:none;cursor:zoom-in' },
      cardThumb(c.id, 44, 56),
      h('div', { style: 'position:absolute;top:0;left:0;min-width:18px;height:18px;padding:0 3px;background:#ff8a3d;color:#0b0d11;display:flex;align-items:center;justify-content:center;font:700 12px monospace;box-shadow:0 0 0 1px #0b0d11' }, c.cost),
      h('div', { style: 'position:absolute;bottom:0;right:0;width:15px;height:15px;background:rgba(11,13,17,.72);color:#e6eaf0;display:flex;align-items:center;justify-content:center;font:700 10px monospace;border-top-left-radius:5px' }, '⤢'),
    );
    return h('div', { style: `display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:10px;background:${n ? '#181d29' : '#131720'};border:1px solid ${n ? '#3c4454' : '#1c222d'}` },
      thumb,
      h('div', { style: 'flex:1;min-width:0' },
        h('div', { style: 'display:flex;align-items:center;gap:5px' },
          h('span', { style: `width:7px;height:7px;border-radius:2px;background:${FCOL[c.f] || '#5a6474'};flex:none` }),
          h('span', { style: 'font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis' }, c.name),
        ),
        h('div', { style: 'font-size:10.5px;color:#7a8494;font-family:monospace' }, line),
      ),
      h('div', { style: 'display:flex;align-items:center;gap:6px;flex:none' },
        h('button', { onclick: () => remCard(c.id), style: stepBtn(n <= 0) }, '−'),
        h('div', { style: 'width:15px;text-align:center;font:700 14px monospace' }, n),
        h('button', { onclick: () => addCard(c.id), style: stepBtn(n >= 2 || cnt >= 24) }, '+'),
      ),
    );
  });

  return h('div', { 'data-screen-label': 'Decks' },
    h('div', { style: 'display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:16px' },
      h('div', {},
        h('button', { onclick: () => setState({ screen: 'home' }), style: 'background:none;border:none;color:#5a6474;font:600 13px Helvetica;cursor:pointer;padding:0 0 6px' }, '← lobby'),
        h('h2', { style: 'font-size:clamp(24px,4vw,32px);font-weight:700;margin:0;letter-spacing:-.01em' }, 'Your decks'),
      ),
      h('div', { style: 'display:flex;align-items:center;gap:16px' },
        h('div', { style: 'text-align:right' },
          h('div', { style: `font:700 26px monospace;color:${valid ? '#2fd6b8' : '#ff4d69'};line-height:1` }, cnt, h('span', { style: 'font-size:14px;color:#5a6474' }, '/24')),
          h('div', { style: 'font:500 11px monospace;color:#5a6474' }, valid ? 'valid deck' : cnt < 24 ? (24 - cnt) + ' more needed' : 'remove ' + (cnt - 24)),
        ),
        h('button', { onclick: valid ? () => startMatch(ed.cards) : () => {}, style: `background:${valid ? '#ff8a3d' : '#1c222d'};color:${valid ? '#0b0d11' : '#3c4454'};border:none;border-radius:9px;padding:12px 22px;font:700 15px Helvetica;cursor:${valid ? 'pointer' : 'default'}` }, 'Play →'),
      ),
    ),
    h('div', { style: 'display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start' },
      h('div', { style: 'flex:0 1 260px;min-width:230px' },
        h('div', { style: 'font:700 10px monospace;letter-spacing:.14em;color:#5a6474;margin-bottom:8px' }, 'DECKS'),
        h('div', { style: 'display:flex;flex-direction:column;gap:6px;margin-bottom:10px' }, deckRows),
        h('button', { onclick: () => newDeck(), style: 'width:100%;background:transparent;border:1px dashed #2a3140;color:#7a8494;border-radius:9px;padding:10px;font:600 13px Helvetica;cursor:pointer' }, '+ New deck'),
        h('div', { style: 'font:500 10.5px/1.6 monospace;color:#5a6474;margin-top:12px' }, '★ = default deck. All cards are ', h('b', { style: 'color:#9aa4b4' }, 'Standard'), ' — infinite copies across decks. Bought copies will lock to one deck at a time.'),
      ),
      h('div', { style: 'flex:1 1 420px;min-width:300px' },
        h('div', { style: 'display:flex;gap:10px;align-items:center;margin-bottom:12px' },
          h('input', { value: ed.name, onchange: e => renameDeck(e.target.value), style: 'flex:1;background:#131720;border:1px solid #2a3140;border-radius:8px;padding:10px 12px;font:700 14px Helvetica;color:#e6eaf0' }),
          h('button', { onclick: () => setDefault(), style: `flex:none;background:${isDefault ? '#ff8a3d' : 'transparent'};color:${isDefault ? '#0b0d11' : '#7a8494'};border:1px solid ${isDefault ? '#ff8a3d' : '#2a3140'};border-radius:8px;padding:10px 14px;font:600 12.5px Helvetica;cursor:pointer` }, isDefault ? '★ Default' : 'Set default'),
        ),
        h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(225px,1fr));gap:9px' }, pool),
      ),
    ),
  );
}
