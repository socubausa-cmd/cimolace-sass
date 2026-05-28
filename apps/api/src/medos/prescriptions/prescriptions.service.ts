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
import {
  CreatePrescriptionDto,
  CreatePrescriptionItemDto,
} from './dto/create-prescription.dto';
import { UpdatePrescriptionDto } from './dto/update-prescription.dto';
import { UpdatePrescriptionItemDto } from './dto/update-prescription-item.dto';

export type PrescriptionRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  practitioner_id: string;
  consultation_note_id: string | null;
  prescription_number: string | null;
  issued_at: string;
  validity_days: number;
  status: 'draft' | 'signed' | 'dispensed' | 'cancelled';
  patient_instructions: string | null;
  practitioner_notes: string | null;
  signed_at: string | null;
  signature_hash: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  pdf_url: string | null;
  created_at: string;
  updated_at: string;
};

export type PrescriptionItemRow = {
  id: string;
  tenant_id: string;
  prescription_id: string;
  position: number;
  drug_name: string;
  drug_code: string | null;
  dosage: string;
  frequency: string;
  duration: string;
  route: string | null;
  quantity: string | null;
  notes: string | null;
  is_substitutable: boolean;
  created_at: string;
};

export type PrescriptionWithItems = PrescriptionRow & {
  items: PrescriptionItemRow[];
};

@Injectable()
export class PrescriptionsService {
  private readonly logger = new Logger(PrescriptionsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ─── Audit log helper (cohérent avec MedosService.writeAudit) ────────────

  private async writeAudit(
    tenantId: string,
    actorId: string,
    resourceId: string | null,
    action: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await (this.supabase.client as any)
      .from('med_audit_log')
      .insert({
        tenant_id: tenantId,
        actor_id: actorId,
        resource: 'med_prescription',
        resource_id: resourceId,
        action,
        metadata: metadata ?? {},
      });
    if (error) {
      this.logger.error(
        `Audit log failed: med_prescription/${action} by ${actorId}`,
        error.message,
      );
      throw new InternalServerErrorException(
        "Échec de l'audit médical obligatoire — opération rejetée",
      );
    }
  }

  // ─── Helpers internes ────────────────────────────────────────────────────

  private async loadPrescriptionRow(
    tenantId: string,
    prescriptionId: string,
  ): Promise<PrescriptionRow> {
    const { data, error } = await this.supabase.client
      .from('med_prescriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', prescriptionId)
      .single();
    if (error || !data) {
      throw new NotFoundException('Ordonnance introuvable');
    }
    return data as unknown as PrescriptionRow;
  }

  private async loadItems(
    tenantId: string,
    prescriptionId: string,
  ): Promise<PrescriptionItemRow[]> {
    const { data, error } = await this.supabase.client
      .from('med_prescription_items')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('prescription_id', prescriptionId)
      .order('position', { ascending: true });
    if (error) {
      this.logger.error('loadItems', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return (data ?? []) as unknown as PrescriptionItemRow[];
  }

  private assertDraft(prescription: PrescriptionRow): void {
    if (prescription.status !== 'draft') {
      throw new BadRequestException(
        `Modification impossible : ordonnance en statut "${prescription.status}"`,
      );
    }
  }

  private async generatePrescriptionNumber(
    tenantId: string,
    tenantSlug: string,
  ): Promise<string> {
    const year = new Date().getFullYear();
    // Compte les prescriptions existantes pour ce tenant cette année
    const { count, error } = await (this.supabase.client as any)
      .from('med_prescriptions')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('prescription_number', 'is', null)
      .gte('issued_at', `${year}-01-01T00:00:00Z`)
      .lte('issued_at', `${year}-12-31T23:59:59Z`);
    if (error) {
      this.logger.warn(
        `generatePrescriptionNumber count failed: ${error.message}`,
      );
    }
    const seq = (count ?? 0) + 1;
    const prefix = (tenantSlug || 'TEN').slice(0, 6).toUpperCase();
    return `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
  }

  // ─── Create ──────────────────────────────────────────────────────────────

  async create(
    tenant: TenantContext,
    practitionerId: string,
    dto: CreatePrescriptionDto,
  ): Promise<PrescriptionWithItems> {
    // Vérifier que le patient existe et appartient au tenant
    const { data: patient, error: patErr } = await this.supabase.client
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('id', dto.patient_id)
      .single();
    if (patErr || !patient) {
      throw new NotFoundException('Patient introuvable');
    }

    // Créer l'entête
    const { data: prescription, error: pErr } = await this.supabase.client
      .from('med_prescriptions')
      .insert({
        tenant_id: tenant.id,
        patient_id: dto.patient_id,
        practitioner_id: practitionerId,
        consultation_note_id: dto.consultation_note_id ?? null,
        validity_days: dto.validity_days ?? 90,
        patient_instructions: dto.patient_instructions ?? null,
        practitioner_notes: dto.practitioner_notes ?? null,
        status: 'draft',
      } as any)
      .select('*')
      .single();

    if (pErr || !prescription) {
      this.logger.error('createPrescription', pErr?.message);
      throw new InternalServerErrorException(
        "Création de l'ordonnance impossible",
      );
    }

    const prescriptionRow = prescription as unknown as PrescriptionRow;
    let items: PrescriptionItemRow[] = [];

    // Insérer les items initiaux si fournis
    if (dto.items && dto.items.length > 0) {
      const itemRows = dto.items.map((item, index) =>
        this.itemToRow(tenant.id, prescriptionRow.id, item, index),
      );
      const { data: insertedItems, error: itemsErr } = await this.supabase
        .client.from('med_prescription_items')
        .insert(itemRows as any)
        .select('*');
      if (itemsErr) {
        this.logger.error('createPrescription items', itemsErr.message);
        throw new InternalServerErrorException(
          "Insertion des lignes d'ordonnance impossible",
        );
      }
      items = (insertedItems ?? []) as unknown as PrescriptionItemRow[];
    }

    await this.writeAudit(
      tenant.id,
      practitionerId,
      prescriptionRow.id,
      'create',
      { item_count: items.length },
    );

    return { ...prescriptionRow, items };
  }

  private itemToRow(
    tenantId: string,
    prescriptionId: string,
    dto: CreatePrescriptionItemDto,
    position: number,
  ) {
    return {
      tenant_id: tenantId,
      prescription_id: prescriptionId,
      position,
      drug_name: dto.drug_name,
      drug_code: dto.drug_code ?? null,
      dosage: dto.dosage,
      frequency: dto.frequency,
      duration: dto.duration,
      route: dto.route ?? null,
      quantity: dto.quantity ?? null,
      notes: dto.notes ?? null,
      is_substitutable: dto.is_substitutable ?? true,
    };
  }

  // ─── List ────────────────────────────────────────────────────────────────

  async list(
    tenant: TenantContext,
    filters: { patient_id?: string; status?: string } = {},
  ): Promise<PrescriptionRow[]> {
    let query = this.supabase.client
      .from('med_prescriptions')
      .select('*')
      .eq('tenant_id', tenant.id);
    if (filters.patient_id) query = query.eq('patient_id', filters.patient_id);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query.order('issued_at', { ascending: false });
    if (error) {
      this.logger.error('listPrescriptions', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return (data ?? []) as unknown as PrescriptionRow[];
  }

  // ─── Read one (with items) ───────────────────────────────────────────────

  async get(
    tenant: TenantContext,
    actorId: string,
    prescriptionId: string,
  ): Promise<PrescriptionWithItems> {
    const prescription = await this.loadPrescriptionRow(
      tenant.id,
      prescriptionId,
    );

    // Si l'appelant est un patient, vérifier qu'il accède à SA prescription
    if (tenant.userRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('id', prescription.patient_id)
        .single();
      if ((pat as any)?.patient_user_id !== actorId) {
        throw new ForbiddenException("Accès refusé à cette ordonnance");
      }
      if (prescription.status === 'draft') {
        throw new NotFoundException('Ordonnance introuvable');
      }
    }

    const items = await this.loadItems(tenant.id, prescriptionId);
    return { ...prescription, items };
  }

  // ─── Patient self-view ───────────────────────────────────────────────────

  async listForCurrentPatient(
    tenant: TenantContext,
    patientUserId: string,
  ): Promise<PrescriptionRow[]> {
    // Trouver le dossier patient du user
    const { data: pat, error: patErr } = await this.supabase.client
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('patient_user_id', patientUserId)
      .maybeSingle();
    if (patErr || !pat) {
      throw new NotFoundException('Aucun dossier patient pour cet utilisateur');
    }
    const { data, error } = await this.supabase.client
      .from('med_prescriptions')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', (pat as any).id)
      .in('status', ['signed', 'dispensed'])
      .order('issued_at', { ascending: false });
    if (error) {
      this.logger.error('listForCurrentPatient', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return (data ?? []) as unknown as PrescriptionRow[];
  }

  // ─── Update draft ────────────────────────────────────────────────────────

  async update(
    tenant: TenantContext,
    actorId: string,
    prescriptionId: string,
    dto: UpdatePrescriptionDto,
  ): Promise<PrescriptionRow> {
    const current = await this.loadPrescriptionRow(tenant.id, prescriptionId);
    this.assertDraft(current);

    const patch: Record<string, unknown> = {};
    if (dto.validity_days !== undefined) patch.validity_days = dto.validity_days;
    if (dto.patient_instructions !== undefined)
      patch.patient_instructions = dto.patient_instructions;
    if (dto.practitioner_notes !== undefined)
      patch.practitioner_notes = dto.practitioner_notes;

    if (Object.keys(patch).length === 0) {
      return current;
    }

    const { data, error } = await (this.supabase.client as any)
      .from('med_prescriptions')
      .update(patch)
      .eq('tenant_id', tenant.id)
      .eq('id', prescriptionId)
      .eq('status', 'draft')
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error('updatePrescription', error?.message);
      throw new InternalServerErrorException('Mise à jour impossible');
    }

    await this.writeAudit(tenant.id, actorId, prescriptionId, 'update');
    return data as unknown as PrescriptionRow;
  }

  // ─── Items ───────────────────────────────────────────────────────────────

  async addItem(
    tenant: TenantContext,
    actorId: string,
    prescriptionId: string,
    dto: CreatePrescriptionItemDto,
  ): Promise<PrescriptionItemRow> {
    const current = await this.loadPrescriptionRow(tenant.id, prescriptionId);
    this.assertDraft(current);

    const items = await this.loadItems(tenant.id, prescriptionId);
    const position = items.length;

    const { data, error } = await this.supabase.client
      .from('med_prescription_items')
      .insert(this.itemToRow(tenant.id, prescriptionId, dto, position) as any)
      .select('*')
      .single();
    if (error || !data) {
      throw new InternalServerErrorException("Ajout de ligne impossible");
    }

    await this.writeAudit(tenant.id, actorId, prescriptionId, 'add_item', {
      item_id: (data as any).id,
    });
    return data as unknown as PrescriptionItemRow;
  }

  async updateItem(
    tenant: TenantContext,
    actorId: string,
    prescriptionId: string,
    itemId: string,
    dto: UpdatePrescriptionItemDto,
  ): Promise<PrescriptionItemRow> {
    const current = await this.loadPrescriptionRow(tenant.id, prescriptionId);
    this.assertDraft(current);

    const patch: Record<string, unknown> = {};
    (
      [
        'position',
        'drug_name',
        'drug_code',
        'dosage',
        'frequency',
        'duration',
        'route',
        'quantity',
        'notes',
        'is_substitutable',
      ] as const
    ).forEach((k) => {
      if (dto[k] !== undefined) patch[k] = dto[k];
    });

    if (Object.keys(patch).length === 0) {
      const items = await this.loadItems(tenant.id, prescriptionId);
      const found = items.find((i) => i.id === itemId);
      if (!found) throw new NotFoundException('Ligne introuvable');
      return found;
    }

    const { data, error } = await (this.supabase.client as any)
      .from('med_prescription_items')
      .update(patch)
      .eq('tenant_id', tenant.id)
      .eq('prescription_id', prescriptionId)
      .eq('id', itemId)
      .select('*')
      .single();
    if (error || !data) {
      throw new NotFoundException('Ligne introuvable');
    }

    await this.writeAudit(tenant.id, actorId, prescriptionId, 'update_item', {
      item_id: itemId,
    });
    return data as unknown as PrescriptionItemRow;
  }

  async removeItem(
    tenant: TenantContext,
    actorId: string,
    prescriptionId: string,
    itemId: string,
  ): Promise<{ id: string }> {
    const current = await this.loadPrescriptionRow(tenant.id, prescriptionId);
    this.assertDraft(current);

    const { data, error } = await this.supabase.client
      .from('med_prescription_items')
      .delete()
      .eq('tenant_id', tenant.id)
      .eq('prescription_id', prescriptionId)
      .eq('id', itemId)
      .select('id')
      .maybeSingle();
    if (error || !data) {
      throw new NotFoundException('Ligne introuvable');
    }

    await this.writeAudit(tenant.id, actorId, prescriptionId, 'remove_item', {
      item_id: itemId,
    });
    return { id: (data as any).id };
  }

  // ─── Sign ────────────────────────────────────────────────────────────────

  async sign(
    tenant: TenantContext,
    practitionerId: string,
    prescriptionId: string,
  ): Promise<PrescriptionWithItems> {
    const current = await this.loadPrescriptionRow(tenant.id, prescriptionId);
    if (current.status !== 'draft') {
      throw new BadRequestException(
        `Signature impossible : ordonnance en statut "${current.status}"`,
      );
    }

    // Charger les items pour calculer le hash
    const items = await this.loadItems(tenant.id, prescriptionId);
    if (items.length === 0) {
      throw new BadRequestException(
        'Impossible de signer une ordonnance vide (aucune ligne)',
      );
    }

    // Génère le numéro et le hash de signature
    const number = await this.generatePrescriptionNumber(
      tenant.id,
      tenant.slug,
    );
    const signedAt = new Date().toISOString();

    const canonicalContent = JSON.stringify({
      prescription_id: current.id,
      tenant_id: current.tenant_id,
      patient_id: current.patient_id,
      practitioner_id: practitionerId,
      issued_at: current.issued_at,
      signed_at: signedAt,
      validity_days: current.validity_days,
      items: items.map((i) => ({
        drug_name: i.drug_name,
        drug_code: i.drug_code,
        dosage: i.dosage,
        frequency: i.frequency,
        duration: i.duration,
        route: i.route,
        quantity: i.quantity,
        is_substitutable: i.is_substitutable,
      })),
    });
    const signatureHash = createHash('sha256')
      .update(canonicalContent)
      .digest('hex');

    const { data, error } = await (this.supabase.client as any)
      .from('med_prescriptions')
      .update({
        status: 'signed',
        signed_at: signedAt,
        signature_hash: signatureHash,
        prescription_number: number,
      })
      .eq('tenant_id', tenant.id)
      .eq('id', prescriptionId)
      .eq('status', 'draft')
      .select('*')
      .single();
    if (error || !data) {
      throw new BadRequestException(
        'Signature impossible (concurrent modification ?)',
      );
    }

    await this.writeAudit(tenant.id, practitionerId, prescriptionId, 'sign', {
      prescription_number: number,
      signature_hash: signatureHash,
    });

    return {
      ...(data as unknown as PrescriptionRow),
      items,
    };
  }

  // ─── Cancel ──────────────────────────────────────────────────────────────

  async cancel(
    tenant: TenantContext,
    actorId: string,
    prescriptionId: string,
    reason: string,
  ): Promise<PrescriptionRow> {
    const current = await this.loadPrescriptionRow(tenant.id, prescriptionId);
    if (current.status === 'cancelled') {
      throw new BadRequestException('Ordonnance déjà annulée');
    }
    if (!reason || reason.trim().length < 3) {
      throw new BadRequestException(
        "Motif d'annulation obligatoire (3 caractères min)",
      );
    }

    const { data, error } = await (this.supabase.client as any)
      .from('med_prescriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason.trim(),
      })
      .eq('tenant_id', tenant.id)
      .eq('id', prescriptionId)
      .neq('status', 'cancelled')
      .select('*')
      .single();
    if (error || !data) {
      throw new InternalServerErrorException('Annulation impossible');
    }

    await this.writeAudit(tenant.id, actorId, prescriptionId, 'cancel', {
      reason: reason.trim(),
    });
    return data as unknown as PrescriptionRow;
  }
}
