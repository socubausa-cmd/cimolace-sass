/**
 * BillingAdvancedController — port des 23 lambdas v1 (`netlify/functions/billing-*`).
 *
 * Routes :
 *   GET    /billing/invoices/mine                  → liste factures de l'utilisateur
 *   GET    /billing/invoices/download              → HTML facture (query paymentId)
 *   POST   /billing/invoices/resend                → renvoi e-mail facture
 *   POST   /billing/invoices/backfill              → cron backfill envois facture (internal key)
 *
 *   POST   /billing/license/activate               → activation manuelle licence Chariow
 *
 *   POST   /billing/checkout/initial               → wrapper create-payment (paymentType=initial)
 *   POST   /billing/checkout/renewal               → wrapper create-payment (paymentType=renewal)
 *   POST   /billing/checkout/create                → create-payment générique
 *
 *   GET    /billing/payments/status                → status d'un paiement (query id)
 *   GET    /billing/subscriptions/status           → status abonnement utilisateur
 *
 *   POST   /billing/subscriptions/expire-cron      → cron expiration (internal key)
 *   POST   /billing/subscriptions/renewal-cron     → cron cycle de renouvellement (internal key)
 *
 *   GET    /billing/tenant/context                 → contexte billing tenant (staff)
 *   POST   /billing/tenant/preferences             → enregistre préférences billing
 *   POST   /billing/tenant/payment-accounts        → enregistre comptes provider
 *   POST   /billing/tenant/setup-assistant         → assistant LLM configuration
 *
 *   POST   /billing/webhooks/stripe                → Stripe (signature-verified)
 *   POST   /billing/webhooks/paypal                → PayPal
 *   POST   /billing/webhooks/chariow               → Chariow HMAC
 *   POST   /billing/webhooks/chariow/attach        → attache vente externe à un compte
 *   POST   /billing/webhooks/cinetpay              → CinetPay form-encoded
 *   POST   /billing/webhooks/nowpayments           → NowPayments (Monero)
 *
 *   POST   /billing/webhooks/dlq/process           → cron rejeu DLQ (internal key)
 *   GET    /billing/webhooks/dlq                   → liste DLQ (staff)
 *   POST   /billing/webhooks/dlq/action            → retry/mark_dead/delete (staff)
 */

import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { BillingAdvancedService } from './billing-advanced.service';

@Controller('billing')
export class BillingAdvancedController {
  constructor(private readonly svc: BillingAdvancedService) {}

  // ─── Invoices (user-scoped) ──────────────────────────────────────────────

  @Get('invoices/mine')
  @UseGuards(JwtAuthGuard)
  async myInvoices(@Req() req: Request) {
    return this.svc.listMyInvoices((req as any).user?.sub ?? (req as any).user?.id);
  }

  @Get('invoices/download')
  @UseGuards(JwtAuthGuard)
  async downloadInvoice(
    @Req() req: Request,
    @Query('paymentId') paymentId: string,
    @Res() res: Response,
  ) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    const { html, filename } = await this.svc.renderInvoiceHtml(userId, paymentId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(html);
  }

  @Post('invoices/resend')
  @UseGuards(JwtAuthGuard)
  async resendInvoice(@Req() req: Request, @Body() body: { paymentId: string }) {
    return this.svc.resendInvoice((req as any).user?.sub ?? (req as any).user?.id, body?.paymentId);
  }

  @Post('invoices/backfill')
  async backfillInvoices(
    @Headers('x-billing-backfill-token') token: string,
    @Query('limit') limit?: string,
    @Query('dryRun') dryRun?: string,
    @Query('key') key?: string,
  ) {
    return this.svc.backfillInvoices({
      token: token || key,
      limit,
      dryRun: String(dryRun || '').toLowerCase() === 'true',
    });
  }

  // ─── License activation ──────────────────────────────────────────────────

  @Post('license/activate')
  @UseGuards(JwtAuthGuard)
  async activateLicense(@Req() req: Request, @Body() body: { licenseKey: string }) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    return this.svc.activateLicense(userId, body?.licenseKey);
  }

  // ─── Checkout ────────────────────────────────────────────────────────────

  @Post('checkout/initial')
  @UseGuards(JwtAuthGuard)
  async createInitialCheckout(@Req() req: Request, @Body() body: any) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    if (!body?.planId) {
      return { error: 'planId is required' };
    }
    return this.svc.createPayment(userId, { ...body, paymentType: 'initial' });
  }

  @Post('checkout/renewal')
  @UseGuards(JwtAuthGuard)
  async createRenewalCheckout(@Req() req: Request, @Body() body: any) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    if (!body?.subscriptionId) {
      return { error: 'subscriptionId is required' };
    }
    return this.svc.createPayment(userId, { ...body, paymentType: 'renewal' });
  }

  @Post('checkout/create')
  @UseGuards(JwtAuthGuard)
  async createPayment(@Req() req: Request, @Body() body: any) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    return this.svc.createPayment(userId, body);
  }

  // ─── Status (user) ───────────────────────────────────────────────────────

  @Get('payments/status')
  @UseGuards(JwtAuthGuard)
  async paymentStatus(@Req() req: Request, @Query('id') id: string) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    return this.svc.getPaymentStatus(userId, id);
  }

  @Get('subscriptions/status')
  @UseGuards(JwtAuthGuard)
  async subscriptionStatus(@Req() req: Request) {
    const userId = (req as any).user?.sub ?? (req as any).user?.id;
    return this.svc.getSubscriptionStatus(userId);
  }

  // ─── Cron (subscriptions) ────────────────────────────────────────────────

  @Post('subscriptions/expire-cron')
  async expireSubscriptionsCron(
    @Headers('x-internal-key') key: string,
    @Query('batch') batch?: string,
  ) {
    return this.svc.expireSubscriptionsCron({ key, batch });
  }

  @Post('subscriptions/renewal-cron')
  async runRenewalCycle(
    @Headers('x-internal-key') key: string,
    @Query('batch') batch?: string,
  ) {
    return this.svc.runRenewalCycleCron({ key, batch });
  }

  // ─── Tenant configuration (staff) ────────────────────────────────────────

  @Get('tenant/context')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat')
  async getTenantBillingContext(@CurrentTenant() t: TenantContext) {
    return this.svc.getTenantBillingContext(t);
  }

  @Post('tenant/preferences')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat')
  async saveTenantBillingPrefs(
    @CurrentTenant() t: TenantContext,
    @Body() body: { billing?: Record<string, unknown> },
  ) {
    return this.svc.saveTenantBillingPreferences(t, body?.billing ?? {});
  }

  @Post('tenant/payment-accounts')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin')
  async saveTenantPaymentAccounts(
    @CurrentTenant() t: TenantContext,
    @Body()
    body: {
      provider: string;
      status?: string;
      credentials?: Record<string, string>;
      publicConfig?: Record<string, string>;
    },
  ) {
    return this.svc.saveTenantPaymentAccount(t, body);
  }

  @Post('tenant/setup-assistant')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat')
  async setupAssistant(
    @CurrentTenant() t: TenantContext,
    @Body()
    body: {
      message: string;
      stepId?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    },
  ) {
    return this.svc.paymentSetupAssistant(t, body);
  }

  // ─── Webhooks (no auth, signature-verified) ──────────────────────────────

  @Post('webhooks/stripe')
  async webhookStripe(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
    @Query('tenant') tenantSlug?: string,
  ) {
    return this.svc.handleStripeWebhook({
      rawBody: (req as any).rawBody ?? JSON.stringify((req as any).body ?? {}),
      signature,
      tenantSlug,
    });
  }

  @Post('webhooks/paypal')
  async webhookPaypal(
    @Req() req: Request,
    @Body() body: any,
    @Query('tenant') tenantSlug?: string,
  ) {
    return this.svc.handlePaypalWebhook({
      headers: req.headers as Record<string, string>,
      payload: body,
      tenantSlug,
    });
  }

  @Post('webhooks/chariow')
  async webhookChariow(
    @Req() req: Request,
    @Headers('x-chariow-signature') signature: string,
    @Body() body: any,
    @Query('tenant') tenantSlug?: string,
  ) {
    return this.svc.handleChariowWebhook({
      rawBody: (req as any).rawBody ?? JSON.stringify(body ?? {}),
      payload: body,
      signature,
      tenantSlug,
    });
  }

  @Post('webhooks/chariow/attach')
  async chariowAttachExternal(@Body() body: any, @Query('tenant') tenantSlug?: string) {
    return this.svc.chariowAttachExternal({ payload: body, tenantSlug });
  }

  @Post('webhooks/cinetpay')
  async webhookCinetpay(
    @Req() req: Request,
    @Body() body: any,
    @Headers('x-token') token: string,
    @Query('tenant') tenantSlug?: string,
  ) {
    return this.svc.handleCinetpayWebhook({
      rawBody: (req as any).rawBody ?? '',
      contentType: String(req.headers['content-type'] || ''),
      receivedToken: token,
      bodyParsed: body,
      tenantSlug,
    });
  }

  @Post('webhooks/nowpayments')
  async webhookNowpayments(
    @Req() req: Request,
    @Headers('x-nowpayments-sig') signature: string,
    @Body() body: any,
    @Query('tenant') tenantSlug?: string,
  ) {
    return this.svc.handleNowpaymentsWebhook({
      rawBody: (req as any).rawBody ?? JSON.stringify(body ?? {}),
      signature,
      payload: body,
      tenantSlug,
    });
  }

  // ─── DLQ ─────────────────────────────────────────────────────────────────

  @Post('webhooks/dlq/process')
  async processDlqCron(@Headers('x-internal-key') key: string) {
    return this.svc.processWebhookDlq({ key });
  }

  @Get('webhooks/dlq')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat')
  async listDlq(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.listWebhookDlq({ status, limit, offset });
  }

  @Post('webhooks/dlq/action')
  @UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
  @Roles('owner', 'admin', 'secretariat')
  async dlqAction(
    @Body() body: { action: string; id?: string; reason?: string; limit?: number },
  ) {
    return this.svc.dlqAction(body);
  }
}
