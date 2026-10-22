// Bake the original #88 SVG filter once, rather than evaluating turbulence when
// paper repaints. Run from late-edition/: node e2e/bake-paper-grain.js
// Browser rasterization preserves the original monochrome texture and palette.
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
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas.toDataURL('image/png').split(',')[1];
  }, svg);
  await writeFile('assets/paper-grain.png', Buffer.from(data, 'base64'));
} finally { await browser.close(); }
