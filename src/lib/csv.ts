/**
 * Exportación CSV de los resultados confirmados (con los filtros aplicados). Incluye el valor tal
 * como lo imprimió el laboratorio y, cuando hubo conversión exacta, el valor en la unidad de la
 * gráfica.
 */
import { analyteName } from './analytes.ts';
import type { Series } from './series.ts';
import type { Lang } from './types.ts';

const HEADERS: Record<Lang, string[]> = {
  es: [
    'fecha',
    'laboratorio',
    'analito_id',
    'analito',
    'nombre_impreso',
    'valor',
    'calificador',
    'unidad',
    'ref_min',
    'ref_max',
    'ref_texto',
    'vs_rango_laboratorio',
    'marca_laboratorio',
    'metodo',
    'valor_en_unidad_grafica',
    'unidad_grafica',
    'archivo',
    'pagina',
    'origen',
  ],
  en: [
    'date',
    'lab',
    'analyte_id',
    'analyte',
    'printed_name',
    'value',
    'qualifier',
    'unit',
    'ref_low',
    'ref_high',
    'ref_text',
    'vs_lab_range',
    'lab_flag',
    'method',
    'value_in_chart_unit',
    'chart_unit',
    'file',
    'page',
    'source',
  ],
};

const STATUS: Record<Lang, Record<string, string>> = {
  es: { in: 'dentro', high: 'arriba', low: 'abajo', none: 'sin_rango_numerico' },
  en: { in: 'within', high: 'above', low: 'below', none: 'no_numeric_range' },
};

/** Comillas cuando hace falta y protección contra fórmulas al abrir en hojas de cálculo. */
export function csvCell(value: string | number | null | undefined, text = true): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (text && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function num(v: number | null): string {
  return v === null ? '' : String(v);
}

export function seriesToCsv(series: Series[], lang: Lang, options: { excel?: boolean } = {}): string {
  const lines = [HEADERS[lang].join(',')];
  const points = series.flatMap((s) => s.points.map((p) => ({ s, p })));
  points.sort((a, b) => a.p.date.localeCompare(b.p.date) || a.s.name.localeCompare(b.s.name, lang));
  for (const { s, p } of points) {
    const r = p.result;
    const row = [
      csvCell(p.date, false),
      csvCell(p.lab),
      csvCell(r.analyteId),
      csvCell(analyteName(r.analyteId, lang, r.name)),
      csvCell(r.name),
      csvCell(r.value === null ? r.valueText : num(r.value), r.value === null),
      csvCell(r.qualifier ?? '', false),
      csvCell(r.unit),
      csvCell(num(r.range?.low ?? null), false),
      csvCell(num(r.range?.high ?? null), false),
      csvCell(r.range?.text ?? ''),
      csvCell(STATUS[lang][p.status ?? 'none'], false),
      csvCell(r.flagRaw),
      csvCell(r.method ?? ''),
      csvCell(p.converted && p.value !== null ? String(p.value) : '', false),
      csvCell(p.converted ? s.unit : ''),
      csvCell(p.study.fileName),
      csvCell(r.page ? String(r.page) : '', false),
      csvCell(p.study.source, false),
    ];
    lines.push(row.join(','));
  }
  const body = lines.join('\r\n') + '\r\n';
  return options.excel ? `\uFEFF${body}` : body;
}
