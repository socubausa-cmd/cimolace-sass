import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class IriService {
  constructor(private readonly supabase: SupabaseService) {}

  async listPages(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('iri_pages').select('*').eq('tenant_id', tenantId).order('updated_at', { ascending: false });
    return data ?? [];
  }

  async getPage(tenantId: string, slug: string) {
    const { data } = await (this.supabase.client as any).from('iri_pages').select('*').eq('slug', slug).eq('tenant_id', tenantId).single();
    if (!data) throw new NotFoundException('Page introuvable');
    return data;
  }

  async createPage(tenantId: string, userId: string, dto: { title: string; slug: string; blocks?: any[] }) {
    const { data } = await (this.supabase.client as any).from('iri_pages').insert({
      tenant_id: tenantId, created_by: userId, title: dto.title, slug: dto.slug,
      blocks: dto.blocks ?? [], status: 'draft',
    }).select('*').single();
    return data;
  }

  async updatePage(tenantId: string, slug: string, dto: { title?: string; blocks?: any[]; status?: string }) {
    const patch: any = {};
    if (dto.title) patch.title = dto.title;
    if (dto.blocks) patch.blocks = dto.blocks;
    if (dto.status) patch.status = dto.status;
    const { data } = await (this.supabase.client as any).from('iri_pages').update(patch).eq('slug', slug).eq('tenant_id', tenantId).select('*').single();
    return data;
  }

  async publishPage(tenantId: string, slug: string) {
    await (this.supabase.client as any).from('iri_pages').update({ status: 'published', published_at: new Date().toISOString() }).eq('slug', slug).eq('tenant_id', tenantId);
    return { slug, status: 'published' };
  }

  async deletePage(tenantId: string, slug: string) {
    await (this.supabase.client as any).from('iri_pages').delete().eq('slug', slug).eq('tenant_id', tenantId);
  }

  /**
   * Page publique. SCOPÉE PAR TENANT via le slug du tenant (header X-Tenant-Slug, résolu par
   * l'hôte côté front) → deux tenants peuvent avoir une page « accueil » sans collision (cloison).
   * Sans slug tenant (appel direct hors hôte), repli legacy sur slug+published (best-effort).
   */
  async getPublicPage(slug: string, tenantSlug?: string) {
    let tenantId: string | null = null;
    if (tenantSlug) {
      const { data: t } = await (this.supabase.client as any).from('tenants').select('id').eq('slug', tenantSlug).maybeSingle();
      if (!t) return null; // hôte inconnu → aucune page (pas de fuite cross-tenant)
      tenantId = t.id;
    }
    let q = (this.supabase.client as any).from('iri_pages').select('*').eq('slug', slug).eq('status', 'published');
    if (tenantId) q = q.eq('tenant_id', tenantId);
    const { data } = await q.maybeSingle();
    return data ?? null;
  }
}
