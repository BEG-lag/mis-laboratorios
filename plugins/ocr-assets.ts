import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

/**
 * Motor de OCR autoalojado (tesseract.js + tesseract.js-core + modelo en español).
 *
 * Todo se sirve desde el mismo origen bajo ocr/<huella>/ y sólo se descarga si la persona activa
 * el OCR. Ningún archivo se pide a una CDN. El modelo de idioma (.traineddata) se envuelve en un
 * script para que el worker lo cargue con importScripts (permitido por script-src 'self') sin usar
 * fetch: el worker nace de una URL blob:, hereda la CSP de la página y connect-src 'none' le impide
 * cualquier petición de red.
 */

const require = createRequire(import.meta.url);
const VIRTUAL_ID = 'virtual:ocr-assets';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

interface OcrFile {
  name: string;
  load: () => Buffer | string;
}

function pkgDir(name: string): string {
  return dirname(require.resolve(`${name}/package.json`));
}

function version(name: string): string {
  return (JSON.parse(readFileSync(join(pkgDir(name), 'package.json'), 'utf8')) as { version: string }).version;
}

const CORE_VARIANTS = ['tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'];
const TRAINEDDATA = join('4.0.0_best_int', 'spa.traineddata.gz');

/** Carpeta versionada para que una actualización del motor no use archivos viejos de la caché. */
export function ocrDir(): string {
  const id = `${version('tesseract.js')}|${version('tesseract.js-core')}|${version('@tesseract.js-data/spa')}`;
  return `ocr/${createHash('sha256').update(id).digest('hex').slice(0, 10)}/`;
}

function workerWrapper(base: string, dir: string): string {
  return `/* mis-laboratorios: worker de OCR sin red (generado en el build). */
(function () {
  'use strict';
  var href = String(self.location.href);
  var origin = href.indexOf('blob:') === 0 ? new URL(href.slice(5)).origin : self.location.origin;
  var dir = origin + ${JSON.stringify(base + dir)};
  importScripts(dir + 'spa.traineddata.gz.js');
  var b64 = self.__misLaboratoriosSpa;
  self.__misLaboratoriosSpa = undefined;
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // tesseract.js pide el modelo con fetch(); aquí se entrega desde memoria. Cualquier otra
  // petición se rechaza (y la CSP heredada también la bloquearía).
  self.fetch = function (input) {
    var url = typeof input === 'string' ? input : input && input.url;
    if (/\\/spa\\.traineddata\\.gz$/.test(String(url))) return Promise.resolve(new Response(bytes.slice()));
    return Promise.reject(new TypeError('mis-laboratorios: el OCR no usa la red'));
  };
  importScripts(dir + 'worker.min.js');
})();
`;
}

function files(base: string, dir: string): OcrFile[] {
  const tess = pkgDir('tesseract.js');
  const core = pkgDir('tesseract.js-core');
  const spa = pkgDir('@tesseract.js-data/spa');
  const licenses = () =>
    [
      'Motor de OCR incluido en mis-laboratorios. Licencias de terceros:',
      '',
      `tesseract.js ${version('tesseract.js')} (Apache-2.0) https://github.com/naptha/tesseract.js`,
      `tesseract.js-core ${version('tesseract.js-core')} (Apache-2.0) https://github.com/naptha/tesseract.js-core`,
      `Modelo spa.traineddata (Apache-2.0) https://github.com/tesseract-ocr/tessdata_best`,
      '',
      readFileSync(join(core, 'LICENSE'), 'utf8'),
    ].join('\n');
  return [
    { name: 'ocr-worker.js', load: () => workerWrapper(base, dir) },
    { name: 'worker.min.js', load: () => readFileSync(join(tess, 'dist', 'worker.min.js')) },
    ...CORE_VARIANTS.map((name) => ({ name, load: () => readFileSync(join(core, name)) })),
    {
      name: 'spa.traineddata.gz.js',
      load: () => `self.__misLaboratoriosSpa=${JSON.stringify(readFileSync(join(spa, TRAINEDDATA)).toString('base64'))};\n`,
    },
    { name: 'LICENSES.txt', load: licenses },
  ];
}

export function ocrAssetsPlugin(): Plugin {
  let config: ResolvedConfig;
  const dir = ocrDir();
  return {
    name: 'mis-laboratorios:ocr-assets',
    configResolved(resolved) {
      config = resolved;
    },
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      // Descarga aproximada la primera vez: worker + el núcleo más grande + modelo de idioma.
      const list = files(config.base, dir);
      const size = (name: string) => Buffer.byteLength(list.find((f) => f.name === name)!.load());
      const bytes = size('ocr-worker.js') + size('worker.min.js') + Math.max(...CORE_VARIANTS.map(size)) + size('spa.traineddata.gz.js');
      return `export const OCR_DIR = ${JSON.stringify(dir)};\nexport const OCR_MB = ${(bytes / 1_000_000).toFixed(1)};\n`;
    },
    configureServer(server) {
      const base = config.base;
      const list = files(base, dir);
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0] ?? '';
        const prefix = `${base}${dir}`;
        if (!path.startsWith(prefix)) return next();
        const file = list.find((f) => f.name === path.slice(prefix.length));
        if (!file) return next();
        res.setHeader('Content-Type', file.name.endsWith('.txt') ? 'text/plain; charset=utf-8' : 'text/javascript; charset=utf-8');
        res.end(file.load());
      });
    },
    generateBundle() {
      if (config.command !== 'build') return;
      for (const file of files(config.base, dir)) {
        this.emitFile({ type: 'asset', fileName: `${dir}${file.name}`, source: file.load() });
      }
    },
  };
}
