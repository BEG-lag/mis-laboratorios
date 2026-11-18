/**
 * Gráficas en SVG hechas a mano (sin bibliotecas): una por indicador, con la franja del rango de
 * referencia de CADA resultado (si cambia de laboratorio, la franja cambia) y marcas para los
 * valores fuera del rango de su propio laboratorio. Colores sólo por clases CSS, nunca con
 * atributos style (la CSP no los permite).
 */
import { formatBand, formatDate, formatNumber, formatResult, monthYear } from '../lib/format.ts';
import { t } from '../lib/i18n.ts';
import type { Series, SeriesPoint } from '../lib/series.ts';
import { escapeHtml as h } from '../lib/text.ts';
import type { Lang } from '../lib/types.ts';

const DAY = 86_400_000;

interface Scale {
  (v: number): number;
}

function linear(d0: number, d1: number, r0: number, r1: number): Scale {
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** Paso "bonito" (1, 2, 2.5, 5 x 10^n) para unas cinco marcas. */
export function niceStep(span: number, target = 5): number {
  if (!(span > 0)) return 1;
  const raw = span / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

export interface YDomain {
  min: number;
  max: number;
  ticks: number[];
}

export function yDomain(points: SeriesPoint[]): YDomain {
  const values: number[] = [];
  for (const p of points) {
    if (p.value !== null) values.push(p.value);
    if (p.low !== null) values.push(p.low);
    if (p.high !== null) values.push(p.high);
  }
  if (values.length === 0) return { min: 0, max: 1, ticks: [0, 1] };
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.2 || 1;
    lo -= pad;
    hi += pad;
  }
  const pad = (hi - lo) * 0.12;
  lo -= pad;
  hi += pad;
  if (Math.min(...values) >= 0 && lo < 0) lo = 0;
  const step = niceStep(hi - lo);
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { min, max, ticks };
}

export interface XDomain {
  min: number;
  max: number;
  ticks: { t: number; label: string }[];
}

export function xDomain(points: SeriesPoint[], lang: Lang, width: number): XDomain {
  const ts = points.map((p) => p.t);
  let min = Math.min(...ts);
  let max = Math.max(...ts);
  if (!Number.isFinite(min)) {
    min = Date.UTC(2020, 0, 1);
    max = Date.UTC(2021, 0, 1);
  }
  if (max - min < 120 * DAY) {
    const mid = (min + max) / 2;
    min = mid - 90 * DAY;
    max = mid + 90 * DAY;
  }
  const pad = (max - min) * 0.05;
  min -= pad;
  max += pad;
  const years = (max - min) / (365.25 * DAY);
  const ticks: { t: number; label: string }[] = [];
  const maxTicks = Math.max(2, Math.floor(width / 70));
  if (years >= 1.6) {
    const y0 = new Date(min).getUTCFullYear() + 1;
    const y1 = new Date(max).getUTCFullYear();
    const every = Math.max(1, Math.ceil((y1 - y0 + 1) / maxTicks));
    for (let y = y0; y <= y1; y += every) ticks.push({ t: Date.UTC(y, 0, 1), label: String(y) });
  } else {
    const start = new Date(min);
    const months = Math.max(1, Math.round((max - min) / (30.44 * DAY)));
    const every = [1, 2, 3, 6].find((m) => months / m <= Math.max(2, Math.floor(maxTicks * 0.8))) ?? 6;
    let y = start.getUTCFullYear();
    let m = start.getUTCMonth() + 1;
    for (let i = 0; i < 40; i++) {
      if (m > 11) {
        m -= 12;
        y++;
      }
      const tt = Date.UTC(y, m, 1);
      if (tt > max) break;
      if (m % every === 0) ticks.push({ t: tt, label: monthYear(tt, lang) });
      m++;
    }
  }
  return { min, max, ticks };
}

function statusText(p: SeriesPoint): string {
  return t(`status.${p.status ?? 'none'}`);
}

export function pointLabel(series: Series, p: SeriesPoint, lang: Lang): string {
  const range = formatBand(p.low, p.high, p.lowInclusive, p.highInclusive, lang) || p.result.range?.text || t('tip.noRange');
  return t('chart.point', {
    date: formatDate(p.date, lang),
    value: formatResult(p.value, p.decimals, p.qualifier, p.result.valueText, lang),
    unit: series.unit,
    status: statusText(p),
    range,
    lab: p.lab || '-',
    file: p.study.fileName,
  });
}

/** Detalle del punto para la burbuja (HTML). */
export function tooltipHtml(series: Series, p: SeriesPoint, lang: Lang): string {
  const range = formatBand(p.low, p.high, p.lowInclusive, p.highInclusive, lang) || h(p.result.range?.text || t('tip.noRange'));
  const value = formatResult(p.value, p.decimals, p.qualifier, p.result.valueText, lang);
  const status = p.status && p.status !== 'in' ? `<p class="tip-status tip-${p.status}">${h(statusText(p))}</p>` : '';
  const conv = p.converted
    ? `<p class="tip-note">${h(t('tip.converted', { original: p.converted.original, unit: p.converted.fromUnit, factor: formatNumber(p.converted.factor, lang, 6) }))}</p>`
    : '';
  const flag = p.result.flagRaw ? `<p><span class="tip-k">${h(t('tip.flag'))}</span> ${h(p.result.flagRaw)}</p>` : '';
  return `<p class="tip-date">${h(formatDate(p.date, lang))}</p>
<p class="tip-value">${h(value)} <span>${h(series.unit)}</span></p>
${status}
<p><span class="tip-k">${h(t('tip.range'))}</span> ${typeof range === 'string' ? h(range) : range}</p>
<p><span class="tip-k">${h(t('tip.lab'))}</span> ${h(p.lab || '-')}</p>
<p><span class="tip-k">${h(t('tip.file'))}</span> ${h(p.study.fileName)}</p>
${flag}${conv}`;
}

interface Band {
  x0: number;
  x1: number;
  low: number | null;
  high: number | null;
}

function bands(points: SeriesPoint[], x: Scale, xMin: number, xMax: number): Band[] {
  const out: Band[] = [];
  points.forEach((p, i) => {
    const prev = points[i - 1];
    const next = points[i + 1];
    const x0 = prev ? (x(prev.t) + x(p.t)) / 2 : x(xMin);
    const x1 = next ? (x(p.t) + x(next.t)) / 2 : x(xMax);
    const last = out[out.length - 1];
    if (last && last.low === p.low && last.high === p.high && Math.abs(last.x1 - x0) < 0.01) last.x1 = x1;
    else out.push({ x0, x1, low: p.low, high: p.high });
  });
  return out.filter((b) => b.low !== null || b.high !== null);
}

const fmt = (v: number) => (Math.round(v * 10) / 10).toString();

export interface ChartOptions {
  width: number;
  height: number;
  lang: Lang;
  idPrefix?: string;
}

/** Gráfica completa con ejes, franja, línea y puntos navegables con teclado. */
export function chartSvg(series: Series, opts: ChartOptions): string {
  const points = series.points.filter((p) => p.value !== null);
  const { width, height, lang } = opts;
  const narrow = width < 480;
  const m = { l: narrow ? 44 : 56, r: narrow ? 12 : 20, t: 18, b: 34 };
  const xd = xDomain(points, lang, width - m.l - m.r);
  const yd = yDomain(points);
  const x = linear(xd.min, xd.max, m.l, width - m.r);
  const y = linear(yd.min, yd.max, height - m.b, m.t);
  const top = m.t;
  const bottom = height - m.b;
  const id = opts.idPrefix ?? 'chart';
  const grid = yd.ticks
    .map((v) => `<line class="grid" x1="${m.l}" x2="${width - m.r}" y1="${fmt(y(v))}" y2="${fmt(y(v))}"/><text class="axis" x="${m.l - 8}" y="${fmt(y(v) + 4)}" text-anchor="end">${h(formatNumber(v, lang, 3))}</text>`)
    .join('');
  const xt = xd.ticks
    .map((tk) => `<line class="tick" x1="${fmt(x(tk.t))}" x2="${fmt(x(tk.t))}" y1="${bottom}" y2="${bottom + 5}"/><text class="axis" x="${fmt(x(tk.t))}" y="${bottom + 19}" text-anchor="middle">${h(tk.label)}</text>`)
    .join('');
  const bandEls = bands(points, x, xd.min, xd.max)
    .map((b) => {
      const yTop = b.high === null ? top : Math.max(top, y(b.high));
      const yBot = b.low === null ? bottom : Math.min(bottom, y(b.low));
      const edges = [
        b.high !== null ? `<line class="band-edge" x1="${fmt(b.x0)}" x2="${fmt(b.x1)}" y1="${fmt(yTop)}" y2="${fmt(yTop)}"/>` : '',
        b.low !== null ? `<line class="band-edge" x1="${fmt(b.x0)}" x2="${fmt(b.x1)}" y1="${fmt(yBot)}" y2="${fmt(yBot)}"/>` : '',
      ].join('');
      return `<rect class="band" x="${fmt(b.x0)}" y="${fmt(yTop)}" width="${fmt(Math.max(0, b.x1 - b.x0))}" height="${fmt(Math.max(0, yBot - yTop))}"/>${edges}`;
    })
    .join('');
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${fmt(x(p.t))},${fmt(y(p.value!))}`).join(' ');
  const pts = points
    .map((p, i) => {
      const cls = p.status === 'high' || p.status === 'low' ? `pt pt-out pt-${p.status}` : p.status === 'in' ? 'pt pt-in' : 'pt pt-none';
      const q = p.qualifier ? ' pt-q' : '';
      const marker =
        p.status === 'high' ? '<path class="pt-mark" d="M0,-15 L5,-9 L-5,-9 Z"/>' : p.status === 'low' ? '<path class="pt-mark" d="M0,15 L5,9 L-5,9 Z"/>' : '';
      const px = fmt(x(p.t));
      const py = fmt(y(p.value!));
      return `<g class="${cls}${q}" transform="translate(${px} ${py})" data-i="${i}" data-x="${px}" data-y="${py}" tabindex="0" role="button" aria-label="${h(pointLabel(series, p, lang))}" aria-describedby="${id}-pin"><circle class="pt-hit" r="14"/><circle class="pt-dot" r="5.5"/>${marker}</g>`;
    })
    .join('');
  return `<svg class="chart-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="group" aria-labelledby="${id}-title" aria-describedby="${id}-desc">
<g aria-hidden="true">${grid}${bandEls}<line class="axis-line" x1="${m.l}" x2="${width - m.r}" y1="${bottom}" y2="${bottom}"/>${xt}<path class="trend" d="${path}"/></g>
${pts}
</svg>`;
}

/** Línea pequeña para el tablero: últimos resultados y la franja del rango del último laboratorio. */
export function sparklineSvg(series: Series, width = 168, height = 44): string {
  const points = series.points.filter((p) => p.value !== null).slice(-12);
  if (points.length === 0) return '';
  const last = points[points.length - 1]!;
  const ys: number[] = points.map((p) => p.value!);
  if (last.low !== null) ys.push(last.low);
  if (last.high !== null) ys.push(last.high);
  let lo = Math.min(...ys);
  let hi = Math.max(...ys);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * 0.15;
  const y = linear(lo - pad, hi + pad, height - 4, 4);
  const xs = points.length === 1 ? [width / 2] : points.map((_, i) => 6 + (i * (width - 12)) / (points.length - 1));
  const band =
    last.low !== null || last.high !== null
      ? `<rect class="band" x="0" y="${fmt(last.high === null ? 0 : y(last.high))}" width="${width}" height="${fmt(Math.max(0, (last.low === null ? height : y(last.low)) - (last.high === null ? 0 : y(last.high))))}"/>`
      : '';
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${fmt(xs[i]!)},${fmt(y(p.value!))}`).join(' ');
  const dots = points
    .map((p, i) => {
      const cls = p.status === 'high' || p.status === 'low' ? 'sp-out' : p.status === 'in' ? 'sp-in' : 'sp-none';
      const r = i === points.length - 1 ? 3.6 : 2.2;
      return `<circle class="sp-dot ${cls}" cx="${fmt(xs[i]!)}" cy="${fmt(y(p.value!))}" r="${r}"/>`;
    })
    .join('');
  return `<svg class="spark" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true" focusable="false">${band}<path class="trend" d="${path}"/>${dots}</svg>`;
}
