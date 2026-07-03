import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { EngineEnabledGuard } from '../common/guards/engine-enabled.guard';
import { RequireEngine } from '../common/decorators/require-engine.decorator';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import { TenantGuard } from '../tenant/tenant.guard';
import type { TenantContext } from '../tenant/tenant.types';
import { MboloService } from './mbolo.service';

// EngineEnabledGuard est un NO-OP sur les routes SANS @RequireEngine (install,
// panier, commandes, storefront restent ouverts). Il n'enforce l'activation
// « mbolo » que sur les routes d'ADMINISTRATION du catalogue marquées
// @RequireEngine('mbolo'), ET seulement pour les tenants ayant opté
// (metadata.gating.runtime=true) → 0 régression sur les tenants existants.
@Controller('mbolo')
@UseGuards(JwtAuthGuard, TenantGuard, EngineEnabledGuard)
export class MboloController {
  constructor(private readonly svc: MboloService) {}
  // ─── Installer Mbolo (provisionne clé storefront + catalogue de départ) ───
  // PAS de @RequireEngine : c'est l'acte d'ACTIVATION lui-même.
  @Post('install') @UseGuards(RolesGuard) @Roles('owner','admin')
  install(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) {
    return this.svc.installStorefront(t.id, (t as any).slug, (r as any).user?.id ?? null, { withSample: d?.withSample === true });
  }
  // ─── Catégories ───
  @Get('categories') listCategories(@CurrentTenant() t: TenantContext) { return this.svc.listCategories(t.id); }
  @Post('categories') @UseGuards(RolesGuard) @Roles('owner','admin') @RequireEngine('mbolo') createCategory(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.createCategory(t.id, d); }
  // ─── Produits (catalogue riche) ───
  @Get('products') listProducts(@CurrentTenant() t: TenantContext, @Query('category') category?: string) { return this.svc.listProducts(t.id, category); }
  @Get('products/:id') getProduct(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getProduct(t.id, id); }
  @Post('products') @UseGuards(RolesGuard) @Roles('owner','admin') @RequireEngine('mbolo') createProduct(@Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.createProduct(t.id, d); }
  @Patch('products/:id') @UseGuards(RolesGuard) @Roles('owner','admin') @RequireEngine('mbolo') updateProduct(@Param('id') id: string, @Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.updateProduct(t.id, id, d); }
  @Delete('products/:id') @UseGuards(RolesGuard) @Roles('owner','admin') @RequireEngine('mbolo') deleteProduct(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.deleteProduct(t.id, id); }
  @Post('products/:id/images') @UseGuards(RolesGuard) @Roles('owner','admin') @RequireEngine('mbolo') addImage(@Param('id') id: string, @Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.addProductImage(t.id, id, d); }
  @Post('products/:id/variants') @UseGuards(RolesGuard) @Roles('owner','admin') @RequireEngine('mbolo') addVariant(@Param('id') id: string, @Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.addProductVariant(t.id, id, d); }
  @Get('cart') getCart(@CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.getCart(t.id, (r as any).user.id); }
  @Post('cart') addToCart(@Body() d: any, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.addToCart(t.id, (r as any).user.id, d.productId, d.quantity); }
  @Delete('cart/:productId') removeFromCart(@Param('productId') pid: string, @CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.removeFromCart(t.id, (r as any).user.id, pid); }
  @Post('orders') createOrder(@CurrentTenant() t: TenantContext, @Req() r: Request) { return this.svc.createOrder(t.id, (r as any).user.id); }
  @Get('orders') listOrders(@CurrentTenant() t: TenantContext, @Req() r: Request) { const role = (r as any).tenant?.userRole; return this.svc.listOrders(t.id, role === 'student' ? (r as any).user.id : undefined); }
  @Get('orders/:id') getOrder(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.getOrder(t.id, id); }
  // Paiement de la commande (membre connecté) : crée la session Stripe + confirme au retour.
  @Post('orders/:id/checkout-session') checkoutSession(@Param('id') id: string, @Body() d: any, @CurrentTenant() t: TenantContext) { return this.svc.createOrderCheckoutSession(t.id, id, { successUrl: d?.successUrl, cancelUrl: d?.cancelUrl }); }
  @Post('orders/:id/confirm') confirmOrder(@Param('id') id: string, @CurrentTenant() t: TenantContext) { return this.svc.confirmOrderPayment(t.id, id); }
}
