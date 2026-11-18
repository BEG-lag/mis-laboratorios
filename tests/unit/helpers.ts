import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { groupLines, type PositionedText } from '../../src/lib/layout.ts';
import { openPdf, pdfText, type PdfjsLike } from '../../src/lib/pdf.ts';
import type { PageText } from '../../src/lib/types.ts';

export const FIXTURES = join(import.meta.dirname, '..', 'fixtures');

export function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(join(FIXTURES, name)));
}

export const PDFJS = pdfjs as unknown as PdfjsLike;

export async function pdfPages(name: string): Promise<PageText[]> {
  const doc = await openPdf(PDFJS, fixture(name));
  try {
    return await pdfText(doc);
  } finally {
    await doc.destroy();
  }
}

/** Página a partir de renglones escritos a mano: cada renglón es una lista de [x, texto]. */
export function page(rows: [number, string][][], size = 9): PageText {
  const items: PositionedText[] = [];
  rows.forEach((cells, i) => {
    for (const [x, text] of cells) items.push({ text, x, y: 100 + i * 14, width: text.length * size * 0.5, size });
  });
  return { page: 1, width: 612, height: 792, lines: groupLines(items) };
}
