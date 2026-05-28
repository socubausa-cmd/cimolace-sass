import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import type { CreatePatientDto } from './dto/create-patient.dto';
import type { UpdatePatientDto } from './dto/update-patient.dto';
import type { CreateNoteDto } from './dto/create-note.dto';
import type { UpdateNoteDto } from './dto/update-note.dto';

// Types internes
type MedPatientRow = {
  id: string;
  tenant_id: string;
  patient_user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: string | null;
  blood_type: string | null;
  allergies: unknown;
  chronic_conditions: unknown;
  current_medications: unknown;
  medical_history: unknown;
  family_history: unknown;
  emergency_contact: unknown;
  insurance_info: unknown;
  consent_given: boolean;
  consent_date: string | null;
  consent_purpose: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type MedNoteRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  practitioner_id: string;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  free_text: string | null;
  ai_transcript: string | null;
  ai_draft: string | null;
  ai_summary: string | null;
  icd10_codes: unknown;
  is_shared_with_patient: boolean;
  is_signed: boolean;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
  patient_read_at?: string | null;
};

type MedNoteReadRow = {
  note_id: string;
  read_at: string;
};

const STAFF_ROLES = ['practitioner', 'clinic_admin'] as readonly string[];
const PATIENT_LIST_ROLES = [
  'practitioner',
  'clinic_admin',
  'receptionist',
] as readonly string[];

@Injectable()
export class MedosService {
  private readonly logger = new Logger(MedosService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // -----------------------------------------------------------------------
  // Audit helper — log obligatoire sur chaque mutation
  // -----------------------------------------------------------------------

  private async writeAudit(
    tenantId: string,
    actorId: string,
    resource: string,
    resourceId: string,
    action: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabase.client.from('med_audit_log').insert({
      tenant_id: tenantId,
      actor_id: actorId,
      resource,
      resource_id: resourceId,
      action,
      metadata: (metadata ?? {}) as any,
    } as any);

    if (error) {
      this.logger.error(
        `Audit log failed: ${resource}/${action} by ${actorId}`,
        error.message,
      );
      throw new InternalServerErrorException(
        'Échec de l\'audit médical obligatoire — opération rejetée',
      );
    }
  }

  // -----------------------------------------------------------------------
  // Patients
  // -----------------------------------------------------------------------

  async createPatient(
    tenant: TenantContext,
    actorId: string,
    dto: CreatePatientDto,
  ): Promise<MedPatientRow> {
    const { data, error } = await this.supabase.client
      .from('med_patients')
      .insert({
        tenant_id: tenant.id,
        patient_user_id: dto.patient_user_id,
        first_name: dto.first_name,
        last_name: dto.last_name,
        date_of_birth: dto.date_of_birth ?? null,
        gender: dto.gender ?? null,
        blood_type: dto.blood_type ?? null,
        allergies: (dto.allergies ?? []) as any,
        chronic_conditions: (dto.chronic_conditions ?? []) as any,
        current_medications: (dto.current_medications ?? []) as any,
        medical_history: (dto.medical_history ?? {}) as any,
        family_history: (dto.family_history ?? {}) as any,
        emergency_contact: (dto.emergency_contact ?? null) as any,
        insurance_info: (dto.insurance_info ?? null) as any,
        consent_given: dto.consent_given ?? false,
        consent_purpose: dto.consent_purpose ?? null,
        consent_date: dto.consent_given ? new Date().toISOString() : null,
      } as any)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(
          'Un dossier existe déjà pour ce patient dans ce tenant',
        );
      }
      this.logger.error('createPatient', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    await this.writeAudit(
      tenant.id,
      actorId,
      'med_patient',
      (data as any).id,
      'create',
    );
    return data as unknown as MedPatientRow;
  }

  async listPatients(
    tenant: TenantContext,
  ): Promise<MedPatientRow[]> {
    const { data, error } = await this.supabase.client
      .from('med_patients')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('last_name', { ascending: true });

    if (error) {
      this.logger.error('listPatients', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return (data ?? []) as unknown as MedPatientRow[];
  }

  async getPatient(
    tenant: TenantContext,
    actorId: string,
    patientId: string,
  ): Promise<MedPatientRow> {
    const { data, error } = await this.supabase.client
      .from('med_patients')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', patientId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Patient introuvable');
    }

    // Vérification supplémentaire : un patient ne peut voir que son propre dossier
    if (tenant.userRole === 'patient') {
      const record = data as unknown as MedPatientRow;
      if (record.patient_user_id !== actorId) {
        throw new ForbiddenException('Accès refusé à ce dossier patient');
      }
    }

    await this.writeAudit(
      tenant.id,
      actorId,
      'med_patient',
      patientId,
      'view',
    );
    return data as unknown as MedPatientRow;
  }

  async updatePatient(
    tenant: TenantContext,
    actorId: string,
    patientId: string,
    dto: UpdatePatientDto,
  ): Promise<MedPatientRow> {
    const patch: Record<string, unknown> = {};
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.date_of_birth !== undefined) patch.date_of_birth = dto.date_of_birth;
    if (dto.gender !== undefined) patch.gender = dto.gender;
    if (dto.blood_type !== undefined) patch.blood_type = dto.blood_type;
    if (dto.allergies !== undefined) patch.allergies = dto.allergies;
    if (dto.chronic_conditions !== undefined)
      patch.chronic_conditions = dto.chronic_conditions;
    if (dto.current_medications !== undefined)
      patch.current_medications = dto.current_medications;
    if (dto.medical_history !== undefined)
      patch.medical_history = dto.medical_history;
    if (dto.family_history !== undefined)
      patch.family_history = dto.family_history;
    if (dto.emergency_contact !== undefined)
      patch.emergency_contact = dto.emergency_contact;
    if (dto.insurance_info !== undefined)
      patch.insurance_info = dto.insurance_info;
    if (dto.consent_given !== undefined) {
      patch.consent_given = dto.consent_given;
      if (dto.consent_given) patch.consent_date = new Date().toISOString();
    }
    if (dto.consent_purpose !== undefined)
      patch.consent_purpose = dto.consent_purpose;

    const { data, error } = await this.supabase.client
      .from('med_patients')
      .update(patch as any)
      .eq('tenant_id', tenant.id)
      .eq('id', patientId)
      .select('*')
      .single();

    if (error || !data) {
      throw new NotFoundException('Patient introuvable');
    }

    await this.writeAudit(
      tenant.id,
      actorId,
      'med_patient',
      patientId,
      'update',
      { changed_fields: Object.keys(patch) },
    );
    return data as unknown as MedPatientRow;
  }

  // -----------------------------------------------------------------------
  // Consultation Notes
  // -----------------------------------------------------------------------

  async createNote(
    tenant: TenantContext,
    actorId: string,
    patientId: string,
    dto: CreateNoteDto,
  ): Promise<MedNoteRow> {
    // Vérifier que le patient existe dans ce tenant
    const { data: patient, error: patientErr } = await this.supabase.client
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('id', patientId)
      .single();

    if (patientErr || !patient) {
      throw new NotFoundException('Patient introuvable');
    }

    const { data, error } = await this.supabase.client
      .from('med_consultation_notes')
      .insert({
        tenant_id: tenant.id,
        patient_id: patientId,
        practitioner_id: actorId,
        subjective: dto.subjective ?? null,
        objective: dto.objective ?? null,
        assessment: dto.assessment ?? null,
        plan: dto.plan ?? null,
        free_text: dto.free_text ?? null,
        icd10_codes: (dto.icd10_codes ?? []) as any,
      } as any)
      .select('*')
      .single();

    if (error) {
      this.logger.error('createNote', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    await this.writeAudit(
      tenant.id,
      actorId,
      'med_consultation_note',
      (data as any).id,
      'create',
      { patient_id: patientId },
    );
    return data as unknown as MedNoteRow;
  }

  async listPatientSharedNotes(
    tenant: TenantContext,
    actorId: string,
  ): Promise<MedNoteRow[]> {
    // Trouver le dossier patient lié à l'utilisateur connecté dans ce tenant
    const { data: patient, error: patientErr } = await this.supabase.client
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('patient_user_id', actorId)
      .single();

    if (patientErr || !patient) {
      throw new NotFoundException(
        'Aucun dossier patient trouvé pour cet utilisateur',
      );
    }

    const { data, error } = await this.supabase.client
      .from('med_consultation_notes')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', (patient as any).id)
      .eq('is_shared_with_patient', true)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('listPatientSharedNotes', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    const notes = (data ?? []) as unknown as MedNoteRow[];
    const noteIds = notes.map((note) => note.id);
    if (noteIds.length === 0) return notes;

    const { data: reads, error: readsError } = await this.supabase.client
      .from('med_note_reads')
      .select('note_id, read_at')
      .eq('tenant_id', tenant.id)
      .eq('patient_user_id', actorId)
      .in('note_id', noteIds);

    if (readsError) {
      this.logger.warn(
        `listPatientSharedNotes read status unavailable: ${readsError.message}`,
      );
      return notes;
    }

    const readByNoteId = new Map(
      ((reads ?? []) as unknown as MedNoteReadRow[]).map((read) => [
        read.note_id,
        read.read_at,
      ]),
    );

    return notes.map((note) => ({
      ...note,
      patient_read_at: readByNoteId.get(note.id) ?? null,
    }));
  }

  async markSharedNoteRead(
    tenant: TenantContext,
    actorId: string,
    noteId: string,
  ): Promise<{ note_id: string; read_at: string }> {
    const { data: patient, error: patientErr } = await this.supabase.client
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('patient_user_id', actorId)
      .single();

    if (patientErr || !patient) {
      throw new NotFoundException(
        'Aucun dossier patient trouvé pour cet utilisateur',
      );
    }

    const patientId = (patient as { id: string }).id;
    const { data: note, error: noteErr } = await this.supabase.client
      .from('med_consultation_notes')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('id', noteId)
      .eq('patient_id', patientId)
      .eq('is_shared_with_patient', true)
      .single();

    if (noteErr || !note) {
      throw new NotFoundException('Note partagée introuvable');
    }

    const readAt = new Date().toISOString();
    const { data, error } = await this.supabase.client
      .from('med_note_reads')
      .upsert(
        {
          tenant_id: tenant.id,
          note_id: noteId,
          patient_user_id: actorId,
          read_at: readAt,
        } as any,
        { onConflict: 'tenant_id,note_id,patient_user_id' } as any,
      )
      .select('note_id, read_at')
      .single();

    if (error) {
      this.logger.error('markSharedNoteRead', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    await this.writeAudit(
      tenant.id,
      actorId,
      'med_consultation_note',
      noteId,
      'read_ack',
    );

    return data as unknown as { note_id: string; read_at: string };
  }

  async listNotes(
    tenant: TenantContext,
    patientId: string,
  ): Promise<MedNoteRow[]> {
    const { data, error } = await this.supabase.client
      .from('med_consultation_notes')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('listNotes', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return (data ?? []) as unknown as MedNoteRow[];
  }

  async updateNote(
    tenant: TenantContext,
    actorId: string,
    noteId: string,
    dto: UpdateNoteDto,
  ): Promise<MedNoteRow> {
    // Vérifier que la note existe et n'est pas signée
    const { data: existing, error: fetchErr } = await this.supabase.client
      .from('med_consultation_notes')
      .select('id, is_signed')
      .eq('tenant_id', tenant.id)
      .eq('id', noteId)
      .single();

    if (fetchErr || !existing) {
      throw new NotFoundException('Note introuvable');
    }

    if ((existing as any).is_signed) {
      throw new BadRequestException(
        'Impossible de modifier une note signée',
      );
    }

    const patch: Record<string, unknown> = {};
    if (dto.subjective !== undefined) patch.subjective = dto.subjective;
    if (dto.objective !== undefined) patch.objective = dto.objective;
    if (dto.assessment !== undefined) patch.assessment = dto.assessment;
    if (dto.plan !== undefined) patch.plan = dto.plan;
    if (dto.free_text !== undefined) patch.free_text = dto.free_text;
    if (dto.icd10_codes !== undefined) patch.icd10_codes = dto.icd10_codes;

    const { data, error } = await this.supabase.client
      .from('med_consultation_notes')
      .update(patch as any)
      .eq('tenant_id', tenant.id)
      .eq('id', noteId)
      .select('*')
      .single();

    if (error || !data) {
      throw new NotFoundException('Note introuvable');
    }

    await this.writeAudit(
      tenant.id,
      actorId,
      'med_consultation_note',
      noteId,
      'update',
    );
    return data as unknown as MedNoteRow;
  }

  async signNote(
    tenant: TenantContext,
    actorId: string,
    noteId: string,
  ): Promise<MedNoteRow> {
    // Vérifier que la note existe et n'est pas déjà signée
    const { data: existing, error: fetchErr } = await this.supabase.client
      .from('med_consultation_notes')
      .select('id, is_signed')
      .eq('tenant_id', tenant.id)
      .eq('id', noteId)
      .single();

    if (fetchErr || !existing) {
      throw new NotFoundException('Note introuvable');
    }

    if ((existing as any).is_signed) {
      throw new BadRequestException('Cette note est déjà signée');
    }

    const { data, error } = await this.supabase.client
      .from('med_consultation_notes')
      .update(({
        is_signed: true,
        signed_at: new Date().toISOString(),
      } as any))
      .eq('tenant_id', tenant.id)
      .eq('id', noteId)
      .select('*')
      .single();

    if (error || !data) {
      throw new NotFoundException('Note introuvable');
    }

    await this.writeAudit(
      tenant.id,
      actorId,
      'med_consultation_note',
      noteId,
      'sign',
    );
    return data as unknown as MedNoteRow;
  }

  async shareNote(
    tenant: TenantContext,
    actorId: string,
    noteId: string,
    shared: boolean,
  ): Promise<MedNoteRow> {
    const { data, error } = await this.supabase.client
      .from('med_consultation_notes')
      .update({
        is_shared_with_patient: shared,
      } as any)
      .eq('tenant_id', tenant.id)
      .eq('id', noteId)
      .select('*')
      .single();

    if (error || !data) {
      throw new NotFoundException('Note introuvable');
    }

    await this.writeAudit(
      tenant.id,
      actorId,
      'med_consultation_note',
      noteId,
      shared ? 'share' : 'unshare',
    );
    return data as unknown as MedNoteRow;
  }

  // -----------------------------------------------------------------------
  // Medical Forms
  // -----------------------------------------------------------------------

  async listForms(tenant: TenantContext) {
    const { data, error } = await this.supabase.client
      .from('med_medical_forms')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('listForms', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return (data ?? []) as unknown as Record<string, unknown>[];
  }

  async createForm(
    tenant: TenantContext,
    actorId: string,
    dto: Record<string, unknown>,
  ) {
    const { data, error } = await this.supabase.client
      .from('med_medical_forms')
      .insert({
        tenant_id: tenant.id,
        title: dto.title,
        description: dto.description ?? null,
        category: dto.category ?? 'custom',
        fields: (dto.fields ?? []) as any,
        is_template: dto.is_template ?? false,
        send_before_days: dto.send_before_days ?? null,
      } as any)
      .select('*')
      .single();

    if (error) {
      this.logger.error('createForm', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    await this.writeAudit(tenant.id, actorId, 'med_form', (data as any).id, 'create');
    return data as unknown as Record<string, unknown>;
  }

  async getForm(tenant: TenantContext, formId: string) {
    const { data, error } = await this.supabase.client
      .from('med_medical_forms')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', formId)
      .single();

    if (error || !data) throw new NotFoundException('Formulaire introuvable');
    return data as unknown as Record<string, unknown>;
  }

  async submitFormResponse(
    tenant: TenantContext,
    actorId: string,
    formId: string,
    dto: { patient_id: string; responses: Record<string, unknown> },
  ) {
    // Vérifier que le patient existe
    const { data: patient } = await this.supabase.client
      .from('med_patients')
      .select('id, patient_user_id')
      .eq('tenant_id', tenant.id)
      .eq('id', dto.patient_id)
      .single();

    if (!patient) throw new NotFoundException('Patient introuvable');

    // Un patient ne peut soumettre que pour son propre dossier
    if (tenant.userRole === 'patient' && (patient as any).patient_user_id !== actorId) {
      throw new ForbiddenException('Vous ne pouvez soumettre un formulaire que pour votre propre dossier');
    }

    const { data, error } = await this.supabase.client
      .from('med_form_responses')
      .insert({
        tenant_id: tenant.id,
        form_id: formId,
        patient_id: dto.patient_id,
        submitted_by: actorId,
        responses: dto.responses as any,
      } as any)
      .select('*')
      .single();

    if (error) {
      this.logger.error('submitFormResponse', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    await this.writeAudit(tenant.id, actorId, 'med_form_response', (data as any).id, 'submit');
    return data as unknown as Record<string, unknown>;
  }

  async getFormResponses(tenant: TenantContext, formId: string) {
    const { data, error } = await this.supabase.client
      .from('med_form_responses')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false });

    if (error) {
      this.logger.error('getFormResponses', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return (data ?? []) as unknown as Record<string, unknown>[];
  }

  // -----------------------------------------------------------------------
  // Health Entries
  // -----------------------------------------------------------------------

  async createHealthEntry(
    tenant: TenantContext,
    actorId: string,
    dto: Record<string, unknown>,
  ) {
    const patientId = dto.patient_id as string;
    // Vérifier que le patient existe
    const { data: patient } = await this.supabase.client
      .from('med_patients')
      .select('id, patient_user_id')
      .eq('tenant_id', tenant.id)
      .eq('id', patientId)
      .single();

    if (!patient) throw new NotFoundException('Patient introuvable');

    // Un patient ne peut créer que ses propres entrées
    if (tenant.userRole === 'patient' && (patient as any).patient_user_id !== actorId) {
      throw new ForbiddenException('Accès refusé');
    }

    const { data, error } = await this.supabase.client
      .from('med_health_entries')
      .insert({
        tenant_id: tenant.id,
        patient_id: patientId,
        entry_date: dto.entry_date ?? new Date().toISOString().split('T')[0],
        entry_type: dto.entry_type ?? 'custom',
        mood_score: dto.mood_score ?? null,
        energy_level: dto.energy_level ?? null,
        sleep_hours: dto.sleep_hours ?? null,
        sleep_quality: dto.sleep_quality ?? null,
        weight_kg: dto.weight_kg ?? null,
        blood_pressure_systolic: dto.blood_pressure_systolic ?? null,
        blood_pressure_diastolic: dto.blood_pressure_diastolic ?? null,
        heart_rate: dto.heart_rate ?? null,
        blood_glucose: dto.blood_glucose ?? null,
        temperature: dto.temperature ?? null,
        meal_photos: (dto.meal_photos ?? []) as any,
        food_notes: dto.food_notes ?? null,
        water_liters: dto.water_liters ?? null,
        steps: dto.steps ?? null,
        exercise_minutes: dto.exercise_minutes ?? null,
        symptoms: (dto.symptoms ?? []) as any,
        notes: dto.notes ?? null,
      } as any)
      .select('*')
      .single();

    if (error) {
      this.logger.error('createHealthEntry', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    await this.writeAudit(tenant.id, actorId, 'med_health_entry', (data as any).id, 'create');
    return data as unknown as Record<string, unknown>;
  }

  async getHealthEntries(tenant: TenantContext, patientId: string) {
    // Un patient ne peut voir que ses propres entrées
    if (tenant.userRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('tenant_id', tenant.id)
        .eq('id', patientId)
        .single();
      // patient_user_id sera vérifié via l'auth context (actorId) — géré côté controller
    }

    const { data, error } = await this.supabase.client
      .from('med_health_entries')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('entry_date', { ascending: false });

    if (error) {
      this.logger.error('getHealthEntries', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return (data ?? []) as unknown as Record<string, unknown>[];
  }

  // -----------------------------------------------------------------------
  // Patient self-service — health journal
  // -----------------------------------------------------------------------

  /**
   * Resolve the med_patients row for the logged-in patient.
   * Returns null when the patient has no dossier yet in this tenant
   * (covers the case where the patient signed up but the doctor hasn't
   * created their record).
   */
  private async findPatientByUser(
    tenantId: string,
    userId: string,
  ): Promise<{ id: string } | null> {
    const { data } = await this.supabase.client
      .from('med_patients')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('patient_user_id', userId)
      .single();
    return (data as { id: string } | null) ?? null;
  }

  async listMyHealthEntries(tenant: TenantContext, userId: string) {
    const patient = await this.findPatientByUser(tenant.id, userId);
    if (!patient) return [] as Record<string, unknown>[];
    return this.getHealthEntries(tenant, patient.id);
  }

  async createMyHealthEntry(
    tenant: TenantContext,
    userId: string,
    dto: Record<string, unknown>,
  ) {
    const patient = await this.findPatientByUser(tenant.id, userId);
    if (!patient) {
      throw new NotFoundException(
        "Aucun dossier patient n'existe pour vous dans cet espace. Contactez votre praticien.",
      );
    }
    return this.createHealthEntry(tenant, userId, {
      ...dto,
      patient_id: patient.id,
    });
  }
}
