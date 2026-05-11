let _els = null;

export function init() {
  _els = {
    hp: document.querySelector('#hp b'),
    ink: document.querySelector('#ink b'),
    page: document.querySelector('#page b'),
    turn: document.querySelector('#turn b'),
    log: document.getElementById('log'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayBody: document.getElementById('overlay-body'),
    overlayButton: document.getElementById('overlay-button'),
    overlaySecondButton: document.getElementById('overlay-second-button'),
    hpRow: document.getElementById('hp'),
    inkRow: document.getElementById('ink'),
  };
}

export function updateHUD(state) {
  if (!_els) return;
  _els.hp.textContent = `${Math.max(0, state.player.hp)}/${state.player.hpMax}`;
  _els.ink.textContent = `${state.player.ink}/${state.player.inkMax}`;
  _els.page.textContent = state.page.depth;
  _els.turn.textContent = state.turn;
  const lowHP = state.player.hp <= Math.ceil(state.player.hpMax / 4);
  _els.hpRow.classList.toggle('low', lowHP);
  const lowInk = state.player.ink <= 1;
  _els.inkRow.classList.toggle('low', lowInk);
}

export function renderLog(state) {
  if (!_els) return;
  const lines = state.log.slice(-6);
  _els.log.innerHTML = lines
    .map((l) => {
      const suffix = l.count > 1 ? ` <span class="run">×${l.count}</span>` : '';
      return `<span class="line tone-${l.tone}">${escape(l.text)}${suffix}</span>`;
    })
    .join('');
}

export function showOverlay({ title, body, primary, secondary }) {
  if (!_els) return;
  _els.overlayTitle.textContent = title;
  _els.overlayBody.textContent = body;
  bindButton(_els.overlayButton, primary);
  bindButton(_els.overlaySecondButton, secondary);
  _els.overlay.hidden = false;
}

function bindButton(el, opts) {
  el.onclick = null;
  if (!opts) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = opts.text;
  el.onclick = opts.onClick;
}

export function hideOverlay() {
  if (!_els) return;
  _els.overlay.hidden = true;
}

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
