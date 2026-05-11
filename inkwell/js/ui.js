let _els = null;

export function init() {
  _els = {
    hp: document.querySelector('#hp b'),
    page: document.querySelector('#page b'),
    turn: document.querySelector('#turn b'),
    log: document.getElementById('log'),
    overlay: document.getElementById('overlay'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayBody: document.getElementById('overlay-body'),
    overlayButton: document.getElementById('overlay-button'),
    hpRow: document.getElementById('hp'),
  };
}

export function updateHUD(state) {
  if (!_els) return;
  _els.hp.textContent = `${Math.max(0, state.player.hp)}/${state.player.hpMax}`;
  _els.page.textContent = state.page.depth;
  _els.turn.textContent = state.turn;
  const lowHP = state.player.hp <= Math.ceil(state.player.hpMax / 4);
  _els.hpRow.classList.toggle('low', lowHP);
}

export function renderLog(state) {
  if (!_els) return;
  const lines = state.log.slice(-6);
  _els.log.innerHTML = lines
    .map((l) => `<span class="line tone-${l.tone}">${escape(l.text)}</span>`)
    .join('');
}

export function showOverlay({ title, body, button }) {
  if (!_els) return;
  _els.overlayTitle.textContent = title;
  _els.overlayBody.textContent = body;
  _els.overlayButton.textContent = button;
  _els.overlay.hidden = false;
}

export function hideOverlay() {
  if (!_els) return;
  _els.overlay.hidden = true;
}

export function onOverlayButton(handler) {
  if (!_els) return;
  _els.overlayButton.addEventListener('click', handler);
}

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
