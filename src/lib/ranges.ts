/**
 * Rangos de referencia como los imprimen los laboratorios: "70 - 100", "< 200", "Hasta 150",
 * "Mayor de 40", rangos por sexo o edad y rangos por categorías.
 *
 * Regla de la app: sólo se usa el rango del propio laboratorio. Si el rango depende del sexo o de
 * la edad, se elige el que corresponde a lo que dice el propio reporte; si hay varias categorías
 * ("Deseable", "Limítrofe", "Alto") no se elige ninguna: se conserva el texto y no se dibuja banda.
 */
import { parseNumber, type DecimalSep } from './numbers.ts';
import { cleanText, fold } from './text.ts';
import type { Qualifier, RefRange, Sex } from './types.ts';
import { canonicalUnit, looksLikeUnit, normalizeUnit } from './units.ts';

export interface RangeContext {
  sex: Sex | null;
  age: number | null;
  decimal: DecimalSep;
  /** Unidad del resultado, para elegir cuando el rango viene en dos unidades. */
  unit?: string;
}

interface Segment {
  label: string;
  low: number | null;
  high: number | null;
  lowInclusive: boolean;
  highInclusive: boolean;
  unit: string;
  isAgeLabel: boolean;
}

const NUM = String.raw`\d+(?:[.,]\d+)*`;
const SCAN = new RegExp(
  [
    String.raw`(?<lo>${NUM})\s*(?:-|\ba\b|\bal\b|\bhasta\b|\bto\b)\s*(?<hi>${NUM})`,
    String.raw`(?<op1><=|<|\bmenor o igual (?:a|que)\b|\bmenor (?:de|a|que)\b|\binferior a\b|\bhasta\b|\bmax(?:imo)?\.?|\bmenos de\b)\s*(?<up>${NUM})`,
    String.raw`(?<op2>>=|>|\bmayor o igual (?:a|que)\b|\bmayor (?:de|a|que)\b|\bsuperior a\b|\bmas de\b|\bmin(?:imo)?\.?|\bdesde\b)\s*(?<lw>${NUM})`,
  ].join('|'),
  'gi',
);

const INCLUSIVE_UPPER = /^(<=|menor o igual|hasta|max)/;
const INCLUSIVE_LOWER = /^(>=|mayor o igual|desde|min)/;

function emptyRange(text: string, kind: RefRange['kind'], unit = ''): RefRange {
  return { text, low: null, high: null, lowInclusive: true, highInclusive: true, kind, label: '', unit };
}

/** Busca una unidad en las primeras palabras de un texto. Devuelve la unidad y cuántos caracteres ocupa. */
function unitAt(text: string): { unit: string; length: number } | null {
  const m = /^(\s*)(\S+)(?:(\s+)(\S+))?(?:(\s+)(\S+))?/.exec(text);
  if (!m) return null;
  const tokens = [m[2], m[4], m[6]];
  const seps = [m[1] ?? '', m[3] ?? '', m[5] ?? ''];
  for (let n = 3; n >= 1; n--) {
    const parts = tokens.slice(0, n);
    if (parts.some((p) => p === undefined)) continue;
    const joined = parts.join('');
    const trail = /[),;\].]+$/.exec(joined)?.[0] ?? '';
    const clean = joined.slice(0, joined.length - trail.length);
    if (!clean) continue;
    if (canonicalUnit(clean) || (n === 1 && looksLikeUnit(clean))) {
      let length = 0;
      for (let i = 0; i < n; i++) length += seps[i]!.length + parts[i]!.length;
      return { unit: normalizeUnit(clean), length: length - trail.length };
    }
  }
  return null;
}

function stripLabel(label: string): string {
  return label
    .replace(/^[\s:;,/|()[\]=.-]+|[\s:;,/|()[\]=.-]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type SexTag = Sex | null;

function sexTags(labels: string[]): SexTag[] {
  const words = labels.map((l) => fold(l).replace(/[^a-z ]/g, ' ').trim());
  const single = words.map((w) => (/^[hmf]$/.test(w) ? w : ''));
  const letters = new Set(single.filter(Boolean));
  return words.map((w, i) => {
    if (/\b(hombres?|masculinos?|varon(es)?|caballeros?|males?|men)\b/.test(w)) return 'M';
    if (/\b(mujer(es)?|femeninos?|femeninas?|damas?|females?|women)\b/.test(w)) return 'F';
    const s = single[i];
    if (!s) return null;
    if (s === 'h') return 'M';
    if (s === 'f') return 'F';
    // "M" sola: Mujeres si convive con "H"; Masculino si convive con "F".
    if (letters.has('h')) return 'F';
    if (letters.has('f')) return 'M';
    return null;
  });
}

interface AgeTag {
  min: number;
  max: number;
}

function ageTag(label: string): AgeTag | null {
  const w = fold(label);
  if (/\badult[oa]s?\b/.test(w)) return { min: 18, max: Infinity };
  if (/\b(ninos?|ninas?|pediatric[oa]s?|infantil)\b/.test(w)) return { min: 0, max: 18 };
  if (/\b(recien nacidos?|neonatos?|lactantes?)\b/.test(w)) return { min: 0, max: 1 };
  const between = /(\d+)\s*(?:-|a)\s*(\d+)\s*(anos|a\b)/.exec(w);
  if (between) return { min: Number(between[1]), max: Number(between[2]) + 1 };
  const over = /(?:>|>=|mayor(?:es)? de|mas de|desde)\s*(\d+)\s*(anos|a\b)/.exec(w);
  if (over) return { min: Number(over[1]), max: Infinity };
  const under = /(?:<|<=|menor(?:es)? de|hasta)\s*(\d+)\s*(anos|a\b)/.exec(w);
  if (under) return { min: 0, max: Number(under[1]) };
  return null;
}

/** Lee el texto de un rango de referencia. */
export function parseRange(raw: string, ctx: RangeContext): RefRange {
  const text = cleanText(raw).replace(/^[([]\s*|\s*[)\]]$/g, '');
  if (!text) return emptyRange(cleanText(raw), 'none');
  const folded = fold(text);
  const segments: Segment[] = [];
  let labelStart = 0;
  let pendingAge = '';
  SCAN.lastIndex = 0;
  for (let m = SCAN.exec(folded); m; m = SCAN.exec(folded)) {
    const g = m.groups ?? {};
    const after = folded.slice(m.index + m[0].length);
    // "18 - 60 años: 0.7 - 1.3": el primer intervalo es una etiqueta de edad, no un rango.
    if (/^\s*(anos|a\b|meses|dias|semanas)/.test(after)) {
      pendingAge += ' ' + text.slice(labelStart, m.index + m[0].length) + ' anos';
      const ageWord = /^\s*(anos|a\b|meses|dias|semanas)/.exec(after)!;
      labelStart = m.index + m[0].length + ageWord[0].length;
      SCAN.lastIndex = labelStart;
      continue;
    }
    const label = stripLabel(pendingAge + ' ' + text.slice(labelStart, m.index));
    pendingAge = '';
    const seg: Segment = { label, low: null, high: null, lowInclusive: true, highInclusive: true, unit: '', isAgeLabel: false };
    if (g.lo !== undefined && g.hi !== undefined) {
      const lo = parseNumber(g.lo, ctx.decimal);
      const hi = parseNumber(g.hi, ctx.decimal);
      if (!lo || !hi) continue;
      seg.low = Math.min(lo.value, hi.value);
      seg.high = Math.max(lo.value, hi.value);
    } else if (g.up !== undefined) {
      const up = parseNumber(g.up, ctx.decimal);
      if (!up) continue;
      seg.high = up.value;
      seg.highInclusive = INCLUSIVE_UPPER.test(g.op1 ?? '');
    } else if (g.lw !== undefined) {
      const lw = parseNumber(g.lw, ctx.decimal);
      if (!lw) continue;
      seg.low = lw.value;
      seg.lowInclusive = INCLUSIVE_LOWER.test(g.op2 ?? '');
    }
    let end = m.index + m[0].length;
    const u = unitAt(text.slice(end));
    if (u) {
      seg.unit = u.unit;
      end += u.length;
    }
    segments.push(seg);
    labelStart = end;
    SCAN.lastIndex = end;
  }

  if (segments.length === 0) {
    const unitOnly = unitAt(text);
    if (unitOnly && unitOnly.length >= text.length - 1) return emptyRange(text, 'none', unitOnly.unit);
    return emptyRange(text, /[a-z]/i.test(text) ? 'qualitative' : 'none');
  }

  // Rangos en dos unidades ("70 - 100 mg/dL (3.9 - 5.6 mmol/L)"): se usa el de la unidad del resultado.
  let candidates = segments;
  const units = new Set(segments.map((s) => s.unit).filter(Boolean));
  if (units.size > 1 && ctx.unit) {
    const wanted = canonicalUnit(ctx.unit) ?? ctx.unit;
    const same = segments.filter((s) => s.unit === wanted);
    if (same.length) candidates = same;
  }
  // Sin etiquetas y en una sola unidad, varios segmentos sólo pueden ser categorías.
  const unitOf = (s: Segment) => s.unit || [...units][0] || '';

  if (candidates.length === 1) return fromSegment(text, candidates[0]!, unitOf(candidates[0]!));

  const sexes = sexTags(candidates.map((s) => s.label));
  if (sexes.some((s) => s !== null)) {
    if (!ctx.sex) return emptyRange(text, 'bySex', unitOf(candidates[0]!));
    candidates = candidates.filter((_, i) => sexes[i] === ctx.sex);
    if (candidates.length === 1) return fromSegment(text, candidates[0]!, unitOf(candidates[0]!));
  }
  const ages = candidates.map((s) => ageTag(s.label));
  if (candidates.length > 1 && ages.some((a) => a !== null)) {
    if (ctx.age === null) return emptyRange(text, 'byAge', unitOf(candidates[0]!));
    const age = ctx.age;
    const fit = candidates.filter((_, i) => {
      const a = ages[i];
      return a !== null && a !== undefined && age >= a.min && age < a.max;
    });
    if (fit.length === 1) return fromSegment(text, fit[0]!, unitOf(fit[0]!));
    return emptyRange(text, 'byAge', unitOf(candidates[0]!));
  }
  return emptyRange(text, 'categories', unitOf(segments[0]!));
}

function fromSegment(text: string, s: Segment, unit: string): RefRange {
  const kind: RefRange['kind'] = s.low !== null && s.high !== null ? 'interval' : s.high !== null ? 'upper' : 'lower';
  return {
    text,
    low: s.low,
    high: s.high,
    lowInclusive: s.lowInclusive,
    highInclusive: s.highInclusive,
    kind,
    label: s.label,
    unit,
  };
}

/** ¿El rango tiene al menos un límite numérico? */
export function hasBand(range: RefRange | null): range is RefRange {
  return Boolean(range && (range.low !== null || range.high !== null));
}

/**
 * Compara un valor contra el rango del propio laboratorio. Devuelve null si el rango no tiene
 * límites numéricos o si el valor no permite decidir ("< 0.5" contra un rango 0 - 4).
 */
export function compareToRange(value: number | null, qualifier: Qualifier | null, range: RefRange | null): 'in' | 'high' | 'low' | null {
  if (value === null || !hasBand(range)) return null;
  const { low, high, lowInclusive, highInclusive } = range;
  const aboveHigh = (v: number) => high !== null && (highInclusive ? v > high : v >= high);
  const belowLow = (v: number) => low !== null && (lowInclusive ? v < low : v <= low);
  if (qualifier === '<' || qualifier === '<=') {
    // El valor real es menor que v: sólo es seguro que está por debajo si v ya está en el límite inferior o abajo.
    if (low !== null && (qualifier === '<' ? value <= low : value < low)) return 'low';
    return high !== null && value <= high ? 'in' : null;
  }
  if (qualifier === '>' || qualifier === '>=') {
    if (high !== null && (qualifier === '>' ? value >= high : value > high)) return 'high';
    return low !== null && value >= low ? 'in' : null;
  }
  if (aboveHigh(value)) return 'high';
  if (belowLow(value)) return 'low';
  return 'in';
}

/** Rango con límites capturados a mano en la revisión. */
export function manualRange(low: number | null, high: number | null, text: string, unit: string): RefRange | null {
  if (low === null && high === null) {
    return text.trim() ? { ...emptyRange(text.trim(), /[a-z]/i.test(text) ? 'qualitative' : 'none'), unit } : null;
  }
  const lo = low !== null && high !== null ? Math.min(low, high) : low;
  const hi = low !== null && high !== null ? Math.max(low, high) : high;
  return {
    text: text.trim() || [lo, hi].map((v) => (v === null ? '' : String(v))).join(' - '),
    low: lo,
    high: hi,
    lowInclusive: true,
    highInclusive: true,
    kind: lo !== null && hi !== null ? 'interval' : hi !== null ? 'upper' : 'lower',
    label: '',
    unit,
  };
}
