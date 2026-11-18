import { describe, expect, it } from 'vitest';
import { detectDecimal, formatValue, parseNumber, parseValueStart, roundConverted } from '../../src/lib/numbers.ts';

describe('separador decimal del documento', () => {
  it('detecta coma decimal', () => {
    expect(detectDecimal(['Glucosa 5,6 mmol/L 3,9 - 5,6', 'Creatinina 0,98'])).toBe(',');
  });
  it('detecta punto decimal', () => {
    expect(detectDecimal(['Creatinina 0.92 mg/dL 0.70 - 1.30'])).toBe('.');
  });
  it('ignora números ambiguos con tres decimales (miles)', () => {
    expect(detectDecimal(['Plaquetas 245.000 /µL', 'Hemoglobina 15,4'])).toBe(',');
    expect(detectDecimal(['Leucocitos 6,500'])).toBe('.');
  });
});

describe('parseNumber', () => {
  it('lee punto y coma decimal', () => {
    expect(parseNumber('0.92', '.')).toEqual({ value: 0.92, decimals: 2 });
    expect(parseNumber('5,6', ',')).toEqual({ value: 5.6, decimals: 1 });
    expect(parseNumber('5,6', '.')).toEqual({ value: 5.6, decimals: 1 });
  });
  it('separadores de miles según el documento', () => {
    expect(parseNumber('250,000', '.')?.value).toBe(250000);
    expect(parseNumber('6,500', '.')?.value).toBe(6500);
    expect(parseNumber('245.000', ',')?.value).toBe(245000);
    expect(parseNumber('1.234,5', ',')?.value).toBe(1234.5);
  });
  it('rechaza lo que no es número', () => {
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('12.')).toBeNull();
    expect(parseNumber('1.2.3.4,5', '.')).toBeNull();
  });
});

describe('parseValueStart', () => {
  it('valor simple con resto', () => {
    expect(parseValueStart('98 mg/dL', '.')).toMatchObject({ value: 98, decimals: 0, qualifier: null, rest: 'mg/dL' });
  });
  it('calificadores < y >', () => {
    expect(parseValueStart('<0.3', '.')).toMatchObject({ value: 0.3, qualifier: '<' });
    expect(parseValueStart('> 90', '.')).toMatchObject({ value: 90, qualifier: '>' });
    expect(parseValueStart('<= 5', '.')).toMatchObject({ value: 5, qualifier: '<=' });
    expect(parseValueStart('menor de 0.5', '.')).toMatchObject({ value: 0.5, qualifier: '<' });
  });
  it('marcas pegadas', () => {
    expect(parseValueStart('215*', '.')).toMatchObject({ value: 215, rest: '*' });
    expect(parseValueStart('*215', '.')).toMatchObject({ value: 215, prefixFlag: '*' });
    expect(parseValueStart('↑ 7,1', ',')).toMatchObject({ value: 7.1, prefixFlag: '↑' });
    expect(parseValueStart('7,1 H', ',')).toMatchObject({ value: 7.1, rest: 'H' });
  });
  it('no confunde nombres que empiezan con número', () => {
    expect(parseValueStart('25OH vitamina', '.')).toBeNull();
    expect(parseValueStart('Glucosa', '.')).toBeNull();
  });
});

describe('formato', () => {
  it('conserva los decimales del laboratorio', () => {
    expect(formatValue(0.9, 2, 'en')).toBe('0.90');
    expect(formatValue(1250, 0, 'es')).toBe('1,250');
  });
  it('redondea valores convertidos a cuatro cifras significativas', () => {
    expect(roundConverted(100.8896)).toEqual({ value: 100.9, decimals: 1 });
    expect(roundConverted(0.99547)).toEqual({ value: 0.9955, decimals: 4 });
    expect(roundConverted(0)).toEqual({ value: 0, decimals: 0 });
  });
});

describe('formato de fechas, resultados y rangos', async () => {
  const { formatBand, formatDate, formatNumber, formatResult, monthYear, todayIso } = await import('../../src/lib/format.ts');
  it('fechas', () => {
    expect(formatDate('2025-03-14', 'es')).toBe('14 mar 2025');
    expect(formatDate('2025-03-14', 'en')).toBe('Mar 14, 2025');
    expect(formatDate('', 'es')).toBe('-');
    expect(monthYear(Date.UTC(2024, 9, 1), 'es')).toBe('oct 2024');
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('resultados con calificador y cualitativos', () => {
    expect(formatResult(0.3, 1, '<', '<0.3', 'en')).toBe('< 0.3');
    expect(formatResult(60, 0, '>=', '>=60', 'en')).toBe('≥ 60');
    expect(formatResult(null, 0, null, 'Negativo', 'es')).toBe('Negativo');
    expect(formatNumber(1234.567, 'en')).toBe('1,234.57');
  });
  it('rangos', () => {
    expect(formatBand(70, 100, true, true, 'en')).toBe('70 - 100');
    expect(formatBand(null, 200, true, false, 'en')).toBe('< 200');
    expect(formatBand(null, 150, true, true, 'en')).toBe('≤ 150');
    expect(formatBand(40, null, false, true, 'en')).toBe('> 40');
    expect(formatBand(60, null, true, true, 'en')).toBe('≥ 60');
    expect(formatBand(null, null, true, true, 'en')).toBe('');
  });
});
