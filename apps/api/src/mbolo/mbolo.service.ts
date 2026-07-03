import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';

const STOREFRONT_BASE = 'https://api.cimolace.space/v1/mbolo/storefront';
const MBOLO_DOCS_URL = 'https://cimolace.space/mbolo/integration';

@Injectable()
export class MboloService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * « Installer Mbolo » — provisionne tout ce qu'il faut pour connecter un site
   * client : une clé API storefront (mbk_…, brute retournée UNE SEULE FOIS),
   * une catégorie par défaut, et (optionnel) un produit exemple si le catalogue
   * est vide. Idempotent sur la catégorie ; la clé est régénérée à chaque appel.
   * Appelé au signup (kind=mbolo) et via POST /mbolo/install (owner/admin).
   */
  async installStorefront(
    tenantId: string,
    tenantSlug: string,
    createdBy: string | null,
    opts: { withSample?: boolean } = {},
  ) {
    if (!/^[a-z0-9-]{1,40}$/.test(tenantSlug || '')) {
      throw new BadRequestException('Slug tenant invalide pour la génération de clé');
    }
    const client = this.supabase.client as any;

    // 1) Clé API storefront (mbk_<slug>_<hex>), hashée SHA-256 (brut non stocké)
    const random = randomBytes(24).toString('hex'); // 48 hex
    const rawKey = `mbk_${tenantSlug}_${random}`;
    const keyPrefix = `mbk_${tenantSlug}_${random.slice(0, 4)}…`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const { data: keyRow, error: keyErr } = await client
      .from('tenant_api_keys')
      .insert({ tenant_id: tenantId, label: 'Mbolo Storefront', key_prefix: keyPrefix, key_hash: keyHash, created_by: createdBy })
      .select('id, key_prefix, created_at')
      .single();
    if (keyErr || !keyRow) {
      throw new InternalServerErrorException(`Création de la clé storefront impossible : ${keyErr?.message ?? 'inconnue'}`);
    }

    // 2) Catégorie par défaut (idempotent sur (tenant_id, slug))
    const { data: category } = await client
      .from('mbolo_categories')
      .upsert({ tenant_id: tenantId, slug: 'boutique', name: 'Boutique', sort_order: 0 }, { onConflict: 'tenant_id,slug' })
      .select('id, slug, name')
      .single();

    // 3) Produit exemple (seulement si demandé ET catalogue vide)
    let sampleProduct: any = null;
    if (opts.withSample) {
      const { count } = await client
        .from('mbolo_products')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      if (!count) {
        const { data } = await client.from('mbolo_products').insert({
          tenant_id: tenantId,
          name: 'Produit exemple',
          slug: 'produit-exemple',
          price_cents: 1000000,
          currency: 'XAF',
          stock: 10,
          is_featured: true,
          is_active: true,
          category_id: category?.id ?? null,
          tagline: 'Exemple — modifiez ou supprimez',
          description: "Produit de démonstration créé à l'installation de Mbolo.",
        }).select('id, name, slug').maybeSingle();
        sampleProduct = data ?? null;
      }
    }

    return {
      api_key: rawKey, // ⚠️ retourné une seule fois
      key_prefix: keyRow.key_prefix,
      storefront: {
        base_url: STOREFRONT_BASE,
        endpoints: {
          categories: `GET ${STOREFRONT_BASE}/categories`,
          products: `GET ${STOREFRONT_BASE}/products`,
          product: `GET ${STOREFRONT_BASE}/products/:slug`,
          checkout: `POST ${STOREFRONT_BASE}/orders`,
        },
      },
      docs_url: MBOLO_DOCS_URL,
      back_office_url: '/dashboard/mbolo',
      category: category ?? null,
      sample_product: sampleProduct,
    };
  }

  // ─── Catalogue : catégories ──────────────────────────────────────────────
  async listCategories(tenantId: string) {
    const { data } = await (this.supabase.client as any)
      .from('mbolo_categories').select('*')
      .eq('tenant_id', tenantId).eq('is_active', true)
      .order('sort_order', { ascending: true });
    return data ?? [];
  }
  async createCategory(tenantId: string, dto: { slug: string; name: string; description?: string; imageUrl?: string; sortOrder?: number }) {
    if (!dto?.slug || !dto?.name) throw new BadRequestException('slug et name requis');
    const { data, error } = await (this.supabase.client as any)
      .from('mbolo_categories')
      .insert({ tenant_id: tenantId, slug: dto.slug, name: dto.name, description: dto.description ?? null, image_url: dto.imageUrl ?? null, sort_order: dto.sortOrder ?? 0 })
      .select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Catalogue : produits (champs riches) ────────────────────────────────
  async listProducts(tenantId: string, categoryId?: string) {
    let q = (this.supabase.client as any)
      .from('mbolo_products')
      .select('*, images:mbolo_product_images(url, alt, is_primary, sort_order)')
      .eq('tenant_id', tenantId).eq('is_active', true)
      .order('is_featured', { ascending: false });
    if (categoryId) q = q.eq('category_id', categoryId);
    const { data } = await q;
    return data ?? [];
  }
  async getProduct(tenantId: string, id: string) {
    const { data } = await (this.supabase.client as any).from('mbolo_products').select('*').eq('id', id).eq('tenant_id', tenantId).single();
    if (!data) throw new NotFoundException('Produit introuvable');
    const { data: images } = await (this.supabase.client as any).from('mbolo_product_images').select('*').eq('product_id', id).order('sort_order', { ascending: true });
    const { data: variants } = await (this.supabase.client as any).from('mbolo_product_variants').select('*').eq('product_id', id).eq('is_active', true).order('sort_order', { ascending: true });
    return { ...data, images: images ?? [], variants: variants ?? [] };
  }
  async createProduct(tenantId: string, dto: any) {
    if (!dto?.name || dto?.priceCents == null) throw new BadRequestException('name et priceCents requis');
    const { data, error } = await (this.supabase.client as any).from('mbolo_products').insert({
      tenant_id: tenantId,
      name: dto.name,
      slug: dto.slug ?? null,
      sku: dto.sku ?? null,
      category_id: dto.categoryId ?? null,
      description: dto.description ?? '',
      tagline: dto.tagline ?? null,
      price_cents: dto.priceCents,
      compare_at_price_cents: dto.compareAtPriceCents ?? null,
      currency: dto.currency ?? 'XAF',
      stock: dto.stock ?? 0,
      is_featured: dto.isFeatured ?? false,
      image_url: dto.imageUrl ?? '',
      benefits: dto.benefits ?? [],
      ingredients: dto.ingredients ?? [],
      seo_title: dto.seoTitle ?? null,
      seo_description: dto.seoDescription ?? null,
      is_active: true,
    }).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async updateProduct(tenantId: string, id: string, dto: any) {
    await this.getProduct(tenantId, id); // garantit l'appartenance au tenant
    const map: Record<string, string> = {
      name: 'name', slug: 'slug', sku: 'sku', categoryId: 'category_id',
      description: 'description', tagline: 'tagline', priceCents: 'price_cents',
      compareAtPriceCents: 'compare_at_price_cents', currency: 'currency',
      stock: 'stock', isFeatured: 'is_featured', imageUrl: 'image_url', isActive: 'is_active',
    };
    const patch: Record<string, any> = {};
    for (const [k, col] of Object.entries(map)) if (dto?.[k] !== undefined) patch[col] = dto[k];
    if (Object.keys(patch).length === 0) return this.getProduct(tenantId, id);
    const { data, error } = await (this.supabase.client as any)
      .from('mbolo_products').update(patch).eq('id', id).eq('tenant_id', tenantId).select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async deleteProduct(tenantId: string, id: string) {
    await this.getProduct(tenantId, id);
    const { error } = await (this.supabase.client as any)
      .from('mbolo_products').delete().eq('id', id).eq('tenant_id', tenantId);
    if (error) throw new BadRequestException(error.message);
    return { ok: true };
  }

  // ─── Catalogue : images & variantes ──────────────────────────────────────
  async addProductImage(tenantId: string, productId: string, dto: { url: string; alt?: string; sortOrder?: number; isPrimary?: boolean }) {
    await this.getProduct(tenantId, productId); // garantit l'appartenance au tenant
    const { data, error } = await (this.supabase.client as any).from('mbolo_product_images')
      .insert({ tenant_id: tenantId, product_id: productId, url: dto.url, alt: dto.alt ?? null, sort_order: dto.sortOrder ?? 0, is_primary: dto.isPrimary ?? false })
      .select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }
  async addProductVariant(tenantId: string, productId: string, dto: { label: string; skuSuffix?: string; priceDeltaCents?: number; stock?: number; sortOrder?: number }) {
    await this.getProduct(tenantId, productId);
    const { data, error } = await (this.supabase.client as any).from('mbolo_product_variants')
      .insert({ tenant_id: tenantId, product_id: productId, label: dto.label, sku_suffix: dto.skuSuffix ?? null, price_delta_cents: dto.priceDeltaCents ?? 0, stock: dto.stock ?? 0, sort_order: dto.sortOrder ?? 0 })
      .select('*').single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  // ─── Storefront public (clé API, acheteur anonyme) ───────────────────────
  /** Détail produit par slug (storefront public) — images + variantes imbriquées. */
  async getProductBySlug(tenantId: string, slug: string) {
    const { data } = await (this.supabase.client as any)
      .from('mbolo_products')
      .select('*, images:mbolo_product_images(url, alt, is_primary, sort_order)')
      .eq('tenant_id', tenantId).eq('slug', slug).eq('is_active', true)
      .maybeSingle();
    if (!data) throw new NotFoundException('Produit introuvable');
    const { data: variants } = await (this.supabase.client as any)
      .from('mbolo_product_variants').select('*')
      .eq('product_id', data.id).eq('is_active', true)
      .order('sort_order', { ascending: true });
    return { ...data, variants: variants ?? [] };
  }

  /**
   * CATALOGUE PUBLIC par slug de tenant — pour l'EMBED navigateur (`/embed/boutique`).
   * Ne renvoie QUE des données publiques (produits/catégories actifs + branding),
   * résolues par slug → aucune clé `mbk_` exposée au navigateur. Les écritures
   * (panier/commande/paiement) restent gardées (clé mbk_ ou session membre).
   * Un catalogue est PUBLIC par nature (l'acheteur le parcourt) → lecture ouverte.
   */
  async getPublicCatalog(tenantSlug: string, categoryId?: string) {
    const slug = String(tenantSlug || '').trim().toLowerCase();
    if (!slug) throw new BadRequestException('tenant slug requis');
    const { data: tenant } = await (this.supabase.client as any)
      .from('tenants')
      .select('id, slug, name, logo_url, brand_colors, status')
      .eq('slug', slug)
      .maybeSingle();
    if (!tenant || tenant.status !== 'active') {
      throw new NotFoundException(`Boutique « ${slug} » introuvable ou inactive`);
    }
    const [categories, products] = await Promise.all([
      this.listCategories(tenant.id),
      this.listProducts(tenant.id, categoryId),
    ]);
    return {
      tenant: {
        slug: tenant.slug,
        name: tenant.name ?? tenant.slug,
        logo_url: tenant.logo_url ?? null,
        colors: tenant.brand_colors ?? {},
      },
      categories,
      products,
    };
  }

  /**
   * Checkout invité (storefront sur le site du client, sans compte Cimolace).
   * Les prix sont TOUJOURS recalculés depuis la base — jamais ceux du client.
   * dto = { customer: {email,name?,phone?,address?}, items: [{productId?|slug?, variantId?, quantity}] }
   */
  async createStorefrontOrder(tenantId: string, dto: any) {
    const email = dto?.customer?.email?.trim();
    if (!email) throw new BadRequestException('customer.email requis');
    const items = Array.isArray(dto?.items) ? dto.items : [];
    if (!items.length) throw new BadRequestException('items requis (panier vide)');

    let totalCents = 0;
    let currency = 'XAF';
    const resolved: Array<{ product_id: string; variant_id: string | null; quantity: number; price_cents: number; product_name: string }> = [];

    for (const it of items) {
      const qty = Math.max(1, parseInt(it?.quantity ?? 1, 10) || 1);
      // Résoudre le produit par id ou slug, scopé au tenant + actif
      let q = (this.supabase.client as any).from('mbolo_products')
        .select('id, name, price_cents, currency, is_active').eq('tenant_id', tenantId).eq('is_active', true);
      q = it?.productId ? q.eq('id', it.productId) : it?.slug ? q.eq('slug', it.slug) : q.eq('id', '00000000-0000-0000-0000-000000000000');
      const { data: product } = await q.maybeSingle();
      if (!product) throw new BadRequestException(`Produit introuvable: ${it?.productId ?? it?.slug ?? '?'}`);

      let unit = product.price_cents as number;
      let variantId: string | null = null;
      if (it?.variantId) {
        const { data: variant } = await (this.supabase.client as any)
          .from('mbolo_product_variants').select('id, price_delta_cents')
          .eq('id', it.variantId).eq('product_id', product.id).eq('is_active', true).maybeSingle();
        if (!variant) throw new BadRequestException(`Variante introuvable pour ${product.name}`);
        unit += variant.price_delta_cents ?? 0;
        variantId = variant.id;
      }
      currency = product.currency ?? currency;
      totalCents += unit * qty;
      resolved.push({ product_id: product.id, variant_id: variantId, quantity: qty, price_cents: unit, product_name: product.name });
    }

    const orderNumber = `MB-${tenantId.slice(0, 4).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const { data: order, error } = await (this.supabase.client as any).from('mbolo_orders').insert({
      tenant_id: tenantId,
      user_id: null,
      total_cents: totalCents,
      status: 'pending',
      order_number: orderNumber,
      customer_email: email,
      customer_name: dto?.customer?.name ?? null,
      customer_phone: dto?.customer?.phone ?? null,
      shipping_address: dto?.customer?.address ?? {},
      currency,
      channel: 'storefront',
    }).select('*').single();
    if (error) throw new BadRequestException(error.message);

    for (const r of resolved) {
      await (this.supabase.client as any).from('mbolo_order_items').insert({
        order_id: order.id, product_id: r.product_id, variant_id: r.variant_id,
        quantity: r.quantity, price_cents: r.price_cents, product_name: r.product_name,
      });
    }
    return { order, items: resolved, total_cents: totalCents, currency };
  }

  // ─── Paiement en ligne (Stripe Checkout, via l'API Cimolace) ─────────────
  // Devises « zéro décimale » Stripe : le montant est en unité majeure (pas ×100).
  // Nos price_cents stockent toujours montant×100 → on divise pour ces devises.
  private static ZERO_DECIMAL = new Set(['XAF','XOF','XPF','BIF','CLP','DJF','GNF','JPY','KMF','KRW','MGA','PYG','RWF','UGX','VND','VUV']);
  private stripeAmount(priceCents: number, currency: string): number {
    return MboloService.ZERO_DECIMAL.has((currency || '').toUpperCase())
      ? Math.round(priceCents / 100)
      : Math.round(priceCents);
  }

  /**
   * Crée une session Stripe Checkout pour une commande Mbolo et renvoie l'URL
   * de paiement hébergée. Le paiement est porté par l'API Cimolace (clé Stripe
   * plateforme). Persiste payment_session_id + provider sur la commande.
   */
  async createOrderCheckoutSession(
    tenantId: string,
    orderId: string,
    opts: { successUrl?: string; cancelUrl?: string } = {},
  ) {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new BadRequestException('Paiement indisponible (STRIPE_SECRET_KEY non configurée)');

    const order = await this.getOrder(tenantId, orderId);
    if (!order?.id) throw new NotFoundException('Commande introuvable');
    if (order.payment_status === 'paid') throw new BadRequestException('Commande déjà payée');

    const currency = (order.currency || 'XAF').toLowerCase();
    const items: any[] = Array.isArray(order.items) ? order.items : [];
    const frontend = process.env.FRONTEND_URL || 'https://cimolace.space';
    const successUrl = opts.successUrl || `${frontend}/success?order=${encodeURIComponent(order.order_number ?? order.id)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = opts.cancelUrl || `${frontend}/cart`;

    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);
    params.append('client_reference_id', order.id);
    params.append('metadata[mbolo_order_id]', order.id);
    params.append('metadata[tenant_id]', tenantId);
    if (order.customer_email) params.append('customer_email', order.customer_email);
    const lines = items.length ? items : [{ product_name: `Commande ${order.order_number ?? order.id}`, price_cents: order.total_cents, quantity: 1 }];
    lines.forEach((it: any, i: number) => {
      params.append(`line_items[${i}][price_data][currency]`, currency);
      params.append(`line_items[${i}][price_data][product_data][name]`, it.product_name || 'Article');
      params.append(`line_items[${i}][price_data][unit_amount]`, String(this.stripeAmount(it.price_cents ?? 0, currency)));
      params.append(`line_items[${i}][quantity]`, String(it.quantity ?? 1));
    });

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(secret + ':').toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new BadRequestException(`Stripe Checkout error ${res.status}: ${errText.slice(0, 300)}`);
    }
    const session = (await res.json()) as { id: string; url: string };
    await (this.supabase.client as any).from('mbolo_orders')
      .update({ payment_provider: 'stripe', payment_session_id: session.id })
      .eq('id', order.id).eq('tenant_id', tenantId);
    return { url: session.url, session_id: session.id, order_number: order.order_number, total_cents: order.total_cents, currency: order.currency };
  }

  /**
   * Confirmation au retour : interroge Stripe pour l'état du paiement de la
   * session liée à la commande ; si payé, bascule la commande en paid/confirmed.
   * Idempotent. Ne marque JAMAIS payé sans confirmation Stripe.
   */
  async confirmOrderPayment(tenantId: string, orderId: string) {
    const order = await this.getOrder(tenantId, orderId);
    if (!order?.id) throw new NotFoundException('Commande introuvable');
    if (order.payment_status === 'paid') return { paid: true, status: order.status, payment_status: 'paid' };
    if (!order.payment_session_id) return { paid: false, status: order.status, payment_status: order.payment_status ?? 'unpaid' };

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) throw new BadRequestException('Paiement indisponible');
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${order.payment_session_id}`, {
      headers: { Authorization: `Basic ${Buffer.from(secret + ':').toString('base64')}` },
    });
    if (!res.ok) throw new BadRequestException(`Stripe session lookup ${res.status}`);
    const session = (await res.json()) as { payment_status?: string };
    const paid = session.payment_status === 'paid';
    if (paid) {
      await (this.supabase.client as any).from('mbolo_orders')
        .update({ payment_status: 'paid', status: 'confirmed', paid_at: new Date().toISOString() })
        .eq('id', order.id).eq('tenant_id', tenantId);
    }
    return { paid, status: paid ? 'confirmed' : order.status, payment_status: paid ? 'paid' : (order.payment_status ?? 'unpaid') };
  }

  async addToCart(tenantId: string, userId: string, productId: string, quantity = 1) {
    await (this.supabase.client as any).from('mbolo_cart_items').upsert({ tenant_id: tenantId, user_id: userId, product_id: productId, quantity }, { onConflict: 'user_id,product_id' });
    return this.getCart(tenantId, userId);
  }
  async getCart(tenantId: string, userId: string) {
    const { data } = await (this.supabase.client as any).from('mbolo_cart_items').select('*, product:mbolo_products(*)').eq('tenant_id', tenantId).eq('user_id', userId);
    return data ?? [];
  }
  async removeFromCart(tenantId: string, userId: string, productId: string) {
    await (this.supabase.client as any).from('mbolo_cart_items').delete().eq('tenant_id', tenantId).eq('user_id', userId).eq('product_id', productId);
  }

  async createOrder(tenantId: string, userId: string) {
    const cart = await this.getCart(tenantId, userId);
    if (!cart.length) throw new NotFoundException('Panier vide');
    const total = cart.reduce((s: number, i: any) => s + (i.product?.price_cents ?? 0) * i.quantity, 0);
    const { data: order } = await (this.supabase.client as any).from('mbolo_orders').insert({ tenant_id: tenantId, user_id: userId, total_cents: total, status: 'pending' }).select('*').single();
    for (const item of cart as any[]) {
      await (this.supabase.client as any).from('mbolo_order_items').insert({ order_id: order.id, product_id: item.product_id, quantity: item.quantity, price_cents: item.product?.price_cents ?? 0 });
    }
    await (this.supabase.client as any).from('mbolo_cart_items').delete().eq('tenant_id', tenantId).eq('user_id', userId);
    return { order, total_cents: total };
  }

  async listOrders(tenantId: string, userId?: string) {
    let q = (this.supabase.client as any).from('mbolo_orders').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (userId) q = q.eq('user_id', userId);
    const { data } = await q;
    return data ?? [];
  }

  async getOrder(tenantId: string, orderId: string) {
    const { data: order } = await (this.supabase.client as any).from('mbolo_orders').select('*').eq('id', orderId).eq('tenant_id', tenantId).single();
    const { data: items } = await (this.supabase.client as any).from('mbolo_order_items').select('*, product:mbolo_products(*)').eq('order_id', orderId);
    return { ...order, items: items ?? [] };
  }
}
