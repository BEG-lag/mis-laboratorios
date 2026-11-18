/** Utilidades de texto: normalización sin acentos y escape de HTML. */

/** "Ácido Úrico (suero)" -> "acido urico suero". Conserva % y #. */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[\u00B5\u03BC]/g, 'u')
    .replace(/[^a-z0-9%#]+/g, ' ')
    .trim();
}

/** Minúsculas y sin acentos, pero conserva la puntuación (para buscar etiquetas y rangos). */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

/**
 * Unifica guiones, signos de comparación y espacios raros. Los guiones largos se escriben como
 * escapes para que el código fuente no los contenga.
 */
export function cleanText(value: string): string {
  return value
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212\uFE58\uFE63\uFF0D]/g, '-')
    .replace(/\u2264/g, '<=')
    .replace(/\u2265/g, '>=')
    .replace(/=</g, '<=')
    .replace(/=>/g, '>=')
    .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let counter = 0;
/** Identificador local (no criptográfico): basta para distinguir filas y estudios en memoria. */
export function uid(prefix = 'id'): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
