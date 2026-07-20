import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { MboloService } from './mbolo.service';
import { MboloAdminKeyGuard } from './mbolo-admin-key.guard';

/**
 * API d'ADMINISTRATION du catalogue Mbolo par clé tenant (server-to-server).
 * Pendant "écriture" de MboloStorefrontController : là où le storefront LIT le
 * catalogue avec sa clé `mbk_`, le back-office d'un client (ex : storefront mbolo
 * générique) CRÉE / MODIFIE ses produits ici avec sa clé `mba_` — même moteur, même
 * tenant, mêmes tables `mbolo_*` scoppées par tenant_id.
 *
 * But : réconcilier admin et vitrine sur UN SEUL catalogue par tenant. Un produit
 * créé via ces endpoints apparaît immédiatement dans le storefront (qui lit la même
 * source Cimolace), ce qui n'était pas le cas quand l'admin écrivait une base à part.
 *
 * Auth : ApiKeyGuard (résout le tenant depuis la clé) + MboloAdminKeyGuard (exige le
 * préfixe `mba_` — une clé storefront `mbk_` est refusée). Isolation tenant garantie
 * par le guard ; le service filtre déjà toutes les requêtes sur tenant_id.
 */
@Controller('v1/mbolo/admin')
@UseGuards(ApiKeyGuard, MboloAdminKeyGuard)
export class MboloAdminController {
  constructor(private readonly svc: MboloService) {}

  // ─── Catégories ───
  @Get('categories')
  listCategories(@CurrentTenant() t: TenantContext) {
    return this.svc.listCategories(t.id);
  }
  @Post('categories')
  createCategory(@Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.svc.createCategory(t.id, d);
  }

  // ─── Produits (catalogue riche, tenant-scopé) ───
  @Get('products')
  listProducts(@CurrentTenant() t: TenantContext, @Query('category') category?: string) {
    return this.svc.listProducts(t.id, category);
  }
  @Get('products/:id')
  getProduct(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.getProduct(t.id, id);
  }
  @Post('products')
  createProduct(@Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.svc.createProduct(t.id, d);
  }
  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.svc.updateProduct(t.id, id, d);
  }
  @Delete('products/:id')
  deleteProduct(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.deleteProduct(t.id, id);
  }
  @Post('products/:id/images')
  addImage(@Param('id') id: string, @Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.svc.addProductImage(t.id, id, d);
  }
  @Post('products/:id/variants')
  addVariant(@Param('id') id: string, @Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.svc.addProductVariant(t.id, id, d);
  }

  // ─── Commandes (back-office tenant-scopé — toutes les commandes de la boutique) ───
  @Get('orders')
  listOrders(@CurrentTenant() t: TenantContext) {
    return this.svc.listOrders(t.id); // sans userId → toutes les commandes du tenant
  }
  @Get('orders/:id')
  getOrder(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.getOrder(t.id, id);
  }
  @Patch('orders/:id')
  updateOrder(@Param('id') id: string, @Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.svc.updateOrderStatus(t.id, id, { status: d?.status, paymentStatus: d?.paymentStatus ?? d?.payment_status });
  }

  // ─── Liens de paiement / facturation (tenant-scopés) ───
  @Get('payment-links')
  listPaymentLinks(@CurrentTenant() t: TenantContext) {
    return this.svc.listPaymentLinks(t.id);
  }
  @Get('payment-links/:id')
  getPaymentLink(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.getPaymentLink(t.id, id);
  }
  @Post('payment-links')
  createPaymentLink(@Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.svc.createPaymentLink(t.id, d);
  }
  @Patch('payment-links/:id')
  updatePaymentLink(@Param('id') id: string, @Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.svc.updatePaymentLink(t.id, id, d);
  }
  @Delete('payment-links/:id')
  deletePaymentLink(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.deletePaymentLink(t.id, id);
  }

  // ─── Factures (tenant-scopées) ───
  @Get('invoices')
  listInvoices(@CurrentTenant() t: TenantContext) {
    return this.svc.listInvoices(t.id);
  }
  @Get('invoices/:id')
  getInvoice(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.getInvoice(t.id, id);
  }
  @Post('invoices')
  createInvoice(@Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.svc.createInvoice(t.id, d);
  }
  @Patch('invoices/:id')
  updateInvoice(@Param('id') id: string, @Body() d: any, @CurrentTenant() t: TenantContext) {
    return this.svc.updateInvoice(t.id, id, d);
  }
  @Delete('invoices/:id')
  deleteInvoice(@Param('id') id: string, @CurrentTenant() t: TenantContext) {
    return this.svc.deleteInvoice(t.id, id);
  }
}
