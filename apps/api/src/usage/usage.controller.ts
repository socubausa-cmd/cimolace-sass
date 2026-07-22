import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UsageService } from './usage.service';

/**
 * Consommation du tenant (minutes live + crédits IA) + achat de packs.
 * owner/admin uniquement : c'est de la donnée de facturation.
 */
@Controller('usage')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class UsageController {
  constructor(private svc: UsageService) {}

  @Get()
  @Roles('owner', 'admin')
  get(@Req() req: any) {
    return this.svc.getUsage(req.tenant.id);
  }

  @Get('packs')
  @Roles('owner', 'admin')
  packs() {
    return this.svc.listPacks();
  }

  @Post('packs/:key/checkout')
  @Roles('owner', 'admin')
  buy(@Req() req: any, @Param('key') key: string) {
    return this.svc.createPackCheckout(req.tenant.id, key);
  }
}
