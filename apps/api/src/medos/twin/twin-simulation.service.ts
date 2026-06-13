import { Injectable } from '@nestjs/common';
import {
  TwinScoringService,
  type BiomarkerRef,
  type BiomarkerValue,
  type OrganScore,
} from './twin-scoring.service';

/**
 * MEDOS v2 — Bio Digital Twin · Simulateur d'intervention (Module 23).
 *
 * DÉTERMINISTE et testable. Modélise l'impact estimé d'interventions
 * thérapeutiques en rapprochant les biomarqueurs ciblés de leur plage optimale,
 * puis en recalculant les scores d'organes via le moteur de scoring.
 *
 * Présenté comme SCÉNARIO PROBABILISTE, jamais comme promesse de résultat.
 */

export interface Intervention {
  key: string;
  label_fr: string;
  /** Facteur de rapprochement vers l'optimal (0..1) par dimension. */
  dimensions?: Partial<Record<string, number>>;
  /** Facteur par biomarqueur précis (prioritaire sur la dimension). */
  biomarkers?: Record<string, number>;
}

export const INTERVENTIONS: Intervention[] = [
  { key: 'sleep', label_fr: 'Optimisation du sommeil', dimensions: { hormones: 0.3, cellular_energy: 0.25 }, biomarkers: { CORTISOL_AM: 0.4 } },
  { key: 'antiinflammatory', label_fr: 'Protocole anti-inflammatoire', dimensions: { inflammation: 0.4 } },
  { key: 'glycemic', label_fr: 'Contrôle glycémique', dimensions: { metabolism: 0.35 }, biomarkers: { HOMA_IR: 0.5, HBA1C: 0.3, GLUCOSE: 0.3, TRIGLYCERIDES: 0.3 } },
  { key: 'gut_repair', label_fr: 'Réparation intestinale', dimensions: { inflammation: 0.25 }, biomarkers: { CRP_HS: 0.3 } },
  { key: 'detox_support', label_fr: 'Soutien de la détoxification', dimensions: { toxicity: 0.4 } },
  { key: 'micronutrients', label_fr: 'Recharge micronutritionnelle', dimensions: { cellular_energy: 0.4 }, biomarkers: { VIT_D: 0.6, B12: 0.4, FERRITIN: 0.3, MAGNESIUM: 0.5 } },
];

export interface SimulationResult {
  before: OrganScore[];
  after: OrganScore[];
  organ_deltas: Array<{ organ_code: string; before: number; after: number; delta: number }>;
  global_indices: { vitality: number; inflammation_load: number; metabolic_health: number };
}

@Injectable()
export class TwinSimulationService {
  constructor(private readonly scoring: TwinScoringService) {}

  private optimalMid(ref: BiomarkerRef): number | null {
    if (ref.optimal_low == null || ref.optimal_high == null) return null;
    return (ref.optimal_low + ref.optimal_high) / 2;
  }

  /** Applique les interventions aux valeurs (rapprochement vers l'optimal). */
  applyInterventions(
    refs: BiomarkerRef[],
    values: BiomarkerValue[],
    interventionKeys: string[],
  ): BiomarkerValue[] {
    const refByCode = new Map(refs.map((r) => [r.code, r]));
    const chosen = INTERVENTIONS.filter((i) => interventionKeys.includes(i.key));

    return values.map((v) => {
      const ref = refByCode.get(v.biomarker_code);
      const mid = ref ? this.optimalMid(ref) : null;
      if (!ref || mid == null) return v;

      // Facteur maximal applicable à ce biomarqueur (dimension ou ciblage direct).
      let factor = 0;
      for (const intv of chosen) {
        const direct = intv.biomarkers?.[ref.code];
        const dim = intv.dimensions?.[ref.dimension];
        factor = Math.max(factor, direct ?? 0, dim ?? 0);
      }
      if (factor <= 0) return v;

      // Rapprochement vers l'optimal : new = v + factor*(mid - v).
      const next = v.value + factor * (mid - v.value);
      return { biomarker_code: v.biomarker_code, value: Math.round(next * 100) / 100 };
    });
  }

  private globalIndices(scores: OrganScore[]): { vitality: number; inflammation_load: number; metabolic_health: number } {
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
    const dim = (d: string) =>
      avg(scores.map((s) => (s.dimensions as any)[d]).filter((x) => typeof x === 'number'));
    const vitality = avg(scores.map((s) => s.score));
    const inflammation_load = 100 - (dim('inflammation') || 100);
    const metabolic_health = dim('metabolism') || vitality;
    return { vitality, inflammation_load, metabolic_health };
  }

  simulate(
    organCodes: string[],
    refs: BiomarkerRef[],
    currentValues: BiomarkerValue[],
    interventionKeys: string[],
  ): SimulationResult {
    const before = this.scoring.computeAllOrganScores(organCodes, refs, currentValues);
    const adjusted = this.applyInterventions(refs, currentValues, interventionKeys);
    const after = this.scoring.computeAllOrganScores(organCodes, refs, adjusted);

    const afterByCode = new Map(after.map((s) => [s.organ_code, s]));
    const organ_deltas = before.map((b) => {
      const a = afterByCode.get(b.organ_code);
      const afterScore = a ? a.score : b.score;
      return { organ_code: b.organ_code, before: b.score, after: afterScore, delta: afterScore - b.score };
    });

    const gi0 = this.globalIndices(before);
    const gi1 = this.globalIndices(after);
    return {
      before,
      after,
      organ_deltas,
      global_indices: {
        vitality: gi1.vitality - gi0.vitality,
        inflammation_load: gi1.inflammation_load - gi0.inflammation_load,
        metabolic_health: gi1.metabolic_health - gi0.metabolic_health,
      },
    };
  }
}
