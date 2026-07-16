// App state + a minimal reactive setState. Mirrors the DC component's this.state
// (screen/sel/mode/… ) and its non-reactive fields (g, rating, record) held in
// `session`. setState/ping trigger a full re-render of the mounted screen.

export const state = {
  screen: 'home',      // 'home' | 'deck' | 'ladder' | 'match'
  ready: false,
  decks: [],
  activeId: null,
  editId: null,
  busy: false,
  sel: null,           // selected hand card uid
  mode: 'play',        // 'play' | 'bank'
  pendFrom: null,      // redeploy source {lane,row}
  coin: null,          // { first: 'p'|'o' }
  tut: false,
  tutStep: 0,          // current Field Training drill index
  tutStage: 'act',     // 'act' | 'review'
  tutPass: false,      // did the current drill's pass() succeed
  oppName: '',
  settingsOpen: false,
  logOpen: false,      // dispatches ticker expanded
};

// Non-reactive session data (engine game object, standing, prefs, lookups).
export const session = {
  FL: null,
  g: null,
  rating: 1000,
  record: { w: 0, l: 0 },
  simLadder: [],
  starterMap: {},
  prefs: { startLife: 20, fastAi: false },
};

let _render = () => {};
export function setRenderer(fn) { _render = fn; }

export function setState(patch) { Object.assign(state, patch); _render(); }
export function ping() { _render(); }

export function myTurn() {
  const g = session.g;
  return !!(g && !g.over && g.active === 'p' && !state.busy);
}
