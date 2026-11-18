/** Iconos SVG en línea (decorativos: aria-hidden). Sin dependencias externas. */
const svg = (size: number, body: string, extra = '') =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${extra}>${body}</svg>`;

export const LOGO_SVG = `<svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#11141b" stroke="#cfff45" stroke-width="1.5"/><rect x="6" y="12" width="20" height="8" rx="1.5" fill="#cfff45" fill-opacity=".18"/><path d="M6.5 21.5 11 17l4 2.5 4.5-7 3.5 3 2.5-2" fill="none" stroke="#eceee6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="19.5" cy="12.5" r="2" fill="#ff5d47"/></svg>`;

export const icons = {
  logo: LOGO_SVG,
  lock: (s = 22) => svg(s, '<rect x="4" y="10.5" width="16" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>'),
  upload: (s = 18) => svg(s, '<path d="M12 15V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>'),
  spark: (s = 18) => svg(s, '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>'),
  pencil: (s = 18) => svg(s, '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>'),
  download: (s = 16) => svg(s, '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>'),
  print: (s = 16) => svg(s, '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>'),
  trash: (s = 16) => svg(s, '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>'),
  info: (s = 18) => svg(s, '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><path d="M12 7.5v.01"/>'),
  alert: (s = 18) => svg(s, '<path d="M12 4 2.8 19.5h18.4Z"/><path d="M12 10v4.5"/><path d="M12 17.3v.01"/>'),
  close: (s = 16) => svg(s, '<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: (s = 16) => svg(s, '<path d="M12 5v14M5 12h14"/>'),
  check: (s = 16) => svg(s, '<path d="m5 12.5 4.5 4.5L19 7.5"/>', ' stroke-width="2.4"'),
  stethoscope: (s = 22) => svg(s, '<path d="M6 3v6a4 4 0 0 0 8 0V3"/><path d="M10 13v2a5 5 0 0 0 10 0v-2"/><circle cx="20" cy="11" r="2"/>'),
  up: (s = 12) => svg(s, '<path d="m6 15 6-6 6 6"/>', ' stroke-width="2.6"'),
  down: (s = 12) => svg(s, '<path d="m6 9 6 6 6-6"/>', ' stroke-width="2.6"'),
};
