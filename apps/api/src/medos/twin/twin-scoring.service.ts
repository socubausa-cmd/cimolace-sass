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

const PENALTY_MILD = 12; // hors plage optimale mais dans la plage labo
const PENALTY_CRITICAL = 30; // hors plage labo (large)

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
   */
  detectAlerts(refs: BiomarkerRef[], values: BiomarkerValue[]): ClinicalAlert[] {
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

    return alerts;
  }
}
