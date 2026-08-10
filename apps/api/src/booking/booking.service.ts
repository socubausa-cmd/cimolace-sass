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
import { DEEPSEEK_FAST_MODEL } from '../common/deepseek-models';
import { buildAvailability, isSlotWithinRules } from './engine/availability';
import { randomBytes } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { isWhatsAppConfigured, resolveWaMsisdn, sendWhatsAppTemplate } from '../common/whatsapp.util';
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

    if ((data as any)?.id) {
      void this.logAppointmentEvent(tenant.id, (data as any).id, 'requested', {
        actorType: 'client', actorId: userId, summary: 'Demande de rendez-vous',
      });
      // La cloche staff doit sonner pour TOUTE demande entrante — ce chemin (avec créneau)
      // n'alertait personne, seul le chemin sans créneau le faisait.
      const whenTxt = slot?.start_at
        ? ` — ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(slot.start_at))}`
        : '';
      void this.notifyStaff(tenant.id, {
        title: 'Nouvelle demande de rendez-vous',
        body: `${slot?.title || 'Créneau réservé'}${whenTxt}`,
        type: 'info', email: true, actionUrl: '/liri/rdv',
      }, userId);
    }
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
      serviceKey?: string; // type de séance (prière / téléconsult / formation) — optionnel
    },
  ) {
    const subject = String(dto?.subject || '').trim();
    const email = String(dto?.email || '').trim();
    // Le formulaire envoie désormais l'international canonique « +241… » (pays choisi →
    // indicatif imposé). On le canonise (+ suivi de chiffres seuls) et on valide strictement ;
    // un numéro SANS « + » (vieux bundle en cache) garde l'ancien seuil laxiste ≥ 8 chiffres.
    const whatsappBrut = String(dto?.whatsapp || '').trim();
    const whatsapp = whatsappBrut.startsWith('+') ? `+${whatsappBrut.replace(/\D/g, '')}` : whatsappBrut;
    if (subject.length < 3) throw new BadRequestException('Sujet trop court (3 caractères minimum).');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('E-mail invalide.');
    const chiffresWa = whatsapp.replace(/\D/g, '').length;
    const waValide = whatsapp.startsWith('+') ? chiffresWa >= 8 && chiffresWa <= 15 : chiffresWa >= 8;
    if (!waValide) throw new BadRequestException('Numéro WhatsApp invalide (indicatif pays + numéro).');

    // Créneau choisi ? On le MATÉRIALISE : un booking_slot est créé à l'heure demandée puis
    // réservé, et le RDV y est rattaché (slot_id). Sinon → demande sans créneau (le secrétariat
    // proposera un horaire). Permet un vrai parcours « choisis ta date » même sans slots pré-publiés.
    const client = this.supabase.client as any;
    let chosenStart: Date | null = null;
    if (dto?.preferredIso) {
      const d = new Date(dto.preferredIso);
      if (!Number.isNaN(d.getTime()) && d.getTime() > Date.now() - 60_000) chosenStart = d;
    }

    // Métadonnées tenant : règles de dispo + catalogue de services.
    let tenantMeta: any = null;
    try {
      const { data: t } = await client.from('tenants').select('metadata').eq('id', tenantId).maybeSingle();
      tenantMeta = (t as any)?.metadata || null;
    } catch { /* best-effort */ }

    // Garde : créneau choisi conforme aux règles de dispo (jour ouvert, plage, aligné, non blackout).
    if (chosenStart) {
      const rules = tenantMeta?.booking_availability;
      if (rules?.weekly && !isSlotWithinRules(chosenStart, rules)) {
        throw new BadRequestException('Ce créneau n’est pas disponible. Merci d’en choisir un autre.');
      }
    }

    // Service choisi (validé contre le catalogue tenant → sinon 'consultation').
    const services: any[] = Array.isArray(tenantMeta?.booking_services) ? tenantMeta.booking_services : [];
    const svc = services.find((x) => x?.key === String(dto?.serviceKey || '')) || null;
    const serviceType = svc?.key || 'consultation';
    const serviceLabel = svc?.label || '';

    const notes = [
      serviceLabel ? `Service : ${serviceLabel}` : null,
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
          type: serviceType,
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

    if (data?.id) {
      void this.logAppointmentEvent(tenantId, data.id, 'requested', {
        actorType: 'client', summary: `Demande : ${subject}`,
        metadata: { email, whatsapp, serviceKey: dto?.serviceKey || null, chosenStart: chosenStart?.toISOString() || null },
      });
    }

    return { ok: true, requestId: data?.id ?? null, slotId, startAt };
  }

  /** Accusé de réception e-mail au DEMANDEUR (adresse saisie), via la file FIABLE email_queue
   *  → worker → Resend (sender du tenant). Envoyé à la CRÉATION d'une demande de RDV : sans lui,
   *  le client (anonyme cagnotte ou élève) n'avait aucune confirmation avant la décision du staff.
   *  Best-effort — ne bloque jamais la demande. */
  private async queueRequesterAck(
    tenantId: string,
    info: { subject: string; email: string; chosenStart: Date | null },
  ): Promise<void> {
    try {
      const email = String(info.email || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
      const esc = (s: string) => String(s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const sujet = esc(info.subject || 'votre rendez-vous');
      const whenClean = info.chosenStart
        ? esc(new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(info.chosenStart))
        : '';
      const { data: ns } = await (this.supabase.client as any)
        .from('tenant_notification_settings')
        .select('email_from, email_from_name')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const bookingLink = process.env.BOOKING_PUBLIC_URL || 'https://prorascience.org/rendez-vous-priere';
      const html = `<h2>Votre demande de rendez-vous 🙏</h2><p>Bonjour,</p>`
        + `<p>Nous avons bien reçu votre demande « <strong>${sujet}</strong> »`
        + (whenClean ? ` pour le <strong>${whenClean}</strong>` : '')
        + `.</p>`
        + (info.chosenStart
            ? `<p>Nous vous confirmerons ce créneau très prochainement.</p>`
            : `<p>Nous vous proposerons un créneau très prochainement.</p>`)
        + `<p>Vous pouvez aussi choisir un créneau dès maintenant : <a href="${bookingLink}">${bookingLink}</a></p>`
        + `<p style="color:#777;font-size:13px;">Avec toute notre gratitude,<br/>Ngowazulu — Prorascience</p>`;
      await (this.supabase.client as any).from('email_queue').insert({
        tenant_id: tenantId,
        to: email,
        from: (ns as any)?.email_from ?? null,
        from_name: (ns as any)?.email_from_name ?? null,
        subject: 'Votre demande de rendez-vous — bien reçue ✓',
        html_body: html,
      });
    } catch (e) {
      this.logger.warn(`RDV ack demandeur: ${(e as Error).message}`);
    }
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
      // Une demande PUBLIQUE (cagnotte) est rattachée à l'OWNER faute de compte demandeur.
      const ownerUserId = await this.ownerOf(tenantId);
      const isAnon = !!ownerUserId && userId === ownerUserId;

      // 1) ACCUSÉ AU DEMANDEUR — e-mail FIABLE à l'adresse saisie via la file email_queue
      //    (worker → Resend, sender du tenant). Même canal que les autres accusés qui partent
      //    bien (accompagnement, décisions). Vaut pour la voie publique (anonyme) ET le chat
      //    élève → le client reçoit une vraie confirmation « demande bien reçue ».
      await this.queueRequesterAck(tenantId, info);

      // Accusé WhatsApp au demandeur (best-effort) — renfort pour ceux qui ne lisent pas leurs
      //    e-mails. UNIQUEMENT si WhatsApp est activé ET le numéro se normalise SANS ambiguïté
      //    (resolveWaMsisdn → null pour un indicatif indevinable, on n'écrit jamais à un inconnu).
      if (isWhatsAppConfigured()) {
        const waMsisdn = resolveWaMsisdn(info.whatsapp);
        if (waMsisdn) {
          const lien = process.env.BOOKING_PUBLIC_URL || 'https://prorascience.org/rendez-vous-priere';
          const phrase = info.chosenStart
            ? `votre demande est bien reçue. Détails et report de votre créneau : ${lien}`
            : `votre demande est bien reçue. Choisissez votre créneau ici : ${lien}`;
          const r = await sendWhatsAppTemplate(waMsisdn, {
            template: process.env.WHATSAPP_TEMPLATE_RDV || 'rdv_notification',
            lang: process.env.WHATSAPP_TEMPLATE_LANG || 'fr',
            bodyParams: [info.subject || 'votre rendez-vous', phrase],
          });
          if (!r.ok) this.logger.warn(`RDV ack WhatsApp KO: ${r.error}`);
        }
      }

      // Notif in-app « demande reçue » : seulement pour un vrai membre connecté (pas l'owner
      //    rattaché d'une demande anonyme). E-mail déjà couvert ci-dessus → email:false (0 doublon).
      if (!isAnon) {
        await this.notifications.send(tenantId, userId, {
          title: info.chosenStart ? 'Rendez-vous enregistré ✓' : 'Demande de rendez-vous reçue ✓',
          body: info.chosenStart
            ? `Ton rendez-vous « ${info.subject} »${whenTxt} est enregistré. Le secrétariat te confirme bientôt.`
            : `Ta demande « ${info.subject} » est bien reçue. Le secrétariat te proposera un créneau.`,
          type: 'success',
          email: false,
          actionUrl: '/liri/rendez-vous',
        });
      }
      // 2) Secrétariat / staff : alerte nouvelle demande.
      const { data: staff } = await (this.supabase.client as any)
        .from('tenant_memberships')
        .select('user_id, role')
        .eq('tenant_id', tenantId)
        .in('role', ['secretariat', 'owner', 'admin']);
      const seen = new Set<string>();
      for (const m of (staff ?? []) as Array<{ user_id?: string }>) {
        const uid = m.user_id;
        // Sur une demande publique (isAnon), l'owner EST le destinataire à alerter → on ne l'exclut pas.
        if (!uid || seen.has(uid) || (!isAnon && uid === userId)) continue;
        seen.add(uid);
        await this.notifications
          .send(tenantId, uid, {
            title: 'Nouvelle demande de rendez-vous',
            body: `« ${info.subject} »${whenTxt} — ${info.email} · ${info.whatsapp}`,
            type: 'info',
            email: true,
            actionUrl: '/liri/rdv', // écran RDV du portail LIRI (staff/owner)
          })
          .catch(() => {});
      }
    } catch (e) {
      this.logger.warn(`RDV notif: ${(e as Error).message}`);
    }
  }

  /** Journalise un événement de RDV (audit → timeline « intelligente »). Best-effort.
   *  Public : réutilisé par BookingAdvancedService (respondInvitation) — même journal,
   *  jamais deux écritures d'audit divergentes. */
  async logAppointmentEvent(
    tenantId: string,
    appointmentId: string,
    kind: string,
    opts: {
      actorType?: 'system' | 'staff' | 'client';
      actorId?: string | null;
      summary?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    try {
      await (this.supabase.client as any).from('appointment_events').insert({
        tenant_id: tenantId,
        appointment_id: appointmentId,
        kind,
        actor_type: opts.actorType || 'system',
        actor_id: opts.actorId ?? null,
        summary: opts.summary ?? null,
        metadata: opts.metadata ?? {},
      });
    } catch (e) {
      this.logger.warn(`appointment_event(${kind}): ${(e as Error).message}`);
    }
  }

  /** Notifie tout le staff (owner/admin/secrétariat) du tenant. Best-effort, jamais bloquant.
   *  Public : réutilisé par BookingAdvancedService (respondInvitation). */
  async notifyStaff(
    tenantId: string,
    payload: { title: string; body: string; type?: string; email?: boolean; actionUrl?: string },
    exceptUserId?: string,
  ): Promise<void> {
    try {
      const { data: staff } = await (this.supabase.client as any)
        .from('tenant_memberships')
        .select('user_id, role')
        .eq('tenant_id', tenantId)
        .in('role', ['secretariat', 'owner', 'admin']);
      const seen = new Set<string>();
      for (const m of (staff ?? []) as Array<{ user_id?: string }>) {
        const uid = m.user_id;
        if (!uid || seen.has(uid) || uid === exceptUserId) continue;
        seen.add(uid);
        await this.notifications
          .send(tenantId, uid, {
            title: payload.title,
            body: payload.body,
            type: payload.type || 'info',
            email: payload.email ?? false,
            actionUrl: payload.actionUrl || '/liri/rdv',
          })
          .catch(() => {});
      }
    } catch (e) {
      this.logger.warn(`notifyStaff: ${(e as Error).message}`);
    }
  }

  async updateAppointment(
    appointmentId: string,
    tenantId: string,
    dto: UpdateAppointmentDto,
  ) {
    // Reprogrammation : déplace le créneau lié (booking_slot) au nouveau début, durée conservée.
    let rescheduled = false;
    if (dto.newStartAt) {
      const { data: cur } = await (this.supabase.client as any)
        .from('appointments').select('slot_id').eq('id', appointmentId).eq('tenant_id', tenantId).maybeSingle();
      const slotId = (cur as any)?.slot_id;
      if (slotId) {
        const { data: slot } = await (this.supabase.client as any)
          .from('booking_slots').select('start_at, end_at').eq('id', slotId).maybeSingle();
        const s0 = (slot as any)?.start_at ? new Date((slot as any).start_at).getTime() : 0;
        const e0 = (slot as any)?.end_at ? new Date((slot as any).end_at).getTime() : 0;
        const durMs = s0 && e0 && e0 > s0 ? e0 - s0 : 45 * 60 * 1000;
        const start = new Date(dto.newStartAt);
        const end = new Date(start.getTime() + durMs);
        await (this.supabase.client as any)
          .from('booking_slots')
          .update({ start_at: start.toISOString(), end_at: end.toISOString() })
          .eq('id', slotId).eq('tenant_id', tenantId);
        rescheduled = true;
      }
    }

    const patch: Record<string, unknown> = {};
    if (dto.status) patch.status = dto.status;
    else if (rescheduled) patch.status = 'confirmed'; // reprogrammé = re-confirmé au nouveau créneau
    if (dto.notes !== undefined) patch.notes = dto.notes;
    if (Object.keys(patch).length === 0) patch.updated_at = new Date().toISOString();

    const { data, error } = await (this.supabase.client as any)
      .from('appointments')
      .update(patch)
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .select('*, booking_slots(start_at)')
      .single();

    if (error || !data) throw new NotFoundException('Rendez-vous introuvable');

    // Notification (interne + demandeur externe) : reprogrammation, confirmation ou annulation.
    if (rescheduled) {
      void this.notifyAppointmentDecision(tenantId, data, { rescheduled: true, reason: dto.reason });
      void this.logAppointmentEvent(tenantId, appointmentId, 'host_rescheduled', {
        actorType: 'staff', summary: 'Report fixé par l’organisateur', metadata: { reason: dto.reason || null },
      });
    } else if (dto.status === 'confirmed' || dto.status === 'cancelled') {
      void this.notifyAppointmentDecision(tenantId, data, { reason: dto.reason });
      void this.logAppointmentEvent(
        tenantId,
        appointmentId,
        dto.status === 'confirmed' ? 'confirmed' : 'cancelled',
        {
          actorType: 'staff',
          summary: dto.status === 'confirmed' ? 'Rendez-vous confirmé' : 'Rendez-vous annulé / refusé',
          metadata: { reason: dto.reason || null },
        },
      );
    }
    return data;
  }

  /**
   * Notifie à la décision (confirmé/annulé) sur DEUX canaux, chacun best-effort/isolé :
   *  (1) le titulaire interne du RDV (`student_id`) — in-app + email ;
   *  (2) le DEMANDEUR EXTERNE si son e-mail est dans les notes. Les RDV publics (séance de
   *      prière de la cagnotte) sont rattachés au OWNER → la notif interne va au owner, pas au
   *      demandeur. On lui envoie donc un vrai e-mail via `email_queue` (worker → Resend, sender du tenant).
   */
  private async notifyAppointmentDecision(
    tenantId: string,
    appt: any,
    opts: { rescheduled?: boolean; reason?: string } = {},
  ): Promise<void> {
    const rescheduled = !!opts.rescheduled;
    const confirmed = !rescheduled && appt?.status === 'confirmed';
    const reasonTxt = opts.reason ? String(opts.reason).trim() : '';
    const startAt = appt?.booking_slots?.start_at;
    const whenTxt = startAt
      ? ` — ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(startAt))}`
      : '';

    // (1) Notif interne (titulaire du RDV = student_id).
    try {
      const studentId = appt?.student_id;
      if (studentId) {
        await this.notifications.send(tenantId, studentId, {
          title: rescheduled ? 'Rendez-vous reprogrammé 📅' : confirmed ? 'Rendez-vous confirmé ✓' : 'Rendez-vous annulé',
          body: rescheduled
            ? `Le rendez-vous est reprogrammé${whenTxt}.${reasonTxt ? ` (${reasonTxt})` : ''}`
            : confirmed
              ? `Ton rendez-vous est confirmé${whenTxt}. À bientôt !`
              : `Ton rendez-vous${whenTxt} a été annulé.${reasonTxt ? ` Motif : ${reasonTxt}.` : ' Tu peux refaire une demande quand tu veux.'}`,
          type: rescheduled || confirmed ? 'success' : 'info',
          email: true,
          actionUrl: '/liri/rendez-vous',
        });
      }
    } catch (e) {
      this.logger.warn(`RDV decision notif (interne): ${(e as Error).message}`);
    }

    // (2) WhatsApp au DEMANDEUR EXTERNE (si configuré + numéro présent). Gabarit Meta requis
    //     (cf. whatsapp.util). Inerte tant que l'env n'est pas posé → 0 risque avant activation.
    try {
      const notes = String(appt?.notes || '');
      const wa = (notes.match(/WhatsApp\s*:\s*([+\d][\d\s]{5,})/i)?.[1] || '').trim();
      if (isWhatsAppConfigured() && wa) {
        const sujet = (notes.match(/Sujet\s*:\s*([\s\S]*?)(?:\s*Description\s*:|$)/i)?.[1] || 'votre rendez-vous').trim();
        const when = startAt
          ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(startAt))
          : '';
        const statusPhrase = rescheduled
          ? `reprogrammé pour le ${when}${reasonTxt ? ` (${reasonTxt})` : ''}`
          : confirmed
            ? `confirmé pour le ${when}`
            : `n'a pas pu être retenu${reasonTxt ? ` : ${reasonTxt}` : ''}`;
        const r = await sendWhatsAppTemplate(wa, {
          template: process.env.WHATSAPP_TEMPLATE_RDV || 'rdv_notification',
          lang: process.env.WHATSAPP_TEMPLATE_LANG || 'fr',
          bodyParams: [sujet, statusPhrase],
        });
        if (!r.ok) this.logger.warn(`WhatsApp RDV KO: ${r.error}`);
      }
    } catch (e) {
      this.logger.warn(`RDV decision notif (WhatsApp): ${(e as Error).message}`);
    }

    // (3) E-mail au DEMANDEUR EXTERNE (e-mail parsé dans les notes du RDV).
    try {
      const notes = String(appt?.notes || '');
      const email = (notes.match(/E-?mail\s*:\s*([^\s]+@[^\s]+)/i)?.[1] || '').trim();
      if (!email) return;
      const esc = (s: string) => String(s || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const sujet = esc((notes.match(/Sujet\s*:\s*([\s\S]*?)(?:\s*Description\s*:|$)/i)?.[1] || 'votre rendez-vous').trim());
      const reasonEsc = esc(reasonTxt);
      const whenClean = esc(whenTxt.replace(/^ — /, ''));
      const sign = `<p style="color:#777;font-size:13px;">Avec toute notre gratitude,<br/>Ngowazulu — Prorascience</p>`;
      const { data: ns } = await (this.supabase.client as any)
        .from('tenant_notification_settings')
        .select('email_from, email_from_name')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const subject = rescheduled
        ? 'Votre rendez-vous a été reprogrammé 📅'
        : confirmed ? 'Votre rendez-vous est confirmé ✓' : 'Votre demande de rendez-vous';
      const html = rescheduled
        ? `<h2>Votre rendez-vous a été reprogrammé 📅</h2><p>Bonjour,</p>`
          + `<p>Votre rendez-vous « <strong>${sujet}</strong> » est reprogrammé pour le <strong>${whenClean}</strong>.</p>`
          + (reasonEsc ? `<p>${reasonEsc}</p>` : '')
          + sign
        : confirmed
          ? `<h2>Votre rendez-vous est confirmé 🙏</h2><p>Bonjour,</p>`
            + `<p>Votre demande « <strong>${sujet}</strong> »${whenTxt} est <strong>confirmée</strong>. Nous vous attendons.</p>`
            + sign
          : `<h2>Votre demande de rendez-vous</h2><p>Bonjour,</p>`
            + `<p>Votre demande « <strong>${sujet}</strong> »${whenTxt} n'a pas pu être retenue.</p>`
            + (reasonEsc ? `<p>${reasonEsc}</p>` : `<p>N'hésitez pas à en refaire une autre quand vous le souhaitez.</p>`)
            + `<p style="color:#777;font-size:13px;">Prorascience</p>`;
      await (this.supabase.client as any).from('email_queue').insert({
        tenant_id: tenantId,
        to: email,
        from: (ns as any)?.email_from ?? null,
        from_name: (ns as any)?.email_from_name ?? null,
        subject,
        html_body: html,
      });
    } catch (e) {
      this.logger.warn(`RDV decision notif (externe): ${(e as Error).message}`);
    }
  }

  // ── Report par LIEN (self-service) ────────────────────────────────────────
  // Le staff envoie au demandeur un lien public ; le demandeur choisit lui-même un nouveau
  // créneau parmi les dispos du propriétaire. Token stocké dans booking_invitations.
  private rescheduleBase(): string {
    return (process.env.SCHOOL_FRONTEND_URL || 'https://prorascience.org').replace(/\/+$/, '');
  }

  private async ownerOf(tenantId: string): Promise<string | null> {
    const { data } = await (this.supabase.client as any)
      .from('tenants').select('owner_user_id').eq('id', tenantId).maybeSingle();
    return (data as any)?.owner_user_id || null;
  }

  /** Staff → génère un lien de report + l'envoie au demandeur (email + WhatsApp best-effort)
   *  + un ACCUSÉ de réception à l'hôte (preuve dans son email Prorascience). */
  async sendRescheduleLink(
    appointmentId: string,
    tenantId: string,
    opts: { reason?: string; actorId?: string } = {},
  ) {
    const client = this.supabase.client as any;
    const { data: appt } = await client
      .from('appointments')
      .select('id, notes, booking_slots(start_at)')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');

    const notes = String((appt as any).notes || '');
    const email = (notes.match(/E-?mail\s*:\s*([^\s]+@[^\s]+)/i)?.[1] || '').trim();
    const wa = (notes.match(/WhatsApp\s*:\s*([+\d][\d\s]{5,})/i)?.[1] || '').trim();
    const sujet = (notes.match(/Sujet\s*:\s*([\s\S]*?)(?:\s*Description\s*:|$)/i)?.[1] || 'votre rendez-vous').trim();
    const reason = String(opts.reason || '').trim();

    const token = randomBytes(24).toString('hex');
    const expires = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(); // 21 jours
    await client.from('booking_invitations').insert({
      tenant_id: tenantId,
      appointment_id: appointmentId,
      invited_email: email || null,
      token,
      expires_at: expires,
      status: 'sent',
      metadata: { purpose: 'self_reschedule', reason: reason || null },
    });

    void this.logAppointmentEvent(tenantId, appointmentId, 'reschedule_link_sent', {
      actorType: 'staff', actorId: opts.actorId ?? null,
      summary: 'Lien de report envoyé au demandeur — en attente de son choix',
      metadata: { reason: reason || null, email: email || null, whatsapp: wa || null },
    });

    const link = `${this.rescheduleBase()}/replanifier/${token}`;
    const esc = (s: string) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    // (1) Email — canal fiable (worker → Resend, sender du tenant).
    let sentEmail = false;
    if (email) {
      try {
        const { data: ns } = await client
          .from('tenant_notification_settings')
          .select('email_from, email_from_name')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        const html = `<h2>Reprogrammons votre rendez-vous 📅</h2><p>Bonjour,</p>`
          + `<p>Concernant votre rendez-vous « <strong>${esc(sujet)}</strong> », nous devons vous proposer un nouveau créneau.</p>`
          + (reason ? `<p>${esc(reason)}</p>` : '')
          + `<p style="margin:22px 0;"><a href="${link}" style="display:inline-block;background:#E86A5B;color:#fff;padding:13px 26px;border-radius:10px;text-decoration:none;font-weight:700;">Choisir un nouveau créneau</a></p>`
          + `<p style="color:#777;font-size:12px;">Ou copiez ce lien : <br/>${link}</p>`
          + `<p style="color:#777;font-size:13px;">Avec toute notre gratitude,<br/>Ngowazulu — Prorascience</p>`;
        await client.from('email_queue').insert({
          tenant_id: tenantId,
          to: email,
          from: (ns as any)?.email_from ?? null,
          from_name: (ns as any)?.email_from_name ?? null,
          subject: 'Reprogrammons votre rendez-vous 📅',
          html_body: html,
        });
        sentEmail = true;
      } catch (e) {
        this.logger.warn(`Reschedule link email KO: ${(e as Error).message}`);
      }
    }

    // (2) WhatsApp — best-effort (gabarit Meta requis, inerte si non configuré). Lien dans {{2}}.
    let sentWhatsApp = false;
    if (isWhatsAppConfigured() && wa) {
      try {
        const phrase = `un report vous est proposé${reason ? ` (${reason})` : ''}. Choisissez votre nouveau créneau ici : ${link}`;
        const r = await sendWhatsAppTemplate(wa, {
          template: process.env.WHATSAPP_TEMPLATE_RDV || 'rdv_notification',
          lang: process.env.WHATSAPP_TEMPLATE_LANG || 'fr',
          bodyParams: [sujet, phrase],
        });
        sentWhatsApp = r.ok;
        if (!r.ok) this.logger.warn(`Reschedule link WhatsApp KO: ${r.error}`);
      } catch (e) {
        this.logger.warn(`Reschedule link WhatsApp KO: ${(e as Error).message}`);
      }
    }

    // (3) ACCUSÉ de réception à l'HÔTE — preuve dans SON email Prorascience.
    let sentHostReceipt = false;
    let hostEmail: string | null = null;
    try {
      const { data: ns2 } = await client
        .from('tenant_notification_settings')
        .select('email_from, email_from_name, notify_email')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      // Destinataire de l'accusé : l'adresse Prorascience configurée (notify_email),
      // sinon repli sur l'email de l'acteur (celui qui clique), sinon owner du tenant.
      hostEmail = String((ns2 as any)?.notify_email || '').trim() || null;
      if (!hostEmail) {
        const actorId = opts.actorId || (await this.ownerOf(tenantId));
        if (actorId) {
          const { data: u } = await client.auth.admin.getUserById(actorId);
          hostEmail = String((u as any)?.user?.email || '').trim() || null;
        }
      }
      if (hostEmail) {
        const startAt = (appt as any)?.booking_slots?.start_at;
        let whenStr = '';
        if (startAt) {
          const d = new Date(startAt);
          if (!Number.isNaN(d.getTime())) {
            try { whenStr = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Libreville' }).format(d); } catch { whenStr = ''; }
          }
        }
        const chan = [
          sentEmail ? 'email ✓' : email ? 'email (mis en file)' : 'email — (aucune adresse)',
          sentWhatsApp ? 'WhatsApp ✓' : wa ? 'WhatsApp — (non envoyé)' : 'WhatsApp — (pas de numéro)',
        ].join(' · ');
        const rhtml =
          `<h2>Lien de report envoyé 📨</h2>`
          + `<p>Vous avez envoyé un lien de reprogrammation pour le rendez-vous « <strong>${esc(sujet)}</strong> »`
          + `${whenStr ? ` (initialement le ${esc(whenStr)})` : ''}.</p>`
          + `<p><strong>Demandeur :</strong> ${esc(email || wa || 'contact inconnu')}<br/>`
          + `<strong>Canaux :</strong> ${chan}</p>`
          + (reason ? `<p><strong>Votre mot :</strong> ${esc(reason)}</p>` : '')
          + `<p>Le demandeur choisira lui-même un nouveau créneau parmi vos disponibilités ; le rendez-vous repassera en « Confirmé » automatiquement.</p>`
          + `<p style="color:#777;font-size:12px;">Lien transmis : ${esc(link)}</p>`;
        await client.from('email_queue').insert({
          tenant_id: tenantId,
          to: hostEmail,
          from: (ns2 as any)?.email_from ?? null,
          from_name: (ns2 as any)?.email_from_name ?? null,
          subject: `Report envoyé — ${sujet}`,
          html_body: rhtml,
        });
        sentHostReceipt = true;
      }
    } catch (e) {
      this.logger.warn(`Reschedule host receipt KO: ${(e as Error).message}`);
    }

    return {
      ok: true, link, token,
      hasEmail: !!email, hasWhatsApp: !!wa,
      sentEmail, sentWhatsApp, sentHostReceipt, hostEmail,
    };
  }

  /**
   * IA — rédige le petit MOT de report envoyé au demandeur (2-3 phrases, FR, ton
   * Prorascience). Fallback fournisseur : Mistral si `MISTRAL_API_KEY`, sinon
   * DeepSeek v4-flash (⚠️ pas `deepseek-chat`, retiré → 400). Le lien n'est PAS
   * inclus (ajouté automatiquement à l'envoi). Renvoie `{ message, provider }`.
   */
  async draftRescheduleMessage(tenantId: string, appointmentId: string, hint?: string) {
    const client = this.supabase.client as any;
    const { data: appt } = await client
      .from('appointments')
      .select('id, notes, booking_slots(start_at)')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');

    const notes = String((appt as any).notes || '');
    const sujet = (notes.match(/Sujet\s*:\s*([\s\S]*?)(?:\s*Description\s*:|$)/i)?.[1] || 'votre rendez-vous').trim();
    const description = (notes.match(/Description\s*:\s*([\s\S]*?)(?:\s*E-?mail\s*:|$)/i)?.[1] || '').trim();
    const startAt = (appt as any)?.booking_slots?.start_at;
    let whenStr: string | null = null;
    if (startAt) {
      const d = new Date(startAt);
      if (!Number.isNaN(d.getTime())) {
        try { whenStr = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Africa/Libreville' }).format(d); } catch { whenStr = null; }
      }
    }
    const { data: t } = await client.from('tenants').select('name').eq('id', tenantId).maybeSingle();
    const org = (t as any)?.name || 'Prorascience';

    const system =
      `Tu es l'assistant de ${org}. Rédige un message COURT (2 à 3 phrases), chaleureux, ` +
      `respectueux et sobre, en français, adressé à une personne dont le rendez-vous doit être ` +
      `REPORTÉ. Le message s'excuse brièvement du report et l'invite à choisir elle-même un nouveau ` +
      `créneau (NE mets PAS de lien : il sera ajouté automatiquement). Pas d'objet d'e-mail, pas de ` +
      `formule de politesse lourde, pas de guillemets. Renvoie UNIQUEMENT le texte du message.`;
    const user =
      `Rendez-vous : « ${sujet} »${whenStr ? ` initialement prévu le ${whenStr}` : ''}.` +
      (description ? ` Contexte de la demande : ${description.slice(0, 400)}.` : '') +
      (hint && hint.trim() ? ` Précision de l'organisateur à intégrer : ${hint.trim()}.` : '');

    const providers = [
      { name: 'mistral', url: 'https://api.mistral.ai/v1/chat/completions', key: process.env.MISTRAL_API_KEY, model: 'mistral-large-latest' },
      { name: 'deepseek', url: 'https://api.deepseek.com/chat/completions', key: process.env.DEEPSEEK_API_KEY, model: DEEPSEEK_FAST_MODEL },
    ].filter((p) => !!p.key);
    if (providers.length === 0) {
      throw new BadRequestException('Aucun fournisseur IA configuré (MISTRAL_API_KEY / DEEPSEEK_API_KEY).');
    }

    let lastErr = '';
    for (const p of providers) {
      try {
        const res = await fetch(p.url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${p.key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: p.model,
            max_tokens: 400,
            temperature: 0.6,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
          }),
        });
        if (!res.ok) {
          lastErr = `${p.name} HTTP ${res.status}`;
          this.logger.warn(`draftRescheduleMessage ${lastErr}: ${(await res.text()).slice(0, 160)}`);
          continue;
        }
        const j = await res.json();
        const text = String(j?.choices?.[0]?.message?.content ?? '')
          .trim()
          .replace(/^["«»\s]+|["«»\s]+$/g, '')
          .trim();
        if (text) return { message: text, provider: p.name };
        lastErr = `${p.name} réponse vide`;
      } catch (e) {
        lastErr = `${p.name}: ${(e as Error).message}`;
        this.logger.warn(`draftRescheduleMessage ${lastErr}`);
      }
    }
    throw new BadRequestException(`Rédaction IA indisponible pour le moment (${lastErr}).`);
  }

  /** Valide un token de report (booking_invitations) — lève si invalide/expiré/déjà utilisé. */
  private async findRescheduleInvite(token: string) {
    const { data: inv } = await (this.supabase.client as any)
      .from('booking_invitations')
      .select('id, tenant_id, appointment_id, status, expires_at, metadata')
      .eq('token', String(token || '').trim())
      .maybeSingle();
    if (!inv) throw new NotFoundException('Lien invalide.');
    if ((inv as any).status && !['sent', 'pending'].includes(String((inv as any).status))) {
      throw new BadRequestException('Ce lien a déjà été utilisé.');
    }
    if ((inv as any).expires_at && new Date((inv as any).expires_at).getTime() < Date.now()) {
      throw new BadRequestException('Ce lien a expiré.');
    }
    return inv as any;
  }

  /** Public (token) → contexte de report : sujet, créneau actuel, slug pour charger la grille. */
  async getRescheduleContext(token: string) {
    const inv = await this.findRescheduleInvite(token);
    const client = this.supabase.client as any;
    const { data: appt } = await client
      .from('appointments').select('id, notes, booking_slots(start_at)').eq('id', inv.appointment_id).maybeSingle();
    const { data: t } = await client.from('tenants').select('slug, name').eq('id', inv.tenant_id).maybeSingle();
    const notes = String((appt as any)?.notes || '');
    const sujet = (notes.match(/Sujet\s*:\s*([\s\S]*?)(?:\s*Description\s*:|$)/i)?.[1] || 'votre rendez-vous').trim();
    return {
      ok: true,
      subject: sujet,
      currentStart: (appt as any)?.booking_slots?.start_at || null,
      slug: (t as any)?.slug || 'isna',
      orgName: (t as any)?.name || 'Prorascience',
      reason: inv.metadata?.reason || null,
    };
  }

  /** Public (token) → applique le nouveau créneau choisi par le demandeur. */
  async applyReschedule(token: string, preferredIso: string) {
    const inv = await this.findRescheduleInvite(token);
    const client = this.supabase.client as any;
    const tenantId = inv.tenant_id as string;

    const start = new Date(preferredIso);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 60_000) {
      throw new BadRequestException('Créneau invalide.');
    }
    // Garde règles de dispo (bon jour/heure).
    try {
      const { data: tt } = await client.from('tenants').select('metadata').eq('id', tenantId).maybeSingle();
      const rules = (tt as any)?.metadata?.booking_availability;
      if (rules?.weekly && !isSlotWithinRules(start, rules)) {
        throw new BadRequestException('Ce créneau n’est pas disponible. Merci d’en choisir un autre.');
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
    }

    const { data: appt } = await client
      .from('appointments').select('id, slot_id').eq('id', inv.appointment_id).eq('tenant_id', tenantId).maybeSingle();
    if (!appt) throw new NotFoundException('Rendez-vous introuvable.');

    const end = new Date(start.getTime() + 30 * 60_000);
    let slotId = (appt as any).slot_id as string | null;
    if (slotId) {
      await client.from('booking_slots')
        .update({ start_at: start.toISOString(), end_at: end.toISOString(), status: 'booked' })
        .eq('id', slotId).eq('tenant_id', tenantId);
    } else {
      const createdBy = await this.ownerOf(tenantId);
      const { data: slot } = await client.from('booking_slots').insert({
        tenant_id: tenantId,
        created_by: createdBy,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        title: 'Rendez-vous',
        type: 'consultation',
        status: 'booked',
      }).select('id').maybeSingle();
      slotId = (slot as any)?.id || null;
    }

    const { data: updated } = await client
      .from('appointments')
      .update({ slot_id: slotId, status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', inv.appointment_id).eq('tenant_id', tenantId)
      .select('*, booking_slots(start_at)').single();

    await client.from('booking_invitations')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', inv.id);

    // Notifie la reprogrammation (email + WhatsApp au demandeur + notif interne). Best-effort.
    void this.notifyAppointmentDecision(tenantId, updated, { rescheduled: true });

    // Audit + alerte STAFF : le demandeur a répondu au lien de report (le système n'est plus aveugle).
    void this.logAppointmentEvent(tenantId, inv.appointment_id, 'client_rescheduled', {
      actorType: 'client', summary: 'Le demandeur a choisi un nouveau créneau',
      metadata: { newStart: start.toISOString() },
    });
    void this.notifyStaff(tenantId, {
      title: 'Un demandeur a reprogrammé son rendez-vous 📅',
      body: `Nouveau créneau choisi : ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(start)}.`,
      type: 'success', email: true, actionUrl: '/liri/rdv',
    });

    return { ok: true, newStart: start.toISOString() };
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
    const list = (data ?? []) as any[];

    // Enrichit chaque RDV avec l'état de son DERNIER lien de report (booking_invitations) :
    //  - `awaiting_client` : lien envoyé, pas encore utilisé (le RDV « attend » le demandeur) ;
    //  - `client_responded` : le demandeur a choisi un créneau.
    // Rend l'écran « voyant » sans nouveau statut de RDV (dérivé, zéro migration côté appointments).
    if (list.length) {
      try {
        const ids = list.map((a) => a.id);
        const { data: invs } = await (this.supabase.client as any)
          .from('booking_invitations')
          .select('appointment_id, status, created_at, accepted_at, expires_at')
          .eq('tenant_id', tenantId)
          .in('appointment_id', ids)
          .order('created_at', { ascending: false });
        const latest = new Map<string, any>();
        for (const iv of (invs ?? []) as any[]) {
          if (!latest.has(iv.appointment_id)) latest.set(iv.appointment_id, iv);
        }
        const now = Date.now();
        for (const a of list) {
          const iv = latest.get(a.id);
          if (!iv) continue;
          const expired = iv.expires_at && new Date(iv.expires_at).getTime() < now;
          const open = ['sent', 'pending'].includes(String(iv.status)) && !expired;
          // Un RDV annulé/terminé/absent n'est jamais « en attente d'un report » (sinon il
          // resterait faussement dans l'onglet Reportés jusqu'à l'expiration du lien).
          const terminal = ['cancelled', 'completed', 'no_show'].includes(String(a.status));
          a.reschedule = {
            status: iv.status,
            sent_at: iv.created_at,
            accepted_at: iv.accepted_at,
            expires_at: iv.expires_at,
            state: iv.status === 'accepted' ? 'client_responded' : (open && !terminal) ? 'awaiting_client' : null,
          };
        }
      } catch (e) {
        this.logger.warn(`listAppointments reschedule-enrich: ${(e as Error).message}`);
      }
    }
    return list;
  }

  /**
   * Timeline « intelligente » d'un RDV : fusionne le journal d'audit (appointment_events)
   * avec des repères dérivés de l'objet (demande = created_at) et des invitations de report
   * (lien envoyé = created_at, demandeur a répondu = accepted_at). Ainsi l'historique est
   * utile IMMÉDIATEMENT, même pour les RDV antérieurs à la table d'audit. Ordre chronologique.
   */
  async listAppointmentEvents(tenantId: string, appointmentId: string) {
    const client = this.supabase.client as any;
    const [evsRes, invRes, apptRes] = await Promise.all([
      client.from('appointment_events').select('*')
        .eq('tenant_id', tenantId).eq('appointment_id', appointmentId),
      client.from('booking_invitations').select('status, created_at, accepted_at')
        .eq('tenant_id', tenantId).eq('appointment_id', appointmentId),
      client.from('appointments').select('created_at, status')
        .eq('tenant_id', tenantId).eq('id', appointmentId).maybeSingle(),
    ]);
    const items: Array<{ kind: string; at: string; summary?: string; source: string; metadata?: any; actor_type?: string }> = [];
    // Les repères DÉRIVÉS (objet + invitations) et les events d'AUDIT du même kind décrivent
    // le même fait avec des horodatages DIFFÉRENTS (inserts distincts) → une dédup par instant
    // ne matcherait jamais. On garde donc l'audit (plus précis) et on n'ajoute le repère dérivé
    // QU'EN FALLBACK : si aucun event d'audit de ce kind n'existe (RDV antérieur à la table).
    const auditKinds = new Set<string>(((evsRes?.data ?? []) as any[]).map((e) => e.kind));
    const appt = apptRes?.data;
    if (appt?.created_at && !auditKinds.has('requested')) {
      items.push({ kind: 'requested', at: appt.created_at, summary: 'Demande reçue', source: 'appointment' });
    }
    for (const iv of (invRes?.data ?? []) as any[]) {
      if (iv.created_at && !auditKinds.has('reschedule_link_sent')) {
        items.push({ kind: 'reschedule_link_sent', at: iv.created_at, summary: 'Lien de report envoyé au demandeur', source: 'invitation' });
      }
      if (iv.accepted_at && !auditKinds.has('client_rescheduled')) {
        items.push({ kind: 'client_rescheduled', at: iv.accepted_at, summary: 'Le demandeur a choisi un nouveau créneau', source: 'invitation' });
      }
    }
    for (const e of (evsRes?.data ?? []) as any[]) {
      items.push({ kind: e.kind, at: e.created_at, summary: e.summary, source: 'event', metadata: e.metadata, actor_type: e.actor_type });
    }
    return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
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
    // Annulation par le CLIENT : sans trace ni alerte, le staff préparerait une séance morte.
    void this.logAppointmentEvent(tenantId, appointmentId, 'cancelled', {
      actorType: 'client', actorId: userId, summary: 'Annulé par le demandeur',
    });
    void this.notifyStaff(tenantId, {
      title: 'Rendez-vous annulé par le demandeur',
      body: 'Un rendez-vous vient d’être annulé côté demandeur.',
      type: 'info', email: true, actionUrl: '/liri/rdv',
    }, userId);
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

    // Règles de dispo propriétaire (tenants.metadata.booking_availability) → pilotent la grille
    // (jours ouverts, plages horaires, durée + battement). Absentes → heures région par défaut.
    let scheduleRules: any = null;
    try {
      const { data: t } = await (this.supabase.client as any)
        .from('tenants')
        .select('metadata')
        .eq('id', tenant.id)
        .maybeSingle();
      const r = (t as any)?.metadata?.booking_availability;
      if (r && r.weekly && typeof r.weekly === 'object') scheduleRules = r;
    } catch {
      /* pas de config → comportement région par défaut */
    }

    const av = buildAvailability({
      secretaries,
      reservedRows,
      queueRows,
      visitorRegion: context.region,
      visitorTimezone: context.timezone,
      windowStart,
      windowEnd,
      scheduleRules,
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

  // ── Calendrier MAÎTRE (vue globale multi-services sur une semaine) ─────────
  // Agrège pour la semaine : RDV (appointments+booking_slots) + téléconsult MedOS
  // (med_appointments, best-effort) + activités fixes récurrentes du propriétaire
  // (tenants.metadata.weekly_activities : masterclass, live, enseignement, repos, occupé).
  async masterCalendar(tenant: TenantContext, weekStartIso?: string) {
    const client = this.supabase.client as any;
    const OFFSET_MS = 60 * 60 * 1000; // Gabon = UTC+1 (pas de DST)
    const base = weekStartIso && !Number.isNaN(new Date(weekStartIso).getTime())
      ? new Date(weekStartIso) : new Date();
    const shifted = new Date(base.getTime() + OFFSET_MS); // heure murale Gabon via méthodes UTC
    const daysFromMonday = (shifted.getUTCDay() + 6) % 7;
    const monday = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - daysFromMonday));
    const dates: Array<{ ymd: string; jsDow: number }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getTime() + i * 24 * 3600 * 1000);
      const ymd = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      dates.push({ ymd, jsDow: d.getUTCDay() });
    }
    const weekStartUtc = new Date(`${dates[0].ymd}T00:00:00+01:00`).toISOString();
    const weekEndUtc = new Date(`${dates[6].ymd}T23:59:59+01:00`).toISOString();
    const wsMs = new Date(weekStartUtc).getTime();
    const weMs = new Date(weekEndUtc).getTime();
    const events: any[] = [];

    // 1) RDV (type de service → couleur : téléconsult / formation / prière)
    const KIND_BY_TYPE: Record<string, string> = { teleconsult: 'teleconsult', formation: 'formation', priere: 'rdv', consultation: 'rdv' };
    try {
      const { data: appts } = await client
        .from('appointments')
        .select('id, status, notes, booking_slots(start_at, end_at, title, type)')
        .eq('tenant_id', tenant.id);
      for (const a of appts ?? []) {
        const s = (a as any).booking_slots;
        if (!s?.start_at || (a as any).status === 'cancelled') continue;
        const stMs = new Date(s.start_at).getTime();
        if (stMs < wsMs || stMs > weMs) continue;
        const notes = String((a as any).notes || '');
        const sujet = (notes.match(/Sujet\s*:\s*([\s\S]*?)(?:\s*Description\s*:|$)/i)?.[1] || s.title || 'Rendez-vous').trim();
        const kind = KIND_BY_TYPE[String(s.type || '')] || 'rdv';
        // Identité du demandeur — ⚠️ appointments N'A PAS de colonne metadata : le
        // contact vit dans les lignes du récap notes (« E-mail : … », « WhatsApp : … »).
        const demEmail = String(notes.match(/E-?mail\s*:\s*(\S+@\S+)/i)?.[1] || '').trim().toLowerCase() || null;
        const demWa = String(notes.match(/WhatsApp\s*:\s*([+\d][\d\s]{5,})/i)?.[1] || '').trim() || null;
        events.push({
          kind, title: sujet, start: s.start_at, end: s.end_at || null, status: (a as any).status, id: (a as any).id, service: s.type || null,
          demandeur: demEmail || demWa ? { email: demEmail, whatsapp: demWa } : null,
        });
      }
    } catch (e) { this.logger.warn(`master-cal RDV: ${(e as Error).message}`); }

    // 2) Téléconsultations MedOS (best-effort — table peut ne pas exister pour ce tenant)
    try {
      const { data: meds } = await client
        .from('med_appointments')
        .select('id, appointment_type, status, scheduled_at, duration_minutes')
        .eq('tenant_id', tenant.id)
        .gte('scheduled_at', weekStartUtc)
        .lte('scheduled_at', weekEndUtc);
      for (const m of meds ?? []) {
        if (!(m as any).scheduled_at) continue;
        const dur = Number((m as any).duration_minutes || 30);
        events.push({
          kind: 'teleconsult',
          title: `Téléconsultation (${(m as any).appointment_type || 'santé'})`,
          start: (m as any).scheduled_at,
          end: new Date(new Date((m as any).scheduled_at).getTime() + dur * 60000).toISOString(),
          status: (m as any).status,
          id: (m as any).id,
        });
      }
    } catch { /* MedOS non utilisé pour ce tenant */ }

    // 3) Activités fixes récurrentes
    try {
      const { data: t } = await client.from('tenants').select('metadata').eq('id', tenant.id).maybeSingle();
      const acts = (t as any)?.metadata?.weekly_activities;
      if (Array.isArray(acts)) {
        for (const { ymd, jsDow } of dates) {
          for (const act of acts) {
            if (Number(act?.dow) !== jsDow) continue;
            const start = new Date(`${ymd}T${act.start || '00:00'}:00+01:00`).toISOString();
            const end = new Date(`${ymd}T${act.end || act.start || '00:00'}:00+01:00`).toISOString();
            events.push({ kind: String(act.kind || 'activite'), title: String(act.label || act.kind || 'Activité'), start, end, recurring: true });
          }
        }
      }
    } catch (e) { this.logger.warn(`master-cal activites: ${(e as Error).message}`); }

    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return { weekStart: weekStartUtc, weekEnd: weekEndUtc, timezone: 'Africa/Libreville', days: dates.map((d) => d.ymd), events };
  }

  /** Catalogue public des services réservables (tenants.metadata.booking_services). */
  async listBookingServices(tenantId: string) {
    try {
      const { data: t } = await (this.supabase.client as any).from('tenants').select('metadata').eq('id', tenantId).maybeSingle();
      const s = (t as any)?.metadata?.booking_services;
      return { services: Array.isArray(s) ? s : [] };
    } catch {
      return { services: [] };
    }
  }

  // ── Réglages agenda (éditeur no-code : dispo + services + activités fixes) ──
  async getBookingSettings(tenantId: string) {
    const { data: t } = await (this.supabase.client as any).from('tenants').select('metadata').eq('id', tenantId).maybeSingle();
    const m = (t as any)?.metadata || {};
    return {
      availability: m.booking_availability || { timezone: 'Africa/Libreville', slotMinutes: 30, bufferMinutes: 30, weekly: {}, blackoutDates: [] },
      services: Array.isArray(m.booking_services) ? m.booking_services : [],
      activities: Array.isArray(m.weekly_activities) ? m.weekly_activities : [],
      vitrineNav: Array.isArray(m.vitrine_nav) ? m.vitrine_nav : [],
    };
  }

  async updateBookingSettings(
    tenantId: string,
    dto: { availability?: any; services?: any; activities?: any; vitrineNav?: any },
  ) {
    const client = this.supabase.client as any;
    const { data: t } = await client.from('tenants').select('metadata').eq('id', tenantId).maybeSingle();
    const m = { ...((t as any)?.metadata || {}) };
    if (dto.availability !== undefined) m.booking_availability = this.sanitizeAvailability(dto.availability);
    if (dto.services !== undefined) m.booking_services = this.sanitizeServices(dto.services);
    if (dto.activities !== undefined) m.weekly_activities = this.sanitizeActivities(dto.activities);
    if (dto.vitrineNav !== undefined) m.vitrine_nav = this.sanitizeVitrineNav(dto.vitrineNav);
    const { error } = await client.from('tenants').update({ metadata: m }).eq('id', tenantId);
    if (error) throw new BadRequestException(error.message);
    return this.getBookingSettings(tenantId);
  }

  private sanitizeAvailability(a: any) {
    if (!a || typeof a !== 'object') return { timezone: 'Africa/Libreville', slotMinutes: 30, bufferMinutes: 30, weekly: {}, blackoutDates: [] };
    const weekly: Record<string, Array<[number, number]>> = {};
    const w = a.weekly && typeof a.weekly === 'object' ? a.weekly : {};
    for (const k of Object.keys(w)) {
      if (!/^[0-6]$/.test(String(k))) continue;
      const out: Array<[number, number]> = [];
      for (const win of Array.isArray(w[k]) ? w[k] : []) {
        const s = Math.max(0, Math.min(1439, Number(win?.[0])));
        const e = Math.max(0, Math.min(1440, Number(win?.[1])));
        if (Number.isFinite(s) && Number.isFinite(e) && e > s) out.push([s, e]);
      }
      if (out.length) weekly[String(k)] = out;
    }
    return {
      timezone: String(a.timezone || 'Africa/Libreville'),
      slotMinutes: Math.max(5, Math.min(240, Number(a.slotMinutes) || 30)),
      bufferMinutes: Math.max(0, Math.min(240, Number(a.bufferMinutes) || 0)),
      weekly,
      blackoutDates: Array.isArray(a.blackoutDates) ? a.blackoutDates.filter((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(String(d))).slice(0, 60) : [],
    };
  }

  private sanitizeServices(arr: any) {
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 20).map((s: any) => {
      const label = String(s?.label || '').trim().slice(0, 60);
      if (!label) return null;
      const key = (String(s?.key || '').trim() || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).slice(0, 40) || 'service';
      // ⚠️ Ne pas PERDRE les champs riches (consultation Manikongo) quand on
      // ré-enregistre les réglages agenda : prix, texte long, fiche déclarée.
      const priceEur = Number(s?.priceEur);
      const champsConnus = ['age', 'taille', 'pointure', 'naissance', 'probleme'];
      const champs = Array.isArray(s?.champs) ? s.champs.filter((c: any) => champsConnus.includes(String(c))).slice(0, 10) : [];
      // Motifs de consultation (prière, libation, songe, questions, couple, sagesse…).
      const motifs = Array.isArray(s?.motifs)
        ? s.motifs.slice(0, 12).map((mo: any) => {
            const moLabel = String(mo?.label || '').trim().slice(0, 60);
            if (!moLabel) return null;
            return {
              key: (String(mo?.key || '').trim() || moLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 40),
              label: moLabel,
              desc: String(mo?.desc || '').trim().slice(0, 160),
              ...(mo?.duo === true ? { duo: true } : {}),
            };
          }).filter(Boolean)
        : [];
      return {
        key,
        label,
        kind: ['priere', 'teleconsult', 'formation', 'consultation'].includes(String(s?.kind)) ? s.kind : 'consultation',
        durationMin: Math.max(10, Math.min(240, Number(s?.durationMin) || 30)),
        desc: String(s?.desc || '').trim().slice(0, 200),
        ...(Number.isFinite(priceEur) && priceEur > 0 ? { priceEur: Math.min(10000, Math.round(priceEur * 100) / 100) } : {}),
        ...(String(s?.apropos || '').trim() ? { apropos: String(s.apropos).trim().slice(0, 1200) } : {}),
        ...(champs.length ? { champs } : {}),
        ...(motifs.length ? { motifs } : {}),
      };
    }).filter(Boolean);
  }

  /** Liens de navigation de la VITRINE (gérés no-code depuis LIRI). */
  private sanitizeVitrineNav(arr: any) {
    if (!Array.isArray(arr)) return [];
    return arr.slice(0, 12).map((l: any) => {
      const label = String(l?.label || '').trim().slice(0, 40);
      const href = String(l?.href || '').trim().slice(0, 200);
      if (!label || !href) return null;
      if (!/^(\/|#|https:\/\/)/.test(href)) return null; // relatif, ancre ou https uniquement
      return {
        label,
        href,
        desc: String(l?.desc || '').trim().slice(0, 80),
        visible: l?.visible !== false,
      };
    }).filter(Boolean);
  }

  /** Nav vitrine PUBLIQUE d'un tenant (liens visibles uniquement). */
  async publicVitrineNav(tenantId: string) {
    try {
      const { data: t } = await (this.supabase.client as any).from('tenants').select('metadata').eq('id', tenantId).maybeSingle();
      const nav = this.sanitizeVitrineNav((t as any)?.metadata?.vitrine_nav);
      return { nav: nav.filter((l: any) => l.visible) };
    } catch {
      return { nav: [] };
    }
  }

  private sanitizeActivities(arr: any) {
    if (!Array.isArray(arr)) return [];
    const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
    return arr.slice(0, 40).map((a: any) => {
      const label = String(a?.label || '').trim().slice(0, 60);
      const dow = Number(a?.dow);
      if (!label || !(dow >= 0 && dow <= 6)) return null;
      return {
        kind: ['busy', 'masterclass', 'live', 'enseignement', 'repos', 'rdv', 'teleconsult', 'formation'].includes(String(a?.kind)) ? a.kind : 'busy',
        label,
        dow,
        start: HHMM.test(String(a?.start)) ? a.start : '08:00',
        end: HHMM.test(String(a?.end)) ? a.end : '09:00',
      };
    }).filter(Boolean);
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
