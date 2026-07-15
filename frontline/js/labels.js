// Keyword tag builders. kwTags = terse board glyphs (live unit); defTags = deck /
// hand descriptors (card definition). Ported verbatim from the DC prototype.
import { KW_NAMES } from './theme.js';

export function kwTags(u) {
  const t = [];
  if (u.kw.guard) t.push('BLW');
  if (u.shieldUp) t.push('PLT');
  if (u.kw.strike) t.push('⁂' + u.kw.strike);
  if (u.kw.rally) t.push('R+' + u.kw.rally);
  if (u.kw.haste) t.push('RPD');
  if (u.kw.venom) t.push('GAS');
  if (u.kw.pierce) t.push('OVR');
  return t.join(' ');
}

export function defTags(d) {
  const t = [];
  if (d.kw.guard) t.push(KW_NAMES.guard);
  if (d.kw.shield) t.push(KW_NAMES.shield);
  if (d.kw.strike) t.push(KW_NAMES.strike + ' ' + d.kw.strike);
  if (d.kw.rally) t.push(KW_NAMES.rally + ' ' + d.kw.rally);
  if (d.kw.haste) t.push(KW_NAMES.haste);
  if (d.kw.venom) t.push(KW_NAMES.venom);
  if (d.kw.pierce) t.push(KW_NAMES.pierce);
  if (d.flanks && (d.flanks[0] || d.flanks[1])) t.push('◀' + d.flanks[0] + ' ' + d.flanks[1] + '▶');
  return t.join(' · ');
}
