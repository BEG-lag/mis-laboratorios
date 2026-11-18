import { describe, expect, it } from 'vitest';
import { ANALYTE_BY_ID, conversionSpec } from '../../src/lib/analytes.ts';
import { canonicalUnit, conversionFactor, looksLikeUnit, normalizeUnit, unitKey } from '../../src/lib/units.ts';

const spec = (id: string) => ANALYTE_BY_ID.get(id)!;
const close = (a: number | null, b: number, digits = 4) => expect(a).toBeCloseTo(b, digits);

describe('reconocimiento de unidades', () => {
  it('normaliza variantes comunes', () => {
    expect(canonicalUnit('mg/dl')).toBe('mg/dL');
    expect(canonicalUnit('mg %')).toBe('mg/dL');
    expect(canonicalUnit('x10^3/uL')).toBe('x10³/µL');
    expect(canonicalUnit('x 10³/µL')).toBe('x10³/µL');
    expect(canonicalUnit('10e3/µL')).toBe('x10³/µL');
    expect(canonicalUnit('miles/mm3')).toBe('x10³/µL');
    expect(canonicalUnit('/mm³')).toBe('/µL');
    expect(canonicalUnit('uUI/mL')).toBe('µUI/mL');
    expect(canonicalUnit('μUI/ml')).toBe('µUI/mL');
    expect(canonicalUnit('mUI/L')).toBe('mUI/L');
    expect(canonicalUnit('U.I./L')).toBe('UI/L');
    expect(canonicalUnit('umol/L')).toBe('µmol/L');
    expect(canonicalUnit('mL/min/1.73 m2')).toBe('mL/min/1.73m²');
    expect(canonicalUnit('x10^12/L')).toBe('x10¹²/L');
    expect(canonicalUnit('fl')).toBe('fL');
    expect(canonicalUnit('palabra')).toBeNull();
  });
  it('acepta unidades desconocidas con forma de unidad', () => {
    expect(looksLikeUnit('UFC/mL')).toBe(true);
    expect(looksLikeUnit('mg/24h')).toBe(true);
    expect(looksLikeUnit('Hombres')).toBe(false);
    expect(normalizeUnit('  UFC/mL ')).toBe('UFC/mL');
    expect(normalizeUnit('')).toBe('');
    expect(unitKey('X10^3/µL')).toBe(unitKey('x10³/uL'));
  });
});

describe('conversiones exactas', () => {
  it('glucosa mmol/L a mg/dL con masa molar 180.16', () => {
    close(conversionFactor('mmol/L', 'mg/dL', spec('glucosa')), 18.016);
    close(conversionFactor('mg/dL', 'mmol/L', spec('glucosa')), 1 / 18.016, 6);
  });
  it('creatinina µmol/L a mg/dL', () => {
    close(conversionFactor('µmol/L', 'mg/dL', spec('creatinina')), 0.011312, 6);
    close(88 * conversionFactor('µmol/L', 'mg/dL', spec('creatinina'))!, 0.9955, 4);
  });
  it('colesterol y triglicéridos usan su propia masa molar', () => {
    close(conversionFactor('mmol/L', 'mg/dL', spec('colesterol-total')), 38.665);
    close(conversionFactor('mmol/L', 'mg/dL', spec('hdl')), 38.665);
    close(conversionFactor('mmol/L', 'mg/dL', spec('trigliceridos')), 88.543);
  });
  it('T4 libre pmol/L a ng/dL', () => {
    close(15.2 * conversionFactor('pmol/L', 'ng/dL', spec('t4-libre'))!, 1.1808, 4);
  });
  it('vitamina D y B12', () => {
    close(conversionFactor('ng/mL', 'nmol/L', spec('vitamina-d')), 2.4960, 4);
    close(conversionFactor('pg/mL', 'pmol/L', spec('vitamina-b12')), 0.7378, 4);
  });
  it('cambios de prefijo exactos', () => {
    expect(conversionFactor('g/L', 'g/dL', spec('hemoglobina'))).toBeCloseTo(0.1, 12);
    expect(conversionFactor('µg/L', 'ng/mL', spec('ferritina'))).toBeCloseTo(1, 12);
    expect(conversionFactor('mUI/L', 'µUI/mL', spec('tsh'))).toBe(1);
    expect(conversionFactor('/µL', 'x10³/µL', spec('leucocitos'))).toBeCloseTo(0.001, 12);
    expect(conversionFactor('x10⁹/L', 'x10³/µL', spec('plaquetas'))).toBe(1);
    expect(conversionFactor('x10¹²/L', 'x10⁶/µL', spec('eritrocitos'))).toBe(1);
  });
  it('equivalencias propias del analito', () => {
    expect(conversionFactor('UI/L', 'U/L', spec('alt'))).toBe(1);
    expect(conversionFactor('µkat/L', 'U/L', spec('ast'))).toBe(60);
    expect(conversionFactor('L/L', '%', spec('hematocrito'))).toBe(100);
  });
  it('mEq/L según la valencia', () => {
    expect(conversionFactor('mEq/L', 'mmol/L', spec('sodio'))).toBe(1);
    expect(conversionFactor('mEq/L', 'mmol/L', spec('calcio')!)).toBeNull();
    expect(conversionFactor('mEq/L', 'mmol/L', { unit: 'mmol/L', valence: 2 })).toBe(0.5);
    expect(conversionFactor('mmol/L', 'mEq/L', { unit: 'mEq/L', valence: 2 })).toBe(2);
  });
  it('nunca convierte sin factor exacto', () => {
    // HbA1c: % y mmol/mol se relacionan con una ecuación de regresión, no con un factor.
    expect(conversionFactor('mmol/mol', '%', spec('hba1c'))).toBeNull();
    // Masa a molar sin masa molar conocida.
    expect(conversionFactor('mg/dL', 'mmol/L', spec('albumina'))).toBeNull();
    expect(conversionFactor('mg/dL', 'mmol/L', conversionSpec('custom:algo', 'mg/dL'))).toBeNull();
    expect(conversionFactor('UFC/mL', 'mg/dL', spec('glucosa'))).toBeNull();
    // Insulina: el factor a pmol/L es convencional, no exacto.
    expect(conversionFactor('pmol/L', 'µUI/mL', spec('insulina'))).toBeNull();
  });
  it('analitos no reconocidos: sólo prefijos', () => {
    const custom = conversionSpec('custom:proteina x', 'mg/L');
    expect(conversionFactor('mg/dL', 'mg/L', custom)).toBeCloseTo(10, 12);
  });
});
