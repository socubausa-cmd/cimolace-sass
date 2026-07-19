import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthService } from '../auth/auth.service';
import { PawaPayService } from '../pawapay/pawapay.service';
import { CreateOfferingDepositDto } from './create-offering-deposit.dto';
import { CreateOfferingCardDto } from './create-offering-card.dto';
import { isStripeConfigured, stripeCreateCheckoutSession } from '../billing/stripe-rest.util';
import {
  resolvePaypalCreds,
  normalizePaypalMode,
  paypalAccessToken,
  paypalCreateOrder,
  paypalCaptureOrder,
  type PaypalCreds,
} from './paypal-rest.util';
import { SubscriptionRenewalService } from './subscription-renewal.service';
import { TenantPaymentConfigService } from '../billing/tenant-payment-config/tenant-payment-config.service';
import { EmailEngineService } from '../email-engine/email-engine.service';
import { LiriEntitlementsService } from '../billing/liri-entitlements.service';

/**
 * Montants des paliers mentorat Ngowazulu, en centimes EUR.
 * Source de vérité serveur : le montant n'est JAMAIS fourni par le client pour un abonnement.
 * (Aligné sur apps/app/src/config/ngowazuluMentoratOffers.js)
 */
const NGOWAZULU_PLAN_AMOUNTS_EUR_CENTS: Record<string, number> = {
  'ngowazulu-mentorat-1x-month': 5500,
  'ngowazulu-mentorat-1x-week': 18000,
  'ngowazulu-mentorat-2x-week': 30000,
  'ngowazulu-mentorat-urgent-3x-week': 50000,
};

const ISNA_TENANT_SLUG = 'isna';

@Injectable()
export class OfferingCheckoutService {
  private readonly logger = new Logger(OfferingCheckoutService.name);

  constructor(
    private readonly auth: AuthService,
    private readonly pawapay: PawaPayService,
    private readonly renewals: SubscriptionRenewalService,
    private readonly tenantPayments: TenantPaymentConfigService,
    private readonly email: EmailEngineService,
    private readonly entitlements: LiriEntitlementsService,
  ) {}

  /**
   * Base d'API PawaPay déduite du `mode` de la config tenant (sandbox/test → sandbox).
   * Si le mode ne précise rien, on ne force pas de base (override.baseUrl undefined →
   * le service PawaPay garde sa propre base, alignée sur l'env).
   */
  private pawapayBaseFromMode(mode: string | null): string | undefined {
    const m = (mode ?? '').toLowerCase();
    if (m === 'sandbox' || m === 'test') return 'https://api.sandbox.pawapay.io';
    if (m === 'production' || m === 'live') return 'https://api.pawapay.io';
    return undefined;
  }

  private get supabase() {
    return this.auth.getClient();
  }

  /**
   * Tenant qui ENCAISSE : celui fourni par le client (dto.tenantSlug) ou, à
   * défaut, 'isna' (rétrocompatible — le flux historique ne passe pas de slug).
   * Permet à n'importe quel tenant de vendre via ce moteur avec SES creds.
   */
  private resolveTenantSlug(tenantSlug?: string | null): string {
    return String(tenantSlug || ISNA_TENANT_SLUG).trim().toLowerCase();
  }

  /** Accès non-typé à pawapay_deposits (table hors types Supabase générés). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get ppDeposits() {
    return (this.supabase as any).from('pawapay_deposits');
  }

  /** Accès non-typé à paypal_orders (table hors types Supabase générés). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get paypalOrders() {
    return (this.supabase as any).from('paypal_orders');
  }

  /**
   * Initie un dépôt Mobile Money pour un abonnement mentorat, une consultation
   * ou une offrande. Le depositId est généré avant l'appel pawaPay (idempotence).
   * Renvoie une erreur explicite si PAWAPAY_API_TOKEN n'est pas configuré.
   */
  async createMobileMoneyDeposit(userId: string, dto: CreateOfferingDepositDto) {
    // 1) Montant — calculé serveur pour un abonnement, fourni pour consultation/don
    const { amountCents, planSlug, currency } = await this.resolveAmount(dto);

    // 1.bis) Mobile money africain : l'opérateur règle en monnaie LOCALE (XOF/XAF…), jamais en EUR.
    //        Zone CFA pegée à l'euro (taux fixe légal) → conversion EXACTE du prix EUR vers le CFA.
    const { amount: depositAmount, currency: depositCurrency } = this.toMobileMoneyAmount(
      amountCents,
      currency,
      dto.country,
    );

    // 2) Tenant qui encaisse (dto.tenantSlug, défaut 'isna' — rétrocompatible)
    const tenantSlug = this.resolveTenantSlug(dto.tenantSlug);
    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .maybeSingle();
    if (!tenant) throw new NotFoundException(`Tenant « ${tenantSlug} » introuvable ou inactif`);

    // 2.bis) Credentials PawaPay DU TENANT (si configurés + enabled) — sinon null → env.
    //         Lecture serveur-à-serveur ; resolveTenantProviderCreds ne lève jamais.
    const tenantPp = await this.tenantPayments.resolveTenantProviderCreds(
      tenant.id,
      'pawapay',
    );
    const tenantPpToken = tenantPp?.creds?.api_token || null;

    // 3) Garde claire si pawaPay n'est dispo NI via le tenant NI via l'env
    //    (évite d'insérer un dépôt orphelin). Le tenant prime ; à défaut, l'env.
    if (!tenantPpToken && !this.pawapay.isConfigured) {
      throw new ServiceUnavailableException(
        'Paiement Mobile Money indisponible : aucun token PawaPay (ni tenant, ni PAWAPAY_API_TOKEN plateforme).',
      );
    }

    // 4) Persister AVANT l'appel pawaPay (point de vérité / idempotence réseau)
    const depositId = randomUUID();
    const { error: insErr } = await this.ppDeposits.insert({
      deposit_id: depositId,
      tenant_id: tenant.id,
      user_id: userId,
      amount_cents: depositAmount,
      currency: depositCurrency,
      provider: dto.provider,
      phone_number: dto.phoneNumber,
      country: dto.country.toUpperCase(),
      pawapay_status: 'PENDING',
      kind: dto.kind,
      plan_slug: planSlug,
    });
    if (insErr) {
      this.logger.error('insert pawapay_deposit (offering)', insErr.message);
      throw new ServiceUnavailableException(
        `Impossible d'enregistrer le paiement (migration pawapay_deposits requise ?) : ${insErr.message}`,
      );
    }

    // 5) Appel pawaPay — token tenant si présent, sinon env (override undefined).
    const ppOverride = tenantPpToken
      ? { apiToken: tenantPpToken, baseUrl: this.pawapayBaseFromMode(tenantPp?.mode ?? null) }
      : undefined;
    const result = await this.pawapay.initiateDeposit(
      {
        depositId,
        amount: String(depositAmount),
        currency: depositCurrency,
        payer: {
          type: 'MMO',
          accountDetails: {
            phoneNumber: String(dto.phoneNumber ?? '').replace(/[^0-9]/g, ''),
            provider: dto.provider,
          },
        },
        customerMessage: 'PRORASCIENCE',
        // PawaPay v2 : metadata = tableau d'objets à UNE clé (nom = clé) ; on écarte les valeurs vides.
        metadata: ([
          { userId: String(userId ?? '') },
          { tenantId: String(tenant.id) },
          { kind: String(dto.kind ?? '') },
          { planSlug: planSlug ?? '' },
        ] as Record<string, string>[]).filter(
          (m) => String(Object.values(m)[0] ?? '').length > 0,
        ),
      },
      ppOverride,
    );

    await this.ppDeposits
      .update({ pawapay_status: result.status })
      .eq('deposit_id', depositId);

    return { depositId, status: result.status, amountCents: depositAmount, currency: depositCurrency };
  }

  // Zone franc CFA : pegée à l'euro à un taux FIXE légal (1 € = 655,957 CFA). XOF = Afrique de
  // l'Ouest (UEMOA), XAF = Afrique centrale (CEMAC). Le CFA n'a pas de décimales → unités entières.
  private static readonly CFA_PEG = 655.957;
  private static readonly XOF_COUNTRIES = new Set([
    'BEN', 'BFA', 'CIV', 'GNB', 'MLI', 'NER', 'SEN', 'TGO',
  ]);
  private static readonly XAF_COUNTRIES = new Set([
    'CMR', 'CAF', 'TCD', 'COG', 'GNQ', 'GAB',
  ]);

  /**
   * Convertit le montant d'un plan vers la devise attendue par l'opérateur mobile money :
   *  - zone CFA (XOF/XAF) + plan EUR → conversion exacte au peg (€→CFA, entier) ;
   *  - plan déjà dans la devise cible → tel quel ;
   *  - hors zone CFA avec un plan EUR → refus propre (pas de taux fiable) ; la carte reste dispo.
   */
  private toMobileMoneyAmount(
    amountCents: number,
    planCurrency: string,
    countryRaw: string,
  ): { amount: number; currency: string } {
    const country = String(countryRaw || '').toUpperCase();
    const cur = String(planCurrency || 'EUR').toUpperCase();
    const cfa = OfferingCheckoutService.XOF_COUNTRIES.has(country)
      ? 'XOF'
      : OfferingCheckoutService.XAF_COUNTRIES.has(country)
        ? 'XAF'
        : null;

    if (cfa) {
      if (cur === 'EUR') {
        return {
          amount: Math.round((amountCents / 100) * OfferingCheckoutService.CFA_PEG),
          currency: cfa,
        };
      }
      if (cur === 'XOF' || cur === 'XAF') {
        return { amount: Math.round(amountCents), currency: cfa };
      }
    }

    if (cur === 'EUR') {
      throw new BadRequestException(
        `Mobile Money disponible en zone CFA (XOF/XAF) pour ce paiement. Pour ${country || 'ce pays'}, utilisez la carte bancaire.`,
      );
    }
    return { amount: Math.round(amountCents), currency: cur };
  }

  /** Montant + planSlug d'une offre — partagé Mobile Money / Carte. Montant abo = serveur uniquement. */
  private async resolveAmount(dto: {
    kind: 'subscription' | 'consultation' | 'donation';
    planSlug?: string;
    amountCents?: number;
  }): Promise<{ amountCents: number; planSlug: string | null; currency: string; billingCycle: string }> {
    if (dto.kind === 'subscription') {
      const planSlug = dto.planSlug ?? null;
      if (!planSlug) throw new BadRequestException('planSlug requis pour un abonnement');
      // 1) Paliers mentorat Ngowazulu en dur (source serveur historique, EUR).
      const hard = NGOWAZULU_PLAN_AMOUNTS_EUR_CENTS[planSlug];
      if (hard) return { amountCents: hard, planSlug, currency: 'EUR', billingCycle: 'monthly' };
      // 2) Sinon, TOUT plan de billing_plans (cycles d'initiation / forfaits) : prix lu serveur
      //    depuis la DB (jamais fourni par le client) → permet de brancher /forfaits sur ce moteur.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: plan } = await (this.supabase as any)
        .from('billing_plans')
        .select('key, price_cents, currency, is_active, billing_cycle')
        .eq('key', planSlug)
        .maybeSingle();
      if (!plan || plan.is_active === false || !plan.price_cents) {
        throw new BadRequestException(`Offre inconnue ou inactive (planSlug=${planSlug})`);
      }
      return {
        amountCents: plan.price_cents,
        planSlug,
        currency: String(plan.currency || 'EUR').toUpperCase(),
        billingCycle: String(plan.billing_cycle || 'monthly').toLowerCase(),
      };
    }
    if (!dto.amountCents || dto.amountCents < 100) {
      throw new BadRequestException(
        dto.kind === 'donation'
          ? "Montant de l'offrande invalide (min 1,00)"
          : 'Montant de la consultation requis (min 1,00)',
      );
    }
    return { amountCents: dto.amountCents, planSlug: dto.planSlug ?? null, currency: 'EUR', billingCycle: 'monthly' };
  }

  /**
   * Crée une session Stripe Checkout (CARTE) pour une offre PRORASCIENCE :
   * - subscription → mode 'subscription' (prix récurrent mensuel inline → débit auto Stripe)
   * - consultation / donation → mode 'payment' (paiement unique)
   * Le fulfillment (création/activation de l'abonnement) se fait au webhook Stripe
   * (POST /offering-checkout/webhook/stripe), comme pour pawaPay.
   */
  async createStripeCheckout(userId: string, dto: CreateOfferingCardDto, userEmail?: string) {
    const { amountCents, planSlug, currency, billingCycle } = await this.resolveAmount(dto);

    // Tenant qui encaisse (dto.tenantSlug, défaut 'isna' — rétrocompatible).
    const tenantSlug = this.resolveTenantSlug(dto.tenantSlug);
    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .maybeSingle();
    if (!tenant) throw new NotFoundException(`Tenant « ${tenantSlug} » introuvable ou inactif`);

    // Clé Stripe DU TENANT (si configurée + enabled) — sinon null → env plateforme.
    // resolveTenantProviderCreds ne lève jamais : pas de config → fallback transparent.
    const tenantStripe = await this.tenantPayments.resolveTenantProviderCreds(
      tenant.id,
      'stripe',
    );
    const tenantStripeKey = tenantStripe?.creds?.secret_key || null;

    // Garde : Stripe doit être dispo via le tenant OU via l'env. Le tenant prime.
    if (!tenantStripeKey && !isStripeConfigured()) {
      throw new ServiceUnavailableException(
        'Paiement carte indisponible : aucune clé Stripe (ni tenant, ni STRIPE_SECRET_KEY plateforme).',
      );
    }

    const isSubscription = dto.kind === 'subscription';
    const productName =
      dto.kind === 'subscription'
        ? `Mentorat PRORASCIENCE${planSlug ? ` — ${planSlug}` : ''}`
        : dto.kind === 'donation'
          ? 'Offrande PRORASCIENCE'
          : 'Consultation Ngowazulu (90 min)';

    const fallbackBase = process.env.SCHOOL_FRONTEND_URL ?? 'https://prorascience.org';
    const successUrl =
      dto.successUrl ??
      `${fallbackBase}/t/${tenantSlug}/paiement?card=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = dto.cancelUrl ?? `${fallbackBase}/t/${tenantSlug}/paiement?card=cancel`;

    const params = new URLSearchParams();
    params.append('mode', isSubscription ? 'subscription' : 'payment');
    params.append('line_items[0][price_data][currency]', currency.toLowerCase());
    params.append('line_items[0][price_data][unit_amount]', String(amountCents));
    params.append('line_items[0][price_data][product_data][name]', productName);
    if (isSubscription) {
      // Rythme de facturation Stripe selon le billing_cycle du plan : sinon tout
      // débiterait mensuellement (un abo trimestriel/annuel surfacturerait).
      if (billingCycle === 'yearly') {
        params.append('line_items[0][price_data][recurring][interval]', 'year');
      } else if (billingCycle === 'quarterly') {
        params.append('line_items[0][price_data][recurring][interval]', 'month');
        params.append('line_items[0][price_data][recurring][interval_count]', '3');
      } else {
        params.append('line_items[0][price_data][recurring][interval]', 'month');
      }
    }
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('client_reference_id', userId);
    params.append('metadata[user_id]', userId);
    params.append('metadata[tenant_id]', tenant.id);
    params.append('metadata[kind]', dto.kind);
    if (planSlug) params.append('metadata[plan_slug]', planSlug);
    // Propage les metadata sur l'abonnement → exploitables aux renouvellements (invoice.paid).
    if (isSubscription) {
      params.append('subscription_data[metadata][user_id]', userId);
      params.append('subscription_data[metadata][tenant_id]', tenant.id);
      params.append('subscription_data[metadata][kind]', dto.kind);
      if (planSlug) params.append('subscription_data[metadata][plan_slug]', planSlug);
    }
    if (userEmail) params.append('customer_email', userEmail);

    let session: { id: string; url: string };
    try {
      // Clé tenant si présente, sinon undefined → l'util retombe sur STRIPE_SECRET_KEY (env).
      session = await stripeCreateCheckoutSession(params, tenantStripeKey ?? undefined);
    } catch (e) {
      this.logger.error('Stripe createCheckoutSession (offering)', (e as Error).message);
      throw new ServiceUnavailableException(
        `Impossible de créer la session de paiement carte : ${(e as Error).message}`,
      );
    }

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      amountCents,
      currency,
      mode: isSubscription ? 'subscription' : 'payment',
    };
  }

  // ── PayPal (Orders v2) ──────────────────────────────────────────────────────
  /**
   * Résout les creds PayPal effectifs d'un tenant. La page de réglages écrit via
   * l'edge `tenant-payments` dans les COLONNES PLATES `public_key`/`secret_key`
   * (+ `is_active`), alors que `resolveTenantProviderCreds` lit le JSONB chiffré
   * `credentials` (+ `enabled`) — deux chemins d'écriture distincts. On lit donc
   * D'ABORD les colonnes plates (source de l'UI), puis le JSONB, puis l'env.
   */
  private async resolveTenantPaypalCreds(tenantId: string): Promise<PaypalCreds | null> {
    // 1) Colonnes plates — ce que l'UI de réglages (edge tenant-payments) écrit.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row } = await (this.supabase as any)
        .from('tenant_payment_providers')
        .select('public_key, secret_key, mode, is_active')
        .eq('tenant_id', tenantId)
        .eq('provider', 'paypal')
        .maybeSingle();
      if (row && row.is_active !== false && row.public_key && row.secret_key) {
        return {
          clientId: String(row.public_key),
          clientSecret: String(row.secret_key),
          mode: normalizePaypalMode(row.mode),
        };
      }
    } catch {
      /* pas de colonnes plates → chemin JSONB / env */
    }
    // 2) JSONB chiffré (chemin NestJS tenant-payment-config) + 3) repli env.
    const tp = await this.tenantPayments.resolveTenantProviderCreds(tenantId, 'paypal');
    return resolvePaypalCreds(tp);
  }

  /**
   * Crée un ordre PayPal (intent CAPTURE) pour une offre. Montant TOUJOURS calculé
   * serveur (resolveAmount). Credentials DU TENANT (client_id/secret/mode) si
   * configurés, sinon env plateforme. On persiste l'ordre AVANT l'approbation
   * (paypal_orders) → à la capture on relit user/plan/kind (jamais fournis par le
   * client). Renvoie { orderId, approveUrl } : le front redirige vers approveUrl.
   */
  async createPaypalOrder(userId: string, dto: CreateOfferingCardDto) {
    const { amountCents, planSlug, currency } = await this.resolveAmount(dto);

    const tenantSlug = this.resolveTenantSlug(dto.tenantSlug);
    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .eq('status', 'active')
      .maybeSingle();
    if (!tenant) throw new NotFoundException(`Tenant « ${tenantSlug} » introuvable ou inactif`);

    const creds = await this.resolveTenantPaypalCreds(tenant.id);
    if (!creds) {
      throw new ServiceUnavailableException(
        'Paiement PayPal indisponible : aucun identifiant PayPal (ni tenant, ni plateforme).',
      );
    }

    const productName =
      dto.kind === 'subscription'
        ? `Abonnement PRORASCIENCE${planSlug ? ` — ${planSlug}` : ''}`
        : dto.kind === 'donation'
          ? 'Offrande PRORASCIENCE'
          : 'Consultation Ngowazulu (90 min)';

    const fallbackBase = process.env.SCHOOL_FRONTEND_URL ?? 'https://prorascience.org';
    const base = `${fallbackBase}/t/${tenantSlug}/paiement${planSlug ? `?plan=${encodeURIComponent(planSlug)}` : ''}`;
    const sep = base.includes('?') ? '&' : '?';
    const returnUrl = dto.successUrl ?? `${base}${sep}paypal=success`;
    const cancelUrl = dto.cancelUrl ?? `${base}${sep}paypal=cancel`;

    // Persistance AVANT PayPal — order_id renseigné après create (2 temps : insert
    // brouillon puis update order_id). On insère d'abord un brouillon avec un
    // order_id temporaire unique, puis on le remplace par l'id PayPal réel.
    let token: string;
    try {
      token = await paypalAccessToken(creds);
    } catch (e) {
      this.logger.error('PayPal OAuth', (e as Error).message);
      throw new ServiceUnavailableException(`PayPal indisponible : ${(e as Error).message}`);
    }

    let order: { id: string; approveUrl: string | null };
    try {
      order = await paypalCreateOrder(creds, token, {
        amountCents,
        currency,
        description: productName,
        customId: `${userId}:${dto.kind}`,
        returnUrl,
        cancelUrl,
      });
    } catch (e) {
      this.logger.error('PayPal createOrder', (e as Error).message);
      throw new ServiceUnavailableException(`Impossible de créer l'ordre PayPal : ${(e as Error).message}`);
    }

    const { error: insErr } = await this.paypalOrders.insert({
      order_id: order.id,
      tenant_id: tenant.id,
      user_id: userId,
      amount_cents: amountCents,
      currency,
      kind: dto.kind,
      plan_slug: planSlug,
      status: 'CREATED',
    });
    if (insErr) {
      this.logger.error('insert paypal_order', insErr.message);
      throw new ServiceUnavailableException(
        `Impossible d'enregistrer l'ordre PayPal (migration paypal_orders requise ?) : ${insErr.message}`,
      );
    }

    return {
      orderId: order.id,
      approveUrl: order.approveUrl,
      amountCents,
      currency,
      mode: creds.mode,
    };
  }

  /**
   * Capture un ordre PayPal approuvé (scopé à l'utilisateur). Relit le contexte
   * en base (jamais du client), capture côté PayPal, et sur COMPLETED réclame la
   * transition ATOMIQUE (status != COMPLETED) → fulfillment UNIQUE (abonnement +
   * membership, ou reçu). Idempotent : une 2e capture ne re-provisionne pas.
   */
  async capturePaypalOrder(userId: string, orderId: string) {
    if (!orderId) throw new BadRequestException('orderId requis');

    const { data: ord } = await this.paypalOrders
      .select('order_id, tenant_id, user_id, amount_cents, currency, kind, plan_slug, status')
      .eq('order_id', orderId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!ord) throw new NotFoundException('Ordre PayPal introuvable.');

    if (ord.status === 'COMPLETED') {
      return { orderId, status: 'COMPLETED', isCompleted: true };
    }

    const creds = await this.resolveTenantPaypalCreds(ord.tenant_id);
    if (!creds) throw new ServiceUnavailableException('PayPal non configuré pour ce tenant.');

    let token: string;
    try {
      token = await paypalAccessToken(creds);
    } catch (e) {
      throw new ServiceUnavailableException(`PayPal indisponible : ${(e as Error).message}`);
    }

    let cap: { status: string; captureId: string | null };
    try {
      cap = await paypalCaptureOrder(creds, token, orderId);
    } catch (e) {
      this.logger.error('PayPal capture', (e as Error).message);
      throw new ServiceUnavailableException(`Capture PayPal impossible : ${(e as Error).message}`);
    }

    if (cap.status !== 'COMPLETED') {
      await this.paypalOrders.update({ status: cap.status, updated_at: new Date().toISOString() }).eq('order_id', orderId);
      return { orderId, status: cap.status, isCompleted: false };
    }

    // COMPLETED : un seul appelant gagne la transition (le 2e met à jour 0 ligne → skip fulfillment).
    const { data: claimed } = await this.paypalOrders
      .update({ status: 'COMPLETED', capture_id: cap.captureId, updated_at: new Date().toISOString() })
      .eq('order_id', orderId)
      .neq('status', 'COMPLETED')
      .select('order_id');
    if (claimed && claimed.length > 0) {
      await this.renewals.fulfillPaidOffer({
        userId: ord.user_id,
        tenantId: ord.tenant_id,
        kind: ord.kind,
        planSlug: ord.plan_slug,
        provider: 'paypal',
        amountCents: ord.amount_cents,
        currency: ord.currency,
      });
      this.logger.log(`PayPal capturé — user=${ord.user_id} kind=${ord.kind} order=${orderId}`);
    }
    return { orderId, status: 'COMPLETED', isCompleted: true };
  }

  /** Statut d'un dépôt (scopé à l'utilisateur). */
  async getStatus(depositId: string, userId: string) {
    const { data: deposit } = await this.ppDeposits
      .select('deposit_id, user_id, kind, plan_slug, tenant_id, pawapay_status')
      .eq('deposit_id', depositId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!deposit) throw new NotFoundException('Dépôt introuvable');
    if (deposit.pawapay_status === 'COMPLETED') {
      return { depositId, status: 'COMPLETED', isCompleted: true };
    }
    const remote = await this.pawapay.getDepositStatus(depositId);
    const status = remote?.status ?? deposit.pawapay_status;
    if (remote && remote.status !== deposit.pawapay_status) {
      // met à jour + active l'abo sur COMPLETED (le callback PawaPay va chez un autre tenant)
      await this.renewals.applyDepositTerminal(deposit, remote.status);
    }
    return { depositId, status, isCompleted: status === 'COMPLETED' };
  }

  /** Opérateurs Mobile Money disponibles (filtrable par pays ISO3). */
  async getProviders(country?: string) {
    return this.pawapay.getActiveConfig(country);
  }

  // ── Paiement INVITÉ (guest) ─────────────────────────────────────────────────
  // Un client sans compte paie/réclame un service en donnant juste son email : on
  // provisionne (ou retrouve) son compte à la volée, puis on réutilise le flux
  // normal (createStripeCheckout / claimFree). Le webhook pose l'accès sur ce
  // compte ; le client se connecte ensuite (email) pour réserver son créneau.

  /** Provisionne (ou retrouve) un compte à partir d'un email + garantit le membership tenant. */
  private async provisionGuestUser(
    tenantId: string,
    email: string,
    firstName?: string,
    lastName?: string,
  ): Promise<string> {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new InternalServerErrorException('Supabase non configuré (invité).');
    const em = email.trim().toLowerCase();
    const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    const findId = async (): Promise<string | undefined> => {
      const r = await fetch(`${url}/auth/v1/admin/users?email=${encodeURIComponent(em)}`, { headers });
      if (!r.ok) return undefined;
      const d = (await r.json()) as { users?: { id: string; email?: string }[] };
      return (d?.users || []).find((u) => u.email?.toLowerCase() === em)?.id;
    };
    let userId = await findId();
    if (!userId) {
      const createRes = await fetch(`${url}/auth/v1/admin/users`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email: em,
          email_confirm: true,
          user_metadata: { first_name: firstName ?? null, last_name: lastName ?? null, created_via: 'guest-checkout' },
        }),
      });
      userId = createRes.ok ? ((await createRes.json()) as { id: string }).id : await findId();
      if (!userId) throw new InternalServerErrorException('Provisionnement du compte invité impossible.');
    }
    // PLAFOND D'OFFRE (monétisation) : un NOUVEL élève invité consomme un slot 'students'
    // (upsert ignoreDuplicates → un membre existant est no-op, donc on ne vérifie que les nouveaux).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMem } = await (this.supabase as any)
      .from('tenant_memberships').select('id').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle();
    if (!existingMem?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count } = await (this.supabase as any)
        .from('tenant_memberships').select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId).eq('status', 'active').eq('role', 'student');
      await this.entitlements.assertWithinCap(tenantId, 'students', count ?? 0);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (this.supabase as any).from('tenant_memberships').upsert(
      { tenant_id: tenantId, user_id: userId, role: 'student', status: 'active' },
      { onConflict: 'tenant_id,user_id', ignoreDuplicates: true },
    );
    return userId;
  }

  private async tenantIdBySlug(slug: string): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (this.supabase as any)
      .from('tenants').select('id').eq('slug', slug).eq('status', 'active').maybeSingle();
    if (!data?.id) throw new NotFoundException(`Tenant « ${slug} » introuvable.`);
    return data.id as string;
  }

  /**
   * Déblocage d'accès SERVICE après un paiement encaissé PAR LE TENANT sur SON
   * propre Stripe (paiement natif hors tunnel Cimolace — ex : zahirwellness règle
   * une masterclass sur son site avec son processeur). Authentifié par clé tenant
   * (ApiKeyGuard) → le `tenantId` vient de la clé, JAMAIS du corps (isolation).
   * Le tenant DOIT avoir vérifié le paiement (webhook Stripe signé) AVANT d'appeler.
   * Idempotent (upsert). Symétrique de ce que pose le webhook Cimolace guest-card.
   */
  async tenantGrantServiceAccess(
    tenantId: string,
    dto: { planSlug?: string; email?: string; first_name?: string; last_name?: string; payment_ref?: string },
  ): Promise<{ ok: true; user_id: string; granted: boolean }> {
    const planSlug = String(dto.planSlug || '').trim();
    const email = String(dto.email || '').trim();
    if (!planSlug) throw new BadRequestException('planSlug requis.');
    if (!email.includes('@')) throw new BadRequestException('Email valide requis.');

    // Le plan doit exister pour CE tenant (isolation) et être réservable/événement.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: plan } = await (this.supabase as any)
      .from('billing_plans')
      .select('key, metadata')
      .eq('tenant_id', tenantId)
      .eq('key', planSlug)
      .maybeSingle();
    if (!plan) throw new NotFoundException('Service introuvable pour ce tenant.');

    // Provisionne (ou retrouve) l'acheteur par email + rattache au tenant (student).
    const userId = await this.provisionGuestUser(tenantId, email, dto.first_name, dto.last_name);

    // Pass réutilisable uniquement pour un service RÉSERVABLE ou un ÉVÉNEMENT/masterclass.
    let granted = false;
    if (plan?.metadata?.event || plan?.metadata?.bookable) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (this.supabase as any).from('access_passes').upsert(
        {
          tenant_id: tenantId,
          user_id: userId,
          resource_type: 'service',
          resource_id: planSlug,
          payment_id: dto.payment_ref ?? null,
          status: 'active',
        },
        { onConflict: 'tenant_id,user_id,resource_type,resource_id' },
      );
      granted = true;
    }
    this.logger.log(
      `tenant-grant: accès service accordé tenant=${tenantId} user=${userId} service=${planSlug} granted=${granted}`,
    );
    // Notifie le praticien de la nouvelle réservation (best-effort, ne bloque jamais).
    if (granted) {
      void this.notifyPractitionerReservation(tenantId, (plan as any)?.label || planSlug, {
        email,
        first_name: dto.first_name,
        last_name: dto.last_name,
      }).catch(() => undefined);
    }
    return { ok: true, user_id: userId, granted };
  }

  /** Notifie le(s) propriétaire(s) du tenant d'une nouvelle réservation (Resend per-tenant). */
  private async notifyPractitionerReservation(
    tenantId: string,
    serviceLabel: string,
    buyer: { email?: string; first_name?: string; last_name?: string },
  ): Promise<void> {
    try {
      const db = this.supabase as any;
      const { data: mems } = await db
        .from('tenant_memberships')
        .select('user_id')
        .eq('tenant_id', tenantId)
        .eq('role', 'owner')
        .eq('status', 'active')
        .limit(5);
      const ownerIds = [
        ...new Set((mems || []).map((m: any) => m.user_id).filter(Boolean)),
      ] as string[];
      if (!ownerIds.length) return;
      const buyerName =
        [buyer.first_name, buyer.last_name].filter(Boolean).join(' ').trim() || buyer.email || 'un client';
      const html = this.email.brandedHtml({
        title: 'Nouvelle réservation',
        body: `${buyerName} vient de réserver « ${serviceLabel} »${buyer.email ? ` (${buyer.email})` : ''}. Retrouvez tous les inscrits dans votre espace MEDOS → Services.`,
      });
      const subject = `✅ Nouvelle réservation — ${serviceLabel}`;
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const headers = { apikey: key || '', Authorization: `Bearer ${key || ''}` };
      for (const uid of ownerIds) {
        try {
          const r = await fetch(`${url}/auth/v1/admin/users/${uid}`, { headers });
          const u = (await r.json()) as { email?: string };
          const to = String(u?.email || '').trim();
          if (to) await this.email.sendRaw(tenantId, to, subject, html);
        } catch {
          /* propriétaire ignoré */
        }
      }
    } catch (e) {
      this.logger.warn(`notifyPractitionerReservation: ${(e as Error).message}`);
    }
  }

  /** Paiement carte INVITÉ : provisionne le compte par email puis crée le checkout Stripe. */
  async guestStripeCheckout(
    dto: CreateOfferingCardDto & { email: string; first_name?: string; last_name?: string },
  ) {
    if (!dto.email) throw new BadRequestException('Email requis pour le paiement invité.');
    const tenantId = await this.tenantIdBySlug(this.resolveTenantSlug(dto.tenantSlug));
    const userId = await this.provisionGuestUser(tenantId, dto.email, dto.first_name, dto.last_name);
    return this.createStripeCheckout(userId, dto, dto.email);
  }

  /** Dépôt Mobile Money INVITÉ : provisionne le compte par email puis crée le dépôt PawaPay. */
  async guestMobileMoney(
    dto: CreateOfferingDepositDto & { email: string; first_name?: string; last_name?: string },
  ) {
    if (!dto.email) throw new BadRequestException('Email requis pour le paiement invité.');
    const tenantId = await this.tenantIdBySlug(this.resolveTenantSlug(dto.tenantSlug));
    const userId = await this.provisionGuestUser(tenantId, dto.email, dto.first_name, dto.last_name);
    return this.createMobileMoneyDeposit(userId, dto);
  }

  /** Ordre PayPal INVITÉ : provisionne le compte par email puis crée l'ordre. */
  async guestPaypal(
    dto: CreateOfferingCardDto & { email: string; first_name?: string; last_name?: string },
  ) {
    if (!dto.email) throw new BadRequestException('Email requis pour le paiement invité.');
    const tenantId = await this.tenantIdBySlug(this.resolveTenantSlug(dto.tenantSlug));
    const userId = await this.provisionGuestUser(tenantId, dto.email, dto.first_name, dto.last_name);
    return this.createPaypalOrder(userId, dto);
  }

  /** Accès GRATUIT INVITÉ : provisionne le compte puis réclame l'accès. */
  async guestClaimFree(dto: {
    planSlug?: string;
    tenantSlug?: string;
    email: string;
    first_name?: string;
    last_name?: string;
  }) {
    if (!dto.email) throw new BadRequestException('Email requis.');
    const tenantId = await this.tenantIdBySlug(this.resolveTenantSlug(dto.tenantSlug));
    const userId = await this.provisionGuestUser(tenantId, dto.email, dto.first_name, dto.last_name);
    await this.claimFree(userId, dto.planSlug);
    return { ok: true, email: dto.email };
  }

  /**
   * Accès GRATUIT (modèle free/community) : débloque le service SANS paiement.
   * Vérifie côté SERVEUR que le service est bien free/community (un service payant ne
   * peut JAMAIS être réclamé gratuitement), puis pose un abonnement actif à 0 sur une
   * période très longue → createOrExtendSubscription accorde aussi membership + rôle.
   */
  async claimFree(userId: string, planSlug?: string) {
    if (!planSlug) throw new BadRequestException('planSlug requis');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: plan } = await (this.supabase as any)
      .from('billing_plans')
      .select('key, access_model, tenant_id, is_active')
      .eq('key', planSlug)
      .maybeSingle();
    if (!plan || plan.is_active === false) {
      throw new NotFoundException('Service introuvable ou inactif.');
    }
    if (plan.access_model !== 'free' && plan.access_model !== 'community') {
      throw new BadRequestException('Ce service est payant — passez par le paiement.');
    }
    // ≈ 100 ans → l'accès gratuit n'expire pas.
    const farFuture = new Date(Date.now() + 100 * 365 * 86_400_000).toISOString();
    await this.renewals.createOrExtendSubscription(userId, planSlug, {
      tenantId: plan.tenant_id ?? null,
      provider: 'free',
      currentPeriodEnd: farFuture,
    });
    return { ok: true, accessModel: plan.access_model, planSlug };
  }
}
