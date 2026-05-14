import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import type { CreateAppointmentDto, CreateSlotDto, SubmitFeedbackDto, UpdateAppointmentDto } from './dto/booking.dto';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(private readonly supabase: SupabaseService) {}

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

  // ── Bloc 9 — Booking Avancé ─────────────────────────────────────────────

  async cancelAppointment(appointmentId: string, tenantId: string) {
    await this.updateAppointment(appointmentId, tenantId, { status: 'canceled' } as any);
    // Free the slot
    const { data: appt } = await (this.supabase.client as any).from('appointments').select('slot_id').eq('id', appointmentId).single();
    if (appt?.slot_id) {
      await (this.supabase.client as any).from('booking_slots').update({ status: 'available' }).eq('id', appt.slot_id);
    }
    return { appointmentId, status: 'canceled' };
  }

  async confirmAppointment(appointmentId: string, tenantId: string) {
    return this.updateAppointment(appointmentId, tenantId, { status: 'confirmed' } as any);
  }

  async rescheduleRequest(appointmentId: string, tenantId: string, newSlotId: string, reason?: string) {
    await this.updateAppointment(appointmentId, tenantId, { status: 'reschedule_requested', notes: reason } as any);
    // Store reschedule request
    await (this.supabase.client as any).from('appointment_reschedule_requests').insert({
      tenant_id: tenantId, appointment_id: appointmentId, new_slot_id: newSlotId, reason: reason ?? '', status: 'pending',
    });
    return { appointmentId, status: 'reschedule_requested' };
  }

  async rescheduleDecide(requestId: string, tenantId: string, approved: boolean) {
    const { data: req } = await (this.supabase.client as any).from('appointment_reschedule_requests').select('*').eq('id', requestId).single();
    if (!req) throw new NotFoundException('Demande de replanification introuvable');

    if (approved) {
      // Validate new slot
      const newSlot = await this.getSlot(req.new_slot_id, tenantId);
      if (newSlot.status !== 'available') throw new ConflictException('Nouveau créneau non disponible');

      // Free old slot
      const { data: appt } = await (this.supabase.client as any).from('appointments').select('slot_id').eq('id', req.appointment_id).single();
      if (appt?.slot_id) {
        await (this.supabase.client as any).from('booking_slots').update({ status: 'available' }).eq('id', appt.slot_id);
      }

      // Book new slot
      await (this.supabase.client as any).from('booking_slots').update({ status: 'booked' }).eq('id', req.new_slot_id);
      await this.updateAppointment(req.appointment_id, tenantId, { status: 'confirmed', slot_id: req.new_slot_id } as any);
    }

    await (this.supabase.client as any).from('appointment_reschedule_requests').update({
      status: approved ? 'approved' : 'rejected', decided_at: new Date().toISOString(),
    }).eq('id', requestId);

    return { requestId, status: approved ? 'approved' : 'rejected' };
  }

  async getRescheduleRequests(tenantId: string, staffId?: string) {
    let q = (this.supabase.client as any).from('appointment_reschedule_requests').select('*, appointments(*), booking_slots(*)').eq('tenant_id', tenantId);
    if (staffId) q = q.eq('staff_id', staffId);
    const { data } = await q.order('created_at', { ascending: false });
    return data ?? [];
  }

  async sendReminder(appointmentId: string, tenantId: string) {
    const appt = await this.getAppointment(appointmentId, tenantId);
    // In production: send email/SMS. For now: log and mark.
    this.logger.log(`Reminder sent for appointment ${appointmentId}`);
    await (this.supabase.client as any).from('appointments').update({ reminder_sent_at: new Date().toISOString() }).eq('id', appointmentId);
    return { appointmentId, reminded: true };
  }

  async generateICS(appointmentId: string, tenantId: string): Promise<string> {
    const appt = await this.getAppointment(appointmentId, tenantId) as any;
    const start = appt.booking_slots?.start_at || appt.created_at;
    const end = appt.booking_slots?.end_at || new Date(Date.now() + 3600000).toISOString();
    const title = appt.booking_slots?.title || 'Rendez-vous';
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0',
      'BEGIN:VEVENT',
      `DTSTART:${new Date(start).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTEND:${new Date(end).toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `SUMMARY:${title}`,
      `UID:${appointmentId}@isna`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
  }

  async postSession(appointmentId: string, tenantId: string, notes: string) {
    await this.updateAppointment(appointmentId, tenantId, { status: 'completed', notes } as any);
    return { appointmentId, status: 'completed' };
  }

  async setPreparation(appointmentId: string, tenantId: string, preparation: string) {
    await (this.supabase.client as any).from('appointments').update({ preparation }).eq('id', appointmentId).eq('tenant_id', tenantId);
    return { appointmentId, preparation };
  }

  // ── Secretariat Workflow ─────────────────────────────────────────────────

  async assignTeacher(tenantId: string, appointmentId: string, teacherId: string) {
    await (this.supabase.client as any).from('appointments').update({ teacher_id: teacherId, status: 'assigned' }).eq('id', appointmentId).eq('tenant_id', tenantId);
    return { appointmentId, teacherId, status: 'assigned' };
  }

  async inviteStudent(tenantId: string, email: string, name?: string) {
    const { data } = await (this.supabase.client as any).from('student_invitations').insert({
      tenant_id: tenantId, email, name: name ?? '', status: 'pending',
    }).select('*').single();
    return data;
  }

  async processEnrollment(tenantId: string, studentId: string, formationId: string) {
    const { data } = await (this.supabase.client as any).from('enrollments').insert({
      tenant_id: tenantId, student_id: studentId, formation_id: formationId, status: 'enrolled',
    }).select('*').single();
    return data;
  }

  async markBillingFollowup(tenantId: string, studentId: string, notes: string) {
    await (this.supabase.client as any).from('billing_followups').insert({
      tenant_id: tenantId, student_id: studentId, notes, status: 'pending',
    });
    return { studentId, followup: true };
  }

  async getSecretariatDashboard(tenantId: string) {
    const [appointments, pending, enrollments] = await Promise.all([
      (this.supabase.client as any).from('appointments').select('*', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'confirmed'),
      (this.supabase.client as any).from('appointments').select('*', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'requested'),
      (this.supabase.client as any).from('enrollments').select('*', { count: 'exact' }).eq('tenant_id', tenantId).eq('status', 'enrolled'),
    ]);
    return {
      todayAppointments: appointments.count ?? 0,
      pendingRequests: pending.count ?? 0,
      activeEnrollments: enrollments.count ?? 0,
    };
  }
}
