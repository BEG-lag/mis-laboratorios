import { describe, expect, it } from 'vitest';
import { compareToRange, hasBand, manualRange, parseRange, type RangeContext } from '../../src/lib/ranges.ts';

const M: RangeContext = { sex: 'M', age: 45, decimal: '.' };
const F: RangeContext = { sex: 'F', age: 45, decimal: '.' };
const NONE: RangeContext = { sex: null, age: null, decimal: '.' };

describe('formas de rango', () => {
  it('intervalo con guion, "a" y guiones tipográficos', () => {
    expect(parseRange('70 - 100', M)).toMatchObject({ kind: 'interval', low: 70, high: 100 });
    expect(parseRange('70-100', M)).toMatchObject({ low: 70, high: 100 });
    expect(parseRange('70 a 100', M)).toMatchObject({ low: 70, high: 100 });
    expect(parseRange('70 – 100', M)).toMatchObject({ low: 70, high: 100 });
    // Guion largo escrito por código (este archivo no lo contiene).
    expect(parseRange(`70 ${String.fromCharCode(0x2014)} 100`, M)).toMatchObject({ low: 70, high: 100 });
    expect(parseRange('(70 - 100)', M)).toMatchObject({ low: 70, high: 100 });
  });
  it('coma decimal y miles', () => {
    expect(parseRange('3,9 - 5,6', { ...M, decimal: ',' })).toMatchObject({ low: 3.9, high: 5.6 });
    expect(parseRange('150.000 - 450.000', { ...M, decimal: ',' })).toMatchObject({ low: 150000, high: 450000 });
    expect(parseRange('150,000 - 450,000', M)).toMatchObject({ low: 150000, high: 450000 });
  });
  it('límites superiores', () => {
    expect(parseRange('< 200', M)).toMatchObject({ kind: 'upper', high: 200, highInclusive: false, low: null });
    expect(parseRange('Menor de 200', M)).toMatchObject({ kind: 'upper', high: 200, highInclusive: false });
    expect(parseRange('Hasta 150', M)).toMatchObject({ kind: 'upper', high: 150, highInclusive: true });
    expect(parseRange('<= 5.7', M)).toMatchObject({ high: 5.7, highInclusive: true });
    expect(parseRange('≤ 5.7', M)).toMatchObject({ high: 5.7, highInclusive: true });
    expect(parseRange('Inferior a 40', M)).toMatchObject({ high: 40, highInclusive: false });
  });
  it('límites inferiores', () => {
    expect(parseRange('> 40', M)).toMatchObject({ kind: 'lower', low: 40, lowInclusive: false });
    expect(parseRange('Mayor de 40', M)).toMatchObject({ low: 40, lowInclusive: false });
    expect(parseRange('Mayor o igual a 60', M)).toMatchObject({ low: 60, lowInclusive: true });
    expect(parseRange('≥ 60', M)).toMatchObject({ low: 60, lowInclusive: true });
    expect(parseRange('Desde 30', M)).toMatchObject({ low: 30, lowInclusive: true });
  });
  it('unidad dentro del rango', () => {
    expect(parseRange('70 - 100 mg/dL', M)).toMatchObject({ low: 70, high: 100, unit: 'mg/dL' });
    expect(parseRange('> 60 mL/min/1.73 m2', M)).toMatchObject({ low: 60, unit: 'mL/min/1.73m²' });
  });
  it('rango en dos unidades: usa el de la unidad del resultado', () => {
    const text = '70 - 100 mg/dL (3.9 - 5.6 mmol/L)';
    expect(parseRange(text, { ...M, unit: 'mmol/L' })).toMatchObject({ low: 3.9, high: 5.6, unit: 'mmol/L' });
    expect(parseRange(text, { ...M, unit: 'mg/dL' })).toMatchObject({ low: 70, high: 100, unit: 'mg/dL' });
  });
  it('cualitativo y vacío', () => {
    expect(parseRange('Negativo', M)).toMatchObject({ kind: 'qualitative', low: null, high: null });
    expect(parseRange('', M).kind).toBe('none');
    expect(parseRange('mg/dL', M)).toMatchObject({ kind: 'none', unit: 'mg/dL' });
  });
});

describe('rangos por sexo', () => {
  const text = 'Hombres: 13.5 - 17.5 ; Mujeres: 12.0 - 15.5';
  it('elige según el sexo del reporte', () => {
    expect(parseRange(text, M)).toMatchObject({ low: 13.5, high: 17.5, label: 'Hombres' });
    expect(parseRange(text, F)).toMatchObject({ low: 12, high: 15.5, label: 'Mujeres' });
  });
  it('sin sexo no elige', () => {
    expect(parseRange(text, NONE)).toMatchObject({ kind: 'bySex', low: null, high: null });
  });
  it('letras H/M y M/F', () => {
    expect(parseRange('H: 3,4 - 7,0 / M: 2,4 - 5,7', { ...M, decimal: ',' })).toMatchObject({ low: 3.4, high: 7 });
    expect(parseRange('H: 3,4 - 7,0 / M: 2,4 - 5,7', { ...F, decimal: ',' })).toMatchObject({ low: 2.4, high: 5.7 });
    expect(parseRange('M: 0.7 - 1.3 F: 0.5 - 1.1', M)).toMatchObject({ low: 0.7, high: 1.3 });
    expect(parseRange('M: 0.7 - 1.3 F: 0.5 - 1.1', F)).toMatchObject({ low: 0.5, high: 1.1 });
    expect(parseRange('Masculino 30 - 400 Femenino 13 - 150', F)).toMatchObject({ low: 13, high: 150 });
  });
});

describe('rangos por edad', () => {
  it('elige por la edad del reporte', () => {
    const text = 'Adultos: 0.7 - 1.3 Niños: 0.3 - 0.7';
    expect(parseRange(text, M)).toMatchObject({ low: 0.7, high: 1.3, label: 'Adultos' });
    expect(parseRange(text, { ...M, age: 8 })).toMatchObject({ low: 0.3, high: 0.7 });
    expect(parseRange(text, { ...M, age: null })).toMatchObject({ kind: 'byAge' });
  });
  it('edades numéricas como etiqueta', () => {
    const text = '18 - 49 años: 0.40 - 4.00 ; 50 - 99 años: 0.50 - 5.00';
    expect(parseRange(text, M)).toMatchObject({ low: 0.4, high: 4 });
    expect(parseRange(text, { ...M, age: 60 })).toMatchObject({ low: 0.5, high: 5 });
  });
});

describe('categorías del laboratorio', () => {
  it('no elige ninguna', () => {
    const hba1c = parseRange('No diabético: < 5.7 ; Prediabetes: 5.7 - 6.4 ; Diabetes: >= 6.5', M);
    expect(hba1c.kind).toBe('categories');
    expect(hasBand(hba1c)).toBe(false);
    const vitD = parseRange('Deficiencia: < 20 Insuficiencia: 20 - 29 Suficiencia: 30 - 100', M);
    expect(vitD.kind).toBe('categories');
  });
  it('una sola categoría sí es el rango del laboratorio', () => {
    expect(parseRange('Deseable: < 200', M)).toMatchObject({ kind: 'upper', high: 200, label: 'Deseable' });
  });
});

describe('comparación contra el rango del laboratorio', () => {
  const r = parseRange('70 - 100', M);
  it('dentro, arriba y abajo', () => {
    expect(compareToRange(85, null, r)).toBe('in');
    expect(compareToRange(100, null, r)).toBe('in');
    expect(compareToRange(101, null, r)).toBe('high');
    expect(compareToRange(69.9, null, r)).toBe('low');
  });
  it('límites exclusivos', () => {
    const lt = parseRange('< 200', M);
    expect(compareToRange(200, null, lt)).toBe('high');
    expect(compareToRange(199, null, lt)).toBe('in');
    const gt = parseRange('> 40', M);
    expect(compareToRange(40, null, gt)).toBe('low');
  });
  it('valores con calificador', () => {
    expect(compareToRange(0.3, '<', parseRange('< 3.0', M))).toBe('in');
    expect(compareToRange(0.5, '<', parseRange('1 - 5', M))).toBe('low');
    expect(compareToRange(2, '<', parseRange('1 - 5', M))).toBe('in');
    expect(compareToRange(90, '>', parseRange('> 60', M))).toBe('in');
    expect(compareToRange(10, '>', parseRange('1 - 5', M))).toBe('high');
    expect(compareToRange(0.5, '<', parseRange('> 1', M))).toBe('low');
  });
  it('sin rango numérico no compara', () => {
    expect(compareToRange(5.8, null, parseRange('No diabético: < 5.7 ; Prediabetes: 5.7 - 6.4', M))).toBeNull();
    expect(compareToRange(null, null, r)).toBeNull();
    expect(compareToRange(5, null, null)).toBeNull();
  });
});

describe('rango capturado a mano', () => {
  it('construye intervalos y límites', () => {
    expect(manualRange(70, 100, '', 'mg/dL')).toMatchObject({ kind: 'interval', low: 70, high: 100, text: '70 - 100' });
    expect(manualRange(100, 70, 'x', 'mg/dL')).toMatchObject({ low: 70, high: 100 });
    expect(manualRange(null, 200, '', 'mg/dL')).toMatchObject({ kind: 'upper', high: 200 });
    expect(manualRange(40, null, '', 'mg/dL')).toMatchObject({ kind: 'lower', low: 40 });
    expect(manualRange(null, null, 'Negativo', '')).toMatchObject({ kind: 'qualitative' });
    expect(manualRange(null, null, '', '')).toBeNull();
  });
});
