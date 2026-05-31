import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MboloService {
  constructor(private readonly supabase: SupabaseService) {}

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
