import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { LiveService } from '../live/live.service';
import {
  normalizeSecretaryProfile,
  rankSecretaries,
  matchingStrategy,
  regionStatus,
} from './engine/secretary-matching';
import { detectVisitorContext } from './engine/timezone-routing';
import { buildAvailability } from './engine/availability';
import type { TenantContext } from '../tenant/tenant.types';
import type { CreateAppointmentDto, CreateSlotDto, SetPreparationDto, SubmitFeedbackDto, UpdateAppointmentDto } from './dto/booking.dto';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly live: LiveService,
  ) {}

  // ── Slots (disponibilités) ───────────────────────────────────────────────

  async createSlot(tenant: TenantContext, userId: string, dto: CreateSlotDto) {
    const { data, error } = await (this.supabase.client as any)
      .from('booking_slots')
      .insert({
        tenant_id: tenant.id,
        created_by: userId,
        start_at: dto.startAt,
        end_at: dto.endAt,
        title: dto.title ?? 'Créneau disponible',
        type: dto.type ?? 'consultation',
        status: 'available',
      })
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async listSlots(
    tenantId: string,
    from?: string,
    to?: string,
  ) {
    let query = (this.supabase.client as any)
      .from('booking_slots')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'available')
      .order('start_at', { ascending: true });

    if (from) query = query.gte('start_at', from);
    if (to) query = query.lte('end_at', to);

    const { data } = await query;
    return data ?? [];
  }

  async getSlot(slotId: string, tenantId: string) {
    const { data, error } = await (this.supabase.client as any)
      .from('booking_slots')
      .select('*')
      .eq('id', slotId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) throw new NotFoundException('Créneau introuvable');
    return data;
  }

  async deleteSlot(slotId: string, tenantId: string) {
    const { error } = await (this.supabase.client as any)
      .from('booking_slots')
      .delete()
      .eq('id', slotId)
      .eq('tenant_id', tenantId);

    if (error) throw new BadRequestException(error.message);
  }

  // ── Appointments (rendez-vous) ───────────────────────────────────────────

  async requestAppointment(
    tenant: TenantContext,
    userId: string,
    dto: CreateAppointmentDto,
  ) {
    // Vérifier que le créneau est disponible
    const slot = await this.getSlot(dto.slotId, tenant.id);
    if (slot.status !== 'available') {
      throw new ConflictException('Ce créneau n\'est plus disponible');
    }

    // Créer le rendez-vous
    const { data, error } = await (this.supabase.client as any)
      .from('appointments')
      .insert({
        tenant_id: tenant.id,
        student_id: userId,
        slot_id: dto.slotId,
        status: 'requested',
        notes: dto.notes ?? '',
        source: dto.source ?? 'app',
      })
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);

    // Marquer le créneau comme réservé
    await (this.supabase.client as any)
      .from('booking_slots')
      .update({ status: 'booked' })
      .eq('id', dto.slotId);

    return data;
  }

  async updateAppointment(
    appointmentId: string,
    tenantId: string,
    dto: UpdateAppointmentDto,
  ) {
    const patch: Record<string, unknown> = {};
    if (dto.status) patch.status = dto.status;
    if (dto.notes !== undefined) patch.notes = dto.notes;

    const { data, error } = await (this.supabase.client as any)
      .from('appointments')
      .update(patch)
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error || !data) throw new NotFoundException('Rendez-vous introuvable');
    return data;
  }

  async listAppointments(
    tenantId: string,
    userId?: string,
    role?: string,
  ) {
    let query = (this.supabase.client as any)
      .from('appointments')
      .select('*, booking_slots(start_at, end_at, title, type)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    // Students see only their appointments
    if (role === 'student' && userId) {
      query = query.eq('student_id', userId);
    }

    const { data } = await query;
    return data ?? [];
  }

  /**
   * Annulation par le propriétaire du RDV (élève/visiteur) — sans rôle staff.
   * Vérifie que le RDV appartient bien à l'utilisateur (student_id) avant d'annuler.
   */
  async cancelOwnAppointment(appointmentId: string, tenantId: string, userId: string) {
    const { data: appt } = await (this.supabase.client as any)
      .from('appointments')
      .select('id, student_id')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .single();
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    if (appt.student_id && String(appt.student_id) !== String(userId)) {
      throw new NotFoundException('Rendez-vous introuvable');
    }
    const { data, error } = await (this.supabase.client as any)
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();
    if (error || !data) throw new NotFoundException('Rendez-vous introuvable');
    return data;
  }

  async getAppointment(appointmentId: string, tenantId: string) {
    const { data, error } = await (this.supabase.client as any)
      .from('appointments')
      .select('*, booking_slots(start_at, end_at, title, type)')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .single();

    if (error || !data) throw new NotFoundException('Rendez-vous introuvable');
    return data;
  }

  // ── Prof → séance live avec un élève (action depuis le profil élève) ──────
  // Réutilise le moteur Liri (LiveService). Le prof ouvre ensuite /live/host/:id ;
  // l'élève est invité via le flux d'invitation live.
  async scheduleLiveWithStudent(
    tenant: TenantContext,
    teacherId: string,
    studentId: string,
    opts: { title?: string; scheduledAt?: string } = {},
  ) {
    const { data: member } = await (this.supabase.client as any)
      .from('tenant_memberships')
      .select('user_id')
      .eq('tenant_id', tenant.id)
      .eq('user_id', studentId)
      .maybeSingle();
    if (!member) throw new NotFoundException('Élève introuvable dans ce tenant');

    const live: any = await this.live.createSession(tenant.id, {
      teacher_id: teacherId,
      title: opts.title?.trim() || 'Séance live',
      session_type: 'entretien',
      scheduled_at: opts.scheduledAt || new Date().toISOString(),
    });
    if (!live?.id) throw new BadRequestException('Création de la séance live impossible');
    return { ok: true, liveSessionId: live.id };
  }

  // ── Pont RDV → séance live (école) ───────────────────────────────────────
  // Porté d'ISNA v1 (booking-start-immersive-live). Le staff transforme un
  // rendez-vous confirmé en séance live LIRI (entretien privé). Idempotent.
  // S'appuie sur le moteur Liri (LiveService), comme teleconsult.service côté santé.
  async startLiveFromAppointment(
    tenant: TenantContext,
    staffUserId: string,
    appointmentId: string,
  ) {
    const appt: any = await this.getAppointment(appointmentId, tenant.id);

    // Idempotent : si la séance existe déjà, on la renvoie.
    if (appt.live_session_id) {
      return { ok: true, liveSessionId: appt.live_session_id, reused: true };
    }

    const scheduledAt =
      appt.scheduled_at || appt.booking_slots?.start_at || new Date().toISOString();
    const shortId = String(appt.id).slice(0, 8);

    // Création de la séance via le moteur Liri (autorité vidéo unique).
    const live: any = await this.live.createSession(tenant.id, {
      teacher_id: staffUserId,
      title: `Live entretien ${shortId}`,
      session_type: 'entretien',
      scheduled_at: scheduledAt,
      appointment_id: appt.id,
    });
    if (!live?.id) {
      throw new BadRequestException('Création de la séance live impossible');
    }

    // Lien retour RDV → séance.
    await (this.supabase.client as any)
      .from('appointments')
      .update({ live_session_id: live.id })
      .eq('id', appt.id)
      .eq('tenant_id', tenant.id);

    return { ok: true, liveSessionId: live.id, reused: false };
  }

  // ── Secrétaires disponibles (moteur de matching v1) ──────────────────────
  // Branche secretaryMatching/timezoneRouting sur les vrais membres du tenant.
  async availableSecretaries(
    tenant: TenantContext,
    opts: { timezone?: string; country?: string; when?: string },
  ) {
    const context = detectVisitorContext({ timezone: opts.timezone, country: opts.country });
    const when = opts.when ? new Date(opts.when) : new Date();
    const closed = { strategy: 'closed' as const, openRegion: null };

    // 1) Staff éligibles du tenant.
    const { data: members } = await (this.supabase.client as any)
      .from('tenant_memberships')
      .select('user_id, role')
      .eq('tenant_id', tenant.id)
      .in('role', ['secretariat', 'admin', 'owner']);
    const ids = (members ?? []).map((m: any) => m.user_id).filter(Boolean);
    if (ids.length === 0) {
      return { context, strategy: closed, statuses: [], secretaries: [] };
    }

    // 2) Profils (champs secrétariat).
    const { data: rows } = await (this.supabase.client as any)
      .from('profiles')
      .select(
        'id,name,email,timezone,country_code,secretariat_region,is_secretariat_active,is_secretariat_online,secretariat_last_seen_at,secretariat_sla_ms,availability_start_hour,availability_end_hour',
      )
      .in('id', ids);
    const secretaries = (rows ?? []).map((row: any) => {
      const s = normalizeSecretaryProfile(row);
      // Éligible par défaut si membre staff et non explicitement désactivé.
      if (row.is_secretariat_active === null || row.is_secretariat_active === undefined) {
        s.active = true;
      }
      return s;
    });

    // 3) Charge (RDV en cours par membre).
    const { data: queueRows } = await (this.supabase.client as any)
      .from('appointments')
      .select('teacher_id')
      .eq('tenant_id', tenant.id)
      .in('status', ['requested', 'scheduled', 'preparing']);
    const queueBySecretary: Record<string, number> = {};
    for (const r of queueRows ?? []) {
      const id = r?.teacher_id;
      if (id) queueBySecretary[id] = (queueBySecretary[id] || 0) + 1;
    }

    // 4) Capacité (créneaux dispo des 7 prochains jours par créateur).
    const windowEnd = new Date(when);
    windowEnd.setDate(windowEnd.getDate() + 7);
    const { data: slotRows } = await (this.supabase.client as any)
      .from('booking_slots')
      .select('created_by, status')
      .eq('tenant_id', tenant.id)
      .eq('status', 'available')
      .gte('start_at', when.toISOString())
      .lte('start_at', windowEnd.toISOString());
    const capacityBySecretary: Record<string, { free: number; total: number }> = {};
    for (const slot of slotRows ?? []) {
      const id = slot?.created_by;
      if (!id) continue;
      if (!capacityBySecretary[id]) capacityBySecretary[id] = { free: 0, total: 0 };
      capacityBySecretary[id].total += 1;
      capacityBySecretary[id].free += 1;
    }

    const strategy = matchingStrategy({ secretaries, visitorRegion: context.region, now: when });
    const statuses = regionStatus(secretaries, when);
    const ranked = rankSecretaries({
      secretaries,
      queueBySecretary,
      capacityBySecretary,
      visitorRegion: context.region,
      slotDate: when,
    }).map((s) => ({
      id: s.id,
      name: s.name,
      region: s.region,
      timezone: s.timezone,
      score: s.score,
      isOnline: s.isOnline,
      isOpenForSlot: s.isOpenForSlot,
      queueEstimate: s.queueCount,
      freeSlots: capacityBySecretary[s.id]?.free ?? null,
    }));

    return { context, strategy, statuses, secretaries: ranked };
  }

  /** Charge les secrétaires éligibles du tenant (rôle staff) avec leurs champs secrétariat. */
  private async loadTenantSecretaries(tenantId: string) {
    const { data: members } = await (this.supabase.client as any)
      .from('tenant_memberships')
      .select('user_id, role')
      .eq('tenant_id', tenantId)
      .in('role', ['secretariat', 'admin', 'owner']);
    const ids = (members ?? []).map((m: any) => m.user_id).filter(Boolean);
    if (ids.length === 0) return [];
    const { data: rows } = await (this.supabase.client as any)
      .from('profiles')
      .select(
        'id,name,email,timezone,country_code,secretariat_region,is_secretariat_active,is_secretariat_online,secretariat_last_seen_at,secretariat_sla_ms,availability_start_hour,availability_end_hour',
      )
      .in('id', ids);
    return (rows ?? []).map((row: any) => {
      const s = normalizeSecretaryProfile(row);
      if (row.is_secretariat_active === null || row.is_secretariat_active === undefined) s.active = true;
      return s;
    });
  }

  // ── Créneaux intelligents (slotGrid + recommandations) ───────────────────
  // Porté d'ISNA v1 (booking-available-slots + availabilityEngine).
  async slotAvailability(
    tenant: TenantContext,
    opts: { timezone?: string; country?: string; windowStart: string; windowEnd: string },
  ) {
    const context = detectVisitorContext({ timezone: opts.timezone, country: opts.country });
    const windowStart = new Date(opts.windowStart);
    const windowEnd = new Date(opts.windowEnd);
    if (
      Number.isNaN(windowStart.getTime()) ||
      Number.isNaN(windowEnd.getTime()) ||
      windowEnd <= windowStart
    ) {
      throw new BadRequestException('Fenêtre invalide (windowStart/windowEnd requis)');
    }

    const secretaries = await this.loadTenantSecretaries(tenant.id);
    if (secretaries.length === 0) {
      return { context, slots: [], fallbackSlots: [], slotGrid: [], regionStatuses: [], schoolOpen: false };
    }

    // Réservés + charge : RDV du tenant assignés à un membre, créneau via booking_slots.
    const { data: appts } = await (this.supabase.client as any)
      .from('appointments')
      .select('teacher_id, status, booking_slots(start_at)')
      .eq('tenant_id', tenant.id)
      .in('status', ['requested', 'scheduled', 'preparing', 'confirmed'])
      .not('teacher_id', 'is', null)
      .limit(500);
    const reservedRows = (appts ?? [])
      .map((a: any) => ({
        assigned_teacher_id: a.teacher_id,
        scheduled_at: a.booking_slots?.start_at ?? null,
        status: a.status,
      }))
      .filter((r: any) => r.scheduled_at);
    const queueRows = (appts ?? [])
      .filter((a: any) => a.status === 'requested')
      .map((a: any) => ({ assigned_teacher_id: a.teacher_id }));

    const av = buildAvailability({
      secretaries,
      reservedRows,
      queueRows,
      visitorRegion: context.region,
      visitorTimezone: context.timezone,
      windowStart,
      windowEnd,
    });
    const schoolOpen = av.regionStatuses.find((r) => r.region === context.region)?.schoolOpen || false;
    return {
      context,
      slots: av.slots,
      fallbackSlots: av.fallbackSlots,
      slotGrid: av.slotGrid,
      regionStatuses: av.regionStatuses,
      schoolOpen,
    };
  }

  // ── Préparation d'entretien (secrétariat) ────────────────────────────────
  // Porté d'ISNA v1 (booking-set-preparation). Remplace l'appel Netlify v1.
  async getAppointmentPreparation(tenant: TenantContext, appointmentId: string) {
    await this.getAppointment(appointmentId, tenant.id); // garde tenant
    const { data } = await (this.supabase.client as any)
      .from('appointment_preparation')
      .select('plan_json, room_type, notes_secretary, documents_json, is_ready')
      .eq('appointment_id', appointmentId)
      .maybeSingle();
    return data ?? null;
  }

  async setAppointmentPreparation(
    tenant: TenantContext,
    appointmentId: string,
    dto: SetPreparationDto,
  ) {
    await this.getAppointment(appointmentId, tenant.id); // 404 si hors tenant

    const { data: prep, error: prepErr } = await (this.supabase.client as any)
      .from('appointment_preparation')
      .upsert(
        {
          tenant_id: tenant.id,
          appointment_id: appointmentId,
          plan_json: Array.isArray(dto.planJson) ? dto.planJson : [],
          room_type: dto.roomType ?? 'chat',
          notes_secretary: dto.notesSecretary?.trim() || null,
          documents_json: Array.isArray(dto.documentsJson) ? dto.documentsJson : [],
          is_ready: Boolean(dto.isReady),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'appointment_id' },
      )
      .select('id')
      .single();
    if (prepErr) throw new BadRequestException(prepErr.message);

    // Maj du statut du RDV si demandé (active le bouton « Rejoindre » côté élève).
    if (dto.newStatus) {
      await (this.supabase.client as any)
        .from('appointments')
        .update({ status: dto.newStatus })
        .eq('id', appointmentId)
        .eq('tenant_id', tenant.id);
    }

    return { ok: true, preparationId: prep?.id, status: dto.newStatus ?? null };
  }

  // ── Feedback / Satisfaction ──────────────────────────────────────────────

  async submitFeedback(tenantId: string, userId: string, dto: SubmitFeedbackDto) {
    const { data, error } = await (this.supabase.client as any)
      .from('appointment_feedback')
      .upsert({
        tenant_id: tenantId,
        appointment_id: dto.appointmentId,
        user_id: userId,
        rating: dto.rating,
        comment: dto.comment ?? '',
      }, { onConflict: 'appointment_id,user_id' })
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async getFeedback(appointmentId: string, tenantId: string) {
    const { data } = await (this.supabase.client as any)
      .from('appointment_feedback')
      .select('*')
      .eq('appointment_id', appointmentId)
      .eq('tenant_id', tenantId);

    return data ?? [];
  }
}
