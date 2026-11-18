import { defineConfig } from 'vitest/config';
import { cspPlugin } from './plugins/csp.ts';
import { ocrAssetsPlugin } from './plugins/ocr-assets.ts';
import { serviceWorkerPlugin } from './plugins/service-worker.ts';

export default defineConfig({
  base: '/mis-laboratorios/',
  build: {
    target: 'es2022',
    // Nada en línea como data: URI; todo se sirve desde el mismo origen y se precachea.
    assetsInlineLimit: 0,
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  worker: { format: 'es' },
  plugins: [cspPlugin(), ocrAssetsPlugin(), serviceWorkerPlugin()],
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    testTimeout: 120_000,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/ocr.ts', 'src/lib/pdf-browser.ts'],
      reporter: ['text-summary', 'text', 'html'],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
    },
  },
});
