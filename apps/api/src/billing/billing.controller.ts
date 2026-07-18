import { Controller, Get, Post, Body, Param, Req, UseGuards, Headers, UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CimolaceStaffGuard } from "../cimolace-backoffice/cimolace-staff.guard";
import { TenantGuard } from "../common/guards/tenant.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { BillingService } from "./billing.service";

@Controller("billing")
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class BillingController {
  constructor(private svc: BillingService) {}
  // Données financières du tenant + écritures d'abonnement : owner/admin seulement
  // (défense en profondeur — un student membre ne doit pas lire le billing/solde
  // ni créer d'abo au nom du tenant). Ferme la priv-esc intra-tenant.
  @Get("subscription") @Roles("owner", "admin") async getSubscription(@Req() req: any) { return { data: await this.svc.getSubscription(req.tenant.id) }; }
  @Post("subscription") @Roles("owner", "admin") async create(@Req() req: any, @Body() b: any) { return { data: await this.svc.createSubscription(req.tenant.id, b.plan, b.provider) }; }
  @Get("invoices") @Roles("owner", "admin") async getInvoices(@Req() req: any) { return { data: await this.svc.getInvoices(req.tenant.id) }; }

  // Abonnement plateforme (billing_*) + collecte mobile money PawaPay
  // Valeur brute renvoyée : le ResponseInterceptor global emballe en { data: ... }
  // (renvoyer { data } ici produirait un double-emballage).
  @Get("plan") @Roles("owner", "admin") async plan(@Req() req: any) { return this.svc.getTenantSubscription(req.tenant.id); }
  // SELF-SERVE : choisir un forfait Cimolace (grille LIRI) → crée l'abo 'pending' à
  // payer ensuite via card-checkout (Stripe) ou collect (PawaPay). Body { planKey, provider? }.
  // Écritures qui engagent de l'argent (créer un abo, déclencher une collecte/
  // un checkout) → owner/admin uniquement (défense en profondeur, spec Billing/
  // Rôles §matrice ; un student ne doit JAMAIS abonner/payer au nom du tenant).
  @Post("subscribe") @Roles("owner", "admin") async subscribe(@Req() req: any, @Body() b: { planKey?: string; provider?: string }) {
    return this.svc.subscribeToPlan(req.tenant.id, b?.planKey ?? "", b?.provider);
  }
  // Mobile money (PawaPay — Afrique)
  @Post("subscriptions/:id/collect") @Roles("owner", "admin") async collect(@Req() req: any, @Param("id") id: string, @Body() b: any) {
    return this.svc.collectSubscriptionViaPawaPay(req.tenant.id, id, b);
  }
  // Mobile money : polling du statut (compte PawaPay partagé → pas de webhook cimolace).
  // Le front appelle ceci après « Demande envoyée » jusqu'à activation de l'abo.
  @Post("mobile-money/sync") @Roles("owner", "admin") async syncMobileMoney(@Req() req: any) {
    return this.svc.syncPendingPawaPayDeposits(req.tenant.id);
  }
  // Remboursement à l'annulation (owner/admin — ⚠️ déplace de l'argent réel vers le payeur)
  @Post("subscriptions/:id/refund") @UseGuards(RolesGuard) @Roles("owner", "admin")
  async refund(@Req() req: any, @Param("id") id: string) {
    return this.svc.refundSubscriptionPayment(req.tenant.id, id);
  }
  // Polling du statut de remboursement (le front l'appelle jusqu'à 'refunded')
  @Post("refunds/sync") @Roles("owner", "admin") async syncRefunds(@Req() req: any) {
    return this.svc.syncPendingRefunds(req.tenant.id);
  }
  // Carte bancaire (Stripe — Europe / international) — owner/admin (engage un paiement)
  @Post("subscriptions/:id/card-checkout") @Roles("owner", "admin") async cardCheckout(@Req() req: any, @Param("id") id: string) {
    return this.svc.createCardCheckout(req.tenant.id, id);
  }
  @Post("subscriptions/:id/card-confirm") @Roles("owner", "admin") async cardConfirm(@Req() req: any, @Param("id") id: string) {
    return this.svc.confirmCardPayment(req.tenant.id, id);
  }

  // Retraits / versements mobile money (PawaPay payouts) — owner/admin
  @Get("payouts") @Roles("owner", "admin") async listPayouts(@Req() req: any) { return this.svc.listPayouts(req.tenant.id); }
  // Solde estimé (encaissé mobile money − retiré) pour l'écran « Mes finances ».
  @Get("balance") @Roles("owner", "admin") async balance(@Req() req: any) { return this.svc.getBalance(req.tenant.id); }
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
  async activate(@Req() req: any, @Param("tenantId") tenantId: string, @Body() body: { plan?: string }) {
    return { data: await this.svc.activateTenantSubscription(tenantId, body?.plan || "zahir-forfait", req.user?.email ?? req.user?.id ?? undefined) };
  }
}

/**
 * Cron interne — renouvellement mobile money « push-to-approve » de TOUS les
 * tenants échus. Protégé par l'en-tête x-internal-key == INTERNAL_CRON_KEY.
 * À appeler périodiquement (worker / scheduler), jamais par un utilisateur.
 */
@Controller("billing")
export class BillingCronController {
  constructor(private svc: BillingService) {}
  @Post("renewals/run")
  runRenewals(@Headers("x-internal-key") key?: string) {
    const expected = process.env.INTERNAL_CRON_KEY;
    if (!expected || key !== expected) throw new UnauthorizedException("Clé interne invalide");
    return this.svc.renewDueSubscriptions();
  }
}
