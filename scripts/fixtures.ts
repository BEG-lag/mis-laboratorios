/**
 * Genera los PDF SINTÉTICOS de prueba en tests/fixtures/ a partir de src/lib/synthetic.ts.
 *
 * - PDF con texto (pdf-lib, Helvetica) para las maquetas clasico, coma, historico y dos-columnas.
 * - Un PDF escaneado (sólo imagen, sin texto) y una foto JPG para el OCR: se dibuja el reporte en
 *   Chromium (Playwright) y se fotografía la página.
 * - Casos de error: un PDF sin resultados, un PDF dañado, un archivo de texto y un PDF con dos
 *   páginas de un mismo estudio.
 *
 * Uso: npm run fixtures
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { drawReport, REPORTS, type DrawnPage } from '../src/lib/synthetic.ts';

const root = join(import.meta.dirname, '..');
const outDir = join(root, 'tests', 'fixtures');
mkdirSync(outDir, { recursive: true });

const FIXED_DATE = new Date('2026-01-01T00:00:00Z');

async function newDoc(title: string): Promise<PDFDocument> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor('mis-laboratorios (datos sintéticos)');
  pdf.setProducer('mis-laboratorios fixtures');
  pdf.setCreator('pdf-lib');
  pdf.setCreationDate(FIXED_DATE);
  pdf.setModificationDate(FIXED_DATE);
  return pdf;
}

async function textPdf(pages: DrawnPage[], title: string): Promise<Uint8Array> {
  const pdf = await newDoc(title);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const p of pages) {
    const page = pdf.addPage([p.width, p.height]);
    for (const item of p.items) {
      page.drawText(item.text, { x: item.x, y: p.height - item.y, size: item.size, font: item.bold ? bold : regular, color: rgb(0.08, 0.08, 0.1) });
    }
  }
  return pdf.save({ useObjectStreams: false });
}

function pageHtml(p: DrawnPage, scale: number): string {
  const spans = p.items
    .map((i) => {
      const esc = i.text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      return `<span style="left:${(i.x * scale).toFixed(1)}px;top:${((i.y - i.size * 0.8) * scale).toFixed(1)}px;font-size:${(i.size * scale).toFixed(1)}px;font-weight:${i.bold ? 700 : 400}">${esc}</span>`;
    })
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;background:#fff}
    .page{position:relative;width:${p.width * scale}px;height:${p.height * scale}px;background:#fbfaf7;font-family:Helvetica,Arial,sans-serif;color:#1a1a1a}
    span{position:absolute;white-space:pre;line-height:1}
  </style></head><body><div class="page">${spans}</div></body></html>`;
}

async function main(): Promise<void> {
  const written: string[] = [];
  const write = (name: string, bytes: Uint8Array | string) => {
    writeFileSync(join(outDir, name), bytes);
    written.push(name);
  };

  for (const rep of REPORTS.filter((r) => r.layout !== 'escaneado')) {
    write(rep.file, await textPdf(drawReport(rep), `Reporte sintético ${rep.date}`));
  }

  // Escaneado: la página se dibuja en Chromium y se guarda como imagen.
  const scanned = REPORTS.find((r) => r.layout === 'escaneado')!;
  const [page] = drawReport(scanned);
  const scale = 2.5;
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: Math.round(page!.width * scale), height: Math.round(page!.height * scale) }, deviceScaleFactor: 1 });
  await tab.setContent(pageHtml(page!, scale));
  const jpg = await tab.screenshot({ type: 'jpeg', quality: 82, fullPage: true });
  await browser.close();
  {
    const pdf = await newDoc(`Reporte sintético escaneado ${scanned.date}`);
    const img = await pdf.embedJpg(jpg);
    const p = pdf.addPage([page!.width, page!.height]);
    p.drawImage(img, { x: 0, y: 0, width: page!.width, height: page!.height });
    write(scanned.file, await pdf.save({ useObjectStreams: false }));
  }
  write('foto-resultados-2026-06.jpg', jpg);

  // Un PDF con texto que no es un reporte de laboratorio.
  {
    const pdf = await newDoc('Carta sintética');
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const p = pdf.addPage([612, 792]);
    const lines = [
      'Carta de ejemplo',
      'Ciudad de Ejemplo, a 3 de marzo de 2024',
      'Estimada persona de prueba:',
      'Le confirmamos su cita número 4521 para el día 12 de abril a las 10:30 horas.',
      'Total a pagar: 1,250.00 pesos. Folio de pago 998877.',
      'Atentamente, Clínica Inventada',
    ];
    lines.forEach((t, i) => p.drawText(t, { x: 60, y: 720 - i * 22, size: 11, font }));
    write('no-es-reporte.pdf', await pdf.save({ useObjectStreams: false }));
  }

  // PDF dañado: un reporte real truncado a la mitad.
  {
    const full = await textPdf(drawReport(REPORTS[0]!), 'Reporte truncado');
    write('danado.pdf', full.subarray(0, Math.floor(full.length / 3)));
  }

  write('notas.txt', 'Esto no es un PDF ni una imagen.\n');

  console.log(`Fixtures en ${outDir}:\n  ${written.join('\n  ')}`);
}

await main();
