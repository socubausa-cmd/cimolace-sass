import { Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { BookingService } from './booking.service';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';

/**
 * Entrée PUBLIQUE (sans login) au moteur de RDV LIRI — pour un visiteur anonyme
 * (donateur de cagnotte) qui réserve une séance de prière. Réutilise
 * `BookingService.slotAvailability` + `requestAppointmentNoSlot` ; le tenant est
 * résolu par SLUG (pas de TenantGuard). AUCUN guard : routes publiques.
 *
 * `appointments.student_id` / `booking_slots.created_by` sont NOT NULL mais SANS
 * clé étrangère → une UUID sentinelle « invité » satisfait la contrainte pour les
 * demandes anonymes ; le vrai contact (e-mail + WhatsApp) est conservé dans les notes.
 */
const GUEST_UUID = '00000000-0000-0000-0000-000000000000';

@Controller('booking-public')
export class BookingPublicController {
  constructor(
    private readonly booking: BookingService,
    private readonly supabase: SupabaseService,
  ) {}

  private async tenantIdBySlug(slug: string): Promise<string> {
    const { data } = await (this.supabase.client as any)
      .from('tenants')
      .select('id')
      .eq('slug', String(slug || '').trim())
      .eq('status', 'active')
      .maybeSingle();
    if (!data) throw new NotFoundException('Organisation introuvable.');
    return data.id as string;
  }

  /** Créneaux disponibles (grille intelligente) — public. */
  @Get(':slug/availability')
  async availability(
    @Param('slug') slug: string,
    @Query('windowStart') windowStart: string,
    @Query('windowEnd') windowEnd: string,
    @Query('timezone') timezone?: string,
    @Query('country') country?: string,
  ) {
    const id = await this.tenantIdBySlug(slug);
    return this.booking.slotAvailability({ id } as TenantContext, {
      timezone,
      country,
      windowStart,
      windowEnd,
    });
  }

  /** Demande de RDV anonyme (crée le booking_slot si un créneau est choisi + le RDV). */
  @Post(':slug/appointment-request')
  async request(
    @Param('slug') slug: string,
    @Body()
    dto: { subject?: string; description?: string; email?: string; whatsapp?: string; preferredIso?: string },
  ) {
    const id = await this.tenantIdBySlug(slug);
    return this.booking.requestAppointmentNoSlot(id, GUEST_UUID, dto ?? {});
  }
}
