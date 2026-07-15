// Roster (deck) CRUD — same rules as the prototype: max 2 copies, 24-card cap,
// at least one roster always exists, ★ marks the default used by quick match.
import { state, setState } from './state.js';
import { saveDecks } from './store.js';

export function deckCountOf(d) { let n = 0; for (const k in d.cards) n += d.cards[k]; return n; }
export function editDeck() { return state.decks.find(d => d.id === state.editId); }

function mutateDecks(fn) {
  const decks = state.decks.map(d => ({ ...d, cards: { ...d.cards } }));
  const patch = fn(decks) || {};
  saveDecks(decks, patch.activeId || state.activeId);
  setState({ decks, ...patch });
}

export function addCard(id) {
  mutateDecks(decks => { const d = decks.find(x => x.id === state.editId); if (!d) return; const n = d.cards[id] || 0; if (n >= 2 || deckCountOf(d) >= 24) return; d.cards[id] = n + 1; });
}
export function remCard(id) {
  mutateDecks(decks => { const d = decks.find(x => x.id === state.editId); if (!d || !d.cards[id]) return; d.cards[id]--; if (!d.cards[id]) delete d.cards[id]; });
}
export function newDeck() {
  const id = 'd' + Date.now().toString(36);
  mutateDecks(decks => { decks.push({ id, name: 'New roster', cards: {} }); return { editId: id }; });
}
export function deleteDeck(id) {
  mutateDecks((decks) => {
    if (decks.length <= 1) return;
    const i = decks.findIndex(d => d.id === id); if (i < 0) return;
    decks.splice(i, 1);
    const patch = {};
    if (state.editId === id) patch.editId = decks[0].id;
    if (state.activeId === id) patch.activeId = decks[0].id;
    return patch;
  });
}
export function setDefault() { mutateDecks(() => ({ activeId: state.editId })); }
export function renameDeck(name) { mutateDecks(decks => { const d = decks.find(x => x.id === state.editId); if (d) d.name = name; }); }
