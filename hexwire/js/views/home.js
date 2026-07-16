// Lobby: title, wallet-connect chip, SOLO (Play vs AI / Tutorial / Decks), the
// simulated lobbies (THE BLOCK / SYNDICATE FLOOR) and the ladder tabs.
import { h } from '../dom.js';
import { state, session, setState } from '../state.js';
import { LADDER, trunc } from '../theme.js';
import { deckCountOf } from '../deck.js';
import { startMatch, startTutorial, disconnect } from '../match.js';

export function homeView() {
  const s = state;
  const w = s.wallet;
  const active = s.decks.find(d => d.id === s.activeId);
  const activeValid = active && deckCountOf(active) === 24;
  const rec = session.record;

  // ---- wallet identity chip ----
  const idClick = () => w ? disconnect() : setState({ showConnect: true });
  const chip = h('div', {
    onclick: idClick,
    style: `display:flex;align-items:center;gap:8px;background:${w ? '#12241f' : '#131720'};border:1px solid ${w ? '#1e4a41' : '#2a3140'};border-radius:9px;padding:8px 12px;cursor:pointer`,
  },
    h('span', { style: `width:8px;height:8px;border-radius:50%;background:${w ? '#2fd6b8' : '#5a6474'}` }),
    h('span', { style: 'font:600 12px monospace' }, w ? trunc(w.addr) : 'GUEST'),
    h('span', { style: 'font:500 10px monospace;color:#5a6474' }, w ? w.provider + ' · tap to disconnect' : 'connect wallet'),
  );

  // ---- lobbies ----
  const lobbies = [
    { key: 'block', name: 'THE BLOCK', desc: 'open scrims · guests welcome · unrated', live: 38, locked: false },
    { key: 'synd', name: 'SYNDICATE FLOOR', desc: 'connected crews only · ladder rated', live: 12, locked: !w },
  ].map(L => h('div', {
    style: `display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:10px;border:1px solid ${L.locked ? '#1c222d' : '#232a36'};background:#0e1117;opacity:${L.locked ? .6 : 1}`,
  },
    h('div', { style: 'flex:1;min-width:0' },
      h('div', { style: 'display:flex;align-items:center;gap:8px' },
        h('span', { style: 'font:700 13px Helvetica' }, L.name),
        h('span', { style: 'font:600 10px monospace;color:#2fd6b8' }, '● ' + L.live + ' live'),
      ),
      h('div', { style: 'font:500 11px Helvetica;color:#7a8494' }, L.desc),
    ),
    h('button', {
      onclick: () => L.locked ? setState({ showConnect: true }) : setState({ queue: L.key }),
      style: `flex:none;background:${L.locked ? 'transparent' : '#1c222d'};color:${L.locked ? '#5a6474' : '#e6eaf0'};border:1px solid #2a3140;border-radius:8px;padding:9px 16px;font:600 12.5px Helvetica;cursor:pointer`,
    }, L.locked ? '🔒 connect' : 'Join'),
  ));

  // ---- ladder ----
  const tabBtn = (label, on, active) => h('button', {
    onclick: on,
    style: `background:${active ? '#1c222d' : 'transparent'};border:none;color:${active ? '#e6eaf0' : '#5a6474'};font:700 10px monospace;letter-spacing:.08em;padding:6px 10px;border-radius:7px;cursor:pointer`,
  }, label);

  let rows = LADDER.map((e, i) => ({ rank: i + 1, handle: e.h, rec: e.w + '–' + e.l, rating: e.r, you: false }));
  if (w) rows.push({ rank: rows.length + 1, handle: trunc(w.addr) + ' (you)', rec: rec.w + '–' + rec.l, rating: 1500 + rec.w * 12 - rec.l * 8, you: true });

  const ladderBody = s.ladderTab === 'std'
    ? [
      h('div', { style: 'display:flex;flex-direction:column;gap:4px' },
        rows.map(r => h('div', {
          style: `display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:${r.you ? '#12241f' : 'transparent'};border:1px solid ${r.you ? '#1e4a41' : 'transparent'}`,
        },
          h('span', { style: 'font:700 11px monospace;color:#3c4454;width:22px' }, r.rank),
          h('span', { style: `flex:1;font:600 12px monospace;color:${r.you ? '#2fd6b8' : '#9aa4b4'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis` }, r.handle),
          h('span', { style: 'font:600 11px monospace;color:#7a8494' }, r.rec),
          h('span', { style: 'font:700 12px monospace;color:#e6eaf0;width:44px;text-align:right' }, r.rating),
        )),
      ),
      h('div', { style: 'font:500 10.5px/1.6 monospace;color:#5a6474;margin-top:10px' },
        w ? 'Standard ladder — free cards only, every deck qualifies. Your rating moves with rated wins/losses.' : 'Connect a wallet to be ranked — guests play unrated.'),
    ]
    : h('div', { style: 'border:1px dashed #2a3140;border-radius:10px;padding:22px 18px;text-align:center' },
      h('div', { style: 'font:700 13px Helvetica;color:#c77dff;margin-bottom:6px' }, 'Collector ladder'),
      h('div', { style: 'font:500 12px/1.6 Helvetica;color:#7a8494' },
        'For decks that include ', h('b', { style: 'color:#9aa4b4' }, 'purchased cards'), '. Standard cards stay infinite; bought copies lock to one deck at a time. Opens with the market.'),
    );

  return h('div', { 'data-screen-label': 'Lobby' },
    h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap' },
      h('div', { style: 'display:flex;align-items:baseline;gap:12px;flex-wrap:wrap' },
        h('div', { style: 'font:700 11px/1 monospace;letter-spacing:.16em;background:#ff8a3d;color:#0b0d11;padding:5px 9px;border-radius:4px' }, 'PROTOTYPE v0.4'),
        h('div', { style: 'font:500 11px/1 monospace;letter-spacing:.06em;color:#5a6474' }, 'PvP, lobbies & ladders simulated'),
      ),
      chip,
    ),
    h('h1', { style: 'font-size:clamp(36px,6vw,56px);font-weight:700;letter-spacing:.06em;margin:14px 0 6px' },
      'HEX', h('span', { style: 'color:#ff8a3d' }, 'WIRE')),
    h('p', { style: 'max-width:620px;font-size:15px;line-height:1.5;color:#9aa4b4;margin:0 0 8px' },
      'Magic leaked out of the network. 3 blocks × street/overwatch rows — ',
      h('b', { style: 'color:#e6eaf0' }, '20 life, first to 0 loses.')),
    h('div', { style: 'display:flex;gap:16px;font:600 11px monospace;margin:0 0 24px;flex-wrap:wrap' },
      h('span', { style: 'color:#53c7ff' }, '■ CHROME'),
      h('span', { style: 'color:#c77dff' }, '■ HEX'),
      h('span', { style: 'color:#ffb02e' }, '■ STREET'),
    ),
    h('div', { style: 'display:flex;flex-wrap:wrap;gap:18px;align-items:stretch' },
      // play column
      h('div', { style: 'flex:1 1 320px;min-width:290px;display:flex;flex-direction:column;gap:12px' },
        h('div', { style: 'background:#131720;border:1px solid #232a36;border-radius:12px;padding:20px 22px' },
          h('div', { style: 'font:700 11px/1 monospace;letter-spacing:.14em;color:#5a6474;margin-bottom:14px' }, 'SOLO'),
          h('button', {
            onclick: () => startMatch(),
            style: 'width:100%;background:#ff8a3d;color:#0b0d11;border:none;border-radius:9px;padding:16px 18px;font:700 16px Helvetica;cursor:pointer',
          }, 'Play vs AI'),
          h('div', { style: 'font:500 11px monospace;color:#5a6474;margin:8px 0 14px' },
            'a rival crew takes the challenge — deck: ' + (activeValid ? active.name : 'Starter')),
          h('div', { style: 'display:flex;gap:10px' },
            h('button', {
              onclick: () => startTutorial(),
              style: 'flex:1;background:transparent;color:#53c7ff;border:1px solid #2a4a5e;border-radius:9px;padding:12px;font:600 13.5px Helvetica;cursor:pointer',
            }, 'Tutorial — learn the streets'),
            h('button', {
              onclick: () => setState({ screen: 'deck' }),
              style: 'flex:0 0 auto;background:transparent;color:#9aa4b4;border:1px solid #2a3140;border-radius:9px;padding:12px 16px;font:600 13.5px Helvetica;cursor:pointer',
            }, 'Decks →'),
          ),
        ),
        h('div', { style: 'background:#131720;border:1px solid #232a36;border-radius:12px;padding:20px 22px;flex:1' },
          h('div', { style: 'font:700 11px/1 monospace;letter-spacing:.14em;color:#5a6474;margin-bottom:12px' }, 'LOBBIES'),
          h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, lobbies),
          h('div', { style: 'font:500 10.5px/1.6 monospace;color:#5a6474;margin-top:10px' },
            'Rated queues hold wallet identities only — guests never meet rated players. Non-custodial: your wallet signs, nothing is held.'),
        ),
      ),
      // ladder column
      h('div', { style: 'flex:1 1 300px;min-width:280px;background:#131720;border:1px solid #232a36;border-radius:12px;padding:20px 22px' },
        h('div', { style: 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px' },
          h('div', { style: 'font:700 11px/1 monospace;letter-spacing:.14em;color:#5a6474' }, 'LADDERS'),
          h('div', { style: 'display:flex;gap:4px' },
            tabBtn('STANDARD', () => setState({ ladderTab: 'std' }), s.ladderTab === 'std'),
            tabBtn('COLLECTOR', () => setState({ ladderTab: 'col' }), s.ladderTab === 'col'),
          ),
        ),
        ladderBody,
      ),
    ),
  );
}
