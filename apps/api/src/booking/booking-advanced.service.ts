/**
 * BookingAdvancedService — Logique métier des features avancées booking.
 * Port des 11 lambdas v1 (reminders, satisfaction, reschedule, invitations, ICS).
 */

import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { BookingService } from './booking.service';

@Injectable()
export class BookingAdvancedService {
  private readonly logger = new Logger(BookingAdvancedService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
    // Journal d'audit + cloche staff : on passe par BookingService pour n'avoir
    // qu'UN émetteur (jamais deux écritures d'audit divergentes).
    private readonly booking: BookingService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // SATISFACTION
  // ═══════════════════════════════════════════════════════════════════════════

  async getSatisfactionStatus(tenantId: string, appointmentId: string) {
    const { data } = await (this.supabase.client as any)
      .from('booking_satisfaction')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('appointment_id', appointmentId)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? { status: 'not_sent' };
  }

  async sendSatisfactionSurvey(tenantId: string, appointmentId: string, reminded: boolean) {
    if (reminded) {
      // C'est une relance — update reminded_at de la dernière satisfaction sent
      const { data: existing } = await (this.supabase.client as any)
        .from('booking_satisfaction')
        .select('id')
        .eq('appointment_id', appointmentId)
        .eq('tenant_id', tenantId)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        await (this.supabase.client as any)
          .from('booking_satisfaction')
          .update({ reminded_at: new Date().toISOString() })
          .eq('id', existing.id);
        return { status: 'reminded', id: existing.id };
      }
    }

    const { data, error } = await (this.supabase.client as any)
      .from('booking_satisfaction')
      .insert({
        tenant_id: tenantId,
        appointment_id: appointmentId,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);
    return { status: 'sent', satisfaction: data };
  }

  async submitSatisfactionResponse(input: {
    token: string;
    rating?: number;
    nps_score?: number;
    comment?: string;
  }) {
    // Le token est l'id de la ligne satisfaction (ou un token séparé en prod)
    const { data: satisfaction } = await (this.supabase.client as any)
      .from('booking_satisfaction')
      .select('*')
      .eq('id', input.token)
      .maybeSingle();

    if (!satisfaction) throw new NotFoundException('Token invalide');
    if (satisfaction.responded_at) {
      return { status: 'already_responded' };
    }

    const { data, error } = await (this.supabase.client as any)
      .from('booking_satisfaction')
      .update({
        rating: input.rating ?? null,
        nps_score: input.nps_score ?? null,
        comment: input.comment ?? null,
        responded_at: new Date().toISOString(),
        status: 'responded',
      })
      .eq('id', input.token)
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);
    return { status: 'recorded', satisfaction: data };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REMINDERS
  // ═══════════════════════════════════════════════════════════════════════════

  async scheduleReminders(
    tenantId: string,
    input: { appointment_id: string; offsets_hours?: number[]; channels?: string[] },
  ) {
    const offsets = input.offsets_hours ?? [24, 1];
    const channels = input.channels ?? ['email'];

    // Récupérer la date du RDV
    const { data: appointment } = await (this.supabase.client as any)
      .from('appointments')
      .select('id, scheduled_at, starts_at, tenant_id')
      .eq('id', input.appointment_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!appointment) throw new NotFoundException('RDV introuvable');

    const startTime = new Date(appointment.scheduled_at ?? appointment.starts_at);
    const reminders: any[] = [];

    for (const offsetH of offsets) {
      const scheduledAt = new Date(startTime.getTime() - offsetH * 3600 * 1000);
      if (scheduledAt < new Date()) continue;
      for (const channel of channels) {
        reminders.push({
          tenant_id: tenantId,
          appointment_id: input.appointment_id,
          channel,
          template: `reminder_${offsetH}h`,
          scheduled_at: scheduledAt.toISOString(),
          status: 'pending',
        });
      }
    }

    if (reminders.length === 0) {
      return { scheduled: 0, message: 'Aucun reminder valide (RDV trop proche ou passé)' };
    }

    const { data, error } = await (this.supabase.client as any)
      .from('booking_reminders')
      .insert(reminders)
      .select('id, scheduled_at, channel, template');

    if (error) throw new BadRequestException(error.message);
    return { scheduled: data?.length ?? 0, reminders: data };
  }

  async processPendingReminders(secret?: string) {
    const expectedSecret = this.config.get<string>('CRON_REMINDERS_SECRET');
    if (expectedSecret && secret !== expectedSecret) {
      throw new ForbiddenException('CRON secret invalide');
    }

    const { data: pending } = await (this.supabase.client as any)
      .from('booking_reminders')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .limit(100);

    let sent = 0;
    let failed = 0;

    for (const r of pending ?? []) {
      try {
        // Ici on déclencherait l'envoi réel via Resend/Twilio
        // Pour l'instant on marque juste comme "sent" (à brancher avec EmailEngine/SmsEngine)
        await (this.supabase.client as any)
          .from('booking_reminders')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', r.id);
        sent++;
      } catch (err) {
        await (this.supabase.client as any)
          .from('booking_reminders')
          .update({
            status: 'failed',
            error: (err as Error).message,
            retry_count: r.retry_count + 1,
          })
          .eq('id', r.id);
        failed++;
      }
    }

    return { processed: (pending ?? []).length, sent, failed };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESCHEDULE WORKFLOW
  // ═══════════════════════════════════════════════════════════════════════════

  async requestReschedule(
    tenantId: string,
    user: { id?: string; role?: string } | undefined,
    input: { appointment_id: string; reason?: string; proposed_slots?: Array<{ start: string; end: string }> },
  ) {
    if (!input.appointment_id) throw new BadRequestException('appointment_id requis');

    const { data, error } = await (this.supabase.client as any)
      .from('booking_reschedule_requests')
      .insert({
        tenant_id: tenantId,
        appointment_id: input.appointment_id,
        requested_by: user?.id ?? null,
        requested_role: user?.role ?? 'student',
        reason: input.reason ?? null,
        proposed_slots: input.proposed_slots ?? [],
        status: 'pending',
      })
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);
    void this.booking.logAppointmentEvent(tenantId, input.appointment_id, 'note', {
      actorType: 'client', actorId: user?.id ?? null,
      summary: 'Demande de report déposée par le demandeur',
      metadata: { reason: input.reason ?? null },
    });
    return data;
  }

  async listPendingReschedule(tenantId: string) {
    const { data } = await (this.supabase.client as any)
      .from('booking_reschedule_requests')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });
    return data ?? [];
  }

  async decideReschedule(
    tenantId: string,
    userId: string | undefined,
    rescheduleId: string,
    input: { decision: 'approved' | 'declined'; note?: string; new_slot_id?: string },
  ) {
    const update: any = {
      status: input.decision,
      decided_by: userId ?? null,
      decided_at: new Date().toISOString(),
      decision_note: input.note ?? null,
    };
    if (input.new_slot_id) update.new_appointment_id = input.new_slot_id;

    const { data, error } = await (this.supabase.client as any)
      .from('booking_reschedule_requests')
      .update(update)
      .eq('id', rescheduleId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);
    if ((data as any)?.appointment_id) {
      void this.booking.logAppointmentEvent(tenantId, (data as any).appointment_id, 'note', {
        actorType: 'staff', actorId: userId ?? null,
        summary: input.decision === 'approved'
          ? 'Demande de report approuvée par le staff'
          : 'Demande de report refusée par le staff',
        metadata: { note: input.note ?? null, new_slot_id: input.new_slot_id ?? null },
      });
    }
    return data;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVITATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  async sendInvitation(
    tenantId: string,
    invitedBy: string | undefined,
    input: { invited_email?: string; invited_user_id?: string; slot_id?: string; channel?: string },
  ) {
    if (!input.invited_email && !input.invited_user_id) {
      throw new BadRequestException('invited_email ou invited_user_id requis');
    }

    const { data, error } = await (this.supabase.client as any)
      .from('booking_invitations')
      .insert({
        tenant_id: tenantId,
        invited_email: input.invited_email ?? null,
        invited_user_id: input.invited_user_id ?? null,
        invited_by: invitedBy ?? null,
        slot_id: input.slot_id ?? null,
        status: 'sent',
        metadata: { channel: input.channel ?? 'email' },
      })
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async respondInvitation(input: { token: string; decision: 'accept' | 'decline' }) {
    const { data: invitation } = await (this.supabase.client as any)
      .from('booking_invitations')
      .select('*')
      .eq('token', input.token)
      .maybeSingle();

    if (!invitation) throw new NotFoundException('Token invalide');
    if (invitation.accepted_at || invitation.declined_at) {
      return { status: 'already_responded' };
    }
    if (new Date(invitation.expires_at) < new Date()) {
      await (this.supabase.client as any)
        .from('booking_invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id);
      throw new BadRequestException('Invitation expirée');
    }

    const updates: any = { status: input.decision === 'accept' ? 'accepted' : 'declined' };
    if (input.decision === 'accept') updates.accepted_at = new Date().toISOString();
    else updates.declined_at = new Date().toISOString();

    const { data } = await (this.supabase.client as any)
      .from('booking_invitations')
      .update(updates)
      .eq('id', invitation.id)
      .select('*')
      .single();

    // ⚠️ S'arrêter à booking_invitations laissait le système AVEUGLE : le RDV lié
    // gardait son ancienne date/statut et personne n'était prévenu. On referme la
    // boucle — best-effort : la réponse du demandeur est déjà enregistrée, elle ne
    // doit jamais être perdue à cause d'un signal secondaire qui échoue.
    if (invitation.appointment_id) {
      try {
        await this.settleInvitationOutcome(invitation, input.decision);
      } catch (e) {
        this.logger.warn(`respondInvitation settle: ${(e as Error).message}`);
      }
    }

    return { status: 'recorded', invitation: data };
  }

  /** Réponse d'invitation → mise à jour du RDV + journal + cloche staff + e-mail accueil. */
  private async settleInvitationOutcome(
    invitation: { id: string; tenant_id: string; appointment_id: string; slot_id?: string | null },
    decision: 'accept' | 'decline',
  ): Promise<void> {
    const client = this.supabase.client as any;
    const tenantId = invitation.tenant_id;
    const appointmentId = invitation.appointment_id;
    const accepted = decision === 'accept';

    // Nouvelle date : celle du créneau proposé dans l'invitation (s'il y en a un).
    let newStart: string | null = null;
    if (accepted && invitation.slot_id) {
      const { data: slot } = await client
        .from('booking_slots')
        .select('id, start_at')
        .eq('id', invitation.slot_id)
        .maybeSingle();
      newStart = (slot as any)?.start_at ?? null;
      if (slot) {
        await client.from('booking_slots').update({ status: 'booked' }).eq('id', invitation.slot_id);
      }
    }

    const patch: any = accepted
      ? { status: 'confirmed', updated_at: new Date().toISOString() }
      : { status: 'reschedule_declined', updated_at: new Date().toISOString() };
    if (accepted && invitation.slot_id) patch.slot_id = invitation.slot_id;
    await client
      .from('appointments')
      .update(patch)
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId);

    const whenTxt = newStart
      ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date(newStart))
      : '';

    await this.booking.logAppointmentEvent(
      tenantId,
      appointmentId,
      accepted ? 'client_responded' : 'reschedule_declined',
      {
        actorType: 'client',
        summary: accepted
          ? `Le demandeur a accepté le créneau proposé${whenTxt ? ` (${whenTxt})` : ''}`
          : 'Le demandeur a refusé le report proposé',
        metadata: { invitation_id: invitation.id, decision, newStart },
      },
    );

    await this.booking.notifyStaff(tenantId, {
      title: accepted ? 'Le demandeur a accepté le créneau ✓' : 'Le demandeur a refusé le report',
      body: accepted
        ? `Rendez-vous confirmé${whenTxt ? ` — ${whenTxt}` : ''}.`
        : 'Le rendez-vous est passé en « Report refusé » : à recontacter.',
      type: accepted ? 'success' : 'info',
      email: true,
      actionUrl: '/liri/rdv',
    });

    // E-mail à l'adresse d'accueil (notify_email) — même mécanique que l'accusé de
    // sendRescheduleLink : file email_queue → worker → Resend (sender du tenant).
    try {
      const { data: ns } = await client
        .from('tenant_notification_settings')
        .select('email_from, email_from_name, notify_email')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      const to = String((ns as any)?.notify_email || '').trim();
      if (!to) return;
      const html = accepted
        ? `<h2>Le demandeur a accepté le créneau ✓</h2>`
          + `<p>Le rendez-vous est confirmé${whenTxt ? ` pour le <strong>${whenTxt}</strong>` : ''}.</p>`
          + `<p style="color:#777;font-size:13px;">Prorascience — système de rendez-vous</p>`
        : `<h2>Le demandeur a refusé le report</h2>`
          + `<p>Le rendez-vous est passé en « Report refusé ». Vous pouvez le recontacter ou proposer un autre créneau.</p>`
          + `<p style="color:#777;font-size:13px;">Prorascience — système de rendez-vous</p>`;
      await client.from('email_queue').insert({
        tenant_id: tenantId,
        to,
        from: (ns as any)?.email_from ?? null,
        from_name: (ns as any)?.email_from_name ?? null,
        subject: accepted ? 'RDV — le demandeur a accepté le créneau' : 'RDV — le demandeur a refusé le report',
        html_body: html,
      });
    } catch (e) {
      this.logger.warn(`respondInvitation email accueil: ${(e as Error).message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ICS EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  async buildICS(tenantId: string, appointmentId: string): Promise<string> {
    const { data: appt } = await (this.supabase.client as any)
      .from('appointments')
      .select('*, teacher:teacher_id(full_name, email), student:student_id(full_name, email)')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!appt) throw new NotFoundException('RDV introuvable');

    const start = new Date(appt.scheduled_at ?? appt.starts_at);
    const end = new Date(
      appt.ends_at ?? new Date(start.getTime() + (appt.duration_minutes ?? 60) * 60000),
    );

    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

    const teacherName = appt.teacher?.full_name ?? 'Enseignant';
    const studentName = appt.student?.full_name ?? 'Étudiant';
    const summary = `RDV LIRI : ${teacherName} ↔ ${studentName}`;
    const description = (appt.description ?? appt.note ?? 'Session LIRI').replace(/\n/g, '\\n');
    const uid = `${appointmentId}@cimolace.space`;

    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//LIRI//Booking//FR',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `STATUS:CONFIRMED`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'DESCRIPTION:Rappel RDV LIRI',
      'TRIGGER:-PT15M',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }
}
