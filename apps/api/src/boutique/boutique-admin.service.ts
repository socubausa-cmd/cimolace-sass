import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { TenantContext } from '../tenant/tenant.types';
import { BoutiqueService } from './boutique.service';

/**
 * Suivi back-office des ventes et des demandes.
 *
 * Chaque lecture est CLOISONNÉE au tenant de l'appelant : on ne fait jamais
 * confiance au `slug` reçu en query — on vérifie que le produit/programme
 * appartient bien au tenant, sinon 403. Sans ça, un owner de zahirwellness
 * lirait les commandes de prorascience en changeant un paramètre d'URL.
 */
@Injectable()
export class BoutiqueAdminService {
  constructor(
    private readonly supabaseSvc: SupabaseService,
    private readonly boutique: BoutiqueService,
  ) {}

  private get db(): any {
    return this.supabaseSvc.client as any;
  }

  /** Slugs des produits du tenant. Vide ⇒ le tenant ne vend rien. */
  private async productSlugsOf(tenant: TenantContext, only?: string): Promise<string[]> {
    const { data } = await this.db
      .from('digital_products')
      .select('slug')
      .eq('tenant_slug', tenant.slug);
    const slugs = (data || []).map((p: any) => p.slug);
    if (!only) return slugs;
    if (!slugs.includes(only)) {
      throw new ForbiddenException("Cet ouvrage n'appartient pas à votre organisation.");
    }
    return [only];
  }

  private async programSlugsOf(tenant: TenantContext, only?: string): Promise<string[]> {
    const { data } = await this.db
      .from('accompaniment_programs')
      .select('slug')
      .eq('tenant_slug', tenant.slug);
    const slugs = (data || []).map((p: any) => p.slug);
    if (!only) return slugs;
    if (!slugs.includes(only)) {
      throw new ForbiddenException("Ce programme n'appartient pas à votre organisation.");
    }
    return [only];
  }

  /**
   * Commandes + chiffres. Le total en EUR est la seule somme comparable :
   * `display_amount` mélange des centimes EUR et des unités XAF, l'additionner
   * donnerait un nombre qui ne veut rien dire.
   */
  async listOrders(tenant: TenantContext, params: { productSlug?: string; status?: string }) {
    const slugs = await this.productSlugsOf(tenant, params.productSlug);
    if (!slugs.length) return { orders: [], summary: emptySummary() };

    let q = this.db
      .from('digital_orders')
      .select('id, product_slug, provider, amount_cents, display_amount, display_currency, status, buyer_email, buyer_name, buyer_phone, country, download_count, download_expires_at, created_at, completed_at')
      .in('product_slug', slugs)
      .order('created_at', { ascending: false })
      .limit(500);
    if (params.status) q = q.eq('status', params.status);

    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    const rows: any[] = data || [];

    const completed = rows.filter((r) => r.status === 'completed');
    const summary = {
      total: rows.length,
      completed: completed.length,
      pending: rows.filter((r) => r.status === 'pending').length,
      failed: rows.filter((r) => r.status === 'failed').length,
      revenueCents: completed.reduce((s, r) => s + (Number(r.amount_cents) || 0), 0),
      // Ce qui a réellement été encaissé, par devise (EUR en centimes, CFA en unités).
      byCurrency: completed.reduce((acc: Record<string, number>, r) => {
        const cur = r.display_currency || 'EUR';
        acc[cur] = (acc[cur] || 0) + (Number(r.display_amount) || 0);
        return acc;
      }, {}),
    };

    return {
      orders: rows.map((r) => ({
        id: r.id,
        productSlug: r.product_slug,
        provider: r.provider,
        amountCents: r.amount_cents,
        displayAmount: r.display_amount,
        displayCurrency: r.display_currency,
        status: r.status,
        buyerEmail: r.buyer_email,
        buyerName: r.buyer_name,
        buyerPhone: r.buyer_phone,
        country: r.country,
        downloadCount: r.download_count,
        downloadExpiresAt: r.download_expires_at,
        createdAt: r.created_at,
        completedAt: r.completed_at,
      })),
      summary,
    };
  }

  /** Renvoi du lien à une acheteuse — réutilise le chemin public (jeton régénéré + e-mail). */
  async resendOrderLink(tenant: TenantContext, orderId: string) {
    const { data: order } = await this.db
      .from('digital_orders')
      .select('id, product_slug, buyer_email, status')
      .eq('id', orderId)
      .maybeSingle();
    if (!order) throw new NotFoundException('Commande introuvable.');
    if (order.status !== 'completed') {
      throw new BadRequestException("Cette commande n'a pas été payée : aucun lien à renvoyer.");
    }
    await this.productSlugsOf(tenant, order.product_slug); // cloisonnement
    await this.boutique.resendLink(order.product_slug, order.buyer_email);
    return { status: 'sent', to: order.buyer_email };
  }

  async listRequests(tenant: TenantContext, params: { programSlug?: string; status?: string }) {
    const slugs = await this.programSlugsOf(tenant, params.programSlug);
    if (!slugs.length) return { requests: [], summary: {} };

    let q = this.db
      .from('accompaniment_requests')
      .select('id, program_slug, formula_key, full_name, email, phone, country, preferred_at, preferred_note, channel, message, status, created_at, updated_at')
      .in('program_slug', slugs)
      .order('created_at', { ascending: false })
      .limit(500);
    if (params.status) q = q.eq('status', params.status);

    const { data, error } = await q;
    if (error) throw new BadRequestException(error.message);
    const rows: any[] = data || [];

    const summary = rows.reduce((acc: Record<string, number>, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});

    return {
      requests: rows.map((r) => ({
        id: r.id,
        programSlug: r.program_slug,
        formulaKey: r.formula_key,
        fullName: r.full_name,
        email: r.email,
        phone: r.phone,
        country: r.country,
        preferredAt: r.preferred_at,
        preferredNote: r.preferred_note,
        channel: r.channel,
        message: r.message,
        status: r.status,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      summary,
    };
  }

  async updateRequest(tenant: TenantContext, id: string, dto: { status: string }) {
    const { data: existing } = await this.db
      .from('accompaniment_requests')
      .select('id, program_slug')
      .eq('id', id)
      .maybeSingle();
    if (!existing) throw new NotFoundException('Demande introuvable.');
    await this.programSlugsOf(tenant, existing.program_slug); // cloisonnement

    const { error } = await this.db
      .from('accompaniment_requests')
      .update({ status: dto.status, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { status: dto.status };
  }
}

function emptySummary() {
  return { total: 0, completed: 0, pending: 0, failed: 0, revenueCents: 0, byCurrency: {} };
}
