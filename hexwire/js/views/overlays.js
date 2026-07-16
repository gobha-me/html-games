// Fixed overlays layered above the current screen: init-chip coin flip (2600ms),
// connect-wallet modal, lobby queue modal, and the game-over card. main.js
// appends whatever overlays() returns after the screen view.
import { h } from '../dom.js';
import { state, session, setState } from '../state.js';
import { AI_DECKS, FCOL, SPELL_LINE } from '../theme.js';
import { defTags } from '../labels.js';
import { cardArtFull } from '../art.js';
import { startMatch, connect, loadLesson } from '../match.js';

const shell = (z, kids, onBackdrop) => h('div', {
  onclick: onBackdrop || undefined,
  style: `position:fixed;inset:0;background:rgba(5,6,9,.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px;z-index:${z}`,
}, kids);

function coinOverlay() {
  const first = state.coin.first;
  const coinInner = `width:100%;height:100%;position:relative;transform-style:preserve-3d;animation:${first === 'p' ? 'flSpinA' : 'flSpinB'} 1.6s cubic-bezier(.15,.6,.25,1) forwards`;
  return shell(60,
    h('div', { style: 'background:#131720;border:1px solid #2a3140;border-radius:16px;padding:30px 36px;text-align:center;box-shadow:0 30px 60px -20px rgba(0,0,0,.8);animation:flPop .2s ease' },
      h('div', { style: 'font:700 11px monospace;letter-spacing:.15em;color:#5a6474;margin-bottom:16px' }, 'INIT CHIP'),
      h('div', { style: 'perspective:600px;width:76px;height:76px;margin:0 auto 16px' },
        h('div', { style: coinInner },
          h('div', { style: 'position:absolute;inset:0;border-radius:16px;background:#2fd6b8;color:#0b0d11;display:flex;align-items:center;justify-content:center;font:800 15px monospace;backface-visibility:hidden;box-shadow:0 0 24px rgba(47,214,184,.4)' }, 'YOU'),
          h('div', { style: 'position:absolute;inset:0;border-radius:16px;background:#ff4d69;color:#0b0d11;display:flex;align-items:center;justify-content:center;font:800 15px monospace;backface-visibility:hidden;transform:rotateY(180deg);box-shadow:0 0 24px rgba(255,77,105,.4)' }, 'RIVAL'),
        ),
      ),
      h('div', { style: 'font-size:24px;font-weight:700;letter-spacing:-.01em;animation:flFade .3s ease 1.6s backwards' }, first === 'p' ? 'You go first' : 'Rival goes first'),
      h('div', { style: 'font:500 11.5px monospace;color:#5a6474;margin-top:8px;animation:flFade .3s ease 1.75s backwards' }, 'going first skips its first draw'),
    ),
  );
}

function connectOverlay() {
  const connecting = state.connecting;
  const providerBtn = (name, onColor) => h('button', {
    onclick: () => connect(name),
    style: `width:100%;background:${connecting === name ? '#3a2a1a' : onColor};color:${connecting === name ? '#ff8a3d' : '#0b0d11'};border:none;border-radius:9px;padding:13px;font:700 14px Helvetica;cursor:pointer`,
  }, connecting === name ? 'Waiting for ' + name + '…' : name + ' Wallet');
  return shell(70,
    h('div', { onclick: e => e.stopPropagation(), style: 'background:#131720;border:1px solid #2a3140;border-radius:16px;padding:26px 28px;max-width:380px;width:100%;box-shadow:0 30px 60px -20px rgba(0,0,0,.8);animation:flPop .2s ease' },
      h('div', { style: 'font:700 11px monospace;letter-spacing:.15em;color:#5a6474' }, 'CONNECT WALLET · ALGORAND'),
      h('h3', { style: 'font-size:20px;font-weight:700;margin:8px 0 4px' }, 'Guest or connected — your call'),
      h('div', { style: 'font:500 12px/1.6 Helvetica;color:#7a8494;margin-bottom:18px' }, 'Connecting unlocks the Syndicate Floor and ladder rating. Non-custodial: the wallet only signs — nothing is ever held. (Simulated in this prototype.)'),
      h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
        providerBtn('Pera', '#ffee55'),
        providerBtn('Defly', '#8a7dff'),
      ),
      h('button', { onclick: () => setState({ showConnect: false, connecting: null }), style: 'width:100%;margin-top:10px;background:none;border:none;color:#5a6474;font:600 12px Helvetica;cursor:pointer' }, 'stay a guest'),
    ),
    () => setState({ showConnect: false, connecting: null }),
  );
}

function queueOverlay() {
  const synd = state.queue === 'synd';
  return shell(70,
    h('div', { style: 'background:#131720;border:1px solid #2a3140;border-radius:16px;padding:26px 28px;max-width:380px;width:100%;box-shadow:0 30px 60px -20px rgba(0,0,0,.8);animation:flPop .2s ease' },
      h('div', { style: 'font:700 11px monospace;letter-spacing:.15em;color:#5a6474' }, synd ? 'SYNDICATE FLOOR · RATED' : 'THE BLOCK · CASUAL'),
      h('h3', { style: 'font-size:20px;font-weight:700;margin:8px 0 10px' }, 'Scanning for rivals…'),
      h('div', { style: 'font:500 12.5px/1.7 Helvetica;color:#9aa4b4;margin-bottom:18px' },
        h('span', { style: 'display:inline-block;width:8px;height:8px;border-radius:50%;background:#ff8a3d;margin-right:7px;animation:flPulse 1.2s infinite' }),
        'No live crews on this build — PvP is simulated. A daemon crew steps up' + (synd ? ' (rated result recorded).' : '.')),
      h('div', { style: 'display:flex;gap:10px' },
        h('button', { onclick: () => setState({ queue: null }), style: 'flex:0 0 auto;background:transparent;color:#9aa4b4;border:1px solid #2a3140;border-radius:9px;padding:12px 16px;font:600 13px Helvetica;cursor:pointer' }, 'Back'),
        h('button', { onclick: () => startMatch(), style: 'flex:1;background:#ff8a3d;color:#0b0d11;border:none;border-radius:9px;padding:12px;font:700 14px Helvetica;cursor:pointer' }, 'Fight the daemon crew'),
      ),
    ),
  );
}

function gameOverOverlay() {
  const g = session.g, P = g.players.p, O = g.players.o;
  const win = g.winner === 'p';
  const color = win ? '#2fd6b8' : '#ff4d69';
  let label, title, sub, again;
  if (state.tut) {
    label = 'TRAINING COMPLETE';
    title = win ? 'Solve — clean' : 'The daemon got there';
    sub = win ? 'Exactly lethal. Tutorial complete — Fence, rows, Guard, Ward, Wired, Pierce, Links. The streets are yours.' : 'Run it back to retry the lesson.';
    again = win ? () => { setState({ tut: null }); startMatch(); } : () => loadLesson(state.tut.les);
  } else {
    label = 'MATCH COMPLETE';
    title = g.winner === 'draw' ? 'Draw' : win ? 'Block secured' : 'The block falls';
    sub = 'Life ' + Math.max(0, P.life) + '–' + Math.max(0, O.life) + ' · ' + g.tc.p + ' turns · they ran the ' + AI_DECKS[state.crewKey].name + ' playbook.';
    again = () => startMatch();
  }
  return shell(50,
    h('div', { style: 'background:#131720;border:1px solid #2a3140;border-radius:16px;padding:28px 30px;max-width:400px;width:100%;box-shadow:0 30px 60px -20px rgba(0,0,0,.8);animation:flPop .25s ease' },
      h('div', { style: 'font:700 11px monospace;letter-spacing:.15em;color:#5a6474' }, label),
      h('h2', { style: `font-size:30px;font-weight:700;margin:6px 0 14px;letter-spacing:-.01em;color:${color}` }, title),
      h('div', { style: 'font-size:14px;line-height:1.6;color:#9aa4b4;margin-bottom:22px' }, sub),
      h('div', { style: 'display:flex;gap:10px' },
        h('button', { onclick: () => setState({ screen: 'home', tut: null }), style: 'flex:0 0 auto;background:transparent;color:#9aa4b4;border:1px solid #2a3140;border-radius:9px;padding:13px 18px;font:600 14px Helvetica;cursor:pointer' }, 'Lobby'),
        h('button', { onclick: again, style: 'flex:1;background:#ff8a3d;color:#0b0d11;border:none;border-radius:9px;padding:13px;font:700 14px Helvetica;cursor:pointer' }, state.tut && !win ? 'Retry lesson' : 'Run it back'),
      ),
    ),
  );
}

function zoomOverlay() {
  const d = session.FL.byId(state.zoom);
  if (!d) return null;
  const isSpell = d.type === 'spell';
  const fc = FCOL[d.f] || '#5a6474';
  const line = isSpell ? SPELL_LINE[d.spell.kind] : defTags(d);
  const close = () => setState({ zoom: null });
  return shell(80,
    h('div', { onclick: e => e.stopPropagation(), style: 'position:relative;background:#131720;border:1px solid #2a3140;border-top:3px solid ' + fc + ';border-radius:16px;padding:16px;max-width:420px;width:100%;box-shadow:0 30px 60px -20px rgba(0,0,0,.85);animation:flPop .2s ease' },
      h('button', { onclick: close, style: 'position:absolute;top:12px;right:14px;z-index:2;background:rgba(11,13,17,.6);border:1px solid #2a3140;color:#e6eaf0;border-radius:8px;width:30px;height:30px;font:700 15px Helvetica;cursor:pointer' }, '×'),
      cardArtFull(state.zoom),
      h('div', { style: 'display:flex;align-items:center;gap:9px;margin-top:13px' },
        h('div', { style: `width:26px;height:26px;border-radius:7px;background:#e6eaf0;color:#0b0d11;display:flex;align-items:center;justify-content:center;font:700 14px monospace;flex:none` }, d.cost),
        h('span', { style: `width:8px;height:8px;border-radius:2px;background:${fc};flex:none` }),
        h('div', { style: 'font:700 18px Helvetica;flex:1;min-width:0' }, d.name),
        h('div', { style: `font:600 9.5px monospace;letter-spacing:.08em;color:${fc}` }, isSpell ? 'SPELL' : 'UNIT'),
      ),
      h('div', { style: 'display:flex;align-items:center;gap:14px;margin-top:8px' },
        !isSpell && h('div', { style: 'font:700 15px monospace;color:#e6eaf0' }, d.pow, h('span', { style: 'color:#7a8494;font-weight:400' }, ' pow')),
        !isSpell && h('div', { style: 'font:700 15px monospace;color:#e6eaf0' }, '♥' + d.hp),
        h('div', { style: 'font:500 11.5px/1.5 monospace;color:#7a8494;flex:1' }, line),
      ),
    ),
    close,
  );
}

// Everything that layers over the current screen, bottom-to-top.
export function overlays() {
  const out = [];
  if (state.coin) out.push(coinOverlay());
  else if (state.screen === 'match' && session.g && session.g.over) out.push(gameOverOverlay());
  if (state.showConnect) out.push(connectOverlay());
  if (state.queue) out.push(queueOverlay());
  if (state.zoom) out.push(zoomOverlay());
  return out;
}
