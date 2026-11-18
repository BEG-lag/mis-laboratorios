import { formatValue } from './numbers.ts';
import type { Lang, Qualifier } from './types.ts';

const MONTHS: Record<Lang, string[]> = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

/** "2025-03-14" -> "14 mar 2025" (sin zona horaria). */
export function formatDate(iso: string, lang: Lang): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso || '-';
  const y = iso.slice(0, 4);
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return lang === 'es' ? `${d} ${MONTHS.es[m - 1]} ${y}` : `${MONTHS.en[m - 1]} ${d}, ${y}`;
}

export function monthYear(t: number, lang: Lang): string {
  const date = new Date(t);
  return `${MONTHS[lang][date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

export function formatNumber(value: number, lang: Lang, maxDecimals = 2): string {
  return new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US', { maximumFractionDigits: maxDecimals }).format(value);
}

export function formatResult(value: number | null, decimals: number, qualifier: Qualifier | null, text: string, lang: Lang): string {
  if (value === null) return text;
  const q = qualifier ? `${qualifier.replace('<=', '≤').replace('>=', '≥')} ` : '';
  return `${q}${formatValue(value, decimals, lang)}`;
}

/** "70 - 100", "< 200", "≥ 40" con los límites ya convertidos. */
export function formatBand(low: number | null, high: number | null, lowInclusive: boolean, highInclusive: boolean, lang: Lang): string {
  const f = (v: number) => formatNumber(v, lang, 3);
  if (low !== null && high !== null) return `${f(low)} - ${f(high)}`;
  if (high !== null) return `${highInclusive ? '≤' : '<'} ${f(high)}`;
  if (low !== null) return `${lowInclusive ? '≥' : '>'} ${f(low)}`;
  return '';
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
