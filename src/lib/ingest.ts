/**
 * Lectura de archivos: PDF con texto, PDF escaneados y fotos (con OCR, si está activado).
 * Devuelve borradores para revisar y la lista de archivos que no se pudieron leer, con el motivo.
 */
import { parseDocument } from './extract.ts';
import { isPdf, PdfReadError, textChars } from './pdf.ts';
import { draftFromParsed, type Draft } from './review.ts';
import type { PageText } from './types.ts';

export type IssueCode =
  | 'unsupported'
  | 'heic'
  | 'too-large'
  | 'password'
  | 'invalid'
  | 'scanned-no-ocr'
  | 'image-no-ocr'
  | 'no-results'
  | 'ocr-failed'
  | 'duplicate'
  | 'read-error';

export interface FileIssue {
  name: string;
  code: IssueCode;
  detail?: string;
}

export interface OpenedPdfLike {
  pages: PageText[];
  numPages: number;
  render(page: number, scale: number): Promise<Blob>;
  close(): Promise<void>;
}

export interface IngestProgress {
  file: string;
  index: number;
  total: number;
  stage: 'reading' | 'ocr';
  page?: number;
  pages?: number;
}

export interface IngestDeps {
  readPdf(bytes: Uint8Array): Promise<OpenedPdfLike>;
  /** Presente sólo si la persona activó el OCR. */
  ocr?: (image: Blob, page: number) => Promise<PageText>;
  onProgress?: (p: IngestProgress) => void;
  knownHashes: Set<string>;
}

export const MAX_BYTES = 50 * 1024 * 1024;
/** Páginas máximas a las que se aplica OCR por archivo (el OCR es lento). */
export const MAX_OCR_PAGES = 8;
/** Menos caracteres que esto en todo el PDF: se considera escaneado. */
export const SCANNED_THRESHOLD = 40;

export type FileKind = 'pdf' | 'image' | 'heic' | 'unsupported';

export function fileKind(name: string, bytes: Uint8Array): FileKind {
  if (isPdf(bytes)) return 'pdf';
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image';
  const ascii = new TextDecoder('latin1').decode(b.subarray(4, 12));
  if (/ftyp(heic|heix|mif1|msf1|hevc)/.test(ascii) || /\.(heic|heif)$/i.test(name)) return 'heic';
  return 'unsupported';
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return Array.from(new Uint8Array(digest), (x) => x.toString(16).padStart(2, '0')).join('');
}

async function ocrPdf(pdf: OpenedPdfLike, deps: IngestDeps, file: string, index: number, total: number): Promise<PageText[]> {
  const pages: PageText[] = [];
  const n = Math.min(pdf.numPages, MAX_OCR_PAGES);
  for (let p = 1; p <= n; p++) {
    deps.onProgress?.({ file, index, total, stage: 'ocr', page: p, pages: n });
    const image = await pdf.render(p, 2.5);
    pages.push(await deps.ocr!(image, p));
  }
  return pages;
}

export async function ingestFiles(files: File[], deps: IngestDeps): Promise<{ drafts: Draft[]; issues: FileIssue[] }> {
  const drafts: Draft[] = [];
  const issues: FileIssue[] = [];
  for (let index = 0; index < files.length; index++) {
    const file = files[index]!;
    const name = file.name || 'archivo';
    deps.onProgress?.({ file: name, index, total: files.length, stage: 'reading' });
    if (file.size > MAX_BYTES) {
      issues.push({ name, code: 'too-large' });
      continue;
    }
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch (err) {
      issues.push({ name, code: 'read-error', detail: err instanceof Error ? err.message : String(err) });
      continue;
    }
    const kind = fileKind(name, bytes);
    if (kind === 'unsupported' || kind === 'heic') {
      issues.push({ name, code: kind });
      continue;
    }
    const hash = await sha256(bytes);
    if (deps.knownHashes.has(hash)) {
      issues.push({ name, code: 'duplicate' });
      continue;
    }
    try {
      if (kind === 'image') {
        if (!deps.ocr) {
          issues.push({ name, code: 'image-no-ocr' });
          continue;
        }
        deps.onProgress?.({ file: name, index, total: files.length, stage: 'ocr', page: 1, pages: 1 });
        const page = await deps.ocr(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: file.type || 'image/png' }), 1);
        const doc = parseDocument([page]);
        if (doc.rows.length === 0) {
          issues.push({ name, code: 'no-results' });
          continue;
        }
        drafts.push(draftFromParsed(doc, name, 'ocr', hash));
        deps.knownHashes.add(hash);
        continue;
      }
      const pdf = await deps.readPdf(bytes);
      try {
        let pages = pdf.pages;
        let source: 'pdf' | 'ocr' = 'pdf';
        const scanned = textChars(pages) < SCANNED_THRESHOLD;
        if (scanned && !deps.ocr) {
          issues.push({ name, code: 'scanned-no-ocr' });
          continue;
        }
        let doc = scanned ? null : parseDocument(pages);
        if ((!doc || doc.rows.length === 0) && deps.ocr) {
          try {
            pages = await ocrPdf(pdf, deps, name, index, files.length);
            source = 'ocr';
            doc = parseDocument(pages);
          } catch (err) {
            issues.push({ name, code: 'ocr-failed', detail: err instanceof Error ? err.message : String(err) });
            continue;
          }
        }
        if (!doc || doc.rows.length === 0) {
          issues.push({ name, code: 'no-results' });
          continue;
        }
        drafts.push(draftFromParsed(doc, name, source, hash));
        deps.knownHashes.add(hash);
      } finally {
        await pdf.close().catch(() => undefined);
      }
    } catch (err) {
      if (err instanceof PdfReadError) issues.push({ name, code: err.code === 'password' ? 'password' : 'invalid', detail: err.message });
      else issues.push({ name, code: kind === 'image' ? 'ocr-failed' : 'invalid', detail: err instanceof Error ? err.message : String(err) });
    }
  }
  return { drafts, issues };
}
