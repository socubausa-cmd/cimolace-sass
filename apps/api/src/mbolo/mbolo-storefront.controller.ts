import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { MboloService } from './mbolo.service';

/**
 * API publique Mbolo "Mode C" — le site existant d'un client (ex: zahirwellness.com)
 * interroge son catalogue et passe commande SANS que chaque acheteur ait un compte
 * Cimolace. Authentifié par une clé API tenant (Authorization: Bearer mbk_<slug>_<secret>).
 *
 * Le guard ApiKeyGuard résout le tenant depuis la clé → isolation garantie.
 * Lecture catalogue = publique (acheteur anonyme) ; checkout = invité (email requis).
 * Les prix sont recalculés côté serveur, jamais ceux envoyés par le client.
 */
@Controller('v1/mbolo/storefront')
@UseGuards(ApiKeyGuard)
export class MboloStorefrontController {
  constructor(private readonly svc: MboloService) {}

  @Get('categories')
  categories(@CurrentTenant() t: TenantContext) {
    return this.svc.listCategories(t.id);
  }

  @Get('products')
  products(@CurrentTenant() t: TenantContext, @Query('category') category?: string) {
    return this.svc.listProducts(t.id, category);
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string, @CurrentTenant() t: TenantContext) {
    return this.svc.getProductBySlug(t.id, slug);
  }

  @Post('orders')
  createOrder(@Body() body: any, @CurrentTenant() t: TenantContext) {
    return this.svc.createStorefrontOrder(t.id, body);
  }

  // ─── Paiement en ligne (Stripe Checkout) ───
  @Post('orders/:id/checkout-session')
  checkoutSession(@Param('id') id: string, @Body() body: any, @CurrentTenant() t: TenantContext) {
    return this.svc.createOrderCheckoutSession(t.id, id, { successUrl: body?.successUrl, cancelUrl: body?.cancelUrl });
  }

  @Post('orders/:id/confirm')
  confirm(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.confirmOrderPayment(t.id, id);
  }

  // ─── Lien de paiement public (page /pay/:token — le storefront lit avec sa clé mbk_) ───
  @Get('pay/:token')
  payLink(@Param('token') token: string, @CurrentTenant() t: TenantContext) {
    return this.svc.getPaymentLinkByToken(t.id, token);
  }
  @Post('pay/:token/checkout-session')
  payCheckout(@Param('token') token: string, @Body() body: any, @CurrentTenant() t: TenantContext) {
    return this.svc.createPaymentLinkCheckoutSession(t.id, token, { successUrl: body?.successUrl, cancelUrl: body?.cancelUrl });
  }
  @Post('pay/:token/confirm')
  payConfirm(@Param('token') token: string, @CurrentTenant() t: TenantContext) {
    return this.svc.confirmPaymentLink(t.id, token);
  }

  // ─── Mobile Money (PawaPay) — encaissement sur le compte du tenant ───
  @Post('orders/:id/mobile-money')
  orderMobileMoney(@Param('id') id: string, @Body() b: any, @CurrentTenant() t: TenantContext) {
    return this.svc.createOrderMobileMoneyDeposit(t.id, id, { phoneNumber: b?.phoneNumber, provider: b?.provider, country: b?.country });
  }
  @Post('orders/:id/mobile-money/status')
  orderMobileMoneyStatus(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.confirmOrderMobileMoney(t.id, id);
  }
  @Post('pay/:token/mobile-money')
  payMobileMoney(@Param('token') token: string, @Body() b: any, @CurrentTenant() t: TenantContext) {
    return this.svc.createPaymentLinkMobileMoneyDeposit(t.id, token, { phoneNumber: b?.phoneNumber, provider: b?.provider, country: b?.country });
  }
  @Post('pay/:token/mobile-money/status')
  payMobileMoneyStatus(@Param('token') token: string, @CurrentTenant() t: TenantContext) {
    return this.svc.confirmPaymentLinkMobileMoney(t.id, token);
  }
}
