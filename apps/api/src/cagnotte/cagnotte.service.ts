import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { PawaPayService } from '../pawapay/pawapay.service';
import {
  isStripeConfigured,
  stripeAuth,
  stripeCreateCheckoutSession,
} from '../billing/stripe-rest.util';

/**
 * Cagnotte PUBLIQUE (dons anonymes) — pas de JWT : n'importe quel visiteur de
 * prorascience.org peut contribuer. Deux moyens de paiement, choisis par le front
 * selon la région :
 *   - Europe  → Stripe Checkout (carte, EUR)
 *   - Afrique → pawaPay (Mobile Money, XAF/XOF), conversion via le peg CFA fixe.
 *
 * Les montants sont normalisés en CENTIMES EUR dans `amount_cents` (le total et
 * l'objectif restent en EUR) ; le montant réellement débité en Mobile Money est
 * conservé à part (`display_amount`/`display_currency`).
 */
@Injectable()
export class CagnotteService {
  private readonly logger = new Logger(CagnotteService.name);

  /** Peg fixe EUR→franc CFA (identique côté offering-checkout). */
  private static readonly CFA_PEG = 655.957;
  /** Pays UEMOA (franc CFA de l'Ouest, XOF) ; le reste de la zone CFA = XAF. */
  private static readonly XOF_COUNTRIES = new Set([
    'BEN', 'BFA', 'CIV', 'GNB', 'MLI', 'NER', 'SEN', 'TGO',
  ]);

  constructor(
    private readonly supabaseSvc: SupabaseService,
    private readonly pawapay: PawaPayService,
  ) {}

  private get db(): any {
    return this.supabaseSvc.client as any;
  }

  private get frontBase(): string {
    return (process.env.SCHOOL_FRONTEND_URL || 'https://prorascience.org').replace(/\/$/, '');
  }

  /** Campagne + total collecté (dons confirmés uniquement). */
  async getCampaign(slug: string) {
    const { data: campaign } = await this.db
      .from('cagnotte_campaigns')
      .select('slug, title, device_name, goal_cents, currency, is_active')
      .eq('slug', slug)
      .maybeSingle();
    if (!campaign) throw new NotFoundException('Cagnotte introuvable.');

    const { data: dons } = await this.db
      .from('cagnotte_donations')
      .select('amount_cents')
      .eq('campaign_slug', slug)
      .eq('status', 'completed');
    const list: Array<{ amount_cents: number }> = dons || [];
    const raisedCents = list.reduce((s, d) => s + (Number(d.amount_cents) || 0), 0);

    return {
      slug: campaign.slug,
      title: campaign.title,
      deviceName: campaign.device_name,
      goalCents: campaign.goal_cents,
      currency: campaign.currency,
      raisedCents,
      donorCount: list.length,
      active: campaign.is_active,
    };
  }

  /** Liste des opérateurs Mobile Money actifs (pour le sélecteur front). */
  async getProviders(country?: string) {
    try {
      return await this.pawapay.getActiveConfig(country);
    } catch (e) {
      this.logger.warn(`getProviders: ${(e as Error).message}`);
      return null;
    }
  }

  private async loadActiveCampaign(slug: string) {
    const { data: campaign } = await this.db
      .from('cagnotte_campaigns')
      .select('slug, device_name, is_active')
      .eq('slug', slug)
      .maybeSingle();
    if (!campaign) throw new NotFoundException('Cagnotte introuvable.');
    if (!campaign.is_active) throw new BadRequestException('Cette cagnotte est clôturée.');
    return campaign;
  }

  private clampEurCents(amountCents: unknown): number {
    const n = Math.round(Number(amountCents) || 0);
    if (!Number.isFinite(n) || n < 100) throw new BadRequestException('Montant minimum : 1 €.');
    if (n > 500000) throw new BadRequestException('Montant maximum : 5 000 € par don.');
    return n;
  }

  private sanitize(s: unknown, max: number): string | null {
    const v = String(s ?? '').trim().slice(0, max);
    return v || null;
  }

  /** Europe — Stripe Checkout (carte, EUR). Renvoie l'URL de paiement hébergée. */
  async createStripe(slug: string, dto: {
    amountCents?: number; donorName?: string; donorMessage?: string;
  }) {
    const campaign = await this.loadActiveCampaign(slug);
    if (!isStripeConfigured()) {
      throw new ServiceUnavailableException('Paiement carte momentanément indisponible.');
    }
    const amountCents = this.clampEurCents(dto.amountCents);
    const donorName = this.sanitize(dto.donorName, 80);
    const donorMessage = this.sanitize(dto.donorMessage, 300);

    // On enregistre le don EN ATTENTE d'abord : son id voyage dans les metadata Stripe
    // et sert de référence au retour (confirmStripe).
    const { data: don, error: insErr } = await this.db
      .from('cagnotte_donations')
      .insert({
        campaign_slug: slug, provider: 'stripe', amount_cents: amountCents,
        display_amount: amountCents, display_currency: 'EUR',
        status: 'pending', donor_name: donorName, donor_message: donorMessage,
      })
      .select('id')
      .single();
    if (insErr) throw new BadRequestException(insErr.message);

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('line_items[0][price_data][currency]', 'eur');
    params.append('line_items[0][price_data][unit_amount]', String(amountCents));
    params.append('line_items[0][price_data][product_data][name]', `Cagnotte — ${campaign.device_name}`);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${this.frontBase}/cagnotte?don=merci&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${this.frontBase}/cagnotte?don=annule`);
    params.append('submit_type', 'donate');
    params.append('metadata[kind]', 'cagnotte');
    params.append('metadata[campaign]', slug);
    params.append('metadata[donation_id]', don.id);

    const session = await stripeCreateCheckoutSession(params);
    await this.db
      .from('cagnotte_donations')
      .update({ provider_ref: session.id })
      .eq('id', don.id);

    return { checkoutUrl: session.url, donationId: don.id };
  }

  /** Confirme un don Stripe au retour (success_url) : marque « complété » si payé. */
  async confirmStripe(sessionId: string) {
    const sid = String(sessionId || '').trim();
    if (!sid) throw new BadRequestException('session_id manquant.');
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sid)}`,
      { headers: { Authorization: stripeAuth() } },
    );
    if (!res.ok) throw new BadRequestException('Session Stripe introuvable.');
    const session = (await res.json()) as any;
    const paid = session?.payment_status === 'paid' || session?.status === 'complete';
    if (!paid) return { status: 'pending' };
    await this.markCompleted('stripe', sid);
    return { status: 'completed' };
  }

  /** Afrique — pawaPay (Mobile Money). Initie un dépôt ; le donateur confirme sur son tél. */
  async createPawapay(slug: string, dto: {
    amountCents?: number; phoneNumber?: string; provider?: string;
    country?: string; donorName?: string; donorMessage?: string;
  }) {
    const campaign = await this.loadActiveCampaign(slug);
    const amountCents = this.clampEurCents(dto.amountCents);
    const phone = String(dto.phoneNumber ?? '').replace(/[^0-9]/g, '');
    const provider = String(dto.provider ?? '').trim();
    const country = String(dto.country ?? '').trim().toUpperCase();
    if (phone.length < 7) throw new BadRequestException('Numéro Mobile Money invalide.');
    if (!provider) throw new BadRequestException('Opérateur Mobile Money requis.');

    const currency = CagnotteService.XOF_COUNTRIES.has(country) ? 'XOF' : 'XAF';
    const mmAmount = Math.round((amountCents / 100) * CagnotteService.CFA_PEG);

    const { data: don, error: insErr } = await this.db
      .from('cagnotte_donations')
      .insert({
        campaign_slug: slug, provider: 'pawapay', amount_cents: amountCents,
        display_amount: mmAmount, display_currency: currency, country: country || null,
        status: 'pending', donor_name: this.sanitize(dto.donorName, 80),
        donor_message: this.sanitize(dto.donorMessage, 300),
      })
      .select('id')
      .single();
    if (insErr) throw new BadRequestException(insErr.message);

    const depositId = randomUUID();
    await this.db.from('cagnotte_donations').update({ provider_ref: depositId }).eq('id', don.id);

    const result = await this.pawapay.initiateDeposit({
      depositId,
      amount: String(mmAmount),
      currency,
      payer: { type: 'MMO', accountDetails: { phoneNumber: phone, provider } },
      customerMessage: 'Cagnotte cultes',
      metadata: [{ campaign: slug }, { donationId: don.id }],
    });

    return {
      depositId,
      donationId: don.id,
      status: result.status,
      displayAmount: mmAmount,
      displayCurrency: currency,
    };
  }

  /** Poll de l'état d'un dépôt pawaPay ; marque « complété » quand confirmé. */
  async pollPawapay(depositId: string) {
    const id = String(depositId || '').trim();
    if (!id) throw new BadRequestException('depositId manquant.');
    const status = await this.pawapay.getDepositStatus(id);
    const s = String((status as any)?.status ?? status ?? '').toUpperCase();
    if (s === 'COMPLETED') {
      await this.markCompleted('pawapay', id);
      return { status: 'completed' };
    }
    if (['FAILED', 'REJECTED'].includes(s)) {
      await this.db
        .from('cagnotte_donations')
        .update({ status: 'failed' })
        .eq('provider', 'pawapay')
        .eq('provider_ref', id)
        .eq('status', 'pending');
      return { status: 'failed' };
    }
    return { status: 'pending' };
  }

  /** Idempotent : passe un don `pending` → `completed` (unique index provider+ref). */
  private async markCompleted(provider: string, providerRef: string) {
    await this.db
      .from('cagnotte_donations')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('provider', provider)
      .eq('provider_ref', providerRef)
      .eq('status', 'pending');
  }
}
