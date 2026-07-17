/**
 * Moteur PUR (aucune I/O) : transforme les réponses d'UN formulaire quelconque
 * en (A) scores de roue de transformation + (B) biomarqueurs déclarés pour le
 * jumeau. La configuration de scoring vit DANS la définition du formulaire
 * (`med_medical_forms.fields[].scoring` / `.biomarker_code`) → migration-free +
 * éditable par formulaire. Déterministe et testable (`form-scoring.test.js`).
 *
 * Sécurité clinique (B) : SEULES des mesures OBJECTIVES whitelistées (constantes)
 * alimentent le jumeau — jamais un ressenti subjectif. Un code inconnu est ignoré
 * (et re-filtré en aval par TwinService.addBiomarkers contre le référentiel).
 */

// Doit rester identique à TwinService.WHEEL_DOMAINS (les 12 axes hygiène de vie).
export const WHEEL_DOMAINS = [
  'digestion', 'sleep', 'stress', 'energy', 'inflammation', 'immunity',
  'metabolism', 'hormones', 'physical_activity', 'cognition', 'environment', 'emotions',
] as const;

// Constantes objectives qu'un patient peut déclarer (codes med_biomarker_refs,
// cf. TwinScoringService.mapVitalsToBiomarkers). Whitelist = garde-fou clinique.
export const DECLARABLE_BIOMARKERS = new Set([
  'GLUCOSE', 'BP_SYSTOLIC', 'BP_DIASTOLIC', 'HEART_RATE', 'SPO2', 'BODY_TEMP', 'WEIGHT',
]);

/** Contribution d'un champ à UN axe de roue. */
export type AxisScoring = {
  axis: string; // un des WHEEL_DOMAINS
  // Mapping réponse → 0..100 pour select / checkbox / multi (par valeur d'option).
  map?: Record<string, number>;
  // Mapping linéaire pour un champ number : (valeur-min)/(max-min)*100, borné 0..100.
  range?: { min: number; max: number; invert?: boolean };
};

export type ScoredField = {
  id: string;
  type?: string;
  scoring?: AxisScoring[];
  biomarker_code?: string;
  unit?: string;
};

const clamp100 = (n: number): number => Math.max(0, Math.min(100, n));

/** Score 0..100 d'une contribution pour une réponse donnée, ou null si inapplicable. */
function scoreContribution(spec: AxisScoring, answer: unknown): number | null {
  // Champ numérique → mapping linéaire.
  if (spec.range) {
    const n = Number(answer);
    if (!Number.isFinite(n)) return null;
    const { min, max, invert } = spec.range;
    if (max === min) return null;
    let pct = ((n - min) / (max - min)) * 100;
    if (invert) pct = 100 - pct;
    return clamp100(pct);
  }
  // Choix (select/checkbox) ou multi-choix (tableau) → table de correspondance.
  if (spec.map && typeof spec.map === 'object') {
    if (Array.isArray(answer)) {
      const vals = answer
        .map((a) => spec.map![String(a)])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      if (vals.length === 0) return null;
      return clamp100(vals.reduce((s, v) => s + v, 0) / vals.length);
    }
    const v = spec.map[String(answer)];
    return typeof v === 'number' && Number.isFinite(v) ? clamp100(v) : null;
  }
  return null;
}

/**
 * (A) Réponses d'un formulaire → scores de roue. Agrège par axe (moyenne des
 * contributions). Ne produit QUE les axes réellement alimentés (pas de score
 * fabriqué pour un axe sans donnée). Retour prêt pour TwinService.saveWheel.
 */
export function scoreFormResponsesToWheel(
  fields: ScoredField[] | null | undefined,
  responses: Record<string, unknown> | null | undefined,
): Array<{ domain: string; score: number }> {
  const buckets = new Map<string, number[]>();
  const resp = responses ?? {};
  for (const f of fields ?? []) {
    if (!f || !Array.isArray(f.scoring) || f.scoring.length === 0) continue;
    const answer = resp[f.id];
    if (answer == null || answer === '') continue;
    for (const spec of f.scoring) {
      if (!spec || !WHEEL_DOMAINS.includes(spec.axis as (typeof WHEEL_DOMAINS)[number])) continue;
      const s = scoreContribution(spec, answer);
      if (s == null) continue;
      const arr = buckets.get(spec.axis) ?? [];
      arr.push(s);
      buckets.set(spec.axis, arr);
    }
  }
  const out: Array<{ domain: string; score: number }> = [];
  for (const [axis, vals] of buckets) {
    if (vals.length === 0) continue;
    out.push({ domain: axis, score: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) });
  }
  return out;
}

/**
 * (B) Réponses d'un formulaire → biomarqueurs déclarés (constantes objectives).
 * Ne retient QUE les champs `type:'measure'` avec un `biomarker_code` whitelisté
 * et une valeur numérique strictement positive. Retour prêt pour
 * TwinService.addBiomarkers (qui re-filtre contre le référentiel + recalcule les
 * scores d'organes).
 */
export function extractMeasureBiomarkers(
  fields: ScoredField[] | null | undefined,
  responses: Record<string, unknown> | null | undefined,
): Array<{ biomarker_code: string; value: number; unit?: string }> {
  const out: Array<{ biomarker_code: string; value: number; unit?: string }> = [];
  const resp = responses ?? {};
  for (const f of fields ?? []) {
    if (!f || f.type !== 'measure' || !f.biomarker_code) continue;
    if (!DECLARABLE_BIOMARKERS.has(f.biomarker_code)) continue; // garde-fou clinique
    const n = Number(resp[f.id]);
    if (!Number.isFinite(n) || n <= 0) continue;
    out.push({ biomarker_code: f.biomarker_code, value: n, unit: f.unit });
  }
  return out;
}
