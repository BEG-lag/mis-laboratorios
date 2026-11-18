/**
 * Diccionario de analitos: nombre en español e inglés, unidad canónica, masa molar (sólo cuando
 * la conversión mg/dL <-> mmol/L es exacta dada esa masa molar) y sinónimos como los imprimen los
 * laboratorios en México.
 *
 * Masas molares en g/mol tomadas de PubChem (https://pubchem.ncbi.nlm.nih.gov). Para
 * triglicéridos se usa la trioleína, que es la convención de los laboratorios clínicos.
 */
import { normalizeName } from './text.ts';
import type { ConversionSpec } from './units.ts';
import { canonicalUnit, unitKey } from './units.ts';

export type Category =
  | 'glucose'
  | 'lipids'
  | 'kidney'
  | 'liver'
  | 'blood'
  | 'differential'
  | 'thyroid'
  | 'vitamins'
  | 'iron'
  | 'electrolytes'
  | 'inflammation'
  | 'prostate'
  | 'hormones'
  | 'other';

export const CATEGORY_ORDER: Category[] = [
  'glucose',
  'lipids',
  'kidney',
  'liver',
  'blood',
  'differential',
  'thyroid',
  'vitamins',
  'iron',
  'electrolytes',
  'inflammation',
  'prostate',
  'hormones',
  'other',
];

export interface Analyte extends ConversionSpec {
  id: string;
  es: string;
  en: string;
  category: Category;
  synonyms: string[];
  /** Fórmula leucocitaria: el mismo nombre se usa para % y para conteo absoluto. */
  kind?: 'pct' | 'abs';
}

const ENZYME = { 'UI/L': 1 };

export const ANALYTES: Analyte[] = [
  // Glucosa y metabolismo
  {
    id: 'glucosa',
    es: 'Glucosa',
    en: 'Glucose',
    category: 'glucose',
    unit: 'mg/dL',
    molarMass: 180.16,
    synonyms: ['glucosa', 'glucosa en ayunas', 'glucosa en ayuno', 'glucosa sérica', 'glucosa en suero', 'glucosa plasmática', 'glucosa basal', 'glucemia', 'glicemia', 'glucemia en ayunas', 'glucose', 'glu'],
  },
  {
    id: 'hba1c',
    es: 'Hemoglobina glucosilada (HbA1c)',
    en: 'Hemoglobin A1c',
    category: 'glucose',
    unit: '%',
    synonyms: ['hba1c', 'hb a1c', 'hemoglobina glucosilada', 'hemoglobina glicosilada', 'hemoglobina glucosilada a1c', 'hemoglobina glicosilada a1c', 'hemoglobina glicada', 'hemoglobina a1c', 'a1c', 'glucohemoglobina', 'hemoglobina glucosilada hba1c', 'hemoglobina glicosilada hba1c'],
  },
  {
    id: 'insulina',
    es: 'Insulina',
    en: 'Insulin',
    category: 'glucose',
    unit: 'µUI/mL',
    synonyms: ['insulina', 'insulina basal', 'insulina en ayunas', 'insulina sérica'],
  },
  // Lípidos
  {
    id: 'colesterol-total',
    es: 'Colesterol total',
    en: 'Total cholesterol',
    category: 'lipids',
    unit: 'mg/dL',
    molarMass: 386.65,
    synonyms: ['colesterol', 'colesterol total', 'colesterol sérico', 'colesterol total sérico', 'cholesterol'],
  },
  {
    id: 'hdl',
    es: 'Colesterol HDL',
    en: 'HDL cholesterol',
    category: 'lipids',
    unit: 'mg/dL',
    molarMass: 386.65,
    synonyms: ['colesterol hdl', 'hdl', 'c hdl', 'hdl colesterol', 'hdl c', 'colesterol de alta densidad', 'colesterol de lipoproteínas de alta densidad', 'lipoproteínas de alta densidad', 'colesterol hdl directo', 'hdl directo'],
  },
  {
    id: 'ldl',
    es: 'Colesterol LDL',
    en: 'LDL cholesterol',
    category: 'lipids',
    unit: 'mg/dL',
    molarMass: 386.65,
    synonyms: ['colesterol ldl', 'ldl', 'c ldl', 'ldl colesterol', 'ldl c', 'colesterol ldl calculado', 'ldl calculado', 'colesterol ldl directo', 'ldl directo', 'colesterol de baja densidad', 'colesterol de lipoproteínas de baja densidad', 'lipoproteínas de baja densidad', 'colesterol ldl friedewald', 'ldl friedewald', 'colesterol ldl calc'],
  },
  {
    id: 'vldl',
    es: 'Colesterol VLDL',
    en: 'VLDL cholesterol',
    category: 'lipids',
    unit: 'mg/dL',
    molarMass: 386.65,
    synonyms: ['colesterol vldl', 'vldl', 'c vldl', 'vldl colesterol', 'colesterol de muy baja densidad', 'colesterol vldl calculado', 'vldl calculado'],
  },
  {
    id: 'no-hdl',
    es: 'Colesterol no HDL',
    en: 'Non-HDL cholesterol',
    category: 'lipids',
    unit: 'mg/dL',
    molarMass: 386.65,
    synonyms: ['colesterol no hdl', 'no hdl', 'colesterol no hdl calculado'],
  },
  {
    id: 'trigliceridos',
    es: 'Triglicéridos',
    en: 'Triglycerides',
    category: 'lipids',
    unit: 'mg/dL',
    molarMass: 885.43,
    synonyms: ['triglicéridos', 'trigliceridos séricos', 'triglicéridos totales', 'triglycerides', 'trig'],
  },
  {
    id: 'indice-aterogenico',
    es: 'Índice aterogénico',
    en: 'Atherogenic index',
    category: 'lipids',
    unit: '',
    synonyms: ['índice aterogénico', 'indice aterogenico colesterol total hdl', 'índice de castelli', 'relación colesterol total hdl', 'colesterol total hdl'],
  },
  // Función renal
  {
    id: 'urea',
    es: 'Urea',
    en: 'Urea',
    category: 'kidney',
    unit: 'mg/dL',
    molarMass: 60.06,
    synonyms: ['urea', 'urea sérica', 'urea en suero'],
  },
  {
    id: 'bun',
    es: 'Nitrógeno ureico (BUN)',
    en: 'Blood urea nitrogen (BUN)',
    category: 'kidney',
    unit: 'mg/dL',
    // 1 mmol de urea contiene 2 mol de nitrógeno: 2 x 14.007 g/mol.
    molarMass: 28.014,
    synonyms: ['bun', 'nitrógeno ureico', 'nitrógeno de urea', 'nitrógeno ureico en sangre', 'nitrógeno ureico sérico', 'n ureico', 'nitrogeno ureico bun', 'bun nitrogeno ureico'],
  },
  {
    id: 'creatinina',
    es: 'Creatinina',
    en: 'Creatinine',
    category: 'kidney',
    unit: 'mg/dL',
    molarMass: 113.12,
    synonyms: ['creatinina', 'creatinina sérica', 'creatinina en suero', 'creatinine'],
  },
  {
    id: 'tfg',
    es: 'Tasa de filtración glomerular estimada',
    en: 'Estimated GFR',
    category: 'kidney',
    unit: 'mL/min/1.73m²',
    synonyms: ['tfg', 'tfge', 'tfg estimada', 'egfr', 'tasa de filtración glomerular', 'tasa de filtración glomerular estimada', 'filtración glomerular estimada', 'filtrado glomerular estimado', 'tfg ckd epi', 'ckd epi'],
  },
  {
    id: 'acido-urico',
    es: 'Ácido úrico',
    en: 'Uric acid',
    category: 'kidney',
    unit: 'mg/dL',
    molarMass: 168.11,
    synonyms: ['ácido úrico', 'acido urico sérico', 'ácido úrico en suero', 'uric acid', 'urato'],
  },
  // Función hepática
  {
    id: 'ast',
    es: 'TGO / AST',
    en: 'AST (SGOT)',
    category: 'liver',
    unit: 'U/L',
    equivalents: ENZYME,
    synonyms: ['tgo', 'ast', 'tgo ast', 'ast tgo', 'asat', 'aspartato aminotransferasa', 'aspartato amino transferasa', 'transaminasa glutámico oxalacética', 'transaminasa glutamico oxalacetica tgo', 'aspartato aminotransferasa ast', 'aspartato aminotransferasa tgo', 'sgot'],
  },
  {
    id: 'alt',
    es: 'TGP / ALT',
    en: 'ALT (SGPT)',
    category: 'liver',
    unit: 'U/L',
    equivalents: ENZYME,
    synonyms: ['tgp', 'alt', 'tgp alt', 'alt tgp', 'alat', 'alanina aminotransferasa', 'alanino aminotransferasa', 'alanina amino transferasa', 'transaminasa glutámico pirúvica', 'transaminasa glutamico piruvica tgp', 'alanina aminotransferasa alt', 'alanina aminotransferasa tgp', 'sgpt'],
  },
  {
    id: 'ggt',
    es: 'Gamma glutamil transferasa (GGT)',
    en: 'Gamma-glutamyl transferase (GGT)',
    category: 'liver',
    unit: 'U/L',
    equivalents: ENZYME,
    synonyms: ['ggt', 'ggtp', 'gamma gt', 'gama gt', 'gamma glutamil transferasa', 'gamma glutamiltransferasa', 'gamma glutamil transpeptidasa', 'gamma glutamiltranspeptidasa', 'gama glutamil transferasa', 'gamma glutamil transferasa ggt'],
  },
  {
    id: 'fosfatasa-alcalina',
    es: 'Fosfatasa alcalina',
    en: 'Alkaline phosphatase',
    category: 'liver',
    unit: 'U/L',
    equivalents: ENZYME,
    synonyms: ['fosfatasa alcalina', 'fal', 'alp', 'fosfatasa alcalina total'],
  },
  {
    id: 'bilirrubina-total',
    es: 'Bilirrubina total',
    en: 'Total bilirubin',
    category: 'liver',
    unit: 'mg/dL',
    molarMass: 584.66,
    synonyms: ['bilirrubina total', 'bilirrubina total sérica'],
  },
  {
    id: 'bilirrubina-directa',
    es: 'Bilirrubina directa',
    en: 'Direct bilirubin',
    category: 'liver',
    unit: 'mg/dL',
    molarMass: 584.66,
    synonyms: ['bilirrubina directa', 'bilirrubina conjugada'],
  },
  {
    id: 'bilirrubina-indirecta',
    es: 'Bilirrubina indirecta',
    en: 'Indirect bilirubin',
    category: 'liver',
    unit: 'mg/dL',
    molarMass: 584.66,
    synonyms: ['bilirrubina indirecta', 'bilirrubina no conjugada'],
  },
  {
    id: 'proteinas-totales',
    es: 'Proteínas totales',
    en: 'Total protein',
    category: 'liver',
    unit: 'g/dL',
    synonyms: ['proteínas totales', 'proteinas totales séricas', 'proteína total'],
  },
  {
    id: 'albumina',
    es: 'Albúmina',
    en: 'Albumin',
    category: 'liver',
    unit: 'g/dL',
    synonyms: ['albúmina', 'albumina sérica', 'alb'],
  },
  {
    id: 'ldh',
    es: 'Deshidrogenasa láctica (DHL)',
    en: 'Lactate dehydrogenase (LDH)',
    category: 'liver',
    unit: 'U/L',
    equivalents: ENZYME,
    synonyms: ['dhl', 'ldh', 'deshidrogenasa láctica', 'lactato deshidrogenasa', 'deshidrogenasa lactica dhl'],
  },
  {
    id: 'amilasa',
    es: 'Amilasa',
    en: 'Amylase',
    category: 'liver',
    unit: 'U/L',
    equivalents: ENZYME,
    synonyms: ['amilasa', 'amilasa sérica', 'alfa amilasa'],
  },
  {
    id: 'lipasa',
    es: 'Lipasa',
    en: 'Lipase',
    category: 'liver',
    unit: 'U/L',
    equivalents: ENZYME,
    synonyms: ['lipasa', 'lipasa sérica'],
  },
  // Biometría hemática
  {
    id: 'hemoglobina',
    es: 'Hemoglobina',
    en: 'Hemoglobin',
    category: 'blood',
    unit: 'g/dL',
    synonyms: ['hemoglobina', 'hb', 'hgb', 'hemoglobina hb', 'hemoglobin'],
  },
  {
    id: 'hematocrito',
    es: 'Hematocrito',
    en: 'Hematocrit',
    category: 'blood',
    unit: '%',
    equivalents: { 'L/L': 100 },
    synonyms: ['hematocrito', 'hto', 'hct', 'hematocrito hto', 'hematocrit'],
  },
  {
    id: 'eritrocitos',
    es: 'Eritrocitos',
    en: 'Red blood cells',
    category: 'blood',
    unit: 'x10⁶/µL',
    synonyms: ['eritrocitos', 'glóbulos rojos', 'hematíes', 'rbc', 'recuento de eritrocitos', 'cuenta de eritrocitos', 'eritrocitos totales'],
  },
  {
    id: 'leucocitos',
    es: 'Leucocitos',
    en: 'White blood cells',
    category: 'blood',
    unit: 'x10³/µL',
    synonyms: ['leucocitos', 'glóbulos blancos', 'wbc', 'leucocitos totales', 'recuento de leucocitos', 'cuenta de leucocitos', 'cuenta leucocitaria'],
  },
  {
    id: 'plaquetas',
    es: 'Plaquetas',
    en: 'Platelets',
    category: 'blood',
    unit: 'x10³/µL',
    synonyms: ['plaquetas', 'recuento de plaquetas', 'cuenta de plaquetas', 'cuenta plaquetaria', 'plt', 'trombocitos'],
  },
  {
    id: 'vcm',
    es: 'Volumen corpuscular medio (VCM)',
    en: 'Mean corpuscular volume (MCV)',
    category: 'blood',
    unit: 'fL',
    synonyms: ['vcm', 'volumen corpuscular medio', 'volumen globular medio', 'vgm', 'mcv', 'volumen corpuscular medio vcm'],
  },
  {
    id: 'hcm',
    es: 'Hemoglobina corpuscular media (HCM)',
    en: 'Mean corpuscular hemoglobin (MCH)',
    category: 'blood',
    unit: 'pg',
    synonyms: ['hcm', 'hemoglobina corpuscular media', 'hemoglobina globular media', 'hgm', 'mch', 'hemoglobina corpuscular media hcm'],
  },
  {
    id: 'cmhc',
    es: 'Concentración media de hemoglobina corpuscular (CMHC)',
    en: 'Mean corpuscular hemoglobin concentration (MCHC)',
    category: 'blood',
    unit: 'g/dL',
    synonyms: ['cmhc', 'chcm', 'cmhg', 'mchc', 'concentración media de hemoglobina corpuscular', 'concentración de hemoglobina corpuscular media', 'concentración media de hemoglobina', 'concentracion media de hemoglobina corpuscular cmhc'],
  },
  {
    id: 'rdw',
    es: 'Amplitud de distribución eritrocitaria (ADE)',
    en: 'Red cell distribution width (RDW)',
    category: 'blood',
    unit: '%',
    synonyms: ['rdw', 'ade', 'rdw cv', 'ade cv', 'amplitud de distribución eritrocitaria', 'ancho de distribución eritrocitaria', 'amplitud de distribucion eritrocitaria rdw'],
  },
  {
    id: 'vpm',
    es: 'Volumen plaquetario medio (VPM)',
    en: 'Mean platelet volume (MPV)',
    category: 'blood',
    unit: 'fL',
    synonyms: ['vpm', 'volumen plaquetario medio', 'mpv'],
  },
  {
    id: 'vsg',
    es: 'Velocidad de sedimentación globular',
    en: 'Erythrocyte sedimentation rate',
    category: 'inflammation',
    unit: 'mm/h',
    synonyms: ['vsg', 'velocidad de sedimentación globular', 'velocidad de sedimentación', 'sedimentación globular', 'esr'],
  },
  // Fórmula leucocitaria (porcentaje y conteo absoluto comparten nombre; decide la unidad)
  ...(['neutrofilos', 'linfocitos', 'monocitos', 'eosinofilos', 'basofilos'] as const).flatMap((base): Analyte[] => {
    const names: Record<string, [string, string, string[]]> = {
      neutrofilos: ['Neutrófilos', 'Neutrophils', ['neutrófilos', 'neutrófilos totales', 'neutrófilos segmentados', 'segmentados', 'neut']],
      linfocitos: ['Linfocitos', 'Lymphocytes', ['linfocitos', 'linf', 'lym']],
      monocitos: ['Monocitos', 'Monocytes', ['monocitos', 'mono']],
      eosinofilos: ['Eosinófilos', 'Eosinophils', ['eosinófilos', 'eos']],
      basofilos: ['Basófilos', 'Basophils', ['basófilos', 'baso']],
    };
    const [es, en, syn] = names[base]!;
    return [
      {
        id: `${base}-pct`,
        es: `${es} (%)`,
        en: `${en} (%)`,
        category: 'differential',
        unit: '%',
        kind: 'pct',
        synonyms: [...syn, ...syn.map((s) => `${s} %`), ...syn.map((s) => `% ${s}`), ...syn.map((s) => `${s} relativos`)],
      },
      {
        id: `${base}-abs`,
        es: `${es} (absolutos)`,
        en: `${en} (absolute)`,
        category: 'differential',
        unit: 'x10³/µL',
        kind: 'abs',
        synonyms: [...syn, ...syn.map((s) => `${s} #`), ...syn.map((s) => `# ${s}`), ...syn.map((s) => `${s} absolutos`), ...syn.map((s) => `${s} abs`), `cuenta absoluta de ${syn[0]}`],
      },
    ];
  }),
  // Tiroides
  {
    id: 'tsh',
    es: 'TSH',
    en: 'TSH',
    category: 'thyroid',
    unit: 'µUI/mL',
    synonyms: ['tsh', 'tsh ultrasensible', 'tsh 3a generación', 'tsh tercera generación', 'hormona estimulante de tiroides', 'hormona estimulante de la tiroides', 'hormona estimulante del tiroides', 'tirotropina', 'hormona tirotrópica', 'tsh hormona estimulante de tiroides'],
  },
  {
    id: 't4-libre',
    es: 'T4 libre',
    en: 'Free T4',
    category: 'thyroid',
    unit: 'ng/dL',
    molarMass: 776.87,
    synonyms: ['t4 libre', 't4l', 'ft4', 'tiroxina libre', 't4 libre tiroxina libre', 'tiroxina libre t4l'],
  },
  {
    id: 't4-total',
    es: 'T4 total',
    en: 'Total T4',
    category: 'thyroid',
    unit: 'µg/dL',
    molarMass: 776.87,
    synonyms: ['t4 total', 't4', 'tiroxina', 'tiroxina total', 'tt4'],
  },
  {
    id: 't3-libre',
    es: 'T3 libre',
    en: 'Free T3',
    category: 'thyroid',
    unit: 'pg/mL',
    molarMass: 650.97,
    synonyms: ['t3 libre', 't3l', 'ft3', 'triyodotironina libre'],
  },
  {
    id: 't3-total',
    es: 'T3 total',
    en: 'Total T3',
    category: 'thyroid',
    unit: 'ng/dL',
    molarMass: 650.97,
    synonyms: ['t3 total', 't3', 'triyodotironina', 'triyodotironina total', 'tt3'],
  },
  // Vitaminas
  {
    id: 'vitamina-d',
    es: 'Vitamina D (25-OH)',
    en: '25-OH vitamin D',
    category: 'vitamins',
    unit: 'ng/mL',
    molarMass: 400.64,
    synonyms: ['vitamina d', 'vitamina d 25 oh', 'vitamina d 25 hidroxi', 'vitamina d total', 'vitamina d3', 'vitamina d 25 oh total', '25 oh vitamina d', '25 oh vitamina d total', '25 hidroxivitamina d', '25 hidroxi vitamina d', '25 oh d', 'calcidiol', 'vitamina d 25 hidroxi total', 'vitamina d 25 oh d'],
  },
  {
    id: 'vitamina-b12',
    es: 'Vitamina B12',
    en: 'Vitamin B12',
    category: 'vitamins',
    unit: 'pg/mL',
    molarMass: 1355.37,
    synonyms: ['vitamina b12', 'vitamina b 12', 'b12', 'cianocobalamina', 'cobalamina', 'vitamina b12 cianocobalamina'],
  },
  {
    id: 'acido-folico',
    es: 'Ácido fólico',
    en: 'Folate',
    category: 'vitamins',
    unit: 'ng/mL',
    molarMass: 441.4,
    synonyms: ['ácido fólico', 'folato', 'folatos', 'acido folico sérico', 'folato sérico'],
  },
  // Hierro
  {
    id: 'ferritina',
    es: 'Ferritina',
    en: 'Ferritin',
    category: 'iron',
    unit: 'ng/mL',
    synonyms: ['ferritina', 'ferritina sérica', 'ferritin'],
  },
  {
    id: 'hierro',
    es: 'Hierro sérico',
    en: 'Serum iron',
    category: 'iron',
    unit: 'µg/dL',
    molarMass: 55.845,
    synonyms: ['hierro', 'hierro sérico', 'hierro total', 'hierro en suero'],
  },
  // Electrolitos y minerales
  {
    id: 'sodio',
    es: 'Sodio',
    en: 'Sodium',
    category: 'electrolytes',
    unit: 'mmol/L',
    molarMass: 22.99,
    valence: 1,
    synonyms: ['sodio', 'sodio sérico'],
  },
  {
    id: 'potasio',
    es: 'Potasio',
    en: 'Potassium',
    category: 'electrolytes',
    unit: 'mmol/L',
    molarMass: 39.098,
    valence: 1,
    synonyms: ['potasio', 'potasio sérico'],
  },
  {
    id: 'cloro',
    es: 'Cloro',
    en: 'Chloride',
    category: 'electrolytes',
    unit: 'mmol/L',
    molarMass: 35.45,
    valence: 1,
    synonyms: ['cloro', 'cloruro', 'cloro sérico'],
  },
  {
    id: 'calcio',
    es: 'Calcio',
    en: 'Calcium',
    category: 'electrolytes',
    unit: 'mg/dL',
    molarMass: 40.078,
    valence: 2,
    synonyms: ['calcio', 'calcio sérico', 'calcio total'],
  },
  {
    id: 'magnesio',
    es: 'Magnesio',
    en: 'Magnesium',
    category: 'electrolytes',
    unit: 'mg/dL',
    molarMass: 24.305,
    valence: 2,
    synonyms: ['magnesio', 'magnesio sérico'],
  },
  {
    id: 'fosforo',
    es: 'Fósforo',
    en: 'Phosphorus',
    category: 'electrolytes',
    unit: 'mg/dL',
    molarMass: 30.974,
    synonyms: ['fósforo', 'fosforo sérico', 'fósforo inorgánico', 'fosfato'],
  },
  // Inflamación
  {
    id: 'pcr',
    es: 'Proteína C reactiva',
    en: 'C-reactive protein',
    category: 'inflammation',
    unit: 'mg/L',
    synonyms: ['pcr', 'proteína c reactiva', 'proteina c reactiva ultrasensible', 'pcr ultrasensible', 'pcr us', 'pcr hs', 'hs crp', 'crp', 'proteína c reactiva de alta sensibilidad'],
  },
  // Próstata
  {
    id: 'psa',
    es: 'Antígeno prostático específico (PSA) total',
    en: 'Total PSA',
    category: 'prostate',
    unit: 'ng/mL',
    synonyms: ['psa', 'psa total', 'ape', 'ape total', 'antígeno prostático específico', 'antígeno prostático específico total', 'antígeno prostático', 'antigeno prostatico especifico psa', 'antigeno prostatico especifico total psa'],
  },
  {
    id: 'psa-libre',
    es: 'PSA libre',
    en: 'Free PSA',
    category: 'prostate',
    unit: 'ng/mL',
    synonyms: ['psa libre', 'ape libre', 'antígeno prostático específico libre', 'antigeno prostatico libre'],
  },
  // Hormonas
  {
    id: 'testosterona',
    es: 'Testosterona total',
    en: 'Total testosterone',
    category: 'hormones',
    unit: 'ng/dL',
    molarMass: 288.42,
    synonyms: ['testosterona', 'testosterona total', 'testosterona sérica'],
  },
];

export const ANALYTE_BY_ID = new Map(ANALYTES.map((a) => [a.id, a] as const));

/** Sinónimo normalizado -> ids candidatos. */
const SYNONYMS = new Map<string, string[]>();
for (const analyte of ANALYTES) {
  for (const syn of [analyte.es, analyte.en, ...analyte.synonyms]) {
    const key = normalizeName(syn);
    if (!key) continue;
    const list = SYNONYMS.get(key) ?? [];
    if (!list.includes(analyte.id)) list.push(analyte.id);
    SYNONYMS.set(key, list);
  }
}

/** Palabras que pueden acompañar al nombre sin cambiar el analito ("en suero", "sérica"). */
const NOISE = new Set(['en', 'de', 'del', 'la', 'el', 'suero', 'serico', 'serica', 'sangre', 'plasma', 'plasmatico', 'plasmatica', 'venosa', 'total', 'resultado', 'ayuno', 'ayunas']);

const COUNT_UNITS = new Set(['x10³/µL', 'x10⁹/L', '/µL', 'x10⁶/µL', 'x10¹²/L']);

function pick(ids: string[], name: string, unit: string): string {
  if (ids.length === 1) return ids[0]!;
  const unitCanon = canonicalUnit(unit) ?? unit;
  const byKind = (kind: 'pct' | 'abs') => ids.find((id) => ANALYTE_BY_ID.get(id)?.kind === kind);
  if (unitCanon === '%') return byKind('pct') ?? ids[0]!;
  if (COUNT_UNITS.has(unitCanon)) return byKind('abs') ?? ids[0]!;
  if (/#|\babs/.test(name)) return byKind('abs') ?? ids[0]!;
  return byKind('pct') ?? ids[0]!;
}

function lookup(key: string, name: string, unit: string): string | null {
  const ids = SYNONYMS.get(key);
  return ids ? pick(ids, name, unit) : null;
}

/**
 * Reconoce el analito a partir del nombre impreso. Devuelve null si no lo reconoce (la fila se
 * conserva con el nombre tal como venía). Las secciones de orina no se mapean a analitos de sangre.
 */
export function resolveAnalyte(printed: string, unit = '', section = ''): string | null {
  const sectionKey = normalizeName(section);
  if (/\b(orina|urinalisis|ego|uroanalisis|liquido|heces|coprologico)\b/.test(sectionKey)) return null;
  const name = normalizeName(printed.replace(/[:.]+\s*$/, ''));
  if (!name) return null;
  const tries: string[] = [name];
  // Sin el contenido entre paréntesis y sólo el contenido entre paréntesis.
  const paren = /\(([^)]*)\)/.exec(printed);
  if (paren) {
    tries.push(normalizeName(printed.replace(/\([^)]*\)/g, ' ')));
    tries.push(normalizeName(paren[1]!));
  }
  // "TGO/AST", "TGP - ALT": cada parte.
  for (const part of printed.split(/\s*[/|]\s*|\s+-\s+/)) tries.push(normalizeName(part));
  for (const key of tries) {
    if (!key) continue;
    const hit = lookup(key, name, unit);
    if (hit) return hit;
    const words = key.split(' ').filter((w) => !NOISE.has(w));
    const stripped = words.join(' ');
    if (stripped && stripped !== key) {
      const hit2 = lookup(stripped, name, unit);
      if (hit2) return hit2;
    }
  }
  return null;
}

/** Variante de método para LDL ("calculado" o "directo"), si el nombre lo dice. */
export function methodOf(printed: string): string | null {
  const n = normalizeName(printed);
  if (/\bdirect[oa]\b/.test(n)) return 'directo';
  if (/\b(calculad[oa]|calc|friedewald|martin|sampson)\b/.test(n)) return 'calculado';
  return null;
}

export function analyteName(id: string, lang: 'es' | 'en', fallback = ''): string {
  const a = ANALYTE_BY_ID.get(id);
  if (a) return lang === 'es' ? a.es : a.en;
  return fallback || id.replace(/^custom:/, '');
}

export function customId(printed: string): string {
  return `custom:${normalizeName(printed) || 'sin-nombre'}`;
}

/** Especificación de conversión para un analito (o una genérica para los no reconocidos). */
export function conversionSpec(id: string, fallbackUnit: string): ConversionSpec {
  const a = ANALYTE_BY_ID.get(id);
  if (a) return a;
  return { unit: canonicalUnit(fallbackUnit) ?? fallbackUnit };
}

export function unitsEqual(a: string, b: string): boolean {
  return unitKey(a) === unitKey(b);
}
