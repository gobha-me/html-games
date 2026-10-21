import { SPELLS } from './constants.js';
import { composeBestiaryEntry, knownKinds, displayName, isBossKind } from './bestiary.js';

let _els = null;
let _inventoryGroups = [];

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
    seedRow: document.getElementById('seed-row'),
    seedInput: document.getElementById('seed-input'),
    seedToday: document.getElementById('seed-today'),
    hpRow: document.getElementById('hp'),
    inkRow: document.getElementById('ink'),
    inventoryOverlay: document.getElementById('inventory-overlay'),
    inventoryBody: document.getElementById('inventory-body'),
    inventoryBestiaryButton: document.getElementById('inventory-bestiary'),
    bestiaryOverlay: document.getElementById('bestiary-overlay'),
    bestiaryBody: document.getElementById('bestiary-body'),
    bestiaryClose: document.getElementById('bestiary-close'),
    slotsStrip: document.getElementById('slots-strip'),
  };
}

export function onInventoryBestiaryClick(handler) {
  if (_els && _els.inventoryBestiaryButton) {
    _els.inventoryBestiaryButton.onclick = handler;
  }
}

export function onBestiaryCloseClick(handler) {
  if (_els && _els.bestiaryClose) {
    _els.bestiaryClose.onclick = handler;
  }
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

export function showOverlay({ title, body, primary, secondary, seedInput }) {
  if (!_els) return;
  _els.overlayTitle.textContent = title;
  _els.overlayBody.textContent = body;
  bindButton(_els.overlayButton, primary);
  bindButton(_els.overlaySecondButton, secondary);
  if (seedInput) {
    _els.seedInput.value = seedInput.defaultValue != null ? String(seedInput.defaultValue) : '';
    _els.seedInput.placeholder = seedInput.placeholder || 'random';
    _els.seedToday.onclick = seedInput.onToday || null;
    _els.seedRow.hidden = false;
  } else {
    _els.seedInput.value = '';
    _els.seedToday.onclick = null;
    _els.seedRow.hidden = true;
  }
  _els.overlay.hidden = false;
}

export function getOverlaySeedValue() {
  if (!_els || !_els.seedInput) return '';
  return _els.seedInput.value.trim();
}

export function setOverlaySeedValue(v) {
  if (!_els || !_els.seedInput) return;
  _els.seedInput.value = v == null ? '' : String(v);
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

export function showInventory(state) {
  if (!_els) return;
  _inventoryGroups = groupInventory(state.player.inventory);
  const itemsHtml = _inventoryGroups.length === 0
    ? '<p class="inv-empty">Your pockets are empty.</p>'
    : _inventoryGroups
        .map((g, i) => {
          const letter = String.fromCharCode(97 + i);
          const count = g.count > 1
            ? `<span class="inv-count">×${g.count}</span>`
            : '<span class="inv-count"></span>';
          return `<div class="inv-row"><span class="inv-letter">${letter}</span><span class="inv-name">${escape(g.name)}</span>${count}</div>`;
        })
        .join('');

  const spells = state.player.knownSpells || [];
  const slots = state.player.slots || [null, null, null];
  const slotsLine = slots
    .map((sp, i) => {
      const tag = sp ? `${spellLabel(sp)} (${SPELLS[sp].cost})` : '—';
      return `[${i + 1}: ${tag}]`;
    })
    .join('  ');
  const spellsHtml = `<h3 class="inv-section">Known spells</h3>` + (
    spells.length === 0
      ? '<p class="inv-empty">You have not yet learned a glyph.</p>'
      : `<div class="inv-spells">${spells.map((sp) => `<span class="inv-spell">${escape(spellLabel(sp))}</span>`).join('')}</div>`
  );
  const slotsHtml = `<h3 class="inv-section">Slots</h3><pre class="inv-slots-line">${escape(slotsLine)}</pre>` +
    (spells.length > 0
      ? '<p class="inv-bind-hint">Press <b>1</b>/<b>2</b>/<b>3</b> here to cycle a slot through your known spells.</p>'
      : '');

  _els.inventoryBody.innerHTML = itemsHtml + spellsHtml + slotsHtml;
  _els.inventoryOverlay.hidden = false;
}

export function renderSlots(state) {
  if (!_els) return;
  const slots = (state && state.player && state.player.slots) || [null, null, null];
  const ink = state && state.player ? state.player.ink : 0;
  _els.slotsStrip.innerHTML =
    '<span class="slots-title">Bound Spells:</span>' +
    slots
      .map((sp, i) => {
        const key = `<span class="key">[${i + 1}]</span>`;
        if (!sp) return `<span class="slot empty">${key} Unbound Slot</span>`;
        const cost = SPELLS[sp].cost;
        const name = spellLabel(sp);
        const dim = ink < cost ? ' dim' : '';
        return `<span class="slot bound${dim}">${key} ${escape(name)}<span style="opacity:0.7"> (${cost})</span></span>`;
      })
      .join('');
}

function spellLabel(spellId) {
  return spellId.charAt(0).toUpperCase() + spellId.slice(1);
}

export function hideInventory() {
  if (!_els) return;
  _els.inventoryOverlay.hidden = true;
  _inventoryGroups = [];
}

export function showBestiary(state) {
  if (!_els) return;
  const seen = (state.meta && Array.isArray(state.meta.beastsSeen)) ? state.meta.beastsSeen : [];
  const bossesSlain = (state.meta && Array.isArray(state.meta.bossesSlain)) ? state.meta.bossesSlain : [];
  const allKinds = knownKinds();
  let html = '';
  if (!seen.length) {
    html = '<p class="bestiary-empty">You have not yet read any margin-creature to its end.</p>';
  } else {
    for (const kind of seen) {
      const bossRecord = isBossKind(kind)
        ? bossesSlain.find((b) => b.kind === kind)
        : null;
      const text = composeBestiaryEntry(state.seed, kind, bossRecord);
      if (!text) continue;
      const paragraphs = text.split('\n\n').map(formatParagraph).join('');
      html += `<article class="bestiary-entry"><h3>${escape(displayName(kind))}</h3>${paragraphs}</article>`;
    }
    if (seen.length >= allKinds.length) {
      html += '<p class="bestiary-complete">All margin-creatures known. The book has nothing new to teach you.</p>';
    }
  }
  _els.bestiaryBody.innerHTML = html;
  _els.bestiaryBody.scrollTop = 0;
  _els.bestiaryOverlay.hidden = false;
}

export function hideBestiary() {
  if (!_els) return;
  _els.bestiaryOverlay.hidden = true;
}

function formatParagraph(p) {
  const escaped = escape(p);
  const withEm = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');
  return `<p class="bestiary-paragraph">${withEm}</p>`;
}

export function getInventoryKindAt(letterIdx) {
  const g = _inventoryGroups[letterIdx];
  return g ? g.kind : null;
}

function groupInventory(inventory) {
  const map = new Map();
  for (const item of inventory) {
    if (!map.has(item.kind)) {
      map.set(item.kind, { kind: item.kind, name: item.name, count: 0 });
    }
    map.get(item.kind).count += 1;
  }
  return [...map.values()];
}

function escape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
