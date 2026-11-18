/**
 * Extracción de resultados a partir del texto de un reporte de laboratorio.
 *
 * Trabaja con renglones y celdas (ver layout.ts), así que sirve igual para el texto de un PDF
 * que para el de un OCR. No depende de un laboratorio en particular: reconoce encabezados de
 * tabla ("Estudio", "Resultado", "Unidades", "Valores de referencia"), columnas de resultado
 * anterior, tablas lado a lado, rangos que continúan en el renglón siguiente, marcas H/L/* y
 * números con coma o punto decimal.
 */
import { methodOf, resolveAnalyte } from './analytes.ts';
import { findStudyDate } from './dates.ts';
import { lineText } from './layout.ts';
import { detectDecimal, parseValueStart, type DecimalSep } from './numbers.ts';
import { parseRange, type RangeContext } from './ranges.ts';
import { cleanText, fold, normalizeName, uid } from './text.ts';
import type { DocMeta, ExtractedRow, FlagDir, PageText, ParsedDocument, RefRange, Sex, TextCell, TextLine } from './types.ts';
import { canonicalUnit, looksLikeUnit, normalizeUnit } from './units.ts';

type ColumnKind = 'name' | 'result' | 'previous' | 'unit' | 'range' | 'flag' | 'method';

interface Column {
  kind: ColumnKind;
  x0: number;
  x1: number;
}

interface HeaderMap {
  columns: Column[];
  /** Fronteras x entre tablas lado a lado. */
  splits: number[];
}

const HEADER_KINDS: [ColumnKind, RegExp][] = [
  ['previous', /\b(anterior|anteriores|previo|previa|historico|ultimo resultado|resultado previo)\b/],
  ['result', /\b(resultados?|valor obtenido|valor)\b/],
  ['unit', /\b(unidad(es)?|u medida|unid)\b/],
  ['range', /\b(valores? de referencia|intervalos?|rangos?|referencia|valores normales|valor normal|limites|valores de ref)\b/],
  ['flag', /\b(marca|bandera|indicador|alerta|fuera de rango)\b/],
  ['method', /\b(metodo|tecnica|metodologia)\b/],
  ['name', /\b(estudios?|pruebas?|analitos?|parametros?|determinacion(es)?|examen(es)?|analisis|conceptos?|descripcion|elementos?)\b/],
];

const FLAG_RE = /^(\*{1,3}|\(?[HLAB]\)?|\(\*\)|ALTO|ALTA|BAJO|BAJA|ELEVADO|ELEVADA|DISMINUIDO|DISMINUIDA|HIGH|LOW|[↑↓]|!)$/i;
const FLAG_START = /^(\*{1,3}|\(?[HLAB]\)?|\(\*\)|ALTO|ALTA|BAJO|BAJA|ELEVADO|ELEVADA|DISMINUIDO|DISMINUIDA|HIGH|LOW|[↑↓]|!)(?=\s|$)/i;

const QUALITATIVE = /^(no reactivo|reactivo|negativ[oa]|positiv[oa]|indetectable|no detectable|no detectado|detectado|trazas|ausentes?|presentes?|escas[oa]s|abundantes|moderad[oa]s|rar[oa]s|no se observan?)\b/i;

const STOP_NAME =
  /^(fecha|folio|edad|sexo|genero|paciente|nombre|medico|dr|dra|doctor|cedula|ced|tel|telefono|orden|expediente|nss|curp|rfc|cp|codigo|muestra|version|id|no|numero|num|registro|sucursal|impreso|impresion|emision|firma|responsable|qfb|q f b|quimico|pagina|pag|hoja|direccion|domicilio|calle|col|colonia|cliente|empresa|procedencia|hora|horario|tipo de muestra|metodo|nota|notas|observaciones?|comentarios?|validado|valido|liberado|autorizado|elaboro|ref|referencia|resultados?|unidad|unidades|estudio|prueba|valores|intervalo|rango|de|del|la|el|los|las|y|total)\b/;

const RANGE_LABEL =
  /^(hombres?|mujer(es)?|masculino|femenino|varon(es)?|adultos?|ninos?|ninas?|recien|deseable|optimo|cercano|normal|limitrofe|alto|alta|bajo|baja|muy|menor|mayor|hasta|desde|inferior|superior|de|h|m|f|negativ|positiv|no|valor|ref|referencia|rango|riesgo|prediabetes|diabetes|deficiencia|insuficiencia|suficiencia|toxicidad|intoxicacion|embarazo|fase|postmenopausia|premenopausia|posmenopausia|nivel|niveles|ideal|aceptable|elevado|indeterminado|zona)\b/;

function classifyHeaderCell(text: string): ColumnKind | null {
  const t = fold(text);
  for (const [kind, re] of HEADER_KINDS) if (re.test(t)) return kind;
  return null;
}

function detectHeader(line: TextLine): HeaderMap | null {
  if (line.cells.length < 2) return null;
  if (line.cells.some((c) => /\d/.test(c.text.replace(/[³²]/g, '')))) return null;
  const kinds = line.cells.map((c) => classifyHeaderCell(c.text));
  if (!kinds.includes('result')) return null;
  const others = kinds.filter((k) => k === 'unit' || k === 'range' || k === 'name').length;
  if (others < 1) return null;
  const columns: Column[] = [];
  line.cells.forEach((c, i) => {
    const kind = kinds[i];
    if (kind) columns.push({ kind, x0: c.x0, x1: c.x1 });
  });
  columns.sort((a, b) => a.x0 - b.x0);
  // Tablas lado a lado: un segundo "Resultado" abre otra tabla; la frontera es la columna de nombre que lo precede.
  const splits: number[] = [];
  let seenResult = false;
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!;
    if (col.kind !== 'result') continue;
    if (seenResult) {
      const prev = columns[i - 1];
      splits.push(prev && prev.kind === 'name' ? prev.x0 - 2 : (columns[i - 1]!.x1 + col.x0) / 2);
    }
    seenResult = true;
  }
  return { columns, splits };
}

/** Columna de encabezado que corresponde a una celda (por la posición de su centro). */
function columnOf(cell: TextCell, header: HeaderMap): Column | null {
  const center = (cell.x0 + cell.x1) / 2;
  const cols = header.columns;
  for (let i = 0; i < cols.length; i++) {
    const start = cols[i]!.x0;
    const end = cols[i + 1]?.x0 ?? Infinity;
    if (center >= start && center < end) return cols[i]!;
  }
  return null;
}

function isSectionLine(line: TextLine): boolean {
  if (line.cells.length !== 1) return false;
  const text = line.cells[0]!.text;
  if (/\d/.test(text) || text.includes(':')) return false;
  const letters = text.replace(/[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/g, '');
  if (letters.length < 4) return false;
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÑÜ]/g, '').length;
  return upper / letters.length >= 0.7;
}

function isValueStart(text: string, decimal: DecimalSep): boolean {
  const t = text.trim();
  if (QUALITATIVE.test(fold(t))) return true;
  const v = parseValueStart(t, decimal);
  if (!v) return false;
  if (/^-\s*[A-Za-z]/.test(v.rest)) return false;
  return true;
}

function cleanName(raw: string): string {
  return cleanText(raw)
    .replace(/^(\d{1,2}[.)]|[-*•·])\s*/, '')
    .replace(/[\s:.]+$/, '')
    .replace(/\s*\.{2,}\s*/g, ' ')
    .trim();
}

function validName(name: string): boolean {
  const n = normalizeName(name);
  if (n.replace(/[^a-z]/g, '').length < 2) return false;
  if (STOP_NAME.test(n)) return false;
  return true;
}

function isNameLike(text: string, next: TextCell | undefined, decimal: DecimalSep): boolean {
  const t = text.trim();
  if (!/^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(t)) return false;
  const n = normalizeName(t);
  if (RANGE_LABEL.test(n) || !validName(t)) return false;
  if (canonicalUnit(t) || looksLikeUnit(t) || FLAG_RE.test(t)) return false;
  return Boolean(next && isValueStart(next.text, decimal));
}

function flagDir(raw: string): FlagDir {
  const t = fold(raw).replace(/[()]/g, '');
  if (/^(h|a|alto|alta|elevado|elevada|high|↑)$/.test(t)) return 'high';
  if (/^(l|b|bajo|baja|disminuido|disminuida|low|↓)$/.test(t)) return 'low';
  return 'flag';
}

interface RowDraft {
  row: ExtractedRow;
  rangeX: number | null;
  valueX: number;
  rangeParts: string[];
}

interface ParseState {
  ctx: RangeContext;
  section: string;
  page: number;
}

/** Intenta separar "Glucosa 98 mg/dL" cuando el nombre y el valor vienen en la misma celda. */
function splitMergedName(cells: TextCell[], decimal: DecimalSep): TextCell[] | null {
  const first = cells[0];
  if (!first) return null;
  const tokens = first.text.split(/\s+/);
  let best: { k: number; known: boolean } | null = null;
  for (let k = 1; k < tokens.length; k++) {
    const name = tokens.slice(0, k).join(' ');
    const rest = tokens.slice(k).join(' ');
    if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]{2}/.test(name) || !isValueStart(rest, decimal)) continue;
    const known = resolveAnalyte(cleanName(name)) !== null;
    if (!best || (known && (!best.known || k > best.k))) best = { k, known };
  }
  if (!best) return null;
  const name = tokens.slice(0, best.k).join(' ');
  const rest = tokens.slice(best.k).join(' ');
  const width = first.x1 - first.x0;
  const cut = first.x0 + (width * name.length) / Math.max(first.text.length, 1);
  return [
    { text: name, x0: first.x0, x1: cut, size: first.size },
    { text: rest, x0: cut, x1: first.x1, size: first.size },
    ...cells.slice(1),
  ];
}

function parseRow(cellsIn: TextCell[], state: ParseState, snippet: string, depth = 0): RowDraft[] {
  if (cellsIn.length === 0 || depth > 3) return [];
  const decimal = state.ctx.decimal;
  let cells = cellsIn;
  let vi = cells.findIndex((c, i) => i > 0 && isValueStart(c.text, decimal));
  if (vi < 0 || (vi > 0 && !validName(cleanName(cells.slice(0, vi).map((c) => c.text).join(' '))))) {
    const split = splitMergedName(cells, decimal);
    if (!split) return [];
    cells = split;
    vi = 1;
  }
  const name = cleanName(cells.slice(0, vi).map((c) => c.text).join(' '));
  if (!validName(name)) return [];
  const valueCell = cells[vi]!;
  let valueText = cleanText(valueCell.text);
  let value: number | null = null;
  let decimals = 0;
  let qualifier: ExtractedRow['qualifier'] = null;
  let flagRaw = '';
  let unitRaw = '';
  const rangeParts: string[] = [];
  let rest: string;
  const qual = QUALITATIVE.exec(fold(valueText));
  if (qual) {
    rest = valueText.slice(qual[0].length).trim();
    valueText = valueText.slice(0, qual[0].length);
  } else {
    const pv = parseValueStart(valueText, decimal);
    if (!pv) return [];
    value = pv.value;
    decimals = pv.decimals;
    qualifier = pv.qualifier;
    if (pv.prefixFlag) flagRaw = pv.prefixFlag;
    rest = pv.rest;
    valueText = valueText.slice(0, valueText.length - rest.length).trim();
  }
  // Lo que quedó en la celda del valor: marca, unidad y quizá el rango.
  while (rest) {
    const flag = FLAG_START.exec(rest);
    if (flag && !flagRaw) {
      flagRaw = flag[1]!;
      rest = rest.slice(flag[0].length).trim();
      continue;
    }
    if (!unitRaw) {
      const u = /^(\S+(?:\s\S+)?)/.exec(rest);
      const single = rest.split(/\s+/)[0] ?? '';
      const two = u?.[1]?.replace(/\s+/g, '') ?? '';
      if (two && canonicalUnit(two)) {
        unitRaw = u![1]!;
        rest = rest.slice(u![1]!.length).trim();
        continue;
      }
      if (canonicalUnit(single) || looksLikeUnit(single)) {
        unitRaw = single;
        rest = rest.slice(single.length).trim();
        continue;
      }
    }
    rangeParts.push(rest);
    rest = '';
  }
  valueText = valueText.replace(/[\s*]+$/, '').trim() || valueText;
  let rangeX: number | null = rangeParts.length ? valueCell.x0 : null;
  const extra: RowDraft[] = [];
  const after = cells.slice(vi + 1);
  for (let i = 0; i < after.length; i++) {
    const c = after[i]!;
    const text = cleanText(c.text);
    if (!flagRaw && FLAG_RE.test(text)) {
      flagRaw = text;
      continue;
    }
    if (!unitRaw && rangeParts.length === 0 && (canonicalUnit(text) || looksLikeUnit(text))) {
      unitRaw = text;
      continue;
    }
    if (isNameLike(text, after[i + 1], decimal)) {
      extra.push(...parseRow(after.slice(i), state, snippet, depth + 1));
      break;
    }
    if (!unitRaw && rangeParts.length > 0 && (canonicalUnit(text) || looksLikeUnit(text))) {
      unitRaw = text;
      continue;
    }
    if (rangeX === null) rangeX = c.x0;
    rangeParts.push(text);
  }
  const rangeText = rangeParts.join(' ').trim();
  let unit = normalizeUnit(unitRaw);
  const range = rangeText ? parseRange(rangeText, { ...state.ctx, unit }) : null;
  if (!unit && range?.unit) unit = range.unit;
  const analyteId = resolveAnalyte(name, unit, state.section);
  const hasBandOrUnit = Boolean(unit) || Boolean(range && (range.low !== null || range.high !== null || range.kind === 'categories' || range.kind === 'bySex' || range.kind === 'byAge'));
  const accept = analyteId ? value !== null || qual !== null : value !== null && hasBandOrUnit;
  const rows: RowDraft[] = [];
  if (accept) {
    rows.push({
      row: {
        id: uid('row'),
        analyteId,
        name,
        valueText,
        value,
        qualifier,
        decimals,
        unit,
        range: range && range.kind !== 'none' ? range : range?.text ? range : null,
        flag: flagRaw ? flagDir(flagRaw) : null,
        flagRaw,
        method: analyteId === 'ldl' ? methodOf(name) : null,
        section: state.section,
        page: state.page,
        snippet,
      },
      rangeX,
      valueX: valueCell.x0,
      rangeParts,
    });
  }
  return [...rows, ...extra];
}

function isContinuation(line: TextLine, last: RowDraft & { y: number; size: number }, decimal: DecimalSep): boolean {
  const first = line.cells[0];
  if (!first) return false;
  if (line.y - last.y > 3.2 * last.size) return false;
  const minX = last.rangeX !== null ? last.rangeX - 2 * last.size : last.valueX + 2 * last.size;
  if (first.x0 < minX) return false;
  const text = line.cells.map((c) => c.text).join(' ');
  if (line.cells.some((c, i) => isNameLike(c.text, line.cells[i + 1], decimal))) return false;
  const r = parseRange(text, { sex: null, age: null, decimal });
  return r.kind !== 'none' && (r.low !== null || r.high !== null || r.kind === 'bySex' || r.kind === 'byAge' || r.kind === 'categories' || RANGE_LABEL.test(normalizeName(text)));
}

const LAB_WORDS = /\b(laboratorios?|analisis clinicos|clinica|diagnostico|patologia|lab|unidad medica|hospital|centro medico)\b/;

function extractLab(page: PageText | undefined): string {
  if (!page) return '';
  const top = page.lines.filter((l) => l.y < page.height * 0.3).slice(0, 12);
  for (const line of top) {
    const text = lineText(line);
    const m = /\blaboratorio\s*:\s*([^\t]+)/i.exec(text);
    if (m) return cleanText(m[1]!);
  }
  for (const line of top) {
    for (const cell of line.cells) {
      if (cell.text.includes(':')) continue;
      if (LAB_WORDS.test(fold(cell.text))) return cleanText(cell.text);
    }
  }
  const cells = top.flatMap((l) => l.cells).filter((c) => !c.text.includes(':') && !/\d{3,}/.test(c.text) && /[A-Za-z]{3}/.test(c.text));
  cells.sort((a, b) => b.size - a.size);
  return cells[0] ? cleanText(cells[0].text) : '';
}

export function extractMeta(pages: PageText[]): DocMeta {
  const lines = pages.flatMap((p) => p.lines.map(lineText));
  const found = findStudyDate(lines);
  let sex: Sex | null = null;
  let age: number | null = null;
  let patient = '';
  for (const line of lines) {
    const f = fold(line);
    if (!sex) {
      const m = /\b(?:sexo|genero)\b\s*[:.]?\s*(masculino|femenino|hombre|mujer|varon|m|f|h)\b/.exec(f);
      if (m) sex = /^(masculino|hombre|varon|m|h)$/.test(m[1]!) ? 'M' : 'F';
    }
    if (age === null) {
      const m = /\bedad\b\s*[:.]?\s*(\d{1,3})\s*(?:anos|a\b|ano)?/.exec(f);
      if (m) age = Number(m[1]);
    }
    if (!patient) {
      const m = /\b(?:paciente|nombre del paciente|nombre)\s*:\s*([^\t]+)/i.exec(line);
      if (m) patient = cleanText(m[1]!);
    }
  }
  return { lab: extractLab(pages[0]), date: found?.date ?? null, dateLabel: found?.label ?? '', sex, age, patient };
}

/** Vuelve a leer el rango con otro sexo o edad (por ejemplo, si la persona corrige el sexo). */
export function reparseRange(range: RefRange | null, ctx: RangeContext): RefRange | null {
  if (!range) return null;
  return parseRange(range.text, ctx);
}

export interface ParseOptions {
  sex?: Sex | null;
  age?: number | null;
}

export function parseDocument(pages: PageText[], options: ParseOptions = {}): ParsedDocument {
  const texts = pages.flatMap((p) => p.lines.map(lineText));
  const decimal = detectDecimal(texts);
  const meta = extractMeta(pages);
  if (options.sex !== undefined) meta.sex = options.sex;
  if (options.age !== undefined) meta.age = options.age;
  const ctx: RangeContext = { sex: meta.sex, age: meta.age, decimal };
  const rows: ExtractedRow[] = [];
  let header: HeaderMap | null = null;
  for (const page of pages) {
    let section = '';
    let last: (RowDraft & { y: number; size: number }) | null = null;
    for (const line of page.lines) {
      const text = lineText(line);
      const h = detectHeader(line);
      if (h) {
        header = h;
        last = null;
        continue;
      }
      if (isSectionLine(line)) {
        section = line.cells[0]!.text;
        last = null;
        continue;
      }
      if (last && isContinuation(line, last, decimal)) {
        last.rangeParts.push(line.cells.map((c) => c.text).join(' '));
        const rangeText = last.rangeParts.join(' ; ');
        const range = parseRange(rangeText, { ...ctx, unit: last.row.unit });
        last.row.range = range;
        if (!last.row.unit && range.unit) last.row.unit = range.unit;
        last.row.snippet = `${last.row.snippet}\n${text}`;
        last.y = line.y;
        continue;
      }
      let groups: TextCell[][] = [line.cells];
      if (header && header.splits.length) {
        const bounds = [...header.splits];
        groups = bounds.map(() => [] as TextCell[]).concat([[]]);
        for (const c of line.cells) {
          let g = 0;
          while (g < bounds.length && c.x0 >= bounds[g]!) g++;
          groups[g]!.push(c);
        }
      }
      const parsed: RowDraft[] = [];
      for (const group of groups) {
        const cells = header ? group.filter((c) => !['previous', 'method'].includes(columnOf(c, header!)?.kind ?? '')) : group;
        const groupSnippet = groups.length > 1 ? group.map((c) => c.text).join('  ') : text.replace(/\t/g, '  ');
        parsed.push(...parseRow(cells, { ctx, section, page: page.page }, groupSnippet));
      }
      for (const p of parsed) rows.push(p.row);
      const size = line.cells[0]?.size ?? 10;
      if (parsed.length === 1) last = { ...parsed[0]!, y: line.y, size };
      else last = null;
    }
  }
  return { meta, rows, decimal, pages: pages.length, textChars: texts.join('').length };
}
