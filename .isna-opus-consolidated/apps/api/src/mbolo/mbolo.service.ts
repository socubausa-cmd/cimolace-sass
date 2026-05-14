import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MboloService {
  constructor(private readonly supabase: SupabaseService) {}

  async listProducts(tenantId: string) { const { data } = await (this.supabase.client as any).from('mbolo_products').select('*').eq('tenant_id', tenantId).eq('is_active', true); return data ?? []; }
  async getProduct(tenantId: string, id: string) { const { data } = await (this.supabase.client as any).from('mbolo_products').select('*').eq('id', id).eq('tenant_id', tenantId).single(); if (!data) throw new NotFoundException('Produit introuvable'); return data; }
  async createProduct(tenantId: string, dto: { name: string; priceCents: number; description?: string; imageUrl?: string }) {
    const { data } = await (this.supabase.client as any).from('mbolo_products').insert({ tenant_id: tenantId, name: dto.name, price_cents: dto.priceCents, description: dto.description ?? '', image_url: dto.imageUrl ?? '', is_active: true }).select('*').single();
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
