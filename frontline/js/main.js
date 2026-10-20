// Bootstrap for the unified Frontline / Hexwire / Rift client.
// Loads the dual-style rules engine (globalThis.FL), restores saved style, rosters,
// standing, wallet, and prefs, then mounts the reactive view loop.
import '../engine.js';
import { state, session, setState, setRenderer } from './state.js';
import { clear } from './dom.js';
import { loadDecks, loadActive, loadRating, loadRecord, buildSimLadder, loadPrefs, loadSavedStyle, loadWallet } from './store.js';
import { syncBodyTheme } from './match.js';
import { homeView } from './views/home.js';
import { ladderView } from './views/ladder.js';
import { rostersView } from './views/rosters.js';
import { matchView } from './views/match.js';
import { overlays } from './views/overlays.js';

const FL = globalThis.FL;
session.FL = FL;

// Allow ?style=hexwire or ?style=rift URL param override
let initialStyle = loadSavedStyle();
try {
  const q = new URLSearchParams(window.location.search).get('style');
  if (q && FL.POOLS[q]) initialStyle = q;
} catch (e) {}

FL.setStyle(initialStyle);

const starterMap = {};
FL.STARTER.forEach(id => { starterMap[id] = (starterMap[id] || 0) + 1; });
session.starterMap = starterMap;

const validIds = new Set(FL.POOL.map(c => c.id));
const decks = loadDecks(validIds, starterMap, initialStyle);
const activeId = loadActive(decks, initialStyle);
session.rating = loadRating(initialStyle);
session.record = loadRecord(initialStyle);
session.simLadder = buildSimLadder(initialStyle);
session.prefs = loadPrefs();
const wallet = loadWallet();

syncBodyTheme(initialStyle);

const app = document.getElementById('app');
const VIEWS = { deck: rostersView, ladder: ladderView, match: matchView, home: homeView };

function render() {
  clear(app);
  app.append((VIEWS[state.screen] || homeView)());
  for (const node of overlays()) app.append(node);
}

setRenderer(render);
setState({ ready: true, style: initialStyle, decks, activeId, editId: activeId, wallet });
