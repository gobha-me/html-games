// App state + a minimal reactive setState. Mirrors the Hexwire DC component's
// this.state and its non-reactive fields (g, prefs) held in `session`.
// setState/ping trigger a full re-render of the mounted screen.

export const state = {
  screen: 'home',      // 'home' | 'deck' | 'match'
  ready: false,
  decks: [],
  activeId: null,
  editId: null,
  busy: false,
  sel: null,           // selected hand card uid
  mode: 'play',        // 'play' | 'bank'
  pendFrom: null,      // redeploy/possess source {lane,row}
  coin: null,          // { first: 'p'|'o' }
  wallet: null,        // { addr, provider } — simulated, non-custodial
  showConnect: false,
  connecting: null,    // provider name while "connecting"
  queue: null,         // lobby key being queued: 'block' | 'synd'
  ladderTab: 'std',    // 'std' | 'col'
  crewKey: 'MID',      // rival crew playbook for the active match
  tut: null,           // tutorial step index into TUT, or null
  zoom: null,          // card id shown in the art-zoom modal, or null
};

// Non-reactive session data (engine game object, prefs, lookups).
export const session = {
  FL: null,
  g: null,
  starterMap: {},
  record: { w: 0, l: 0 },
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
