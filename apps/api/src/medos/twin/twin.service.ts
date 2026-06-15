import {
  BadRequestException,
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
import { TwinSimulationService, INTERVENTIONS } from './twin-simulation.service';
import {
  TwinProjectionService,
  PROJECTION_VERSION,
  SCENARIOS as PROJECTION_SCENARIOS,
} from './twin-projection.service';
import type {
  AddBiomarkersDto,
  CreateLabDocumentDto,
  OrganAssistantDto,
  StructuredBiomarkerItemDto,
} from './dto/twin.dto';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 Mo (cf. cahier des charges M3).
const SUPPORTED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const SUPPORTED_PDF_MIMES = new Set([
  'application/pdf',
  'application/x-pdf',
]);
type UploadedLabFile = {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size?: number;
};

const ENGINE_VERSION = 'v1';
const GRAPH_VERSION = 'v1';

@Injectable()
export class TwinService {
  private readonly logger = new Logger(TwinService.name);
  // Cache memoire par langue. Le scoring/IA continue de lire la version 'fr'
  // (le contenu clinique source — function_fr, message_fr — reste FR).
  // Les variantes localisees exposent seulement name/description traduits.
  private refCacheByLang: Map<
    'fr' | 'en',
    { organs: any[]; biomarkers: BiomarkerRef[] }
  > = new Map();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly scoring: TwinScoringService,
    private readonly ai: TwinAiService,
    private readonly simulation: TwinSimulationService,
    private readonly projectionSvc: TwinProjectionService,
  ) {}

  /** Client Supabase non typé (tables twin hors du type Database de base). */
  private get db(): any {
    return this.supabase.client as any;
  }

  // ── Référentiels (cache mémoire, multi-langue) ────────────────────────
  /**
   * Renvoie le referentiel organes + biomarqueurs.
   *
   * Quand `lang='en'` (defaut 'fr'), les champs `name_fr` / `description_fr`
   * sont remappes vers les colonnes anglaises (`name_en`, `description_en`)
   * pour exposition cote client. Si une traduction est absente en DB,
   * fallback transparent sur la version francaise. Les autres champs
   * (codes, plages, unites, function_fr, associated_symptoms) sont
   * conserves tels quels — le moteur de scoring et l'IA continuent de
   * consommer le contenu source FR.
   *
   * Note pour les devs : pour activer EN cote front, passer `?lang=en` a
   * GET /med/twin/referential. Aucun switcher UI n'est livre ici
   * (fondation Chantier 5 uniquement) — c'est a l'appelant d'exposer le
   * choix de langue (ex. localStorage, profil utilisateur).
   */
  async getReferential(
    lang: 'fr' | 'en' = 'fr',
  ): Promise<{ organs: any[]; biomarkers: BiomarkerRef[] }> {
    const cached = this.refCacheByLang.get(lang);
    if (cached) return cached;
    const [organsRes, bmRes] = await Promise.all([
      this.db.from('med_organs').select('*').order('sort_order', { ascending: true }),
      this.db.from('med_biomarker_refs').select('*').order('category', { ascending: true }),
    ]);
    let organs: any[] = organsRes.data ?? [];
    let biomarkers: BiomarkerRef[] = (bmRes.data ?? []) as BiomarkerRef[];

    if (lang === 'en') {
      organs = organs.map((o: any) => ({
        ...o,
        name_fr: o.name_en ?? o.name_fr,
        description_fr: o.description_en ?? o.description_fr,
      }));
      biomarkers = biomarkers.map((b: any) => ({
        ...b,
        name_fr: b.name_en ?? b.name_fr,
      })) as BiomarkerRef[];
    }

    const result = { organs, biomarkers };
    this.refCacheByLang.set(lang, result);
    return result;
  }

  async getGraph(): Promise<{ nodes: any[]; edges: any[] }> {
    const [nodes, edges] = await Promise.all([
      this.db.from('med_bio_nodes').select('*').eq('graph_version', GRAPH_VERSION),
      this.db.from('med_bio_edges').select('*').eq('graph_version', GRAPH_VERSION),
    ]);
    return { nodes: nodes.data ?? [], edges: edges.data ?? [] };
  }

  // ── Versioning moteur + graphe (P2 C1) ────────────────────────────────
  /**
   * Liste les versions du moteur deterministe + du knowledge graph.
   * Retourne les versions actives ET deprecated (utile pour comparer dans
   * le temps). Triees par kind puis released_at desc.
   */
  async listEngineVersions(): Promise<
    Array<{
      id: string;
      code: string;
      version: string;
      kind: 'engine' | 'graph';
      description_fr: string | null;
      released_at: string;
      deprecated_at: string | null;
      change_notes: string | null;
      is_active: boolean;
    }>
  > {
    const { data, error } = await this.db
      .from('med_engine_versions')
      .select(
        'id, code, version, kind, description_fr, released_at, deprecated_at, change_notes, is_active',
      )
      .order('kind', { ascending: true })
      .order('released_at', { ascending: false });
    if (error) {
      this.logger.error(`list engine versions: ${error.message}`);
      return [];
    }
    return data ?? [];
  }

  /**
   * Timeline complete des scores d'organes pour un patient.
   *
   * S'appuie sur med_organ_scores qui est deja historise (INSERT non
   * ecrasant a chaque computeScores). Retourne un dictionnaire
   * { organ_code: [{ score, color, created_at, engine_version, graph_version }] }
   * ordonne par computed_at ASC pour faciliter l'affichage chronologique.
   *
   * Si `organCode` est fourni, ne retourne que cet organe.
   */
  async getOrganScoresTimeline(
    tenant: TenantContext,
    patientId: string,
    organCode?: string,
  ): Promise<
    Record<
      string,
      Array<{
        score: number;
        color: string;
        created_at: string;
        engine_version: string;
        graph_version: string;
      }>
    >
  > {
    await this.assertPatient(tenant, patientId);
    let q = this.db
      .from('med_organ_scores')
      .select('organ_code, score, color, computed_at, engine_version, graph_version')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('computed_at', { ascending: true });
    if (organCode) q = q.eq('organ_code', organCode);

    const { data, error } = await q;
    if (error) {
      this.logger.error(`organ scores timeline: ${error.message}`);
      return {};
    }
    const timeline: Record<
      string,
      Array<{
        score: number;
        color: string;
        created_at: string;
        engine_version: string;
        graph_version: string;
      }>
    > = {};
    for (const row of data ?? []) {
      const arr = timeline[row.organ_code] ?? (timeline[row.organ_code] = []);
      arr.push({
        score: row.score,
        color: row.color,
        // On expose le champ sous le nom `created_at` cote API (champ
        // metier "quand ce snapshot a-t-il ete cree"), meme si en DB la
        // colonne s'appelle computed_at.
        created_at: row.computed_at,
        engine_version: row.engine_version,
        graph_version: row.graph_version,
      });
    }
    return timeline;
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

  /**
   * Import structuré (CSV/JSON) — zéro IA pour le mapping.
   *
   * Chaque item est validé contre le référentiel (code connu + valeur numérique
   * finie). Un document `med_lab_documents` est créé avec
   * source_type='structured_import', status='extracted', extraction_path
   * 'csv_deterministic' et extraction_model='none' afin de tracer l'origine
   * sans passer par le pipeline IA. Les valeurs valides sont ensuite poussées
   * via addBiomarkers qui réutilise tout l'aval (flag, scoring, alertes).
   */
  async importStructuredBiomarkers(
    tenant: TenantContext,
    userId: string,
    patientId: string,
    items: StructuredBiomarkerItemDto[],
    meta: { lab_name?: string } = {},
  ): Promise<{
    imported_count: number;
    skipped: Array<{ code: string; reason: string }>;
    document_id: string;
    scores: any;
  }> {
    await this.assertPatient(tenant, patientId);

    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Aucun item à importer.');
    }

    const { biomarkers: refs } = await this.getReferential();
    const refByCode = new Map(refs.map((r) => [r.code, r]));

    const valid: StructuredBiomarkerItemDto[] = [];
    const skipped: Array<{ code: string; reason: string }> = [];

    for (const raw of items) {
      const code = String(raw?.code ?? '').trim();
      if (!code) {
        skipped.push({ code: '', reason: 'code manquant' });
        continue;
      }
      if (!refByCode.has(code)) {
        skipped.push({ code, reason: 'code inconnu dans le référentiel' });
        continue;
      }
      const value = Number(raw?.value);
      if (!Number.isFinite(value)) {
        skipped.push({ code, reason: 'valeur non numérique' });
        continue;
      }
      valid.push({
        code,
        value,
        unit: raw.unit,
        measured_at: raw.measured_at,
      });
    }

    // Trace du document même si tout est invalide (audit). status='extracted'
    // car l'extraction déterministe a fonctionné — un code skipped n'est pas
    // un échec d'extraction, juste un mapping manquant côté client.
    const { data: doc, error: docErr } = await this.db
      .from('med_lab_documents')
      .insert({
        tenant_id: tenant.id,
        patient_id: patientId,
        attachment_id: null,
        source_type: 'structured_import',
        lab_name: meta.lab_name ?? null,
        raw_text: null,
        status: 'extracted',
        extraction_path: 'csv_deterministic',
        extraction_model: 'none',
        extraction_confidence: valid.length > 0 ? 1.0 : 0,
        uploaded_by: userId,
      })
      .select('*')
      .single();
    if (docErr) throw new BadRequestException(docErr.message);
    const docId: string = doc.id;

    let scores: any = null;
    if (valid.length > 0) {
      const res = await this.addBiomarkers(tenant, userId, patientId, {
        biomarkers: valid.map((v) => ({
          biomarker_code: v.code,
          value: v.value,
          unit: v.unit,
          measured_at: v.measured_at,
        })),
        lab_document_id: docId,
      } as AddBiomarkersDto);
      scores = res.scores;
    } else {
      scores = await this.computeScores(tenant, patientId);
    }

    return {
      imported_count: valid.length,
      skipped,
      document_id: docId,
      scores,
    };
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

  // ── Vue patient (lecture seule — Chantier 4) ─────────────────────────
  /**
   * État du jumeau pour le patient connecté (lecture seule).
   * Résout le patient via med_patients.patient_user_id = userId,
   * puis projette une vue réduite : organes (scores), roue,
   * timeline events, alertes ouvertes. PAS de biomarkers bruts,
   * PAS d'hypothèses, PAS de documents labo.
   */
  async getMyTwinState(tenant: TenantContext, userId: string): Promise<any> {
    const { data: patient } = await this.db
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('patient_user_id', userId)
      .maybeSingle();
    if (!patient) throw new NotFoundException('Aucun dossier patient lié à ce compte');

    const patientId = patient.id;
    const { organs } = await this.getReferential();

    const [scoresRes, wheelRes, eventsRes, alertsRes] = await Promise.all([
      this.db
        .from('med_organ_scores')
        .select('organ_code,score,color,computed_at')
        .eq('patient_id', patientId)
        .order('computed_at', { ascending: false }),
      this.db
        .from('med_transformation_wheel')
        .select('domain,score,measured_at')
        .eq('patient_id', patientId)
        .order('measured_at', { ascending: false }),
      this.db
        .from('med_health_events')
        .select('id,event_type,title,occurred_at')
        .eq('patient_id', patientId)
        .order('occurred_at', { ascending: false })
        .limit(50),
      this.db
        .from('med_alerts')
        .select('id,severity,message,created_at')
        .eq('patient_id', patientId)
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
    ]);

    // Dernier score par organe.
    const latestScore = new Map<string, any>();
    for (const s of scoresRes.data ?? []) {
      if (!latestScore.has(s.organ_code)) latestScore.set(s.organ_code, s);
    }
    const organs_scores = organs.map((o: any) => {
      const s = latestScore.get(o.code);
      return {
        organ_code: o.code,
        label: o.label ?? o.name ?? o.code,
        score: s?.score ?? null,
        color: s?.color ?? null,
      };
    });

    // Roue : dernière valeur par domaine.
    const latestWheel = new Map<string, any>();
    for (const r of wheelRes.data ?? []) {
      if (!latestWheel.has(r.domain)) latestWheel.set(r.domain, r);
    }
    const wheel = TwinService.WHEEL_DOMAINS.map((d) => ({
      domain: d,
      score: latestWheel.get(d)?.score ?? null,
    }));

    return {
      organs_scores,
      wheel,
      events: eventsRes.data ?? [],
      alerts: alertsRes.data ?? [],
      disclaimer:
        "Ces données sont indicatives, à des fins de suivi pédagogique. Elles ne constituent pas un diagnostic médical et ne remplacent pas l'avis d'un professionnel de santé.",
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

  /**
   * Upload + extraction d'un bilan en un seul appel (M3 — multipart).
   *
   * - PDF → texte natif via pdf-parse, puis pipeline texte habituel.
   * - JPG/PNG/WebP/GIF → Claude Vision (base64) avec mêmes contraintes JSON.
   *
   * Le fichier lui-même n'est PAS conservé en DB ici (le buffer reste en
   * mémoire le temps de l'extraction). La table med_lab_documents reçoit une
   * trace (filename, mime, status, extracted_count, raw_text si PDF natif).
   */
  async extractFromUploadedFile(
    tenant: TenantContext,
    userId: string,
    patientId: string,
    file: UploadedLabFile,
    meta: { source_type?: string; lab_name?: string } = {},
  ): Promise<any> {
    await this.assertPatient(tenant, patientId);
    if (!file?.buffer || !file?.mimetype) {
      throw new BadRequestException('Fichier manquant ou invalide.');
    }
    const size = file.size ?? file.buffer.length;
    if (size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        `Fichier trop volumineux (${Math.round(size / 1024)} Ko). Limite : 10 Mo.`,
      );
    }

    const mime = file.mimetype.toLowerCase();
    const isPdf = SUPPORTED_PDF_MIMES.has(mime);
    const isImage = SUPPORTED_IMAGE_MIMES.has(mime);
    if (!isPdf && !isImage) {
      throw new BadRequestException(
        `Type non supporté (${mime}). Acceptés : PDF, JPG, PNG, WebP, GIF.`,
      );
    }

    // 1) Pré-extraction du texte si PDF (pdf-parse) — fallback Vision si vide.
    let rawText: string | null = null;
    if (isPdf) {
      try {
        rawText = await this.extractPdfText(file.buffer);
      } catch (e: any) {
        this.logger.warn(`pdf-parse a échoué : ${e?.message ?? e}`);
        rawText = null;
      }
    }

    // 2) Trace en DB (état initial : uploaded). Métadonnées fichier capturées.
    const { data: doc, error: docErr } = await this.db
      .from('med_lab_documents')
      .insert({
        tenant_id: tenant.id,
        patient_id: patientId,
        attachment_id: null,
        source_type: meta.source_type ?? 'blood',
        lab_name: meta.lab_name ?? null,
        raw_text: rawText,
        status: 'uploaded',
        mime_type: mime,
        file_size_bytes: size,
        original_filename: file.originalname ?? null,
        uploaded_by: userId,
      })
      .select('*')
      .single();
    if (docErr) throw new BadRequestException(docErr.message);
    const docId: string = doc.id;

    // 2bis) Upload du buffer vers Supabase Storage (audit trail GDPR).
    // Chemin : twin-lab/{tenant_id}/{patient_id}/{doc_id}.{ext}
    // Si l'upload échoue (rare — réseau), l'extraction continue sans bloquer
    // mais le document n'aura pas de storage_path (visible côté frontend).
    let storagePath: string | null = null;
    try {
      const ext =
        mime === 'application/pdf' || mime === 'application/x-pdf'
          ? 'pdf'
          : (mime.split('/')[1] || 'bin').replace('jpg', 'jpeg');
      const candidate = `twin-lab/${tenant.id}/${patientId}/${docId}.${ext}`;
      const { error: upErr } = await this.supabase.client.storage
        .from('medos')
        .upload(candidate, file.buffer, {
          contentType: mime,
          upsert: false,
        });
      if (upErr) throw upErr;
      storagePath = candidate;
      await this.db
        .from('med_lab_documents')
        .update({ storage_path: storagePath, status: 'extracting' })
        .eq('id', docId);
    } catch (e: any) {
      this.logger.warn(
        `Storage upload échoué pour doc ${docId}: ${e?.message ?? e} (extraction continue)`,
      );
      await this.db
        .from('med_lab_documents')
        .update({ status: 'extracting' })
        .eq('id', docId);
    }

    const { biomarkers: refs } = await this.getReferential();
    const knownCodes = refs.map((r) => ({ code: r.code, name_fr: r.name_fr }));
    const started = Date.now();
    let extracted: any = { values: [] };
    let model = '';
    let tokens = 0;
    let extractionPath: 'pdf_text' | 'image_vision' | 'pdf_scanned_vision' =
      'pdf_text';
    let inputHash = '';
    let error: string | null = null;

    try {
      const hasUsableText =
        isPdf && rawText !== null && rawText.trim().length >= 100;
      if (isPdf && hasUsableText) {
        extractionPath = 'pdf_text';
        inputHash = createHash('sha256')
          .update(rawText!)
          .digest('hex')
          .slice(0, 16);
        const res = await this.ai.extractBiomarkers(rawText!, knownCodes);
        extracted = res.data;
        model = res.model;
        tokens = res.tokens;
      } else if (isImage) {
        extractionPath = 'image_vision';
        const base64 = file.buffer.toString('base64');
        inputHash = createHash('sha256')
          .update(file.buffer)
          .digest('hex')
          .slice(0, 16);
        // image/jpg → image/jpeg (Anthropic n'accepte que les media types standards).
        const mediaType = (mime === 'image/jpg' ? 'image/jpeg' : mime) as
          | 'image/jpeg'
          | 'image/png'
          | 'image/webp'
          | 'image/gif';
        const res = await this.ai.extractBiomarkersFromImage(
          base64,
          mediaType,
          knownCodes,
        );
        extracted = res.data;
        model = res.model;
        tokens = res.tokens;
      } else if (isPdf) {
        // PDF sans texte natif exploitable (scan d'image embarquée) — on
        // rasterise les premières pages et on les passe à Claude Vision page
        // par page, puis on déduplique les valeurs (garder confidence max).
        extractionPath = 'pdf_scanned_vision';
        inputHash = createHash('sha256')
          .update(file.buffer)
          .digest('hex')
          .slice(0, 16);
        const pages = await this.rasterizePdf(file.buffer, 3);
        if (pages.length === 0) {
          throw new BadRequestException(
            'PDF scanné illisible : aucune page n\'a pu être rasterisée.',
          );
        }
        const byCode = new Map<
          string,
          { code: string; value: number; unit: string; confidence: number }
        >();
        let lastModel = '';
        let totalTokens = 0;
        for (const png of pages) {
          const b64 = png.toString('base64');
          const res = await this.ai.extractBiomarkersFromImage(
            b64,
            'image/png',
            knownCodes,
          );
          lastModel = res.model;
          totalTokens += res.tokens ?? 0;
          for (const v of res.data?.values ?? []) {
            if (!v?.code) continue;
            const incoming = {
              code: v.code,
              value: Number(v.value),
              unit: v.unit,
              confidence:
                typeof v.confidence === 'number' ? v.confidence : 0,
            };
            const prev = byCode.get(v.code);
            if (!prev || incoming.confidence > prev.confidence) {
              byCode.set(v.code, incoming);
            }
          }
        }
        extracted = { values: Array.from(byCode.values()) };
        model = lastModel;
        tokens = totalTokens;
      } else {
        throw new BadRequestException(
          `Type non supporté pour extraction (${mime}).`,
        );
      }
    } catch (e: any) {
      error = e?.message ?? 'extraction failed';
    }

    await this.logAgentRun(tenant, patientId, null, 'extraction', {
      input_hash: inputHash || undefined,
      model,
      tokens,
      latency_ms: Date.now() - started,
      output: { ...extracted, _path: extractionPath, _mime: mime },
      error,
    });

    if (error) {
      await this.db
        .from('med_lab_documents')
        .update({ status: 'failed' })
        .eq('id', docId);
      throw new BadRequestException(`Extraction échouée : ${error}`);
    }

    const values = (extracted.values ?? []).map((v: any) => ({
      biomarker_code: v.code,
      value: Number(v.value),
      unit: v.unit,
      confidence:
        typeof v.confidence === 'number' ? v.confidence : null,
    }));
    const avgConf = values.length
      ? values
          .map((v: any) => (typeof v.confidence === 'number' ? v.confidence : 0))
          .reduce((a: number, b: number) => a + b, 0) / values.length
      : null;

    await this.db
      .from('med_lab_documents')
      .update({
        status: 'extracted',
        extraction_model: model,
        extraction_confidence: avgConf,
        extraction_path: extractionPath,
      })
      .eq('id', docId);

    const insertResult = await this.addBiomarkers(tenant, userId, patientId, {
      biomarkers: values.map(({ biomarker_code, value, unit }: any) => ({
        biomarker_code,
        value,
        unit,
      })),
      lab_document_id: docId,
    } as AddBiomarkersDto);

    return {
      document_id: docId,
      filename: file.originalname ?? null,
      mime,
      path: extractionPath,
      storage_path: storagePath,
      has_file: !!storagePath,
      extracted_count: values.length,
      values,
      ...insertResult,
    };
  }

  // ── Liste + Signed URLs des bilans uploadés (audit trail) ────────────
  /**
   * Liste les documents de bilan d'un patient avec leur métadonnée fichier.
   * N'expose JAMAIS le storage_path directement (utilise has_file flag).
   */
  async listLabDocuments(tenant: TenantContext, patientId: string): Promise<any[]> {
    await this.assertPatient(tenant, patientId);
    const { data, error } = await this.db
      .from('med_lab_documents')
      .select(
        'id, source_type, lab_name, status, mime_type, file_size_bytes, original_filename, page_count, extraction_model, extraction_confidence, extraction_path, created_at, storage_path',
      )
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((d: any) => ({
      id: d.id,
      source_type: d.source_type,
      lab_name: d.lab_name,
      status: d.status,
      mime_type: d.mime_type,
      file_size_bytes: d.file_size_bytes,
      original_filename: d.original_filename,
      page_count: d.page_count,
      extraction_model: d.extraction_model,
      extraction_confidence: d.extraction_confidence,
      extraction_path: d.extraction_path,
      created_at: d.created_at,
      has_file: !!d.storage_path,
    }));
  }

  /**
   * Génère une URL signée à durée de vie courte (5 min) pour servir le
   * fichier original du bilan (PDF/image). Strictement scopée au tenant
   * + patient via assertPatient.
   */
  async getDocumentSignedUrl(
    tenant: TenantContext,
    patientId: string,
    docId: string,
  ): Promise<{
    url: string;
    mime_type: string | null;
    original_filename: string | null;
    expires_at: string;
  }> {
    await this.assertPatient(tenant, patientId);
    const { data: doc } = await this.db
      .from('med_lab_documents')
      .select('storage_path, mime_type, original_filename')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .eq('id', docId)
      .maybeSingle();
    if (!doc) {
      throw new NotFoundException('Document introuvable.');
    }
    if (!doc.storage_path) {
      throw new NotFoundException(
        'Aucun fichier source associé (document ancien ou texte collé).',
      );
    }
    const ttlSec = 300;
    const { data, error } = await this.supabase.client.storage
      .from('medos')
      .createSignedUrl(doc.storage_path, ttlSec);
    if (error || !data?.signedUrl) {
      throw new BadRequestException(
        `Erreur signature URL : ${error?.message ?? 'inconnue'}`,
      );
    }
    return {
      url: data.signedUrl,
      mime_type: doc.mime_type ?? null,
      original_filename: doc.original_filename ?? null,
      expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
    };
  }

  /**
   * Suppression GDPR d'un document de bilan : retire le fichier du Storage
   * et marque le document comme deleted (conserve la trace audit).
   */
  async deleteLabDocument(
    tenant: TenantContext,
    patientId: string,
    docId: string,
  ): Promise<{ deleted: boolean }> {
    await this.assertPatient(tenant, patientId);
    const { data: doc } = await this.db
      .from('med_lab_documents')
      .select('storage_path')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .eq('id', docId)
      .maybeSingle();
    if (!doc) {
      throw new NotFoundException('Document introuvable.');
    }
    if (doc.storage_path) {
      try {
        await this.supabase.client.storage
          .from('medos')
          .remove([doc.storage_path]);
      } catch (e: any) {
        this.logger.warn(
          `Suppression Storage échouée pour doc ${docId}: ${e?.message ?? e}`,
        );
      }
    }
    await this.db
      .from('med_lab_documents')
      .update({ status: 'deleted', storage_path: null })
      .eq('id', docId);
    return { deleted: true };
  }

  /**
   * Extraction texte natif d'un PDF via pdf-parse (chargement dynamique pour
   * éviter les soucis ESM/CJS au démarrage Nest).
   */
  private async extractPdfText(buffer: Buffer): Promise<string> {
    // Import dynamique : pdf-parse est ESM, et Nest compile en CJS.
    const mod: any = await import('pdf-parse');
    const PDFParse = mod?.PDFParse ?? mod?.default?.PDFParse ?? mod?.default;
    if (!PDFParse) {
      throw new Error('pdf-parse: PDFParse introuvable dans le module');
    }
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const res = await parser.getText();
      const text: string =
        (res && (res.text ?? res?.pages?.map((p: any) => p.text).join('\n'))) ??
        '';
      return text.trim();
    } finally {
      try {
        await parser.destroy?.();
      } catch {
        /* ignore */
      }
    }
  }

  /**
   * Rasterise un PDF scanné (sans texte natif) en PNG page par page.
   * Limité à `maxPages` (par défaut 3) pour borner coûts/latence Vision.
   * DPI 150 = bon compromis lisibilité OCR / taille image.
   */
  private async rasterizePdf(
    buffer: Buffer,
    maxPages = 3,
  ): Promise<Buffer[]> {
    const mod: any = await import('pdf-to-png-converter');
    const pdfToPng = mod?.pdfToPng ?? mod?.default?.pdfToPng ?? mod?.default;
    if (typeof pdfToPng !== 'function') {
      throw new Error(
        'pdf-to-png-converter: fonction pdfToPng introuvable dans le module',
      );
    }
    const pages: Array<{ content: Buffer }> = await pdfToPng(buffer, {
      viewportScale: 150 / 72, // 150 DPI (PDF base = 72 DPI).
      pagesToProcess: Array.from({ length: maxPages }, (_, i) => i + 1),
    });
    return (pages ?? []).map((p) => p.content).filter((b) => b && b.length > 0);
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

  // ── Roue de transformation (Module 2) ─────────────────────────────────
  private static WHEEL_DOMAINS = [
    'digestion', 'sleep', 'stress', 'energy', 'inflammation', 'immunity',
    'metabolism', 'hormones', 'physical_activity', 'cognition', 'environment', 'emotions',
  ];

  async getWheel(tenant: TenantContext, patientId: string): Promise<any> {
    await this.assertPatient(tenant, patientId);
    const { data } = await this.db
      .from('med_transformation_wheel')
      .select('domain,score,measured_at')
      .eq('patient_id', patientId)
      .order('measured_at', { ascending: false });
    const latest = new Map<string, any>();
    for (const r of data ?? []) if (!latest.has(r.domain)) latest.set(r.domain, r);
    return {
      domains: TwinService.WHEEL_DOMAINS.map((d) => ({ domain: d, score: latest.get(d)?.score ?? null })),
    };
  }

  async saveWheel(
    tenant: TenantContext,
    patientId: string,
    scores: Array<{ domain: string; score: number }>,
  ): Promise<any> {
    await this.assertPatient(tenant, patientId);
    const rows = scores
      .filter((s) => TwinService.WHEEL_DOMAINS.includes(s.domain) && s.score >= 0 && s.score <= 100)
      .map((s) => ({ tenant_id: tenant.id, patient_id: patientId, domain: s.domain, score: Math.round(s.score), source: 'questionnaire' }));
    if (rows.length > 0) await this.db.from('med_transformation_wheel').insert(rows);
    return this.getWheel(tenant, patientId);
  }

  // ── Timeline santé 360 (Module 21) ────────────────────────────────────
  async listEvents(tenant: TenantContext, patientId: string): Promise<any> {
    await this.assertPatient(tenant, patientId);
    const { data } = await this.db
      .from('med_health_events')
      .select('*')
      .eq('patient_id', patientId)
      .order('occurred_at', { ascending: false });
    return data ?? [];
  }

  async createEvent(
    tenant: TenantContext,
    patientId: string,
    body: { event_type: string; title: string; occurred_at: string; payload?: any },
  ): Promise<any> {
    await this.assertPatient(tenant, patientId);
    const { data, error } = await this.db
      .from('med_health_events')
      .insert({
        tenant_id: tenant.id,
        patient_id: patientId,
        event_type: body.event_type,
        title: body.title,
        occurred_at: body.occurred_at,
        payload: body.payload ?? {},
      })
      .select('*')
      .single();
    if (error) throw new NotFoundException(error.message);
    return data;
  }

  // ── Analyse longitudinale (Module 26) ─────────────────────────────────
  async getHistory(tenant: TenantContext, patientId: string): Promise<any> {
    await this.assertPatient(tenant, patientId);
    const [scores, biomarkers] = await Promise.all([
      this.db.from('med_organ_scores').select('organ_code,score,color,computed_at').eq('patient_id', patientId).order('computed_at', { ascending: true }),
      this.db.from('med_patient_biomarkers').select('biomarker_code,value,measured_at,flag').eq('patient_id', patientId).order('measured_at', { ascending: true }),
    ]);
    // Séries temporelles par organe.
    const organSeries: Record<string, Array<{ t: string; score: number }>> = {};
    for (const s of scores.data ?? []) {
      (organSeries[s.organ_code] = organSeries[s.organ_code] || []).push({ t: s.computed_at, score: s.score });
    }
    const biomarkerSeries: Record<string, Array<{ t: string; value: number }>> = {};
    for (const b of biomarkers.data ?? []) {
      (biomarkerSeries[b.biomarker_code] = biomarkerSeries[b.biomarker_code] || []).push({ t: b.measured_at, value: Number(b.value) });
    }
    return { organSeries, biomarkerSeries };
  }

  // ── Moteur de corrélations (Modules 9/17) — déterministe, graphe ──────
  async getCorrelations(tenant: TenantContext, patientId: string): Promise<any> {
    await this.assertPatient(tenant, patientId);
    const { biomarkers: refs } = await this.getReferential();
    const values = await this.listLatestBiomarkers(tenant, patientId);
    const flags = this.scoring.flagMap(refs, values);
    const abnormal = Object.entries(flags).filter(([, f]) => f !== 'normal').map(([c]) => c);
    const refByCode = new Map(refs.map((r) => [r.code, r]));

    // Corrélations biomarqueur anormal → organes impactés (depuis le référentiel).
    const bmOrgan = abnormal.flatMap((code) => {
      const ref = refByCode.get(code);
      return (ref?.organs ?? []).map((organ: string) => ({
        from: code, from_label: ref?.name_fr, to: organ, type: 'biomarker_organ', flag: flags[code],
      }));
    });

    // Chaînes du knowledge graph touchant les conditions/organes en jeu.
    const { edges } = await this.getGraph();
    const involvedOrgans = new Set(bmOrgan.map((x) => x.to));
    const graphChains = edges.filter((e: any) => involvedOrgans.has(e.from_code) || involvedOrgans.has(e.to_code));

    return { abnormal, biomarker_organ: bmOrgan, graph_chains: graphChains };
  }

  // ── Simulateur d'intervention (Module 23) — déterministe ──────────────
  async simulate(tenant: TenantContext, patientId: string, interventionKeys: string[]): Promise<any> {
    await this.assertPatient(tenant, patientId);
    const { organs, biomarkers } = await this.getReferential();
    const values = await this.listLatestBiomarkers(tenant, patientId);
    const result = this.simulation.simulate(organs.map((o) => o.code), biomarkers, values, interventionKeys);
    return { interventions: INTERVENTIONS, applied: interventionKeys, ...result };
  }

  // ── Projection temporelle du jumeau (projection-v1) — déterministe ─────
  /**
   * Projette le risque fonctionnel / l'espérance de vie sur plusieurs horizons
   * selon des scénarios de mode de vie. Modèle HEURISTIQUE TRANSPARENT, 100 %
   * déterministe (aucune IA). Toutes les données patient sont résolues
   * server-side via le patientId (le front n'envoie aucune donnée patient).
   */
  async projection(
    tenant: TenantContext,
    patientId: string,
    opts: { horizons_years?: number[]; scenario_keys?: string[]; horizon_focus?: number } = {},
  ): Promise<any> {
    const patient = await this.assertPatient(tenant, patientId);
    const { organs, biomarkers } = await this.getReferential();
    const values = await this.listLatestBiomarkers(tenant, patientId);
    const organScores = this.scoring.computeAllOrganScores(
      organs.map((o) => o.code),
      biomarkers,
      values,
    );
    const wheel = (await this.getWheel(tenant, patientId)).domains as Array<{
      domain: string;
      score: number | null;
    }>;

    const age = patient.date_of_birth
      ? Math.floor(
          (Date.now() - new Date(patient.date_of_birth).getTime()) / (365.25 * 864e5),
        )
      : null;
    const sex: 'female' | 'male' | null =
      patient.gender === 'female' || patient.gender === 'male' ? patient.gender : null;

    // ── Normalisation / bornage des entrées (ICI, pas dans le moteur pur) ──
    // Horizons : entiers, bornés 1..40, dédupliqués, triés, max 6 ; défaut [1,5,10,20].
    const rawHorizons = Array.isArray(opts.horizons_years) ? opts.horizons_years : [];
    let horizonsYears = Array.from(
      new Set(
        rawHorizons
          .map((h) => Math.round(Number(h)))
          .filter((h) => Number.isFinite(h) && h >= 1 && h <= 40),
      ),
    )
      .sort((a, b) => a - b)
      .slice(0, 6);
    if (horizonsYears.length === 0) horizonsYears = [1, 5, 10, 20];

    // Scénarios : sous-ensemble valide du catalogue ; défaut = status_quo + tous
    // les leviers ; status_quo TOUJOURS forcé présent.
    const validKeys = new Set(PROJECTION_SCENARIOS.map((s) => s.key));
    const requested = Array.isArray(opts.scenario_keys) ? opts.scenario_keys : null;
    let scenarioKeys: string[];
    if (requested && requested.length > 0) {
      scenarioKeys = requested.filter((k) => validKeys.has(k));
    } else {
      scenarioKeys = PROJECTION_SCENARIOS.map((s) => s.key);
    }
    if (!scenarioKeys.includes('status_quo')) scenarioKeys.unshift('status_quo');

    // Horizon focus : borné aux horizons disponibles ; défaut = max(horizons).
    const maxHorizon = horizonsYears[horizonsYears.length - 1];
    let horizonFocus = Math.round(Number(opts.horizon_focus));
    if (!Number.isFinite(horizonFocus) || horizonFocus <= 0) {
      horizonFocus = maxHorizon;
    } else {
      // Cale sur l'horizon disponible le plus proche (≤ focus, sinon le min).
      const eligible = horizonsYears.filter((h) => h <= horizonFocus);
      horizonFocus = eligible.length ? eligible[eligible.length - 1] : horizonsYears[0];
    }

    return {
      patient_id: patientId,
      generated_at: new Date().toISOString(),
      ...this.projectionSvc.project({
        age,
        sex,
        organScores,
        wheel,
        biomarkerCount: values.length,
        horizonsYears,
        scenarioKeys,
        horizonFocus,
      }),
      engine_version: PROJECTION_VERSION,
    };
  }

  // ── Root Cause Explorer (Module 16) — IA ──────────────────────────────
  async rootCause(tenant: TenantContext, userId: string, patientId: string): Promise<any> {
    const ctx = await this.buildAiContext(tenant, patientId);
    const started = Date.now();
    const { data: analysis } = await this.db
      .from('med_ai_analyses')
      .insert({ tenant_id: tenant.id, patient_id: patientId, kind: 'root_cause', status: 'generating', created_by: userId })
      .select('*')
      .single();
    try {
      const res = await this.ai.rootCause(ctx);
      await this.logAgentRun(tenant, patientId, analysis?.id ?? null, 'hypotheses', { model: res.model, tokens: res.tokens, latency_ms: Date.now() - started, output: res.data });
      await this.db.from('med_ai_analyses').update({ status: 'ready', output: res.data, models: { root_cause: res.model } }).eq('id', analysis.id);
      return { analysis_id: analysis.id, root_causes: res.data.root_causes ?? [] };
    } catch (e: any) {
      await this.db.from('med_ai_analyses').update({ status: 'failed', output: { error: e?.message } }).eq('id', analysis.id);
      throw e;
    }
  }

  // ── Conseil multi-agents (Module 33) — IA ─────────────────────────────
  async council(tenant: TenantContext, userId: string, patientId: string): Promise<any> {
    const ctx = await this.buildAiContext(tenant, patientId);
    const started = Date.now();
    const { data: analysis } = await this.db
      .from('med_ai_analyses')
      .insert({ tenant_id: tenant.id, patient_id: patientId, kind: 'council', status: 'generating', created_by: userId })
      .select('*')
      .single();
    try {
      const res = await this.ai.council(ctx);
      await this.logAgentRun(tenant, patientId, analysis?.id ?? null, 'consensus', { model: res.model, tokens: res.tokens, latency_ms: Date.now() - started, output: res.data });
      await this.db.from('med_ai_analyses').update({ status: 'ready', output: res.data, confidence: res.data.confidence ?? null, models: { council: res.model } }).eq('id', analysis.id);
      return { analysis_id: analysis.id, ...res.data };
    } catch (e: any) {
      await this.db.from('med_ai_analyses').update({ status: 'failed', output: { error: e?.message } }).eq('id', analysis.id);
      throw e;
    }
  }

  // ── Moteur scientifique (Module 15) — PubMed E-utilities ──────────────
  async scientificSearch(query: string): Promise<any> {
    const q = encodeURIComponent(query.slice(0, 200));
    try {
      const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=6&sort=relevance&term=${q}`;
      const sr = await fetch(searchUrl);
      if (!sr.ok) return { query, results: [], error: `PubMed ${sr.status}` };
      const sj: any = await sr.json();
      const ids: string[] = sj?.esearchresult?.idlist ?? [];
      if (ids.length === 0) return { query, results: [] };
      const sumUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`;
      const mr = await fetch(sumUrl);
      const mj: any = await mr.json();
      const results = ids.map((id) => {
        const r = mj?.result?.[id];
        return r
          ? { pmid: id, title: r.title, source: r.fulljournalname || r.source, year: (r.pubdate || '').slice(0, 4), url: `https://pubmed.ncbi.nlm.nih.gov/${id}/` }
          : null;
      }).filter(Boolean);
      return { query, results };
    } catch (e: any) {
      return { query, results: [], error: e?.message };
    }
  }
}
