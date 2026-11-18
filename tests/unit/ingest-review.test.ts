import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseDocument } from '../../src/lib/extract.ts';
import { fileKind, ingestFiles, MAX_BYTES, sha256, type IngestDeps } from '../../src/lib/ingest.ts';
import { openPdf, pdfText } from '../../src/lib/pdf.ts';
import {
  confirmDraft,
  CUSTOM,
  draftFromParsed,
  emptyRow,
  manualDraft,
  parseInputNumber,
  parseInputValue,
  resultKey,
  setDraftSex,
  validateDraft,
} from '../../src/lib/review.ts';
import { REPORTS, reportPages } from '../../src/lib/synthetic.ts';
import { FIXTURES, page, PDFJS } from './helpers.ts';

function file(name: string, type = ''): File {
  return new File([readFileSync(join(FIXTURES, name))], name, { type });
}

function deps(extra: Partial<IngestDeps> = {}): IngestDeps {
  return {
    knownHashes: new Set(),
    readPdf: async (bytes) => {
      const doc = await openPdf(PDFJS, bytes);
      const pages = await pdfText(doc);
      return { pages, numPages: doc.numPages, render: async () => new Blob([readFileSync(join(FIXTURES, 'foto-resultados-2026-06.jpg'))]), close: () => doc.destroy() };
    },
    ...extra,
  };
}

describe('lectura de archivos', () => {
  it('tipos de archivo por su firma', () => {
    const b = (arr: number[]) => new Uint8Array([...arr, ...new Array(16).fill(0)]);
    expect(fileKind('a.pdf', new TextEncoder().encode('%PDF-1.7'))).toBe('pdf');
    expect(fileKind('a.png', b([0x89, 0x50, 0x4e, 0x47]))).toBe('image');
    expect(fileKind('a.jpg', b([0xff, 0xd8, 0xff]))).toBe('image');
    expect(fileKind('a.webp', new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image');
    expect(fileKind('a.heic', new TextEncoder().encode('\0\0\0\x18ftypheic'))).toBe('heic');
    expect(fileKind('a.txt', new TextEncoder().encode('hola'))).toBe('unsupported');
  });

  it('PDF con texto, errores y duplicados', async () => {
    const d = deps();
    const progress: string[] = [];
    d.onProgress = (p) => progress.push(`${p.stage}:${p.file}`);
    const files = [
      file('laboratorio-ejemplo-2019-03.pdf'),
      file('analisis-valle-ficticio-2021-08.pdf'),
      file('laboratorio-ejemplo-2019-03.pdf'),
      file('laboratorio-ejemplo-2026-06-escaneado.pdf'),
      file('foto-resultados-2026-06.jpg', 'image/jpeg'),
      file('no-es-reporte.pdf'),
      file('danado.pdf'),
      file('notas.txt'),
    ];
    const { drafts, issues } = await ingestFiles(files, d);
    expect(drafts.map((x) => x.fileName)).toEqual(['laboratorio-ejemplo-2019-03.pdf', 'analisis-valle-ficticio-2021-08.pdf']);
    expect(drafts[0]!.source).toBe('pdf');
    expect(issues.map((i) => `${i.name}:${i.code}`)).toEqual([
      'laboratorio-ejemplo-2019-03.pdf:duplicate',
      'laboratorio-ejemplo-2026-06-escaneado.pdf:scanned-no-ocr',
      'foto-resultados-2026-06.jpg:image-no-ocr',
      'no-es-reporte.pdf:no-results',
      'danado.pdf:invalid',
      'notas.txt:unsupported',
    ]);
    expect(progress[0]).toBe('reading:laboratorio-ejemplo-2019-03.pdf');
  });

  it('con OCR: escaneados y fotos pasan por el OCR', async () => {
    const pages = reportPages(REPORTS.find((r) => r.layout === 'escaneado')!);
    const calls: number[] = [];
    const d = deps({
      ocr: async (_img, n) => {
        calls.push(n);
        return { ...pages[0]!, page: n };
      },
    });
    const { drafts, issues } = await ingestFiles([file('laboratorio-ejemplo-2026-06-escaneado.pdf'), file('foto-resultados-2026-06.jpg', 'image/jpeg')], d);
    expect(issues).toEqual([]);
    expect(drafts.map((x) => x.source)).toEqual(['ocr', 'ocr']);
    expect(drafts[0]!.rows.length).toBe(16);
    expect(calls).toEqual([1, 1]);
  });

  it('archivos demasiado grandes y fallas del OCR', async () => {
    const big = { name: 'enorme.pdf', size: MAX_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File;
    const failing = deps({
      ocr: async () => {
        throw new Error('sin memoria');
      },
    });
    const { issues } = await ingestFiles([big, file('laboratorio-ejemplo-2026-06-escaneado.pdf'), file('foto-resultados-2026-06.jpg')], failing);
    expect(issues.map((i) => i.code)).toEqual(['too-large', 'ocr-failed', 'ocr-failed']);
  });

  it('huella SHA-256', async () => {
    expect(await sha256(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('revisión humana', () => {
  const rep = REPORTS.find((r) => r.file.includes('2019-03'))!;
  const draft = () => draftFromParsed(parseDocument(reportPages(rep)), rep.file, 'pdf', 'abc');

  it('el borrador conserva fecha, laboratorio, sexo y filas', () => {
    const d = draft();
    expect(d).toMatchObject({ date: '2019-03-14', lab: 'LABORATORIO CLÍNICO EJEMPLO', sex: 'M', sexDetected: 'M', decimal: '.' });
    expect(d.rows[0]).toMatchObject({ analyteId: 'glucosa', valueText: '92', unit: 'mg/dL', lowText: '70', highText: '100' });
    expect(validateDraft(d)).toEqual([]);
  });

  it('cambiar el sexo vuelve a elegir el rango impreso', () => {
    const d = draft();
    setDraftSex(d, 'F');
    expect(d.rows.find((r) => r.analyteId === 'hemoglobina')).toMatchObject({ lowText: '12', highText: '15.5' });
    setDraftSex(d, null);
    expect(d.rows.find((r) => r.analyteId === 'hemoglobina')).toMatchObject({ lowText: '', highText: '' });
  });

  it('valida fecha, nombre, valor y límites', () => {
    const d = draft();
    d.date = '';
    const row = emptyRow();
    row.lowText = 'abc';
    d.rows.push(row);
    const errors = validateDraft(d).map((e) => e.field);
    expect(errors).toEqual(['date', 'name', 'value', 'low']);
    expect(validateDraft({ ...d, rows: [] }).map((e) => e.field)).toContain('rows');
  });

  it('confirma: convierte en estudio y resultados', () => {
    const d = draft();
    d.rows[0]!.valueText = '93';
    d.rows[0]!.lowText = '74';
    d.rows[0]!.rangeEdited = true;
    d.rows[1]!.analyteId = CUSTOM;
    d.rows[1]!.name = 'Urea (como se imprimió)';
    const { study, results } = confirmDraft(d);
    expect(study).toMatchObject({ date: '2019-03-14', lab: 'LABORATORIO CLÍNICO EJEMPLO', source: 'pdf', hash: 'abc', sex: 'M' });
    expect(results[0]).toMatchObject({ analyteId: 'glucosa', value: 93, valueText: '93' });
    expect(results[0]!.range).toMatchObject({ low: 74, high: 100, kind: 'interval' });
    expect(results[1]!.analyteId).toBe('custom:urea como se imprimio');
    // Sin cambios, el rango leído se conserva tal cual (con su etiqueta).
    expect(results.find((r) => r.analyteId === 'hemoglobina')!.range).toMatchObject({ label: 'Hombres', low: 13.5 });
    expect(resultKey(results[0]!, study)).toBe('2019-03-14|glucosa|93|mg/dL|laboratorio clínico ejemplo');
  });

  it('límites editados igual a los leídos conservan el rango original', () => {
    const d = draft();
    const ch = d.rows.find((r) => r.analyteId === 'colesterol-total')!;
    ch.rangeEdited = true;
    const { results } = confirmDraft(d);
    expect(results.find((r) => r.analyteId === 'colesterol-total')!.range).toMatchObject({ high: 200, highInclusive: false });
  });

  it('captura manual y valores cualitativos', () => {
    const d = manualDraft('Captura manual');
    expect(d.rows).toHaveLength(1);
    d.date = '2024-05-01';
    d.lab = '  Laboratorio a mano ';
    d.rows[0]!.analyteId = 'glucosa';
    d.rows[0]!.valueText = '5,4';
    d.rows[0]!.unit = 'mmol/l';
    d.rows.push({ ...emptyRow(), analyteId: CUSTOM, name: 'Antígeno X', valueText: 'Negativo' });
    expect(validateDraft(d)).toEqual([]);
    const { study, results } = confirmDraft(d);
    expect(study.lab).toBe('Laboratorio a mano');
    expect(results[0]).toMatchObject({ value: 5.4, unit: 'mmol/L', analyteId: 'glucosa', name: 'Glucosa' });
    expect(results[1]).toMatchObject({ value: null, valueText: 'Negativo' });
  });

  it('números capturados con coma o punto', () => {
    expect(parseInputNumber('5,6', '.')).toBe(5.6);
    expect(parseInputNumber('1.250,5', ',')).toBe(1250.5);
    expect(parseInputNumber('', '.')).toBeNull();
    expect(parseInputValue('< 0,5', '.')).toMatchObject({ value: 0.5, qualifier: '<' });
    expect(parseInputValue('', '.')).toBeNull();
  });

  it('borrador de una página escrita a mano', () => {
    const d = draftFromParsed(parseDocument([page([[[40, 'Glucosa'], [250, '92'], [330, 'mg/dL'], [420, 'Hombres 70 - 100 Mujeres 65 - 95']]])]), 'x.pdf', 'pdf', null);
    expect(d.sex).toBeNull();
    expect(d.rows[0]).toMatchObject({ lowText: '', highText: '' });
    expect(d.rows[0]!.range?.kind).toBe('bySex');
  });
});
