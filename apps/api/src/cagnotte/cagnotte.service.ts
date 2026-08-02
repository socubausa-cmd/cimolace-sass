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
  /** Indicatif téléphonique par pays (zone CFA) — PawaPay exige un MSISDN
   *  international SANS « + » ni « 0 » initial (ex. Gabon 077… → 24177…). */
  private static readonly DIAL_CODES: Record<string, string> = {
    CMR: '237', GAB: '241', COG: '242', TCD: '235', CAF: '236', GNQ: '240',
    CIV: '225', SEN: '221', BEN: '229', BFA: '226', MLI: '223', NER: '227', TGO: '228', GNB: '245',
  };

  /** Numéro Mobile Money → MSISDN international (chiffres seuls, 0 initial retiré,
   *  indicatif pays préfixé s'il manque). Sinon PawaPay renvoie INVALID_PAYER_FORMAT. */
  private normalizeMsisdn(raw: unknown, country: string): string {
    let p = String(raw ?? '').replace(/\D/g, '');
    const dial = CagnotteService.DIAL_CODES[country];
    if (dial) {
      p = p.replace(/^0+/, '');
      if (!p.startsWith(dial)) p = dial + p;
    }
    return p;
  }

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
      .select('slug, title, device_name, goal_cents, currency, is_active, booking_url, booking_label, image_url')
      .eq('slug', slug)
      .maybeSingle();
    if (!campaign) throw new NotFoundException('Cagnotte introuvable.');

    // Réconciliation paresseuse : re-vérifie les dons « pending » récents auprès de
    // Stripe/PawaPay et les passe « completed » s'ils sont payés. Le total progresse
    // ainsi même si le donateur a quitté la page avant la confirmation (pas besoin
    // de webhook). Borné (récents + limité) pour rester rapide.
    await this.reconcilePending(slug).catch(() => {});

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
      bookingUrl: campaign.booking_url || null,
      bookingLabel: campaign.booking_label || null,
      imageUrl: campaign.image_url || null,
    };
  }

  /** Re-vérifie les dons « pending » récents (Stripe/PawaPay) et confirme les payés. */
  private async reconcilePending(slug: string) {
    const cutoff = new Date(Date.now() - 3 * 3600_000).toISOString();
    const { data: pend } = await this.db
      .from('cagnotte_donations')
      .select('provider, provider_ref')
      .eq('campaign_slug', slug)
      .eq('status', 'pending')
      .gte('created_at', cutoff)
      .not('provider_ref', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);
    for (const d of pend || []) {
      try {
        if (d.provider === 'stripe') await this.confirmStripe(d.provider_ref);
        else if (d.provider === 'pawapay') await this.pollPawapay(d.provider_ref);
      } catch {
        /* un don pas encore payé reste « pending » — on réessaiera au prochain chargement */
      }
    }
  }

  /** Liste publique des donateurs (dons confirmés) — « mur des donateurs ». */
  async listDonors(slug: string) {
    const { data } = await this.db
      .from('cagnotte_donations')
      .select('donor_name, donor_message, amount_cents, display_amount, display_currency, provider, completed_at, created_at')
      .eq('campaign_slug', slug)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(50);
    return (data || []).map((d: any) => ({
      name: String(d.donor_name || '').trim() || 'Anonyme',
      message: d.donor_message || null,
      amountCents: d.amount_cents,
      displayAmount: d.display_amount,
      displayCurrency: d.display_currency,
      provider: d.provider,
      at: d.completed_at || d.created_at,
    }));
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
    amountCents?: number; donorName?: string; donorMessage?: string; donorEmail?: string;
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
        donor_email: this.sanitize(dto.donorEmail, 200),
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
    amountCents?: number; mobileMoneyAmount?: number; phoneNumber?: string; provider?: string;
    country?: string; donorName?: string; donorMessage?: string; donorEmail?: string;
  }) {
    const campaign = await this.loadActiveCampaign(slug);
    const amountCents = this.clampEurCents(dto.amountCents);
    const provider = String(dto.provider ?? '').trim();
    const country = String(dto.country ?? '').trim().toUpperCase();
    const phone = this.normalizeMsisdn(dto.phoneNumber, country);
    if (phone.length < 8) throw new BadRequestException('Numéro Mobile Money invalide.');
    if (!provider) throw new BadRequestException('Opérateur Mobile Money requis.');

    const currency = CagnotteService.XOF_COUNTRIES.has(country) ? 'XOF' : 'XAF';
    // Montant Mobile Money EXACT si fourni (le front affiche + fait payer en CFA) ;
    // sinon conversion depuis les centimes EUR.
    const mmAmount = Number.isFinite(Number(dto.mobileMoneyAmount)) && Number(dto.mobileMoneyAmount) > 0
      ? Math.round(Number(dto.mobileMoneyAmount))
      : Math.round((amountCents / 100) * CagnotteService.CFA_PEG);

    const { data: don, error: insErr } = await this.db
      .from('cagnotte_donations')
      .insert({
        campaign_slug: slug, provider: 'pawapay', amount_cents: amountCents,
        display_amount: mmAmount, display_currency: currency, country: country || null,
        status: 'pending', donor_name: this.sanitize(dto.donorName, 80),
        donor_message: this.sanitize(dto.donorMessage, 300),
        donor_email: this.sanitize(dto.donorEmail, 200),
        donor_phone: phone,
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

  /** Idempotent : passe un don `pending` → `completed` (unique index provider+ref).
   *  `.select()` après l'update ne renvoie une ligne QUE sur la transition RÉELLE
   *  pending→completed → le remerciement part une seule fois (pas à chaque poll/réconcile). */
  private async markCompleted(provider: string, providerRef: string) {
    const { data: updated } = await this.db
      .from('cagnotte_donations')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('provider', provider)
      .eq('provider_ref', providerRef)
      .eq('status', 'pending')
      .select('id, campaign_slug, donor_email, donor_name, donor_phone, display_amount, display_currency, amount_cents, provider');
    const row = (updated as any[])?.[0];
    if (!row) return;
    // Tenant de la campagne résolu UNE fois, partagé par les 2 réactions (email + CRM).
    const tenantId = await this.resolveCampaignTenantId(row.campaign_slug);
    if (row.donor_email) {
      void this.sendThankYou(row, tenantId).catch((e) =>
        this.logger.warn(`Cagnotte remerciement KO: ${(e as Error).message}`));
    }
    void this.ingestDonorToCrm(row, tenantId).catch((e) =>
      this.logger.warn(`Cagnotte→CRM KO: ${(e as Error).message}`));
  }

  /** Slug de campagne → tenant_id (via cagnotte_campaigns.tenant_slug, défaut 'isna'). */
  private async resolveCampaignTenantId(campaignSlug: string): Promise<string | null> {
    const { data: camp } = await this.db
      .from('cagnotte_campaigns').select('tenant_slug').eq('slug', campaignSlug).maybeSingle();
    const tenantSlug = (camp as any)?.tenant_slug || 'isna';
    const { data: t } = await this.db.from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
    return (t as any)?.id || null;
  }

  /**
   * Remerciement au donateur (best-effort) : email via `email_queue` (worker isna-worker
   * → Resend, expéditeur du tenant) avec le lien de la séance de prière (RDV public).
   * Envoyé UNE fois, à la confirmation réelle du paiement (voir markCompleted).
   */
  private async sendThankYou(row: {
    campaign_slug: string; donor_email: string; donor_name?: string | null;
    display_amount?: number | null; display_currency?: string | null;
  }, tenantId: string | null): Promise<void> {
    const email = String(row.donor_email || '').trim();
    if (!email) return;

    const { data: camp } = await this.db
      .from('cagnotte_campaigns')
      .select('title, booking_url, booking_label')
      .eq('slug', row.campaign_slug)
      .maybeSingle();
    const c = camp as any;
    const bookingPath = c?.booking_url || '/rendez-vous-priere';
    const bookingUrl = /^https?:\/\//i.test(bookingPath)
      ? bookingPath
      : `${this.frontBase}${bookingPath}`;
    const bookingLabel = c?.booking_label || 'Réserver ma séance de prière';

    // Expéditeur (email_from) que le worker utilisera ; sinon expéditeur plateforme.
    let from: string | null = null;
    let fromName: string | null = null;
    if (tenantId) {
      const { data: ns } = await this.db
        .from('tenant_notification_settings')
        .select('email_from, email_from_name')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      from = (ns as any)?.email_from ?? null;
      fromName = (ns as any)?.email_from_name ?? null;
    }

    const name = String(row.donor_name || '').trim();
    const cur = row.display_currency || '';
    // display_amount = CENTIMES pour EUR (Stripe), unités entières pour XAF/XOF (PawaPay).
    const amt = row.display_amount == null
      ? ''
      : cur === 'EUR'
        ? `${(Number(row.display_amount) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
        : `${Number(row.display_amount).toLocaleString('fr-FR')} ${cur}`.trim();
    const hello = name ? `Merci ${name}` : 'Merci du fond du cœur';

    await this.db.from('email_queue').insert({
      tenant_id: tenantId,
      to: email,
      from,
      from_name: fromName,
      subject: 'Merci pour votre don 🙏 — réservez votre séance de prière',
      html_body:
        `<div style="max-width:600px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;">` +
          // COUVERTURE — bandeau sombre + œil Prorascience (blanc transparent → visible sur fond sombre)
          `<div style="background:#262624;padding:30px 24px;text-align:center;border-radius:14px 14px 0 0;">` +
            `<img src="${this.frontBase}/prorascience-eye.png" alt="Prorascience" width="58" style="width:58px;height:auto;display:inline-block;" />` +
            `<div style="color:#f5f4ee;font-family:Georgia,'Times New Roman',serif;font-size:19px;letter-spacing:3px;margin-top:10px;">PRORASCIENCE</div>` +
            `<div style="color:#d97757;font-size:11px;letter-spacing:2px;margin-top:5px;text-transform:uppercase;">Cagnotte solidaire</div>` +
          `</div>` +
          // CORPS
          `<div style="background:#faf8f4;padding:32px 28px;color:#2b2926;border-radius:0 0 14px 14px;">` +
            `<h2 style="margin:0 0 14px;font-size:22px;color:#1c1a18;">${hello} !</h2>` +
            `<p style="font-size:15px;line-height:1.65;margin:0 0 14px;">Votre don${amt ? ` de <strong>${amt}</strong>` : ''} à la cagnotte Prorascience est bien reçu. Grâce à vous, nous nous rapprochons du matériel pour filmer et enregistrer chaque culte en haute qualité.</p>` +
            `<p style="font-size:15px;line-height:1.65;margin:0 0 8px;">En remerciement, nous vous offrons une <strong>séance de prière</strong> pour l'intention de votre choix.</p>` +
            `<div style="text-align:center;margin:26px 0;">` +
              `<a href="${bookingUrl}" style="display:inline-block;padding:14px 30px;background:#d97757;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">${bookingLabel}</a>` +
            `</div>` +
            `<p style="color:#8a857e;font-size:12.5px;line-height:1.5;margin:0 0 26px;">Si le bouton ne fonctionne pas, ouvrez ce lien : <a href="${bookingUrl}" style="color:#d97757;">${bookingUrl}</a></p>` +
            // SIGNATURE
            `<div style="border-top:1px solid #e6e1d8;padding-top:18px;">` +
              `<p style="font-size:14px;line-height:1.5;margin:0;">Avec toute notre gratitude,</p>` +
              `<p style="font-size:15px;font-weight:700;margin:6px 0 0;color:#1c1a18;">L'équipe Prorascience</p>` +
              `<p style="font-size:12.5px;color:#8a857e;margin:3px 0 0;">L'unification de la Science et de la Spiritualité</p>` +
              `<p style="font-size:12.5px;margin:10px 0 0;"><a href="${this.frontBase}" style="color:#d97757;text-decoration:none;">prorascience.org</a></p>` +
            `</div>` +
          `</div>` +
        `</div>`,
    });
  }

  /**
   * Ingestion CRM (best-effort) : chaque donateur confirmé devient un contact CRM
   * (dédup par email — index unique tenant+email — sinon par téléphone), source 'cagnotte',
   * + une activité journalisant le montant. → le propriétaire le contacte/appelle depuis /liri/crm.
   */
  private async ingestDonorToCrm(row: {
    campaign_slug: string; donor_email?: string | null; donor_name?: string | null;
    donor_phone?: string | null; display_amount?: number | null; display_currency?: string | null;
    amount_cents?: number | null; provider?: string | null;
  }, tenantId: string | null): Promise<void> {
    if (!tenantId) return;
    const email = String(row.donor_email || '').trim().toLowerCase();
    const phone = String(row.donor_phone || '').trim();
    if (!email && !phone) return; // rien pour identifier/joindre le donateur
    const name = String(row.donor_name || '').trim();

    // Dédup : email (unique tenant+email) puis téléphone.
    let contactId: string | null = null;
    if (email) {
      const { data: ex } = await this.db
        .from('crm_contacts').select('id').eq('tenant_id', tenantId).ilike('email', email).limit(1).maybeSingle();
      contactId = (ex as any)?.id ?? null;
    }
    if (!contactId && phone) {
      const { data: ex } = await this.db
        .from('crm_contacts').select('id').eq('tenant_id', tenantId).eq('phone', phone).limit(1).maybeSingle();
      contactId = (ex as any)?.id ?? null;
    }
    if (!contactId) {
      const { data: created, error } = await this.db
        .from('crm_contacts')
        .insert({ tenant_id: tenantId, first_name: name || 'Donateur', email: email || null, phone: phone || null, source: 'cagnotte' })
        .select('id').single();
      if (error) {
        // Course : conflit unique (tenant,email) → re-sélectionne le contact existant.
        if (email) {
          const { data: ex } = await this.db
            .from('crm_contacts').select('id').eq('tenant_id', tenantId).ilike('email', email).limit(1).maybeSingle();
          contactId = (ex as any)?.id ?? null;
        }
        if (!contactId) throw new Error(error.message);
      } else {
        contactId = (created as any).id;
      }
    }

    const cur = row.display_currency || '';
    const amt = row.display_amount == null
      ? ''
      : cur === 'EUR'
        ? `${(Number(row.display_amount) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
        : `${Number(row.display_amount).toLocaleString('fr-FR')} ${cur}`.trim();
    await this.db.from('crm_activities').insert({
      tenant_id: tenantId,
      entity_type: 'contact',
      entity_id: contactId,
      type: 'cagnotte_donation',
      title: `Don cagnotte${amt ? ` : ${amt}` : ''}`,
      meta: { campaign: row.campaign_slug, amount_cents: row.amount_cents ?? null, currency: cur, provider: row.provider ?? null },
    });
  }
}
