import { h } from '../dom.js';
import { state, session, setState } from '../state.js';
import { tierOf, HW_AI_DECKS, HW_LADDER } from '../theme.js';
import { deckCountOf } from '../deck.js';
import { startMatch, startTutorial } from '../match.js';
import { styleBar } from './stylebar.js';

function ladderPos() {
  if (!session.simLadder) return '—';
  return session.simLadder.filter(e => e.r > session.rating).length + 1;
}

function enterLobby(mode) {
  const active = state.decks.find(d => d.id === state.activeId);
  const cards = (active && deckCountOf(active) === 24) ? active.cards : session.starterMap;
  const pick = HW_LADDER[(Math.random() * HW_LADDER.length) | 0];
  setState({ queue: { mode, opp: pick } });
  setTimeout(() => {
    if (!state.queue) return;
    setState({ queue: null });
    startMatch(cards, { oppName: pick.h, ranked: mode === 'ranked', crewKey: 'RANDOM' });
  }, 900);
}

function hexwireHomeView() {
  const active = state.decks.find(d => d.id === state.activeId);
  const activeValid = active && deckCountOf(active) === 24;

  const crewChips = Object.keys(HW_AI_DECKS).map(k => {
    const on = state.crewKey === k;
    return h('button', {
      onclick: () => setState({ crewKey: k }),
      style: `background:${on ? '#c77dff' : '#151923'};color:${on ? '#0b0d11' : '#9aa3b2'};border:1px solid ${on ? '#c77dff' : '#262d3d'};border-radius:8px;padding:7px 11px;font:700 11px 'IBM Plex Mono';letter-spacing:.06em;cursor:pointer`,
    }, HW_AI_DECKS[k].name);
  });

  return h('div', { 'data-screen-label': 'Home' },
    styleBar(),
    h('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap' },
      h('div', { style: 'font:700 11px/1 \'IBM Plex Mono\';letter-spacing:.16em;background:#c77dff;color:#0b0d11;padding:5px 9px;border-radius:4px' }, 'STYLE · HEXWIRE 2099'),
      h('div', { style: 'font:500 11px/1 \'IBM Plex Mono\';color:#7c8596' }, 'Chrome · Street · Hex · Subvert & Possession active'),
    ),
    h('h1', { style: 'font:400 clamp(44px,8vw,74px)/0.95 \'Saira Stencil One\';letter-spacing:.03em;margin:16px 0 2px;color:#ece8df;text-transform:uppercase' }, 'Hexwire'),
    h('div', { style: 'display:flex;align-items:center;gap:10px;margin:2px 0 14px' },
      h('div', { style: 'height:3px;flex:0 0 46px;background:#c77dff' }),
      h('div', { style: 'font:600 14px \'Barlow Condensed\';letter-spacing:.34em;color:#53c7ff;text-transform:uppercase' }, 'Street Magic · Three Blocks Wide'),
      h('div', { style: 'height:3px;flex:1;background:#1e2433' }),
    ),
    h('p', { style: 'max-width:640px;font-size:16px;line-height:1.5;color:#9aa3b2;margin:0 0 22px' },
      'Three city blocks wide: brawlers hold the ', h('b', { style: 'color:#ece8df' }, 'street'),
      ', snipers and drones fire from ', h('b', { style: 'color:#ece8df' }, 'overwatch'),
      ', and hexes subvert enemy operatives from within. ',
      h('b', { style: 'color:#c77dff' }, '20 life — first rival to flatline loses.'),
    ),
    h('div', { style: 'display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start' },
      h('div', { style: 'flex:1 1 340px;min-width:290px;background:#131720;border:1px solid #232a38;border-radius:12px;padding:20px 22px' },
        h('div', { style: 'font:700 11px/1 \'IBM Plex Mono\';letter-spacing:.14em;color:#7c8596;margin-bottom:12px' }, 'SOLO & SYNDICATE LOBBIES'),
        h('div', { style: 'margin-bottom:12px' },
          h('div', { style: 'font:600 11px \'IBM Plex Mono\';color:#7c8596;margin-bottom:6px' }, 'OPPONENT CREW'),
          h('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' }, crewChips),
        ),
        h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
          h('button', { onclick: () => startMatch(), style: 'background:linear-gradient(135deg,#c77dff,#7b5cff);color:#0b0d11;border:none;border-radius:9px;padding:14px 18px;font:700 17px \'Barlow Condensed\';letter-spacing:.08em;text-transform:uppercase;cursor:pointer' }, '⚡ Solo Run vs AI Crew'),
          h('div', { style: 'display:flex;gap:8px' },
            h('button', { onclick: () => enterLobby('casual'), style: 'flex:1;background:#181d29;color:#ece8df;border:1px solid #2b3548;border-radius:9px;padding:11px;font:700 13px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer' }, 'The Block · Casual'),
            h('button', { onclick: () => enterLobby('ranked'), style: 'flex:1;background:#181d29;color:#53c7ff;border:1px solid #2b4560;border-radius:9px;padding:11px;font:700 13px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer' }, 'Syndicate · ' + session.rating),
          ),
          h('div', { style: 'display:flex;gap:8px;margin-top:2px' },
            h('button', { onclick: () => startTutorial(), style: 'flex:1;background:transparent;color:#9aa3b2;border:1px solid #262d3d;border-radius:8px;padding:10px;font:600 13px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer' }, 'How to Play (8 Steps)'),
            h('button', { onclick: () => setState({ screen: 'deck' }), style: 'flex:1;background:transparent;color:#9aa3b2;border:1px solid #262d3d;border-radius:8px;padding:10px;font:600 13px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer' }, 'Crews (26 Pool)'),
            h('button', { onclick: () => setState({ screen: 'ladder' }), style: 'flex:1;background:transparent;color:#9aa3b2;border:1px solid #262d3d;border-radius:8px;padding:10px;font:600 13px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer' }, 'Standings'),
          ),
        ),
        h('div', { style: 'font:500 11px \'IBM Plex Mono\';color:#7c8596;margin-top:12px' },
          activeValid ? 'running with: ' + active.name + ' · ' + session.record.w + 'W–' + session.record.l + 'L' : 'default crew incomplete — falls back to Starter Crew'),
      ),
      h('div', { style: 'flex:1 1 300px;min-width:260px' },
        h('div', { style: 'font:700 11px/1 \'IBM Plex Mono\';letter-spacing:.14em;color:#7c8596;margin-bottom:12px' }, 'STREET CODE · RULES SHIFT'),
        h('ul', { style: 'margin:0;padding-left:18px;font-size:15px;line-height:1.65;color:#9aa3b2' },
          h('li', {}, h('b', { style: 'color:#ece8df' }, 'Fence'), ' a card once per turn: +1 permanent energy (+2 if cost 4+).'),
          h('li', {}, h('b', { style: 'color:#ece8df' }, 'Street & Overwatch:'), ' front row brawls; back row fires with ', h('b', { style: 'color:#53c7ff' }, 'Strike'), ' while the street in front holds.'),
          h('li', {}, h('b', { style: 'color:#c77dff' }, 'Subvert & Possession:'), ' Puppeteer (6⚡) seizes an enemy of cost ≤2 in its block and hides beneath it until killed; Possession (5⚡) steals one permanently.'),
          h('li', {}, h('b', { style: 'color:#ffb02e' }, 'Links ◀ ▶'), ' lend power sideways across your row.'),
        ),
        h('div', { style: 'margin-top:14px;border-top:1px dashed #262d3d;padding-top:12px;font:500 11.5px/1.6 \'IBM Plex Mono\';color:#7c8596' },
          'New to the sprawl? Run ', h('b', { style: 'color:#c77dff' }, 'How to Play'), ' — 7 interactive street lessons plus ', h('b', { style: 'color:#ece8df' }, 'THE SOLVE'), ' lethal puzzle.'),
      ),
    ),
  );
}

export function homeView() {
  if (state.style === 'hexwire') return hexwireHomeView();

  const isRift = state.style === 'rift';
  const active = state.decks.find(d => d.id === state.activeId);
  const activeValid = active && deckCountOf(active) === 24;
  const tier = tierOf(session.rating);
  const accent = isRift ? '#53c7ff' : '#c9a227';

  const btn = (label, on, extra) => h('button', {
    onclick: on,
    style: 'flex:1;background:transparent;color:#b3a88a;border:1px solid #5a5238;padding:12px;font:600 14px \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;cursor:pointer' + (extra || ''),
  }, label);

  return h('div', { 'data-screen-label': 'Home' },
    styleBar(),
    h('div', { style: 'display:flex;align-items:center;gap:12px;flex-wrap:wrap' },
      h('div', { style: `font:700 11px/1 'IBM Plex Mono';letter-spacing:.16em;background:${accent};color:#26221a;padding:5px 9px` },
        isRift ? 'STYLE · RIFT CROSSOVER' : 'STYLE · 1918 DIESELPUNK'),
      h('div', { style: 'font:500 11px/1 \'IBM Plex Mono\';letter-spacing:.06em;color:#8a8065' },
        isRift ? 'Positional M/R artillery + Hexwire Subvert & Possession (26-card pool)' : 'Positional M/R trench warfare · 24-card standard issue pool'),
    ),
    h('h1', { style: 'font:400 clamp(44px,8vw,76px)/0.95 \'Saira Stencil One\';letter-spacing:.02em;margin:18px 0 2px;color:#e8dfc6;text-transform:uppercase' },
      isRift ? 'Frontline // Rift' : 'Frontline'),
    h('div', { style: 'display:flex;align-items:center;gap:10px;margin:2px 0 14px' },
      h('div', { style: `height:3px;flex:0 0 46px;background:${isRift ? '#c77dff' : '#a4402c'}` }),
      h('div', { style: `font:600 14px 'Barlow Condensed';letter-spacing:.34em;color:${accent};text-transform:uppercase` },
        isRift ? 'The Breach of 1918–2099' : 'The Great Works War'),
      h('div', { style: 'height:3px;flex:1;background:#3a3526' }),
    ),
    h('p', { style: 'max-width:620px;font-size:16px;line-height:1.5;color:#b3a88a;margin:0 0 26px' },
      isRift
        ? 'Anomalous rift-storms have torn across the Meridian trenches. Field your positional M/R artillery alongside Rift Puppeteers and Possession orders. '
        : 'The trenches are dug three sectors wide. Field your infantry on the line, dig your artillery in behind it, and requisition supply from the rear. ',
      h('b', { style: 'color:#e8dfc6' }, '20 morale — the first HQ to break loses.'),
    ),
    h('div', { style: 'display:flex;flex-wrap:wrap;gap:22px;align-items:flex-start' },
      h('div', { style: 'flex:1 1 330px;min-width:290px;background:#2f2a1f;border:1px solid #4a422e;padding:20px 22px' },
        h('div', { style: 'font:700 11px/1 \'IBM Plex Mono\';letter-spacing:.14em;color:#8a8065;margin-bottom:14px' }, 'YOUR COMMISSION'),
        h('div', { style: 'display:flex;align-items:center;gap:14px;margin-bottom:18px;padding:12px 14px;background:#26221a;border:1px solid #4a422e' },
          h('div', { style: `width:52px;height:52px;flex:none;border-radius:50%;border:3px double ${accent};display:flex;align-items:center;justify-content:center;font:700 17px 'IBM Plex Mono';color:${accent}` }, '№' + ladderPos()),
          h('div', { style: 'flex:1' },
            h('div', { style: 'font:700 19px/1.1 \'Barlow Condensed\';letter-spacing:.06em;text-transform:uppercase;color:' + tier[2] }, tier[1]),
            h('div', { style: 'font:500 11px \'IBM Plex Mono\';color:#8a8065' }, session.rating + ' standing · ' + session.record.w + 'W–' + session.record.l + 'L'),
          ),
        ),
        h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
          h('button', { onclick: () => startMatch(), style: `background:${accent};color:#26221a;border:none;padding:15px 18px;font:700 17px 'Barlow Condensed';letter-spacing:.08em;text-transform:uppercase;cursor:pointer` }, '⚔ Skirmish vs AI'),
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
          h('li', {}, h('b', { style: 'color:#e8dfc6' }, 'The line'), ' (front row) fights down its sector with M power; ', h('b', { style: 'color:#e8dfc6' }, 'emplacements'), ' (back row) fire over it with R power — safe while your line holds.'),
          h('li', {}, 'Combat is ', h('b', { style: 'color:#e8dfc6' }, 'automatic'), ' at end of turn. Fresh troops are entrenching unless marked Rapid.'),
          h('li', {}, h('b', { style: 'color:#e8dfc6' }, 'Flanks ◀ ▶'), ' lend firepower to row neighbours — order your formation.'),
          isRift
            ? h('li', {}, h('b', { style: 'color:#53c7ff' }, 'Rift Anomaly:'), ' Rift Puppeteer (Subvert ≤2) and Rift Possession are unlocked in Rosters.')
            : h('li', {}, 'An empty supply deck bleeds escalating morale.'),
        ),
        h('div', { style: 'margin-top:14px;border-top:1px dashed #4a422e;padding-top:12px;font:500 11.5px/1.6 \'IBM Plex Mono\';color:#6e654d' },
          'New to the front? Run ', h('b', { style: 'color:#8a8065' }, 'Field training'), ' — five scripted drills, from Hold the Line through Gas & Overrun to a Break Through final exam.'),
      ),
    ),
  );
}
