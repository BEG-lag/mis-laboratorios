/**
 * Lectura del texto de un PDF con pdf.js. El módulo de pdf.js se recibe como parámetro para usar
 * la misma lógica en el navegador (con su worker) y en las pruebas con Node.
 */
import { pdfItemsToPage, type PdfTextItem } from './layout.ts';
import type { PageText } from './types.ts';

interface PdfPageLike {
  getViewport(params: { scale: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: unknown[] }>;
  cleanup(): void;
}

export interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
  /** Libera el documento (destruye su tarea de carga; un worker compartido sigue vivo). */
  destroy(): Promise<void>;
}

export interface PdfjsLike {
  getDocument(src: Record<string, unknown>): { promise: Promise<unknown>; destroy(): Promise<void> };
}

export type PdfErrorCode = 'password' | 'invalid' | 'unknown';

export class PdfReadError extends Error {
  code: PdfErrorCode;
  constructor(code: PdfErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function isPdf(bytes: Uint8Array): boolean {
  // "%PDF" puede venir después de algunos bytes basura; pdf.js lo busca en los primeros 1024.
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 1024));
  return head.includes('%PDF-');
}

/** Opciones de pdf.js: sin eval, sin fuentes del sistema, sin descargar nada. */
export function pdfOptions(data: Uint8Array, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    data,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    useWorkerFetch: false,
    useWasm: false,
    enableXfa: false,
    stopAtErrors: false,
    verbosity: 0,
    ...extra,
  };
}

export async function openPdf(pdfjs: PdfjsLike, data: Uint8Array, extra: Record<string, unknown> = {}): Promise<PdfDocLike> {
  const task = pdfjs.getDocument(pdfOptions(data, extra));
  try {
    const doc = (await task.promise) as Omit<PdfDocLike, 'destroy'>;
    return { numPages: doc.numPages, getPage: (n) => doc.getPage(n), destroy: () => task.destroy() };
  } catch (err) {
    await task.destroy().catch(() => undefined);
    const name = (err as { name?: string })?.name ?? '';
    if (name === 'PasswordException') throw new PdfReadError('password', 'PDF protegido con contraseña');
    if (name === 'InvalidPDFException' || name === 'FormatError') throw new PdfReadError('invalid', 'PDF dañado o inválido');
    throw new PdfReadError('unknown', err instanceof Error ? err.message : String(err));
  }
}

/** Texto posicionado de todas las páginas. */
export async function pdfText(doc: PdfDocLike): Promise<PageText[]> {
  const pages: PageText[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.filter((i): i is PdfTextItem => typeof (i as PdfTextItem).str === 'string');
    pages.push(pdfItemsToPage(items, n, viewport.width, viewport.height));
    page.cleanup();
  }
  return pages;
}

/** Caracteres de texto útiles: un PDF escaneado casi no tiene. */
export function textChars(pages: PageText[]): number {
  return pages.reduce((sum, p) => sum + p.lines.reduce((s, l) => s + l.cells.reduce((x, c) => x + c.text.replace(/\s/g, '').length, 0), 0), 0);
}
