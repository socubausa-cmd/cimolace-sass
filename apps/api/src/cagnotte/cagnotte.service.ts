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
import {
  isWhatsAppConfigured,
  resolveWaMsisdn,
  sendWhatsAppTemplate,
} from '../common/whatsapp.util';

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

  // ── STUDIO PÉDAGOGIQUE — financement participatif PAR ÉQUIPEMENT ──────────
  // Architecture : chaque équipement = UNE campagne cagnotte (slug `studio-*`,
  // objectif = prix) + `studio-fonds` pour la contribution libre. Les montants
  // viennent donc des transactions réellement enregistrées (Stripe/pawaPay),
  // et le catalogue riche (image, utilité, ordre, achat réel, preuve) vit dans
  // tenants.metadata.studio_campaign — géré no-code dans /liri/studio.

  private static readonly STUDIO_TENANT = 'isna';
  private static readonly STUDIO_FONDS = 'studio-fonds';

  private async studioMeta() {
    const { data: t } = await this.db.from('tenants').select('id, metadata').eq('slug', CagnotteService.STUDIO_TENANT).maybeSingle();
    const sc = (t as any)?.metadata?.studio_campaign || {};
    return {
      tenantId: (t as any)?.id || null,
      tenantMeta: (t as any)?.metadata || {},
      titre: String(sc.titre || 'Ensemble, construisons notre studio pédagogique'),
      intro: String(sc.intro || ''),
      cloturee: sc.cloturee === true,
      equipements: Array.isArray(sc.equipements) ? sc.equipements : [],
      dejaDisponibles: Array.isArray(sc.dejaDisponibles) ? sc.dejaDisponibles : [],
    };
  }

  /** Sommes confirmées par campagne (centimes EUR normalisés). */
  private async studioSommes(slugs: string[]) {
    const parSlug = new Map<string, number>();
    if (!slugs.length) return parSlug;
    const { data } = await this.db
      .from('cagnotte_donations')
      .select('campaign_slug, amount_cents')
      .in('campaign_slug', slugs)
      .eq('status', 'completed');
    for (const d of data || []) {
      parSlug.set(d.campaign_slug, (parSlug.get(d.campaign_slug) || 0) + Number(d.amount_cents || 0));
    }
    return parSlug;
  }

  /** Vue PUBLIQUE du studio : équipements + progressions + stats + mur. */
  async studioOverview() {
    const meta = await this.studioMeta();
    const slugs = meta.equipements.map((e: any) => String(e.slug)).concat(CagnotteService.STUDIO_FONDS);
    const sommes = await this.studioSommes(slugs);

    const equipements = meta.equipements
      .slice()
      .sort((a: any, b: any) => (Number(a.ordre) || 99) - (Number(b.ordre) || 99))
      .map((e: any) => {
        const objectifCents = Math.round(Number(e.prixEur || 0) * 100);
        const collecteCents = sommes.get(String(e.slug)) || 0;
        const restantCents = Math.max(0, objectifCents - collecteCents);
        const finance = objectifCents > 0 && collecteCents >= objectifCents;
        return {
          slug: String(e.slug),
          label: String(e.label || ''),
          desc: String(e.desc || ''),
          utilite: String(e.utilite || ''),
          image: String(e.image || ''),
          images: Array.isArray(e.images) ? e.images : [],
          presentation: String(e.presentation || ''),
          prixEur: Number(e.prixEur || 0),
          objectifCents,
          collecteCents,
          restantCents,
          pct: objectifCents > 0 ? Math.min(100, Math.round((collecteCents / objectifCents) * 100)) : 0,
          finance,
          achete: e.achete && typeof e.achete === 'object' ? e.achete : null,
        };
      });

    const fondsCents = sommes.get(CagnotteService.STUDIO_FONDS) || 0;
    const objectifCents = equipements.reduce((s: number, e: any) => s + e.objectifCents, 0);
    const collecteCents = equipements.reduce((s: number, e: any) => s + e.collecteCents, 0) + fondsCents;
    const depenseCents = equipements.reduce((s: number, e: any) => s + Math.round(Number(e.achete?.prixPayeEur || 0) * 100), 0);

    // Mur des contributeurs — le nom n'apparaît QUE s'il a été donné (case
    // explicite côté formulaire) ; sinon « Anonyme ».
    const { data: dons } = await this.db
      .from('cagnotte_donations')
      .select('donor_name, amount_cents, display_amount, display_currency, campaign_slug, completed_at, created_at')
      .in('campaign_slug', slugs)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .limit(40);
    const parLabel = new Map(equipements.map((e: any) => [e.slug, e.label]));

    return {
      titre: meta.titre,
      intro: meta.intro,
      cloturee: meta.cloturee,
      objectifCents,
      collecteCents,
      fondsCents,
      depenseCents,
      disponibleCents: Math.max(0, collecteCents - depenseCents),
      pct: objectifCents > 0 ? Math.min(100, Math.round((collecteCents / objectifCents) * 100)) : 0,
      nbFinances: equipements.filter((e: any) => e.finance).length,
      nbRestants: equipements.filter((e: any) => !e.finance).length,
      equipements,
      dejaDisponibles: meta.dejaDisponibles,
      donateurs: (dons || []).map((d: any) => ({
        name: String(d.donor_name || '').trim() || 'Anonyme',
        amountCents: d.amount_cents,
        displayAmount: d.display_amount,
        displayCurrency: d.display_currency,
        equipement: parLabel.get(d.campaign_slug) || (d.campaign_slug === CagnotteService.STUDIO_FONDS ? 'Fonds général' : d.campaign_slug),
        at: d.completed_at || d.created_at,
      })),
    };
  }

  /** Garde anti-dépassement : une contribution fléchée sur un équipement ne peut
   *  pas excéder le restant à financer (l'excédent va au fonds général, choix
   *  explicite du contributeur côté page). Le fonds général reste libre. */
  private async garantirPlafondStudio(slug: string, amountCents: number) {
    if (!slug.startsWith('studio-') || slug === CagnotteService.STUDIO_FONDS) return;
    const { data: camp } = await this.db.from('cagnotte_campaigns').select('goal_cents').eq('slug', slug).maybeSingle();
    const objectif = Number((camp as any)?.goal_cents || 0);
    if (!objectif) return;
    const sommes = await this.studioSommes([slug]);
    const restant = Math.max(0, objectif - (sommes.get(slug) || 0));
    if (restant <= 0) throw new BadRequestException('Cet équipement est déjà entièrement financé — merci ! Vous pouvez soutenir le fonds général du studio.');
    if (amountCents > restant) {
      throw new BadRequestException(
        `Il ne reste que ${(restant / 100).toFixed(0)} € à financer pour cet équipement. Contribuez ce montant, ou versez librement au fonds général du studio.`,
      );
    }
  }

  /** Catalogue + contributions — vue ADMIN (LIRI → Studio). */
  async studioAdmin() {
    const meta = await this.studioMeta();
    const slugs = meta.equipements.map((e: any) => String(e.slug)).concat(CagnotteService.STUDIO_FONDS);
    const { data: dons } = await this.db
      .from('cagnotte_donations')
      .select('id, campaign_slug, provider, amount_cents, display_amount, display_currency, status, donor_name, donor_email, donor_phone, created_at, completed_at')
      .in('campaign_slug', slugs.length ? slugs : ['studio-fonds'])
      .order('created_at', { ascending: false })
      .limit(300);
    const publicVue = await this.studioOverview();
    return { ...publicVue, contributions: dons || [] };
  }

  /** Sauvegarde ADMIN : catalogue assaini + upsert des campagnes par équipement. */
  async studioAdminSave(dto: { titre?: string; intro?: string; cloturee?: boolean; equipements?: any; dejaDisponibles?: any }) {
    const meta = await this.studioMeta();
    if (!meta.tenantId) throw new NotFoundException('Tenant du studio introuvable.');

    const equipements = Array.isArray(dto.equipements)
      ? dto.equipements.slice(0, 30).map((e: any, i: number) => {
          const label = String(e?.label || '').trim().slice(0, 80);
          if (!label) return null;
          const brut = String(e?.slug || '').trim() || label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const slug = (brut.startsWith('studio-') ? brut : `studio-${brut}`).slice(0, 60);
          if (slug === CagnotteService.STUDIO_FONDS) return null;
          const image = String(e?.image || '').trim().slice(0, 300);
          // Galerie de la fiche portfolio : jusqu'à 8 visuels (relatifs ou https).
          const images = Array.isArray(e?.images)
            ? e.images.map((u: any) => String(u || '').trim().slice(0, 300))
                .filter((u: string) => /^(\/|https:\/\/)/.test(u)).slice(0, 8)
            : [];
          const presentation = String(e?.presentation || '').trim().slice(0, 2500);
          const achete = e?.achete && typeof e.achete === 'object'
            ? {
                date: String(e.achete.date || '').slice(0, 10),
                prixPayeEur: Math.max(0, Math.min(20000, Number(e.achete.prixPayeEur) || 0)),
                photo: String(e.achete.photo || '').trim().slice(0, 300),
                facture: String(e.achete.facture || '').trim().slice(0, 300),
                installe: e.achete.installe === true,
              }
            : null;
          return {
            slug,
            label,
            prixEur: Math.max(1, Math.min(20000, Number(e?.prixEur) || 1)),
            desc: String(e?.desc || '').trim().slice(0, 300),
            utilite: String(e?.utilite || '').trim().slice(0, 700),
            image: /^(\/|https:\/\/)/.test(image) ? image : '',
            ...(images.length ? { images } : {}),
            ...(presentation ? { presentation } : {}),
            ordre: Number.isFinite(Number(e?.ordre)) ? Number(e.ordre) : i + 1,
            ...(achete && (achete.date || achete.prixPayeEur || achete.photo) ? { achete } : {}),
          };
        }).filter(Boolean)
      : undefined;

    const dejaDisponibles = Array.isArray(dto.dejaDisponibles)
      ? dto.dejaDisponibles.slice(0, 20).map((d: any) => ({
          label: String(d?.label || '').trim().slice(0, 80),
          desc: String(d?.desc || '').trim().slice(0, 200),
        })).filter((d: any) => d.label)
      : undefined;

    const sc = { ...(meta.tenantMeta.studio_campaign || {}) };
    if (dto.titre !== undefined) sc.titre = String(dto.titre).trim().slice(0, 120);
    if (dto.intro !== undefined) sc.intro = String(dto.intro).trim().slice(0, 800);
    if (dto.cloturee !== undefined) sc.cloturee = dto.cloturee === true;
    if (equipements !== undefined) sc.equipements = equipements;
    if (dejaDisponibles !== undefined) sc.dejaDisponibles = dejaDisponibles;

    const { error } = await this.db.from('tenants')
      .update({ metadata: { ...meta.tenantMeta, studio_campaign: sc } })
      .eq('id', meta.tenantId);
    if (error) throw new BadRequestException(error.message);

    // Upsert des campagnes réelles (une par équipement + le fonds général) :
    // c'est LÀ que les paiements Stripe/pawaPay s'enregistrent.
    const cible = equipements !== undefined ? equipements : (sc.equipements || []);
    const lignes = cible.map((e: any) => ({
      slug: e.slug,
      title: e.label,
      device_name: e.label,
      goal_cents: Math.round(e.prixEur * 100),
      currency: 'EUR',
      is_active: sc.cloturee !== true && !(e.achete && e.achete.date),
      image_url: e.image || null,
      tenant_slug: CagnotteService.STUDIO_TENANT,
    })).concat([{
      slug: CagnotteService.STUDIO_FONDS,
      title: 'Fonds général du studio pédagogique',
      device_name: 'Fonds général du studio',
      // ⚠️ contrainte goal_cents > 0 en base ; le fonds n'affiche jamais d'objectif.
      goal_cents: 100,
      currency: 'EUR',
      is_active: sc.cloturee !== true,
      image_url: null,
      tenant_slug: CagnotteService.STUDIO_TENANT,
    }]);
    for (const l of lignes) {
      const { error: e2 } = await this.db.from('cagnotte_campaigns').upsert(l, { onConflict: 'slug' });
      if (e2) this.logger.warn(`upsert campagne ${l.slug}: ${e2.message}`);
    }
    return this.studioAdmin();
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
    await this.garantirPlafondStudio(slug, amountCents);
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
    // CAPTURE AUTO des coordonnées RÉELLES du payeur (Stripe collecte l'e-mail au checkout ;
    // le formulaire de don ne le capture pas toujours). On ne remplit que les champs VIDES →
    // remerciement e-mail + WhatsApp fiables sans jamais écraser ce que le donateur a saisi.
    try {
      const cd = session?.customer_details || {};
      const { data: cur } = await this.db
        .from('cagnotte_donations')
        .select('donor_email, donor_name, donor_phone')
        .eq('provider', 'stripe').eq('provider_ref', sid).eq('status', 'pending')
        .maybeSingle();
      const patch: Record<string, unknown> = {};
      if (cd.email && !(cur as any)?.donor_email) patch.donor_email = String(cd.email).slice(0, 200);
      if (cd.name && !(cur as any)?.donor_name) patch.donor_name = String(cd.name).slice(0, 80);
      if (cd.phone && !(cur as any)?.donor_phone) patch.donor_phone = String(cd.phone).replace(/[^\d+]/g, '').slice(0, 20);
      if (Object.keys(patch).length) {
        await this.db.from('cagnotte_donations').update(patch)
          .eq('provider', 'stripe').eq('provider_ref', sid).eq('status', 'pending');
      }
    } catch (e) {
      this.logger.warn(`Cagnotte capture Stripe KO: ${(e as Error).message}`);
    }
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
    await this.garantirPlafondStudio(slug, amountCents);
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
    // Tenant de la campagne résolu UNE fois, partagé par les réactions (email + WhatsApp + CRM).
    const tenantId = await this.resolveCampaignTenantId(row.campaign_slug);
    void this.notifyDonor(row, tenantId).catch((e) =>
      this.logger.warn(`Cagnotte notif donateur KO: ${(e as Error).message}`));
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
            `<img src="${this.frontBase}/ngowazulu-logo.png" alt="Ngowazulu" width="96" style="width:96px;height:auto;display:inline-block;" />` +
            `<div style="color:#f5f4ee;font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:3px;margin-top:8px;">NGOWAZULU</div>` +
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
              `<p style="font-size:16px;font-weight:700;margin:6px 0 0;color:#1c1a18;">Ngowazulu</p>` +
              `<p style="font-size:12.5px;color:#8a857e;margin:3px 0 0;">Prorascience — L'unification de la Science et de la Spiritualité</p>` +
              `<p style="font-size:12.5px;margin:10px 0 0;"><a href="${this.frontBase}" style="color:#d97757;text-decoration:none;">prorascience.org</a></p>` +
            `</div>` +
          `</div>` +
        `</div>`,
    });
  }

  /** Lien public de réservation de la séance (surchargeable via BOOKING_PUBLIC_URL). */
  private bookingLink(): string {
    return process.env.BOOKING_PUBLIC_URL || `${this.frontBase}/rendez-vous-priere`;
  }

  /** Notifie le donateur à la confirmation : e-mail de remerciement + WhatsApp (best-effort),
   *  et marque thanked_at / wa_notified_at pour le suivi des relances J+1. */
  private async notifyDonor(row: any, tenantId: string | null): Promise<void> {
    if (row.donor_email) {
      try {
        await this.sendThankYou(row, tenantId);
        await this.db.from('cagnotte_donations')
          .update({ thanked_at: new Date().toISOString() }).eq('id', row.id);
      } catch (e) {
        this.logger.warn(`Cagnotte remerciement e-mail KO: ${(e as Error).message}`);
      }
    }
    const wa = await this.resolveDonorWa(row, tenantId);
    if (wa) {
      const ok = await this.sendDonorWhatsApp(wa, `merci pour votre don 🙏 réservez votre séance ici : ${this.bookingLink()}`);
      if (ok) {
        await this.db.from('cagnotte_donations')
          .update({ wa_notified_at: new Date().toISOString() }).eq('id', row.id);
      }
    }
  }

  /** Résout un MSISDN pour le donateur : téléphone direct (pawaPay) OU croisé depuis sa
   *  demande de RDV (appointments.notes, match e-mail). null si rien de fiable (jamais d'inconnu). */
  private async resolveDonorWa(row: any, tenantId: string | null): Promise<string | null> {
    const direct = resolveWaMsisdn(row.donor_phone);
    if (direct) return direct;
    const email = String(row.donor_email || '').trim();
    if (!email) return null;
    let q = this.db.from('appointments').select('notes').ilike('notes', `%${email}%`).limit(1);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data } = await q;
    const notes = String((data as any[])?.[0]?.notes || '');
    const m = notes.match(/WhatsApp\s*:\s*([+0-9 ]{6,})/i);
    return m ? resolveWaMsisdn(m[1]) : null;
  }

  /** A-t-il « fait signe » : une demande de RDV existe pour cet e-mail. */
  private async donorHasRdv(email: string, tenantId: string | null): Promise<boolean> {
    const e = String(email || '').trim();
    if (!e) return false;
    let q = this.db.from('appointments').select('id').ilike('notes', `%${e}%`).limit(1);
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data } = await q;
    return !!(data as any[])?.length;
  }

  /** Envoi WhatsApp via le gabarit RDV approuvé (best-effort). */
  private async sendDonorWhatsApp(msisdn: string, phrase: string): Promise<boolean> {
    if (!isWhatsAppConfigured()) return false;
    const r = await sendWhatsAppTemplate(msisdn, {
      template: process.env.WHATSAPP_TEMPLATE_RDV || 'rdv_notification',
      lang: process.env.WHATSAPP_TEMPLATE_LANG || 'fr',
      bodyParams: ['votre séance de prière', phrase],
    });
    if (!r.ok) this.logger.warn(`Cagnotte WhatsApp KO: ${r.error}`);
    return r.ok;
  }

  /** E-mail de RELANCE (best-effort) au donateur qui n'a pas encore réservé sa séance. */
  private async sendReminderEmail(row: any, tenantId: string | null): Promise<void> {
    const email = String(row.donor_email || '').trim();
    if (!email) return;
    let from: string | null = null, fromName: string | null = null;
    if (tenantId) {
      const { data: ns } = await this.db.from('tenant_notification_settings')
        .select('email_from, email_from_name').eq('tenant_id', tenantId).maybeSingle();
      from = (ns as any)?.email_from ?? null;
      fromName = (ns as any)?.email_from_name ?? null;
    }
    const name = String(row.donor_name || '').trim();
    const lien = this.bookingLink();
    await this.db.from('email_queue').insert({
      tenant_id: tenantId, to: email, from, from_name: fromName,
      subject: 'Votre séance de prière vous attend 🙏',
      html_body:
        `<h2>${name ? `Bonjour ${name}` : 'Bonjour'} 🙏</h2>`
        + `<p>Nous vous remercions encore pour votre don à Prorascience.</p>`
        + `<p>Votre <strong>séance de prière</strong> offerte n'est pas encore réservée — nous serions heureux de vous accueillir. Choisissez votre créneau ici :</p>`
        + `<p><a href="${lien}">${lien}</a></p>`
        + `<p style="color:#777;font-size:13px;">Avec toute notre gratitude,<br/>Ngowazulu — Prorascience</p>`,
    });
  }

  /** RELANCE QUOTIDIENNE (cron) : relance par e-mail + WhatsApp les donateurs qui ont donné mais
   *  n'ont PAS encore pris de RDV (« pas fait signe »), 24 h+ après le dernier contact, max 3 fois.
   *  Idempotent : garde-fous last_reminder_at (>24 h) + reminder_count (<3). */
  async remindDonors(): Promise<{ scanned: number; reminded: number }> {
    const dayMs = 24 * 3600 * 1000;
    const { data: rows } = await this.db
      .from('cagnotte_donations')
      .select('id, campaign_slug, donor_email, donor_name, donor_phone, display_amount, display_currency, thanked_at, reminder_count, last_reminder_at')
      .eq('status', 'completed')
      .lt('reminder_count', 3)
      .not('thanked_at', 'is', null);
    const list = (rows as any[]) || [];
    let reminded = 0;
    for (const row of list) {
      const lastContact = row.last_reminder_at || row.thanked_at;
      if (!lastContact || Date.now() - new Date(lastContact).getTime() < dayMs) continue;
      const tenantId = await this.resolveCampaignTenantId(row.campaign_slug);
      if (row.donor_email && await this.donorHasRdv(row.donor_email, tenantId)) continue; // a fait signe
      if (row.donor_email) {
        await this.sendReminderEmail(row, tenantId).catch((e) =>
          this.logger.warn(`Cagnotte relance e-mail KO: ${(e as Error).message}`));
      }
      const wa = await this.resolveDonorWa(row, tenantId);
      if (wa) await this.sendDonorWhatsApp(wa, `pensez à réserver votre séance de prière offerte : ${this.bookingLink()}`);
      await this.db.from('cagnotte_donations')
        .update({ reminder_count: (row.reminder_count || 0) + 1, last_reminder_at: new Date().toISOString() })
        .eq('id', row.id);
      reminded++;
    }
    return { scanned: list.length, reminded };
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
