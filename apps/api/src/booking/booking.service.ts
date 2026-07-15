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
import { NotificationsService } from '../notifications/notifications.service';
import type { TenantContext } from '../tenant/tenant.types';
import type { CreateAppointmentDto, CreateSlotDto, SetPreparationDto, SubmitFeedbackDto, UpdateAppointmentDto } from './dto/booking.dto';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly live: LiveService,
    private readonly notifications: NotificationsService,
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

  /**
   * Demande de RDV SANS créneau, depuis le chat conversationnel LIRI (LiriRendezVousPage).
   * Le secrétariat planifie ensuite le créneau. Insert service-role dans `appointments`
   * (slot_id NULL, status='requested'). Remplace l'edge function `liri-appointment-request`
   * (non déployée + visait des tables inexistantes student_appointments/appointment_requests).
   */
  async requestAppointmentNoSlot(
    tenantId: string,
    userId: string,
    dto: {
      subject?: string;
      description?: string;
      email?: string;
      whatsapp?: string;
      preferredIso?: string; // créneau choisi par l'élève (grille de dispo) — optionnel
    },
  ) {
    const subject = String(dto?.subject || '').trim();
    const email = String(dto?.email || '').trim();
    const whatsapp = String(dto?.whatsapp || '').trim();
    if (subject.length < 3) throw new BadRequestException('Sujet trop court (3 caractères minimum).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('E-mail invalide.');
    if (whatsapp.replace(/\D/g, '').length < 8) throw new BadRequestException('Numéro WhatsApp invalide.');

    // Créneau choisi ? On le MATÉRIALISE : un booking_slot est créé à l'heure demandée puis
    // réservé, et le RDV y est rattaché (slot_id). Sinon → demande sans créneau (le secrétariat
    // proposera un horaire). Permet un vrai parcours « choisis ta date » même sans slots pré-publiés.
    const client = this.supabase.client as any;
    let chosenStart: Date | null = null;
    if (dto?.preferredIso) {
      const d = new Date(dto.preferredIso);
      if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now() - 60_000) chosenStart = d;
    }

    const notes = [
      `Sujet : ${subject}`,
      `Description : ${String(dto?.description || '').trim() || '—'}`,
      `E-mail : ${email}`,
      `WhatsApp : ${whatsapp}`,
      chosenStart ? `Créneau souhaité : ${chosenStart.toISOString()}` : null,
    ].filter(Boolean).join('\n');

    let slotId: string | null = null;
    let startAt: string | null = null;
    if (chosenStart) {
      const end = new Date(chosenStart.getTime() + 30 * 60_000);
      const { data: slot, error: slotErr } = await client
        .from('booking_slots')
        .insert({
          tenant_id: tenantId,
          created_by: userId,
          start_at: chosenStart.toISOString(),
          end_at: end.toISOString(),
          title: subject.slice(0, 120),
          type: 'consultation',
          status: 'booked', // directement réservé par cette demande
        })
        .select('id, start_at')
        .maybeSingle();
      if (slotErr) throw new BadRequestException(slotErr.message);
      slotId = slot?.id ?? null;
      startAt = slot?.start_at ?? null;
    }

    const { data, error } = await client
      .from('appointments')
      .insert({
        tenant_id: tenantId,
        student_id: userId,
        slot_id: slotId,
        status: 'requested',
        notes,
        source: 'liri-rdv-chat',
      })
      .select('id')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);

    // Notifications (in-app + email brandé tenant) — best-effort, ne bloque JAMAIS le RDV.
    void this.notifyAppointmentRequest(tenantId, userId, { subject, email, whatsapp, chosenStart });

    return { ok: true, requestId: data?.id ?? null, slotId, startAt };
  }

  /** Confirme l'élève + alerte le secrétariat/staff d'une nouvelle demande de RDV. Best-effort. */
  private async notifyAppointmentRequest(
    tenantId: string,
    userId: string,
    info: { subject: string; email: string; whatsapp: string; chosenStart: Date | null },
  ): Promise<void> {
    try {
      const whenTxt = info.chosenStart
        ? ` pour le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(info.chosenStart)}`
        : '';
      // 1) Élève : confirmation.
      await this.notifications.send(tenantId, userId, {
        title: info.chosenStart ? 'Rendez-vous enregistré ✓' : 'Demande de rendez-vous reçue ✓',
        body: info.chosenStart
          ? `Ton rendez-vous « ${info.subject} »${whenTxt} est enregistré. Le secrétariat te confirme bientôt.`
          : `Ta demande « ${info.subject} » est bien reçue. Le secrétariat te proposera un créneau.`,
        type: 'success',
        email: true,
        actionUrl: '/liri/rendez-vous',
      });
      // 2) Secrétariat / staff : alerte nouvelle demande.
      const { data: staff } = await (this.supabase.client as any)
        .from('tenant_memberships')
        .select('user_id, role')
        .eq('tenant_id', tenantId)
        .in('role', ['secretariat', 'owner', 'admin']);
      const seen = new Set<string>();
      for (const m of (staff ?? []) as Array<{ user_id?: string }>) {
        const uid = m.user_id;
        if (!uid || seen.has(uid) || uid === userId) continue;
        seen.add(uid);
        await this.notifications
          .send(tenantId, uid, {
            title: 'Nouvelle demande de rendez-vous',
            body: `« ${info.subject} »${whenTxt} — ${info.email} · ${info.whatsapp}`,
            type: 'info',
            email: true,
            actionUrl: '/secretariat-space/rendez-vous', // liste RDV du secrétariat (staff/owner)
          })
          .catch(() => {});
      }
    } catch (e) {
      this.logger.warn(`RDV notif: ${(e as Error).message}`);
    }
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

    // 2) Profils — UNIQUEMENT les colonnes qui existent en prod (id/name/email). Les champs
    //    secrétariat (timezone/region/availability/…) n'existent pas → normalizeSecretaryProfile
    //    applique des défauts (actif, en ligne, heures d'ouverture région). Sélectionner les
    //    colonnes fantômes faisait échouer la requête → 0 secrétaire.
    const { data: rows } = await (this.supabase.client as any)
      .from('profiles')
      .select('id, name, email')
      .in('id', ids);
    const secretaries = (rows ?? []).map((row: any) => normalizeSecretaryProfile(row));

    // 3) Charge par secrétaire : dérivée des booking_slots RÉSERVÉS (appointments.teacher_id
    //    n'existe pas en prod). Approximation raisonnable pour le scoring « faible file ».
    const queueBySecretary: Record<string, number> = {};

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
    // Colonnes existantes seulement (cf. availableSecretaries) — défauts via normalizeSecretaryProfile.
    const { data: rows } = await (this.supabase.client as any)
      .from('profiles')
      .select('id, name, email')
      .in('id', ids);
    return (rows ?? []).map((row: any) => normalizeSecretaryProfile(row));
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
    // Aligne le début sur le prochain multiple de 30 min → créneaux RONDS (09:00, 09:30…),
    // pas 09:03/09:33 (sinon la grille part de « maintenant »). UX Calendly propre.
    windowStart.setSeconds(0, 0);
    const rem = windowStart.getMinutes() % 30;
    if (rem !== 0) windowStart.setMinutes(windowStart.getMinutes() + (30 - rem));

    const secretaries = await this.loadTenantSecretaries(tenant.id);
    if (secretaries.length === 0) {
      return { context, slots: [], fallbackSlots: [], slotGrid: [], regionStatuses: [], schoolOpen: false };
    }

    // Créneaux DÉJÀ RÉSERVÉS : dérivés des booking_slots status='booked' (appointments.teacher_id
    // n'existe pas en prod). Le créneau pris est associé à son créateur (created_by). Marque les
    // cases correspondantes en 'taken' dans la grille.
    const { data: bookedSlots } = await (this.supabase.client as any)
      .from('booking_slots')
      .select('created_by, start_at, status')
      .eq('tenant_id', tenant.id)
      .eq('status', 'booked')
      .gte('start_at', windowStart.toISOString())
      .lte('start_at', windowEnd.toISOString())
      .limit(1000);
    const reservedRows = (bookedSlots ?? [])
      .filter((s: any) => s?.start_at && s?.created_by)
      .map((s: any) => ({ assigned_teacher_id: s.created_by, scheduled_at: s.start_at, status: 'booked' }));
    const queueRows: Array<{ assigned_teacher_id: string }> = [];

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
