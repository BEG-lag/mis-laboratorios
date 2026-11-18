/**
 * Revisión humana: cada documento leído se convierte en un borrador editable. Nada se agrega al
 * historial hasta que la persona lo confirma.
 */
import { ANALYTE_BY_ID, customId } from './analytes.ts';
import { parseNumber, parseValueStart, type DecimalSep } from './numbers.ts';
import { manualRange, parseRange } from './ranges.ts';
import { cleanText, uid } from './text.ts';
import type { FlagDir, LabResult, ParsedDocument, Qualifier, RefRange, Sex, Study, StudySource } from './types.ts';
import { normalizeUnit } from './units.ts';

export const CUSTOM = 'custom';

export interface DraftRow {
  id: string;
  /** Id del diccionario o "custom" (se usa el nombre impreso). */
  analyteId: string;
  name: string;
  valueText: string;
  unit: string;
  lowText: string;
  highText: string;
  /** La persona cambió los límites: se usan los suyos en lugar de los leídos. */
  rangeEdited: boolean;
  range: RefRange | null;
  flag: FlagDir | null;
  flagRaw: string;
  method: string | null;
  page: number;
  snippet: string;
}

export interface Draft {
  id: string;
  fileName: string;
  source: StudySource;
  hash: string | null;
  date: string;
  dateLabel: string;
  lab: string;
  sex: Sex | null;
  sexDetected: Sex | null;
  age: number | null;
  patient: string;
  decimal: DecimalSep;
  pages: number;
  rows: DraftRow[];
}

function bandText(v: number | null): string {
  return v === null ? '' : String(v);
}

export function rowFromRange(range: RefRange | null): Pick<DraftRow, 'lowText' | 'highText'> {
  return { lowText: bandText(range?.low ?? null), highText: bandText(range?.high ?? null) };
}

export function draftFromParsed(doc: ParsedDocument, fileName: string, source: StudySource, hash: string | null): Draft {
  return {
    id: uid('draft'),
    fileName,
    source,
    hash,
    date: doc.meta.date ?? '',
    dateLabel: doc.meta.dateLabel,
    lab: doc.meta.lab,
    sex: doc.meta.sex,
    sexDetected: doc.meta.sex,
    age: doc.meta.age,
    patient: doc.meta.patient,
    decimal: doc.decimal,
    pages: doc.pages,
    rows: doc.rows.map((r) => ({
      id: r.id,
      analyteId: r.analyteId ?? CUSTOM,
      name: r.name,
      valueText: r.valueText,
      unit: r.unit,
      ...rowFromRange(r.range),
      rangeEdited: false,
      range: r.range,
      flag: r.flag,
      flagRaw: r.flagRaw,
      method: r.method,
      page: r.page,
      snippet: r.snippet,
    })),
  };
}

export function emptyRow(): DraftRow {
  return {
    id: uid('row'),
    analyteId: CUSTOM,
    name: '',
    valueText: '',
    unit: '',
    lowText: '',
    highText: '',
    rangeEdited: false,
    range: null,
    flag: null,
    flagRaw: '',
    method: null,
    page: 0,
    snippet: '',
  };
}

export function manualDraft(label: string): Draft {
  return {
    id: uid('draft'),
    fileName: label,
    source: 'manual',
    hash: null,
    date: '',
    dateLabel: '',
    lab: '',
    sex: null,
    sexDetected: null,
    age: null,
    patient: '',
    decimal: '.',
    pages: 0,
    rows: [emptyRow()],
  };
}

/** Cambia el sexo con el que se eligen los rangos que dependen del sexo y vuelve a leerlos. */
export function setDraftSex(draft: Draft, sex: Sex | null): void {
  draft.sex = sex;
  for (const row of draft.rows) {
    if (row.rangeEdited || !row.range) continue;
    row.range = parseRange(row.range.text, { sex, age: draft.age, decimal: draft.decimal, unit: row.unit });
    Object.assign(row, rowFromRange(row.range));
  }
}

/** Lee un número capturado a mano aceptando coma o punto decimal. */
export function parseInputNumber(text: string, decimal: DecimalSep): number | null {
  const t = cleanText(text);
  if (!t) return null;
  const a = parseNumber(t, decimal) ?? parseNumber(t, decimal === ',' ? '.' : ',');
  return a ? a.value : null;
}

export interface ParsedInputValue {
  value: number | null;
  decimals: number;
  qualifier: Qualifier | null;
  text: string;
}

export function parseInputValue(text: string, decimal: DecimalSep): ParsedInputValue | null {
  const t = cleanText(text);
  if (!t) return null;
  const pv = parseValueStart(t, decimal) ?? parseValueStart(t, decimal === ',' ? '.' : ',');
  if (pv && !/[A-Za-z]{3,}/.test(pv.rest)) return { value: pv.value, decimals: pv.decimals, qualifier: pv.qualifier, text: t };
  // Resultado cualitativo ("Negativo"): se conserva como texto y no se grafica.
  return { value: null, decimals: 0, qualifier: null, text: t };
}

export type DraftErrorField = 'date' | 'name' | 'value' | 'low' | 'high' | 'rows';

export interface DraftError {
  field: DraftErrorField;
  rowId?: string;
}

export function validateDraft(draft: Draft): DraftError[] {
  const errors: DraftError[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || Number.isNaN(Date.parse(draft.date))) errors.push({ field: 'date' });
  if (draft.rows.length === 0) errors.push({ field: 'rows' });
  for (const row of draft.rows) {
    if (row.analyteId === CUSTOM && !cleanText(row.name)) errors.push({ field: 'name', rowId: row.id });
    if (!parseInputValue(row.valueText, draft.decimal)) errors.push({ field: 'value', rowId: row.id });
    if (row.lowText.trim() && parseInputNumber(row.lowText, draft.decimal) === null) errors.push({ field: 'low', rowId: row.id });
    if (row.highText.trim() && parseInputNumber(row.highText, draft.decimal) === null) errors.push({ field: 'high', rowId: row.id });
  }
  return errors;
}

function finalRange(row: DraftRow, decimal: DecimalSep): RefRange | null {
  const unit = normalizeUnit(row.unit);
  if (!row.rangeEdited) return row.range ? { ...row.range, unit: row.range.unit || unit } : null;
  const low = parseInputNumber(row.lowText, decimal);
  const high = parseInputNumber(row.highText, decimal);
  const original = row.range?.text ?? '';
  const sameAsParsed = row.range && low === row.range.low && high === row.range.high;
  if (sameAsParsed) return row.range;
  return manualRange(low, high, low === null && high === null ? original : '', unit);
}

/** Convierte un borrador confirmado en un estudio y sus resultados. */
export function confirmDraft(draft: Draft): { study: Study; results: LabResult[] } {
  const study: Study = {
    id: uid('study'),
    fileName: draft.fileName,
    lab: cleanText(draft.lab),
    date: draft.date,
    source: draft.source,
    sex: draft.sex,
    addedAt: new Date().toISOString(),
    hash: draft.hash,
  };
  const results: LabResult[] = draft.rows.map((row) => {
    const parsed = parseInputValue(row.valueText, draft.decimal)!;
    const known = row.analyteId !== CUSTOM && ANALYTE_BY_ID.has(row.analyteId);
    const name = cleanText(row.name) || (known ? ANALYTE_BY_ID.get(row.analyteId)!.es : '');
    return {
      id: uid('res'),
      studyId: study.id,
      analyteId: known ? row.analyteId : customId(name),
      name,
      valueText: parsed.text,
      value: parsed.value,
      qualifier: parsed.qualifier,
      decimals: parsed.decimals,
      unit: normalizeUnit(row.unit),
      range: finalRange(row, draft.decimal),
      flag: row.flag,
      flagRaw: row.flagRaw || (row.flag === 'high' ? 'H' : row.flag === 'low' ? 'L' : row.flag === 'flag' ? '*' : ''),
      method: row.method,
      page: row.page,
      snippet: row.snippet,
    };
  });
  return { study, results };
}

/** Clave para detectar el mismo resultado cargado dos veces. */
export function resultKey(r: LabResult, study: Study): string {
  return [study.date, r.analyteId, r.valueText, normalizeUnit(r.unit), study.lab.toLowerCase()].join('|');
}
