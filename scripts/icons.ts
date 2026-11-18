/**
 * Genera los íconos PNG del manifiesto (192, 512 y maskable 512) a partir del SVG del logo,
 * renderizándolos con Chromium de Playwright. Uso: npm run icons
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const svg = readFileSync(join(root, 'public', 'favicon.svg'), 'utf8');

const targets = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  { file: 'icon-maskable-512.png', size: 512, padding: 0.18 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.padding * 2));
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0;background:#0a0c10;display:grid;place-items:center;width:${t.size}px;height:${t.size}px">${svg.replace(
      '<svg ',
      `<svg width="${inner}" height="${inner}" `,
    )}</body></html>`,
  );
  await page.screenshot({ path: join(root, 'public', 'icons', t.file), omitBackground: false });
  console.log(`public/icons/${t.file}`);
}
await browser.close();
