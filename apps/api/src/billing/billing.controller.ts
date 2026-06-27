import { Controller, Get, Post, Body, Param, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CimolaceStaffGuard } from "../cimolace-backoffice/cimolace-staff.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { BillingService } from "./billing.service";

@Controller("billing")
@UseGuards(JwtAuthGuard, TenantGuard)
export class BillingController {
  constructor(private svc: BillingService) {}
  @Get("subscription") async getSubscription(@Req() req: any) { return { data: await this.svc.getSubscription(req.tenant.id) }; }
  @Post("subscription") async create(@Req() req: any, @Body() b: any) { return { data: await this.svc.createSubscription(req.tenant.id, b.plan, b.provider) }; }
  @Get("invoices") async getInvoices(@Req() req: any) { return { data: await this.svc.getInvoices(req.tenant.id) }; }

  // Abonnement plateforme (billing_*) + collecte mobile money PawaPay
  // Valeur brute renvoyée : le ResponseInterceptor global emballe en { data: ... }
  // (renvoyer { data } ici produirait un double-emballage).
  @Get("plan") async plan(@Req() req: any) { return this.svc.getTenantSubscription(req.tenant.id); }
  // SELF-SERVE : choisir un forfait Cimolace (grille LIRI) → crée l'abo 'pending' à
  // payer ensuite via card-checkout (Stripe) ou collect (PawaPay). Body { planKey, provider? }.
  @Post("subscribe") async subscribe(@Req() req: any, @Body() b: { planKey?: string; provider?: string }) {
    return this.svc.subscribeToPlan(req.tenant.id, b?.planKey ?? "", b?.provider);
  }
  // Mobile money (PawaPay — Afrique)
  @Post("subscriptions/:id/collect") async collect(@Req() req: any, @Param("id") id: string, @Body() b: any) {
    return this.svc.collectSubscriptionViaPawaPay(req.tenant.id, id, b);
  }
  // Carte bancaire (Stripe — Europe / international)
  @Post("subscriptions/:id/card-checkout") async cardCheckout(@Req() req: any, @Param("id") id: string) {
    return this.svc.createCardCheckout(req.tenant.id, id);
  }
  @Post("subscriptions/:id/card-confirm") async cardConfirm(@Req() req: any, @Param("id") id: string) {
    return this.svc.confirmCardPayment(req.tenant.id, id);
  }

  // Retraits / versements mobile money (PawaPay payouts) — owner/admin
  @Get("payouts") async listPayouts(@Req() req: any) { return this.svc.listPayouts(req.tenant.id); }
  @Post("payouts") @UseGuards(RolesGuard) @Roles("owner", "admin") async createPayout(@Req() req: any, @Body() b: any) {
    return this.svc.createPayout(req.tenant.id, req.user?.id ?? null, b);
  }
}

/**
 * Back-office Cimolace (staff) — activation d'un abonnement forfaitaire pour un
 * tenant donné. Séparé de BillingController (self-serve, tenant-scoped) : ici on
 * agit sur un tenant arbitraire via son id, réservé au staff Cimolace.
 */
@Controller("admin/billing")
export class AdminBillingController {
  constructor(private svc: BillingService) {}

  /**
   * Active le forfait d'un tenant (crée billing_subscriptions actif + arme le
   * gating). Body optionnel : { plan?: string } (défaut "zahir-forfait").
   */
  @Post("tenants/:tenantId/activate")
  @UseGuards(JwtAuthGuard, CimolaceStaffGuard)
  async activate(@Param("tenantId") tenantId: string, @Body() body: { plan?: string }) {
    return { data: await this.svc.activateTenantSubscription(tenantId, body?.plan || "zahir-forfait") };
  }
}
