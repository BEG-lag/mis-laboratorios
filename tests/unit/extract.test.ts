import { describe, expect, it } from 'vitest';
import { extractMeta, parseDocument, reparseRange } from '../../src/lib/extract.ts';
import { fixOcrToken, groupLines, lineText, ocrWordsToPage } from '../../src/lib/layout.ts';
import { expectedValues, REPORTS, reportPages } from '../../src/lib/synthetic.ts';
import { page } from './helpers.ts';

const byFile = (needle: string) => REPORTS.find((r) => r.file.includes(needle))!;

describe('maquetas sintéticas (texto en memoria)', () => {
  for (const rep of REPORTS) {
    it(`${rep.layout}: ${rep.file}`, () => {
      const doc = parseDocument(reportPages(rep));
      const expected = expectedValues(rep);
      expect(doc.rows).toHaveLength(expected.length);
      expect(doc.meta.date).toBe(rep.date);
      expect(doc.meta.sex).toBe('M');
      expect(doc.rows.every((r) => r.analyteId !== null)).toBe(true);
      // Cada valor coincide con lo impreso (sin marcas).
      const printed = expected.map((e) => e.value.replace(/[*\sHL]+$/g, '').replace(/^</, ''));
      expect(doc.rows.map((r) => r.valueText.replace(/^</, '')).sort()).toEqual(printed.sort());
    });
  }
});

describe('maqueta clásica', () => {
  const doc = parseDocument(reportPages(byFile('2019-03')));
  it('metadatos', () => {
    expect(doc.meta).toMatchObject({ lab: 'LABORATORIO CLÍNICO EJEMPLO', date: '2019-03-14', dateLabel: 'toma de muestra', sex: 'M', age: 40, patient: 'Paciente de Ejemplo' });
    expect(doc.decimal).toBe('.');
  });
  it('rango por sexo en dos renglones', () => {
    const hb = doc.rows.find((r) => r.analyteId === 'hemoglobina')!;
    expect(hb.range).toMatchObject({ low: 13.5, high: 17.5, label: 'Hombres' });
    expect(hb.snippet).toContain('Mujeres: 12.0 - 15.5');
  });
  it('rangos de un solo lado', () => {
    expect(doc.rows.find((r) => r.analyteId === 'colesterol-total')!.range).toMatchObject({ kind: 'upper', high: 200, highInclusive: false });
    expect(doc.rows.find((r) => r.analyteId === 'hdl')!.range).toMatchObject({ kind: 'lower', low: 40 });
    expect(doc.rows.find((r) => r.analyteId === 'ast')!.range).toMatchObject({ kind: 'upper', high: 40, highInclusive: true });
  });
  it('método de LDL', () => {
    expect(doc.rows.find((r) => r.analyteId === 'ldl')!.method).toBe('calculado');
  });
  it('marca en columna aparte', () => {
    const d2 = parseDocument(reportPages(byFile('2020-09')));
    expect(d2.rows.find((r) => r.analyteId === 'acido-urico')).toMatchObject({ flag: 'high', flagRaw: 'H' });
  });
});

describe('maqueta con coma decimal y dos páginas', () => {
  const doc = parseDocument(reportPages(byFile('2021-08')));
  it('coma decimal y miles con punto', () => {
    expect(doc.decimal).toBe(',');
    expect(doc.rows.find((r) => r.analyteId === 'glucosa')).toMatchObject({ value: 5.6, unit: 'mmol/L' });
    expect(doc.rows.find((r) => r.analyteId === 'plaquetas')).toMatchObject({ value: 245000, unit: '/µL' });
    expect(doc.rows.find((r) => r.analyteId === 'leucocitos')!.range).toMatchObject({ low: 4500, high: 11000 });
  });
  it('rango antes de la unidad y marca pegada al valor', () => {
    expect(doc.rows.find((r) => r.analyteId === 'colesterol-total')).toMatchObject({ value: 212, flag: 'high', unit: 'mg/dL' });
    expect(doc.rows.find((r) => r.analyteId === 'colesterol-total')!.range).toMatchObject({ high: 200, highInclusive: false });
    expect(doc.rows.find((r) => r.analyteId === 'trigliceridos')!.range).toMatchObject({ high: 150, highInclusive: true });
  });
  it('rango por sexo con letras H/M en un renglón', () => {
    expect(doc.rows.find((r) => r.analyteId === 'acido-urico')!.range).toMatchObject({ low: 3.4, high: 7, label: 'H' });
  });
  it('lee la segunda página', () => {
    expect(doc.pages).toBe(2);
    expect(doc.rows.filter((r) => r.page === 2).map((r) => r.analyteId)).toEqual(['hemoglobina', 'hematocrito', 'leucocitos', 'plaquetas', 'ferritina']);
  });
});

describe('maqueta con resultado anterior', () => {
  const doc = parseDocument(reportPages(byFile('2022-11')));
  it('ignora la columna de resultado anterior', () => {
    expect(doc.rows.find((r) => r.analyteId === 'glucosa')).toMatchObject({ value: 104, unit: 'mg/dL' });
    expect(doc.rows.find((r) => r.analyteId === 'glucosa')!.range).toMatchObject({ low: 74, high: 106 });
    expect(doc.rows.find((r) => r.analyteId === 'colesterol-total')).toMatchObject({ value: 225, flag: 'flag', flagRaw: '*' });
  });
  it('categorías en varios renglones: sin banda', () => {
    const hba1c = doc.rows.find((r) => r.analyteId === 'hba1c')!;
    expect(hba1c.range?.kind).toBe('categories');
    expect(hba1c.range?.text).toContain('Prediabetes');
    expect(doc.rows.find((r) => r.analyteId === 'vitamina-d')!.range?.kind).toBe('categories');
    expect(doc.rows.find((r) => r.analyteId === 'ldl')).toMatchObject({ method: 'directo' });
  });
  it('fecha escrita con palabras', () => {
    expect(doc.meta.date).toBe('2022-11-05');
  });
});

describe('maqueta en dos columnas', () => {
  const doc = parseDocument(reportPages(byFile('2025-02')));
  it('separa las tablas lado a lado', () => {
    const ids = doc.rows.map((r) => r.analyteId);
    expect(ids).toContain('neutrofilos-pct');
    expect(ids).toContain('neutrofilos-abs');
    expect(doc.rows.find((r) => r.analyteId === 'leucocitos')).toMatchObject({ value: 5.9, unit: 'x10⁹/L' });
    expect(doc.rows.find((r) => r.analyteId === 'eritrocitos')).toMatchObject({ value: 5.1, unit: 'x10¹²/L' });
  });
  it('marca al final y calificador en el valor', () => {
    expect(doc.rows.find((r) => r.analyteId === 'glucosa')).toMatchObject({ value: 101, flag: 'high' });
    expect(doc.rows.find((r) => r.analyteId === 'pcr')).toMatchObject({ value: 0.3, qualifier: '<' });
    expect(doc.rows.find((r) => r.analyteId === 'hba1c')).toMatchObject({ value: 39, unit: 'mmol/mol' });
  });
});

describe('casos sueltos', () => {
  it('nombre y valor en la misma celda', () => {
    const doc = parseDocument([page([[[40, 'Glucosa: 98 mg/dL (70 - 100)']], [[40, 'Vitamina D 25 OH 31.4 ng/mL 30 - 100']]])]);
    expect(doc.rows[0]).toMatchObject({ analyteId: 'glucosa', value: 98, unit: 'mg/dL' });
    expect(doc.rows[0]!.range).toMatchObject({ low: 70, high: 100 });
    expect(doc.rows[1]).toMatchObject({ analyteId: 'vitamina-d', value: 31.4 });
  });
  it('analito no reconocido con unidad y rango se conserva', () => {
    const doc = parseDocument([page([[[40, 'Proteína inventada'], [250, '12.5'], [330, 'mg/L'], [420, '5 - 20']]])]);
    expect(doc.rows[0]).toMatchObject({ analyteId: null, name: 'Proteína inventada', value: 12.5, unit: 'mg/L' });
  });
  it('descarta renglones que no son resultados', () => {
    const doc = parseDocument([
      page([
        [[40, 'Folio: 12345']],
        [[40, 'Edad: 45 años'], [200, 'Sexo: F']],
        [[40, 'Página 1 de 2']],
        [[40, 'Cédula profesional 1234567']],
        [[40, 'Método: enzimático 2 pasos']],
        [[40, 'Teléfono 55 1234 5678']],
      ]),
    ]);
    expect(doc.rows).toEqual([]);
    expect(doc.meta.sex).toBe('F');
    expect(doc.meta.age).toBe(45);
  });
  it('resultados cualitativos sólo para analitos conocidos', () => {
    const doc = parseDocument([page([[[40, 'Glucosa'], [250, 'Negativo'], [420, 'Negativo']], [[40, 'Antígeno raro'], [250, 'Negativo'], [420, 'Negativo']]])]);
    expect(doc.rows).toHaveLength(1);
    expect(doc.rows[0]).toMatchObject({ analyteId: 'glucosa', value: null, valueText: 'Negativo' });
  });
  it('sección de orina: no se mapea a sangre', () => {
    const doc = parseDocument([page([[[40, 'EXAMEN GENERAL DE ORINA']], [[40, 'Glucosa'], [250, '15'], [330, 'mg/dL'], [420, 'Hasta 15']]])]);
    expect(doc.rows[0]).toMatchObject({ analyteId: null, section: 'EXAMEN GENERAL DE ORINA' });
  });
  it('signos tipográficos y guiones largos en rangos', () => {
    const dash = String.fromCharCode(0x2014);
    const doc = parseDocument([page([[[40, 'Glucosa'], [250, '92'], [330, 'mg/dL'], [420, `70 ${dash} 100`]], [[40, 'HbA1c'], [250, '5.4'], [330, '%'], [420, '≤ 5.6']]])]);
    expect(doc.rows[0]!.range).toMatchObject({ low: 70, high: 100 });
    expect(doc.rows[1]!.range).toMatchObject({ high: 5.6, highInclusive: true });
  });
  it('vuelve a leer un rango con otro sexo', () => {
    const doc = parseDocument(reportPages(byFile('2019-03')));
    const hb = doc.rows.find((r) => r.analyteId === 'hemoglobina')!;
    expect(reparseRange(hb.range, { sex: 'F', age: 40, decimal: '.' })).toMatchObject({ low: 12, high: 15.5 });
    expect(reparseRange(null, { sex: 'F', age: 40, decimal: '.' })).toBeNull();
  });
  it('opciones de sexo y edad sobrescriben el reporte', () => {
    const doc = parseDocument(reportPages(byFile('2019-03')), { sex: 'F', age: 30 });
    expect(doc.meta).toMatchObject({ sex: 'F', age: 30 });
    expect(doc.rows.find((r) => r.analyteId === 'hemoglobina')!.range).toMatchObject({ low: 12, high: 15.5 });
  });
  it('metadatos sin datos', () => {
    expect(extractMeta([])).toEqual({ lab: '', date: null, dateLabel: '', sex: null, age: null, patient: '' });
  });
});

describe('renglones y celdas', () => {
  it('agrupa por altura y separa columnas', () => {
    const lines = groupLines([
      { text: 'Glucosa', x: 40, y: 100, width: 30, size: 9 },
      { text: 'en ayunas', x: 72, y: 100.5, width: 40, size: 9 },
      { text: '92', x: 250, y: 100, width: 10, size: 9 },
      { text: 'Urea', x: 40, y: 114, width: 20, size: 9 },
      { text: ' ', x: 70, y: 114, width: 3, size: 9 },
    ]);
    expect(lines.map(lineText)).toEqual(['Glucosa en ayunas\t92', 'Urea']);
  });
  it('corrige letras dentro de números del OCR', () => {
    expect(fixOcrToken('1O0')).toBe('100');
    expect(fixOcrToken('0.9l')).toBe('0.91');
    expect(fixOcrToken('Glucosa')).toBe('Glucosa');
    expect(fixOcrToken('mg/dL')).toBe('mg/dL');
  });
  it('palabras de OCR a renglones', () => {
    const p = ocrWordsToPage(
      [
        { text: 'Glucosa', bbox: { x0: 100, y0: 500, x1: 220, y1: 525 }, confidence: 95 },
        { text: '95', bbox: { x0: 625, y0: 501, x1: 660, y1: 524 }, confidence: 96 },
        { text: 'mg/dL', bbox: { x0: 800, y0: 500, x1: 880, y1: 526 }, confidence: 90 },
        { text: '~~', bbox: { x0: 900, y0: 500, x1: 910, y1: 526 }, confidence: 5 },
      ],
      1,
      1530,
      1980,
    );
    expect(p.lines).toHaveLength(1);
    expect(p.lines[0]!.cells.map((c) => c.text)).toEqual(['Glucosa', '95', 'mg/dL']);
  });
});
