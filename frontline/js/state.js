// App state + reactive setState for the unified Frontline / Hexwire / Rift client.

export const state = {
  style: 'frontline',  // 'frontline' | 'hexwire' | 'rift'
  screen: 'home',      // 'home' | 'deck' | 'ladder' | 'match'
  ready: false,
  decks: [],
  activeId: null,
  editId: null,
  busy: false,
  sel: null,           // selected hand card uid
  mode: 'play',        // 'play' | 'bank'
  pendFrom: null,      // redeploy/possess source {lane,row}
  coin: null,          // { first: 'p'|'o' }
  tut: false,          // boolean (Frontline drill) or { les, step, phase } (Hexwire lesson)
  tutStep: 0,
  tutStage: 'act',     // 'act' | 'review'
  tutPass: false,
  oppName: '',
  crewKey: 'MID',
  queue: null,
  ladderTab: 'std',
  zoom: null,
  settingsOpen: false,
  logOpen: false,
};

export const session = {
  FL: null,
  g: null,
  rating: 1000,
  record: { w: 0, l: 0 },
  simLadder: [],
  starterMap: {},
  prefs: { startLife: 20, fastAi: false, muted: false },
};

let _render = () => {};
export function setRenderer(fn) { _render = fn; }

export function setState(patch) { Object.assign(state, patch); _render(); }
export function ping() { _render(); }

export function myTurn() {
  const g = session.g;
  return !!(g && !g.over && g.active === 'p' && !state.busy);
}

export function isHexStyle() {
  return state.style === 'hexwire';
}
