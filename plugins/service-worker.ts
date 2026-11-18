import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite';

function listFiles(dir: string, root = dir): string[] {
  let out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out = out.concat(listFiles(full, root));
    else out.push(relative(root, full).split('\\').join('/'));
  }
  return out;
}

/**
 * Service worker mínimo, sin dependencias: precachea la app para que funcione sin conexión.
 * El motor de OCR (carpeta ocr/, varios MB) no se precachea: se guarda en caché la primera vez
 * que la persona activa el OCR. Sólo atiende peticiones GET del mismo origen.
 */
function swSource(cacheName: string, assets: string[]): string {
  return `/* mis-laboratorios service worker (generado en el build) */
const CACHE = ${JSON.stringify(cacheName)};
const OCR_CACHE = 'mis-laboratorios-ocr-v1';
const ASSETS = ${JSON.stringify(assets)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== OCR_CACHE && k.startsWith('mis-laboratorios-')).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          if (response.ok) caches.open(CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html', { ignoreVary: true }).then((cached) => cached || Response.error())),
    );
    return;
  }
  if (url.pathname.includes('/ocr/')) {
    // Motor de OCR: primero la caché; si no está, se descarga del mismo sitio y se guarda.
    event.respondWith(
      caches.open(OCR_CACHE).then((cache) =>
        cache.match(request, { ignoreVary: true }).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            }),
        ),
      ),
    );
    return;
  }
  // ignoreVary: algunos servidores responden con "Vary: Origin" y los scripts de módulo
  // envían Origin; los archivos son estáticos y del mismo origen, así que es seguro ignorarlo.
  event.respondWith(caches.match(request, { ignoreVary: true }).then((cached) => cached || fetch(request)));
});
`;
}

export function serviceWorkerPlugin(): Plugin {
  let config: ResolvedConfig;
  return {
    name: 'mis-laboratorios:service-worker',
    apply: 'build',
    enforce: 'post',
    configResolved(resolved) {
      config = resolved;
    },
    generateBundle(_options, bundle) {
      const fromBundle = Object.keys(bundle);
      let fromPublic: string[];
      try {
        fromPublic = listFiles(config.publicDir);
      } catch {
        fromPublic = [];
      }
      const assets = ['./', ...new Set([...fromBundle, ...fromPublic])]
        .filter((f) => f !== 'sw.js' && !f.startsWith('ocr/') && !f.endsWith('.map') && !/\.woff$/.test(f))
        .sort();
      const digest = createHash('sha256').update(assets.join('\n'));
      for (const name of assets) {
        const item = bundle[name];
        if (!item) continue;
        digest.update(item.type === 'chunk' ? item.code : typeof item.source === 'string' ? item.source : Buffer.from(item.source));
      }
      const hash = digest.digest('hex').slice(0, 12);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: swSource(`mis-laboratorios-${hash}`, assets) });
    },
  };
}
