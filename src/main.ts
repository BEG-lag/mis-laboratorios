import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import './styles/app.css';
import './styles/print.css';
import { start } from './ui/app.ts';

/**
 * Carga todas las tipografías al inicio para que, una vez lista la página, no haya ninguna
 * petición más (ni siquiera de fuentes) cuando la persona carga sus resultados.
 */
async function preloadFonts(): Promise<void> {
  const faces = ['400 1em "JetBrains Mono"', '700 1em "JetBrains Mono"', '400 1em Inter', '600 1em Inter', 'italic 500 1em "Cormorant Garamond"'];
  await Promise.all(faces.map((f) => document.fonts.load(f, 'Aá1µ').catch(() => [])));
}

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  await start(root);
  await preloadFonts();
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
    } catch {
      // Sin service worker la app funciona igual, sólo que no sin conexión.
    }
  }
  document.documentElement.dataset.ready = 'true';
}

void boot();
