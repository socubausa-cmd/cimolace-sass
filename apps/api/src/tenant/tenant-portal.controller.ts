import { BadRequestException, Body, Controller, Get, NotFoundException, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { SupabaseService } from '../supabase/supabase.service';

/**
 * Back-office TENANT (self-service) — endpoints scoped au tenant courant via
 * TenantGuard (req.tenant.{id,slug,userRole}, appartenance déjà validée).
 * Sert les onglets API & clés, Marketplace et Support du dashboard tenant.
 */
@Controller('tenant-portal')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TenantPortalController {
  constructor(private readonly supabase: SupabaseService) {}

  private get db(): any {
    return this.supabase.client as any;
  }

  // NB : la gestion des clés API tenant est servie par TenantApiKeyController
  // (`/tenants/api-keys` GET/POST/DELETE, rôle owner/admin) — pas de doublon ici.

  /** Catalogue Cimolace souscriptible + ce que le tenant a déjà. */
  @Get('marketplace')
  async marketplace(@Req() req: any) {
    const [plansRes, subsRes] = await Promise.all([
      this.db.from('billing_plans').select('key, label, description, price_cents, currency, billing_cycle, features').eq('is_active', true),
      this.db.from('billing_subscriptions').select('plan_id, status').eq('tenant_id', req.tenant.id),
    ]);
    const subscribedKeys = new Set(
      (subsRes.data ?? [])
        .filter((s: any) => ['active', 'trialing', 'past_due', 'pending'].includes(s.status))
        .map((s: any) => s.plan_id),
    );
    const available = (plansRes.data ?? [])
      .filter((p: any) => !String(p.key).startsWith('ngowazulu-')) // exclut les plans mentorat perso
      .map((p: any) => ({ ...p, subscribed: subscribedKeys.has(p.key) }))
      .sort((a: any, b: any) => (a.price_cents ?? 0) - (b.price_cents ?? 0));
    return { data: available };
  }

  /** Souscrit (pending) un plan — le tenant paie ensuite par carte (card-checkout). */
  @Post('marketplace/subscribe')
  async subscribe(@Req() req: any, @Body() body: { plan?: string }) {
    const planKey = body?.plan;
    if (!planKey) throw new BadRequestException('Plan requis');
    const { data: plan } = await this.db.from('billing_plans').select('*').eq('key', planKey).maybeSingle();
    if (!plan) throw new NotFoundException('Plan introuvable');

    const { data: existing } = await this.db
      .from('billing_subscriptions')
      .select('id, status')
      .eq('tenant_id', req.tenant.id)
      .eq('plan_id', planKey)
      .in('status', ['active', 'trialing', 'past_due', 'pending'])
      .maybeSingle();
    if (existing) return { data: { id: existing.id, status: existing.status, already: true } };

    const { data, error } = await this.db
      .from('billing_subscriptions')
      .insert({
        tenant_id: req.tenant.id,
        plan_id: planKey,
        status: 'pending',
        amount_cents: plan.price_cents ?? 0,
        currency: plan.currency || 'EUR',
        provider: 'stripe',
        customer_email: req.user?.email ?? null,
        metadata: { label: plan.label, source: 'tenant-portal-marketplace' },
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return { data };
  }

  /** Tickets support du tenant (liés par email du demandeur). */
  @Get('support/tickets')
  async tickets(@Req() req: any) {
    const email = String(req.user?.email || '').toLowerCase();
    if (!email) return { data: [] };
    const { data } = await this.db
      .from('cimolace_tickets')
      .select('*')
      .eq('contact_email', email)
      .order('created_at', { ascending: false });
    return { data: data ?? [] };
  }

  /** Crée un ticket support depuis l'espace tenant. */
  @Post('support/tickets')
  async createTicket(@Req() req: any, @Body() body: any) {
    const email = String(req.user?.email || '').toLowerCase();
    const ticketNumber = `TEN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const { data, error } = await this.db
      .from('cimolace_tickets')
      .insert({
        ticket_number: body?.ticket_number ?? ticketNumber,
        subject: body?.subject ?? 'Demande de support',
        description: body?.description ?? null,
        category: body?.category ?? 'support',
        priority: body?.priority ?? 'medium',
        status: 'open',
        contact_email: email || null,
      })
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return { data };
  }
}
