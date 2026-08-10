import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { BookingService } from './booking.service';
import { SupabaseService } from '../supabase/supabase.service';
import { PublicRateLimitGuard } from '../common/public-rate-limit.guard';
import type { TenantContext } from '../tenant/tenant.types';

/**
 * Entrée PUBLIQUE (sans login) au moteur de RDV LIRI — pour un visiteur anonyme
 * (donateur de cagnotte) qui réserve une séance de prière. Réutilise
 * `BookingService.slotAvailability` + `requestAppointmentNoSlot` ; le tenant est
 * résolu par SLUG (pas de TenantGuard). AUCUN guard : routes publiques.
 *
 * `appointments.student_id` / `booking_slots.created_by` ont une CLÉ ÉTRANGÈRE vers
 * `auth.users` → on rattache la demande anonyme au PROPRIÉTAIRE du tenant (qui existe
 * toujours), et le vrai contact du demandeur (e-mail + WhatsApp + requête) est
 * conservé dans les notes du RDV. Le secrétariat voit la demande dans sa file.
 */
@Controller('booking-public')
export class BookingPublicController {
  constructor(
    private readonly booking: BookingService,
    private readonly supabase: SupabaseService,
  ) {}

  private async tenantBySlug(slug: string): Promise<{ id: string; owner: string }> {
    const { data } = await (this.supabase.client as any)
      .from('tenants')
      .select('id, owner_user_id')
      .eq('slug', String(slug || '').trim())
      .eq('status', 'active')
      .maybeSingle();
    if (!data) throw new NotFoundException('Organisation introuvable.');
    if (!data.owner_user_id) throw new NotFoundException('Organisation sans responsable — RDV indisponible.');
    return { id: data.id as string, owner: data.owner_user_id as string };
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
    const { id } = await this.tenantBySlug(slug);
    return this.booking.slotAvailability({ id } as TenantContext, {
      timezone,
      country,
      windowStart,
      windowEnd,
    });
  }

  /** Demande de RDV anonyme (crée le booking_slot si un créneau est choisi + le RDV). */
  @Post(':slug/appointment-request')
  @UseGuards(PublicRateLimitGuard)
  async request(
    @Param('slug') slug: string,
    @Body()
    dto: { subject?: string; description?: string; email?: string; whatsapp?: string; preferredIso?: string },
  ) {
    const { id, owner } = await this.tenantBySlug(slug);
    return this.booking.requestAppointmentNoSlot(id, owner, dto ?? {});
  }

  /** Catalogue des services réservables — public. */
  @Get(':slug/services')
  async services(@Param('slug') slug: string) {
    const { id } = await this.tenantBySlug(slug);
    return this.booking.listBookingServices(id);
  }

  /** Liens de navigation de la vitrine (gérés dans LIRI → Vitrine) — public. */
  @Get(':slug/vitrine-nav')
  async vitrineNav(@Param('slug') slug: string) {
    const { id } = await this.tenantBySlug(slug);
    return this.booking.publicVitrineNav(id);
  }

  /** Contexte d'un report self-service (token) — public, sans login. */
  @Get('reschedule/:token')
  rescheduleContext(@Param('token') token: string) {
    return this.booking.getRescheduleContext(token);
  }

  /** Applique le nouveau créneau choisi par le demandeur (token) — public. */
  @Post('reschedule/:token')
  @UseGuards(PublicRateLimitGuard)
  applyReschedule(@Param('token') token: string, @Body() dto: { preferredIso?: string }) {
    return this.booking.applyReschedule(token, String(dto?.preferredIso || ''));
  }
}
