/**
 * BillingAdvancedService — port des 23 lambdas v1 `netlify/functions/billing-*`.
 *
 * Portée :
 *   - Toute la logique Supabase (lecture/écriture tables billing_*) est portée.
 *   - Les intégrations provider externes (Stripe SDK, PayPal OAuth, Chariow HMAC,
 *     NowPayments HMAC, CinetPay token) sont marquées TODO et renvoient des
 *     réponses neutres en attendant le port complet des helper libs
 *     `netlify/functions/_lib/payments/*` et `_lib/billing/*`.
 *   - L'objectif immédiat est d'exposer les 23 routes attendues côté v2 et de
 *     préserver les données quand l'intégration provider est encore en stub.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';

type AnyObj = Record<string, any>;

@Injectable()
export class BillingAdvancedService {
  private readonly logger = new Logger(BillingAdvancedService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService,
  ) {}

  private get sb(): any {
    return this.supabase.client as any;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INVOICES — billing-my-invoices, billing-invoice-download, billing-resend-invoice
  // ═══════════════════════════════════════════════════════════════════════════

  async listMyInvoices(userId: string | undefined) {
    if (!userId) throw new UnauthorizedException('Authentication required');

    const { data: payments, error } = await this.sb
      .from('billing_payments')
      .select(
        'id,order_id,price_amount,price_currency,payment_method,payment_status,paid_at,created_at,purchase_type,payment_type,formation_title,billing_plans(name,interval_type)',
      )
      .eq('user_id', userId)
      .eq('payment_status', 'confirmed')
      .order('paid_at', { ascending: false })
      .limit(50);

    if (error) throw new BadRequestException(error.message);

    const invoices = (payments ?? []).map((p: AnyObj) => ({
      paymentId: p.id,
      orderId: p.order_id,
      invoiceNumber: this.buildInvoiceNumber(p.id || p.order_id, p.paid_at),
      amount: p.price_amount,
      currency: p.price_currency || 'XAF',
      paymentMethod: p.payment_method,
      paidAt: p.paid_at || p.created_at,
      purchaseType: p.purchase_type || p.payment_type,
      formationTitle: p.formation_title || null,
      planName: p.billing_plans?.name || null,
      planInterval: p.billing_plans?.interval_type || null,
    }));

    return { invoices };
  }

  async renderInvoiceHtml(
    userId: string | undefined,
    paymentId: string,
  ): Promise<{ html: string; filename: string }> {
    if (!userId) throw new UnauthorizedException('Authentication required');
    if (!paymentId) throw new BadRequestException('paymentId is required');

    const { data: payment } = await this.sb
      .from('billing_payments')
      .select('*, billing_plans(name,interval_type)')
      .eq('id', paymentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!payment) throw new NotFoundException('Facture introuvable ou accès refusé');
    if (String(payment.payment_status ?? '').toLowerCase() !== 'confirmed') {
      throw new BadRequestException('Cette facture ne correspond pas à un paiement confirmé');
    }

    const { data: profile } = await this.sb
      .from('profiles')
      .select('name, email')
      .eq('id', userId)
      .maybeSingle();

    const invoiceNumber = this.buildInvoiceNumber(payment.id || payment.order_id, payment.paid_at);
    const amount = payment.price_amount ?? payment.amount;
    const currency = payment.price_currency || payment.currency || 'XAF';
    const customerName = profile?.name || profile?.email || 'Client';
    const html = this.simpleInvoiceHtml({
      invoiceNumber,
      paymentId: payment.id,
      orderId: payment.order_id,
      paidAt: payment.paid_at || payment.updated_at || new Date().toISOString(),
      amount,
      currency,
      paymentMethod: payment.payment_method,
      planName: payment.billing_plans?.name,
      customerName,
    });
    const filename = `facture-${String(payment.order_id || payment.id).slice(0, 12)}.html`;
    return { html, filename };
  }

  async resendInvoice(userId: string | undefined, paymentId: string) {
    if (!userId) throw new UnauthorizedException('Authentication required');
    if (!paymentId) throw new BadRequestException('paymentId is required');

    const { data: actor } = await this.sb
      .from('profiles')
      .select('role,name,email')
      .eq('id', userId)
      .maybeSingle();

    const privileged = ['owner', 'admin', 'secretariat'].includes(String(actor?.role || ''));

    const { data: payment } = await this.sb
      .from('billing_payments')
      .select('*, billing_plans(name,interval_type)')
      .eq('id', paymentId)
      .maybeSingle();

    if (!payment) throw new NotFoundException('Paiement introuvable');
    if (String(payment.payment_status ?? '').toLowerCase() !== 'confirmed') {
      throw new BadRequestException('Seuls les paiements confirmés ont une facture');
    }
    if (!privileged && payment.user_id !== userId) {
      throw new ForbiddenException('Accès refusé');
    }

    const COOLDOWN_MS = 24 * 60 * 60 * 1000;
    const lastEmailed = payment.invoice_last_emailed_at || payment.invoice_sent_at;
    if (!privileged && lastEmailed) {
      const elapsed = Date.now() - new Date(lastEmailed).getTime();
      if (elapsed < COOLDOWN_MS) {
        const retryAfterMs = COOLDOWN_MS - elapsed;
        return {
          ok: false,
          error: 'Trop tôt pour un nouveau renvoi',
          retryAfterMs,
          retryAfterHours: Math.ceil(retryAfterMs / (60 * 60 * 1000)),
        };
      }
    }

    // TODO: brancher EmailEngine (Resend) pour envoyer réellement la facture.
    // Pour l'instant on marque seulement le timestamp.
    const now = new Date().toISOString();
    const invoiceNumber = this.buildInvoiceNumber(payment.id, payment.paid_at);
    await this.sb
      .from('billing_payments')
      .update({ invoice_last_emailed_at: now, invoice_sent_at: payment.invoice_sent_at || now })
      .eq('id', paymentId);

    return { ok: true, invoiceNumber, queued: true };
  }

  async backfillInvoices(input: { token?: string; limit?: string; dryRun?: boolean }) {
    const expected = String(this.config.get('BILLING_BACKFILL_TOKEN') || '').trim();
    if (!expected) {
      return { error: 'BILLING_BACKFILL_TOKEN is not configured', status: 503 };
    }
    if (String(input.token ?? '').trim() !== expected) {
      throw new UnauthorizedException('Unauthorized');
    }

    const limit = input.limit && input.limit !== 'all' ? Number(input.limit) : null;

    let q = this.sb
      .from('billing_payments')
      .select(
        'id,user_id,order_id,price_amount,price_currency,payment_method,paid_at,billing_plans(name,interval_type)',
      )
      .eq('payment_status', 'confirmed')
      .or('invoice_sent_at.is.null,invoice_student_not_received_at.not.is.null')
      .order('id', { ascending: true });

    if (limit && Number.isFinite(limit) && limit > 0) q = q.limit(limit);

    const { data: rows, error } = await q;
    if (error) throw new BadRequestException(error.message);

    let sent = 0;
    const failed: AnyObj[] = [];
    for (const p of rows ?? []) {
      if (input.dryRun) {
        sent++;
        continue;
      }
      // TODO: dispatchInvoiceEmailForPayment via EmailEngine.
      const { error: upErr } = await this.sb
        .from('billing_payments')
        .update({ invoice_sent_at: new Date().toISOString() })
        .eq('id', p.id);
      if (upErr) failed.push({ paymentId: p.id, reason: upErr.message });
      else sent++;
    }
    return { ok: true, dryRun: !!input.dryRun, scanned: (rows ?? []).length, sent, failed };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LICENSE — billing-activate-license
  // ═══════════════════════════════════════════════════════════════════════════

  async activateLicense(userId: string | undefined, licenseKey: string) {
    if (!userId) throw new UnauthorizedException();
    if (!licenseKey?.trim()) throw new BadRequestException('licenseKey is required');

    const { data: payment } = await this.sb
      .from('billing_payments')
      .select('*, billing_plans(*)')
      .eq('provider', 'chariow')
      .eq('provider_license_key', licenseKey.trim())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!payment) throw new NotFoundException('Licence introuvable');
    if (payment.user_id !== userId) {
      throw new ForbiddenException("Cette licence n'appartient pas à ce compte");
    }

    await this.sb
      .from('billing_payments')
      .update({
        license_activation_attempts: Number(payment.license_activation_attempts || 0) + 1,
      })
      .eq('id', payment.id);

    if (String(payment.payment_status ?? '').toLowerCase() !== 'confirmed') {
      return {
        ok: false,
        error: 'Paiement non confirmé pour cette licence',
        paymentStatus: payment.payment_status,
        status: 409,
      };
    }

    // Active la souscription depuis le paiement (logique simplifiée).
    const plan = payment.billing_plans;
    const expiresAt = this.computeExpiry(plan?.interval_type);
    const { data: sub, error: subErr } = await this.sb
      .from('billing_subscriptions')
      .upsert(
        {
          user_id: userId,
          plan_id: plan?.id,
          status: 'active',
          provider: 'chariow',
          payment_method: 'chariow',
          started_at: new Date().toISOString(),
          expires_at: expiresAt,
          activation_source: 'manual_license',
        },
        { onConflict: 'user_id,plan_id' },
      )
      .select('*')
      .single();

    if (subErr || !sub?.id) {
      throw new BadRequestException("Impossible d'activer l'abonnement avec cette licence");
    }

    await this.sb
      .from('billing_payments')
      .update({
        license_activated_at: new Date().toISOString(),
        subscription_id: sub.id,
      })
      .eq('id', payment.id);

    return { ok: true, subscription: sub, payment: { id: payment.id, license_activated_at: new Date().toISOString() } };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKOUT — billing-create-payment (+ initial/renewal wrappers)
  // ═══════════════════════════════════════════════════════════════════════════

  async createPayment(userId: string | undefined, body: AnyObj) {
    if (!userId) throw new UnauthorizedException();
    const paymentType = String(body?.paymentType || 'initial');
    const planId = body?.planId ?? null;
    const subscriptionId = body?.subscriptionId ?? null;
    const provider = String(body?.provider || 'chariow').toLowerCase();
    const paymentMethod = String(body?.paymentMethod || provider);

    if (paymentType === 'initial' && !planId) throw new BadRequestException('planId required');
    if (paymentType === 'renewal' && !subscriptionId) {
      throw new BadRequestException('subscriptionId required');
    }

    const { data: plan } = planId
      ? await this.sb.from('billing_plans').select('*').eq('id', planId).maybeSingle()
      : { data: null };

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const { data: payment, error } = await this.sb
      .from('billing_payments')
      .insert({
        user_id: userId,
        subscription_id: subscriptionId,
        plan_id: plan?.id ?? null,
        provider,
        payment_method: paymentMethod,
        payment_type: paymentType,
        order_id: orderId,
        payment_status: 'pending',
        price_amount: plan?.price_amount ?? body?.amount ?? null,
        price_currency: String(plan?.price_currency || body?.currency || 'XAF').toUpperCase(),
      })
      .select('*')
      .single();

    if (error) throw new BadRequestException(error.message);

    // TODO: appeler le provider (Chariow / Stripe / PayPal / NowPayments / CinetPay)
    // pour créer la session de checkout réelle et récupérer payment_url + provider_payment_id.
    return {
      ok: true,
      payment,
      checkout: {
        url: null,
        provider,
        note: 'Provider checkout creation TODO — return stored payment row for now.',
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS — billing-payment-status, billing-subscription-status
  // ═══════════════════════════════════════════════════════════════════════════

  async getPaymentStatus(userId: string | undefined, id: string) {
    if (!userId) throw new UnauthorizedException();
    if (!id) throw new BadRequestException('Missing id');

    const { data: payment } = await this.sb
      .from('billing_payments')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.user_id !== userId) throw new ForbiddenException('Forbidden');

    // TODO: refresh provider-side status for nowpayments / chariow if pending.
    return { payment };
  }

  async getSubscriptionStatus(userId: string | undefined) {
    if (!userId) throw new UnauthorizedException();

    // Schéma PROD réel : current_period_end (pas expires_at), plan_id = clé texte. Pas d'embed
    // billing_plans (plan_id n'est pas un FK uuid → l'embed PostgREST casserait la requête, ce qui
    // renvoyait jusqu'ici subscription:null et fermait l'accès à tort).
    const subscriptionSelect =
      'id,user_id,plan_id,status,provider,amount_cents,currency,current_period_start,current_period_end,created_at';

    let subscription: AnyObj | null = null;
    const { data: prio } = await this.sb
      .from('billing_subscriptions')
      .select(subscriptionSelect)
      .eq('user_id', userId)
      .in('status', ['active', 'past_due'])
      .order('current_period_end', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prio?.id) {
      subscription = prio;
    }

    // Billing TENANT-SCOPÉ : un abonnement du TENANT (souvent `user_id = null`,
    // posé par le checkout tenant / webhook Stripe) débloque TOUS ses membres.
    // L'ancienne résolution par seul `user_id` ne le voyait pas → le tenant
    // payant (ex : zahirwellness, forfait 150 €/mois) retombait à tort en tier
    // GRATUIT (live coupé à 3 min). On résout donc le(s) tenant(s) du user via
    // `tenant_memberships` et on prend l'abonnement ACTIF du tenant — prioritaire
    // sur un éventuel sub user annulé.
    if (!subscription) {
      const { data: mems } = await this.sb
        .from('tenant_memberships')
        .select('tenant_id')
        .eq('user_id', userId);
      const tenantIds = [
        ...new Set(((mems as AnyObj[]) || []).map((m) => m.tenant_id).filter(Boolean)),
      ];
      if (tenantIds.length) {
        const { data: tenantSub } = await this.sb
          .from('billing_subscriptions')
          .select(subscriptionSelect)
          .in('tenant_id', tenantIds)
          .in('status', ['active', 'past_due'])
          .order('current_period_end', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (tenantSub?.id) subscription = tenantSub;
      }
    }

    // Dernier recours : le sub user le plus récent (toute statut) pour conserver
    // l'historique (renewalLink, paiements) si rien d'actif n'a été trouvé.
    if (!subscription) {
      const { data: fallback } = await this.sb
        .from('billing_subscriptions')
        .select(subscriptionSelect)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      subscription = fallback || null;
    }

    const computed = this.computeSubscriptionState(subscription);

    let activeRenewalLink: AnyObj | null = null;
    if (subscription?.id) {
      const { data: link } = await this.sb
        .from('billing_renewal_links')
        .select('id,checkout_url,expires_at,status,created_at')
        .eq('subscription_id', subscription.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (link?.checkout_url) {
        const expiresMs = link.expires_at ? new Date(link.expires_at).getTime() : null;
        if (!expiresMs || expiresMs > Date.now()) activeRenewalLink = link;
      }
    }

    const { data: recentPayments } = await this.sb
      .from('billing_payments')
      .select(
        'id,payment_type,payment_status,provider,payment_method,price_amount,price_currency,created_at,paid_at,provider_checkout_url,payment_url,provider_invoice_url,provider_invoice_number,provider_license_key,provider_license_expires_at,license_activated_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8);

    const { data: licensePayment } = await this.sb
      .from('billing_payments')
      .select(
        'id,provider_license_key,payment_status,provider_license_expires_at,license_activated_at,created_at',
      )
      .eq('user_id', userId)
      .eq('provider', 'chariow')
      .not('provider_license_key', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const canActivateByLicense =
      String(licensePayment?.payment_status ?? '').toLowerCase() === 'confirmed' &&
      !licensePayment?.license_activated_at;

    return {
      subscription,
      computed,
      activeRenewalLink,
      recentPayments: recentPayments || [],
      licenseActivation: {
        canActivateByLicense,
        paymentId: licensePayment?.id || null,
        providerLicenseKey: licensePayment?.provider_license_key || null,
        providerLicenseExpiresAt: licensePayment?.provider_license_expires_at || null,
      },
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CRON — billing-expire-subscriptions, billing-run-renewal-cycle
  // ═══════════════════════════════════════════════════════════════════════════

  async expireSubscriptionsCron(input: { key?: string; batch?: string }) {
    this.ensureInternalKey(input.key);

    const nowMs = Date.now();
    const nowIso = new Date().toISOString();
    const graceDays = Number(this.config.get('BILLING_GRACE_DAYS') || 0);

    const { data: subs } = await this.sb
      .from('billing_subscriptions')
      .select('id,user_id,status,expires_at,grace_ends_at')
      .in('status', ['active', 'past_due'])
      .not('expires_at', 'is', null)
      .order('id', { ascending: true })
      .limit(input.batch ? Number(input.batch) : 1000);

    let markedPastDue = 0;
    let markedExpired = 0;

    for (const sub of subs ?? []) {
      const expMs = sub.expires_at ? new Date(sub.expires_at).getTime() : null;
      if (!expMs || expMs > nowMs) continue;
      const graceEndsAt =
        sub.grace_ends_at ?? new Date(expMs + graceDays * 86_400_000).toISOString();
      const graceMs = new Date(graceEndsAt).getTime();

      if (sub.status === 'active' && nowMs <= graceMs) {
        await this.sb
          .from('billing_subscriptions')
          .update({ status: 'past_due', grace_ends_at: graceEndsAt, reminder_stage: 'expired' })
          .eq('id', sub.id);
        markedPastDue++;
      } else if (nowMs > graceMs) {
        await this.sb
          .from('billing_subscriptions')
          .update({ status: 'expired', grace_ends_at: graceEndsAt, reminder_stage: 'expired' })
          .eq('id', sub.id);
        markedExpired++;
      }
    }

    const { data: expiredLinks } = await this.sb
      .from('billing_renewal_links')
      .select('id')
      .eq('status', 'active')
      .lt('expires_at', nowIso);
    const ids = (expiredLinks ?? []).map((r: AnyObj) => r.id);
    if (ids.length) {
      await this.sb.from('billing_renewal_links').update({ status: 'expired' }).in('id', ids);
    }

    return { ok: true, markedPastDue, markedExpired, linksExpired: ids.length };
  }

  async runRenewalCycleCron(input: { key?: string; batch?: string }) {
    this.ensureInternalKey(input.key);

    const now = new Date();
    const nowMs = now.getTime();

    const { data: subs } = await this.sb
      .from('billing_subscriptions')
      .select(
        'id,user_id,plan_id,status,expires_at,grace_ends_at,auto_renew_enabled,reminder_stage,cimolace_tenant_id',
      )
      .in('status', ['active', 'past_due', 'expired'])
      .eq('auto_renew_enabled', true)
      .not('expires_at', 'is', null)
      .order('id', { ascending: true })
      .limit(input.batch ? Number(input.batch) : 500);

    let remindersCreated = 0;
    const errors: string[] = [];

    for (const sub of subs ?? []) {
      try {
        const expMs = sub.expires_at ? new Date(sub.expires_at).getTime() : null;
        if (!expMs) continue;
        const diffDays = Math.ceil((expMs - nowMs) / 86_400_000);
        const reminderType =
          diffDays === 7 ? 'd7' : diffDays === 3 ? 'd3' : diffDays === 1 ? 'd1' : diffDays <= 0 ? 'expired' : null;
        if (!reminderType) continue;

        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);
        const { data: existing } = await this.sb
          .from('billing_subscription_reminders')
          .select('id')
          .eq('subscription_id', sub.id)
          .eq('reminder_type', reminderType)
          .gte('created_at', startOfDay.toISOString())
          .limit(1)
          .maybeSingle();
        if (existing?.id) continue;

        await this.sb.from('billing_subscription_reminders').insert({
          subscription_id: sub.id,
          user_id: sub.user_id,
          reminder_type: reminderType,
          channel: 'in_app',
          status: 'sent',
          scheduled_for: now.toISOString(),
          sent_at: now.toISOString(),
          metadata: { subscription_status: sub.status },
        });
        await this.sb
          .from('billing_subscriptions')
          .update({ reminder_stage: reminderType, last_reminder_sent_at: now.toISOString() })
          .eq('id', sub.id);
        remindersCreated++;
        // TODO: getOrCreateRenewalLink via Chariow checkout.
      } catch (err) {
        errors.push(String((err as Error)?.message ?? err));
      }
    }

    return { ok: true, processed: (subs ?? []).length, remindersCreated, errors: errors.slice(0, 20) };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TENANT CONFIG — get-tenant-billing-context, save-tenant-billing-preferences,
  //                 save-tenant-payment-accounts, payment-setup-assistant
  // ═══════════════════════════════════════════════════════════════════════════

  async getTenantBillingContext(t: TenantContext) {
    const { data: tenantRow } = await this.sb
      .from('cimolace_tenants')
      .select('id, slug, metadata, email')
      .eq('slug', t.slug)
      .maybeSingle();

    const metadata = tenantRow?.metadata && typeof tenantRow.metadata === 'object' ? tenantRow.metadata : {};
    const billing = (metadata.billing && typeof metadata.billing === 'object') ? metadata.billing : {};

    const { data: accounts } = await this.sb
      .from('tenant_payment_accounts')
      .select('id, provider_id, status, config, payment_providers(code)')
      .eq('tenant_id', tenantRow?.id ?? t.id);

    const providersConfigured: AnyObj = {};
    for (const a of accounts ?? []) {
      const code = a.payment_providers?.code ?? a.provider_id;
      providersConfigured[code] = a.status === 'active';
    }

    const base = String(this.config.get('APP_BASE_URL') || '').replace(/\/+$/, '');
    const slugEnc = encodeURIComponent(t.slug);
    const webhookUrls = {
      paypal: `${base}/billing/webhooks/paypal?tenant=${slugEnc}`,
      chariow: `${base}/billing/webhooks/chariow?tenant=${slugEnc}`,
      stripe: `${base}/billing/webhooks/stripe?tenant=${slugEnc}`,
    };
    const encConfigured = Boolean(String(this.config.get('BILLING_SECRETS_KEY') || '').trim());

    return {
      tenantSlug: t.slug,
      billing,
      providersConfigured,
      webhookUrls,
      platform: {
        billingSecretsKeyConfigured: encConfigured,
        paypalWebhookGloballyEnabled: this.config.get('BILLING_ENABLE_PAYPAL_WEBHOOK') === '1',
        stripeWebhookGloballyEnabled: this.config.get('BILLING_ENABLE_STRIPE_WEBHOOK') === '1',
      },
    };
  }

  async saveTenantBillingPreferences(t: TenantContext, patch: AnyObj) {
    const { data: tenantRow } = await this.sb
      .from('cimolace_tenants')
      .select('id, metadata')
      .eq('slug', t.slug)
      .maybeSingle();
    if (!tenantRow?.id) throw new NotFoundException('tenant_not_found');

    const metadata = tenantRow.metadata && typeof tenantRow.metadata === 'object' ? tenantRow.metadata : {};
    const nextMeta = { ...metadata, billing: { ...(metadata.billing || {}), ...patch } };

    const { error } = await this.sb
      .from('cimolace_tenants')
      .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
      .eq('id', tenantRow.id);
    if (error) throw new BadRequestException(error.message);

    return { ok: true, tenantSlug: t.slug, billing: nextMeta.billing };
  }

  async saveTenantPaymentAccount(
    t: TenantContext,
    body: { provider: string; status?: string; credentials?: Record<string, string>; publicConfig?: Record<string, string> },
  ) {
    const provider = String(body.provider || '').toLowerCase();
    const allowed = new Set(['chariow', 'stripe', 'paypal']);
    if (!allowed.has(provider)) throw new BadRequestException('invalid_provider');
    const status = String(body.status || 'active');
    if (!['active', 'disabled', 'pending'].includes(status)) {
      throw new BadRequestException('invalid_status');
    }

    const { data: tenantRow } = await this.sb
      .from('cimolace_tenants')
      .select('id')
      .eq('slug', t.slug)
      .maybeSingle();
    if (!tenantRow?.id) throw new NotFoundException('tenant_not_found');

    const { data: provRow } = await this.sb
      .from('payment_providers')
      .select('id')
      .ilike('code', provider)
      .maybeSingle();
    if (!provRow?.id) throw new BadRequestException('payment_provider_missing');

    // TODO: encryptTenantCredentials (AES-GCM via BILLING_SECRETS_KEY). On stocke
    // pour l'instant un placeholder afin de ne pas perdre le formulaire.
    const hasSecrets = body.credentials && Object.keys(body.credentials).length > 0;

    const row: AnyObj = {
      tenant_id: tenantRow.id,
      provider_id: provRow.id,
      status,
      config: body.publicConfig ?? {},
      updated_at: new Date().toISOString(),
    };
    if (hasSecrets) {
      row.encrypted_credentials = { _todo: 'aes-gcm-encrypt', keys: Object.keys(body.credentials!) };
    }

    const { data: upserted, error } = await this.sb
      .from('tenant_payment_accounts')
      .upsert(row, { onConflict: 'tenant_id,provider_id' })
      .select('id, status, config, updated_at')
      .maybeSingle();
    if (error) throw new BadRequestException(error.message);

    return { ok: true, tenantSlug: t.slug, provider, account: upserted, secretsUpdated: hasSecrets };
  }

  async paymentSetupAssistant(
    t: TenantContext,
    input: {
      message: string;
      stepId?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    },
  ) {
    const message = String(input.message || '').trim();
    if (!message || message.length > 8000) throw new BadRequestException('message invalide');

    const groqKey = String(this.config.get('GROQ_API_KEY') || '').trim();
    if (groqKey) {
      try {
        const SYSTEM = `Tu es le guide IA pour configurer les paiements (Chariow, Stripe, PayPal). Réponds en français, ne demande JAMAIS de clé secrète dans le chat.`;
        const messages = [
          { role: 'system', content: SYSTEM },
          ...((input.history ?? []).slice(-8).map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: String(m.content).slice(0, 4000),
          }))),
          { role: 'user', content: input.stepId ? `${message}\n(Étape: ${input.stepId})` : message },
        ];
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.config.get('GROQ_MODEL') || 'llama-3.3-70b-versatile',
            messages,
            temperature: 0.35,
            max_tokens: 900,
          }),
        });
        if (res.ok) {
          const data: AnyObj = await res.json();
          const out = data?.choices?.[0]?.message?.content?.trim();
          if (out) return { reply: out, source: 'groq' };
        }
      } catch (e) {
        this.logger.warn(`setup-assistant groq error: ${(e as Error).message}`);
      }
    }

    return {
      reply: this.assistantFallbackReply(message, input.stepId),
      source: 'fallback',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBHOOKS — stripe / paypal / chariow / cinetpay / nowpayments
  // Les vérifications de signature provider sont marquées TODO ; les routes
  // enregistrent l'événement dans billing_webhook_logs et la table d'idempotence.
  // ═══════════════════════════════════════════════════════════════════════════

  async handleStripeWebhook(input: { rawBody: string; signature: string; tenantSlug?: string }) {
    if (this.config.get('BILLING_ENABLE_STRIPE_WEBHOOK') !== '1') {
      return { ok: true, asleep: true, provider: 'stripe' };
    }
    // TODO: Stripe.webhooks.constructEvent + applyStripeWebhookToBilling.
    await this.logWebhook('stripe', input.tenantSlug, { signatureProvided: !!input.signature });
    return { received: true, todo: 'stripe-signature-verify-and-apply' };
  }

  async handlePaypalWebhook(input: {
    headers: Record<string, string>;
    payload: AnyObj;
    tenantSlug?: string;
  }) {
    if (this.config.get('BILLING_ENABLE_PAYPAL_WEBHOOK') !== '1') {
      return { ok: true, asleep: true, provider: 'paypal' };
    }
    if (!input.tenantSlug) throw new BadRequestException('missing_tenant');
    await this.logWebhook('paypal', input.tenantSlug, {
      event_type: input.payload?.event_type ?? null,
    });
    // TODO: paypalVerifyWebhookSignature + applyPaypalWebhookToBilling.
    return { received: true, id: input.payload?.id ?? null, todo: 'paypal-verify-and-apply' };
  }

  async handleChariowWebhook(input: {
    rawBody: string;
    payload: AnyObj;
    signature: string;
    tenantSlug?: string;
  }) {
    await this.logWebhook('chariow', input.tenantSlug, {
      hasSignature: !!input.signature,
    });
    // TODO: HMAC sha256 verify + applyChariowWebhookToBilling.
    return { received: true, todo: 'chariow-hmac-verify-and-apply' };
  }

  async chariowAttachExternal(input: { payload: AnyObj; tenantSlug?: string }) {
    // TODO: matching profile + activateSubscriptionFromPayment.
    await this.logWebhook('chariow', input.tenantSlug, { kind: 'attach-external' });
    return { received: true, todo: 'chariow-attach-external' };
  }

  async handleCinetpayWebhook(input: {
    rawBody: string;
    contentType: string;
    receivedToken: string;
    bodyParsed: AnyObj;
    tenantSlug?: string;
  }) {
    if (String(this.config.get('BILLING_ENABLE_CINETPAY') || '0') !== '1') {
      return { ok: true, asleep: true, provider: 'cinetpay' };
    }
    await this.logWebhook('cinetpay', input.tenantSlug, {
      cpm_trans_status: input.bodyParsed?.cpm_trans_status ?? null,
    });
    // TODO: verifyCinetPayToken + applyPaymentConfirmationEffects.
    return { ok: true, todo: 'cinetpay-verify-and-apply' };
  }

  async handleNowpaymentsWebhook(input: {
    rawBody: string;
    signature: string;
    payload: AnyObj;
    tenantSlug?: string;
  }) {
    if (String(this.config.get('BILLING_ENABLE_NOWPAYMENTS') || '0') !== '1') {
      return { ok: true, asleep: true, provider: 'nowpayments' };
    }
    await this.logWebhook('nowpayments', input.tenantSlug, {
      payment_status: input.payload?.payment_status ?? null,
    });
    // TODO: verifyNowPaymentsSignature + applyPaymentConfirmationEffects.
    return { ok: true, todo: 'nowpayments-verify-and-apply' };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DLQ — billing-process-webhook-dlq, billing-webhook-dlq-admin
  // ═══════════════════════════════════════════════════════════════════════════

  async processWebhookDlq(input: { key?: string }) {
    this.ensureInternalKey(input.key);
    const nowIso = new Date().toISOString();

    const { data: rows, error } = await this.sb
      .from('billing_webhook_dlq')
      .select('*')
      .eq('status', 'pending')
      .lte('next_retry_at', nowIso)
      .order('next_retry_at', { ascending: true });

    if (error) throw new BadRequestException(error.message);

    // TODO: rejouer via fetch() vers /billing/webhooks/<provider>. Pour l'instant,
    // on incrémente les attempts pour rendre la queue inspectable.
    let advanced = 0;
    for (const row of rows ?? []) {
      const next = (Number(row.attempts ?? 0) || 0) + 1;
      const backoffMs = 30_000 * 2 ** Math.min(next, 28);
      await this.sb
        .from('billing_webhook_dlq')
        .update({
          attempts: next,
          next_retry_at: new Date(Date.now() + backoffMs).toISOString(),
          updated_at: nowIso,
        })
        .eq('id', row.id);
      advanced++;
    }
    return { ok: true, scanned: (rows ?? []).length, advanced, todo: 'replay-via-http' };
  }

  async listWebhookDlq(input: { status?: string; limit?: string; offset?: string }) {
    const status = String(input.status || 'pending').toLowerCase();
    const limit = Math.min(200, Math.max(1, Number(input.limit) || 50));
    const offset = Math.max(0, Number(input.offset) || 0);

    let q = this.sb
      .from('billing_webhook_dlq')
      .select(
        'id,provider,event_id,attempts,max_attempts,next_retry_at,last_error,status,created_at,updated_at',
        { count: 'exact' },
      )
      .order('next_retry_at', { ascending: true });
    if (status && status !== 'all') q = q.eq('status', status);
    q = q.range(offset, offset + limit - 1);

    const { data: rows, error, count } = await q;
    if (error) throw new BadRequestException(error.message);
    return {
      items: rows ?? [],
      total: typeof count === 'number' ? count : (rows ?? []).length,
      limit,
      offset,
      statusFilter: status,
    };
  }

  async dlqAction(body: { action: string; id?: string; reason?: string; limit?: number }) {
    const action = String(body.action || '').toLowerCase();
    const nowIso = new Date().toISOString();

    if (action === 'retry_all_pending') {
      const cap = Math.min(500, Math.max(1, Number(body.limit) || 200));
      const { data: rows } = await this.sb
        .from('billing_webhook_dlq')
        .select('id')
        .eq('status', 'pending')
        .order('next_retry_at', { ascending: true })
        .limit(cap);
      const ids = (rows ?? []).map((r: AnyObj) => r.id);
      if (!ids.length) return { ok: true, action, updated: 0 };
      const { error } = await this.sb
        .from('billing_webhook_dlq')
        .update({ next_retry_at: nowIso, updated_at: nowIso })
        .in('id', ids);
      if (error) throw new BadRequestException(error.message);
      return { ok: true, action, updated: ids.length };
    }

    if (!body.id) throw new BadRequestException('id_required');

    if (action === 'retry_now') {
      await this.sb
        .from('billing_webhook_dlq')
        .update({ status: 'pending', next_retry_at: nowIso, updated_at: nowIso })
        .eq('id', body.id);
      return { ok: true, action, id: body.id };
    }
    if (action === 'mark_dead') {
      await this.sb
        .from('billing_webhook_dlq')
        .update({
          status: 'dead',
          last_error: String(body.reason || 'manual_dead').slice(0, 2000),
          updated_at: nowIso,
        })
        .eq('id', body.id);
      return { ok: true, action, id: body.id };
    }
    if (action === 'delete') {
      await this.sb.from('billing_webhook_dlq').delete().eq('id', body.id);
      return { ok: true, action, id: body.id };
    }

    throw new BadRequestException('unknown_action');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private ensureInternalKey(provided: string | undefined) {
    const expected = String(this.config.get('BILLING_INTERNAL_JOB_KEY') || '').trim();
    if (!expected) {
      // FAIL-CLOSED en production : sans clé configurée, ces crons (retries de
      // paiement, DLQ, réconciliation) seraient exposés publiquement → on REFUSE.
      // L'absence de clé n'est tolérée qu'en dev/test (audit 2026-07-03).
      const env = String(this.config.get('NODE_ENV') || process.env.NODE_ENV || '').toLowerCase();
      if (env === 'production' || env === 'prod') {
        throw new UnauthorizedException('BILLING_INTERNAL_JOB_KEY non configuré');
      }
      return; // dev/test uniquement
    }
    if (String(provided ?? '').trim() !== expected) {
      throw new UnauthorizedException('Unauthorized');
    }
  }

  private async logWebhook(
    provider: string,
    tenantSlug: string | undefined,
    extra: AnyObj,
  ): Promise<void> {
    try {
      await this.sb.from('billing_webhook_logs').insert({
        provider,
        event_type: extra.event_type ?? null,
        payload: { tenantSlug, ...extra },
        signature_valid: null,
        processed: false,
      });
    } catch (err) {
      this.logger.warn(`logWebhook ${provider} failed: ${(err as Error).message}`);
    }
  }

  private buildInvoiceNumber(id: string | undefined, paidAt: string | null | undefined): string {
    const d = paidAt ? new Date(paidAt) : new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const short = String(id || '').slice(0, 8).toUpperCase();
    return `INV-${yyyy}${mm}-${short}`;
  }

  private simpleInvoiceHtml(args: {
    invoiceNumber: string;
    paymentId: string;
    orderId: string | null;
    paidAt: string;
    amount: number | null;
    currency: string;
    paymentMethod: string | null;
    planName?: string | null;
    customerName: string;
  }): string {
    const amount = args.amount != null ? `${args.amount} ${args.currency}` : '—';
    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>Facture ${args.invoiceNumber}</title>
<style>body{font:14px/1.5 -apple-system,Segoe UI,sans-serif;max-width:720px;margin:40px auto;padding:0 24px;color:#111}
h1{font-size:22px;margin:0 0 8px}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{text-align:left;padding:8px 12px;border-bottom:1px solid #eee}
.totals{font-weight:600;font-size:16px}</style></head><body>
<h1>Facture ${args.invoiceNumber}</h1>
<p>Client : <strong>${args.customerName}</strong><br/>
Date : ${new Date(args.paidAt).toLocaleString('fr-FR')}<br/>
Référence commande : ${args.orderId || args.paymentId}</p>
<table><thead><tr><th>Description</th><th>Méthode</th><th>Montant</th></tr></thead>
<tbody><tr><td>${args.planName || 'Abonnement'}</td><td>${args.paymentMethod || '—'}</td><td>${amount}</td></tr></tbody></table>
<p class="totals">Total : ${amount}</p>
<p style="color:#888;font-size:12px">Document généré automatiquement par ISNA / Cimolace.</p>
</body></html>`;
  }

  private computeExpiry(intervalType: string | undefined): string {
    const days = intervalType === 'yearly' ? 365 : intervalType === 'weekly' ? 7 : 30;
    return new Date(Date.now() + days * 86_400_000).toISOString();
  }

  private computeSubscriptionState(subscription: AnyObj | null) {
    if (!subscription) {
      return { status: 'none', visualState: 'expired', daysRemaining: 0, expiresAt: null, graceEndsAt: null };
    }
    const now = Date.now();
    const graceDays = Number(this.config.get('BILLING_GRACE_DAYS') || 0);
    // Schéma PROD réel : fin de période = current_period_end (pas d'expires_at) ; pas de colonne
    // grace_ends_at → période de grâce = fin + BILLING_GRACE_DAYS.
    const expiresMs = subscription.current_period_end ? new Date(subscription.current_period_end).getTime() : null;
    const graceMs = expiresMs != null ? expiresMs + graceDays * 86_400_000 : null;

    if (expiresMs && expiresMs > now) {
      const days = Math.max(0, Math.ceil((expiresMs - now) / 86_400_000));
      return {
        status: 'active',
        visualState: days <= 7 ? 'expiring_soon' : 'active',
        daysRemaining: days,
        expiresAt: subscription.current_period_end,
        graceEndsAt: null,
      };
    }
    if (graceMs && graceMs > now) {
      const days = Math.max(0, Math.ceil((graceMs - now) / 86_400_000));
      return {
        status: 'grace_period',
        visualState: 'grace_period',
        daysRemaining: days,
        expiresAt: subscription.current_period_end,
        graceEndsAt: new Date(graceMs).toISOString(),
      };
    }
    return {
      status: 'expired',
      visualState: 'expired',
      daysRemaining: 0,
      expiresAt: subscription.expires_at,
      graceEndsAt: subscription.grace_ends_at,
    };
  }

  private assistantFallbackReply(raw: string, stepId?: string): string {
    const q = `${raw} ${stepId || ''}`.toLowerCase();
    if (/stripe/.test(q)) {
      return "Pour Stripe : ouvrez le dashboard, récupérez la clé secrète (Développeurs → Clés API), créez un endpoint webhook pointant vers l'URL affichée dans Paramètres → Paiements de votre tenant, puis copiez le secret de signature dans le formulaire (sans le coller ici).";
    }
    if (/paypal/.test(q)) {
      return "Pour PayPal : sur developer.paypal.com, créez une application REST (sandbox ou live). Récupérez Client ID et Secret, ajoutez un webhook avec l'URL fournie dans votre admin, copiez le Webhook ID puis renseignez les champs dans la carte PayPal.";
    }
    if (/chariow/.test(q)) {
      return "Pour Chariow : connectez-vous à votre espace marchand Chariow, générez ou copiez la clé API boutique et, si disponible, le secret pour valider les webhooks. Collez-les uniquement dans le formulaire Chariow.";
    }
    if (/webhook/.test(q)) {
      return "Les trois URLs de webhook (PayPal, Chariow, Stripe) sont listées dans Paramètres → Paiements. Copiez chaque URL dans le dashboard du fournisseur correspondant.";
    }
    return "Je peux vous guider sur Chariow, Stripe, PayPal ou les webhooks. Précisez votre blocage. Ne collez aucune clé secrète dans cette fenêtre.";
  }
}
