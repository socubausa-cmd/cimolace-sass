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

    return alerts;
  }
}
