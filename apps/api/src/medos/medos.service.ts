import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TwinService } from './twin/twin.service';
import {
  computeWheelScores,
  WHEEL_DOMAINS,
  type WheelMapping,
} from './twin/wheel-mapping';
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

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
    private readonly twin: TwinService,
  ) {}

  /**
   * 2026-06 — Provisionne (ou retrouve) le compte patient à partir d'un email,
   * puis garantit son membership 'patient' sur le tenant. Renvoie l'UUID du
   * user. Réplique la logique éprouvée de EmbedService.findOrCreateUser (le
   * même flux qui a créé les patients existants via le sync intake), pour que
   * le modal "Nouveau patient" et le wizard Onboarding Twin puissent créer un
   * patient sans connaître son UUID à l'avance.
   */
  private async ensurePatientUser(
    tenantId: string,
    email: string,
    firstName?: string,
    lastName?: string,
  ): Promise<string> {
    const supabaseUrl = this.config.get<string>('SUPABASE_URL');
    const serviceKey = this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      throw new InternalServerErrorException(
        'Supabase non configuré pour la création de patients',
      );
    }
    const adminHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    };

    // 1. User existant ? (filtre admin par email)
    let userId: string | undefined;
    const listRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
      { headers: adminHeaders },
    );
    if (listRes.ok) {
      const data = (await listRes.json()) as { users?: { id: string; email?: string }[] };
      const existing = (data?.users || []).find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      );
      if (existing) userId = existing.id;
    }

    // 2. Sinon, créer le user
    if (!userId) {
      const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          email,
          email_confirm: true,
          user_metadata: {
            first_name: firstName ?? null,
            last_name: lastName ?? null,
            created_via: 'medos-patient-create',
          },
        }),
      });
      if (!createRes.ok) {
        const body = await createRes.text();
        this.logger.error(`ensurePatientUser create failed: ${createRes.status} ${body}`);
        throw new InternalServerErrorException(
          `Création du compte patient impossible : ${createRes.status}`,
        );
      }
      const created = (await createRes.json()) as { id: string };
      userId = created.id;
    }

    // 3. Garantir le membership 'patient' — SANS JAMAIS rétrograder un membre
    //    du staff. L'upsert (onConflict tenant_id,user_id) écraserait sinon le
    //    rôle d'un owner/practitioner en 'patient' si son email est saisi comme
    //    email patient → il perdrait l'accès au back-office (bug 403 vécu).
    const MEMBERSHIP_STAFF = ['owner', 'practitioner', 'clinic_admin', 'receptionist'];
    const { data: existingMem } = await (this.supabase.client as any)
      .from('tenant_memberships')
      .select('role')
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .maybeSingle();
    if (existingMem && MEMBERSHIP_STAFF.includes((existingMem as any).role)) {
      throw new BadRequestException(
        "Cet email appartient à un membre de l'équipe — utilisez l'adresse personnelle du patient.",
      );
    }
    await (this.supabase.client as any)
      .from('tenant_memberships')
      .upsert(
        { tenant_id: tenantId, user_id: userId, role: 'patient', status: 'active' },
        { onConflict: 'tenant_id,user_id' },
      );

    return userId;
  }

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
    // 2026-06 — Résolution de l'identité patient. Trois cas :
    //   a) patient_user_id fourni → on l'utilise tel quel (flux SSO/embed).
    //   b) email fourni → on provisionne/retrouve le compte + membership.
    //   c) ni l'un ni l'autre → 400 explicite (plutôt que le cryptique
    //      "patient_user_id must be a UUID" renvoyé par le validateur).
    let patientUserId = dto.patient_user_id;
    if (!patientUserId) {
      if (!dto.email) {
        throw new BadRequestException(
          'Email du patient requis pour créer un dossier (ou fournir patient_user_id).',
        );
      }
      patientUserId = await this.ensurePatientUser(
        tenant.id,
        dto.email.trim().toLowerCase(),
        dto.first_name,
        dto.last_name,
      );
    }

    const { data, error } = await this.supabase.client
      .from('med_patients')
      .insert({
        tenant_id: tenant.id,
        patient_user_id: patientUserId,
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

    // In-app notification → patient, only on share (best-effort).
    try {
      if (shared) {
        const { data: pat } = await this.supabase.client
          .from('med_patients')
          .select('patient_user_id')
          .eq('tenant_id', tenant.id)
          .eq('id', (data as any).patient_id)
          .single();
        const patientUserId = (pat as any)?.patient_user_id as string | null;
        if (patientUserId) {
          await this.notifications.send(tenant.id, patientUserId, {
            title: 'Nouvelle note partagée',
            body: 'Votre praticien a partagé une note de consultation.',
            type: 'note_shared',
            email: true,
            actionUrl: `https://${tenant.slug}.patient.cimolace.space`,
          });
        }
      }
    } catch (e) {
      this.logger.warn(`notif note_shared: ${(e as Error).message}`);
    }

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

    // G1 — Auto-remplir la Roue Détox si le template a un wheel_mapping.
    // Best-effort : jamais bloquant pour la soumission.
    await this.applyWheelMappingIfAny(
      tenant.id,
      formId,
      dto.patient_id,
      dto.responses,
    );

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

    // Base de l'entrée (sans provenance). `source` est ajouté ensuite et
    // retiré en repli si la colonne n'existe pas encore (migration RPM non
    // appliquée) — voir insertHealthEntry.
    const baseRow: Record<string, unknown> = {
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
    };

    // Provenance (RPM) : on tague l'origine de la saisie. Whitelist de valeurs
    // pour éviter qu'un client injecte un libellé arbitraire ; défaut 'manual'.
    const PROVENANCE = ['manual', 'home_device', 'questionnaire', 'import'];
    const rawSource = typeof dto.source === 'string' ? dto.source : undefined;
    const source = rawSource && PROVENANCE.includes(rawSource) ? rawSource : 'manual';

    const data = await this.insertHealthEntry({ ...baseRow, source });

    await this.writeAudit(tenant.id, actorId, 'med_health_entry', (data as any).id, 'create');

    // Fermeture de boucle suivi → jumeau (best-effort, ne bloque JAMAIS la
    // saisie patient). Deux projections complémentaires :
    //   1. roue de transformation (lifestyle : sommeil/énergie/exercice…),
    //   2. biomarqueurs CLINIQUES depuis les CONSTANTES maison (RPM : glycémie,
    //      tension, FC, poids, température) — c'est ce qui alimente les scores
    //      d'organes + alertes cliniques (ex. glycémie/tension élevée).
    // computeScores est appelé EN DERNIER pour qu'il voie les biomarqueurs
    // fraîchement insérés et régénère scores d'organes + alertes en un passage.
    // Une panne ici (table twin absente, recompute en erreur) ne doit pas faire
    // échouer l'enregistrement du suivi — d'où le try/catch silencieux.
    try {
      await this.twin.syncWheelFromHealthEntries(tenant, patientId);
      await this.twin.syncBiomarkersFromHealthEntry(tenant, patientId);
      await this.twin.computeScores(tenant, patientId);
    } catch (e: any) {
      this.logger.warn(
        `health→twin sync skipped for patient ${patientId}: ${e?.message ?? e}`,
      );
    }

    return data as unknown as Record<string, unknown>;
  }

  /**
   * Insère une entrée de suivi. Tente d'écrire la colonne `source`
   * (provenance RPM) ; si elle n'existe pas encore en base (migration
   * 20260628150000_medos_twin_rpm_vitals non appliquée → Postgres 42703 /
   * « column ... does not exist »), repli automatique en réinsérant SANS
   * `source`. Garantit que la saisie n'échoue jamais à cause de la provenance,
   * tout en l'enregistrant dès que la migration est appliquée.
   */
  private async insertHealthEntry(
    row: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const { data, error } = await this.supabase.client
      .from('med_health_entries')
      .insert(row as any)
      .select('*')
      .single();

    if (!error) return data as unknown as Record<string, unknown>;

    const code = (error as { code?: string }).code;
    const msg = (error.message ?? '').toLowerCase();
    const missingSource =
      'source' in row &&
      (code === '42703' ||
        (msg.includes('source') && msg.includes('does not exist') &&
          msg.includes('column')));
    if (missingSource) {
      const { source: _omit, ...withoutSource } = row;
      const retry = await this.supabase.client
        .from('med_health_entries')
        .insert(withoutSource as any)
        .select('*')
        .single();
      if (!retry.error) {
        return retry.data as unknown as Record<string, unknown>;
      }
      this.logger.error('createHealthEntry (retry)', retry.error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    this.logger.error('createHealthEntry', error.message);
    throw new InternalServerErrorException('Erreur interne');
  }

  /**
   * Vue staff « Suivi santé » (roll-up tenant) — dernières entrées de suivi
   * tous patients confondus, enrichies du nom du patient. Lecture seule,
   * réservée au staff (garde rôle côté contrôleur). Sert l'écran HealthTracker
   * qui n'a pas de patient sélectionné : sans cet endpoint, le bare
   * GET /med/health renvoyait 404 → liste toujours vide.
   */
  async listRecentHealthEntries(tenant: TenantContext, limit = 100) {
    const { data, error } = await this.supabase.client
      .from('med_health_entries')
      .select(
        'id, patient_id, entry_date, entry_type, mood_score, energy_level, sleep_hours, exercise_minutes, water_liters, symptoms, notes, created_at',
      )
      .eq('tenant_id', tenant.id)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('listRecentHealthEntries', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    const entries = (data ?? []) as any[];
    if (entries.length === 0) return [] as Record<string, unknown>[];

    // Enrichissement nom patient (une seule requête, dédupliquée).
    const ids = [...new Set(entries.map((e) => e.patient_id))];
    const { data: patients } = await this.supabase.client
      .from('med_patients')
      .select('id, first_name, last_name')
      .eq('tenant_id', tenant.id)
      .in('id', ids);
    const nameById = new Map(
      (patients ?? []).map((p: any) => [
        p.id,
        [p.first_name, p.last_name].filter(Boolean).join(' ') || null,
      ]),
    );

    return entries.map((e) => ({
      ...e,
      patient_name: nameById.get(e.patient_id) ?? null,
    })) as unknown as Record<string, unknown>[];
  }

  async getHealthEntries(
    tenant: TenantContext,
    patientId: string,
    actorId?: string,
  ) {
    // Un patient ne peut voir QUE ses propres entrées. RLS étant contournée
    // (client service-role), ce contrôle d'ownership applicatif est le SEUL
    // filet : sans lui, un patient lirait le journal santé de n'importe quel
    // autre patient du tenant via un patientId arbitraire (fuite PHI).
    if (tenant.userRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('tenant_id', tenant.id)
        .eq('id', patientId)
        .single();
      if (!pat || (pat as any).patient_user_id !== actorId) {
        throw new ForbiddenException('Accès refusé');
      }
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
  ): Promise<{ id: string; first_name: string | null; last_name: string | null } | null> {
    const { data } = await this.supabase.client
      .from('med_patients')
      .select('id, first_name, last_name')
      .eq('tenant_id', tenantId)
      .eq('patient_user_id', userId)
      .single();
    return (
      (data as {
        id: string;
        first_name: string | null;
        last_name: string | null;
      } | null) ?? null
    );
  }

  async listMyHealthEntries(tenant: TenantContext, userId: string) {
    const patient = await this.findPatientByUser(tenant.id, userId);
    if (!patient) return [] as Record<string, unknown>[];
    return this.getHealthEntries(tenant, patient.id, userId);
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

  /**
   * Forms visible to the patient: tenant-specific forms + global templates
   * (tenant_id IS NULL AND is_template = true). Returns answered status by
   * checking med_form_responses for this patient.
   */
  async listMyForms(tenant: TenantContext) {
    const { data, error } = await this.supabase.client
      .from('med_medical_forms')
      .select('*')
      .or(`tenant_id.eq.${tenant.id},and(tenant_id.is.null,is_template.eq.true)`)
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error('listMyForms', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return (data ?? []) as unknown as Record<string, unknown>[];
  }

  async submitMyFormResponse(
    tenant: TenantContext,
    userId: string,
    formId: string,
    responses: Record<string, unknown>,
  ) {
    const patient = await this.findPatientByUser(tenant.id, userId);
    if (!patient) {
      throw new NotFoundException(
        "Aucun dossier patient n'existe pour vous dans cet espace. Contactez votre praticien.",
      );
    }

    // Verify the form exists either as a tenant form or a global template.
    const { data: form } = await this.supabase.client
      .from('med_medical_forms')
      .select('id, tenant_id, is_template')
      .eq('id', formId)
      .single();
    if (!form) throw new NotFoundException('Formulaire introuvable');
    const row = form as { tenant_id: string | null; is_template: boolean };
    if (row.tenant_id !== tenant.id && !(row.tenant_id === null && row.is_template)) {
      throw new ForbiddenException('Ce formulaire n\'est pas accessible');
    }

    const { data, error } = await this.supabase.client
      .from('med_form_responses')
      .insert({
        tenant_id: tenant.id,
        form_id: formId,
        patient_id: patient.id,
        submitted_by: userId,
        responses: responses as any,
      } as any)
      .select('*')
      .single();

    if (error) {
      this.logger.error('submitMyFormResponse', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    await this.writeAudit(tenant.id, userId, 'med_form_response', (data as any).id, 'submit');

    // Best-effort: if a targeted assignment of this form to this patient is
    // pending, mark it completed. Never let this affect the submission result
    // (table may not be migrated yet, or no assignment may exist).
    let notifiedAssigner: string | null = null;
    try {
      const { data: assignmentRows, error: assignErr } = await this.faTable()
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          response_id: (data as any).id,
          updated_at: new Date().toISOString(),
        })
        .eq('tenant_id', tenant.id)
        .eq('form_id', formId)
        .eq('patient_id', patient.id)
        .eq('status', 'pending')
        .select('assigned_by');
      if (assignErr && !this.isRelationMissing(assignErr)) {
        this.logger.warn(
          `Assignment completion skipped: ${assignErr.message}`,
        );
      } else {
        // Capture the practitioner user_id who assigned this form so we can
        // notify them (G3 — form response arrived).
        const first = ((assignmentRows ?? []) as Array<{ assigned_by: string | null }>)[0];
        notifiedAssigner = first?.assigned_by ?? null;
      }
    } catch (e) {
      // Assignment missing or table not migrated — ignore silently.
      this.logger.debug?.(`Assignment completion hook ignored: ${String(e)}`);
    }

    // G1 — Auto-remplir la Roue Détox si le template a un wheel_mapping.
    // Best-effort : jamais bloquant pour la soumission.
    await this.applyWheelMappingIfAny(
      tenant.id,
      formId,
      patient.id,
      responses,
    );

    // G3 — Notif praticien assignant. Best-effort : jamais bloquant. On lui
    // renvoie le lien direct vers le dossier patient pour qu'il puisse ouvrir
    // les réponses en 1 clic (deep-link handled côté med-app).
    if (notifiedAssigner) {
      try {
        const patientLabel =
          patient.first_name?.trim() || patient.last_name?.trim() || 'Un patient';
        const { data: formRow } = await this.supabase.client
          .from('med_medical_forms')
          .select('title')
          .eq('id', formId)
          .maybeSingle();
        const formTitle =
          (formRow as { title?: string } | null)?.title ?? 'un formulaire';
        await this.notifications.send(tenant.id, notifiedAssigner, {
          title: 'Formulaire complété',
          body: `${patientLabel} a rempli « ${formTitle} ». Ouvrez le dossier pour consulter les réponses.`,
          type: 'form_response_submitted',
          email: true,
          actionUrl: `https://med.cimolace.space/patients/${patient.id}`,
        });
      } catch (e) {
        this.logger.warn(`notif form_response_submitted: ${(e as Error).message}`);
      }
    }

    return data as unknown as Record<string, unknown>;
  }

  // -----------------------------------------------------------------------
  // Targeted form assignments — send a precise form to a precise patient
  // (med_form_assignments). Gracefully degrades to []/no-op/503 while the
  // table migration is not yet applied (Postgres 42P01).
  // -----------------------------------------------------------------------

  /**
   * True when a Supabase/Postgres error means the med_form_assignments table
   * (or a referenced relation) does not exist yet. Lets every accessor degrade
   * gracefully (empty list / no-op / 503) instead of returning a 500 before
   * the migration is applied.
   */
  /**
   * Query builder for med_form_assignments. The table is intentionally absent
   * from the generated Supabase `Database` types until its migration ships, so
   * the typed client would infer write payloads as `never`. We access it through
   * an untyped client cast here; all callers still degrade via isRelationMissing.
   */
  private faTable() {
    return (this.supabase.client as any).from('med_form_assignments');
  }

  private isRelationMissing(error: unknown): boolean {
    const e = error as { code?: string; message?: string } | null | undefined;
    if (!e) return false;
    if (e.code === '42P01') return true;
    const msg = (e.message ?? '').toLowerCase();
    return (
      msg.includes('does not exist') ||
      msg.includes('med_form_assignments')
    );
  }

  /**
   * Assign a form to a patient (staff). Upserts on (tenant_id, form_id,
   * patient_id): re-assigning resets the assignment to 'pending'. Verifies the
   * form AND the patient belong to the tenant (404 otherwise). 503 — not 500 —
   * while the table is missing.
   */
  async assignForm(
    tenant: TenantContext,
    actorId: string,
    formId: string,
    dto: { patient_id: string; note?: string },
  ) {
    // 1. Form must belong to the tenant.
    const { data: form } = await this.supabase.client
      .from('med_medical_forms')
      .select('id, title')
      .eq('tenant_id', tenant.id)
      .eq('id', formId)
      .single();
    if (!form) throw new NotFoundException('Formulaire introuvable');

    // 2. Patient must belong to the tenant.
    const { data: patient } = await this.supabase.client
      .from('med_patients')
      .select('id, patient_user_id')
      .eq('tenant_id', tenant.id)
      .eq('id', dto.patient_id)
      .single();
    if (!patient) throw new NotFoundException('Patient introuvable');

    // 3. Upsert the assignment.
    const { data, error } = await this.faTable()
      .upsert(
        {
          tenant_id: tenant.id,
          form_id: formId,
          patient_id: dto.patient_id,
          status: 'pending',
          note: dto.note ?? null,
          assigned_by: actorId,
          assigned_at: new Date().toISOString(),
          completed_at: null,
          response_id: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'tenant_id,form_id,patient_id' },
      )
      .select('*')
      .single();

    if (error) {
      if (this.isRelationMissing(error)) {
        throw new ServiceUnavailableException(
          'Assignations non disponibles (migration en attente)',
        );
      }
      this.logger.error('assignForm', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    await this.writeAudit(
      tenant.id,
      actorId,
      'med_form_assignment',
      (data as any).id,
      'create',
    );

    // In-app notification → patient (best-effort: never break the assignment).
    try {
      const patientUserId = (patient as any).patient_user_id as string | null;
      if (patientUserId) {
        await this.notifications.send(tenant.id, patientUserId, {
          title: 'Nouveau formulaire à remplir',
          body: `Votre praticien vous a assigné : « ${((form as any).title as string) ?? 'Formulaire'} ». Merci de le compléter.`,
          type: 'form_assignment',
          email: true,
          actionUrl: `https://${tenant.slug}.patient.cimolace.space`,
        });
      }
    } catch (e) {
      this.logger.warn(`notif form_assignment: ${(e as Error).message}`);
    }

    return data as unknown as Record<string, unknown>;
  }

  /**
   * Cancel an assignment (staff). Tenant-scoped. No-op gracefully when the
   * table is missing. Returns { id }.
   */
  async cancelAssignment(
    tenant: TenantContext,
    id: string,
  ): Promise<{ id: string }> {
    const { data, error } = await this.faTable()
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('tenant_id', tenant.id)
      .eq('id', id)
      .select('id')
      .single();

    if (error) {
      if (this.isRelationMissing(error)) return { id };
      // Row not found (PGRST116) is also a benign no-op for cancel.
      if ((error as { code?: string }).code === 'PGRST116') return { id };
      this.logger.error('cancelAssignment', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return { id: (data as { id: string } | null)?.id ?? id };
  }

  /**
   * List assignments for a given patient (staff view). Tenant-scoped, joins
   * the form title. Degrades to [] when the table is missing.
   */
  async listPatientAssignments(tenant: TenantContext, patientId: string) {
    const { data, error } = await this.faTable()
      .select(
        'id, form_id, status, assigned_at, completed_at, med_medical_forms(title)',
      )
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patientId)
      .order('assigned_at', { ascending: false });

    if (error) {
      if (this.isRelationMissing(error)) return [];
      this.logger.error('listPatientAssignments', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    return ((data ?? []) as any[]).map((row) => ({
      id: row.id,
      form_id: row.form_id,
      form_title: row.med_medical_forms?.title ?? '—',
      status: row.status,
      assigned_at: row.assigned_at,
      completed_at: row.completed_at,
    }));
  }

  /**
   * List the calling patient's own assignments (patient view). Resolves the
   * med_patients row via userId like the other /med/me routes, excludes
   * cancelled ones, and joins the form title + description. Degrades to []
   * when the patient has no dossier or the table is missing.
   */
  async listMyAssignments(tenant: TenantContext, userId: string) {
    const patient = await this.findPatientByUser(tenant.id, userId);
    if (!patient) return [];

    const { data, error } = await this.faTable()
      .select(
        'id, form_id, status, assigned_at, med_medical_forms(title, description)',
      )
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patient.id)
      .neq('status', 'cancelled')
      .order('assigned_at', { ascending: false });

    if (error) {
      if (this.isRelationMissing(error)) return [];
      this.logger.error('listMyAssignments', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }

    return ((data ?? []) as any[]).map((row) => ({
      id: row.id,
      form_id: row.form_id,
      form_title: row.med_medical_forms?.title ?? '—',
      form_description: row.med_medical_forms?.description ?? null,
      status: row.status,
      assigned_at: row.assigned_at,
    }));
  }

  /**
   * List appointments belonging to the calling patient. Returns from the
   * 30 days back up to 180 days forward, ordered by scheduled_at asc.
   */
  async listMyAppointments(tenant: TenantContext, userId: string) {
    const patient = await this.findPatientByUser(tenant.id, userId);
    if (!patient) return [] as Record<string, unknown>[];
    const from = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const to = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await this.supabase.client
      .from('med_appointments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('patient_id', patient.id)
      .gte('scheduled_at', from)
      .lte('scheduled_at', to)
      .order('scheduled_at', { ascending: true });
    if (error) {
      this.logger.error('listMyAppointments', error.message);
      throw new InternalServerErrorException('Erreur interne');
    }
    return (data ?? []) as unknown as Record<string, unknown>[];
  }

  /**
   * G1 — Charge le template du formulaire soumis, et s'il a un `wheel_mapping`
   * déclaré, calcule les 12 scores Roue Détox à partir des réponses et upsert
   * dans `med_transformation_wheel` avec source='form_response'.
   *
   * Idempotent : chaque nouvelle soumission REMPLACE les 12 lignes précédentes
   * `source='form_response'` pour ce patient (garde les lignes 'questionnaire'
   * saisies par le praticien lui-même intactes).
   *
   * Best-effort : erreurs loguées, jamais renvoyées (ne casse pas la
   * soumission du formulaire).
   */
  private async applyWheelMappingIfAny(
    tenantId: string,
    formId: string,
    patientId: string,
    responses: Record<string, unknown>,
  ): Promise<void> {
    try {
      const { data: form } = await this.supabase.client
        .from('med_medical_forms')
        .select('wheel_mapping')
        .eq('id', formId)
        .maybeSingle();
      const mapping = (form as { wheel_mapping?: unknown } | null)
        ?.wheel_mapping;
      if (!mapping || typeof mapping !== 'object') {
        return; // Template sans mapping — comportement legacy.
      }

      const scores = computeWheelScores(mapping as WheelMapping, responses);

      // Delete idempotent des anciennes lignes source='form_response' pour
      // ce patient (préserve source='questionnaire' saisi par praticien +
      // source='vitalis_intake' importé par pont zahir-app).
      await (this.supabase.client as any)
        .from('med_transformation_wheel')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('patient_id', patientId)
        .eq('source', 'form_response');

      const rows = WHEEL_DOMAINS.map((domain) => ({
        tenant_id: tenantId,
        patient_id: patientId,
        domain,
        score: scores[domain],
        source: 'form_response',
      }));
      const { error } = await (this.supabase.client as any)
        .from('med_transformation_wheel')
        .insert(rows);
      if (error) {
        this.logger.warn(`applyWheelMapping insert: ${error.message}`);
      }
    } catch (e) {
      this.logger.warn(`applyWheelMapping: ${(e as Error).message}`);
    }
  }
}
