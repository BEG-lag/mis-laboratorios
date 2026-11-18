/**
 * OCR opcional con tesseract.js autoalojado. Sólo se carga si la persona activa el OCR.
 *
 * - El motor (worker, núcleo WebAssembly y modelo en español) se sirve desde este mismo sitio,
 *   en la carpeta ocr/<huella>/; nunca desde una CDN.
 * - El worker nace de una URL blob: y hereda la CSP de la página, así que no puede hacer
 *   peticiones de red; el modelo se carga como script (importScripts), no con fetch.
 * - cacheMethod 'none': tesseract.js no guarda nada en IndexedDB.
 */
import { OCR_DIR } from 'virtual:ocr-assets';
import { ocrWordsToPage, type OcrWord } from './layout.ts';
import type { PageText } from './types.ts';

type TesseractWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;

let workerPromise: Promise<TesseractWorker> | null = null;
let progressListener: ((status: string, progress: number) => void) | null = null;

export function onOcrProgress(listener: ((status: string, progress: number) => void) | null): void {
  progressListener = listener;
}

export function ocrBaseUrl(): string {
  return new URL(`${import.meta.env.BASE_URL}${OCR_DIR}`, location.href).href;
}

async function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, OEM } = await import('tesseract.js');
      const base = ocrBaseUrl();
      const worker = await createWorker('spa', OEM.LSTM_ONLY, {
        workerPath: `${base}ocr-worker.js`,
        corePath: base,
        langPath: base.replace(/\/$/, ''),
        cacheMethod: 'none',
        gzip: true,
        workerBlobURL: true,
        logger: (m: { status: string; progress: number }) => progressListener?.(m.status, m.progress),
        errorHandler: () => undefined,
      });
      await worker.setParameters({ tessedit_pageseg_mode: '3' as never, preserve_interword_spaces: '1', user_defined_dpi: '200' });
      return worker;
    })();
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

interface Block {
  paragraphs: { lines: { words: OcrWord[] }[] }[];
}

/** Reconoce el texto de una imagen y lo devuelve como renglones y celdas. */
export async function ocrImage(image: Blob, pageNumber: number): Promise<PageText> {
  const worker = await getWorker();
  const bitmap = await createImageBitmap(image);
  const { width, height } = bitmap;
  bitmap.close();
  const { data } = await worker.recognize(image, {}, { blocks: true, text: false });
  const blocks = ((data as unknown as { blocks: Block[] | null }).blocks ?? []) as Block[];
  const words = blocks.flatMap((b) => b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)));
  return ocrWordsToPage(words, pageNumber, width, height);
}

export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return;
  const w = await workerPromise.catch(() => null);
  workerPromise = null;
  await w?.terminate();
}
