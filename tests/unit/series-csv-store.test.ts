import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { csvCell, seriesToCsv } from '../../src/lib/csv.ts';
import { parseDocument } from '../../src/lib/extract.ts';
import { allKeys, setLang, t } from '../../src/lib/i18n.ts';
import { confirmDraft, draftFromParsed } from '../../src/lib/review.ts';
import { applyFilters, buildSeries, labKey, labsOf, NO_FILTERS } from '../../src/lib/series.ts';
import { DB_NAME, hasSaved, loadState, saveState, wipeState } from '../../src/lib/store.ts';
import { REPORTS, reportPages } from '../../src/lib/synthetic.ts';
import type { LabResult, Study } from '../../src/lib/types.ts';

function history(): { studies: Study[]; results: LabResult[] } {
  const studies: Study[] = [];
  const results: LabResult[] = [];
  for (const rep of REPORTS) {
    const { study, results: rs } = confirmDraft(draftFromParsed(parseDocument(reportPages(rep)), rep.file, 'demo', null));
    studies.push(study);
    results.push(...rs);
  }
  return { studies, results };
}

const H = history();

describe('series para graficar', () => {
  const series = buildSeries(H.results, H.studies, 'es');
  const find = (key: string) => series.find((s) => s.key === key)!;

  it('glucosa: convierte mmol/L a mg/dL con factor exacto', () => {
    const glu = find('glucosa|mg/dL');
    expect(glu.points).toHaveLength(7);
    const conv = glu.points.find((p) => p.converted)!;
    expect(conv.date).toBe('2021-08-22');
    expect(conv.value).toBeCloseTo(100.9, 1);
    expect(conv.low).toBeCloseTo(70.26, 2);
    expect(conv.high).toBeCloseTo(100.9, 1);
    expect(conv.converted).toMatchObject({ fromUnit: 'mmol/L', original: '5,6' });
    expect(glu.rangesDiffer).toBe(true);
    expect(glu.labs).toHaveLength(4);
  });

  it('cada punto conserva el rango de su laboratorio y se compara contra él', () => {
    const glu = find('glucosa|mg/dL');
    const y2023 = glu.points.find((p) => p.date === '2023-10-03')!;
    expect(y2023).toMatchObject({ value: 108, low: 74, high: 106, status: 'high' });
    const y2022 = glu.points.find((p) => p.date === '2022-11-05')!;
    expect(y2022).toMatchObject({ value: 104, status: 'in' });
  });

  it('HbA1c en % y en mmol/mol: series separadas, nunca mezcladas', () => {
    const pct = find('hba1c|%');
    const mmol = find('hba1c|mmol/mol');
    expect(pct.points.map((p) => p.date)).toEqual(['2021-08-22', '2022-11-05', '2023-10-03', '2026-06-09']);
    expect(mmol.points).toHaveLength(1);
    expect(pct.siblings).toEqual(['hba1c|mmol/mol']);
    // Las categorías del laboratorio no dan banda ni comparación.
    expect(pct.points.find((p) => p.date === '2022-11-05')).toMatchObject({ low: null, high: null, status: null });
  });

  it('conteos y unidades equivalentes', () => {
    const leu = find('leucocitos|x10³/µL');
    expect(leu.points.find((p) => p.date === '2021-08-22')).toMatchObject({ value: 6.8, low: 4.5, high: 11 });
    expect(leu.points.find((p) => p.date === '2025-02-17')).toMatchObject({ value: 5.9 });
    const hto = find('hematocrito|%');
    expect(hto.points.find((p) => p.date === '2025-02-17')).toMatchObject({ value: 45, low: 40, high: 52 });
    const crea = find('creatinina|mg/dL');
    expect(crea.points.find((p) => p.date === '2025-02-17')!.value).toBeCloseTo(0.9955, 4);
  });

  it('valores con calificador', () => {
    const pcr = find('pcr|mg/L');
    expect(pcr.points[0]).toMatchObject({ qualifier: '<', value: 0.3, status: 'in' });
  });

  it('filtros por fecha y laboratorio', () => {
    const lab = labKey('Laboratorio Demo Norte');
    const filtered = applyFilters(H.results, H.studies, { from: '2022-01-01', to: '2023-12-31', lab });
    const s = buildSeries(filtered, H.studies, 'es');
    expect(s.find((x) => x.key === 'glucosa|mg/dL')!.points.map((p) => p.value)).toEqual([104, 108]);
    expect(applyFilters(H.results, H.studies, NO_FILTERS)).toHaveLength(H.results.length);
    expect(labsOf(H.studies).map((l) => l.name)).toContain('Centro de Diagnóstico Prueba');
    expect(labKey('Laboratorio Ejemplo, S.A. de C.V.')).toBe('laboratorio ejemplo');
    expect(labKey('')).toBe('sin-laboratorio');
  });

  it('nombres en inglés', () => {
    expect(buildSeries(H.results, H.studies, 'en').find((s) => s.key === 'glucosa|mg/dL')!.name).toBe('Glucose');
  });
});

describe('CSV', () => {
  const series = buildSeries(H.results, H.studies, 'es');
  it('encabezados, valores originales y convertidos', () => {
    const csv = seriesToCsv(series, 'es');
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe(
      'fecha,laboratorio,analito_id,analito,nombre_impreso,valor,calificador,unidad,ref_min,ref_max,ref_texto,vs_rango_laboratorio,marca_laboratorio,metodo,valor_en_unidad_grafica,unidad_grafica,archivo,pagina,origen',
    );
    expect(lines).toHaveLength(H.results.length + 1);
    const glu = lines.find((l) => l.startsWith('2021-08-22') && l.includes(',glucosa,'))!;
    expect(glu).toContain(',5.6,,mmol/L,3.9,5.6,');
    expect(glu).toContain(',100.9,mg/dL,');
    expect(csv.startsWith('﻿')).toBe(false);
    expect(seriesToCsv(series, 'en', { excel: true }).startsWith('﻿date,lab')).toBe(true);
  });
  it('escapa comas, comillas y fórmulas', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
    expect(csvCell('=SUMA(A1)')).toBe("'=SUMA(A1)");
    expect(csvCell('-5', false)).toBe('-5');
    expect(csvCell(null)).toBe('');
  });
});

describe('almacenamiento opcional (IndexedDB)', () => {
  it('no existe hasta que se guarda; se borra completo', async () => {
    expect(await hasSaved()).toBe(false);
    expect(await loadState()).toBeNull();
    await saveState({ version: 1, savedAt: '2026-01-01T00:00:00Z', studies: H.studies, results: H.results, settings: { lang: 'en' } });
    expect(await hasSaved()).toBe(true);
    const loaded = await loadState();
    expect(loaded?.studies).toHaveLength(H.studies.length);
    expect(loaded?.results).toHaveLength(H.results.length);
    expect(loaded?.settings.lang).toBe('en');
    expect((await indexedDB.databases()).map((d) => d.name)).toContain(DB_NAME);
    await wipeState();
    expect(await hasSaved()).toBe(false);
    expect((await indexedDB.databases()).map((d) => d.name)).not.toContain(DB_NAME);
  });
});

describe('textos', () => {
  it('español e inglés tienen las mismas claves', () => {
    expect(allKeys('en').sort()).toEqual(allKeys('es').sort());
  });
  it('el aviso médico es el acordado', () => {
    setLang('es');
    expect(t('disclaimer.body')).toBe('Organiza y grafica tus resultados. No interpreta, no diagnostica y no sustituye a tu médico.');
    expect(t('review.found', { count: 3 })).toBe('3 resultado(s) encontrados');
    expect(t('clave.inexistente')).toBe('clave.inexistente');
    setLang('en');
    expect(t('tabs.dashboard')).toBe('Dashboard');
    setLang('es');
  });
  it('sin palabras de interpretación médica en la interfaz', () => {
    const banned = /\b(normal|anormal|sano|saludable|enfermedad|riesgo|diagn[oó]stico de|deber[ií]as|recomendamos|preocup|grave|peligro)\b/i;
    for (const lang of ['es', 'en'] as const) {
      for (const key of allKeys(lang)) {
        if (key === 'disclaimer.body' || key.startsWith('footer.')) continue;
        expect(t(key, undefined, lang), `${lang}:${key}`).not.toMatch(banned);
      }
    }
  });
});
