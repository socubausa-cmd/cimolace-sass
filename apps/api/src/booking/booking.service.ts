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
}
