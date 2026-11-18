import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { createWorker, OEM } from 'tesseract.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parseDocument } from '../../src/lib/extract.ts';
import { ocrWordsToPage, type OcrWord } from '../../src/lib/layout.ts';
import { isPdf, openPdf, PdfReadError, textChars } from '../../src/lib/pdf.ts';
import { expectedValues, REPORTS } from '../../src/lib/synthetic.ts';
import { fixture, PDFJS, pdfPages } from './helpers.ts';

describe('PDF sintéticos leídos con pdf.js', () => {
  for (const rep of REPORTS.filter((r) => r.layout !== 'escaneado')) {
    it(`${rep.layout}: ${rep.file}`, async () => {
      const pages = await pdfPages(rep.file);
      expect(pages).toHaveLength(rep.pages.length);
      const doc = parseDocument(pages);
      const expected = expectedValues(rep);
      expect(doc.rows).toHaveLength(expected.length);
      expect(doc.meta.date).toBe(rep.date);
      expect(doc.meta.lab).toBe(rep.lab);
      expect(doc.rows.every((r) => r.analyteId !== null && r.unit !== '')).toBe(true);
    });
  }

  it('multipágina: la segunda página repite el encabezado sin duplicar resultados', async () => {
    const pages = await pdfPages('analisis-valle-ficticio-2021-08.pdf');
    const doc = parseDocument(pages);
    expect(doc.pages).toBe(2);
    const ids = doc.rows.map((r) => r.analyteId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('PDF escaneado: no tiene texto', async () => {
    const pages = await pdfPages('laboratorio-ejemplo-2026-06-escaneado.pdf');
    expect(textChars(pages)).toBe(0);
  });

  it('PDF que no es reporte: cero resultados', async () => {
    const doc = parseDocument(await pdfPages('no-es-reporte.pdf'));
    expect(doc.rows).toEqual([]);
  });

  it('PDF dañado: error claro', async () => {
    await expect(openPdf(PDFJS, fixture('danado.pdf'))).rejects.toBeInstanceOf(PdfReadError);
  });

  it('reconoce la firma %PDF', () => {
    expect(isPdf(fixture('no-es-reporte.pdf'))).toBe(true);
    expect(isPdf(fixture('notas.txt'))).toBe(false);
  });
});

describe('OCR (tesseract.js) de un escaneo sintético', () => {
  const require = createRequire(import.meta.url);
  const langPath = join(dirname(require.resolve('@tesseract.js-data/spa/package.json')), '4.0.0_best_int');
  let worker: Awaited<ReturnType<typeof createWorker>>;

  beforeAll(async () => {
    worker = await createWorker('spa', OEM.LSTM_ONLY, { langPath, cacheMethod: 'none', gzip: true });
    await worker.setParameters({ tessedit_pageseg_mode: '3' as never, preserve_interword_spaces: '1', user_defined_dpi: '200' });
  });
  afterAll(async () => {
    await worker?.terminate();
  });

  it('extrae los valores de la foto del reporte', async () => {
    const { data } = await worker.recognize(Buffer.from(fixture('foto-resultados-2026-06.jpg')), {}, { blocks: true, text: false });
    const words = (data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words))) as unknown as OcrWord[];
    const doc = parseDocument([ocrWordsToPage(words, 1, 1530, 1980)]);
    const rep = REPORTS.find((r) => r.layout === 'escaneado')!;
    const expected = expectedValues(rep);
    expect(doc.meta.date).toBe('2026-06-09');
    expect(doc.meta.sex).toBe('M');
    const got = new Map(doc.rows.map((r) => [r.name.toLowerCase(), r.valueText]));
    const hits = expected.filter((e) => got.get(e.name.toLowerCase()) === e.value).length;
    // El OCR puede fallar; exigimos al menos 14 de 16 valores exactos.
    expect(hits).toBeGreaterThanOrEqual(14);
    expect(doc.rows.find((r) => r.analyteId === 'glucosa')).toMatchObject({ value: 95, unit: 'mg/dL' });
  });
});
