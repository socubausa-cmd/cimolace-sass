import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';

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

export type MetaboliteInputItem = {
  metabolite_code: string;
  value: number;
  unit?: string;
  sample_date?: string;
  lab_name?: string;
};

export type PathwayStatus = 'optimal' | 'low' | 'high' | 'imbalanced';

export type PathwayProfile = {
  name_fr: string;
  status: PathwayStatus;
  evidence_codes: string[];
  interpretation_fr: string;
};

/**
 * MEDOS v2 — Bio Digital Twin · Multi-omics metabolomique (P3 C2).
 *
 * Couche metier pour la dimension metabolomique du Twin :
 *  - lecture du referentiel metabolites (~40 marqueurs seedes)
 *  - saisie et lecture des valeurs patient (tenant-scoped, RLS staff)
 *  - profilage des voies biochimiques cles (methylation, neurotransmission,
 *    Krebs, mitochondrial, axe omega) — analyse deterministe.
 *
 * Le systeme ne pose JAMAIS de diagnostic. Les profils sont indicatifs
 * et destines a eclairer le therapeute.
 */
@Injectable()
export class TwinMetabolomicsService {
  private readonly logger = new Logger(TwinMetabolomicsService.name);
  private refCache: MetaboliteRef[] | null = null;

  constructor(private readonly supabase: SupabaseService) {}

  private get db(): any {
    return this.supabase.client as any;
  }

  /** Garde tenant/patient — meme regle que TwinService/TwinGenomicsService. */
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

  // ── Referentiel global ────────────────────────────────────────────────
  async listMetaboliteRefs(): Promise<MetaboliteRef[]> {
    if (this.refCache) return this.refCache;
    const { data, error } = await this.db
      .from('med_metabolite_refs')
      .select('*')
      .order('category', { ascending: true })
      .order('metabolite_code', { ascending: true });
    if (error) {
      this.logger.error('listMetaboliteRefs failed', error);
      return [];
    }
    this.refCache = (data ?? []) as MetaboliteRef[];
    return this.refCache;
  }

  // ── Mesures patient ───────────────────────────────────────────────────
  async listPatientMetabolites(
    tenant: TenantContext,
    patientId: string,
  ): Promise<PatientMetabolite[]> {
    await this.assertPatient(tenant, patientId);
    const { data } = await this.db
      .from('med_patient_metabolites')
      .select('id,metabolite_code,value,unit,sample_date,lab_name,source,created_at')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('sample_date', { ascending: false })
      .order('created_at', { ascending: false });
    return (data ?? []) as PatientMetabolite[];
  }

  async addPatientMetabolites(
    tenant: TenantContext,
    _userId: string,
    patientId: string,
    items: MetaboliteInputItem[],
  ): Promise<{ inserted: number; rows: PatientMetabolite[] }> {
    await this.assertPatient(tenant, patientId);
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Aucun metabolite fourni.');
    }
    const refs = await this.listMetaboliteRefs();
    const refByCode = new Map(refs.map((r) => [r.metabolite_code, r]));

    const today = new Date().toISOString().slice(0, 10);
    const rows = items
      .filter(
        (it) =>
          it &&
          typeof it.metabolite_code === 'string' &&
          typeof it.value === 'number' &&
          Number.isFinite(it.value),
      )
      .map((it) => {
        const ref = refByCode.get(it.metabolite_code);
        return {
          tenant_id: tenant.id,
          patient_id: patientId,
          metabolite_code: it.metabolite_code,
          value: it.value,
          unit: it.unit ?? ref?.unit ?? null,
          sample_date: it.sample_date || today,
          lab_name: it.lab_name ?? null,
          source: 'manual',
        };
      });

    if (rows.length === 0) {
      throw new BadRequestException('Entrees metabolites invalides.');
    }

    const { data, error } = await this.db
      .from('med_patient_metabolites')
      .insert(rows)
      .select('id,metabolite_code,value,unit,sample_date,lab_name,source,created_at');
    if (error) {
      this.logger.error('addPatientMetabolites insert failed', error);
      throw new BadRequestException(error.message);
    }
    return { inserted: data?.length ?? 0, rows: (data ?? []) as PatientMetabolite[] };
  }

  // ── Profilage des voies biochimiques (deterministe) ───────────────────
  /**
   * Analyse les voies biochimiques cles a partir des mesures les plus
   * recentes. Pour chaque voie :
   *   - 'optimal'    : tous les marqueurs dans la fenetre cible
   *   - 'low'        : au moins un marqueur sous optimal_low
   *   - 'high'       : au moins un marqueur au-dessus de optimal_high
   *   - 'imbalanced' : combinaison high + low (perte d'equilibre)
   */
  async profilePathways(
    tenant: TenantContext,
    patientId: string,
  ): Promise<{ patient_id: string; pathways: PathwayProfile[] }> {
    await this.assertPatient(tenant, patientId);
    const [refs, measurements] = await Promise.all([
      this.listMetaboliteRefs(),
      this.listPatientMetabolites(tenant, patientId),
    ]);
    const refByCode = new Map(refs.map((r) => [r.metabolite_code, r]));

    // Garde la valeur la plus recente par metabolite_code.
    const latestByCode = new Map<string, PatientMetabolite>();
    for (const m of measurements) {
      if (!latestByCode.has(m.metabolite_code)) latestByCode.set(m.metabolite_code, m);
    }

    // Definition des voies — codes cibles pour chaque axe.
    const pathwayDefs: Array<{ name_fr: string; codes: string[] }> = [
      {
        name_fr: 'Methylation',
        codes: ['METHYLMALONIC_ACID_U', 'METHIONINE', 'GLYCINE', 'CYSTEINE', 'PYROGLUTAMATE'],
      },
      {
        name_fr: 'Neurotransmission',
        codes: [
          'TYROSINE', 'TRYPTOPHAN', 'GLUTAMATE', 'GABA',
          'HVA', 'VMA', '5_HIAA', 'KYNURENATE', 'QUINOLINATE',
          'SEROTONIN_PLATELET', 'DOPAMINE_URINE', 'NOREPINEPHRINE_URINE',
        ],
      },
      {
        name_fr: 'Cycle de Krebs',
        codes: ['CITRATE', 'AKG', 'SUCCINATE', 'FUMARATE', 'MALATE', 'LACTATE', 'PYRUVATE'],
      },
      {
        name_fr: 'Fonction mitochondriale',
        codes: ['COQ10_RBC', 'ACETYL_L_CARNITINE', 'LACTATE', 'PYRUVATE', '3_HYDROXYBUTYRATE'],
      },
      {
        name_fr: 'Axe omega (inflammation membranaire)',
        codes: ['OMEGA3_INDEX', 'EPA', 'DHA', 'ARACHIDONIC_ACID', 'AA_EPA_RATIO'],
      },
      {
        name_fr: 'Cycle uree et detoxification azotee',
        codes: ['ARGININE', 'ORNITHINE', 'CITRULLINE', 'GLUTAMINE'],
      },
    ];

    const pathways: PathwayProfile[] = pathwayDefs.map((def) =>
      this.evaluatePathway(def.name_fr, def.codes, latestByCode, refByCode),
    );

    return { patient_id: patientId, pathways };
  }

  private evaluatePathway(
    name_fr: string,
    codes: string[],
    latest: Map<string, PatientMetabolite>,
    refs: Map<string, MetaboliteRef>,
  ): PathwayProfile {
    const evidence: string[] = [];
    let lowHits = 0;
    let highHits = 0;
    let optimalHits = 0;
    let measured = 0;

    for (const code of codes) {
      const meas = latest.get(code);
      const ref = refs.get(code);
      if (!meas || !ref) continue;
      measured += 1;
      const v = Number(meas.value);
      const lo = ref.optimal_low;
      const hi = ref.optimal_high;
      if (lo !== null && v < lo) {
        lowHits += 1;
        evidence.push(code);
        continue;
      }
      if (hi !== null && v > hi) {
        highHits += 1;
        evidence.push(code);
        continue;
      }
      optimalHits += 1;
    }

    let status: PathwayStatus;
    let interpretation_fr: string;

    if (measured === 0) {
      status = 'optimal';
      interpretation_fr = `Aucune mesure disponible pour la voie "${name_fr}". Saisir des valeurs pour activer l'analyse.`;
      return { name_fr, status, evidence_codes: [], interpretation_fr };
    }

    if (lowHits > 0 && highHits > 0) {
      status = 'imbalanced';
      interpretation_fr = `Voie "${name_fr}" desequilibree : ${highHits} marqueur(s) eleve(s) et ${lowHits} marqueur(s) bas (sur ${measured} mesures). Rechercher facteur limitant en amont.`;
    } else if (lowHits > 0) {
      status = 'low';
      interpretation_fr = `Voie "${name_fr}" sous-active : ${lowHits} marqueur(s) en dessous de la cible fonctionnelle. Soutenir cofacteurs et substrats.`;
    } else if (highHits > 0) {
      status = 'high';
      interpretation_fr = `Voie "${name_fr}" en surcharge : ${highHits} marqueur(s) au-dessus de la cible fonctionnelle. Verifier inflammation, stress, surcharge substrats.`;
    } else {
      status = 'optimal';
      interpretation_fr = `Voie "${name_fr}" dans la fenetre fonctionnelle (${optimalHits}/${measured} marqueurs optimaux).`;
    }

    return { name_fr, status, evidence_codes: evidence, interpretation_fr };
  }
}
