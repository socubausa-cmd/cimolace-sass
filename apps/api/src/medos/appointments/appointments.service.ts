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
import { TeleconsultService } from '../teleconsult/teleconsult.service';
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
    private readonly teleconsult: TeleconsultService,
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

  // ───────────────────────────────────────────────────────────────────────────
  // DIRECT PAYANT — pont masterclass (billing_plan `metadata.event`) ↔ moteur live LIRI.
  // Une masterclass vendue via la vitrine donne un access_pass `service`. Ici on la
  // relie à une `live_session` (moteur live existant + gate payant de generateToken).
  // Source de vérité du lien : `billing_plans.metadata.live_session_id`.
  // La session est créée à la DEMANDE de l'hôte (host_user_id non-null garanti) ;
  // l'acheteur qui arrive avant le lancement reçoit `session_id:null` (« pas encore démarré »).
  // ───────────────────────────────────────────────────────────────────────────

  /** Résout (et crée si `hostUserId` fourni) la live_session jumelle d'une masterclass. */
  private async resolveMasterclassSession(
    tenant: TenantContext,
    serviceKey: string,
    hostUserId?: string,
  ): Promise<{
    id: string;
    status: string;
    started_at: string | null;
    scheduled_at: string | null;
    title: string | null;
    host_user_id: string | null;
  } | null> {
    const db = this.supabase.client as any;
    const { data: plan } = await db
      .from('billing_plans')
      .select('id, key, label, price_cents, metadata')
      .eq('tenant_id', tenant.id)
      .eq('key', serviceKey)
      .maybeSingle();
    if (!plan) throw new NotFoundException('Masterclass introuvable');
    if (!plan.metadata?.event) {
      throw new BadRequestException("Ce service n'est pas un direct.");
    }
    const linkedId = plan.metadata?.live_session_id as string | undefined;
    if (linkedId) {
      const { data: existing } = await db
        .from('live_sessions')
        .select('id, status, started_at, scheduled_at, title, host_user_id')
        .eq('id', linkedId)
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (existing?.id) return existing;
    }
    // Pas encore de session : on ne la crée QUE si un hôte est fourni (= démarrage hôte).
    if (!hostUserId) return null;
    const { data: created, error } = await db
      .from('live_sessions')
      .insert({
        tenant_id: tenant.id,
        host_user_id: hostUserId,
        teacher_id: hostUserId,
        title: plan.label || 'Masterclass',
        price_cents: plan.price_cents ?? 0,
        // scheduled_at est NOT NULL en base : défaut = maintenant (l'hôte lance le direct).
        scheduled_at: plan.metadata?.scheduled_at || new Date().toISOString(),
        status: 'scheduled',
      })
      .select('id, status, started_at, scheduled_at, title, host_user_id')
      .single();
    if (error || !created?.id) {
      throw new InternalServerErrorException('Création du direct impossible.');
    }
    // Relier au plan pour l'idempotence future (best-effort).
    await db
      .from('billing_plans')
      .update({ metadata: { ...(plan.metadata || {}), live_session_id: created.id } })
      .eq('tenant_id', tenant.id)
      .eq('id', plan.id);
    return created;
  }

  /** HÔTE (staff) : démarre — ou rouvre — le direct d'une masterclass. Retourne la session à ouvrir. */
  async masterclassStart(tenant: TenantContext, userId: string, serviceKey: string) {
    const STAFF = new Set(['owner', 'admin', 'teacher', 'practitioner', 'secretariat']);
    if (!STAFF.has(String(tenant.userRole ?? '').toLowerCase())) {
      throw new ForbiddenException('Seul le praticien peut démarrer le direct.');
    }
    const session = await this.resolveMasterclassSession(tenant, serviceKey, userId);
    if (!session) throw new InternalServerErrorException('Direct indisponible.');
    const db = this.supabase.client as any;
    const wasLive = session.status === 'live';
    const patch: Record<string, unknown> = {};
    if (!session.host_user_id) {
      patch.host_user_id = userId;
      patch.teacher_id = userId;
    }
    if (!wasLive) {
      patch.status = 'live';
      patch.started_at = session.started_at ?? new Date().toISOString();
    }
    if (Object.keys(patch).length) {
      await db.from('live_sessions').update(patch).eq('id', session.id).eq('tenant_id', tenant.id);
    }
    // À la 1re ouverture du direct : email de rappel aux acheteurs avec le lien pour
    // rejoindre. Best-effort, non bloquant (n'empêche pas l'hôte d'entrer). Pas de
    // double envoi si l'hôte rouvre une salle déjà en direct.
    if (!wasLive) {
      void this.notifyMasterclassBuyers(tenant, serviceKey, session.title).catch(() => undefined);
    }
    return {
      session_id: session.id,
      title: session.title,
      scheduled_at: session.scheduled_at,
      status: 'live',
    };
  }

  /**
   * DIRECT PAYANT — prévient par email tous les acheteurs (pass `service` actif) que le
   * direct commence, avec le lien pour rejoindre en un clic (page réservation → bouton
   * « Rejoindre le direct », gaté au pass). Best-effort, séquentiel, jamais bloquant.
   */
  private async notifyMasterclassBuyers(
    tenant: TenantContext,
    serviceKey: string,
    serviceLabel: string | null,
  ): Promise<void> {
    try {
      const db = this.supabase.client as any;
      const { data: passes } = await db
        .from('access_passes')
        .select('user_id')
        .eq('tenant_id', tenant.id)
        .eq('resource_type', 'service')
        .eq('resource_id', serviceKey)
        .eq('status', 'active');
      const userIds = [
        ...new Set((passes || []).map((p: any) => p.user_id).filter(Boolean)),
      ] as string[];
      if (!userIds.length) return;
      const { data: t } = await db
        .from('tenants')
        .select('name, slug')
        .eq('id', tenant.id)
        .maybeSingle();
      const clinic = (t as any)?.name || 'votre praticien';
      const slug = (t as any)?.slug || '';
      const label = serviceLabel || 'le direct';
      const base = process.env.APP_URL || 'https://app.cimolace.space';
      const joinUrl = `${base}/t/${encodeURIComponent(slug)}/reserver?service=${encodeURIComponent(serviceKey)}`;
      const html = this.email.brandedHtml({
        title: `« ${label} » — c'est en direct maintenant`,
        body: `Le direct animé par ${clinic} vient de démarrer. Cliquez ci-dessous pour rejoindre la salle en un clic (réservé aux inscrits).`,
        ctaLabel: 'Rejoindre le direct',
        ctaUrl: joinUrl,
      });
      const subject = `🔴 En direct maintenant — ${label}`;
      for (const uid of userIds) {
        try {
          const { data: u } = await db.auth.admin.getUserById(uid);
          const to = String(u?.user?.email || '').trim();
          if (to) await this.email.sendRaw(tenant.id, to, subject, html);
        } catch {
          /* acheteur ignoré, on continue */
        }
      }
    } catch (e) {
      this.logger.warn(`notifyMasterclassBuyers: ${String(e)}`);
    }
  }

  /**
   * RÉSERVATIONS (staff) : liste les inscrits de chaque service payant du tenant
   * (masterclass/consultation), depuis les `access_passes` service actifs, avec
   * détails acheteur (nom, email, date). Groupé par service, trié récent d'abord.
   * Réservé au staff (le contrôleur applique RolesGuard) : contient des emails.
   */
  async listReservations(tenant: TenantContext) {
    const db = this.supabase.client as any;
    const { data: passes } = await db
      .from('access_passes')
      .select('user_id, resource_id, granted_at, payment_id, created_at, status')
      .eq('tenant_id', tenant.id)
      .eq('resource_type', 'service')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    const rows = (passes || []) as any[];
    if (!rows.length) return { services: [], total: 0 };

    // Libellés/prix des services (billing_plans).
    const keys = [...new Set(rows.map((r) => r.resource_id).filter(Boolean))];
    const { data: plans } = await db
      .from('billing_plans')
      .select('key, label, price_cents, currency, category, metadata')
      .eq('tenant_id', tenant.id)
      .in('key', keys);
    const planMap = new Map((plans || []).map((p: any) => [p.key, p]));

    // Détails acheteurs (email + nom) via admin, dédupliqués.
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    const userMap = new Map<string, { email: string; name: string }>();
    for (const uid of userIds) {
      try {
        const { data: u } = await db.auth.admin.getUserById(uid);
        const m = (u?.user?.user_metadata ?? {}) as Record<string, string>;
        const name = [m.first_name || m.given_name, m.last_name || m.family_name]
          .filter(Boolean)
          .join(' ')
          .trim();
        const email = String(u?.user?.email || '');
        userMap.set(uid, { email, name: name || email.split('@')[0] || 'Invité' });
      } catch {
        /* acheteur ignoré */
      }
    }

    // Groupement par service.
    const grouped = new Map<string, any>();
    for (const r of rows) {
      const plan = planMap.get(r.resource_id) as any;
      if (!grouped.has(r.resource_id)) {
        grouped.set(r.resource_id, {
          service_key: r.resource_id,
          service_label: plan?.label || r.resource_id,
          category: plan?.category || null,
          is_event: !!plan?.metadata?.event,
          price_cents: plan?.price_cents ?? null,
          currency: plan?.currency || 'EUR',
          scheduled_at: plan?.metadata?.scheduled_at || null,
          buyers: [] as any[],
        });
      }
      const u = userMap.get(r.user_id) || { email: '', name: 'Invité' };
      grouped.get(r.resource_id).buyers.push({
        user_id: r.user_id,
        name: u.name,
        email: u.email,
        reserved_at: r.granted_at || r.created_at,
        payment_ref: r.payment_id || null,
      });
    }
    const services = [...grouped.values()].map((s) => ({ ...s, count: s.buyers.length }));
    return { services, total: rows.length };
  }

  /**
   * ACHETEUR : rejoint le direct. Le pass `service` (preuve d'achat) est vérifié,
   * puis on octroie le pass `live_session` (idempotent) pour que le gate serveur de
   * `POST /lives/:id/token` accepte l'acheteur. `session_id:null` si l'hôte n'a pas lancé.
   */
  async masterclassJoin(
    tenant: TenantContext,
    userId: string,
    info: { email?: string; first_name?: string; last_name?: string },
    serviceKey: string,
  ) {
    const ctx = await this.bookingContext(tenant, userId, info, serviceKey);
    if (!ctx.service.is_event) {
      throw new BadRequestException("Ce service n'est pas un direct.");
    }
    if (!ctx.has_access) {
      throw new ForbiddenException('Paiement requis pour rejoindre ce direct.');
    }
    const session = await this.resolveMasterclassSession(tenant, serviceKey);
    if (!session) {
      return {
        session_id: null,
        status: 'not_started',
        scheduled_at: ctx.service.scheduled_at,
        title: ctx.service.label,
      };
    }
    const db = this.supabase.client as any;
    await db.from('access_passes').upsert(
      {
        tenant_id: tenant.id,
        user_id: userId,
        resource_type: 'live_session',
        resource_id: session.id,
        status: 'active',
      },
      { onConflict: 'tenant_id,user_id,resource_type,resource_id' },
    );
    return {
      session_id: session.id,
      status: session.status,
      scheduled_at: session.scheduled_at,
      title: session.title,
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

  // ── RÉSERVATION INVITÉE (embarquée sur le site du tenant, ex www.zahirwellness.com) ──
  // Le visiteur voit les créneaux et réserve un RDV GRATUIT sans compte/login Cimolace.
  // Auth = clé tenant (le contrôleur applique ApiKeyGuard). Provisionne l'invité par email
  // puis réserve via le flux normal (service gratuit → has_access=true, aucun paiement).

  /** Provisionne (ou retrouve) un compte invité par email + membership tenant (student). */
  private async provisionGuest(
    tenantId: string,
    email: string,
    firstName?: string,
    lastName?: string,
  ): Promise<string> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new InternalServerErrorException('Supabase non configuré (guest).');
    const em = email.trim().toLowerCase();
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    // ⚠️ GoTrue IGNORE le filtre `?email=` et renvoie la liste paginée. Sans pagination,
    // tout utilisateur au-delà de la 1re page (ex. un client déjà enregistré) est vu comme
    // « inexistant » → tentative de création en doublon (422) → 500 « Provisionnement invité
    // impossible » → le RDV retombe silencieusement sur Zoom. On PAGINE donc (per_page=200,
    // honoré par GoTrue) jusqu'à trouver l'email ou épuiser les pages.
    const findId = async (): Promise<string | undefined> => {
      for (let page = 1; page <= 200; page++) {
        const r = await fetch(
          `${url}/auth/v1/admin/users?page=${page}&per_page=200`,
          { headers },
        );
        if (!r.ok) return undefined;
        const d = (await r.json()) as { users?: { id: string; email?: string }[] };
        const users = d?.users || [];
        if (users.length === 0) return undefined; // dernière page dépassée
        const hit = users.find((u) => u.email?.toLowerCase() === em)?.id;
        if (hit) return hit;
      }
      return undefined;
    };
    let userId = await findId();
    if (!userId) {
      const cr = await fetch(`${url}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: em,
          email_confirm: true,
          user_metadata: {
            first_name: firstName ?? null,
            last_name: lastName ?? null,
            created_via: 'guest-booking',
          },
        }),
      });
      userId = cr.ok ? ((await cr.json()) as { id: string }).id : await findId();
      if (!userId) throw new InternalServerErrorException('Provisionnement invité impossible.');
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.supabase.client as any).from('tenant_memberships').upsert(
      { tenant_id: tenantId, user_id: userId, role: 'student', status: 'active' },
      { onConflict: 'tenant_id,user_id', ignoreDuplicates: true },
    );
    return userId;
  }

  /** Créneaux libres d'un service (invité) — résout le praticien rattaché au service. */
  async guestSlots(tenant: TenantContext, serviceKey: string, fromIso: string, toIso: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: service } = await (this.supabase.client as any)
      .from('billing_plans')
      .select('key, label, metadata')
      .eq('tenant_id', tenant.id)
      .eq('key', serviceKey)
      .maybeSingle();
    if (!service) throw new NotFoundException('Service introuvable.');
    const practitionerId = await this.resolveServicePractitioner(tenant, service);
    if (!practitionerId) return { slots: [], practitioner: false };
    return { slots: await this.findSlots(tenant, practitionerId, fromIso, toIso), practitioner: true };
  }

  /** Réservation invitée d'un créneau (service GRATUIT réservable téléconsult). */
  async guestBook(
    tenant: TenantContext,
    dto: {
      service_key?: string;
      scheduled_at?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
    },
  ) {
    const serviceKey = String(dto.service_key || '').trim();
    const scheduledAt = String(dto.scheduled_at || '').trim();
    const email = String(dto.email || '').trim();
    if (!serviceKey || !scheduledAt) {
      throw new BadRequestException('service_key et scheduled_at requis.');
    }
    if (!email.includes('@')) throw new BadRequestException('Email valide requis.');
    const userId = await this.provisionGuest(tenant.id, email, dto.first_name, dto.last_name);
    const info = { email, first_name: dto.first_name, last_name: dto.last_name };
    const appointment = await this.bookFromService(tenant, userId, info, serviceKey, scheduledAt);
    return { ok: true, appointment };
  }

  /**
   * Réservation invitée AVEC salle téléconsult LIRI prête IMMÉDIATEMENT (auto-confirmée).
   * Embarqué sur le site du tenant (ex www.zahirwellness.com) via clé `cml_`. Réutilise 100%
   * du flux `guestBook` (provision invité + RDV gratuit), puis crée la session téléconsult
   * (LiveKit routé par Liri) et un siège invité AUTO-CONSENTI (`kind:'member'` → pas de barrière
   * RGPD, aucun email Cimolace : le site tenant notifie lui-même). Renvoie les 2 URLs à stocker :
   *  - `guest_url` : page publique token-gatée, le VISITEUR rejoint sans compte.
   *  - `host_url`  : page authentifiée, le PRATICIEN anime (équivalent du `start_url` Zoom).
   */
  async guestBookRoom(
    tenant: TenantContext,
    dto: {
      service_key?: string;
      scheduled_at?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
    },
  ): Promise<{
    ok: true;
    session_id: string;
    guest_url: string;
    host_url: string;
    appointment: AppointmentRow;
  }> {
    // 1) Réserver (provision invité + RDV) — service gratuit → has_access=true, aucun paiement.
    const { appointment } = await this.guestBook(tenant, dto);
    const practitionerId = appointment.practitioner_id;

    // 2) Créer la salle téléconsult MAINTENANT (lie med_appointments.teleconsult_session_id).
    const session = await this.teleconsult.create(tenant, practitionerId, {
      patient_id: appointment.patient_id,
      appointment_id: appointment.id,
      recording_consented: false,
    });
    const sessionId = (session as { id: string }).id;

    // 3) Siège invité auto-consenti (kind:'member' → status 'consented' ; email omis → 'skipped').
    const displayName =
      `${dto.first_name ?? ''} ${dto.last_name ?? ''}`.trim() || 'Patient';
    const invite = await this.teleconsult.createInvite(
      tenant,
      practitionerId,
      sessionId,
      { display_name: displayName, kind: 'member' },
    );
    const inviteId = (invite as { id: string }).id;

    // 4) Composer les URLs (mêmes bases que la prod).
    const base = process.env.APP_URL || 'https://app.cimolace.space';
    const q = `?tenant=${encodeURIComponent(tenant.slug)}`;
    return {
      ok: true,
      session_id: sessionId,
      guest_url: `${base}/teleconsult/${sessionId}/proche/${inviteId}${q}`,
      host_url: `${base}/teleconsult/${sessionId}${q}`,
      appointment,
    };
  }

  // ── LIVES PAYANTS embarqués sur le site du tenant (ex www.zahirwellness.com) ──
  // Vente sur le Stripe DU TENANT ; ici on liste les lives vendables + on octroie
  // l'accès après paiement. Option A (magic-link) : réutilise le flux masterclass
  // prouvé (pass `service` → converti en `live_session` au join par masterclassJoin).

  /** Liste les lives/masterclass payants vendables du tenant (site tenant, clé cml_). */
  async guestLives(tenant: TenantContext) {
    const { data } = await (this.supabase.client as any)
      .from('billing_plans')
      .select('key, label, price_cents, currency, metadata')
      .eq('tenant_id', tenant.id)
      .eq('category', 'masterclass');
    const lives = ((data as any[]) || [])
      .filter((p) => p.metadata?.event)
      .map((p) => ({
        key: p.key,
        label: p.label,
        price_cents: p.price_cents,
        currency: p.currency,
        scheduled_at: p.metadata?.scheduled_at ?? null,
        description: p.metadata?.description ?? null,
        cover_url: p.metadata?.cover_url ?? null,
      }));
    return { lives };
  }

  /**
   * Accès invité à un live payant — OPTION A (magic-link). Après paiement sur le SITE
   * du tenant, on provisionne l'acheteur, on octroie le pass `service` (preuve d'achat,
   * idempotent) et on renvoie un MAGIC LINK Supabase (généré serveur, sans SMTP) → le
   * site tenant l'envoie par email. L'acheteur clique → connecté sur app.cimolace.space
   * → rejoint le direct (masterclassJoin convertit service → live_session au join).
   */
  async guestLiveAccess(
    tenant: TenantContext,
    dto: { service_key?: string; email?: string; first_name?: string; last_name?: string },
  ): Promise<{
    ok: true;
    magic_link: string | null;
    guest_join_url: string | null;
    session_id: string | null;
    service_key: string;
  }> {
    const serviceKey = String(dto.service_key || '').trim();
    const email = String(dto.email || '').trim();
    if (!serviceKey) throw new BadRequestException('service_key requis.');
    if (!email.includes('@')) throw new BadRequestException('Email valide requis.');
    const { data: svc } = await (this.supabase.client as any)
      .from('billing_plans')
      .select('key, category, metadata')
      .eq('tenant_id', tenant.id)
      .eq('key', serviceKey)
      .maybeSingle();
    if (!svc) throw new NotFoundException('Live introuvable.');
    const userId = await this.provisionGuest(tenant.id, email, dto.first_name, dto.last_name);
    await (this.supabase.client as any).from('access_passes').upsert(
      {
        tenant_id: tenant.id,
        user_id: userId,
        resource_type: 'service',
        resource_id: serviceKey,
        status: 'active',
      },
      { onConflict: 'tenant_id,user_id,resource_type,resource_id', ignoreDuplicates: false },
    );
    const magic_link = await this.generateMagicLink(email, serviceKey, tenant.slug);

    // OPTION B (join invité NATIF, sans login) : si la masterclass est reliée à une
    // live_session, octroyer un pass `live_session` (idempotent) dont l'id sert de
    // jeton d'URL invité → lien de join sans compte. Best-effort (A reste dispo).
    let guest_join_url: string | null = null;
    let session_id: string | null = null;
    try {
      const liveSessionId = (svc as any)?.metadata?.live_session_id as string | undefined;
      if (liveSessionId) {
        session_id = liveSessionId;
        const { data: pass } = await (this.supabase.client as any)
          .from('access_passes')
          .upsert(
            {
              tenant_id: tenant.id,
              user_id: userId,
              resource_type: 'live_session',
              resource_id: liveSessionId,
              status: 'active',
            },
            { onConflict: 'tenant_id,user_id,resource_type,resource_id' },
          )
          .select('id')
          .maybeSingle();
        const passId = (pass as any)?.id;
        if (passId) {
          const base = process.env.APP_URL || 'https://app.cimolace.space';
          guest_join_url = `${base}/live/${liveSessionId}/invite/${passId}?tenant=${encodeURIComponent(tenant.slug)}`;
        }
      }
    } catch {
      /* best-effort : l'option A (magic-link) reste disponible même si B échoue */
    }

    return { ok: true, magic_link, guest_join_url, session_id, service_key: serviceKey };
  }

  /** Magic link Supabase (admin generate_link — NE dépend PAS du SMTP ; le lien est renvoyé). */
  private async generateMagicLink(
    email: string,
    serviceKey: string,
    slug: string,
  ): Promise<string | null> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    const base = process.env.APP_URL || 'https://app.cimolace.space';
    const redirect = `${base}/t/${encodeURIComponent(slug)}/reserver?service=${encodeURIComponent(serviceKey)}`;
    try {
      const r = await fetch(`${url}/auth/v1/admin/generate_link`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'magiclink',
          email: email.trim().toLowerCase(),
          options: { redirect_to: redirect },
        }),
      });
      if (!r.ok) return null;
      const d = (await r.json()) as any;
      return d?.action_link || d?.properties?.action_link || null;
    } catch {
      return null;
    }
  }
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
