import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
  Headers,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import type { CreateSubscriptionDto } from './billing.service';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  // ── Subscriptions ──────────────────────────────────────────────────────

  @Get('subscription')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  getSubscription(@CurrentTenant() tenant: TenantContext) {
    return this.billing.getSubscription(tenant);
  }

  @Get('subscriptions')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  listSubscriptions(@CurrentTenant() tenant: TenantContext) {
    return this.billing.listSubscriptions(tenant);
  }

  @Post('subscription')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  createCheckout(
    @Body() dto: CreateSubscriptionDto,
    @CurrentTenant() tenant: TenantContext,
    @Req() req: Request,
  ) {
    return this.billing.createCheckout(tenant, (req as any).user.id, dto);
  }

  @Delete('subscription')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  cancelSubscription(@CurrentTenant() tenant: TenantContext) {
    return this.billing.cancelSubscription(tenant);
  }

  // ── Invoices ────────────────────────────────────────────────────────────

  @Get('invoices')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  listInvoices(
    @CurrentTenant() tenant: TenantContext,
    @Query('limit') limit?: string,
  ) {
    return this.billing.listInvoices(tenant, limit ? parseInt(limit, 10) : 10);
  }

  @Get('invoices/:id')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  getInvoice(@Param('id') id: string, @CurrentTenant() tenant: TenantContext) {
    return this.billing.getInvoice(tenant, id);
  }

  // ── Providers ───────────────────────────────────────────────────────────

  @Get('providers')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  getProvidersStatus() {
    return this.billing.getProvidersStatus();
  }

  // ── Payment accounts ────────────────────────────────────────────────────

  @Get('payment-accounts')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  getPaymentAccounts(@CurrentTenant() tenant: TenantContext) {
    return this.billing.getPaymentAccounts(tenant);
  }

  @Post('payment-accounts')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner')
  savePaymentAccounts(
    @Body() accounts: Record<string, any>,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.billing.savePaymentAccounts(tenant, accounts);
  }
}

/**
 * Webhook controller — no auth, raw body required for signature verification
 */
@Controller('billing/webhook')
export class BillingWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post('stripe')
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    await this.billing.handleWebhook('stripe', rawBody as Buffer, signature || '');
    return { received: true };
  }

  @Post('chariow')
  async chariowWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-chariow-signature') signature: string,
  ) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    await this.billing.handleWebhook('chariow', rawBody as Buffer, signature || '');
    return { received: true };
  }

  @Post('cinetpay')
  async cinetpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-cinetpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body || {}));
    await this.billing.handleWebhook('cinetpay', rawBody as Buffer, signature || '');
    return { received: true };
  }
}
