// Bake the original #88 SVG filter once, rather than evaluating turbulence when
// paper repaints. Run from late-edition/: node e2e/bake-paper-grain.js
// Encode monochrome multiply as black with inverse-luminance alpha. Source-over
// then gives the same C * (1 - opacity * alpha * (1 - grain)) without a separate
// destination-dependent blend surface for every paper object (PR #101).
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">
<filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".72" numOctaves="3" stitchTiles="stitch"/>
<feColorMatrix type="saturate" values="0"/></filter>
<path filter="url(#g)" d="M0 0h120v120H0z"/></svg>`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const data = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = `data:image/svg+xml,${encodeURIComponent(source)}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, 120, 120);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i + 3] = Math.round(pixels.data[i + 3] * (1 - pixels.data[i] / 255));
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 0;
    }
    ctx.putImageData(pixels, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  }, svg);
  await writeFile('assets/paper-grain.png', Buffer.from(data, 'base64'));
} finally { await browser.close(); }
