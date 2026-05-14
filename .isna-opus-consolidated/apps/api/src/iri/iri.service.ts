import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
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

  async getPublicPage(slug: string) {
    const { data } = await (this.supabase.client as any).from('iri_pages').select('*').eq('slug', slug).eq('status', 'published').single();
    return data ?? null;
  }

  // ── Reviews ─────────────────────────────────────────────────────────────

  async submitReview(tenantId: string, userId: string, rating: number, comment?: string) {
    const { data } = await (this.supabase.client as any).from('reviews').insert({
      tenant_id: tenantId, user_id: userId, rating, comment: comment ?? '', status: 'pending',
    }).select('*').single();
    return data;
  }

  async listReviews(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('reviews').select('*').eq('tenant_id', tenantId).eq('status', 'approved').order('created_at', { ascending: false });
    return data ?? [];
  }

  async approveReview(tenantId: string, reviewId: string) {
    await (this.supabase.client as any).from('reviews').update({ status: 'approved' }).eq('id', reviewId).eq('tenant_id', tenantId);
    return { reviewId, status: 'approved' };
  }

  // ── Privileged Links ────────────────────────────────────────────────────

  async createPrivilegedLink(tenantId: string, userId: string, resourceType: string, resourceId: string, expiresInHours = 24) {
    const code = crypto.randomUUID().slice(0, 8);
    const { data } = await (this.supabase.client as any).from('privileged_links').insert({
      tenant_id: tenantId, created_by: userId, code, resource_type: resourceType, resource_id: resourceId,
      expires_at: new Date(Date.now() + expiresInHours * 3600000).toISOString(), status: 'active',
    }).select('*').single();
    return data;
  }

  async redeemPrivilegedLink(code: string) {
    const { data } = await (this.supabase.client as any).from('privileged_links').select('*').eq('code', code).eq('status', 'active').single();
    if (!data) throw new NotFoundException('Lien invalide ou expiré');
    if (data.expires_at && new Date(data.expires_at) < new Date()) throw new NotFoundException('Lien expiré');
    await (this.supabase.client as any).from('privileged_links').update({ status: 'used', used_at: new Date().toISOString() }).eq('id', data.id);
    return { resourceType: data.resource_type, resourceId: data.resource_id };
  }

  // ── Ad Copy Generation ──────────────────────────────────────────────────

  async generateAdCopy(tenantId: string, productName: string, targetAudience: string, tone = 'professional') {
    const prompt = `Generate 3 ad copy variations for "${productName}". Target: ${targetAudience}. Tone: ${tone}. Include headline, body (2-3 lines), and CTA. Format JSON: [{"headline":"...","body":"...","cta":"..."}]`;
    try {
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY || ''}` },
        body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], max_tokens: 1000 }),
      });
      if (resp.ok) {
        const json: any = await resp.json();
        const text = json.choices?.[0]?.message?.content || '';
        const match = text.match(/\[[\s\S]*\]/);
        return { variations: match ? JSON.parse(match[0]) : [{ headline: text.slice(0, 80), body: '', cta: '' }] };
      }
    } catch { /* fallback */ }
    return { variations: [{ headline: `Découvrez ${productName}`, body: `La solution idéale pour ${targetAudience}`, cta: 'Essayez gratuitement' }] };
  }
}
