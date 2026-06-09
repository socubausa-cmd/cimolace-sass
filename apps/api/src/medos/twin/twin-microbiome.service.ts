import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';

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

export type MicrobiomeInputItem = {
  taxon_code: string;
  relative_abundance: number;
  sample_date?: string;
  lab_name?: string;
};

export type DysbiosisColor = 'green' | 'yellow' | 'orange' | 'red';

export type DysbiosisAssessment = {
  patient_id: string;
  sample_date: string | null;
  dysbiosis_score: number; // 0 (optimal) → 100 (severe)
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

/**
 * MEDOS v2 — Bio Digital Twin · Multi-omics microbiome (P3 Chantier 1).
 *
 * Couche métier pour la dimension microbiome du Twin :
 *  - lecture du référentiel taxons (~30 entrées seedées : phyla, genres,
 *    espèces, ratios, scores synthétiques)
 *  - saisie et lecture des mesures d'abondance patient (tenant-scoped,
 *    RLS staff)
 *  - évaluation déterministe de la dysbiose (score 0-100, couleur, key
 *    findings, recommandations FR)
 *
 * Le système ne pose JAMAIS de diagnostic microbiologique. Les seuils
 * sont indicatifs (littérature récente, adultes occidentaux) et destinés
 * à éclairer le thérapeute.
 */
@Injectable()
export class TwinMicrobiomeService {
  private readonly logger = new Logger(TwinMicrobiomeService.name);
  private refCache: MicrobiomeRef[] | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  private get db(): any {
    return this.supabase.client as any;
  }

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

  // ── Référentiel global (cache mémoire) ────────────────────────────────
  async listMicrobiomeRefs(): Promise<MicrobiomeRef[]> {
    if (this.refCache) return this.refCache;
    const { data, error } = await this.db
      .from('med_microbiome_refs')
      .select('*')
      .order('taxon_level', { ascending: true })
      .order('taxon_code', { ascending: true });
    if (error) {
      this.logger.error('listMicrobiomeRefs failed', error);
      return [];
    }
    this.refCache = (data ?? []) as MicrobiomeRef[];
    return this.refCache;
  }

  // ── Mesures patient ───────────────────────────────────────────────────
  async listPatientMicrobiome(
    tenant: TenantContext,
    patientId: string,
  ): Promise<PatientMicrobiome[]> {
    await this.assertPatient(tenant, patientId);
    const { data } = await this.db
      .from('med_patient_microbiome')
      .select('id,taxon_code,relative_abundance,sample_date,lab_name,source')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('sample_date', { ascending: false })
      .order('created_at', { ascending: false });
    return (data ?? []) as PatientMicrobiome[];
  }

  async addPatientMicrobiome(
    tenant: TenantContext,
    _userId: string,
    patientId: string,
    taxa: MicrobiomeInputItem[],
  ): Promise<{ inserted: number; rows: PatientMicrobiome[] }> {
    await this.assertPatient(tenant, patientId);
    if (!Array.isArray(taxa) || taxa.length === 0) {
      throw new BadRequestException('Aucune mesure microbiome fournie.');
    }
    const today = new Date().toISOString().slice(0, 10);
    const rows = taxa
      .filter(
        (t) =>
          t &&
          typeof t.taxon_code === 'string' &&
          typeof t.relative_abundance === 'number' &&
          Number.isFinite(t.relative_abundance),
      )
      .map((t) => ({
        tenant_id: tenant.id,
        patient_id: patientId,
        taxon_code: t.taxon_code.trim(),
        relative_abundance: t.relative_abundance,
        sample_date: t.sample_date || today,
        lab_name: t.lab_name ?? null,
        source: 'manual' as const,
      }));

    if (rows.length === 0) {
      throw new BadRequestException('Entrées microbiome invalides.');
    }

    const { data, error } = await this.db
      .from('med_patient_microbiome')
      .insert(rows)
      .select('id,taxon_code,relative_abundance,sample_date,lab_name,source');
    if (error) {
      this.logger.error('addPatientMicrobiome insert failed', error);
      throw new BadRequestException(error.message);
    }
    return { inserted: data?.length ?? 0, rows: (data ?? []) as PatientMicrobiome[] };
  }

  // ── Évaluation déterministe de la dysbiose ────────────────────────────
  /**
   * Calcule un score global de dysbiose (0 optimal → 100 sévère) à partir
   * des dernières mesures patient.
   *
   * Métriques agrégées :
   *   - Ratio Firmicutes/Bacteroidetes (calculé si manquant, à partir des
   *     phyla individuels mesurés)
   *   - Diversité alpha (Shannon)
   *   - Score producteurs de butyrate (somme Faecalibacterium + Roseburia
   *     + Eubacterium rectale + Butyricicoccus si non fourni)
   *   - Charge LPS (depuis le score fourni OU Proteobacteria si absent)
   *
   * Pour chaque métrique, déviation par rapport aux bornes optimales du
   * référentiel → points (0-25). Total ramené sur 100.
   */
  async assessDysbiosis(
    tenant: TenantContext,
    patientId: string,
  ): Promise<DysbiosisAssessment> {
    await this.assertPatient(tenant, patientId);
    const [refs, measurements] = await Promise.all([
      this.listMicrobiomeRefs(),
      this.listPatientMicrobiome(tenant, patientId),
    ]);

    const refByCode = new Map(refs.map((r) => [r.taxon_code, r]));

    // Dernière mesure par taxon (la liste est déjà triée desc).
    const latestByCode = new Map<string, PatientMicrobiome>();
    let mostRecent: string | null = null;
    for (const m of measurements) {
      if (!latestByCode.has(m.taxon_code)) latestByCode.set(m.taxon_code, m);
      if (!mostRecent || m.sample_date > mostRecent) mostRecent = m.sample_date;
    }
    const val = (code: string): number | null => {
      const m = latestByCode.get(code);
      return m ? Number(m.relative_abundance) : null;
    };

    // ── Métriques agrégées ───────────────────────────────────────────────
    let firmBact = val('FIRMICUTES_BACTEROIDETES_RATIO');
    if (firmBact == null) {
      const f = val('FIRMICUTES');
      const b = val('BACTEROIDETES');
      if (f != null && b != null && b > 0) firmBact = f / b;
    }

    const alpha = val('ALPHA_DIVERSITY_SHANNON');

    let butyrate = val('BUTYRATE_PRODUCERS_SCORE');
    if (butyrate == null) {
      const parts = [
        val('FAECALIBACTERIUM_PRAUSNITZII'),
        val('ROSEBURIA'),
        val('EUBACTERIUM_RECTALE'),
        val('BUTYRICICOCCUS'),
      ].filter((x): x is number => x != null);
      if (parts.length > 0) butyrate = parts.reduce((a, b) => a + b, 0);
    }

    let lps = val('LPS_LOAD_SCORE');
    if (lps == null) {
      const proteo = val('PROTEOBACTERIA');
      // Approximation grossière : 1 point LPS par % de Proteobacteria.
      if (proteo != null) lps = proteo;
    }

    // ── Points de pénalité par métrique (0-25 chacun) ────────────────────
    const findings: string[] = [];
    const recommendations: string[] = [];
    let penalty = 0;
    let metricsUsed = 0;

    const ratioRef = refByCode.get('FIRMICUTES_BACTEROIDETES_RATIO');
    if (firmBact != null && ratioRef?.optimal_low != null && ratioRef.optimal_high != null) {
      metricsUsed++;
      if (firmBact > ratioRef.optimal_high) {
        const dev = (firmBact - ratioRef.optimal_high) / ratioRef.optimal_high;
        penalty += Math.min(25, Math.round(dev * 25));
        findings.push(
          `Ratio Firmicutes/Bacteroidetes élevé (${firmBact.toFixed(2)}) — profil potentiellement obésogène / inflammatoire.`,
        );
        recommendations.push(
          'Augmenter la diversité des fibres végétales (30+ espèces/semaine), légumineuses, légumes crucifères.',
        );
      } else if (firmBact < ratioRef.optimal_low) {
        const dev = (ratioRef.optimal_low - firmBact) / ratioRef.optimal_low;
        penalty += Math.min(25, Math.round(dev * 25));
        findings.push(
          `Ratio Firmicutes/Bacteroidetes bas (${firmBact.toFixed(2)}) — équilibre microbien inversé.`,
        );
        recommendations.push(
          'Soutenir les Firmicutes : amidon résistant (banane verte, pomme de terre refroidie), avoine.',
        );
      }
    }

    const alphaRef = refByCode.get('ALPHA_DIVERSITY_SHANNON');
    if (alpha != null && alphaRef?.optimal_low != null) {
      metricsUsed++;
      if (alpha < alphaRef.optimal_low) {
        const dev = (alphaRef.optimal_low - alpha) / alphaRef.optimal_low;
        penalty += Math.min(25, Math.round(dev * 25));
        findings.push(
          `Diversité alpha (Shannon) appauvrie (${alpha.toFixed(2)}) — microbiote fragilisé.`,
        );
        recommendations.push(
          'Diversifier l alimentation végétale, aliments fermentés (kéfir, kimchi, choucroute non pasteurisée).',
        );
      }
    }

    const butRef = refByCode.get('BUTYRATE_PRODUCERS_SCORE');
    if (butyrate != null && butRef?.optimal_low != null) {
      metricsUsed++;
      if (butyrate < butRef.optimal_low) {
        const dev = (butRef.optimal_low - butyrate) / butRef.optimal_low;
        penalty += Math.min(25, Math.round(dev * 25));
        findings.push(
          `Producteurs de butyrate insuffisants (${butyrate.toFixed(2)}) — déficit d AGCC, inflammation colique possible.`,
        );
        recommendations.push(
          'Augmenter amidon résistant, inuline, FOS/GOS, son d avoine ; envisager butyrate post-biotique sur avis clinique.',
        );
      }
    }

    const lpsRef = refByCode.get('LPS_LOAD_SCORE');
    if (lps != null && lpsRef?.optimal_high != null) {
      metricsUsed++;
      if (lps > lpsRef.optimal_high) {
        const dev = (lps - lpsRef.optimal_high) / Math.max(1, lpsRef.optimal_high);
        penalty += Math.min(25, Math.round(dev * 25));
        findings.push(
          `Charge LPS élevée (${lps.toFixed(2)}) — endotoxémie possible, inflammation bas grade.`,
        );
        recommendations.push(
          'Renforcer la barrière intestinale : zinc-carnosine, L-glutamine, polyphénols, oméga-3 ; réduire ultra-transformés et alcool.',
        );
      }
    }

    // ── Normalisation : score sur 100 (moyenne pondérée des métriques) ───
    const maxPenaltyPerMetric = 25;
    const maxPossible = Math.max(1, metricsUsed) * maxPenaltyPerMetric;
    const score = metricsUsed === 0
      ? 0
      : Math.round((penalty / maxPossible) * 100);

    const color: DysbiosisColor =
      score >= 70 ? 'red'
        : score >= 45 ? 'orange'
        : score >= 20 ? 'yellow'
        : 'green';

    // Cas particulier : pas assez de données pour évaluer.
    if (metricsUsed === 0) {
      findings.push(
        'Données insuffisantes pour évaluer la dysbiose. Saisir au minimum Firmicutes, Bacteroidetes et la diversité alpha.',
      );
    } else if (findings.length === 0) {
      findings.push('Équilibre microbien dans les bornes optimales — pas de dysbiose détectée.');
      recommendations.push('Maintenir une alimentation riche en fibres variées et en aliments fermentés.');
    }

    return {
      patient_id: patientId,
      sample_date: mostRecent,
      dysbiosis_score: score,
      color,
      metrics: {
        firmicutes_bacteroidetes_ratio: firmBact,
        alpha_diversity_shannon: alpha,
        butyrate_producers_score: butyrate,
        lps_load_score: lps,
      },
      key_findings_fr: findings,
      recommendations_fr: recommendations,
    };
  }
}
