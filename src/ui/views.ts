import { ANALYTES, CATEGORY_ORDER, analyteName, type Category } from '../lib/analytes.ts';
import { formatBand, formatDate, formatResult } from '../lib/format.ts';
import { t } from '../lib/i18n.ts';
import type { FileIssue } from '../lib/ingest.ts';
import { CUSTOM, type Draft, type DraftError, type DraftRow } from '../lib/review.ts';
import type { Series, SeriesPoint } from '../lib/series.ts';
import { escapeHtml as h } from '../lib/text.ts';
import type { LabResult, Lang, Study } from '../lib/types.ts';
import { sparklineSvg } from './chart.ts';
import { icons } from './icons.ts';

export const REPO_URL = 'https://github.com/BEG-lag/mis-laboratorios';

/* ------------------------------------------------------------------ armazón */

export function shellHtml(lang: Lang, ocrSizeMb: string): string {
  return `
<a class="skip" href="#main">${h(t('app.skip'))}</a>
<div class="app">
<header class="top">
  <div class="wrap">
    <a class="brand" href="./" aria-label="mis-laboratorios">${icons.logo}<span>mis<span class="dim">-laboratorios</span></span></a>
    <a class="pvk" href="https://pivotek.mx" title="PIVOTEK"><img class="pvk-logo" src="${import.meta.env.BASE_URL}pivotek-logotipo-naranja.svg" alt="PIVOTEK" width="90" height="34"><img class="pvk-iso" src="${import.meta.env.BASE_URL}pivotek-isotipo-naranja.svg" alt="PIVOTEK" width="21" height="24"></a>
    <div class="badges" aria-hidden="true">
      <span class="badge">${h(t('privacy.local'))}</span>
      <span class="badge">${h(t('privacy.zero'))}</span>
      <span class="badge">${h(t('privacy.offline'))}</span>
    </div>
    <button type="button" class="lang-btn" id="lang-toggle"><span lang="${lang === 'es' ? 'en' : 'es'}">${h(t('lang.toggle'))}</span><span class="sr-only"> (${h(t('lang.toggleLabel'))})</span></button>
  </div>
</header>

<main id="main" tabindex="-1">
  <section class="hero wrap" aria-labelledby="hero-title">
    <p class="kicker">${h(t('app.kicker'))}</p>
    <h1 id="hero-title">${t('app.h1')}</h1>
    <p class="lede">${h(t('app.lede'))}</p>
    <div class="callouts">
      <div class="callout disclaimer" role="note" aria-labelledby="disclaimer-title">
        ${icons.stethoscope(24)}
        <div>
          <h2 id="disclaimer-title">${h(t('disclaimer.title'))}</h2>
          <p data-testid="disclaimer">${h(t('disclaimer.body'))}</p>
        </div>
      </div>
      <div class="callout privacy" role="note" aria-labelledby="privacy-title">
        ${icons.lock(24)}
        <div>
          <h2 id="privacy-title">${h(t('privacy.title'))}</h2>
          <p>${h(t('privacy.body'))}</p>
        </div>
      </div>
    </div>
  </section>

  <section class="drop wrap" aria-label="${h(t('drop.inputLabel'))}">
    <div class="dropzone" id="dropzone">
      <strong id="drop-title">${h(t('drop.title'))}</strong>
      <p class="hint">${h(t('drop.hint'))}</p>
      <div class="actions">
        <label class="btn btn-primary" for="file-input">${icons.upload()}<span id="choose-label">${h(t('drop.choose'))}</span></label>
        <input class="file-input" id="file-input" type="file" multiple accept=".pdf,application/pdf,image/png,image/jpeg,image/webp,.jpg,.jpeg,.png,.webp" aria-describedby="drop-title" />
        <button type="button" class="btn" id="manual-btn">${icons.pencil()}${h(t('drop.manual'))}</button>
        <button type="button" class="btn" id="demo-btn">${icons.spark()}${h(t('drop.demo'))}</button>
      </div>
      <p class="demo-note">${h(t('drop.demoNote'))}</p>
      <div class="ocr-opt">
        <label class="checkbox"><input type="checkbox" id="ocr-toggle" aria-describedby="ocr-help" />${h(t('drop.ocr'))}</label>
        <p class="help" id="ocr-help">${h(t('drop.ocrHelp', { size: ocrSizeMb }))}</p>
      </div>
    </div>
    <div class="progress" id="progress" hidden>
      <span id="progress-text"></span>
      <div class="progress-track"><div class="progress-fill" id="progress-fill"></div></div>
    </div>
  </section>

  <section class="wrap workspace" id="workspace" hidden>
    <div class="notices" id="notices"></div>

    <section class="review" id="review" aria-labelledby="review-title" hidden>
      <div class="review-head">
        <div>
          <h2 id="review-title">${h(t('review.title'))}</h2>
          <p class="help">${h(t('review.help'))}</p>
        </div>
        <button type="button" class="btn btn-primary" id="confirm-all">${icons.check()}${h(t('review.confirmAll'))}</button>
      </div>
      <div id="drafts"></div>
    </section>

    <section class="history" id="history" aria-labelledby="history-title" hidden>
      <div class="history-head">
        <h2 id="history-title">${h(t('history.title'))}</h2>
        <p class="help" id="history-summary"></p>
      </div>
      <form class="filters" id="filters" novalidate aria-label="${h(t('filters.title'))}">
        <div class="field"><label for="f-from">${h(t('filters.from'))}</label><input type="date" id="f-from" /></div>
        <div class="field"><label for="f-to">${h(t('filters.to'))}</label><input type="date" id="f-to" /></div>
        <div class="field"><label for="f-lab">${h(t('filters.lab'))}</label><select id="f-lab"></select></div>
        <button type="button" class="btn btn-sm" id="f-clear">${h(t('filters.clear'))}</button>
      </form>

      <div class="tabs" role="tablist" aria-label="${h(t('tabs.label'))}">
        <button type="button" class="tab" role="tab" id="tab-dashboard" aria-controls="panel-dashboard" data-tab="dashboard">${h(t('tabs.dashboard'))}<span class="count" id="tab-dashboard-count"></span></button>
        <button type="button" class="tab" role="tab" id="tab-chart" aria-controls="panel-chart" data-tab="chart">${h(t('tabs.chart'))}</button>
        <button type="button" class="tab" role="tab" id="tab-studies" aria-controls="panel-studies" data-tab="studies">${h(t('tabs.studies'))}<span class="count" id="tab-studies-count"></span></button>
      </div>

      <div role="tabpanel" id="panel-dashboard" aria-labelledby="tab-dashboard" tabindex="0"></div>
      <div role="tabpanel" id="panel-chart" aria-labelledby="tab-chart" tabindex="0" hidden>
        <div class="field chart-pick"><label for="series-select">${h(t('chart.select'))}</label><select id="series-select"></select></div>
        <h3 class="chart-title" id="chart-title"></h3>
        <p class="sr-only" id="chart-desc"></p>
        <p class="sr-only" id="chart-pin">${h(t('chart.pin'))}</p>
        <div class="chart-box" id="chart-box">
          <div class="chart-tip" id="chart-tip" role="status" hidden></div>
        </div>
        <ul class="legend" aria-hidden="true">
          <li><span class="sw sw-band"></span>${h(t('chart.legend.band'))}</li>
          <li><span class="sw sw-in"></span>${h(t('chart.legend.in'))}</li>
          <li><span class="sw sw-out"></span>${h(t('chart.legend.out'))}</li>
          <li><span class="sw sw-none"></span>${h(t('chart.legend.none'))}</li>
        </ul>
        <div class="chart-notes" id="chart-notes"></div>
        <div class="table-wrap"><table class="data-table" id="chart-table"></table></div>
      </div>
      <div role="tabpanel" id="panel-studies" aria-labelledby="tab-studies" tabindex="0" hidden></div>

      <div class="export-bar">
        <button type="button" class="btn btn-sm" id="export-csv">${icons.download()}${h(t('export.csv'))}</button>
        <button type="button" class="btn btn-sm" id="export-excel">${icons.download()}${h(t('export.excel'))}</button>
        <button type="button" class="btn btn-sm" id="print-btn">${icons.print()}${h(t('export.print'))}</button>
        <p class="help">${h(t('export.scope'))}</p>
      </div>

      <div class="settings">
        <label class="checkbox"><input type="checkbox" id="persist" aria-describedby="persist-help" />${h(t('settings.persist'))}</label>
        <p class="help" id="persist-help">${h(t('settings.persistHelp'))}</p>
        <button type="button" class="btn btn-danger btn-sm" id="clear-all">${icons.trash()}${h(t('settings.clear'))}</button>
      </div>
    </section>
  </section>
</main>

<footer class="foot">
  <div class="wrap">
    <p class="disclaimer-strong">${h(t('disclaimer.body'))}</p>
    <nav aria-label="footer">
      <a href="${REPO_URL}" target="_blank" rel="noopener noreferrer">${h(t('footer.code'))}</a>
      <span>${h(t('footer.license'))}</span>
    </nav>
    <p class="author">${h(t('footer.author'))} · <em>${h(t('footer.role'))}</em> · <a href="https://pivotek.mx" target="_blank" rel="noopener noreferrer">pivotek.mx</a> · <a href="https://github.com/BEG-lag/portafolio-ia" target="_blank" rel="noopener noreferrer">portafolio-ia</a></p>
    <p>${h(t('footer.synthetic'))}</p>
  </div>
</footer>
</div>

<div class="print-only print-summary" id="print-summary"></div>
<div class="sr-only" aria-live="polite" id="live"></div>
<div class="toast" id="toast" role="status" hidden></div>
`;
}

/* ------------------------------------------------------------------ avisos */

export function issuesHtml(issues: FileIssue[]): string {
  if (issues.length === 0) return '';
  const items = issues.map((i) => `<li><strong>${h(i.name)}</strong>: ${h(t(`issue.${i.code}`))}</li>`).join('');
  return `<div class="notice warn" role="alert">${icons.alert()}<div><p><strong>${h(t('issue.title'))}</strong></p><ul>${items}</ul>
<button type="button" class="btn btn-sm" id="dismiss-issues">${icons.close()}${h(t('issue.dismiss'))}</button></div></div>`;
}

/* ------------------------------------------------------------------ revisión */

const optionsCache = new Map<Lang, string>();

function analyteOptions(lang: Lang): string {
  let html = optionsCache.get(lang);
  if (!html) {
    const groups = CATEGORY_ORDER.filter((c) => c !== 'other')
      .map((cat) => {
        const opts = ANALYTES.filter((a) => a.category === cat)
          .map((a) => `<option value="${a.id}">${h(lang === 'es' ? a.es : a.en)}</option>`)
          .join('');
        return opts ? `<optgroup label="${h(t(`cat.${cat}`))}">${opts}</optgroup>` : '';
      })
      .join('');
    html = `<option value="${CUSTOM}">${h(t('review.custom'))}</option>${groups}`;
    optionsCache.set(lang, html);
  }
  return html;
}

export function clearOptionsCache(): void {
  optionsCache.clear();
}

function sel(options: string, value: string): string {
  return options.replace(`value="${value}"`, `value="${value}" selected`);
}

function rangeNote(row: DraftRow): string {
  const r = row.range;
  if (!r || !r.text) return '';
  if (row.rangeEdited) return '';
  const note =
    r.kind === 'bySex'
      ? t('review.range.bySex')
      : r.kind === 'byAge'
        ? t('review.range.byAge')
        : r.kind === 'categories'
          ? t('review.range.categories')
          : r.kind === 'qualitative'
            ? t('review.range.qualitative')
            : r.label
              ? t('review.range.label', { label: r.label })
              : '';
  return note ? `<span class="range-note">${h(note)}</span>` : '';
}

function errFor(errors: DraftError[], rowId: string, field: string): boolean {
  return errors.some((e) => e.rowId === rowId && e.field === field);
}

function rowHtml(d: Draft, row: DraftRow, n: number, lang: Lang, errors: DraftError[]): string {
  const id = `${d.id}-${row.id}`;
  const label = (key: string) => h(t('review.rowLabel', { field: t(key), n }));
  const inv = (f: string) => (errFor(errors, row.id, f) ? ' aria-invalid="true"' : '');
  const displayName = row.name || analyteName(row.analyteId, lang, '');
  const flag = row.flag ?? '';
  const flagOptions = ['', 'high', 'low', 'flag']
    .map((v) => `<option value="${v}"${v === flag ? ' selected' : ''}>${h(t(`review.flag.${v || 'none'}`))}</option>`)
    .join('');
  return `<tr data-row="${row.id}">
  <td class="c-analyte" data-label="${h(t('review.col.analyte'))}">
    <select data-field="analyteId" id="${id}-a" aria-label="${label('review.col.analyte')}">${sel(analyteOptions(lang), row.analyteId)}</select>
    ${
      row.analyteId === CUSTOM
        ? `<input type="text" data-field="name" id="${id}-n" value="${h(row.name)}" placeholder="${h(t('review.printedName'))}" aria-label="${label('review.printedName')}"${inv('name')} autocomplete="off" />`
        : row.name
          ? `<span class="printed">${h(t('review.printedAs', { name: row.name }))}</span>`
          : ''
    }
  </td>
  <td class="c-value" data-label="${h(t('review.col.value'))}"><input type="text" inputmode="decimal" data-field="valueText" id="${id}-v" value="${h(row.valueText)}" aria-label="${label('review.col.value')}"${inv('value')} autocomplete="off" /></td>
  <td class="c-unit" data-label="${h(t('review.col.unit'))}"><input type="text" data-field="unit" id="${id}-u" value="${h(row.unit)}" list="unit-list" aria-label="${label('review.col.unit')}" autocomplete="off" /></td>
  <td class="c-low" data-label="${h(t('review.col.low'))}"><input type="text" inputmode="decimal" data-field="lowText" id="${id}-lo" value="${h(row.lowText)}" aria-label="${label('review.col.low')}"${inv('low')} autocomplete="off" /></td>
  <td class="c-high" data-label="${h(t('review.col.high'))}"><input type="text" inputmode="decimal" data-field="highText" id="${id}-hi" value="${h(row.highText)}" aria-label="${label('review.col.high')}"${inv('high')} autocomplete="off" /></td>
  <td class="c-flag" data-label="${h(t('review.col.flag'))}"><select data-field="flag" id="${id}-f" aria-label="${label('review.col.flag')}">${flagOptions}</select></td>
  <td class="c-src" data-label="${h(t('review.col.source'))}">${row.snippet ? `<code>${h(row.snippet)}</code>` : ''}${row.page ? `<span class="page-ref">${h(t('review.page', { page: row.page }))}</span>` : ''}${rangeNote(row)}</td>
  <td class="c-act"><button type="button" class="icon-btn" data-action="delete-row" aria-label="${h(t('review.deleteRow', { name: displayName || String(n) }))}">${icons.close()}</button></td>
</tr>`;
}

export function draftHtml(d: Draft, lang: Lang, errors: DraftError[] = []): string {
  const dateErr = errors.some((e) => e.field === 'date');
  const sexLabel = d.sexDetected === 'M' ? t('review.sexM') : d.sexDetected === 'F' ? t('review.sexF') : t('review.sexNone');
  const meta = [
    t(`review.source.${d.source}`),
    d.pages ? t('review.pages', { pages: d.pages }) : '',
    d.source !== 'manual' ? t('review.found', { count: d.rows.length }) : '',
  ]
    .filter(Boolean)
    .join(' · ');
  const errMsgs = errors.length
    ? `<p class="error" role="alert" id="${d.id}-errors">${h(t('review.errors', { count: errors.length }))} ${errors
        .map((e) => t(`review.err.${e.field}`))
        .filter((v, i, arr) => arr.indexOf(v) === i)
        .map((m) => h(m))
        .join(' ')}</p>`
    : '';
  const rows = d.rows.map((r, i) => rowHtml(d, r, i + 1, lang, errors)).join('');
  return `<article class="draft${d.source === 'ocr' ? ' is-ocr' : ''}" data-draft="${d.id}" aria-labelledby="${d.id}-title">
  <header class="draft-head">
    <h3 id="${d.id}-title">${h(d.fileName)}</h3>
    <p class="draft-meta">${h(meta)}</p>
    ${d.patient ? `<p class="help">${h(t('review.patient', { name: d.patient }))}</p>` : ''}
    <div class="draft-fields">
      <div class="field">
        <label for="${d.id}-date">${h(t('review.date'))}</label>
        <input type="date" id="${d.id}-date" data-dfield="date" value="${h(d.date)}" aria-describedby="${d.id}-date-help"${dateErr ? ' aria-invalid="true"' : ''} required />
        <p class="help" id="${d.id}-date-help">${h(d.date && d.dateLabel ? t('review.dateFound', { label: d.dateLabel }) : d.source === 'manual' ? '' : t('review.dateMissing'))}</p>
      </div>
      <div class="field">
        <label for="${d.id}-lab">${h(t('review.lab'))}</label>
        <input type="text" id="${d.id}-lab" data-dfield="lab" value="${h(d.lab)}" autocomplete="off" />
      </div>
      <div class="field">
        <label for="${d.id}-sex">${h(t('review.sex'))}</label>
        <select id="${d.id}-sex" data-dfield="sex" aria-describedby="${d.id}-sex-help">
          <option value=""${d.sex === null ? ' selected' : ''}>${h(t('review.sexNone'))}</option>
          <option value="M"${d.sex === 'M' ? ' selected' : ''}>${h(t('review.sexM'))}</option>
          <option value="F"${d.sex === 'F' ? ' selected' : ''}>${h(t('review.sexF'))}</option>
        </select>
        <p class="help" id="${d.id}-sex-help">${h(t('review.sexHelp', { sex: sexLabel }))}</p>
      </div>
    </div>
    ${errMsgs}
  </header>
  <div class="table-wrap">
    <table class="review-table">
      <caption class="sr-only">${h(t('review.caption', { file: d.fileName }))}</caption>
      <thead><tr>
        <th scope="col">${h(t('review.col.analyte'))}</th><th scope="col">${h(t('review.col.value'))}</th><th scope="col">${h(t('review.col.unit'))}</th>
        <th scope="col">${h(t('review.col.low'))}</th><th scope="col">${h(t('review.col.high'))}</th><th scope="col">${h(t('review.col.flag'))}</th>
        <th scope="col">${h(t('review.col.source'))}</th><th scope="col"><span class="sr-only">${h(t('review.col.actions'))}</span></th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <div class="draft-actions">
    <button type="button" class="btn btn-sm" data-action="add-row">${icons.plus()}${h(t('review.addRow'))}</button>
    <button type="button" class="btn btn-sm btn-danger" data-action="discard">${icons.trash()}${h(t('review.discard'))}</button>
    <button type="button" class="btn btn-primary" data-action="confirm">${icons.check()}${h(t('review.confirm'))}</button>
  </div>
</article>`;
}

export function unitDatalist(): string {
  const units = ['mg/dL', 'g/dL', 'g/L', 'mg/L', 'mmol/L', 'µmol/L', 'mmol/mol', 'mEq/L', 'U/L', 'UI/L', 'µUI/mL', 'mUI/L', 'ng/mL', 'ng/dL', 'pg/mL', 'pmol/L', 'nmol/L', 'µg/dL', '%', 'fL', 'pg', 'x10³/µL', 'x10⁶/µL', '/µL', 'mL/min/1.73m²', 'mm/h'];
  return `<datalist id="unit-list">${units.map((u) => `<option value="${h(u)}"></option>`).join('')}</datalist>`;
}

/* ------------------------------------------------------------------ tablero */

function spanText(series: Series, lang: Lang): string {
  const first = series.points[0];
  const last = series.points[series.points.length - 1];
  if (!first || !last) return '';
  const y0 = first.date.slice(0, 4);
  const y1 = last.date.slice(0, 4);
  return y0 === y1 ? formatDate(last.date, lang) : `${y0}-${y1}`;
}

function statusChip(p: SeriesPoint | undefined): string {
  if (!p || (p.status !== 'high' && p.status !== 'low')) return '';
  return `<span class="chip chip-${p.status}">${p.status === 'high' ? icons.up() : icons.down()}${h(t(`status.short.${p.status}`))}</span>`;
}

export function dashboardHtml(series: Series[], lang: Lang): string {
  if (series.length === 0) return `<p class="empty">${h(t('dash.empty'))}</p>`;
  const byCat = new Map<Category, Series[]>();
  for (const s of series) {
    const list = byCat.get(s.category) ?? [];
    list.push(s);
    byCat.set(s.category, list);
  }
  return CATEGORY_ORDER.filter((c) => byCat.has(c))
    .map((cat) => {
      const cards = byCat
        .get(cat)!
        .map((s) => {
          const numeric = s.points.filter((p) => p.value !== null);
          const last = numeric[numeric.length - 1] ?? s.points[s.points.length - 1]!;
          const value = formatResult(last.value, last.decimals, last.qualifier, last.result.valueText, lang);
          return `<li><button type="button" class="series-card" data-series="${h(s.key)}" aria-describedby="dash-open-hint">
  <span class="sc-name">${h(s.name)}</span>
  <span class="sc-unit">${h(s.unit || ' ')}</span>
  <span class="sc-value">${h(value)}</span>
  ${statusChip(numeric.length ? last : undefined)}
  ${numeric.length ? sparklineSvg(s) : `<span class="sc-qual">${h(t('dash.qualitative'))}</span>`}
  <span class="sc-meta">${h(t('dash.latest', { date: formatDate(last.date, lang), lab: last.lab || '-' }))}</span>
  <span class="sc-meta">${h(t('dash.points', { count: s.points.length, span: spanText(s, lang) }))}</span>
</button></li>`;
        })
        .join('');
      return `<section class="cat" aria-labelledby="cat-${cat}"><h3 id="cat-${cat}">${h(t(`cat.${cat}`))}</h3><ul class="cards">${cards}</ul></section>`;
    })
    .join('') + `<p class="sr-only" id="dash-open-hint">${h(t('dash.openHint'))}</p>`;
}

/* ------------------------------------------------------------------ gráfica */

export function seriesOptions(series: Series[], lang: Lang): string {
  void lang;
  return CATEGORY_ORDER.map((cat) => {
    const opts = series
      .filter((s) => s.category === cat)
      .map((s) => `<option value="${h(s.key)}">${h(s.name)} · ${h(s.unit || '-')} (${s.points.length})</option>`)
      .join('');
    return opts ? `<optgroup label="${h(t(`cat.${cat}`))}">${opts}</optgroup>` : '';
  }).join('');
}

export function chartNotesHtml(series: Series, all: Series[], lang: Lang): string {
  const notes: string[] = [];
  if (series.rangesDiffer) {
    const items = new Map<string, string>();
    for (const p of series.points) {
      const band = formatBand(p.low, p.high, p.lowInclusive, p.highInclusive, lang);
      if (!band) continue;
      const key = `${p.labKey}|${band}`;
      if (!items.has(key)) items.set(key, `${p.lab || '-'}: ${band} ${series.unit}`);
    }
    notes.push(`<p>${h(t('chart.rangesDiffer'))}</p><ul>${[...items.values()].map((i) => `<li>${h(i)}</li>`).join('')}</ul>`);
  }
  if (series.points.some((p) => p.converted)) notes.push(`<p>${h(t('chart.converted', { unit: series.unit }))}</p>`);
  const qual = series.points.filter((p) => p.value === null).length;
  if (qual) notes.push(`<p>${h(t('chart.qualitative', { count: qual }))}</p>`);
  if (series.points.some((p) => p.value !== null && p.low === null && p.high === null && p.result.range && ['categories', 'bySex', 'byAge'].includes(p.result.range.kind))) {
    notes.push(`<p>${h(t('chart.noRange'))}</p>`);
  }
  const siblings = series.siblings.map((k) => all.find((s) => s.key === k)).filter((s): s is Series => Boolean(s));
  if (siblings.length) {
    notes.push(
      `<p>${h(t('chart.siblings', { units: siblings.map((s) => s.unit).join(', ') }))} ${siblings
        .map((s) => `<button type="button" class="link-btn" data-series="${h(s.key)}">${h(t('chart.siblingOpen', { unit: s.unit }))}</button>`)
        .join(' ')}</p>`,
    );
  }
  return notes.length ? `<div class="notice info">${icons.info()}<div>${notes.join('')}</div></div>` : '';
}

export function chartTableHtml(series: Series, lang: Lang): string {
  const rows = [...series.points]
    .reverse()
    .map((p) => {
      const value = formatResult(p.value, p.decimals, p.qualifier, p.result.valueText, lang);
      const range = formatBand(p.low, p.high, p.lowInclusive, p.highInclusive, lang) || p.result.range?.text || '-';
      const status = p.status === 'high' || p.status === 'low' ? `<span class="chip chip-${p.status}">${h(t(`status.short.${p.status}`))}</span>` : h(t(`status.${p.status ?? 'none'}`));
      return `<tr><td>${h(formatDate(p.date, lang))}</td><td class="num">${h(value)}</td><td>${h(p.converted ? `${p.converted.original} ${p.converted.fromUnit}` : `${p.result.valueText} ${p.result.unit}`)}</td><td>${h(range)}</td><td>${status}</td><td>${h(p.lab || '-')}</td><td class="file">${h(p.study.fileName)}</td></tr>`;
    })
    .join('');
  return `<caption>${h(t('chart.table'))}</caption><thead><tr><th scope="col">${h(t('table.date'))}</th><th scope="col" class="num">${h(t('table.value'))} (${h(series.unit || '-')})</th><th scope="col">${h(t('table.original'))}</th><th scope="col">${h(t('table.range'))}</th><th scope="col">${h(t('table.status'))}</th><th scope="col">${h(t('table.lab'))}</th><th scope="col">${h(t('table.file'))}</th></tr></thead><tbody>${rows}</tbody>`;
}

/* ------------------------------------------------------------------ estudios */

export function studiesHtml(studies: Study[], results: LabResult[], lang: Lang): string {
  if (studies.length === 0) return `<p class="empty">${h(t('studies.empty'))}</p>`;
  const byStudy = new Map<string, LabResult[]>();
  for (const r of results) {
    const list = byStudy.get(r.studyId) ?? [];
    list.push(r);
    byStudy.set(r.studyId, list);
  }
  return `<ul class="studies">${[...studies]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((s) => {
      const list = byStudy.get(s.id) ?? [];
      const rows = list
        .map((r) => `<tr><td>${h(analyteName(r.analyteId, lang, r.name))}</td><td class="num">${h(formatResult(r.value, r.decimals, r.qualifier, r.valueText, lang))}</td><td>${h(r.unit)}</td><td>${h(r.range?.text ?? '')}</td><td>${h(r.flagRaw)}</td></tr>`)
        .join('');
      return `<li class="study" data-study="${s.id}">
  <div class="study-head">
    <div><p class="study-date">${h(formatDate(s.date, lang))}</p><p class="study-lab">${h(s.lab || '-')}</p>
    <p class="help">${h(s.fileName)} · ${h(t(`review.source.${s.source}`))} · ${h(t('studies.results', { count: list.length }))}</p></div>
    <button type="button" class="btn btn-sm btn-danger" data-action="delete-study" aria-label="${h(t('studies.deleteLabel', { date: formatDate(s.date, lang), lab: s.lab || '-' }))}">${icons.trash()}${h(t('studies.delete'))}</button>
  </div>
  <details><summary>${h(t('studies.show'))}</summary>
  <div class="table-wrap"><table class="data-table"><thead><tr><th scope="col">${h(t('table.analyte'))}</th><th scope="col" class="num">${h(t('table.value'))}</th><th scope="col">${h(t('table.unit'))}</th><th scope="col">${h(t('table.range'))}</th><th scope="col">${h(t('tip.flag'))}</th></tr></thead><tbody>${rows}</tbody></table></div>
  </details>
</li>`;
    })
    .join('')}</ul>`;
}
