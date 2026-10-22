import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import stylelint from 'stylelint';
import { PALETTE, alpha } from '../js/palette.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const css = readFileSync(`${root}css/style.css`, 'utf8');
const expected = {
  'night-ink': '#0E0D0C', mahogany: '#2A1710', smoke: '#6B655C', newsprint: '#EDE4CE',
  'newsprint-aged': '#D9CBA8', sodium: '#E8A23A', brass: '#B5893F',
  'stamp-red': '#A3221B', telegram: '#EAD58A', 'police-blue': '#3E5A78',
};

test('exactly ten root tokens mirror the sole JS palette', () => {
  const blocks = [...css.matchAll(/:root\s*\{([^}]+)\}/g)];
  assert.equal(blocks.length, 1);
  const tokens = Object.fromEntries([...blocks[0][1].matchAll(/--([\w-]+):\s*([^;]+);/g)]
    .map(([, name, value]) => [name, value.toUpperCase()]));
  assert.deepEqual(tokens, expected);
  assert.equal(blocks[0][1].split(';').filter((decl) => decl.trim()).length, 10, 'Root contains only the ten declarations');
  assert.deepEqual(Object.fromEntries(Object.entries(PALETTE).map(([key, value]) =>
    [key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), value])), expected);
});

// Scan ALL js/ files, not a hand-maintained renderer list: new modules cannot
// quietly reintroduce literal colors, including alpha hex or legacy rgb commas.
export function literalColors(source) {
  return source.match(/#[\da-f]{3,8}\b|\b(?:rgba?|hsla?)\s*\(/gi) ?? [];
}

test('JS has no literal colors outside palette.js, including nested future modules', () => {
  const files = readdirSync(`${root}js`, { recursive: true }).filter((f) => f.endsWith('.js') && f !== 'palette.js');
  for (const name of files) assert.deepEqual(literalColors(readFileSync(`${root}js/${name}`, 'utf8')), [], name);
  for (const invalid of ['#abc', '#abcdef88', 'rgb(1 2 3)', 'rgba(1,2,3,.5)', 'hsl(0 0% 0%)']) {
    assert.equal(literalColors(invalid).length, 1, invalid);
  }
  assert.equal(alpha(PALETTE.sodium, -1), `color-mix(in srgb, ${PALETTE.sodium} 0%, transparent)`);
  assert.equal(alpha(PALETTE.sodium, 2), `color-mix(in srgb, ${PALETTE.sodium} 100%, transparent)`);
});

for (const [source, rule] of [
  ['a { color: #ede4ce; }', 'color-no-hex'],
  ['a { color: rgb(14 13 12); }', 'function-disallowed-list'],
  ['a { color: hsl(0 0% 0%); }', 'function-disallowed-list'],
  ['a { color: rgba(14, 13, 12, 0.5); }', 'function-disallowed-list'],
  ['a { color: hsla(0, 0%, 0%, .5); }', 'function-disallowed-list'],
  [':root, body { color: #ede4ce; }', 'color-no-hex'],
  [':root { color: #ede4ce; }', 'color-no-hex'],
  [':root { --rogue: #ede4ce; }', 'color-no-hex'],
  [':root { --night-ink: #a3221b; }', 'color-no-hex'],
  [':root { a { color: #ede4ce; } }', 'color-no-hex'],
]) {
  test(`palette lint rejects ${source}`, async () => {
    const result = await stylelint.lint({ code: source, codeFilename: `${root}css/adversarial.css`,
      configFile: `${root}stylelint.config.js` });
    assert.ok(result.results[0].warnings.some((w) => w.rule === rule), JSON.stringify(result.results.map((r) => r.warnings)));
  });
}

test('palette lint accepts root tokens and derived alpha colors', async () => {
  const result = await stylelint.lint({ code: ':root {\n  --night-ink: #0e0d0c;\n}\n\na {\n  color: color-mix(in srgb, var(--night-ink) 50%, transparent);\n}\n',
    codeFilename: `${root}css/valid.css`, configFile: `${root}stylelint.config.js` });
  assert.equal(result.errored, false, JSON.stringify(result.results.map((r) => r.warnings)));
});

function luminance(hex) {
  return hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255)
    .map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// Opaque text roles actually used in the stylesheet. Smoke is rules/hardware,
// never small body text on aged stock (that pair would fail the 4.5 requirement).
const textPairs = [
  ['newsprint', 'nightInk'], ['newsprintAged', 'nightInk'], ['sodium', 'nightInk'],
  ['newsprint', 'mahogany'], ['newsprintAged', 'mahogany'],
  ['nightInk', 'newsprint'], ['nightInk', 'newsprintAged'], ['nightInk', 'telegram'],
  ['stampRed', 'newsprint'], ['stampRed', 'newsprintAged'], ['newsprint', 'stampRed'],
  ['policeBlue', 'newsprint'],
];
test('every body text token pair reaches WCAG 4.5:1 (including danger copy)', (t) => {
  for (const [fg, bg] of textPairs) {
    const ratio = contrast(PALETTE[fg], PALETTE[bg]);
    t.diagnostic(`${fg}/${bg}: ${ratio.toFixed(2)}:1`);
    assert.ok(ratio >= 4.5, `${fg}/${bg} = ${ratio}`);
  }
  assert.ok(contrast(PALETTE.sodium, PALETTE.newsprint) < 4.5, 'reject accent used as body ink');
  assert.ok(contrast(PALETTE.smoke, PALETTE.newsprintAged) < 4.5, 'reject tempting faded caption');
});

test('font assets are WOFF2 with OFL licenses, and no CDN link survives', () => {
  const html = readFileSync(`${root}index.html`, 'utf8');
  assert.doesNotMatch(html, /https?:\/\//);
  const fonts = [...css.matchAll(/url\('\.\.\/assets\/fonts\/([^']+)'\)/g)];
  assert.equal(fonts.length, 7);
  for (const [, file] of fonts) assert.equal(readFileSync(`${root}assets/fonts/${file}`).subarray(0, 4).toString(), 'wOF2');
  for (const family of ['leaguegothic', 'oldstandardtt', 'courierprime', 'unifrakturmaguntia']) {
    assert.match(readFileSync(`${root}assets/fonts/${family}-OFL.txt`, 'utf8'), /SIL OPEN FONT LICENSE/);
  }
  assert.equal([...css.matchAll(/font-display: swap/g)].length, 7);
});


test('legacy accents are isolated checksum data; renderer cannot import them', () => {
  const renderer = readFileSync(`${root}js/renderer.js`, 'utf8');
  assert.doesNotMatch(renderer, /legacy-district-hash/);
  assert.doesNotMatch(renderer, /(?:lead|op|fl|c)\.color/, 'Old saves cannot inject retired colors into overlays');
  for (const name of readdirSync(`${root}js`).filter((f) => f.endsWith('.js') && f !== 'sim.js')) {
    assert.doesNotMatch(readFileSync(`${root}js/${name}`, 'utf8'), /legacy-district-hash/, name);
  }
});
