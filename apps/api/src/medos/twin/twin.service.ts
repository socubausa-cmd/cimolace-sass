import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';
import {
  TwinScoringService,
  type BiomarkerRef,
  type BiomarkerValue,
} from './twin-scoring.service';
import { TwinAiService, type PatientAiContext } from './twin-ai.service';
import type {
  AddBiomarkersDto,
  CreateLabDocumentDto,
  OrganAssistantDto,
} from './dto/twin.dto';

const ENGINE_VERSION = 'v1';
const GRAPH_VERSION = 'v1';

@Injectable()
export class TwinService {
  private readonly logger = new Logger(TwinService.name);
  private refCache: { organs: any[]; biomarkers: BiomarkerRef[] } | null = null;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly scoring: TwinScoringService,
    private readonly ai: TwinAiService,
  ) {}

  /** Client Supabase non typé (tables twin hors du type Database de base). */
  private get db(): any {
    return this.supabase.client as any;
  }

  // ── Référentiels (cache mémoire) ──────────────────────────────────────
  async getReferential(): Promise<{ organs: any[]; biomarkers: BiomarkerRef[] }> {
    if (this.refCache) return this.refCache;
    const [organsRes, bmRes] = await Promise.all([
      this.db.from('med_organs').select('*').order('sort_order', { ascending: true }),
      this.db.from('med_biomarker_refs').select('*').order('category', { ascending: true }),
    ]);
    this.refCache = {
      organs: organsRes.data ?? [],
      biomarkers: (bmRes.data ?? []) as BiomarkerRef[],
    };
    return this.refCache;
  }

  async getGraph(): Promise<{ nodes: any[]; edges: any[] }> {
    const [nodes, edges] = await Promise.all([
      this.db.from('med_bio_nodes').select('*').eq('graph_version', GRAPH_VERSION),
      this.db.from('med_bio_edges').select('*').eq('graph_version', GRAPH_VERSION),
    ]);
    return { nodes: nodes.data ?? [], edges: edges.data ?? [] };
  }

  // ── Garde tenant/patient ──────────────────────────────────────────────
  private async assertPatient(tenant: TenantContext, patientId: string): Promise<any> {
    const { data } = await this.db
      .from('med_patients')
      .select('*')
      .eq('id', patientId)
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    if (!data) throw new NotFoundException('Patient introuvable pour ce tenant');
    return data;
  }

  // ── Biomarqueurs ──────────────────────────────────────────────────────
  /** Dernière valeur connue par code (déduplication). */
  async listLatestBiomarkers(
    tenant: TenantContext,
    patientId: string,
  ): Promise<BiomarkerValue[]> {
    await this.assertPatient(tenant, patientId);
    const { data } = await this.db
      .from('med_patient_biomarkers')
      .select('biomarker_code,value,measured_at,created_at,flag,unit_raw')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('measured_at', { ascending: false })
      .order('created_at', { ascending: false });
    const seen = new Set<string>();
    const latest: any[] = [];
    for (const row of data ?? []) {
      if (seen.has(row.biomarker_code)) continue;
      seen.add(row.biomarker_code);
      latest.push(row);
    }
    return latest.map((r) => ({ biomarker_code: r.biomarker_code, value: Number(r.value) }));
  }

  async addBiomarkers(
    tenant: TenantContext,
    userId: string,
    patientId: string,
    dto: AddBiomarkersDto,
  ): Promise<{ inserted: number; scores: any }> {
    await this.assertPatient(tenant, patientId);
    const { biomarkers: refs } = await this.getReferential();
    const refByCode = new Map(refs.map((r) => [r.code, r]));

    const rows = dto.biomarkers
      .filter((b) => refByCode.has(b.biomarker_code))
      .map((b) => {
        const ref = refByCode.get(b.biomarker_code)!;
        const flag = this.scoring.computeFlag(ref, b.value);
        return {
          tenant_id: tenant.id,
          patient_id: patientId,
          lab_document_id: dto.lab_document_id ?? null,
          biomarker_code: b.biomarker_code,
          value: b.value,
          unit_raw: b.unit ?? ref.unit,
          value_canonical: b.value,
          flag,
          measured_at: b.measured_at ?? new Date().toISOString().slice(0, 10),
          confidence: 1.0,
          source: 'manual',
        };
      });

    if (rows.length > 0) {
      const { error } = await this.db.from('med_patient_biomarkers').insert(rows);
      if (error) this.logger.error(`insert biomarkers: ${error.message}`);
    }

    const scores = await this.computeScores(tenant, patientId);
    return { inserted: rows.length, scores };
  }

  // ── Scoring (déterministe) + alertes ──────────────────────────────────
  async computeScores(tenant: TenantContext, patientId: string): Promise<any> {
    await this.assertPatient(tenant, patientId);
    const { organs, biomarkers } = await this.getReferential();
    const values = await this.listLatestBiomarkers(tenant, patientId);
    const organCodes = organs.map((o) => o.code);

    const organScores = this.scoring.computeAllOrganScores(organCodes, biomarkers, values);
    const alerts = this.scoring.detectAlerts(biomarkers, values);

    // Snapshot des scores (historisé : on insère, on n'écrase pas).
    if (organScores.length > 0) {
      const rows = organScores.map((s) => ({
        tenant_id: tenant.id,
        patient_id: patientId,
        organ_code: s.organ_code,
        score: s.score,
        color: s.color,
        dimensions: s.dimensions,
        contributing_biomarkers: s.contributing_biomarkers,
        confidence: s.confidence,
        engine_version: ENGINE_VERSION,
        graph_version: GRAPH_VERSION,
      }));
      const { error } = await this.db.from('med_organ_scores').insert(rows);
      if (error) this.logger.error(`insert organ_scores: ${error.message}`);
    }

    // Alertes : on remplace les alertes ouvertes auto-générées par les nouvelles.
    await this.db
      .from('med_alerts')
      .delete()
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .eq('status', 'open');
    if (alerts.length > 0) {
      const rows = alerts.map((a) => ({
        tenant_id: tenant.id,
        patient_id: patientId,
        kind: a.kind,
        severity: a.severity,
        message_fr: a.message_fr,
        evidence: a.evidence,
        status: 'open',
        graph_version: GRAPH_VERSION,
      }));
      await this.db.from('med_alerts').insert(rows);
    }

    return { organ_scores: organScores, alerts };
  }

  // ── État complet du jumeau (Module 35 : centre de commande) ───────────
  async getState(tenant: TenantContext, patientId: string): Promise<any> {
    await this.assertPatient(tenant, patientId);
    const { organs } = await this.getReferential();

    const [scoresRes, biomarkersRes, alertsRes, hypoRes, wheelRes] = await Promise.all([
      this.db
        .from('med_organ_scores')
        .select('*')
        .eq('patient_id', patientId)
        .order('computed_at', { ascending: false }),
      this.db
        .from('med_patient_biomarkers')
        .select('biomarker_code,value,unit_raw,flag,measured_at')
        .eq('patient_id', patientId)
        .order('measured_at', { ascending: false }),
      this.db
        .from('med_alerts')
        .select('*')
        .eq('patient_id', patientId)
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
      this.db
        .from('med_hypotheses')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false }),
      this.db
        .from('med_transformation_wheel')
        .select('*')
        .eq('patient_id', patientId)
        .order('measured_at', { ascending: false }),
    ]);

    // Dernier score par organe.
    const latestScore = new Map<string, any>();
    for (const s of scoresRes.data ?? []) {
      if (!latestScore.has(s.organ_code)) latestScore.set(s.organ_code, s);
    }
    const organs_state = organs.map((o) => ({
      ...o,
      score: latestScore.get(o.code) ?? null,
    }));

    // Dernier biomarqueur par code.
    const seen = new Set<string>();
    const latestBiomarkers: any[] = [];
    for (const b of biomarkersRes.data ?? []) {
      if (seen.has(b.biomarker_code)) continue;
      seen.add(b.biomarker_code);
      latestBiomarkers.push(b);
    }

    return {
      organs: organs_state,
      biomarkers: latestBiomarkers,
      alerts: alertsRes.data ?? [],
      hypotheses: hypoRes.data ?? [],
      wheel: wheelRes.data ?? [],
      disclaimer:
        'Aide à la décision clinique — ne remplace pas le jugement du thérapeute ; aucune valeur de diagnostic.',
    };
  }

  // ── Documents labo (Module 3) ─────────────────────────────────────────
  async createLabDocument(
    tenant: TenantContext,
    patientId: string,
    dto: CreateLabDocumentDto,
  ): Promise<any> {
    await this.assertPatient(tenant, patientId);
    const { data, error } = await this.db
      .from('med_lab_documents')
      .insert({
        tenant_id: tenant.id,
        patient_id: patientId,
        attachment_id: dto.attachment_id ?? null,
        source_type: dto.source_type ?? 'blood',
        lab_name: dto.lab_name ?? null,
        raw_text: dto.raw_text ?? null,
        status: dto.raw_text ? 'uploaded' : 'uploaded',
      })
      .select('*')
      .single();
    if (error) throw new NotFoundException(error.message);
    return data;
  }

  /** Extraction IA d'un document → biomarqueurs (Module 3). */
  async extractDocument(
    tenant: TenantContext,
    userId: string,
    patientId: string,
    docId: string,
  ): Promise<any> {
    await this.assertPatient(tenant, patientId);
    const { data: doc } = await this.db
      .from('med_lab_documents')
      .select('*')
      .eq('id', docId)
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    if (!doc) throw new NotFoundException('Document introuvable');
    if (!doc.raw_text) {
      throw new NotFoundException('Document sans texte à extraire (OCR requis en amont).');
    }

    await this.db.from('med_lab_documents').update({ status: 'extracting' }).eq('id', docId);
    const { biomarkers: refs } = await this.getReferential();
    const started = Date.now();
    let extracted: any = { values: [] };
    let model = '';
    let tokens = 0;
    let error: string | null = null;
    try {
      const res = await this.ai.extractBiomarkers(
        doc.raw_text,
        refs.map((r) => ({ code: r.code, name_fr: r.name_fr })),
      );
      extracted = res.data;
      model = res.model;
      tokens = res.tokens;
    } catch (e: any) {
      error = e?.message ?? 'extraction failed';
    }

    await this.logAgentRun(tenant, patientId, null, 'extraction', {
      input_hash: createHash('sha256').update(doc.raw_text).digest('hex').slice(0, 16),
      model,
      tokens,
      latency_ms: Date.now() - started,
      output: extracted,
      error,
    });

    if (error) {
      await this.db.from('med_lab_documents').update({ status: 'failed' }).eq('id', docId);
      throw new NotFoundException(`Extraction échouée : ${error}`);
    }

    // Persistance des valeurs extraites + recalcul des scores.
    const values = (extracted.values ?? []).map((v: any) => ({
      biomarker_code: v.code,
      value: Number(v.value),
      unit: v.unit,
    }));
    await this.db
      .from('med_lab_documents')
      .update({ status: 'extracted', extraction_model: model })
      .eq('id', docId);

    const result = await this.addBiomarkers(tenant, userId, patientId, {
      biomarkers: values,
      lab_document_id: docId,
    } as AddBiomarkersDto);
    return { extracted: values.length, ...result };
  }

  // ── Contexte IA pseudonymisé ──────────────────────────────────────────
  private async buildAiContext(
    tenant: TenantContext,
    patientId: string,
  ): Promise<PatientAiContext> {
    const patient = await this.assertPatient(tenant, patientId);
    const { biomarkers: refs } = await this.getReferential();
    const refByCode = new Map(refs.map((r) => [r.code, r]));
    const values = await this.listLatestBiomarkers(tenant, patientId);

    const bm = values
      .map((v) => {
        const ref = refByCode.get(v.biomarker_code);
        if (!ref) return null;
        return {
          code: ref.code,
          name_fr: ref.name_fr,
          value: v.value,
          unit: ref.unit,
          flag: this.scoring.computeFlag(ref, v.value),
        };
      })
      .filter(Boolean) as any[];

    // Symptômes : dérivés des biomarqueurs anormaux (ancrés sur les données).
    const symptoms = new Set<string>();
    for (const b of bm) {
      if (b.flag !== 'normal') {
        const ref = refByCode.get(b.code);
        (ref?.associated_symptoms ?? []).forEach((s: string) => symptoms.add(s));
      }
    }

    const scoreState = await this.computeScores(tenant, patientId);
    const age = patient.date_of_birth
      ? Math.floor((Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 864e5))
      : null;

    return {
      age,
      sex: patient.gender ?? null,
      symptoms: [...symptoms],
      biomarkers: bm,
      organ_scores: (scoreState.organ_scores ?? []).map((s: any) => ({
        organ_code: s.organ_code,
        score: s.score,
        color: s.color,
      })),
    };
  }

  private async logAgentRun(
    tenant: TenantContext,
    patientId: string,
    analysisId: string | null,
    agent: string,
    fields: Partial<{
      input_hash: string;
      prompt_version: string;
      model: string;
      output: any;
      tokens: number;
      latency_ms: number;
      error: string | null;
    }>,
  ): Promise<void> {
    await this.db.from('med_ai_agent_runs').insert({
      tenant_id: tenant.id,
      analysis_id: analysisId,
      patient_id: patientId,
      agent,
      input_hash: fields.input_hash ?? null,
      prompt_version: fields.prompt_version ?? 'v1',
      model: fields.model ?? null,
      output: fields.output ?? {},
      tokens: fields.tokens ?? null,
      latency_ms: fields.latency_ms ?? null,
      error: fields.error ?? null,
    });
  }

  // ── Assistant Organe (M11 + XAI M19) ──────────────────────────────────
  async organAssistant(
    tenant: TenantContext,
    userId: string,
    patientId: string,
    dto: OrganAssistantDto,
  ): Promise<any> {
    const ctx = await this.buildAiContext(tenant, patientId);
    const { organs } = await this.getReferential();
    const organ = organs.find((o) => o.code === dto.organ_code);
    if (!organ) throw new NotFoundException('Organe inconnu');

    const { edges } = await this.getGraph();
    const relevant = edges.filter(
      (e: any) => e.from_code === dto.organ_code || e.to_code === dto.organ_code,
    );

    const started = Date.now();
    const { data: analysis } = await this.db
      .from('med_ai_analyses')
      .insert({
        tenant_id: tenant.id,
        patient_id: patientId,
        kind: 'organ_assistant',
        status: 'generating',
        created_by: userId,
        models: {},
      })
      .select('*')
      .single();

    try {
      const res = await this.ai.organAssistant(
        ctx,
        dto.organ_code,
        organ.name_fr,
        dto.question,
        relevant,
      );
      await this.logAgentRun(tenant, patientId, analysis?.id ?? null, 'organ_assistant', {
        model: res.model,
        tokens: res.tokens,
        latency_ms: Date.now() - started,
        output: res.data,
      });
      const { data: updated } = await this.db
        .from('med_ai_analyses')
        .update({
          status: 'ready',
          output: res.data,
          confidence: res.data.confidence ?? null,
          models: { organ_assistant: res.model },
        })
        .eq('id', analysis.id)
        .select('*')
        .single();
      return updated;
    } catch (e: any) {
      await this.db
        .from('med_ai_analyses')
        .update({ status: 'failed', output: { error: e?.message } })
        .eq('id', analysis.id);
      throw e;
    }
  }

  // ── Analyse multi-agents : hypothèses (M16/M18) ───────────────────────
  async analyze(tenant: TenantContext, userId: string, patientId: string): Promise<any> {
    const ctx = await this.buildAiContext(tenant, patientId);
    const started = Date.now();
    const { data: analysis } = await this.db
      .from('med_ai_analyses')
      .insert({
        tenant_id: tenant.id,
        patient_id: patientId,
        kind: 'differential',
        status: 'generating',
        created_by: userId,
      })
      .select('*')
      .single();

    try {
      const res = await this.ai.generateHypotheses(ctx);
      await this.logAgentRun(tenant, patientId, analysis?.id ?? null, 'hypotheses', {
        model: res.model,
        tokens: res.tokens,
        latency_ms: Date.now() - started,
        output: res.data,
      });

      const hyps = (res.data.hypotheses ?? []).map((h) => ({
        tenant_id: tenant.id,
        patient_id: patientId,
        analysis_id: analysis.id,
        label_fr: h.label_fr,
        probability: h.probability ?? null,
        confidence: h.confidence ?? null,
        reasoning_fr: h.reasoning_fr ?? null,
        args_for: h.args_for ?? [],
        args_against: h.args_against ?? [],
        status: 'suggested',
        graph_version: GRAPH_VERSION,
      }));
      if (hyps.length > 0) await this.db.from('med_hypotheses').insert(hyps);

      await this.db
        .from('med_ai_analyses')
        .update({ status: 'ready', output: res.data, models: { hypotheses: res.model } })
        .eq('id', analysis.id);

      return { analysis_id: analysis.id, hypotheses: res.data.hypotheses ?? [] };
    } catch (e: any) {
      await this.db
        .from('med_ai_analyses')
        .update({ status: 'failed', output: { error: e?.message } })
        .eq('id', analysis.id);
      throw e;
    }
  }

  /** Validation/rejet d'une hypothèse par le thérapeute (contrôle humain). */
  async setHypothesisStatus(
    tenant: TenantContext,
    id: string,
    status: 'validated' | 'rejected',
  ): Promise<any> {
    const { data, error } = await this.db
      .from('med_hypotheses')
      .update({ status })
      .eq('id', id)
      .eq('tenant_id', tenant.id)
      .select('*')
      .single();
    if (error) throw new NotFoundException(error.message);
    return data;
  }
}
