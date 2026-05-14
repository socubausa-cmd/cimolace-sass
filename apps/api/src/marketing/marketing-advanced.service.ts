import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class MarketingAdvancedService {
  constructor(private readonly supabase: SupabaseService) {}

  // ── Funnels ──────────────────────────────────────────────────────────────
  async listFunnels(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('marketing_funnels').select('*').eq('tenant_id', tenantId);
    return data ?? [];
  }
  async createFunnel(tenantId: string, name: string, steps: any[]) {
    const { data } = await (this.supabase.client as any).from('marketing_funnels').insert({ tenant_id: tenantId, name, steps: JSON.stringify(steps), status: 'draft' }).select('*').single();
    return data;
  }

  // ── Campaigns ────────────────────────────────────────────────────────────
  async listCampaigns(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('marketing_campaigns').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false });
    return data ?? [];
  }
  async createCampaign(tenantId: string, dto: { name: string; type: string; channel: string; content: string }) {
    const { data } = await (this.supabase.client as any).from('marketing_campaigns').insert({ tenant_id: tenantId, ...dto, status: 'draft' }).select('*').single();
    return data;
  }
  async startCampaign(tenantId: string, campaignId: string) {
    const { data } = await (this.supabase.client as any).from('marketing_campaigns').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', campaignId).eq('tenant_id', tenantId).select('*').single();
    return data;
  }

  // ── Automations ──────────────────────────────────────────────────────────
  async listAutomations(tenantId: string) {
    const { data } = await (this.supabase.client as any).from('marketing_automations').select('*').eq('tenant_id', tenantId);
    return data ?? [];
  }
  async createAutomation(tenantId: string, dto: { name: string; trigger: string; actions: any[] }) {
    const { data } = await (this.supabase.client as any).from('marketing_automations').insert({ tenant_id: tenantId, ...dto, status: 'active' }).select('*').single();
    return data;
  }

  // ── Analytics ────────────────────────────────────────────────────────────
  async getAnalytics(tenantId: string) {
    const [campaigns, leads, promos] = await Promise.all([
      (this.supabase.client as any).from('marketing_campaigns').select('*', { count: 'exact' }).eq('tenant_id', tenantId),
      (this.supabase.client as any).from('leads').select('*', { count: 'exact' }).eq('tenant_id', tenantId),
      (this.supabase.client as any).from('promo_codes').select('*', { count: 'exact' }).eq('tenant_id', tenantId),
    ]);
    return { totalCampaigns: campaigns.count, totalLeads: leads.count, totalPromos: promos.count };
  }
}
