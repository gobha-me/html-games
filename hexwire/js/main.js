// Bootstrap. Loads the engine (side-effect: sets globalThis.FL), restores saved
// decks/active/wallet/record, then wires the state→render loop and mounts the
// initial screen. Card display names are baked into engine POOL — no override map.
import '../engine.js';
import { state, session, setState, setRenderer } from './state.js';
import { clear } from './dom.js';
import { loadDecks, loadActive, loadWallet, loadRecord } from './store.js';
import { homeView } from './views/home.js';
import { rostersView } from './views/rosters.js';
import { matchView } from './views/match.js';
import { overlays } from './views/overlays.js';

const FL = globalThis.FL;
session.FL = FL;

const starterMap = {};
FL.STARTER.forEach(id => { starterMap[id] = (starterMap[id] || 0) + 1; });
session.starterMap = starterMap;

const validIds = new Set(FL.POOL.map(c => c.id));
const decks = loadDecks(validIds, starterMap);
const activeId = loadActive(decks);
const wallet = loadWallet();
session.record = loadRecord();

const app = document.getElementById('app');
const VIEWS = { deck: rostersView, match: matchView, home: homeView };

function render() {
  clear(app);
  app.append((VIEWS[state.screen] || homeView)());
  for (const node of overlays()) app.append(node);
}

setRenderer(render);
setState({ ready: true, decks, activeId, editId: activeId, wallet });
