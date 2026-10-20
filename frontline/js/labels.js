// Keyword tag builders aware of the active card style ('frontline' | 'hexwire' | 'rift').
import { state } from './state.js';
import { KW_NAMES_FL, KW_NAMES_HW } from './theme.js';

export function kwTags(u) {
  const hex = state.style === 'hexwire';
  const t = [];
  if (u.kw.guard) t.push(hex ? 'GRD' : 'BLW');
  if (u.shieldUp) t.push(hex ? 'WRD' : 'PLT');
  if (u.kw.rally) t.push('R+' + u.kw.rally);
  if (u.kw.haste) t.push(hex ? 'WIRED' : 'RPD');
  if (u.kw.venom) t.push(hex ? 'CURSE' : 'GAS');
  if (u.kw.pierce) t.push(hex ? 'PRC' : 'OVR');
  if (u.kw.subvert) t.push('SBV≤' + u.kw.subvert);
  return t.join(' ');
}

export function defTags(d) {
  const names = state.style === 'hexwire' ? KW_NAMES_HW : KW_NAMES_FL;
  const t = [];
  if (d.kw.guard) t.push(names.guard);
  if (d.kw.shield) t.push(names.shield);
  if (d.kw.rally) t.push(names.rally + ' ' + d.kw.rally);
  if (d.kw.haste) t.push(names.haste);
  if (d.kw.venom) t.push(names.venom);
  if (d.kw.pierce) t.push(names.pierce);
  if (d.kw.subvert) t.push('Subvert ≤' + d.kw.subvert);
  if (d.flanks && (d.flanks[0] || d.flanks[1])) t.push('◀' + d.flanks[0] + ' ' + d.flanks[1] + '▶');
  return t.join(' · ');
}
