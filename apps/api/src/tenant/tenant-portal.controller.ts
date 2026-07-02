import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { randomBytes } from 'crypto';
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
    // « Déjà actif » = abo RÉELLEMENT payé/actif. Un abo 'pending' = paiement lancé
    // mais NON abouti → ne doit PAS s'afficher comme souscrit (sinon on voit « Déjà
    // actif » sans avoir payé). On l'expose séparément (pendingPayment) pour info.
    const subscribedKeys = new Set(
      (subsRes.data ?? [])
        .filter((s: any) => ['active', 'trialing', 'past_due'].includes(s.status))
        .map((s: any) => s.plan_id),
    );
    const pendingKeys = new Set(
      (subsRes.data ?? [])
        .filter((s: any) => s.status === 'pending')
        .map((s: any) => s.plan_id),
    );
    const available = (plansRes.data ?? [])
      .filter((p: any) => !String(p.key).startsWith('ngowazulu-')) // exclut les plans mentorat perso
      .map((p: any) => ({ ...p, subscribed: subscribedKeys.has(p.key), pendingPayment: pendingKeys.has(p.key) }))
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

  /** Synthèse d'usage du tenant (onglet Monitoring). */
  @Get('usage')
  async usage(@Req() req: any) {
    const tid = req.tenant.id;
    const [svc, keys, members, subs, invoices] = await Promise.all([
      this.db.from('tenant_services').select('active').eq('tenant_id', tid),
      this.db.from('tenant_api_keys').select('id, revoked_at').eq('tenant_id', tid),
      this.db.from('tenant_memberships').select('id, status').eq('tenant_id', tid),
      this.db.from('billing_subscriptions').select('status, plan_id, current_period_end').eq('tenant_id', tid),
      this.db.from('billing_invoices').select('status').eq('tenant_id', tid),
    ]);
    const services = svc.data ?? [];
    const apiKeys = (keys.data ?? []).filter((k: any) => !k.revoked_at);
    const mem = (members.data ?? []).filter((m: any) => m.status !== 'removed');
    const subscriptions = subs.data ?? [];
    const activeSub = subscriptions.find((s: any) => ['active', 'trialing', 'past_due'].includes(s.status));
    const inv = invoices.data ?? [];
    return {
      data: {
        engines: { active: services.filter((s: any) => s.active).length, total: services.length },
        apiKeys: apiKeys.length,
        members: mem.length,
        subscription: activeSub ? { status: activeSub.status, plan: activeSub.plan_id, renews: activeSub.current_period_end } : null,
        invoices: {
          total: inv.length,
          paid: inv.filter((i: any) => i.status === 'paid').length,
          unpaid: inv.filter((i: any) => i.status && !['paid', 'void', 'canceled'].includes(i.status)).length,
        },
      },
    };
  }

  /** Profil de l'utilisateur courant + son rôle dans le tenant. */
  @Get('profile')
  async profile(@Req() req: any) {
    return {
      data: {
        id: req.user?.id,
        email: req.user?.email,
        role: req.tenant?.userRole ?? null,
        tenant: { id: req.tenant?.id, slug: req.tenant?.slug },
      },
    };
  }

  /** Annule un abonnement du tenant (après vérification d'appartenance). */
  @Post('subscriptions/:id/cancel')
  async cancelSub(@Req() req: any, @Param('id') id: string) {
    const { data: sub } = await this.db.from('billing_subscriptions').select('id, tenant_id').eq('id', id).maybeSingle();
    if (!sub || sub.tenant_id !== req.tenant.id) throw new NotFoundException('Abonnement introuvable pour ce tenant');
    const now = new Date().toISOString();
    const { data, error } = await this.db
      .from('billing_subscriptions')
      .update({ status: 'canceled', canceled_at: now, updated_at: now })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new BadRequestException(error.message);
    return { data };
  }

  /**
   * Demande de suppression de compte (SOFT) : marque le tenant
   * (`metadata.deletion_requested`) + ouvre un ticket pour l'équipe Cimolace.
   * Pas de suppression destructive ici. Réservé au owner du tenant.
   */
  @Post('account/request-deletion')
  async requestDeletion(@Req() req: any, @Body() body: any) {
    if (req.tenant?.userRole !== 'owner') {
      throw new BadRequestException('Seul le owner du tenant peut demander la suppression du compte.');
    }
    const tid = req.tenant.id;
    const now = new Date().toISOString();
    const { data: t } = await this.db.from('tenants').select('metadata').eq('id', tid).maybeSingle();
    const meta = {
      ...(t?.metadata || {}),
      deletion_requested: { at: now, by: req.user?.email ?? null, reason: body?.reason ?? null },
    };
    await this.db.from('tenants').update({ metadata: meta, updated_at: now }).eq('id', tid);
    await this.db.from('cimolace_tickets').insert({
      ticket_number: `DEL-${Date.now().toString(36).toUpperCase().slice(-6)}`,
      subject: `Suppression de compte demandée — ${req.tenant.slug}`,
      description: body?.reason ?? 'Demande de suppression depuis le portail tenant (à traiter par l’équipe).',
      category: 'account_deletion',
      priority: 'high',
      status: 'open',
      contact_email: req.user?.email ?? null,
    });
    return { data: { ok: true, requested_at: now } };
  }

  // ── Équipe / membres (tenant_memberships + profiles) ───────────────────────

  /** Liste les membres du tenant (email + rôle + statut). */
  @Get('members')
  async members(@Req() req: any) {
    const { data: memberships } = await this.db
      .from('tenant_memberships')
      .select('id, user_id, role, status, created_at')
      .eq('tenant_id', req.tenant.id)
      .order('created_at', { ascending: true });
    const ids = (memberships ?? []).map((m: any) => m.user_id).filter(Boolean);
    let profiles: any[] = [];
    if (ids.length) {
      const { data } = await this.db.from('profiles').select('id, email, full_name').in('id', ids);
      profiles = data ?? [];
    }
    const byId: Record<string, any> = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
    return {
      data: (memberships ?? []).map((m: any) => ({
        user_id: m.user_id,
        role: m.role,
        status: m.status,
        created_at: m.created_at,
        email: byId[m.user_id]?.email ?? null,
        full_name: byId[m.user_id]?.full_name ?? null,
      })),
    };
  }

  /** Ajoute un membre par email (l'utilisateur doit déjà avoir un compte). Owner/admin. */
  @Post('members')
  async inviteMember(@Req() req: any, @Body() body: { email?: string; role?: string }) {
    if (!['owner', 'admin'].includes(req.tenant?.userRole)) {
      throw new BadRequestException('Rôle owner/admin requis pour gérer l’équipe.');
    }
    const email = String(body?.email || '').toLowerCase().trim();
    if (!email) throw new BadRequestException('Email requis');
    const role = body?.role || 'member';
    const { data: prof } = await this.db.from('profiles').select('id').eq('email', email).maybeSingle();
    if (!prof?.id) {
      throw new BadRequestException("Aucun compte pour cet email — demandez à la personne de s'inscrire d'abord.");
    }
    const { data: existing } = await this.db
      .from('tenant_memberships')
      .select('id')
      .eq('tenant_id', req.tenant.id)
      .eq('user_id', prof.id)
      .maybeSingle();
    if (existing?.id) {
      await this.db.from('tenant_memberships').update({ role, status: 'active' }).eq('id', existing.id);
    } else {
      await this.db.from('tenant_memberships').insert({ tenant_id: req.tenant.id, user_id: prof.id, role, status: 'active' });
    }
    return { data: { ok: true, email, role } };
  }

  /** Retire un membre du tenant. Owner/admin. */
  @Delete('members/:userId')
  async removeMember(@Req() req: any, @Param('userId') userId: string) {
    if (!['owner', 'admin'].includes(req.tenant?.userRole)) {
      throw new BadRequestException('Rôle owner/admin requis.');
    }
    if (userId === req.user?.id) throw new BadRequestException('Vous ne pouvez pas vous retirer vous-même.');
    await this.db.from('tenant_memberships').delete().eq('tenant_id', req.tenant.id).eq('user_id', userId);
    return { data: { ok: true } };
  }

  /** Change le rôle d'un membre. Owner uniquement. */
  @Patch('members/:userId')
  async updateMemberRole(@Req() req: any, @Param('userId') userId: string, @Body() body: { role?: string }) {
    if (req.tenant?.userRole !== 'owner') throw new BadRequestException('Rôle owner requis.');
    const role = body?.role;
    if (!role) throw new BadRequestException('Rôle requis');
    await this.db.from('tenant_memberships').update({ role }).eq('tenant_id', req.tenant.id).eq('user_id', userId);
    return { data: { ok: true, role } };
  }

  /**
   * Ouvre le portail de facturation Stripe (gérer carte, factures, annulation)
   * pour le client Stripe du tenant. Renvoie l'URL de la session.
   */
  @Post('billing-portal')
  async billingPortal(@Req() req: any) {
    const { data: sub } = await this.db
      .from('billing_subscriptions')
      .select('provider_customer_id')
      .eq('tenant_id', req.tenant.id)
      .not('provider_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const customer = sub?.provider_customer_id;
    if (!customer) {
      throw new BadRequestException("Aucun client Stripe — effectuez d'abord un paiement par carte.");
    }
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new BadRequestException('Paiement carte non configuré (STRIPE_SECRET_KEY).');
    const frontend = process.env.FRONTEND_URL || 'https://app.cimolace.space';
    const params = new URLSearchParams();
    params.append('customer', String(customer));
    params.append('return_url', `${frontend}/cimolace/billing`);
    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(secret + ':').toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    const session: any = await res.json();
    if (!res.ok) throw new BadRequestException(session?.error?.message || 'Portail Stripe indisponible');
    return { url: session.url };
  }

  // ── Webhooks tenant (tenant_webhooks) ──────────────────────────────────────

  /** Liste les webhooks du tenant (sans le secret). */
  @Get('webhooks')
  async webhooks(@Req() req: any) {
    const { data } = await this.db
      .from('tenant_webhooks')
      .select('id, label, url, events, is_active, failure_count, created_at')
      .eq('tenant_id', req.tenant.id)
      .order('created_at', { ascending: false });
    return { data: data ?? [] };
  }

  /** Crée un webhook (secret HMAC généré + renvoyé une fois). Owner/admin. */
  @Post('webhooks')
  async createWebhook(@Req() req: any, @Body() body: { label?: string; url?: string; events?: string[] }) {
    if (!['owner', 'admin'].includes(req.tenant?.userRole)) throw new BadRequestException('Rôle owner/admin requis.');
    const url = String(body?.url || '').trim();
    if (!/^https:\/\//i.test(url)) throw new BadRequestException('URL HTTPS requise.');
    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    const { data, error } = await this.db
      .from('tenant_webhooks')
      .insert({
        tenant_id: req.tenant.id,
        label: body?.label || 'Webhook',
        url,
        secret,
        events: Array.isArray(body?.events) && body.events.length ? body.events : ['*'],
        is_active: true,
      })
      .select('id, label, url, events, is_active')
      .single();
    if (error) throw new BadRequestException(error.message);
    return { data: { ...data, secret } };
  }

  /** Active/désactive un webhook. Owner/admin. */
  @Patch('webhooks/:id')
  async toggleWebhook(@Req() req: any, @Param('id') id: string, @Body() body: { is_active?: boolean }) {
    if (!['owner', 'admin'].includes(req.tenant?.userRole)) throw new BadRequestException('Rôle owner/admin requis.');
    const { data, error } = await this.db
      .from('tenant_webhooks')
      .update({ is_active: !!body?.is_active })
      .eq('id', id)
      .eq('tenant_id', req.tenant.id)
      .select('id, is_active')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException('Webhook introuvable');
    return { data };
  }

  /** Supprime un webhook. Owner/admin. */
  @Delete('webhooks/:id')
  async deleteWebhook(@Req() req: any, @Param('id') id: string) {
    if (!['owner', 'admin'].includes(req.tenant?.userRole)) throw new BadRequestException('Rôle owner/admin requis.');
    await this.db.from('tenant_webhooks').delete().eq('id', id).eq('tenant_id', req.tenant.id);
    return { data: { ok: true } };
  }
}
