// Venice art drop-in. Card art is optional: if art/cards/{id}.webp is present it
// renders behind the card/cell text with a legibility scrim; if it 404s the
// layer removes itself and the text-only card (the prototype look) remains.
// Canonical ids come from engine.js POOL — see art/README.md + venice-asset-brief.md.

export function cardArt(id, extra) {
  const wrap = document.createElement('div');
  wrap.setAttribute('style', 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;' + (extra || ''));
  const img = document.createElement('img');
  img.src = 'art/cards/' + id + '.webp';
  img.alt = '';
  img.setAttribute('style', 'width:100%;height:100%;object-fit:cover;display:block');
  img.addEventListener('error', () => wrap.remove());
  const scrim = document.createElement('div');
  scrim.setAttribute('style', 'position:absolute;inset:0;background:linear-gradient(180deg,rgba(38,34,26,.12) 0%,rgba(38,34,26,.74) 100%)');
  wrap.append(img, scrim);
  return wrap;
}

// Top art-window band for a hand card: portrait art with the text panel sitting
// below it on paper (no scrim needed). If the webp 404s the band removes itself and
// the card shrinks back to its text-only paper layout.
export function cardArtBand(id, height) {
  const band = document.createElement('div');
  band.setAttribute('style', `position:relative;flex:none;height:${height || 56}px;overflow:hidden;background:#26221a`);
  const img = document.createElement('img');
  img.src = 'art/cards/' + id + '.webp';
  img.alt = '';
  img.setAttribute('style', 'width:100%;height:100%;object-fit:cover;object-position:50% 30%;display:block');
  img.addEventListener('error', () => band.remove());
  band.append(img);
  return band;
}

// Optional battlefield backdrop behind the board grid (art/env/board_field.webp).
export function boardField() {
  const img = document.createElement('img');
  img.src = 'art/env/board_field.webp';
  img.alt = '';
  img.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.2;pointer-events:none;z-index:0');
  img.addEventListener('error', () => img.remove());
  return img;
}
