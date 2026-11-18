import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dropFiles, FIXTURES, loadDemoHistory, ready, TEXT_PDFS, waitDrafts } from './helpers.ts';

test.describe('carga y revisión', () => {
  test('arrastrar PDF, revisar, corregir y confirmar', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await expect(page.getByTestId('disclaimer')).toHaveText('Organiza y grafica tus resultados. No interpreta, no diagnostica y no sustituye a tu médico.');

    await dropFiles(page, [TEXT_PDFS[0]!, TEXT_PDFS[2]!]);
    await waitDrafts(page, 2);
    const first = page.locator('.draft').first();
    await expect(first.locator('h3')).toHaveText('laboratorio-ejemplo-2019-03.pdf');
    await expect(first.locator('input[data-dfield="date"]')).toHaveValue('2019-03-14');
    await expect(first.locator('input[data-dfield="lab"]')).toHaveValue('LABORATORIO CLÍNICO EJEMPLO');
    await expect(first.locator('tbody tr')).toHaveCount(15);

    // Cada fila muestra el texto original junto al valor leído.
    const glucose = first.locator('tbody tr').first();
    await expect(glucose.locator('select[data-field="analyteId"]')).toHaveValue('glucosa');
    await expect(glucose.locator('input[data-field="valueText"]')).toHaveValue('92');
    await expect(glucose.locator('code')).toContainText('Glucosa');
    await expect(glucose.locator('code')).toContainText('70 - 100');

    // Corregir, eliminar y agregar filas.
    await glucose.locator('input[data-field="valueText"]').fill('93');
    await first.locator('tbody tr').nth(1).getByRole('button', { name: /Eliminar fila/ }).click();
    await expect(first.locator('tbody tr')).toHaveCount(14);
    await first.getByRole('button', { name: 'Agregar fila' }).click();
    await expect(first.locator('tbody tr')).toHaveCount(15);
    const added = first.locator('tbody tr').last();
    await expect(added.locator('select[data-field="analyteId"]')).toBeFocused();

    // Una fila vacía impide confirmar y señala el error.
    await first.getByRole('button', { name: 'Confirmar y agregar al historial' }).click();
    await expect(first.locator('.error')).toContainText('Revisa los campos marcados');
    await expect(added.locator('[aria-invalid="true"]').first()).toBeFocused();
    await added.locator('input[data-field="name"]').fill('Proteína de ejemplo');
    await added.locator('input[data-field="valueText"]').fill('12,5');
    await added.locator('input[data-field="unit"]').fill('mg/L');
    await first.getByRole('button', { name: 'Confirmar y agregar al historial' }).click();
    await waitDrafts(page, 1);
    await expect(page.locator('#history')).toBeVisible();

    // El segundo documento: coma decimal y sexo para rangos.
    const second = page.locator('.draft').first();
    await expect(second.locator('input[data-dfield="date"]')).toHaveValue('2021-08-22');
    const uric = () => second.locator('tbody tr').filter({ has: page.locator('code', { hasText: 'Ácido úrico' }) });
    await expect(uric().locator('input[data-field="highText"]')).toHaveValue('7');
    await second.locator('select[data-dfield="sex"]').selectOption('F');
    await expect(uric().locator('input[data-field="highText"]')).toHaveValue('5.7');
    await page.locator('#confirm-all').click();
    await waitDrafts(page, 0);
    await expect(page.locator('#history-summary')).toContainText('2 estudios');
    await expect(page.locator('#tab-dashboard')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.series-card', { hasText: 'Proteína de ejemplo' })).toBeVisible();
  });

  test('captura manual', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await page.getByRole('button', { name: 'Captura manual' }).click();
    const draft = page.locator('.draft');
    await expect(draft.locator('input[data-dfield="date"]')).toBeFocused();
    await draft.getByRole('button', { name: 'Confirmar y agregar al historial' }).click();
    await expect(draft.locator('.error')).toContainText('Captura la fecha del estudio.');
    await draft.locator('input[data-dfield="date"]').fill('2024-05-01');
    await draft.locator('input[data-dfield="lab"]').fill('Laboratorio capturado a mano');
    const row = draft.locator('tbody tr').first();
    await row.locator('select[data-field="analyteId"]').selectOption('glucosa');
    await expect(row.locator('input[data-field="name"]')).toHaveCount(0);
    await row.locator('input[data-field="valueText"]').fill('91');
    await row.locator('input[data-field="unit"]').fill('mg/dL');
    await row.locator('input[data-field="lowText"]').fill('70');
    await row.locator('input[data-field="highText"]').fill('100');
    await draft.getByRole('button', { name: 'Confirmar y agregar al historial' }).click();
    await waitDrafts(page, 0);
    await expect(page.locator('.series-card', { hasText: 'Glucosa' })).toContainText('91');
  });

  test('reporta los archivos que no se pudieron leer', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await page.locator('#file-input').setInputFiles(['danado.pdf', 'no-es-reporte.pdf', 'notas.txt', 'laboratorio-ejemplo-2026-06-escaneado.pdf', 'foto-resultados-2026-06.jpg'].map((f) => join(FIXTURES, f)));
    const notices = page.locator('#notices');
    await expect(notices).toContainText('danado.pdf: el PDF está dañado o no es válido.');
    await expect(notices).toContainText('no-es-reporte.pdf: no encontramos resultados');
    await expect(notices).toContainText('notas.txt: no es un PDF ni una imagen compatible.');
    await expect(notices).toContainText('laboratorio-ejemplo-2026-06-escaneado.pdf: parece un PDF escaneado');
    await expect(notices).toContainText('foto-resultados-2026-06.jpg: es una imagen. Activa el OCR');
    await page.locator('#file-input').setInputFiles([TEXT_PDFS[0]!]);
    await waitDrafts(page, 1);
    await page.locator('#file-input').setInputFiles([TEXT_PDFS[0]!]);
    await expect(notices).toContainText('laboratorio-ejemplo-2019-03.pdf: ya lo habías cargado.');
  });
});

test.describe('historial y gráficas', () => {
  test('tablero, gráfica con rangos de cada laboratorio, burbuja y teclado', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await loadDemoHistory(page);
    await expect(page.locator('#history-summary')).toContainText('7 estudios');
    const glucoseCard = page.locator('.series-card[data-series="glucosa|mg/dL"]');
    await expect(glucoseCard).toContainText('95');
    await expect(glucoseCard.locator('svg.spark')).toBeVisible();

    await glucoseCard.click();
    await expect(page.locator('#tab-chart')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#chart-title')).toHaveText('Glucosa (mg/dL)');
    const svg = page.locator('#chart-box svg');
    await expect(svg.locator('.pt')).toHaveCount(7);
    // Fuera del rango de SU laboratorio: 108 (74 - 106) y 101 (70 - 99).
    await expect(svg.locator('.pt-out')).toHaveCount(2);
    expect(await svg.locator('rect.band').count()).toBeGreaterThan(1);
    await expect(page.locator('#chart-notes')).toContainText('El rango de referencia cambia entre resultados');
    await expect(page.locator('#chart-notes')).toContainText('se convirtieron a mg/dL');
    await expect(page.locator('#chart-table tbody tr')).toHaveCount(7);
    await expect(page.locator('#chart-table tbody tr').first()).toContainText('9 jun 2026');

    // Puntos con teclado: foco, flechas, Enter fija la burbuja, Escape la cierra.
    const first = svg.locator('.pt').first();
    await first.focus();
    await expect(page.locator('#chart-tip')).toBeVisible();
    await expect(page.locator('#chart-tip')).toContainText('14 mar 2019');
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
    await expect(svg.locator('.pt').nth(4)).toBeFocused();
    await expect(page.locator('#chart-tip')).toContainText('108');
    await expect(page.locator('#chart-tip')).toContainText('Arriba del rango del laboratorio');
    await expect(page.locator('#chart-tip')).toContainText('Laboratorio Demo Norte');
    await expect(page.locator('#chart-tip')).toContainText('laboratorio-demo-norte-2023-10.pdf');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(page.locator('#chart-tip')).toBeHidden();
    await expect(svg.locator('.pt').nth(4)).toHaveAttribute('aria-label', /3 oct 2023: 108 mg\/dL/);

    // Clic (o toque) también muestra el detalle.
    await svg.locator('.pt').nth(2).click();
    await expect(page.locator('#chart-tip')).toContainText('Convertido de 5,6 mmol/L');
  });

  test('HbA1c en % y mmol/mol no se mezclan', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await loadDemoHistory(page);
    await page.locator('.series-card[data-series="hba1c|%"]').click();
    await expect(page.locator('#chart-box svg .pt')).toHaveCount(4);
    await expect(page.locator('#chart-notes')).toContainText('mmol/mol');
    await expect(page.locator('#chart-notes')).toContainText('no existe un factor de conversión exacto');
    await expect(page.locator('#chart-notes')).toContainText('sin límites numéricos no se dibuja franja');
    await page.locator('#chart-notes').getByRole('button', { name: 'Ver en mmol/mol' }).click();
    await expect(page.locator('#chart-title')).toHaveText('Hemoglobina glucosilada (HbA1c) (mmol/mol)');
    await expect(page.locator('#chart-box svg .pt')).toHaveCount(1);
  });

  test('filtros por fecha y laboratorio, pestañas con teclado y eliminar estudio', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await loadDemoHistory(page);
    await page.locator('#f-lab').selectOption({ label: 'Laboratorio Demo Norte' });
    await expect(page.locator('#history-summary')).toContainText('2 estudios');
    await page.locator('#f-lab').selectOption('all');
    await page.locator('#f-from').fill('2023-01-01');
    await page.locator('#f-from').dispatchEvent('change');
    await expect(page.locator('#history-summary')).toContainText('3 estudios');
    await page.locator('#f-clear').click();
    await expect(page.locator('#history-summary')).toContainText('7 estudios');

    await page.locator('#tab-dashboard').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tab-chart')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.locator('#tab-studies')).toBeFocused();
    await expect(page.locator('.study')).toHaveCount(7);
    page.once('dialog', (d) => void d.accept());
    await page.locator('.study').first().getByRole('button', { name: /Eliminar estudio del 9 jun 2026/ }).click();
    await expect(page.locator('.study')).toHaveCount(6);
  });

  test('exporta CSV y resumen imprimible', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await loadDemoHistory(page);
    const [csv] = await Promise.all([page.waitForEvent('download'), page.locator('#export-csv').click()]);
    expect(csv.suggestedFilename()).toMatch(/^mis-laboratorios-\d{4}-\d{2}-\d{2}\.csv$/);
    const text = readFileSync((await csv.path())!, 'utf8');
    const lines = text.trim().split('\r\n');
    expect(lines[0]!.startsWith('fecha,laboratorio,analito_id')).toBe(true);
    expect(lines.length).toBe(Number(await page.locator('#app').getAttribute('data-result-count')) + 1);
    const [excel] = await Promise.all([page.waitForEvent('download'), page.locator('#export-excel').click()]);
    expect([...readFileSync((await excel.path())!).subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);

    await page.evaluate(() => {
      window.print = () => undefined;
    });
    await page.locator('#print-btn').click();
    await page.emulateMedia({ media: 'print' });
    const summary = page.locator('#print-summary');
    await expect(summary.locator('h1')).toHaveText('Resumen de resultados de laboratorio');
    await expect(summary).toContainText('No interpreta, no diagnostica y no sustituye a tu médico.');
    await expect(summary).toContainText('Glucosa');
    await expect(summary).toBeVisible();
    await expect(page.locator('.app')).toBeHidden();
  });

  test('cambia a inglés', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await page.locator('#lang-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByTestId('disclaimer')).toHaveText('Organizes and charts your results. It does not interpret, does not diagnose and does not replace your doctor.');
    await loadDemoHistory(page);
    await expect(page.locator('.series-card[data-series="glucosa|mg/dL"] .sc-name')).toHaveText('Glucose');
    await expect(page.locator('#tab-dashboard')).toContainText('Dashboard');
  });
});

test.describe('persistencia opcional', () => {
  test('no guarda nada por omisión; guarda sólo si se activa y "Borrar todo" lo elimina', async ({ page }) => {
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await loadDemoHistory(page);
    const dbNames = () => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
    expect(await dbNames()).toEqual([]);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
    expect(await page.context().cookies()).toEqual([]);

    await page.locator('#persist').check();
    await expect.poll(dbNames).toEqual(['mis-laboratorios']);
    await expect.poll(() => page.locator('#app').getAttribute('data-saved')).not.toBeNull();
    await page.reload();
    await ready(page, { serviceWorker: false });
    await expect(page.locator('#history')).toBeVisible();
    await expect(page.locator('#persist')).toBeChecked();

    page.once('dialog', (d) => void d.accept());
    await page.locator('#clear-all').click();
    await expect(page.locator('#workspace')).toBeHidden();
    await expect.poll(dbNames).toEqual([]);
    await page.reload();
    await ready(page, { serviceWorker: false });
    await expect(page.locator('#workspace')).toBeHidden();
  });
});

test.describe('PWA', () => {
  test('funciona sin conexión después de la primera visita', async ({ page, context }) => {
    await page.goto('./');
    await ready(page);
    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector('html[data-ready="true"]');
    await page.locator('#file-input').setInputFiles([TEXT_PDFS[5]!]);
    await waitDrafts(page, 1);
    await page.locator('#confirm-all').click();
    await expect(page.locator('#history')).toBeVisible();
    await context.setOffline(false);
  });
});

test.describe('accesibilidad (axe)', () => {
  test('sin violaciones WCAG 2.1 A/AA en portada, revisión, tablero, gráfica y estudios', async ({ page }) => {
    const check = async (label: string) => {
      const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      expect(res.violations.map((v) => `${label} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
    };
    await page.goto('./');
    await ready(page, { serviceWorker: false });
    await check('portada');
    await page.locator('#demo-btn').click();
    await waitDrafts(page, 7);
    await check('revisión');
    await page.locator('#confirm-all').click();
    await waitDrafts(page, 0);
    await check('tablero');
    await page.locator('#tab-chart').click();
    await page.locator('#chart-box svg .pt').first().focus();
    await check('gráfica');
    await page.locator('#tab-studies').click();
    await check('estudios');
  });
});
