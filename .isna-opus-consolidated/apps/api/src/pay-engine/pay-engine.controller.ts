import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { PayEngineService } from './pay-engine.service';

@Controller('pay-engine')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard) @Roles('owner','admin')
export class PayEngineController {
  constructor(private readonly svc: PayEngineService) {}
  @Get('providers') getProviders(@CurrentTenant() t: TenantContext) { return this.svc.getProviders(t.id); }
  @Patch('providers/:provider') enableProvider(@Param('provider') p: string, @Body('enabled') e: boolean, @CurrentTenant() t: TenantContext) { return this.svc.enableProvider(t.id, p, e); }
  @Post('pay/cinetpay') createCinetPay(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.createCinetPayPayment(t.id, d.amount, d.currency, d.transactionId); }
  @Get('transactions') getTransactions(@CurrentTenant() t: TenantContext) { return this.svc.getTransactions(t.id); }
}
