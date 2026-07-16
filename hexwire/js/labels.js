// Keyword tag builders. kwTags = terse board glyphs (live unit); defTags = deck /
// hand descriptors (card definition). Ported verbatim from the Hexwire prototype.

export function kwTags(u) {
  const t = [];
  if (u.kw.guard) t.push('GRD');
  if (u.shieldUp) t.push('WRD');
  if (u.kw.strike) t.push('⚔' + u.kw.strike);
  if (u.kw.rally) t.push('R+' + u.kw.rally);
  if (u.kw.haste) t.push('WIRED');
  if (u.kw.venom) t.push('CURSE');
  if (u.kw.pierce) t.push('PRC');
  if (u.kw.subvert) t.push('SBV≤' + u.kw.subvert);
  return t.join(' ');
}

export function defTags(d) {
  const t = [];
  if (d.kw.guard) t.push('Guard');
  if (d.kw.shield) t.push('Ward');
  if (d.kw.strike) t.push('Strike ' + d.kw.strike);
  if (d.kw.rally) t.push('Rally ' + d.kw.rally);
  if (d.kw.haste) t.push('Wired');
  if (d.kw.venom) t.push('Curse');
  if (d.kw.pierce) t.push('Pierce');
  if (d.kw.subvert) t.push('Subvert ≤' + d.kw.subvert);
  if (d.flanks && (d.flanks[0] || d.flanks[1])) t.push('◀' + d.flanks[0] + ' ' + d.flanks[1] + '▶');
  return t.join(' · ');
}
