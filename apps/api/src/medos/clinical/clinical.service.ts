import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { TenantContext } from '../../tenant/tenant.types';

/**
 * Service générique pour les 5 listes cliniques :
 *  - allergies   → med_allergies
 *  - medications → med_medications
 *  - problems    → med_problems
 *  - immunizations → med_immunizations
 *  - lab_results → med_lab_results
 *
 * Toutes les listes partagent un même squelette (CRUD + isolation tenant +
 * filtre par patient). On factorise via un service paramétré par `table`.
 */

export type ClinicalTable =
  | 'med_allergies'
  | 'med_medications'
  | 'med_problems'
  | 'med_immunizations'
  | 'med_lab_results';

const RESOURCE_LABEL: Record<ClinicalTable, string> = {
  med_allergies: 'allergie',
  med_medications: 'médicament',
  med_problems: 'problème',
  med_immunizations: 'vaccination',
  med_lab_results: 'résultat de laboratoire',
};

@Injectable()
export class ClinicalListsService {
  private readonly logger = new Logger(ClinicalListsService.name);

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

  async create(
    table: ClinicalTable,
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    payload: Record<string, unknown>,
  ) {
    if (!payload.patient_id) {
      throw new InternalServerErrorException(
        'patient_id requis pour les listes cliniques',
      );
    }

    if (actorRole === 'patient') {
      const owns = await this.checkPatientOwnership(
        payload.patient_id as string,
        actorId,
      );
      if (!owns) {
        throw new ForbiddenException(
          'Vous ne pouvez créer une entrée que sur votre propre dossier',
        );
      }
    }

    // Champs communs auto-renseignés selon le rôle
    const enriched: Record<string, unknown> = {
      ...payload,
      tenant_id: tenant.id,
    };

    // Pour allergies & medications & immunizations : tracer la source
    if (table === 'med_allergies' || table === 'med_medications') {
      if (enriched.recorded_by === undefined) {
        enriched.recorded_by = actorId;
      }
      if (enriched.recorded_by_role === undefined) {
        enriched.recorded_by_role =
          actorRole === 'patient' ? 'patient' : 'practitioner';
      }
    }
    if (table === 'med_immunizations' && enriched.administered_by === undefined) {
      enriched.administered_by = actorRole === 'patient' ? null : actorId;
    }
    if (table === 'med_lab_results' && enriched.prescribed_by === undefined) {
      enriched.prescribed_by = actorRole === 'patient' ? null : actorId;
    }
    if (table === 'med_problems' && enriched.diagnosed_by === undefined) {
      enriched.diagnosed_by = actorId;
    }

    const { data, error } = await (this.supabase.client as any)
      .from(table)
      .insert(enriched)
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error(`create ${table}`, error?.message);
      throw new InternalServerErrorException(
        `Création de la ${RESOURCE_LABEL[table]} impossible`,
      );
    }
    return data;
  }

  async listForPatient(
    table: ClinicalTable,
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    patientId: string,
  ) {
    if (actorRole === 'patient') {
      const owns = await this.checkPatientOwnership(patientId, actorId);
      if (!owns) {
        throw new ForbiddenException("Accès refusé à ce dossier");
      }
    }

    const orderColumn =
      table === 'med_lab_results'
        ? 'taken_at'
        : table === 'med_immunizations'
          ? 'administered_on'
          : 'created_at';

    const { data, error } = await this.supabase.client
      .from(table)
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order(orderColumn, { ascending: false });
    if (error) throw new InternalServerErrorException(error.message);
    return data ?? [];
  }

  async update(
    table: ClinicalTable,
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    entryId: string,
    patch: Record<string, unknown>,
  ) {
    // Charger pour vérifier ownership
    const { data: existing, error: loadErr } = await this.supabase.client
      .from(table)
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', entryId)
      .single();
    if (loadErr || !existing)
      throw new NotFoundException(`${RESOURCE_LABEL[table]} introuvable`);

    if (actorRole === 'patient') {
      const owns = await this.checkPatientOwnership(
        (existing as any).patient_id,
        actorId,
      );
      if (!owns) {
        throw new ForbiddenException("Modification refusée");
      }
      // Patient ne peut pas modifier tenant_id ou patient_id
      delete patch.tenant_id;
      delete patch.patient_id;
    }

    if (Object.keys(patch).length === 0) return existing;

    const { data, error } = await (this.supabase.client as any)
      .from(table)
      .update(patch)
      .eq('tenant_id', tenant.id)
      .eq('id', entryId)
      .select('*')
      .single();
    if (error || !data)
      throw new NotFoundException(`${RESOURCE_LABEL[table]} introuvable`);
    return data;
  }

  async remove(
    table: ClinicalTable,
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    entryId: string,
  ): Promise<{ id: string }> {
    // Ownership check
    const { data: existing } = await this.supabase.client
      .from(table)
      .select('patient_id')
      .eq('tenant_id', tenant.id)
      .eq('id', entryId)
      .single();
    if (!existing) throw new NotFoundException();

    if (actorRole === 'patient') {
      const owns = await this.checkPatientOwnership(
        (existing as any).patient_id,
        actorId,
      );
      if (!owns) throw new ForbiddenException();
    }

    const { data, error } = await (this.supabase.client as any)
      .from(table)
      .delete()
      .eq('tenant_id', tenant.id)
      .eq('id', entryId)
      .select('id')
      .maybeSingle();
    if (error || !data) throw new NotFoundException();
    return { id: (data as any).id };
  }
}
