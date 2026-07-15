// localStorage persistence + simulated ladder. Keys match the Claude Design
// prototype so an existing playtester's saved rosters/standing carry over.
import { COMMANDERS } from './theme.js';

const K_DECKS = 'fl_decks_v1', K_ACTIVE = 'fl_active_v1', K_RATING = 'fl_rating_v1', K_RECORD = 'fl_record_v1', K_PREFS = 'fl_prefs_v1';

export function loadDecks(validIds, starterMap) {
  let decks = [];
  try { decks = JSON.parse(localStorage.getItem(K_DECKS) || '[]'); } catch (e) { decks = []; }
  decks = Array.isArray(decks)
    ? decks.filter(d => d && d.id && d.cards && Object.keys(d.cards).every(k => validIds.has(k) && d.cards[k] >= 1 && d.cards[k] <= 2))
    : [];
  if (!decks.length) decks = [{ id: 'starter', name: 'Standard Issue', cards: { ...starterMap } }];
  return decks;
}

export function loadActive(decks) {
  let activeId = null;
  try { activeId = localStorage.getItem(K_ACTIVE); } catch (e) {}
  if (!decks.find(d => d.id === activeId)) activeId = decks[0].id;
  return activeId;
}

export function saveDecks(decks, activeId) {
  try { localStorage.setItem(K_DECKS, JSON.stringify(decks)); if (activeId) localStorage.setItem(K_ACTIVE, activeId); } catch (e) {}
}

export function loadRating() { try { return parseInt(localStorage.getItem(K_RATING)) || 1000; } catch (e) { return 1000; } }

export function loadRecord() {
  try { const r = JSON.parse(localStorage.getItem(K_RECORD) || 'null'); if (r && typeof r.w === 'number') return r; } catch (e) {}
  return { w: 0, l: 0 };
}

export function saveStanding(rating, record) {
  try { localStorage.setItem(K_RATING, String(rating)); localStorage.setItem(K_RECORD, JSON.stringify(record)); } catch (e) {}
}

// Deterministic sim ladder, identical formula to the prototype.
export function buildSimLadder() {
  return COMMANDERS.map((name, i) => {
    const r = 880 + ((i * 137) % 440);
    return { name, r, w: Math.max(1, Math.round((r - 850) / 9)), l: Math.max(1, Math.round((1350 - r) / 11)) };
  });
}

const DEFAULT_PREFS = { startLife: 20, fastAi: false };
export function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(K_PREFS) || 'null');
    if (p && typeof p === 'object') return { ...DEFAULT_PREFS, ...p };
  } catch (e) {}
  return { ...DEFAULT_PREFS };
}
export function savePrefs(prefs) { try { localStorage.setItem(K_PREFS, JSON.stringify(prefs)); } catch (e) {} }
