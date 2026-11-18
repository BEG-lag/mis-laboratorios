/**
 * Unidades: reconoce cómo las imprimen los laboratorios y convierte SÓLO con factores exactos.
 *
 * - Cambios de prefijo dentro de una misma magnitud (mg/dL y g/L, µmol/L y mmol/L, U/L y µkat/L,
 *   µUI/mL y mUI/L, conteos por µL y por L) son exactos por definición.
 * - Masa y cantidad de sustancia (mg/dL y mmol/L) sólo se convierten si el analito tiene masa
 *   molar documentada en el diccionario (src/lib/analytes.ts).
 * - Todo lo demás (por ejemplo HbA1c en % y en mmol/mol, que se relacionan con una ecuación de
 *   regresión y no con un factor) NO se convierte: se grafica como una serie aparte.
 */
import { fold } from './text.ts';

type Family = 'mass' | 'molar' | 'catalytic' | 'intl' | 'count';

interface UnitDef {
  unit: string;
  family?: Family;
  /** Valor de 1 de esta unidad expresado en la unidad base de su familia. */
  base?: number;
  aliases: string[];
}

/**
 * Unidades base por familia: mass mg/dL, molar mmol/L, catalytic U/L, intl mUI/L,
 * count x10³/µL.
 */
const UNITS: UnitDef[] = [
  { unit: 'mg/dL', family: 'mass', base: 1, aliases: ['mg/dl', 'mg/100ml', 'mg%', 'mgs/dl', 'mgr/dl'] },
  { unit: 'g/dL', family: 'mass', base: 1000, aliases: ['g/dl', 'gr/dl', 'grs/dl', 'gm/dl', 'g/100ml', 'g%'] },
  { unit: 'g/L', family: 'mass', base: 100, aliases: ['g/l', 'gr/l', 'grs/l'] },
  { unit: 'mg/L', family: 'mass', base: 0.1, aliases: ['mg/l', 'mgs/l'] },
  { unit: 'µg/dL', family: 'mass', base: 1e-3, aliases: ['ug/dl', 'mcg/dl', 'microg/dl', 'microgramos/dl'] },
  { unit: 'µg/L', family: 'mass', base: 1e-4, aliases: ['ug/l', 'mcg/l'] },
  { unit: 'ng/mL', family: 'mass', base: 1e-4, aliases: ['ng/ml', 'nanog/ml'] },
  { unit: 'ng/dL', family: 'mass', base: 1e-6, aliases: ['ng/dl'] },
  { unit: 'pg/mL', family: 'mass', base: 1e-7, aliases: ['pg/ml'] },
  { unit: 'mmol/L', family: 'molar', base: 1, aliases: ['mmol/l', 'mmol/lt', 'mm/l'] },
  { unit: 'µmol/L', family: 'molar', base: 1e-3, aliases: ['umol/l', 'mcmol/l', 'micromol/l'] },
  { unit: 'nmol/L', family: 'molar', base: 1e-6, aliases: ['nmol/l'] },
  { unit: 'pmol/L', family: 'molar', base: 1e-9, aliases: ['pmol/l'] },
  { unit: 'mmol/mol', aliases: ['mmol/mol'] },
  { unit: 'mEq/L', aliases: ['meq/l', 'meq/lt', 'meq/litro'] },
  { unit: 'U/L', family: 'catalytic', base: 1, aliases: ['u/l', 'u/lt', 'unidades/l'] },
  { unit: 'µkat/L', family: 'catalytic', base: 60, aliases: ['ukat/l'] },
  { unit: 'UI/L', family: 'intl', base: 1000, aliases: ['ui/l', 'iu/l', 'ui/lt'] },
  { unit: 'mUI/L', family: 'intl', base: 1, aliases: ['mui/l', 'miu/l', 'mu/l'] },
  { unit: 'µUI/mL', family: 'intl', base: 1, aliases: ['uui/ml', 'uiu/ml', 'uu/ml', 'mcui/ml', 'microui/ml', 'uli/ml'] },
  { unit: 'mUI/mL', family: 'intl', base: 1000, aliases: ['mui/ml', 'miu/ml', 'mu/ml'] },
  { unit: 'UI/mL', family: 'intl', base: 1e6, aliases: ['ui/ml', 'iu/ml', 'u/ml'] },
  { unit: '%', aliases: ['%', 'porciento', 'porcentaje'] },
  { unit: 'L/L', aliases: ['l/l'] },
  { unit: 'fL', aliases: ['fl', 'um3', 'micras3', 'femtolitros'] },
  { unit: 'pg', aliases: ['pg', 'pg/cel', 'pg/celula', 'picogramos', 'uug'] },
  {
    unit: 'x10³/µL',
    family: 'count',
    base: 1,
    aliases: ['x103/ul', '103/ul', 'x103/mm3', '103/mm3', 'miles/ul', 'miles/mm3', 'k/ul', 'x1000/ul', 'mil/ul', 'mil/mm3', 'x103/mcl', 'x103/uL'],
  },
  { unit: 'x10⁹/L', family: 'count', base: 1, aliases: ['x109/l', '109/l'] },
  {
    unit: 'x10⁶/µL',
    family: 'count',
    base: 1000,
    aliases: ['x106/ul', '106/ul', 'x106/mm3', '106/mm3', 'millones/ul', 'millones/mm3', 'mill/ul', 'mill/mm3', 'm/ul', 'x106/mcl'],
  },
  { unit: 'x10¹²/L', family: 'count', base: 1000, aliases: ['x1012/l', '1012/l', 't/l'] },
  { unit: '/µL', family: 'count', base: 1e-3, aliases: ['/ul', 'cel/ul', 'celulas/ul', '/mm3', 'cel/mm3', 'celulas/mm3', 'xmm3', 'pormm3', '/mcl'] },
  { unit: 'mL/min/1.73m²', aliases: ['ml/min/1.73m2', 'ml/min/1,73m2', 'ml/min/173m2', 'ml/min/1.73', 'ml/min/1,73'] },
  { unit: 'mL/min', aliases: ['ml/min'] },
  { unit: 'mm/h', aliases: ['mm/h', 'mm/hr', 'mm/hora', 'mm/1h', 'mm/1ahora', 'mm/1hr', 'mm/hrs'] },
  { unit: 's', aliases: ['seg', 'segs', 'segundos', 'sec'] },
];

const SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

/** Clave para comparar unidades: sin espacios, sin acentos, µ como u y exponentes como dígitos. */
export function unitKey(raw: string): string {
  return fold(raw)
    .replace(/[µμ]/g, 'u')
    .replace(/[⁰¹²³⁴-⁹]/g, (c) => SUPERSCRIPTS[c] ?? c)
    .replace(/\s+/g, '')
    .replace(/u\.i\./g, 'ui')
    .replace(/[×*]/g, 'x')
    .replace(/\^/g, '')
    .replace(/x?10e(\d+)/g, 'x10$1')
    .replace(/xx/g, 'x')
    .replace(/^x?(10\d+)/, 'x$1')
    .replace(/\.(?=\/)/g, '')
    .replace(/\.$/, '')
    .replace(/litro$/, 'l');
}

const BY_KEY = new Map<string, UnitDef>();
for (const def of UNITS) {
  BY_KEY.set(unitKey(def.unit), def);
  for (const alias of def.aliases) BY_KEY.set(unitKey(alias), def);
}

/** Unidad conocida en su forma canónica, o null. */
export function canonicalUnit(raw: string): string | null {
  const key = unitKey(raw);
  if (!key) return null;
  return BY_KEY.get(key)?.unit ?? null;
}

/**
 * ¿Parece una unidad aunque no la conozcamos? ("mg/24h", "UFC/mL"). Se exige una barra o un
 * símbolo de porcentaje para no confundir palabras con unidades.
 */
export function looksLikeUnit(raw: string): boolean {
  const s = raw.trim();
  if (!s || s.length > 24) return false;
  if (canonicalUnit(s)) return true;
  return /^[A-Za-zµμ%#³²0-9.^*x×]{0,10}\/[A-Za-zµμ0-9.,^*³² ]{1,14}$/.test(s) && /[A-Za-zµμ]/.test(s);
}

/** Normaliza una unidad: canónica si se conoce; si no, el texto limpio tal como venía. */
export function normalizeUnit(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return canonicalUnit(trimmed) ?? trimmed;
}

export interface ConversionSpec {
  /** Unidad canónica del analito. */
  unit: string;
  /** Masa molar en g/mol, para convertir entre masa (mg/dL) y cantidad de sustancia (mmol/L). */
  molarMass?: number;
  /** Valencia del ion, para mEq/L. */
  valence?: number;
  /** Equivalencias exactas propias del analito: unidad -> factor hacia la unidad canónica. */
  equivalents?: Record<string, number>;
}

function defOf(unit: string): UnitDef | undefined {
  return BY_KEY.get(unitKey(unit));
}

/** Factor que lleva 1 `unit` a la unidad canónica del analito, o null si no hay factor exacto. */
export function factorToCanonical(unit: string, spec: ConversionSpec): number | null {
  const from = canonicalUnit(unit) ?? unit;
  const to = spec.unit;
  if (from === to) return 1;
  const eq = spec.equivalents?.[from];
  if (eq !== undefined) return eq;
  const a = defOf(from);
  const b = defOf(to);
  if (!a || !b) return null;
  if (a.family && a.family === b.family) return a.base! / b.base!;
  // Masa <-> cantidad de sustancia: 1 mmol/L = M mg/L = M/10 mg/dL.
  if (spec.molarMass) {
    const mgdlPerMmolL = spec.molarMass / 10;
    if (a.family === 'molar' && b.family === 'mass') return (a.base! * mgdlPerMmolL) / b.base!;
    if (a.family === 'mass' && b.family === 'molar') return a.base! / mgdlPerMmolL / b.base!;
  }
  // mEq/L <-> mmol/L según la valencia del ion.
  if (spec.valence) {
    if (a.unit === 'mEq/L' && b.family === 'molar') return 1 / spec.valence / b.base!;
    if (a.family === 'molar' && b.unit === 'mEq/L') return a.base! * spec.valence;
  }
  return null;
}

/** Factor exacto entre dos unidades para un analito (valor_en_to = valor_en_from * factor). */
export function conversionFactor(from: string, to: string, spec: ConversionSpec): number | null {
  const f1 = factorToCanonical(from, spec);
  const f2 = factorToCanonical(to, spec);
  if (f1 === null || f2 === null) return null;
  return f1 / f2;
}
