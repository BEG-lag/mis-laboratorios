/**
 * Fechas como las imprimen los laboratorios en México (día primero): 14/03/2024, 14-03-24,
 * 14-mar-2024, 14 de marzo de 2024, 2024-03-14.
 */
import { fold } from './text.ts';

const MONTHS: Record<string, number> = {
  ene: 1,
  enero: 1,
  jan: 1,
  feb: 2,
  febrero: 2,
  mar: 3,
  marzo: 3,
  abr: 4,
  abril: 4,
  apr: 4,
  may: 5,
  mayo: 5,
  jun: 6,
  junio: 6,
  jul: 7,
  julio: 7,
  ago: 8,
  agosto: 8,
  aug: 8,
  sep: 9,
  sept: 9,
  septiembre: 9,
  set: 9,
  setiembre: 9,
  oct: 10,
  octubre: 10,
  nov: 11,
  noviembre: 11,
  dic: 12,
  diciembre: 12,
  dec: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += y >= 70 ? 1900 : 2000;
  if (y < 1950 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const MONTH_WORD = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join('|');

const PATTERNS: { re: RegExp; get: (m: RegExpExecArray) => string | null }[] = [
  { re: /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/, get: (m) => iso(+m[1]!, +m[2]!, +m[3]!) },
  { re: /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/, get: (m) => iso(+m[3]!, +m[2]!, +m[1]!) },
  {
    re: new RegExp(String.raw`\b(\d{1,2})[\s/.-]*(?:de\s+)?(${MONTH_WORD})\.?[\s/.-]*(?:de(?:l)?\s+)?(\d{4}|\d{2})\b`),
    get: (m) => iso(+m[3]!, MONTHS[m[2]!]!, +m[1]!),
  },
];

/** Primera fecha válida dentro de un texto, en formato AAAA-MM-DD. */
export function parseDate(text: string): string | null {
  const t = fold(text);
  let best: { index: number; value: string } | null = null;
  for (const p of PATTERNS) {
    const m = p.re.exec(t);
    if (!m) continue;
    const value = p.get(m);
    if (value && (!best || m.index < best.index)) best = { index: m.index, value };
  }
  return best?.value ?? null;
}

/** Etiquetas de fecha por prioridad: la fecha de toma de muestra es la del estudio. */
const DATE_LABELS: { re: RegExp; priority: number; label: string }[] = [
  { re: /fecha\s+(?:y\s+hora\s+)?de\s+(?:la\s+)?(?:toma|muestra|recoleccion|extraccion|obtencion)(?:\s+de(?:\s+la)?\s+muestra)?/, priority: 1, label: 'toma de muestra' },
  { re: /\b(?:toma\s+de\s+muestra|muestra\s+tomada|tomada\s+el)\b/, priority: 1, label: 'toma de muestra' },
  { re: /fecha\s+de\s+(?:recepcion|registro|ingreso|admision|orden|solicitud)/, priority: 2, label: 'recepción' },
  { re: /fecha\s+de\s+(?:validacion|liberacion|resultado|resultados|reporte|informe|entrega|analisis)/, priority: 3, label: 'resultado' },
  { re: /fecha\s+de\s+(?:emision|impresion|expedicion)/, priority: 4, label: 'impresión' },
  { re: /\bfecha\b(?!\s+de\s+nac)(?!\s+nac)/, priority: 5, label: 'fecha' },
];

export interface FoundDate {
  date: string;
  label: string;
  priority: number;
}

/** Busca la fecha del estudio en las líneas del reporte (nunca la de nacimiento). */
export function findStudyDate(lines: string[]): FoundDate | null {
  let best: FoundDate | null = null;
  for (const line of lines) {
    const folded = fold(line);
    for (const { re, priority, label } of DATE_LABELS) {
      const g = new RegExp(re.source, 'g');
      for (let m = g.exec(folded); m; m = g.exec(folded)) {
        const tail = line.slice(m.index + m[0].length, m.index + m[0].length + 48);
        // Lo que sigue a la etiqueta, hasta la siguiente etiqueta conocida.
        const cut = tail.split(/\s{3,}|\t|\b(?:Fecha|Edad|Sexo|Folio|Paciente|M[eé]dico|Orden)\b/i)[0] ?? tail;
        const date = parseDate(cut);
        if (date && (!best || priority < best.priority)) best = { date, label, priority };
      }
    }
  }
  return best;
}
