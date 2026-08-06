import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { SupabaseService } from '../supabase/supabase.service';
import { PawaPayService } from '../pawapay/pawapay.service';
import {
  isStripeConfigured,
  stripeAuth,
  stripeCreateCheckoutSession,
} from '../billing/stripe-rest.util';

/**
 * Boutique numérique PUBLIQUE — vente d'un PDF à une visiteuse anonyme, sans compte.
 *
 *   Europe  → Stripe Checkout (carte, EUR)
 *   Afrique → pawaPay (Mobile Money, XAF/XOF)
 *
 * Le PRIX vient toujours de la base : le client envoie son e-mail, jamais un montant.
 * Le fichier vit dans un bucket PRIVÉ ; il n'est servi que contre un jeton opaque,
 * expirant et à usage limité, et chaque exemplaire est filigrané au nom de l'acheteuse.
 */
@Injectable()
export class BoutiqueService {
  private readonly logger = new Logger(BoutiqueService.name);

  private static readonly CFA_PEG = 655.957;
  private static readonly XOF_COUNTRIES = new Set([
    'BEN', 'BFA', 'CIV', 'GNB', 'MLI', 'NER', 'SEN', 'TGO',
  ]);
  private static readonly DIAL_CODES: Record<string, string> = {
    CMR: '237', GAB: '241', COG: '242', TCD: '235', CAF: '236', GNQ: '240',
    CIV: '225', SEN: '221', BEN: '229', BFA: '226', MLI: '223', NER: '227', TGO: '228', GNB: '245',
  };

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

  private get apiBase(): string {
    return (process.env.API_URL || 'https://api.cimolace.space').replace(/\/$/, '');
  }

  /** Numéro Mobile Money → MSISDN international (sinon pawaPay : INVALID_PAYER_FORMAT). */
  private normalizeMsisdn(raw: unknown, country: string): string {
    let p = String(raw ?? '').replace(/\D/g, '');
    const dial = BoutiqueService.DIAL_CODES[country];
    if (dial) {
      p = p.replace(/^0+/, '');
      if (!p.startsWith(dial)) p = dial + p;
    }
    return p;
  }

  private sanitize(s: unknown, max: number): string | null {
    const v = String(s ?? '').trim().slice(0, max);
    return v || null;
  }

  // ───────────────────────────── PRODUIT ─────────────────────────────

  private async loadProduct(slug: string) {
    const { data } = await this.db
      .from('digital_products')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (!data) throw new NotFoundException('Ouvrage introuvable.');
    return data;
  }

  /** Fiche publique du produit + résumé des avis. Ne fuit ni le chemin ni le bucket. */
  async getProduct(slug: string) {
    const p = await this.loadProduct(slug);

    const { data: reviews } = await this.db
      .from('site_reviews')
      .select('rating')
      .eq('product_slug', slug)
      .eq('status', 'approved');
    const ratings: number[] = (reviews || []).map((r: any) => Number(r.rating) || 0);
    const average = ratings.length
      ? Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10
      : null;

    const { count: sold } = await this.db
      .from('digital_orders')
      .select('id', { count: 'exact', head: true })
      .eq('product_slug', slug)
      .eq('status', 'completed');

    return {
      slug: p.slug,
      title: p.title,
      subtitle: p.subtitle,
      author: p.author,
      description: p.description,
      highlights: p.highlights ?? [],
      excerpts: p.excerpts ?? [],
      coverUrl: p.cover_url,
      pageCount: p.page_count,
      format: p.format,
      priceCents: p.price_cents,
      priceXaf: p.price_xaf,
      currency: p.currency,
      active: p.is_active,
      maxDownloads: p.max_downloads,
      downloadDays: p.download_days,
      reviewCount: ratings.length,
      reviewAverage: average,
      soldCount: sold ?? 0,
    };
  }

  /** Opérateurs Mobile Money actifs (sélecteur pawaPay). */
  async getProviders(country?: string) {
    try {
      return await this.pawapay.getActiveConfig(country);
    } catch (e) {
      this.logger.warn(`getProviders: ${(e as Error).message}`);
      return null;
    }
  }

  // ───────────────────────────── AVIS ─────────────────────────────

  async listReviews(slug: string, limit = 24) {
    const n = Math.min(60, Math.max(1, Number(limit) || 24));
    const { data } = await this.db
      .from('site_reviews')
      .select('id, author_name, author_role, rating, review_text, is_verified, submitted_at')
      .eq('product_slug', slug)
      .eq('status', 'approved')
      .order('submitted_at', { ascending: false })
      .limit(n);
    return (data || []).map((r: any) => ({
      id: r.id,
      authorName: r.author_name,
      authorRole: r.author_role,
      rating: r.rating,
      text: r.review_text,
      verified: r.is_verified,
      at: r.submitted_at,
    }));
  }

  /**
   * Dépôt d'un avis — toujours en `pending` : rien ne s'affiche sans modération.
   * Si l'e-mail correspond à une commande payée, l'avis est marqué « achat vérifié »
   * (on stocke l'id de commande, jamais l'e-mail : la policy anonyme de site_reviews
   * rend la ligne approuvée lisible en entier).
   */
  async submitReview(slug: string, dto: any) {
    if (dto?.website) return { status: 'received' }; // pot de miel
    await this.loadProduct(slug);

    let orderId: string | null = null;
    const email = String(dto.buyerEmail || '').trim().toLowerCase();
    if (email) {
      const { data: order } = await this.db
        .from('digital_orders')
        .select('id')
        .eq('product_slug', slug)
        .eq('status', 'completed')
        .ilike('buyer_email', email)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      orderId = (order as any)?.id ?? null;
    }

    const { error } = await this.db.from('site_reviews').insert({
      source: 'femme-nouvelle',
      product_slug: slug,
      order_id: orderId,
      author_name: this.sanitize(dto.authorName, 80),
      author_role: this.sanitize(dto.authorRole, 80),
      rating: Math.min(5, Math.max(1, Number(dto.rating) || 5)),
      review_text: this.sanitize(dto.reviewText, 2000),
      is_verified: !!orderId,
      status: 'pending',
    });
    if (error) throw new BadRequestException(error.message);

    return {
      status: 'received',
      verified: !!orderId,
      message: 'Merci. Votre témoignage sera publié après relecture.',
    };
  }

  // ───────────────────────────── ACHAT ─────────────────────────────

  private async loadActiveProduct(slug: string) {
    const p = await this.loadProduct(slug);
    if (!p.is_active) throw new BadRequestException('Cet ouvrage n’est plus en vente.');
    return p;
  }

  /** Europe — Stripe Checkout. Le montant est celui de la base. */
  async createStripe(slug: string, dto: { buyerEmail: string; buyerName?: string }) {
    const p = await this.loadActiveProduct(slug);
    if (!isStripeConfigured()) {
      throw new ServiceUnavailableException('Paiement carte momentanément indisponible.');
    }
    const amountCents = Number(p.price_cents);
    if (!Number.isFinite(amountCents) || amountCents < 50) {
      throw new BadRequestException('Prix de l’ouvrage non configuré.');
    }

    const { data: order, error } = await this.db
      .from('digital_orders')
      .insert({
        product_slug: slug,
        provider: 'stripe',
        amount_cents: amountCents,
        display_amount: amountCents,
        display_currency: 'EUR',
        status: 'pending',
        buyer_email: String(dto.buyerEmail).trim().toLowerCase(),
        buyer_name: this.sanitize(dto.buyerName, 80),
      })
      .select('id')
      .single();
    if (error) throw new BadRequestException(error.message);

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('customer_email', String(dto.buyerEmail).trim());
    params.append('line_items[0][price_data][currency]', 'eur');
    params.append('line_items[0][price_data][unit_amount]', String(amountCents));
    params.append('line_items[0][price_data][product_data][name]', p.title);
    params.append('line_items[0][price_data][product_data][description]', String(p.subtitle || 'Livre numérique (PDF)').slice(0, 200));
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${this.frontBase}/femme-nouvelle?achat=merci&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${this.frontBase}/femme-nouvelle?achat=annule`);
    params.append('metadata[kind]', 'digital_product');
    params.append('metadata[product]', slug);
    params.append('metadata[order_id]', order.id);

    const session = await stripeCreateCheckoutSession(params);
    await this.db.from('digital_orders').update({ provider_ref: session.id }).eq('id', order.id);

    return { checkoutUrl: session.url, orderId: order.id };
  }

  /** Confirmation au retour Stripe → délivre le lien de téléchargement si payé. */
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
    const delivered = await this.markCompleted('stripe', sid);
    return { status: 'completed', ...delivered };
  }

  /** Afrique — pawaPay (Mobile Money). Montant = prix CFA de la base. */
  async createPawapay(slug: string, dto: {
    buyerEmail: string; buyerName?: string; phoneNumber: string; provider: string; country: string;
  }) {
    const p = await this.loadActiveProduct(slug);
    const country = String(dto.country ?? '').trim().toUpperCase();
    const provider = String(dto.provider ?? '').trim();
    const phone = this.normalizeMsisdn(dto.phoneNumber, country);
    if (phone.length < 8) throw new BadRequestException('Numéro Mobile Money invalide.');
    if (!provider) throw new BadRequestException('Opérateur Mobile Money requis.');

    // XAF (CEMAC) et XOF (UEMOA) sont au même peg : le prix CFA vaut pour les deux.
    const currency = BoutiqueService.XOF_COUNTRIES.has(country) ? 'XOF' : 'XAF';
    const amountCents = Number(p.price_cents);
    const mmAmount = Number(p.price_xaf) > 0
      ? Math.round(Number(p.price_xaf))
      : Math.round((amountCents / 100) * BoutiqueService.CFA_PEG);

    const { data: order, error } = await this.db
      .from('digital_orders')
      .insert({
        product_slug: slug,
        provider: 'pawapay',
        amount_cents: amountCents,
        display_amount: mmAmount,
        display_currency: currency,
        country,
        status: 'pending',
        buyer_email: String(dto.buyerEmail).trim().toLowerCase(),
        buyer_name: this.sanitize(dto.buyerName, 80),
        buyer_phone: phone,
      })
      .select('id')
      .single();
    if (error) throw new BadRequestException(error.message);

    const depositId = randomUUID();
    await this.db.from('digital_orders').update({ provider_ref: depositId }).eq('id', order.id);

    const result = await this.pawapay.initiateDeposit({
      depositId,
      amount: String(mmAmount),
      currency,
      payer: { type: 'MMO', accountDetails: { phoneNumber: phone, provider } },
      customerMessage: 'Livre numerique',
      metadata: [{ product: slug }, { orderId: order.id }],
    });

    return {
      depositId,
      orderId: order.id,
      status: result.status,
      displayAmount: mmAmount,
      displayCurrency: currency,
    };
  }

  /** Poll pawaPay ; délivre le lien de téléchargement dès que le dépôt est confirmé. */
  async pollPawapay(depositId: string) {
    const id = String(depositId || '').trim();
    if (!id) throw new BadRequestException('depositId manquant.');
    const status = await this.pawapay.getDepositStatus(id);
    const s = String((status as any)?.status ?? status ?? '').toUpperCase();
    if (s === 'COMPLETED') {
      const delivered = await this.markCompleted('pawapay', id);
      return { status: 'completed', ...delivered };
    }
    if (['FAILED', 'REJECTED'].includes(s)) {
      await this.db
        .from('digital_orders')
        .update({ status: 'failed' })
        .eq('provider', 'pawapay')
        .eq('provider_ref', id)
        .eq('status', 'pending');
      return { status: 'failed' };
    }
    return { status: 'pending' };
  }

  /**
   * Idempotent : `pending` → `completed`, génère le jeton, envoie l'e-mail UNE fois.
   * `.select()` après l'update ne renvoie une ligne que sur la transition réelle,
   * donc ni double e-mail ni double jeton quand le front interroge en boucle.
   * Si la commande était déjà complétée, on renvoie quand même son lien courant.
   */
  private async markCompleted(provider: string, providerRef: string): Promise<{ downloadUrl?: string }> {
    const token = randomBytes(32).toString('hex');

    const { data: prod } = await this.db
      .from('digital_orders')
      .select('product_slug')
      .eq('provider', provider)
      .eq('provider_ref', providerRef)
      .maybeSingle();
    const productSlug = (prod as any)?.product_slug;
    if (!productSlug) return {};
    const p = await this.loadProduct(productSlug);
    const expires = new Date(Date.now() + Number(p.download_days || 90) * 86400_000).toISOString();

    const { data: updated } = await this.db
      .from('digital_orders')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        download_token: token,
        download_expires_at: expires,
      })
      .eq('provider', provider)
      .eq('provider_ref', providerRef)
      .eq('status', 'pending')
      .select('id, product_slug, buyer_email, buyer_name, buyer_phone, display_amount, display_currency, amount_cents, provider');

    const row = (updated as any[])?.[0];
    if (!row) {
      // Déjà complétée (poll répété) → on rend le lien existant sans rien réémettre.
      const { data: existing } = await this.db
        .from('digital_orders')
        .select('download_token')
        .eq('provider', provider)
        .eq('provider_ref', providerRef)
        .eq('status', 'completed')
        .maybeSingle();
      const t = (existing as any)?.download_token;
      return t ? { downloadUrl: this.downloadUrl(t) } : {};
    }

    const tenantId = await this.resolveTenantId(p.tenant_slug);
    void this.sendDownloadEmail(row, p, token, tenantId).catch((e) =>
      this.logger.warn(`Boutique e-mail KO: ${(e as Error).message}`));
    void this.ingestBuyerToCrm(row, tenantId).catch((e) =>
      this.logger.warn(`Boutique→CRM KO: ${(e as Error).message}`));

    return { downloadUrl: this.downloadUrl(token) };
  }

  private downloadUrl(token: string): string {
    return `${this.apiBase}/boutique/telecharger/${token}`;
  }

  private async resolveTenantId(tenantSlug?: string): Promise<string | null> {
    const { data } = await this.db
      .from('tenants').select('id').eq('slug', tenantSlug || 'isna').maybeSingle();
    return (data as any)?.id ?? null;
  }

  // ─────────────────────── TÉLÉCHARGEMENT ───────────────────────

  /**
   * Sert le PDF contre un jeton. Trois barrières : jeton inconnu, jeton expiré,
   * quota épuisé. L'exemplaire est filigrané au nom de l'acheteuse puis mis en
   * cache (le filigrane ne se recalcule pas à chaque téléchargement).
   */
  async download(token: string): Promise<{ buffer: Buffer; filename: string }> {
    const t = String(token || '').trim();
    if (!/^[a-f0-9]{64}$/.test(t)) throw new NotFoundException('Lien invalide.');

    const { data: order } = await this.db
      .from('digital_orders')
      .select('id, product_slug, status, buyer_email, buyer_name, download_expires_at, download_count, watermarked_path')
      .eq('download_token', t)
      .maybeSingle();
    if (!order || order.status !== 'completed') throw new NotFoundException('Lien invalide.');

    if (order.download_expires_at && new Date(order.download_expires_at) < new Date()) {
      throw new ForbiddenException(
        'Ce lien de téléchargement a expiré. Écrivez-nous et nous vous en renverrons un.',
      );
    }

    const p = await this.loadProduct(order.product_slug);
    if (Number(order.download_count) >= Number(p.max_downloads || 5)) {
      throw new ForbiddenException(
        'Ce lien a atteint son nombre maximum de téléchargements. Écrivez-nous et nous vous en renverrons un.',
      );
    }

    const filename = `${this.slugifyFilename(p.title)}.pdf`;

    // Exemplaire déjà filigrané en cache ?
    if (order.watermarked_path) {
      const cached = await this.readStorage(p.storage_bucket, order.watermarked_path);
      if (cached) {
        await this.bumpDownloadCount(order.id, order.download_count);
        return { buffer: cached, filename };
      }
    }

    const source = await this.readStorage(p.storage_bucket, p.storage_path);
    if (!source) throw new NotFoundException('Fichier indisponible. Contactez-nous.');

    let out = source;
    if (p.watermark) {
      try {
        out = await this.watermark(source, {
          email: order.buyer_email,
          name: order.buyer_name,
          orderId: order.id,
        });
        const cachePath = `orders/${order.id}.pdf`;
        await this.writeStorage(p.storage_bucket, cachePath, out);
        await this.db.from('digital_orders').update({ watermarked_path: cachePath }).eq('id', order.id);
      } catch (e) {
        // Un filigrane raté ne doit pas priver l'acheteuse de son livre : elle a payé.
        this.logger.warn(`Filigrane KO (commande ${order.id}): ${(e as Error).message}`);
        out = source;
      }
    }

    await this.bumpDownloadCount(order.id, order.download_count);
    return { buffer: out, filename };
  }

  private async bumpDownloadCount(id: string, current: unknown) {
    await this.db
      .from('digital_orders')
      .update({ download_count: (Number(current) || 0) + 1 })
      .eq('id', id);
  }

  private slugifyFilename(title: string): string {
    return String(title || 'livre')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'livre';
  }

  private async readStorage(bucket: string, path: string): Promise<Buffer | null> {
    try {
      const { data, error } = await this.db.storage.from(bucket).download(path);
      if (error || !data) return null;
      return Buffer.from(await data.arrayBuffer());
    } catch {
      return null;
    }
  }

  private async writeStorage(bucket: string, path: string, buf: Buffer): Promise<void> {
    await this.db.storage
      .from(bucket)
      .upload(path, buf, { contentType: 'application/pdf', upsert: true });
  }

  /**
   * Filigrane nominatif : un pied de page discret sur chaque page + une mention en
   * fin d'ouvrage. Le but n'est pas d'empêcher la copie (impossible sur un PDF) mais
   * de la rendre traçable — ce qui suffit à décourager le partage en masse.
   * WinAnsi n'encode pas tout l'Unicode : le texte est réduit au latin-1.
   */
  private async watermark(
    source: Buffer,
    buyer: { email: string; name?: string | null; orderId: string },
  ): Promise<Buffer> {
    const pdf = await PDFDocument.load(source);
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    const who = this.toLatin1(
      [buyer.name, buyer.email].filter(Boolean).join(' — ') || buyer.email,
    );
    const line = this.toLatin1(
      `Exemplaire personnel de ${who} · reference ${buyer.orderId.slice(0, 8)} · reproduction et diffusion interdites`,
    );

    const pages = pdf.getPages();
    for (const page of pages) {
      const { width } = page.getSize();
      const size = 6;
      const w = font.widthOfTextAtSize(line, size);
      page.drawText(line, {
        x: Math.max(8, (width - w) / 2),
        y: 12,
        size,
        font,
        color: rgb(0.62, 0.6, 0.57),
        opacity: 0.75,
      });
    }

    pdf.setTitle(this.toLatin1(String(pdf.getTitle() || 'On t’a jugee sans t’entendre')));
    pdf.setSubject(this.toLatin1(`Exemplaire personnel — ${who}`));
    pdf.setKeywords(['femme-nouvelle', buyer.orderId]);

    return Buffer.from(await pdf.save());
  }

  /** WinAnsi ne couvre pas tout l'Unicode : on remplace ce qui ne s'encode pas. */
  private toLatin1(s: string): string {
    return String(s)
      .replace(/[\u2018\u2019\u201b]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\u2026/g, '...')
      .replace(/\u00a0/g, ' ')
      .replace(/[^\u0020-\u00ff]/g, '');
  }

  /** Renvoi du lien à une acheteuse qui a perdu son e-mail (jeton régénéré + prolongé). */
  async resendLink(slug: string, email: string) {
    const mail = String(email || '').trim().toLowerCase();
    const p = await this.loadProduct(slug);

    const { data: order } = await this.db
      .from('digital_orders')
      .select('id, buyer_email, buyer_name')
      .eq('product_slug', slug)
      .eq('status', 'completed')
      .ilike('buyer_email', mail)
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Réponse volontairement identique dans les deux cas : ne pas révéler
    // quelles adresses ont acheté (énumération).
    if (order) {
      const token = randomBytes(32).toString('hex');
      await this.db
        .from('digital_orders')
        .update({
          download_token: token,
          download_expires_at: new Date(Date.now() + Number(p.download_days || 90) * 86400_000).toISOString(),
          download_count: 0,
        })
        .eq('id', (order as any).id);
      const tenantId = await this.resolveTenantId(p.tenant_slug);
      void this.sendDownloadEmail(
        { ...(order as any), product_slug: slug }, p, token, tenantId,
      ).catch((e) => this.logger.warn(`Renvoi lien KO: ${(e as Error).message}`));
    }

    return {
      status: 'sent',
      message: 'Si cette adresse correspond à un achat, le lien vient d’y être renvoyé.',
    };
  }

  // ─────────────────────── E-MAIL + CRM ───────────────────────

  private async sendDownloadEmail(
    row: { id: string; buyer_email: string; buyer_name?: string | null },
    product: any,
    token: string,
    tenantId: string | null,
  ): Promise<void> {
    const email = String(row.buyer_email || '').trim();
    if (!email) return;

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

    const url = this.downloadUrl(token);
    const name = String(row.buyer_name || '').trim();
    const hello = name ? `Bonjour ${this.escapeHtml(name)}` : 'Bonjour';
    const programUrl = `${this.frontBase}/femme-nouvelle#accompagnement`;

    await this.db.from('email_queue').insert({
      tenant_id: tenantId,
      to: email,
      from,
      from_name: fromName,
      subject: `Votre exemplaire — ${product.title}`,
      html_body:
        `<div style="max-width:600px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;">` +
          `<div style="background:#262624;padding:30px 24px;text-align:center;border-radius:14px 14px 0 0;">` +
            `<div style="color:#e6b878;font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:2px;">LA FEMME NOUVELLE</div>` +
            `<div style="color:#a8a49c;font-size:11px;letter-spacing:2px;margin-top:6px;text-transform:uppercase;">Ngowazulu · MK5</div>` +
          `</div>` +
          `<div style="background:#faf8f4;padding:32px 28px;color:#2b2926;border-radius:0 0 14px 14px;">` +
            `<h2 style="margin:0 0 14px;font-size:22px;color:#1c1a18;">${hello},</h2>` +
            `<p style="font-size:15px;line-height:1.65;margin:0 0 14px;">Votre exemplaire de <strong>${this.escapeHtml(product.title)}</strong> est prêt. Il porte votre nom : merci de ne pas le rediffuser.</p>` +
            `<div style="text-align:center;margin:26px 0;">` +
              `<a href="${url}" style="display:inline-block;padding:14px 30px;background:#d97757;color:#ffffff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;">Télécharger le livre (PDF)</a>` +
            `</div>` +
            `<p style="color:#8a857e;font-size:12.5px;line-height:1.5;margin:0 0 20px;">Lien valable ${product.download_days} jours, ${product.max_downloads} téléchargements. Si le bouton ne fonctionne pas : <a href="${url}" style="color:#d97757;">${url}</a></p>` +
            `<div style="background:#f2ede4;border-radius:10px;padding:16px 18px;margin:0 0 22px;">` +
              `<p style="font-size:14px;line-height:1.6;margin:0 0 10px;color:#2b2926;">Le livre rouvre le dossier. Si vous voulez qu’on le travaille ensemble, l’accompagnement <strong>Devenir Femme Nouvelle</strong> reprend les sept axes, un par un.</p>` +
              `<a href="${programUrl}" style="color:#b0532f;font-weight:700;font-size:14px;text-decoration:none;">Découvrir l’accompagnement →</a>` +
            `</div>` +
            `<div style="border-top:1px solid #e6e1d8;padding-top:18px;">` +
              `<p style="font-size:14px;line-height:1.5;margin:0;">Bonne lecture,</p>` +
              `<p style="font-size:16px;font-weight:700;margin:6px 0 0;color:#1c1a18;">Ngowazulu</p>` +
              `<p style="font-size:12.5px;margin:10px 0 0;"><a href="${this.frontBase}" style="color:#d97757;text-decoration:none;">prorascience.org</a></p>` +
            `</div>` +
          `</div>` +
        `</div>`,
    });
  }

  private escapeHtml(s: string): string {
    return String(s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
    ));
  }

  private async ingestBuyerToCrm(row: {
    id: string; product_slug: string; buyer_email?: string | null; buyer_name?: string | null;
    buyer_phone?: string | null; display_amount?: number | null; display_currency?: string | null;
    amount_cents?: number | null; provider?: string | null;
  }, tenantId: string | null): Promise<void> {
    if (!tenantId) return;
    const email = String(row.buyer_email || '').trim().toLowerCase();
    const phone = String(row.buyer_phone || '').trim();
    if (!email && !phone) return;

    const contactId = await this.upsertCrmContact(tenantId, {
      name: String(row.buyer_name || '').trim(),
      email,
      phone,
      source: 'boutique-livre',
    });
    if (!contactId) return;

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
      type: 'book_purchase',
      title: `Achat du livre${amt ? ` : ${amt}` : ''}`,
      meta: {
        product: row.product_slug,
        order_id: row.id,
        amount_cents: row.amount_cents ?? null,
        currency: cur,
        provider: row.provider ?? null,
      },
    });
  }

  /** Dédup par e-mail (index unique tenant+email) puis par téléphone. */
  private async upsertCrmContact(
    tenantId: string,
    who: { name?: string; email?: string; phone?: string; source: string },
  ): Promise<string | null> {
    let contactId: string | null = null;
    if (who.email) {
      const { data } = await this.db
        .from('crm_contacts').select('id').eq('tenant_id', tenantId).ilike('email', who.email).limit(1).maybeSingle();
      contactId = (data as any)?.id ?? null;
    }
    if (!contactId && who.phone) {
      const { data } = await this.db
        .from('crm_contacts').select('id').eq('tenant_id', tenantId).eq('phone', who.phone).limit(1).maybeSingle();
      contactId = (data as any)?.id ?? null;
    }
    if (contactId) return contactId;

    const { data: created, error } = await this.db
      .from('crm_contacts')
      .insert({
        tenant_id: tenantId,
        first_name: who.name || 'Lectrice',
        email: who.email || null,
        phone: who.phone || null,
        source: who.source,
      })
      .select('id').single();
    if (!error) return (created as any).id;

    // Course sur l'index unique (tenant, email) → on relit.
    if (who.email) {
      const { data } = await this.db
        .from('crm_contacts').select('id').eq('tenant_id', tenantId).ilike('email', who.email).limit(1).maybeSingle();
      return (data as any)?.id ?? null;
    }
    return null;
  }

  // ─────────────────────── ACCOMPAGNEMENT ───────────────────────

  async getProgram(slug: string) {
    const { data: program } = await this.db
      .from('accompaniment_programs')
      .select('slug, title, tagline, intro, axes, disclaimer, is_active')
      .eq('slug', slug)
      .maybeSingle();
    if (!program) throw new NotFoundException('Programme introuvable.');

    const { data: formulas } = await this.db
      .from('accompaniment_formulas')
      .select('key, title, summary, includes, duration_label, price_cents, price_xaf, billing_label, is_featured, sort_order')
      .eq('program_slug', slug)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    return {
      slug: program.slug,
      title: program.title,
      tagline: program.tagline,
      intro: program.intro,
      axes: program.axes ?? [],
      disclaimer: program.disclaimer,
      active: program.is_active,
      formulas: (formulas || []).map((f: any) => ({
        key: f.key,
        title: f.title,
        summary: f.summary,
        includes: f.includes ?? [],
        durationLabel: f.duration_label,
        priceCents: f.price_cents,
        priceXaf: f.price_xaf,
        billingLabel: f.billing_label,
        featured: f.is_featured,
      })),
    };
  }

  /**
   * Demande de rendez-vous. Volontairement SANS auto-réservation d'un créneau :
   * un accompagnement de ce type se confirme par un humain. La demandeuse indique
   * sa préférence, le secrétariat la rappelle et pose le rendez-vous.
   */
  async createRequest(slug: string, dto: any) {
    if (dto?.website) return { status: 'received' }; // pot de miel
    if (!dto?.consent) {
      throw new BadRequestException('Merci de confirmer que nous pouvons vous recontacter.');
    }
    const { data: program } = await this.db
      .from('accompaniment_programs').select('slug, tenant_slug, is_active').eq('slug', slug).maybeSingle();
    if (!program) throw new NotFoundException('Programme introuvable.');
    if (!program.is_active) throw new BadRequestException('Les inscriptions sont momentanément fermées.');

    const email = String(dto.email).trim().toLowerCase();
    const phone = this.sanitize(dto.phone, 40);
    const fullName = this.sanitize(dto.fullName, 120);

    const { data: created, error } = await this.db
      .from('accompaniment_requests')
      .insert({
        program_slug: slug,
        formula_key: this.sanitize(dto.formulaKey, 40),
        full_name: fullName,
        email,
        phone,
        country: this.sanitize(dto.country, 60),
        preferred_at: dto.preferredAt ? new Date(dto.preferredAt).toISOString() : null,
        preferred_note: this.sanitize(dto.preferredNote, 120),
        channel: dto.channel || null,
        message: this.sanitize(dto.message, 2000),
        consent: true,
        source: 'femme-nouvelle',
      })
      .select('id')
      .single();
    if (error) throw new BadRequestException(error.message);

    const tenantId = await this.resolveTenantId((program as any).tenant_slug);
    void this.notifyRequest(created.id, { fullName, email, phone, dto }, tenantId)
      .catch((e) => this.logger.warn(`Accompagnement notif KO: ${(e as Error).message}`));

    return {
      status: 'received',
      requestId: created.id,
      message: 'Votre demande est enregistrée. Nous vous répondons sous 48 h ouvrées.',
    };
  }

  /** Accusé de réception à la demandeuse + fiche CRM pour le secrétariat. */
  private async notifyRequest(
    requestId: string,
    who: { fullName: string | null; email: string; phone: string | null; dto: any },
    tenantId: string | null,
  ): Promise<void> {
    let from: string | null = null;
    let fromName: string | null = null;
    let staffTo: string | null = null;
    if (tenantId) {
      const { data: ns } = await this.db
        .from('tenant_notification_settings')
        .select('email_from, email_from_name, notify_email')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      from = (ns as any)?.email_from ?? null;
      fromName = (ns as any)?.email_from_name ?? null;
      staffTo = (ns as any)?.notify_email ?? null;
    }

    const hello = who.fullName ? `Bonjour ${this.escapeHtml(who.fullName)}` : 'Bonjour';
    await this.db.from('email_queue').insert({
      tenant_id: tenantId,
      to: who.email,
      from,
      from_name: fromName,
      subject: 'Votre demande d’accompagnement — bien reçue',
      html_body:
        `<div style="max-width:600px;margin:0 auto;font-family:'Helvetica Neue',Arial,sans-serif;">` +
          `<div style="background:#262624;padding:28px 24px;text-align:center;border-radius:14px 14px 0 0;">` +
            `<div style="color:#e6b878;font-family:Georgia,serif;font-size:20px;letter-spacing:2px;">DEVENIR FEMME NOUVELLE</div>` +
          `</div>` +
          `<div style="background:#faf8f4;padding:30px 28px;color:#2b2926;border-radius:0 0 14px 14px;">` +
            `<h2 style="margin:0 0 14px;font-size:21px;color:#1c1a18;">${hello},</h2>` +
            `<p style="font-size:15px;line-height:1.65;margin:0 0 14px;">Votre demande est arrivée. Nous vous recontactons sous <strong>48 heures ouvrées</strong> pour fixer votre rendez-vous.</p>` +
            `<p style="font-size:15px;line-height:1.65;margin:0 0 14px;">Ce que vous nous avez écrit reste entre nous.</p>` +
            `<p style="font-size:13.5px;line-height:1.6;color:#6b6560;margin:22px 0 0;padding-top:16px;border-top:1px solid #e6e1d8;">Si votre situation est urgente ou si vous n’êtes pas en sécurité, ne nous attendez pas : rapprochez-vous des secours ou d’une association de votre pays.</p>` +
            `<p style="font-size:16px;font-weight:700;margin:18px 0 0;color:#1c1a18;">L’équipe Prorascience</p>` +
          `</div>` +
        `</div>`,
    });

    if (staffTo) {
      const d = who.dto || {};
      const rows = [
        ['Nom', who.fullName], ['E-mail', who.email], ['Téléphone', who.phone],
        ['Pays', d.country], ['Formule', d.formulaKey], ['Canal', d.channel],
        ['Créneau souhaité', d.preferredAt || d.preferredNote],
      ].filter(([, v]) => v);
      await this.db.from('email_queue').insert({
        tenant_id: tenantId,
        to: staffTo,
        from,
        from_name: fromName,
        subject: `Nouvelle demande d'accompagnement — ${who.fullName || who.email}`,
        html_body:
          `<div style="font-family:Arial,sans-serif;max-width:620px;">` +
            `<h2 style="color:#1c1a18;">Demande d'accompagnement</h2>` +
            `<table style="border-collapse:collapse;font-size:14px;">` +
            rows.map(([k, v]) =>
              `<tr><td style="padding:5px 14px 5px 0;color:#6b6560;">${k}</td>` +
              `<td style="padding:5px 0;font-weight:600;">${this.escapeHtml(String(v))}</td></tr>`).join('') +
            `</table>` +
            (d.message ? `<p style="margin-top:16px;white-space:pre-wrap;background:#f5f2ec;padding:14px;border-radius:8px;font-size:14px;">${this.escapeHtml(String(d.message))}</p>` : '') +
            `<p style="margin-top:18px;font-size:12.5px;color:#8a857e;">Référence ${requestId}</p>` +
          `</div>`,
      });
    }

    if (tenantId) {
      const contactId = await this.upsertCrmContact(tenantId, {
        name: who.fullName || '',
        email: who.email,
        phone: who.phone || '',
        source: 'accompagnement-femme-nouvelle',
      });
      if (contactId) {
        await this.db.from('crm_activities').insert({
          tenant_id: tenantId,
          entity_type: 'contact',
          entity_id: contactId,
          type: 'accompaniment_request',
          title: `Demande d'accompagnement${who.dto?.formulaKey ? ` — ${who.dto.formulaKey}` : ''}`,
          meta: { request_id: requestId, formula: who.dto?.formulaKey ?? null, channel: who.dto?.channel ?? null },
        });
      }
    }
  }
}
