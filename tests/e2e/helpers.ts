import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

export const FIXTURES = join(import.meta.dirname, '..', 'fixtures');
export const TEXT_PDFS = [
  'laboratorio-ejemplo-2019-03.pdf',
  'laboratorio-ejemplo-2020-09.pdf',
  'analisis-valle-ficticio-2021-08.pdf',
  'laboratorio-demo-norte-2022-11.pdf',
  'laboratorio-demo-norte-2023-10.pdf',
  'centro-diagnostico-prueba-2025-02.pdf',
].map((f) => join(FIXTURES, f));

/** Espera a que la app termine de cargar (worker de PDF, fuentes y, en producción, el service worker). */
export async function ready(page: Page, { serviceWorker = true } = {}): Promise<void> {
  await page.waitForSelector('html[data-ready="true"]');
  if (serviceWorker) {
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (reg.active?.state !== 'activated') {
        await new Promise<void>((resolve) => reg.active?.addEventListener('statechange', () => resolve()));
      }
    });
  }
}

/** Suelta archivos sobre la zona de carga con un evento drop real (DataTransfer). */
export async function dropFiles(page: Page, paths: string[], target = '#dropzone'): Promise<void> {
  const files = paths.map((p) => ({ name: basename(p), b64: readFileSync(p).toString('base64'), type: p.endsWith('.pdf') ? 'application/pdf' : p.endsWith('.jpg') ? 'image/jpeg' : 'text/plain' }));
  const dt = await page.evaluateHandle((list) => {
    const transfer = new DataTransfer();
    for (const f of list) {
      const bin = atob(f.b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      transfer.items.add(new File([bytes], f.name, { type: f.type }));
    }
    return transfer;
  }, files);
  await page.dispatchEvent(target, 'dragenter', { dataTransfer: dt });
  await page.dispatchEvent(target, 'dragover', { dataTransfer: dt });
  await page.dispatchEvent(target, 'drop', { dataTransfer: dt });
}

export async function waitDrafts(page: Page, count: number): Promise<void> {
  await page.waitForFunction((n) => document.querySelector('#app')?.getAttribute('data-draft-count') === String(n), count);
}

/** Datos de ejemplo confirmados: deja el historial listo. */
export async function loadDemoHistory(page: Page): Promise<void> {
  await page.locator('#demo-btn').click();
  await waitDrafts(page, 7);
  await page.locator('#confirm-all').click();
  await page.waitForSelector('#history:not([hidden])');
  await waitDrafts(page, 0);
}
