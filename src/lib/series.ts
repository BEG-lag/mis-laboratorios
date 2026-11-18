/**
 * Series para graficar: un analito en una unidad. Los resultados en otra unidad se convierten
 * sólo si hay factor exacto (units.ts); si no, forman una serie aparte. Cada punto conserva el
 * rango de SU laboratorio, convertido con el mismo factor.
 */
import { ANALYTE_BY_ID, CATEGORY_ORDER, analyteName, conversionSpec, type Category } from './analytes.ts';
import { roundConverted } from './numbers.ts';
import { compareToRange } from './ranges.ts';
import { normalizeName } from './text.ts';
import type { FlagDir, LabResult, Lang, Qualifier, RefRange, Study } from './types.ts';
import { conversionFactor, factorToCanonical, unitKey } from './units.ts';

export interface SeriesPoint {
  result: LabResult;
  study: Study;
  date: string;
  t: number;
  value: number | null;
  decimals: number;
  qualifier: Qualifier | null;
  low: number | null;
  high: number | null;
  lowInclusive: boolean;
  highInclusive: boolean;
  /** Comparación contra el rango del propio laboratorio (null si no tiene límites numéricos). */
  status: 'in' | 'high' | 'low' | null;
  flag: FlagDir | null;
  converted: { fromUnit: string; factor: number; original: string } | null;
  lab: string;
  labKey: string;
}

export interface Series {
  key: string;
  analyteId: string;
  name: string;
  unit: string;
  category: Category;
  points: SeriesPoint[];
  labs: string[];
  rangesDiffer: boolean;
  /** Otras series del mismo analito en unidades sin factor exacto. */
  siblings: string[];
}

export interface Filters {
  from: string;
  to: string;
  lab: string;
}

export const NO_FILTERS: Filters = { from: '', to: '', lab: 'all' };

/** Clave para agrupar laboratorios aunque el nombre venga escrito distinto. */
export function labKey(lab: string): string {
  return (
    normalizeName(lab)
      .replace(/\b(s a p i de c v|s a de c v|sa de cv|s de r l de c v|s de rl de cv|sapi de cv|s c|sc)\b/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'sin-laboratorio'
  );
}

export function applyFilters(results: LabResult[], studies: Study[], filters: Filters): LabResult[] {
  const byId = new Map(studies.map((s) => [s.id, s] as const));
  return results.filter((r) => {
    const s = byId.get(r.studyId);
    if (!s) return false;
    if (filters.from && s.date < filters.from) return false;
    if (filters.to && s.date > filters.to) return false;
    if (filters.lab !== 'all' && labKey(s.lab) !== filters.lab) return false;
    return true;
  });
}

function mostCommon<T>(items: T[], tieBreak?: T): T | undefined {
  const counts = new Map<T, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  let best: T | undefined;
  let bestCount = -1;
  for (const [item, count] of counts) {
    if (count > bestCount || (count === bestCount && item === tieBreak)) {
      best = item;
      bestCount = count;
    }
  }
  return best;
}

function scaled(v: number | null, factor: number): number | null {
  if (v === null) return null;
  return factor === 1 ? v : roundConverted(v * factor).value;
}

function bandOf(range: RefRange | null, factor: number): Pick<SeriesPoint, 'low' | 'high' | 'lowInclusive' | 'highInclusive'> {
  if (!range) return { low: null, high: null, lowInclusive: true, highInclusive: true };
  return {
    low: scaled(range.low, factor),
    high: scaled(range.high, factor),
    lowInclusive: range.lowInclusive,
    highInclusive: range.highInclusive,
  };
}

function toT(date: string): number {
  return Date.parse(`${date}T12:00:00Z`);
}

export function buildSeries(results: LabResult[], studies: Study[], lang: Lang): Series[] {
  const byStudy = new Map(studies.map((s) => [s.id, s] as const));
  const byAnalyte = new Map<string, LabResult[]>();
  for (const r of results) {
    if (!byStudy.has(r.studyId)) continue;
    const list = byAnalyte.get(r.analyteId) ?? [];
    list.push(r);
    byAnalyte.set(r.analyteId, list);
  }
  const out: Series[] = [];
  for (const [analyteId, list] of byAnalyte) {
    const fallbackUnit = mostCommon(list.map((r) => r.unit)) ?? '';
    const spec = conversionSpec(analyteId, fallbackUnit);
    // Grupo convertible (con factor exacto a la unidad canónica) y grupos aparte por unidad.
    const groups = new Map<string, LabResult[]>();
    for (const r of list) {
      const convertible = factorToCanonical(r.unit, spec) !== null;
      const key = convertible ? '\u0000canon' : unitKey(r.unit);
      const g = groups.get(key) ?? [];
      g.push(r);
      groups.set(key, g);
    }
    const printedName = mostCommon(list.map((r) => r.name)) ?? analyteId;
    const name = analyteName(analyteId, lang, printedName);
    const category: Category = ANALYTE_BY_ID.get(analyteId)?.category ?? 'other';
    const made: Series[] = [];
    for (const [groupKey, items] of groups) {
      const displayUnit = groupKey === '\u0000canon' ? (mostCommon(items.map((r) => r.unit), spec.unit) ?? spec.unit) : items[0]!.unit;
      const points: SeriesPoint[] = items.map((r) => {
        const study = byStudy.get(r.studyId)!;
        const factor = groupKey === '\u0000canon' ? (conversionFactor(r.unit, displayUnit, spec) ?? 1) : 1;
        const isConverted = Math.abs(factor - 1) > 1e-12 || unitKey(r.unit) !== unitKey(displayUnit);
        const conv = r.value !== null && isConverted ? roundConverted(r.value * factor) : null;
        return {
          result: r,
          study,
          date: study.date,
          t: toT(study.date),
          value: r.value === null ? null : conv ? conv.value : r.value,
          decimals: conv ? conv.decimals : r.decimals,
          qualifier: r.qualifier,
          ...bandOf(r.range, factor),
          status: compareToRange(r.value, r.qualifier, r.range),
          flag: r.flag,
          converted: isConverted ? { fromUnit: r.unit, factor, original: r.valueText } : null,
          lab: study.lab,
          labKey: labKey(study.lab),
        };
      });
      points.sort((a, b) => a.t - b.t || a.result.id.localeCompare(b.result.id));
      const signatures = new Set(
        points.filter((p) => p.low !== null || p.high !== null).map((p) => `${p.low === null ? '' : p.low.toPrecision(6)}|${p.high === null ? '' : p.high.toPrecision(6)}`),
      );
      const labs: string[] = [];
      const seen = new Set<string>();
      for (const p of points) {
        if (seen.has(p.labKey)) continue;
        seen.add(p.labKey);
        labs.push(p.lab);
      }
      made.push({
        key: `${analyteId}|${displayUnit}`,
        analyteId,
        name,
        unit: displayUnit,
        category,
        points,
        labs,
        rangesDiffer: signatures.size > 1,
        siblings: [],
      });
    }
    for (const s of made) s.siblings = made.filter((o) => o !== s).map((o) => o.key);
    out.push(...made);
  }
  const catIndex = (c: Category) => CATEGORY_ORDER.indexOf(c);
  out.sort((a, b) => catIndex(a.category) - catIndex(b.category) || a.name.localeCompare(b.name, lang) || a.unit.localeCompare(b.unit));
  return out;
}

export function numericPoints(series: Series): SeriesPoint[] {
  return series.points.filter((p) => p.value !== null);
}

/** Etiquetas de laboratorio únicas (para el filtro). */
export function labsOf(studies: Study[]): { key: string; name: string }[] {
  const map = new Map<string, string>();
  for (const s of [...studies].sort((a, b) => a.date.localeCompare(b.date))) {
    const k = labKey(s.lab);
    if (!map.has(k)) map.set(k, s.lab || '-');
  }
  return [...map.entries()].map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name));
}
