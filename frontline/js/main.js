// Bootstrap. Loads the engine (side-effect: sets globalThis.FL), applies the
// dieselpunk names, restores saved rosters/standing/prefs, then wires the
// state→render loop and mounts the initial screen.
import '../engine.js';
import { THEME_NAMES } from './theme.js';
import { state, session, setState, setRenderer } from './state.js';
import { clear } from './dom.js';
import { loadDecks, loadActive, loadRating, loadRecord, buildSimLadder, loadPrefs } from './store.js';
import { homeView } from './views/home.js';
import { ladderView } from './views/ladder.js';
import { rostersView } from './views/rosters.js';
import { matchView } from './views/match.js';
import { overlays } from './views/overlays.js';

const FL = globalThis.FL;
session.FL = FL;
FL.POOL.forEach(c => { if (THEME_NAMES[c.id]) c.name = THEME_NAMES[c.id]; });

const starterMap = {};
FL.STARTER.forEach(id => { starterMap[id] = (starterMap[id] || 0) + 1; });
session.starterMap = starterMap;

const validIds = new Set(FL.POOL.map(c => c.id));
const decks = loadDecks(validIds, starterMap);
const activeId = loadActive(decks);
session.rating = loadRating();
session.record = loadRecord();
session.simLadder = buildSimLadder();
session.prefs = loadPrefs();

const app = document.getElementById('app');
const VIEWS = { deck: rostersView, ladder: ladderView, match: matchView, home: homeView };

function render() {
  clear(app);
  app.append((VIEWS[state.screen] || homeView)());
  for (const node of overlays()) app.append(node);
}

setRenderer(render);
setState({ ready: true, decks, activeId, editId: activeId });
