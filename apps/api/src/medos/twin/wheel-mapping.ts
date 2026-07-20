/**
 * Wheel mapping engine — convertit une réponse de formulaire (jsonb) en 12
 * scores 0-100 sur les axes canoniques de la Roue Détox, à partir d'un
 * `wheel_mapping` déclaratif stocké sur le template `med_medical_forms`.
 *
 * Utilisé par MedosService.submitFormResponse / submitMyFormResponse pour
 * upsert automatiquement `med_transformation_wheel` source='form_response'
 * à chaque soumission — le praticien voit la Roue prête sans rien saisir.
 *
 * Design pragmatique : pas de tour de force générique, juste 4 reducers qui
 * couvrent 95 % des cas concrets (sévérité 0-10, verbal→score, count avec
 * pénalité, constante). Nouveaux formulaires = étendre ce fichier.
 */

export const WHEEL_DOMAINS = [
  'digestion',
  'sleep',
  'stress',
  'energy',
  'inflammation',
  'immunity',
  'metabolism',
  'hormones',
  'physical_activity',
  'cognition',
  'environment',
  'emotions',
] as const;

export type WheelDomain = (typeof WHEEL_DOMAINS)[number];
export type WheelScores = Record<WheelDomain, number>;

// ── Types de reducers ────────────────────────────────────────────────────

interface SeverityReducer {
  type: 'severity_to_wellness';
  field: string;
}

interface VerbalReducer {
  type: 'verbal_to_score';
  field: string;
  map: Record<string, number>;
  fallback?: number;
}

interface CountPenaltyReducer {
  type: 'count_penalty';
  field: string;
  base?: number;
  penalty?: number;
  min?: number;
}

interface ConstantReducer {
  type: 'constant';
  value: number;
}

type Reducer = SeverityReducer | VerbalReducer | CountPenaltyReducer | ConstantReducer;

interface DomainMapping {
  reducers: Reducer[];
}

export type WheelMapping = Partial<Record<WheelDomain, DomainMapping>>;

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Résout un chemin dot-notation (« section3_symptoms.fatigue ») sur un objet
 * de réponses JSONB. Retourne undefined si le chemin ne résout pas.
 */
function resolvePath(responses: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = responses;
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function severityToWellness(sev: unknown): number | null {
  if (typeof sev !== 'number' || Number.isNaN(sev)) return null;
  const clamped = Math.max(0, Math.min(10, sev));
  return Math.round(Math.max(20, 100 - clamped * 8));
}

function verbalToScore(
  value: unknown,
  map: Record<string, number>,
  fallback: number,
): number | null {
  if (value == null) return null;
  const key = String(value).toLowerCase().trim();
  if (!key) return null;
  for (const [pattern, score] of Object.entries(map)) {
    if (key.includes(pattern.toLowerCase())) return score;
  }
  return fallback;
}

function countPenalty(
  value: unknown,
  base: number,
  penalty: number,
  min: number,
): number | null {
  if (!Array.isArray(value)) return null;
  const cap = base - min;
  const p = Math.min(cap, penalty * value.length);
  return Math.max(min, base - p);
}

// ── API publique ─────────────────────────────────────────────────────────

/**
 * Calcule les 12 scores de la Roue Détox à partir d'un `wheel_mapping` et
 * d'un objet de réponses de formulaire.
 *
 * Axes non couverts par le mapping → score par défaut 60 (neutre, pas
 * d'alerte). Reducers qui échouent silencieusement (champ absent, type
 * inattendu) sont ignorés dans la moyenne.
 */
export function computeWheelScores(
  mapping: WheelMapping,
  responses: Record<string, unknown>,
): WheelScores {
  const scores = {} as WheelScores;

  for (const domain of WHEEL_DOMAINS) {
    const dm = mapping[domain];
    if (!dm || !Array.isArray(dm.reducers) || dm.reducers.length === 0) {
      scores[domain] = 60;
      continue;
    }

    const values: number[] = [];
    for (const reducer of dm.reducers) {
      let v: number | null = null;
      switch (reducer.type) {
        case 'severity_to_wellness':
          v = severityToWellness(resolvePath(responses, reducer.field));
          break;
        case 'verbal_to_score':
          v = verbalToScore(
            resolvePath(responses, reducer.field),
            reducer.map,
            reducer.fallback ?? 60,
          );
          break;
        case 'count_penalty':
          v = countPenalty(
            resolvePath(responses, reducer.field),
            reducer.base ?? 90,
            reducer.penalty ?? 12,
            reducer.min ?? 30,
          );
          break;
        case 'constant':
          v = reducer.value;
          break;
      }
      if (v != null && Number.isFinite(v)) values.push(v);
    }

    if (values.length === 0) {
      scores[domain] = 60;
    } else {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      scores[domain] = Math.max(0, Math.min(100, Math.round(avg)));
    }
  }

  return scores;
}

/**
 * Valide qu'un objet ressemble à un WheelMapping (validation légère pour
 * refuser les payloads franchement malformés dans les endpoints admin).
 */
export function isValidWheelMapping(input: unknown): input is WheelMapping {
  if (input == null || typeof input !== 'object') return false;
  const obj = input as Record<string, unknown>;
  for (const domain of Object.keys(obj)) {
    if (!WHEEL_DOMAINS.includes(domain as WheelDomain)) return false;
    const dm = obj[domain];
    if (
      dm == null ||
      typeof dm !== 'object' ||
      !Array.isArray((dm as { reducers?: unknown[] }).reducers)
    ) {
      return false;
    }
  }
  return true;
}
