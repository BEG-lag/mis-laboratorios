/**
 * pdf.js en el navegador. El worker se sirve desde el mismo origen y se crea a partir de una URL
 * blob: para que herede la CSP de la página (connect-src 'none'): ni la página ni el worker pueden
 * hacer peticiones de red. Se crea al arrancar, antes de marcar la app como lista, para que no haya
 * ninguna descarga después.
 */
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { openPdf, pdfText, type PdfDocLike, type PdfjsLike } from './pdf.ts';
import type { PageText } from './types.ts';

let pdfWorker: pdfjs.PDFWorker | null = null;
let starting: Promise<void> | null = null;

export function initPdfWorker(timeoutMs = 15_000): Promise<void> {
  if (starting) return starting;
  starting = new Promise<void>((resolve) => {
    let worker: Worker;
    try {
      const abs = new URL(workerUrl, location.href).href;
      const blob = new Blob([`import ${JSON.stringify(abs)};\n`], { type: 'text/javascript' });
      worker = new Worker(URL.createObjectURL(blob), { type: 'module', name: 'pdf.js' });
    } catch {
      resolve();
      return;
    }
    const done = () => {
      window.clearTimeout(timer);
      worker.removeEventListener('message', done);
      if (!pdfWorker) pdfWorker = new pdfjs.PDFWorker({ port: worker as never, verbosity: 0 });
      resolve();
    };
    const timer = window.setTimeout(done, timeoutMs);
    worker.addEventListener('message', done);
  });
  return starting;
}

async function doc(data: Uint8Array): Promise<PdfDocLike> {
  await initPdfWorker();
  return openPdf(pdfjs as unknown as PdfjsLike, data, pdfWorker ? { worker: pdfWorker } : {});
}

export interface OpenedPdf {
  pages: PageText[];
  numPages: number;
  /** Dibuja una página a imagen (para OCR de PDF escaneados). */
  render(page: number, scale: number): Promise<Blob>;
  close(): Promise<void>;
}

export async function readPdf(data: Uint8Array): Promise<OpenedPdf> {
  const d = await doc(data);
  const pages = await pdfText(d);
  return {
    pages,
    numPages: d.numPages,
    async render(pageNumber: number, scale: number): Promise<Blob> {
      const page = (await d.getPage(pageNumber)) as unknown as pdfjs.PDFPageProxy;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport, background: '#ffffff' }).promise;
      page.cleanup();
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) throw new Error('No se pudo dibujar la página');
      return blob;
    },
    close: () => d.destroy(),
  };
}
