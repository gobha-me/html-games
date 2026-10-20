// localStorage persistence + simulated ladder for Frontline ('fl_*'), Hexwire ('hw_*'), and Rift ('rf_*').
// Preserves existing saved rosters/standings from both Frontline and Hexwire prototypes.
import { state } from './state.js';
import { COMMANDERS, HW_LADDER } from './theme.js';

function keys(style = state.style) {
  if (style === 'hexwire') {
    return {
      decks: 'hw_decks_v1',
      active: 'hw_active_v1',
      rating: 'hw_rating_v1',
      record: 'hw_record_v1',
      wallet: 'hw_wallet_v1',
    };
  }
  if (style === 'rift') {
    return {
      decks: 'rf_decks_v1',
      active: 'rf_active_v1',
      rating: 'rf_rating_v1',
      record: 'rf_record_v1',
      wallet: 'hw_wallet_v1',
    };
  }
  return {
    decks: 'fl_decks_v1',
    active: 'fl_active_v1',
    rating: 'fl_rating_v1',
    record: 'fl_record_v1',
    wallet: 'hw_wallet_v1',
  };
}

const K_PREFS = 'fl_prefs_v1';
const K_STYLE = 'fl_style_v1';

export function loadSavedStyle() {
  try {
    const s = localStorage.getItem(K_STYLE);
    if (s === 'frontline' || s === 'hexwire' || s === 'rift') return s;
  } catch (e) {}
  return 'frontline';
}

export function saveStyle(style) {
  try { localStorage.setItem(K_STYLE, style); } catch (e) {}
}

export function loadDecks(validIds, starterMap, style = state.style) {
  const K = keys(style);
  const defName = style === 'hexwire' ? 'Starter Crew' : style === 'rift' ? 'Rift Expedition' : 'Standard Issue';
  let decks = [];
  try { decks = JSON.parse(localStorage.getItem(K.decks) || '[]'); } catch (e) { decks = []; }
  decks = Array.isArray(decks)
    ? decks.filter(d => d && d.id && d.cards && Object.keys(d.cards).every(k => validIds.has(k) && d.cards[k] >= 1 && d.cards[k] <= 2))
    : [];
  if (!decks.length) decks = [{ id: 'starter', name: defName, cards: { ...starterMap } }];
  return decks;
}

export function loadActive(decks, style = state.style) {
  const K = keys(style);
  let activeId = null;
  try { activeId = localStorage.getItem(K.active); } catch (e) {}
  if (!decks.find(d => d.id === activeId)) activeId = decks[0].id;
  return activeId;
}

export function saveDecks(decks, activeId, style = state.style) {
  const K = keys(style);
  try {
    localStorage.setItem(K.decks, JSON.stringify(decks));
    if (activeId) localStorage.setItem(K.active, activeId);
  } catch (e) {}
}

export function loadRating(style = state.style) {
  const K = keys(style);
  const def = style === 'hexwire' ? 1500 : 1000;
  try { return parseInt(localStorage.getItem(K.rating)) || def; } catch (e) { return def; }
}

export function loadRecord(style = state.style) {
  const K = keys(style);
  try {
    const r = JSON.parse(localStorage.getItem(K.record) || 'null');
    if (r && typeof r.w === 'number') return r;
  } catch (e) {}
  return { w: 0, l: 0 };
}

export function saveStanding(rating, record, style = state.style) {
  const K = keys(style);
  try {
    localStorage.setItem(K.rating, String(rating));
    localStorage.setItem(K.record, JSON.stringify(record));
  } catch (e) {}
}

export function loadWallet() {
  try { return JSON.parse(localStorage.getItem('hw_wallet_v1') || 'null'); } catch (e) { return null; }
}

export function saveWallet(w) {
  try { localStorage.setItem('hw_wallet_v1', JSON.stringify(w)); } catch (e) {}
}

export function clearWallet() {
  try { localStorage.removeItem('hw_wallet_v1'); } catch (e) {}
}

export function buildSimLadder(style = state.style) {
  if (style === 'hexwire') {
    return HW_LADDER.map(e => ({ name: e.h, r: e.r, w: e.w, l: e.l }));
  }
  return COMMANDERS.map((name, i) => {
    const r = 880 + ((i * 137) % 440);
    return { name, r, w: Math.max(1, Math.round((r - 850) / 9)), l: Math.max(1, Math.round((1350 - r) / 11)) };
  });
}

const DEFAULT_PREFS = { startLife: 20, fastAi: false, muted: false };
export function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(K_PREFS) || 'null');
    if (p && typeof p === 'object') return { ...DEFAULT_PREFS, ...p };
  } catch (e) {}
  return { ...DEFAULT_PREFS };
}

export function savePrefs(prefs) {
  try { localStorage.setItem(K_PREFS, JSON.stringify(prefs)); } catch (e) {}
}
