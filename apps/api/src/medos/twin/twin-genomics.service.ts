import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';

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

export type SnpInterpretation = {
  snp_code: string;
  gene: string;
  genotype: string;
  risk_level: 'wild' | 'hetero' | 'homo_risk' | 'unknown';
  interpretation_fr: string;
  interventions_fr: string[];
};

export type SnpInputItem = { snp_code: string; genotype: string };

/**
 * MEDOS v2 — Bio Digital Twin · Multi-omics génomique (Chantier 2).
 *
 * Couche métier pour la dimension génomique du Twin :
 *  - lecture du référentiel SNP (~25 variants actionnables seedés)
 *  - saisie et lecture des génotypes patient (tenant-scoped, RLS staff)
 *  - interprétation déterministe genotype → risk_level + interventions FR
 *
 * Le système ne pose JAMAIS de diagnostic génétique. Les interprétations
 * sont indicatives (médecine fonctionnelle) et destinées à éclairer le
 * thérapeute, qui reste seul décideur.
 */
@Injectable()
export class TwinGenomicsService {
  private readonly logger = new Logger(TwinGenomicsService.name);
  private refCache: SnpRef[] | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  private get db(): any {
    return this.supabase.client as any;
  }

  /** Garde tenant/patient — réutilise la même règle que TwinService. */
  private async assertPatient(
    tenant: TenantContext,
    patientId: string,
  ): Promise<void> {
    const { data } = await this.db
      .from('med_patients')
      .select('id')
      .eq('id', patientId)
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    if (!data) throw new NotFoundException('Patient introuvable pour ce tenant');
  }

  // ── Référentiel SNP global ────────────────────────────────────────────
  async listSnpReferential(): Promise<SnpRef[]> {
    if (this.refCache) return this.refCache;
    const { data, error } = await this.db
      .from('med_snp_refs')
      .select('*')
      .order('gene', { ascending: true });
    if (error) {
      this.logger.error('listSnpReferential failed', error);
      return [];
    }
    this.refCache = (data ?? []) as SnpRef[];
    return this.refCache;
  }

  // ── Génotypes patient ─────────────────────────────────────────────────
  async listPatientSnps(
    tenant: TenantContext,
    patientId: string,
  ): Promise<PatientSnp[]> {
    await this.assertPatient(tenant, patientId);
    const { data } = await this.db
      .from('med_patient_snps')
      .select('id,snp_code,genotype,gene,recorded_at,source')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('recorded_at', { ascending: false });
    return (data ?? []) as PatientSnp[];
  }

  async addPatientSnps(
    tenant: TenantContext,
    _userId: string,
    patientId: string,
    snps: SnpInputItem[],
  ): Promise<{ inserted: number; rows: PatientSnp[] }> {
    await this.assertPatient(tenant, patientId);
    if (!Array.isArray(snps) || snps.length === 0) {
      throw new BadRequestException('Aucun SNP fourni.');
    }
    const refs = await this.listSnpReferential();
    const refByCode = new Map(refs.map((r) => [r.snp_code, r]));

    const today = new Date().toISOString().slice(0, 10);
    const rows = snps
      .filter((s) => s && typeof s.snp_code === 'string' && typeof s.genotype === 'string')
      .map((s) => {
        const ref = refByCode.get(s.snp_code);
        return {
          tenant_id: tenant.id,
          patient_id: patientId,
          snp_code: s.snp_code,
          genotype: s.genotype.toUpperCase().trim(),
          gene: ref?.gene ?? null,
          recorded_at: today,
          source: 'manual',
        };
      });

    if (rows.length === 0) {
      throw new BadRequestException('Entrées SNP invalides.');
    }

    const { data, error } = await this.db
      .from('med_patient_snps')
      .insert(rows)
      .select('id,snp_code,genotype,gene,recorded_at,source');
    if (error) {
      this.logger.error('addPatientSnps insert failed', error);
      throw new BadRequestException(error.message);
    }
    return { inserted: data?.length ?? 0, rows: (data ?? []) as PatientSnp[] };
  }

  // ── Interprétation déterministe ───────────────────────────────────────
  /**
   * Classifie chaque génotype patient face au référentiel :
   *   - wild        : génotype = wild_genotype (allèle sauvage homo)
   *   - hetero      : un seul allèle à risque
   *   - homo_risk   : génotype dans risk_genotypes (forme la plus marquée)
   *   - unknown     : SNP inconnu du référentiel ou génotype non interprétable
   */
  async interpretSnps(
    tenant: TenantContext,
    patientId: string,
  ): Promise<{
    patient_id: string;
    interpretations: SnpInterpretation[];
  }> {
    await this.assertPatient(tenant, patientId);
    const [refs, patientSnps] = await Promise.all([
      this.listSnpReferential(),
      this.listPatientSnps(tenant, patientId),
    ]);
    const refByCode = new Map(refs.map((r) => [r.snp_code, r]));

    // Déduplication : garde le génotype le plus récent par snp_code.
    const latestByCode = new Map<string, PatientSnp>();
    for (const s of patientSnps) {
      if (!latestByCode.has(s.snp_code)) latestByCode.set(s.snp_code, s);
    }

    const interpretations: SnpInterpretation[] = [];
    for (const snp of latestByCode.values()) {
      const ref = refByCode.get(snp.snp_code);
      if (!ref) {
        interpretations.push({
          snp_code: snp.snp_code,
          gene: snp.gene ?? 'unknown',
          genotype: snp.genotype,
          risk_level: 'unknown',
          interpretation_fr: 'SNP non référencé.',
          interventions_fr: [],
        });
        continue;
      }
      const risk = this.classifyGenotype(snp.genotype, ref);
      interpretations.push({
        snp_code: ref.snp_code,
        gene: ref.gene,
        genotype: snp.genotype,
        risk_level: risk,
        interpretation_fr: this.buildInterpretation(risk, ref),
        interventions_fr: risk === 'wild' ? [] : ref.interventions_fr,
      });
    }

    return { patient_id: patientId, interpretations };
  }

  private classifyGenotype(
    genotype: string,
    ref: SnpRef,
  ): 'wild' | 'hetero' | 'homo_risk' | 'unknown' {
    const g = (genotype || '').toUpperCase().trim();
    if (!g) return 'unknown';
    const risk = (ref.risk_genotypes || []).map((x) => x.toUpperCase());
    const wild = (ref.wild_genotype || '').toUpperCase();

    if (risk.includes(g)) {
      // Homozygote à risque si les deux allèles sont identiques (et != wild).
      if (g.length === 2 && g[0] === g[1] && g !== wild) return 'homo_risk';
      // Hétérozygote sinon (deux allèles différents).
      if (g.length === 2 && g[0] !== g[1]) return 'hetero';
      // Cas DEL/DEL ou notations non binaires : risque homozygote par défaut.
      return 'homo_risk';
    }
    if (wild && g === wild) return 'wild';
    return 'unknown';
  }

  private buildInterpretation(
    risk: 'wild' | 'hetero' | 'homo_risk' | 'unknown',
    ref: SnpRef,
  ): string {
    const base = ref.impact_fr ?? '';
    switch (risk) {
      case 'wild':
        return `Génotype sauvage (${ref.wild_genotype}) — pas d'impact attendu pour ${ref.gene}.`;
      case 'hetero':
        return `Hétérozygote pour ${ref.gene}. Impact modéré : ${base}`;
      case 'homo_risk':
        return `Homozygote à risque pour ${ref.gene}. Impact marqué : ${base}`;
      case 'unknown':
      default:
        return `Génotype non interprétable pour ${ref.gene} (saisie à vérifier).`;
    }
  }
}
