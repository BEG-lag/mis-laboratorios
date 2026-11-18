import type { Plugin } from 'vite';

/**
 * Política de seguridad de contenido que se inyecta sólo en el build de producción.
 *
 * - connect-src 'none' impide que la página haga peticiones de red (fetch, XHR, WebSocket,
 *   sendBeacon): tus resultados no pueden salir del navegador aunque alguien lo intente.
 * - Los workers (pdf.js y OCR) se crean desde URL blob: para que HEREDEN esta política; así
 *   tampoco pueden hacer peticiones de red. Por eso worker-src permite blob:.
 * - 'wasm-unsafe-eval' sólo permite compilar WebAssembly (el motor de OCR); no habilita eval de
 *   JavaScript.
 */
export const CSP = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');

export function cspPlugin(): Plugin {
  return {
    name: 'mis-laboratorios:csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}
