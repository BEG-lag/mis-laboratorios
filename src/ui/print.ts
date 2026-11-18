import { CATEGORY_ORDER } from '../lib/analytes.ts';
import { formatBand, formatDate, formatResult, todayIso } from '../lib/format.ts';
import { t } from '../lib/i18n.ts';
import type { Filters, Series } from '../lib/series.ts';
import { escapeHtml as h } from '../lib/text.ts';
import type { Lang, Study } from '../lib/types.ts';
import { sparklineSvg } from './chart.ts';

/** Resumen para imprimir o guardar como PDF y llevar a tu médico. Sin interpretación. */
export function printHtml(series: Series[], studies: Study[], filters: Filters, labName: string, lang: Lang): string {
  const dates = studies.map((s) => s.date).sort();
  const from = filters.from || dates[0] || '';
  const to = filters.to || dates[dates.length - 1] || '';
  const sections = CATEGORY_ORDER.filter((c) => series.some((s) => s.category === c))
    .map((cat) => {
      const rows = series
        .filter((s) => s.category === cat)
        .map((s) => {
          const recent = [...s.points].reverse().slice(0, 8);
          const values = recent
            .map((p) => {
              const out = p.status === 'high' || p.status === 'low' ? '*' : '';
              const conv = p.converted ? ` (${p.converted.original} ${p.converted.fromUnit})` : '';
              return `<span class="pv"><span class="pd">${h(formatDate(p.date, lang))}</span> ${h(formatResult(p.value, p.decimals, p.qualifier, p.result.valueText, lang))}${out}${h(conv)}</span>`;
            })
            .join('');
          const last = s.points[s.points.length - 1]!;
          const band = formatBand(last.low, last.high, last.lowInclusive, last.highInclusive, lang) || last.result.range?.text || '-';
          return `<tr><th scope="row">${h(s.name)}<br><span class="note">${h(s.unit || '-')}</span></th><td class="pvs">${values}</td><td>${h(band)}<br><span class="note">${h(last.lab || '-')}</span></td><td class="ps">${sparklineSvg(s, 120, 32)}</td></tr>`;
        })
        .join('');
      return `<h2>${h(t(`cat.${cat}`))}</h2><table><thead><tr><th scope="col">${h(t('table.analyte'))}</th><th scope="col">${h(t('print.recent'))}</th><th scope="col">${h(t('print.lastRange'))}</th><th scope="col"><span class="sr-only">sparkline</span></th></tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join('');
  const studyRows = [...studies]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((s) => `<tr><td>${h(formatDate(s.date, lang))}</td><td>${h(s.lab || '-')}</td><td>${h(s.fileName)}</td></tr>`)
    .join('');
  return `
  <h1>${h(t('print.title'))}</h1>
  <p class="note">${h(t('print.generated', { date: formatDate(todayIso(), lang) }))}</p>
  <p class="note">${h(t('print.filters', { from: from ? formatDate(from, lang) : '-', to: to ? formatDate(to, lang) : '-', lab: labName }))}</p>
  <p class="disclaimer">${h(t('disclaimer.body'))}</p>
  <p class="note">${h(t('print.note'))}</p>
  ${sections}
  <h2>${h(t('print.studies'))}</h2>
  <table><thead><tr><th scope="col">${h(t('table.date'))}</th><th scope="col">${h(t('table.lab'))}</th><th scope="col">${h(t('table.file'))}</th></tr></thead><tbody>${studyRows}</tbody></table>`;
}
