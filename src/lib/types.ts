export type Lang = 'es' | 'en';

/** Sexo con el que el laboratorio elige su rango de referencia (M = masculino, F = femenino). */
export type Sex = 'M' | 'F';

/** Marca que imprimió el laboratorio junto al valor. */
export type FlagDir = 'high' | 'low' | 'flag';

export type Qualifier = '<' | '>' | '<=' | '>=';

/** Un bloque de texto con su posición horizontal en la página (puntos PDF o píxeles de OCR). */
export interface TextCell {
  text: string;
  x0: number;
  x1: number;
  size: number;
}

export interface TextLine {
  y: number;
  cells: TextCell[];
}

export interface PageText {
  page: number;
  width: number;
  height: number;
  lines: TextLine[];
}

/** Rango de referencia tal como lo imprimió el laboratorio, más los límites que se pudieron leer. */
export interface RefRange {
  text: string;
  low: number | null;
  high: number | null;
  lowInclusive: boolean;
  highInclusive: boolean;
  /**
   * interval: "70 - 100"; upper: "< 200", "Hasta 150"; lower: "> 40"; categories: varias
   * categorías del laboratorio (no se elige ninguna); bySex / byAge: depende del sexo o la edad y
   * no se pudo elegir; qualitative: "Negativo"; none: sin rango legible.
   */
  kind: 'interval' | 'upper' | 'lower' | 'categories' | 'bySex' | 'byAge' | 'qualitative' | 'none';
  /** Etiqueta elegida cuando el rango depende del sexo o la edad ("Hombres", "Adultos"). */
  label: string;
  /** Unidad que venía dentro del texto del rango ("70 - 100 mg/dL"). */
  unit: string;
}

export interface ExtractedRow {
  id: string;
  analyteId: string | null;
  name: string;
  valueText: string;
  value: number | null;
  qualifier: Qualifier | null;
  decimals: number;
  unit: string;
  range: RefRange | null;
  flag: FlagDir | null;
  flagRaw: string;
  method: string | null;
  section: string;
  page: number;
  snippet: string;
}

export interface DocMeta {
  lab: string;
  date: string | null;
  dateLabel: string;
  sex: Sex | null;
  age: number | null;
  patient: string;
}

export interface ParsedDocument {
  meta: DocMeta;
  rows: ExtractedRow[];
  decimal: ',' | '.';
  pages: number;
  textChars: number;
}

export type StudySource = 'pdf' | 'ocr' | 'manual' | 'demo';

/** Un estudio confirmado por la persona (un PDF, una foto o una captura manual). */
export interface Study {
  id: string;
  fileName: string;
  lab: string;
  date: string;
  source: StudySource;
  sex: Sex | null;
  addedAt: string;
  /** Huella SHA-256 del archivo, para avisar si se vuelve a cargar. */
  hash?: string | null;
}

/** Un resultado confirmado. analyteId es un id del diccionario o "custom:<nombre normalizado>". */
export interface LabResult {
  id: string;
  studyId: string;
  analyteId: string;
  name: string;
  valueText: string;
  value: number | null;
  qualifier: Qualifier | null;
  decimals: number;
  unit: string;
  range: RefRange | null;
  flag: FlagDir | null;
  flagRaw: string;
  method: string | null;
  page: number;
  snippet: string;
}
