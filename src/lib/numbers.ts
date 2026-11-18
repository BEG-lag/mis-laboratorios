/**
 * Números como los imprimen los laboratorios en México: punto o coma decimal, separadores de
 * miles ("250,000" plaquetas por µL o "250.000" si el reporte usa coma decimal).
 */
import type { Qualifier } from './types.ts';

export type DecimalSep = ',' | '.';

/** Cuenta evidencia de coma decimal ("1,05", "13,5") contra punto decimal ("1.05"). */
export function detectDecimal(texts: string[]): DecimalSep {
  let comma = 0;
  let point = 0;
  for (const text of texts) {
    for (const m of text.matchAll(/(?<![\d.,])\d+([.,])(\d+)(?![\d.,])/g)) {
      const sep = m[1];
      const frac = m[2] ?? '';
      if (frac.length === 3) continue; // "6,500" o "250.000": ambiguo, puede ser separador de miles
      if (sep === ',') comma++;
      else point++;
    }
  }
  return comma > point ? ',' : '.';
}

export interface ParsedNumber {
  value: number;
  decimals: number;
}

/** Convierte un número impreso a número, según el separador decimal del documento. */
export function parseNumber(raw: string, decimal: DecimalSep = '.'): ParsedNumber | null {
  const s = raw.replace(/\s+/g, '').replace(/^\+/, '');
  if (!/^\d[\d.,]*$/.test(s) || /[.,]$/.test(s)) return null;
  let normalized: string;
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) && decimal === '.') {
    normalized = s.replace(/,/g, '');
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) && decimal === ',') {
    normalized = s.replace(/\./g, '').replace(',', '.');
  } else if (/^\d+,\d+$/.test(s)) {
    normalized = s.replace(',', '.');
  } else if (/^\d+(\.\d+)?$/.test(s)) {
    normalized = s;
  } else {
    return null;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;
  const decimals = normalized.includes('.') ? normalized.split('.')[1]!.length : 0;
  return { value, decimals };
}

const QUALIFIERS: [RegExp, Qualifier][] = [
  [/^(<=|menor o igual (a|que))\s*/i, '<='],
  [/^(>=|mayor o igual (a|que))\s*/i, '>='],
  [/^(<|menor (de|a|que)|inferior a)\s*/i, '<'],
  [/^(>|mayor (de|a|que)|superior a)\s*/i, '>'],
];

export interface ParsedValue {
  value: number;
  decimals: number;
  qualifier: Qualifier | null;
  /** Lo que sobró después del número (marca pegada, unidad, rango...). */
  rest: string;
  /** Marca pegada antes del número ("*215", "↑215"). */
  prefixFlag: string;
}

/** Lee un valor al inicio de un texto: "98", "<0.5", "215*", "*215", "6,8 H", "1.05 mg/dL". */
export function parseValueStart(text: string, decimal: DecimalSep): ParsedValue | null {
  let s = text.trim();
  let prefixFlag = '';
  const pre = /^(\*{1,3}|[↑↓])\s*/.exec(s);
  if (pre) {
    prefixFlag = pre[1]!;
    s = s.slice(pre[0].length);
  }
  let qualifier: Qualifier | null = null;
  for (const [re, q] of QUALIFIERS) {
    const m = re.exec(s);
    if (m) {
      qualifier = q;
      s = s.slice(m[0].length);
      break;
    }
  }
  const m = /^\d[\d.,]*/.exec(s);
  if (!m) return null;
  let token = m[0];
  // "6.5." o "98," al final de una frase: se quita la puntuación final.
  while (/[.,]$/.test(token)) token = token.slice(0, -1);
  const parsed = parseNumber(token, decimal);
  if (!parsed) return null;
  const rest = s.slice(token.length);
  // Un número pegado a letras ("25OH", "4x10") no es un valor.
  if (/^[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,}/.test(rest) && !/^(mg|g|ng|pg|u|mu|ui|mui|mmol|umol|fl|meq)/i.test(rest)) return null;
  return { value: parsed.value, decimals: parsed.decimals, qualifier, rest: rest.trim(), prefixFlag };
}

/** Formatea con los mismos decimales que imprimió el laboratorio. */
export function formatValue(value: number, decimals: number, lang: 'es' | 'en'): string {
  return new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US', {
    minimumFractionDigits: Math.min(decimals, 6),
    maximumFractionDigits: Math.min(Math.max(decimals, 0), 6),
  }).format(value);
}

/** Redondeo para valores convertidos: cuatro cifras significativas, sin decimales de más. */
export function roundConverted(value: number): { value: number; decimals: number } {
  if (value === 0) return { value: 0, decimals: 0 };
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const decimals = Math.max(0, Math.min(4, 3 - magnitude));
  const factor = 10 ** decimals;
  return { value: Math.round(value * factor) / factor, decimals };
}
