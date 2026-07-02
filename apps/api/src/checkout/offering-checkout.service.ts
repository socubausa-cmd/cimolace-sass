import {
  BadRequestException,
  Injectable,
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
import { SubscriptionRenewalService } from './subscription-renewal.service';
import { TenantPaymentConfigService } from '../billing/tenant-payment-config/tenant-payment-config.service';

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

  /** Accès non-typé à pawapay_deposits (table hors types Supabase générés). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get ppDeposits() {
    return (this.supabase as any).from('pawapay_deposits');
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

    // 2) Tenant isna actif
    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('id')
      .eq('slug', ISNA_TENANT_SLUG)
      .eq('status', 'active')
      .maybeSingle();
    if (!tenant) throw new NotFoundException('Tenant isna introuvable ou inactif');

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
          accountDetails: { phoneNumber: dto.phoneNumber, provider: dto.provider },
        },
        customerMessage: 'PRORASCIENCE',
        metadata: [
          { fieldName: 'userId', fieldValue: String(userId ?? '') },
          { fieldName: 'tenantId', fieldValue: String(tenant.id) },
          { fieldName: 'kind', fieldValue: String(dto.kind ?? '') },
          { fieldName: 'planSlug', fieldValue: planSlug ?? '' },
        ],
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

    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('id')
      .eq('slug', ISNA_TENANT_SLUG)
      .eq('status', 'active')
      .maybeSingle();
    if (!tenant) throw new NotFoundException('Tenant isna introuvable ou inactif');

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
      `${fallbackBase}/t/${ISNA_TENANT_SLUG}/paiement?card=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = dto.cancelUrl ?? `${fallbackBase}/t/${ISNA_TENANT_SLUG}/paiement?card=cancel`;

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
