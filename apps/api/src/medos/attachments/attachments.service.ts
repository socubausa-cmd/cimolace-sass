import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';
import {
  CreateAttachmentDto,
  UpdateAttachmentDto,
} from './dto/attachments.dto';

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Génère une URL signée pour upload direct depuis le frontend.
   * Le frontend pré-upload le fichier puis appelle POST /attachments avec
   * le storage_path retourné ici. Ça évite de passer les bytes par l'API.
   */
  async createUploadUrl(
    tenant: TenantContext,
    actorId: string,
    bucket: string = 'medos',
  ): Promise<{ upload_url: string; storage_path: string; bucket: string }> {
    const storagePath = `${tenant.id}/${actorId}/${crypto.randomUUID()}`;
    const { data, error } = await (this.supabase.client as any).storage
      .from(bucket)
      .createSignedUploadUrl(storagePath);
    if (error || !data) {
      this.logger.error('createSignedUploadUrl', error?.message);
      throw new InternalServerErrorException(
        `Création de l'URL d'upload impossible (bucket "${bucket}" manquant ?)`,
      );
    }
    return {
      upload_url: (data as any).signedUrl,
      storage_path: storagePath,
      bucket,
    };
  }

  /** Enregistre les métadonnées d'un fichier déjà uploadé via signed URL. */
  async register(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    dto: CreateAttachmentDto,
  ) {
    // Le patient ne peut attacher que sur son propre dossier
    if (actorRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('id', dto.patient_id)
        .single();
      if ((pat as any)?.patient_user_id !== actorId) {
        throw new ForbiddenException(
          'Vous ne pouvez attacher des fichiers que sur votre propre dossier',
        );
      }
    }

    const uploadedRole =
      actorRole === 'patient'
        ? 'patient'
        : actorRole === 'practitioner'
          ? 'practitioner'
          : actorRole === 'clinic_admin'
            ? 'clinic_admin'
            : actorRole === 'receptionist'
              ? 'receptionist'
              : 'practitioner';

    const { data, error } = await (this.supabase.client as any)
      .from('med_attachments')
      .insert({
        tenant_id: tenant.id,
        owner_type: dto.owner_type,
        owner_id: dto.owner_id,
        patient_id: dto.patient_id,
        file_name: dto.file_name,
        file_size_bytes: dto.file_size_bytes,
        mime_type: dto.mime_type,
        checksum_sha256: dto.checksum_sha256 ?? null,
        storage_bucket: dto.storage_bucket ?? 'medos',
        storage_path: dto.storage_path,
        is_phi: true,
        visible_to_patient:
          actorRole === 'patient' ? true : (dto.visible_to_patient ?? false),
        uploaded_by: actorId,
        uploaded_by_role: uploadedRole,
        category: dto.category ?? null,
        description: dto.description ?? null,
        taken_at: dto.taken_at ?? null,
      })
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error('registerAttachment', error?.message);
      throw new InternalServerErrorException(
        "Enregistrement de la pièce jointe impossible",
      );
    }
    return data;
  }

  async listByOwner(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    ownerType: string,
    ownerId: string,
  ) {
    let q = this.supabase.client
      .from('med_attachments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('owner_type', ownerType)
      .eq('owner_id', ownerId)
      .is('deleted_at', null);

    if (actorRole === 'patient') {
      q = q.eq('visible_to_patient', true);
      // Et restreindre au patient_id du user
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('patient_user_id', actorId)
        .maybeSingle();
      if (!pat) return [];
      q = q.eq('patient_id', (pat as any).id);
    }

    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async listForPatient(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    patientId: string,
  ) {
    if (actorRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('id', patientId)
        .single();
      if ((pat as any)?.patient_user_id !== actorId) {
        throw new ForbiddenException();
      }
    }

    let q = this.supabase.client
      .from('med_attachments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .is('deleted_at', null);
    if (actorRole === 'patient') q = q.eq('visible_to_patient', true);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  /** Signed download URL pour récupérer le binaire (1h validité). */
  async signedDownloadUrl(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    attachmentId: string,
  ): Promise<{ download_url: string; expires_in: number }> {
    const { data, error } = await this.supabase.client
      .from('med_attachments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', attachmentId)
      .is('deleted_at', null)
      .single();
    if (error || !data) throw new NotFoundException('Pièce jointe introuvable');

    const row = data as any;
    if (actorRole === 'patient') {
      if (!row.visible_to_patient) {
        throw new ForbiddenException('Cette pièce jointe ne vous est pas partagée');
      }
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('id', row.patient_id)
        .single();
      if ((pat as any)?.patient_user_id !== actorId) {
        throw new ForbiddenException();
      }
    }

    const { data: urlData, error: urlErr } = await (
      this.supabase.client as any
    ).storage
      .from(row.storage_bucket)
      .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS);
    if (urlErr || !urlData) {
      throw new InternalServerErrorException(
        `Signature URL impossible : ${urlErr?.message}`,
      );
    }
    return {
      download_url: (urlData as any).signedUrl,
      expires_in: SIGNED_URL_TTL_SECONDS,
    };
  }

  async update(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    attachmentId: string,
    dto: UpdateAttachmentDto,
  ) {
    if (actorRole === 'patient') {
      throw new ForbiddenException(
        'Le patient ne peut pas modifier les métadonnées (seulement supprimer)',
      );
    }
    const patch: Record<string, unknown> = {};
    (['description', 'category', 'visible_to_patient', 'is_archived'] as const).forEach(
      (k) => {
        if (dto[k] !== undefined) patch[k] = dto[k];
      },
    );
    if (dto.is_archived === true) patch.archived_at = new Date().toISOString();
    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Aucun champ à mettre à jour');
    }
    const { data, error } = await (this.supabase.client as any)
      .from('med_attachments')
      .update(patch)
      .eq('tenant_id', tenant.id)
      .eq('id', attachmentId)
      .select('*')
      .single();
    if (error || !data) throw new NotFoundException();
    return data;
  }

  /** Soft delete (RGPD : on garde la métadonnée pour traçabilité, on supprime le binaire). */
  async softDelete(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    attachmentId: string,
  ): Promise<{ id: string }> {
    const { data: existing } = await this.supabase.client
      .from('med_attachments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', attachmentId)
      .single();
    if (!existing) throw new NotFoundException();
    const row = existing as any;

    if (actorRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('id', row.patient_id)
        .single();
      if ((pat as any)?.patient_user_id !== actorId) {
        throw new ForbiddenException();
      }
      // Patient ne peut supprimer que ses propres uploads
      if (row.uploaded_by !== actorId) {
        throw new ForbiddenException(
          "Vous ne pouvez supprimer que les fichiers que vous avez uploadés",
        );
      }
    }

    // Supprimer le binaire dans le bucket
    try {
      await (this.supabase.client as any).storage
        .from(row.storage_bucket)
        .remove([row.storage_path]);
    } catch (err: any) {
      this.logger.warn(
        `Suppression binaire échouée (continuation) : ${err?.message}`,
      );
    }

    const { data, error } = await (this.supabase.client as any)
      .from('med_attachments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('tenant_id', tenant.id)
      .eq('id', attachmentId)
      .select('id')
      .maybeSingle();
    if (error || !data) throw new NotFoundException();
    return { id: (data as any).id };
  }
}
