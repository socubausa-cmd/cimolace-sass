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
  ) {}

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
    const { amountCents, planSlug } = this.resolveAmount(dto);

    // 2) Tenant isna actif
    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('id')
      .eq('slug', ISNA_TENANT_SLUG)
      .eq('status', 'active')
      .maybeSingle();
    if (!tenant) throw new NotFoundException('Tenant isna introuvable ou inactif');

    // 3) Garde claire si pawaPay n'est pas configuré (évite d'insérer un dépôt orphelin)
    if (!this.pawapay.isConfigured) {
      throw new ServiceUnavailableException(
        'Paiement Mobile Money indisponible : PAWAPAY_API_TOKEN non configuré côté serveur.',
      );
    }

    // 4) Persister AVANT l'appel pawaPay (point de vérité / idempotence réseau)
    const depositId = randomUUID();
    const currency = 'EUR';
    const { error: insErr } = await this.ppDeposits.insert({
      deposit_id: depositId,
      tenant_id: tenant.id,
      user_id: userId,
      amount_cents: amountCents,
      currency,
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

    // 5) Appel pawaPay
    const result = await this.pawapay.initiateDeposit({
      depositId,
      amount: String(Math.round(amountCents)),
      currency,
      payer: {
        type: 'MMO',
        accountDetails: { phoneNumber: dto.phoneNumber, provider: dto.provider },
      },
      statementDescription: 'PRORASCIENCE'.slice(0, 22),
      metadata: {
        userId,
        tenantId: tenant.id,
        kind: dto.kind,
        planSlug: planSlug ?? '',
      },
    });

    await this.ppDeposits
      .update({ pawapay_status: result.status })
      .eq('deposit_id', depositId);

    return { depositId, status: result.status, amountCents, currency };
  }

  /** Montant + planSlug d'une offre — partagé Mobile Money / Carte. Montant abo = serveur uniquement. */
  private resolveAmount(dto: {
    kind: 'subscription' | 'consultation' | 'donation';
    planSlug?: string;
    amountCents?: number;
  }): { amountCents: number; planSlug: string | null } {
    if (dto.kind === 'subscription') {
      const planSlug = dto.planSlug ?? null;
      const amt = planSlug ? NGOWAZULU_PLAN_AMOUNTS_EUR_CENTS[planSlug] : undefined;
      if (!amt) throw new BadRequestException('Offre mentorat inconnue (planSlug invalide)');
      return { amountCents: amt, planSlug };
    }
    if (!dto.amountCents || dto.amountCents < 100) {
      throw new BadRequestException(
        dto.kind === 'donation'
          ? "Montant de l'offrande invalide (min 1,00)"
          : 'Montant de la consultation requis (min 1,00)',
      );
    }
    return { amountCents: dto.amountCents, planSlug: dto.planSlug ?? null };
  }

  /**
   * Crée une session Stripe Checkout (CARTE) pour une offre PRORASCIENCE :
   * - subscription → mode 'subscription' (prix récurrent mensuel inline → débit auto Stripe)
   * - consultation / donation → mode 'payment' (paiement unique)
   * Le fulfillment (création/activation de l'abonnement) se fait au webhook Stripe
   * (POST /offering-checkout/webhook/stripe), comme pour pawaPay.
   */
  async createStripeCheckout(userId: string, dto: CreateOfferingCardDto, userEmail?: string) {
    if (!isStripeConfigured()) {
      throw new ServiceUnavailableException(
        'Paiement carte indisponible : STRIPE_SECRET_KEY non configuré côté serveur.',
      );
    }

    const { amountCents, planSlug } = this.resolveAmount(dto);

    const { data: tenant } = await this.supabase
      .from('tenants')
      .select('id')
      .eq('slug', ISNA_TENANT_SLUG)
      .eq('status', 'active')
      .maybeSingle();
    if (!tenant) throw new NotFoundException('Tenant isna introuvable ou inactif');

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
    params.append('line_items[0][price_data][currency]', 'eur');
    params.append('line_items[0][price_data][unit_amount]', String(amountCents));
    params.append('line_items[0][price_data][product_data][name]', productName);
    if (isSubscription) {
      params.append('line_items[0][price_data][recurring][interval]', 'month');
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
      session = await stripeCreateCheckoutSession(params);
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
      currency: 'EUR',
      mode: isSubscription ? 'subscription' : 'payment',
    };
  }

  /** Statut d'un dépôt (scopé à l'utilisateur). */
  async getStatus(depositId: string, userId: string) {
    const { data: deposit } = await this.ppDeposits
      .select('deposit_id, user_id, pawapay_status')
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
      await this.ppDeposits.update({ pawapay_status: remote.status }).eq('deposit_id', depositId);
    }
    return { depositId, status, isCompleted: status === 'COMPLETED' };
  }

  /** Opérateurs Mobile Money disponibles (filtrable par pays ISO3). */
  async getProviders(country?: string) {
    return this.pawapay.getActiveConfig(country);
  }
}
