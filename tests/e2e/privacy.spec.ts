import { expect, test, type Request } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dropFiles, FIXTURES, ready, TEXT_PDFS, waitDrafts } from './helpers.ts';

test.describe('privacidad: cero peticiones de red al leer tus resultados', () => {
  test('lee seis PDF, revisa, grafica, exporta e imprime sin una sola petición HTTP', async ({ page, context }) => {
    await page.goto('./');
    await ready(page);

    // A partir de aquí registramos TODA petición del contexto (página, workers y service worker).
    const requests: Request[] = [];
    context.on('request', (r) => requests.push(r));

    await dropFiles(page, TEXT_PDFS);
    await waitDrafts(page, 6);
    const ms = Number(await page.locator('#app').getAttribute('data-last-load-ms'));
    test.info().annotations.push({ type: 'perf', description: `6 PDF leídos en ${ms} ms` });
    console.info(`[perf chromium] 6 PDF sintéticos leídos y analizados en ${ms} ms`);

    await page.locator('.draft').first().locator('tbody tr').first().locator('input[data-field="valueText"]').fill('92');
    await page.locator('#confirm-all').click();
    await waitDrafts(page, 0);
    await page.locator('.series-card').first().click();
    await page.locator('#chart-box svg .pt').first().hover();
    await page.locator('#f-lab').selectOption({ index: 1 });
    await page.locator('#tab-studies').click();
    const download = page.waitForEvent('download');
    await page.locator('#export-csv').click();
    await download;
    await page.evaluate(() => {
      window.print = () => undefined;
    });
    await page.locator('#print-btn').click();
    await page.locator('#lang-toggle').click();

    const http = requests.filter((r) => /^https?:/.test(r.url()));
    expect(http.map((r) => `${r.method()} ${r.url()}`)).toEqual([]);
  });

  test('la CSP bloquea fetch en la página y en los workers', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("connect-src 'none'");
    expect(csp).toContain("default-src 'none'");
    const fromPage = await page.evaluate(async () => {
      try {
        await fetch('https://example.com/');
        return 'sent';
      } catch {
        return 'blocked';
      }
    });
    expect(fromPage).toBe('blocked');
    // Un worker creado desde blob: (como los de pdf.js y OCR) hereda la política.
    const fromWorker = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const src = `fetch(${JSON.stringify(location.origin + '/')}).then(() => postMessage('sent'), () => postMessage('blocked'));`;
          const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
          w.onmessage = (e) => resolve(String(e.data));
          w.onerror = () => resolve('error');
        }),
    );
    expect(fromWorker).toBe('blocked');
  });

  test('sin analítica, cookies ni recursos de terceros al cargar', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (/^https?:$/.test(url.protocol) && url.hostname !== 'localhost') external.push(r.url());
    });
    await page.goto('./');
    await ready(page);
    expect(external).toEqual([]);
    expect(await page.context().cookies()).toEqual([]);
  });

  test('OCR: sólo descarga su propio motor del mismo sitio y nunca envía archivos', async ({ page, context }) => {
    await page.goto('./');
    await ready(page);
    const requests: Request[] = [];
    context.on('request', (r) => requests.push(r));
    await page.locator('#ocr-toggle').check();
    await page.locator('#file-input').setInputFiles([join(FIXTURES, 'laboratorio-ejemplo-2026-06-escaneado.pdf'), join(FIXTURES, 'foto-resultados-2026-06.jpg')]);
    await waitDrafts(page, 2);
    const drafts = page.locator('.draft');
    await expect(drafts.first()).toHaveClass(/is-ocr/);
    await expect(drafts.first().locator('.draft-meta')).toContainText('Leído con OCR');
    await expect(drafts.first().locator('input[data-dfield="date"]')).toHaveValue('2026-06-09');
    expect(await drafts.first().locator('tbody tr').count()).toBeGreaterThanOrEqual(14);
    const glucose = drafts.first().locator('tbody tr').filter({ has: page.locator('select[data-field="analyteId"] option[value="glucosa"]:checked') });
    await expect(glucose.locator('input[data-field="valueText"]')).toHaveValue('95');

    const http = requests.filter((r) => /^https?:/.test(r.url()));
    const origin = new URL(page.url()).origin;
    for (const r of http) {
      expect(r.method(), r.url()).toBe('GET');
      expect(r.url().startsWith(origin), r.url()).toBe(true);
      expect(r.postData()).toBeNull();
      expect(new URL(r.url()).pathname, r.url()).toMatch(/\/mis-laboratorios\/(ocr\/[0-9a-f]{10}\/[\w.-]+|assets\/[\w.-]+\.js)$/);
    }
    // Sin conexión y con la página recargada, el motor sale de la caché del service worker.
    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector('html[data-ready="true"]');
    await page.locator('#ocr-toggle').check();
    const photo = readFileSync(join(FIXTURES, 'foto-resultados-2026-06.jpg'));
    await page.locator('#file-input').setInputFiles({ name: 'otra-foto.jpg', mimeType: 'image/jpeg', buffer: Buffer.concat([photo, Buffer.from([0])]) });
    await waitDrafts(page, 1);
    await expect(page.locator('.draft').first().locator('.draft-meta')).toContainText('Leído con OCR');
    await context.setOffline(false);
  });
});
