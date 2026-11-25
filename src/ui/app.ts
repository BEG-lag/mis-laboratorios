import { OCR_MB } from 'virtual:ocr-assets';
import { seriesToCsv } from '../lib/csv.ts';
import { parseDocument } from '../lib/extract.ts';
import { formatDate, todayIso } from '../lib/format.ts';
import { setLang, t } from '../lib/i18n.ts';
import { ingestFiles, type FileIssue, type IngestProgress } from '../lib/ingest.ts';
import { readPdf, initPdfWorker } from '../lib/pdf-browser.ts';
import {
  confirmDraft,
  CUSTOM,
  draftFromParsed,
  emptyRow,
  manualDraft,
  resultKey,
  setDraftSex,
  validateDraft,
  type Draft,
  type DraftError,
  type DraftRow,
} from '../lib/review.ts';
import { applyFilters, buildSeries, labsOf, NO_FILTERS, type Filters, type Series } from '../lib/series.ts';
import { hasSaved, loadState, saveState, wipeState } from '../lib/store.ts';
import { REPORTS, reportPages } from '../lib/synthetic.ts';
import { escapeHtml as h } from '../lib/text.ts';
import type { FlagDir, LabResult, Lang, PageText, Sex, Study } from '../lib/types.ts';
import { chartSvg, tooltipHtml } from './chart.ts';
import { printHtml } from './print.ts';
import {
  chartNotesHtml,
  chartTableHtml,
  clearOptionsCache,
  dashboardHtml,
  draftHtml,
  issuesHtml,
  seriesOptions,
  shellHtml,
  studiesHtml,
  unitDatalist,
} from './views.ts';

type Tab = 'dashboard' | 'chart' | 'studies';
const TABS: Tab[] = ['dashboard', 'chart', 'studies'];

interface State {
  lang: Lang;
  drafts: Draft[];
  draftErrors: Map<string, DraftError[]>;
  studies: Study[];
  results: LabResult[];
  issues: FileIssue[];
  knownHashes: Set<string>;
  persist: boolean;
  ocr: boolean;
  filters: Filters;
  tab: Tab;
  selected: string | null;
  busy: boolean;
  series: Series[];
  tipPinned: number | null;
}

const state: State = {
  lang: 'es',
  drafts: [],
  draftErrors: new Map(),
  studies: [],
  results: [],
  issues: [],
  knownHashes: new Set(),
  persist: false,
  ocr: false,
  filters: { ...NO_FILTERS },
  tab: 'dashboard',
  selected: null,
  busy: false,
  series: [],
  tipPinned: null,
};

let root: HTMLElement;
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/* ------------------------------------------------------------------ utilidades */

function announce(message: string): void {
  const live = $('live');
  live.textContent = '';
  window.setTimeout(() => (live.textContent = message), 30);
}

let toastTimer = 0;
function toast(message: string): void {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (el.hidden = true), 2800);
}

function setProgress(text: string, fraction: number | null): void {
  $('progress').hidden = false;
  $('progress-text').textContent = text;
  $('progress-fill').style.setProperty('--w', String(fraction === null ? 100 : Math.round(fraction * 100)));
}

function download(name: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ------------------------------------------------------------------ persistencia */

let saveTimer = 0;
function schedulePersist(): void {
  if (!state.persist) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveState({ version: 1, savedAt: new Date().toISOString(), studies: state.studies, results: state.results, settings: { lang: state.lang } })
      .then(() => {
        root.dataset.saved = String(state.results.length);
        announce(t('settings.saved'));
      })
      .catch(() => undefined);
  }, 250);
}

/* ------------------------------------------------------------------ render */

function renderAll(): void {
  const hasDrafts = state.drafts.length > 0;
  const hasHistory = state.studies.length > 0;
  const loaded = hasDrafts || hasHistory || state.issues.length > 0;
  root.classList.toggle('is-loaded', loaded);
  $('workspace').hidden = !loaded;
  $('choose-label').textContent = loaded ? t('drop.add') : t('drop.choose');
  ($('ocr-toggle') as HTMLInputElement).checked = state.ocr;
  root.dataset.draftCount = String(state.drafts.length);
  root.dataset.resultCount = String(state.results.length);
  renderNotices();
  renderDrafts();
  renderHistory();
}

function renderNotices(): void {
  $('notices').innerHTML = issuesHtml(state.issues);
}

function renderDrafts(): void {
  $('review').hidden = state.drafts.length === 0;
  $('drafts').innerHTML = state.drafts.map((d) => draftHtml(d, state.lang, state.draftErrors.get(d.id))).join('') + unitDatalist();
  root.dataset.draftCount = String(state.drafts.length);
}

function renderDraft(id: string, focusSelector?: string): void {
  const d = state.drafts.find((x) => x.id === id);
  const el = root.querySelector<HTMLElement>(`[data-draft="${id}"]`);
  if (!d || !el) return renderDrafts();
  el.outerHTML = draftHtml(d, state.lang, state.draftErrors.get(d.id));
  if (focusSelector) root.querySelector<HTMLElement>(focusSelector)?.focus();
}

function recomputeSeries(): void {
  state.series = buildSeries(applyFilters(state.results, state.studies, state.filters), state.studies, state.lang);
  if (state.selected && !state.series.some((s) => s.key === state.selected)) state.selected = null;
  if (!state.selected) state.selected = state.series.find((s) => s.points.some((p) => p.value !== null))?.key ?? state.series[0]?.key ?? null;
}

function setOptions(select: HTMLSelectElement, html: string, value: string): void {
  if (select.dataset.html !== html) {
    select.innerHTML = html;
    select.dataset.html = html;
  }
  select.value = value;
}

function renderHistory(): void {
  const has = state.studies.length > 0;
  $('history').hidden = !has;
  if (!has) return;
  recomputeSeries();
  const filtered = applyFilters(state.results, state.studies, state.filters);
  const studyIds = new Set(filtered.map((r) => r.studyId));
  $('history-summary').textContent = t('history.summary', { results: filtered.length, studies: studyIds.size, analytes: state.series.length });
  const labs = labsOf(state.studies);
  setOptions(
    $('f-lab') as HTMLSelectElement,
    `<option value="all">${h(t('filters.allLabs'))}</option>${labs.map((l) => `<option value="${h(l.key)}">${h(l.name)}</option>`).join('')}`,
    labs.some((l) => l.key === state.filters.lab) ? state.filters.lab : 'all',
  );
  const from = $('f-from') as HTMLInputElement;
  const to = $('f-to') as HTMLInputElement;
  if (document.activeElement !== from) from.value = state.filters.from;
  if (document.activeElement !== to) to.value = state.filters.to;
  ($('persist') as HTMLInputElement).checked = state.persist;
  $('tab-dashboard-count').textContent = String(state.series.length);
  $('tab-studies-count').textContent = String(state.studies.length);
  renderTabs();
  $('panel-dashboard').innerHTML = dashboardHtml(state.series, state.lang);
  renderChart();
  $('panel-studies').innerHTML = studiesHtml(state.studies, state.results, state.lang);
}

function renderTabs(): void {
  for (const tab of TABS) {
    const btn = $(`tab-${tab}`);
    const selected = state.tab === tab;
    btn.setAttribute('aria-selected', String(selected));
    btn.tabIndex = selected ? 0 : -1;
    $(`panel-${tab}`).hidden = !selected;
  }
}

function currentSeries(): Series | undefined {
  return state.series.find((s) => s.key === state.selected);
}

function renderChart(): void {
  const select = $('series-select') as HTMLSelectElement;
  setOptions(select, seriesOptions(state.series, state.lang), state.selected ?? '');
  const s = currentSeries();
  const title = $('chart-title');
  const notes = $('chart-notes');
  const table = $('chart-table');
  hideTip(true);
  if (!s) {
    title.textContent = t('chart.empty');
    notes.innerHTML = '';
    table.innerHTML = '';
    renderChartSvg();
    return;
  }
  title.textContent = t('chart.title', { name: s.name, unit: s.unit || '-' });
  const numeric = s.points.filter((p) => p.value !== null);
  $('chart-desc').textContent = t('chart.desc', {
    name: s.name,
    unit: s.unit || '-',
    from: numeric[0] ? formatDate(numeric[0].date, state.lang) : '-',
    to: numeric.length ? formatDate(numeric[numeric.length - 1]!.date, state.lang) : '-',
    count: numeric.length,
  });
  notes.innerHTML = chartNotesHtml(s, state.series, state.lang);
  table.innerHTML = chartTableHtml(s, state.lang);
  renderChartSvg();
}

function renderChartSvg(): void {
  const box = $('chart-box');
  const tip = $('chart-tip');
  box.querySelector('svg')?.remove();
  const s = currentSeries();
  if (!s || $('panel-chart').hidden) return;
  const width = Math.max(280, Math.floor(box.clientWidth || 720));
  const height = width < 480 ? 250 : 320;
  box.insertAdjacentHTML('afterbegin', chartSvg(s, { width, height, lang: state.lang, idPrefix: 'chart' }));
  box.append(tip);
}

/* ------------------------------------------------------------------ burbuja de la gráfica */

function showTip(index: number): void {
  const s = currentSeries();
  const g = $('chart-box').querySelector<SVGGElement>(`.pt[data-i="${index}"]`);
  if (!s || !g) return;
  const numeric = s.points.filter((p) => p.value !== null);
  const p = numeric[index];
  if (!p) return;
  const tip = $('chart-tip');
  tip.innerHTML = tooltipHtml(s, p, state.lang);
  tip.hidden = false;
  const box = $('chart-box');
  const x = Number(g.dataset.x);
  const y = Number(g.dataset.y);
  const tipW = tip.offsetWidth;
  const left = Math.min(Math.max(4, x - tipW / 2), box.clientWidth - tipW - 4);
  const above = y - tip.offsetHeight - 16;
  tip.style.setProperty('--tip-x', `${Math.round(left)}px`);
  tip.style.setProperty('--tip-y', `${Math.round(above < 0 ? y + 18 : above)}px`);
  box.querySelectorAll('.pt.is-active').forEach((el) => el.classList.remove('is-active'));
  g.classList.add('is-active');
}

function hideTip(force = false): void {
  if (state.tipPinned !== null && !force) return;
  if (force) state.tipPinned = null;
  const tip = document.getElementById('chart-tip');
  if (tip) tip.hidden = true;
  document.querySelectorAll('#chart-box .pt.is-active').forEach((el) => el.classList.remove('is-active'));
}

/* ------------------------------------------------------------------ carga */

function hashesInUse(): Set<string> {
  const set = new Set<string>();
  for (const d of state.drafts) if (d.hash) set.add(d.hash);
  for (const s of state.studies) if (s.hash) set.add(s.hash);
  return set;
}

async function ocrFn(): Promise<(image: Blob, page: number) => Promise<PageText>> {
  const mod = await import('../lib/ocr.ts');
  mod.onOcrProgress((status, progress) => {
    if (/recognizing/.test(status)) return;
    setProgress(t('progress.ocrEngine', { pct: `${Math.round(progress * 100)}%` }), progress);
  });
  return mod.ocrImage;
}

async function loadFiles(files: File[]): Promise<void> {
  if (files.length === 0 || state.busy) return;
  state.busy = true;
  const t0 = performance.now();
  try {
    const ocr = state.ocr ? await ocrFn() : undefined;
    const knownHashes = hashesInUse();
    const { drafts, issues } = await ingestFiles(files, {
      readPdf,
      ocr,
      knownHashes,
      onProgress: (p: IngestProgress) => {
        const text =
          p.stage === 'ocr'
            ? t('progress.ocr', { file: p.file, page: p.page ?? 1, pages: p.pages ?? 1 })
            : t('progress.reading', { file: p.file, index: p.index + 1, total: p.total });
        setProgress(text, p.total ? p.index / p.total : null);
      },
    });
    state.drafts.push(...drafts);
    state.issues = issues;
    const ms = Math.round(performance.now() - t0);
    const message = drafts.length ? t('progress.done', { docs: drafts.length, ms }) : t('progress.none');
    setProgress(message, 1);
    root.dataset.lastLoadMs = String(ms);
    renderAll();
    announce(message);
    if (drafts[0]) $(`${drafts[0].id}-title`)?.scrollIntoView({ block: 'start' });
  } finally {
    state.busy = false;
  }
}

function loadDemo(): void {
  const t0 = performance.now();
  for (const rep of REPORTS) {
    const doc = parseDocument(reportPages(rep));
    state.drafts.push(draftFromParsed(doc, rep.file, 'demo', `demo:${rep.file}`));
  }
  const ms = Math.round(performance.now() - t0);
  const message = t('progress.done', { docs: REPORTS.length, ms });
  setProgress(message, 1);
  renderAll();
  announce(message);
}

function addManual(): void {
  const d = manualDraft(t('manual.label'));
  state.drafts.push(d);
  renderAll();
  $(`${d.id}-date`).focus();
}

/** Recorre carpetas arrastradas (webkitGetAsEntry) para encontrar los archivos. */
async function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items ?? [])
    .map((item) => (typeof item.webkitGetAsEntry === 'function' ? item.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => e !== null);
  if (entries.length === 0) return Array.from(dt.files);
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      out.push(await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      let batch: FileSystemEntry[];
      do {
        batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        for (const child of batch) await walk(child);
      } while (batch.length > 0);
    }
  };
  try {
    for (const e of entries) await walk(e);
  } catch {
    return Array.from(dt.files);
  }
  return out.length ? out : Array.from(dt.files);
}

/* ------------------------------------------------------------------ revisión */

function findDraft(el: HTMLElement): { draft: Draft; row: DraftRow | undefined } | null {
  const art = el.closest<HTMLElement>('[data-draft]');
  const draft = state.drafts.find((d) => d.id === art?.dataset.draft);
  if (!draft) return null;
  const tr = el.closest<HTMLElement>('[data-row]');
  return { draft, row: draft.rows.find((r) => r.id === tr?.dataset.row) };
}

function confirmOne(id: string, quiet = false): boolean {
  const draft = state.drafts.find((d) => d.id === id);
  if (!draft) return false;
  const errors = validateDraft(draft);
  if (errors.length) {
    state.draftErrors.set(id, errors);
    renderDraft(id);
    if (!quiet) {
      const first = errors[0]!;
      const sel = first.field === 'date' ? `#${id}-date` : first.rowId ? `[data-draft="${id}"] [data-row="${first.rowId}"] [aria-invalid="true"]` : `[data-draft="${id}"] [data-action="add-row"]`;
      root.querySelector<HTMLElement>(sel)?.focus();
      announce(t('review.errors', { count: errors.length }));
    }
    return false;
  }
  state.draftErrors.delete(id);
  const { study, results } = confirmDraft(draft);
  const byId = new Map(state.studies.map((s) => [s.id, s] as const));
  const existing = new Set(state.results.map((r) => resultKey(r, byId.get(r.studyId)!)));
  const fresh = results.filter((r) => !existing.has(resultKey(r, study)));
  const dupes = results.length - fresh.length;
  if (fresh.length) {
    state.studies.push(study);
    state.results.push(...fresh);
  }
  state.drafts = state.drafts.filter((d) => d.id !== id);
  const message = [t('review.confirmed', { count: fresh.length, file: draft.fileName }), dupes ? t('review.duplicates', { count: dupes }) : ''].filter(Boolean).join(' ');
  if (!quiet) {
    toast(message);
    announce(message);
  }
  return true;
}

function afterConfirm(): void {
  schedulePersist();
  renderAll();
  const next = state.drafts[0];
  if (next) $(`${next.id}-title`)?.closest('article')?.querySelector<HTMLElement>('input, select')?.focus();
  else if (state.studies.length) {
    state.tab = 'dashboard';
    renderTabs();
    $('history-title').setAttribute('tabindex', '-1');
    $('history-title').focus();
  }
}

/* ------------------------------------------------------------------ eventos */

function setTab(tab: Tab, focus = false): void {
  state.tab = tab;
  renderTabs();
  if (tab === 'chart') renderChartSvg();
  if (focus) $(`tab-${tab}`).focus();
}

function openSeries(key: string): void {
  state.selected = key;
  setTab('chart');
  renderChart();
  $('chart-title').setAttribute('tabindex', '-1');
  $('chart-title').focus();
}

function bindDropzone(): void {
  const fileInput = $('file-input') as HTMLInputElement;
  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files ?? []);
    fileInput.value = '';
    void loadFiles(files);
  });
  $('demo-btn').addEventListener('click', loadDemo);
  $('manual-btn').addEventListener('click', addManual);
  ($('ocr-toggle') as HTMLInputElement).addEventListener('change', (e) => {
    state.ocr = (e.target as HTMLInputElement).checked;
  });
  const zone = $('dropzone');
  zone.addEventListener('dragenter', (e) => {
    e.preventDefault();
    zone.classList.add('is-over');
  });
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  zone.addEventListener('dragleave', (e) => {
    if (e.target === zone) zone.classList.remove('is-over');
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('is-over');
    if (e.dataTransfer) void filesFromDataTransfer(e.dataTransfer).then(loadFiles);
  });
}

function bindReview(): void {
  const drafts = $('drafts');
  drafts.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    const found = findDraft(el);
    if (!found) return;
    const { draft, row } = found;
    const dfield = el.dataset.dfield;
    if (dfield === 'date') draft.date = el.value;
    else if (dfield === 'lab') draft.lab = el.value;
    const field = el.dataset.field;
    if (!row || !field) return;
    if (field === 'name' || field === 'valueText' || field === 'unit') row[field] = el.value;
    else if (field === 'lowText' || field === 'highText') {
      row[field] = el.value;
      row.rangeEdited = true;
    }
    if (el.getAttribute('aria-invalid') === 'true') el.removeAttribute('aria-invalid');
  });
  drafts.addEventListener('change', (e) => {
    const el = e.target as HTMLSelectElement;
    const found = findDraft(el);
    if (!found) return;
    const { draft, row } = found;
    if (el.dataset.dfield === 'sex') {
      setDraftSex(draft, (el.value || null) as Sex | null);
      renderDraft(draft.id, `#${draft.id}-sex`);
      return;
    }
    if (el.dataset.dfield === 'date') draft.date = el.value;
    if (!row) return;
    if (el.dataset.field === 'analyteId') {
      const wasCustom = row.analyteId === CUSTOM;
      row.analyteId = el.value;
      if (wasCustom !== (row.analyteId === CUSTOM)) {
        renderDraft(draft.id, row.analyteId === CUSTOM ? `[data-draft="${draft.id}"] [data-row="${row.id}"] [data-field="name"]` : `[data-draft="${draft.id}"] [data-row="${row.id}"] [data-field="analyteId"]`);
      }
    }
    if (el.dataset.field === 'flag') {
      row.flag = (el.value || null) as FlagDir | null;
      row.flagRaw = '';
    }
  });
  drafts.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!btn) return;
    const found = findDraft(btn);
    if (!found) return;
    const { draft, row } = found;
    const action = btn.dataset.action;
    if (action === 'add-row') {
      const r = emptyRow();
      draft.rows.push(r);
      renderDraft(draft.id, `[data-draft="${draft.id}"] [data-row="${r.id}"] select`);
    } else if (action === 'delete-row' && row) {
      const idx = draft.rows.indexOf(row);
      draft.rows.splice(idx, 1);
      const next = draft.rows[idx] ?? draft.rows[idx - 1];
      renderDraft(draft.id, next ? `[data-draft="${draft.id}"] [data-row="${next.id}"] [data-action="delete-row"]` : `[data-draft="${draft.id}"] [data-action="add-row"]`);
    } else if (action === 'discard') {
      if (!window.confirm(t('review.discardConfirm', { file: draft.fileName }))) return;
      state.drafts = state.drafts.filter((d) => d !== draft);
      state.draftErrors.delete(draft.id);
      renderAll();
      (state.drafts[0] ? $(`${state.drafts[0].id}-date`) : $('demo-btn')).focus();
    } else if (action === 'confirm') {
      if (confirmOne(draft.id)) afterConfirm();
    }
  });
  $('confirm-all').addEventListener('click', () => {
    const ids = state.drafts.map((d) => d.id);
    let ok = 0;
    for (const id of ids) if (confirmOne(id, true)) ok++;
    afterConfirm();
    const pending = state.drafts.length;
    const message = t('review.confirmedAll', { docs: ok, count: state.results.length });
    toast(message);
    if (pending) {
      const first = state.drafts[0]!;
      const errors = state.draftErrors.get(first.id) ?? [];
      announce(t('review.errors', { count: errors.length }));
      $(`${first.id}-title`)?.scrollIntoView({ block: 'start' });
    } else announce(message);
  });
}

function bindHistory(): void {
  const filterChange = () => {
    state.filters = {
      from: ($('f-from') as HTMLInputElement).value,
      to: ($('f-to') as HTMLInputElement).value,
      lab: ($('f-lab') as HTMLSelectElement).value || 'all',
    };
    renderHistory();
  };
  $('f-from').addEventListener('change', filterChange);
  $('f-to').addEventListener('change', filterChange);
  $('f-lab').addEventListener('change', filterChange);
  $('filters').addEventListener('submit', (e) => e.preventDefault());
  $('f-clear').addEventListener('click', () => {
    state.filters = { ...NO_FILTERS };
    renderHistory();
  });

  const tablist = root.querySelector<HTMLElement>('[role="tablist"]')!;
  tablist.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]');
    if (btn) setTab(btn.dataset.tab as Tab);
  });
  tablist.addEventListener('keydown', (e) => {
    const idx = TABS.indexOf(state.tab);
    const moves: Record<string, number> = { ArrowRight: (idx + 1) % TABS.length, ArrowLeft: (idx - 1 + TABS.length) % TABS.length, Home: 0, End: TABS.length - 1 };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    setTab(TABS[next]!, true);
  });

  $('panel-dashboard').addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest<HTMLElement>('[data-series]');
    if (card) openSeries(card.dataset.series!);
  });
  $('series-select').addEventListener('change', (e) => {
    state.selected = (e.target as HTMLSelectElement).value;
    renderChart();
  });
  $('chart-notes').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-series]');
    if (btn) openSeries(btn.dataset.series!);
  });

  const box = $('chart-box');
  const pointIndex = (el: EventTarget | null) => {
    const g = (el as Element | null)?.closest?.('.pt') as SVGGElement | null;
    return g ? Number(g.dataset.i) : null;
  };
  box.addEventListener('pointerover', (e) => {
    const i = pointIndex(e.target);
    if (i !== null && state.tipPinned === null) showTip(i);
  });
  box.addEventListener('pointerout', (e) => {
    if (pointIndex(e.target) !== null && pointIndex(e.relatedTarget) === null) hideTip();
  });
  box.addEventListener('focusin', (e) => {
    const i = pointIndex(e.target);
    if (i !== null) {
      if (state.tipPinned !== null && state.tipPinned !== i) state.tipPinned = null;
      showTip(i);
    }
  });
  box.addEventListener('focusout', (e) => {
    if (pointIndex(e.relatedTarget) === null) hideTip(true);
  });
  box.addEventListener('click', (e) => {
    const i = pointIndex(e.target);
    if (i === null) {
      hideTip(true);
      return;
    }
    state.tipPinned = state.tipPinned === i ? null : i;
    showTip(i);
  });
  box.addEventListener('keydown', (e) => {
    const i = pointIndex(e.target);
    if (i === null) return;
    const pts = Array.from(box.querySelectorAll<SVGGElement>('.pt'));
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      state.tipPinned = state.tipPinned === i ? null : i;
      showTip(i);
    } else if (e.key === 'Escape') {
      hideTip(true);
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = pts[i + (e.key === 'ArrowRight' ? 1 : -1)];
      next?.focus();
    }
  });

  $('panel-studies').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action="delete-study"]');
    if (!btn) return;
    const id = btn.closest<HTMLElement>('[data-study]')?.dataset.study;
    const study = state.studies.find((s) => s.id === id);
    if (!study) return;
    const count = state.results.filter((r) => r.studyId === study.id).length;
    if (!window.confirm(t('studies.deleteConfirm', { date: formatDate(study.date, state.lang), lab: study.lab || '-', count }))) return;
    state.studies = state.studies.filter((s) => s !== study);
    state.results = state.results.filter((r) => r.studyId !== study.id);
    schedulePersist();
    renderAll();
    toast(t('studies.deleted'));
    announce(t('studies.deleted'));
    if (state.studies.length) $('tab-studies').focus();
  });

  $('export-csv').addEventListener('click', () => exportCsv(false));
  $('export-excel').addEventListener('click', () => exportCsv(true));
  $('print-btn').addEventListener('click', () => {
    fillPrint();
    window.print();
  });

  ($('persist') as HTMLInputElement).addEventListener('change', (e) => {
    state.persist = (e.target as HTMLInputElement).checked;
    if (state.persist) schedulePersist();
    else {
      window.clearTimeout(saveTimer);
      void wipeState();
    }
  });
  $('clear-all').addEventListener('click', () => {
    if (!window.confirm(t('settings.clearConfirm'))) return;
    window.clearTimeout(saveTimer);
    void wipeState().then(() => {
      state.drafts = [];
      state.draftErrors.clear();
      state.studies = [];
      state.results = [];
      state.issues = [];
      state.persist = false;
      state.filters = { ...NO_FILTERS };
      state.selected = null;
      state.tab = 'dashboard';
      mount();
      $('progress').hidden = true;
      toast(t('settings.cleared'));
      announce(t('settings.cleared'));
      $('demo-btn').focus();
    });
  });
}

function exportCsv(excel: boolean): void {
  const csv = seriesToCsv(state.series, state.lang, { excel });
  download(`mis-laboratorios-${todayIso()}${excel ? '-excel' : ''}.csv`, csv, 'text/csv;charset=utf-8');
}

function fillPrint(): void {
  const labs = labsOf(state.studies);
  const labName = state.filters.lab === 'all' ? t('filters.allLabs') : (labs.find((l) => l.key === state.filters.lab)?.name ?? '-');
  const studyIds = new Set(applyFilters(state.results, state.studies, state.filters).map((r) => r.studyId));
  $('print-summary').innerHTML = printHtml(
    state.series,
    state.studies.filter((s) => studyIds.has(s.id)),
    state.filters,
    labName,
    state.lang,
  );
}

function bindGlobal(): void {
  $('lang-toggle').addEventListener('click', () => {
    state.lang = state.lang === 'es' ? 'en' : 'es';
    mount();
    $('lang-toggle').focus();
    schedulePersist();
  });
  $('notices').addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('#dismiss-issues')) {
      state.issues = [];
      renderAll();
      $('file-input').focus();
    }
  });
}

/** Evita que soltar un archivo fuera de la zona haga que el navegador lo abra. */
function guardWindowDrop(): void {
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (e.dataTransfer && !(e.target as HTMLElement).closest?.('#dropzone')) void filesFromDataTransfer(e.dataTransfer).then(loadFiles);
  });
  window.addEventListener('beforeprint', () => {
    if (state.studies.length && !$('print-summary').innerHTML) fillPrint();
  });
  window.addEventListener('afterprint', () => {
    $('print-summary').innerHTML = '';
  });
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (state.tab === 'chart' && !$('history').hidden) {
        hideTip(true);
        renderChartSvg();
      }
    }, 150);
  });
}

function mount(): void {
  setLang(state.lang);
  clearOptionsCache();
  document.documentElement.lang = state.lang === 'es' ? 'es-MX' : 'en';
  document.title = t('app.title');
  // El logo de PIVOTEK no cambia con el idioma: al volver a montar se conserva el mismo nodo para que
  // sus imágenes no se pidan otra vez. El <template> es inerte, así que las <img> de la copia nueva
  // nunca cargan: se vacía antes de insertarla y en su lugar se pone el logo que ya estaba.
  const shell = document.createElement('template');
  shell.innerHTML = shellHtml(state.lang, String(OCR_MB));
  const pvk = root.querySelector('.pvk');
  const slot = pvk ? shell.content.querySelector('.pvk') : null;
  slot?.replaceChildren();
  root.replaceChildren(shell.content);
  if (pvk && slot) slot.replaceWith(pvk);
  bindGlobal();
  bindDropzone();
  bindReview();
  bindHistory();
  renderAll();
}

export async function start(container: HTMLElement): Promise<void> {
  root = container;
  guardWindowDrop();
  const params = new URLSearchParams(location.search);
  if (params.get('lang') === 'en') state.lang = 'en';
  mount();
  await initPdfWorker();
  if (await hasSaved()) {
    const saved = await loadState().catch(() => null);
    if (saved) {
      state.studies = saved.studies;
      state.results = saved.results;
      state.lang = params.get('lang') === 'en' ? 'en' : saved.settings.lang;
      state.persist = true;
      mount();
    }
  }
}
