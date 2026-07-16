// localStorage persistence. Keys are namespaced `hw_` so Hexwire never collides
// with the frontline game on the shared deploy origin (both live under the same
// host, and localStorage is per-origin, not per-path).

const K_DECKS = 'hw_decks_v1', K_ACTIVE = 'hw_active_v1', K_WALLET = 'hw_wallet', K_RECORD = 'hw_record';

export function loadDecks(validIds, starterMap) {
  let decks = [];
  try { decks = JSON.parse(localStorage.getItem(K_DECKS) || '[]'); } catch (e) { decks = []; }
  decks = Array.isArray(decks)
    ? decks.filter(d => d && d.id && d.cards && Object.keys(d.cards).every(k => validIds.has(k) && d.cards[k] >= 1 && d.cards[k] <= 2))
    : [];
  if (!decks.length) decks = [{ id: 'starter', name: 'Starter', cards: { ...starterMap } }];
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

export function loadWallet() { try { return JSON.parse(localStorage.getItem(K_WALLET) || 'null'); } catch (e) { return null; } }
export function saveWallet(w) { try { localStorage.setItem(K_WALLET, JSON.stringify(w)); } catch (e) {} }
export function clearWallet() { try { localStorage.removeItem(K_WALLET); } catch (e) {} }

export function loadRecord() {
  try { const r = JSON.parse(localStorage.getItem(K_RECORD) || 'null'); if (r && typeof r.w === 'number') return r; } catch (e) {}
  return { w: 0, l: 0 };
}
export function saveRecord(rec) { try { localStorage.setItem(K_RECORD, JSON.stringify(rec)); } catch (e) {} }
