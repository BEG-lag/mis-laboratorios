/**
 * Reportes de laboratorio SINTÉTICOS para el demo, las pruebas y las capturas de pantalla.
 *
 * Paciente, laboratorios, folios, médicos, teléfonos y valores son inventados. Las cinco
 * maquetas imitan rasgos comunes de reportes de laboratorios grandes en México (tablas de cuatro
 * columnas, coma decimal, columna de resultado anterior, biometría en dos columnas, escaneo), sin
 * copiar el diseño de ningún laboratorio real.
 *
 * El mismo modelo se usa para dibujar los PDF de prueba (scripts/fixtures.ts) y para el botón
 * "Probar con datos de ejemplo", que pasa estas páginas directamente al extractor.
 */
import { groupLines, type PositionedText } from './layout.ts';
import type { PageText } from './types.ts';

export type Layout = 'clasico' | 'coma' | 'historico' | 'dos-columnas' | 'escaneado';

export interface SynthRow {
  name: string;
  value: string;
  unit: string;
  /** Una o varias líneas del rango de referencia. */
  range: string | string[];
  flag?: string;
  /** Resultado anterior (maqueta "historico"). */
  prev?: string;
}

export interface SynthSection {
  title: string;
  rows: SynthRow[];
  /** Segunda tabla lado a lado (maqueta "dos-columnas"). */
  right?: SynthRow[];
  notes?: string[];
}

export interface SynthReport {
  file: string;
  layout: Layout;
  lab: string;
  labLine: string;
  date: string;
  dateText: string;
  printedText: string;
  folio: string;
  pages: SynthSection[][];
}

export interface DrawnText extends PositionedText {
  bold: boolean;
}

export interface DrawnPage {
  width: number;
  height: number;
  items: DrawnText[];
}

export const PATIENT = 'Paciente de Ejemplo';
export const BIRTH = '12/05/1978';
export const SEX_TEXT = 'Masculino';

function ageAt(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  let age = y - 1978;
  if (m < 5 || (m === 5 && d < 12)) age--;
  return age;
}

/* Anchos de Helvetica (AFM, milésimas de em) para alinear a la derecha igual que el PDF. */
const W: Record<string, number> = {};
const widths: [string, number][] = [
  [' !,./:;Iijl[\\]ft', 278],
  ['"', 355],
  ['#$0123456789?L_abdeghnopqu', 556],
  ['%', 889],
  ['&ABEKPSVXY', 667],
  ["'", 191],
  ['()-`r', 333],
  ['*', 389],
  ['+<=>~', 584],
  ['@', 1015],
  ['CDHNRUw', 722],
  ['FTZ', 611],
  ['GOQ', 778],
  ['J', 500],
  ['M', 833],
  ['W', 944],
  ['^', 469],
  ['cksvxyz', 500],
  ['m', 833],
  ['{}', 334],
  ['|', 260],
  ['áéóúñüµ', 556],
  ['í', 278],
  ['ÁÉ', 667],
  ['Í', 278],
  ['Ó', 778],
  ['ÚÑ', 722],
  ['³²¹', 333],
  ['°', 400],
];
for (const [chars, w] of widths) for (const ch of chars) W[ch] = w;

export function textWidth(text: string, size: number, bold = false): number {
  let total = 0;
  for (const ch of text) total += W[ch] ?? 556;
  return (total / 1000) * size * (bold ? 1.06 : 1);
}

const r = (name: string, value: string, unit: string, range: string | string[], extra: Partial<SynthRow> = {}): SynthRow => ({
  name,
  value,
  unit,
  range,
  ...extra,
});

export const REPORTS: SynthReport[] = [
  {
    file: 'laboratorio-ejemplo-2019-03.pdf',
    layout: 'clasico',
    lab: 'LABORATORIO CLÍNICO EJEMPLO',
    labLine: 'Análisis clínicos de ejemplo · Sucursal Centro · Tel. 55 0000 0000',
    date: '2019-03-14',
    dateText: 'Fecha de toma: 14/03/2019',
    printedText: 'Fecha de impresión: 15/03/2019',
    folio: 'Folio: EJ-190314-001',
    pages: [
      [
        {
          title: 'QUÍMICA SANGUÍNEA',
          rows: [
            r('Glucosa', '92', 'mg/dL', '70 - 100'),
            r('Urea', '30.0', 'mg/dL', '15.0 - 38.5'),
            r('Nitrógeno ureico (BUN)', '14.0', 'mg/dL', '7.0 - 18.0'),
            r('Creatinina', '0.92', 'mg/dL', '0.70 - 1.30'),
            r('Ácido úrico', '6.8', 'mg/dL', '3.5 - 7.2'),
          ],
          notes: ['Método: enzimático colorimétrico. Ayuno de 8 horas.'],
        },
        {
          title: 'PERFIL DE LÍPIDOS',
          rows: [
            r('Colesterol total', '185', 'mg/dL', '< 200'),
            r('Colesterol HDL', '46', 'mg/dL', '> 40'),
            r('Colesterol LDL (calculado)', '112', 'mg/dL', '< 130'),
            r('Triglicéridos', '135', 'mg/dL', '< 150'),
          ],
        },
        {
          title: 'PRUEBAS DE FUNCIÓN HEPÁTICA',
          rows: [r('TGO (AST)', '24', 'U/L', 'Hasta 40'), r('TGP (ALT)', '33', 'U/L', 'Hasta 41')],
        },
        {
          title: 'BIOMETRÍA HEMÁTICA',
          rows: [
            r('Hemoglobina', '15.2', 'g/dL', ['Hombres: 13.5 - 17.5', 'Mujeres: 12.0 - 15.5']),
            r('Hematocrito', '45.1', '%', ['Hombres: 40.0 - 52.0', 'Mujeres: 36.0 - 46.0']),
            r('Leucocitos', '6.5', 'x10³/µL', '4.5 - 11.0'),
            r('Plaquetas', '250', 'x10³/µL', '150 - 450'),
          ],
        },
      ],
    ],
  },
  {
    file: 'laboratorio-ejemplo-2020-09.pdf',
    layout: 'clasico',
    lab: 'LABORATORIO CLÍNICO EJEMPLO',
    labLine: 'Análisis clínicos de ejemplo · Sucursal Centro · Tel. 55 0000 0000',
    date: '2020-09-02',
    dateText: 'Fecha de toma: 02/09/2020',
    printedText: 'Fecha de impresión: 03/09/2020',
    folio: 'Folio: EJ-200902-014',
    pages: [
      [
        {
          title: 'QUÍMICA SANGUÍNEA',
          rows: [
            r('Glucosa', '97', 'mg/dL', '70 - 100'),
            r('Nitrógeno ureico (BUN)', '15.0', 'mg/dL', '7.0 - 18.0'),
            r('Creatinina', '0.95', 'mg/dL', '0.70 - 1.30'),
            r('Ácido úrico', '7.4', 'mg/dL', '3.5 - 7.2', { flag: 'H' }),
          ],
        },
        {
          title: 'PERFIL DE LÍPIDOS',
          rows: [
            r('Colesterol total', '198', 'mg/dL', '< 200'),
            r('Colesterol HDL', '44', 'mg/dL', '> 40'),
            r('Colesterol LDL (calculado)', '121', 'mg/dL', '< 130'),
            r('Triglicéridos', '160', 'mg/dL', '< 150', { flag: 'H' }),
          ],
        },
        {
          title: 'PERFIL TIROIDEO',
          rows: [r('TSH', '2.10', 'µUI/mL', '0.35 - 4.94'), r('T4 libre', '1.12', 'ng/dL', '0.70 - 1.48')],
        },
        {
          title: 'BIOMETRÍA HEMÁTICA',
          rows: [
            r('Hemoglobina', '15.0', 'g/dL', ['Hombres: 13.5 - 17.5', 'Mujeres: 12.0 - 15.5']),
            r('Hematocrito', '44.6', '%', ['Hombres: 40.0 - 52.0', 'Mujeres: 36.0 - 46.0']),
            r('Leucocitos', '7.1', 'x10³/µL', '4.5 - 11.0'),
            r('Plaquetas', '238', 'x10³/µL', '150 - 450'),
          ],
        },
      ],
    ],
  },
  {
    file: 'analisis-valle-ficticio-2021-08.pdf',
    layout: 'coma',
    lab: 'Análisis Clínicos del Valle Ficticio',
    labLine: 'Laboratorio de prueba · Av. Inventada 123 · Ciudad de Ejemplo',
    date: '2021-08-22',
    dateText: 'Fecha de recepción: 22-ago-2021',
    printedText: 'Fecha de emisión: 23-ago-2021',
    folio: 'Orden: 21-08-55501',
    pages: [
      [
        {
          title: 'QUÍMICA CLÍNICA',
          rows: [
            r('Glucosa en ayunas', '5,6', 'mmol/L', '3,9 - 5,6'),
            r('Urea', '32', 'mg/dL', '17 - 43'),
            r('Creatinina', '0,98', 'mg/dL', '0,7 - 1,2'),
            r('Ácido úrico', '7,1 H', 'mg/dL', 'H: 3,4 - 7,0 / M: 2,4 - 5,7'),
            r('Sodio', '140', 'mEq/L', '136 - 145'),
            r('Potasio', '4,2', 'mEq/L', '3,5 - 5,1'),
            r('Hemoglobina glucosilada (HbA1c)', '5,6', '%', '4,0 - 5,6'),
          ],
        },
        {
          title: 'PERFIL LIPÍDICO',
          rows: [
            r('Colesterol', '212 H', 'mg/dL', 'Menor de 200'),
            r('Colesterol HDL', '41', 'mg/dL', 'Mayor de 40'),
            r('Colesterol LDL', '138 H', 'mg/dL', 'Hasta 130'),
            r('Triglicéridos', '178 H', 'mg/dL', 'Hasta 150'),
          ],
        },
        {
          title: 'FUNCIÓN HEPÁTICA',
          rows: [
            r('Aspartato aminotransferasa (AST)', '31', 'UI/L', '5 - 34'),
            r('Alanina aminotransferasa (ALT)', '45', 'UI/L', '0 - 55'),
            r('Gamma glutamil transferasa', '42', 'UI/L', '12 - 64'),
          ],
        },
      ],
      [
        {
          title: 'HEMATOLOGÍA',
          rows: [
            r('Hemoglobina', '15,4', 'g/dL', 'H: 13,5 - 17,5 / M: 12,0 - 15,5'),
            r('Hematocrito', '46,0', '%', 'H: 40,0 - 52,0 / M: 36,0 - 46,0'),
            r('Leucocitos', '6.800', '/µL', '4.500 - 11.000'),
            r('Plaquetas', '245.000', '/µL', '150.000 - 450.000'),
            r('Ferritina', '145', 'ng/mL', ['Hombres: 30 - 400', 'Mujeres: 13 - 150']),
          ],
        },
      ],
    ],
  },
  {
    file: 'laboratorio-demo-norte-2022-11.pdf',
    layout: 'historico',
    lab: 'Laboratorio Demo Norte',
    labLine: 'Diagnóstico clínico ficticio · Unidad Norte · contacto@ejemplo.invalid',
    date: '2022-11-05',
    dateText: 'Fecha de toma de muestra: 05 de noviembre de 2022',
    printedText: 'Fecha de liberación: 07 de noviembre de 2022',
    folio: 'Folio: DN-2211-0457',
    pages: [
      [
        {
          title: 'QUÍMICA SANGUÍNEA',
          rows: [
            r('Glucosa', '104', 'mg/dL', '74 - 106', { prev: '97 (02/09/2020)' }),
            r('Nitrógeno ureico', '16', 'mg/dL', '6 - 20', { prev: '15 (02/09/2020)' }),
            r('Creatinina', '1.01', 'mg/dL', '0.67 - 1.17', { prev: '0.95 (02/09/2020)' }),
            r('Hemoglobina glucosilada', '5.8', '%', ['No diabético: < 5.7', 'Prediabetes: 5.7 - 6.4', 'Diabetes: >= 6.5'], { prev: '5.6 (22/08/2021)' }),
          ],
        },
        {
          title: 'PERFIL DE LÍPIDOS',
          rows: [
            r('Colesterol total', '225*', 'mg/dL', '< 200', { prev: '212 (22/08/2021)' }),
            r('Colesterol HDL', '39*', 'mg/dL', '> 40', { prev: '41 (22/08/2021)' }),
            r('Colesterol LDL directo', '150', 'mg/dL', ['Óptimo: < 100', 'Limítrofe alto: 130 - 159', 'Alto: >= 160']),
            r('Triglicéridos', '182*', 'mg/dL', '< 150', { prev: '178 (22/08/2021)' }),
          ],
        },
        {
          title: 'PERFIL TIROIDEO',
          rows: [r('TSH', '2.80', 'µUI/mL', '0.40 - 4.00', { prev: '2.10 (02/09/2020)' }), r('T4 libre', '1.18', 'ng/dL', '0.93 - 1.70', { prev: '1.12 (02/09/2020)' })],
        },
        {
          title: 'VITAMINAS',
          rows: [
            r('Vitamina D 25-OH', '18.5', 'ng/mL', ['Deficiencia: < 20', 'Insuficiencia: 20 - 29', 'Suficiencia: 30 - 100']),
            r('Vitamina B12', '310', 'pg/mL', '200 - 900'),
          ],
        },
        {
          title: 'MARCADORES',
          rows: [r('Antígeno prostático específico total', '0.62', 'ng/mL', '< 4.0')],
        },
      ],
    ],
  },
  {
    file: 'laboratorio-demo-norte-2023-10.pdf',
    layout: 'historico',
    lab: 'Laboratorio Demo Norte',
    labLine: 'Diagnóstico clínico ficticio · Unidad Norte · contacto@ejemplo.invalid',
    date: '2023-10-03',
    dateText: 'Fecha de toma de muestra: 03 de octubre de 2023',
    printedText: 'Fecha de liberación: 04 de octubre de 2023',
    folio: 'Folio: DN-2310-0912',
    pages: [
      [
        {
          title: 'QUÍMICA SANGUÍNEA',
          rows: [
            r('Glucosa', '108*', 'mg/dL', '74 - 106', { prev: '104 (05/11/2022)' }),
            r('Nitrógeno ureico', '17', 'mg/dL', '6 - 20', { prev: '16 (05/11/2022)' }),
            r('Creatinina', '1.03', 'mg/dL', '0.67 - 1.17', { prev: '1.01 (05/11/2022)' }),
            r('Ácido úrico', '6.9', 'mg/dL', '3.4 - 7.0'),
            r('Hemoglobina glucosilada', '5.9', '%', ['No diabético: < 5.7', 'Prediabetes: 5.7 - 6.4', 'Diabetes: >= 6.5'], { prev: '5.8 (05/11/2022)' }),
          ],
        },
        {
          title: 'PERFIL DE LÍPIDOS',
          rows: [
            r('Colesterol total', '219*', 'mg/dL', '< 200', { prev: '225 (05/11/2022)' }),
            r('Colesterol HDL', '42', 'mg/dL', '> 40', { prev: '39 (05/11/2022)' }),
            r('Colesterol LDL directo', '141', 'mg/dL', ['Óptimo: < 100', 'Limítrofe alto: 130 - 159', 'Alto: >= 160'], { prev: '150 (05/11/2022)' }),
            r('Triglicéridos', '170*', 'mg/dL', '< 150', { prev: '182 (05/11/2022)' }),
          ],
        },
        {
          title: 'FUNCIÓN HEPÁTICA',
          rows: [r('TGO', '29', 'U/L', '< 40'), r('TGP', '38', 'U/L', '< 41')],
        },
        {
          title: 'PERFIL TIROIDEO',
          rows: [r('TSH', '3.10', 'µUI/mL', '0.40 - 4.00', { prev: '2.80 (05/11/2022)' }), r('T4 libre', '1.05', 'ng/dL', '0.93 - 1.70', { prev: '1.18 (05/11/2022)' })],
        },
        {
          title: 'VITAMINAS Y HIERRO',
          rows: [
            r('Vitamina D 25-OH', '27.4', 'ng/mL', ['Deficiencia: < 20', 'Insuficiencia: 20 - 29', 'Suficiencia: 30 - 100'], { prev: '18.5 (05/11/2022)' }),
            r('Vitamina B12', '285', 'pg/mL', '200 - 900', { prev: '310 (05/11/2022)' }),
            r('Ferritina', '160', 'ng/mL', ['Hombres: 30 - 400', 'Mujeres: 13 - 150']),
          ],
        },
        {
          title: 'MARCADORES',
          rows: [r('Antígeno prostático específico total', '0.71', 'ng/mL', '< 4.0', { prev: '0.62 (05/11/2022)' })],
        },
      ],
    ],
  },
  {
    file: 'centro-diagnostico-prueba-2025-02.pdf',
    layout: 'dos-columnas',
    lab: 'Centro de Diagnóstico Prueba',
    labLine: 'Patología clínica de ejemplo · Sucursal Sur',
    date: '2025-02-17',
    dateText: 'Fecha de toma: 17-FEB-2025',
    printedText: 'Fecha de impresión: 18-FEB-2025',
    folio: 'Orden: CDP-250217-3381',
    pages: [
      [
        {
          title: 'BIOMETRÍA HEMÁTICA COMPLETA',
          rows: [
            r('Eritrocitos', '5.10', 'x10^12/L', '4.50 - 5.90'),
            r('Hemoglobina', '152', 'g/L', '135 - 175'),
            r('Hematocrito', '0.45', 'L/L', '0.40 - 0.52'),
            r('VCM', '88.2', 'fL', '80.0 - 100.0'),
            r('HCM', '29.8', 'pg', '27.0 - 33.0'),
            r('CMHC', '33.8', 'g/dL', '32.0 - 36.0'),
            r('ADE', '13.1', '%', '11.5 - 14.5'),
            r('Plaquetas', '231', 'x10^9/L', '150 - 450'),
          ],
          right: [
            r('Leucocitos', '5.9', 'x10^9/L', '4.0 - 10.0'),
            r('Neutrófilos %', '55.2', '%', '40.0 - 75.0'),
            r('Linfocitos %', '33.1', '%', '20.0 - 45.0'),
            r('Monocitos %', '7.4', '%', '2.0 - 10.0'),
            r('Eosinófilos %', '3.6', '%', '0.0 - 6.0'),
            r('Basófilos %', '0.7', '%', '0.0 - 2.0'),
            r('Neutrófilos #', '3.26', 'x10^9/L', '1.80 - 7.50'),
            r('Linfocitos #', '1.95', 'x10^9/L', '1.00 - 4.80'),
          ],
        },
        {
          title: 'QUÍMICA SANGUÍNEA',
          rows: [
            r('Glucosa', '101', 'mg/dL', '70 - 99', { flag: 'H' }),
            r('Urea', '34', 'mg/dL', '17 - 49'),
            r('BUN', '15.9', 'mg/dL', '8.0 - 23.0'),
            r('Creatinina', '88', 'µmol/L', '62 - 106'),
            r('Tasa de filtración glomerular estimada', '94', 'mL/min/1.73m²', '> 60'),
            r('Ácido úrico', '6.5', 'mg/dL', '3.5 - 7.2'),
            r('Hemoglobina glucosilada (HbA1c)', '39', 'mmol/mol', '20 - 42'),
            r('Colesterol total', '196', 'mg/dL', '< 200'),
            r('Colesterol HDL', '47', 'mg/dL', '> 40'),
            r('Colesterol LDL calculado', '118', 'mg/dL', '< 130'),
            r('Triglicéridos', '140', 'mg/dL', '< 150'),
            r('TGO / AST', '26', 'U/L', '< 40'),
            r('TGP / ALT', '30', 'U/L', '< 41'),
            r('GGT', '36', 'U/L', '8 - 61'),
            r('PCR ultrasensible', '<0.3', 'mg/L', '< 3.0'),
          ],
        },
        {
          title: 'HORMONAS, VITAMINAS Y MARCADORES',
          rows: [
            r('TSH', '2.60', 'mUI/L', '0.27 - 4.20'),
            r('T4 libre', '15.2', 'pmol/L', '12.0 - 22.0'),
            r('Vitamina D 25-OH', '34.1', 'ng/mL', '30 - 100'),
            r('Vitamina B12', '402', 'pg/mL', '197 - 771'),
            r('Ferritina', '172', 'µg/L', '30 - 400'),
            r('PSA total', '0.80', 'ng/mL', '0.00 - 4.00'),
          ],
        },
      ],
    ],
  },
  {
    file: 'laboratorio-ejemplo-2026-06-escaneado.pdf',
    layout: 'escaneado',
    lab: 'LABORATORIO CLÍNICO EJEMPLO',
    labLine: 'Análisis clínicos de ejemplo · Sucursal Centro · Tel. 55 0000 0000',
    date: '2026-06-09',
    dateText: 'Fecha de toma: 09/06/2026',
    printedText: 'Fecha de impresión: 10/06/2026',
    folio: 'Folio: EJ-260609-022',
    pages: [
      [
        {
          title: 'QUÍMICA SANGUÍNEA',
          rows: [
            r('Glucosa', '95', 'mg/dL', '70 - 100'),
            r('Creatinina', '0.97', 'mg/dL', '0.70 - 1.30'),
            r('Ácido úrico', '6.4', 'mg/dL', '3.5 - 7.2'),
            r('Colesterol total', '189', 'mg/dL', '< 200'),
            r('Colesterol HDL', '49', 'mg/dL', '> 40'),
            r('Colesterol LDL', '110', 'mg/dL', '< 130'),
            r('Triglicéridos', '128', 'mg/dL', '< 150'),
            r('Hemoglobina glucosilada', '5.6', '%', '4.0 - 5.6'),
          ],
        },
        {
          title: 'OTROS ESTUDIOS',
          rows: [
            r('TGO', '22', 'U/L', 'Hasta 40'),
            r('TGP', '28', 'U/L', 'Hasta 41'),
            r('TSH', '2.40', 'uUI/mL', '0.35 - 4.94'),
            r('Vitamina D', '37.0', 'ng/mL', '30 - 100'),
            r('PSA total', '0.85', 'ng/mL', '< 4.0'),
            r('Hemoglobina', '14.9', 'g/dL', '13.5 - 17.5'),
            r('Leucocitos', '6.2', 'x10^3/uL', '4.5 - 11.0'),
            r('Plaquetas', '244', 'x10^3/uL', '150 - 450'),
          ],
        },
      ],
    ],
  },
];

const PAGE_W = 612;
const PAGE_H = 792;

function push(items: DrawnText[], text: string, x: number, y: number, size: number, bold = false, align: 'left' | 'right' = 'left'): void {
  const width = textWidth(text, size, bold);
  items.push({ text, x: align === 'right' ? x - width : x, y, width, size, bold });
}

interface Columns {
  name: number;
  result: number;
  resultAlign: 'left' | 'right';
  prev?: number;
  unit: number;
  range: number;
  flag?: number;
}

const COLS: Record<Exclude<Layout, 'dos-columnas'>, Columns> = {
  clasico: { name: 40, result: 250, resultAlign: 'left', flag: 300, unit: 330, range: 420 },
  escaneado: { name: 40, result: 250, resultAlign: 'left', unit: 320, range: 420 },
  coma: { name: 40, result: 300, resultAlign: 'right', range: 330, unit: 480 },
  historico: { name: 40, result: 235, resultAlign: 'left', prev: 292, unit: 392, range: 455 },
};

const HEADERS: Record<Exclude<Layout, 'dos-columnas'>, [keyof Columns, string][]> = {
  clasico: [
    ['name', 'Estudio'],
    ['result', 'Resultado'],
    ['unit', 'Unidades'],
    ['range', 'Valores de referencia'],
  ],
  escaneado: [
    ['name', 'Estudio'],
    ['result', 'Resultado'],
    ['unit', 'Unidades'],
    ['range', 'Valores de referencia'],
  ],
  coma: [
    ['name', 'Determinación'],
    ['result', 'Resultado'],
    ['range', 'Intervalo de referencia'],
    ['unit', 'Unidades'],
  ],
  historico: [
    ['name', 'Prueba'],
    ['result', 'Resultado'],
    ['prev', 'Resultado anterior'],
    ['unit', 'Unidades'],
    ['range', 'Valores de referencia'],
  ],
};

function drawHeaderBlock(items: DrawnText[], rep: SynthReport, pageIndex: number, pageCount: number): number {
  push(items, rep.lab, 40, 52, 15, true);
  push(items, rep.labLine, 40, 67, 8);
  push(items, `Paciente: ${PATIENT}`, 40, 96, 9);
  push(items, rep.folio, 330, 96, 9);
  push(items, `Edad: ${ageAt(rep.date)} años`, 40, 109, 9);
  push(items, `Sexo: ${SEX_TEXT}`, 160, 109, 9);
  push(items, `Fecha de nacimiento: ${BIRTH}`, 330, 109, 9);
  push(items, 'Médico: A quien corresponda', 40, 122, 9);
  push(items, rep.dateText, 330, 122, 9);
  push(items, rep.printedText, 330, 135, 9);
  if (pageCount > 1) push(items, `Página ${pageIndex + 1} de ${pageCount}`, 572, 760, 8, false, 'right');
  return 165;
}

function drawFooter(items: DrawnText[]): void {
  push(items, 'Q.F.B. Responsable Ficticio · Cédula profesional 0000000', 40, 745, 7.5);
  push(items, 'Documento sintético generado para pruebas. No corresponde a ninguna persona real.', 40, 757, 7.5);
}

function drawTable(items: DrawnText[], layout: Exclude<Layout, 'dos-columnas'>, section: SynthSection, startY: number): number {
  const cols = COLS[layout];
  let y = startY;
  push(items, section.title, 40, y, 10, true);
  y += 15;
  for (const [key, label] of HEADERS[layout]) {
    const x = cols[key] as number;
    push(items, label, x, y, 8.5, true, key === 'result' ? cols.resultAlign : 'left');
  }
  y += 14;
  for (const row of section.rows) {
    push(items, row.name, cols.name, y, 9);
    push(items, row.value, cols.result, y, 9, false, cols.resultAlign);
    if (row.flag && cols.flag) push(items, row.flag, cols.flag, y, 9, true);
    if (row.prev && cols.prev) push(items, row.prev, cols.prev, y, 8);
    push(items, row.unit, cols.unit, y, 9);
    const lines = Array.isArray(row.range) ? row.range : [row.range];
    lines.forEach((line, i) => {
      push(items, line, cols.range, y + i * 12, 9);
    });
    y += 14 + (lines.length - 1) * 12;
  }
  for (const note of section.notes ?? []) {
    push(items, note, 40, y, 7.5);
    y += 12;
  }
  return y + 10;
}

function drawTwoColumns(items: DrawnText[], section: SynthSection, startY: number): number {
  let y = startY;
  push(items, section.title, 40, y, 10, true);
  y += 15;
  const halves = [
    { rows: section.rows, cols: { name: 40, result: 150, unit: 160, range: 214, flag: 282 } },
    { rows: section.right ?? [], cols: { name: 320, result: 432, unit: 442, range: 498, flag: 566 } },
  ];
  for (const half of halves) {
    push(items, 'Parámetro', half.cols.name, y, 8.5, true);
    push(items, 'Resultado', half.cols.result, y, 8.5, true, 'right');
    push(items, 'Unidad', half.cols.unit, y, 8.5, true);
    push(items, 'Referencia', half.cols.range, y, 8.5, true);
  }
  y += 14;
  const n = Math.max(halves[0]!.rows.length, halves[1]!.rows.length);
  for (let i = 0; i < n; i++) {
    for (const half of halves) {
      const row = half.rows[i];
      if (!row) continue;
      push(items, row.name, half.cols.name, y, 8.5);
      push(items, row.value, half.cols.result, y, 8.5, false, 'right');
      push(items, row.unit, half.cols.unit, y, 8.5);
      push(items, Array.isArray(row.range) ? row.range[0]! : row.range, half.cols.range, y, 8.5);
      if (row.flag) push(items, row.flag, half.cols.flag, y, 8.5, true);
    }
    y += 13;
  }
  return y + 10;
}

function drawSingleWide(items: DrawnText[], section: SynthSection, startY: number): number {
  // Química de la maqueta "dos-columnas": valores alineados a la derecha y marca al final.
  let y = startY;
  push(items, section.title, 40, y, 10, true);
  y += 15;
  push(items, 'Parámetro', 40, y, 8.5, true);
  push(items, 'Resultado', 230, y, 8.5, true);
  push(items, 'Unidad', 300, y, 8.5, true);
  push(items, 'Referencia', 400, y, 8.5, true);
  push(items, 'Marca', 520, y, 8.5, true);
  y += 14;
  for (const row of section.rows) {
    push(items, row.name, 40, y, 8.5);
    push(items, row.value, 280, y, 8.5, false, 'right');
    push(items, row.unit, 300, y, 8.5);
    push(items, Array.isArray(row.range) ? row.range[0]! : row.range, 400, y, 8.5);
    if (row.flag) push(items, row.flag, 524, y, 8.5, true);
    y += 13;
  }
  return y + 10;
}

/** Dibuja un reporte sintético como páginas con texto posicionado (coordenadas PDF, y hacia abajo). */
export function drawReport(rep: SynthReport): DrawnPage[] {
  return rep.pages.map((sections, pageIndex) => {
    const items: DrawnText[] = [];
    let y = drawHeaderBlock(items, rep, pageIndex, rep.pages.length);
    for (const section of sections) {
      if (rep.layout === 'dos-columnas') y = section.right ? drawTwoColumns(items, section, y) : drawSingleWide(items, section, y);
      else y = drawTable(items, rep.layout, section, y);
    }
    drawFooter(items);
    return { width: PAGE_W, height: PAGE_H, items };
  });
}

/** Páginas como las devolvería pdf.js, para el demo sin PDF. */
export function reportPages(rep: SynthReport): PageText[] {
  return drawReport(rep).map((page, i) => ({ page: i + 1, width: page.width, height: page.height, lines: groupLines(page.items) }));
}

/** Valores esperados por analito, para las pruebas. */
export function expectedValues(rep: SynthReport): { name: string; value: string; unit: string }[] {
  return rep.pages.flat().flatMap((s) => [...s.rows, ...(s.right ?? [])]).map((row) => ({ name: row.name, value: row.value, unit: row.unit }));
}
