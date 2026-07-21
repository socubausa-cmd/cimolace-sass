/**
 * AiBillingController — endpoints REST pour le dashboard tenant.
 *
 * Routes (auth: JwtAuthGuard + TenantGuard) :
 *   GET    /ai-billing/balance              → solde courant + plan
 *   GET    /ai-billing/transactions         → historique mouvements
 *   GET    /ai-billing/usage                → events détaillés
 *   GET    /ai-billing/usage/stats          → stats agrégées (30j)
 *   GET    /ai-billing/pricing              → catalogue prix par modèle
 *   GET    /ai-billing/topup-packages       → packs disponibles
 *   POST   /ai-billing/topup/checkout       → crée session Stripe pour pack
 *   GET    /ai-billing/plans                → quotas par plan
 *   POST   /ai-billing/plan                 → changer de plan (admin)
 *   POST   /ai-billing/refill               → refill manuel (admin)
 */

import {
  Body, Controller, Get, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantGuard } from '../tenant/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentTenant } from '../tenant/current-tenant.decorator';
import type { TenantContext } from '../tenant/tenant.types';
import { AiBillingService } from './ai-billing.service';

// RolesGuard au niveau classe : les handlers SANS @Roles (pricing, topup-packages,
// plans = catalogue global) restent lisibles par tout membre ; les handlers avec
// @Roles('owner','admin') (solde/usage/plan/refill/topup = données & actions
// financières du tenant) sont réservés au staff (ferme la priv-esc intra-tenant).
@Controller('ai-billing')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AiBillingController {
  constructor(private readonly svc: AiBillingService) {}

  @Get('balance')
  @Roles('owner', 'admin')
  async balance(@CurrentTenant() t: TenantContext) {
    return this.svc.getBalance(t.id);
  }

  @Get('transactions')
  @Roles('owner', 'admin')
  async transactions(
    @CurrentTenant() t: TenantContext,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getTransactionHistory(t.id, limit ? parseInt(limit, 10) : 50);
  }

  @Get('usage')
  @Roles('owner', 'admin')
  async usage(
    @CurrentTenant() t: TenantContext,
    @Query('limit') limit?: string,
    @Query('function') function_name?: string,
    @Query('since') since?: string,
  ) {
    return this.svc.getUsageEvents(t.id, {
      limit: limit ? parseInt(limit, 10) : 100,
      function_name,
      since,
    });
  }

  @Get('usage/stats')
  @Roles('owner', 'admin')
  async stats(
    @CurrentTenant() t: TenantContext,
    @Query('days') days?: string,
  ) {
    return this.svc.getUsageStats(t.id, days ? parseInt(days, 10) : 30);
  }

  @Get('pricing')
  async pricing() {
    return this.svc.getPricing();
  }

  @Get('topup-packages')
  async topupPackages() {
    return this.svc.listTopupPackages();
  }

  @Get('plans')
  async plans() {
    return this.svc.listPlanQuotas();
  }

  // ─── Mutations administratives ────────────────────────────────────────────

  @Post('plan')
  @Roles('owner', 'admin')
  async setPlan(
    @CurrentTenant() t: TenantContext,
    @Body() body: { plan_tier: string },
  ) {
    return this.svc.setTenantPlan(t.id, body.plan_tier);
  }

  @Post('refill')
  @Roles('owner', 'admin')
  async refill(@CurrentTenant() t: TenantContext) {
    return this.svc.monthlyRefill(t.id);
  }

  /**
   * POST /ai-billing/topup/checkout
   * Crée une session Stripe Checkout pour un pack de crédits LIRI.
   * - Dev (NODE_ENV != production) : crédite directement, pratique pour les tests.
   * - Prod : crée une vraie Stripe Checkout Session et retourne l'URL de paiement.
   *   Le webhook checkout.session.completed crédite alors le solde côté serveur.
   */
  @Post('topup/checkout')
  @Roles('owner', 'admin')
  async createTopupCheckout(
    @CurrentTenant() t: TenantContext,
    @Body() body: { pack_key: string; success_url?: string; cancel_url?: string },
  ) {
    const pack = await this.svc.getTopupPackage(body.pack_key);

    if (process.env.NODE_ENV !== 'production') {
      const result = await this.svc.creditCredits(
        t.id,
        parseFloat(pack.credits_amount),
        'topup_purchase',
        {
          reference: `dev_topup_${body.pack_key}_${Date.now()}`,
          description: `Achat ${pack.label} (mode dev)`,
          metadata: { pack_key: body.pack_key, price_cents: pack.price_cents },
        },
      );
      return {
        ...result,
        dev_mode: true,
        message: 'Mode dev : crédits ajoutés directement. En prod, redirection Stripe Checkout.',
      };
    }

    // ─── Mode prod : Stripe Checkout Session réelle ─────────────────────────
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) {
      return { success: false, message: 'STRIPE_SECRET_KEY non configurée' };
    }
    if (!pack.stripe_price_id) {
      return {
        success: false,
        message: `Pack "${body.pack_key}" n'a pas de stripe_price_id configuré`,
      };
    }

    const frontend = process.env.FRONTEND_URL || 'https://cimolace.space';
    const successUrl =
      body.success_url ||
      `${frontend}/tenant/admin/ai-billing?topup=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = body.cancel_url || `${frontend}/tenant/admin/ai-billing?topup=cancel`;

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('line_items[0][price]', pack.stripe_price_id);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('client_reference_id', t.id);
    params.append('metadata[tenant_id]', t.id);
    params.append('metadata[pack_key]', body.pack_key);
    params.append('metadata[credits_amount]', String(pack.credits_amount));
    params.append('metadata[purpose]', 'liri_credits_topup');

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(stripeSecret + ':').toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        success: false,
        message: `Stripe Checkout error ${res.status}`,
        error: errText.slice(0, 500),
      };
    }

    const session = (await res.json()) as { id: string; url: string };
    return {
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      pack: {
        key: pack.key,
        label: pack.label,
        credits: pack.credits_amount,
        price_cents: pack.price_cents,
      },
    };
  }

  /** Récap rapide pour le widget header (solde + pourcentage utilisé) */
  @Get('summary')
  @Roles('owner', 'admin')
  async summary(@CurrentTenant() t: TenantContext) {
    const balance = await this.svc.getBalance(t.id);
    const monthlyQuota = parseFloat(balance.monthly_quota || '0');
    const currentBalance = parseFloat(balance.balance_credits || '0');
    const consumedThisMonth = Math.max(0, monthlyQuota - currentBalance);
    const percentUsed = monthlyQuota > 0 ? (consumedThisMonth / monthlyQuota) * 100 : 0;

    return {
      balance: currentBalance,
      monthly_quota: monthlyQuota,
      consumed_this_month: consumedThisMonth,
      percent_used: Math.round(percentUsed * 10) / 10,
      plan_tier: balance.plan_tier,
      next_refill_at: balance.next_refill_at,
      total_consumed_lifetime: parseFloat(balance.total_consumed || '0'),
      total_purchased_lifetime: parseFloat(balance.total_purchased || '0'),
      is_blocked: balance.is_blocked,
      low_balance_warning: currentBalance < monthlyQuota * 0.1,
    };
  }
}
