/**
 * Convierte el texto posicionado de una página (pdf.js u OCR) en renglones y celdas.
 * Una celda es un bloque de texto separado de los demás por un espacio horizontal amplio,
 * lo que en un reporte de laboratorio corresponde casi siempre a una columna.
 */
import type { PageText, TextCell, TextLine } from './types.ts';

export interface PositionedText {
  text: string;
  /** Izquierda, en unidades de la página. */
  x: number;
  /** Línea base o centro vertical; crece hacia abajo. */
  y: number;
  width: number;
  /** Alto de la letra. */
  size: number;
}

/** Agrupa fragmentos en renglones (por altura) y celdas (por separación horizontal). */
export function groupLines(items: PositionedText[], cellGap = 0.9): TextLine[] {
  const usable = items.filter((i) => i.text.trim() !== '' && Number.isFinite(i.x) && Number.isFinite(i.y));
  usable.sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: PositionedText[][] = [];
  for (const item of usable) {
    const row = rows[rows.length - 1];
    if (row) {
      const ref = row[0]!;
      const tol = Math.max(1.5, 0.45 * Math.min(ref.size, item.size));
      if (Math.abs(item.y - ref.y) <= tol) {
        row.push(item);
        continue;
      }
    }
    rows.push([item]);
  }
  return rows.map((row) => {
    row.sort((a, b) => a.x - b.x);
    const cells: TextCell[] = [];
    for (const item of row) {
      const prev = cells[cells.length - 1];
      const size = item.size || 10;
      const gap = prev ? item.x - prev.x1 : Infinity;
      if (prev && gap <= cellGap * size) {
        const needsSpace = gap > 0.12 * size && !prev.text.endsWith(' ') && !item.text.startsWith(' ');
        prev.text = `${prev.text}${needsSpace ? ' ' : ''}${item.text}`;
        prev.x1 = Math.max(prev.x1, item.x + item.width);
        prev.size = Math.max(prev.size, size);
      } else {
        cells.push({ text: item.text, x0: item.x, x1: item.x + item.width, size });
      }
    }
    for (const c of cells) c.text = c.text.replace(/\s+/g, ' ').trim();
    const y = row.reduce((s, i) => s + i.y, 0) / row.length;
    return { y, cells: cells.filter((c) => c.text !== '') };
  });
}

/** Elemento de texto de pdf.js (TextItem). */
export interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

/** Texto de una página de pdf.js a renglones; el eje y se invierte para que crezca hacia abajo. */
export function pdfItemsToPage(items: PdfTextItem[], pageNumber: number, width: number, height: number): PageText {
  const positioned: PositionedText[] = items.map((it) => {
    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = it.transform;
    const size = Math.hypot(c, d) || Math.hypot(a, b) || it.height || 10;
    return { text: it.str, x: e, y: height - f, width: it.width, size };
  });
  return { page: pageNumber, width, height, lines: groupLines(positioned) };
}

export interface OcrWord {
  text: string;
  confidence?: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/** Correcciones mínimas de OCR dentro de números: O por 0, l o I por 1. */
export function fixOcrToken(token: string): string {
  if (!/\d/.test(token)) return token;
  const letters = token.replace(/[^A-Za-z]/g, '').length;
  if (letters > 2) return token;
  return token.replace(/(?<=\d)[Oo](?=[\d.,]|$)|(?<=^|[<>])[Oo](?=[.,]\d)/g, '0').replace(/(?<=\d)[lI](?=[\d.,]|$)|^[lI](?=[\d.,]\d)/g, '1');
}

/**
 * Palabras de OCR a renglones. Se ignora la segmentación en bloques de Tesseract (que suele
 * partir las tablas por columnas) y se reagrupa por altura, como en un PDF con texto.
 */
export function ocrWordsToPage(words: OcrWord[], pageNumber: number, width: number, height: number): PageText {
  const heights = words.map((w) => w.bbox.y1 - w.bbox.y0).filter((h) => h > 0).sort((a, b) => a - b);
  const median = heights[Math.floor(heights.length / 2)] ?? 12;
  const positioned: PositionedText[] = words
    .filter((w) => w.text.trim() !== '' && (w.confidence ?? 100) > 20)
    .map((w) => ({
      text: fixOcrToken(w.text.trim()),
      x: w.bbox.x0,
      y: (w.bbox.y0 + w.bbox.y1) / 2,
      width: w.bbox.x1 - w.bbox.x0,
      size: median,
    }));
  return { page: pageNumber, width, height, lines: groupLines(positioned, 1.1) };
}

/** Texto de un renglón con las celdas separadas por tabuladores. */
export function lineText(line: TextLine): string {
  return line.cells.map((c) => c.text).join('\t');
}
