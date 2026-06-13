import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';
import type { Request } from 'express';
import {
  CreateConsentDto,
  RequestAnonymizationDto,
  RequestExportDto,
} from './dto/gdpr.dto';

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private async checkPatientOwnership(
    patientId: string,
    userId: string,
  ): Promise<boolean> {
    const { data } = await this.supabase.client
      .from('med_patients')
      .select('patient_user_id')
      .eq('id', patientId)
      .single();
    return (data as any)?.patient_user_id === userId;
  }

  // ─── Consents ────────────────────────────────────────────────────────────

  async recordConsent(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    dto: CreateConsentDto,
    req: Request,
  ) {
    if (actorRole === 'patient') {
      const owns = await this.checkPatientOwnership(dto.patient_id, actorId);
      if (!owns) throw new ForbiddenException();
    }

    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      req.socket?.remoteAddress ??
      null;

    const { data, error } = await (this.supabase.client as any)
      .from('med_consent_records')
      .insert({
        tenant_id: tenant.id,
        patient_id: dto.patient_id,
        scope: dto.scope,
        granted: dto.granted,
        consent_text: dto.consent_text,
        consent_version: dto.consent_version,
        ip_address: ip,
        user_agent: req.headers['user-agent'] ?? null,
        signature_data: dto.signature_data ?? null,
        recorded_via: dto.recorded_via ?? 'web',
        related_form_response_id: dto.related_form_response_id ?? null,
      })
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error('recordConsent', error?.message);
      throw new InternalServerErrorException(
        "Enregistrement du consentement impossible",
      );
    }
    return data;
  }

  async listConsents(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    patientId: string,
  ) {
    if (actorRole === 'patient') {
      const owns = await this.checkPatientOwnership(patientId, actorId);
      if (!owns) throw new ForbiddenException();
    }

    const { data, error } = await this.supabase.client
      .from('med_consent_records')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('granted_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async revokeConsent(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    consentId: string,
  ) {
    const { data: existing } = await this.supabase.client
      .from('med_consent_records')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', consentId)
      .single();
    if (!existing) throw new NotFoundException('Consentement introuvable');

    if (actorRole === 'patient') {
      const owns = await this.checkPatientOwnership(
        (existing as any).patient_id,
        actorId,
      );
      if (!owns) throw new ForbiddenException();
    }

    const { data, error } = await (this.supabase.client as any)
      .from('med_consent_records')
      .update({ revoked_at: new Date().toISOString() })
      .eq('tenant_id', tenant.id)
      .eq('id', consentId)
      .is('revoked_at', null)
      .select('*')
      .single();
    if (error || !data) {
      throw new BadRequestException('Consentement déjà révoqué');
    }
    return data;
  }

  // ─── Exports ─────────────────────────────────────────────────────────────

  async requestExport(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    dto: RequestExportDto,
  ) {
    if (actorRole === 'patient') {
      const owns = await this.checkPatientOwnership(dto.patient_id, actorId);
      if (!owns) throw new ForbiddenException();
    }

    const { data, error } = await (this.supabase.client as any)
      .from('med_gdpr_exports')
      .insert({
        tenant_id: tenant.id,
        patient_id: dto.patient_id,
        requested_by: actorId,
        format: dto.format ?? 'json',
        scope: dto.scope ?? 'full',
        custom_scope: dto.custom_scope ?? null,
        status: 'pending',
      })
      .select('*')
      .single();
    if (error || !data) {
      throw new InternalServerErrorException(
        "Création de la demande d'export impossible",
      );
    }
    // TODO : déclencher un worker async pour générer l'export (Phase 2).
    // Pour le MVP, l'export se traite manuellement via apps/worker.
    return data;
  }

  /**
   * Génère immédiatement un payload d'export RGPD complet pour le patient
   * (Article 20 — droit à la portabilité).
   *
   * Tables incluses :
   *  • Identité — med_patients (PII complète : nom, email, naissance, etc.)
   *  • Médical — med_notes, med_prescriptions, med_programs,
   *    med_appointments, med_form_responses, med_attachments (métadonnées),
   *    med_consent_records, med_audit_log (filtré au patient).
   *  • Bio Digital Twin — bloc dédié :
   *      - med_patient_biomarkers   (toutes les mesures du patient)
   *      - med_organ_scores         (historique complet des scores d'organes)
   *      - med_transformation_wheel (roue de transformation 12 domaines)
   *      - med_health_events        (timeline santé 360)
   *      - med_alerts               (alertes, status != 'deleted')
   *      - med_hypotheses           (hypothèses cliniques générées)
   *      - med_ai_analyses          (analyses IA — output complet)
   *      - med_ai_agent_runs        (runs IA — model/tokens/latency/output,
   *        input_hash MASQUÉ pour préserver pseudonymisation des prompts)
   *      - med_lab_documents        (métadonnées + URL signées 24h si bonus
   *        activé. storage_path JAMAIS exposé.)
   *
   * Le payload est généré à la demande (pas de stockage persistant côté
   * med_gdpr_exports.result_jsonb : la colonne n'existe pas en MVP).
   *
   * Tenant-scoping : toutes les requêtes filtrent par tenant_id + patient_id.
   * RLS Supabase applique également la vérification côté DB.
   *
   * @param tenant    contexte tenant courant
   * @param patientId UUID du patient (med_patients.id)
   * @param scope     full | medical_only | administrative_only
   * @param opts.includeSignedUrls si true, génère des URLs signées 24h pour
   *                  les lab_documents avec storage_path non null.
   */
  async exportPatient(
    tenant: TenantContext,
    patientId: string,
    scope: 'full' | 'medical_only' | 'administrative_only' | 'custom' = 'full',
    opts: { includeSignedUrls?: boolean } = {},
  ): Promise<Record<string, unknown>> {
    const db: any = this.supabase.client;

    // ─── Identité (toujours incluse) ──────────────────────────────────
    const { data: patient, error: patientErr } = await db
      .from('med_patients')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', patientId)
      .maybeSingle();
    if (patientErr || !patient) {
      throw new NotFoundException('Patient introuvable pour ce tenant');
    }

    const includeMedical = scope === 'full' || scope === 'medical_only';
    const includeAdmin = scope === 'full' || scope === 'administrative_only';

    // ─── Médical (notes, prescriptions, programmes, RDV, formulaires) ─
    const medical: Record<string, any[]> = {
      notes: [],
      prescriptions: [],
      programs: [],
      appointments: [],
      form_responses: [],
      attachments: [],
    };
    if (includeMedical) {
      const [notes, prescriptions, programs, appts, formResponses, attachments] =
        await Promise.all([
          db
            .from('med_notes')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false }),
          db
            .from('med_prescriptions')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false }),
          db
            .from('med_programs')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false }),
          db
            .from('med_appointments')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('patient_id', patientId)
            .order('scheduled_at', { ascending: false }),
          db
            .from('med_form_responses')
            .select('*')
            .eq('tenant_id', tenant.id)
            .eq('patient_id', patientId)
            .order('submitted_at', { ascending: false }),
          db
            .from('med_attachments')
            .select(
              'id, file_name, mime_type, file_size_bytes, kind, created_at, uploaded_by',
            )
            .eq('tenant_id', tenant.id)
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false }),
        ]);
      medical.notes = notes.data ?? [];
      medical.prescriptions = prescriptions.data ?? [];
      medical.programs = programs.data ?? [];
      medical.appointments = appts.data ?? [];
      medical.form_responses = formResponses.data ?? [];
      medical.attachments = attachments.data ?? [];
    }

    // ─── Administratif (consentements, audit log) ─────────────────────
    const administrative: Record<string, any[]> = {
      consents: [],
      audit_log: [],
    };
    if (includeAdmin) {
      const [consents, audit] = await Promise.all([
        db
          .from('med_consent_records')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('patient_id', patientId)
          .order('granted_at', { ascending: false }),
        db
          .from('med_audit_log')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('resource_id', patientId)
          .order('created_at', { ascending: false })
          .limit(1000),
      ]);
      administrative.consents = consents.data ?? [];
      administrative.audit_log = audit.data ?? [];
    }

    // ─── Bio Digital Twin (bloc dédié — toujours présent en full) ─────
    const twin: Record<string, any> = {
      biomarkers: [],
      organ_scores: [],
      transformation_wheel: [],
      health_events: [],
      alerts: [],
      hypotheses: [],
      ai_analyses: [],
      ai_runs: [],
      lab_documents: [],
    };
    if (includeMedical) {
      const [
        biomarkers,
        organScores,
        wheel,
        events,
        alerts,
        hypotheses,
        aiAnalyses,
        aiRuns,
        labDocs,
      ] = await Promise.all([
        db
          .from('med_patient_biomarkers')
          .select(
            'id, biomarker_code, value, unit_raw, value_canonical, flag, measured_at, confidence, source, lab_document_id, created_at',
          )
          .eq('tenant_id', tenant.id)
          .eq('patient_id', patientId)
          .order('measured_at', { ascending: false }),
        db
          .from('med_organ_scores')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('patient_id', patientId)
          .order('computed_at', { ascending: false }),
        db
          .from('med_transformation_wheel')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('patient_id', patientId)
          .order('measured_at', { ascending: false }),
        db
          .from('med_health_events')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('patient_id', patientId)
          .order('occurred_at', { ascending: false }),
        db
          .from('med_alerts')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('patient_id', patientId)
          .neq('status', 'deleted')
          .order('created_at', { ascending: false }),
        db
          .from('med_hypotheses')
          .select('*')
          .eq('tenant_id', tenant.id)
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
        db
          .from('med_ai_analyses')
          .select(
            'id, kind, status, output, confidence, models, created_at, created_by',
          )
          .eq('tenant_id', tenant.id)
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
        db
          .from('med_ai_agent_runs')
          .select(
            'id, analysis_id, agent, prompt_version, model, tokens, latency_ms, error, created_at',
          )
          .eq('tenant_id', tenant.id)
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
        db
          .from('med_lab_documents')
          .select(
            'id, source_type, lab_name, status, mime_type, file_size_bytes, original_filename, page_count, extraction_model, extraction_confidence, extraction_path, created_at, storage_path',
          )
          .eq('tenant_id', tenant.id)
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
      ]);

      twin.biomarkers = biomarkers.data ?? [];
      twin.organ_scores = organScores.data ?? [];
      twin.transformation_wheel = wheel.data ?? [];
      twin.health_events = events.data ?? [];
      twin.alerts = alerts.data ?? [];
      twin.hypotheses = hypotheses.data ?? [];
      twin.ai_analyses = aiAnalyses.data ?? [];

      // ai_runs : on conserve model/tokens/latency/error mais on MASQUE
      // input_hash (pseudonymisation des prompts envoyés au LLM — ne doit
      // pas révéler le contenu original). prompt_version reste, c'est une
      // métadonnée de version, pas du PII.
      twin.ai_runs = (aiRuns.data ?? []).map((r: any) => ({
        id: r.id,
        analysis_id: r.analysis_id,
        agent: r.agent,
        prompt_version: r.prompt_version,
        model: r.model,
        tokens: r.tokens,
        latency_ms: r.latency_ms,
        error: r.error,
        created_at: r.created_at,
        // input_hash volontairement omis (anonymisation prompts IA).
      }));

      // lab_documents : on N'EXPOSE JAMAIS storage_path. À la place :
      //   - has_file (booléen)
      //   - signed_url + signed_url_expires_at (TTL 24h) si demandé.
      const TTL_24H = 60 * 60 * 24;
      const wantSigned = !!opts.includeSignedUrls;
      twin.lab_documents = await Promise.all(
        (labDocs.data ?? []).map(async (d: any) => {
          const base: Record<string, unknown> = {
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
            signed_url: null as string | null,
            signed_url_expires_at: null as string | null,
          };
          if (wantSigned && d.storage_path) {
            try {
              const { data: signed, error: signedErr } =
                await this.supabase.client.storage
                  .from('medos')
                  .createSignedUrl(d.storage_path, TTL_24H);
              if (!signedErr && signed?.signedUrl) {
                base.signed_url = signed.signedUrl;
                base.signed_url_expires_at = new Date(
                  Date.now() + TTL_24H * 1000,
                ).toISOString();
              }
            } catch (e: any) {
              this.logger.warn(
                `signedUrl failed for lab_doc ${d.id}: ${e?.message ?? e}`,
              );
            }
          }
          return base;
        }),
      );
    }

    return {
      meta: {
        tenant_id: tenant.id,
        tenant_slug: tenant.slug,
        patient_id: patientId,
        scope,
        generated_at: new Date().toISOString(),
        article: 'RGPD Art. 20 — Droit à la portabilité',
        twin_included: includeMedical,
        notes: [
          "Les analyses IA sont anonymisées côté prompt (input_hash masqué).",
          "Les chemins de stockage internes (storage_path) ne sont jamais exposés.",
        ],
      },
      patient,
      medical,
      administrative,
      twin: includeMedical ? twin : null,
    };
  }

  /**
   * Récupère le payload assemblé d'un export RGPD (Article 20). À la
   * différence de listExports, ce endpoint reconstruit dynamiquement les
   * données à partir des tables courantes (snapshot au moment de l'appel).
   *
   * Met également à jour le record med_gdpr_exports : status='ready',
   * processed_at=now() — pour traçabilité de l'export effectivement réalisé.
   */
  async getExportPayload(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    exportId: string,
    opts: { includeSignedUrls?: boolean } = {},
  ): Promise<{ export: any; payload: Record<string, unknown> }> {
    const { data: exportRow } = await this.supabase.client
      .from('med_gdpr_exports')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', exportId)
      .maybeSingle();
    if (!exportRow) {
      throw new NotFoundException("Export introuvable");
    }

    if (actorRole === 'patient') {
      const owns = await this.checkPatientOwnership(
        (exportRow as any).patient_id,
        actorId,
      );
      if (!owns) throw new ForbiddenException();
    }

    const payload = await this.exportPatient(
      tenant,
      (exportRow as any).patient_id,
      (exportRow as any).scope,
      opts,
    );

    // Mise à jour du record : on marque ready + processed_at, sans toucher
    // au file_url (les données sont retournées inline, pas via fichier).
    await (this.supabase.client as any)
      .from('med_gdpr_exports')
      .update({
        status: 'ready',
        processed_at: new Date().toISOString(),
        processed_by: actorId,
      })
      .eq('tenant_id', tenant.id)
      .eq('id', exportId);

    return { export: exportRow, payload };
  }

  async listExports(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    patientId?: string,
  ) {
    let q = this.supabase.client
      .from('med_gdpr_exports')
      .select('*')
      .eq('tenant_id', tenant.id);

    if (actorRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('patient_user_id', actorId)
        .maybeSingle();
      if (!pat) return [];
      q = q.eq('patient_id', (pat as any).id);
    } else if (patientId) {
      q = q.eq('patient_id', patientId);
    }

    const { data, error } = await q.order('requested_at', {
      ascending: false,
    });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  // ─── Anonymizations ──────────────────────────────────────────────────────

  /**
   * Démarre une demande d'anonymisation. Le traitement réel (UPDATE des
   * colonnes PII vers pseudonyme) est réservé au worker / staff Cimolace —
   * cet endpoint crée juste la trace de demande.
   *
   * En MVP : on ne fait QUE poser le record. L'exécution réelle de la
   * pseudonymisation est volontairement non-implémentée côté API publique
   * (trop risquée, nécessite double validation humaine).
   */
  async requestAnonymization(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    dto: RequestAnonymizationDto,
  ) {
    if (!dto.legal_basis || dto.legal_basis.trim().length < 10) {
      throw new BadRequestException(
        'legal_basis doit faire au moins 10 caractères',
      );
    }

    if (actorRole === 'patient') {
      const owns = await this.checkPatientOwnership(dto.patient_id, actorId);
      if (!owns) throw new ForbiddenException();
    }

    // Récupérer patient_user_id pour snapshot
    const { data: patient } = await this.supabase.client
      .from('med_patients')
      .select('patient_user_id')
      .eq('tenant_id', tenant.id)
      .eq('id', dto.patient_id)
      .single();
    if (!patient) throw new NotFoundException('Patient introuvable');

    // Génère un pseudonyme stable (hash tenant_id + patient_id)
    const pseudonym = `PATIENT_ANON_${createHash('sha256')
      .update(`${tenant.id}:${dto.patient_id}`)
      .digest('hex')
      .slice(0, 16)}`;

    const requestedRole =
      actorRole === 'patient'
        ? 'patient'
        : actorRole === 'clinic_admin'
          ? 'clinic_admin'
          : actorRole === 'owner'
            ? 'owner'
            : 'clinic_admin';

    const { data, error } = await (this.supabase.client as any)
      .from('med_gdpr_anonymizations')
      .insert({
        tenant_id: tenant.id,
        original_patient_id: dto.patient_id,
        original_patient_user_id: (patient as any).patient_user_id,
        pseudonym,
        requested_by: actorId,
        requested_by_role: requestedRole,
        legal_basis: dto.legal_basis.trim(),
        method: dto.method ?? 'pseudonymization',
        scope: dto.scope ?? 'full',
        status: 'pending',
      })
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error('requestAnonymization', error?.message);
      throw new InternalServerErrorException(
        "Demande d'anonymisation impossible",
      );
    }
    return data;
  }

  async listAnonymizations(tenant: TenantContext) {
    const { data, error } = await this.supabase.client
      .from('med_gdpr_anonymizations')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('requested_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /**
   * Read the MEDOS audit log for the tenant. Staff only — patient view of
   * their own audit trail would need a separate endpoint with filtering by
   * actor_id / resource_id.
   */
  async listAuditLog(
    tenant: TenantContext,
    opts: { limit?: number; resource?: string; action?: string; actor_id?: string } = {},
  ) {
    let q = this.supabase.client
      .from('med_audit_log')
      .select('*')
      .eq('tenant_id', tenant.id);
    if (opts.resource) q = q.eq('resource', opts.resource);
    if (opts.action) q = q.eq('action', opts.action);
    if (opts.actor_id) q = q.eq('actor_id', opts.actor_id);
    const { data, error } = await q
      .order('created_at', { ascending: false })
      .limit(opts.limit ?? 200);
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }
}
