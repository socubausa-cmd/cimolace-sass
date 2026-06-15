import { Injectable } from '@nestjs/common';
import type { OrganScore } from './twin-scoring.service';

/**
 * MEDOS v2 — Bio Digital Twin · Projection temporelle du jumeau (projection-v1).
 *
 * MIROIR de TwinSimulationService : 100 % DÉTERMINISTE, fonctions PURES,
 * AUCUN appel LLM, AUCUNE nouvelle table. Mêmes entrées → mêmes sorties.
 *
 * Le modèle est HEURISTIQUE et TRANSPARENT : chaque terme du risque annualisé
 * est justifiable et tracé comme « driver ». On projette un RISQUE FONCTIONNEL
 * (bien-être), JAMAIS une mortalité. Le disclaimer fixe est renvoyé à chaque
 * appel et la confiance est explicite — rien n'est caché.
 *
 * `engine_version='projection-v1'` permet de faire évoluer la table de cohorte
 * ou les pénalités sans casser l'historique des analyses déjà produites.
 */

// ─── Versionnage & disclaimer (valeurs FIXES) ────────────────────────────────
export const PROJECTION_VERSION = 'projection-v1';

export const PROJECTION_DISCLAIMER =
  "Estimation de bien-être à visée pédagogique, fondée sur un modèle heuristique transparent — ce n'est PAS une prédiction médicale, ni un diagnostic, ni une espérance de vie individuelle. Les chiffres illustrent des tendances selon le mode de vie ; seul un médecin peut évaluer un risque réel.";

// ─── Les 6 dimensions du scoring (miroir de TwinScoringService.Dimension) ────
export const PROJECTION_DIMENSIONS = [
  'inflammation',
  'metabolism',
  'hormones',
  'oxidative_stress',
  'toxicity',
  'cellular_energy',
] as const;
export type ProjectionDimension = (typeof PROJECTION_DIMENSIONS)[number];

export type RiskBand = 'low' | 'moderate' | 'elevated' | 'high';
export type ConfidenceLevel = 'faible' | 'moderee' | 'bonne';
export type DriverDirection = 'aggravant' | 'protecteur';
export type DriverSource = 'biomarker' | 'lifestyle' | 'organ_score' | 'demographic';

// ─── Table d'espérance de vie de cohorte (FIGÉE & versionnée) ────────────────
/** Espérance de vie à la naissance, cohorte FR figée. Fallback 82 si sexe inconnu. */
export const COHORT_LE = { female: 85.3, male: 79.4, fallback: 82 } as const;

/** Âge de cohorte par défaut si la date de naissance est absente. */
export const DEFAULT_COHORT_AGE = 45;

// ─── Catalogue des leviers (scénarios) ───────────────────────────────────────
/**
 * Chaque levier réduit certaines pénalités « mode de vie » (facteur multiplicatif
 * appliqué à la pénalité/an) et/ou atténue le risque de certaines dimensions
 * (affinité 0..1 : 1 = pleinement adressé). `status_quo` ne touche à rien.
 *
 * Les clés `penaltyFactors` correspondent aux clés de LIFESTYLE_PENALTIES.
 * Aligné sur l'esprit des INTERVENTIONS du simulateur (sleep/glycemic/antiinflammatory).
 */
export interface ScenarioDef {
  key: string;
  label_fr: string;
  /** Facteur multiplicatif (<1 = réduction) par pénalité mode de vie. */
  penaltyFactors: Partial<Record<LifestylePenaltyCode, number>>;
  /** Atténuation du risque par dimension (0 = aucune, 1 = pleine). */
  dimensionRelief: Partial<Record<ProjectionDimension, number>>;
  /** true = ce levier est un programme modifiable (≠ status_quo). */
  modifiable: boolean;
}

export const SCENARIOS: ScenarioDef[] = [
  {
    key: 'status_quo',
    label_fr: 'Si rien ne change',
    penaltyFactors: {},
    dimensionRelief: {},
    modifiable: false,
  },
  {
    key: 'weight_loss',
    label_fr: 'Perte de poids',
    // Réutilise l'esprit du levier 'glycemic' : glycation/sucre fortement réduits.
    penaltyFactors: { sugar: 0.4, glycation_inflammation: 0.6 },
    dimensionRelief: { metabolism: 1.0 },
    modifiable: true,
  },
  {
    key: 'quit_smoking',
    label_fr: 'Arrêt du tabac',
    // Annule la pénalité tabac, atténue oxydatif + inflammation.
    penaltyFactors: { smoking: 0 },
    dimensionRelief: { oxidative_stress: 0.5, inflammation: 0.5 },
    modifiable: true,
  },
  {
    key: 'better_sleep',
    label_fr: 'Sommeil amélioré',
    // Aligné sur l'intervention 'sleep' (CORTISOL, hormones).
    penaltyFactors: { sleep: 0.3 },
    dimensionRelief: { hormones: 0.7, cellular_energy: 0.7 },
    modifiable: true,
  },
  {
    key: 'more_activity',
    label_fr: 'Activité physique',
    penaltyFactors: { sedentary: 0.3 },
    dimensionRelief: { cellular_energy: 0.8, metabolism: 0.6, inflammation: 0.3 },
    modifiable: true,
  },
  {
    key: 'stress_reduction',
    label_fr: 'Gestion du stress',
    // Aligné sur 'antiinflammatory' (inflammation + communication hormonale).
    penaltyFactors: { stress: 0.35 },
    dimensionRelief: { inflammation: 0.4, hormones: 0.5 },
    modifiable: true,
  },
  {
    key: 'combined_optimal',
    label_fr: 'Programme global',
    // Tous les leviers modifiables simultanément (cumul borné côté moteur :
    // r_lifestyle ne peut chuter sous 20 % de sa valeur initiale).
    penaltyFactors: {
      sugar: 0.4,
      glycation_inflammation: 0.5,
      smoking: 0,
      sleep: 0.3,
      sedentary: 0.3,
      stress: 0.35,
      inflammation_low: 0.4,
      alcohol: 0.4,
    },
    dimensionRelief: {
      inflammation: 0.6,
      metabolism: 0.7,
      hormones: 0.6,
      oxidative_stress: 0.5,
      toxicity: 0.5,
      cellular_energy: 0.7,
    },
    modifiable: true,
  },
];

// ─── Pénalités « mode de vie » (risque annualisé additionnel) ────────────────
/**
 * Chaque pénalité est dérivée d'un axe RÉEL de la roue de transformation (12 axes).
 * On ne fabrique aucune donnée : si l'axe est absent (score null), la pénalité
 * ne s'applique pas. Tracée comme driver `lifestyle`.
 *
 * Convention « mauvais » = score < 50 (pénalité pleine) ; « moyen » = 50..65
 * (demi-pénalité) ; ≥ 65 = aucune pénalité.
 *
 * Mapping axe roue → pénalité (les 12 axes : digestion, sleep, stress, energy,
 * inflammation, immunity, metabolism, hormones, physical_activity, cognition,
 * environment, emotions) :
 *  - tabac/alcool : la roue ne porte pas d'axe dédié → proxy `environment`
 *    (charge toxique / mode de vie environnemental). Documenté & auditable.
 */
export type LifestylePenaltyCode =
  | 'smoking'
  | 'alcohol'
  | 'sugar'
  | 'glycation_inflammation'
  | 'sedentary'
  | 'sleep'
  | 'stress'
  | 'inflammation_low';

export interface LifestylePenaltyDef {
  code: LifestylePenaltyCode;
  /** Axe(s) de la roue source de cette pénalité. */
  wheelDomain: string;
  /** Pénalité/an à pleine charge (axe « mauvais »). */
  perYear: number;
  label_fr: string;
  why_fr: string;
  /** Dimensions du scoring que cette pénalité aggrave (pour systems_d). */
  dimensions: ProjectionDimension[];
}

export const LIFESTYLE_PENALTIES: LifestylePenaltyDef[] = [
  {
    code: 'smoking',
    wheelDomain: 'environment',
    perYear: 0.012,
    label_fr: 'Tabagisme / charge toxique',
    why_fr:
      "Le tabac et l'exposition toxique accélèrent le vieillissement vasculaire et oxydatif.",
    dimensions: ['oxidative_stress', 'toxicity', 'inflammation'],
  },
  {
    code: 'alcohol',
    wheelDomain: 'environment',
    perYear: 0.006,
    label_fr: 'Consommation d\'alcool élevée',
    why_fr:
      "Une consommation d'alcool soutenue charge le foie et entretient l'inflammation.",
    dimensions: ['toxicity', 'inflammation'],
  },
  {
    code: 'sugar',
    wheelDomain: 'metabolism',
    perYear: 0.005,
    label_fr: 'Charge glycémique / métabolique',
    why_fr:
      "Un métabolisme déséquilibré (sucre, glycation) favorise la résistance à l'insuline.",
    dimensions: ['metabolism'],
  },
  {
    code: 'glycation_inflammation',
    wheelDomain: 'digestion',
    perYear: 0.005,
    label_fr: 'Digestion / glycation',
    why_fr:
      'Une digestion altérée entretient une inflammation de bas grade et la glycation.',
    dimensions: ['metabolism', 'inflammation'],
  },
  {
    code: 'sedentary',
    wheelDomain: 'physical_activity',
    perYear: 0.006,
    label_fr: 'Sédentarité',
    why_fr:
      "Le manque d'activité physique réduit la santé métabolique et l'énergie cellulaire.",
    dimensions: ['cellular_energy', 'metabolism', 'inflammation'],
  },
  {
    code: 'sleep',
    wheelDomain: 'sleep',
    perYear: 0.004,
    label_fr: 'Sommeil insuffisant',
    why_fr:
      "Un sommeil de mauvaise qualité dérègle le cortisol et l'équilibre hormonal.",
    dimensions: ['hormones', 'cellular_energy'],
  },
  {
    code: 'stress',
    wheelDomain: 'stress',
    perYear: 0.004,
    label_fr: 'Stress chronique',
    why_fr:
      "Le stress prolongé maintient l'inflammation et perturbe la communication hormonale.",
    dimensions: ['inflammation', 'hormones'],
  },
  {
    code: 'inflammation_low',
    wheelDomain: 'inflammation',
    perYear: 0.005,
    label_fr: 'Terrain inflammatoire',
    why_fr:
      "Un terrain inflammatoire élevé accélère l'usure fonctionnelle des organes.",
    dimensions: ['inflammation'],
  },
];

// ─── Paliers de risque liés à l'âge (senescence) ─────────────────────────────
export function ageRiskTerm(age: number): number {
  if (age < 40) return 0.004;
  if (age < 55) return 0.008;
  if (age < 70) return 0.014;
  return 0.022;
}

// ─── Bornes globales du risque annualisé ─────────────────────────────────────
const R_MIN = 0.005; // 0.5 %/an
const R_MAX = 0.08; // 8 %/an
/** r_lifestyle ne peut chuter sous ce ratio de sa valeur initiale (cumul borné). */
const LIFESTYLE_FLOOR_RATIO = 0.2;
/** Cap absolu du gain/perte d'espérance (crédibilité). */
const LE_GAIN_CAP_YEARS = 12;
/** Facteur d'échelle de l'ajustement d'espérance (borné). */
const LE_SCALE_K = 6;

// ─── Interfaces d'entrée / sortie ────────────────────────────────────────────
export interface ProjectionInput {
  age: number | null;
  sex: 'female' | 'male' | string | null;
  organScores: OrganScore[];
  wheel: Array<{ domain: string; score: number | null }>;
  biomarkerCount: number;
  horizonsYears: number[];
  scenarioKeys: string[];
  horizonFocus: number;
}

export interface ProjectionSystems {
  inflammation: number;
  metabolism: number;
  hormones: number;
  oxidative_stress: number;
  toxicity: number;
  cellular_energy: number;
}

export interface ProjectionScenarioPoint {
  composite_risk: number;
  risk_delta_pct: number;
  vitality: number;
  systems: ProjectionSystems;
  band: RiskBand;
}

export interface ProjectionHorizon {
  year: number;
  age_at_horizon: number | null;
  scenarios: Record<string, ProjectionScenarioPoint>;
}

export interface ProjectionLifeExpectancyScenario {
  estimate_years: number;
  healthspan_years: number;
  delta_vs_status_quo_years: number;
}

export interface ProjectionDriver {
  code: string;
  label_fr: string;
  contribution_pct: number;
  direction: DriverDirection;
  why_fr: string;
  source: DriverSource;
  modifiable: boolean;
}

export interface ProjectionConfidence {
  level: ConfidenceLevel;
  score: number;
  reasons_fr: string[];
}

export interface ProjectionInputsEcho {
  age: number | null;
  sex: 'female' | 'male' | null;
  baseline_life_expectancy: number;
  horizons_years: number[];
  scenario_keys: string[];
  horizon_focus: number;
}

export interface ProjectionCurrent {
  vitality: number;
  composite_risk: number;
  data_completeness: number;
}

/** Forme de réponse SANS patient_id / generated_at (ajoutés par le service appelant). */
export interface ProjectionResult {
  engine_version?: string;
  inputs: ProjectionInputsEcho;
  current: ProjectionCurrent;
  horizons: ProjectionHorizon[];
  life_expectancy: {
    baseline: number;
    scenarios: Record<string, ProjectionLifeExpectancyScenario>;
  };
  drivers: ProjectionDriver[];
  confidence: ProjectionConfidence;
  assumptions_fr: string[];
  disclaimer: string;
}

// ─── Helpers numériques (jamais de NaN/Infinity) ─────────────────────────────
function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}
function round(n: number, decimals = 0): number {
  if (!Number.isFinite(n)) return 0;
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}
function avg(arr: number[]): number {
  const nums = arr.filter((x) => Number.isFinite(x));
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

@Injectable()
export class TwinProjectionService {
  // Aucune dépendance externe : calcul 100 % pur (les organScores sont fournis
  // par l'appelant, déjà calculés via TwinScoringService).

  // ── Étape 1 : risque fonctionnel actuel (0-100) ────────────────────────
  /** Vitalité actuelle = moyenne des scores d'organes (= global_indices.vitality). */
  currentVitality(organScores: OrganScore[]): number {
    return round(clamp(avg(organScores.map((s) => s.score)), 0, 100));
  }

  /** Risque composite actuel = 100 - vitalité, borné. */
  currentCompositeRisk(organScores: OrganScore[]): number {
    return round(clamp(100 - this.currentVitality(organScores), 0, 100));
  }

  /** Score par dimension actuel (0-100). Moyenne des sous-scores d'organes. */
  currentDimensionScore(organScores: OrganScore[], dim: ProjectionDimension): number {
    const vals = organScores
      .map((s) => (s.dimensions as Record<string, number | undefined>)[dim])
      .filter((x): x is number => typeof x === 'number');
    // Si la dimension n'est portée par aucun organe scoré, on retombe sur la
    // vitalité globale (signal le moins biaisé), évitant un 0 trompeur.
    if (vals.length === 0) return this.currentVitality(organScores);
    return round(clamp(avg(vals), 0, 100));
  }

  // ── Étape 2 : risque annualisé (additif, chaque terme justifiable) ─────
  /**
   * Décompose le risque annualisé en ses termes (age / état / mode de vie).
   * `wheelScoreByDomain` : map domaine → score (0-100) ou null.
   */
  annualRiskTerms(input: ProjectionInput): {
    r_age: number;
    r_state: number;
    lifestyle: Array<{ def: LifestylePenaltyDef; raw: number; severity: 'bad' | 'mid' }>;
    r_lifestyle: number;
    r_total: number;
  } {
    const effectiveAge = input.age ?? DEFAULT_COHORT_AGE;
    const compositeRisk0 = this.currentCompositeRisk(input.organScores);

    const r_age = ageRiskTerm(effectiveAge);
    const r_state = (compositeRisk0 / 100) * 0.025;

    const wheelByDomain = new Map<string, number | null>();
    for (const w of input.wheel) wheelByDomain.set(w.domain, w.score);

    const lifestyle: Array<{
      def: LifestylePenaltyDef;
      raw: number;
      severity: 'bad' | 'mid';
    }> = [];
    let r_lifestyle = 0;
    for (const def of LIFESTYLE_PENALTIES) {
      const score = wheelByDomain.get(def.wheelDomain);
      if (score == null || !Number.isFinite(score)) continue; // axe absent → pas de pénalité
      let raw = 0;
      let severity: 'bad' | 'mid' | null = null;
      if (score < 50) {
        raw = def.perYear;
        severity = 'bad';
      } else if (score < 65) {
        raw = def.perYear * 0.5;
        severity = 'mid';
      }
      if (severity) {
        lifestyle.push({ def, raw, severity });
        r_lifestyle += raw;
      }
    }

    const r_total_unbounded = r_age + r_state + r_lifestyle;
    const r_total = clamp(r_total_unbounded, R_MIN, R_MAX);
    return { r_age, r_state, lifestyle, r_lifestyle, r_total };
  }

  /**
   * Calcule le risque annualisé effectif d'un scénario (leviers appliqués),
   * en réduisant les pénalités mode de vie. Renvoie aussi r_lifestyle effectif
   * (pour l'espérance de vie) et l'atténuation moyenne par dimension.
   */
  scenarioAnnualRisk(
    input: ProjectionInput,
    base: ReturnType<TwinProjectionService['annualRiskTerms']>,
    scenario: ScenarioDef,
  ): { r_eff: number; r_lifestyle_eff: number; dimensionRelief: Partial<Record<ProjectionDimension, number>> } {
    let r_lifestyle_eff = 0;
    for (const item of base.lifestyle) {
      const factor = scenario.penaltyFactors[item.def.code];
      const applied = factor == null ? item.raw : item.raw * factor;
      r_lifestyle_eff += applied;
    }
    // Cumul borné : ne pas descendre sous LIFESTYLE_FLOOR_RATIO de la valeur initiale.
    if (base.r_lifestyle > 0) {
      const floor = base.r_lifestyle * LIFESTYLE_FLOOR_RATIO;
      r_lifestyle_eff = Math.max(r_lifestyle_eff, floor);
    }
    const r_eff = clamp(base.r_age + base.r_state + r_lifestyle_eff, R_MIN, R_MAX);
    return { r_eff, r_lifestyle_eff, dimensionRelief: scenario.dimensionRelief };
  }

  // ── Étape 3 : composition aux horizons (pas linéaire) ──────────────────
  /** composite_risk(t) = 100 - (100 - risk0) * (1 - r)^t, borné 0..100. */
  composeRisk(risk0: number, r: number, years: number): number {
    const safeR = clamp(r, 0, 1);
    const survival = Math.pow(1 - safeR, Math.max(0, years));
    const projected = 100 - (100 - clamp(risk0, 0, 100)) * survival;
    return round(clamp(projected, 0, 100));
  }

  /** Bande couleur dérivée du risque composite. */
  band(compositeRisk: number): RiskBand {
    if (compositeRisk < 20) return 'low';
    if (compositeRisk < 40) return 'moderate';
    if (compositeRisk < 60) return 'elevated';
    return 'high';
  }

  /** Variation RELATIVE (%) du risque vs actuel — la « phrase signature ». */
  riskDeltaPct(projected: number, risk0: number): number {
    return round(((projected - risk0) / Math.max(risk0, 1)) * 100);
  }

  // ── Étape 4 : espérance de vie / healthspan ────────────────────────────
  baselineLifeExpectancy(sex: 'female' | 'male' | string | null): number {
    if (sex === 'female') return COHORT_LE.female;
    if (sex === 'male') return COHORT_LE.male;
    return COHORT_LE.fallback;
  }

  /**
   * Espérance de vie ajustée + healthspan d'un scénario.
   * Seule la part MODIFIABLE (r_lifestyle) bouge l'espérance — l'âge n'est pas
   * « réversible ». Bornes crédibles appliquées.
   */
  lifeExpectancy(
    input: ProjectionInput,
    base: ReturnType<TwinProjectionService['annualRiskTerms']>,
    scenario: { r_lifestyle_eff: number; r_eff: number },
    statusQuoLifestyle: number,
    risk0: number,
    compositeRiskAt10: number,
  ): ProjectionLifeExpectancyScenario {
    const effectiveAge = input.age ?? DEFAULT_COHORT_AGE;
    const baseLE = this.baselineLifeExpectancy(input.sex);
    const remainingBaseline = Math.max(baseLE - effectiveAge, 3);

    // L'amélioration du mode de vie (vs status quo) rallonge l'espérance.
    const lifestyleDelta = statusQuoLifestyle - scenario.r_lifestyle_eff; // >= 0 si amélioration
    let adjustYears = remainingBaseline * (LE_SCALE_K * lifestyleDelta);
    adjustYears = clamp(adjustYears, -LE_GAIN_CAP_YEARS, LE_GAIN_CAP_YEARS);

    let estimate = effectiveAge + remainingBaseline + adjustYears;
    // Borne crédible : [age+3, age+remaining+8].
    estimate = clamp(estimate, effectiveAge + 3, effectiveAge + remainingBaseline + 8);

    // Healthspan : années en bonne santé fonctionnelle.
    const morbidityGap = clamp(8 * (1 + compositeRiskAt10 / 100), 2, 15);
    const healthspan = clamp(estimate - morbidityGap, effectiveAge, estimate);

    return {
      estimate_years: round(estimate, 1),
      healthspan_years: round(healthspan, 1),
      delta_vs_status_quo_years: 0, // rempli après calcul du status_quo
    };
  }

  // ── Étape 5 : drivers (le « pourquoi ») ────────────────────────────────
  buildDrivers(
    input: ProjectionInput,
    base: ReturnType<TwinProjectionService['annualRiskTerms']>,
  ): ProjectionDriver[] {
    const effectiveAge = input.age ?? DEFAULT_COHORT_AGE;
    const compositeRisk0 = this.currentCompositeRisk(input.organScores);

    type RawDriver = Omit<ProjectionDriver, 'contribution_pct'> & { weight: number };
    const raw: RawDriver[] = [];

    // Terme âge (non modifiable).
    raw.push({
      code: 'age',
      label_fr: 'Âge biologique (sénescence)',
      weight: base.r_age,
      direction: 'aggravant',
      why_fr:
        input.age == null
          ? `Âge non renseigné : cohorte ${DEFAULT_COHORT_AGE} ans retenue par défaut.`
          : `À ${effectiveAge} ans, le rythme de vieillissement fonctionnel s'accélère naturellement.`,
      source: 'demographic',
      modifiable: false,
    });

    // Terme « état actuel » (dette de santé) — basé sur les organes scorés.
    if (base.r_state > 0) {
      raw.push({
        code: 'current_state',
        label_fr: 'État fonctionnel de départ',
        weight: base.r_state,
        direction: 'aggravant',
        why_fr: `Le risque fonctionnel actuel (${compositeRisk0}/100) crée une « dette de santé » qui accélère la dérive.`,
        source: 'organ_score',
        modifiable: true,
      });
    }

    // Termes mode de vie (modifiables, issus de la roue).
    for (const item of base.lifestyle) {
      raw.push({
        code: item.def.code,
        label_fr: item.def.label_fr,
        weight: item.raw,
        direction: 'aggravant',
        why_fr:
          item.severity === 'bad'
            ? item.def.why_fr
            : `${item.def.why_fr} (axe à surveiller, impact modéré).`,
        source: 'lifestyle',
        modifiable: true,
      });
    }

    const total = raw.reduce((a, d) => a + d.weight, 0);
    const drivers: ProjectionDriver[] = raw
      .map((d) => {
        const { weight, ...rest } = d;
        return {
          ...rest,
          contribution_pct: total > 0 ? round((weight / total) * 100) : 0,
        };
      })
      .sort((a, b) => b.contribution_pct - a.contribution_pct);

    return drivers;
  }

  // ── Étape 6 : confiance (explicite, jamais cachée) ─────────────────────
  confidence(input: ProjectionInput): ProjectionConfidence {
    const agePart = input.age != null ? 0.3 : 0;
    const filledAxes = input.wheel.filter(
      (w) => w.score != null && Number.isFinite(w.score),
    ).length;
    const wheelPart = 0.35 * Math.min(filledAxes / 12, 1);
    const organPart = 0.25 * Math.min(input.organScores.length / 8, 1);
    const bioPart = 0.1 * Math.min(input.biomarkerCount / 10, 1);
    const score = round(clamp(agePart + wheelPart + organPart + bioPart, 0, 1), 2);

    const level: ConfidenceLevel = score < 0.4 ? 'faible' : score < 0.7 ? 'moderee' : 'bonne';

    const reasons_fr: string[] = [];
    reasons_fr.push(
      input.age != null
        ? 'Âge renseigné'
        : 'Âge non renseigné → cohorte 45 ans (confiance réduite)',
    );
    reasons_fr.push(`${filledAxes}/12 axes de la roue remplis`);
    reasons_fr.push(`${input.organScores.length} organe(s) scoré(s)`);
    reasons_fr.push(
      input.biomarkerCount >= 10
        ? `${input.biomarkerCount} biomarqueurs disponibles`
        : `${input.biomarkerCount} biomarqueur(s) seulement → confiance réduite`,
    );

    return { level, score, reasons_fr };
  }

  // ── Assemblage final ───────────────────────────────────────────────────
  project(input: ProjectionInput): ProjectionResult {
    const organScores = Array.isArray(input.organScores) ? input.organScores : [];
    const safeInput: ProjectionInput = { ...input, organScores };

    const compositeRisk0 = this.currentCompositeRisk(organScores);
    const vitality0 = this.currentVitality(organScores);
    const base = this.annualRiskTerms(safeInput);

    // Scénarios demandés (status_quo forcé en tête, ordre stable).
    const requested = new Set(safeInput.scenarioKeys);
    requested.add('status_quo');
    const scenarios = SCENARIOS.filter((s) => requested.has(s.key));
    // status_quo doit être présent même si filtré (sécurité).
    if (!scenarios.some((s) => s.key === 'status_quo')) {
      const sq = SCENARIOS.find((s) => s.key === 'status_quo');
      if (sq) scenarios.unshift(sq);
    }

    // Pré-calcule r_eff par scénario.
    const scenarioRisk = new Map<
      string,
      ReturnType<TwinProjectionService['scenarioAnnualRisk']>
    >();
    for (const s of scenarios) {
      scenarioRisk.set(s.key, this.scenarioAnnualRisk(safeInput, base, s));
    }
    const statusQuoRisk = scenarioRisk.get('status_quo')!;

    // Risque actuel par dimension (pour systems_d).
    const dimRisk0: Record<ProjectionDimension, number> = {} as Record<
      ProjectionDimension,
      number
    >;
    for (const dim of PROJECTION_DIMENSIONS) {
      dimRisk0[dim] = clamp(100 - this.currentDimensionScore(organScores, dim), 0, 100);
    }

    // Horizons.
    const horizons: ProjectionHorizon[] = safeInput.horizonsYears.map((year) => {
      const ageAtHorizon = safeInput.age != null ? safeInput.age + year : null;
      const scenarioPoints: Record<string, ProjectionScenarioPoint> = {};

      for (const s of scenarios) {
        const sr = scenarioRisk.get(s.key)!;
        const projectedRisk = this.composeRisk(compositeRisk0, sr.r_eff, year);

        // Risque par sous-système : r pondéré par l'affinité dimension↔levier.
        const systems: ProjectionSystems = {} as ProjectionSystems;
        for (const dim of PROJECTION_DIMENSIONS) {
          const relief = sr.dimensionRelief[dim] ?? 0;
          // Plus l'affinité (relief) est forte, plus le r de cette dimension est réduit.
          const rDim = clamp(sr.r_eff * (1 - relief), R_MIN, R_MAX);
          systems[dim] = this.composeRisk(dimRisk0[dim], rDim, year);
        }

        scenarioPoints[s.key] = {
          composite_risk: projectedRisk,
          risk_delta_pct: this.riskDeltaPct(projectedRisk, compositeRisk0),
          vitality: round(clamp(100 - projectedRisk, 0, 100)),
          systems,
          band: this.band(projectedRisk),
        };
      }

      return { year, age_at_horizon: ageAtHorizon, scenarios: scenarioPoints };
    });

    // Espérance de vie / healthspan par scénario.
    const baselineLE = round(this.baselineLifeExpectancy(safeInput.sex), 1);
    const leScenarios: Record<string, ProjectionLifeExpectancyScenario> = {};
    // Risque composite @10 ans (status_quo sert de référence morbidité, mais on
    // calcule par scénario pour un healthspan cohérent).
    for (const s of scenarios) {
      const sr = scenarioRisk.get(s.key)!;
      const riskAt10 = this.composeRisk(compositeRisk0, sr.r_eff, 10);
      leScenarios[s.key] = this.lifeExpectancy(
        safeInput,
        base,
        sr,
        statusQuoRisk.r_lifestyle_eff,
        compositeRisk0,
        riskAt10,
      );
    }
    // delta_vs_status_quo (status_quo = 0).
    const statusQuoEstimate = leScenarios['status_quo']?.estimate_years ?? 0;
    for (const key of Object.keys(leScenarios)) {
      leScenarios[key].delta_vs_status_quo_years = round(
        leScenarios[key].estimate_years - statusQuoEstimate,
        1,
      );
    }

    // Drivers au horizon_focus (scénario status_quo).
    const drivers = this.buildDrivers(safeInput, base);

    // Confiance + complétude des données.
    const conf = this.confidence(safeInput);
    const filledAxes = safeInput.wheel.filter(
      (w) => w.score != null && Number.isFinite(w.score),
    ).length;
    const dataCompleteness = round(
      clamp(
        (Math.min(organScores.length / 8, 1) +
          Math.min(filledAxes / 12, 1) +
          Math.min(safeInput.biomarkerCount / 10, 1)) /
          3,
        0,
        1,
      ),
      2,
    );

    const assumptions_fr = [
      'Risque annualisé composé dans le temps (1 - r)^t ; pas de courbe actuarielle officielle.',
      'Seules les variables MODIFIABLES (mode de vie) influencent l\'espérance de vie ; l\'âge n\'est pas considéré comme réversible.',
      `Table d'espérance de vie de cohorte figée (FR : femme ${COHORT_LE.female} ans, homme ${COHORT_LE.male} ans, défaut ${COHORT_LE.fallback}).`,
      `Gain/perte d'espérance borné à ±${LE_GAIN_CAP_YEARS} ans pour rester crédible.`,
      ...(safeInput.age == null
        ? [`Âge absent : cohorte ${DEFAULT_COHORT_AGE} ans appliquée par défaut.`]
        : []),
    ];

    return {
      engine_version: PROJECTION_VERSION,
      inputs: {
        age: safeInput.age,
        sex:
          safeInput.sex === 'female' || safeInput.sex === 'male'
            ? safeInput.sex
            : null,
        baseline_life_expectancy: baselineLE,
        horizons_years: safeInput.horizonsYears,
        scenario_keys: scenarios.map((s) => s.key),
        horizon_focus: safeInput.horizonFocus,
      },
      current: {
        vitality: vitality0,
        composite_risk: compositeRisk0,
        data_completeness: dataCompleteness,
      },
      horizons,
      life_expectancy: { baseline: baselineLE, scenarios: leScenarios },
      drivers,
      confidence: conf,
      assumptions_fr,
      disclaimer: PROJECTION_DISCLAIMER,
    };
  }
}
