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
