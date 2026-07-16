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

// Small fixed-size card thumbnail for the roster pool (the NFT browser). Portrait
// art in a dark box; if the webp 404s the img removes itself and the box stays as a
// plain dark tile (the caller overlays the cost badge so cost is always visible).
export function cardThumb(id, w, h) {
  const box = document.createElement('div');
  box.setAttribute('style', `position:relative;flex:none;width:${w || 44}px;height:${h || 56}px;overflow:hidden;background:#26221a;border:1px solid #4a422e`);
  const img = document.createElement('img');
  img.src = 'art/cards/' + id + '.webp';
  img.alt = '';
  img.setAttribute('style', 'width:100%;height:100%;object-fit:cover;object-position:50% 28%;display:block');
  img.addEventListener('error', () => img.remove());
  box.append(img);
  return box;
}

// Battlefield backdrop behind the board grid (art/env/board_field.webp). The terrain
// reads at full strength; a single ~20% dark overlay on top keeps it from competing
// with the translucent cells and stat text layered above it.
export function boardField() {
  const wrap = document.createElement('div');
  wrap.setAttribute('style', 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0');
  const img = document.createElement('img');
  img.src = 'art/env/board_field.webp';
  img.alt = '';
  img.setAttribute('style', 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block');
  img.addEventListener('error', () => wrap.remove());
  const dim = document.createElement('div');
  dim.setAttribute('style', 'position:absolute;inset:0;background:rgba(20,17,11,.2)');
  wrap.append(img, dim);
  return wrap;
}
