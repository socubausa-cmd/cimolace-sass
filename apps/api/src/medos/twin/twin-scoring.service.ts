import { Injectable } from '@nestjs/common';

/**
 * MEDOS v2 — Bio Digital Twin · Moteur de scoring DÉTERMINISTE (engine v1).
 *
 * Fonctions PURES (aucun I/O, aucun LLM) → entièrement testables unitairement.
 * Transforme des valeurs de biomarqueurs en scores d'organes (0-100), couleurs,
 * sous-scores dimensionnels, et alertes cliniques rule-based.
 *
 * Principe clinique : un score reflète l'écart aux plages FONCTIONNELLES
 * optimales (plus strictes que les plages "labo"). Ce n'est PAS un diagnostic ;
 * c'est un indicateur d'aide à la décision avec niveau de confiance.
 */

export type Flag = 'low' | 'normal' | 'high' | 'critical';
export type OrganColor = 'green' | 'yellow' | 'orange' | 'red';
export type Dimension =
  | 'inflammation' | 'oxidative_stress' | 'metabolism'
  | 'hormones' | 'toxicity' | 'cellular_energy';

export interface BiomarkerRef {
  code: string;
  name_fr: string;
  category: string;
  dimension: string;
  unit: string;
  optimal_low: number | null;
  optimal_high: number | null;
  lab_low: number | null;
  lab_high: number | null;
  organs: string[];
  higher_is_worse: boolean;
  associated_symptoms?: string[];
}

export interface BiomarkerValue {
  biomarker_code: string;
  value: number;
}

export interface ContributingBiomarker {
  code: string;
  name_fr: string;
  value: number;
  flag: Flag;
  penalty: number;
  dimension: string;
}

export interface OrganScore {
  organ_code: string;
  score: number;
  color: OrganColor;
  dimensions: Partial<Record<Dimension, number>>;
  contributing_biomarkers: ContributingBiomarker[];
  confidence: number;
}

export interface ClinicalAlert {
  kind: string;
  severity: 'info' | 'warning' | 'critical';
  message_fr: string;
  evidence: Array<{ code: string; value: number; flag: Flag }>;
}

/**
 * Métriques de suivi (lifestyle) issues de med_health_entries, AGRÉGÉES côté
 * service avant d'être passées au moteur. Toutes optionnelles : une règle
 * d'alerte lifestyle ne se déclenche que si les champs qu'elle exige sont
 * présents (sinon elle est silencieuse — additif, jamais de faux positif).
 *
 * - latest_*   : dernière valeur saisie par le patient.
 * - avg_mood_recent / low_mood_streak : agrégats sur les N dernières entrées
 *   (pour détecter une tendance, pas un point isolé).
 */
export interface LifestyleSignals {
  latest_sleep_hours?: number | null;
  latest_energy_level?: number | null; // 1-10
  latest_mood_score?: number | null; // 1-10
  latest_exercise_minutes?: number | null;
  latest_water_liters?: number | null;
  latest_stress_score?: number | null; // 0-100 (axe roue) si disponible
  /** Nb de jours consécutifs (entrées récentes) avec humeur basse (<=4/10). */
  low_mood_streak?: number;
  /** Nb d'entrées prises en compte pour les agrégats (confiance). */
  sample_size?: number;
}

/**
 * Métrique unique de la roue de transformation (Module 2), bornée 0-100.
 * `source='health_entry'` distingue les axes dérivés du suivi patient des
 * axes saisis au questionnaire ('questionnaire').
 */
export interface WheelMetric {
  domain: string;
  score: number;
}

/**
 * Valeur de biomarqueur projetée depuis les CONSTANTES (vitals) d'une entrée
 * de suivi patient (RPM — Remote Patient Monitoring). `biomarker_code` doit
 * correspondre à un code de med_biomarker_refs (cf. mapVitalsToBiomarkers).
 * `measured_at` est l'entry_date de la saisie (date du relevé maison).
 */
export interface VitalBiomarker {
  biomarker_code: string;
  value: number;
  measured_at?: string;
}

const PENALTY_MILD = 12; // hors plage optimale mais dans la plage labo
const PENALTY_CRITICAL = 30; // hors plage labo (large)

/** Borne un nombre dans [0,100] et l'arrondit (helper pur, hors classe). */
function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

@Injectable()
export class TwinScoringService {
  /** Classe une valeur par rapport aux plages optimale/labo du biomarqueur. */
  computeFlag(ref: BiomarkerRef, value: number): Flag {
    const { optimal_low, optimal_high, lab_low, lab_high } = ref;
    if (lab_low != null && value < lab_low) return 'critical';
    if (lab_high != null && value > lab_high) return 'critical';
    if (optimal_low != null && value < optimal_low) return 'low';
    if (optimal_high != null && value > optimal_high) return 'high';
    return 'normal';
  }

  /** Pénalité (points retirés au score d'organe) pour un flag donné. */
  penaltyFor(flag: Flag): number {
    switch (flag) {
      case 'normal':
        return 0;
      case 'low':
      case 'high':
        return PENALTY_MILD;
      case 'critical':
        return PENALTY_CRITICAL;
    }
  }

  scoreColor(score: number): OrganColor {
    if (score >= 80) return 'green';
    if (score >= 60) return 'yellow';
    if (score >= 40) return 'orange';
    return 'red';
  }

  private clamp(n: number, lo = 0, hi = 100): number {
    return Math.max(lo, Math.min(hi, n));
  }

  /**
   * Calcule le score d'UN organe à partir des biomarqueurs qui le concernent.
   * Retourne null si aucune donnée (organe "inconnu", non scoré).
   */
  computeOrganScore(
    organCode: string,
    refs: BiomarkerRef[],
    values: BiomarkerValue[],
  ): OrganScore | null {
    const refByCode = new Map(refs.map((r) => [r.code, r]));
    const contributing: ContributingBiomarker[] = [];
    const dimPenalties: Partial<Record<string, number>> = {};
    let totalPenalty = 0;

    for (const v of values) {
      const ref = refByCode.get(v.biomarker_code);
      if (!ref || !ref.organs.includes(organCode)) continue;
      const flag = this.computeFlag(ref, v.value);
      const penalty = this.penaltyFor(flag);
      contributing.push({
        code: ref.code,
        name_fr: ref.name_fr,
        value: v.value,
        flag,
        penalty,
        dimension: ref.dimension,
      });
      totalPenalty += penalty;
      dimPenalties[ref.dimension] = (dimPenalties[ref.dimension] ?? 0) + penalty;
    }

    if (contributing.length === 0) return null;

    const score = Math.round(this.clamp(100 - totalPenalty));
    const dimensions: Partial<Record<Dimension, number>> = {};
    for (const [dim, pen] of Object.entries(dimPenalties)) {
      dimensions[dim as Dimension] = Math.round(this.clamp(100 - (pen ?? 0)));
    }

    // Confiance : croît avec le nombre de biomarqueurs disponibles (plafond 1).
    const confidence = this.clamp(contributing.length / 4, 0, 1);

    return {
      organ_code: organCode,
      score,
      color: this.scoreColor(score),
      dimensions,
      contributing_biomarkers: contributing.sort((a, b) => b.penalty - a.penalty),
      confidence: Math.round(confidence * 100) / 100,
    };
  }

  /** Calcule les scores de TOUS les organes ayant au moins une donnée. */
  computeAllOrganScores(
    organCodes: string[],
    refs: BiomarkerRef[],
    values: BiomarkerValue[],
  ): OrganScore[] {
    return organCodes
      .map((code) => this.computeOrganScore(code, refs, values))
      .filter((s): s is OrganScore => s !== null);
  }

  // ── Suivi patient → Roue de transformation (fermeture de boucle) ────────
  /**
   * Mappe UNE entrée de suivi (med_health_entries) vers des axes lifestyle de
   * la roue de transformation, bornés 0-100. DÉTERMINISTE et PUR (aucun I/O).
   *
   * Mapping (volontairement simple, défendable cliniquement comme INDICATEUR,
   * pas comme diagnostic) :
   *   - sleep_hours        → sleep              (optimum ~8 h ; pénalité linéaire
   *                                              de part et d'autre, plancher 0)
   *   - energy_level 1-10  → energy             (×10)
   *   - exercise_minutes   → physical_activity  (30 min/j ≈ 100, plafonné)
   *   - water_liters       → environment        (1.5 L/j ≈ 100, plafonné)
   *   - mood_score 1-10    → emotions           (×10)
   *   - symptoms (non vide) → inflammation       (présence de symptômes = signal
   *                                              d'inflammation/inconfort abaissé)
   *
   * Seuls les axes dont la métrique source est renseignée sont produits — une
   * entrée « humeur seule » ne fabrique pas un score de sommeil arbitraire.
   */
  mapHealthEntryToWheel(entry: {
    sleep_hours?: number | null;
    energy_level?: number | null;
    exercise_minutes?: number | null;
    water_liters?: number | null;
    mood_score?: number | null;
    symptoms?: unknown;
  }): WheelMetric[] {
    const out: WheelMetric[] = [];
    const num = (v: unknown): number | null =>
      v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v);

    const sleep = num(entry.sleep_hours);
    if (sleep != null) {
      // Optimum 8 h. On retire ~12.5 pts par heure d'écart (4 h d'écart → 50).
      const deviation = Math.abs(sleep - 8);
      out.push({ domain: 'sleep', score: clamp100(100 - deviation * 12.5) });
    }

    const energy = num(entry.energy_level);
    if (energy != null) out.push({ domain: 'energy', score: clamp100(energy * 10) });

    const exercise = num(entry.exercise_minutes);
    if (exercise != null) {
      // 30 min/j = 100. Au-delà, plafonné (pas de bonus). 0 min → 0.
      out.push({ domain: 'physical_activity', score: clamp100((exercise / 30) * 100) });
    }

    const water = num(entry.water_liters);
    if (water != null) {
      // 1.5 L/j = 100 (hydratation correcte), plafonné.
      out.push({ domain: 'environment', score: clamp100((water / 1.5) * 100) });
    }

    const mood = num(entry.mood_score);
    if (mood != null) out.push({ domain: 'emotions', score: clamp100(mood * 10) });

    // Symptômes déclarés → inflammation abaissée (signal d'inconfort).
    // 0 symptôme = 100 ; chaque symptôme retire 20 pts (plancher 0).
    const symptomCount = Array.isArray(entry.symptoms) ? entry.symptoms.length : 0;
    if (symptomCount > 0) {
      out.push({ domain: 'inflammation', score: clamp100(100 - symptomCount * 20) });
    }

    return out;
  }

  // ── Constantes maison (RPM) → Biomarqueurs cliniques ────────────────────
  /**
   * Projette les CONSTANTES (vitals) d'une entrée de suivi vers des codes de
   * biomarqueurs cliniques (RPM — Remote Patient Monitoring). DÉTERMINISTE et
   * PUR (aucun I/O). À la différence de mapHealthEntryToWheel (lifestyle → roue),
   * ce mapping alimente le niveau CLINIQUE : les valeurs renvoyées sont
   * insérées dans med_patient_biomarkers puis scorées/alertées par le moteur.
   *
   * Mapping (codes de med_biomarker_refs — le poids/temp/SpO2 supposent la
   * migration 20260628150000_medos_twin_rpm_vitals ; GLUCOSE préexiste) :
   *   - blood_glucose            → GLUCOSE       (mg/dL, glycémie)
   *   - blood_pressure_systolic  → BP_SYSTOLIC   (mmHg)
   *   - blood_pressure_diastolic → BP_DIASTOLIC  (mmHg)
   *   - heart_rate               → HEART_RATE    (bpm)
   *   - spo2                      → SPO2          (%) — si fourni (futur oxymètre)
   *   - temperature              → BODY_TEMP     (°C)
   *   - weight_kg                → WEIGHT        (kg)
   *
   * Seules les constantes RENSEIGNÉES (numériques finies, > 0 pour écarter les
   * 0 sentinelles d'appareils) produisent un biomarqueur. Un code dont la ref
   * n'existe pas en base sera filtré en aval par addBiomarkers (refByCode) —
   * donc additif et sûr même avant l'application de la migration.
   */
  mapVitalsToBiomarkers(
    entry: {
      blood_glucose?: number | null;
      blood_pressure_systolic?: number | null;
      blood_pressure_diastolic?: number | null;
      heart_rate?: number | null;
      spo2?: number | null;
      temperature?: number | null;
      weight_kg?: number | null;
    },
    measuredAt?: string,
  ): VitalBiomarker[] {
    const out: VitalBiomarker[] = [];
    // Valeur strictement positive et finie : écarte null/''/0 (0 = pas de
    // mesure pour une constante humaine ; aucune des constantes ici ne vaut 0).
    const pos = (v: unknown): number | null => {
      if (v == null || v === '') return null;
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : null;
    };
    const push = (code: string, v: unknown) => {
      const n = pos(v);
      if (n != null) out.push({ biomarker_code: code, value: n, measured_at: measuredAt });
    };

    push('GLUCOSE', entry.blood_glucose);
    push('BP_SYSTOLIC', entry.blood_pressure_systolic);
    push('BP_DIASTOLIC', entry.blood_pressure_diastolic);
    push('HEART_RATE', entry.heart_rate);
    push('SPO2', entry.spo2);
    push('BODY_TEMP', entry.temperature);
    push('WEIGHT', entry.weight_kg);

    return out;
  }

  /** Carte code → flag pour l'ensemble des valeurs (utilitaire alertes/UI). */
  flagMap(refs: BiomarkerRef[], values: BiomarkerValue[]): Record<string, Flag> {
    const refByCode = new Map(refs.map((r) => [r.code, r]));
    const out: Record<string, Flag> = {};
    for (const v of values) {
      const ref = refByCode.get(v.biomarker_code);
      if (ref) out[v.biomarker_code] = this.computeFlag(ref, v.value);
    }
    return out;
  }

  /**
   * Détection d'alertes cliniques RULE-BASED (Module 14).
   * Patterns reconnus : syndrome métabolique, inflammation chronique,
   * carences, risque métabolique. Présentés comme signaux, jamais diagnostics.
   *
   * `lifestyle` (optionnel) : quand des métriques de suivi patient sont
   * fournies, des règles d'hygiène de vie DÉTERMINISTES s'AJOUTENT aux règles
   * biomarqueurs. Sans `lifestyle`, le comportement est strictement inchangé
   * (rétro-compatibilité — aucun faux positif quand le suivi est vide).
   */
  detectAlerts(
    refs: BiomarkerRef[],
    values: BiomarkerValue[],
    lifestyle?: LifestyleSignals,
  ): ClinicalAlert[] {
    const flags = this.flagMap(refs, values);
    const valByCode = new Map(values.map((v) => [v.biomarker_code, v.value]));
    const alerts: ClinicalAlert[] = [];
    const ev = (code: string): { code: string; value: number; flag: Flag } => ({
      code,
      value: valByCode.get(code) ?? 0,
      flag: flags[code] ?? 'normal',
    });
    const high = (c: string) => flags[c] === 'high' || flags[c] === 'critical';
    const low = (c: string) => flags[c] === 'low' || flags[c] === 'critical';

    // Syndrome métabolique : insulino-résistance + dyslipidémie
    if (
      [high('HOMA_IR'), high('TRIGLYCERIDES'), low('HDL'), high('HBA1C')].filter(
        Boolean,
      ).length >= 2
    ) {
      alerts.push({
        kind: 'metabolic_syndrome',
        severity: 'warning',
        message_fr:
          `Faisceau évocateur d'un syndrome métabolique (résistance insulinique + dyslipidémie). À explorer cliniquement.`,
        evidence: ['HOMA_IR', 'TRIGLYCERIDES', 'HDL', 'HBA1C']
          .filter((c) => valByCode.has(c))
          .map(ev),
      });
    }

    // Inflammation chronique
    if (high('CRP_HS') && (high('FERRITIN') || high('ESR'))) {
      alerts.push({
        kind: 'chronic_inflammation',
        severity: 'warning',
        message_fr:
          `Signaux d'inflammation systémique (CRP + ferritine/VS). Rechercher la source inflammatoire.`,
        evidence: ['CRP_HS', 'FERRITIN', 'ESR'].filter((c) => valByCode.has(c)).map(ev),
      });
    }

    // Carences fréquentes
    const deficits = ['VIT_D', 'B12', 'FERRITIN', 'MAGNESIUM'].filter((c) => low(c));
    if (deficits.length > 0) {
      alerts.push({
        kind: 'deficiency',
        severity: deficits.length >= 2 ? 'warning' : 'info',
        message_fr: `Carence(s) possible(s) : ${deficits.join(', ')}. À corréler aux symptômes.`,
        evidence: deficits.map(ev),
      });
    }

    // Risque métabolique précoce
    if (high('TG_HDL') || (high('GLUCOSE') && !high('HBA1C'))) {
      alerts.push({
        kind: 'metabolic_risk',
        severity: 'info',
        message_fr:
          'Indice de risque métabolique précoce (ratio TG/HDL ou glycémie). Surveillance recommandée.',
        evidence: ['TG_HDL', 'GLUCOSE'].filter((c) => valByCode.has(c)).map(ev),
      });
    }

    // ─── Patterns étendus (référentiel v2 — 144 codes additionnels) ─────────

    // Risque cardiaque (NT-proBNP / BNP / troponine HS hauts)
    const cardiacSignals = ['NT_PROBNP', 'BNP', 'TROPONIN_HS'].filter((c) => high(c));
    if (cardiacSignals.length >= 1) {
      const isCritical = cardiacSignals.some(
        (c) => flags[c] === 'critical',
      );
      alerts.push({
        kind: 'cardiac_risk',
        severity: isCritical ? 'critical' : 'warning',
        message_fr: `Signal cardiaque (${cardiacSignals.join(', ')}). Évaluation cardiologique recommandée.`,
        evidence: cardiacSignals.map(ev),
      });
    }

    // Blocage méthylation : HOMOCYSTEINE haute + (MMA haut OU B9/B12 bas)
    if (
      high('HOMOCYSTEINE') &&
      (high('MMA') || low('VIT_B9_FOLATE') || low('FOLATE_RBC') || low('B12') || low('HOLOTC'))
    ) {
      alerts.push({
        kind: 'methylation_block',
        severity: 'warning',
        message_fr:
          'Faisceau évocateur d\'un blocage du cycle de méthylation (homocystéine ± MMA, déficit B9/B12). À explorer avec un test génétique MTHFR.',
        evidence: ['HOMOCYSTEINE', 'MMA', 'VIT_B9_FOLATE', 'FOLATE_RBC', 'B12', 'HOLOTC']
          .filter((c) => valByCode.has(c))
          .map(ev),
      });
    }

    // Hyperperméabilité intestinale (leaky gut) : zonuline + calprotectine
    if (
      (high('ZONULIN') && high('CALPROTECTIN')) ||
      high('LACTOFERRIN') ||
      low('SECRETORY_IGA')
    ) {
      alerts.push({
        kind: 'gut_permeability',
        severity: 'warning',
        message_fr:
          'Signaux d\'hyperperméabilité intestinale / dysbiose (zonuline, calprotectine, lactoferrine, sIgA). Investiguer la barrière intestinale.',
        evidence: ['ZONULIN', 'CALPROTECTIN', 'LACTOFERRIN', 'SECRETORY_IGA']
          .filter((c) => valByCode.has(c))
          .map(ev),
      });
    }

    // Stress oxydatif élevé : marqueurs hauts + défenses basses
    const oxidativeHigh = ['MDA', 'F2_ISOPROSTANES', 'OHDG_8', 'TBARS', 'ROS', 'OXYLDL']
      .filter((c) => high(c));
    const antioxidantLow = ['GSH', 'GPX', 'SOD', 'CATALASE', 'TAC'].filter((c) => low(c));
    if (oxidativeHigh.length >= 1 && antioxidantLow.length >= 1) {
      alerts.push({
        kind: 'oxidative_stress_high',
        severity: 'warning',
        message_fr: `Stress oxydatif marqué (${oxidativeHigh.length} marqueur(s) d'attaque + ${antioxidantLow.length} défense(s) abaissée(s)). Soutien antioxydant à considérer.`,
        evidence: [...oxidativeHigh, ...antioxidantLow].map(ev),
      });
    }

    // Auto-immunité thyroïdienne (Hashimoto / Basedow)
    if (high('ANTI_TPO') || high('ANTI_TG')) {
      const tshAbnormal = high('TSH') || low('TSH');
      const severity: 'info' | 'warning' | 'critical' =
        flags['ANTI_TPO'] === 'critical' || flags['ANTI_TG'] === 'critical'
          ? 'critical'
          : tshAbnormal
          ? 'warning'
          : 'info';
      alerts.push({
        kind: 'thyroid_autoimmune',
        severity,
        message_fr:
          'Anticorps thyroïdiens positifs (TPO/TG). Évoque une thyroïdite auto-immune (Hashimoto si TSH↑, Basedow si TSH↓). À confirmer en consultation endocrinologique.',
        evidence: ['ANTI_TPO', 'ANTI_TG', 'TSH', 'FT4', 'FT3']
          .filter((c) => valByCode.has(c))
          .map(ev),
      });
    }

    // Dysrégulation du cortisol (pattern inversé ou aplati)
    const cortisolAM = valByCode.get('CORTISOL_AM') ?? null;
    const cortisolPM = valByCode.get('CORTISOL_PM') ?? null;
    if (cortisolAM !== null && cortisolPM !== null) {
      // Pattern inversé : PM proche ou supérieur à AM (devrait être bien inférieur)
      const ratio = cortisolPM / cortisolAM;
      if (ratio > 0.6 || low('CORTISOL_AM') || high('CORTISOL_PM')) {
        alerts.push({
          kind: 'cortisol_dysregulation',
          severity: ratio > 0.8 ? 'warning' : 'info',
          message_fr: `Pattern de cortisol atypique (rapport PM/AM = ${ratio.toFixed(2)}, attendu < 0.5). Évoque une fatigue surrénalienne ou un stress chronique.`,
          evidence: ['CORTISOL_AM', 'CORTISOL_PM', 'ACTH', 'DHEA_S']
            .filter((c) => valByCode.has(c))
            .map(ev),
        });
      }
    }

    // Résistance insulinique avancée : HOMA-IR + adipocytokines
    if (
      high('HOMA_IR') &&
      (high('LEPTIN') || high('C_PEPTIDE') || low('ADIPONECTIN') || high('FRUCTOSAMINE'))
    ) {
      alerts.push({
        kind: 'insulin_resistance_advanced',
        severity: 'warning',
        message_fr:
          'Résistance insulinique avec déséquilibre adipocytokines (leptine ↑, adiponectine ↓ ou C-peptide ↑). Profil métabolique avancé à corriger.',
        evidence: ['HOMA_IR', 'LEPTIN', 'C_PEPTIDE', 'ADIPONECTIN', 'FRUCTOSAMINE']
          .filter((c) => valByCode.has(c))
          .map(ev),
      });
    }

    // Déséquilibre électrolytique (potentiellement critique pour le cœur)
    const electrolytesAbnormal = ['SODIUM', 'POTASSIUM', 'CALCIUM', 'MAGNESIUM', 'PHOSPHORUS', 'BICARBONATE']
      .filter((c) => high(c) || low(c));
    if (electrolytesAbnormal.length >= 2) {
      const isCritical = electrolytesAbnormal.some(
        (c) => flags[c] === 'critical',
      );
      alerts.push({
        kind: 'electrolyte_imbalance',
        severity: isCritical ? 'critical' : 'warning',
        message_fr: `Déséquilibre électrolytique sur ${electrolytesAbnormal.length} marqueur(s) (${electrolytesAbnormal.join(', ')}). Vigilance cardiaque/rénale.`,
        evidence: electrolytesAbnormal.map(ev),
      });
    }

    // Atteinte hépatique multifactorielle (NAFLD probable)
    const liverHigh = ['ALT', 'AST', 'GGT', 'ALP', 'BILIRUBIN_TOTAL'].filter((c) => high(c));
    if (liverHigh.length >= 2) {
      alerts.push({
        kind: 'liver_strain',
        severity: liverHigh.length >= 3 ? 'warning' : 'info',
        message_fr: `Atteinte hépatique multiple (${liverHigh.join(', ')} ↑). Évoquer NAFLD, hépatite ou surcharge toxique selon contexte.`,
        evidence: liverHigh.map(ev),
      });
    }

    // ─── Constantes maison (RPM — tensiomètre/oxymètre/glucomètre) ──────────
    // Alertes CLINIQUES déterministes sur les vitals saisis par le patient.
    // Ne se déclenchent que si le code correspondant est présent (additif,
    // jamais de faux positif). Sévérité 'critical' quand la valeur sort de la
    // plage labo (flag 'critical'), 'warning' sinon.
    // L'hypertension lit la VALEUR (pas seulement le flag) : un seuil de crise
    // (≥180/≥110) reste critique même si la borne labo est plus permissive.
    const sys = valByCode.get('BP_SYSTOLIC');
    const dia = valByCode.get('BP_DIASTOLIC');
    if ((sys != null && high('BP_SYSTOLIC')) || (dia != null && high('BP_DIASTOLIC'))) {
      const crisis = (sys ?? 0) >= 180 || (dia ?? 0) >= 110;
      const labCritical =
        flags['BP_SYSTOLIC'] === 'critical' || flags['BP_DIASTOLIC'] === 'critical';
      alerts.push({
        kind: 'hypertension',
        severity: crisis || labCritical ? 'critical' : 'warning',
        message_fr: crisis
          ? `Tension artérielle très élevée (${sys ?? '?'}/${dia ?? '?'} mmHg). Seuil de crise hypertensive — contactez sans tarder votre praticien ou les urgences.`
          : `Tension artérielle au-dessus de la cible (${sys ?? '?'}/${dia ?? '?'} mmHg). À recontrôler au calme et à signaler à votre praticien.`,
        evidence: ['BP_SYSTOLIC', 'BP_DIASTOLIC'].filter((c) => valByCode.has(c)).map(ev),
      });
    }

    // Hypotension marquée (systolique très basse) — sortie de plage labo basse.
    if (sys != null && low('BP_SYSTOLIC')) {
      alerts.push({
        kind: 'hypotension',
        severity: flags['BP_SYSTOLIC'] === 'critical' ? 'warning' : 'info',
        message_fr: `Tension artérielle basse (${sys} mmHg de systolique). Si vertiges ou malaises, asseyez-vous, hydratez-vous et parlez-en à votre praticien.`,
        evidence: ['BP_SYSTOLIC', 'BP_DIASTOLIC'].filter((c) => valByCode.has(c)).map(ev),
      });
    }

    // Fréquence cardiaque au repos anormale (tachycardie / bradycardie).
    const hr = valByCode.get('HEART_RATE');
    if (hr != null && (high('HEART_RATE') || low('HEART_RATE'))) {
      const tachy = high('HEART_RATE');
      alerts.push({
        kind: tachy ? 'tachycardia' : 'bradycardia',
        severity: flags['HEART_RATE'] === 'critical' ? 'warning' : 'info',
        message_fr: tachy
          ? `Fréquence cardiaque au repos élevée (${hr} bpm). Au repos et hors effort/stress, à surveiller ; consultez si palpitations ou malaise.`
          : `Fréquence cardiaque au repos basse (${hr} bpm). Souvent bénin chez les sportifs ; consultez en cas de fatigue, vertiges ou malaise.`,
        evidence: [ev('HEART_RATE')],
      });
    }

    // Hypoxémie (SpO2 basse à l'oxymètre) — signal respiratoire potentiellement grave.
    const spo2 = valByCode.get('SPO2');
    if (spo2 != null && low('SPO2')) {
      const severe = spo2 < 92 || flags['SPO2'] === 'critical';
      alerts.push({
        kind: 'hypoxemia',
        severity: severe ? 'critical' : 'warning',
        message_fr: severe
          ? `Saturation en oxygène basse (SpO2 ${spo2} %). En cas d'essoufflement, appelez le 15/112 ; sinon recontrôlez et contactez votre praticien.`
          : `Saturation en oxygène un peu basse (SpO2 ${spo2} %). Recontrôlez au repos, doigt réchauffé, et signalez-le à votre praticien.`,
        evidence: [ev('SPO2')],
      });
    }

    // Fièvre (température corporelle élevée) — signal inflammatoire/infectieux aigu.
    const temp = valByCode.get('BODY_TEMP');
    if (temp != null && high('BODY_TEMP')) {
      const highFever = temp >= 39 || flags['BODY_TEMP'] === 'critical';
      alerts.push({
        kind: 'fever',
        severity: highFever ? 'warning' : 'info',
        message_fr: highFever
          ? `Fièvre élevée (${temp} °C). Hydratez-vous et surveillez ; consultez si elle persiste ou s'accompagne de signes de gravité.`
          : `Température au-dessus de la normale (${temp} °C). Reposez-vous, hydratez-vous et recontrôlez ; consultez si cela dure.`,
        evidence: [ev('BODY_TEMP')],
      });
    }

    // ─── Règles HYGIÈNE DE VIE (suivi patient → jumeau) ─────────────────────
    // Déterministes, additives, sans biomarqueur requis. `evidence` reste []
    // (le contrat ClinicalAlert vise des codes biomarqueurs ; le suivi n'en a
    // pas). Ne se déclenchent que si les métriques nécessaires sont présentes.
    if (lifestyle) {
      const ls = lifestyle;
      const sleep = ls.latest_sleep_hours;
      const stress = ls.latest_stress_score; // 0-100, plus BAS = plus stressé
      const water = ls.latest_water_liters;
      const exercise = ls.latest_exercise_minutes;
      const energy = ls.latest_energy_level;

      // 1) Fatigue chronique probable : sommeil court ET stress élevé.
      //    (stress_score bas = stress élevé sur l'axe roue ; seuil < 40)
      if (sleep != null && sleep < 6 && stress != null && stress < 40) {
        alerts.push({
          kind: 'lifestyle_chronic_fatigue',
          severity: 'warning',
          message_fr:
            'Sommeil insuffisant (< 6 h) associé à un niveau de stress élevé. ' +
            'Ce cumul favorise la fatigue chronique. Prioriser le repos et la ' +
            'gestion du stress ; en parler à votre praticien si cela persiste.',
          evidence: [],
        });
      }

      // 2) Fatigue/sous-récupération : sommeil court ET énergie basse
      //    (filet quand le stress n'est pas renseigné — n'entre pas en conflit).
      else if (sleep != null && sleep < 6 && energy != null && energy <= 4) {
        alerts.push({
          kind: 'lifestyle_low_recovery',
          severity: 'info',
          message_fr:
            'Sommeil court (< 6 h) et énergie ressentie basse. Votre récupération ' +
            'semble insuffisante : visez des nuits plus longues et régulières.',
          evidence: [],
        });
      }

      // 3) Risque de déshydratation : hydratation faible ET activité soutenue.
      if (water != null && water < 1 && exercise != null && exercise >= 45) {
        alerts.push({
          kind: 'lifestyle_dehydration_risk',
          severity: 'info',
          message_fr:
            'Hydratation faible (< 1 L) avec une activité physique soutenue ' +
            '(≥ 45 min). Pensez à boire davantage, surtout autour de l\'effort.',
          evidence: [],
        });
      }

      // 4) Mal-être persistant : humeur basse sur plusieurs jours consécutifs.
      if ((ls.low_mood_streak ?? 0) >= 3) {
        alerts.push({
          kind: 'lifestyle_persistent_low_mood',
          severity: 'warning',
          message_fr:
            `Humeur basse rapportée plusieurs jours de suite ` +
            `(${ls.low_mood_streak} jours). Si ce ressenti dure, n'attendez pas ` +
            'pour en parler à votre praticien ; un soutien est possible.',
          evidence: [],
        });
      }
    }

    return alerts;
  }
}
