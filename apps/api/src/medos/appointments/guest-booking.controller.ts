import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../../auth/api-key.guard';
import { AppointmentsService } from './appointments.service';

/**
 * RÉSERVATION INVITÉE — embarquée sur le SITE du tenant (ex : www.zahirwellness.com).
 * Auth = CLÉ TENANT (`cml_`, même garde que /offering-checkout/tenant-grant) : le site
 * du tenant proxifie serveur-à-serveur. Le visiteur voit les créneaux et réserve un RDV
 * GRATUIT sans compte ni login Cimolace ; le RDV (téléconsult) apparaît côté praticien
 * dans med-app, et la salle vidéo LIRI est gérée par MEDOS.
 */
@ApiTags('MedOS — Réservation invitée (site tenant)')
@ApiBearerAuth()
@Controller('med/guest-booking')
@UseGuards(ApiKeyGuard)
export class MedosGuestBookingController {
  constructor(private readonly appts: AppointmentsService) {}

  /** Créneaux libres d'un service réservable (téléconsult) sur une fenêtre [from, to]. */
  @Get('slots')
  slots(
    @Req() req: any,
    @Query('service_key') serviceKey: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.appts.guestSlots(req.tenant, serviceKey, from, to);
  }

  /** Réserve un créneau pour un invité (email) → crée le RDV téléconsult. */
  @Post('book')
  book(
    @Req() req: any,
    @Body()
    body: {
      service_key?: string;
      scheduled_at?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
    },
  ) {
    return this.appts.guestBook(req.tenant, body);
  }

  /**
   * Réserve un créneau ET crée la salle téléconsult LIRI immédiatement (auto-confirmée).
   * Renvoie `{ session_id, guest_url, host_url, appointment }`. Le site tenant stocke
   * `guest_url` (lien visiteur) et `host_url` (lien praticien) — remplace la réunion Zoom.
   */
  @Post('room')
  bookRoom(
    @Req() req: any,
    @Body()
    body: {
      service_key?: string;
      scheduled_at?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
    },
  ) {
    return this.appts.guestBookRoom(req.tenant, body);
  }

  /** Liste les lives/masterclass payants vendables du tenant (pour le site tenant). */
  @Get('lives')
  lives(@Req() req: any) {
    return this.appts.guestLives(req.tenant);
  }

  /**
   * Accès invité à un live payant après paiement sur le site du tenant (option A magic-link).
   * Provisionne l'acheteur + octroie le pass `service` + renvoie un magic link à emailer.
   */
  @Post('live-access')
  liveAccess(
    @Req() req: any,
    @Body()
    body: {
      service_key?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
    },
  ) {
    return this.appts.guestLiveAccess(req.tenant, body);
  }
}
