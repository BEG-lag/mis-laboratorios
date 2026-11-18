/**
 * Capturas reales de la app con datos SINTÉTICOS para el README.
 * Uso: npm run build && npm run screenshots
 */
import { chromium, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { preview } from 'vite';

const root = join(import.meta.dirname, '..');
const outDir = join(root, 'docs', 'screenshots');
mkdirSync(outDir, { recursive: true });
const PORT = 4179;
const FIX = join(root, 'tests', 'fixtures');

const server = await preview({ root, preview: { port: PORT, strictPort: true } });
const url = `http://localhost:${PORT}/mis-laboratorios/`;

async function open(page: Page): Promise<void> {
  await page.goto(url);
  await page.waitForSelector('html[data-ready="true"]');
  page.on('dialog', (d) => void d.accept());
}

async function scrollTo(page: Page, selector: string, offset: number): Promise<void> {
  await page.evaluate(
    ({ sel, off }) => {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off);
    },
    { sel: selector, off: offset },
  );
  await page.waitForTimeout(150);
}

async function history(page: Page): Promise<void> {
  await page.locator('#demo-btn').click();
  await page.locator('#confirm-all').click();
  await page.waitForSelector('#history:not([hidden])');
  await page.waitForTimeout(3200); // deja que desaparezca el aviso
}

const browser = await chromium.launch();

// Escritorio
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await open(page);
  await page.screenshot({ path: join(outDir, 'desktop-inicio.png') });
  await page.locator('#file-input').setInputFiles([join(FIX, 'analisis-valle-ficticio-2021-08.pdf'), join(FIX, 'laboratorio-demo-norte-2022-11.pdf')]);
  await page.waitForSelector('#review:not([hidden])');
  await scrollTo(page, '.draft:nth-of-type(2)', 70);
  await page.screenshot({ path: join(outDir, 'desktop-revision.png') });
  await page.locator('#confirm-all').click();
  await history(page);
  await scrollTo(page, '.tabs', 76);
  await page.screenshot({ path: join(outDir, 'desktop-tablero.png') });
  await page.locator('[data-series="glucosa|mg/dL"]').click();
  await scrollTo(page, '.chart-pick', 76);
  await page.locator('#chart-box svg .pt').nth(4).hover();
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(outDir, 'desktop-grafica.png') });
  await page.locator('#series-select').selectOption('hba1c|%');
  await scrollTo(page, '.chart-pick', 76);
  await page.screenshot({ path: join(outDir, 'desktop-hba1c.png') });
  await page.close();
}

// Móvil (375 px)
{
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await open(page);
  await page.screenshot({ path: join(outDir, 'mobile-inicio.png') });
  await page.locator('#demo-btn').click();
  await scrollTo(page, '.draft tbody', 70);
  await page.screenshot({ path: join(outDir, 'mobile-revision.png') });
  await page.locator('#confirm-all').click();
  await page.waitForTimeout(3200);
  await scrollTo(page, '.tabs', 64);
  await page.screenshot({ path: join(outDir, 'mobile-tablero.png') });
  await page.locator('[data-series="colesterol-total|mg/dL"]').click();
  await scrollTo(page, '.chart-title', 70);
  await page.locator('#chart-box svg .pt').nth(3).tap();
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(outDir, 'mobile-grafica.png') });
  await page.close();
}

await browser.close();
await new Promise<void>((resolve) => server.httpServer.close(() => resolve()));
console.log(`Capturas en ${outDir}`);
