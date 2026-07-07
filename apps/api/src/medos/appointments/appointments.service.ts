import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { EmailEngineService } from '../../email-engine/email-engine.service';
import type { TenantContext } from '../../tenant/tenant.types';
import {
  CancelAppointmentDto,
  CreateAppointmentDto,
  CreateAvailabilityDto,
  UpdateAppointmentDto,
  UpdateAvailabilityDto,
} from './dto/appointment.dto';

export type AvailabilityRow = {
  id: string;
  tenant_id: string;
  practitioner_id: string;
  weekday: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  buffer_minutes: number;
  is_active: boolean;
  notes: string | null;
};

export type AppointmentRow = {
  id: string;
  tenant_id: string;
  patient_id: string;
  practitioner_id: string;
  scheduled_at: string;
  duration_minutes: number;
  appointment_type: string;
  reason: string | null;
  status: string;
  internal_notes: string | null;
  price_cents: number | null;
  currency: string | null;
  payment_status: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  completed_at: string | null;
  consultation_note_id: string | null;
  teleconsult_session_id: string | null;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly email: EmailEngineService,
  ) {}

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
        resource: 'med_appointment',
        resource_id: resourceId,
        action,
        metadata: metadata ?? {},
      });
    if (error) {
      this.logger.error(`Audit failed: med_appointment/${action}`, error.message);
      throw new InternalServerErrorException(
        "Échec de l'audit médical — opération rejetée",
      );
    }
  }

  // ─── Availability ────────────────────────────────────────────────────────

  async createAvailability(
    tenant: TenantContext,
    actorId: string,
    dto: CreateAvailabilityDto,
  ): Promise<AvailabilityRow> {
    if ((dto.weekday === undefined) === (dto.specific_date === undefined)) {
      throw new BadRequestException(
        'Fournir EXACTEMENT un des deux : weekday OU specific_date',
      );
    }

    const { data, error } = await (this.supabase.client as any)
      .from('med_practitioner_availability')
      .insert({
        tenant_id: tenant.id,
        practitioner_id: dto.practitioner_id,
        weekday: dto.weekday ?? null,
        specific_date: dto.specific_date ?? null,
        start_time: dto.start_time,
        end_time: dto.end_time,
        slot_duration_minutes: dto.slot_duration_minutes ?? 30,
        buffer_minutes: dto.buffer_minutes ?? 0,
        notes: dto.notes ?? null,
      })
      .select('*')
      .single();

    if (error || !data) {
      this.logger.error('createAvailability', error?.message);
      throw new InternalServerErrorException(
        "Création de la disponibilité impossible",
      );
    }

    await this.writeAudit(tenant.id, actorId, (data as any).id, 'create_availability');
    return data as AvailabilityRow;
  }

  async listAvailability(
    tenant: TenantContext,
    practitionerId?: string,
  ): Promise<AvailabilityRow[]> {
    let q = this.supabase.client
      .from('med_practitioner_availability')
      .select('*')
      .eq('tenant_id', tenant.id);
    if (practitionerId) q = q.eq('practitioner_id', practitionerId);

    const { data, error } = await q.order('weekday', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as unknown as AvailabilityRow[];
  }

  async updateAvailability(
    tenant: TenantContext,
    actorId: string,
    availabilityId: string,
    dto: UpdateAvailabilityDto,
  ): Promise<AvailabilityRow> {
    const patch: Record<string, unknown> = {};
    if (dto.is_active !== undefined) patch.is_active = dto.is_active;
    if (dto.start_time !== undefined) patch.start_time = dto.start_time;
    if (dto.end_time !== undefined) patch.end_time = dto.end_time;
    if (dto.slot_duration_minutes !== undefined)
      patch.slot_duration_minutes = dto.slot_duration_minutes;
    if (dto.buffer_minutes !== undefined)
      patch.buffer_minutes = dto.buffer_minutes;

    if (Object.keys(patch).length === 0) {
      const list = await this.listAvailability(tenant);
      const found = list.find((a) => a.id === availabilityId);
      if (!found) throw new NotFoundException('Disponibilité introuvable');
      return found;
    }

    const { data, error } = await (this.supabase.client as any)
      .from('med_practitioner_availability')
      .update(patch)
      .eq('tenant_id', tenant.id)
      .eq('id', availabilityId)
      .select('*')
      .single();
    if (error || !data) {
      throw new NotFoundException('Disponibilité introuvable');
    }
    await this.writeAudit(tenant.id, actorId, availabilityId, 'update_availability');
    return data as AvailabilityRow;
  }

  async deleteAvailability(
    tenant: TenantContext,
    actorId: string,
    availabilityId: string,
  ): Promise<{ id: string }> {
    const { data, error } = await (this.supabase.client as any)
      .from('med_practitioner_availability')
      .delete()
      .eq('tenant_id', tenant.id)
      .eq('id', availabilityId)
      .select('id')
      .maybeSingle();
    if (error || !data) throw new NotFoundException('Disponibilité introuvable');

    await this.writeAudit(tenant.id, actorId, availabilityId, 'delete_availability');
    return { id: (data as any).id };
  }

  // ─── Appointments ────────────────────────────────────────────────────────

  /** Crée un RDV (staff = directement confirmed, patient = requested). */
  async create(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    dto: CreateAppointmentDto,
  ): Promise<AppointmentRow> {
    // Vérifier patient existe
    const { data: patient, error: patErr } = await this.supabase.client
      .from('med_patients')
      .select('id, patient_user_id')
      .eq('tenant_id', tenant.id)
      .eq('id', dto.patient_id)
      .single();
    if (patErr || !patient) throw new NotFoundException('Patient introuvable');

    // Patient ne peut créer que pour lui-même
    if (actorRole === 'patient' && (patient as any).patient_user_id !== actorId) {
      throw new ForbiddenException('Vous ne pouvez créer que vos propres RDV');
    }

    // ── Marketplace praticien : RDV rattaché à un SERVICE du catalogue ──────────
    // Si le service est PAYANT (access_model=paid + price>0) et que c'est le
    // PATIENT qui réserve, exiger un access_pass actif (posé au paiement, cf.
    // subscription-renewal.grantServiceAccessIfBookable). Gratuit/communauté →
    // autorisé sans paiement. Le staff (praticien/owner) réserve toujours librement.
    let servicePrice: { price_cents: number | null; currency: string | null } | null = null;
    if (dto.service_key) {
      const { data: svc } = await (this.supabase.client as any)
        .from('billing_plans')
        .select('key, access_model, price_cents, currency')
        .eq('tenant_id', tenant.id)
        .eq('key', dto.service_key)
        .maybeSingle();
      if (svc) {
        servicePrice = { price_cents: svc.price_cents ?? null, currency: svc.currency ?? null };
        const isPaid =
          Number(svc.price_cents ?? 0) > 0 && (svc.access_model ?? 'paid') === 'paid';
        if (isPaid && actorRole === 'patient') {
          const passUserId = (patient as any).patient_user_id || actorId;
          const { data: pass } = await (this.supabase.client as any)
            .from('access_passes')
            .select('id')
            .eq('tenant_id', tenant.id)
            .eq('user_id', passUserId)
            .eq('resource_type', 'service')
            .eq('resource_id', dto.service_key)
            .eq('status', 'active')
            .maybeSingle();
          if (!pass?.id) {
            throw new ForbiddenException(
              'Ce service est payant : complétez le paiement avant de réserver.',
            );
          }
        }
      }
    }

    // Vérifier qu'aucun RDV n'existe au même créneau pour ce praticien
    const scheduledAt = new Date(dto.scheduled_at).toISOString();
    const duration = dto.duration_minutes ?? 30;
    const endAt = new Date(
      new Date(scheduledAt).getTime() + duration * 60_000,
    ).toISOString();
    const { data: conflicts } = await (this.supabase.client as any)
      .from('med_appointments')
      .select('id, scheduled_at, duration_minutes, status')
      .eq('tenant_id', tenant.id)
      .eq('practitioner_id', dto.practitioner_id)
      .in('status', ['requested', 'confirmed', 'rescheduled']);
    const hasConflict = ((conflicts ?? []) as AppointmentRow[]).some((a) => {
      const aStart = new Date(a.scheduled_at).getTime();
      const aEnd = aStart + a.duration_minutes * 60_000;
      const newStart = new Date(scheduledAt).getTime();
      const newEnd = new Date(endAt).getTime();
      return newStart < aEnd && aStart < newEnd;
    });
    if (hasConflict) {
      throw new ConflictException(
        'Conflit : le praticien a déjà un RDV qui chevauche ce créneau',
      );
    }

    const initialStatus = actorRole === 'patient' ? 'requested' : 'confirmed';
    const confirmedAt =
      initialStatus === 'confirmed' ? new Date().toISOString() : null;

    const { data, error } = await (this.supabase.client as any)
      .from('med_appointments')
      .insert({
        tenant_id: tenant.id,
        patient_id: dto.patient_id,
        practitioner_id: dto.practitioner_id,
        scheduled_at: scheduledAt,
        duration_minutes: duration,
        appointment_type: dto.appointment_type ?? 'in_person',
        reason: dto.reason ?? null,
        status: initialStatus,
        confirmed_at: confirmedAt,
        // Reprend le tarif du service marketplace rattaché (colonnes existantes).
        ...(servicePrice
          ? { price_cents: servicePrice.price_cents, currency: servicePrice.currency }
          : {}),
      })
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error('createAppointment', error?.message);
      throw new InternalServerErrorException('Création du RDV impossible');
    }

    await this.writeAudit(tenant.id, actorId, (data as any).id, 'create', {
      status: initialStatus,
    });

    // RDV téléconsultation confirmé → notifie le patient par email (best-effort).
    if (initialStatus === 'confirmed' && (dto.appointment_type ?? 'in_person') === 'teleconsult') {
      void this.notifyPatientAppointment(tenant.id, dto.patient_id, data as AppointmentRow);
    }
    return data as AppointmentRow;
  }

  /**
   * Email de confirmation d'un RDV téléconsultation au patient (depuis le domaine
   * du tenant). Best-effort : ne jette jamais (l'échec email ne bloque pas le RDV).
   */
  private async notifyPatientAppointment(
    tenantId: string,
    patientId: string,
    appt: AppointmentRow,
  ): Promise<void> {
    try {
      const { data: pat } = await (this.supabase.client as any)
        .from('med_patients')
        .select('patient_user_id')
        .eq('id', patientId)
        .maybeSingle();
      const userId = (pat as any)?.patient_user_id;
      if (!userId) return;
      const { data: u } = await (this.supabase.client as any).auth.admin.getUserById(userId);
      const to = String(u?.user?.email || '').trim();
      if (!to) return;
      const { data: t } = await this.supabase.client
        .from('tenants')
        .select('name')
        .eq('id', tenantId)
        .maybeSingle();
      const clinic = (t as any)?.name || 'votre praticien';
      const when = new Date((appt as any).scheduled_at).toLocaleString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      });
      const base = process.env.APP_URL || 'https://app.cimolace.space';
      const html = this.email.brandedHtml({
        title: 'Votre téléconsultation est confirmée',
        body: `Rendez-vous avec ${clinic} le ${when}. À l'heure prévue, ouvrez votre espace pour rejoindre la salle sécurisée.`,
        ctaLabel: 'Voir mon rendez-vous',
        ctaUrl: base,
      });
      await this.email.sendRaw(tenantId, to, `Téléconsultation confirmée — ${clinic}`, html);
    } catch (e) {
      this.logger.warn(`notifyPatientAppointment: ${String(e)}`);
    }
  }

  async list(
    tenant: TenantContext,
    filters: {
      patient_id?: string;
      practitioner_id?: string;
      status?: string;
      from?: string;
      to?: string;
    } = {},
  ): Promise<AppointmentRow[]> {
    let q = this.supabase.client
      .from('med_appointments')
      .select('*')
      .eq('tenant_id', tenant.id);
    if (filters.patient_id) q = q.eq('patient_id', filters.patient_id);
    if (filters.practitioner_id)
      q = q.eq('practitioner_id', filters.practitioner_id);
    if (filters.status) q = q.eq('status', filters.status);
    if (filters.from) q = q.gte('scheduled_at', filters.from);
    if (filters.to) q = q.lte('scheduled_at', filters.to);

    const { data, error } = await q.order('scheduled_at', { ascending: true });
    if (error) throw new InternalServerErrorException(error.message);
    return (data ?? []) as unknown as AppointmentRow[];
  }

  async get(
    tenant: TenantContext,
    actorId: string,
    actorRole: TenantContext['userRole'],
    id: string,
  ): Promise<AppointmentRow> {
    const { data, error } = await this.supabase.client
      .from('med_appointments')
      .select('*')
      .eq('tenant_id', tenant.id)
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException('RDV introuvable');

    if (actorRole === 'patient') {
      const { data: pat } = await this.supabase.client
        .from('med_patients')
        .select('patient_user_id')
        .eq('id', (data as any).patient_id)
        .single();
      if ((pat as any)?.patient_user_id !== actorId) {
        throw new ForbiddenException('Accès refusé à ce RDV');
      }
    }

    return data as unknown as AppointmentRow;
  }

  async update(
    tenant: TenantContext,
    actorId: string,
    id: string,
    dto: UpdateAppointmentDto,
  ): Promise<AppointmentRow> {
    const patch: Record<string, unknown> = {};
    if (dto.scheduled_at !== undefined)
      patch.scheduled_at = new Date(dto.scheduled_at).toISOString();
    if (dto.duration_minutes !== undefined)
      patch.duration_minutes = dto.duration_minutes;
    if (dto.internal_notes !== undefined) patch.internal_notes = dto.internal_notes;
    if (dto.price_cents !== undefined) patch.price_cents = dto.price_cents;
    if (dto.currency !== undefined) patch.currency = dto.currency;

    if (Object.keys(patch).length === 0) {
      return this.get(tenant, actorId, 'practitioner', id);
    }

    // Si reschedule, marquer status = 'rescheduled'
    if (patch.scheduled_at !== undefined) {
      patch.status = 'rescheduled';
    }

    const { data, error } = await (this.supabase.client as any)
      .from('med_appointments')
      .update(patch)
      .eq('tenant_id', tenant.id)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) throw new NotFoundException('RDV introuvable');

    await this.writeAudit(tenant.id, actorId, id, 'update', { patched: Object.keys(patch) });
    return data as AppointmentRow;
  }

  async confirm(
    tenant: TenantContext,
    actorId: string,
    id: string,
  ): Promise<AppointmentRow> {
    const { data, error } = await (this.supabase.client as any)
      .from('med_appointments')
      .update({
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant.id)
      .eq('id', id)
      .in('status', ['requested', 'rescheduled'])
      .select('*')
      .single();
    if (error || !data) {
      throw new BadRequestException(
        'Confirmation impossible (RDV inexistant ou statut incompatible)',
      );
    }
    await this.writeAudit(tenant.id, actorId, id, 'confirm');
    return data as AppointmentRow;
  }

  async cancel(
    tenant: TenantContext,
    actorId: string,
    id: string,
    dto: CancelAppointmentDto,
  ): Promise<AppointmentRow> {
    if (!dto.reason || dto.reason.trim().length < 3) {
      throw new BadRequestException("Motif d'annulation obligatoire (3 chars min)");
    }

    const { data, error } = await (this.supabase.client as any)
      .from('med_appointments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: dto.reason.trim(),
      })
      .eq('tenant_id', tenant.id)
      .eq('id', id)
      .neq('status', 'cancelled')
      .neq('status', 'completed')
      .select('*')
      .single();
    if (error || !data) {
      throw new BadRequestException(
        'Annulation impossible (RDV inexistant, déjà annulé ou terminé)',
      );
    }
    await this.writeAudit(tenant.id, actorId, id, 'cancel', {
      reason: dto.reason.trim(),
    });
    return data as AppointmentRow;
  }

  async complete(
    tenant: TenantContext,
    actorId: string,
    id: string,
  ): Promise<AppointmentRow> {
    const { data, error } = await (this.supabase.client as any)
      .from('med_appointments')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenant.id)
      .eq('id', id)
      .eq('status', 'confirmed')
      .select('*')
      .single();
    if (error || !data) {
      throw new BadRequestException(
        'Complétion impossible (RDV doit être confirmé)',
      );
    }
    await this.writeAudit(tenant.id, actorId, id, 'complete');
    return data as AppointmentRow;
  }

  async noShow(
    tenant: TenantContext,
    actorId: string,
    id: string,
  ): Promise<AppointmentRow> {
    const { data, error } = await (this.supabase.client as any)
      .from('med_appointments')
      .update({ status: 'no_show' })
      .eq('tenant_id', tenant.id)
      .eq('id', id)
      .eq('status', 'confirmed')
      .select('*')
      .single();
    if (error || !data) {
      throw new BadRequestException(
        'Marquage no-show impossible (RDV doit être confirmé)',
      );
    }
    await this.writeAudit(tenant.id, actorId, id, 'no_show');
    return data as AppointmentRow;
  }

  // ─── Slot search (utile pour appointment-booker widget) ──────────────────

  /**
   * Calcule les créneaux disponibles pour un praticien entre deux dates.
   * Intersect availability (récurrente + ponctuelle) avec les RDV existants.
   */
  async findSlots(
    tenant: TenantContext,
    practitionerId: string,
    fromIso: string,
    toIso: string,
  ): Promise<Array<{ start: string; end: string }>> {
    const availabilities = await this.listAvailability(tenant, practitionerId);
    const active = availabilities.filter((a) => a.is_active);

    const { data: existingApps } = await (this.supabase.client as any)
      .from('med_appointments')
      .select('scheduled_at, duration_minutes, status')
      .eq('tenant_id', tenant.id)
      .eq('practitioner_id', practitionerId)
      .gte('scheduled_at', fromIso)
      .lte('scheduled_at', toIso)
      .in('status', ['requested', 'confirmed', 'rescheduled']);

    const taken = ((existingApps ?? []) as AppointmentRow[]).map((a) => ({
      start: new Date(a.scheduled_at).getTime(),
      end:
        new Date(a.scheduled_at).getTime() + a.duration_minutes * 60_000,
    }));

    const slots: Array<{ start: string; end: string }> = [];
    const fromMs = new Date(fromIso).getTime();
    const toMs = new Date(toIso).getTime();

    for (let dayMs = startOfDay(fromMs); dayMs < toMs; dayMs += 86_400_000) {
      const date = new Date(dayMs);
      const weekday = date.getDay(); // 0=Sun..6=Sat
      const isoDate = date.toISOString().slice(0, 10);

      const matching = active.filter(
        (a) =>
          (a.weekday !== null && a.weekday === weekday) ||
          (a.specific_date !== null && a.specific_date === isoDate),
      );

      for (const a of matching) {
        const [sh, sm] = a.start_time.split(':').map(Number);
        const [eh, em] = a.end_time.split(':').map(Number);
        const dayStart = new Date(date);
        dayStart.setHours(sh, sm ?? 0, 0, 0);
        const dayEnd = new Date(date);
        dayEnd.setHours(eh, em ?? 0, 0, 0);

        const slotMs = a.slot_duration_minutes * 60_000;
        const bufferMs = a.buffer_minutes * 60_000;
        for (
          let t = dayStart.getTime();
          t + slotMs <= dayEnd.getTime();
          t += slotMs + bufferMs
        ) {
          if (t < fromMs || t > toMs) continue;
          const slotEnd = t + slotMs;
          const overlaps = taken.some(
            (b) => t < b.end && b.start < slotEnd,
          );
          if (!overlaps) {
            slots.push({
              start: new Date(t).toISOString(),
              end: new Date(slotEnd).toISOString(),
            });
          }
        }
      }
    }

    return slots;
  }

  // ── Marketplace : réservation depuis un SERVICE du catalogue ────────────────
  // Utilisé par le CLIENT (tout membre authentifié du tenant — pas seulement rôle
  // 'patient', car après paiement il a le rôle 'student'). Résout/crée la fiche
  // patient + le praticien, vérifie l'access_pass, puis crée le RDV (gate inclus).

  /** Résout (ou crée à la volée) la fiche med_patients du user courant. */
  async resolveMyPatient(
    tenant: TenantContext,
    userId: string,
    info: { email?: string; first_name?: string; last_name?: string },
  ): Promise<{ id: string; patient_user_id: string }> {
    const { data: existing } = await (this.supabase.client as any)
      .from('med_patients')
      .select('id, patient_user_id')
      .eq('tenant_id', tenant.id)
      .eq('patient_user_id', userId)
      .maybeSingle();
    if (existing?.id) return existing;
    const { data, error } = await (this.supabase.client as any)
      .from('med_patients')
      .insert({
        tenant_id: tenant.id,
        patient_user_id: userId,
        first_name: info.first_name || (info.email ? info.email.split('@')[0] : 'Client'),
        last_name: info.last_name || '',
      })
      .select('id, patient_user_id')
      .single();
    if (error || !data) {
      this.logger.error('resolveMyPatient', error?.message);
      throw new InternalServerErrorException('Création de la fiche patient impossible');
    }
    return data;
  }

  /** Praticien d'un service : metadata.practitioner_id, sinon 1er praticien du tenant. */
  private async resolveServicePractitioner(
    tenant: TenantContext,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service: any,
  ): Promise<string | null> {
    const fromMeta = service?.metadata?.practitioner_id;
    if (fromMeta) return fromMeta;
    const { data } = await (this.supabase.client as any)
      .from('med_practitioner_availability')
      .select('practitioner_id')
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    return data?.practitioner_id ?? null;
  }

  /** Contexte de réservation d'un service : fiche patient + praticien + accès payé. */
  async bookingContext(
    tenant: TenantContext,
    userId: string,
    info: { email?: string; first_name?: string; last_name?: string },
    serviceKey: string,
  ) {
    const { data: service } = await (this.supabase.client as any)
      .from('billing_plans')
      .select('key, label, price_cents, currency, category, access_model, metadata')
      .eq('tenant_id', tenant.id)
      .eq('key', serviceKey)
      .maybeSingle();
    if (!service) throw new NotFoundException('Service introuvable');
    const patient = await this.resolveMyPatient(tenant, userId, info);
    const practitionerId = await this.resolveServicePractitioner(tenant, service);
    const isPaid =
      Number(service.price_cents || 0) > 0 && (service.access_model ?? 'paid') === 'paid';
    let hasPass = !isPaid;
    if (isPaid) {
      const { data: pass } = await (this.supabase.client as any)
        .from('access_passes')
        .select('id')
        .eq('tenant_id', tenant.id)
        .eq('user_id', userId)
        .eq('resource_type', 'service')
        .eq('resource_id', serviceKey)
        .eq('status', 'active')
        .maybeSingle();
      hasPass = !!pass?.id;
    }
    const isEvent = !!service.metadata?.event;
    return {
      patient_id: patient.id,
      practitioner_id: practitionerId,
      service: {
        key: service.key,
        label: service.label,
        price_cents: service.price_cents,
        currency: service.currency,
        appointment_type: service.metadata?.appointment_type || 'teleconsult',
        duration_minutes: Number(service.metadata?.duration_minutes || 30),
        is_event: isEvent,
        scheduled_at: service.metadata?.scheduled_at || null,
      },
      is_paid: isPaid,
      has_access: hasPass,
      // Un événement (masterclass) n'a pas besoin de praticien/créneaux : l'accès payé suffit.
      can_book: hasPass && (isEvent || !!practitionerId),
    };
  }

  /** Crée le RDV depuis un service (après contrôle d'accès payé). */
  async bookFromService(
    tenant: TenantContext,
    userId: string,
    info: { email?: string; first_name?: string; last_name?: string },
    serviceKey: string,
    scheduledAt: string,
  ): Promise<AppointmentRow> {
    const ctx = await this.bookingContext(tenant, userId, info, serviceKey);
    if (!ctx.has_access) {
      throw new ForbiddenException('Paiement requis avant de réserver ce service.');
    }
    if (!ctx.practitioner_id) {
      throw new BadRequestException('Aucun praticien disponible pour ce service.');
    }
    return this.create(tenant, userId, 'patient', {
      patient_id: ctx.patient_id,
      practitioner_id: ctx.practitioner_id,
      scheduled_at: scheduledAt,
      duration_minutes: ctx.service.duration_minutes,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      appointment_type: ctx.service.appointment_type as any,
      reason: `Réservation : ${ctx.service.label}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      service_key: serviceKey,
    } as any);
  }
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
