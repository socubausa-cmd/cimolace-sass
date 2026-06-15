// MEDOS v2 — Bio Digital Twin · client API (front med-app)
const API = import.meta.env.VITE_API_URL || 'http://localhost:4002';

function headers(json = false): HeadersInit {
  const h: Record<string, string> = {
    Authorization: 'Bearer ' + (localStorage.getItem('supabase_token') || ''),
    'X-Tenant-Slug': localStorage.getItem('tenant_slug') || '',
  };
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

function unwrap(d: any): any {
  return d?.data !== undefined ? d.data : d;
}

async function del(path: string): Promise<any> {
  const r = await fetch(API + path, { method: 'DELETE', headers: headers() });
  if (!r.ok) throw new Error(`Erreur ${r.status}`);
  return unwrap(await r.json());
}

async function get(path: string): Promise<any> {
  const r = await fetch(API + path, { headers: headers() });
  if (!r.ok) throw new Error(`Erreur ${r.status}`);
  return unwrap(await r.json());
}

async function post(path: string, body?: unknown): Promise<any> {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: headers(true),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b?.message || `Erreur ${r.status}`);
  }
  return unwrap(await r.json());
}

async function patch(path: string, body: unknown): Promise<any> {
  const r = await fetch(API + path, {
    method: 'PATCH',
    headers: headers(true),
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Erreur ${r.status}`);
  return unwrap(await r.json());
}

export type OrganColor = 'green' | 'yellow' | 'orange' | 'red';

export const twinApi = {
  /**
   * Bibliotheque de reference (organes + biomarqueurs).
   *
   * Passer `lang='en'` pour recevoir name/description en anglais (i18n
   * fondation — Chantier 5). Defaut : 'fr'. Si la traduction est absente
   * en DB, fallback transparent cote backend sur la version francaise.
   *
   * Pour les devs : aucun switcher UI n'est livre — c'est a l'appelant
   * de stocker/exposer le choix de langue (ex. localStorage 'med_lang',
   * preference utilisateur, contexte i18n React).
   */
  referential: (lang?: 'fr' | 'en') =>
    get('/med/twin/referential' + (lang ? `?lang=${lang}` : '')),
  graph: () => get('/med/twin/graph'),
  state: (pid: string) => get(`/med/twin/${pid}/state`),
  addBiomarkers: (pid: string, biomarkers: Array<{ biomarker_code: string; value: number }>) =>
    post(`/med/twin/${pid}/biomarkers`, { biomarkers }),
  compute: (pid: string) => post(`/med/twin/${pid}/compute`),
  organAssistant: (pid: string, organ_code: string, question?: string) =>
    post(`/med/twin/${pid}/organ-assistant`, { organ_code, question }),
  analyze: (pid: string) => post(`/med/twin/${pid}/analyze`),
  setHypothesis: (id: string, status: 'validated' | 'rejected') =>
    patch(`/med/twin/hypotheses/${id}`, { status }),
  // Vague 2
  getWheel: (pid: string) => get(`/med/twin/${pid}/wheel`),
  saveWheel: (pid: string, scores: Array<{ domain: string; score: number }>) =>
    post(`/med/twin/${pid}/wheel`, { scores }),
  listEvents: (pid: string) => get(`/med/twin/${pid}/events`),
  createEvent: (pid: string, e: { event_type: string; title: string; occurred_at: string }) =>
    post(`/med/twin/${pid}/events`, e),
  history: (pid: string) => get(`/med/twin/${pid}/history`),
  correlations: (pid: string) => get(`/med/twin/${pid}/correlations`),
  simulate: (pid: string, interventions: string[]) =>
    post(`/med/twin/${pid}/simulate`, { interventions }),
  /**
   * Projection temporelle du jumeau (moteur `projection-v1`, déterministe).
   *
   * Tous les champs sont optionnels — passer `{}` (ou rien) renvoie la
   * projection par défaut (tous les scénarios, horizons [1, 5, 10, 20]).
   * Aucune donnée patient n'est envoyée : age/sexe/scores/roue/biomarqueurs
   * sont résolus côté serveur via le `patientId`.
   */
  projection: (
    pid: string,
    opts?: { horizons_years?: number[]; scenario_keys?: string[]; horizon_focus?: number },
  ): Promise<ProjectionResult> => post(`/med/twin/${pid}/projection`, opts ?? {}),
  rootCause: (pid: string) => post(`/med/twin/${pid}/root-cause`),
  council: (pid: string) => post(`/med/twin/${pid}/council`),
  scientific: (query: string) => post('/med/twin/scientific', { query }),
  createDocument: (pid: string, raw_text: string, lab_name?: string) =>
    post(`/med/twin/${pid}/documents`, { raw_text, lab_name, source_type: 'blood' }),
  extractDocument: (pid: string, docId: string) =>
    post(`/med/twin/${pid}/documents/${docId}/extract`),
  /**
   * Upload + extraction d'un bilan en multipart (M3 — PDF/JPG/PNG, max 10 Mo).
   * Renvoie { document_id, extracted_count, values, inserted, scores }.
   */
  uploadDocument: async (
    pid: string,
    file: File,
    meta?: { source_type?: string; lab_name?: string },
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    if (meta?.source_type) fd.append('source_type', meta.source_type);
    if (meta?.lab_name) fd.append('lab_name', meta.lab_name);
    const r = await fetch(API + `/med/twin/${pid}/documents/upload`, {
      method: 'POST',
      headers: headers(), // PAS de Content-Type → laisser le browser ajouter la boundary multipart.
      body: fd,
    });
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      throw new Error(b?.message || `Erreur ${r.status}`);
    }
    return unwrap(await r.json());
  },
  /**
   * Import CSV/JSON déterministe — connecteur labo zéro-IA.
   * Le mapping code/valeur est fait côté client (parser CSV ou export labo).
   */
  importCsv: (
    pid: string,
    items: Array<{ code: string; value: number; unit?: string; measured_at?: string }>,
    meta?: { lab_name?: string },
  ): Promise<{
    imported_count: number;
    skipped: Array<{ code: string; reason: string }>;
    document_id: string;
    scores: any;
  }> => post(`/med/twin/${pid}/documents/import-csv`, { items, lab_name: meta?.lab_name }),
  // Audit trail bilans : liste, signed URL pour viewer, suppression GDPR.
  listDocuments: (pid: string): Promise<LabDocument[]> =>
    get(`/med/twin/${pid}/documents`),
  documentSignedUrl: (
    pid: string,
    docId: string,
  ): Promise<{ url: string; mime_type: string | null; original_filename: string | null; expires_at: string }> =>
    get(`/med/twin/${pid}/documents/${docId}/signed-url`),
  deleteDocument: (pid: string, docId: string): Promise<{ deleted: boolean }> =>
    del(`/med/twin/${pid}/documents/${docId}`),
  // Versioning moteur + historique (P2 C1)
  engineVersions: (): Promise<EngineVersion[]> => get('/med/twin/engine-versions'),
  scoresTimeline: (
    pid: string,
    organCode?: string,
  ): Promise<Record<string, OrganScoreSnapshot[]>> => {
    const qs = organCode ? `?organ=${encodeURIComponent(organCode)}` : '';
    return get(`/med/twin/${pid}/timeline${qs}`);
  },
  // ── Multi-omics génomique (P2 C2) ──────────────────────────────────────
  /** Référentiel des SNPs actionnables (~25 variants, lecture seule). */
  snpReferential: (): Promise<SnpRef[]> => get('/med/twin/snp-referential'),
  /** Liste les génotypes SNP d'un patient. */
  snpList: (pid: string): Promise<PatientSnp[]> => get(`/med/twin/${pid}/snps`),
  /** Saisie de génotypes (manuel ou import labo). */
  snpAdd: (
    pid: string,
    snps: Array<{ snp_code: string; genotype: string }>,
  ): Promise<{ inserted: number; rows: PatientSnp[] }> =>
    post(`/med/twin/${pid}/snps`, { snps }),
  /** Interprétation déterministe : génotype → risk_level + interventions FR. */
  snpInterpret: (
    pid: string,
  ): Promise<{ patient_id: string; interpretations: SnpInterpretation[] }> =>
    get(`/med/twin/${pid}/snps/interpretation`),
  // ── Multi-omics microbiome (P3 C1) ─────────────────────────────────────
  /** Référentiel des taxons microbiome (~30 entrées, lecture seule). */
  microbiomeRef: (): Promise<MicrobiomeRef[]> => get('/med/twin/microbiome-referential'),
  /** Liste les mesures microbiome d'un patient (triées par date desc). */
  microbiomeList: (pid: string): Promise<PatientMicrobiome[]> =>
    get(`/med/twin/${pid}/microbiome`),
  /** Saisie d'une ou plusieurs mesures microbiome (manuel ou import labo). */
  microbiomeAdd: (
    pid: string,
    taxa: Array<{
      taxon_code: string;
      relative_abundance: number;
      sample_date?: string;
      lab_name?: string;
    }>,
  ): Promise<{ inserted: number; rows: PatientMicrobiome[] }> =>
    post(`/med/twin/${pid}/microbiome`, { taxa }),
  /** Évaluation déterministe de la dysbiose (score 0-100 + recommandations FR). */
  microbiomeAssessment: (pid: string): Promise<DysbiosisAssessment> =>
    get(`/med/twin/${pid}/microbiome/assessment`),
  // ── Multi-omics métabolomique (P3 C2) ──────────────────────────────────
  /** Référentiel des métabolites (~40 marqueurs, lecture seule). */
  metaboliteRef: (): Promise<MetaboliteRef[]> =>
    get('/med/twin/metabolite-referential'),
  /** Liste les mesures métabolomiques d'un patient (triées par date desc). */
  metaboliteList: (pid: string): Promise<PatientMetabolite[]> =>
    get(`/med/twin/${pid}/metabolites`),
  /** Saisie d'une ou plusieurs mesures métabolomiques (manuel ou import). */
  metaboliteAdd: (
    pid: string,
    items: Array<{
      metabolite_code: string;
      value: number;
      unit?: string;
      sample_date?: string;
      lab_name?: string;
    }>,
  ): Promise<{ inserted: number; rows: PatientMetabolite[] }> =>
    post(`/med/twin/${pid}/metabolites`, { items }),
  /** Profil des voies biochimiques (méthylation, Krebs, mitochondrie, etc.). */
  metaboliteProfile: (
    pid: string,
  ): Promise<{ patient_id: string; pathways: PathwayProfile[] }> =>
    get(`/med/twin/${pid}/metabolites/profile`),
};

// ── Types génomiques (P2 C2) ───────────────────────────────────────────
export type SnpRef = {
  snp_code: string;
  rs_id: string | null;
  gene: string;
  chromosome: string | null;
  function_fr: string | null;
  risk_genotypes: string[];
  wild_genotype: string | null;
  impact_fr: string | null;
  interventions_fr: string[];
};

export type PatientSnp = {
  id: string;
  snp_code: string;
  genotype: string;
  gene: string | null;
  recorded_at: string;
  source: 'manual' | 'lab';
};

export type SnpRiskLevel = 'wild' | 'hetero' | 'homo_risk' | 'unknown';

export type SnpInterpretation = {
  snp_code: string;
  gene: string;
  genotype: string;
  risk_level: SnpRiskLevel;
  interpretation_fr: string;
  interventions_fr: string[];
};

// ── Types microbiome (P3 C1) ───────────────────────────────────────────
export type MicrobiomeTaxonLevel = 'phylum' | 'genus' | 'species' | 'ratio' | 'score';

export type MicrobiomeRef = {
  taxon_code: string;
  taxon_name: string;
  taxon_level: MicrobiomeTaxonLevel;
  ecology_fr: string | null;
  optimal_low: number | null;
  optimal_high: number | null;
  low_impact_fr: string | null;
  high_impact_fr: string | null;
  organs: string[];
  higher_is_worse: boolean;
};

export type PatientMicrobiome = {
  id: string;
  taxon_code: string;
  relative_abundance: number;
  sample_date: string;
  lab_name: string | null;
  source: 'manual' | 'lab';
};

export type DysbiosisColor = 'green' | 'yellow' | 'orange' | 'red';

export type DysbiosisAssessment = {
  patient_id: string;
  sample_date: string | null;
  dysbiosis_score: number;
  color: DysbiosisColor;
  metrics: {
    firmicutes_bacteroidetes_ratio: number | null;
    alpha_diversity_shannon: number | null;
    butyrate_producers_score: number | null;
    lps_load_score: number | null;
  };
  key_findings_fr: string[];
  recommendations_fr: string[];
};

// ── Types métabolomique (P3 C2) ────────────────────────────────────────
export type MetaboliteCategory =
  | 'organic_acid'
  | 'amino_acid'
  | 'neurotransmitter'
  | 'fatty_acid'
  | 'mitochondrial';

export type MetaboliteRef = {
  metabolite_code: string;
  name_fr: string;
  name_en: string | null;
  category: MetaboliteCategory;
  unit: string | null;
  optimal_low: number | null;
  optimal_high: number | null;
  lab_low: number | null;
  lab_high: number | null;
  pathway_fr: string | null;
  deficiency_impact_fr: string | null;
  excess_impact_fr: string | null;
  organs: string[];
};

export type PatientMetabolite = {
  id: string;
  metabolite_code: string;
  value: number;
  unit: string | null;
  sample_date: string;
  lab_name: string | null;
  source: 'manual' | 'lab' | 'import';
  created_at: string;
};

export type PathwayStatus = 'optimal' | 'low' | 'high' | 'imbalanced';

export type PathwayProfile = {
  name_fr: string;
  status: PathwayStatus;
  evidence_codes: string[];
  interpretation_fr: string;
};

export type EngineVersion = {
  id: string;
  code: string;
  version: string;
  kind: 'engine' | 'graph';
  description_fr: string | null;
  released_at: string;
  deprecated_at: string | null;
  change_notes: string | null;
  is_active: boolean;
};

// ── Types projection temporelle (projection-v1) ────────────────────────
/** Les 6 sous-systèmes du scoring fonctionnel (risque projeté 0-100). */
export type ProjectionSystems = {
  inflammation: number;
  metabolism: number;
  hormones: number;
  oxidative_stress: number;
  toxicity: number;
  cellular_energy: number;
};

export type ProjectionBand = 'low' | 'moderate' | 'elevated' | 'high';

/** Projection d'un scénario à un horizon donné. */
export type ProjectionScenarioPoint = {
  composite_risk: number; // 0-100
  risk_delta_pct: number; // % signé vs risque actuel (phrase signature)
  vitality: number; // 0-100
  systems: ProjectionSystems;
  band: ProjectionBand;
};

/** Une entrée par année demandée (1 | 5 | 10 | 20…). */
export type ProjectionHorizon = {
  year: number;
  age_at_horizon: number | null;
  scenarios: Record<string, ProjectionScenarioPoint>;
};

export type ProjectionLifeExpectancyScenario = {
  estimate_years: number;
  healthspan_years: number;
  delta_vs_status_quo_years: number; // status_quo = 0
};

export type ProjectionDriverDirection = 'aggravant' | 'protecteur';
export type ProjectionDriverSource = 'biomarker' | 'lifestyle' | 'organ_score' | 'demographic';

/** Facteur explicatif au horizon_focus (le « pourquoi » chiffré). */
export type ProjectionDriver = {
  code: string;
  label_fr: string;
  contribution_pct: number; // somme ~100
  direction: ProjectionDriverDirection;
  why_fr: string;
  source: ProjectionDriverSource;
  modifiable: boolean;
};

export type ProjectionConfidenceLevel = 'faible' | 'moderee' | 'bonne';

export type ProjectionConfidence = {
  level: ProjectionConfidenceLevel;
  score: number; // 0-1
  reasons_fr: string[];
};

export type ProjectionResult = {
  patient_id: string;
  engine_version: string; // ex 'projection-v1'
  generated_at: string; // ISO
  inputs: {
    age: number | null;
    sex: 'female' | 'male' | null;
    baseline_life_expectancy: number;
    horizons_years: number[];
    scenario_keys: string[];
    horizon_focus: number;
  };
  current: {
    vitality: number; // 0-100
    composite_risk: number; // 0-100
    data_completeness: number; // 0-1
  };
  horizons: ProjectionHorizon[];
  life_expectancy: {
    baseline: number;
    scenarios: Record<string, ProjectionLifeExpectancyScenario>;
  };
  drivers: ProjectionDriver[];
  confidence: ProjectionConfidence;
  assumptions_fr: string[];
  disclaimer: string; // valeur fixe (PROJECTION_DISCLAIMER)
};

export type OrganScoreSnapshot = {
  score: number;
  color: OrganColor;
  created_at: string;
  engine_version: string;
  graph_version: string;
};

export type LabDocument = {
  id: string;
  source_type: string | null;
  lab_name: string | null;
  status: 'uploaded' | 'extracting' | 'extracted' | 'failed' | 'reviewed' | 'deleted';
  mime_type: string | null;
  file_size_bytes: number | null;
  original_filename: string | null;
  page_count: number | null;
  extraction_model: string | null;
  extraction_confidence: number | null;
  extraction_path: 'pdf_text' | 'image_vision' | 'pasted_text' | null;
  created_at: string;
  has_file: boolean;
};

export const WHEEL_LABELS: Record<string, string> = {
  digestion: 'Digestion', sleep: 'Sommeil', stress: 'Stress', energy: 'Énergie',
  inflammation: 'Inflammation', immunity: 'Immunité', metabolism: 'Métabolisme',
  hormones: 'Hormones', physical_activity: 'Activité physique', cognition: 'Cognition',
  environment: 'Environnement', emotions: 'Émotions',
};

export const COLOR_HEX: Record<OrganColor, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  orange: '#f97316',
  red: '#ef4444',
};
export const COLOR_LABEL: Record<OrganColor, string> = {
  green: 'Optimal',
  yellow: 'À surveiller',
  orange: 'Sub-optimal',
  red: 'Critique',
};
