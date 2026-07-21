import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentTenant } from '../../tenant/current-tenant.decorator';
import { TenantGuard } from '../../tenant/tenant.guard';
import type { TenantContext } from '../../tenant/tenant.types';
import { MedosEnabledGuard } from '../medos-enabled.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppointmentsService } from './appointments.service';

type AuthRequest = Request & {
  user: { id: string; email?: string; user_metadata?: Record<string, unknown> };
};

function actorInfo(req: AuthRequest) {
  const m = (req.user?.user_metadata ?? {}) as Record<string, string>;
  return {
    email: req.user?.email,
    first_name: m.first_name || m.given_name,
    last_name: m.last_name || m.family_name,
  };
}

/**
 * Réservation CLIENT depuis un service du catalogue (marketplace praticien).
 *
 * Auth = JWT + tenant (X-Tenant-Slug) ; PAS de RolesGuard strict → un client qui
 * vient de payer (rôle `student` du tenant, posé par le fulfillment) peut
 * réserver. La fiche `med_patients` est résolue/créée à la volée, et
 * l'`access_pass` (preuve de paiement) est vérifié CÔTÉ SERVEUR avant tout RDV.
 */
@ApiTags('MedOS — Réservation service')
@ApiBearerAuth()
@Controller('med/booking')
@UseGuards(JwtAuthGuard, TenantGuard, MedosEnabledGuard)
export class MedosBookingController {
  constructor(private readonly appts: AppointmentsService) {}

  /** Contexte : fiche patient (créée si besoin) + praticien + accès payé + service. */
  @Get('context')
  context(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
    @Query('service_key') serviceKey: string,
  ) {
    return this.appts.bookingContext(tenant, req.user.id, actorInfo(req), serviceKey);
  }

  /** Créneaux libres du praticien rattaché au service. */
  @Get('slots')
  async slots(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
    @Query('service_key') serviceKey: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    const ctx = await this.appts.bookingContext(
      tenant,
      req.user.id,
      actorInfo(req),
      serviceKey,
    );
    if (!ctx.practitioner_id) return { slots: [] };
    return this.appts.findSlots(tenant, ctx.practitioner_id, from, to);
  }

  /** Crée le RDV depuis le service (gate access_pass appliqué serveur). */
  @Post('appointment')
  book(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
    @Body() dto: { service_key: string; scheduled_at: string },
  ) {
    return this.appts.bookFromService(
      tenant,
      req.user.id,
      actorInfo(req),
      dto.service_key,
      dto.scheduled_at,
    );
  }

  /**
   * DIRECT PAYANT — hôte (staff) : démarre/rouvre le direct d'une masterclass.
   * Retourne `{ session_id }` → le front ouvre `/live/host/:session_id`.
   */
  @Post('live/start')
  startLive(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
    @Body() dto: { service_key: string },
  ) {
    return this.appts.masterclassStart(tenant, req.user.id, dto.service_key);
  }

  /**
   * DIRECT PAYANT — acheteur : rejoint le direct (gate access_pass service → octroi
   * du pass live_session). `{ session_id }` → le front ouvre `/live/:session_id`,
   * ou `session_id:null` si l'hôte n'a pas encore lancé.
   */
  @Post('live/join')
  joinLive(
    @CurrentTenant() tenant: TenantContext,
    @Req() req: AuthRequest,
    @Body() dto: { service_key: string },
  ) {
    return this.appts.masterclassJoin(tenant, req.user.id, actorInfo(req), dto.service_key);
  }

  /**
   * RÉSERVATIONS (STAFF only) : liste des inscrits par service payant du tenant.
   * Contient des emails → RolesGuard staff (jamais les élèves/acheteurs).
   */
  @Get('reservations')
  @UseGuards(RolesGuard)
  @Roles('owner', 'practitioner', 'clinic_admin', 'receptionist')
  reservations(@CurrentTenant() tenant: TenantContext) {
    return this.appts.listReservations(tenant);
  }
}
