import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { resolve4, resolveCname } from 'dns/promises';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SupabaseService } from '../supabase/supabase.service';
import { LiriEntitlementsService } from '../billing/liri-entitlements.service';

/**
 * Back-office TENANT (self-service) — endpoints scoped au tenant courant via
 * TenantGuard (req.tenant.{id,slug,userRole}, appartenance déjà validée).
 * Sert les onglets API & clés, Marketplace et Support du dashboard tenant.
 *
 * RolesGuard au niveau classe : les handlers SANS @Roles restent lisibles par
 * tout membre (profile, support/tickets = données propres) ; les reads sensibles
 * (members/webhooks/domains/usage/marketplace) et les actions billing (subscribe,
 * cancel, billing-portal) portent @Roles('owner','admin'). Les writes équipe/
 * webhook/domaine gardent leur check manuel (déjà fail-closed).
 */
@Controller('tenant-portal')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class TenantPortalController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly entitlements: LiriEntitlementsService,
  ) {}

  private get db(): any {
    return this.supabase.client as any;
  }

  // NB : la gestion des clés API tenant est servie par TenantApiKeyController
  // (`/tenants/api-keys` GET/POST/DELETE, rôle owner/admin) — pas de doublon ici.

  /** Catalogue Cimolace souscriptible + ce que le tenant a déjà. */
  @Get('marketplace')
  @Roles('owner', 'admin')
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
  @Roles('owner', 'admin')
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
  @Roles('owner', 'admin')
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
  // RÉSILIATION SELF-SERVE (§11) — politique unique = FIN DE PÉRIODE : l'accès est conservé
  // jusqu'à current_period_end (aucun remboursement), puis l'abo expire (le cron de
  // renouvellement mobile-money saute les résiliés). Réversible tant que la période court.
  /**
   * Propage la (dé)programmation de fin de période à un VRAI abonnement récurrent Stripe
   * (id `sub_…`). Sinon (plans inline / mobile money : pas de sub_id) le flag local + le saut
   * du cron suffisent. Best-effort : n'échoue jamais la résiliation locale.
   */
  private async setStripeCancelAtPeriodEnd(provider?: string, subId?: string, cancel = true): Promise<void> {
    if (provider !== 'stripe' || !subId || !subId.startsWith('sub_') || !process.env.STRIPE_SECRET_KEY) return;
    try {
      const auth = `Bearer ${process.env.STRIPE_SECRET_KEY}`;
      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
        method: 'POST',
        headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `cancel_at_period_end=${cancel ? 'true' : 'false'}`,
      });
      if (!res.ok) console.error(`[tenant-portal cancel] Stripe ${subId} → ${res.status}`);
    } catch (e) {
      console.error(`[tenant-portal cancel] Stripe ${subId} exception: ${(e as Error).message}`);
    }
  }

  @Post('subscriptions/:id/cancel')
  @Roles('owner', 'admin')
  async cancelSub(@Req() req: any, @Param('id') id: string, @Body() body: { reason?: string }) {
    const { data: sub } = await this.db
      .from('billing_subscriptions')
      .select('id, tenant_id, provider, provider_subscription_id, current_period_end, metadata')
      .eq('id', id).maybeSingle();
    if (!sub || sub.tenant_id !== req.tenant.id) throw new NotFoundException('Abonnement introuvable pour ce tenant');
    // Propage à Stripe pour un vrai abo récurrent (sinon prélèvements continus + accès jamais coupé).
    await this.setStripeCancelAtPeriodEnd(sub.provider, sub.provider_subscription_id, true);
    const meta = { ...(sub.metadata || {}), cancel_at_period_end: true, cancel_requested_at: new Date().toISOString() };
    if (body?.reason) meta.cancel_reason = String(body.reason).slice(0, 500);
    if (req.user?.email || req.user?.id) meta.canceled_by = req.user?.email ?? req.user?.id;
    const { data, error } = await this.db
      .from('billing_subscriptions')
      .update({ metadata: meta, updated_at: new Date().toISOString() })
      .eq('id', id).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return { data: { ...data, cancel_at_period_end: true, effective_until: sub.current_period_end ?? null } };
  }

  /** Annule la résiliation programmée tant que la période court. */
  @Post('subscriptions/:id/reactivate')
  @Roles('owner', 'admin')
  async reactivateSub(@Req() req: any, @Param('id') id: string) {
    const { data: sub } = await this.db
      .from('billing_subscriptions')
      .select('id, tenant_id, provider, provider_subscription_id, metadata')
      .eq('id', id).maybeSingle();
    if (!sub || sub.tenant_id !== req.tenant.id) throw new NotFoundException('Abonnement introuvable pour ce tenant');
    await this.setStripeCancelAtPeriodEnd(sub.provider, sub.provider_subscription_id, false);
    const meta = { ...(sub.metadata || {}) };
    delete meta.cancel_at_period_end; delete meta.cancel_requested_at; delete meta.cancel_reason;
    meta.reactivated_at = new Date().toISOString();
    const { data, error } = await this.db
      .from('billing_subscriptions')
      .update({ metadata: meta, updated_at: new Date().toISOString() })
      .eq('id', id).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return { data: { ...data, cancel_at_period_end: false } };
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
  @Roles('owner', 'admin')
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

  /**
   * Annuaire messagerie — LISIBLE PAR TOUT MEMBRE actif (pas de @Roles ; reste
   * borné par JwtAuthGuard + TenantGuard = membership active + scope tenant).
   * Distinct de `members` (owner/admin, gestion d'équipe : annuaire complet + emails).
   *
   * Rôle-aware & fail-fermé côté vie privée :
   *  - Le STAFF (owner/admin/teacher/secretariat) voit TOUS les membres (il enseigne /
   *    encadre) et reçoit les emails (comme `members`).
   *  - Un NON-staff (student/member/viewer…) ne voit QUE le staff joignable — jamais
   *    l'annuaire des pairs. On ne fuit donc AUCUN email d'élève à un autre élève.
   *
   * Sert le sélecteur de destinataire de la messagerie (MessagingContext) : un élève
   * doit pouvoir écrire à son/ses formateur(s) SANS recevoir 403 sur `members`
   * (même classe de bug que le menu école, cf. tenant-services gardé owner/admin).
   */
  @Get('directory')
  async directory(@Req() req: any) {
    // Rôles STAFF = joignables par tous + voient tout le monde. Volontairement LARGE
    // (couvre école ET clinique MEDOS) mais N'INCLUT JAMAIS les rôles « end-user »
    // pairs (student, patient, member, viewer) — eux ne voient QUE le staff.
    const STAFF = new Set([
      'owner', 'admin', 'teacher', 'practitioner', 'clinic_admin', 'receptionist', 'secretariat',
    ]);
    const viewerIsStaff = STAFF.has(req.tenant?.userRole);
    const { data: memberships } = await this.db
      .from('tenant_memberships')
      .select('user_id, role, status, created_at')
      .eq('tenant_id', req.tenant.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true });
    let rows = memberships ?? [];
    // Non-staff : ne voit que le staff joignable (pas les pairs).
    if (!viewerIsStaff) rows = rows.filter((m: any) => STAFF.has(m.role));
    const ids = rows.map((m: any) => m.user_id).filter(Boolean);
    let profiles: any[] = [];
    if (ids.length) {
      const { data } = await this.db.from('profiles').select('id, email, full_name').in('id', ids);
      profiles = data ?? [];
    }
    const byId: Record<string, any> = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
    return {
      data: rows.map((m: any) => {
        // Email exposé au staff (annuaire complet) OU quand le membre listé est du
        // staff (contact officiel joignable par l'élève). Jamais l'email d'un pair élève.
        const exposeEmail = viewerIsStaff || STAFF.has(m.role);
        return {
          user_id: m.user_id,
          role: m.role,
          status: m.status,
          email: exposeEmail ? (byId[m.user_id]?.email ?? null) : null,
          full_name: byId[m.user_id]?.full_name ?? null,
        };
      }),
    };
  }

  // PLAFOND D'OFFRE (monétisation) : « seat » = membre d'équipe (tout SAUF élève/patient/visiteur).
  private static isSeatRole(role?: string) {
    return !!role && !['student', 'patient', 'visitor'].includes(String(role).toLowerCase());
  }
  /** Lève 403 si le tenant a déjà atteint son plafond de sièges. À appeler AVANT d'ajouter un siège. */
  private async assertSeatCap(tenantId: string) {
    const { count } = await this.db
      .from('tenant_memberships')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .not('role', 'in', '("student","patient","visitor")');
    await this.entitlements.assertWithinCap(tenantId, 'seats', count ?? 0);
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
      .select('id, role, status')
      .eq('tenant_id', req.tenant.id)
      .eq('user_id', prof.id)
      .maybeSingle();
    // Cap sièges : bloque quand on AJOUTE un siège — nouveau membre, OU réactivation/promotion
    // d'un membership existant qui n'était pas déjà un siège actif (sinon contournement du cap).
    const wasActiveSeat = existing?.status === 'active' && TenantPortalController.isSeatRole(existing?.role);
    if (TenantPortalController.isSeatRole(role) && !wasActiveSeat) {
      await this.assertSeatCap(req.tenant.id);
    }
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
    // Cap sièges : une PROMOTION d'un rôle non-siège vers un rôle siège consomme un siège.
    const { data: cur } = await this.db
      .from('tenant_memberships').select('role, status')
      .eq('tenant_id', req.tenant.id).eq('user_id', userId).maybeSingle();
    const wasActiveSeat = cur?.status === 'active' && TenantPortalController.isSeatRole(cur?.role);
    if (TenantPortalController.isSeatRole(role) && !wasActiveSeat) {
      await this.assertSeatCap(req.tenant.id);
    }
    await this.db.from('tenant_memberships').update({ role }).eq('tenant_id', req.tenant.id).eq('user_id', userId);
    return { data: { ok: true, role } };
  }

  /**
   * Ouvre le portail de facturation Stripe (gérer carte, factures, annulation)
   * pour le client Stripe du tenant. Renvoie l'URL de la session.
   */
  @Post('billing-portal')
  @Roles('owner', 'admin')
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
  @Roles('owner', 'admin')
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

  // ─── Domaine personnalisé (self-service owner) ────────────────────────────
  // Le tenant branche SON domaine (ex. academy-ngowazulu.com) : ses élèves
  // atterrissent sur SA vitrine brandée (résolution host→tenant via
  // tenant_domains + GET /tenants/by-host — cf. tenantResolver front).
  // Flux façon Vercel/Stripe : add (pending) → le client pose les 2 DNS →
  // verify (check DNS réel) → attach Vercel (SSL auto) → active + embed_origin
  // (CORS). Owner/admin uniquement — contrairement à l'endpoint opérateur
  // /admin/tenants/:id/domains (CimolaceStaffGuard), celui-ci est self-service.

  /** Enregistrements DNS que le client doit poser chez son registrar. */
  private static readonly DNS_EXPECTED = {
    apexA: '76.76.21.21',
    cname: 'cname.vercel-dns.com',
  } as const;

  /** Hôtes qu'un tenant ne peut PAS revendiquer (plateforme + infra). */
  private static readonly RESERVED_DOMAIN_SUFFIXES = [
    'cimolace.space',
    'vercel.app',
    'vercel-dns.com',
    'supabase.co',
    'railway.app',
    'localhost',
  ];

  private normalizeDomain(raw?: string): string {
    const d = String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/\.+$/, '');
    // Hostname DNS plausible (labels alphanum/tirets, un point minimum).
    if (!/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/.test(d)) {
      throw new BadRequestException('Domaine invalide — attendu : mon-ecole.com (sans http:// ni chemin).');
    }
    for (const suffix of TenantPortalController.RESERVED_DOMAIN_SUFFIXES) {
      if (d === suffix || d.endsWith('.' + suffix)) {
        throw new BadRequestException(`Ce domaine est réservé à la plateforme (${suffix}).`);
      }
    }
    return d;
  }

  /** Le DNS du domaine pointe-t-il vers Vercel ? (A apex OU CNAME) */
  private async dnsPointsToVercel(domain: string): Promise<{ ok: boolean; observed: string }> {
    const { apexA, cname } = TenantPortalController.DNS_EXPECTED;
    try {
      const cnames = await resolveCname(domain).catch(() => [] as string[]);
      if (cnames.some((c) => String(c).toLowerCase().replace(/\.$/, '').endsWith(cname))) {
        return { ok: true, observed: `CNAME ${cnames.join(', ')}` };
      }
      const ips = await resolve4(domain).catch(() => [] as string[]);
      if (ips.includes(apexA)) return { ok: true, observed: `A ${ips.join(', ')}` };
      const observed = [
        cnames.length ? `CNAME ${cnames.join(', ')}` : '',
        ips.length ? `A ${ips.join(', ')}` : '',
      ].filter(Boolean).join(' · ');
      return { ok: false, observed: observed || 'aucun enregistrement résolu (propagation en cours ?)' };
    } catch (e) {
      return { ok: false, observed: `résolution DNS impossible (${(e as Error).message})` };
    }
  }

  /**
   * Attache le domaine au projet Vercel `app` (SSL auto). Best-effort : sans
   * VERCEL_TOKEN on n'échoue pas (l'opérateur peut attacher à la main) ; 409 =
   * déjà attaché (idempotent). Patron : signup.service provisionPatientSubdomain.
   */
  private async attachDomainToVercel(domain: string): Promise<{ attached: boolean; note: string }> {
    const token = process.env.VERCEL_TOKEN;
    if (!token) return { attached: false, note: 'VERCEL_TOKEN absent — attachement Vercel à faire côté opérateur.' };
    const projectId = process.env.VERCEL_APP_PROJECT_ID || 'prj_Ytxn7g7wLgvZEmBUXf7phfSxYGJX';
    const teamId = process.env.VERCEL_TEAM_ID || 'team_88680YTZRMqaKYKSg6anHLBZ';
    try {
      const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains?teamId=${teamId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: domain }),
      });
      if (res.ok || res.status === 409) return { attached: true, note: res.status === 409 ? 'déjà attaché (ok)' : 'attaché — certificat SSL en cours d’émission' };
      const body = await res.text().catch(() => '');
      return { attached: false, note: `Vercel ${res.status} : ${body.slice(0, 160)}` };
    } catch (e) {
      return { attached: false, note: `Vercel injoignable : ${(e as Error).message}` };
    }
  }

  /** Domaines du tenant + instructions DNS (pour l'onglet « Domaine »). */
  @Get('domains')
  @Roles('owner', 'admin')
  async listDomains(@Req() req: any) {
    const { data } = await this.db
      .from('tenant_domains')
      .select('id, domain, usage, status, verified_at, created_at')
      .eq('tenant_id', req.tenant.id)
      .eq('usage', 'custom_host')
      .order('created_at', { ascending: false });
    return { data: { domains: data ?? [], dns: TenantPortalController.DNS_EXPECTED } };
  }

  /** Déclare un domaine (status=pending) + tente l'attachement Vercel. Owner/admin. */
  @Post('domains')
  async addDomain(@Req() req: any, @Body() body: { domain?: string }) {
    if (!['owner', 'admin'].includes(req.tenant?.userRole)) throw new BadRequestException('Rôle owner/admin requis.');
    // P5 — offre HÉBERGÉE : pas de domaine personnalisé (réservé Customisé/Intégration).
    const { data: tRow } = await this.db.from('tenants').select('metadata').eq('id', req.tenant.id).maybeSingle();
    if ((tRow as any)?.metadata?.hosting_mode === 'hosted') {
      throw new BadRequestException('Domaine personnalisé réservé aux offres Customisé et Intégration.');
    }
    const domain = this.normalizeDomain(body?.domain);
    // Déjà revendiqué par un AUTRE tenant → erreur claire (UNIQUE(domain,usage) en filet).
    const { data: existing } = await this.db
      .from('tenant_domains')
      .select('id, tenant_id, status')
      .eq('domain', domain)
      .eq('usage', 'custom_host')
      .maybeSingle();
    if (existing && existing.tenant_id !== req.tenant.id) {
      throw new BadRequestException('Ce domaine est déjà relié à une autre organisation.');
    }
    let row = existing;
    if (!row) {
      const { data, error } = await this.db
        .from('tenant_domains')
        .insert({
          tenant_id: req.tenant.id,
          domain,
          usage: 'custom_host',
          status: 'pending',
          verify_token: `dv_${randomBytes(12).toString('hex')}`,
          created_by: req.user?.id ?? null,
        })
        .select('id, domain, status, created_at')
        .single();
      if (error) throw new BadRequestException(error.message);
      row = data;
    }
    // Attachement Vercel immédiat (idempotent) : le domaine sert dès que le DNS pointe.
    const vercel = await this.attachDomainToVercel(domain);
    return { data: { ...row, dns: TenantPortalController.DNS_EXPECTED, vercel } };
  }

  /** Vérifie le DNS ; si OK → active + ligne CORS embed_origin. Owner/admin. */
  @Post('domains/:id/verify')
  async verifyDomain(@Req() req: any, @Param('id') id: string) {
    if (!['owner', 'admin'].includes(req.tenant?.userRole)) throw new BadRequestException('Rôle owner/admin requis.');
    const { data: row } = await this.db
      .from('tenant_domains')
      .select('id, domain, status')
      .eq('id', id)
      .eq('tenant_id', req.tenant.id)
      .eq('usage', 'custom_host')
      .maybeSingle();
    if (!row) throw new NotFoundException('Domaine introuvable');
    const dns = await this.dnsPointsToVercel(row.domain);
    if (!dns.ok) {
      return { data: { id: row.id, domain: row.domain, status: row.status, verified: false, dnsObserved: dns.observed, dns: TenantPortalController.DNS_EXPECTED } };
    }
    const vercel = await this.attachDomainToVercel(row.domain);
    const now = new Date().toISOString();
    await this.db
      .from('tenant_domains')
      .update({ status: 'active', verified_at: now, ssl_status: vercel.attached ? 'provisioning' : null, updated_at: now })
      .eq('id', row.id);
    // CORS : l'Origin du domaine doit être whitelisté (main.ts loadTenantDomains lit embed_origin).
    await this.db
      .from('tenant_domains')
      .upsert(
        { tenant_id: req.tenant.id, domain: row.domain, usage: 'embed_origin', status: 'active', created_by: req.user?.id ?? null },
        { onConflict: 'domain,usage' },
      );
    return { data: { id: row.id, domain: row.domain, status: 'active', verified: true, dnsObserved: dns.observed, vercel } };
  }

  /** Retire un domaine (custom_host + sa ligne CORS). Owner/admin. */
  @Delete('domains/:id')
  async deleteDomain(@Req() req: any, @Param('id') id: string) {
    if (!['owner', 'admin'].includes(req.tenant?.userRole)) throw new BadRequestException('Rôle owner/admin requis.');
    const { data: row } = await this.db
      .from('tenant_domains')
      .select('id, domain')
      .eq('id', id)
      .eq('tenant_id', req.tenant.id)
      .eq('usage', 'custom_host')
      .maybeSingle();
    if (!row) throw new NotFoundException('Domaine introuvable');
    await this.db.from('tenant_domains').delete().eq('id', row.id);
    await this.db
      .from('tenant_domains')
      .delete()
      .eq('tenant_id', req.tenant.id)
      .eq('domain', row.domain)
      .eq('usage', 'embed_origin');
    return { data: { ok: true } };
  }
}
