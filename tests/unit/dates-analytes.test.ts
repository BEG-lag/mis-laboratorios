import { describe, expect, it } from 'vitest';
import { ANALYTES, analyteName, customId, methodOf, resolveAnalyte } from '../../src/lib/analytes.ts';
import { findStudyDate, parseDate } from '../../src/lib/dates.ts';
import { normalizeName } from '../../src/lib/text.ts';

describe('fechas', () => {
  it('formatos de México (día primero)', () => {
    expect(parseDate('14/03/2024')).toBe('2024-03-14');
    expect(parseDate('14-03-24')).toBe('2024-03-14');
    expect(parseDate('14.03.2024')).toBe('2024-03-14');
    expect(parseDate('2024-03-14')).toBe('2024-03-14');
    expect(parseDate('14-mar-2024')).toBe('2024-03-14');
    expect(parseDate('17-FEB-2025')).toBe('2025-02-17');
    expect(parseDate('05 de noviembre de 2022')).toBe('2022-11-05');
    expect(parseDate('3 de sept. de 2021')).toBe('2021-09-03');
  });
  it('rechaza fechas imposibles', () => {
    expect(parseDate('31/02/2024')).toBeNull();
    expect(parseDate('14/13/2024')).toBeNull();
    expect(parseDate('sin fecha')).toBeNull();
  });
  it('prioriza la toma de muestra y nunca usa la fecha de nacimiento', () => {
    const lines = ['Paciente: X\tFecha de nacimiento: 12/05/1978', 'Fecha de impresión: 15/03/2019', 'Médico: Y\tFecha de toma: 14/03/2019'];
    expect(findStudyDate(lines)).toMatchObject({ date: '2019-03-14', label: 'toma de muestra' });
    expect(findStudyDate(['Fecha de nacimiento: 12/05/1978'])).toBeNull();
    expect(findStudyDate(['Fecha de recepción: 22-ago-2021', 'Fecha de emisión: 23-ago-2021'])).toMatchObject({ date: '2021-08-22', label: 'recepción' });
    expect(findStudyDate(['Fecha: 01/02/2023'])).toMatchObject({ date: '2023-02-01', label: 'fecha' });
  });
});

describe('diccionario de analitos', () => {
  it('sinónimos frecuentes', () => {
    const cases: [string, string][] = [
      ['Glucosa en ayunas', 'glucosa'],
      ['GLUCOSA SÉRICA', 'glucosa'],
      ['Colesterol', 'colesterol-total'],
      ['Colesterol HDL', 'hdl'],
      ['C-HDL', 'hdl'],
      ['Colesterol LDL (calculado)', 'ldl'],
      ['LDL directo', 'ldl'],
      ['Triglicéridos', 'trigliceridos'],
      ['Hemoglobina glucosilada (HbA1c)', 'hba1c'],
      ['HbA1c', 'hba1c'],
      ['Creatinina sérica', 'creatinina'],
      ['Nitrógeno ureico (BUN)', 'bun'],
      ['BUN', 'bun'],
      ['Urea', 'urea'],
      ['Ácido úrico', 'acido-urico'],
      ['TGO (AST)', 'ast'],
      ['TGO / AST', 'ast'],
      ['Aspartato aminotransferasa', 'ast'],
      ['TGP', 'alt'],
      ['Alanina aminotransferasa (ALT)', 'alt'],
      ['Gamma glutamil transferasa', 'ggt'],
      ['GGT', 'ggt'],
      ['TSH', 'tsh'],
      ['Hormona estimulante de tiroides', 'tsh'],
      ['T4 libre', 't4-libre'],
      ['Vitamina D 25-OH', 'vitamina-d'],
      ['25-OH Vitamina D', 'vitamina-d'],
      ['Vitamina B12', 'vitamina-b12'],
      ['Ferritina', 'ferritina'],
      ['Hemoglobina', 'hemoglobina'],
      ['Hematocrito', 'hematocrito'],
      ['Leucocitos', 'leucocitos'],
      ['Plaquetas', 'plaquetas'],
      ['Antígeno prostático específico total', 'psa'],
      ['PSA total', 'psa'],
      ['VCM', 'vcm'],
      ['CMHC', 'cmhc'],
      ['ADE', 'rdw'],
      ['Tasa de filtración glomerular estimada', 'tfg'],
      ['PCR ultrasensible', 'pcr'],
    ];
    for (const [printed, id] of cases) expect(resolveAnalyte(printed), printed).toBe(id);
  });
  it('porcentaje o absolutos según la unidad', () => {
    expect(resolveAnalyte('Neutrófilos', '%')).toBe('neutrofilos-pct');
    expect(resolveAnalyte('Neutrófilos', 'x10³/µL')).toBe('neutrofilos-abs');
    expect(resolveAnalyte('Neutrófilos #', '')).toBe('neutrofilos-abs');
    expect(resolveAnalyte('Linfocitos %', '')).toBe('linfocitos-pct');
  });
  it('no confunde analitos parecidos', () => {
    expect(resolveAnalyte('Hemoglobina corpuscular media')).toBe('hcm');
    expect(resolveAnalyte('Glucosa postprandial')).toBeNull();
    expect(resolveAnalyte('Proteína X inventada')).toBeNull();
  });
  it('no mapea secciones de orina a analitos de sangre', () => {
    expect(resolveAnalyte('Glucosa', 'mg/dL', 'EXAMEN GENERAL DE ORINA')).toBeNull();
  });
  it('método de LDL', () => {
    expect(methodOf('Colesterol LDL directo')).toBe('directo');
    expect(methodOf('LDL (Friedewald)')).toBe('calculado');
    expect(methodOf('Colesterol LDL')).toBeNull();
  });
  it('nombres y claves', () => {
    expect(analyteName('glucosa', 'en')).toBe('Glucose');
    expect(analyteName('custom:proteina x', 'es', 'Proteína X')).toBe('Proteína X');
    expect(analyteName('custom:proteina x', 'es')).toBe('proteina x');
    expect(customId('Proteína X')).toBe('custom:proteina x');
    expect(customId('***')).toBe('custom:sin-nombre');
  });
  it('cada analito tiene unidad canónica y sinónimos sin duplicados internos', () => {
    for (const a of ANALYTES) {
      expect(typeof a.unit).toBe('string');
      const keys = a.synonyms.map(normalizeName);
      expect(new Set(keys).size, a.id).toBe(keys.length);
    }
  });
});
